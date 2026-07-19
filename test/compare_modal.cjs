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

/** Statuts rendus. NON_MESURABLE n'est PAS un échec : la référence elle-même est muette. */
const ISO = 'ISO';
const DIFF = 'DIFF';
const NON_MESURABLE = 'NON-MESURABLE';
const ABSENT = 'ABSENT';

let _cache = null;

function loadBaseline(baselineDir = DEFAULT_BASELINE) {
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
function referenceFor(name, baselineDir = DEFAULT_BASELINE) {
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
  if (fs.existsSync(f)) {
    if (e.modalite === 'MIDI') out.tokens = JSON.parse(fs.readFileSync(f, 'utf-8'));
    else if (e.modalite === 'TEXTE') out.text = fs.readFileSync(f, 'utf-8');
  }
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

/** Même périmètre, rendu en TEXTE (modalité TEXTE). */
function soundingText(tokens) {
  return soundingOnly(tokens).map((t) => t.token).join(' ');
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
function registerShiftFor(name, baselineDir = DEFAULT_BASELINE) {
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

/** Texte : on normalise UNIQUEMENT les blancs et les fins de ligne, jamais le contenu. */
const normText = (s) => String(s).replace(/\r\n?/g, '\n').trim().split(/\s+/).join(' ');

/** Jeton timé → forme comparable stable. */
const keyTok = (t) => `${normalizeSaptak(t.token)}@${t.start}-${t.end}`;

/**
 * Confronte une production candidate à la référence, DANS LA MODALITÉ DÉCLARÉE.
 *
 * @param {string} name        nom de grammaire (clé baseline)
 * @param {object} candidate   { tokens:[{token,start,end}] } ou { text:string }
 *                             `null`/absent = la voie candidate ne produit rien
 * @returns {{status, modalite, produit, n_ref, n_cand, detail}}
 */
function compare(name, candidate, baselineDir = DEFAULT_BASELINE) {
  // `candidate.shiftApplied` : la voie déclare avoir APPLIQUÉ le décalage de registre
  // (donc son Hz est celui du natif). Sans cette déclaration, aucune normalisation —
  // on ne suppose jamais que le son est bon, on exige que l'appelant l'atteste.
  const shiftApplied = !!(candidate && candidate.shiftApplied);
  const ref = referenceFor(name, baselineDir);
  if (!ref) return { status: ABSENT, modalite: null, detail: 'absente de la baseline' };

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
    if (a.length === b.length && a.every((x, i) => x === b[i])) {
      return { status: ISO, modalite: 'MIDI', produit: true, n_ref: a.length, n_cand: b.length, detail: null };
    }
    // ISO AU NOMMAGE PRÈS : le natif renumérote le registre quand C4key != 60, Kairos
    // préserve le nom écrit à Hz identique. On réessaie APRÈS avoir aligné le registre —
    // et on l'EXPOSE (renomme:true), pour qu'un ISO-au-nommage ne se lise jamais ISO strict.
    const shift = registerShiftFor(name, baselineDir);
    if (shift && shiftApplied) {
      const bn = candidate.tokens.map((t) => keyTok({ ...t, token: normalizeRegister(t.token, shift) }));
      if (a.length === bn.length && a.every((x, i) => x === bn[i])) {
        return { status: ISO, modalite: 'MIDI', produit: true, n_ref: a.length, n_cand: bn.length,
          renomme: true, shift, detail: `ISO au nommage près : registre aligné de ${shift} octave(s) (C4key), Hz identique` };
      }
    }
    return {
      status: DIFF, modalite: 'MIDI', produit: true, n_ref: a.length, n_cand: b.length,
      cause: (shift && !shiftApplied) ? 'reglage-c4key-absent' : undefined,
      detail: (shift && !shiftApplied)
        ? `décalage de registre de ${shift} octave(s) attendu (C4key) mais NON appliqué par la voie : le son est réellement décalé, ce n'est pas un écart de nommage — cause de provisionnement, pas de transcription. ${firstDiff(a, b)}`
        : firstDiff(a, b),
    };
  }

  if (ref.modalite === 'TEXTE') {
    if (typeof candidate.text !== 'string') {
      return { status: NON_MESURABLE, modalite: 'TEXTE', produit: true, n_ref: normText(ref.text || '').split(' ').length, n_cand: 0,
        detail: 'référence TEXTE mais candidat sans texte — modalités non comparables' };
    }
    const a = normText(ref.text || '').split(' ');
    const b = normText(candidate.text).split(' ');
    if (a.length === b.length && a.every((x, i) => x === b[i])) {
      return { status: ISO, modalite: 'TEXTE', produit: true, n_ref: a.length, n_cand: b.length, detail: null };
    }

    // RÉFÉRENCE SANS AUCUN SÉPARATEUR : comparer la CHAÎNE, pas le découpage.
    //
    // Certaines captures natives écrivent les terminaux ACCOLÉS — `tryGOTO` sort
    // `abbabaccbccca`, un seul mot. Ma voie rend les mêmes caractères mais séparés, parce que
    // je joins toujours par une espace. On opposait donc 1 « mot » à 13 : un écart de FORME
    // compté comme un écart de CONTENU. Signalé par bp3-frontend, vérifié ici sur la capture.
    //
    // ⚠️ On ne normalise QUE lorsque la référence ne porte AUCUN blanc. Retirer les espaces
    // des deux côtés systématiquement masquerait les vraies fautes de découpage là où le natif
    // sépare — ce serait acheter des ISO en aveuglant la mesure.
    if (a.length === 1 && !/\s/.test(String(ref.text || '').trim())) {
      const colle = b.join('');
      if (colle === a[0]) {
        return { status: ISO, modalite: 'TEXTE', produit: true, n_ref: 1, n_cand: 1,
          accole: true, detail: `ISO à l'accolement près : la référence écrit les ${b.length} terminaux sans séparateur` };
      }
    }
    const shiftT = registerShiftFor(name, baselineDir);
    if (shiftT && shiftApplied) {
      const bn = b.map((w) => normalizeRegister(w, shiftT));
      if (a.length === bn.length && a.every((x, i) => x === bn[i])) {
        return { status: ISO, modalite: 'TEXTE', produit: true, n_ref: a.length, n_cand: bn.length,
          renomme: true, shift: shiftT, detail: `ISO au nommage près : registre aligné de ${shiftT} octave(s) (C4key)` };
      }
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

module.exports = { compare, referenceFor, loadBaseline, soundingOnly, soundingText, registerShiftFor, normalizeRegister, ISO, DIFF, NON_MESURABLE, ABSENT };

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
