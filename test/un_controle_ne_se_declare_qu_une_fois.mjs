#!/usr/bin/env node
/**
 * GARDE — un contrôle se déclare dans UNE SEULE librairie, et le chargeur REFUSE le second.
 *
 * POURQUOI CE GARDE EXISTE. Le destinataire d'un réglage n'est écrit nulle part sur le réglage :
 * il se lit sur la librairie qui le déclare (`resolvedBy` — `engine`→BPx, `midi`→runtime-MIDI,
 * `transpo`→Kairos, `audio`→runtime-audio, `expression`→toutes les sorties). Une clé déclarée dans
 * deux librairies porte donc DEUX destinataires, et le chargeur tranchait en silence : `ctx.controls`
 * est un objet, le dernier fichier chargé écrasait l'autre, et l'ORDRE DE CHARGEMENT devenait la
 * décision. Rien en aval ne peut voir ce choix — le réglage part au mauvais outil sans erreur.
 *
 * LA MÊME CONFISCATION PAR L'AUTRE PORTE : une scène qui nomme un contrôleur (`@cc <nom>:<n>`)
 * ajoute un nom au vocabulaire depuis la SCÈNE. S'il porte un nom déjà déclaré par une librairie,
 * il l'écrasait pareillement, et la scène perdait le contrôle d'origine sans un signe.
 *
 * CE QUE LE GARDE MESURE, EN MATRICE, JAMAIS SUR UNE LISTE DE NOMS :
 *   1. le chargeur avale le registre ENTIER — toutes les librairies, toutes leurs sections
 *      (`controls`, `engine`, `subgrammar` de portée flux, `groups.*`) — sans refuser ;
 *   2. il REFUSE une seconde déclaration venue d'une autre librairie ;
 *   3. il REFUSE un `@cc` qui reprend un nom du vocabulaire ;
 *   4. il se TAIT quand la même directive est écrite deux fois (même fichier, même section :
 *      ni deux définitions, ni deux destinataires) ;
 *   5. il se TAIT sur un nom neuf.
 *
 * L'injection porte sur l'ACCUSÉ (le chargeur réel, registre fabriqué) puis sur le JUGE (la
 * comparaison de provenance rejouée à part) — les deux doivent rougir.
 */
import { loadLibsFromDirectives, registerLib, universeControlNames } from '../src/transpiler/libs.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const refuse = (fn, motif, quoi) => {
  try { fn(); echecs.push(`${quoi} — AUCUN refus (le chargeur a accepté)`); }
  catch (e) {
    if (motif.test(e.message)) passe++;
    else echecs.push(`${quoi} — refus au mauvais motif : ${e.message.slice(0, 120)}`);
  }
};

// ─── 0. Témoin anti-rétrécissement — le registre n'est pas vide et porte des contrôles ────────
const toutesLesLibs = Object.keys(LIBS);
ok(toutesLesLibs.length >= 20, `0. le registre doit porter au moins 20 librairies (reçu ${toutesLesLibs.length})`);
ok(universeControlNames().size >= 60,
   `0. l'univers doit porter au moins 60 contrôles (reçu ${universeControlNames().size})`);

// ─── 1. LA MATRICE — le registre ENTIER passe le chargeur, toutes sections confondues ────────
// Charger toutes les librairies à la fois est exactement le cas où deux déclarations du même nom
// se rencontrent. Aucune liste de noms n'est écrite ici : le sujet est le registre tel qu'il est.
try {
  const ctx = loadLibsFromDirectives(toutesLesLibs.map((name) => ({ name })));
  ok(Object.keys(ctx.controls).length >= 60,
     `1. le chargeur doit rendre au moins 60 contrôles (reçu ${Object.keys(ctx.controls).length})`);
} catch (e) {
  echecs.push(`1. le registre RÉEL porte une double déclaration : ${e.message.slice(0, 200)}`);
}

// ─── 2. INJECTION DANS L'ACCUSÉ — une seconde déclaration, dans une autre librairie ──────────
// On reprend un nom réellement déclaré, sans l'écrire en dur : le premier de l'univers.
const nomExistant = [...universeControlNames()][0];
registerLib('_faux_doublon', {
  name: '_faux_doublon', resolvedBy: 'un-autre-outil',
  controls: { [nomExistant]: { args: ['value'], description: 'doublon injecté' } },
});
refuse(() => loadLibsFromDirectives([...toutesLesLibs, '_faux_doublon'].map((name) => ({ name }))),
       /déclaré DEUX FOIS/,
       `2. (mord) '${nomExistant}' déclaré une seconde fois dans une autre librairie`);

// ─── 3. INJECTION — un `@cc` qui confisque un nom du vocabulaire ─────────────────────────────
refuse(() => loadLibsFromDirectives([
         ...toutesLesLibs.map((name) => ({ name })),
         { name: 'cc', ccMappings: [{ name: nomExistant, number: 98 }] },
       ]),
       /déclaré DEUX FOIS/,
       `3. (mord) '@cc ${nomExistant}' reprend un nom déjà déclaré par une librairie`);

// ─── 4. LE COMPLÉMENT — la même directive écrite deux fois ne dit rien de contradictoire ─────
try {
  loadLibsFromDirectives([...toutesLesLibs, ...toutesLesLibs].map((name) => ({ name })));
  passe++;
} catch (e) {
  echecs.push(`4. (se tait) une directive écrite deux fois ne doit PAS être refusée : ${e.message.slice(0, 150)}`);
}

// ─── 5. LE COMPLÉMENT — un nom neuf entre sans un mot ────────────────────────────────────────
registerLib('_faux_neuf', {
  name: '_faux_neuf', resolvedBy: 'un-autre-outil',
  controls: { zz_nom_qui_n_existe_nulle_part: { args: ['value'], description: 'neuf' } },
});
try {
  const ctx = loadLibsFromDirectives([...toutesLesLibs, '_faux_neuf'].map((name) => ({ name })));
  ok(ctx.controlNames.has('zz_nom_qui_n_existe_nulle_part'),
     '5. (se tait) un nom neuf doit entrer au vocabulaire');
} catch (e) {
  echecs.push(`5. (se tait) un nom neuf ne doit PAS être refusé : ${e.message.slice(0, 150)}`);
}

// ─── 6. INJECTION DANS LE JUGE — la comparaison de provenance, rejouée isolée ────────────────
// Le chargeur ne doit pas être le seul témoin de sa propre règle : la comparaison qu'il applique
// est rejouée sur des provenances FABRIQUÉES, pour prouver qu'elle distingue bien « deux origines »
// de « la même origine deux fois ».
const juger = (couples) => {
  const vu = new Map();
  for (const [nom, origine] of couples) {
    if (vu.has(nom) && vu.get(nom) !== origine) return `${nom}: ${vu.get(nom)} vs ${origine}`;
    vu.set(nom, origine);
  }
  return null;
};
ok(juger([['vel', 'A'], ['vel', 'B']]) !== null, '6. (mord) le juge doit voir deux origines pour un nom');
ok(juger([['vel', 'A'], ['vel', 'A']]) === null, '6. (se tait) la même origine deux fois n\'est pas un doublon');
ok(juger([['vel', 'A'], ['pan', 'B']]) === null, '6. (se tait) deux noms distincts ne sont pas un doublon');

if (echecs.length) {
  console.error(`❌ double déclaration de contrôle : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ un contrôle ne se déclare qu'une fois, et le chargeur refuse le second — ${passe} vérification(s) passée(s)`);
}
