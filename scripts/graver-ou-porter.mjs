#!/usr/bin/env node
/**
 * CHIFFRE LES DEUX RÉGIMES D'HÉRITAGE SUR L'ÉTAT E, ET CONTRE-MESURE LA CLÉ DU PAQUET.
 *
 * Romain a tranché le 2026-08-29 — *« oui tout, sinon ça me semble incohérent »* : un exemplaire
 * reçoit de son prototype tout ce qu'il n'écrit pas. **Hériter n'est pas recopier**, et la question
 * restée ouverte est le MOYEN :
 *
 *     GRAVER   la résolution matérialise la valeur dans le paquet · le consommateur ne fait rien
 *     PORTER   la résolution rend la valeur · le paquet porte la trace · le consommateur remonte
 *
 * Les deux produisent un paquet différent, et c'est ce paquet que six dépôts chargent. Cet outil
 * chiffre les deux, hors arbre, pour que la décision se prenne sur une mesure.
 *
 * ⛔ IL NE TRANSFORME PAS LE TEXTE, ET C'EST CE QUI L'A RENDU JUSTE. Ma première version appliquait
 * la bascule par une expression régulière sur la source : elle s'arrêtait au premier `)` INTERNE —
 * `symbols()` dans `core` — et ne voyait pas une ligne de tête écrite sur plusieurs lignes. Six
 * sources sur vingt-huit tombaient, et le chiffre qui sortait était **plausible**. L'AST porte déjà
 * tout ce que la bascule change : on le lit.
 *
 * ⛔ ET IL N'ÉCRIT RIEN — ni dans l'arbre, ni ailleurs. Il compile les sources en mémoire par la voie
 * unique. Un instrument qui salirait l'arbre casserait la fenêtre de mesure d'un voisin.
 *
 * ⚠️ IL S'ÉPROUVE PAR INJECTION : `--injecter` greffe un membre témoin sur chaque prototype. Le
 * compte de « graver » doit monter d'exactement le nombre d'exemplaires que la chaîne atteint, et
 * celui de « porter » ne doit pas bouger. Une sonde qui rend le même chiffre avec et sans ne mesure
 * pas la chaîne.
 *
 *     node scripts/graver-ou-porter.mjs
 *     node scripts/graver-ou-porter.mjs --injecter
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { CHAMPS_DE_FICHIER } from '../src/transpiler/libs-champs.js';

const RACINE = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const injecter = process.argv.includes('--injecter');

const sources = execFileSync('git', ['ls-files', 'lib'], { encoding: 'utf8', cwd: RACINE })
  .split('\n').filter((f) => f.endsWith('.bpsl'));
if (sources.length < 5) throw new Error(`ASSIETTE VIDE : ${sources.length} source(s) .bpsl.`);

const membresDe = (v) => new Set(((v.settings && v.settings.pairs) || []).map((p) => p.key));
const valeurDe = (v, cle) => ((v.settings && v.settings.pairs) || []).find((p) => p.key === cle)?.value;

/**
 * DEUX FORMES, DEUX PLACES DANS L'ARBRE — et c'est le fait que l'état E déplace. Un `def X (…)`
 * atterrit en `DefDirective` dans `ast.defs` ; un `<type> X (…)` déjà basculé atterrit en
 * `VarDirective` dans `ast.vars`, porteur de son `varType`. Lire une seule des deux places rend zéro
 * sur la moitié du corpus — deux catalogues sont DÉJÀ dans la forme neuve.
 */
const relever = (ast) => [
  ...((ast.defs || []).map((d) => ({ nom: d.name, parentEcrit: null, membres: membresDe(d), brut: d }))),
  ...((ast.vars || []).flatMap((v) => (v.names || []).map((n) => ({
    nom: n, parentEcrit: v.varType && v.varType.kind === 'type' ? v.varType.type : null,
    membres: membresDe(v), brut: v,
  })))),
];

// ── RELEVER L'ÉTAT E : la ligne de tête devient le prototype, son `resolves` en devient le nom ───
const declarations = new Map();
const refus = [];
const tetes = [];

