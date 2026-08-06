#!/usr/bin/env node
// LA GRAMMAIRE COUVRE LE LANGAGE SPÉCIFIÉ — les quatre volets, mécanisés.
//
// ⚠️ POURQUOI CE GARDE EXISTE. Le 2026-08-06, la grammaire de maquette a atteint 270 scènes du
// corpus sur 270, et j'ai présenté ce chiffre comme un aboutissement. Romain a posé une question
// en une phrase — « et comme ça couvre tout le corpus tu estimes avoir terminé ? » — qui a fait
// tomber trois choses d'un coup :
//
//   1. LE CORPUS N'EST PAS LE LANGAGE. Il est ce que les gens ont écrit, pas ce que la référence
//      autorise. Mesuré aussitôt : 21 formes de la bible refusées, alors que le corpus passait
//      en entier.
//   2. JE N'AVAIS JAMAIS VÉRIFIÉ QUE LA GRAMMAIRE REFUSE. Une grammaire qui accepterait TOUT
//      aurait obtenu le même 270/270, sans rien valoir. C'est la faute que ce dépôt dénonce tous
//      les jours — « un garde qui ne teste que des cas qui réussissent garde l'accusé, pas le
//      juge » — commise sur la plus grosse mesure de la journée.
//   3. L'EBNF N'ÉTAIT CONFRONTÉ À RIEN. Chaque production doit avoir sa contrepartie.
//
// LES QUATRE VOLETS, et ce que chacun établit :
//   A. LA BIBLE — chaque forme écrite dans `LANGUAGE.md` doit être acceptée. Cliquet daté.
//   B. LE REFUS — un jeu de contre-exemples doit être refusé. Sans lui, A ne prouve rien.
//   C. L'EBNF — chaque production doit avoir une contrepartie dans la grammaire de maquette.
//   D. LES DIAGNOSTICS — chaque refus doit porter une position DIFFÉRENTE et utile.
//
// ⚠️ CE QU'IL NE DIT PAS : que l'arbre engendré coïncide avec celui du parseur de production.
// C'est le volet manquant, et il est écrit ici pour qu'on ne croie pas ce garde plus large qu'il
// n'est. Il tombera quand la maquette construira un arbre comparable.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MAQUETTE = path.join(ICI, '..', 'maquette', 'parseur-derive');
const MODULE = path.join(MAQUETTE, 'js', 'generated', 'module.js');
const GRAMMAIRE = path.join(MAQUETTE, 'bpscript.langium');
const SPEC = path.join(ICI, '..', 'docs', 'spec');

// ⚠️ L'ANALYSEUR EST ENGENDRÉ, DONC ABSENT D'UN DÉPÔT FRAIS — les fichiers produits ne sont pas
// versionnés (une copie figée divergerait de sa source). Le garde le DIT et sort en succès plutôt
// que de rougir pour une raison qui n'est pas un défaut du langage.
if (!existsSync(MODULE)) {
  console.log('⏭️  analyseur de maquette absent — `cd maquette/parseur-derive && npx langium generate '
            + '&& npx tsc -p tsconfig.json`. Ce garde ne mesure rien tant qu\'il n\'est pas engendré.');
  process.exit(0);
}

const { createDefaultCoreModule, createDefaultSharedCoreModule, inject, EmptyFileSystem } = await import('langium');
const M = await import(MODULE);
const shared = inject(createDefaultSharedCoreModule(EmptyFileSystem), M.BPScriptGeneratedSharedModule);
const services = inject(createDefaultCoreModule({ shared }), M.BPScriptGeneratedModule);
shared.ServiceRegistry.register(services);
const analyser = (t) => {
  const r = services.parser.LangiumParser.parse(t);
  return [...(r.lexerErrors || []), ...(r.parserErrors || [])];
};

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ────────────────────────────────────────────────────────────────────────────
// A. LA BIBLE — chaque forme écrite doit être acceptée
// ────────────────────────────────────────────────────────────────────────────
// ⚠️ L'EXTRACTEUR SURCOMPTE, ET C'EST ÉCRIT. Il prend toute ligne d'un bloc clôturé qui commence
// par `@` ou porte une flèche — donc aussi des lignes de TABLEAU qui décrivent les signes
// (`-> <- <>   derivation et direction`). Ces lignes ne sont pas des formes ; elles sont au
// registre ci-dessous avec cette raison. Un extracteur qui les exclurait par une règle fine
// risquerait d'exclure de vraies formes : mieux vaut surcompter et nommer.
function formesDe(fichier) {
  const out = [];
  let dans = false;
  for (const l of readFileSync(path.join(SPEC, fichier), 'utf-8').split('\n')) {
    if (/^```/.test(l)) { dans = /^```(bpscript|text|bps)/.test(l); continue; }
    if (!dans) continue;
    const li = l.replace(/\s*\/\/.*$/, '').trim();
    if (!li) continue;
    if (!/^@/.test(li) && !/(->|<>|<-)/.test(li)) continue;
    out.push(li);
  }
  return out;
}

