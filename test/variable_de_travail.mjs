#!/usr/bin/env node
/**
 * GARDE — `@var` déclare des VARIABLES DE TRAVAIL : des symboles du flux qui ne sont l'écriture
 * d'aucune note.
 *
 * DÉCISION Romain 2026-07-27, voie 3 : « on déclare les symboles non-alphabet terminaux en plus,
 * avec une directive @. Ce sont des VARIABLES DE TRAVAIL. »
 *
 * LE BLOCAGE QUE ÇA LÈVE, mesuré avant d'être arbitré : `Nadaka-1er-essai` écrit `v8`, qui n'a
 * AUCUNE règle (ni dans la scène ni dans la grammaire d'origine) et n'est une note dans aucun
 * alphabet — le moteur natif l'émet littéralement comme jeton. Annoter la convention de notes de
 * cette scène la faisait REFUSER par le compilateur. Le langage confondait TERMINAL et NOTE.
 *
 * ⚠️ LE REFUS NE S'AFFAIBLIT PAS, il gagne une porte NOMMÉE. C'est tout l'intérêt de la voie
 * retenue sur les deux autres : une COQUILLE reste attrapée (elle n'est déclarée nulle part), un
 * symbole VOULU passe. Autoriser tout symbole hors alphabet aurait rendu les deux indistinguables.
 *
 * ⚠️ ET LA NATURE COMPTE AUTANT QUE LA PORTE. Sans nature propre, `@var` serait une porte qui ne
 * change RIEN : la scène compilerait et l'aval continuerait d'inventer une hauteur pour un symbole
 * qui n'en a pas — c'est exactement d'où venait le 7040 Hz que Kairos a mesuré. Accepter n'est pas
 * transmettre. Même mécanisme que la nature `wait`, posée deux jours plus tôt pour la même raison.
 *
 * ⚠️ NE PAS CONFONDRE avec le silence : un silence OCCUPE du temps. Une variable de travail n'est
 * pas un événement du tout.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const EN_TETE = '@core\n@controls\n@alphabet.western:midi\n@trigger sync1:midi\n';
const compile = (corps) => {
  try { return compileToBPxAST(`${EN_TETE}${corps}\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};
/** Toutes les feuilles nommées, à quelque profondeur qu'elles vivent. */
const feuilles = (n, out = []) => {
  if (Array.isArray(n)) { for (const x of n) feuilles(x, out); return out; }
  if (!n || typeof n !== 'object') return out;
  const nom = typeof n.symbol === 'string' ? n.symbol : n.name;
  if (nom && n.payload) out.push({ nom, nature: n.payload.nature });
  for (const k of ['symbol', 'triggers', 'primary', 'secondaries', 'voices', 'elements', 'content', 'items']) {
    if (n[k] && typeof n[k] === 'object') feuilles(n[k], out);
  }
  return out;
};
const toutesLesFeuilles = (ast) => {
  const out = [];
  for (const sg of ast?.subgrammars || []) for (const r of sg.rules || []) feuilles(r.rhs || [], out);
  return out;
};

// ─── 1. LA GRAPHIE — telle que validée, et rien de plus ──────────────────────────────────────
for (const [corps, quoi, attendus] of [
  ['@var v8\n@mode:ord\nS -> C4 v8', 'un symbole seul', ['v8']],
  ['@var a, b, c\n@mode:ord\nS -> C4 a b c', 'une liste séparée par des virgules', ['a', 'b', 'c']],
  ['@var a\n@var b\n@mode:ord\nS -> C4 a b', "deux lignes qui S'ACCUMULENT (elles ne se remplacent pas)", ['a', 'b']],
]) {
  const r = compile(corps);
  ok((r.errors || []).length === 0,
     `1. ${quoi} doit compiler — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
  for (const n of attendus) {
    ok((r.ast?.vars || []).includes(n), `1. ${quoi} : '${n}' doit ARRIVER dans l'arbre — reçu : ${JSON.stringify(r.ast?.vars)}`);
  }
}
// Pas de deux-points : on ÉNUMÈRE, on n'affecte pas. La forme fautive ne doit pas se glisser.
{
  const r = compile('@var: a\n@mode:ord\nS -> C4 a');
  ok((r.errors || []).length > 0, "1. '@var:' doit être refusé — le deux-points AFFECTE, ici on énumère");
}
{
  const r = compile('@var\n@mode:ord\nS -> C4');
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, '1. un @var sans nom doit être refusé');
  ok(msg.includes('@var'), `1. et le refus doit NOMMER la directive et donner la forme — reçu : ${msg.slice(0, 110)}`);
}

