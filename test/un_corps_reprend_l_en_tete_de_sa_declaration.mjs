#!/usr/bin/env node
/**
 * GARDE — UN CORPS SE RATTACHE PAR LA REPRISE DE SON EN-TÊTE, ET LA LIBRAIRIE DÉCLARE SES FICHIERS.
 *
 * Décision de Romain, 2026-09-03 : « même si le corps est dans un autre fichier il devrait reprendre
 * EXACTEMENT le même en-tête », et la librairie déclare ses fichiers de corps par une ligne à elle.
 *
 * ⛔ CE QUE ÇA REMPLACE. Le rattachement tenait au NOM DU FICHIER : `lib/transpo/transpose.ts` allait
 * sur l'objet `transpose`, sans que rien ne soit écrit nulle part. Romain : « ça ne doit pas juste
 * marcher parce que les fichiers sont correctement nommés ». En C non plus : le nom des fichiers n'y
 * joue AUCUN rôle — le `.c` inclut le `.h`, l'éditeur de liens apparie par symbole, et la LISTE des
 * fichiers vient du build.
 *
 * ⇒ CE GARDE ÉPROUVE LES TROIS REFUS QUI N'EXISTAIENT PAS, plus le complément : ce qui doit passer.
 *   Il travaille sur des sources fabriquées, jamais sur `lib/` — un garde qui lirait le dépôt réel
 *   verdirait le jour où la forme y disparaîtrait.
 */
import { enTeteEcrit, memeEnTete } from '../src/transpiler/librairies.js';
import { objet, objets } from '../src/transpiler/index-des-objets.js';
import '../src/transpiler/index.js';

const B = String.fromCharCode(96);
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── 1. L'EN-TÊTE ÉCRIT S'EXTRAIT, ET IL S'ARRÊTE À SA PARENTHÈSE ─────────────────────────────────
{
  const racine = 'control transpose(\n  rank:3,\n  args(interval)\n)\n';
  const corps = `control transpose(\n  rank:3,\n  args(interval)\n) ${B}${B}ts:\ndu code\n${B}${B}\n`;
  ok(enTeteEcrit(racine, 'transpose') === 'control transpose(\n  rank:3,\n  args(interval)\n)',
    `1. l'en-tête d'une racine s'extrait entier — reçu ${JSON.stringify(enTeteEcrit(racine, 'transpose'))}`);
  ok(enTeteEcrit(corps, 'transpose') === 'control transpose(\n  rank:3,\n  args(interval)\n)',
    `1. ⛔ l'en-tête d'un corps s'arrête à sa PARENTHÈSE, pas à la fin de ligne — le backtick s'ouvre `
    + `sur la même ligne, et le prendre faisait diverger tous les en-têtes — reçu `
    + `${JSON.stringify(enTeteEcrit(corps, 'transpose'))}`);
  ok(memeEnTete(racine, corps, 'transpose'), '1. les deux concordent');
}

// ── 2. LA CONCORDANCE IGNORE LES BLANCS, ET ELLE SEULE ───────────────────────────────────────────
{
  const a = 'control t(\n  rank:3,\n  args(i)\n)\n';
  ok(memeEnTete(a, 'control t(rank:3, args(i))\n', 't'),
    '2. le pli et l\'indentation ne comptent pas — ils sont de la mise en forme');
  ok(!memeEnTete(a, 'control t(rank:4, args(i))\n', 't'),
    '2. ⛔ une VALEUR différente diverge — c\'est la concordance de signature du C');
  ok(!memeEnTete(a, 'control t(rank:3, args(i), extra:1)\n', 't'),
    '2. ⛔ un membre EN PLUS diverge');
  ok(!memeEnTete(a, 'control t(rank:3)\n', 't'),
    '2. ⛔ un membre EN MOINS diverge');
  ok(!memeEnTete(a, 'control autre(rank:3, args(i))\n', 't'),
    '2. ⛔ un en-tête absent du corps ne concorde avec rien');
}

// ── 3. LE COMPLÉMENT — les corps réels du dépôt sont posés, et par cette voie ─────────────────────
{
  const avecCorps = objets().filter((o) => o.membres && o.membres.body);
  ok(avecCorps.length > 0, '3. le dépôt porte au moins un objet à corps — sinon ce garde n\'éprouve rien');
  const t = objet('transpo.transpose');
  ok(t && typeof t.membres.body === 'string' && t.membres.body.length > 100,
    `3. le corps d'une manipulation est posé — reçu ${t ? typeof t.membres.body : 'objet absent'}`);
  const tables = objets().filter((o) => o.famille === 'homomorphism');
  ok(tables.length > 0 && tables.every((o) => typeof o.membres.body === 'string'),
    `3. le corps d'un PROTOTYPE descend sur ses ${tables.length} exemplaires — `
    + `${tables.filter((o) => !o.membres.body).length} sans corps`);
}

// ── 4. LE CORPS EST TAGUÉ, ET SON LANGAGE EST DÉCLARÉ ────────────────────────────────────────────
{
  ok(objet('eval.ts') !== null,
    '4. ⛔ `ts` est déclaré parmi les évaluateurs — les corps du dépôt sont du TypeScript, et le tag '
    + 'd\'un backtick nomme un évaluateur qui existe');
}

const ATTENDU = 3 + 5 + 3 + 1;
ok(passe + echecs.length === ATTENDU,
  `le garde doit éprouver ${ATTENDU} cas — ${passe + echecs.length} seulement`);

if (echecs.length) {
  console.error(`[en-tête repris] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[en-tête repris] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