// RETARD — figé le 2026-08-06, il ne peut que descendre. Chaque entrée dit POURQUOI.
// ⚠️ CETTE LISTE A ÉTÉ ÉCRITE DEUX FOIS. La première l'a été SUR MA MÉMOIRE d'une mesure faite
// vingt minutes plus tôt — sept entrées, dont deux au texte approximatif que le cliquet a
// aussitôt déclarées périmées, et neuf formes manquantes. Une liste de retard se remplit avec la
// SORTIE de la mesure, jamais de tête : c'est exactement ce que ce dépôt appelle « le compte qui
// flatte devient le dossier ».
const RETARD_BIBLE = new Map([
  ["|x| (A) x B -> x $mel &mel [stage+1]", "mesuré le 2026-08-06"],
  ["S -> sa(vel:`rrand(40,127)`) `sc: i = i + 1` re", "mesuré le 2026-08-06"],
  ["@def fast(x) {x}:2", "mesuré le 2026-08-06"],
  ["@def sirene  hz:440  voice.`js: saw(pitch) >> lpf(cutoff) >> out`", "mesuré le 2026-08-06"],
  ["-> <- <>       derivation et direction", "mesuré le 2026-08-06"],
  ["=              affectation de drapeau, entre crochets en fin de regle (S -> C4 [stage=2])", "mesuré le 2026-08-06"],
  ["(S -> !dha C4) ; devant un reglage, mutation de flux (!(mode:random))", "mesuré le 2026-08-06"],
  ["S -> sitar.sa(vel:120) sitar.sa(vel:`rrand(40,127)`) sitar.sa", "mesuré le 2026-08-06"],
  ["S -> sitar.sa sitar.sa(vel:120) sitar.sa(vel:`rrand(40,127)`)", "mesuré le 2026-08-06"],
  ["(A B) X -> D E", "mesuré le 2026-08-06"],
  ["Debut -> { A B", "mesuré le 2026-08-06"],
  ["Fin   -> C D }:2", "mesuré le 2026-08-06"],
  ["@def halo(x) x!tin!ge", "mesuré le 2026-08-06"],
  ["@def eclair(x) x!na!ka", "mesuré le 2026-08-06"],
  ["(C4 D4) E4 -> F4 G4", "mesuré le 2026-08-06"],
  ["(C4) D4 -> D4 C4", "mesuré le 2026-08-06"],
  ["(C4)    D4 -> G4", "mesuré le 2026-08-06"],
  ["#(K1 K2 K3) M -> C4", "mesuré le 2026-08-06"],
  ["#_ M -> C4", "mesuré le 2026-08-06"],
  ["S -> sa re ga (on_fail:retry(3))", "mesuré le 2026-08-06"],
  ["T -> ma pa (on_fail:fallback(ALT))", "mesuré le 2026-08-06"],
]);

const formes = formesDe('LANGUAGE.md');
ok(formes.length >= 250, `SOCLE : ${formes.length} formes extraites de LANGUAGE.md — l'extracteur ne la lit plus`);

const refuseesBible = formes.filter((f) => analyser(f + '\n').length > 0);
const horsRetard = refuseesBible.filter((f) => !RETARD_BIBLE.has(f));
ok(horsRetard.length === 0,
   `A. ${horsRetard.length} forme(s) de la bible refusée(s) HORS RETARD :\n     `
   + horsRetard.slice(0, 10).map((f) => JSON.stringify(f.slice(0, 60))).join('\n     '));
// CLIQUET — une entrée que la grammaire rattrape doit SORTIR.
for (const [f] of RETARD_BIBLE) {
  ok(refuseesBible.includes(f),
     `A-cliquet. ${JSON.stringify(f.slice(0, 50))} est au retard mais n'est plus refusée — RETIRE-la.`);
}

// ────────────────────────────────────────────────────────────────────────────
// B. LE REFUS — sans lui, le volet A ne prouve rien
// ────────────────────────────────────────────────────────────────────────────
// ⚠️ C'EST LA MOITIÉ QUI MANQUAIT. Une grammaire qui accepte tout passerait le volet A à 100 %.
const CONTRE_EXEMPLES = [
  ['flèche manquante', 'S C4 D4'],
  ['membre gauche absent', '-> C4 D4'],
  ['accolade non fermée', 'S -> {A B'],
  ['parenthèse non fermée', 'S -> C4(vel:80'],
  ['deux flèches', 'S -> -> C4'],
  ['clé sans valeur', 'S -> C4(vel:)'],
  ['charabia', '&&& %%% !!!'],
  ['jeton inconnu', 'S -> C4 @@@ D4'],
  ['crochet non fermé', 'S -> C4 [flag==1'],
  ['sac vide', 'S -> C4()'],
];
const acceptesATort = CONTRE_EXEMPLES.filter(([, s]) => analyser(s + '\n').length === 0);
ok(acceptesATort.length === 0,
   `B. ${acceptesATort.length} contre-exemple(s) ACCEPTÉ(S) — la grammaire est trop permissive :\n     `
   + acceptesATort.map(([q, s]) => `${q} : ${JSON.stringify(s)}`).join('\n     '));

