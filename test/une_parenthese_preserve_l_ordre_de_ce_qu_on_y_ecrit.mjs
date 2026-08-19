#!/usr/bin/env node
/**
 * GARDE — UNE PARENTHÈSE PRÉSERVE L'ORDRE DE CE QU'ON Y ÉCRIT.
 *
 * Arbitrage Romain, 2026-08-19 : une seule forme sert la SUITE et l'ENSEMBLE — un ensemble est une
 * suite dont personne ne lit le rang. Une liste s'écrit donc `registers(mandra, madhya, taar)`, et
 * ce qui en sort doit ressortir DANS CET ORDRE.
 *
 * ⛔ CE QUI L'A EXIGÉ EST UNE DONNÉE, PAS UN GOÛT : `octaves.saptak` adresse ses registres PAR LEUR
 * RANG — `default:1` désigne madhya, le deuxième des trois. Une suite rendue dans un autre ordre ne
 * casse rien de visible : elle désigne un AUTRE registre, en silence.
 *
 * ⛔ ET LE PIÈGE EST DANS LE LANGAGE HÔTE : un objet JavaScript réordonne ses clés entières avant
 * toutes les autres, donc `{"0":…,"1":…}` sort en ordre numérique quoi qu'on écrive. Une lecture qui
 * passe par un objet intermédiaire rend le rang du moteur d'exécution au lieu de celui de la source.
 * Le garde mesure donc l'ORDRE, jamais la seule présence des membres — compter ce qui existe n'est
 * pas mesurer ce que ça porte.
 *
 * DEUX ÉTAGES, parce qu'un seul ne dirait pas où le rang se perd :
 *   A. l'AST — ce que le PARSER rend d'une parenthèse ;
 *   B. la donnée PUBLIÉE — ce que le bundle rend de chaque liste écrite en parenthèse dans `lib/`.
 */
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

const LIB_DIR = join(dirname(fileURLToPath(import.meta.url)), '../lib');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

console.log('[ordre] une parenthèse préserve l\'ordre de ce qu\'on y écrit');

// ── A. L'AST — LE RANG VIENT DE LA SOURCE, ET LE TÉMOIN LE FABRIQUE ─────────────────────────
// ⛔ OBSERVER NE DISCRIMINE PAS : une seule suite passerait aussi bien chez un lecteur qui TRIE.
// On écrit donc la MÊME suite dans DEUX ordres et on exige deux résultats différents.
{
  const pairs = (src) => {
    const r = compileToBPxAST(`core\nalphabet.western\n${src}\n-----\nS -> C4\n`);
    ok((r.errors || []).length === 0, `A. '${src}' doit compiler (reçu : ${(r.errors || [])[0]?.message})`);
    return ((r.ast?.defs || [])[0]?.settings?.pairs || [])
      .find((p) => p.key === 'registers')?.value?.pairs?.map((p) => p.key);
  };
  const droit = pairs('def x (registers(mandra, madhya, taar))');
  const envers = pairs('def x (registers(taar, madhya, mandra))');
  ok(JSON.stringify(droit) === JSON.stringify(['mandra', 'madhya', 'taar']),
    `A. la suite écrite doit ressortir telle quelle — reçu ${JSON.stringify(droit)}`);
  ok(JSON.stringify(envers) === JSON.stringify(['taar', 'madhya', 'mandra']),
    `A. TÉMOIN FABRIQUÉ — la suite écrite à l'envers doit ressortir à l'envers. Si elle ressort `
    + `comme la première, le rang vient du lecteur et non de la source. Reçu ${JSON.stringify(envers)}`);
  ok(JSON.stringify(droit) !== JSON.stringify(envers),
    'A. les deux ordres doivent DIFFÉRER — sinon le garde ne distingue rien');
}

// ── B. LA DONNÉE PUBLIÉE — CHAQUE LISTE ÉCRITE EN PARENTHÈSE, DANS `lib/` ────────────────────
// Le garde balaye l'ESPACE : toute librairie du langage, toute déclaration, toute liste. Il grandit
// donc tout seul à chaque librairie réécrite, sans qu'on pense à l'y inscrire.
const trouver = (o, nom) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (Object.prototype.hasOwnProperty.call(o, nom) && o[nom] && typeof o[nom] === 'object') return o[nom];
  for (const v of Object.values(o)) { const t = trouver(v, nom); if (t) return t; }
  return null;
};

const sources = readdirSync(LIB_DIR).filter((f) => f.endsWith('.bpsl')).sort();
ok(sources.length >= 9, `B. le balayage doit voir les librairies du langage — ${sources.length} vue(s)`);

