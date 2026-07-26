#!/usr/bin/env node
/**
 * GARDE — une extrémité PORTÉE de `@map` doit nommer un référent DÉCLARÉ.
 *
 * SIGNALÉE par bp3-frontend le 2026-07-26 : `@map foobar.X -> sync1` compilait. Il a refusé de
 * s'appuyer dessus pour traduire, alors qu'il aurait pu — ça passait.
 *
 * ⚠️ LE DIAGNOSTIC D'ORIGINE ÉTAIT INEXACT, et c'est instructif : on avait conclu que la directive
 * « n'arrive pas dans l'arbre » parce qu'elle est absente de `ast.directives`. Elle arrive — dans
 * `ast.maps`, son canal propre. Ce n'était donc pas un silence de transport mais une ABSENCE DE
 * VALIDATION. Chercher une chose au mauvais endroit et conclure à son absence est le même piège
 * que le filtre d'adresses qui n'acceptait que les alphabets : on ne voit pas ce qu'on ne regarde
 * pas. La garde vérifie donc `ast.maps`, là où la donnée vit.
 *
 * CE QUI EST DÉCLARABLE (docs/design/SCENES.md §6.1-6.2) — aucune forme créée ici, on vérifie
 * celles qui existent : une SCÈNE déclarée, un LABEL posé sur un élément, ou `*`.
 *
 * ⚠️ `@map note.C#2` TOMBE, et c'est VOULU : la façon dont une note entrante se déclare comme
 * source n'existe pas encore dans le langage — la question est chez Romain. Fermer le silence
 * n'est pas remplir le vide. Le jour où la forme sera créée, ce garde devra l'accueillir ; d'ici
 * là, l'accepter fabriquerait une correspondance morte.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const compile = (corps) => {
  try { return compileToBPxAST(`@core\n@controls\n@alphabet.western:midi\n${corps}\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};

// ─── 1. Ce qui désigne quelque chose passe ───────────────────────────────────────────────────
for (const [corps, quoi] of [
  ['@map cc:1 -> kick.vel\n@mode:ord\nS -> C4@kick D4', 'un LABEL posé sur un élément'],
  ['@map cc:7 -> sys.tempo\n@mode:ord\nS -> C4', 'une commande système'],
  ['@map cc:1 -> [intensity]\n@mode:ord\nS -> C4', 'un flag'],
  ['@map osc:/x -> alias1\n@mode:ord\nS -> C4', 'un alias'],
  ['@map [flag] -> cc:2\n@mode:ord\nS -> C4', 'un flag vers un contrôleur'],
  ['@map cc:1 <-> [intensity]\n@mode:ord\nS -> C4', 'une correspondance bidirectionnelle'],
]) {
  const r = compile(corps);
  ok((r.errors || []).length === 0,
     `1. ${quoi} doit passer — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
}

// ─── 2. La directive ARRIVE — dans son canal, pas dans les directives ────────────────────────
{
  const r = compile('@map cc:1 -> kick.vel\n@mode:ord\nS -> C4@kick D4');
  ok((r.ast?.maps || []).length === 1, "2. la correspondance doit ARRIVER dans ast.maps — c'est son canal");
  const m = (r.ast?.maps || [])[0];
  ok(m?.source?.kind === 'cc' && m?.target?.kind === 'scoped',
     `2. ses deux extrémités doivent être portées telles qu'écrites — reçu : ${JSON.stringify(m)}`);
}

// ─── 3. Ce qui ne désigne rien CRIE, et le message nomme le mot fautif ───────────────────────
for (const [corps, quoi, mot] of [
  ['@map foobar.X -> sync1\n@mode:ord\nS -> C4', 'une portée inventée', 'foobar'],
  ['@map cc:1 -> kick.vel\n@mode:ord\nS -> C4 D4', 'un label JAMAIS POSÉ sur un élément', 'kick'],
  ['@map note.C#2 -> sync1\n@mode:ord\nS -> C4', "la note entrante, forme qui n'existe pas encore", 'note'],
]) {
  const r = compile(corps);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, `3. ${quoi} doit CRIER — '${corps.split('\n')[0]}'`);
  ok(msg.includes(mot), `3. le message doit NOMMER le mot fautif '${mot}' — reçu : ${msg.slice(0, 110)}`);
}

if (echecs.length) {
  console.error(`❌ correspondance @map : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ correspondance @map — ${passe} vérification(s) passée(s)`);
}
