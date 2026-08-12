#!/usr/bin/env node
/**
 * LE comparateur — unique, MODALITÉ-CONSCIENT, partagé.
 *
 * Décision 2026-07-18 (procédure de test suivi normée, 113 modalité) : on abandonne
 * s1/s2/s3 comme critère. On compare une production CANDIDATE à la baseline native,
 * DANS SA MODALITÉ, bit-à-bit :
 *   MIDI  → jetons timés vs jetons timés  ({token, start, end})
 *   TEXTE → texte vs texte
 * Comparer une modalité avec l'autre n'a pas de sens et rendrait un DIFF trompeur.
 *
 * AUTORITÉ DE LA MODALITÉ : bp3-engine/baseline-native/baseline.json. Elle n'est jamais
 * devinée ni déduite du contenu — c'est la baseline qui la déclare.
 *
 * PARTAGEABLE PAR CONSTRUCTION : ce module ne connaît NI BPScript, NI BPx, NI le frontal.
 * Il prend une production candidate déjà capturée et la confronte à la référence.
 * bp3-frontend l'utilise tel quel pour la Voie A, ce dépôt pour la Voie B.
 *
 * Usage bibliothèque :
 *   const { compare, loadBaseline } = require('./compare_modal.cjs');
 *   compare('765432', { tokens: [...] })        // MIDI
 *   compare('acceleration', { text: '…' })      // TEXTE
 *
 * Usage CLI (diagnostic) :
 *   node compare_modal.cjs --list                 statut déclaré de chaque grammaire
 *   node compare_modal.cjs <grammaire>            modalité + taille de la référence
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_BASELINE = path.resolve(
  __dirname, '..', '..', 'bp3-engine', 'baseline-native',
);

/**
 * ⚠️ UNE RÉFÉRENCE SE LIT SUR UNE RÉVISION, PAS SUR UN RÉPERTOIRE VIVANT.
 *
 * Ce chemin pointe l'arbre de travail d'un AUTRE dépôt. Le 2026-07-19 j'ai mesuré ce répertoire
 * pendant que bp3-engine y refaisait ses captures : à cet instant il en manquait des dizaines, le
 * nombre changeait de minute en minute, et j'en ai conclu — puis PROPAGÉ à deux consommateurs —
 * que sa baseline déclarait des captures inexistantes. Elle n'en déclarait aucune : sur la
 * révision publiée, les 98 captures promises sont là, et son garde d'intégrité le vérifie.
 * J'avais photographié un remplacement en cours et pris la photo pour l'état des choses.
 *
 * La garde ci-dessous ne peut pas empêcher ça — elle CONSTATE seulement l'incohérence et refuse
 * de la traiter comme une mesure. Le vrai remède est de lire une révision figée :
 *
 *   git -C ../bp3-engine archive <rev> baseline-native | tar -x -C <zone>
 *   BASELINE_DIR=<zone>/baseline-native node test/voie_b_status.mjs
 *
 * `BASELINE_DIR` existe pour ça. Tant qu'on lit l'arbre de travail, toute mesure est datée d'un
 * instant qu'on ne contrôle pas.
 */
const BASELINE_DIR = process.env.BASELINE_DIR
  ? path.resolve(process.env.BASELINE_DIR)
  : DEFAULT_BASELINE;

/** Statuts rendus. NON_MESURABLE n'est PAS un échec : la référence elle-même est muette. */
const ISO = 'ISO';
const DIFF = 'DIFF';
const NON_MESURABLE = 'NON-MESURABLE';
const ABSENT = 'ABSENT';

let _cache = null;

