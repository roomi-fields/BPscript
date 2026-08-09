#!/usr/bin/env node
/**
 * GARDE — L'AST SORT COMPLET. Une scène qui se tait HÉRITE ; elle ne sort jamais à vide.
 *
 * ⚠️ CE QUI A ÉTÉ PAYÉ (Romain, 2026-07-29). Une scène qui ne déclarait aucune convention de notes
 * sortait de chez moi avec un ensemble de terminaux VIDE — 91 scènes sur 263. Tout ce qui demande
 * « est-ce une note ? » se taisait dessus : la règle d'unicité des noms comme le refus d'un
 * terminal inconnu. Je l'avais présenté comme « la convention perdue à la conversion » ; Romain a
 * tranché que c'est faux, et son verdict tient en une phrase : « ça ne devrait JAMAIS ARRIVER ».
 * Il a ajouté ce qui compte pour l'aval : « même si BPScript est en erreur, Kanopi ne devrait pas
 * rajouter une couche de valeurs par défaut — son rôle c'est uniquement d'ASSEMBLER ».
 *
 * LE PRINCIPE ÉTAIT DÉJÀ RATIFIÉ ET DATÉ : `docs/design/SCENE_DEFAULTS_CASCADE.md` (2026-07-04),
 * « un paramètre définissable n'est jamais inexistant ». Son étape 2 n'avait jamais été faite.
 * Le défaut n'était donc pas une question ouverte — c'était un contrat signé et non tenu.
 *
 * ⚠️ POURQUOI LA PARTIE 3 EST LA VRAIE GARDE, ET PAS LA MATRICE. Une matrice d'exemples prouve que
 * mes huit cas marchent ; elle ne dit RIEN de l'espace. Le balayage du corpus, lui, prend TOUTES
 * les scènes, relève celles dont l'alphabet sort absent, et exige que CHACUNE soit une absence
 * LÉGITIME et nommée. Une nouvelle scène qui retomberait dans le trou rougit sans que personne
 * n'ait à y penser — et c'est la seule forme de règle qui tienne (architecte 2026-07-27 : une
 * règle qui exige qu'on y pense au bon moment n'est pas une règle, c'est une intention).
 *
 * DEUX ABSENCES SONT LÉGITIMES, et elles seules :
 *   · la HAUTEUR OPAQUE (loi 35) — la scène invoque une identité de hauteur par le canal neutre,
 *     BPScript ne peut pas la résoudre, Kairos la remplit. Poser le socle @core par-dessus serait
 *     le bug diapason du 2026-07-04 à l'envers ;
 *   · la VOIX-CODE — un acteur `eval.X` porte du code étranger, pas un vocabulaire de notes.
 *     Lui donner un alphabet inventerait des notes là où il n'y en a aucune.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';
import { exigerCorpus, toutesLesScenes } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compiler = (src) => {
  const r = compileToBPxAST(src);
  return { ast: r.ast, erreurs: (r.errors || []).map((e) => e.message ?? String(e)) };
};
const acteur = (ast) => (ast && ast.actors && ast.actors[0]) || null;
const propriete = (ast, k) => (acteur(ast)?.properties || {})[k];
const reference = (ast, cat) => (acteur(ast)?.references || []).find((r) => r.category === cat)?.name;

// ── 0. SOCLE — sans la donnée, ce garde serait creux et vert ─────────────────────────────────
const SOCLE_CORE = LIBS['core']?.defaults?.components || {};
ok(SOCLE_CORE.alphabet === 'western',
  `0. @core doit porter l'alphabet de socle en DONNÉE (lu : ${JSON.stringify(SOCLE_CORE)})`);

// ── 1. LA MATRICE — situations × propriétés ─────────────────────────────────────────────────
// Une SITUATION dit ce que la scène déclare ; l'attendu dit ce que l'AST doit porter.
// `null` = la valeur doit être ABSENTE, et l'absence est alors une VALEUR, pas un trou.
const SITUATIONS = [
  ['scène nue : elle hérite du socle @core',
   '@core\nS -> C4 D4', { alphabet: 'western', octaves: 'western', tuning: 'western_12TET' }],
  ['la scène déclare son alphabet : il gagne sur le socle',
   '@core\n@alphabet.sargam\nS -> sa re', { alphabet: 'sargam', octaves: 'saptak', tuning: 'sargam_12TET' }],
  // Un alphabet SANS registres : l'absence est le sens (« notes nues »), pas un défaut à combler.
  ['un alphabet sans registres reste sans registres (tabla : 39 frappes nues)',
   '@core\n@alphabet.tabla\nS -> dha', { alphabet: 'tabla', octaves: null, tuning: null }],
  ['la scène déclare des registres : ils gagnent sur ceux de l\'alphabet',
   '@core\n@alphabet.sargam\n@octaves.saptak\nS -> madhya_sa', { alphabet: 'sargam', octaves: 'saptak', tuning: 'sargam_12TET' }],
  ['un acteur déclaré porte les siens',
   '@core\n@actor voix\n  alphabet.sargam\n  out.audio\nS -> voix.sa', { alphabet: 'sargam', octaves: 'saptak', tuning: 'sargam_12TET' }],
  // Les deux SEULES absences légitimes.
  ['hauteur OPAQUE : l\'alphabet reste ABSENT, Kairos le remplit (loi 35)',
   '@core\n@mine.perso.gamme\nS -> C4', { alphabet: null, octaves: null, tuning: null }],
  ['invocation par le canal NEUTRE : ABSENT aussi — le socle ne recouvre jamais un composant invoqué',
   '@core\n@test_alphabets.abc\nS -> a b', { alphabet: null, octaves: null, tuning: null }],
  ['une VOIX-CODE n\'a pas de vocabulaire de notes : ABSENT',
   '@core\n@actor viz  eval.hydra\nS -> voix\nvoix -> viz.`osc(4).out()`', { alphabet: null, octaves: null, tuning: null }],
  // ⚠️ L'ACCORDAGE vient de l'ALPHABET, jamais du socle @core (Romain 2026-07-29). J'avais laissé
  // cet axe à vide sur 230 scènes en refusant de poser western_12TET sur du sargam — le refus
  // était juste, et la réponse est que je n'ai jamais à le poser : l'alphabet le déclare.
  ['un alphabet non occidental porte SON accordage, pas celui du socle',
   '@core\n@alphabet.gamelan_pelog\nS -> nem', { alphabet: 'gamelan_pelog', octaves: null, tuning: 'gamelan_pelog' }],
  ['la scène peut surcharger l\'accordage de l\'alphabet',
   '@core\n@alphabet.western\n@tuning.western_just\nS -> C4', { alphabet: 'western', octaves: 'western', tuning: 'western_just' }],
];
const PROPRIETES = [
  ['la scène compile', (o) => o.erreurs.length === 0],
  ['l\'alphabet effectif est porté', (o, a) => propriete(o.ast, 'alphabet') === (a.alphabet ?? undefined)],
  ['les registres effectifs sont portés', (o, a) => propriete(o.ast, 'octaves') === (a.octaves ?? undefined)],
  ['l\'accordage effectif est porté', (o, a) => propriete(o.ast, 'tuning') === (a.tuning ?? undefined)],
  // Une propriété sans sa référence, c'est une moitié de matérialisation : mesuré chez BPx, son
  // lecteur d'alphabet regarde `properties` D'ABORD et `references[]` seulement à défaut — les
  // deux doivent dire la même chose, sinon le désaccord se règle chez le consommateur.
  ['la référence d\'alphabet dit la même chose que la propriété',
   (o, a) => reference(o.ast, 'alphabet') === (a.alphabet ?? undefined)],
];
console.log(`[ast complet] matrice ${SITUATIONS.length} situations × ${PROPRIETES.length} propriétés`);
for (const [quoi, src, attendu] of SITUATIONS) {
  const o = compiler(src);
  for (const [prop, verif] of PROPRIETES) {
    ok(verif(o, attendu), `1. ${quoi} — ${prop} (reçu : ${JSON.stringify(acteur(o.ast)?.properties)} · ${o.erreurs.slice(0, 1)})`);
  }
}

// ── 2. TÉMOINS DES DEUX SENS — la cascade doit MORDRE et se TAIRE ───────────────────────────
// Sans le premier, une régression qui remettrait l'alphabet à vide laisserait tout ce fichier au
// vert. Sans le second, une cascade qui refuserait tout aurait l'air juste.
const refusUnicite = (src) => compiler(src).erreurs.filter((m) => /TERMINAL de l'alphabet actif/.test(m));
// ⚠️ LE SUJET DU TÉMOIN A CHANGÉ le 2026-08-07 ET SA FONCTION EST INTACTE. Il prouvait que
// l'alphabet est bien résolu dans une scène NUE en montrant qu'une TÊTE DE RÈGLE nommée comme une
// note était refusée — devenu une forme légitime (décision `2026-08-03-une-tete-de-regle-peut-
// etre-un-terminal`). Ce qu'il faut prouver ici n'est pas ce refus-là : c'est que le vocabulaire
// EXISTE. Une DÉCLARATION qui heurte un terminal le prouve aussi bien, et elle, elle n'a jamais
// été levée — la règle d'unicité tient pour ce qui CRÉE un nom.
ok(refusUnicite('@core\n@def G4 C4 D4\nS -> C4').length >= 1,
  '2. MORD — dans une scène NUE, une DÉCLARATION nommée comme une note est refusée : la preuve que '
  + "l'alphabet du socle est bien descendu (sans lui, il n'y a rien à heurter)");
ok(refusUnicite('@core\n@def grondement saw >> audio\nS -> C4').length === 0,
  '2. SE TAIT — la même scène nue accepte une déclaration au nom quelconque');
ok(refusUnicite('@core\n@mine.perso.gamme\nG4 -> C4').length === 0,
  '2. SE TAIT — hauteur opaque : aucun vocabulaire connu ici, donc rien à heurter');

// ── 3. LE BALAYAGE — l'ESPACE, pas mes exemples ─────────────────────────────────────────────
// Toute scène dont l'alphabet sort ABSENT doit l'être pour une raison NOMMÉE. Sinon, le trou est
// revenu quelque part et personne ne l'a vu.
exigerCorpus();
// ⚠️ TOUTES les scènes de la bibliothèque, pas le seul dossier des converties : les voix de code
// vivent ailleurs, et un balayage qui les rate verdit sur une famille qu'il n'a jamais vue.
const sources = [...toutesLesScenes()];
const DEMOS = new URL('../public/demos/', import.meta.url);
const marcher = (dir, prefixe) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) marcher(new URL(`${e.name}/`, dir), `${prefixe}${e.name}/`);
    else if (e.name.endsWith('.bps')) sources.push([`${prefixe}${e.name}`, readFileSync(new URL(e.name, dir), 'utf8')]);
  }
};
if (existsSync(DEMOS)) marcher(DEMOS, 'demo:');
ok(sources.length > 100, `3. il faut de quoi mesurer — ${sources.length} source(s)`);

const sansRaison = [];
// ⚠️ ET LE MÊME BALAYAGE POUR L'ACCORDAGE, sur l'ESPACE : tout acteur dont l'alphabet DÉCLARE un
// accordage doit le porter. Une matrice prouve mes deux exemples ; seul le balayage dit que la
// famille est fermée. C'est aussi lui qui rendrait visible un alphabet ajouté sans accordage.
const accordageManquant = [];
let avecAlphabet = 0, opaques = 0, voixCode = 0, avecAccordage = 0;
for (const [nom, src] of sources) {
  let o;
  try { o = compiler(src); } catch { continue; }
  if (!o.ast) continue;
  const acteurs = o.ast.actors || [];
  for (const a of acteurs) {
    const alpha = (a.properties || {}).alphabet;
    if (alpha) {
      avecAlphabet++;
      const declare = LIBS['alphabets']?.[alpha]?.tuning;
      if (declare) {
        if ((a.properties || {}).tuning) avecAccordage++;
        else accordageManquant.push(`${nom} → acteur '${a.name}' (alphabet ${alpha} déclare ${declare})`);
      }
      continue;
    }
    if ((a.properties || {}).eval) { voixCode++; continue; }                 // voix-code : légitime
    if ((o.ast.libRefs || []).length) { opaques++; continue; }               // hauteur opaque : légitime
    sansRaison.push(`${nom} → acteur '${a.name}'`);
  }
}
console.log(`[ast complet] ${sources.length} scènes · ${avecAlphabet} acteur(s) avec alphabet · `
  + `${voixCode} voix-code · ${opaques} hauteur opaque · ${avecAccordage} avec accordage · `
  + `${sansRaison.length} SANS RAISON`);
ok(accordageManquant.length === 0,
  `3. tout alphabet qui DÉCLARE un accordage doit le voir porté — ${accordageManquant.length} manquant(s) : ${accordageManquant.slice(0, 4).join(' · ')}`);
ok(avecAccordage > 50, `3. le balayage doit VOIR des accordages résolus — ${avecAccordage}`);
ok(sansRaison.length === 0,
  `3. aucun acteur ne doit sortir sans alphabet SANS RAISON — ${sansRaison.length} : ${sansRaison.slice(0, 6).join(' · ')}`);
// Anti-rétrécissement : si ce balayage cessait de trouver des acteurs, il verdirait sans rien voir.
ok(avecAlphabet > 100, `3. le balayage doit VOIR des acteurs alphabétisés — ${avecAlphabet}`);
ok(SITUATIONS.length >= 10 && PROPRIETES.length >= 5, '3. la matrice ne s\'est pas vidée');

if (echecs.length) {
  console.error(`[ast complet] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[ast complet] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
