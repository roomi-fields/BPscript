#!/usr/bin/env node
/**
 * GARDE — LE TYPE EN TÊTE PORTE SON OBJET JUSQU'À L'ARBRE (EBNF.md, AST.md:119-150).
 * Le mot `var` est sorti le 2026-08-18 ; ce que ce fichier garde n'a pas bougé — un type déclaré,
 * un nom, et la nature qui voyage jusqu'au consommateur.
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
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const EN_TETE = 'core\nalphabet.western:midi\n';
const compile = (ligne) => {
  try { return compileToBPxAST(`${EN_TETE}${ligne}\nmode:ord\n-----\nS -> C4\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};
const msgs = (r) => (r.errors || []).map((e) => e.message ?? String(e));
/** La première (et seule) VarDirective d'une compilation à une seule ligne @var. */
const vd = (r) => (r.ast?.vars || [])[0] || null;

// ─── 1. LES HUIT FORMES DE LA RÉFÉRENCE COMPILENT, ET LE NŒUD PRODUIT CORRESPOND À AST.md ────
const FORMES = [
  ['flag section:1', 'un drapeau et sa valeur initiale',
    (n) => n?.names?.[0] === 'section'
      && n?.varType?.kind === 'flag'
      && n?.varType?.initiale === 1
      && JSON.stringify(n.varType.states) === '[]'],
  ['in.keyboard touches', 'une entrée (déjà portée — InDirective, hors `ast.vars`)',
    null, (r) => (r.ast?.inputs || []).some((i) => i.name === 'touches' && i.transport === 'keyboard')],
  ['signal grain', 'la convention signal',
    (n) => n?.names?.[0] === 'grain' && n?.varType?.kind === 'convention' && n.varType.convention === 'signal'],
  ['pitch hauteur', 'la convention pitch',
    (n) => n?.names?.[0] === 'hauteur' && n?.varType?.kind === 'convention' && n.varType.convention === 'pitch'],
  ['phase rotation', 'la convention phase',
    (n) => n?.names?.[0] === 'rotation' && n?.varType?.kind === 'convention' && n.varType.convention === 'phase'],
  ['logic porte', 'la convention logic',
    (n) => n?.names?.[0] === 'porte' && n?.varType?.kind === 'convention' && n.varType.convention === 'logic'],
  // ⛔ `ramp ramp1` A QUITTÉ CETTE MATRICE avec le catalogue qui le portait. `lib/mod.json` est
  // archivé le 2026-08-23 (décision de Romain) et ses trois entrées sortent du langage : le type
  // n'existe plus, et aucun chemin ne produit plus un `varType.kind === 'module'`.
  // ⚠️ LE CAS `lpf lpf1` PLUS BAS RESTE, ET IL CHANGE DE SENS : il éprouvait « un module RÉEL mais
  // absent des données » — un trou de catalogue. Il n'y a plus de catalogue, donc plus de trou : le
  // mot est désormais refusé pour la même raison qu'un mot inventé, et c'est ce que le volet dit.
  // ⛔ LE TYPE VOYAGE MÊME SANS PARENTHÈSE — prototypal pur, 2026-08-20. Ce volet exigeait
  // `varType === null` : il CERTIFIAIT la perte. Six types sortaient sans nature dès qu'aucune
  // parenthèse ne suivait, et un consommateur y lisait une variable anonyme là où l'auteur en
  // avait nommé une.
  ['symbol pivot', 'un nom seul — la parenthèse absente vaut parenthèse vide, ET LE TYPE VOYAGE',
    (n) => JSON.stringify(n?.names) === JSON.stringify(['pivot'])
           && n?.varType?.kind === 'type' && n.varType.type === 'symbol'],
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
  const r = compile('symbol z1, z2, z3');
  ok((r.errors || []).length === 0, `1. une liste de noms séparés par des virgules doit compiler — reçu : ${msgs(r).join(' | ')}`);
  const n = vd(r);
  ok(!!n && JSON.stringify(n.names) === JSON.stringify(['z1', 'z2', 'z3'])
     && n.varType?.kind === 'type' && n.varType.type === 'symbol',
    `1. et porter les TROIS noms dans UNE seule VarDirective, AVEC leur type — reçu : ${JSON.stringify(n)}`);
}

