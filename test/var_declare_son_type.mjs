#!/usr/bin/env node
/**
 * GARDE — `@var` PORTE SON TYPE JUSQU'À L'ARBRE (EBNF.md:47-57, AST.md:119-150, 2026-08-05).
 *
 * ⚠️ CE QUE LE PARSER PERDAIT AVANT CE CHANTIER : chaque `@var` était réduit à ses noms nus
 * (`Scene.vars: string[]`), quel que soit le type écrit derrière — le `varType` n'avait nulle
 * part où survivre jusqu'à l'arbre. `docs/spec/AST.md:28` documente la cible `vars: VarDirective[]`.
 * Ce garde mesure la CONSTRUCTION (les six familles de `var_type`), pas la forme d'un ticket :
 *   1. "flag" ":" flag_state {"," flag_state}
 *   2. "in" "." IN_CHANNEL                          (déjà porté ailleurs — vérifié, pas réécrit ici)
 *   3-6. CONVENTION = "signal" | "pitch" | "phase" | "logic"
 *   7. IDENT nu — une INSTANCE d'un module du catalogue (`lib/mod.json`)
 *   8. aucun type — un nom seul, ou plusieurs séparés par des virgules
 *
 * ⚠️ ET `@flag` (directive de TÊTE de scène) EST TOMBÉE DANS LE MÊME MOUVEMENT : la référence ne
 * connaît que quatre mots déclaratifs (`actor`/`var`/`def`/`init`, EBNF.md:29-33) — un drapeau est
 * une VARIABLE, pas un cinquième mot. La forme unique est `@var <nom> flag: <état>:<entier>, ...`.
 *
 * ⚠️ « UN TYPE INCONNU SE REFUSE » (LANGUAGE.md) — un IDENT qui n'est ni un mot-clé ("flag"), ni
 * une CONVENTION, ni un module DU CATALOGUE est REFUSÉ, jamais accepté à l'aveugle. Deux causes
 * distinctes existent pour la même famille de refus : un module RÉEL mais absent des données
 * (`lpf`/`saw`/`vca` — trou de catalogue connu et assumé, traité ailleurs) et un IDENT qui ne
 * désigne RIEN DE CONNU (`zorglub`) — mécaniquement le MÊME refus, et le message le dit dans les
 * deux cas : « absent du catalogue », jamais « type inconnu » (qui ne distinguerait rien de plus).
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const EN_TETE = '@core\n@controls\n@alphabet.western:midi\n';
const compile = (ligne) => {
  try { return compileToBPxAST(`${EN_TETE}${ligne}\n@mode:ord\nS -> C4\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};
const msgs = (r) => (r.errors || []).map((e) => e.message ?? String(e));
/** La première (et seule) VarDirective d'une compilation à une seule ligne @var. */
const vd = (r) => (r.ast?.vars || [])[0] || null;

// ─── 1. LES HUIT FORMES DE LA RÉFÉRENCE COMPILENT, ET LE NŒUD PRODUIT CORRESPOND À AST.md ────
const FORMES = [
  ['@var section flag: calm:1, full:2', 'un drapeau et ses états nommés',
    (n) => n?.names?.[0] === 'section'
      && n?.varType?.kind === 'flag'
      && JSON.stringify(n.varType.states) === JSON.stringify([{ name: 'calm', value: 1 }, { name: 'full', value: 2 }])],
  ['@var touches in.keyboard', 'une entrée (déjà portée — InDirective, hors `ast.vars`)',
    null, (r) => (r.ast?.inputs || []).some((i) => i.name === 'touches' && i.transport === 'keyboard')],
  ['@var grain signal', 'la convention signal',
    (n) => n?.names?.[0] === 'grain' && n?.varType?.kind === 'convention' && n.varType.convention === 'signal'],
  ['@var hauteur pitch', 'la convention pitch',
    (n) => n?.names?.[0] === 'hauteur' && n?.varType?.kind === 'convention' && n.varType.convention === 'pitch'],
  ['@var rotation phase', 'la convention phase',
    (n) => n?.names?.[0] === 'rotation' && n?.varType?.kind === 'convention' && n.varType.convention === 'phase'],
  ['@var porte logic', 'la convention logic',
    (n) => n?.names?.[0] === 'porte' && n?.varType?.kind === 'convention' && n.varType.convention === 'logic'],
  ['@var ramp1 ramp', 'un module DU CATALOGUE (`ramp` vit dans lib/mod.json)',
    (n) => n?.names?.[0] === 'ramp1' && n?.varType?.kind === 'module' && n.varType.module === 'ramp'],
  ['@var pivot', 'un nom seul, sans type',
    (n) => JSON.stringify(n?.names) === JSON.stringify(['pivot']) && n?.varType === null],
];
for (const [ligne, quoi, verifNoeud, verifAlt] of FORMES) {
  const r = compile(ligne);
  ok((r.errors || []).length === 0, `1. ${quoi} : '${ligne}' doit compiler — reçu : ${msgs(r).join(' | ')}`);
  if (verifAlt) {
    ok(verifAlt(r), `1. ${quoi} : le nœud attendu doit ARRIVER dans l'arbre — reçu : ${JSON.stringify(r.ast?.inputs)}`);
  } else {
    const n = vd(r);
    ok(!!n && verifNoeud(n), `1. ${quoi} : le nœud VarDirective ne correspond pas à AST.md:119-150 — reçu : ${JSON.stringify(n)}`);
  }
}
// La forme à plusieurs noms — distincte du tableau ci-dessus car elle porte PLUSIEURS `names`.
{
  const r = compile('@var z1, z2, z3');
  ok((r.errors || []).length === 0, `1. une liste de noms séparés par des virgules doit compiler — reçu : ${msgs(r).join(' | ')}`);
  const n = vd(r);
  ok(!!n && JSON.stringify(n.names) === JSON.stringify(['z1', 'z2', 'z3']) && n.varType === null,
    `1. et porter les TROIS noms dans UNE seule VarDirective, sans type — reçu : ${JSON.stringify(n)}`);
}

