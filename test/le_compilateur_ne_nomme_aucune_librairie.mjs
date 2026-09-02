#!/usr/bin/env node
/**
 * GARDE — LE COMPILATEUR NE LIT AUCUNE TABLE PAR LE NOM D'UNE LIBRAIRIE.
 *
 * Décision de Romain, 2026-09-02 : « rien ne se code en dur de ce qui se déclare — le compilateur
 * lit, il ne connaît pas de liste de noms ». Treize lectures lisaient encore le schéma structurel par
 * le NOM de la librairie qui le porte — `loadLib('core').schema.catalogAxes`, `…channels`,
 * `…actorKeys`, `…reservedDirectives`, `directiveDeclareeParLaLibrairie('core', …)` — et une scène
 * ou une librairie qui aurait déclaré son propre `schema` n'aurait jamais été lue. Le compilateur lit
 * désormais l'OBJET `schema` par son nom, via l'index des objets, et pose au registre entier la
 * question « qui déclare ce mot ? ». Ce garde tient que la forme ne revient pas : aucun fichier du
 * compilateur ne nomme une librairie pour en lire une table.
 *
 * ⚠️ IL LIT LE CODE, PAS LES COMMENTAIRES — un commentaire a le droit de raconter d'où vient une
 * table ; c'est le code qui ne doit pas l'y chercher.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileToBPxAST } from '../src/transpiler/index.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ICI, '..', 'src', 'transpiler');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const FICHIERS = ['parser.js', 'resolution.js', 'bpxAst.js', 'actorResolver.js', 'controlValidation.js', 'segmentation.js'];
// Les graphies par lesquelles une table se lit PAR LE NOM d'une librairie — la matrice, pas la forme vue.
const GRAPHIES = [
  { nom: 'loadLib par un nom littéral', motif: /\bloadLib\(\s*['"][A-Za-z_]+['"]\s*\)/ },
  { nom: 'loadJsonFile par un nom littéral', motif: /\bloadJsonFile\(\s*['"][A-Za-z_]+['"]\s*\)/ },
  { nom: 'directiveDeclareeParLaLibrairie par un nom littéral', motif: /\bdirectiveDeclareeParLaLibrairie\(\s*['"][A-Za-z_]+['"]/ },
  { nom: 'LIBS.<nom> en dur', motif: /\bLIBS\.[A-Za-z_]+\b/ },
  { nom: "LIBS['<nom>'] en dur", motif: /\bLIBS\[\s*['"][A-Za-z_]+['"]\s*\]/ },
];

// ⚠️ UNE EXEMPTION, DATÉE ET MOTIVÉE — la table des portées permises (`chargerPorteesPermises`,
// resolution.js) lit encore CINQ librairies par leur nom. Lire le registre entier change le langage,
// mesuré : le refus d'un réglage de flux écrit en tête de scène disparaissait, vingt clés entraient
// dans la table, et `vel` est déclaré deux fois (`expression`, `settings`) sans règle pour trancher.
// C'est une décision de langage, remontée à Romain le 2026-09-02 ; l'exemption tombe avec sa
// décision. Elle ne couvre que la graphie `w(LIBS.<nom>)` de cette fonction, et rien d'autre.
const EXEMPTE = (ligne) => /^\s*w\(LIBS\.[a-z]+\);\s*$/.test(ligne);

let lignesLues = 0;
let exemptees = 0;
const coupables = [];
for (const f of FICHIERS) {
  let texte;
  try { texte = readFileSync(path.join(SRC, f), 'utf-8'); } catch { echecs.push(`SOCLE : ${f} introuvable`); continue; }
  texte.split('\n').forEach((ligne, i) => {
    const t = ligne.trimStart();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;   // la prose a le droit
    lignesLues++;
    if (EXEMPTE(ligne)) { exemptees++; return; }
    for (const g of GRAPHIES) if (g.motif.test(ligne)) coupables.push(`${f}:${i + 1} (${g.nom}) — ${t.slice(0, 90)}`);
  });
}
ok(lignesLues > 5000, `SOCLE : ${lignesLues} ligne(s) de code lues — un périmètre qui fond ne prouve rien`);
// L'exemption est COMPTÉE : cinq lignes, ni plus ni moins. Une sixième serait une dette neuve qui se
// glisse sous une dette datée ; zéro dirait que la dette est payée et que ce texte ment.
ok(exemptees === 5, `l'exemption couvre ${exemptees} ligne(s) — elle en attend 5 (la table des portées) ; une autre valeur dit que la dette a bougé sans que ce garde le sache`);
ok(coupables.length === 0,
   `${coupables.length} lecture(s) d'une table PAR LE NOM d'une librairie :\n       ${coupables.join('\n       ')}`);

// Le juge se prouve sur les graphies qu'il doit voir, et sur celles qu'il doit laisser.
for (const [graphie, ligne] of [
  ['loadLib littéral', "  const core = loadLib('core') || {};"],
  ['directiveDeclaree littéral', "  if (!directiveDeclareeParLaLibrairie('core', 'in')) {"],
  ['LIBS.nom', "  const s = LIBS.core.schema;"],
  ['LIBS[nom]', "  const s = LIBS['core'].schema;"],
]) ok(GRAPHIES.some((g) => g.motif.test(ligne)), `le juge ne voit pas « ${graphie} » : ${ligne}`);
for (const innocent of [
  "  const lib = loadLib(nom);",
  "  if (directiveDeclareeParLaLibrairie(lib, nom)) return true;",
  "  // `lib/core.json` schema.catalogAxes — la donnée déclare",
  "  const s = objet('schema');",
]) ok(!GRAPHIES.some((g) => g.motif.test(innocent)) || innocent.trimStart().startsWith('//'), `le juge accuse une ligne innocente : ${innocent}`);

// ET LA LECTURE PAR L'OBJET FONCTIONNE — le compilateur trouve encore ses tables : une scène avec un
// acteur et un canal compile, et une clé d'acteur inconnue est refusée (la table `actorKeys` est lue).
{
  const r = compileToBPxAST('core\nactor lead alphabet.western out.midi\n-----\nS -> lead.C4\n', {});
  ok(r.ast && !r.errors.length, `une scène à acteur compile — reçu ${JSON.stringify(r.errors.map((e) => e.message))}`);
  const k = compileToBPxAST('core\nactor lead alphabet.western zorglub.x out.midi\n-----\nS -> lead.C4\n', {});
  ok(k.errors.length > 0, `une clé d'acteur inconnue est refusée — la table des clés est bien lue`);
  const c = compileToBPxAST('core\nactor lead alphabet.western out.zorglub\n-----\nS -> lead.C4\n', {});
  ok(c.errors.length > 0, `un canal inconnu est refusé — le catalogue des canaux est bien lu`);
}

if (echecs.length) {
  console.error(`[aucun nom de librairie] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[aucun nom de librairie] ${passe} PASS / 0 FAIL — ${passe} assertion(s) · ${lignesLues} lignes de code, ${FICHIERS.length} fichiers`);
