#!/usr/bin/env node
/**
 * CONVERTIT UNE LIBRAIRIE DE JSON VERS BPSCRIPT.
 *
 * La demande de Romain : « je veux que ton interpréteur interprète le contenu des librairies de la
 * même façon qu'il interprète le contenu des scènes ». Le vocabulaire se dit donc dans le langage
 * qu'il sert, et depuis le 2026-08-17 la syntaxe d'une librairie EST celle de la tête de scène.
 *
 * ⚠️ CE SCRIPT N'EST PAS UN LECTEUR DE LIBRAIRIE — il n'en existe qu'un, le transpileur. Il ÉCRIT
 * une source `.bpsl` ; c'est `libs-bundle.js` qui la relit, avec le compilateur et lui seul. La
 * preuve de la conversion n'est pas ce que ce script croit avoir écrit, c'est l'ÉGALITÉ du bundle
 * avant et après, champ par champ.
 *
 * ⛔ CE QU'IL REFUSE PLUTÔT QUE DE L'APPROXIMER : une valeur qu'il ne sait pas rendre fidèlement.
 * Il s'arrête et la nomme. Une conversion qui « passe » en perdant une valeur est le pire résultat
 * possible : les consommateurs lisent le bundle, et une valeur muette ne casse rien avant longtemps.
 *
 * ⛔ IL N'EXISTE QU'UN CONVERTISSEUR, ET C'EST CELUI-CI. Un script ad hoc à côté, c'est deux
 * autorités sur la même transformation : la mienne savait rendre les entrées de racine et forcer
 * les chaînes numériques, celle-ci savait les sections et les refus. Chacune ignorait ce que
 * l'autre avait appris, et les deux produisaient des sources qui se ressemblaient.
 *
 * ⚠️ LA GRAPHIE DE SORTIE VIT EN UN SEUL POINT — `ecrireEntree`, et c'est UNE LIGNE à parenthèse
 * SÉPARÉE, la forme des dix `.bpsl` du dépôt. Le collage était réputé non tranché ici ; il l'est par
 * le code, mesuré le 2026-08-23 : `def w(a:1)` collé est refusé (liste de paramètres), `def w (a:1)`
 * séparé compile (corps). Il n'y avait pas de question ouverte, mais une distinction non mesurée —
 * et la forme multi-ligne que ce fichier écrivait refusait l'objet imbriqué que celle-ci accepte.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CHAMPS_DE_FICHIER } from '../src/transpiler/libs-champs.js';

const CLES_LISTES = new Set(['args', 'values', 'scope', 'range']);

/**
 * UN TEXTE DU LANGAGE — le guillemet s'y DOUBLE, il ne s'échappe pas.
 *
 * ⛔ `JSON.stringify` ÉCHAPPE À LA MODE JSON, et c'est ce qui a produit l'antislash que ce fichier
 * refusait autrefois. Doubler le guillemet PUIS passer par `JSON.stringify` le réchappe : la source
 * sortait `\"\"` et le compilateur disait « caractère inattendu '\' ». La délimitation du langage
 * s'écrit donc ici, une fois, et jamais par un outil qui sert un autre format.
 */
