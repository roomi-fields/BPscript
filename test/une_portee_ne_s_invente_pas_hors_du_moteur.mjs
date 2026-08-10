#!/usr/bin/env node
/**
 * GARDE — LA PORTÉE D'UN CONTRÔLE EST CELLE DU MOTEUR NATIF, ET LE PORTAGE LA SUIT.
 *
 * ⚠️ CE QUI A COÛTÉ CE GARDE. `lib/engine.json` donnait à `destru` les portées
 * `["subgrammar","scene"]`. La seconde était INVENTÉE : le moteur natif ne la porte nulle part —
 * `CompileGrammar.c:1528` arme `subgram.destru` depuis le préambule d'une sous-grammaire (lu
 * `Compute.c:225`), `Encode.c:408` arme `rule.destru` depuis le RHS d'une règle (lu
 * `Compute.c:732`), et aucune branche ne connaît de portée « scène ». Le corpus natif dit la même
 * chose : 3 occurrences, toutes posées après le mode d'une sous-grammaire.
 *
 * CE QUE LA PORTÉE INVENTÉE A PRODUIT, et c'est pour ça qu'elle n'était pas inoffensive : elle
 * rendait `@destru` écrivable en tête de scène, et ma voie de portage BP3 l'y écrivait. Le même
 * `_destru` natif devenait donc une DIRECTIVE DE SCÈNE chez moi et un MODIFICATEUR DE
 * SOUS-GRAMMAIRE chez bp3-frontend — deux objets, deux places dans l'arbre, pour le même texte.
 * Rien ne rougissait : chaque voie était conforme à une donnée qui autorisait les deux.
 *
 * Arbitrage Romain, 2026-08-10 : « on doit être conforme à l'usage BP3 et s'y limiter pour
 * destru ». La portée `scene` est retirée, `rule` la remplace — sa graphie existait déjà.
 *
 * ⚠️ CE GARDE ÉPROUVE LES DEUX BOUTS, et l'un sans l'autre ne prouverait rien : ce que la DONNÉE
 * déclare, et ce que le PORTAGE en fait. Une donnée juste avec un portage qui l'ignore laisse le
 * défaut entier — c'est exactement l'état d'où l'on vient.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { bp3ToScene } from '../src/transpiler/bp3ToScene.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const LIB = JSON.parse(readFileSync(path.join(ICI, '..', 'lib', 'engine.json'), 'utf-8'));

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const SOCLE = '@core\n@alphabet.western\n';
const err = (src) => {
  try { return (compileToBPxAST(SOCLE + src).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};

// ── 1. LA DONNÉE — les portées déclarées sont celles du moteur, dans TOUTES ses sections ─────
// `destru` est déclaré DEUX fois dans cette librairie (le vocabulaire réservé et la section des
// procédures de sous-grammaire). Une seule corrigée laisserait l'autre répondre — et c'est la
// section interrogée qui gagne, donc le hasard.
{
  const ATTENDU = ['subgrammar', 'rule'];
  let vues = 0;
  for (const [nomSection, section] of Object.entries(LIB)) {
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue;
    for (const [ou, def] of Object.entries(section)) {
      const cible = ou === 'destru' ? def : (ou === 'reservedDirectives' ? null : null);
      if (!cible || !Array.isArray(cible.scope)) continue;
      vues++;
      ok(!cible.scope.includes('scene'),
         `1. '${nomSection}.destru' déclare encore la portée 'scene' — INVENTÉE, aucune branche du `
         + `moteur ne la porte (CompileGrammar.c:1528 = sous-grammaire, Encode.c:408 = règle)`);
      ok(JSON.stringify(cible.scope) === JSON.stringify(ATTENDU),
         `1. '${nomSection}.destru' doit déclarer ${JSON.stringify(ATTENDU)} — reçu `
         + `${JSON.stringify(cible.scope)}`);
    }
  }
  // Le vocabulaire réservé, atteint par son propre chemin.
  const res = LIB?.schema?.reservedDirectives?.destru;
  if (res && Array.isArray(res.scope)) {
    vues++;
    ok(!res.scope.includes('scene'), "1. 'schema.reservedDirectives.destru' déclare encore 'scene'");
  }
  ok(vues >= 2, `1. les DEUX déclarations de 'destru' doivent être éprouvées — ${vues} vue(s)`);
}

// ── 2. LA SURFACE — chaque graphie est acceptée là où la portée la met, refusée ailleurs ─────
{
  ok(err('@destru\nS -> C4').length >= 1,
     "2. '@destru' en tête de scène doit être REFUSÉ — la portée 'scene' n'existe pas au moteur");
  ok(err('@destru\nS -> C4').some((m) => /sous-grammaire|règle/.test(m)),
     `2. et le refus doit dire OÙ le mot vaut ; reçu : ${err('@destru\nS -> C4')[0]}`);
  ok(err('@mode:ord(destru)\nS -> C4').length === 0,
     `2. '@mode:ord(destru)' doit PASSER — portée 'subgrammar', armée par CompileGrammar.c:1528`);

  // ⚠️ CETTE SECTION A ÉTÉ RÉÉCRITE LE JOUR MÊME, ET LE GARDE L'AVAIT EXIGÉ. Elle constatait que
  // la portée `rule` n'avait AUCUNE graphie : `[destru]` passait comme DRAPEAU homonyme et
  // `(destru)` rendait « attribut inconnu ». Le constat portait sa propre condition de péremption
  // — « si ça change, la portée a reçu une graphie et cette section est à réécrire ». Romain a
  // tranché quelques heures après : « la portée règle, c'est un sac en fin de règle pour tous les
  // contrôles, ça doit être pareil pour destru, voilà comme pour stop ».
  //
  // CE QUI MANQUAIT N'ÉTAIT PAS UNE SYNTAXE, mais deux faits de donnée : `destru` vivait dans une
  // section qui n'alimente aucun sac, et le critère des procédures de règle exigeait une portée
  // de longueur EXACTEMENT 1 — ce qui écartait toute procédure valant aussi ailleurs.
  //
  // LA PREUVE SE FAIT PAR COMPARAISON AVEC `stop`, jamais sur `destru` seul : le crochet accepte
  // n'importe quel mot comme drapeau, donc « `[destru]` passe » ne prouve rien. Ce qui prouve,
  // c'est qu'il produise le MÊME OBJET que la procédure de référence.
  {
    const lire = (src) => {
      const regle = compileToBPxAST(`${SOCLE}${src}`).ast?.subgrammars?.[0]?.rules?.[0];
      return {
        cles: (regle?.qualifiers || []).flatMap((q) => (q.pairs || []).map((p) => p.key)),
        drapeaux: (regle?.flags || []).map((f) => f && f.flag),
      };
    };
    const d = lire('S -> C4 [destru]');
    const s = lire('S -> C4 [stop]');
    ok(s.cles.includes('stop'),
       `2. SOCLE — '[stop]', la procédure de référence, doit être un contrôle de règle ; reçu `
       + `${JSON.stringify(s)}`);
    ok(d.cles.includes('destru'),
       `2. '[destru]' doit être lu comme un CONTRÔLE de règle, comme '[stop]' ; reçu `
       + `${JSON.stringify(d)}`);
    ok(d.drapeaux.length === 0,
       `2. et PLUS comme un drapeau — c'était l'homonymie silencieuse d'avant ; reçu `
       + `${JSON.stringify(d.drapeaux)}`);
    // ET LES DEUX NATURES COEXISTENT : recevoir le crochet ne lui retire pas la sous-grammaire.
    ok(err('@mode:ord(destru)\nS -> C4').length === 0,
       `2. '@mode:ord(destru)' passe TOUJOURS — la section dit le SAC, la portée dit la POSITION, `
       + `et les deux natures de 'destru' tiennent ensemble`);
  }
}

// ── 3. LE PORTAGE — ce que ma voie BP3 fait du même mot ──────────────────────────────────────
// ⚠️ SANS CETTE SECTION, LA DONNÉE POURRAIT ÊTRE JUSTE ET LE PORTAGE FAUX : c'est l'état exact
// d'avant, et il ne rougissait nulle part.
{
  const bps = bp3ToScene('ORD\n_mm(88.0000) _striated _destru\ngram#1[1] S --> a b\n');
  ok(!/^@destru/m.test(bps),
     `3. le portage ne doit PLUS écrire '@destru' en tête de scène — reçu :\n${bps}`);
  ok(/@mode:ord\([^)]*destru/.test(bps),
     `3. '_destru' doit se poser sur la SOUS-GRAMMAIRE, comme dans le natif — reçu :\n${bps}`);
  ok(/^@tempo:88/m.test(bps),
     `3. et '_mm(N)', dont la portée EST la scène, reste en tête — reçu :\n${bps}`);

  const r = compileToBPxAST(bps);
  const mods = (r.ast?.subgrammars?.[0]?.modifiers || []).map((m) => m && m.name);
  ok(mods.includes('destru'),
     `3. l'arbre doit porter 'destru' dans les modificateurs de sous-grammaire — reçu `
     + `${JSON.stringify(mods)}`);
  ok(!(r.ast?.directives || []).some((d) => d && d.name === 'destru'),
     `3. et PAS dans les directives de scène — c'est la place que bp3-frontend lui donne aussi, `
     + `et deux voies qui divergent sur la place rendent deux arbres pour le même texte natif`);
}

// ── 4. TÉMOIN D'INSTRUMENT ───────────────────────────────────────────────────────────────────
// ⚠️ CE TÉMOIN A DÉJÀ SERVI, ET C'EST POUR ÇA QU'IL EST ÉCRIT AINSI. Sa première version exigeait
// que `[zorglub]` soit REFUSÉ — elle a échoué, et cet échec a révélé que le crochet accepte tout
// mot comme drapeau, donc que ma preuve de la portée `rule` (section 2) était verte pour la
// mauvaise raison. Un témoin qui rougit n'accuse pas toujours le sujet : ici il accusait la mesure.
ok(err('S -> C4 [zorglub]').length === 0,
   "4. TÉMOIN — le crochet accepte tout mot comme drapeau : c'est CE FAIT qui interdit de lire "
   + "'[destru] passe' comme une preuve de portée. S'il se met à refuser, le crochet a été "
   + 'restreint et la section 2 doit être relue.');
// ⚠️ ET LE SECOND TÉMOIN A MORDU AUSSI, sur la seconde preuve. J'attendais que le modificateur de
// sous-grammaire VALIDE ses noms — il ne les valide pas : `@mode:ord(zorglub)` passe et entre dans
// l'arbre en `{name:"zorglub"}`. Donc « `@mode:ord(destru)` passe » ne prouvait pas davantage que
// « `[destru]` passe » : les deux graphies acceptent n'importe quel mot.
// CE QUI EST RÉELLEMENT PROUVÉ DANS CE FICHIER se réduit donc à deux choses, et elles suffisent au
// geste du jour : `@destru` en tête est REFUSÉ (section 2, la portée inventée est bien partie), et
// le PORTAGE pose le mot sur la sous-grammaire (section 3, la divergence avec bp3-frontend est
// fermée). Le reste est un constat, pas une preuve, et il est écrit comme tel.
// ⚠️ CE TÉMOIN A ROUGI LE JOUR MÊME, ET C'ÉTAIT SON OFFICE. Il exigeait d'abord que
// `@mode:ord(zorglub)` PASSE — c'était l'état : les modificateurs de sous-grammaire n'étaient
// confrontés à aucune librairie, et j'avais écrit « le jour où il se ferme, ce témoin rougit et la
// section 2 devient une vraie preuve ». Le trou a été refermé quelques heures plus tard (règle 1
// de Romain), le témoin a rougi, et il dit maintenant l'état neuf. C'est la forme utile d'un
// témoin : il ne garde pas un acquis, il DATE un état et exige qu'on revienne le relire.
{
  const e = err('@mode:ord(zorglub)\nS -> C4');
  ok(e.length >= 1 && e.some((m) => /aucune librairie/.test(m)),
     `4. TÉMOIN — un modificateur de sous-grammaire inconnu est REFUSÉ, en nommant la cause ; `
     + `reçu : ${JSON.stringify(e)}`);
  const horsPortee = err('@mode:ord(tempo:60)\nS -> C4');
  ok(horsPortee.some((m) => /portée déclarée/.test(m)),
     `4. TÉMOIN — un mot DÉCLARÉ mais hors portée est refusé en NOMMANT sa portée : la section 2 `
     + `mesure donc bien quelque chose ; reçu : ${JSON.stringify(horsPortee)}`);
}

if (echecs.length) {
  console.error(`[portée native] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[portée native] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