function loadBaseline(baselineDir = BASELINE_DIR) {
  if (_cache && _cache.dir === baselineDir) return _cache;
  const file = path.join(baselineDir, 'baseline.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const byName = {};
  for (const e of Object.values(raw.grammaires)) byName[e.grammaire] = e;
  _cache = { dir: baselineDir, meta: { date: raw.date, binaire: raw.binaire, seed: raw.seed, n: raw.n }, byName };
  return _cache;
}

/**
 * Référence d'une grammaire : sa modalité déclarée et sa capture.
 * Rend `produit:false` + `raison` pour les grammaires que le natif lui-même ne produit pas.
 */
function referenceFor(name, baselineDir = BASELINE_DIR) {
  const { byName, dir } = loadBaseline(baselineDir);
  const e = byName[name];
  if (!e) return null;
  const out = { name, modalite: e.modalite, produit: !!e.produit, raison: e.raison || null };
  if (!e.produit) return out;
  // LE CHEMIN DE LA CAPTURE EST DÉCLARÉ PAR LA BASELINE — on ne le RECONSTRUIT plus.
  //
  // On rebâtissait `<nom>.tokens.json` depuis le nom de la grammaire. Ça marche tant que le
  // nom est un nom de fichier valide — et ça casse en SILENCE sinon : `check&` est capturée
  // dans `check_.tokens.json` (l'esperluette est assainie), donc le fichier reconstruit
  // n'existait pas, la référence se chargeait VIDE, et la grammaire ressortait en écart de
  // contenu alors qu'on ne lui avait rien opposé. Signalé par bp3-frontend, vérifié ici.
  //
  // L'entrée de baseline porte un champ `capture` qui dit exactement où est le fichier.
  // On le lit. C'est la règle que bp3-engine énonce lui-même : LES CHAMPS FONT FOI, PAS UNE
  // convention qu'on redevine à côté.
  const rel = e.capture
    || (e.modalite === 'MIDI' ? path.join('captures', `${name}.tokens.json`)
                              : path.join('captures', `${name}.text.txt`));
  const f = path.join(dir, rel);
  // ⚠️ LE CORRECTIF PRÉCÉDENT A TRAITÉ L'INSTANCE, PAS LA CLASSE. Lire le chemin DÉCLARÉ au lieu
  // de le reconstruire a réglé `check&` — mais le mode de défaillance a survécu intact : quand le
  // fichier déclaré n'existe PAS, on rendait `out` sans `tokens`, donc une référence VIDE, sans un
  // mot. La grammaire ressortait alors en écart de contenu contre « ∅ », ce qui se lit « le natif
  // ne produit rien » alors que la vérité est « je n'ai pas su lire la référence ». Deux phrases
  // opposées, un seul affichage.
  // ⚠️ CE QUI M'A FAIT TROUVER LE DÉFAUT N'ÉTAIT PAS UN DÉFAUT — et je le note ici pour que
  // personne ne relise ce garde comme la preuve d'un manque chez bp3-engine. J'avais mesuré
  // « 27 des 98 captures déclarées sont absentes » et je l'avais propagé. C'était FAUX : je
  // lisais son arbre de travail PENDANT une recapture, à un moment où le répertoire était à
  // moitié réécrit. Sur la révision publiée, les 98 captures promises sont toutes là — vérifié
  // sur `11f079d`, zéro absente, et son propre garde d'intégrité le contrôle à chaque passage.
  // Le garde ci-dessous reste JUSTE et nécessaire : rendre une référence vide en silence est un
  // mensonge d'oracle quelle qu'en soit la cause. Mais sa cause réelle est la LECTURE D'UN
  // RÉPERTOIRE VIVANT, traitée plus haut (`BASELINE_DIR`), pas une baseline incomplète.
  // On ne devine donc PAS un repli, et on ne compare surtout pas à du vide : on DIT que la
  // référence manque, et l'appelant en fait un statut distinct — jamais un DIFF.
  if (!fs.existsSync(f)) {
    out.capture_absente = rel;
    return out;
  }
  if (e.modalite === 'MIDI') out.tokens = JSON.parse(fs.readFileSync(f, 'utf-8'));
  else if (e.modalite === 'TEXTE') out.text = fs.readFileSync(f, 'utf-8');
  return out;
}

/**
 * Jetons SONNANTS d'une capture BPx — À UTILISER PAR LES DEUX VOIES.
 *
 * La baseline native ne capture QUE ce qui sonne. Une capture BPx brute contient en plus
 * les silences, les prolongations et les échos de contrôle : comparer sans filtrer
 * confronterait deux choses différentes (765432 : 1481 jetons bruts pour 823 sonnants).
 *
 * Ce filtre vit ICI, et non chez chaque producteur, pour une raison précise : si la Voie A
 * et la Voie B filtraient chacune de leur côté, un écart de filtre rendrait leurs statuts
 * SILENCIEUSEMENT incomparables — le pire des défauts pour une mesure censée les confronter.
 * Une seule définition, donc un seul périmètre.
 */
function soundingOnly(tokens) {
  return (tokens || [])
    .filter((t) => t && t.type === 'terminal' && t.token !== '-' && t.token !== '_')
    .map((t) => ({ token: t.token, start: t.start, end: t.end }));
}

/** Même périmètre, rendu en TEXTE. */
function soundingText(tokens) {
  return soundingOnly(tokens).map((t) => t.token).join(' ');
}

/**
 * PÉRIMÈTRE DE L'AXE TEXTE — ce que le moteur natif IMPRIME, silences compris.
 *
 * La décision du 2026-08-12 sépare deux axes, et un seul périmètre ne peut pas les servir tous les
 * deux : l'axe SONNANT ne retient que ce qui sonne, l'axe TEXTE retient aussi ce que le natif
 * écrit sans le faire sonner. Mesuré sur les captures natives : 7 des 37 grammaires textuelles
 * impriment des silences ou des prolongations — jusqu'à 652 sur 3860 (`dhin`). Leur appliquer le
 * périmètre sonnant creuse un déficit égal, exactement, au nombre de silences imprimés.
 *
 * LE CRITÈRE EST LE TYPE DÉCLARÉ, comme sur l'autre axe : `terminal` et `rest` s'impriment,
 * `control` non — un marqueur de bloc n'est un terminal sur aucun axe. Jamais la durée : un silence
 * qui occupe du temps et une prolongation de durée nulle portent le MÊME type et se traitent pareil.
 *
 * Les deux périmètres vivent ICI, dans la pièce partagée, pour la raison qui vaut depuis le début :
 * deux voies qui définiraient chacune ce qui compte rendraient leurs statuts silencieusement
 * incomparables. Une seule définition, deux axes — comme la décision les nomme.
 */
function printedOnly(tokens) {
  return (tokens || [])
    .filter((t) => t && (t.type === 'terminal' || t.type === 'rest'))
    .map((t) => ({ token: t.token, start: t.start, end: t.end }));
}

/** Même périmètre, rendu en TEXTE (modalité TEXTE). */
function printedText(tokens) {
  return printedOnly(tokens).map((t) => t.token).join(' ');
}

/**
 * Décalage de REGISTRE dû à C4key, lu depuis le -se que la baseline référence.
 *
 * Le moteur natif RENUMÉROTE le nom quand C4key differe de 60 (Encode.c:678 fait
 * key += C4key-60), alors que Kairos PRÉSERVE le nom écrit et baisse la fréquence
 * (design E-016) : à C4key=48, le natif capture `do3` là où nos deux voies écrivent
 * `do4` — mais kairos [434] a PROUVÉ que le Hz est identique (130.81 Hz des deux
 * côtés). C est donc un écart de NOMMAGE à son IDENTIQUE, pas une divergence.
 *
 * Le -se de la baseline donne le décalage ATTENDU. Il ne donne PAS le verdict : celui-ci
 * se joue sur le SON. Normaliser le nom n'est légitime que si la voie candidate a
 * RÉELLEMENT appliqué le décalage (son Hz vaut alors celui du natif, seul le nom diffère).
 *
 * CORRECTION [642], et c'est un piège que ma première version n'évitait pas : j'avais rendu
 * la normalisation SYMÉTRIQUE, en croyant bien faire. Or les deux voies ne sont PAS dans la
 * même situation. La Voie A applique le décalage (c4key lu du -se) → son Hz est juste, seul
 * le nom diffère → ISO au nommage près. La Voie B ne l'applique pas (elle n'a pas de -se) →
 * Kairos résout au défaut c4key=60 → son Hz est VRAIMENT décalé d'un octave. Normaliser là
 * transformerait un VRAI écart de son en faux ISO — exactement le masquage qu'on refuse.
 * L'asymétrie est donc CORRECTE : elle SURFACE le trou de réglages de la Voie B.
 */
function registerShiftFor(name, baselineDir = BASELINE_DIR) {
  const { byName, dir } = loadBaseline(baselineDir);
  const e = byName[name];
  const se = e && e.config && e.config['-se'];
  if (!se) return 0;
  const p = path.join(dir, '..', 'test-data', se);
  if (!fs.existsSync(p)) return 0;
  const raw = fs.readFileSync(p, 'utf-8');
  if (!raw.trimStart().startsWith('{')) return 0;
  let j; try { j = JSON.parse(raw); } catch { return 0; }
  const c4 = j.C4key ? Number(j.C4key.value) : 60;
  if (!Number.isFinite(c4) || c4 === 60) return 0;
  return (60 - c4) / 12;
}

/**
 * Ramène le numéro de registre du candidat sur celui de la référence, MAIS SEULEMENT si
 * l écart est EXACTEMENT le décalage attendu. Tout résidu non expliqué reste un vrai DIFF :
 * on ne normalise pas une divergence, on aligne une CONVENTION DE NOMMAGE à son égal.
 */
function normalizeRegister(token, shift) {
  if (!shift) return token;
  const m = /^(.*?)(-?\d+)$/.exec(token);
  if (!m) return token;
  return `${m[1]}${parseInt(m[2], 10) - shift}`;
}

/**
 * NOTATION SAPTAK ↔ NOTATION NUMÉRIQUE — deux écritures du MÊME registre.
 *
 * Le natif écrit le sargam en degré + chiffre (`sa3`, `pa3`, `ni3`, `sa4`). BPScript écrit le
 * registre en PRÉFIXE NOMMÉ, séparateur souligné (`mandra_sa`, `madhya_sa`) — c'est la
 * convention ratifiée par Romain (TAAR-TOK, `189128b`), adoptée parce que l'espace faisait
 * tokeniser `taar sa` en DEUX terminaux et que le registre aigu n'était jamais résolu.
 *
 * Correspondance MESURÉE par kairos contre la capture native de `vina` : chiffre N → registre
 * saptak d'index N−3. Donc 3 = mandra, 4 = madhya, 5 = taar.
 *
 * ⚠️ POURQUOI CETTE NORMALISATION EST NÉCESSAIRE ET NON COMPLAISANTE. Tant que la fixture
 * écrivait `sa3`, elle « matchait » le natif — mais AUCUNE hauteur ne se résolvait : `sa3` ne
 * correspond à aucun registre de l'alphabet sargam, qui est configuré en saptak. C'était un ISO
 * DE NOMS, avec du vide derrière. Corriger la fixture rend la hauteur réelle (mesuré :
 * `mandra_sa` = 120.00 Hz, `madhya_sa` = 240.00 Hz) et fait diverger les NOMS — d'où cette
 * table, qui compare ce que les deux notations DÉSIGNENT au lieu de leurs caractères.
 * On ne masque donc pas un écart : on cesse d'en fabriquer un.
 */
const SAPTAK_PAR_CHIFFRE = { 3: 'mandra', 4: 'madhya', 5: 'taar' };
const DEGRES_SARGAM = ['sa', 're', 'ga', 'ma', 'pa', 'dha', 'ni'];
function normalizeSaptak(token) {
  const m = new RegExp(`^(${DEGRES_SARGAM.join('|')})([0-9])$`).exec(String(token));
  if (!m) return token;
  const registre = SAPTAK_PAR_CHIFFRE[m[2]];
  return registre ? `${registre}_${m[1]}` : token;
}

/**
 * DEUX ORTHOGRAPHES D'UNE MÊME HAUTEUR SONT LA MÊME HAUTEUR.
 *
 * Arbitrage Romain du 2026-08-12 : « bémol contre dièse à hauteur égale compte CONFORME », et
 * la scène `.bps` n'a pas à porter le choix d'écriture. Le natif capture `Bb3` là où la chaîne
 * écrit `A#3` — deux graphies, une seule note.
 *
 * On ne compare donc pas les caractères, on compare CE QU'ILS DÉSIGNENT : le nom est ramené à
 * son rang en demi-tons, celui de la numérotation MIDI (`do4` = `C4` = 60). L'altération est
 * portée dans le rang, ce qui rend d'un même geste `Cb4` et `B3`, ou `E#4` et `F4`.
 *
 * PORTÉE STRICTE, et c'est le point : seuls les noms de note occidentaux ou solfégiques — une
 * lettre ou un degré, ses altérations, un chiffre d'octave — sont ramenés. Un degré sargam, un
 * bol, un symbole d'alphabet de test traversent intacts : leur graphie EST leur identité, et les
 * ramener inventerait des égalités que personne n'a tranchées.
 */
const DEMI_TONS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const SOLFEGE_VERS_LETTRE = { do: 'c', ré: 'd', re: 'd', mi: 'e', fa: 'f', sol: 'g', la: 'a', si: 'b' };
const RE_SOLFEGE = /^(do|ré|re|mi|fa|sol|la|si)([#b]*)(-?\d+)$/i;
const RE_LETTRE = /^([A-Ga-g])([#b]*)(-?\d+)$/;
function rangEnDemiTons(token) {
  const s = String(token);
  let lettre; let alterations; let octave;
  let m = RE_SOLFEGE.exec(s);
  if (m) { lettre = SOLFEGE_VERS_LETTRE[m[1].toLowerCase()]; [, , alterations, octave] = m; }
  else {
    m = RE_LETTRE.exec(s);
    if (!m) return null;
    lettre = m[1].toLowerCase(); [, , alterations, octave] = m;
  }
  let alt = 0;
  for (const c of alterations) alt += c === '#' ? 1 : -1;
  return 12 * (Number(octave) + 1) + DEMI_TONS[lettre] + alt;
}
/** Nom de note → forme canonique de sa HAUTEUR ; tout autre symbole traverse intact. */
function normalizeEnharmonie(token) {
  const rang = rangEnDemiTons(token);
  return rang === null ? token : `demiton:${rang}`;
}

/**
 * SIGNES DE STRUCTURE d'une capture texte — accolade et virgule de polymétrie, parenthèse d'un
 * contrôle imprimé, le contrôle lui-même, et le NOMBRE NU, qui est une valeur de temps : durée,
 * signature (`4+4/6`), échelle. Leur présence dit que la référence porte une structure, donc que
 * la comparaison en demande une.
 *
 * Le nombre nu n'est un terminal dans AUCUN des alphabets du corpus texte — abc, bols, comptes
 * kathak, symboles structurels : tous nomment leurs terminaux par des lettres ou des syllabes.
 * Vérifié sur les captures avant de l'inscrire ici.
 */
const SIGNES_DE_STRUCTURE = /[{},()]|_[a-zA-Z]+\(|(?:^|\s)\d+(?:[/+]\d+)*(?=\s|$)/;

/** Texte : on normalise UNIQUEMENT les blancs et les fins de ligne, jamais le contenu. */
const normText = (s) => String(s).replace(/\r\n?/g, '\n').trim().split(/\s+/).join(' ');

/** Jeton timé → forme comparable stable. */
const keyTok = (t) => `${normalizeEnharmonie(normalizeSaptak(t.token))}@${t.start}-${t.end}`;
/** Même clé, SANS correspondance de notation — pour savoir si l'ISO en a eu besoin. */
const keyBrut = (t) => `${t.token}@${t.start}-${t.end}`;

/**
 * L'AXE SONNANT COMPARE UN ENSEMBLE MINUTE, PAS UNE SUITE — arbitrage Romain du 2026-08-12.
 *
 * Ses mots : « ce dont je veux m'assurer, c'est que les MÊMES NOTES soient produites aux MÊMES
 * INSTANTS avec la MÊME DURÉE. L'ORDRE D'AFFICHAGE N'A AUCUNE IMPORTANCE. » Deux voix simultanées
 * s'écrivent dans un ordre que le producteur choisit ; ce choix ne s'entend pas.
 *
 * ⛔ CE QUE ÇA NE RELÂCHE PAS. Rien sur les instants, rien sur les durées, rien sur les
 * multiplicités : la clé comparée porte le nom, le début ET la fin, et deux occurrences du même
 * jeton comptent deux fois — c'est un MULTIENSEMBLE, jamais un ensemble. Une grammaire dont un
 * seul instant diffère reste divergente. Seul le RANG cesse de compter.
 *
 * ⛔ ET ÇA NE VAUT QUE SUR L'AXE SONNANT. Sur l'axe TEXTE, la SUITE des terminaux compte — c'est
 * une décision distincte, du même jour, qui ne bouge pas.
 */
function multiensemble(cles) {
  const m = new Map();
  for (const k of cles) m.set(k, (m.get(k) || 0) + 1);
  return m;
}

/** Deux multiensembles portent-ils exactement les mêmes éléments, aux mêmes multiplicités ? */
function memeMultiensemble(a, b) {
  if (a.length !== b.length) return false;
  const ma = multiensemble(a); const mb = multiensemble(b);
  if (ma.size !== mb.size) return false;
  for (const [k, n] of ma) if (mb.get(k) !== n) return false;
  return true;
}

/**
 * Écart entre deux multiensembles, dit en éléments EN TROP et MANQUANTS.
 * « La première divergence au rang N » n'a plus de sens quand le rang ne compte pas.
 */
function diffMultiensemble(a, b) {
  const ma = multiensemble(a); const mb = multiensemble(b);
  const manquants = []; const enTrop = [];
  for (const [k, n] of ma) { const d = n - (mb.get(k) || 0); if (d > 0) manquants.push(d > 1 ? `${k} ×${d}` : k); }
  for (const [k, n] of mb) { const d = n - (ma.get(k) || 0); if (d > 0) enTrop.push(d > 1 ? `${k} ×${d}` : k); }
  const bout = (l) => (l.length > 3 ? `${l.slice(0, 3).join(', ')} … (+${l.length - 3})` : l.join(', '));
  if (!manquants.length && !enTrop.length) return `comptes différents : ${a.length} vs ${b.length}`;
  const parts = [];
  if (manquants.length) parts.push(`${manquants.length} de la référence absent(s) du candidat : ${bout(manquants)}`);
  if (enTrop.length) parts.push(`${enTrop.length} du candidat absent(s) de la référence : ${bout(enTrop)}`);
  return parts.join(' · ');
}

/**
 * Confronte une production candidate à la référence, DANS LA MODALITÉ DÉCLARÉE.
 *
 * @param {string} name        nom de grammaire (clé baseline)
 * @param {object} candidate   { tokens:[{token,start,end}] } ou { text:string }
 *                             `null`/absent = la voie candidate ne produit rien
 * @returns {{status, modalite, produit, n_ref, n_cand, detail}}
 */
function compare(name, candidate, baselineDir = BASELINE_DIR) {
  // `candidate.shiftApplied` : la voie déclare avoir APPLIQUÉ le décalage de registre
  // (donc son Hz est celui du natif). Sans cette déclaration, aucune normalisation —
  // on ne suppose jamais que le son est bon, on exige que l'appelant l'atteste.
  const shiftApplied = !!(candidate && candidate.shiftApplied);
  const ref = referenceFor(name, baselineDir);
  if (!ref) return { status: ABSENT, modalite: null, detail: 'absente de la baseline' };

  // RÉFÉRENCE DONT LE PROPRIÉTAIRE ANNONCE QU'ELLE EST FAUSSE — on ne publie pas contre elle.
  //
  // Préavis bp3-engine du 2026-08-12 : ses captures de `PP` et de `check&` reposent sur un fichier
  // de réglages EMPRUNTÉ, que la grammaire ne déclare pas. Mesuré chez lui, binaire gelé, une
  // variable déplacée à la fois : `PP` porte des instants divisés par 6,67 (X1 600-750 au lieu de
  // 4000-5000), `check&` accorde une octave EN DESSOUS de ce que la grammaire déclare (220 Hz
  // contre 440), durées multipliées par trois. Romain a levé le gel pour ces DEUX entrées, et pour
  // rien d'autre ; les 94 autres restent scellées.
  //
  // Publier un verdict contre une référence dont le propriétaire vient de dire qu'elle est fausse
  // rendrait un chiffre qu'on sait périmé — dans un sens comme dans l'autre : un DIFF imputerait à
  // la scène l'écart du réglage emprunté, un ISO consacrerait le mauvais instant. La suspension vit
  // ICI, dans la pièce PARTAGÉE, pour la raison qui vaut depuis le début : les deux voies comparent
  // contre les mêmes deux entrées, et une seule qui suspendrait laisserait l'autre publier.
  //
  // LEVÉE : le second courrier de bp3-engine, qui annonce le geste fait et les nouvelles empreintes.
  // Rien ici ne se retire sans lui — et alors les deux entrées sortent de cette liste, pas une.
  const REFERENCES_EN_REVISION = {
    PP: 'réglages empruntés — instants divisés par 6,67 (X1 600-750 au lieu de 4000-5000)',
    'check&': "réglages empruntés — accord une octave en dessous (220 Hz contre 440), durées ×3",
  };
  if (Object.prototype.hasOwnProperty.call(REFERENCES_EN_REVISION, name)) {
    return {
      status: NON_MESURABLE, modalite: ref.modalite, produit: !!ref.produit,
      n_ref: ref.produit ? sizeOf(ref) : 0, n_cand: candidate ? sizeOf(candidate) : 0,
      reference_en_revision: true,
      detail: `référence en cours de révision par bp3-engine (préavis du 2026-08-12) — ${REFERENCES_EN_REVISION[name]}. `
        + 'Comparer contre elle rendrait un chiffre déjà su faux.',
    };
  }

  // La référence est DÉCLARÉE mais son relevé n'existe pas : on ne peut RIEN conclure. Ce cas
  // doit rester visiblement distinct d'un vrai écart — le confondre avec un DIFF, c'est imputer
  // à la voie candidate une divergence qu'on n'a jamais mesurée.
  if (ref.capture_absente) {
    return {
      status: NON_MESURABLE, modalite: ref.modalite, produit: true,
      n_ref: null, n_cand: candidate ? sizeOf(candidate) : 0,
      detail: `référence introuvable — la baseline déclare « ${ref.capture_absente} », absent du disque`,
    };
  }

  // La RÉFÉRENCE est muette : rien à mesurer, ce n'est pas un échec de la voie candidate.
  if (!ref.produit) {
    return {
      status: NON_MESURABLE, modalite: null, produit: false,
      n_ref: 0, n_cand: candidate ? sizeOf(candidate) : 0,
      detail: `le natif ne produit pas — ${ref.raison || 'raison non déclarée'}`,
    };
  }

  const produitCand = !!candidate && sizeOf(candidate) > 0;
  if (!produitCand) {
    return {
      status: DIFF, modalite: ref.modalite, produit: false,
      n_ref: sizeOf(ref), n_cand: 0,
      detail: 'la voie candidate ne produit rien alors que la référence produit',
    };
  }

  // RÉFÉRENCE NON COMPARABLE EN CONTENU (`capture_comparable:false`, baseline v11).
  //
  // Certaines grammaires produisent un contenu volontairement instable : `trySrand` appelle
  // `_randomize`, qui ré-ensemence le tirage avec un nombre arbitraire et PRIME sur `--seed`.
  // Elle sort un nombre de jetons stable, dans un ORDRE différent à chaque exécution, même à
  // graine fixe — et c'est son OBJET (elle existe pour démontrer `_srand`/`_randomize`,
  // `-gr.trySrand:7` et son propre commentaire l'annoncent).
  // Diffé comme les autres, elle rendait un ÉCHEC FABRIQUÉ. On compare donc ce qui a un sens
  // ici — le COMPTE — et jamais la séquence.
  if (ref.capture_comparable === false) {
    const nRef = sizeOf(ref);
    const nCand = sizeOf(candidate);
    return nRef === nCand
      ? { status: ISO, modalite: ref.modalite, produit: true, n_ref: nRef, n_cand: nCand,
          comptesSeuls: true, detail: `compte identique (${nRef}) — contenu volontairement instable, non comparé` }
      : { status: DIFF, modalite: ref.modalite, produit: true, n_ref: nRef, n_cand: nCand,
          comptesSeuls: true, detail: `compte ${nCand} vs ${nRef} — contenu volontairement instable, seul le compte est comparable` };
  }

  if (ref.modalite === 'MIDI') {
    if (!Array.isArray(candidate.tokens)) {
      return { status: NON_MESURABLE, modalite: 'MIDI', produit: true, n_ref: (ref.tokens || []).length, n_cand: 0,
        detail: 'référence MIDI mais candidat sans jetons timés — modalités non comparables' };
    }
    const a = (ref.tokens || []).map(keyTok);
    const b = candidate.tokens.map(keyTok);
    if (memeMultiensemble(a, b)) {
      // UN ISO OBTENU PAR CORRESPONDANCE DE NOTATION NE DOIT PAS SE LIRE COMME UN ISO STRICT.
      //
      // `normalizeSaptak` fait coïncider `sa4` et `madhya_sa` : c'est légitime, ils désignent le
      // MÊME registre (correspondance mesurée par kairos contre la capture native). Mais le
      // natif plaque le sargam sur la grille occidentale (`sa4` = C4 = 261.63 Hz) là où notre
      // alphabet garde l'ancre traditionnelle (`madhya_sa` = 240 Hz) : il reste un facteur de
      // DIAPASON de 0.917, uniforme, non tranché à ce jour (escaladé par kairos).
      // Rendre `ISO` tout court laisserait croire que la production est identique JUSQU'À LA
      // FRÉQUENCE. Elle ne l'est pas — le registre et les intervalles le sont, l'absolu non.
      // On le DIT dans le verdict, comme on le fait déjà pour l'alignement de registre C4key :
      // acheter un ISO en taisant ce qu'il recouvre serait aveugler la mesure.
      // DEUX CORRESPONDANCES, DEUX VERDICTS — les confondre ferait porter à l'enharmonie une
      // réserve qui ne la concerne pas. Le saptak garde sa réserve de diapason ; l'enharmonie
      // n'en a aucune, Romain l'a tranchée « conforme » et la hauteur est la MÊME par
      // construction. On dit donc laquelle a joué.
      // CE QUE L'ISO A COÛTÉ SE DIT — et le rang ne servant plus, ces témoins se prennent sur les
      // multiensembles, jamais sur des paires de même index qui n'ont plus de sens.
      const changeParSaptak = (l) => l.some((t) => normalizeSaptak(t.token) !== t.token);
      const parSaptak = changeParSaptak(ref.tokens || []) || changeParSaptak(candidate.tokens);
      const parEnharmonie = !memeMultiensemble((ref.tokens || []).map(keyBrut), candidate.tokens.map(keyBrut));
      // L'ORDRE A-T-IL JOUÉ ? Même multiensemble, suites différentes rang à rang. On le DIT, comme
      // on dit la notation : un ISO qui a demandé un relâchement ne se lit pas comme un ISO strict.
      const parOrdre = a.some((x, i) => x !== b[i]);
      if (parSaptak) {
        return { status: ISO, modalite: 'MIDI', produit: true, n_ref: a.length, n_cand: b.length,
          notation: 'saptak', detail: 'ISO à la NOTATION près : registre équivalent (sa4 ↔ madhya_sa, '
            + 'correspondance mesurée). Le diapason reste NON TRANCHÉ — ancre traditionnelle 240 Hz '
            + 'contre ancre occidentale du natif, facteur 0.917 : la hauteur ABSOLUE n\'est pas prouvée identique.' };
      }
      if (parEnharmonie) {
        return { status: ISO, modalite: 'MIDI', produit: true, n_ref: a.length, n_cand: b.length,
          notation: 'enharmonie', ordre: parOrdre ? 'libre' : undefined,
          detail: 'ISO — orthographes différentes d\'une MÊME hauteur (Bb3 ↔ A#3). La scène ne porte '
            + 'pas le choix d\'écriture (arbitrage Romain 2026-08-12).'
            + (parOrdre ? ' Ordre d\'affichage différent : les mêmes notes sonnent aux mêmes instants pour les mêmes durées.' : '') };
      }
      if (parOrdre) {
        return { status: ISO, modalite: 'MIDI', produit: true, n_ref: a.length, n_cand: b.length,
          ordre: 'libre',
          detail: 'ISO — mêmes notes, mêmes instants, mêmes durées ; seul l\'ORDRE D\'AFFICHAGE '
            + 'diffère, et il ne s\'entend pas (arbitrage Romain 2026-08-12).' };
      }
      return { status: ISO, modalite: 'MIDI', produit: true, n_ref: a.length, n_cand: b.length, detail: null };
    }
    // ISO AU NOMMAGE PRÈS : le natif renumérote le registre quand C4key != 60, Kairos
    // préserve le nom écrit à Hz identique. On réessaie APRÈS avoir aligné le registre —
    // et on l'EXPOSE (renomme:true), pour qu'un ISO-au-nommage ne se lise jamais ISO strict.
    const shift = registerShiftFor(name, baselineDir);
    if (shift && shiftApplied) {
      const bn = candidate.tokens.map((t) => keyTok({ ...t, token: normalizeRegister(t.token, shift) }));
      if (memeMultiensemble(a, bn)) {
        // Deux relâchements peuvent se composer, et alors on les nomme TOUS LES DEUX : un ISO qui
        // a demandé l'alignement de registre ET la liberté d'ordre ne se lit pas comme un ISO strict.
        const ordreAJoue = a.some((x, i) => x !== bn[i]);
        return { status: ISO, modalite: 'MIDI', produit: true, n_ref: a.length, n_cand: bn.length,
          renomme: true, shift, ordre: ordreAJoue ? 'libre' : undefined,
          detail: `ISO au nommage près : registre aligné de ${shift} octave(s) (C4key), Hz identique`
            + (ordreAJoue ? ". L'ORDRE D'AFFICHAGE diffère aussi : mêmes notes, mêmes instants, mêmes durées." : '') };
      }
    }
    return {
      status: DIFF, modalite: 'MIDI', produit: true, n_ref: a.length, n_cand: b.length,
      cause: (shift && !shiftApplied) ? 'reglage-c4key-absent' : undefined,
      detail: (shift && !shiftApplied)
        ? `décalage de registre de ${shift} octave(s) attendu (C4key) mais NON appliqué par la voie : le son est réellement décalé, ce n'est pas un écart de nommage — cause de provisionnement, pas de transcription. ${diffMultiensemble(a, b)}`
        : diffMultiensemble(a, b),
    };
  }

  if (ref.modalite === 'TEXTE') {
    if (typeof candidate.text !== 'string') {
      return { status: NON_MESURABLE, modalite: 'TEXTE', produit: true, n_ref: normText(ref.text || '').split(' ').length, n_cand: 0,
        detail: 'référence TEXTE mais candidat sans texte — modalités non comparables' };
    }
    // Même règle que sur l'axe sonnant : deux orthographes d'une même hauteur sont la même
    // hauteur (arbitrage Romain 2026-08-12). Tout symbole qui n'est pas un nom de note traverse.
    const motComparable = (w) => normalizeEnharmonie(normalizeSaptak(w));
    const a = normText(ref.text || '').split(' ').map(motComparable);
    const b = normText(candidate.text).split(' ').map(motComparable);
    if (a.length === b.length && a.every((x, i) => x === b[i])) {
      return { status: ISO, modalite: 'TEXTE', produit: true, n_ref: a.length, n_cand: b.length, detail: null };
    }

    // LA GRAPHIE D'IMPRESSION NE SE COMPARE PAS — arbitrage Romain du 2026-08-12.
    //
    // On compare la SUITE DES TERMINAUX et la STRUCTURE ; l'espacement, le collage des signes et
    // la mise en page ne portent aucune information et restent libres. Le natif écrit
    // `bcbcbcbcbc` là où je rends `b c b c b c b c b c` : même suite, deux mises en page.
    //
    // Le test précédent ne relâchait l'espacement que si la référence n'avait AUCUN blanc — une
    // demi-mesure : il attrapait `tryGOTO`, il ratait toute capture qui mélange les deux. La
    // décision retire la condition, et rien n'est acheté au passage : deux suites de terminaux
    // différentes restent différentes une fois les blancs ôtés.
    const sansBlancs = (s) => String(s).replace(/\s+/g, '');
    if (sansBlancs(ref.text || '') === sansBlancs(candidate.text)) {
      return { status: ISO, modalite: 'TEXTE', produit: true, n_ref: a.length, n_cand: b.length,
        graphie: 'espacement', detail: `ISO — même suite de terminaux, mise en page différente (${a.length} mot(s) contre ${b.length}). `
          + "L'espacement ne se compare pas (arbitrage Romain 2026-08-12)." };
    }
    const shiftT = registerShiftFor(name, baselineDir);
    if (shiftT && shiftApplied) {
      const bn = b.map((w) => normalizeRegister(w, shiftT));
      if (a.length === bn.length && a.every((x, i) => x === bn[i])) {
        return { status: ISO, modalite: 'TEXTE', produit: true, n_ref: a.length, n_cand: bn.length,
          renomme: true, shift: shiftT, detail: `ISO au nommage près : registre aligné de ${shiftT} octave(s) (C4key)` };
      }
    }
    // LA STRUCTURE FAIT PARTIE DE LA COMPARAISON, ET LE PRODUCTEUR NE LA REND PAS.
    //
    // La décision demande de comparer la suite des terminaux ET la structure — groupes,
    // polymétrie, frontières de bloc. Quand la référence porte cette structure et que la voie
    // candidate rend une suite plate, on ne compare PAS ce que la règle demande. Rendre DIFF
    // imputerait à la scène un écart qu'on n'a pas mesuré ; rendre ISO l'achèterait en fermant
    // les yeux. On le DIT, et la cause est nommée : c'est le rendu de surface qui manque.
    //
    // ⚠️ CE DÉCLENCHEUR NE REGARDAIT QUE LA RÉFÉRENCE, ET C'ÉTAIT UN DÉFAUT DE JUGE PARTAGÉ.
    // Il suffisait que le NATIF porte une accolade pour que la prudence tombe — y compris sur une
    // voie qui rend parfaitement la structure. Mesuré par bp3-frontend : huit de ses verdicts
    // passaient en non-mesurable alors que sa chaîne rend groupes, imbrication et virgules. Une
    // prudence juste chez l'un devenait un faux non-mesurable chez l'autre.
    // Il regarde donc LES DEUX CÔTÉS : on ne renonce que si la référence porte la structure ET
    // que le candidat n'en rend aucune.
    //
    // ⚠️ ET IL NE RENONCE PAS SUR UN CANDIDAT PLUS COURT — second défaut de la même prudence,
    // mesuré par bp3-frontend sur `gramgene2` : sa référence porte ~60 mots, son rendu s'arrête à
    // 11 et finit sur une suite de tirets. Sa sortie est plate PARCE QU'ELLE EST TRONQUÉE, et la
    // platitude est ici le SYMPTÔME de l'écart, pas une incapacité à rendre la structure. Renoncer
    // là efface la divergence même qu'on cherche. Une voie qui rend MOINS que la référence a
    // divergé ; seule une voie qui en rend AUTANT, à plat, se heurte vraiment à un défaut de rendu.
    const candidatPlusCourt = b.length < a.length;
    if (SIGNES_DE_STRUCTURE.test(String(ref.text || '')) && !SIGNES_DE_STRUCTURE.test(String(candidate.text || ''))
        && !candidatPlusCourt) {
      return {
        status: NON_MESURABLE, modalite: 'TEXTE', produit: true, n_ref: a.length, n_cand: b.length,
        detail: 'la référence porte la STRUCTURE (groupes, polymétrie, contrôles imprimés) et la '
          + "comparaison la demande ; le rendu d'énumération ne rend qu'une suite plate de terminaux. "
          + `Écart de suite, hors structure : ${firstDiff(a, b)}`,
      };
    }
    return {
      status: DIFF, modalite: 'TEXTE', produit: true, n_ref: a.length, n_cand: b.length,
      detail: firstDiff(a, b),
    };
  }

  return { status: NON_MESURABLE, modalite: ref.modalite, produit: true, detail: `modalité inconnue : ${ref.modalite}` };
}

function sizeOf(x) {
  if (!x) return 0;
  if (Array.isArray(x.tokens)) return x.tokens.length;
  if (typeof x.text === 'string') return normText(x.text) ? normText(x.text).split(' ').length : 0;
  return 0;
}

function firstDiff(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return `1re divergence au rang ${i} : référence «${a[i] ?? '∅'}» vs candidat «${b[i] ?? '∅'}»`;
  }
  return `longueurs différentes : ${a.length} vs ${b.length}`;
}

module.exports = { compare, referenceFor, loadBaseline, soundingOnly, soundingText, printedOnly, printedText, registerShiftFor, normalizeRegister, normalizeSaptak, normalizeEnharmonie, rangEnDemiTons, memeMultiensemble, diffMultiensemble, ISO, DIFF, NON_MESURABLE, ABSENT };

// ── CLI de diagnostic ────────────────────────────────────────────────────────
if (require.main === module) {
  const arg = process.argv[2];
  const { byName, meta } = loadBaseline();
  if (!arg || arg === '--list') {
    console.log(`baseline ${meta.date} · ${meta.binaire} · seed ${meta.seed} · ${meta.n} grammaires`);
    const mods = {};
    for (const e of Object.values(byName)) {
      const k = e.produit ? e.modalite : 'ne produit pas';
      mods[k] = (mods[k] || 0) + 1;
    }
    for (const [k, n] of Object.entries(mods)) console.log(`  ${String(k).padEnd(16)} ${n}`);
  } else {
    const r = referenceFor(arg);
    if (!r) { console.error(`${arg} : absente de la baseline`); process.exit(1); }
    console.log(`${arg} · modalité ${r.modalite ?? '—'} · produit ${r.produit}`);
    if (!r.produit) console.log(`  raison : ${r.raison}`);
    else console.log(`  référence : ${r.tokens ? r.tokens.length + ' jetons timés' : (r.text ? normText(r.text).split(' ').length + ' mots' : 'capture absente')}`);
  }
}