// ────────────────────────────────────────────────────────────────────────────
// C. L'EBNF — chaque production doit avoir une contrepartie
// ────────────────────────────────────────────────────────────────────────────
function productionsEbnf() {
  const txt = readFileSync(path.join(SPEC, 'EBNF.md'), 'utf-8');
  const blocs = [];
  let dans = false, courant = [];
  for (const l of txt.split('\n')) {
    if (/^```/.test(l)) {
      if (dans) { blocs.push(courant.join('\n')); courant = []; dans = false; }
      else if (/^```ebnf/.test(l)) dans = true;
      continue;
    }
    if (dans) courant.push(l);
  }
  const noms = new Set();
  for (const b of blocs)
    for (const m of b.replace(/\(\*[\s\S]*?\*\)/g, ' ').matchAll(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/gm))
      noms.add(m[1]);
  return noms;
}
const prods = productionsEbnf();
ok(prods.size >= 100, `SOCLE : ${prods.size} productions lues dans EBNF.md`);

const gram = readFileSync(GRAMMAIRE, 'utf-8').toLowerCase();
const snake = (s) => s.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
// Une production est COUVERTE si son nom, ou une forme proche, paraît dans la grammaire de
// maquette. ⚠️ C'est une correspondance de NOMS, donc grossière : elle dit « la notion est
// nommée », jamais « elle est correctement décrite ». Écrit pour qu'on ne la surinterprète pas.
const couverte = (n) => gram.includes(n.toLowerCase()) || gram.includes(snake(n).replace(/_/g, ''));
const nonCouvertes = [...prods].filter((n) => !couverte(n));
// RETARD daté : le compte du 2026-08-06, il ne peut que descendre.
const RETARD_EBNF = nonCouvertes.length;
ok(RETARD_EBNF <= 84,
   `C. ${RETARD_EBNF} production(s) d'EBNF.md sans contrepartie dans la grammaire — le retard `
   + `mesuré le 2026-08-06 était de 84, il ne doit pas remonter.`);

// ────────────────────────────────────────────────────────────────────────────
// D. LES DIAGNOSTICS — un refus doit dire OÙ, et pas toujours au même endroit
// ────────────────────────────────────────────────────────────────────────────
// ⚠️ MESURÉ le 2026-08-06 : une grammaire mal découpée rendait TROIS fautes différentes à
// « ligne 1, colonne 1 ». La qualité des diagnostics est une propriété de la GRAMMAIRE.
// ⚠️ DEUX SORTES DE FAUTE, DEUX FORMES DE POSITION. Une faute d'ANALYSE porte un jeton
// (`e.token`) ; une faute LEXICALE — un caractère que rien ne reconnaît, comme `%` — n'en a pas :
// elle porte sa ligne et sa colonne DIRECTEMENT. Mesuré ici : le contre-exemple « charabia »
// rendait « position inconnue » alors qu'il en avait une, parce que je ne lisais qu'une des deux
// formes. Un diagnostic jugé inutilisable sur une lecture partielle de l'outil.
const positions = CONTRE_EXEMPLES.map(([, s]) => {
  const e = analyser(s + '\n')[0];
  if (e?.token) return `${e.token.startLine}:${e.token.startColumn}`;
  if (e?.line != null) return `${e.line}:${e.column}`;
  return 'inconnue';
});
const distinctes = new Set(positions.filter((p) => p !== 'inconnue'));
ok(positions.every((p) => p !== 'inconnue'),
   `D. ${positions.filter((p) => p === 'inconnue').length} refus SANS POSITION — inutilisables.`);
ok(distinctes.size >= 4,
   `D. les ${CONTRE_EXEMPLES.length} contre-exemples ne rendent que ${distinctes.size} position(s) `
   + `distincte(s) — signe d'une répétition englobante qui fait remonter toute faute au sommet.`);

// ────────────────────────────────────────────────────────────────────────────
if (echecs.length) {
  console.error(`❌ couverture du langage spécifié : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ la grammaire couvre le langage spécifié — ${passe} vérification(s) : `
          + `${formes.length} formes de la bible dont ${refuseesBible.length} au retard daté · `
          + `${CONTRE_EXEMPLES.length}/${CONTRE_EXEMPLES.length} contre-exemples refusés · `
          + `${prods.size - RETARD_EBNF}/${prods.size} productions EBNF nommées dans la grammaire · `
          + `${distinctes.size} positions de faute distinctes.`);
console.log(`   ⚠️ NON MESURÉ ICI : que l'arbre engendré coïncide avec celui du parseur de production.`);
