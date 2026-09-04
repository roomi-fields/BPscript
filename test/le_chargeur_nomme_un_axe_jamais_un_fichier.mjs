#!/usr/bin/env node
/**
 * GARDE — LE CHARGEUR NOMME UN AXE, JAMAIS UN FICHIER, DÈS QU'UN AXE EXISTE.
 *
 * ⛔ CE QU'IL TIENT. Un nom d'AXE est un mot du LANGAGE — celui que la scène écrit. Un nom de FICHIER
 * est un détail de mon rangement. Quand le chargeur nomme le fichier, mon rangement devient une
 * interface publique que je ne contrôle plus : renommer une librairie casse le code en silence.
 *
 * ⚠️ ET LA MESURE A CORRIGÉ MON PROPRE DIAGNOSTIC. J'avais remonté CINQ sites à réparer. Mesure faite,
 * TROIS étaient déjà corrects : `loadJsonFile` passe par la résolution d'axe avant toute chose, donc
 * `alphabet`, `settings` et `octaves` sont des mots d'axe et non des noms de fichier — deux d'entre
 * eux par homonymie avec leur fichier, ce qui les rend indistinguables à l'œil et corrects au code.
 * Seuls `digital` (axe `function`) et `voices` (axe `voice`) nommaient vraiment un fichier.
 *
 * ⛔ POURQUOI CE GARDE LIT LE CODE SOURCE. La faute est INVISIBLE à l'exécution : les deux chemins
 * rendent la même donnée, clé pour clé — mesuré avant la frappe. Aucun test de comportement ne peut
 * donc la voir. Elle ne se manifeste qu'au renommage d'un fichier, c'est-à-dire trop tard.
 *
 * LES TROIS QUI RESTENT SONT NOMMÉS ET JUSTIFIÉS, jamais tolérés en silence : `core` est le point
 * d'entrée — quelque chose doit nommer le premier fichier ; `modulation` et `language` ne déclarent
 * aucun mot d'invocation, donc aucun mot ne peut les désigner, et leur sort est une décision ouverte.
 */
import { readFileSync } from 'node:fs';
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

/** Les mots d'invocation que la DONNÉE déclare — jamais une liste écrite ici. */
const AXES = new Set(Object.values(LIBS).map((l) => l && typeof l === 'object' ? l.resolves : null).filter(Boolean));
ok(AXES.size > 0, 'la donnée doit déclarer des mots d\'invocation — sans eux le garde examine zéro');

/**
 * Les trois noms de fichier ADMIS, chacun avec sa raison. Un quatrième doit faire échouer ce garde :
 * on l'ajoute ici avec sa raison, ou on le branche sur son axe.
 */
const ADMIS = new Map([
  // ⛔ ET `modulation` EST SORTI LE 2026-08-22, DE LA MÊME FAÇON QUE `core` : ce garde a rougi dans
  // le geste même qui lui a donné son mot, en disant quoi faire. Il portait « décision ouverte chez
  // Romain » ; la décision est rendue — la clé `resolves` s'écrit sur les deux fichiers qui la
  // taisaient encore, `mapping` et `modulation`.
  // ⚠️ MESURÉ AVANT L'ÉCRITURE, et le champ ne DÉCIDE rien : `modulation` nu compilait déjà, et
  // `(cutoff:4000)` aussi. Le mot était donc bien celui-là, déduit du nom du fichier — c'est-à-dire
  // juste par coïncidence, et faux au premier renommage. Le champ le rend lisible.
  // ⛔ `core` EST SORTI D'ICI LE 2026-08-21, ET C'EST CE GARDE QUI L'A EXIGÉ. Il portait « point
  // d'entrée — quelque chose doit nommer le premier fichier ». Le jour où `core.json` a déclaré son
  // mot (`resolves:core`, régularisation des onze), le garde a rougi en disant exactement quoi
  // faire : « un axe le porte maintenant, le brancher dessus et le retirer d'ADMIS ». Une
  // dérogation dont le motif a disparu est un trou, pas une tolérance.
  //
  // ⛔ `language` EST SORTI AVEC LE SCHÉMA DE SYNTAXE, le même jour : il ne se charge plus par le
  // registre des librairies mais par sa propre porte, `syntaxe-data.js`.
]);

const source = readFileSync(new URL('../src/transpiler/libs.js', import.meta.url), 'utf8');

// Tout littéral passé en PREMIER argument à l'un des deux chargeurs — la graphie que le code écrit.
const appels = [...source.matchAll(/\b(loadJsonFile|loadLib)\(\s*'([^']+)'/g)]
  .map((m) => ({ fonction: m[1], nom: m[2] }));
ok(appels.length > 0, 'le garde doit trouver des appels au chargeur — zéro appel signifie que sa lecture est fausse');

const enDur = [];
for (const a of appels) {
  if (AXES.has(a.nom)) continue;              // un mot d'axe : c'est du langage, pas du rangement
  if (ADMIS.has(a.nom)) continue;             // nommé et justifié ci-dessus
  if (a.nom.includes('/')) continue;          // un sous-fichier (`settings/visser2`), pas un axe
  enDur.push(a);
}
ok(enDur.length === 0,
  `un chargement nomme un FICHIER alors qu'aucun axe ne le porte : ${enDur.map((x) => `${x.fonction}('${x.nom}')`).join(', ')}`
  + " — brancher sur l'axe que la librairie déclare, ou inscrire le nom dans ADMIS avec sa raison");

// ── LES DEUX RÉPARÉS — nommément, pour que leur retour en arrière se voie ────────────────────────
// ⚠️ `mapping` ET `modulation` NE SONT PAS ICI, ET C'EST DÉLIBÉRÉ. Ils DÉCLARENT leur axe depuis le
// 2026-08-22 — c'est ce qui les a sortis d'ADMIS — mais `libs.js` charge encore `modulation` par son
// NOM DE FICHIER. Les inscrire parmi les réparés affirmerait un branchement qui n'existe pas ; le
// volet `enDur` ci-dessus les laisse passer parce qu'un axe les porte, ce qui est vrai. Le
// branchement appartient au chantier des noms de librairies en dur, et il s'y fera.
// `digital`/`function` est sorti le 2026-09-03 : une manipulation est un contrôle du langage, et
// son corps se rattache à lui. Le couple `voices`/`voice` porte la même règle — le chargeur nomme
// l'AXE, jamais le fichier.
for (const [fichier, axe] of [['voices', 'voice']]) {
  ok(!appels.some((a) => a.nom === fichier), `'${fichier}' ne doit plus être chargé par son nom de fichier — l'axe est '${axe}'`);
  ok(AXES.has(axe), `l'axe '${axe}' doit être déclaré par une librairie — sans lui la réparation ne tient pas`);
}

// ── LES TROIS ADMIS DOIVENT RESTER SANS AXE — sinon leur dérogation n'a plus lieu d'être ─────────
for (const [nom, raison] of ADMIS) {
  ok(!AXES.has(nom), `'${nom}' est admis comme nom de fichier(${raison}) — mais un axe le porte maintenant : le brancher dessus et le retirer d'ADMIS`);
}

const ATTENDU = 1 + 1 + 3 + ADMIS.size;   // un couple fichier/axe depuis la sortie de `digital`
ok(p + e.length === ATTENDU, `le garde doit éprouver ${ATTENDU} cas — ${p + e.length} seulement`);

if (e.length) { console.error(`[chargeur] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[chargeur] ${p} PASS / 0 FAIL — ${p} assertion(s), ${appels.length} appel(s) examiné(s)`);
