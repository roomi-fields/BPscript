#!/usr/bin/env node
/**
 * GARDE — UN ÉTAT QUI NE DÉSIGNE RIEN SE REFUSE À L'USAGE, ET UN DRAPEAU SANS DÉCLARATION RESTE LIBRE.
 *
 * Les deux volets sont le MÊME garde parce qu'ils tiennent l'un contre l'autre. Le refus seul a déjà
 * cassé le corpus une fois, et la liberté seule laisserait revenir l'état fantôme.
 *
 * ⛔ CE QUE LE PREMIER VOLET REFUSE. Quand l'auteur a écrit ce qu'un drapeau accepte —
 * `flag section(a:1, b:2)` — un nom hors de cette liste ne se compare à rien. Décision du
 * 2026-08-20 : l'incomplétude se refuse à l'USAGE, jamais à la déclaration.
 *
 * ⛔ CE QUE LE SECOND VOLET PROTÈGE, ET IL EST LE PLUS IMPORTANT. `X -> lambda [Num_a=20, Num_b=0]`
 * crée ses drapeaux à l'usage, sans aucune ligne de déclaration — forme BP3, forme VIVANTE : 44
 * scènes sur les 583 des trois dépôts l'emploient, dont trois d'ici. Une première écriture de ce cri
 * les refusait toutes. Sans ce volet écrit, un geste futur les recasse et le garde reste vert.
 *
 * ⚠️ POURQUOI LA MATRICE EST SI LARGE. Un garde s'écrit pour la CONSTRUCTION, jamais pour la forme
 * signalée. La faute est apparue sur `==` ; l'EBNF donne SIX comparateurs et TROIS mutateurs, et le
 * cri les traverse tous par le même chemin. Écrire `==` seul aurait laissé cinq portes ouvertes.
 *
 * ⚠️ ET LA GRAPHIE VIENT D'UNE SCÈNE RÉELLE, jamais d'un commentaire ni de ma mémoire. Les deux
 * premières écritures de ce fichier acceptaient TOUT — `var s flag: a:1` et l'absence de `-----`
 * sont refusées avant d'atteindre le cri, donc l'injection ne mordait sur rien et rassurait.
 */
import { readFileSync } from 'node:fs';
import { compileToBPxAST } from '../src/transpiler/index.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

/** Une scène qui DÉCLARE deux drapeaux, plus la règle qu'on éprouve. */
const DECL = 'flag section(a:1, b:2)\nflag autre(x:1)\n-----\nS -> A\n';
const cri = (regle, tete = DECL) => {
  try {
    const r = compileToBPxAST(`${tete}${regle}\n`);
    return (r.errors || []).map((x) => String(x.message ?? x));
  } catch (err) { return [String(err.message)]; }
};
const refuse = (regle, tete) => cri(regle, tete).some((m) => /drapeau|état/i.test(m));
const passe = (regle, tete) => cri(regle, tete).length === 0;

const COMPARE = ['==', '!=', '>', '<', '>=', '<='];
const MUTE = ['=', '+', '-'];

// ── A. L'ÉTAT INCONNU EST REFUSÉ — sur les six comparateurs et les trois mutateurs ───────────────
for (const op of COMPARE) {
  ok(refuse(`[section${op}zz] A -> C4`), `A. garde '[section${op}zz]' doit être REFUSÉ — 'zz' n'est pas un état de 'section'`);
}
for (const op of MUTE) {
  ok(refuse(`A -> C4 [section${op}zz]`), `A. mutation '[section${op}zz]' doit être REFUSÉE — 'zz' n'est pas un état de 'section'`);
}

// ── B. LE COMPLÉMENT — les trois natures de valeur LÉGITIMES passent, sur tous les opérateurs ────
for (const op of COMPARE) {
  ok(passe(`[section${op}a] A -> C4`), `B. garde '[section${op}a]' doit PASSER — 'a' est un état déclaré`);
  ok(passe(`[section${op}autre] A -> C4`), `B. garde '[section${op}autre]' doit PASSER — le nom d'un autre drapeau reste admis (fidèle BP3)`);
  ok(passe(`[section${op}1] A -> C4`), `B. garde '[section${op}1]' doit PASSER — un entier littéral ne se résout pas`);
}
for (const op of MUTE) {
  ok(passe(`A -> C4 [section${op}a]`), `B. mutation '[section${op}a]' doit PASSER — état déclaré`);
  ok(passe(`A -> C4 [section${op}autre]`), `B. mutation '[section${op}autre]' doit PASSER — autre drapeau`);
  ok(passe(`A -> C4 [section${op}1]`), `B. mutation '[section${op}1]' doit PASSER — entier littéral`);
}

