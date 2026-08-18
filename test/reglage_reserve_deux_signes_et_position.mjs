#!/usr/bin/env node
/**
 * GARDE — MATRICE : chaque RÉGLAGE RÉSERVÉ (`lib/core.json` schema.qualifierKeys) accepte
 * `(clé:valeur)`, refuse `[clé:valeur]` avec un message qui donne la forme cible, et accepte la
 * forme parenthèse à TOUTES les positions où le crochet vivait — y compris APRÈS une affectation
 * de drapeau en fin de règle (`S -> C4 [etape=3] (weight:3)`), une position que le parseur refusait
 * avant ce chantier (« Expected arrow », alors que l'inverse — `(weight:3) [etape=3]` — compilait).
 *
 * POURQUOI UNE MATRICE, PAS UNE LISTE (règle du dépôt, payée plusieurs fois) : un garde écrit pour
 * la forme du ticket ne garde que cette forme. Les CLÉS et leurs VALEURS D'EXEMPLE viennent de la
 * DONNÉE (`lib/core.json` schema.qualifierKeys croisé avec `lib/controls.json` engine section),
 * jamais d'une liste recopiée ici — une clé ajoutée demain à `qualifierKeys` entre AUTOMATIQUEMENT
 * dans la matrice, aux deux signes et à toutes les positions.
 *
 * ⚠️ CE QUE CETTE MATRICE NE COUVRE PAS, ET C'EST MESURÉ, PAS OUBLIÉ (§0) : `goto`/`repeat`/
 * `failed`/`rndtime` sont des réglages de la section `engine` de `lib/controls.json` au même titre
 * que les neuf ci-dessous, mais NE SONT PAS dans `qualifierKeys` — mesuré au corpus, ils s'écrivent
 * exclusivement en SUFFIXE DE RÈGLE, et BPx (`loadGrammar.ts`, `mergeQualifierProcedures` +
 * la lecture dédiée de `rndtime`) les lit EXCLUSIVEMENT depuis `ast.qualifiers` (le nœud produit
 * par `[]`), jamais depuis `ast.settings` (le SettingBag que produit `()`, renommé depuis
 * `ast.runtimeQualifier` le 2026-08-06 — même nœud, même lieu, nouveau nom). Les migrer romprait
 * SILENCIEUSEMENT leur effet moteur côté BPx. Cf. `lib/core.json` `_qualifierKeys_doc` pour le
 * détail ligne par ligne. `shuffle` est un cas distinct : sa forme AVEC VALEUR (`[shuffle:N]`) a
 * été RETIRÉE du langage le 2026-06-14 (la graine s'écrit `seed:N` en tête de scène depuis le
 * 2026-08-10, `![seed:N]` dans le flux), donc il n'y a pas de forme
 * `(shuffle:N)` à migrer — seule la forme NUE `[shuffle]` (sans deux-points) reste, et elle n'entre
 * pas dans cette matrice (qui porte sur les paires `clé:valeur`).
 */
import assert from 'node:assert/strict';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const QUALIFIER_KEYS = LIBS.core?.schema?.qualifierKeys || [];
// ⚠️ SOURCE DÉPLACÉE le 2026-08-10 : la section `engine` de lib/controls.json (mode/scan/weight/
// goto/rndtime…) a rejoint lib/engine.json (mise en conformité des librairies — une clé ne vit
// que dans UNE librairie, seule lib/engine.json a pour destinataire BPx).
const ENGINE_SPECS = LIBS.engine?.engine || {};

// ─── 0. Témoin anti-rétrécissement + périmètre EXCLU explicite ───────────────────────────────
// ⚠️ SEUIL DESCENDU DE 8 À 7 LE 2026-08-08, et la raison est datée : `mode` a été RETIRÉ de
// `qualifierKeys` sur décision de Romain — « on ne change pas de mode en cours de tirage ».
// Ce n'est donc pas un socle qu'on baisse pour verdir : c'est le langage qui a perdu une clé
// de sac, et le socle qui suit. Il garde son office — refuser que la liste se VIDE.
ok(Array.isArray(QUALIFIER_KEYS) && QUALIFIER_KEYS.length >= 7,
   `0. lib/core.json schema.qualifierKeys doit rester >= 7 entrées — reçu ${JSON.stringify(QUALIFIER_KEYS)}`);