for (const f of sources) {
  const r = compileToBPxAST(readFileSync(`${RACINE}/${f}`, 'utf8'), {});
  if ((r.errors || []).length) { refus.push([f, `NE COMPILE PAS : ${r.errors[0].message.slice(0, 60)}`]); continue; }
  const releve = relever(r.ast || {});
  const nomDuFichier = f.replace(/^lib\//, '').replace(/\.bpsl$/, '').replace(/\//g, '_');
  const tete = releve.find((d) => d.nom === nomDuFichier && !d.parentEcrit);
  if (!tete) { refus.push([f, `aucune ligne de tête nommée « ${nomDuFichier} »`]); continue; }
  const mot = valeurDe(tete.brut, 'resolves');
  if (typeof mot !== 'string') { refus.push([f, 'la ligne de tête n\'écrit pas `resolves`']); continue; }
  tetes.push([f, nomDuFichier, mot]);

  const membresDuProto = new Set([...tete.membres].filter((k) => k !== 'resolves'));
  if (injecter) membresDuProto.add('_temoin_injecte');
  declarations.set(mot, { fichier: f, parent: null, estProto: true, membres: membresDuProto });
  for (const d of releve) {
    if (d === tete) continue;
    declarations.set(d.nom, { fichier: f, parent: d.parentEcrit || mot, membres: d.membres });
  }
}

const remonter = (nom) => {
  const c = []; const vus = new Set([nom]);
  let p = declarations.get(nom)?.parent;
  // `object` est la RACINE du prototypal : elle ne se déclare pas, donc son absence n'est pas un trou.
  while (p && p !== 'object' && declarations.has(p) && !vus.has(p)) { c.push(p); vus.add(p); p = declarations.get(p).parent; }
  return { chaine: c, absent: p && p !== 'object' && !declarations.has(p) ? p : null };
};

// ── LES DEUX RÉGIMES ─────────────────────────────────────────────────────────────────────────
let graves = 0, derives = 0, profMax = 0, sansHeritage = 0;
const parProf = new Map(); const champs = new Map(); const absents = [];
for (const [nom, d] of declarations) {
  if (d.estProto) continue;
  derives++;
  const { chaine, absent } = remonter(nom);
  if (absent) absents.push([nom, absent]);
  profMax = Math.max(profMax, chaine.length);
  parProf.set(chaine.length, (parProf.get(chaine.length) || 0) + 1);
  const ecrits = new Set(d.membres);
  let recus = 0;
  for (const a of chaine) for (const k of declarations.get(a).membres) {
    if (ecrits.has(k)) continue;
    ecrits.add(k); graves++; recus++; champs.set(k, (champs.get(k) || 0) + 1);
  }
  if (!recus) sansHeritage++;
}

// ── RENDU ────────────────────────────────────────────────────────────────────────────────────
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', cwd: RACINE }).trim();
const sale = execFileSync('git', ['status', '--porcelain', '--', 'lib', 'src'], { encoding: 'utf8', cwd: RACINE }).trim();
console.log(`GRAVER OU PORTER — l'état E lu sur ${sources.length} sources, à « ${commit}`
  + `${sale ? ` + ${sale.split('\n').length} NON ENREGISTRÉS` : ''} »`
  + `${injecter ? '   ⚠️ INJECTION ACTIVE' : ''}\n`);
console.log(`  ${tetes.length} ligne(s) de tête portent un mot · ${declarations.size} déclarations · ${derives} exemplaires`);
if (refus.length) {
  console.log(`\n  ⛔ ${refus.length} source(s) HORS COMPTE — un chiffre pris sur elles serait muet :`);
  for (const [f, r] of refus) console.log(`      ${f.padEnd(30)} ${r}`);
}
console.log(`\n  profondeur de la chaîne   max ${profMax} · `
  + [...parProf.entries()].sort((a, b) => a[0] - b[0]).map(([p, n]) => `${p} cran(s): ${n}`).join(' · '));
console.log(`\n  GRAVER    +${graves} membres matérialisés  (${(graves / Math.max(1, derives)).toFixed(1)} par exemplaire)`);
console.log(`  PORTER    +${derives} traces \`_derive\`     (1 par exemplaire, quelle que soit la chaîne)`);
console.log(`  ⇒ écart   ${graves - derives} membres\n`);
console.log('  ce que GRAVER matérialise, et ce que PORTER oblige à remonter :');
for (const [k, n] of [...champs.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`      ${k.padEnd(20)} ${String(n).padStart(5)} exemplaires`
    + `   ${CHAMPS_DE_FICHIER.has(k) ? '· champ de fichier' : ''}`);
}
console.log(`\n  ⚠️ ${sansHeritage} exemplaire(s) ne reçoivent RIEN : leur chaîne remonte à \`object\` sans `
  + `passer\n     par la ligne de tête de leur fichier. Les deux régimes leur donnent la même chose — rien.`);

const { LIBS } = await import(`${RACINE}/src/transpiler/libs-data.js`);

// ── CE QUE PORTER EXIGE : que la trace RÉSOLVE dans ce que je publie ─────────────────────────
{
  const publies = new Set();
  for (const [cat, contenu] of Object.entries(LIBS)) {
    publies.add(cat);
    for (const k of Object.keys(contenu)) if (!CHAMPS_DE_FICHIER.has(k)) publies.add(k);
  }
  const culDeSac = new Map();
  for (const [nom, d] of declarations) {
    if (d.estProto) continue;
    for (const a of [d.parent, ...remonter(nom).chaine]) {
      if (!a || a === 'object' || publies.has(a)) continue;
      (culDeSac.get(a) || culDeSac.set(a, []).get(a)).push(nom);
    }
  }
  const total = [...culDeSac.values()].reduce((n, l) => n + l.length, 0);
  console.log(`\n  ⇒ CE QUE PORTER EXIGE — que la trace résolve dans le paquet publié :`);
  console.log(`     ${culDeSac.size} prototype(s) nommés par une chaîne sont ABSENTS du paquet, `
    + `atteignant ${total} exemplaire(s) sur ${derives} :`);
  for (const [a, l] of [...culDeSac.entries()].sort((x, y) => y[1].length - x[1].length)) {
    console.log(`         ${a.padEnd(18)} ${String(l.length).padStart(4)} exemplaires  (ex. ${[...new Set(l)].slice(0, 3).join(', ')})`);
  }
  if (!culDeSac.size) console.log('         aucun — toute chaîne résout.');
  console.log(`     ⚠️ Mesuré sur le paquet D'AUJOURD'HUI, donc MINORÉ : l'état E retire aussi `
    + `\`resolves\`\n        et la ligne de tête de \`types\`, dont d'autres chaînes dépendent.`);

  const octets = (o) => Buffer.byteLength(JSON.stringify(o), 'utf8');
  const base = octets(LIBS);
  let poidsGrave = 0, poidsPorte = 0;
  for (const [nom, d] of declarations) {
    if (d.estProto) continue;
    poidsPorte += Buffer.byteLength(`,"_derive":${JSON.stringify(d.parent)}`, 'utf8');
    const ecrits = new Set(d.membres);
    for (const a of remonter(nom).chaine) for (const k of declarations.get(a).membres) {
      if (ecrits.has(k)) continue;
      ecrits.add(k);
      poidsGrave += Buffer.byteLength(`,${JSON.stringify(k)}:`, 'utf8') + 12;
    }
  }
  console.log(`\n  POIDS — ${(base / 1024).toFixed(0)} Ko aujourd'hui`);
  console.log(`     GRAVER  +${(poidsGrave / 1024).toFixed(1)} Ko  (+${(100 * poidsGrave / base).toFixed(1)} %)`);
  console.log(`     PORTER  +${(poidsPorte / 1024).toFixed(1)} Ko  (+${(100 * poidsPorte / base).toFixed(1)} %)`);
  console.log('     ⚠️ La valeur gravée est comptée à 12 octets — un ORDRE DE GRANDEUR. La mesure octet '
    + 'pour\n        octet demande de régénérer, donc d\'écrire.');
}

// ── LA CLÉ DU PAQUET — décision du 2026-08-20, contre-mesurée ICI ────────────────────────────
// ⛔ La mesure d'origine est de bp3-frontend, prise sur mon paquet publié. Un compte pris depuis une
// autre surface se contre-mesure chez son propriétaire avant d'être frappé.
{
  console.log('\n  ── LA CLÉ DU PAQUET EST-ELLE LE MOT DÉCLARÉ ? (décision 2026-08-20) ──');
  let diff = 0, sans = 0;
  const parMot = new Map();
  for (const [cle, cat] of Object.entries(LIBS)) {
    const mot = cat.resolves;
    if (typeof mot !== 'string') { sans++; console.log(`      ${cle.padEnd(26)} ⛔ AUCUN MOT`); continue; }
    (parMot.get(mot) || parMot.set(mot, []).get(mot)).push(cle);
    if (mot === cle) continue;
    diff++; console.log(`      ${cle.padEnd(26)} → ${mot.padEnd(16)} ⛔ DIFFÈRE`);
  }
  console.log(`      ⇒ ${diff} clé(s) diffèrent · ${sans} sans mot · ${diff + sans} sur ${Object.keys(LIBS).length}`);
  const collisions = [...parMot.entries()].filter(([, l]) => l.length > 1);
  if (collisions.length) {
    console.log(`\n      ⛔ ${collisions.length} COLLISION(S) — deux catalogues réclament la MÊME clé, et la `
      + `bascule\n         ne peut pas les servir toutes les deux :`);
    for (const [mot, l] of collisions) console.log(`         « ${mot} » ← ${l.join(' et ')}`);
  }
}
