#!/usr/bin/env node
/**
 * GARDE — L'ARBRE NE PORTE PAS LA TRACE DU SIGNE (Romain, chantier 2026-08-06).
 *
 * Le moteur lit l'ARBRE, pas des parenthèses ni des crochets. Avant ce chantier, le parser
 * rangeait D'APRÈS LE SIGNE : `[...]` remplissait `rule.qualifiers`, `(...)` remplissait
 * `rule.runtimeQualifier` — deux champs, deux types de nœud (`Qualifier` / `RuntimeQualifier`)
 * pour la MÊME notion de réglage. `runtimeQualifier` est renommé `settings` (type `SettingBag`,
 * `docs/spec/AST.md:642-659`) : la clé d'un réglage dit sa nature, jamais le glyphe qui l'a écrit.
 *
 * CE QUE CE GARDE PROUVE, PAR INJECTION DANS LES DEUX SENS (mord + se tait) :
 *  1. Un réglage RÉSERVÉ (`lib/core.json` schema.qualifierKeys) et un contrôle RUNTIME déclaré
 *     (`lib/controls.json`) écrits `(clé:valeur)` produisent TOUJOURS un nœud `SettingBag` —
 *     jamais `Qualifier`, jamais un autre type — quelle que soit la POSITION d'attachement :
 *     `Rule.settings`, `Polymetric.settings`, `suffixQualifiers[i]` (élément).
 *  2. AUCUNE de ces clés n'atterrit dans `rule.qualifiers` (le sac bracket restant, réservé aux
 *     gardes/mutations de drapeau/rang de gabarit/procédures moteur `goto`/`failed`/`repeat`/
 *     `rndtime` — hors du périmètre `Setting`, cf. rapport de chantier). Si une clé de réglage se
 *     mettait à y atterrir, ce serait EXACTEMENT le bug d'origine (un poids qui devient muet parce
 *     qu'un consommateur ne regarde que l'autre sac).
 *  3. Le témoin MORD : une clé absente de `qualifierKeys` ET de `controlNames` (donc PAS un
 *     réglage) reste refusée — ce garde ne s'est pas mis à tout accepter.
 *
 * ⚠️ CE QUE CE GARDE NE COUVRE PAS, EXPLICITEMENT (périmètre du chantier 2026-08-06, cf. rapport) :
 *  - `rule.qualifiers` (bracket) lui-même NE disparaît PAS : `goto`/`failed`/`repeat`/`rndtime`/les
 *    contrôles moteur nus (`destru`, `striated`…) et l'opérateur de tempo (`TempoOp`, `[/N]`) y
 *    restent — AST.md ne leur connaît aucune place dans `SettingBag`, et BPx les lit exclusivement
 *    depuis `ast.qualifiers` (cf. `lib/core.json` `_qualifierKeys_doc`, `test/reglage_reserve_deux_signes_et_position.mjs`
 *    §0). Les y faire migrer casserait ce contrat SANS que la spec tranche leur forme cible.
 *  - La preuve « la même clé écrite des deux signes produit le même nœud » ne peut PAS s'écrire
 *    littéralement pour un réglage : depuis la décision Romain 2026-08-02 (« un signe, une
 *    nature »), `[weight:…]` etc. sont REFUSÉS au parse (checkQualifierKey) — un seul signe est
 *    grammaticalement possible par clé. Ce garde prouve l'invariant qui EN DÉCOULE : la même DONNÉE
 *    (la clé), quelle que soit sa POSITION d'attachement, produit toujours le MÊME type de nœud.
 */
import assert from 'node:assert/strict';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const QUALIFIER_KEYS = LIBS.core?.schema?.qualifierKeys || [];
// Échantillon de contrôles RUNTIME déclarés (section non-'engine' de lib/controls.json), pris
// dans les sous-groupes de transport — mêmes clés que le corpus (vel/pan connus de tous les
// transports). Dérivé de la donnée, pas recopié : on prend les 3 premières clés numériques du
// sous-groupe MIDI si présentes, sinon on retombe sur un couple connu du corpus.
const runtimeSample = ['vel', 'pan'].filter((k) => !QUALIFIER_KEYS.includes(k));

// Plancher abaissé de 9 à 8 le 2026-08-06 : `tempx` SUPPRIMÉ du langage (décision Romain,
// doublon exact de l'opérateur de vitesse, qui s'écrit `! (/N)` dans le flux). Un plancher se
// baisse à la MAIN, daté et motivé — jamais parce qu'un compte a bougé.
ok(QUALIFIER_KEYS.length >= 8, `0. schema.qualifierKeys doit rester peuplé — reçu ${QUALIFIER_KEYS.length}`);
ok(runtimeSample.length === 2, `0. l'échantillon runtime (vel, pan) doit être hors qualifierKeys — reçu ${JSON.stringify(runtimeSample)}`);

function valeurExemple(spec) {
  if (spec && Array.isArray(spec.values) && spec.values.length) return spec.values[0];
  if (spec && typeof spec.default === 'string') return spec.default;
  if (spec && Array.isArray(spec.range) && spec.range.length === 2) {
    return String(Math.min(spec.range[1], Math.max(spec.range[0], 10)));
  }
  return '3';
}
const ENGINE_SPECS = LIBS.controls?.engine || {};
const specDe = (cle) => ENGINE_SPECS[cle] || (LIBS.controls?.runtime?.midi?.[cle]) || (LIBS.controls?.runtime?.audio?.[cle]);