// (plancher 9 -> 8 le 2026-08-06 : `tempx` SUPPRIMÉ, décision Romain — doublon de `! (/N)`)
for (const exclu of ['goto', 'repeat', 'failed', 'rndtime']) {
  ok(!QUALIFIER_KEYS.includes(exclu),
     `0. '${exclu}' ne doit PAS être dans qualifierKeys — sa lecture côté BPx dépend de ast.qualifiers `
     + `au niveau règle (cf. lib/core.json _qualifierKeys_doc). Si cette assertion casse, c'est que `
     + `quelqu'un l'a migré : vérifier la coordination BPx AVANT de faire taire ce témoin.`);
}
ok(!QUALIFIER_KEYS.includes('shuffle'),
   `0. 'shuffle' ne doit pas être dans qualifierKeys — sa forme valuée '[shuffle:N]' est RETIRÉE du `
   + `langage (décision 2026-06-14), il n'y a pas de forme '(shuffle:N)' vers laquelle migrer`);

// ─── Valeur d'exemple par clé, dérivée de la DONNÉE (jamais recopiée en dur) ─────────────────
function valeurExemple(spec) {
  if (spec && Array.isArray(spec.values) && spec.values.length) return spec.values[0];
  if (spec && typeof spec.default === 'string') return spec.default;
  if (spec && Array.isArray(spec.range) && spec.range.length === 2) {
    return String(Math.min(spec.range[1], Math.max(spec.range[0], 10)));
  }
  if (spec && typeof spec.default === 'number') return String(spec.default);
  return '3';
}

const compile = (src) => compileToBPxAST(`core\nalphabet.western:audio\n-----\n\n${src}\n`);

let cellules = 0;
// ⚠️ FILTRÉ PAR LA PORTÉE le 2026-08-08. Ce garde mesure que les DEUX SIGNES mènent au même
// endroit pour une clé donnée. Il exerçait chaque clé à toutes les positions, ce qui était sans
// conséquence tant qu'aucune n'était interdite. Depuis que la portée est validée, écrire un
// réordonnancement sur une règle est une faute de langage et non un cas de lecture. La liste
// vient de la DONNÉE : étendre une portée étend le test tout seul.
const porteesDe = (cle) => {
  const eng = LIBS.engine?.engine?.[cle];
  return Array.isArray(eng?.scope) ? eng.scope : [];
};
for (const cle of QUALIFIER_KEYS.filter((c) => porteesDe(c).includes('rule'))) {
  const spec = ENGINE_SPECS[cle];
  const valeur = valeurExemple(spec);

  // ─── 1. (clé:valeur) accepté ──────────────────────────────────────────────────────────────
  cellules++;
  {
    const { errors } = compile(`S -> C4 (${cle}:${valeur})`);
    ok(errors.length === 0,
       `1. '(${cle}:${valeur})' doit compiler — reçu : ${errors.map((e) => e.message).join(' | ')}`);
  }

  // ─── 2. [clé:valeur] refusé, message donne la forme cible ────────────────────────────────
  cellules++;
  {
    const { errors } = compile(`S -> C4 [${cle}:${valeur}]`);
    ok(errors.length > 0, `2. '[${cle}:${valeur}]' doit être REFUSÉ`);
    ok(errors.some((e) => e.message.includes(`(${cle}:…)`) && /PARENTHÈSES/.test(e.message)),
       `2. le refus de '[${cle}:${valeur}]' doit NOMMER la forme cible '(${cle}:…)' — reçu : `
       + `${errors.map((e) => e.message).join(' | ')}`);
  }

  // ─── 3. Position : APRÈS une affectation de drapeau en fin de règle ──────────────────────
  cellules++;
  {
    const { errors } = compile(`S -> C4 [etape=3] (${cle}:${valeur})`);
    ok(errors.length === 0,
       `3. '[etape=3] (${cle}:${valeur})' (parenthèse APRÈS le crochet) doit compiler — reçu : `
       + `${errors.map((e) => e.message).join(' | ')}`);
  }

  // ─── 4. Position : AVANT une affectation de drapeau (non-régression, l'ordre inverse marchait déjà) ──
  cellules++;
  {
    const { errors } = compile(`S -> C4 (${cle}:${valeur}) [etape=3]`);
    ok(errors.length === 0,
       `4. '(${cle}:${valeur}) [etape=3]' (parenthèse AVANT le crochet) doit compiler — reçu : `
       + `${errors.map((e) => e.message).join(' | ')}`);
  }
}
// Plancher 36 -> 32 le 2026-08-06 : `tempx` SUPPRIMÉ (décision Romain). Matrice toujours pleine.
// Plancher 32 -> 28 le 2026-08-08 : `mode` RETIRÉ des clés de sac (décision Romain). Idem.
// Le plancher compte les clés RÉELLEMENT exercées (celles qui valent sur une règle), pas la
// liste entière — même raison que le filtre ci-dessus, et même calcul depuis la donnée.
const clesRegle = QUALIFIER_KEYS.filter((c) => porteesDe(c).includes('rule'));
ok(cellules === clesRegle.length * 4 && cellules >= 12,
   `la matrice doit être PLEINE — ${cellules} cellule(s) pour ${QUALIFIER_KEYS.length} clé(s) × 4 propriétés`);

