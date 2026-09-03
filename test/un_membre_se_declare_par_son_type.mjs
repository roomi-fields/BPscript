#!/usr/bin/env node
/**
 * GARDE — UN MEMBRE SE DÉCLARE PAR SON TYPE, LE TYPE EN TÊTE, ET IL SE PUBLIE COMME UN EXEMPLAIRE
 * VIDE QUI DÉRIVE DE SON TYPE.
 *
 * Arbitrage de Romain, 2026-09-03 (« ok parfait ») : « il ne doit y avoir aucune ambiguïté possible,
 * le langage doit être explicite ». Un mot nu entre parenthèses est une VALEUR (`scope(scene)`
 * contient `scene`) ; la nature d'un membre s'écrit comme toute déclaration, LE TYPE EN TÊTE :
 *     def alphabet (scope(scene), octaves:western, sound terminals())
 *     def actor (alphabet alphabet, tuning tuning, …)
 * `sound terminals()` : une collection de sons, vide donc obligatoire ; `alphabet alphabet` : un
 * membre de type alphabet, sans valeur. Les terminaux des alphabets sont des sons.
 *
 * LA MATRICE :
 *   1. le parseur lit `T nom` (membre typé) et `T nom()` / `T nom(x, y)` (collection typée) dans un
 *      sac DÉCLARATIF, et rend la paire avec son `type` ;
 *   2. `scope(scene)` reste une valeur — un mot nu dans une parenthèse n'est pas un type ;
 *   3. dans le FLUX, deux mots séparés par une espace gardent leur lecture (parties d'une valeur) ;
 *   4. la publication : au registre, `types.alphabet.terminals` vaut `{_derive:'sound'}`, et le
 *      lecteur des terminaux ne compte pas `_derive` — un alphabet sans terminaux propres en a zéro ;
 *   5. la porte : l'objet `alphabet.western` garde SES terminaux (les siens gagnent), et le
 *      prototype `types.alphabet` porte l'exemplaire typé ;
 *   6. une librairie fabriquée avec `sound terminals(dha, ta)` publie `{dha:{}, ta:{}, _derive:'sound'}`.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { leRegistre, nomsDeTerminaux, registerLib } from '../src/transpiler/libs.js';
import { objet } from '../src/transpiler/index-des-objets.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const TETE = 'core\nalphabet.simple\n';
const paires = (decl) => {
  const r = compileToBPxAST(`${TETE}${decl}\n-----\nS -> a\n`, {});
  if (!r.ast) return { erreurs: (r.errors || []).map((e) => e.message) };
  const v = (r.ast.vars || [])[0];
  return { erreurs: (r.errors || []).map((e) => e.message), paires: v && v.settings ? v.settings.pairs : [] };
};

// ── 1. le parseur lit le type en tête ──────────────────────────────────────────────────────────
{
  const r = paires('def truc (alphabet alphabet, tuning tuning)');
  ok(r.erreurs.length === 0, `1. 'alphabet alphabet, tuning tuning' compile — reçu ${JSON.stringify(r.erreurs)}`);
  ok(r.paires && r.paires.length === 2 && r.paires[0].key === 'alphabet' && r.paires[0].type === 'alphabet' && r.paires[1].key === 'tuning' && r.paires[1].type === 'tuning',
     `1. deux membres typés — reçu ${JSON.stringify(r.paires)}`);
  const c = paires('def truc (scope(scene), sound terminals())');
  ok(c.erreurs.length === 0 && c.paires && c.paires[1] && c.paires[1].key === 'terminals' && c.paires[1].type === 'sound' && c.paires[1].value && c.paires[1].value.type === 'SettingBag' && c.paires[1].value.pairs.length === 0,
     `1. 'sound terminals()' : une collection typée vide — reçu ${JSON.stringify(c.paires)} ${JSON.stringify(c.erreurs)}`);
  const p = paires('def truc (sound terminals(dha, ta))');
  ok(p.erreurs.length === 0 && p.paires && p.paires[0].type === 'sound' && p.paires[0].value.pairs.length === 2,
     `1. 'sound terminals(dha, ta)' : une collection typée avec ses éléments — reçu ${JSON.stringify(p.paires)} ${JSON.stringify(p.erreurs)}`);
}

// ── 2. un mot nu reste une valeur ─────────────────────────────────────────────────────────────
{
  const r = paires('def truc (scope(scene, rule), octaves:western)');
  ok(r.erreurs.length === 0 && r.paires[0].key === 'scope' && !('type' in r.paires[0]) && r.paires[0].value.pairs.map((x) => x.key).join(',') === 'scene,rule',
     `2. 'scope(scene, rule)' reste une valeur, sans type — reçu ${JSON.stringify(r.paires)}`);
}

// ── 2bis. les trois bornes : une virgule oubliée ne devient jamais un membre typé en silence ───
{
  const pasUnType = paires('def truc (zzpasuntype nom)');
  ok(pasUnType.erreurs.some((m) => /virgule/.test(m)),
     `2bis. 'zzpasuntype nom' — le premier mot n'est pas un type en portée : refusé en nommant la virgule — reçu ${JSON.stringify(pasUnType.erreurs)}`);
  const imbrique = paires('def truc (scope(symbol group))');
  ok(imbrique.erreurs.some((m) => /virgule/.test(m)),
     `2bis. 'scope(symbol group)' — dans un sac IMBRIQUÉ, même un type en tête ne déclare rien : refusé en nommant la virgule — reçu ${JSON.stringify(imbrique.erreurs)}`);
}

// ── 3. le flux ne change pas ───────────────────────────────────────────────────────────────────
{
  const r = compileToBPxAST(`${TETE}-----\nS -> a (keyxpand:b -1)\n`, {});
  ok(!(r.errors || []).some((e) => /type/.test(e.message)), `3. dans le flux, deux parties d'une valeur ne sont pas un membre typé — reçu ${JSON.stringify((r.errors || []).map((e) => e.message))}`);
}

// ── 4. la publication et le lecteur des terminaux ─────────────────────────────────────────────
{
  const proto = leRegistre().types && leRegistre().types.alphabet;
  ok(proto && proto.terminals && proto.terminals._derive === 'sound' && Object.keys(proto.terminals).length === 1,
     `4. types.alphabet.terminals vaut {_derive:'sound'} — reçu ${JSON.stringify(proto && proto.terminals)}`);
  ok(Array.isArray(nomsDeTerminaux(proto)) && nomsDeTerminaux(proto).length === 0,
     `4. le lecteur des terminaux ne compte pas _derive — reçu ${JSON.stringify(nomsDeTerminaux(proto))}`);
  // Mesuré : les 24 alphabets du registre ont leurs propres terminaux (`structural` compris). Le cas
  // « sans terminaux propres » se FABRIQUE : un alphabet vide hérite l'exemplaire typé du prototype,
  // et le lecteur des terminaux lui en trouve zéro — jamais un terminal nommé « sound ».
  const registre = leRegistre();
  registerLib('zzalph', { resolves: 'alphabet', resolvedBy: 'témoin', zzvide: { description: 'alphabet témoin sans terminaux', _derive: 'alphabet' } });
  try {
    const vide = objet('alphabet.zzvide');
    ok(vide && vide.membres && vide.membres.terminals && vide.membres.terminals._derive === 'sound' && nomsDeTerminaux(vide.membres).length === 0,
       `4. un alphabet sans terminaux propres hérite l'exemplaire typé et n'a AUCUN terminal — reçu ${JSON.stringify(vide && vide.membres && vide.membres.terminals)}`);
  } finally {
    delete registre.zzalph;
    registerLib('zzalph', undefined);
    delete registre.zzalph;
  }
}

// ── 5. la porte : les siens gagnent, le prototype porte l'exemplaire ──────────────────────────
{
  const western = objet('alphabet.western');
  ok(western && western.membres && nomsDeTerminaux(western.membres).join(',') === 'C,D,E,F,G,A,B',
     `5. 'alphabet.western' garde ses sept terminaux — reçu ${JSON.stringify(western && nomsDeTerminaux(western.membres))}`);
  const proto = objet('types.alphabet');
  ok(proto && proto.membres && proto.membres.terminals && proto.membres.terminals._derive === 'sound',
     `5. le prototype 'types.alphabet' porte l'exemplaire typé — reçu ${JSON.stringify(proto && proto.membres)}`);
}

ok(passe >= 10, `SOCLE : ${passe} vérifications — la matrice s'est vidée`);
if (echecs.length) {
  console.error(`[membre typé] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[membre typé] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
