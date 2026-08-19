#!/usr/bin/env node
/**
 * GARDE — LA LISTE DES MOTS RÉSERVÉS A PLUSIEURS DOMICILES, ET UNE SEULE PORTE.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE, ET C'EST LA MÊME FAUTE DEUX FOIS DANS LA JOURNÉE. Le matin du
 * 2026-08-19, j'ai réparé une valeur de mode qui vivait dans DEUX librairies dont une seule avait
 * migré. Une heure plus tard, mesurant sept mots pour l'architecte, j'ai écrit « aucun des sept
 * n'est dans reservedDirectives » — après avoir lu `core.schema.reservedDirectives` SEUL. L'un des
 * sept était déclaré dans `engine.schema.reservedDirectives`. Ma phrase disait plus que ma mesure.
 *
 * ⛔ ET LES DEUX DOMICILES N'ONT MÊME PAS LA MÊME FORME : `core` porte une LISTE PLATE de noms,
 * `engine` un OBJET `{nom: {description, scope}}`. Un lecteur écrit pour l'un ne lit pas l'autre —
 * il n'obtient pas des données manquantes, il obtient des INDICES là où il attend des noms. Les
 * deux formes sont légitimes ; ce qui ne l'est pas, c'est de viser un domicile par son nom.
 *
 * CE QUE CE GARDE TIENT :
 *   1. la porte fait l'UNION — elle rend au moins ce que chaque domicile déclare, séparément ;
 *   2. elle lit les DEUX FORMES — un domicile en objet ne doit pas rendre ses indices ;
 *   3. le code du transpileur ne vise pas un domicile par son NOM, sauf là où c'est un défaut
 *      NOMMÉ et daté, inscrit ici avec sa cause.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { LIBS } from '../src/transpiler/libs-data.js';
import { universeReservedDirectives } from '../src/transpiler/libs.js';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── 1. LES DOMICILES SE DÉCOUVRENT, ils ne se nomment pas ────────────────────────────────────
// Une liste écrite à la main deviendrait fausse le jour où une librairie en déclare un troisième —
// et le garde resterait vert, ce qui est exactement le défaut qu'il surveille.
const DOMICILES = Object.entries(LIBS)
  .filter(([, lib]) => lib?.schema?.reservedDirectives !== undefined)
  .map(([nom, lib]) => {
    const rd = lib.schema.reservedDirectives;
    return { nom, forme: Array.isArray(rd) ? 'liste' : 'objet',
             mots: Array.isArray(rd) ? rd : Object.keys(rd || {}) };
  });

const porte = universeReservedDirectives();
console.log(`[réservés] ${DOMICILES.length} domicile(s) : `
  + `${DOMICILES.map((d) => `${d.nom} (${d.forme}, ${d.mots.length})`).join(' · ')} `
  + `→ ${porte.size} à la porte`);

ok(DOMICILES.length >= 2,
  `1. ${DOMICILES.length} domicile(s) trouvé(s) — ce garde n'a de sens qu'à plusieurs. Sous deux, `
  + `soit la donnée a fusionné (le dire et retirer ce garde), soit la découverte est cassée.`);
ok(new Set(DOMICILES.map((d) => d.forme)).size >= 2,
  '1. les deux FORMES doivent coexister — c\'est ce qui rend un lecteur par chemin dangereux. '
  + 'Si elles ont fusionné, ce garde doit être relu.');

// ── 2. LA PORTE FAIT L'UNION, ET ELLE LIT LES DEUX FORMES ───────────────────────────────────
for (const d of DOMICILES) {
  ok(d.mots.length > 0, `2. le domicile '${d.nom}' déclare ZÉRO mot — un ensemble vide passe toute inclusion`);
  for (const mot of d.mots) {
    ok(porte.has(mot),
      `2. '${mot}' est déclaré par '${d.nom}' (forme ${d.forme}) et MANQUE à la porte — `
      + `un lecteur qui passe par elle le traiterait comme un mot inventé.`);
  }
}
// ⛔ LA FORME OBJET RENDRAIT SES INDICES SI ON LA LISAIT COMME UNE LISTE. Ce témoin le vérifie
// sur la donnée réelle : aucun mot de la porte n'est un entier déguisé en nom.
for (const mot of porte) {
  ok(!/^\d+$/.test(String(mot)),
    `2. la porte porte '${mot}', qui est un INDICE : un domicile en objet a été lu comme une liste.`);
}

// ── 3. AUCUN LECTEUR NE VISE UN DOMICILE PAR SON NOM ────────────────────────────────────────
// ⛔ LE RETARD EST NOMMÉ, DATÉ, ET IL PORTE SA CAUSE — jamais une exemption muette.
const RETARD = new Map([
  ['src/transpiler/bpxAst.js',
   'le lecteur des axes d\'invocation vise `core` seul : il connaît 22 mots sur 67. Le brancher '
   + 'sur la porte le rend PIRE — `seed.x`, `meter.x` et `timepatterns.x` se mettent à COMPILER, '
   + 'parce que l\'exemption épargne le mot sans que personne ne juge la SOUS-CLÉ. Ce qui manque '
   + 'est un juge pour « un mot du langage suivi d\'une sous-clé qu\'il n\'admet pas ». '
   + 'Mesuré et remonté à l\'architecte le 2026-08-19.'],
]);

/** Les fichiers de code du transpileur — la donnée et les gardes sont hors sujet. */
const fichiersDuTranspileur = readdirSync(path.join(RACINE, 'src', 'transpiler'))
  .filter((f) => /\.m?js$/.test(f) && !/^libs-data/.test(f))
  .map((f) => path.join('src', 'transpiler', f));

