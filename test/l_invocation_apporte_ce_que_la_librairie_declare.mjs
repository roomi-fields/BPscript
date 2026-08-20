#!/usr/bin/env node
/**
 * GARDE — INVOQUER UNE LIBRAIRIE APPORTE CE QU'ELLE DÉCLARE, PROTOTYPES COMPRIS.
 *
 * ⛔ CE QUI MANQUAIT. Le registre des prototypes ne se remplissait qu'à la lecture du fichier
 * COURANT. Écrire `types` en tête n'y ajoutait rien, donc `interval ionian (…)` était refusé dans
 * `lib/scales.bpsl` — et le refus ne nommait pas la cause, il tombait sur une erreur de syntaxe.
 * Un mécanisme qui ne faisait que la moitié de son travail : l'invocation apportait les contrôles
 * et pas les modèles, sans que rien ne dise pourquoi.
 *
 * ⚠️ CE QUE J'AVAIS CONCLU DE TRAVERS. J'avais mesuré qu'une invocation résout `vel` dans un fichier
 * de librairie, et j'en avais conclu que la résolution suivait pour tout. Elle ne suivait pas pour
 * les prototypes, et je ne l'ai su qu'en écrivant vraiment le fichier — pas en le raisonnant.
 *
 * ⛔ TOUTE ENTRÉE EST UN PROTOTYPE, et ce n'est pas trop large : en prototypal pur, tout objet peut
 * servir de modèle. Le parseur le fait déjà pour le fichier courant, où un exemplaire qui porte des
 * valeurs dérive au même titre qu'un prototype vide. Une gamme est donc dérivable, et c'est voulu.
 *
 * ⚠️ ET LA NATURE DÉCIDE, JAMAIS UNE LISTE DE NOMS. Une entrée est un OBJET ; les métas d'une
 * librairie sont des chaînes. Une liste de noms nommerait des champs, et un champ renommé la laisse
 * filtrer sur un mot mort sans que rien ne rougisse — la faute que Kanopi a payée le jour même sur
 * `domain`, retiré du langage dix jours plus tôt.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };
const passe = (src) => {
  try { return (compileToBPxAST(src).errors || []).length === 0; }
  catch { return false; }
};

// ── A. L'INVOCATION APPORTE LES PROTOTYPES — la faute d'origine ──────────────────────────────────
ok(passe('types\ninterval x (ratios(1))'), "A. ⛔ `types` invoquée rend son prototype `interval` dérivable");
ok(passe('types\ndirectional y (ascending(1), descending(2))'),
  "A. et jusqu'au troisième étage — `directional` dérive de `degree`, qui dérive de `scale`");
ok(passe('scale\nbilaval x (a:1)'), "A. une VRAIE entrée de catalogue dérive aussi — tout objet est un modèle");

// ── B. TÉMOINS — l'invocation apporte ce que LA librairie déclare, pas ce qu'une autre déclare ───
ok(!passe('core\ninterval x (ratios(1))'), "B. TÉMOIN — `core` ne déclare pas `interval`, il reste refusé");
ok(!passe('interval x (ratios(1))'), "B. TÉMOIN — sans aucune invocation, rien n'est apporté");
ok(!passe('types\nzorglubinvente x (a:1)'), "B. TÉMOIN — un mot que `types` ne déclare pas reste refusé");

// ── C. ⛔ LA NATURE FILTRE — une méta est une chaîne, jamais un modèle ───────────────────────────
ok(!passe('scale\nresolves x (a:1)'), "C. `resolves` est une chaîne : elle n'entre pas au registre");
ok(!passe('scale\nresolvedBy x (a:1)'), "C. `resolvedBy` non plus");
ok(!passe('types\nresolvedBy x (a:1)'), "C. ni par une librairie qui ne la porte même pas");

// ── C bis. ⛔ ET UNE ENTRÉE NE CONFISQUE PAS UN MOT DU LANGAGE ───────────────────────────────────
// Deux collisions mesurées le jour où ce mécanisme est né : `core` porte une SECTION nommée
// `settings`, et `types` un prototype nommé `scale`. Les deux sont des mots réservés. Sans ce
// refus, `settings` seul en tête de scène devenait une déclaration typée sans nom — le portillon
// l'a attrapé, ce garde-ci ne l'aurait pas vu. Le plus local gagne, et le langage l'est plus
// qu'une librairie.
ok(passe('core\nalphabet.western\nsettings\n-----\nS -> C4\n'),
  "C bis. `settings` reste un mot du langage, même si `core` porte une section de ce nom");
ok(!passe('types\nscale x (description:\"y\")'),
  "C bis. `scale` reste le mot qui invoque les gammes, même si `types` porte un prototype de ce nom");

// ── D. LA DONNÉE EST BIEN CELLE QU'ON CROIT — sinon les assertions ci-dessus ne prouvent rien ────
ok(LIBS.types && typeof LIBS.types === 'object', "D. la librairie `types` doit être publiée");
for (const n of ['scale', 'interval', 'degree', 'directional', 'composite']) {
  ok(LIBS.types?.[n] && typeof LIBS.types[n] === 'object', `D. la librairie types doit déclarer le prototype ${n}`);
}
ok(typeof LIBS.scales?.resolvedBy === 'string', "D. `resolvedBy` doit être une CHAÎNE — le volet C repose dessus");

const ATTENDU = 3 + 3 + 3 + 2 + 1 + 5 + 1;
ok(p + e.length === ATTENDU, `le garde doit éprouver ${ATTENDU} cas — ${p + e.length} seulement`);

if (e.length) { console.error(`[invocation] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[invocation] ${p} PASS / 0 FAIL — ${p} assertion(s)`);