let listes = 0;
let ordreNonTrivial = 0;
for (const fichier of sources) {
  const nomLib = fichier.replace('.bpsl', '');
  const texte = readFileSync(join(LIB_DIR, fichier), 'utf-8');
  // Une déclaration à corps parenthésé, sur une ligne : `def <nom> (…)`.
  for (const m of texte.matchAll(/^def (\w+) \((.*)\)\s*$/gm)) {
    const [, nomDecl, corps] = m;
    const publiee = nomDecl === nomLib ? LIBS[nomLib] : trouver(LIBS[nomLib], nomDecl);
    if (!publiee) { echecs.push(`B. ${nomLib}.${nomDecl} : déclaré dans la source, introuvable dans la donnée publiée`); continue; }
    // ⚠️ ON NE LIT QUE LES PARENTHÈSES DE PREMIER NIVEAU DU CORPS : `cle(a, b, c)` sans imbrication.
    // Une liste ne porte que des noms nus — une parenthèse imbriquée n'est pas une liste, et le
    // générateur la refuse déjà bruyamment si un membre porte une valeur.
    for (const l of corps.matchAll(/(?:^|,\s*)(\w+)\(([^()]*)\)/g)) {
      const [, cle, membres] = l;
      const bruts = membres.split(',').map((x) => x.trim()).filter((x) => x !== '');
      if (!bruts.length || bruts.some((x) => x.includes(':'))) continue;   // pas une liste
      // ⛔ UN MEMBRE PORTE SA NATURE, ET LE GARDE LA LIT COMME LE COMPILATEUR : un texte entre
      // guillemets reste un TEXTE — `"0"` n'est pas 0 —, un nombre nu devient un NOMBRE, un nom
      // reste son nom. Comparer les seuls textes laisserait passer un registre « 0 » publié en
      // nombre, et c'est exactement le type qui casserait la résolution de hauteur.
      const ecrits = bruts.map((x) => {
        const t = x.match(/^"([\s\S]*)"$/);
        if (t) return t[1];
        return /^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x;
      });
      const rendue = publiee[cle];
      listes++;
      ok(Array.isArray(rendue),
        `B. ${nomLib}.${nomDecl}.${cle} doit être publiée comme une SUITE — reçu ${JSON.stringify(rendue)}`);
      ok(JSON.stringify(rendue) === JSON.stringify(ecrits),
        `B. ${nomLib}.${nomDecl}.${cle} : la donnée publiée doit être la suite ÉCRITE, dans son ordre `
        + `ET dans ses types. écrit ${JSON.stringify(ecrits)} · publié ${JSON.stringify(rendue)}`);
      const trie = [...ecrits].map(String).sort();
      if (JSON.stringify(trie) !== JSON.stringify(ecrits.map(String))) ordreNonTrivial++;
    }
  }
}

// ⛔ UN GARDE COMPTE CE QU'IL A EXAMINÉ, ET REFUSE D'AVOIR EXAMINÉ ZÉRO.
ok(listes >= 18, `B. le garde doit avoir examiné des listes publiées, pas seulement tourné (${listes} vue(s))`);
// ⛔ ET IL REFUSE DE N'AVOIR VU QUE DES SUITES DÉJÀ TRIÉES : sur celles-là, un lecteur qui TRIE
// passerait tout le volet B sans se distinguer d'un lecteur correct.
ok(ordreNonTrivial >= 1,
  `B-témoin. aucune des ${listes} listes examinées n'a un ordre distinct de son tri alphabétique — `
  + `le volet B ne distinguerait pas un lecteur qui trie d'un lecteur qui préserve.`);

// ── C. LE RANG DÉSIGNE — ce que la décision exigeait, et ce qu'un vert sur la seule présence
//        des membres ne prouverait pas ────────────────────────────────────────────────────────
// ⛔ `octaves` ADRESSE SES REGISTRES PAR LEUR RANG : `default` est un INDICE dans la suite. Compter
// les membres, ou les retrouver tous, ne dit RIEN sur ce que `default` désigne. Le garde lit donc
// la désignation elle-même, convention par convention.
{
  let designations = 0;
  let videAuRang = 0;
  for (const [nom, conv] of Object.entries(LIBS.octaves || {})) {
    if (!conv || typeof conv !== 'object' || !Array.isArray(conv.registers)) continue;
    designations++;
    const d = conv.default;
    ok(Number.isInteger(d) && d >= 0 && d < conv.registers.length,
      `C. octaves.${nom} : 'default' (${JSON.stringify(d)}) doit être un RANG de la suite de `
      + `${conv.registers.length} registres`);
    ok(typeof conv.registers[d] === 'string',
      `C. octaves.${nom} : le registre désigné par le rang ${d} doit être un TEXTE — reçu `
      + `${JSON.stringify(conv.registers[d])}`);
    if (conv.registers[d] === '') videAuRang++;
  }
  ok(designations >= 10, `C. le garde doit voir les conventions d'octaves — ${designations} vue(s)`);
  // Les trois désignations que la décision cite ou que la donnée rend fragiles.
  ok(LIBS.octaves?.saptak?.registers?.[LIBS.octaves.saptak.default] === 'madhya',
    `C. octaves.saptak : 'default:1' doit désigner 'madhya', le DEUXIÈME des trois — c'est le cas `
    + `qui a fait trancher l'ordre. Reçu `
    + `${JSON.stringify(LIBS.octaves?.saptak?.registers?.[LIBS.octaves?.saptak?.default])}`);
  ok(LIBS.octaves?.western?.registers?.[LIBS.octaves.western.default] === '4',
    `C. octaves.western : le registre par défaut doit être le TEXTE '4', jamais le nombre 4 — reçu `
    + `${JSON.stringify(LIBS.octaves?.western?.registers?.[LIBS.octaves?.western?.default])}`);
  // ⛔ LE MEMBRE VIDE TIENT SA PLACE. Deux conventions désignent par défaut un registre écrit SANS
  // marqueur ; le retirer de la suite décalerait tous les rangs suivants d'un cran, en silence.
  ok(videAuRang >= 2,
    `C. au moins deux conventions doivent désigner par défaut un registre VIDE — il occupe un RANG, `
    + `et le retirer décalerait tous les suivants. Reçu ${videAuRang}`);
}

console.log(`[ordre] ${listes} liste(s) publiée(s) examinée(s), dont ${ordreNonTrivial} d'ordre non trivial`);

if (echecs.length) {
  console.error(`[ordre] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[ordre] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