const CHEMIN_NOMME = /loadLib\(\s*['"][a-z]+['"]\s*\)[?.\s]*\.?\s*schema[?.\s]*\.?\s*reservedDirectives|LIBS\.[a-z]+\.schema\.reservedDirectives|LIBS\[\s*['"][a-z]+['"]\s*\][?.\s]*\.?\s*schema/;

let examinés = 0;
const coupables = [];
for (const rel of fichiersDuTranspileur) {
  const src = readFileSync(path.join(RACINE, rel), 'utf-8');
  examinés++;
  src.split('\n').forEach((ligne, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(ligne)) return;          // un commentaire ne lit rien
    if (!CHEMIN_NOMME.test(ligne)) return;
    // La porte elle-même construit l'union : elle a le droit de descendre dans chaque schéma.
    if (rel.endsWith('libs.js')) return;
    coupables.push(`${rel}:${i + 1} — ${ligne.trim().slice(0, 80)}`);
  });
}
ok(examinés >= 8, `3. ${examinés} fichier(s) examiné(s) — un périmètre qui fond ne prouve rien`);

const attendus = [...RETARD.keys()];
for (const c of coupables) {
  const fichier = c.split(':')[0];
  ok(RETARD.has(fichier),
    `3. ${c}\n      vise un domicile par son NOM. La liste a ${DOMICILES.length} domiciles et `
    + `${new Set(DOMICILES.map((d) => d.forme)).size} formes : ce lecteur en connaît un seul. `
    + `Passer par universeReservedDirectives(), ou l'inscrire au retard avec sa cause.`);
}
// ⛔ ET UN RETARD QUI N'EST PLUS ATTEINT EST UNE EXEMPTION MUETTE.
for (const f of attendus) {
  ok(coupables.some((c) => c.startsWith(f + ':')),
    `3. '${f}' est inscrit au retard et ne vise PLUS un domicile par son nom — RETIRE-le du `
    + `registre, daté. Un retard qui ne se resserre jamais n'est qu'un compteur.`);
}

// ── 4. LE JUGE MORD SUR LES GRAPHIES QU'IL PRÉTEND VOIR ─────────────────────────────────────
// ⛔ SANS CE VOLET, un motif trop étroit rendrait le volet 3 vert sur un dépôt fautif.
for (const [graphie, ligne] of [
  ['loadLib direct',  `const m = new Set(loadLib('core')?.schema?.reservedDirectives || []);`],
  ['LIBS pointé',     `const m = LIBS.engine.schema.reservedDirectives;`],
  ['LIBS indexé',     `const m = LIBS['core'].schema.reservedDirectives;`],
]) {
  ok(CHEMIN_NOMME.test(ligne), `4. la graphie « ${graphie} » n'est PAS vue par le juge : ${ligne}`);
}
for (const innocent of [
  `const m = universeReservedDirectives();`,
  `const axes = loadLib('core')?.schema?.catalogAxes || [];`,
  `// core.schema.reservedDirectives recense les mots du langage`,
]) {
  ok(!CHEMIN_NOMME.test(innocent) || /^\s*\/\//.test(innocent),
    `4. le juge accuse une ligne INNOCENTE — il ferait refuser la voie correcte : ${innocent}`);
}

ok(passe > 60, `le garde doit avoir EXAMINÉ, pas seulement tourné (${passe} assertions)`);

if (echecs.length) {
  console.error(`[réservés] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[réservés] ${passe} PASS / 0 FAIL — ${passe} assertion(s), ${RETARD.size} au retard`);
