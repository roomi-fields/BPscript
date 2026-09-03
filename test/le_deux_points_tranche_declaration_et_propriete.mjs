#!/usr/bin/env node
/**
 * GARDE — le DEUX-POINTS tranche entre DÉCLARER un nom et POSER une propriété.
 *
 * Deux décisions de Romain du 2026-07-29, livrées ensemble parce qu'elles touchent LES MÊMES
 * LIGNES — 12 scènes sur 263, 27 occurrences. Les livrer séparément aurait fait migrer Kanopi
 * deux fois pour les mêmes lignes ; c'est un choix de séquencement, pas de périmètre.
 *
 * 1. LA FORME NUE EST SUPPRIMÉE, pas dépréciée. Ma grammaire l'annonçait comme « format legacy
 *    toujours supporté » : c'était de la rétrocompatibilité conservée, donc elle tombe sous la
 *    règle du 2026-07-19. Une partie déclarative se lit à l'œil quand toutes ses lignes portent le
 *    même signe ; une exception par type le défait.
 *
 * 2. LE DEUX-POINTS TRANCHE, ET C'EST LE RETRAIT D'UNE DEVINETTE. Le compilateur distinguait la
 *    déclaration d'un modulateur de la pose d'une propriété d'après ce qui SUIVAIT le deux-points
 *    (`lib.type(…)` ou un bloc de code ?). C'est exactement le mécanisme qui a condamné le signe
 *    `=` le 27 juillet — un sens qui dépend du contexte. Désormais :
 *      · AVEC `:` → PROPRIÉTÉ posée sur un nom qui existe ;
 *      · SANS `:` → DÉCLARATION qui crée un nom, forme unique `@<directive> <nom> <valeur>`.
 *    Romain généralise aux QUATRE types : « en toute logique les 2 formes s'appliquent aux 4 ».
 *
 * ⚠️ ET UN DÉFAUT TROUVÉ EN LIVRANT, de la famille exacte que je répare ce matin : la déclaration
 * sans deux-points était PARSÉE PUIS RANGÉE PARMI LES DIRECTIVES — donc invisible de tout ce qui
 * cherche un modulateur. Un objet déclaré que rien ne pouvait invoquer, sans une erreur. Le §3 le
 * garde : il ne suffit pas que ça compile, il faut que l'objet ARRIVE.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const err = (src) => {
  try { return (compileToBPxAST(src).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};
const S = 'core\nalphabet.western\n';

// ── 1. LE VOLET DE LA FORME NUE EST RETIRÉ — la règle qu'il tenait est ABROGÉE ─────────────
// ⛔ Il exigeait que `gate X:midi`, `trigger` et `cv` sans arobase soient REFUSÉS, au nom de la
// décision du 2026-07-29 : « une partie déclarative se lit à l'œil quand toutes ses lignes
// portent le même signe ». Le 2026-08-18, Romain a retiré l'arobase de PARTOUT — « on enlève
// tous les arobases et c'est tout ». La forme nue n'est donc plus la forme morte : c'est la
// SEULE forme. Le volet ne se rafistole pas, il sort.
//
// ⚠️ CE QUI RESTE DE CE FICHIER EST TOUJOURS VIVANT, et c'est pourquoi il n'est pas supprimé :
// le DEUX-POINTS qui tranche déclaration et propriété (§2, §2bis) et l'objet déclaré qui doit
// ARRIVER dans l'arbre (§3) sont deux règles que la sortie de l'arobase ne touche pas.

// ── 2. LES DEUX FORMES AROBASÉES — chacune à sa place ───────────────────────────────────────
ok(err(`${S}C4:midi\n-----\nS -> C4\n`).length === 0,
  '2. PROPRIÉTÉ — `C4:midi` pose une propriété sur un nom qui existe');
// ⛔ LE VOLET 2 ÉPROUVAIT `adsr env1` — une déclaration de module, sortie du langage le 2026-08-23
// avec l'archivage de `mod`. Ce que ce garde tient est le DEUX-POINTS, pas le module : la
// déclaration sans deux-points reste éprouvée par les autres types en tête, qui eux vivent.
ok(err(`${S}signal grain\n-----\nS -> C4\n`).length === 0,
  '2. DÉCLARATION — `signal grain` crée un nom, sans deux-points');
// ⛔ LE CAS DU BLOC DE CODE A PERDU SON PORTEUR le 2026-08-09 : il s ecrivait avec `cv`, supprime
// du langage. La forme qui le remplacera — le corps  code typé  de `def` — n est PAS ENCORE LUE.
// Ce que le volet garde encore, et qui suffit : les deux formes arobasées vivantes, la PROPRIÉTÉ
// sur un nom existant et la DÉCLARATION qui crée un nom. Le troisième cas revient avec son palier.
// Un nom SEUL en tête ne déclare rien : il doit être refusé plutôt que passer.
// ⚠️ LE MOTIF ATTENDU A CHANGÉ AVEC LE PORTEUR, le 2026-08-18. Ce cas s'écrivait `gate X` — le mot
// portait l'intention de déclarer, et son refus pouvait dire « sans valeur, tu ne déclares rien ».
// `gate` est sorti : `X` seul n'est plus une déclaration incomplète, c'est un mot de tête que rien
// ne déclare, et c'est ce que le refus dit. Exiger l'ancien motif ferait redemander un message que
// plus aucune forme ne justifie.
{
  const e = err(`${S}X\n-----\nS -> C4\n`);
  ok(e.length >= 1, '2. `X` seul ne déclare rien et doit être refusé');
  ok(e.some((m) => /is declared by no loaded library/.test(m)),
     `2. et le refus doit dire POURQUOI — reçu : ${e.join(' | ').slice(0, 120)}`);
}

// ── 2bis. LE DEUXIÈME PAS DE LA MIGRATION — là où on abandonne l'auteur ─────────────────────
// ⚠️ SIGNALÉ PAR KAIROS VIA BPX, ET LE DÉFAUT ÉTAIT DE MOI. Mon refus de la forme nue ENSEIGNE
// que le deux-points pose une propriété. Qui migre `cv env1 : mod.adsr(…)` en lisant ce message
// garde donc naturellement le deux-points — et tombait sur « ligne non reconnue au niveau des
// règles », un générique qui ne dit plus rien du modulateur.
// UNE ERREUR QUI APPREND UNE GRAPHIE NE DOIT PAS MENER À UNE ERREUR QUI N'APPREND RIEN. Un
// message de migration se juge sur le CHEMIN COMPLET, pas sur son premier pas : c'est le second
// qui décide si l'auteur s'en sort.
// ⛔ VOLET SUSPENDU le 2026-08-09 : la directive qu il mesure est SUPPRIMEE du langage.
// Son sujet — un message de migration se juge sur le CHEMIN COMPLET, pas sur son premier pas —
// reste entierement vrai et vaut pour toute directive. Mais son porteur n existe plus, et le
// refus qu il rencontre desormais est celui de la SUPPRESSION, qui ne parle pas de deux-points.
// ⚠️ CE VOLET A UNE VALEUR PARTICULIERE ET IL FAUT LE DIRE : il a ete ecrit sur un defaut SIGNALE
// par Kairos via BPx, ou mon refus enseignait une graphie qui menait a un refus muet. Le rallumer
// tel quel n aurait pas de sens ; le reecrire sur le corps  code typé  de def, quand il existera,
// gardera la meme chose sur la forme vivante.
const VOLET_2BIS_ACTIF = false;
if (VOLET_2BIS_ACTIF) {
for (const [quoi, corps] of [['un bloc de code', '`js: 1`']]) {
  const e = err(`core\nmod\nalphabet.western\ncv x : ${corps}\n-----\nS -> C4\n`);
  ok(e.length >= 1, `2bis. 'cv x : ${quoi}' doit être refusé — le deux-points n'a pas de sens là`);
  ok(e.some((m) => /deux-points n'a pas de sens ici/.test(m)),
    `2bis. ${quoi} — le refus doit NOMMER la faute, pas dire « ligne non reconnue » (reçu : ${e[0]})`);
  ok(e.some((m) => /Retirer le deux-points/.test(m)),
    `2bis. ${quoi} — et donner la RÉÉCRITURE, sinon le second pas abandonne l'auteur`);
}
}

// ── 3. L'OBJET DÉCLARÉ DOIT ARRIVER — pas seulement compiler ────────────────────────────────
// ⚠️ C'EST ICI QUE LE DÉFAUT S'EST MONTRÉ. La déclaration sans deux-points compilait proprement
// et le modulateur était rangé parmi les directives : déclaré, invisible, non invocable. « Ça
// compile » n'est pas « ça arrive » — c'est la même famille que la directive jetée après les
// règles, à un aiguillage près.
{
  const r = compileToBPxAST(`${S}signal grain\n-----\nS -> C4 grain\n`);
  ok((r.errors || []).length === 0, '3. la scène doit compiler');
  // ⚠️ LA SONDE A CHANGE DE SECTION le 2026-08-09 : le modulateur se declare desormais avec `var`,
  // et il arrive donc dans `vars`, pas dans la section supprimee avec `cv`. Le SUJET du volet est
  // inchange et c est lui qui compte —  ça compile  n est pas  ça arrive .
  ok((r.ast?.vars || []).some((v) => (v.names || []).includes('grain')),
    `3. le nom déclaré doit ARRIVER dans l'arbre (reçu : ${JSON.stringify((r.ast?.vars || []).flatMap((v) => v.names || []))})`);
  ok(!(r.ast?.directives || []).some((d) => d && d.name === 'var'),
    '3. et il ne doit PAS traîner parmi les directives de scène');
}
{
  const r = compileToBPxAST(`${S}C4:midi\n-----\nS -> C4\n`);
  ok((r.ast?.declarations || []).some((d) => d.name === 'C4' && d.runtime === 'midi'),
    `3. la PROPRIÉTÉ doit arriver dans les déclarations(reçu : ${JSON.stringify(r.ast?.declarations)})`);
}

// ── 4. SOCLE ET ANTI-RÉTRÉCISSEMENT ─────────────────────────────────────────────────────────
// ⛔ LES TÉMOINS DE LA PIERRE TOMBALE SONT PARTIS AVEC ELLE. Ils exigeaient que `gate C4:midi`
// soit REFUSÉ — la forme nue étant morte — et la ligne suivante exigeait le contraire sur la
// MÊME entrée. Deux témoins qui se contredisent tenaient ensemble tant que le premier passait ;
// la règle abrogée, il ne restait qu'une contradiction. Ce qui les remplace éprouve ce qui VIT.
ok(err(`${S}symbol v\n-----\nS -> C4 v\n`).length === 0,
  '4. la déclaration d\'une variable de travail passe — forme unique depuis le 2026-08-18');
ok(err(`${S}C4:midi\n-----\nS -> C4\n`).length === 0,
  '4. TÉMOIN — une propriété posée par le DEUX-POINTS passe, c\'est la règle que ce fichier tient');

if (echecs.length) {
  console.error(`[deux-points tranche] ${echecs.length} FAIL`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[deux-points tranche] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