// ─── 5. Injection — le refus MORD sur une clé migrée, et il se TAIT sur une clé qui ne l'est pas ──
{
  const { errors: refuse } = compile(`S -> C4 [weight:5]`);
  ok(refuse.length > 0, "5. (mord) '[weight:5]' (clé migrée) doit être refusée entre crochets");
  // (se tait) témoin distinct, hors matrice : 'goto' n'est PAS migré (§0), son crochet reste
  // légitime — le refus ne déborde pas sur une clé qui n'a pas changé de sac.
  const { errors: legitime } = compile(`S -> C4 [goto:2 1]`);
  ok(legitime.length === 0,
     `5. (se tait) '[goto:2 1]' — clé NON migrée — doit rester accepté entre crochets — reçu : `
     + `${legitime.map((e) => e.message).join(' | ')}`);
}

// ─── 6. Les TROIS emplois légitimes du crochet survivent ─────────────────────────────────────
{
  const { errors } = compile(`[stage==1] S -> C4`);
  ok(errors.length === 0, `6a. garde de drapeau avant le membre gauche '[stage==1]' doit compiler — reçu : ${errors.map((e) => e.message).join(' | ')}`);
}
{
  const { errors } = compile(`S -> C4 [stage=2]`);
  ok(errors.length === 0, `6b. affectation de drapeau en fin de règle '[stage=2]' doit compiler — reçu : ${errors.map((e) => e.message).join(' | ')}`);
}
{
  const { errors } = compileToBPxAST(`core\nalphabet.western\n\n-----\nS -> C4 D4\n\ntemplate\n[1] /1 ??\n`);
  ok(errors.length === 0, `6c. rang de gabarit '[1]' en tête de ligne 'template' doit compiler — reçu : ${errors.map((e) => e.message).join(' | ')}`);
}

if (echecs.length) {
  console.error(`❌ réglage réservé — deux signes et position : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ réglage réservé — deux signes et position — ${passe} vérification(s) passée(s) sur `
            + `${QUALIFIER_KEYS.length} clé(s) [${QUALIFIER_KEYS.join(', ')}]`);
}
