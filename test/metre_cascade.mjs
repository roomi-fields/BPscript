#!/usr/bin/env node
/**
 * GARDE — le mètre de SCÈNE pose le défaut, la RÈGLE le recouvre pour elle seule.
 *
 * POURQUOI ELLE VÉRIFIE JUSQU'AU CONSOMMATEUR. `@meter:4/4` compilait déjà et n'était consommé
 * par RIEN : le mètre se lit dans les QUALIFICATIFS DE LA RÈGLE (BPx `loadGrammar.ts:4136-4143`,
 * `parseMeterSignature`), jamais dans les directives de scène. Une directive acceptée qui
 * n'atteint aucune règle donne l'illusion d'un câblage — c'est exactement ce qu'on a payé
 * aujourd'hui avec la forme d'appel : accepter n'est pas transmettre.
 *
 * La cascade n'est pas propre au mètre : `lib/controls.json` se déclare « layered by scope », et
 * la décision `2026-06-26-kai9-adresse-dans-arbre.md:17-19` pose l'override par portée pour tout
 * le langage. Ce garde vérifie que le mètre s'y conforme comme le reste.
 *
 * LA GRAPHIE ADDITIVE `3+4+2/4` est celle de BP3, reprise telle quelle (décision Romain
 * 2026-07-26, contre la recommandation d'Atlas). Le `+` y a un SECOND rôle — séparateur de
 * sections — et c'est un écart assumé, daté, motivé : ce garde le PROTÈGE au lieu de le corriger.
 *
 * ⚠️ `meter` s'écrit en PARENTHÈSES depuis la décision Romain 2026-08-02 (LANGUAGE.md:773-800) —
 * un signe, une nature : c'est un RÉGLAGE (ce que la règle PRODUIT), pas ce qui gouverne sa
 * dérivation. `[meter:…]` (crochets) est désormais REFUSÉ ; la cascade de scène (`emitSceneMeter`,
 * bpxAst.js) injecte donc le défaut dans `rule.settings.pairs` (SettingBag, renommé depuis
 * `runtimeQualifier` le 2026-08-06).
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compile = (src) => compileToBPxAST(src);
const metresDe = (ast, i) => (ast?.subgrammars?.[0]?.rules?.[i]?.settings?.pairs || [])
  .filter((p) => p && p.key === 'meter')
  .map((p) => p.value);

// ─── 1. La graphie additive de BP3 est acceptée, telle quelle ────────────────────────────────
for (const forme of ['4/4', '3+4+2/4', '5+7/8', '3+4/4', '4+4+4+4/6']) {
  const r = compile(`@core\n@meter:${forme}\n@alphabet.western:midi\n@mode:ord\nS -> C4\n`);
  ok((r.errors || []).length === 0, `1. '@meter:${forme}' doit être accepté — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
  ok(metresDe(r.ast, 0)[0] === forme,
     `1. '@meter:${forme}' doit ARRIVER À LA RÈGLE intact — reçu : ${JSON.stringify(metresDe(r.ast, 0))}`);
}

// ─── 2. La cascade : défaut de scène, recouvrement par la règle ──────────────────────────────
{
  const r = compile('@core\n@meter:3+4+2/4\n@alphabet.western:midi\n@mode:ord\nS -> C4 D4\nA -> C4 (meter:7/8)\nB -> D4\n');
  ok(metresDe(r.ast, 0)[0] === '3+4+2/4', '2. une règle sans mètre reçoit le défaut de la scène');
  ok(metresDe(r.ast, 1).length === 1 && metresDe(r.ast, 1)[0] === '7/8',
     `2. une règle QUI PORTE le sien le garde, et n'en reçoit pas un second — reçu : ${JSON.stringify(metresDe(r.ast, 1))}`);
  ok(metresDe(r.ast, 2)[0] === '3+4+2/4', '2. le recouvrement vaut POUR LA SEULE règle qui recouvre — les autres gardent le défaut');
}

// ─── 3. Sans directive de scène, rien n'est inventé ──────────────────────────────────────────
{
  const r = compile('@core\n@alphabet.western:midi\n@mode:ord\nS -> C4 D4\n');
  ok(metresDe(r.ast, 0).length === 0, '3. sans @meter, aucune règle ne doit porter de mètre fabriqué');
}

if (echecs.length) {
  console.error(`❌ cascade du mètre : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ cascade du mètre — ${passe} vérification(s) passée(s)`);
}
