#!/usr/bin/env node
/**
 * GARDE DE L'OUTIL DE MIGRATION — c'est l'endroit où une erreur coûterait le plus cher.
 *
 * Cet outil va tourner sur des dépôts qui ne sont pas le mien, sur des scènes qui servent de
 * MESURE DE CONFORMITÉ au moteur natif. S'il renomme mal, il ne casse rien de visible : il produit
 * une pièce différente, en silence, et la campagne de conformité diverge — on lirait ça comme un
 * bug moteur pendant des jours. Un outil de migration non gardé est le pire endroit pour une
 * approximation.
 *
 * CE QU'IL VÉRIFIE, en matrice : sur des scènes fabriquées dont on SAIT ce qui doit arriver.
 *   · qu'il TROUVE une collision quand elle existe ;
 *   · qu'il n'en INVENTE pas quand un nom ressemble à une note d'une AUTRE convention ;
 *   · qu'il RENOMME tous les usages, jamais un préfixe (`A` ne doit pas toucher `A4`) ;
 *   · qu'il REFUSE quand il ne peut pas prouver la production identique ;
 *   · qu'il laisse tranquille ce qui pose une PROPRIÉTÉ sur un nom existant (`gate Sa:sc`).
 */
import { chargerMoteur, collisions, renommer, migrerSource, terminauxActifs } from './migration_noms.mjs';
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

if (!await chargerMoteur()) {
  console.error("[outil migration] dist BPx introuvable : `npm run build` côté BPx.");
  console.error("Ce n'est PAS un défaut de l'outil — mais sans moteur il ne peut rien prouver,");
  console.error("et le laisser passer vert ici reviendrait à verdir sans avoir rien examiné.");
  process.exit(1);
}

// ── 1. TROUVER, ET NE PAS INVENTER ───────────────────────────────────────────
// L'espace : la convention active × ce à quoi le nom ressemble.
const DETECTION = [
  ['occidental, tête nommée comme une note',      '@core\n@alphabet.western\nG4 -> C4 D4', 1],
  ['sargam, tête nommée comme une note',          '@core\n@alphabet.sargam\nsa -> re ga', 1],
  ['occidental, tête d\'allure SARGAM',           '@core\n@alphabet.western\npa1 -> C4 D4', 0],
  ['sargam, tête d\'allure OCCIDENTALE',          '@core\n@alphabet.sargam\nG4 -> sa re', 0],
  ['occidental, tête sans rapport',               '@core\n@alphabet.western\nmotif -> C4 D4', 0],
  ['macro nommée comme une note',                 '@core\n@alphabet.western\n@macro C4 saw >> audio\nS -> D4', 1],
];
console.log(`[outil migration] détection : ${DETECTION.length} cas`);
for (const [nom, src, attendu] of DETECTION) {
  const { ast } = compileToBPxAST(src);
  ok(!!ast, `${nom} — la scène d'essai doit compiler`);
  ok(ast ? collisions(ast).size === attendu : false,
    `${nom} — doit trouver ${attendu} collision(s), pas ${ast ? collisions(ast).size : '?'}`);
}

// ── 2. LE RENOMMAGE NE MORD PAS SUR LES VOISINS ──────────────────────────────
// C'est L'erreur qui transforme une note en autre chose, et elle ne se voit pas à la relecture.
const VOISINS = [
  ['A ne touche pas A4',        'S -> A A4 A',       'A', 'A_r', 'S -> A_r A4 A_r'],
  ['A ne touche pas Ab',        'S -> A Ab',         'A', 'A_r', 'S -> A_r Ab'],
  ['A ne touche pas _A',        'S -> A _A',         'A', 'A_r', 'S -> A_r _A'],
  ['A en début de ligne',       'A -> A A',          'A', 'A_r', 'A_r -> A_r A_r'],
  ['sa ne touche pas sa4',      'S -> sa sa4',       'sa', 'sa_r', 'S -> sa_r sa4'],
  ['un nom ne touche pas son préfixé', 'S -> re rega', 're', 're_r', 'S -> re_r rega'],
];
console.log(`[outil migration] renommage : ${VOISINS.length} cas`);
for (const [nom, avant, de, vers, attendu] of VOISINS) {
  ok(renommer(avant, de, vers) === attendu,
    `${nom} — attendu « ${attendu} », obtenu « ${renommer(avant, de, vers)} »`);
}

