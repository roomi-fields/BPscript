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
 * ⚠️ LA GRAPHIE DE SORTIE VIT EN UN SEUL POINT — `ecrireEntree`. La forme à parenthèse est tranchée
 * mais son COLLAGE ne l'est pas encore (`(x)` collé est déjà la liste de paramètres d'une
 * définition, `(vel:60)` séparé est un corps) ; quand il le sera, une seule fonction bouge.
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
      return /^[A-Za-z0-9_/#.+-]+$/.test(s) && !/^-?[0-9.]+$/.test(s) ? s : `\`txt: ${s}\``;
    }).join(' ');
  }
  if (typeof v === 'object' && v !== null) throw new Error(`${ou}.${cle} : objet imbriqué, non rendu`);
  const s = String(v);
  // ⚠️ LE TEXTE TYPÉ EST OBLIGATOIRE DÈS QU'IL Y A UNE ESPACE — sans lui, la valeur se découperait
  // en PARTIES et une description deviendrait une liste de mots.
  // L'accent grave DÉLIMITE le texte typé et ne s'échappe pas : une valeur qui en porte un n'est
  // pas rendable, et se refuse au lieu d'être tronquée en silence.
  if (s.includes('`')) throw new Error(`${ou}.${cle} : la valeur contient un accent grave`);
  if (s === '' || CLES_LISTES.has(cle) || !/^[A-Za-z0-9_/#.+-]+$/.test(s) || /^-?[0-9.]+$/.test(s)) {
    return `\`txt: ${s}\``;
  }
  return s;
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
  return [`@def ${nom}`, ...lignesDeCles.map((l) => `  ${l}`)];
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
    try { enTete.push(`${c}:${rendValeur(c, j[c], nom)}`); } catch (e) { refus.push(e.message); }
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
        try { cles.push(`${k}:${rendValeur(k, v, nomE)}`); } catch (e) { refus.push(e.message); }
      }
      out.push(...ecrireEntree(nomE, cles));
      out.push('');
    }
  }
  return { texte: out.join('\n'), refus };
}

const cible = process.argv[2];
if (cible) {
  const j = JSON.parse(readFileSync(`lib/${cible}.json`, 'utf-8'));
  const { texte, refus } = convertir(cible, j);
  if (refus.length) {
    console.error(`⛔ ${cible} : ${refus.length} valeur(s) non rendue(s) — rien n'est écrit.`);
    for (const r of [...new Set(refus)]) console.error(`   - ${r}`);
    process.exit(1);
  }
  writeFileSync(`lib/${cible}.bpsl`, texte + '\n');
  console.log(`✅ lib/${cible}.bpsl écrit`);
}