// ─── 2. LES TROIS REFUS, AVEC LEUR MESSAGE ENTIER ─────────────────────────────────────────────
const REFUS = [
  ['@flag section: calm:1', "'@flag' n'existe plus en directive de tête de scène",
    /n'est pas une directive de tête de scène/],
  ['@var x zorglub', "un IDENT qui ne désigne RIEN de connu — refusé comme un module absent",
    /'zorglub' est absent du catalogue de modules/],
  ['@var x lpf', "un module RÉEL mais absent des données (trou de catalogue connu)",
    /'lpf' est absent du catalogue de modules/],
];
for (const [ligne, quoi, attendu] of REFUS) {
  const r = compile(ligne);
  ok((r.errors || []).length > 0, `2. ${quoi} : '${ligne}' doit être REFUSÉ, et ne l'est pas`);
  ok(msgs(r).some((m) => attendu.test(m)),
    `2. ${quoi} : le message doit correspondre à ${attendu} — reçu : ${msgs(r).join(' | ').slice(0, 160)}`);
}
// Le message des deux refus de module doit dire « absent du catalogue », JAMAIS « type inconnu » —
// exigence explicite : les deux causes sont mécaniquement le MÊME refus (lookup `lib/mod.json`),
// et le message ne doit pas prétendre distinguer ce qu'il ne distingue pas.
{
  const rLpf = compile('@var x lpf');
  const rZorglub = compile('@var x zorglub');
  ok(!msgs(rLpf).some((m) => /type inconnu/.test(m)),
    "2. le refus d'un module absent du catalogue ne doit JAMAIS dire 'type inconnu'");
  ok(!msgs(rZorglub).some((m) => /type inconnu/.test(m)),
    "2. le refus d'un IDENT qui ne désigne rien ne doit JAMAIS dire 'type inconnu' non plus");
}

// ─── 3. TÉMOINS D'INSTRUMENT — le garde sait MORDRE et sait se TAIRE ──────────────────────────
// Sans eux, une régression qui rendrait ce fichier muet le laisserait vert par accident.
{
  const doitMordre = compile('@var x flag sans_deux_points:1'); // 'flag' sans ':' — forme fautive
  ok((doitMordre.errors || []).length > 0,
    "3. TÉMOIN — 'flag' sans deux-points doit être refusé (sinon ce fichier ne prouve rien)");
}
{
  const doitSeTaire = compile('@var env1 adsr'); // module réellement au catalogue
  ok((doitSeTaire.errors || []).length === 0,
    "3. TÉMOIN — un module RÉELLEMENT au catalogue doit compiler (sinon le refus mord à l'aveugle)");
}
ok(FORMES.length === 8, `3. les HUIT formes de la référence doivent être éprouvées — ${FORMES.length + 1} (avec la liste de noms)`);
ok(REFUS.length === 3, `3. les TROIS refus doivent être éprouvés — ${REFUS.length}`);

if (echecs.length) {
  console.error(`❌ @var porte son type : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ @var porte son type jusqu'à l'arbre — ${passe} vérification(s) passée(s)`);
}