// ── 3. LE VERDICT DE BOUT EN BOUT ────────────────────────────────────────────
// Une scène où le renommage est sûr doit passer AVEC preuve de production identique ; une scène
// sans collision ne doit rien changer ; une déclaration qui pose une propriété sur un nom existant
// ne doit RIEN déclencher.
const SCENE_A_MIGRER = '@core\n@alphabet.western\nS -> A B\nA -> C4 D4\nB -> E4 A4';
{
  const r = migrerSource(SCENE_A_MIGRER);
  ok(r.ok === true, '3. une scène migrable doit être acceptée');
  ok(!r.aucunChangement, '3. et elle doit avoir des renommages');
  ok((r.renommages || []).some((x) => x.de === 'A' && x.vers === 'A_r'), '3. la tête A doit être renommée');
  ok((r.renommages || []).some((x) => x.de === 'B'), '3. la tête B aussi');
  // La preuve qui compte : le nom renommé n'a pas mordu sur la NOTE A4.
  ok(/A4/.test(r.source || '') && !/A_r4/.test(r.source || ''),
    '3. la note A4 doit être INTACTE après renommage — c\'est le piège du lot');
  ok(collisions(compileToBPxAST(r.source).ast).size === 0, '3. zéro collision restante');
}
{
  const r = migrerSource('@core\n@alphabet.western\nS -> motif\nmotif -> C4 D4');
  ok(r.ok && r.aucunChangement, '3. une scène sans collision ne doit rien changer');
}
{
  // `gate Sa:sc` pose une PROPRIÉTÉ sur un nom existant — ratifié Romain 2026-07-28. Ce témoin
  // garde la distinction : elle ne crée pas de nom rival, donc l'outil ne doit rien y toucher.
  const r = migrerSource('@core\n@alphabet.western\ngate C4:midi\nS -> C4 D4');
  ok(r.ok && r.aucunChangement,
    '3. une déclaration qui pose une PROPRIÉTÉ sur un nom existant ne doit RIEN déclencher');
}
{
  // Une scène illisible est HORS SUJET, pas refusée : un outil qui sort en erreur pour une raison
  // qui n'est pas la sienne apprend à son propriétaire à ignorer son code de sortie.
  const r = migrerSource('ceci n est pas une scène \\ du tout');
  ok(r.ok && r.horsSujet, '3. une scène qui ne compile pas est HORS SUJET, pas refusée');
}

// ── 3bis. LE COMPARATEUR SAIT-IL VOIR UNE DIFFÉRENCE ? ───────────────────────
// ⚠️ CE BLOC EXISTE PARCE QU'UNE INJECTION N'A RIEN FAIT ROUGIR. J'avais débranché la comparaison
// de production — le cœur de sécurité de l'outil, ce qui l'empêche d'écrire quand la musique
// change — et les 29 assertions restaient vertes. Toutes les scènes d'essai renommaient
// correctement, donc aucune ne pouvait révéler que le juge était absent.
// Un garde qui ne teste que des cas qui réussissent ne garde pas le juge, il garde l'accusé.
// On vérifie donc ici la seule chose dont dépend le refus d'écrire : le comparateur DISCRIMINE.
// S'il rendait une constante, il déclarerait « production identique » sur n'importe quel
// renommage, y compris celui qui change la pièce.
{
  const { production } = await import('./migration_noms.mjs');
  const a1 = production('@core\n@alphabet.western\nS -> C4 D4');
  const a2 = production('@core\n@alphabet.western\nS -> C4 D4 E4');
  const a3 = production('@core\n@alphabet.western\nS -> C4 D4');
  ok(!a1.erreur && !a2.erreur, '3bis. les deux productions témoins doivent se dériver');
  ok(a1.jetons !== a2.jetons, '3bis. le comparateur doit VOIR deux pièces différentes');
  ok(a1.jetons === a3.jetons, '3bis. et rendre identiques deux pièces identiques');
  ok((a1.jetons || '').length > 0, '3bis. et il doit produire quelque chose, pas du vide');
}
{
  // Et la propriété de bout en bout : une source dont la production DIFFÉRERAIT doit être refusée.
  // On la fabrique en renommant à moitié — le cas exact du piège annoncé par l'architecte.
  const { production } = await import('./migration_noms.mjs');
  const complet = '@core\n@alphabet.western\nS -> A B\nA -> C4 D4\nB -> E4 A4';
  const moitie  = '@core\n@alphabet.western\nS -> A_r B\nA -> C4 D4\nB -> E4 A4';  // la tête n'est plus atteinte
  const p1 = production(complet), p2 = production(moitie);
  ok(p1.jetons !== p2.jetons || !!p2.erreur,
    '3bis. un renommage À MOITIÉ doit se voir — production différente ou scène refusée');
}

// ── 4. TÉMOIN ANTI-RÉTRÉCISSEMENT ────────────────────────────────────────────
ok(DETECTION.length >= 6 && VOISINS.length >= 6, '4. les matrices ne se sont pas vidées');
{
  // Et que l'outil sait encore VOIR : sans ce témoin, une régression qui viderait la détection
  // rendrait « aucune collision partout » et tout ce fichier passerait au vert.
  const { ast } = compileToBPxAST('@core\n@alphabet.western\nG4 -> C4');
  ok(terminauxActifs(ast).size > 100, '4. l\'alphabet occidental doit rendre ses terminaux (témoin d\'instrument)');
}

if (echecs.length) {
  console.error(`[outil migration] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[outil migration] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
