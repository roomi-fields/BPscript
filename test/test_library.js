// LA BANQUE D'ÉCHANTILLONS — un paramètre INTRINSÈQUE au moteur, porté par l'acteur.
//
// ⚠️ CE FICHIER A CHANGÉ DE SUJET LE 2026-08-06, ET LE POURQUOI IMPORTE.
// Il testait `library.<moteur> "<banque>"`, une directive de scène. Elle est SUPPRIMÉE
// (décision Romain) : c'était la seule des quinze librairies dont ce qui suit le point n'était
// pas l'ENTRÉE du catalogue mais le MOTEUR, l'entrée venant après entre guillemets — trois
// pièces là où toutes les autres en ont deux. Mesuré avant de trancher : sa forme nue
// `library.strudel`, celle que la bible imprimait, ne compilait même pas.
//
// LA QUESTION, ELLE, N'A PAS CHANGÉ : la banque est-elle lisible dans l'arbre, sans table
// annexe ? Elle est seulement posée au nouvel endroit — `lib/eval.json` déclare `bank` sur
// l'entrée `strudel`, et l'acteur l'écrit `eval.strudel(bank:gm)`.
//
// CE QUE LE NOUVEAU MODÈLE PERMET ET QUE L'ANCIEN INTERDISAIT : deux voix du même moteur avec
// deux banques DIFFÉRENTES dans une seule scène. La directive était de portée scène.
//
// Run: node test/test_library.js

import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
const check = (cond, label) => { if (cond) { pass++; } else { fail++; console.error('  FAIL: ' + label); } };
const banqueDe = (ast, acteur) =>
  (ast?.actors || []).find((a) => a.name === acteur)?.properties?.entityParams?.eval?.bank;

// 1. La banque est portée par l'acteur et lisible dans l'arbre.
{
  const r = compileToBPxAST('core\nactor drums  eval.strudel(bank:gm)\n-----\nS -> drums_r\ndrums_r -> drums.`s("bd")`');
  check((r.errors || []).length === 0, 'compile sans erreur : ' + JSON.stringify(r.errors));
  check(banqueDe(r.ast, 'drums') === 'gm', 'banque lisible sur l acteur');
}

// 2. DEUX VOIX DU MÊME MOTEUR, DEUX BANQUES — ce que la directive de scène rendait impossible.
{
  const r = compileToBPxAST('core\nactor drums  eval.strudel(bank:gm)\nactor perc  eval.strudel(bank:dirt)\n-----\n'
                          + 'S -> drums_r perc_r\n-----\ndrums_r -> drums.`s("bd")`\n-----\nperc_r -> perc.`s("cp")`');
  check((r.errors || []).length === 0, 'deux banques compilent : ' + JSON.stringify(r.errors));
  check(banqueDe(r.ast, 'drums') === 'gm' && banqueDe(r.ast, 'perc') === 'dirt',
        'chaque voix garde la sienne : ' + banqueDe(r.ast, 'drums') + ' / ' + banqueDe(r.ast, 'perc'));
}

// 3. `bank` EST INTRINSÈQUE À STRUDEL — l'exigence exacte de Romain, et c'est la moitié qui
//    MORD : un paramètre déclaré sur une entrée ne vaut pas pour les autres entrées de l'axe.
{
  const r = compileToBPxAST('core\nactor v  eval.hydra(bank:gm)\n-----\nS -> v_r\nv_r -> v.`osc()`');
  check((r.errors || []).length > 0, 'bank sur hydra doit être REFUSÉ — il appartient à strudel');
  check((r.errors || []).some((e) => /n'est ni un paramètre de 'hydra'/.test(e.message)),
        'le refus nomme l entrée : ' + (r.errors || []).map((e) => e.message).join(' | '));
}

// 4. Un nom de paramètre inconnu refuse, et le refus dit où il aurait dû être déclaré.
{
  const r = compileToBPxAST('core\nactor d  eval.strudel(banque:gm)\n-----\nS -> d_r\nd_r -> d.`s("bd")`');
  check((r.errors || []).length > 0, 'un paramètre inconnu doit refuser');
}

// 5. LA PIERRE TOMBALE — la forme supprimée refuse, et NOMME sa relève. Sans ce cas, la
//    directive pourrait revenir en silence par une régression du parseur.
{
  const r = compileToBPxAST('library.strudel "dirt-samples"\ncore\n-----\nS -> C4\n');
  const msg = (r.errors || []).map((e) => e.message).join(' | ');
  check((r.errors || []).length > 0, 'library doit être REFUSÉE');
  check(/eval\.strudel\(bank:/.test(msg), 'le refus donne la forme vivante : ' + msg.slice(0, 120));
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
