#!/usr/bin/env node
/**
 * GARDE — UNE UNITÉ QUE LA DÉCLARATION CONNAÎT VIT DANS LE CHAMP PRÉVU, JAMAIS AILLEURS.
 *
 * ⛔ LE DÉFAUT, MESURÉ LE 2026-08-21 : sur 55 grandeurs, 44 taisaient leur unité dans le champ
 * `unit`, et SIX la portaient quand même — cinq dans le NOM DE L'ARGUMENT (`args(bpm)`,
 * `args(cents)`, `args(keys)`, `args(degrees)`), une dans la PROSE (« en SECONDES »). L'information
 * existait, lisible par un humain, invisible à qui lit le champ.
 *
 * C'EST LE MÊME DÉFAUT QUE CELUI DES IMAGES NATIVES, TROUVÉ LE MÊME JOUR : une donnée rangée là où
 * personne ne va la chercher n'est pas publiée, elle est ENTERRÉE. Un consommateur qui interroge
 * `unit` lit « aucune unité » et affiche un nombre nu ; la prose, elle, ne voyage pas.
 *
 * ⚠️ CE QUE CE GARDE NE DIT PAS : que toute grandeur DOIT porter une unité. Un numéro de canal, un
 * rang de programme, un poids de règle n'en ont pas — ce ne sont pas des grandeurs physiques, et
 * leur en inventer une serait pire que le silence. Il tient une chose plus étroite et vérifiable :
 * quand le nom de l'argument ou la description NOMME une unité connue, le champ la porte aussi.
 *
 * ⚠️ ET LE MOTIF S'EST TROMPÉ D'UNE LETTRE À SA PREMIÈRE ÉCRITURE : `degr[ée]s?` ratait `degrees`,
 * qui prend deux « e » en anglais. Deux entrées tombaient en « aucune trace » et le compte rendu
 * disait trois là où il y en avait cinq. Un motif qui rate une graphie rend un compte trop bas et
 * le fait passer pour une mesure.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { LIBS } = require('../src/transpiler/libs-data.js');

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

/**
 * LES UNITÉS DE COMPTAGE — question ouverte, portée à Romain le 2026-08-21.
 *
 * `degrees` compte des DEGRÉS D'ALPHABET, `keys` des TOUCHES : ce sont des rangs dans une échelle,
 * pas des grandeurs physiques. Leur donner un champ `unit` supposerait que « degré » et « touche »
 * SONT des unités — c'est une décision de vocabulaire, et le vocabulaire du langage appartient à
 * Romain. Ils sont donc nommés ici, un par un, au lieu d'être ni traités ni vus.
 */
const COMPTAGE = new Set(['rotate', 'scaleshift', 'chromashift']);

/**
 * ⛔ CE QUI EXIGERAIT UNE UNITÉ QUI N'EXISTE PAS ENCORE — et j'ai essayé de l'écrire, un garde
 * voisin m'a arrêté. Le vocabulaire des unités est FERMÉ à {Hz, ms, ratio, cents}
 * (`une_unite_ne_s_invente_pas_et_un_jumeau_ne_reste_pas_muet`), et déclarer une unité neuve est un
 * arbitrage de Romain, jamais une conséquence de ma mesure.
 *
 *   time.tempo     args(bpm)       → « BPM » n'est pas dans le vocabulaire
 *   midi.fadeout   « en SECONDES » → « s » non plus, et l'écrire en `ms` changerait la VALEUR :
 *                                     le natif lit `EndFadeOut` en secondes.
 *
 * Ils sont donc nommés ici, avec leur unité manquante, au lieu d'être ni traités ni vus. Le volet 4
 * tient la contrepartie : le jour où l'unité entre au vocabulaire, l'exemption doit tomber.
 */
const UNITE_ABSENTE_DU_VOCABULAIRE = new Map([['tempo', 'BPM'], ['fadeout', 's']]);
const VOCABULAIRE = new Set(['Hz', 'ms', 'ratio', 'cents']);

/** Les unités que je sais reconnaître, avec la graphie attendue dans le champ. */
const CONNUES = [
  [/\bbpm\b/i, 'BPM'], [/\bcents?\b/i, 'cents'], [/\bhz\b/i, 'Hz'],
  [/\bms\b|\bmillisecondes?\b/i, 'ms'], [/\bsecondes?\b/i, 's'],
];

const entrees = [];
const descendre = (n, lib) => {
  if (!n || typeof n !== 'object') return;
  for (const [k, v] of Object.entries(n)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    if (v.description !== undefined || v.args !== undefined) entrees.push({ lib, nom: k, def: v });
    descendre(v, lib);
  }
};
for (const [nl, l] of Object.entries(LIBS)) for (const s of ['controls', 'engine', 'subgrammar']) descendre(l[s], nl);

// ⛔ UN GARDE COMPTE CE QU'IL A EXAMINÉ, et refuse d'avoir examiné zéro.
ok(entrees.length >= 90, `SOCLE : ${entrees.length} entrée(s) lues dans le paquet publié — sous 90, le balayage ne mesure rien`);
const grandeurs = entrees.filter((x) => Array.isArray(x.def.args) && x.def.args.length && !Array.isArray(x.def.values));
ok(grandeurs.length >= 50, `SOCLE : ${grandeurs.length} grandeur(s) — une entrée à argument, hors liste fermée`);
const avecUnite = grandeurs.filter((x) => typeof x.def.unit === 'string' && x.def.unit);
// ⚠️ CE SEUIL A ÉTÉ POSÉ AVANT LA MESURE, ET IL ÉTAIT FAUX. Je l'avais écrit à 14 en comptant deux
// unités que je venais d'écrire — « BPM » et « s » — et qu'un garde voisin m'a fait retirer : elles
// ne sont pas au vocabulaire, et en déclarer une est un arbitrage de Romain. Le compte réel est 13.
// Le seuil est donc à 12 : il attrape une chute d'une seule unité sans casser au premier ajout.
ok(avecUnite.length >= 12, `SOCLE : ${avecUnite.length} grandeur(s) nomment leur unité — sous 12, le champ s'est vidé`);

