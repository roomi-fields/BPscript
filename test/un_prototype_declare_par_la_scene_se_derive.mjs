import { compileToBPxAST } from '/home/romi/dev/bp/BPscript/src/transpiler/index.js';
let p = 0; const e = [];
const ok = (c, q) => { if (c) p++; else e.push(q); };
const T = 'core\nalphabet.western\n';
const cp = (l) => { try { return compileToBPxAST(`${T}${l}\n-----\nS -> C4\n`); } catch (x) { return { errors: [{ message: String(x.message) }] }; } };
// ⛔ UNE RACINE PORTE `type: null` — `def gamme (…)` ne dérive de rien, et `null` le dit (AST.md,
// `VarType`, 2026-09-02). Le `??` d'avant retombait sur `kind` et rendait `'type'` pour une racine :
// un fait juste dans l'arbre, mal lu par la sonde.
const vars = (r) => (r.ast?.vars || []).map((v) => ({ n: v.names,
  t: v.varType?.kind === 'type' ? v.varType.type : (v.varType?.kind ?? null) }));
console.log("[prototype] un nom declare par la scene ouvre une declaration, comme un type du socle");
// A. LA DERIVATION PAR LE TYPE EN TETE
{
  const r = cp('def gamme (culture, ratios)\ngamme ionian (ratios(1, 2), notes_count:7)');
  ok((r.errors || []).length === 0, `A. le prototype et son exemplaire doivent compiler — ${r.errors?.[0]?.message}`);
  ok(JSON.stringify(vars(r)) === JSON.stringify([{ n: ['gamme'], t: null }, { n: ['ionian'], t: 'gamme' }]),
    `A. et l exemplaire doit porter SON PROTOTYPE comme type — reçu ${JSON.stringify(vars(r))}. Le type en tete PORTE la derivation ; \`extends\` a ete efface pour ca.`);
  const d = cp('def gamme (x)\ngamme ionian (x:1)\ngamme dorian (x:2)');
  ok(vars(d).length === 3 && vars(d)[1].t === 'gamme' && vars(d)[2].t === 'gamme',
    `A. plusieurs exemplaires derivent du meme prototype — reçu ${JSON.stringify(vars(d))}`);
}
// B. L ORDRE DU LANGAGE — un prototype se declare AVANT d etre derive
{
  const r = cp('gamme ionian (x:1)\ndef gamme (x)');
  ok((r.errors || []).length > 0, "B. un exemplaire ecrit AVANT son prototype doit etre refuse — le registre se remplit a la lecture, comme celui des acteurs");
}
// C. TEMOINS — le mecanisme ne s ouvre pas a n importe quoi
{
  ok((cp('zorglub ionian (x:1)').errors || []).length > 0, "C. TEMOIN — un mot qui ne designe rien reste refuse");
  const s = cp('control ionian (x:1)');
  ok((s.errors || []).length === 0 && vars(s)[0].t === 'control', "C. TEMOIN — un type du SOCLE marchait deja et marche toujours");
  const nu = cp('def gamme (x)\ngamme ionian');
  ok((nu.errors || []).length === 0 && vars(nu)[1]?.t === 'gamme',
    `C. un exemplaire NU derive aussi — la parenthese absente vaut parenthese vide, et le type voyage. Reçu ${JSON.stringify(vars(nu))}`);
}
ok(p >= 6, `le garde doit avoir EXAMINE (${p} assertions)`);
if (e.length) { console.error(`[prototype] ${e.length} ECHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[prototype] ${p} PASS / 0 FAIL — ${p} assertion(s)`);
