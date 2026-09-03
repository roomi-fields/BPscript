#!/usr/bin/env node
/**
 * `required` ET `many` SONT SORTIS — ET UN MOT SORTI NE PASSE PAS POUR UNE VALEUR ORDINAIRE.
 *
 * DÉCISION DE ROMAIN, 2026-08-20 : « ni l'un ni l'autre ne s'écrit : les deux se lisent de la
 * forme ». L'obligation se lit de l'ABSENCE de défaut, la multiplicité de l'EXEMPLAIRE.
 *
 *     scope              obligatoire — rien n'est donné, donc rien n'a de défaut
 *     scope()            obligatoire ET collection
 *     scope:flow         optionnel, une valeur — le défaut est `flow`
 *     scope(flow, rule)  optionnel, collection
 *
 * ⛔ LE DÉFAUT QUE CE BANC FERME EST MUET, ET C'EST CE QUI LE REND CHER. Les deux mots PASSAIENT —
 * non comme des mots du langage, mais comme une CHAÎNE QUELCONQUE : `scope:required` produisait un
 * membre dont la valeur est le texte « required ». L'auteur écrivait une forme qu'il croyait
 * vivante, et rien ne le détrompait. Un mot retiré qui reste lisible comme une valeur ordinaire est
 * le pire des retraits : il n'a pas de pierre tombale.
 *
 * ⛔ ET LE REFUS EST BORNÉ À LA VALEUR D'UN MEMBRE DÉCLARATIF, jamais au mot partout. Refuser
 * « many » comme chaîne interdirait un mot anglais dans une prose — et la donnée en porte déjà un
 * cas, dans la note sur les makams turcs. Le volet C tient cette borne.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const compiler = (src) => {
  try {
    const r = compileToBPxAST(`core\n${src}`, {});
    const errs = (r.errors || []).map((x) => x.message || String(x));
    return { ok: !!r.ast && !errs.length, err: errs[0] || '' };
  } catch (x) { return { ok: false, err: x.message }; }
};

ok(compiler('-----\nS -> C4\n').ok, 'SOCLE : la scène nue doit compiler');

// ── A. LES DEUX MOTS SONT REFUSÉS, ET LE REFUS PORTE SES DEUX RÉÉCRITURES ───────────────────
for (const mot of ['required', 'many']) {
  const r = compiler(`control zz(args:value, scope:${mot})\n-----\nS -> C4\n`);
  ok(!r.ok, `A. 'scope:${mot}' doit être REFUSÉ — le mot est sorti du langage le 2026-08-20`);
  ok(/has LEFT the language/.test(r.err),
     `A. et le refus doit le DIRE, avec sa décision — sans quoi l'auteur cherche une faute de `
     + `syntaxe dans une forme correcte. Reçu : ${r.err.slice(0, 80)}`);
  ok(/scope\(\)/.test(r.err) && /'scope' alone/.test(r.err),
     `A. ⛔ ET IL DOIT PORTER LES DEUX RÉÉCRITURES — le nu pour l'obligation, la parenthèse vide `
     + `pour la collection obligatoire. Un refus qui n'en donne qu'une envoie la moitié des auteurs `
     + `écrire l'autre faute. Reçu : ${r.err.slice(0, 140)}`);
}

// ── B. LES QUATRE FORMES VIVANTES PASSENT — le témoin qui distingue REFUSER de TOUT REFUSER ──
for (const [quoi, forme] of [
  ['obligatoire, une valeur',    'scope'],
  ['obligatoire, collection',    'scope()'],
  ['optionnel, une valeur',      'scope:symbol'],
  ['optionnel, collection',      'scope(symbol, group)'],
]) {
  const r = compiler(`control zz(args:value, ${forme})\n-----\nS -> C4\n`);
  ok(r.ok, `B. ${quoi} — '${forme}' doit COMPILER. Reçu : ${r.err.slice(0, 70)}`);
}

// ── C. ⛔ LA BORNE — le refus ne vaut QUE pour la valeur d'un membre déclaratif ──────────────
// Sans elle, ce garde interdirait l'anglais courant. La donnée porte déjà « many more note names »
// dans une note sur les makams turcs, et un backtick peut contenir n'importe quel texte.
{
  const dansUnCode = compiler('def zz `js: many things are required here`\n-----\nS -> C4\n');
  ok(dansUnCode.ok,
     `C. les deux mots dans un CODE EXTERNE passent — le refus porte sur une valeur de membre, pas `
     + `sur le texte. Reçu : ${dansUnCode.err.slice(0, 70)}`);
  // ⛔ ET LE VOLET DU FLUX N ATTEIGNAIT PAS LA BORNE — mesuré en l'injectant. Une paire du flux avec
  // une valeur ordinaire ne passe pas par le point où la borne vit, donc retirer `enDeclaratif` ne
  // faisait rougir personne. Le cas qui l'atteint est une paire du FLUX dont la valeur EST le mot
  // sorti : `(vel:required)` — elle doit passer, parce que le refus est déclaratif et que `vel`
  // n'a pas de liste fermée qui l'en empêche par ailleurs.
  const dansLeFlux = compiler('alphabet.western:audio\n-----\nS -> C4 (vel:required)\n');
  ok(dansLeFlux.ok,
     `C. ⛔ LE MOT SORTI COMME VALEUR DANS LE FLUX passe — le refus s'arrête au déclaratif, et `
     + `c'est ce cas-là qui le prouve. Reçu : ${dansLeFlux.err.slice(0, 70)}`);
}

// ── D. LE TÉMOIN NON NUL — une valeur ordinaire garde son propre refus ──────────────────────
// Sans lui, « le mot sorti est refusé » se confondrait avec « toute valeur inconnue est refusée ».
{
  const r = compiler('control zz(args:value, scope:zorglub)\n-----\nS -> C4\n');
  ok(!/has LEFT the language/.test(r.err),
     `D. une valeur inconnue qui n'est PAS un mot sorti ne reçoit pas ce refus-là — sinon le `
     + `message accuserait une décision qui ne la concerne pas. Reçu : ${r.err.slice(0, 70) || 'compile'}`);
}

const ATTENDU = 1 + 6 + 4 + 2 + 1;
ok(p + e.length === ATTENDU, `bilan : ${ATTENDU} attendues, ${p + e.length} exécutées`);

if (e.length) {
  console.error(`❌ un mot sorti ne passe pas pour une valeur : ${e.length} échec(s)`);
  for (const x of e) console.error(`  ✗ ${x}`);
  process.exit(1);
}
console.log(`✅ un mot sorti du langage ne passe pas pour une valeur — les deux sont refusés avec `
  + `LEURS DEUX réécritures, les quatre formes vivantes passent, et le refus s'arrête à la valeur `
  + `d'un membre déclaratif. ${p} vérification(s) passée(s).`);
