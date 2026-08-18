#!/usr/bin/env node
/**
 * GARDE — un RÉGLAGE RÉSERVÉ (lib/core.json schema.qualifierKeys : mode/scan/weight/on_fail/
 * weight/meter) est un mot du LANGAGE, pas un contrôle optionnel de librairie. Il doit être
 * reconnu que `@controls` soit chargé ou non — même principe déjà appliqué au suffixe de règle
 * (`isRuntimeQualifierLoose`, contrat AST §runtime qualifier).
 *
 * DEUX DÉFAUTS MESURÉS (BPx, 2026-08-05), tous deux reproduits UNIQUEMENT quand `@controls`
 * n'est pas chargé — les deux passages qui LISENT `(clé:valeur)` sans passer par
 * `parseRuntimeQualifier` :
 *
 * 1. Le marqueur AUTONOME `!(mode:…)` / `!(weight:…)` / `!(meter:…)` dans le flux (position
 *    `S -> C4 !(mode:random) D4`) était refusé quelle que soit la valeur, avec un message qui
 *    se contredit : « Expected symbol, (...) or [...] after ! » — il nomme '(...)' comme une
 *    forme ATTENDUE puis la refuse. Cause : `isRuntimeQualifier()` (parser.js) ne reconnaît que
 *    les contrôles de `controlNames`, peuplé par `@controls` — les réglages réservés n'y sont
 *    jamais entrés puisqu'ils ne sont PAS des contrôles de librairie facultatifs.
 *
 * 2. `C4(rndtime:50)` COLLÉ à un terminal, sans `@controls` chargé, tombe dans le lecteur
 *    générique de `parseSymbolCall` (appel de symbole, pas qualifieur runtime reconnu) : celui-ci
 *    lit un entier seul mais n'avale pas le `/5` d'une fraction — la valeur RAPPORT échoue avec
 *    « Expected argument value » là où la même position accepte un entier nu.
 */
import assert from 'node:assert/strict';
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compile = (rhs) => compileToBPxAST(`core\nalphabet.western:midi\n\n-----\nS -> ${rhs}\n`);

// ─── 1. Marqueur autonome !(…) dans le flux, SANS controls ──────────────────────────────────
// ⚠️ `mode:random` A ÉTÉ RETIRÉ DE CETTE LISTE le 2026-08-08 — il n'est plus une clé de sac
// (décision Romain : « on ne change pas de mode en cours de tirage »). Le cobaye historique de
// ce garde devient donc un cas REFUSÉ ; il est remplacé par `rotate`, qui est mesuré en
// position flux dans le corpus et couvre la même propriété. Le garde ne perd rien : il vérifie
// qu'un réglage RÉSERVÉ se lit dans le flux, pas que le mode en soit un.
// ⚠️ LISTE RESSERRÉE le 2026-08-08 : ce garde mesure qu'un réglage RÉSERVÉ se lit DANS LE FLUX.
// Depuis que la portée est validée, quatre de ses cobayes n'ont pas le droit d'y être — le poids,
// le scan, la stratégie d'échec et le mètre gouvernent une règle, pas un instant. Les y écrire
// n'est plus un cas de lecture mais une faute de langage. Restent ceux qui valent dans le flux,
// et ils suffisent : la propriété mesurée est la LECTURE du sac, pas le nom de la clé.
for (const forme of ['rotate:2', 'legato:20', 'staccato:96', 'rndtime:50']) {
  const { ast, errors } = compile(`C4 !(${forme}) D4`);
  ok(errors.length === 0, `1. '!(${forme})' dans le flux (sans @controls) doit compiler — reçu : ${errors.map((e) => e.message).join(' | ')}`);
  if (errors.length === 0) {
    const noeud = ast.subgrammars[0].rules[0].rhs.find((e) => e.type === 'InstantControl');
    ok(noeud?.qualifier?.type === 'SettingBag', `1. '!(${forme})' doit produire un InstantControl { qualifier: SettingBag }`);
  }
}

// Témoin négatif : une clé qui n'est NI un réglage réservé NI un contrôle connu reste refusée
// (le garde ne doit pas s'être mis à tout accepter après '!').
{
  const { errors } = compile(`C4 !(zzz_pas_un_reglage:1) D4`);
  ok(errors.length > 0, `1. (témoin) '!(zzz_pas_un_reglage:1)' doit rester refusé — une clé inconnue n'est ni un réglage réservé ni un contrôle`);
}

// ─── 2. (meter:N/D) collé à un terminal, SANS controls ──────────────────────────────────────
{
  const { ast, errors } = compile(`C4(rndtime:50) D4`);
  ok(errors.length === 0, `2. 'C4(rndtime:50)' collé (sans @controls) doit compiler — reçu : ${errors.map((e) => e.message).join(' | ')}`);
  if (errors.length === 0) {
    const c4 = ast.subgrammars[0].rules[0].rhs[0];
    const valeur = c4.suffixQualifiers?.[0]?.pairs?.[0]?.value ?? c4.args?.[0]?.value?.value;
    ok(valeur === 50, `2. la valeur portée doit être 50 — reçu ${JSON.stringify(valeur)}`);
  }
}
{
  // Non-régression : l'entier collé continue de marcher (c'est lui qui marchait déjà).
  // ⚠️ COBAYE CHANGÉ le 2026-08-08 : ce cas mesure qu'un réglage réservé COLLÉ à une note est lu
  // sans invoquer la librairie. Il employait le POIDS, qui n'a désormais plus le droit d'être là
  // (il gouverne une règle). `staccato` porte la même propriété et vaut sur un élément.
  const { errors } = compile(`C4(staccato:96) D4`);
  ok(errors.length === 0, `2. (non-régression) 'C4(staccato:96)' collé (sans @controls) doit rester accepté — ${errors.map((e) => e.message).join(' | ')}`);
}

if (echecs.length) {
  console.error(`❌ marqueur réglage réservé : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ réglage réservé reconnu sans @controls, flux ET collé — ${passe} vérification(s) passée(s)`);
}
