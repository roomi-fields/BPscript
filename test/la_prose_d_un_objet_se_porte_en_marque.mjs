#!/usr/bin/env node
/**
 * GARDE — LA PROSE D'UN OBJET SE PORTE EN MARQUE, JAMAIS DANS SON SAC.
 *
 * Décision de Romain, 2026-09-04 : « la prose sort de la donnée vers une marque // @description en
 * source », et « convention : on met en préfixe de chaque objet le // @description correspondant ».
 * Elle se replie au-delà de 140 caractères, sur des lignes de `//` nu.
 *
 * ⛔ CE GARDE S'ÉCRIT POUR LA CONSTRUCTION, PAS POUR LA FORME SIGNALÉE. La marque s'apparie à ce qui
 *   suit, et le parseur produit des places à TROIS profondeurs — une déclaration au sommet, un membre
 *   dont la valeur ouvre un sac, un membre au fond d'un `params(…)`. Les trois sont éprouvées, plus
 *   les deux graphies d'écriture (sac indenté, sac d'une seule ligne) et le repli multi-lignes : une
 *   matrice, pas une liste. Le défaut qui a mordu pendant l'écriture vivait exactement là — plusieurs
 *   sacs OUVRENT SUR UNE MÊME LIGNE (`control stop(bp3:_stop, scope(rule), …)`), et la prose du
 *   contrôle partait sur son `scope` sans qu'aucun refus ne s'en aperçoive.
 *
 * ⇒ ET LES DEUX MOITIÉS DU FAIT :
 *     1. la marque ENTRE dans la donnée — sinon mes consommateurs perdent l'aide, la voie « lire ma
 *        source » étant fermée (décision du 2026-08-24) ;
 *     2. la prose écrite DANS un sac est REFUSÉE, à toute profondeur — sans quoi les deux formes
 *        vivraient côte à côte, et la profondeur choisirait laquelle.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { poserLesDescriptions } from '../src/transpiler/librairies.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const LARGEUR = 140;
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// Une source de librairie invoque en tête ce qui met ses mots en portée — `control` vient de `types`,
// exactement comme les 22 sources du dépôt. Le socle est compté dans les lignes, donc l'appariement
// des marques le traverse comme il traverse une vraie source.
const SOCLE = 'types\n';

/** Compile une source de librairie et rend l'arbre avec ses proses posées. */
// ⛔ TOUT EST CAPTURÉ, Y COMPRIS LA COMPILATION : le premier appel construit le registre depuis les
//   sources, et une faute grave le fait LEVER. Un garde qui laisse remonter l'exception ne rougit
//   pas — il DISPARAÎT du portillon, qui le compte parmi les absents au lieu des échecs. Mesuré ici
//   même, en injectant l'écrasement de place : le garde a explosé au lieu d'accuser.
function lire(corps, fichier = 'temoin.bpsl') {
  const texte = SOCLE + corps;
  try {
    const r = compileToBPxAST(texte, { librairie: true });
    if ((r.errors || []).length) return { erreur: r.errors[0].message };
    const n = poserLesDescriptions(texte, r.ast, fichier);
    return { ast: r.ast, posees: n };
  } catch (e) { return { refus: e.message }; }
}

/** La prose que porte le sac d'une déclaration, ou d'un membre nommé par un chemin de clés. */
function prose(ast, ...chemin) {
  let sac = [...(ast.defs || []), ...(ast.vars || [])]
    .find((d) => (d.name || (d.names || [])[0]) === chemin[0])?.settings;
  for (const cle of chemin.slice(1)) {
    sac = (sac?.pairs || []).find((p) => p.key === cle)?.value;
  }
  return (sac?.pairs || []).find((p) => p.key === 'description')?.value;
}

// ── 1. LA MATRICE DES PLACES — la marque s'apparie à toutes les profondeurs et aux deux graphies ──
const MATRICE = [
  ['déclaration au sommet, sac indenté',
   '// @description au sommet\ncontrol zz(\n  args(a),\n  scope(scene),\n  section:controls\n)',
   ['zz'], 'au sommet'],
  ['déclaration au sommet, sac d\'une seule ligne',
   '// @description en une ligne\ncontrol zz(args(a), scope(scene), section:controls)',
   ['zz'], 'en une ligne'],
  ['membre dont la valeur ouvre un sac',
   'control zz(\n  args(a),\n  section:controls,\n  params(\n    // @description un membre\n    n(from:value)\n  )\n)',
   ['zz', 'params', 'n'], 'un membre'],
  ['membre au fond d\'un sac d\'une seule ligne',
   'control zz(\n  args(a),\n  section:controls,\n  params(\n    // @description au fond\n    n(from:value, coerce:raw)\n  )\n)',
   ['zz', 'params', 'n'], 'au fond'],
  ['nom nu — la parenthèse absente vaut parenthèse vide',
   '// @description un nom nu\ndef zz',
   ['zz'], 'un nom nu'],
  ['prose repliée sur trois lignes',
   '// @description une prose\n// qui se replie\n// sur trois lignes\ncontrol zz(args(a), section:controls)',
   ['zz'], 'une prose qui se replie sur trois lignes'],
];
for (const [quoi, texte, chemin, attendu] of MATRICE) {
  const r = lire(texte);
  ok(!r.erreur && !r.refus, `1-${quoi} : la source doit compiler et se lire — ${r.erreur || r.refus || ''}`);
  ok(prose(r.ast || {}, ...chemin) === attendu,
     `1-${quoi} : la prose doit être « ${attendu} », reçu ${JSON.stringify(prose(r.ast || {}, ...chemin))}`);
}

