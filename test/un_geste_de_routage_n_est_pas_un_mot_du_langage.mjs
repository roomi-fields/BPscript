#!/usr/bin/env node
/**
 * GARDE — un geste déclaré pour le ROUTAGE n'entre pas au VOCABULAIRE.
 *
 * RATIFIÉ PAR ROMAIN le 2026-08-13. Mes librairies ont DEUX MÉTIERS et ne savaient en dire qu'un :
 *   · le VOCABULAIRE BPScript — ce qu'un auteur a le droit d'écrire ;
 *   · l'AUTORITÉ DE ROUTAGE — ce que le frontal BP3 interroge pour traduire une grammaire NATIVE.
 * Toute entrée chargée entrait au vocabulaire : déclarer un geste le rendait forcément écrivable.
 *
 * CE QUE ÇA A COÛTÉ, LE JOUR MÊME. En retirant `value`, `fixed` et `cont` du langage — leur graphie
 * cassait deux canons, le paramètre est désormais la clé — j'ai retiré du même geste la
 * correspondance dont le frontal avait besoin. Le binaire les exécute toujours et SIX grammaires du
 * corpus natif les écrivent : il s'est retrouvé sans autorité sur des gestes que le moteur fait, et
 * a dû inscrire la lacune chez lui. Une décision de langage avait franchi une frontière qu'elle ne
 * visait pas.
 *
 * LA RÈGLE : `bpscript: false` sur l'entrée. La donnée garde la graphie native et le destinataire —
 * le frontal lit le BUNDLE, il route — mais le nom n'entre ni dans `ctx.controls` ni dans le
 * vocabulaire : une scène qui l'écrit est refusée comme avant.
 *
 * ⚠️ ET L'ABSENCE CESSE D'ÊTRE MUETTE, c'est le vrai gain : un mot que je ne déclare PAS DU TOUT est
 * un TROU ; un mot marqué `bpscript: false` est une DÉCISION. Le frontal cesse d'avoir à deviner
 * lequel des deux il a sous les yeux.
 *
 * INJECTION dans l'ACCUSÉ (le marqueur ignoré, l'exclusion posée trop tard) et dans le JUGE.
 */
import { createRequire } from 'node:module';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { registerLib, clearRegistry, registerAll } from '../src/transpiler/libs.js';
import { describeVocabulary } from '../src/transpiler/vocabulaire.js';

const require = createRequire(import.meta.url);
require('../src/transpiler/index.js');
// ⛔ UN INSTANTANÉ, PAS LA RÉFÉRENCE VIVANTE — ce garde vide et re-remplit le registre, et
// `leRegistre()` rend l'objet que `clearRegistry()` VIDE EN PLACE. Le bundle retiré le
// 2026-09-04 donnait une copie figée sans le dire ; ici on la prend, en la nommant.
const LIBS = structuredClone(require('../src/transpiler/libs.js').leRegistre());

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = 'core\nalphabet.western\n-----\n';
const erreursDe = (src) => {
  try { return compileToBPxAST(src).errors ?? []; } catch (e) { return [{ message: e.message }]; }
};

clearRegistry();
registerAll(LIBS);

/** Toutes les entrées marquées, quelle que soit leur librairie — la portée, pas les quatre connues. */
const marquees = [];
for (const [lib, f] of Object.entries(LIBS)) {
  if (!f || typeof f !== 'object') continue;
  for (const section of ['controls', 'engine', 'subgrammar']) {
    for (const [nom, def] of Object.entries(f[section] || {})) {
      if (def && typeof def === 'object' && def.bpscript === false) marquees.push({ lib, nom, def });
    }
  }
}

// ─── 0. SOCLE — refuser de conclure sur du vide ──────────────────────────────────────────────
ok(marquees.length >= 4,
   `0. SOCLE : au moins quatre entrées doivent porter le marqueur — vues ${marquees.length}. Sous ce `
   + 'seuil le garde ne mesure rien.');

const vocabulaire = new Set(describeVocabulary().controls.map((c) => c.name));

// ─── 1. LES DEUX MÉTIERS, SUR CHAQUE ENTRÉE MARQUÉE ──────────────────────────────────────────
for (const { lib, nom, def } of marquees) {
  ok(typeof def.bp3 === 'string' && def.bp3.length > 0,
     `1. '${nom}' (${lib}) est déclaré pour le ROUTAGE : il doit porter sa graphie native, sinon il `
     + `ne route rien et le marqueur ne sert à rien`);
  ok(!vocabulaire.has(nom),
     `1. '${nom}' (${lib}) porte 'bpscript: false' et figure POURTANT au vocabulaire — une scène `
     + `pourrait l'écrire, ce que le marqueur existe précisément pour interdire`);
  ok(erreursDe(`${TETE}S -> C4 (${nom}:x)\n`).length > 0,
     `1. '${nom}' écrit dans une scène doit être REFUSÉ — c'est la seule mesure qui compte, le reste `
     + `est une table`);
}

