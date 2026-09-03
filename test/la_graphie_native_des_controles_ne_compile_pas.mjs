#!/usr/bin/env node
/**
 * GARDE — la graphie native `_nom(…)` est REFUSÉE, et aucun contrôle non déclaré ne compile.
 *
 * LA DÉCISION (Romain, 2026-08-12). La graphie `_nom(…)` n'était pas une tolérance, c'était un
 * CONTOURNEMENT : elle vivait dans le parseur, la bible ne l'a jamais mentionnée, et aucune forme
 * du langage n'existe sans sa validation. Celle-ci n'en avait aucune — elle routait TOUT
 * identifiant collé à un `_` vers un contrôle sans le confronter au catalogue, si bien que
 * `_xyzzy(1)` compilait exactement comme `_transpose(2)`, avec la même étiquette. Une scène
 * pouvait porter un contrôle inexistant, passer sans un mot, et ne rien produire.
 *
 * ⛔ CE QUE LE GARDE TIENT, ET SON COMPLÉMENT — c'est le complément qui coûte, parce qu'un refus
 * trop large casserait la prolongation, qui s'écrit avec le même caractère :
 *   `_vel(120)`          → REFUSÉ, et le refus NOMME `!(vel:120)`
 *   `_xyzzy(1)`          → REFUSÉ, nom inconnu ou pas : c'est la GRAPHIE qui sort
 *   `!(vel:120)`         → accepté — la forme du langage
 *   `!(xyzzy:1)`         → REFUSÉ, elle validait déjà ses noms AVANT cette décision
 *   `C4 _ _`             → accepté : la prolongation nue n'est pas touchée
 *   `C4 _ !(vel:80) D4`  → accepté : un `_` SUIVI D'UN ESPACE est une prolongation autonome
 *
 * LE REFUS N'EST PAS MUET. Romain l'a posé comme condition : il dit quoi écrire à la place. C'est
 * ce qui sépare une migration d'un mur, et c'est testé ici — pas seulement le fait de refuser.
 */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { compileToBPxAST } = require('../src/transpiler/index.js');

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.error(`FAIL — ${quoi}`); } };

const SOCLE = 'core\nalphabet.western:midi\n-----\n\n';
const compile = (regle) => compileToBPxAST(SOCLE + regle + '\n');
const refuse = (regle) => compile(regle).errors;

// ── LA GRAPHIE NATIVE SORT, QUEL QUE SOIT LE NOM ──────────────────────────────────────────────
// On l'éprouve sur des noms RÉELS et sur des noms inventés : c'est la graphie qui est refusée,
// jamais le nom. Un garde qui ne testerait que les noms inconnus laisserait `_vel(120)` rentrer.
for (const [nom, arg] of [['vel', '120'], ['chan', '3'], ['transpose', '2'], ['rndvel', '20'],
  ['xyzzy', '1'], ['step', 'blurb'], ['print', '']]) {
  const errs = refuse(`S -> _${nom}(${arg}) C4`);
  verifier(errs.length > 0, `_${nom}(${arg}) est REFUSÉ`);
  verifier(errs.some((e) => new RegExp(`_${nom}`).test(e.message)),
    `_${nom} : le refus CITE la graphie fautive`);
  // On exige qu'une forme SOIT nommée, sans présumer laquelle : pour les noms que BPScript a
  // renommés, la bonne réponse n'est PAS `!(<nom natif>:…)` — c'est éprouvé juste en dessous.
  verifier(errs.some((e) => /!\([a-z]+:…\)/.test(e.message)),
    `_${nom} : le refus NOMME UNE FORME À ÉCRIRE, au lieu de rejeter sans rien dire`);
}