// ─── 2. LA PORTE NE DÉSARME PAS LE MUR ───────────────────────────────────────────────────────
// Le point de bascule de la voie retenue : ce qui n'est déclaré NULLE PART crie toujours.
{
  const r = compile('@var a\n@mode:ord\nS -> C4 a zzzz9');
  ok((r.errors || []).length > 0, "2. un symbole NON déclaré doit toujours CRIER, même quand la scène porte un @var");
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok(msg.includes('zzzz9') && !msg.includes("'a'"),
     `2. et le refus vise la coquille, PAS la variable déclarée — reçu : ${msg.slice(0, 120)}`);
}

// ─── 3. LA NATURE, DANS TOUTES LES POSITIONS OÙ UN SYMBOLE PEUT VIVRE ────────────────────────
// Écrite pour la CONSTRUCTION, pas pour la forme du ticket (CLAUDE.md, règle des quatre fois) :
// une variable n'est pas seulement un symbole nu au fil d'une règle. Elle peut être liée, ancrée,
// accordée, groupée, qualifiée, étiquetée, durée, ou vivre dans une autre sous-grammaire — et la
// forme dérivée perd volontiers ce que la forme nue porte (payé sur l'attente ancrée le 25).
for (const [corps, quoi] of [
  ['@var a\n@mode:ord\nS -> a C4', 'nue au fil de la règle'],
  ['@var a\n@mode:ord\nS -> a~ C4', 'LIÉE — le nom vit dans un autre champ'],
  ['@var a\n@mode:ord\nS -> a~ ~a C4', 'liée des deux côtés'],
  ['@var a\n@mode:ord\nS -> a<!sync1 C4', 'ANCRÉE à un point d\'attente'],
  ['@var a\n@mode:ord\nS -> C4!a', 'SECONDAIRE d\'un événement simultané'],
  ['@var a\n@mode:ord\nS -> a!C4', 'PRIMAIRE d\'un événement simultané'],
  ['@var a\n@mode:ord\nS -> {C4 a}', 'dans un groupe polymétrique'],
  ['@var a\n@mode:ord\nS -> a(vel:80) C4', 'porteuse d\'une annotation runtime'],
  ['@var a\n@mode:ord\nS -> groove:{C4 a, D4}', 'dans un groupe étiqueté'],
  ['@var a\n@mode:ord\nS -> a:2 C4', 'porteuse d\'une durée'],
  ['@var a\n@mode:ord\nS -> a a a', 'répétée'],
  ['@var a\n@mode:ord\nS -> C4\n-----\n@mode:ord\nT -> a', 'dans une AUTRE sous-grammaire'],
]) {
  const r = compile(corps);
  ok((r.errors || []).length === 0,
     `3. ${quoi} : doit compiler — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
  const vues = toutesLesFeuilles(r.ast).filter((f) => f.nom === 'a');
  ok(vues.length > 0, `3. ${quoi} : la variable doit ARRIVER dans l'arbre — aucune feuille 'a' trouvée`);
  const fautives = vues.filter((f) => f.nature !== 'var');
  ok(fautives.length === 0,
     `3. ${quoi} : CHAQUE occurrence porte la nature 'var' — ${fautives.length} sur ${vues.length} ne l'ont pas `
     + `(${JSON.stringify(fautives)})`);
  // Et surtout pas les deux natures qui la rendraient audible ou temporelle.
  ok(!vues.some((f) => f.nature === 'sounding'),
     `3. ${quoi} : JAMAIS 'sounding' — c'est ce qui faisait inventer une hauteur à un symbole qui n'en a pas`);
  ok(!vues.some((f) => f.nature === 'rest'),
     `3. ${quoi} : JAMAIS 'rest' — un silence OCCUPE du temps, une variable n'est pas un événement`);
}

// ─── 4. Une note reste une NOTE — on n'a pas déteint sur le voisinage ────────────────────────
{
  const r = compile('@var a\n@mode:ord\nS -> C4 a D4~ E4!F4');
  const notes = toutesLesFeuilles(r.ast).filter((f) => f.nom !== 'a');
  ok(notes.length >= 4, `4. les notes voisines doivent toutes arriver — ${notes.length} trouvée(s)`);
  ok(notes.every((f) => f.nature === 'sounding'),
     `4. et rester SONNANTES — reçu : ${JSON.stringify(notes)}`);
}

// ─── 5. Le nom d'une variable APPARTIENT à la scène ──────────────────────────────────────────
// Même règle que pour une macro : le plus local gagne, et un mot du vocabulaire ne le confisque pas.
{
  const r = compile('@var mute\n@mode:ord\nS -> C4 mute D4');
  ok((r.errors || []).length === 0,
     `5. une variable homonyme d'un mot du vocabulaire doit passer — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
  const vues = toutesLesFeuilles(r.ast).filter((f) => f.nom === 'mute');
  ok(vues.length === 1 && vues[0].nature === 'var',
     `5. et rester une variable, pas devenir un contrôle — reçu : ${JSON.stringify(vues)}`);
}

if (echecs.length) {
  console.error(`❌ variables de travail : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ variables de travail @var — ${passe} vérification(s) passée(s)`);
}