function enTexte(s) {
  return '"' + String(s).replace(/"/g, '""') + '"';
}
// ⛔ CETTE LISTE ÉTAIT UNE COPIE, ET ELLE AVAIT DÉJÀ DIVERGÉ : elle ignorait `section`, que le
// générateur du bundle emploie depuis le 2026-08-22. Un champ de fichier qui manque ici ne rougit
// pas — la boucle des entrées écrit en COMMENTAIRE toute valeur qui n'est pas un objet, donc le
// champ quitte la donnée sans un mot. Prouvé par injection le 2026-08-24 : `// documented : no`.

/**
 * Une valeur simple se rend nue ; une phrase passe par le texte typé.
 *
 * ⚠️ UNE CHAÎNE PUREMENT NUMÉRIQUE SE FORCE EN TEXTE. La donnée porte les deux — `"1"` chaîne dans
 * un maqam, `1` nombre dans un handpan — et le lecteur type ce qu'il relit : rendue nue, la chaîne
 * `"1"` revient en NOMBRE et la preuve d'égalité tombe sur quinze entrées. La différence est
 * invisible à l'œil et parfaitement visible au consommateur.
 */
function rendValeur(cle, v, ou) {
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    return v.map((p) => {
      if (typeof p === 'object' && p !== null) throw new Error(`${ou}.${cle} : liste d'OBJETS, non rendue`);
      if (typeof p === 'number' || typeof p === 'boolean') return String(p);
      const s = String(p);
      if (s.includes(' ')) throw new Error(`${ou}.${cle} : la partie « ${s} » contient une espace`);
      if (s.includes('`')) throw new Error(`${ou}.${cle} : la partie « ${s} » contient un accent grave`);
      // ⚠️ CE QUI PASSE NU EST UN MOT, ET RIEN D'AUTRE. Un signe hors de ce jeu a un SENS dans le
      // langage : `^` marque un registre dans `octaves`, et rendu nu il sort « caractère inattendu ».
      // Le jeu est donc écrit en positif — ce qui passe — jamais en liste de ce qui ne passe pas.
      return /^[A-Za-z0-9_/#.+-]+$/.test(s) && !/^-?[0-9.]+$/.test(s) ? s : enTexte(s);
    }).join(' ');
  }
  if (typeof v === 'object' && v !== null) throw new Error(`${ou}.${cle} : objet imbriqué, non rendu`);
  const s = String(v);
  // ⛔ LE GUILLEMET INTERNE SORTAIT EN `\"` ET LE LANGAGE REFUSE L'ANTISLASH. `JSON.stringify` échappe
  // à la mode JSON ; le fichier produit ne compilait pas, et l'outil disait « ✅ écrit » — un refus
  // muet à l'écriture, découvert par la seule preuve d'égalité. Mesuré sur `temperaments` :
  //     … 2 grades of scale \"Ma05\" (23 grades) …   ⛔ Caractère inattendu '\'
  // Tant que la graphie d'un guillemet dans un texte n'est pas tranchée, on REFUSE au lieu de rendre
  // un fichier invalide : un refus nommé se répare, un fichier qui ne compile pas se cherche.
  // ⛔ CE REFUS EST PÉRIMÉ ET C'ÉTAIT LE TROISIÈME DE CE FICHIER FONDÉ SUR UNE AFFIRMATION. Il tenait
  // sur « l'antislash n'a aucun emploi dans le langage » — vrai — pour conclure qu'un guillemet dans
  // un texte n'a pas de graphie — faux depuis que le guillemet SE DOUBLE. Mesuré au compilateur :
  //     def w (d:"il dit ""oui"" ici")     ✓
  // 106 valeurs de `temperaments` attendaient cette ligne.
  // ⚠️ LE TEXTE TYPÉ EST OBLIGATOIRE DÈS QU'IL Y A UNE ESPACE — sans lui, la valeur se découperait
  // en PARTIES et une description deviendrait une liste de mots.
  //
  // ⛔ L'ACCENT GRAVE SE REFUSAIT ICI, ET LE LANGAGE SAIT L'ÉCRIRE. Ce refus tenait sur une
  // affirmation — « l'accent grave délimite le texte typé et ne s'échappe pas » — que personne
  // n'avait passée au compilateur. Mesuré le 2026-08-23, les quatre formes compilent :
  //     def x (audio:`js: saw(p)`)                        le code typé NU
  //     def x (audio:"`js: saw(p)`")                      le même entre guillemets
  //     def x (description:"le mot `midi` porte")         une prose, paire d'accents graves
  //     def x (description:"natif `-al.abc et suite")     une prose, accent grave IMPAIR
  // Une valeur qui en porte un est donc rendable, et le guillemet suffit : il n'échappe rien, il
  // délimite, et l'accent grave voyage à l'intérieur sans être lu comme une ouverture de code.
  //
  // ⚠️ CE QUE JE NE TRANCHE PAS ICI : la forme NUE pour une valeur qui EST un code typé complet
  // (`voices.*.audio`, 15 valeurs). Les deux compilent, et laquelle RELIT juste ne se prouve que
  // par la porte du bundle — sur un catalogue qui se convertit. Les seuls qui portent du code typé
  // butent encore sur l'objet imbriqué, donc aucune preuve n'est possible aujourd'hui. On rend
  // donc la forme PROUVÉE, et le nu attend son témoin plutôt qu'un raisonnement.
  if (s === '' || CLES_LISTES.has(cle) || !/^[A-Za-z0-9_/#.+-]+$/.test(s) || /^-?[0-9.]+$/.test(s)) {
    return enTexte(s);
  }
  return s;
}

/**
 * UNE CLÉ DE MEMBRE COMMENCE PAR UNE LETTRE — borné au compilateur, pas supposé.
 *     bb · b · x · a1 · sa · Ma05 · western_12TET · maqam-sikah · n5     acceptées
 *     _note (souligné initial) · 12TET (chiffre initial) · 2 (nombre)    refusées
 */
const CLE_DE_MEMBRE = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * UN NOM D'ENTREE QUE LE LANGAGE ECRIT NU — le recollage du parseur, borne au compilateur.
 *     western · 12TET · bp3_Bohlen-Pierce · western_just_c        nu
 *     fatbass for:sub37 · B#_instead_of_C · a.b                   PAS nu
 * Le parseur recolle IDENT/INT/tiret tant qu'ils se touchent ; l'espace, le point et le diese
 * portent un sens ailleurs. Un nom entre guillemets est REFUSE en tete de `def` (mesure du
 * 2026-08-24) : la seule place qui accepte un nom quelconque est une CLE DE MEMBRE.
 */
const NOM_D_ENTREE = /^[A-Za-z0-9_-]+$/;
const nomNu = (s) => NOM_D_ENTREE.test(s) && /[A-Za-z]/.test(s);

/**
 * UNE PAIRE — `k:valeur` quand la valeur est simple, `k(…)` quand elle est composée.
 *
 * ⛔ L'OBJET IMBRIQUÉ SE REFUSAIT ICI, ET LE LANGAGE LE PORTE. Deuxième refus de ce fichier fondé
 * sur une affirmation jamais mesurée — après l'accent grave, le même jour. Mesuré le 2026-08-23 :
 *     def w (alterations(bb:-2, b:-1), n:3)     ✓ à un niveau
 *     def w (a(b(c:1), d:2))                    ✓ à deux
 *
 * ⚠️ ET CE QUI BLOQUAIT N'ÉTAIT PAS LE LANGAGE MAIS LA FORME QUE CET OUTIL ÉCRIVAIT. La même donnée
 * en corps multi-ligne est REFUSÉE — `def w` puis `  alterations(bb:-2)` sort « n'est ni un appel de
 * composant ni une affectation ». Les dix `.bpsl` du dépôt, eux, sont tous écrits EN UNE LIGNE à
 * parenthèse séparée. Cet outil produisait donc une graphie que le dépôt n'emploie nulle part, et
 * c'est elle qui refusait l'imbrication — pas la grammaire.
 *
 * ⚠️ LE COLLAGE EST TRANCHÉ PAR LE CODE, contrairement à ce que disait le commentaire d'à côté :
 *     def w(a:1)    ⛔ « la liste de paramètres ne porte que des NOMS »   — collé = paramètres
 *     def w (a:1)   ✓                                                     — séparé = corps
 * Il n'y avait pas de question ouverte, il y avait une distinction que personne n'avait mesurée.
 */
function rendPaire(k, v, ou) {
  // ⛔ CINQUIÈME REFUS PÉRIMÉ DE CE FICHIER. Une clé de membre s'écrit NUE quand c'est un
  // identifiant, ENTRE GUILLEMETS sinon — décision Romain, 2026-08-23 — et les deux graphies
  // disent le même fait. Mesuré : `def w ("":0)` ✓, `def w ("12TET":1)` ✓, `def w ("a'":1)` ✓.
  const nue = CLE_DE_MEMBRE.test(k);
  const ecrite = nue ? k : enTexte(k);
  if (Array.isArray(v)) {
    // En une ligne, une liste se PARENTHÈSE : `scope:a b` sort « dans la partie DÉCLARATIVE… ».
    return `${ecrite}(${v.map((p) => rendValeur(k, p === null ? '' : p, ou)).join(', ')})`;
  }
  if (v && typeof v === 'object') {
    const dedans = Object.entries(v)
      .filter(([kk]) => !kk.startsWith('_'))
      .map(([kk, vv]) => rendPaire(kk, vv, `${ou}.${k}`));
    // ⛔ ET L'OBJET VIDE SE REND, QUATRIÈME REFUS PÉRIMÉ DE CE FICHIER. `terminals.C` vaut {} dans
    // sept alphabets, et cet outil disait « objet SANS membre rendable » — une règle à lui.
    // Mesuré au compilateur : `def w (terminals(C(), D()))` ✓. Un nom nu vaut un objet vide, et la
    // parenthèse vide le dit sans ambiguïté.
    return `${ecrite}(${dedans.join(', ')})`;
  }
  return `${ecrite}:${rendValeur(k, v, ou)}`;
}

/** Une note devient un COMMENTAIRE : elle ne voyage plus jusqu'aux consommateurs. */
function enCommentaire(texte, largeur = 96) {
  const mots = String(texte).replace(/\s+/g, ' ').trim().split(' ');
  const lignes = []; let cur = '//';
  for (const m of mots) {
    if ((cur + ' ' + m).length > largeur) { lignes.push(cur); cur = '//'; }
    cur += ' ' + m;
  }
  if (cur !== '//') lignes.push(cur);
  return lignes;
}

/**
 * LA GRAPHIE D'UNE ENTRÉE — le seul point qui décide de la FORME écrite.
 *
 * Tout le reste de ce script décide QUOI écrire ; celui-ci décide COMMENT. Quand le collage de la
 * parenthèse sera tranché, cette fonction seule change, et les vingt fichiers se régénèrent.
 */
function ecrireEntree(nom, lignesDeCles) {
  // L'arobase est SORTIE du langage (decision Romain, 2026-08-18) : une librairie s'ecrit dans la
  // graphie de la tete de scene, et la tete de scene ne la porte plus.
  //
  // ⛔ LA FORME EST CELLE DU DÉPÔT, ET CE FICHIER EN ÉCRIVAIT UNE AUTRE. Les dix `.bpsl` suivis sont
  // tous en UNE LIGNE à parenthèse séparée — `def scales (resolvedBy:"Kairos", resolves:scale)` ;
  // cet outil rendait un corps multi-ligne que rien d'autre n'emploie, et ce corps REFUSE l'objet
  // imbriqué que la forme à parenthèse accepte. La divergence de graphie de l'outil se lisait comme
  // une limite du langage — pendant six jours, et sur 82 valeurs.
  if (!lignesDeCles.length) return [`def ${nom}`];
  return [`def ${nom} (${lignesDeCles.join(', ')})`];
}

/**
 * OÙ VIVENT LES ENTRÉES D'UNE LIBRAIRIE — mesuré sur la donnée, jamais écrit ici.
 *
 * ⛔ QUATRE SECTIONS ÉCRITES EN DUR RENDAIENT CE SCRIPT AVEUGLE À LA MOITIÉ DES CATALOGUES : les
 * librairies de vocabulaire rangent sous `controls`/`engine`/`subgrammar`, les catalogues de
 * données posent leurs entrées À LA RACINE. `scales` en porte 185, et la liste en dur en voyait
 * zéro. On cherche donc les sections que la donnée PORTE, plus la racine.
 */
function sections(j) {
  const trouvees = [];
  const explorer = (obj, chemin) => {
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_') || CHAMPS_DE_FICHIER.has(k)) continue;
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      // Une SECTION est un objet dont les valeurs sont elles-mêmes des objets — une ENTRÉE est un
      // objet dont les valeurs sont des feuilles. La donnée le dit par sa forme.
      const fils = Object.values(v).filter((x) => x && typeof x === 'object' && !Array.isArray(x));
      const estSection = fils.length > 0 && fils.length === Object.values(v).filter((x) => x !== null).length;
      // ⛔ UNE PLACE PORTE UN NOM QUE LE LANGAGE ÉCRIT NU, et sans cette clause l'entrée
      // `fatbass for:sub37` était prise pour une place : son unique membre est un objet, donc elle a
      // EXACTEMENT la forme d'une section. L'outil descendait dedans et émettait `def device
      // (section:objects.fatbass for:sub37, …)` — une entrée fabriquée, sous une section dont le nom
      // ne s'écrit pas. Un nom qu'on ne peut pas écrire ne peut pas nommer une place où l'on range.
      if (estSection && chemin.length < 2 && nomNu(k)) explorer(v, [...chemin, k]);
    }
    if (chemin.length) trouvees.push(chemin.join('.'));
  };
  explorer(j, []);
  return trouvees.filter((s) => s !== '');
}

export function convertir(nom, j) {
  const out = [];
  const refus = [];
  out.push(`// LA LIBRAIRIE « ${nom} » — écrite dans le langage qu'elle sert.`);
  out.push('// Convertie depuis le JSON : le bundle en rend la MÊME donnée, champ par champ. Les');
  out.push("// consommateurs ne voient aucun changement — c'est l'AUTHORING qui change, pas la donnée.");
  out.push('//');
  out.push('// ⚠️ UNE NOTE EST UN COMMENTAIRE, plus une clé `_xxx` dans la donnée : un commentaire ne');
  out.push('//    voyage pas jusqu\'aux consommateurs, une clé si.');
  out.push('');

  // ── LA PROSE DU FICHIER, EN TÊTE ──
  for (const [k, v] of Object.entries(j)) {
    if (!k.startsWith('_')) continue;
    const texte = Array.isArray(v) ? v.join(' ') : v;
    if (typeof texte !== 'string') continue;
    out.push(`// ${k.replace(/^_|_doc$/g, '').toUpperCase().replace(/_/g, ' ')}`);
    out.push(...enCommentaire(texte));
    out.push('');
  }

  // ── OÙ RANGER LES ENTRÉES ──
  // La section MAJORITAIRE se déclare une fois, en tête ; les entrées d'une autre portent la leur.
  // ⛔ `section` ROUTE et ne se publie JAMAIS — publiée, elle ajoutait 21 octets à chaque librairie
  // et faisait mentir la preuve d'égalité.
  const lire = (chemin) => (chemin === '' ? j : chemin.split('.').reduce((o, k) => (o || {})[k], j)) || {};
  const trouvees = sections(j);
  const compte = (s) => Object.keys(lire(s)).filter((k) => !k.startsWith('_') && !CHAMPS_DE_FICHIER.has(k)
    && lire(s)[k] && typeof lire(s)[k] === 'object').length;
  const majoritaire = trouvees.length
    ? trouvees.slice().sort((a, b) => compte(b) - compte(a))[0]
    : '';

  // ⛔ UNE PLACE S'ÉCRIT ENTIÈREMENT EN MEMBRES DÈS QU'UN SEUL DE SES NOMS N'EST PAS ÉCRIVABLE NU, et
  // c'est l'ORDRE qui l'exige. Un nom non nu n'a qu'une graphie — une clé de membre — et une place
  // ne se pose que sur la déclaration DU FICHIER, donc en tête. Mélanger les deux graphies déplaçait
  // l'entrée en PREMIÈRE position : `[wobble, fatbass, fatbass for:sub37, …]` devenait
  // `[fatbass for:sub37, wobble, fatbass, …]`. Toutes en membres, l'ordre de la source est tenu.
  const placesEnMembres = new Set(
    [...new Set([...trouvees, ''])].filter((s) => Object.keys(lire(s))
      .some((k) => !k.startsWith('_') && !CHAMPS_DE_FICHIER.has(k) && !nomNu(k)
        && lire(s)[k] && typeof lire(s)[k] === 'object' && !Array.isArray(lire(s)[k])))
      .filter((s) => s !== ''),
  );

  // ── LE BLOC DU FICHIER ──
  const enTete = [];
  // L'ordre de CETTE boucle ne décide de rien : l'assemblage plus bas repose chaque ligne au rang
  // qu'elle porte DANS LA SOURCE. Deux mécanismes pour un seul fait, c'est un de trop — et c'est une
  // injection qui ne mordait pas qui l'a montré.
  for (const c of CHAMPS_DE_FICHIER) {
    if (j[c] === undefined) continue;
    try { enTete.push(rendPaire(c, j[c], nom)); } catch (e) { refus.push(e.message); }
  }
  // `section` ROUTE les `def` d'entrée ; une place écrite en membres n'en produit aucun, donc la clé
  // n'aurait rien à router.
  if (majoritaire && !placesEnMembres.has(majoritaire)) enTete.push(`section:${majoritaire}`);
  // ⛔ LE CORPS S'ECRIT AVANT L'EN-TETE, et ce n'est pas de la mise en page. Un nom d'entree que le
  // langage n'ecrit pas NU n'a qu'une place ou vivre : une CLE DE MEMBRE, dans la PLACE portee par la
  // declaration du fichier. Il faut donc avoir lu toutes les entrees avant d'ecrire cette ligne.
  const corps = [];
  const horsNom = new Map();   // place -> [`"<nom>"(<cles>)`]

  // ── LE COMPTE : CE QUE LA SOURCE PORTE, AVANT DE REGARDER CE QU'ON EN ÉCRIT ──
  // ⛔ CET OUTIL A LAISSÉ TROIS CHAMPS DERRIÈRE LUI ET A DIT « ✅ ». `settings` porte
  // `note_conventions` À LA RACINE, la boucle du dessous n'itère que les SECTIONS, et rien ne
  // comparait les deux. Le refus est bruyant, la perte est muette : seul un compte les distingue.
  const attendues = new Set();
  const recenser = (obj, chemin) => {
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_') || CHAMPS_DE_FICHIER.has(k)) continue;
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      const ici = [...chemin, k].join('.');
      if (trouvees.includes(ici)) { recenser(v, [...chemin, k]); continue; }
      attendues.add(ici);
    }
  };
  recenser(j, []);
  const vues = new Set();

  // ── UN BLOC PAR ENTRÉE, DANS CHACUNE DE SES SECTIONS ──
  // ⛔ UNE LIBRAIRIE PEUT PORTER SON VOCABULAIRE EN PLUSIEURS SECTIONS. `engine` en a QUATRE, et
  // les fusionner changerait la donnée : plusieurs lecteurs de `src/` les distinguent.
  // ⛔ LA RACINE SE PARCOURT TOUJOURS, PAS SEULEMENT QUAND ELLE EST SEULE. Un fichier qui porte des
  // sections peut porter AUSSI des entrées à sa racine — `settings.note_conventions`, `core.schema` —
  // et cette boucle ne les voyait pas. Une entrée mixte, qui mêle listes et objets, n'est jamais
  // reconnue comme section : elle vit donc à la racine par construction, et s'y perdait.
  for (const sec of [...new Set([...trouvees, ''])]) {
    for (const [nomE, def] of Object.entries(lire(sec))) {
      if (nomE.startsWith('_') || CHAMPS_DE_FICHIER.has(nomE)) continue;
      // À la racine, ce qui EST une section se lit dans sa propre passe, jamais deux fois.
      if (sec === '' && trouvees.includes(nomE)) continue;
      vues.add(sec ? `${sec}.${nomE}` : nomE);
      if (typeof def !== 'object' || def === null || Array.isArray(def)) {
        out.push(...enCommentaire(`${nomE} : ${def}`), ''); continue;
      }
      for (const [k, v] of Object.entries(def)) {
        if (k.startsWith('_') && typeof v === 'string') out.push(...enCommentaire(`${nomE} · ${v}`));
      }
      const cles = [];
      // ⛔ LA RACINE SE DIT PAR UN TEXTE VIDE, PAS PAR LE MOT « racine ». Le mot créait une PLACE
      // nommée `racine` dans le bundle — `settings.racine.note_conventions` au lieu de
      // `settings.note_conventions` : trois champs déplacés, la perte muette devenue un déplacement
      // muet. Le lecteur range à la racine quand le chemin est vide, et il le faisait déjà.
      if (sec !== majoritaire) cles.push(sec ? `section:${sec}` : 'section:""');
      for (const [k, v] of Object.entries(def)) {
        if (k.startsWith('_')) continue;
        // Une liste VIDE s'écrit en n'écrivant pas la clé — le bundle la rétablit (libs-bundle.js).
        if (Array.isArray(v) && v.length === 0) continue;
        try { cles.push(rendPaire(k, v, nomE)); } catch (e) { refus.push(e.message); }
      }
      if (!placesEnMembres.has(sec)) {
        corps.push(...ecrireEntree(nomE, cles));
        corps.push('');
        continue;
      }
      // ⛔ UN NOM QUE LE LANGAGE N'ECRIT PAS NU DEVIENT UNE CLE DE MEMBRE DE SA PLACE. `def "a b"` est
      // REFUSE ; `place("a b"(…))` est accepte, et le bundle range une place posee sur la declaration
      // du fichier. Sans cette voie, huit noms du paquet — sept reglages a diese et
      // `fatbass for:sub37` — n'avaient AUCUNE graphie, et cet outil sortait un fichier qui ne
      // compile pas en disant « ecrit ».
      const place = sec;
      if (!place) {
        refus.push(`${nom}.${nomE} : nom non ecrivable NU et AUCUNE place ou le poser — une cle de `
          + `membre exige une place, et ce fichier range ses entrees a la racine.`);
        continue;
      }
      if (!horsNom.has(place)) horsNom.set(place, []);
      const ecrit = CLE_DE_MEMBRE.test(nomE) ? nomE : enTexte(nomE);
      horsNom.get(place).push(`${ecrit}(${cles.filter((c) => !c.startsWith('section:')).join(', ')})`);
    }
  }
  // Un membre par ligne : le corps d'un `def` accepte les sauts de ligne entre ses parenthèses
  // (mesuré au compilateur), et seize entrées sur une seule ligne ne se relisent pas.
  // ⛔ TOUT SE REPOSE AU RANG DE LA SOURCE — les champs de fichier ET les places. C'est le seul
  // endroit qui décide de l'ordre publié, et il a fallu deux mesures pour l'écrire :
  //     [wobble, fatbass, fatbass for:sub37, …]   →   [fatbass for:sub37, wobble, fatbass, …]
  //     [documented, resolvedBy, name, objects…]  →   [resolvedBy, resolves, name, documented…]
  // Le rang d'une clé n'est pas de la mise en page : c'est lui qui a fait du catalogue de TEST
  // l'autorité de l'axe `alphabet` le 2026-08-23, et sept gardes sont tombés d'un coup. Une preuve
  // d'égalité qui compare les VALEURS ne le voit pas.
  const rendrePlace = (place) => `${place}(\n  ${horsNom.get(place).join(',\n  ')})`;
  const posees = new Set();
  const enTeteOrdonne = [];
  for (const c of Object.keys(j)) {
    const dejaPosee = enTete.find((l) => l.startsWith(`${c}:`) || l.startsWith(`${c}(`));
    if (dejaPosee) { enTeteOrdonne.push(dejaPosee); continue; }
    if (horsNom.has(c)) { enTeteOrdonne.push(rendrePlace(c)); posees.add(c); }
  }
  for (const l of enTete) if (!enTeteOrdonne.includes(l)) enTeteOrdonne.push(l);
  for (const place of horsNom.keys()) if (!posees.has(place)) enTeteOrdonne.push(rendrePlace(place));
  out.push(...ecrireEntree(nom, enTeteOrdonne));
  out.push('');
  out.push(...corps);

  // ⚠️ UN COMPTE QUI N'A RIEN EXAMINÉ NE PROUVE RIEN — il le dit lui-même.
  if (!attendues.size) refus.push(`${nom} : ZÉRO entrée recensée — le compte n'a rien examiné.`);
  for (const a of attendues) {
    if (!vues.has(a)) refus.push(`${nom}.${a} : entrée de la source JAMAIS ÉCRITE — perte muette.`);
  }
  return { texte: out.join('\n'), refus, examinees: attendues.size };
}