// ── 1. L'UNITÉ NOMMÉE DANS L'ARGUMENT OU DANS LA PROSE VIT AUSSI DANS LE CHAMP ───────────────
for (const { lib, nom, def } of grandeurs) {
  if (COMPTAGE.has(nom)) continue;
  // ⛔ UNE ENTRÉE QUI PORTE `argType` N'A PAS D'UNITÉ FIXE, ET C'EST LA DONNÉE QUI LE DIT — pas une
  // liste que je tiens à côté. `transpose` accepte trois écritures d'un même intervalle : une
  // fraction (3/2), des cents (700c), un décimal (1.5). L'unité voyage AVEC la valeur, donc lui
  // en figer une dans le champ mentirait sur deux écritures sur trois.
  // Le garde l'a trouvé tout seul en accusant `transpose` : c'est le cas qui a fait écrire ceci.
  if (typeof def.argType === 'string' && def.argType) continue;
  if (UNITE_ABSENTE_DU_VOCABULAIRE.has(nom)) continue;      // l'unité manque au vocabulaire — volet 4
  const ou = (def.args || []).join(' ') + ' ' + String(def.description || '');
  for (const [motif, attendue] of CONNUES) {
    if (!motif.test(ou)) continue;
    ok(typeof def.unit === 'string' && def.unit.length > 0,
       `1. '${lib}.${nom}' NOMME une unité (« ${(ou.match(motif) || [])[0]} ») dans son argument ou sa `
       + `description, et son champ \`unit\` est vide. Un consommateur qui interroge le champ lit `
       + `« aucune unité » et affiche un nombre nu — l'information est là, et elle est ENTERRÉE. `
       + `Attendu quelque chose comme « ${attendue} ».`);
    break;
  }
}

// ── 2. UNE UNITÉ ÉCRITE EST UN SYMBOLE, PAS UNE PHRASE ───────────────────────────────────────
// Un champ qui porterait « en valeurs par seconde » redeviendrait de la prose, dans le champ cette
// fois. Ce qui se lit par une machine tient en quelques caractères.
for (const { lib, nom, def } of grandeurs) {
  if (typeof def.unit !== 'string' || !def.unit) continue;
  ok(def.unit.length <= 12 && !/\s\s|\ben\b/i.test(def.unit),
     `2. '${lib}.${nom}' : l'unité s'écrit en symbole — reçu ${JSON.stringify(def.unit)}`);
}

// ── 3. LE COMPLÉMENT NE RANCIT PAS ───────────────────────────────────────────────────────────
// Une entrée inscrite parmi les comptages doit exister, et doit encore porter le mot qui l'y a
// mise. Sans ça l'exemption survit à son motif et couvre autre chose.
for (const nom of COMPTAGE) {
  const x = grandeurs.find((g) => g.nom === nom);
  ok(!!x, `3. '${nom}' est inscrit parmi les unités de comptage mais n'est plus une grandeur déclarée — RETIRER la ligne`);
  if (x) {
    ok(/degrees|keys/i.test((x.def.args || []).join(' ')),
       `3. '${nom}' est inscrit comme comptage, et son argument ne compte plus rien — reçu args(${(x.def.args || []).join(', ')})`);
    ok(!(typeof x.def.unit === 'string' && x.def.unit),
       `3. '${nom}' porte maintenant une unité (${JSON.stringify(x.def.unit)}) — la question de Romain est `
       + `donc tranchée : le RETIRER de la liste des comptages, sinon l'exemption cache une décision rendue`);
  }
}

// ── 4. L'ATTENTE D'UNE UNITÉ NE SURVIT PAS À SON ARRIVÉE ─────────────────────────────────────
// Le jour où Romain fait entrer « BPM » ou « s » au vocabulaire, l'exemption ci-dessus cesse d'être
// une attente et devient un trou. Ce volet la fait tomber toute seule — sinon elle vieillirait en
// silence, et le mot resterait muet alors que plus rien ne l'y oblige.
for (const [nom, manquante] of UNITE_ABSENTE_DU_VOCABULAIRE) {
  const x = grandeurs.find((g) => g.nom === nom);
  ok(!!x, `4. '${nom}' attend une unité mais n'est plus une grandeur déclarée — RETIRER la ligne`);
  ok(!VOCABULAIRE.has(manquante),
     `4. « ${manquante} » est ENTRÉE au vocabulaire des unités : '${nom}' n'a plus de raison de se `
     + `taire. Lui poser son unité et le RETIRER de la liste d'attente.`);
  if (x) {
    ok(!(typeof x.def.unit === 'string' && x.def.unit),
       `4. '${nom}' porte maintenant l'unité ${JSON.stringify(x.def.unit)} — le RETIRER de la liste `
       + `d'attente, sinon l'exemption cache une décision rendue`);
  }
}

if (e.length) { console.error(`[unités] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[unités] ${p} PASS / 0 FAIL — ${p} assertion(s) · ${grandeurs.length} grandeurs, `
          + `${avecUnite.length} nomment leur unité, ${COMPTAGE.size} comptages en question`);
