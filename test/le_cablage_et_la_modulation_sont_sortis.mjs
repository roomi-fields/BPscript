#!/usr/bin/env node
/**
 * GARDE — LE CÂBLAGE ET LA MODULATION SONT SORTIS DU LANGAGE.
 *
 * Décision Romain, 2026-08-18 :
 * `hub/decisions/2026-08-18-la-modulation-et-le-cablage-sortent-du-langage.md`.
 *
 * ⛔ CE QUE CE GARDE REMPLACE, ET POURQUOI LES DEUX QU'IL REMPLACE NE GARDAIENT RIEN. Deux bancs
 * éprouvaient ces mécanismes. Tous deux s'ouvraient sur un drapeau en dur qui les faisait SORTIR
 * AVANT leur première assertion, en affichant « SUSPENDU ». Ils comptaient donc ZÉRO, et le
 * portillon les lisait verts. L'un affirmait même en commentaire que « les 135 vérifications qui
 * précèdent tournent toujours » — un commentaire se relit comme une preuve, et celui-là était faux.
 * Un garde qui peut se sauter doit ÉCHOUER, jamais avertir.
 *
 * ⛔ ET CE GARDE NE TIENT PAS UNE FORME, IL TIENT UN ESPACE. Un mécanisme s'écrit à toutes les
 * places où le parser lit un élément, pas à celle où on l'a vu la dernière fois. La matrice
 * énumère donc les places ; ajouter une place les éprouve toutes.
 *
 * ⛔ LE CRITÈRE EST LE TÉMOIN, PAS LE MESSAGE. Un mot retiré se refuse EXACTEMENT comme un mot
 * inventé (Romain, 2026-08-18 : pas de message dédié, pas de renvoi). Ce qui l'établit est donc la
 * COMPARAISON à un mot qui n'a jamais existé — un refus lu seul ne prouve rien, et un refus qui
 * donnerait une réécriture PUBLIERAIT la forme qu'il nomme.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const T = 'core\nalphabet.western\n';
function mesure(src) {
  try {
    const r = compileToBPxAST(src);
    return { erreurs: (r.errors || []).map((e) => e.message ?? String(e)), ast: r.ast };
  } catch (e) {
    return { erreurs: [String(e.message ?? e)], ast: null };
  }
}

// ── 1. TOUTES LES PLACES OÙ LE BRANCHEMENT POUVAIT S'ÉCRIRE ─────────────────────────────────
// Les quatre premières sont les portes de tête ; les suivantes sont les endroits du FLUX où un
// élément se lit — c'est là que la lecture s'était propagée, un site à la fois.
const PLACES_DU_BRANCHEMENT = [
  ['en tête de scène',                 `${T}wire saw >> lpf >> audio\n-----\nS -> C4\n`],
  ['dans l\'état de départ',           `${T}init saw1 >> lpf1\n-----\nS -> C4\n`],
  ['dans un corps nommé',              `${T}macro lead saw >> lpf\n-----\nS -> C4\n`],
  ['par la directive de correspondance', `${T}map saw lpf\n-----\nS -> C4\n`],
  ['seul dans le flux',                `${T}-----\nS -> C4 !osc >> filtre D4\n`],
  ['en tête de règle',                 `${T}-----\nS -> !osc >> audio\n`],
  ['avec un port',                     `${T}-----\nS -> C4 !pot >> tempo.bpm D4\n`],
  ['avec un port et une valeur',       `${T}-----\nS -> C4 !pot >> tempo.bpm: 120 D4\n`],
  ['deux branchements enchaînés',      `${T}-----\nS -> C4 !a >> b !c >> d D4\n`],
  ['après un accord',                  `${T}-----\nS -> C4 !E4 !osc >> filtre D4\n`],
  ['après un silence',                 `${T}-----\nS -> - !osc >> filtre D4\n`],
  ['dans une voix polymétrique',       `${T}-----\nS -> {C4 !osc >> filtre, D4}\n`],
];

// La COUPURE porte son propre signe : n'en guetter qu'un laisse l'autre passer par une autre
// porte. Elle s'éprouve donc aux mêmes places, séparément.
const PLACES_DE_LA_COUPURE = [
  ['en tête de scène',      `${T}wire saw \\>> audio\n-----\nS -> C4\n`],
  ['dans un corps nommé',   `${T}macro mute \\>> out.in\n-----\nS -> C4\n`],
  ['seule dans le flux',    `${T}-----\nS -> C4 !\\>> out.in D4\n`],
  ['en milieu de chaîne',   `${T}-----\nS -> C4 !a >> b \\>> c D4\n`],
  ['en tête de règle',      `${T}-----\nS -> !\\>> out.in\n`],
];

// ── 2. TOUTES LES PLACES OÙ LA MODULATION POUVAIT S'ÉCRIRE ──────────────────────────────────
const PLACES_DE_LA_MODULATION = [
  ['modulateur nommé, forme déclarative', `${T}cv env1 mod.adsr(attack:5)\n-----\nS -> C4\n`],
  ['modulateur en tête, sans nom',        `${T}mod.adsr(attack:5)\n-----\nS -> C4\n`],
  ['modulateur dans l\'état de départ',   `${T}init mod.lfo(rate:2)\n-----\nS -> C4\n`],
  ['modulateur dans un corps nommé',      `${T}macro m mod.adsr(attack:5)\n-----\nS -> C4\n`],
];

const TOUTES = [
  ...PLACES_DU_BRANCHEMENT.map(([q, s]) => ['branchement — ' + q, s]),
  ...PLACES_DE_LA_COUPURE.map(([q, s]) => ['coupure — ' + q, s]),
  ...PLACES_DE_LA_MODULATION.map(([q, s]) => ['modulation — ' + q, s]),
];

console.log(`[câblage sorti] ${TOUTES.length} places × 3 propriétés + le témoin du mot inventé`);

for (const [quoi, src] of TOUTES) {
  const { erreurs, ast } = mesure(src);
  ok(erreurs.length >= 1, `1. ${quoi} — doit être REFUSÉ`);
  // ⛔ LE SUCCÈS S'ÉTABLIT PAR L'ABSENCE D'ERREUR, jamais par la présence d'un arbre : un refus
  // rend désormais un arbre non nul. C'est l'erreur qui prouve le refus, pas `ast === null`.
  const msg = erreurs.join(' ');
  ok(!/>>|\\>>/.test(msg),
    `1. ${quoi} — le refus ne doit PAS écrire le signe sorti : un message est le troisième `
    + `domicile d'une forme retirée (reçu : ${erreurs[0]?.slice(0, 120)})`);
  ok(!/mod\.|modulateur|FaustX|FauxtX/i.test(msg),
    `1. ${quoi} — le refus ne doit nommer NI le mécanisme retiré, NI ce qui le remplacera `
    + `(reçu : ${erreurs[0]?.slice(0, 120)})`);
}

// ── 3. LE TÉMOIN QUI TRANCHE — un mot retiré se refuse COMME un mot inventé ─────────────────
// ⛔ CE TÉMOIN EST LE SEUL QUI DISCRIMINE. Lire un refus et le trouver « générique » est un
// jugement ; comparer deux refus est une mesure. Le mot inventé n'a jamais existé : si le mot
// retiré rend le même message au mot près, il est débranché — sinon le parser le reconnaît encore.
for (const mot of ['wire', 'map', 'mod', 'macro', 'cv']) {
  const retire = mesure(`${T}${mot} alpha beta\n-----\nS -> C4\n`).erreurs.join(' ');
  const invente = mesure(`${T}zorglubinvente alpha beta\n-----\nS -> C4\n`).erreurs.join(' ');
  const sansPosition = (m) => m.replace(/at line \d+:\d+/g, '').trim();
  ok(sansPosition(retire) === sansPosition(invente) && retire.length > 0,
    `3. '${mot}' doit se refuser EXACTEMENT comme un mot inventé, à la position près.\n`
    + `      retiré  : ${retire.slice(0, 150)}\n      inventé : ${invente.slice(0, 150)}`);
}

// ── 4. LE NŒUD N'EXISTE PLUS DANS L'ARBRE — mesuré sur ce que le compilateur ÉMET ───────────
// Un nœud peut cesser d'être ATTEIGNABLE tout en restant produit par une autre porte. On balaie
// donc la sérialisation d'une scène riche, pas seulement le membre droit d'une règle.
{
  const { ast, erreurs } = mesure(`${T}def ouvre (vel:120)\ninit\n  \`sc: x\`\n-----\n`
    + `M -> $ C4 D4\nS -> C4 !(cutoff:400) D4 {E4, F4} &M\n`);
  ok(erreurs.length === 0, `4. TÉMOIN NON NUL — la scène de contrôle doit compiler `
    + `(reçu : ${erreurs[0]?.slice(0, 140)})`);
  const serialise = JSON.stringify(ast ?? {});
  ok(!serialise.includes('"Wiring"'), '4. aucun nœud de branchement dans l\'arbre émis');
  ok(!serialise.includes('"wire"'), '4. aucune nature de branchement dans l\'arbre émis');
  ok(!serialise.includes('"wires"'), '4. aucun champ de branchement à la racine de la scène');
}

// ── 5. LES TÉMOINS NON NULS — CE QUE LA DÉCISION GARDE EXPRESSÉMENT ─────────────────────────
// ⛔ SANS EUX, UN RETRAIT TROP LARGE A EXACTEMENT LA MÊME TÊTE QU'UN RETRAIT JUSTE. La décision
// nomme ce qui reste : le sac de flux pose une valeur, les gabarits gardent leurs deux signes.
// ⚠️ CETTE LISTE A ÉTÉ MESURÉE, PAS RECOPIÉE. Cinq de mes premiers témoins, repris du garde que
// celui-ci remplace, étaient FAUX : ils écrivaient une valeur de membre derrière un nom défini et
// un crochet posé dans le flux — deux graphies que le langage a perdues depuis. Un témoin faux
// rougit pour la mauvaise raison et fait chercher un défaut là où il n'y en a pas.
const CE_QUI_RESTE = [
  ['le sac de flux pose une valeur',        `${T}-----\nS -> C4 !(cutoff:400) D4\n`],
  ['un sac de flux à deux entrées',         `${T}-----\nS -> C4 !(cutoff:400, vel:80) D4\n`],
  ['la définition nommée',                  `${T}def ouvre (vel:120)\n-----\nS -> C4\n`],
  ['l\'état de départ — le code lancé',     `${T}init\n  \`sc: x\`\n-----\nS -> C4\n`],
  ['l\'état de départ — les valeurs',       `${T}init\n  (vel:100)\n-----\nS -> C4\n`],
  ['le gabarit capture et rejoue',          `${T}-----\nM -> $ C4 D4\nS -> &M G4\n`],
  ['l\'accord collé',                       `${T}-----\nS -> C4!E4 D4\n`],
  ['l\'accord espacé',                      `${T}-----\nS -> C4 !E4 D4\n`],
  ['l\'accord à deux secondaires',          `${T}-----\nS -> C4!E4!G4 D4\n`],
  ['l\'objet hors-temps',                   `${T}-----\nS -> !f D4\n`],
  ['le changement de vitesse dans le flux', `${T}-----\nS -> C4 ! (/2) D4\n`],
  ['la voix polymétrique',                  `${T}-----\nS -> {C4 D4, E4}\n`],
];
for (const [quoi, src] of CE_QUI_RESTE) {
  const { erreurs } = mesure(src);
  ok(erreurs.length === 0,
    `5. TÉMOIN NON NUL — ${quoi} doit COMPILER (reçu : ${erreurs[0]?.slice(0, 140)})`);
}

// ── 6. TÉMOINS ANTI-RÉTRÉCISSEMENT ──────────────────────────────────────────────────────────
// Un garde qui a examiné zéro cas ressemble trait pour trait à un garde vert.
ok(PLACES_DU_BRANCHEMENT.length >= 12, '6. la matrice du branchement ne s\'est pas vidée');
ok(PLACES_DE_LA_COUPURE.length >= 5, '6. la matrice de la coupure ne s\'est pas vidée');
ok(PLACES_DE_LA_MODULATION.length >= 4, '6. la matrice de la modulation ne s\'est pas vidée');
ok(CE_QUI_RESTE.length >= 12, '6. la liste de ce qui reste ne s\'est pas vidée');
ok(passe > 60, `6. le garde doit avoir EXAMINÉ, pas seulement tourné (${passe} assertions)`);

if (echecs.length) {
  console.error(`[câblage sorti] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[câblage sorti] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
