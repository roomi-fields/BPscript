#!/usr/bin/env node
/**
 * SENTINELLE — deux signaux que J'ÉMETS ne doivent pas se contredire.
 *
 * ⚠️ LE DÉFAUT, mesuré par BPx à leur entrée le 2026-07-29, sur un même arbre :
 *     `noteTerminals` NE CONTIENT PAS `chain`   → je dis moi-même que ce n'est pas une note
 *     l'élément de flux porte `nature:'sounding'` → je dis qu'il sonne
 * Ils SUIVENT LA NATURE — c'est leur contrat d'opacité, ils portent et ne fabriquent pas. D'où un
 * item qui occupe un temps : chain@0-500, C4 repoussée à 500-1000. À 120 au tempo, un temps entier
 * de musique avalé.
 *
 * ⚠️ ET LE DÉFAUT N'ÉTAIT PAS DANS L'INTENTION — leur mise au point, que je reprends parce qu'elle
 * est juste et que je m'étais accusé de « mauvaise foi » : `noteTerminals` est arrivé APRÈS, la
 * nature venait d'ailleurs, et les deux ont vécu côte à côte SANS QUE RIEN NE LES CONFRONTE.
 * Le défaut était l'ABSENCE D'UN GARDE QUI LES REGARDE ENSEMBLE. C'est ce fichier.
 *
 * POURQUOI UN REGISTRE ET PAS UNE ASSERTION : la réparation demande de NOMMER la nature d'une macro
 * de câblage, et c'est une décision de FORMALISME — Romain a gravé que ni moi ni l'architecte ne la
 * prenons. Exiger dès maintenant l'invariant rendrait ce garde ROUGE en permanence, et un garde
 * toujours rouge apprend à être ignoré. On pose donc un CLIQUET : l'étendue exacte est inscrite, et
 * le garde mord si elle GRANDIT. Le jour où la nature est scellée, l'étendue tombe à zéro et le
 * témoin rougit pour dire de RETIRER l'entrée — pas d'ajuster le nombre.
 *
 * (Méthode empruntée à BPx, qui a épinglé sa moitié le même jour : un constat qu'on note dans un
 * registre se relit quand on y pense ; un constat qu'on épingle VIENT VOUS CHERCHER.)
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { exigerCorpus, toutesLesScenes } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const naturesSonnantes = (n, out = []) => {
  if (!n || typeof n !== 'object') return out;
  if (Array.isArray(n)) { n.forEach((x) => naturesSonnantes(x, out)); return out; }
  if (n.type === 'Symbol' && n.name && n.payload && n.payload.nature === 'sounding') out.push(n.name);
  for (const k of ['voices', 'elements', 'content', 'symbol', 'triggers', 'primary', 'secondaries']) {
    if (n[k]) naturesSonnantes(n[k], out);
  }
  return out;
};

// ── 1. L'INVARIANT — le cliquet est devenu une ASSERTION, et c'est LUI qui me l'a dit ───────
// ⚠️ CE BLOC ÉTAIT UN REGISTRE À CLIQUET. Il inscrivait l'étendue exacte de la contradiction (UNE
// scène, UNE macro) et mordait si elle grandissait — parce que la réparation demandait de NOMMER
// la nature, donc une décision qui n'était pas la mienne.
// Romain me l'a rendue le 2026-07-29 (« l'agent a toujours été autonome là-dessus »), avec la
// frontière : la GRAPHIE est à lui, un NOM INTERNE D'AST ne l'est pas. La nature `wire` est scellée
// à parser.js:680-682, et LE CLIQUET A ROUGI DE LUI-MÊME en disant quoi faire : « ne pas ajuster
// le nombre — c'est la réparation qui est arrivée, retirez l'entrée et transformez-le en
// assertion ». C'est fait, et le mécanisme a fonctionné de bout en bout sans que j'aie à y penser.
const naturesDe = (ast) => {
  const macros = new Map((ast.macros || []).map((m) => [m.name, m]));
  const fautives = [];
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) {
    for (const n of naturesSonnantes(r.rhs || [])) {
      const m = macros.get(n);
      // ⚠️ PÉRIMÈTRE ÉLARGI le 2026-07-29 : « régler un paramètre ne doit pas avoir de durée »
      // (Romain). Le critère n'est plus le câblage strict mais CE QUI AGIT SUR UN MODULE — un
      // corps `Wiring` OU un appel-composant (`Symbol` portant un acteur). J'avais signalé que mon
      // registre était trop étroit SANS l'élargir moi-même ; l'élargissement vient de la décision.
      if (m && (m.body || []).some((b) => b && (b.type === 'Wiring' || (b.type === 'Symbol' && b.actor)))) fautives.push(n);
    }
  }
  return fautives;
};

exigerCorpus();
const fautives = [];
let scenes = 0;
for (const [nom, src] of toutesLesScenes()) {
  let o;
  try { o = compileToBPxAST(src); } catch { continue; }
  if (!o.ast || (o.errors || []).length) continue;
  scenes++;
  for (const n of naturesDe(o.ast)) fautives.push(`${nom.replace(/^.*\//, '')}:${n}`);
}
console.log(`[deux signaux] ${scenes} scènes examinées`);
ok(fautives.length === 0,
  `1. INVARIANT — une macro de CÂBLAGE ne porte JAMAIS la nature 'sounding' : ${fautives.length} `
  + `violation(s) : ${fautives.join(' · ')}. Je publierais alors noteTerminals SANS ce nom ET une `
  + `nature sonnante DESSUS — l'aval suit la nature et lui donne un temps qu'il ne doit pas avoir.`);

// TÉMOIN D'INSTRUMENT — sans lui, un balayage qui ne lirait rien passerait au vert.
ok(scenes > 100, `1. le balayage doit LIRE des scènes — ${scenes}`);
// ⛔ LA NATURE  wire  N EST PLUS PRODUITE le 2026-08-09 : son porteur etait un corps de CABLAGE
// dans une macro, et la directive est supprimee. Le cablage sera entierement refait (Romain), donc
// cette nature reviendra sous une autre forme.
// ⚠️ CE QUE LE VOLET GARDE ENCORE, et qui est son sujet : le BALAYAGE lit bien plus de cent scenes.
// C est le temoin d instrument — sans lui, un balayage qui ne lirait rien passerait au vert.

// ── 2. CE QUI DOIT RESTER VRAI PENDANT L'ATTENTE ────────────────────────────────────────────
// Une macro ORDINAIRE garde sa durée : Romain l'a tranché explicitement (« une macro a TOUJOURS
// une durée, celle de ce qu'elle contient »). Sans ce témoin, une réparation trop large passerait.
{
  const r = compileToBPxAST('@core\n@alphabet.western\n@def motif C4 D4\nS -> motif E4\n');
  const s = naturesSonnantes(r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || []);
  ok(s.includes('motif'),
    '2. SE TAIT — une macro ORDINAIRE garde la nature sonnante : elle a une durée, celle de son contenu');
}
// Et un MODULATEUR invoqué dure aussi — l'enveloppe a sa propre durée (même arbitrage).
ok(compileToBPxAST('@core\n@alphabet.western\n@mod\n@var env1 adsr\nS -> C4 env1\n').errors.length === 0,
  '2. SE TAIT — un modulateur invoqué reste légitime dans le flux');

// ── 3. SOCLE ─────────────────────────────────────────────────────────────────────────────────
// Le registre a disparu avec la réparation : il n'y a plus de dérogation à dater ni à motiver.
// Ce qui reste à garder, c'est que le PÉRIMÈTRE n'a pas débordé — les appels-composants opaques
// (`lpf.cutoff:12000`) ne sont PAS du câblage strict, et savoir s'ils doivent suivre le même sort
// est une question encore chez Romain. Élargir ici trancherait à sa place.
// ⛔ VOLET SUSPENDU le 2026-08-09 : sa PREMIERE moitié mesurait la nature d un REGLAGE porte par
// une macro, et la directive est supprimee — la nature  wire  n est plus produite. Le cablage
// sera entierement refait (Romain), la question reviendra avec lui.
// ⚠️ CE TEMOIN A UNE HISTOIRE QU IL FAUT GARDER : il exigeait l INVERSE une heure avant d etre
// ecrit, parce que la question  un REGLAGE doit-il suivre le sort d un BRANCHEMENT  etait chez
// Romain. Il a tranche —  regler un parametre ne doit pas avoir de duree  — et le temoin a ete
// retourne. Le rallumer sur la forme de cablage a venir demandera de verifier que la reponse
// tient encore : une decision datee ne suit pas automatiquement un changement de graphie.
// ⚠️ SA SECONDE MOITIE, elle, reste VRAIE ET MESURABLE — une definition ordinaire garde la nature
// sonnante, elle a une duree, celle de son contenu. C est la moitie  qui empeche de deborder , et
// la garder seule vaut mieux que suspendre les deux.
{
  const o = compileToBPxAST('@core\n@alphabet.western\n@def motif C4 D4\nS -> motif E4\n');
  const f = (o.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [])[0];
  ok(f?.payload?.nature === 'sounding',
    `3. une définition ORDINAIRE garde 'sounding' — elle a une durée, celle de son contenu `
    + `(reçu : ${JSON.stringify(f?.payload)})`);
}

if (echecs.length) {
  console.error(`[deux signaux] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[deux signaux] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
