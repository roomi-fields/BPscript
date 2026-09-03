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
 * ⚠️ CE GARDE ÉPROUVAIT LES DEUX BOUTS — ce que la DONNÉE déclare, et ce que le PORTAGE en faisait.
 * Le second bout est parti le 2026-08-12 AVEC SON OBJET : le convertisseur de grammaire native a
 * été retiré (aucun appelant de production, aucun produit, et sa sortie ne compilait plus — 0 des
 * 26 grammaires sans scène, 5 sur 40 en témoin non nul). Ce n'est pas une couverture perdue : la
 * divergence qu'il fermait ne peut plus naître, faute d'une seconde voie pour la porter. Ce qui
 * reste ici garde ce qui reste : la donnée et la surface.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileToBPxAST } from '../src/transpiler/index.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
// ⛔ CE GARDE LIT LE PAQUET, PAS UN FICHIER NOMMÉ — corrigé le 2026-08-14 quand `engine` est passée
// en `.bpsl`. Il ouvrait `lib/engine.json` par son nom et s'est arrêté sur une erreur d'ouverture.
// C'est le piège annoncé, sous sa forme la plus directe : la bascule des cinq avait aveuglé un
// lecteur qui ÉNUMÉRAIT `lib/*.json` ; celui-ci NOMMAIT le fichier, et le nom est aussi mouvant que
// l'extension. `src/transpiler/libs-data.js` est ce que tous les consommateurs chargent, et il rend
// les deux graphies sous une seule forme.
// ⚠️ MESURE DE LA FAMILLE, faite avant de corriger le cas : 54 fichiers NOMMENT un `lib/*.json`,
// mais DEUX seulement en OUVRENT un. Les 52 autres le citent en commentaire — une mention n'est pas
// un lien, et corriger les 54 aurait été réparer 52 choses qui ne cassent pas.
const _req = createRequire(import.meta.url);
const _d = _req('../src/transpiler/libs-data.js');
const LIB = (_d.LIBS || _d.default || _d).engine;

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const SOCLE = 'core\nalphabet.western\n';
const err = (src) => {
  try { return (compileToBPxAST(SOCLE + src).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};

// ── 1. LA DONNÉE — les portées déclarées sont celles du moteur, dans TOUTES ses sections ─────
// `destru` a été déclaré DEUX fois dans cette librairie jusqu'au 2026-09-02 (le vocabulaire réservé
// et la place des procédures) ; la table réservée d'`engine` est sortie ce jour-là — chaque mot est
// un `control` qui déclare sa portée, une fois. Le balayage reste sur TOUTES les places : une
// seconde déclaration qui reviendrait serait vue et éprouvée comme la première.
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
         + `moteur ne la porte(CompileGrammar.c:1528 = sous-grammaire, Encode.c:408 = règle)`);
      ok(JSON.stringify(cible.scope) === JSON.stringify(ATTENDU),
         `1. '${nomSection}.destru' doit déclarer ${JSON.stringify(ATTENDU)} — reçu `
         + `${JSON.stringify(cible.scope)}`);
    }
  }
  ok(vues >= 1, `1. la déclaration de 'destru' doit être éprouvée — ${vues} vue(s)`);
  ok(!LIB?.schema?.reservedDirectives,
     "1. `engine` ne porte plus de table réservée — chaque mot est un contrôle qui déclare sa portée(2026-09-02)");
}

// ── 2. LA SURFACE — chaque graphie est acceptée là où la portée la met, refusée ailleurs ─────
{
  ok(err('destru\n-----\nS -> C4').length >= 1,
     "2. 'destru' en tête de scène doit être REFUSÉ — la portée 'scene' n'existe pas au moteur");
  ok(err('destru\n-----\nS -> C4').some((m) => /sub-grammar|rule/.test(m)),
     `2. et le refus doit dire OÙ le mot vaut ; reçu : ${err('destru\n-----\nS -> C4')[0]}`);
  ok(err('mode:ord(destru)\n-----\nS -> C4').length === 0,
     `2. 'mode:ord(destru)' doit PASSER — portée 'subgrammar', armée par CompileGrammar.c:1528`);

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
    const d = lire('-----\nS -> C4 [destru]');
    const s = lire('-----\nS -> C4 [stop]');
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
    ok(err('mode:ord(destru)\n-----\nS -> C4').length === 0,
       `2. 'mode:ord(destru)' passe TOUJOURS — la section dit le SAC, la portée dit la POSITION, `
       + `et les deux natures de 'destru' tiennent ensemble`);
  }
}

// ── 3. LA PLACE DANS L'ARBRE — le mot se pose sur la sous-grammaire, jamais sur la scène ─────
// ⚠️ CE QUE CETTE SECTION MESURE A CHANGÉ DE SOURCE, PAS D'OBJET. Elle partait d'une grammaire
// native passée au convertisseur ; celui-ci est retiré, et la scène s'écrit donc directement. La
// question gardée est la même et elle reste la bonne : le mot atterrit-il au bon endroit de
// l'arbre. C'est là que se jouait la divergence avec bp3-frontend — deux places pour un même mot
// rendent deux arbres, et rien ne rougit.
{
  const r = compileToBPxAST(`${SOCLE}tempo:88\nmode:ord(destru)\n-----\nS -> C4 E4\n`);
  ok((r.errors || []).length === 0,
     `3. la scène doit compiler — reçu : ${JSON.stringify((r.errors || []).map((e) => e.message))}`);
  const mods = (r.ast?.subgrammars?.[0]?.modifiers || []).map((m) => m && m.name);
  ok(mods.includes('destru'),
     `3. l'arbre doit porter 'destru' dans les modificateurs de sous-grammaire — reçu `
     + `${JSON.stringify(mods)}`);
  ok(!(r.ast?.directives || []).some((d) => d && d.name === 'destru'),
     `3. et PAS dans les directives de scène — c'est la place que bp3-frontend lui donne aussi, `
     + `et deux voies qui divergent sur la place rendent deux arbres pour le même texte natif`);
}

