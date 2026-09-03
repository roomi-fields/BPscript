#!/usr/bin/env node
/**
 * GARDE — L'UNIVERS DU PARSEUR SUIT L'INVOCATION : un mot qu'aucune librairie invoquée ne déclare
 * n'est pas en portée, et son refus nomme la librairie à invoquer.
 *
 * Principe 1 de Romain (2026-09-02) : l'invocation met en portée ce qu'une librairie déclare, et
 * rien d'autre n'est en portée. Le parseur lisait sept « univers » — toutes les librairies du
 * registre, « quelle que soit l'invocation » — et le chargeur de contexte faisait l'UNION du
 * registre pour les mots de tête et les clés d'adresse : `tempo:120` passait sans `time`,
 * `(weight:50)` sans `engine`, `(ch:5)` sans `midi`. Mesuré sur la bibliothèque de kanopi : onze
 * scènes sur 177 écrivaient un mot hors invocation, toutes acceptées.
 *
 * LA MATRICE — chaque place où un mot s'écrit × avec ou sans la librairie qui le déclare :
 *   tête de scène (`tempo:120`, `striated`) · règle (`(weight:50)`) · élément (`C4(transpose:3/2)`,
 *   `C4(ch:5)`) · flux (`!(vel:80)`) · crochet (`[goto:2]`) · tête de sous-grammaire (`mode:…(…)`).
 * Sans la librairie : REFUS qui nomme la librairie. Avec elle (nommément, ou par `core` qui
 * l'apporte) : ACCEPTÉ. Et un mot que PERSONNE ne déclare reste refusé comme inconnu, sans nom
 * de librairie — le refus nommé ne s'invente pas de déclarant.
 *
 * Le complément : le texte du parseur ne lit plus aucun univers — aucun import `universe*` ni
 * `porteesDeclarees` — et le chargeur ne relève plus le registre entier pour les mots de tête.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compileToBPxAST } from '../src/transpiler/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const erreurs = (src) => { try { return (compileToBPxAST(src, {}).errors || []).map((e) => String(e.message)); } catch (e) { return ['PLANTAGE ' + e.message]; } };
const refuseEnNommant = (msgs, mot, lib) => msgs.some((m) => new RegExp(`'${mot}' n'est pas en portée.*'${lib}'`).test(m));

// ── 1. LA MATRICE : place × (sans | avec) ──────────────────────────────────────────────────────
const CAS = [
  // [place, mot, librairie, scène SANS, scène AVEC (la librairie nommée), scène AVEC core]
  ['tête de scène',          'tempo',     'time',   'alphabet.western\ntempo:120\n-----\nS -> C4\n',
                                                     'alphabet.western\ntime\ntempo:120\n-----\nS -> C4\n',
                                                     'core\ntempo:120\n-----\nS -> C4\n'],
  ['tête de scène, mot nu',  'striated',  'engine', 'alphabet.western\nstriated\n-----\nS -> C4\n',
                                                     'alphabet.western\nengine\nstriated\n-----\nS -> C4\n',
                                                     'core\nstriated\n-----\nS -> C4\n'],
  ['règle',                  'weight',    'engine', 'alphabet.western\n-----\nS -> C4 D4 (weight:50)\n',
                                                     'alphabet.western\nengine\n-----\nS -> C4 D4 (weight:50)\n',
                                                     'core\n-----\nS -> C4 D4 (weight:50)\n'],
  ['élément, intervalle',    'transpose', 'transpo', 'alphabet.western\n-----\nS -> C4(transpose:3/2)\n',
                                                     'alphabet.western\ntranspo\n-----\nS -> C4(transpose:3/2)\n',
                                                     'core\n-----\nS -> C4(transpose:3/2)\n'],
  ['élément, adresse',       'ch',        'midi',   'alphabet.western\n-----\nS -> C4(ch:5)\n',
                                                     'alphabet.western\nmidi\n-----\nS -> C4(ch:5)\n',
                                                     'core\n-----\nS -> C4(ch:5)\n'],
  ['flux',                   'vel',       'expression', 'alphabet.western\n-----\nS -> !(vel:80) C4\n',
                                                     'alphabet.western\nexpression\n-----\nS -> !(vel:80) C4\n',
                                                     'core\n-----\nS -> !(vel:80) C4\n'],
];
for (const [place, mot, lib, sans, avec, avecCore] of CAS) {
  const s = erreurs(sans);
  ok(refuseEnNommant(s, mot, lib), `1. ${place} : '${mot}' SANS '${lib}' est refusé en nommant '${lib}' — reçu ${JSON.stringify(s)}`);
  ok(s.length === 1, `1. ${place} : UN SEUL refus pour '${mot}' — un fait, un canal — reçu ${s.length} : ${JSON.stringify(s)}`);
  const a = erreurs(avec);
  ok(a.length === 0, `1. ${place} : '${mot}' AVEC '${lib}' nommément est accepté — reçu ${JSON.stringify(a)}`);
  const c = erreurs(avecCore);
  ok(c.length === 0, `1. ${place} : '${mot}' avec 'core' (qui apporte '${lib}') est accepté — reçu ${JSON.stringify(c)}`);
}

// ── 2. LE CROCHET ET LA TÊTE DE SOUS-GRAMMAIRE ─────────────────────────────────────────────────
{
  const sans = erreurs('alphabet.western\n-----\nS -> C4 [goto:2]\n');
  ok(sans.length > 0 && !sans.some((m) => /PLANTAGE/.test(m)),
     `2. '[goto:2]' sans 'engine' est refusé sans plantage — reçu ${JSON.stringify(sans)}`);
  const avec = erreurs('core\n-----\nS -> C4 [goto:2]\nS -> D4\n');
  ok(avec.length === 0, `2. '[goto:2]' avec core est accepté — reçu ${JSON.stringify(avec)}`);
  const modeSans = erreurs('alphabet.western\n-----\nmode:random(striated)\nS -> C4\n');
  ok(modeSans.some((m) => /striated.*aucune librairie invoquée.*'engine'/.test(m)),
     `2. 'mode:random(striated)' sans 'engine' est refusé en nommant 'engine' — reçu ${JSON.stringify(modeSans)}`);
}

// ── 3. UN MOT QUE PERSONNE NE DÉCLARE reste inconnu, sans déclarant inventé ────────────────────
{
  const tete = erreurs('core\nzzinconnu:3\n-----\nS -> C4\n');
  ok(tete.length > 0 && !tete.some((m) => /n'est pas en portée/.test(m)),
     `3. 'zzinconnu:3' en tête est refusé comme INCONNU, jamais comme hors portée — reçu ${JSON.stringify(tete)}`);
  const sac = erreurs('core\n-----\nS -> C4(zzinconnu:3)\n');
  ok(sac.length > 0 && !sac.some((m) => /n'est pas en portée/.test(m)),
     `3. '(zzinconnu:3)' est refusé comme INCONNU, jamais comme hors portée — reçu ${JSON.stringify(sac)}`);
}

// ── 4. LE CONTEXTE SUIT LES LIGNES DE TÊTE : un intervalle se lit dès que sa librairie est là ──
{
  const apres = erreurs('core\ntranspose:700c\n-----\nS -> C4\n');
  ok(apres.length === 0, `4. 'transpose:700c' en tête APRÈS core lit un intervalle — reçu ${JSON.stringify(apres)}`);
  const ordre = erreurs('tempo:120\ncore\n-----\nS -> C4\n');
  ok(ordre.length === 0, `4. la portée se juge sur la scène entière : 'tempo' AVANT 'core' passe — reçu ${JSON.stringify(ordre)}`);
}

// ── 4bis. LE PRÉFIXE D'UNE DIRECTIVE DE TÊTE INVOQUE — « les catégories du cœur s'invoquent
// directement » (LIBRAIRIES.md) : `time.tempo:120` nomme `time`, donc `time` est en portée ─────
{
  const r = compileToBPxAST('alphabet.western\ntime.tempo:120\n-----\nS -> C4\n', {});
  ok((r.errors || []).length === 0, `4bis. 'time.tempo:120' sans 'core' est accepté — le préfixe invoque — reçu ${JSON.stringify((r.errors || []).map((e) => e.message))}`);
  const d = r.ast && r.ast.directives.find((x) => x.name === 'tempo');
  ok(d && d.lib === 'time' && d.subkey === null, `4bis. le nœud porte le réglage en 'name' et la catégorie en 'lib' — reçu ${JSON.stringify(d)}`);
  const parLePrefixe = erreurs('alphabet.western\nengine.seed:42\n-----\nS -> C4 D4 (weight:50)\n');
  ok(parLePrefixe.length === 0, `4bis. 'engine.seed:42' met 'engine' en portée : '(weight:50)' passe — reçu ${JSON.stringify(parLePrefixe)}`);
}

// ── 5. LE COMPLÉMENT : le texte ne lit plus d'univers ──────────────────────────────────────────
{
  const parser = readFileSync(join(__dirname, '..', 'src', 'transpiler', 'parser.js'), 'utf-8');
  const libs = readFileSync(join(__dirname, '..', 'src', 'transpiler', 'libs.js'), 'utf-8');
  const lecturesParseur = (parser.match(/\buniverse[A-Z][A-Za-z]*\(/g) || []).length + (parser.match(/\bporteesDeclarees\(/g) || []).length;
  ok(lecturesParseur === 0, `5. le parseur ne lit aucun univers ni portée du registre entier — ${lecturesParseur} lecture(s)`);
  const univers = (libs.match(/^function universe[A-Z][A-Za-z]*\(/gm) || []).map((m) => m.slice(9, -1));
  ok(univers.length === 1 && univers[0] === 'universeControlNames',
     `5. le chargeur ne garde qu'UN vocabulaire du registre, pour les outils qui le décrivent — reçu ${JSON.stringify(univers)}`);
  ok(/for \(const dir of aCharger\) \{\s*\n\s*const lib = dir && dir\.name \? loadJsonFile\(dir\.name\) : null;/.test(libs),
     '5. les mots de tête et les clés d\'adresse se relèvent sur les librairies INVOQUÉES (aCharger), pas sur le registre');
}

ok(passe >= 30, `SOCLE : ${passe} vérifications — la matrice s'est vidée`);
if (echecs.length) {
  console.error(`[univers → invocation] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[univers → invocation] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
