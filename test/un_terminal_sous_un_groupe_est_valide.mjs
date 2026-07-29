#!/usr/bin/env node
/**
 * GARDE — un terminal inconnu est refusé PARTOUT, y compris sous un nœud composite.
 *
 * ⚠️ LE TROU, ET IL A VÉCU LONGTEMPS : le validateur de terminaux ne lisait que le PREMIER NIVEAU
 * du membre droit. Mesure du 2026-07-29, sous alphabet occidental :
 *   `motif -> zzz` REFUSÉ · `motif -> a b` REFUSÉ · `motif -> {a a b b}` ZÉRO ERREUR.
 *
 * ⚠️ QUATRIÈME FOIS QUE JE PAIE CETTE FAMILLE, et je l'avais inscrite trois fois : « descendre
 * jusqu'aux FEUILLES — compter les voisins de surface ne voit pas ce qui vit sous un nœud
 * composite ». Je l'avais réparée dans la garde des sacs, dans celle de la correspondance, dans
 * celle du point d'attente — et jamais re-balayée dans le validateur le plus central de tous.
 * Une règle appliquée ailleurs ne protège pas l'endroit qu'on n'a pas regardé.
 *
 * CE QUE LE TROU COÛTAIT, ET C'EST PIRE QUE LUI-MÊME : tant qu'il était ouvert, aucune scène à
 * groupes ne pouvait être migrée sur la foi d'un « zéro erreur » — le compilateur disait oui à
 * tout. Une scène de la bibliothèque a été déclarée MIGRÉE le matin même sur ce vert-là
 * (`Mozartexpression`, huit noms de solfège cachés). Formule de bpx, reprise telle quelle :
 * UN VERT QUI NE MESURE PAS CE QU'ON CROIT EST PIRE QU'UN ROUGE.
 *
 * ⚠️ CE GARDE PORTE SUR L'ESPACE DES CONTENANTS, PAS SUR LE GROUPE QUI S'EST MONTRÉ. Le
 * signalement venait d'un groupe polymétrique ; le produit croisé ci-dessous éprouve TOUTES les
 * formes qui peuvent contenir un symbole, et chacune dans les deux sens.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const err = (src) => {
  try { return (compileToBPxAST(src).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};
const S = '@core\n@controls\n@alphabet.western:midi\n@trigger s1:midi\n@mode:ord\n';

// ── 1. LA MATRICE — chaque CONTENANT × (inconnu refusé / connu accepté) ─────────────────────
// `%s` reçoit le terminal. Les formes viennent de ce que le parser produit, pas de mon souvenir.
const CONTENANTS = [
  ['nu, au premier niveau',            'motif -> %s'],
  ['groupe polymétrique',              'motif -> {%s}'],
  ['groupe, entouré de notes',         'motif -> C4 {%s} D4'],
  ['groupe IMBRIQUÉ',                  'motif -> {C4 {%s D4}}'],
  ['voix parallèle d\'un groupe',      'motif -> {C4, %s}'],
  ['événement simultané',              'motif -> C4!%s'],
  ['note ancrée à un point d\'attente', 'motif -> {%s<!s1}'],
  ['groupe avec durée collée',         'motif -> {%s C4}:2'],
  ['groupe avec sac moteur',           'motif -> {%s C4}[weight:2]'],
];
console.log(`[terminal sous un groupe] ${CONTENANTS.length} contenants x 2 sens`);
for (const [quoi, forme] of CONTENANTS) {
  // INCONNU → doit être REFUSÉ, et le refus doit NOMMER le terminal.
  const e = err(S + forme.replace('%s', 'zzz') + '\nS -> motif\n');
  ok(e.some((m) => /terminal 'zzz' non déclaré/.test(m)),
    `1. ${quoi} : un terminal inconnu doit être REFUSÉ et NOMMÉ (reçu : ${e[0] ?? 'rien'})`);
  // CONNU → doit PASSER. Sans cette moitié, un validateur qui refuserait tout aurait l'air juste.
  ok(err(S + forme.replace('%s', 'C4') + '\nS -> motif\n').length === 0,
    `1. ${quoi} : une NOTE au même endroit doit passer — c'est la moitié qu'on casse`);
}

// ── 2. CE QUI N'EST PAS UN TERMINAL NE DOIT PAS ÊTRE ACCUSÉ ─────────────────────────────────
// Un validateur qui descend voit des nœuds que le premier niveau lui cachait : il doit continuer
// de distinguer ce qui est un terminal de ce qui n'en est pas un.
ok(err('@core\n@alphabet.western\n@var travail\nmotif -> {travail C4}\nS -> motif\n').length === 0,
  '2. une VARIABLE DE TRAVAIL sous un groupe n\'est pas un terminal inconnu');
ok(err('@core\n@alphabet.western\nmotif -> {sous C4}\nsous -> D4\nS -> motif\n').length === 0,
  '2. un NON-TERMINAL sous un groupe non plus');
ok(err('@core\n@actor viz  eval.hydra\nmotif -> {viz.`osc(4).out()`}\nS -> motif\n').length === 0,
  '2. un BLOC DE CODE sous un groupe non plus — une voix-code a un vocabulaire arbitraire');
ok(err('@core\n@alphabet.western\nmotif -> {- _ C4}\nS -> motif\n').length === 0,
  '2. un SILENCE et une PROLONGATION sous un groupe non plus');

// ── 3. SOCLE ET ANTI-RÉTRÉCISSEMENT ─────────────────────────────────────────────────────────
ok(CONTENANTS.length >= 9, `3. la matrice ne s'est pas vidée — ${CONTENANTS.length} contenants`);
ok(err(S + 'motif -> {zzz}\nS -> motif\n').length >= 1,
  '3. TÉMOIN — la descente doit MORDRE (c\'est le cas exact qui a vécu des mois)');
ok(err(S + 'motif -> {C4}\nS -> motif\n').length === 0,
  '3. TÉMOIN — et se TAIRE (sinon elle refuserait tout, et mordrait aussi)');

if (echecs.length) {
  console.error(`[terminal sous un groupe] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[terminal sous un groupe] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
