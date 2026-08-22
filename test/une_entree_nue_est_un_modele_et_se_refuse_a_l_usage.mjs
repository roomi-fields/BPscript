#!/usr/bin/env node
/**
 * UNE ENTRÉE NUE EST UN MODÈLE — elle se déclare, elle ne s'emploie pas.
 *
 * ALIGNEMENT DU 2026-08-22, sur les canons du prototypal pur que Romain a demandé d'appliquer.
 *
 * ⛔ LA TABLE DE LA BIBLE NE SE TROMPAIT PAS, C'ÉTAIT LE CODE QUI ÉTAIT EN RETARD. J'avais rendu
 * « `in` est classé type par la bible, autre chose dans le code — la table est à corriger ». Elle
 * tranche dans l'autre sens : `in.midi pedale` EST le type en tête avec dérivation pointée — `in`
 * le type, `midi` la sorte, `pedale` le nom —, la même forme que `actor midi.actor(ch)` et que
 * `gamut ionian(…)`. Ce qui était en retard, c'était le REFUS de la forme nue.
 *
 * ⛔ LES DEUX MOITIÉS, ET AUCUNE NE VAUT SANS L'AUTRE :
 *   · `in zz` COMPILE — un nom nu vaut un objet vide, comme `flag zz` et `actor basse` ;
 *   · `<!zz` sur ce rôle est REFUSÉ — l'incomplétude se refuse à l'USAGE.
 * Frapper la première seule ouvrirait un trou : un rôle sans canal attend un signal que rien
 * n'apporte, et la dérivation s'arrête pour toujours sans un mot. Frapper la seconde seule
 * interdirait le modèle, donc toute dérivation.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const compiler = (src) => {
  try {
    const r = compileToBPxAST(`core\n${src}`, {});
    const errs = (r.errors || []).map((x) => x.message || String(x));
    return { ok: !!r.ast && !errs.length, err: errs[0] || '', ast: r.ast };
  } catch (x) { return { ok: false, err: x.message, ast: null }; }
};

// ── SOCLE ───────────────────────────────────────────────────────────────────────────────────
ok(compiler('-----\nS -> C4\n').ok, 'SOCLE : la scène nue doit compiler');

// ── A. LA FORME NUE EST UN MODÈLE — elle compile, et elle entre dans l'arbre ────────────────
{
  const r = compiler('in zz\n-----\nS -> C4\n');
  ok(r.ok, `A. 'in zz' doit COMPILER — un nom nu vaut un objet vide. Reçu : ${r.err}`);
  const i = (r.ast?.inputs || [])[0];
  ok(i?.type === 'InDirective' && i?.name === 'zz',
     `A. et elle entre dans l'arbre comme les autres entrées — vue : ${JSON.stringify(i)}`);
  ok(i?.transport === null,
     `A. ⛔ SON CANAL EST null, PAS ABSENT : « elle n'en a pas » et « le champ n'existe pas » `
     + `doivent rester distinguables par l'aval, qui décide sur ce champ. Vu : `
     + `${JSON.stringify(i?.transport)}`);
}

// ── B. LA FORME COMPLÈTE NE BOUGE PAS — le témoin qui distingue AJOUTER de REMPLACER ────────
for (const [quoi, src] of [
  ['avec son canal',           'in.midi zz\n-----\nS -> C4\n'],
  // ⚠️ PAS DE VOLET « AVEC SA TABLE » : `lib/mapping.json` ne porte AUCUNE table aujourd hui —
  // mesuré, elle n'a que sa clé d'invocation et sa prose. Un volet qui en inventerait une
  // rougirait pour une donnée absente, pas pour la forme qu'il prétend garder.
  ['employée par le flux',     'in.midi zz\n-----\nS -> C4 <!zz\n'],
]) {
  const r = compiler(src);
  ok(r.ok, `B. la forme complète ${quoi} doit rester vivante. Reçu : ${r.err}`);
}

// ── C. ⛔ L'INCOMPLÉTUDE SE REFUSE À L'USAGE — l'autre moitié du geste ──────────────────────
{
  const jamais = compiler('in zz\n-----\nS -> C4\n');
  ok(jamais.ok, "C. déclarée et JAMAIS employée, elle passe — rien ne se refuse à la déclaration");
  const employe = compiler('in zz\n-----\nS -> C4 <!zz\n');
  ok(!employe.ok, "C. EMPLOYÉE par un point d'attente, elle est REFUSÉE");
  ok(/DÉCLARÉE SANS CANAL/.test(employe.err),
     `C. et le refus dit que le canal manque, pas que le nom est inconnu — deux causes opposées `
     + `mèneraient l'auteur à deux réparations. Reçu : ${employe.err.slice(0, 90)}`);
}

// ── D. LE TÉMOIN QUI DISCRIMINE — un nom JAMAIS déclaré garde son propre refus ──────────────
// Sans lui, « le refus existe » se confondrait avec « tout point d'attente refuse ».
{
  const inconnu = compiler('-----\nS -> C4 <!zz\n');
  ok(!inconnu.ok, 'D. un rôle JAMAIS déclaré reste refusé');
  ok(/rien ne déclare/.test(inconnu.err),
     `D. et son refus est l'AUTRE — celui du nom inconnu, pas celui du canal manquant. Reçu : `
     + `${inconnu.err.slice(0, 80)}`);
}

// ── E. LE CANAL RESTE UNE LISTE FERMÉE ─────────────────────────────────────────────────────
// La forme nue s'ouvre ; elle n'ouvre pas la porte à un canal inventé.
{
  const r = compiler('in.zorglub zz\n-----\nS -> C4\n');
  ok(!r.ok && /n'est pas une entrée/.test(r.err),
     `E. un canal hors de la liste fermée reste refusé — la forme nue ne desserre pas la liste. `
     + `Reçu : ${r.err.slice(0, 80)}`);
}

const ATTENDU = 1 + 3 + 2 + 3 + 2 + 1;
ok(p + e.length === ATTENDU, `bilan : ${ATTENDU} attendues, ${p + e.length} exécutées`);

if (e.length) {
  console.error(`❌ une entrée nue est un modèle : ${e.length} échec(s)`);
  for (const x of e) console.error(`  ✗ ${x}`);
  process.exit(1);
}
console.log(`✅ une entrée nue est un modèle — elle compile et porte un canal null, son emploi est `
  + `REFUSÉ en nommant le canal manquant, le nom inconnu garde son propre refus, et la liste des `
  + `canaux reste fermée. ${p} vérification(s) passée(s).`);
