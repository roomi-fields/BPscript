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
require('../src/transpiler/index.js');
const LIBS = require('../src/transpiler/libs.js').leRegistre();

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

/**
 * LES COMPTAGES — ⛔ QUESTION TRANCHÉE PAR ROMAIN LE 2026-08-22, ET ELLE NE SE ROUVRE PAS.
 *
 * « Le degré et la touche N'ENTRENT PAS au vocabulaire. Un degré d'alphabet est un RANG, pas une
 * grandeur — `args(degrees)` dit déjà ce qu'il compte. »
 *
 * `degrees` compte des DEGRÉS D'ALPHABET, `keys` des TOUCHES : des rangs dans une échelle, jamais
 * des grandeurs physiques. Leur champ d'unité reste VIDE, et c'est un état, pas un oubli — c'est le
 * NOM DE L'ARGUMENT qui porte l'information, et il la porte entièrement.
 *
 * ⚠️ CE VOLET NE LES SURVEILLE PLUS COMME UNE DETTE, IL LES TIENT COMME UNE RÈGLE : le jour où l'un
 * d'eux se met à porter une unité, c'est LUI qui rougit. La liste n'est donc pas une exemption qui
 * s'oublie, c'est le lieu où la décision s'applique.
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
// ⛔ LA MAP EST VIDE DEPUIS LE 2026-08-22, ET C EST LE VOLET QUI L A VIDEE, PAS MA MAIN. `bpm` et
// `s` sont entrés au vocabulaire sur GO de Romain ; `tempo` et `fadeout` portent désormais leur
// unité, donc plus aucune attente ne les couvre. Le volet 4 exige que chaque entrée de cette map
// rougisse encore : celle qui a cessé de rougir sort, datée. Les deux sont sorties ensemble.
// ⚠️ ELLE RESTE, VIDE, ET CE N EST PAS UN OUBLI : le jour où une unité connue se cache de nouveau
// dans un nom d argument sans pouvoir entrer au vocabulaire, c est ici qu elle s inscrit avec sa
// cause. Une map supprimée ferait disparaître le mécanisme avec ses deux cas.
const UNITE_ABSENTE_DU_VOCABULAIRE = new Map([]);
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

// ⛔ UN GARDE COMPTE CE QU'IL A EXAMINÉ, et refuse d'avoir examiné ZÉRO — le mot est dans la règle,
// et ces deux seuils gardaient un INVENTAIRE : 144 entrées pour un seuil de 90, 55 grandeurs pour un
// seuil de 50. Cinq grandeurs retirées de la donnée faisaient rougir le second sur un geste ordinaire.
//
// ⚠️ ET ILS SONT DEUX LIGNES AU-DESSUS DE CELUI QUE JE VENAIS DE RÉPARER. Kairos a payé le même
// mouvement dans la même nuit — « réparer le site rendu par l'instrument, jamais son voisinage » —
// et c'est ma propre règle de garde, retournée contre mes propres bancs : on répare l'ESPACE où le
// défaut peut vivre, pas l'endroit où il s'est montré.
ok(entrees.length > 0, `SOCLE : AUCUNE entrée lue dans le paquet publié — le balayage ne mesure rien`);
const grandeurs = entrees.filter((x) => Array.isArray(x.def.args) && x.def.args.length && !Array.isArray(x.def.values));
ok(grandeurs.length > 0, `SOCLE : AUCUNE grandeur — une entrée à argument, hors liste fermée`);
const avecUnite = grandeurs.filter((x) => typeof x.def.unit === 'string' && x.def.unit);
// ⛔ CE SEUIL ÉTAIT À 12 ET IL ÉTAIT FAUX DANS LES DEUX SENS — mesuré le 2026-08-24 après que
// bp3-frontend et Kairos aient cherché la même forme chez eux.
//
// Son commentaire promettait d'« attraper une chute d'une seule unité » à partir d'un compte de 13.
// La donnée en porte 15 aujourd'hui : retirer DEUX unités passait donc sans un mot, et son message
// disait « le champ s'est vidé » pendant qu'il gardait un inventaire.
//
// ⚠️ DEUX PROPOS VIVAIENT DANS UNE SEULE ASSERTION : « pas vide » — impérissable — et « pas de
// chute » — qui se périme à chaque retrait légitime. Kairos l'a formulé le mieux : un tel seuil ne
// tient ni le propos qu'il annonce ni l'inventaire qu'il verrouille, et il ne mord qu'au SECOND
// retrait avec un message qui parle du premier.
//
// ⇒ LE PROPOS TENABLE EST « PAS VIDE ». Une unité qui sort de la donnée est un geste, pas un défaut
// — vingt-neuf clés de prose sont sorties cette nuit. Le seuil devient une INCLUSION, la réparation
// que Kairos a payée deux fois sur le même banc.
ok(avecUnite.length > 0, `SOCLE : aucune grandeur ne nomme son unité — le champ a disparu de la donnée`);

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
       `1. '${lib}.${nom}' NOMME une unité(« ${(ou.match(motif) || [])[0]} ») dans son argument ou sa `
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
// mise. Sans ça la règle survit à son motif et couvre autre chose.
// ⛔ ET DEPUIS LE 2026-08-22 CE N'EST PLUS UNE EXEMPTION : la décision est rendue, donc ce volet
// APPLIQUE une règle au lieu de garder une dette. Un comptage qui se mettrait à porter une unité
// contredirait Romain, et c'est ce que le troisième test dit maintenant.
for (const nom of COMPTAGE) {
  const x = grandeurs.find((g) => g.nom === nom);
  ok(!!x, `3. '${nom}' est inscrit parmi les unités de comptage mais n'est plus une grandeur déclarée — RETIRER la ligne`);
  if (x) {
    ok(/degrees|keys/i.test((x.def.args || []).join(' ')),
       `3. '${nom}' est inscrit comme comptage, et son argument ne compte plus rien — reçu args(${(x.def.args || []).join(', ')})`);
    ok(!(typeof x.def.unit === 'string' && x.def.unit),
       `3. ⛔ '${nom}' porte une unité(${JSON.stringify(x.def.unit)}), et la décision de Romain du `
       + `2026-08-22 dit l'inverse : « le degré et la touche N'ENTRENT PAS — un degré d'alphabet est `
       + `un RANG, pas une grandeur ». Son champ d'unité doit rester VIDE, et c'est \`args(`
       + `${(x.def.args || []).join(', ')})\` qui porte l'information.`);
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
          + `${avecUnite.length} nomment leur unité, ${COMPTAGE.size} comptages sans unité — décision rendue`);