const HEAD = '@core\n@controls\n@alphabet.western:midi\n\n';
const compile = (src) => compileToBPxAST(`${HEAD}${src}\n`);

const clesTestees = [...QUALIFIER_KEYS, ...runtimeSample];

// ─── 1+2. Position RULE : `(clé:val)` → Rule.settings SettingBag, JAMAIS rule.qualifiers ───────
let cellules = 0;
for (const cle of clesTestees) {
  const valeur = valeurExemple(specDe(cle));
  cellules++;
  const { ast, errors } = compile(`S -> C4 (${cle}:${valeur})`);
  ok(errors.length === 0, `1. 'S -> C4 (${cle}:${valeur})' doit compiler — ${errors.map((e) => e.message).join(' | ')}`);
  if (errors.length === 0) {
    const rule = ast.subgrammars[0].rules[0];
    ok(rule.settings?.type === 'SettingBag',
      `1. '(${cle}:…)' au niveau règle doit produire Rule.settings.type==='SettingBag' — reçu ${JSON.stringify(rule.settings)}`);
    ok((rule.settings?.pairs || []).some((p) => p.key === cle),
      `1. '(${cle}:…)' doit apparaître dans Rule.settings.pairs — reçu ${JSON.stringify(rule.settings?.pairs)}`);
    ok(!(rule.qualifiers || []).some((q) => (q.pairs || []).some((p) => p.key === cle)),
      `2. '${cle}' ne doit JAMAIS apparaître dans rule.qualifiers (sac bracket) — reçu ${JSON.stringify(rule.qualifiers)}`);
  }
}

// ─── 1bis. Position GROUPE : `{A B}(clé:val)` → Polymetric.settings SettingBag ─────────────────
for (const cle of clesTestees) {
  const valeur = valeurExemple(specDe(cle));
  cellules++;
  const { ast, errors } = compile(`S -> {C4 D4}(${cle}:${valeur})`);
  ok(errors.length === 0, `1bis. '{C4 D4}(${cle}:${valeur})' doit compiler — ${errors.map((e) => e.message).join(' | ')}`);
  if (errors.length === 0) {
    const poly = ast.subgrammars[0].rules[0].rhs.find((e) => e.type === 'Polymetric');
    ok(poly?.settings?.type === 'SettingBag',
      `1bis. '{…}(${cle}:…)' doit produire Polymetric.settings.type==='SettingBag' — reçu ${JSON.stringify(poly?.settings)}`);
  }
}

// ─── 1ter. Position ÉLÉMENT : `A(clé:val)` collé → suffixQualifiers[i] SettingBag ──────────────
for (const cle of clesTestees) {
  const valeur = valeurExemple(specDe(cle));
  cellules++;
  const { ast, errors } = compile(`S -> C4(${cle}:${valeur}) D4`);
  ok(errors.length === 0, `1ter. 'C4(${cle}:${valeur})' doit compiler — ${errors.map((e) => e.message).join(' | ')}`);
  if (errors.length === 0) {
    const c4 = ast.subgrammars[0].rules[0].rhs.find((e) => e.name === 'C4');
    const sq = (c4?.suffixQualifiers || [])[0];
    ok(sq?.type === 'SettingBag',
      `1ter. 'C4(${cle}:…)' doit produire suffixQualifiers[0].type==='SettingBag' — reçu ${JSON.stringify(sq)}`);
  }
}

// Plancher 33 -> 30 le 2026-08-06 : `tempx` SUPPRIMÉ du langage (décision Romain — doublon
// exact de l'opérateur de vitesse). Le produit croisé reste PLEIN, il a une clé de moins.
ok(cellules === clesTestees.length * 3 && cellules >= 30,
  `la matrice doit être PLEINE — ${cellules} cellule(s) pour ${clesTestees.length} clé(s) × 3 positions`);

// ─── 3. Témoin MORD : une clé qui n'est ni réglage réservé ni contrôle connu reste refusée ─────
{
  const { errors } = compile(`S -> C4 (inconnueXYZ:1)`);
  ok(errors.length > 0, `3. (mord) '(inconnueXYZ:1)' — clé inconnue — doit rester refusée`);
}

// ─── 4. INJECTION — débrancher l'invariant doit faire rougir le garde lui-même ─────────────────
// (Auto-vérification du garde, PAS un test séparé : si on cherchait 'settings' là où le code
// pose 'runtimeQualifier', la cellule 1 échouerait — preuve que la clé de lecture est bien celle
// qui a mordu ci-dessus, pas un champ toujours présent par accident.)
{
  const { ast } = compile(`S -> C4 (weight:5)`);
  const rule = ast.subgrammars[0].rules[0];
  ok(rule.runtimeQualifier === undefined,
    `4. (témoin) 'rule.runtimeQualifier' ne doit PLUS exister (ancien nom, migré) — reçu ${JSON.stringify(rule.runtimeQualifier)}`);
}

if (echecs.length) {
  console.error(`❌ le signe ne route pas le réglage : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ le signe ne route pas le réglage — ${passe} vérification(s) passée(s) sur `
    + `${clesTestees.length} clé(s) × 3 positions [${clesTestees.join(', ')}]`);
}