// ── 4. TÉMOIN D'INSTRUMENT ───────────────────────────────────────────────────────────────────
// ⛔ CE TÉMOIN A SERVI DEUX FOIS, ET LA SECONDE EST LE 2026-08-22 — IL A ANNONCÉ SON PROPRE
// RENVERSEMENT. Sa première version exigeait que `[zorglub]` soit REFUSÉ ; elle a échoué, et cet
// échec a révélé que le crochet acceptait ALORS tout mot comme drapeau — donc que la preuve de la
// portée `rule` (section 2) était verte pour la mauvaise raison. Le témoin a donc été retourné pour
// GRAVER ce fait, avec sa clause : « s'il se met à refuser, le crochet a été restreint et la
// section 2 doit être relue ».
//
// ⛔ IL S'EST MIS À REFUSER. Un drapeau se déclare depuis le 2026-08-22 (Romain), et `[zorglub]` est
// refusé en nommant le drapeau manquant. La section 2 est donc relue, et elle GAGNE une preuve
// qu'elle n'avait pas : `[destru]` passe MAINTENANT pour une raison, celle qu'on voulait montrer —
// `destru` est un réglage de règle du vocabulaire, pas un mot que le crochet avale.
ok(err('-----\nS -> C4 [zorglub]').length >= 1,
   "4. TÉMOIN — le crochet REFUSE désormais un mot qui n'est ni un réglage de règle ni un drapeau "
   + "déclaré. C'est CE FAIT qui rend '[destru] passe' probant : il ne passe plus par tolérance.");
ok(err('-----\nS -> C4 [zorglub]').some((m) => /is not declared/.test(m)),
   '4. et son refus NOMME le drapeau manquant — un refus muet laisserait croire que la graphie est '
   + 'fautive alors que c\'est la déclaration qui manque');
ok(err('flag zorglub:0\n-----\nS -> C4 [zorglub]').length === 0,
   '4. COMPLÉMENT — déclaré, le même mot passe. Sans lui, « le crochet refuse » se confondrait avec '
   + '« le crochet a cessé de lire les drapeaux ».');
// ⚠️ ET LE SECOND TÉMOIN S'EST RETOURNÉ AVEC LUI. Il constatait que `mode:ord(zorglub)` PASSAIT,
// donc que « `mode:ord(destru)` passe » ne prouvait rien. Mesuré le 2026-08-22 : il REFUSE
// maintenant — « 'zorglub' n'est déclaré par aucune librairie ». Les deux graphies sont donc
// devenues probantes le même jour, sans que ce fichier ait bougé.
// CE QUI EST PROUVÉ DANS CE FICHIER n'est plus réduit : `destru` en tête est REFUSÉ (section 2), il
// est ACCEPTÉ là où sa portée le met — et cette acceptation vaut désormais, puisque les deux
// lecteurs refusent ce qu'ils ne connaissent pas —, et le PORTAGE le pose sur la sous-grammaire
// (section 3). Ce qui était un constat est devenu une preuve, par un geste étranger à ce fichier.
// ⚠️ CE TÉMOIN A ROUGI LE JOUR MÊME, ET C'ÉTAIT SON OFFICE. Il exigeait d'abord que
// `mode:ord(zorglub)` PASSE — c'était l'état : les modificateurs de sous-grammaire n'étaient
// confrontés à aucune librairie, et j'avais écrit « le jour où il se ferme, ce témoin rougit et la
// section 2 devient une vraie preuve ». Le trou a été refermé quelques heures plus tard (règle 1
// de Romain), le témoin a rougi, et il dit maintenant l'état neuf. C'est la forme utile d'un
// témoin : il ne garde pas un acquis, il DATE un état et exige qu'on revienne le relire.
{
  const e = err('mode:ord(zorglub)\n-----\nS -> C4');
  ok(e.length >= 1 && e.some((m) => /not declared by any invoked library/.test(m)),
     `4. TÉMOIN — un modificateur de sous-grammaire inconnu est REFUSÉ, en nommant la cause ; `
     + `reçu : ${JSON.stringify(e)}`);
  // ⚠️ CE TÉMOIN PORTAIT `tempo`, QUI A CESSÉ DE CONVENIR le 2026-08-18 : le métronome a gagné la
  // portée `subgrammar` en reprenant le câblage de `mm`, sorti du langage. Un témoin de « déclaré
  // mais hors portée » doit nommer un mot que la donnée tient HORS de la sous-grammaire ;
  // `quantization` est déclaré `["scene"]` et le reste.
  const horsPortee = err('mode:ord(quantization:60)\n-----\nS -> C4');
  ok(horsPortee.some((m) => /does not apply to a sub-grammar/.test(m)),
     `4. TÉMOIN — un mot DÉCLARÉ mais hors portée est refusé en NOMMANT sa portée : la section 2 `
     + `mesure donc bien quelque chose ; reçu : ${JSON.stringify(horsPortee)}`);
}

if (echecs.length) {
  console.error(`[portée native] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[portée native] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