// ── LA FORME ATTENDUE SE LIT DANS LE CATALOGUE, ELLE NE SE DÉDUIT PAS DU NOM ─────────────────
// C'est le piège que le champ `bp3` existe pour fermer : le `_transpose` natif se dit
// `chromashift` ici, et la clé `transpose` existe AUSSI en désignant un AUTRE geste. Un message
// qui traduirait mécaniquement `_transpose` en `!(transpose:…)` ferait changer le geste EN
// SILENCE — la migration serait « réussie » et la scène jouerait autre chose.
{
  const m = refuse('S -> _transpose(2) C4').map((e) => e.message).join(' ');
  verifier(/!\(chromashift:/.test(m),
    '_transpose : le refus nomme « chromashift », la clé qui DÉCLARE ce geste natif');
  verifier(!/!\(transpose:…\)/.test(m),
    "_transpose : le refus ne propose SURTOUT PAS « transpose », qui est un autre geste");
  verifier(/DIFFERENT gesture/.test(m),
    "_transpose : et il DIT que la clé de même nom en désigne un autre — sans quoi la mise en garde manque");
}
{
  // Le complément : un nom que personne n'a renommé se rend tel quel, sans mise en garde parasite.
  const m = refuse('S -> _vel(120) C4').map((e) => e.message).join(' ');
  verifier(/!\(vel:/.test(m) && !/DIFFERENT gesture/.test(m),
    '_vel : rendu tel quel, et AUCUNE mise en garde de renommage là où il n\'y en a pas');
}

// ── LA FORME DU LANGAGE PASSE, ET ELLE VALIDE SES NOMS ────────────────────────────────────────
for (const [nom, val] of [['vel', '120'], ['chan', '3'], ['rndvel', '20']]) {
  verifier(compile(`S -> !(${nom}:${val}) C4`).errors.length === 0,
    `!(${nom}:${val}) est ACCEPTÉ — c'est la forme du langage`);
}
verifier(refuse('S -> !(xyzzy:1) C4').length > 0,
  "!(xyzzy:1) est REFUSÉ : un contrôle non déclaré ne compile pas, forme du langage comprise");
verifier(refuse('S -> !(xyzzy:1) C4').some((e) => /unknown/.test(e.message)),
  'et son refus dit que le nom est inconnu');

// ── LE COMPLÉMENT — LA PROLONGATION N'EST PAS TOUCHÉE ─────────────────────────────────────────
// Elle s'écrit avec le MÊME caractère. Un refus trop large la mangerait, et le compte de
// prolongations se corromprait EN SILENCE — c'est un défaut déjà payé une fois sur ce parseur.
verifier(compile('S -> C4 _ _').errors.length === 0, 'la prolongation nue « C4 _ _ » passe');
verifier(compile('S -> C4 _ !(vel:80) D4').errors.length === 0,
  "un « _ » SUIVI D'UN ESPACE puis d'un contrôle est une prolongation autonome : elle passe");
verifier(compile('S -> C4 _ _ _ D4').errors.length === 0, 'trois prolongations de suite passent');
{
  // Et le COMPTE de prolongations est intact — sans quoi le refus mangerait un `_` sans se voir.
  const r = compile('S -> C4 _ _ D4');
  const n = JSON.stringify(r.ast).match(/"type":"Prolongation"/g);
  verifier(n && n.length === 2, `les DEUX prolongations sont bien émises (${n ? n.length : 0})`);
}

// ── LE CORPUS EST DU BON CÔTÉ — la migration est faite, et ça se prouve sur les scènes ────────
{
  const D = '/home/romi/dev/bp/kanopi/packages/library/scenes/BPScript-tests';
  let scenes = [];
  try { scenes = readdirSync(D).filter((f) => f.endsWith('.bps')); } catch { /* corpus absent */ }
  verifier(scenes.length > 100, `le corpus de scènes est lisible(${scenes.length} scènes)`);
  const fautives = [];
  for (const f of scenes) {
    // Le commentaire cite légitimement la graphie native (« ordre natif : … ») : on ne lit que le CODE.
    const code = readFileSync(path.join(D, f), 'utf-8').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    if (/(^|[\s{,(!])_[A-Za-z][A-Za-z0-9]*\s*\(/m.test(code)) fautives.push(f);
  }
  verifier(fautives.length === 0,
    `AUCUNE scène du corpus n'emploie plus la graphie native en CODE${fautives.length ? ` (reste : ${fautives.join(', ')})` : ''}`);
}

// ── LE GARDE MORD : on injecte l'ancien comportement et on exige qu'il se voie ─────────────────
{
  // La faute d'origine = router `_nom(` vers un contrôle sans rien valider. On la simule et on
  // montre qu'elle donne l'autre verdict sur le cas qui compte.
  const ancienAcceptait = (src) => /^_[A-Za-z]+\(/.test(src); // routait, donc acceptait
  verifier(ancienAcceptait('_xyzzy(1)') && refuse('S -> _xyzzy(1) C4').length > 0,
    "l'ancien routage acceptait `_xyzzy(1)` là où le parseur corrigé le refuse : le garde mord");
}

console.log(`Résultat la_graphie_native_des_controles_ne_compile_pas : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
