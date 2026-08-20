#!/usr/bin/env node
/**
 * GARDE — UNE PRIMITIVE PORTE SON TYPE, QUE LA PARENTHÈSE SOIT ÉCRITE OU NON.
 *
 * ⛔ LA FAUTE QU'IL TIENT. `control x` compilait et sortait avec `varType: null` — la déclaration
 * passait, le TYPE ne voyageait pas, et un consommateur lisait une variable sans nature là où
 * l'auteur en avait nommé une. Six primitives dans cet état, en silence. Réparé par 8ca99b4 : la
 * parenthèse absente vaut parenthèse vide, et le type voyage.
 *
 * ⚠️ POURQUOI CE GARDE EXISTE ALORS QUE LE PORTILLON ROUGIT DÉJÀ. Il rougit par RICOCHET : le garde
 * de la dérivation partage la ligne réparée, donc il tombe avec elle aujourd'hui. Il ne nomme pas
 * les primitives, et rien ne garantit que les deux chemins resteront le même. Un garde protège la
 * faute qu'on avait en tête quand on l'a écrit, jamais son complément — celui-ci EST le complément.
 *
 * ⛔ LA LISTE SE DÉRIVE, ELLE NE S'ÉCRIT PAS. Les primitives viennent de `core.schema`, la même
 * donnée que le parseur lit. Recopier douze noms ici rouvrirait l'écart que `typesDeclaratifs()`
 * ferme, et une primitive ajoutée demain sortirait du garde sans un signe.
 *
 * LES DEUX FAMILLES N'ONT PAS LA MÊME FORME, et le garde le dit plutôt que de l'uniformiser :
 * un TYPE s'écrit avec ou sans parenthèse ; une CONVENTION n'en prend pas.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const lire = (source) => {
  try {
    const r = compileToBPxAST(`${source}\n-----\nS -> C4\n`);
    return { erreurs: (r.errors || []).map((x) => String(x.message ?? x)), v: (r.ast?.vars || [])[0] };
  } catch (err) { return { erreurs: [String(err.message)], v: null }; }
};

const schema = LIBS.core?.schema || {};
const TYPES = schema.declarationTypes || [];
const CONVENTIONS = schema.varConventions || [];
ok(TYPES.length > 0, 'core.schema.declarationTypes doit être peuplé — sans lui le garde examine zéro');
ok(CONVENTIONS.length > 0, 'core.schema.varConventions doit être peuplé — sans lui le garde examine zéro');

// ── A. UN TYPE PORTE SON TYPE EN FORME NUE — la faute d'origine, primitive par primitive ─────────
for (const t of TYPES) {
  const nu = lire(`${t} truc`);
  ok(nu.erreurs.length === 0, `A. '${t} truc' doit COMPILER — la parenthèse absente vaut parenthèse vide`);
  const porte = t === 'flag' ? nu.v?.varType?.kind === 'flag' : nu.v?.varType?.type === t;
  ok(porte, `A. '${t} truc' doit porter son type — reçu ${JSON.stringify(nu.v?.varType)}`);
}

// ── B. ET LA FORME AVEC PARENTHÈSE PORTE LE MÊME — sinon la forme nue serait un régime à part ────
for (const t of TYPES) {
  const avec = lire(`${t} truc (x:1)`);
  ok(avec.erreurs.length === 0, `B. '${t} truc (x:1)' doit COMPILER`);
  const porte = t === 'flag' ? avec.v?.varType?.kind === 'flag' : avec.v?.varType?.type === t;
  ok(porte, `B. '${t} truc (x:1)' doit porter le MÊME type que sa forme nue — reçu ${JSON.stringify(avec.v?.varType)}`);
}

// ── C. UNE CONVENTION EST UNE AUTRE FAMILLE — elle se déclare nue, et refuse la parenthèse ───────
for (const c of CONVENTIONS) {
  const nu = lire(`${c} truc`);
  ok(nu.erreurs.length === 0 && nu.v?.varType?.convention === c,
    `C. '${c} truc' doit porter sa convention — reçu ${JSON.stringify(nu.v?.varType)}`);
  ok(lire(`${c} truc (x:1)`).erreurs.length > 0,
    `C. '${c} truc (x:1)' doit être REFUSÉ — une convention ne porte pas de corps`);
}

// ── D. TÉMOIN — le mécanisme ne s'ouvre pas à n'importe quel mot ─────────────────────────────────
ok(lire('zorglubinvente truc').erreurs.length > 0, "D. TÉMOIN — un mot qui ne désigne rien reste refusé, nu");
ok(lire('zorglubinvente truc (x:1)').erreurs.length > 0, "D. TÉMOIN — et refusé avec un corps");

// ⛔ Le compte se dérive de la donnée, il ne s'écrit pas : une primitive ajoutée l'augmente d'elle-même.
const ATTENDU = 2 + TYPES.length * 4 + CONVENTIONS.length * 2 + 2;
ok(p + e.length === ATTENDU, `le garde doit couvrir les ${TYPES.length} types et les ${CONVENTIONS.length} conventions — ${p + e.length} cas au lieu de ${ATTENDU}`);

if (e.length) { console.error(`[primitives] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[primitives] ${p} PASS / 0 FAIL — ${p} assertion(s)`);
