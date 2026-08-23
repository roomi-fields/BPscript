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

const CLES_LISTES = new Set(['args', 'values', 'scope', 'range']);
const CHAMPS_DE_FICHIER = new Set(['resolvedBy', 'resolves', 'name', 'description', 'version', 'type']);

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
      return /^[A-Za-z0-9_/#.+-]+$/.test(s) && !/^-?[0-9.]+$/.test(s) ? s : JSON.stringify(s);
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
  if (s.includes('"')) throw new Error(`${ou}.${cle} : la valeur contient un GUILLEMET — il sortirait `
    + `en \\" et l'antislash n'a aucun emploi dans le langage`);
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
    return JSON.stringify(s);
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
  if (!CLE_DE_MEMBRE.test(k)) {
    throw new Error(`${ou}.${k} : la clé « ${k} » n'est pas un nom — un membre commence par une `
      + `lettre. La graphie d'une clé qui n'en est pas une n'est pas tranchée.`);
  }
  if (Array.isArray(v)) {
    // En une ligne, une liste se PARENTHÈSE : `scope:a b` sort « dans la partie DÉCLARATIVE… ».
    return `${k}(${v.map((p) => rendValeur(k, p === null ? '' : p, ou)).join(', ')})`;
  }
  if (v && typeof v === 'object') {
    const dedans = Object.entries(v)
      .filter(([kk]) => !kk.startsWith('_'))
      .map(([kk, vv]) => rendPaire(kk, vv, `${ou}.${k}`));
    if (!dedans.length) throw new Error(`${ou}.${k} : objet SANS membre rendable`);
    return `${k}(${dedans.join(', ')})`;
  }
  return `${k}:${rendValeur(k, v, ou)}`;
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
      if (estSection && chemin.length < 2) explorer(v, [...chemin, k]);
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

  // ── LE BLOC DU FICHIER ──
  const enTete = [];
  for (const c of CHAMPS_DE_FICHIER) {
    if (j[c] === undefined) continue;
    try { enTete.push(rendPaire(c, j[c], nom)); } catch (e) { refus.push(e.message); }
  }
  if (majoritaire) enTete.push(`section:${majoritaire}`);
  out.push(...ecrireEntree(nom, enTete));
  out.push('');

  // ── UN BLOC PAR ENTRÉE, DANS CHACUNE DE SES SECTIONS ──
  // ⛔ UNE LIBRAIRIE PEUT PORTER SON VOCABULAIRE EN PLUSIEURS SECTIONS. `engine` en a QUATRE, et
  // les fusionner changerait la donnée : plusieurs lecteurs de `src/` les distinguent.
  for (const sec of (trouvees.length ? trouvees : [''])) {
    for (const [nomE, def] of Object.entries(lire(sec))) {
      if (nomE.startsWith('_') || CHAMPS_DE_FICHIER.has(nomE)) continue;
      if (typeof def !== 'object' || def === null || Array.isArray(def)) {
        out.push(...enCommentaire(`${nomE} : ${def}`), ''); continue;
      }
      for (const [k, v] of Object.entries(def)) {
        if (k.startsWith('_') && typeof v === 'string') out.push(...enCommentaire(`${nomE} · ${v}`));
      }
      const cles = [];
      if (sec !== majoritaire) cles.push(`section:${sec || 'racine'}`);
      for (const [k, v] of Object.entries(def)) {
        if (k.startsWith('_')) continue;
        // Une liste VIDE s'écrit en n'écrivant pas la clé — le bundle la rétablit (libs-bundle.js).
        if (Array.isArray(v) && v.length === 0) continue;
        try { cles.push(rendPaire(k, v, nomE)); } catch (e) { refus.push(e.message); }
      }
      out.push(...ecrireEntree(nomE, cles));
      out.push('');
    }
  }
  return { texte: out.join('\n'), refus };
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