// ─── 2. LA DONNÉE RESTE LISIBLE PAR LE FRONTAL, qui lit le BUNDLE et pas mon contexte ────────
for (const { lib, nom, def } of marquees) {
  ok(LIBS[lib][ 'controls' ]?.[nom]?.bp3 === def.bp3,
     `2. '${nom}' doit rester dans le bundle avec sa graphie native — le frontal lit la DONNÉE, `
     + `pas mon vocabulaire ; l'en retirer le priverait de ce qu'il route`);
}

// ─── 3. LE COMPLÉMENT — un contrôle ORDINAIRE reste écrivable ────────────────────────────────
// Sans ce volet, exclure TOUT ferait passer le garde au vert en décrivant un langage vide.
for (const nom of ['vel', 'pan', 'velstep', 'rndtime']) {
  ok(vocabulaire.has(nom),
     `3. '${nom}' n'est pas marqué : il doit rester au vocabulaire — l'exclusion ne vaut que pour `
     + `ce qui la demande`);
}
ok(erreursDe(`${TETE}S -> C4(vel:100)\n`).length === 0,
   '3. un contrôle ordinaire doit continuer de compiler');

// ─── 4. LE MARQUEUR EST POSITIF ET PORTÉ PAR LA DONNÉE ───────────────────────────────────────
// Fabriqué EN MÉMOIRE : une librairie modifiée sur disque atteint mes consommateurs à la seconde
// où j'enregistre. Marquer une entrée VIVANTE doit la sortir du vocabulaire sans toucher au code.
{
  const sansVel = JSON.parse(JSON.stringify(LIBS.expression));
  sansVel.controls.vel = { ...sansVel.controls.vel, bpscript: false };
  registerLib('expression', sansVel);
  ok(erreursDe(`${TETE}S -> C4(vel:100)\n`).length > 0,
     "4. marquer une entrée VIVANTE doit la sortir du vocabulaire — le marqueur est porté par la "
     + 'DONNÉE, aucun nom de contrôle ne vit dans le code');
  clearRegistry();
  registerAll(LIBS);
  ok(erreursDe(`${TETE}S -> C4(vel:100)\n`).length === 0,
     '4. après restauration, `vel` doit redevenir écrivable — sinon le témoin fuit');
}

// ─── 4bis. LE MARQUEUR SE LIT STRICTEMENT — seul le booléen `false` exclut ───────────────────
// ⚠️ VOLET AJOUTÉ APRÈS UNE INJECTION MUETTE, ET LA PREMIÈRE VERSION DE CE VOLET ÉTAIT FAUSSE : je
// l'avais écrit sur la CHAÎNE 'false', or une lecture molle(`!def.bpscript && 'bpscript' in def`)
// traite une chaîne non vide comme VRAIE — les deux lectures s'accordent donc sur cette valeur, et
// le test ne pouvait rien séparer. C'est `null` qui les divise : strictement, ce n'est pas `false`
// et le mot RESTE au vocabulaire ; mollement, il en SORT. Une clé posée à `null` par un outil de
// génération retirerait alors un mot vivant du langage, en silence.
{
  const mou = JSON.parse(JSON.stringify(LIBS.expression));
  mou.controls.vel = { ...mou.controls.vel, bpscript: null };
  registerLib('expression', mou);
  ok(erreursDe(`${TETE}S -> C4(vel:100)\n`).length === 0,
     '4bis. `null` ne doit PAS exclure — seul le booléen `false` marque, sinon une clé posée à null '
     + 'par un outil retire un mot vivant du langage sans un signe');
  clearRegistry();
  registerAll(LIBS);
}

// ─── 5. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const juger = (def) => def.bpscript !== false;
ok(juger({}), '5. (se tait) sans marqueur, une entrée est un mot du langage');
ok(!juger({ bpscript: false }), '5. (mord) le marqueur sort l\'entrée du vocabulaire');
ok(juger({ bpscript: true }), '5. (se tait) le marqueur POSITIF ne sort rien');
ok(juger({ bpscript: 'false' }), "5. (se tait) la CHAÎNE 'false' n'est pas le booléen — un marqueur "
   + 'se lit strictement, sinon une coquille de typage exclurait un mot vivant');

if (echecs.length) {
  console.error(`❌ geste de routage devenu mot du langage : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ un geste de routage n'entre pas au vocabulaire — ${passe} vérification(s) passée(s), `
    + `${marquees.length} entrée(s) marquée(s)`);
}