// ⛔ LE CAS QUI A MORDU : deux sacs ouvrent sur la MÊME ligne, et c'est le plus englobant qui porte.
{
  const r = lire('// @description le contrôle, pas son scope\ncontrol zz(bp3:_zz, scope(rule), section:controls)');
  ok(prose(r.ast || {}, 'zz') === 'le contrôle, pas son scope',
     '1-même ligne : la prose va au sac le plus ENGLOBANT, jamais au sous-sac qui ouvre à la même ligne');
  ok(prose(r.ast || {}, 'zz', 'scope') === undefined,
     '1-même ligne : le sous-sac `scope` ne doit RIEN porter — sinon la prose du contrôle a fui');
}

// ── 2. LA PROSE ÉCRITE DANS UN SAC EST REFUSÉE, À TOUTE PROFONDEUR ──────────────────────────────
const REFUS = [
  ['au sommet', 'control zz(args(a), description:"dans le sac", section:controls)'],
  ['dans un sac indenté', 'control zz(\n  args(a),\n  description:"dans le sac",\n  section:controls\n)'],
  ['au fond d\'un params', 'control zz(\n  args(a),\n  section:controls,\n  params(\n    n(from:value, description:"au fond")\n  )\n)'],
];
for (const [ou, texte] of REFUS) {
  const r = lire(texte);
  ok(Boolean(r.refus) && /ne s'écrit plus dans un sac/.test(r.refus || ''),
     `2-${ou} : 'description' écrite dans un sac doit être REFUSÉE — reçu ${JSON.stringify(r.refus || r.erreur || 'aucun refus')}`);
}

// ── 3. UNE MARQUE QUI NE PRÉCÈDE AUCUN OBJET EST REFUSÉE ────────────────────────────────────────
{
  const r = lire('control zz(args(a), section:controls)\n// @description personne derrière moi\n');
  ok(Boolean(r.refus) && /ne précède aucun objet/.test(r.refus || ''),
     `3. une marque sans objet derrière elle doit être refusée — reçu ${JSON.stringify(r.refus || 'aucun refus')}`);
}

// ── 4. LES SOURCES DU DÉPÔT — aucune prose en donnée, aucune ligne au-delà de 140 ───────────────
const sources = (d) => readdirSync(d).flatMap((e) => {
  const p = join(d, e);
  return statSync(p).isDirectory() ? sources(p) : (/\.bpsl$/.test(e) ? [p] : []);
});
const fichiers = sources(join(RACINE, 'lib'));
ok(fichiers.length >= 20, `SOCLE : ${fichiers.length} source(s) de librairie examinée(s) — trop peu`);
let marques = 0;
let tropLongues = 0;
let enDonnee = 0;
for (const f of fichiers) {
  const lignes = readFileSync(f, 'utf8').split('\n');
  let dansUneMarque = false;
  lignes.forEach((l) => {
    if (/^[ \t]*description:/.test(l) || /[,(]\s*description:/.test(l)) enDonnee += 1;
    const debut = /^[ \t]*\/\/ @description /.test(l);
    const suite = dansUneMarque && /^[ \t]*\/\/[ \t]*[^@\s]/.test(l);
    if (debut) marques += 1;
    if (debut || suite) { dansUneMarque = true; if (l.length > LARGEUR) tropLongues += 1; }
    else dansUneMarque = false;
  });
}
ok(marques >= 500, `SOCLE : ${marques} marque(s) relevée(s) dans les sources — le corpus en porte des centaines`);
ok(enDonnee === 0, `4. ${enDonnee} source(s) écrivent encore 'description:' dans un sac — la prose est de la MARQUE`);
ok(tropLongues === 0, `4. ${tropLongues} ligne(s) de marque dépassent ${LARGEUR} caractères — la prose se replie au-delà`);

// ── 5. ELLE RESSORT DANS LA DONNÉE — la voie « lire ma source » est fermée pour mes consommateurs ─
const { leRegistre } = await import('../src/transpiler/libs.js');
let registre = {};
try { registre = leRegistre(); }
catch (e) { echecs.push(`5. le registre ne se construit plus : ${e.message}`); }
let dansLeRegistre = 0;
const vus = new Set();
const marcher = (o) => {
  if (!o || typeof o !== 'object' || vus.has(o)) return;
  vus.add(o);
  for (const [k, v] of Object.entries(o)) {
    if (k === 'description' && typeof v === 'string') dansLeRegistre += 1; else marcher(v);
  }
};
marcher(registre);
ok(dansLeRegistre >= 500,
   `5. le registre ne porte que ${dansLeRegistre} description(s) — la marque doit ENTRER dans la donnée `
   + `publiée, mes consommateurs ne lisent plus ma source`);

console.log(`[prose] ${passe} PASS / ${echecs.length} FAIL — ${passe} assertion(s) — `
  + `${marques} marque(s) dans ${fichiers.length} source(s), ${dansLeRegistre} dans le registre`);
if (echecs.length) {
  console.error(`[prose] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error(`  ✗ ${e}`);
  process.exit(1);
}