// ─── 2. LES TROIS REFUS, AVEC LEUR MESSAGE ENTIER ─────────────────────────────────────────────
// ⚠️ LES TROIS REFUS ONT CHANGÉ DE FORME LE 2026-08-18, PAS D'OBJET. Le TYPE vient désormais en
// tête : ce qui était refusé en seconde position l'est en première, et les états d'un drapeau
// passent du deux-points aux parenthèses.
const REFUS = [
  ['zorglub x', "un mot en tête qui ne désigne RIEN de connu",
    /'zorglub' n'est pas un type/],
  ['lpf lpf1', "un mot qui n'ouvre aucune déclaration — le catalogue de modules est archivé",
    /'lpf' n'est pas un type/],
];
for (const [ligne, quoi, attendu] of REFUS) {
  const r = compile(ligne);
  ok((r.errors || []).length > 0, `2. ${quoi} : '${ligne}' doit être REFUSÉ, et ne l'est pas`);
  ok(msgs(r).some((m) => attendu.test(m)),
    `2. ${quoi} : le message doit correspondre à ${attendu} — reçu : ${msgs(r).join(' | ').slice(0, 160)}`);
}
// ⛔ LE REFUS NE PRÉTEND PAS DISTINGUER CE QU'IL NE DISTINGUE PAS. Un mot hors catalogue
// et un mot inventé sont mécaniquement le MÊME cas — aucun n'est un type déclaré —, et le message
// est donc le même pour les deux. Ce qu'il DOIT faire, c'est ÉNUMÉRER les types connus : sans cette
// liste, l'auteur apprend seulement que son mot est faux, jamais lequel écrire.
{
  const rLpf = compile('lpf lpf1');
  const rZorglub = compile('zorglub x');
  // ⛔ LA LISTE ATTENDUE SE LIT DANS LA DONNÉE, elle ne se recopie pas ici. Elle était écrite en
  // dur — « flag, symbol, in.<canal> » — et le 2026-08-19 elle est devenue FAUSSE sans que rien ne
  // la corrige : cinq types nouveaux sont entrés dans `core.json` et ce garde a rougi en accusant
  // le MESSAGE, qui avait raison. Un garde qui recopie une liste devient sa concurrente.
  const TYPES_DECLARES = LIBS.core?.schema?.declarationTypes || [];
  // ⛔ 8 → 7 LE 2026-09-02 : `object` SORT des types de déclaration — décision de Romain, « def et
  // object disent exactement la même chose, on doit en supprimer un ; je préfère migrer object vers
  // def ». La racine s'écrit désormais `def <nom> (…)`. Le plancher suit UN retrait décidé, diff à
  // l'appui ; il ne baisse jamais parce qu'un extracteur a cessé de voir.
  ok(TYPES_DECLARES.length >= 7,
    `2. les types déclaratifs doivent se lire dans la donnée — reçu ${JSON.stringify(TYPES_DECLARES)}`);
  for (const [r, quoi] of [[rLpf, 'un mot hors catalogue'], [rZorglub, 'un mot inventé']]) {
    const m = msgs(r).join(' | ');
    // ⚠️ LE REFUS N'ÉNUMÈRE PLUS LES MODULES, et c'est voulu : un refus qui nomme une forme la
    // ressuscite pour son lecteur. Le catalogue est archivé le 2026-08-23, la liste part avec lui.
    ok(/signal, pitch, phase, logic/.test(m) && /in\.<canal>/.test(m) && !/adsr|lfo|ramp/.test(m),
      `2. le refus ${quoi} doit ÉNUMÉRER les conventions et le canal d'entrée, et NE PLUS nommer `
      + `les modules archivés — reçu : ${m.slice(0, 160)}`);
    const manquants = TYPES_DECLARES.filter((t) => !m.includes(t));
    ok(manquants.length === 0,
      `2. le refus ${quoi} doit nommer CHAQUE type déclaré dans la donnée — manque(nt) `
      + `${JSON.stringify(manquants)}. Reçu : ${m.slice(0, 200)}`);
  }
  ok(msgs(rLpf)[0] && msgs(rZorglub)[0]
     && msgs(rLpf)[0].replace(/lpf1?/g, '<x>') === msgs(rZorglub)[0].replace(/zorglub|\bx\b/g, '<x>'),
    "2. et les deux refus doivent être le MÊME message : le compilateur ne sait pas les distinguer");
}

// ─── 3. TÉMOINS D'INSTRUMENT — le garde sait MORDRE et sait se TAIRE ──────────────────────────
// Sans eux, une régression qui rendrait ce fichier muet le laisserait vert par accident.
{
  // ⛔ LE TÉMOIN A CHANGÉ D'OBJET LE 2026-08-20, PAS DE RÔLE. Un drapeau sans états n'est plus
  // refusé — c'est un MODÈLE, et l'incomplétude se refuse à l'USAGE, jamais à la déclaration.
  // Le témoin porte donc sur un mot qui ne désigne rien, qui reste refusé et le restera.
  const doitMordre = compile('zorglubinvente x');
  ok((doitMordre.errors || []).length > 0,
    "3. TÉMOIN — un mot en tête qui ne désigne rien doit être refusé (sinon ce fichier ne prouve rien)");
}
// ⛔ LE TÉMOIN DU MODULE VIVANT EST PARTI AVEC LE CATALOGUE. Il éprouvait que `adsr env1` compile,
// pour que « le refus mord » ne se confonde pas avec « le refus mord à l'aveugle ». Les sept autres
// formes de la matrice tiennent ce rôle : chacune doit compiler, et si le lecteur devenait gourmand
// elles rougiraient ensemble.
// ⚠️ SEPT DEPUIS LE 2026-08-23 : l'instance de module a quitté la référence avec son catalogue.
ok(FORMES.length === 7, `3. les SEPT formes de la référence doivent être éprouvées — ${FORMES.length + 1} (avec la liste de noms)`);
ok(REFUS.length === 2, `3. les DEUX refus doivent être éprouvés — ${REFUS.length}`);

if (echecs.length) {
  console.error(`❌ le type en tête porte son objet : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ le type en tête porte son objet jusqu'à l'arbre — ${passe} vérification(s) passée(s)`);
}