// ── C. LES FORMES SANS VALEUR — rien à résoudre, donc rien à refuser ─────────────────────────────
for (const forme of ['[section+1]', '[section-1]', '[section]']) {
  ok(passe(`${forme} A -> C4`), `C. '${forme}' doit PASSER — la garde ne porte aucun nom d'état`);
}

// ── D. ⛔ LE RÉGIME BP3 — aucune déclaration, le drapeau naît à l'usage et RIEN ne le refuse ──────
const NU = 'S -> X [Num_a=20, Num_b=0]\n';
ok(passe('[Num_a>Num_b] X -> C4', NU), "D. un drapeau NON déclaré se compare librement — 44 scènes vivantes en dépendent");
ok(passe('[Num_a==zz] X -> C4', NU), "D. et même vers un nom inconnu : sans liste déclarée, il n'y a rien à contredire");
ok(passe('X -> C4 [Num_a=zz]', NU), "D. idem en mutation — le refus ne vaut QUE là où l'auteur a écrit la liste");
for (const op of COMPARE) {
  ok(passe(`[Num_a${op}zz] X -> C4`, NU), `D. régime BP3 sur '${op}' — aucun comparateur ne doit réveiller le cri`);
}

// ── E. LE MODÈLE VIDE — déclaré sans aucun état, il ne peut servir que de modèle ─────────────────
ok(refuse('[s==a] A -> C4', 'flag s\n-----\nS -> A\n'),
  "E. 'flag s' ne déclare aucun état : son usage est refusé, et c'est le contraire du drapeau NON déclaré");

// ── F. CE QUE LE CRI EXISTE POUR FAIRE — l'état nommé devient un ENTIER dans l'AST ───────────────
{
  const r = compileToBPxAST(`${DECL}[section==b] A -> C4\n`);
  const g = r.ast?.subgrammars?.[0]?.rules?.map((x) => x.guard).flat().filter(Boolean).find((x) => x.flag === 'section');
  ok(g?.value === 2, `F. '[section==b]' doit porter la valeur ENTIÈRE 2 dans l'AST — reçu ${JSON.stringify(g?.value)}`);
  const r2 = compileToBPxAST(`${DECL}A -> C4 [section=b]\n`);
  const f = (r2.ast?.subgrammars?.[0]?.rules || []).flatMap((x) => x.flags || []).find((x) => x.flag === 'section');
  ok(f?.value === 2, `F. la mutation '[section=b]' doit porter 2 — reçu ${JSON.stringify(f?.value)}`);
}

// ── G. LE CORPUS VIVANT — les scènes d'ici qui créent un drapeau à l'usage compilent ─────────────
{
  const vivantes = [
    'public/demos/flags-counter.bps',
    'public/demos/tuto-10-flags.bps',
    'test/transpiler_fixtures/mut_slot.bps',
  ];
  for (const f of vivantes) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    const r = compileToBPxAST(src);
    ok((r.errors || []).length === 0, `G. '${f}' doit compiler — elle crée son drapeau à l'usage`);
  }
}

// ⛔ Un garde qui a examiné zéro cas se refuse : le compte vient de la matrice, il ne s'écrit pas ici.
const ATTENDU = COMPARE.length + MUTE.length + COMPARE.length * 3 + MUTE.length * 3 + 3 + 3 + COMPARE.length + 1 + 2 + 3;
ok(p + e.length === ATTENDU, `le garde doit couvrir la matrice ENTIÈRE — ${p + e.length} cas éprouvés au lieu de ${ATTENDU}`);

if (e.length) { console.error(`[drapeaux] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[drapeaux] ${p} PASS / 0 FAIL — ${p} assertion(s)`);