// ⛔ CET OUTIL ÉCRIVAIT DANS `lib/` SANS QU'ON LE LUI DEMANDE, ET IL M'A EU. Une mesure des 14
// catalogues — « lequel se convertit ? » — a CRÉÉ cinq fichiers dans le dépôt : sa sortie standard
// ne porte qu'une ligne de confirmation, donc rediriger sa sortie pour lire le résultat ne montre
// rien et écrit quand même. Un instrument qui modifie ce qu'il observe est une sonde absorbée.
//
// `--essai` rend la conversion sur la SORTIE STANDARD sans rien écrire : mesurer redevient un geste
// qui ne laisse pas de trace. Le refus, lui, part sur la sortie d'erreur dans les deux modes.
const args = process.argv.slice(2);
const essai = args.includes('--essai');
const cible = args.find((a) => !a.startsWith('--'));
if (cible) {
  const j = JSON.parse(readFileSync(`lib/${cible}.json`, 'utf-8'));
  const { texte, refus } = convertir(cible, j);
  if (refus.length) {
    console.error(`⛔ ${cible} : ${refus.length} valeur(s) non rendue(s) — rien n'est écrit.`);
    for (const r of [...new Set(refus)]) console.error(`   - ${r}`);
    process.exit(1);
  }
  // ⛔ CET OUTIL DISAIT « ✅ ÉCRIT » SUR UN FICHIER QUI NE COMPILE PAS, et c'est le défaut qui les
  // contient tous. `temperaments`, `voices` et `core` sont sortis d'ici sans un refus, et c'est le
  // BUNDLE qui les a rejetés — trois frontières plus loin, dans un message qui parle d'un fichier
  // que personne n'a écrit à la main. Un convertisseur qui ne relit pas sa propre sortie ne convertit
  // pas, il produit du texte.
  //
  // ⚠️ ET LE RELECTEUR EST LE COMPILATEUR, PAS UNE VÉRIFICATION À MOI. C'est lui qui tranche ce que
  // le langage accepte ; toute autre porte réintroduirait la seconde autorité que ce fichier existe
  // pour éviter. Deux refus de ce script — l'accent grave, l'objet imbriqué — étaient précisément
  // des règles inventées ici et jamais confrontées à lui.
  const { compileToBPxAST } = await import('../src/transpiler/index.js');
  const essaiCompile = compileToBPxAST(`core\n${texte}\n\n-----\nS -> -\n`, {});
  const fautes = (essaiCompile.errors || []).map((e) => e.message || String(e));
  if (fautes.length) {
    console.error(`⛔ ${cible} : la source produite NE COMPILE PAS — rien n'est écrit.`);
    console.error(`   ${fautes[0].slice(0, 200)}`);
    process.exit(1);
  }

  if (essai) { process.stdout.write(texte + '\n'); }
  else {
    writeFileSync(`lib/${cible}.bpsl`, texte + '\n');
    console.log(`✅ lib/${cible}.bpsl écrit — source relue par le compilateur avant écriture`);
  }
}
