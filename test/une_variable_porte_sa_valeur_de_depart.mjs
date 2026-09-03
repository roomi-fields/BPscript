#!/usr/bin/env node
/**
 * GARDE — une variable porte sa VALEUR DE DÉPART, et le sujet du deux-points est son NOM.
 *
 * CE QUI MANQUAIT, mesuré le 2026-08-13 : aucune forme ne donnait une valeur de départ à une
 * variable déclarée. Les trois graphies imaginables étaient refusées — `@init grain:0.5`, le bloc
 * `@init` indenté, et `@var grain signal:0.5`. Romain a tranché la voie A d'une phrase qui dit
 * exactement ce qui manquait : « init, c'est var plus une affectation ».
 *
 * ⛔ LE SUJET DU DEUX-POINTS EST LE NOM, JAMAIS LE TYPE. `@var grain:0.5 signal` se lit « grain
 * vaut 0.5, et c'est un signal ». La graphie concurrente `@var grain signal:0.5` est REFUSÉE et
 * ce refus est tenu ici : elle lierait la valeur à `signal`, donc elle dirait « signal vaut 0.5 »
 * — une phrase fausse sur un mot qui n'est pas le sujet. C'est le canon `:` du langage, celui-là
 * même qui distingue `Sa:sound.kick` de `alphabet.sargam`.
 *
 * ⚠️ AUCUN CONFLIT AVEC LE DRAPEAU, et il se prouve plutôt qu'il se raisonne. `@var section flag:
 * calm:1, full:2` porte son deux-points APRÈS le mot `flag`, jamais après le nom. Les deux formes
 * se distinguent sur la POSITION du signe, pas sur une convention de lecture — un drapeau non
 * touché est donc vérifié ici comme un témoin, pas comme une évidence.
 *
 * ⚠️ CHAQUE NOM D'UNE LISTE PORTE LA SIENNE : `@var a:1, b:2`. Une valeur unique partagée par la
 * liste serait une invention — la ligne énumère des variables DISTINCTES, et rien ne dit qu'elles
 * démarrent ensemble.
 *
 * ⛔ ET `@init` N'A PAS BOUGÉ. Romain : « on ne supprime pas init pour l'instant, on verra avec
 * FaustX. » La voie B — les affectations dans `@init` — reste REFUSÉE, et ce refus est tenu ici :
 * sans lui, les deux graphies coexisteraient, ce qui est exactement la voie parallèle qu'on
 * s'interdit. Une seule porte pour une valeur de départ.
 *
 * ⚠️ LE CHAMP EST ABSENT QUAND IL N'Y A PAS DE VALEUR, il ne vaut pas une liste vide : une
 * variable sans valeur de départ ne doit RIEN changer pour l'aval, qui lit `vars` depuis toujours.
 *
 * INJECTION dans l'ACCUSÉ et dans le JUGE.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = 'core\nalphabet.western\n';
const varsDe = (ligne) => {
  let r;
  try { r = compileToBPxAST(`${TETE}${ligne}\n\n-----\nS -> C4\n`); } catch (e) { return { erreur: e.message }; }
  if ((r.errors ?? []).length) return { erreur: r.errors[0].message };
  return ((r.ast ?? r).vars || [])[0] || {};
};
const refuse = (ligne) => Boolean(varsDe(ligne).erreur);

// ─── 0. SOCLE — une variable SANS valeur ne change pas de forme ──────────────────────────────
{
  const v = varsDe('signal grain');
  ok(!v.erreur && !('initial' in v),
     '0. SOCLE : une variable sans valeur de départ ne doit porter AUCUN champ `initial` — tout '
     + `l'aval lit \`vars\` depuis toujours(reçu ${JSON.stringify(v)})`);
  ok(v.varType?.convention === 'signal',
     `0. SOCLE : le type doit rester lu(reçu ${JSON.stringify(v.varType)})`);
}

// ─── 1. LES QUATRE FAMILLES DE `var` ACCEPTENT UNE VALEUR ───────────────────────────────────
// La portée s'écrit avec son complément : si une seule famille la portait, la forme serait une
// exception au lieu d'être la règle, et la suivante repartirait de zéro.
for (const [quoi, ligne, attendu] of [
  ['une convention',      'signal grain:0.5',  { name: 'grain', value: 0.5 }],
  ['une note',            'pitch hauteur:C4',  { name: 'hauteur', value: 'C4' }],
  ['un entier',           'signal n:3',        { name: 'n', value: 3 }],
  ['une variable nue',    'symbol compteur:7',        { name: 'compteur', value: 7 }],
]) {
  const v = varsDe(ligne);
  ok(!v.erreur && JSON.stringify(v.initial) === JSON.stringify([attendu]),
     `1. ${quoi} : '${ligne}' doit rendre ${JSON.stringify([attendu])} — reçu `
     + `${v.erreur ? `REFUS « ${v.erreur.slice(0, 60)} »` : JSON.stringify(v.initial)}`);
}

// ─── 2. LE SUJET EST LE NOM — les deux graphies concurrentes sont REFUSÉES ───────────────────
// ⚠️ CETTE SECTION A CHANGÉ DE CIBLE LE 2026-08-18, ET SON OBJET N'A PAS BOUGÉ. Elle refusait
// `signal grain:0.5` — la graphie concurrente TANT QUE le nom venait en tête (`var grain signal`).
// Depuis que le TYPE vient en tête, c'est cette ligne-là qui est la forme ratifiée, et la section
// 1 ci-dessus l'exige. La concurrente est désormais celle qui lie la valeur au TYPE.
ok(refuse('signal:0.5 grain'),
   "2. `signal:0.5 grain` doit être REFUSÉ : le deux-points y lierait la valeur au TYPE, donc il "
   + "dirait « signal vaut 0.5 ». Le sujet d'une affectation est le NOM.");
// ET LA VALEUR SE COLLE À SON SIGNE — détachée, elle se lirait comme un second terme.
ok(refuse('signal grain: 0.5'),
   "2. `signal grain: 0.5` doit être REFUSÉ : l'espace sépare deux termes, le collage les réunit.");

// ─── 3. LA VOIE B RESTE FERMÉE — une seule porte pour une valeur de départ ───────────────────
for (const [quoi, scene] of [
  ['sur la ligne', 'signal grain\n-----\ninit grain:0.5'],
  ['en bloc',      'signal grain\n-----\ninit\n  grain:0.5'],
]) {
  ok(refuse(scene),
     `3. \`init\` ${quoi} ne doit PAS accepter une valeur : deux graphies pour une valeur de `
     + 'départ seraient la voie parallèle qu\'on s\'interdit. `init` garde le code lancé une fois.');
}

// ─── 4. ⛔ LE DRAPEAU A CHANGÉ DE CÔTÉ LE 2026-08-22, ET CE VOLET GARDE L'INVERSE ─────────────
// Il gardait que le deux-points d'un drapeau n'initialise RIEN — il venait après le mot `flag` et
// séparait un état de sa valeur. Les états sont sortis (Romain), et le deux-points y porte
// désormais la VALEUR INITIALE. Le volet reste, retourné : c'est le seul endroit où l'on voit que
// ce signe a changé de rôle sur ce mot-là, et non qu'on l'a simplement oublié.
// ⚠️ ET IL NE SE CONFOND PAS AVEC LA VALEUR DE DÉPART DES AUTRES SORTES : celles-ci la portent dans
// `initial`, le drapeau dans `varType.initiale`. Deux champs, deux mécanismes — le volet le dit.
{
  const v = varsDe('flag section:1');
  ok(!v.erreur && v.varType?.kind === 'flag' && v.varType.initiale === 1
     && v.varType.states.length === 0 && !('initial' in v),
     '4. `flag section:1` : le deux-points du drapeau porte sa VALEUR INITIALE dans `varType`, '
     + `jamais dans le champ 'initial' des autres sortes, et il ne fabrique aucun état `
     + `(reçu ${JSON.stringify(v.varType)}, initial=${JSON.stringify(v.initial)})`);
}

// ─── 5. CHAQUE NOM D'UNE LISTE PORTE LA SIENNE ───────────────────────────────────────────────
{
  const v = varsDe('symbol a:1, b:2');
  ok(JSON.stringify(v.initial) === JSON.stringify([{ name: 'a', value: 1 }, { name: 'b', value: 2 }]),
     `5. 'symbol a:1, b:2' doit rendre DEUX valeurs distinctes — une valeur partagée serait une `
     + `invention (reçu ${JSON.stringify(v.initial)})`);
  const m = varsDe('symbol a:1, b');
  ok(JSON.stringify(m.initial) === JSON.stringify([{ name: 'a', value: 1 }])
     && JSON.stringify(m.names) === JSON.stringify(['a', 'b']),
     `5. un nom SANS valeur dans une liste qui en porte reste déclaré et n'en reçoit aucune `
     + `(reçu names=${JSON.stringify(m.names)} initial=${JSON.stringify(m.initial)})`);
}

// ─── 6. UNE VALEUR ABSENTE APRÈS LE SIGNE EST REFUSÉE, EN NOMMANT SA CAUSE ───────────────────
ok(refuse('symbol grain: signal'),
   '6. `symbol grain:` sans valeur doit être refusé — un deux-points qui n\'affecte rien passerait '
   + 'pour une déclaration ordinaire et la valeur disparaîtrait sans un signe.');

// ─── 7. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const sujetDu = (jetons) => {
  // Reproduit la règle : le deux-points qui suit IMMÉDIATEMENT le nom affecte ; celui qui suit
  // un mot de type ne lui appartient pas.
  const [nom, apres] = jetons;
  return apres === ':' ? nom : null;
};
ok(sujetDu(['grain', ':']) === 'grain', '7. (mord) le deux-points collé au nom affecte le NOM');
ok(sujetDu(['grain', 'signal']) === null, '7. (se tait) un type qui suit le nom n\'affecte rien');

if (echecs.length) {
  console.error(`❌ une variable ne porte pas sa valeur de départ : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ une variable porte sa valeur de départ — ${passe} vérification(s) passée(s)`);
}
