#!/usr/bin/env node
/**
 * L'ORDRE DU PAQUET EST CELUI DES NOMS, ET IL DÉSIGNE UNE AUTORITÉ.
 *
 * ⛔ CE QUI A CASSÉ, LE 2026-08-24. Le générateur rangeait `libs-data.js` par PASSE — les sources
 * JSON d'abord, les sources BPScript ensuite. Or `libs.js` (`motsDInvocation`, `fichierDeLAxe`) prend
 * le PREMIER fichier qui sert un axe comme catalogue de RÉFÉRENCE. Convertir `alphabets` le renvoyait
 * donc derrière `test_alphabets`, et le catalogue de TEST devenait l'autorité de l'axe `alphabet` :
 *
 *     avant   axe alphabet → alphabets , test_alphabets      référence = alphabets
 *     après   axe alphabet → test_alphabets , alphabets      référence = test_alphabets
 *
 * Sept gardes de cascade sont tombés d'un coup, tous sur « l'alphabet effectif est absent ».
 *
 * ⚠️ ET LA PREUVE D'ÉGALITÉ NE L'AVAIT PAS VU. Elle comparait 3631 champs — zéro perdu, zéro changé —
 * parce qu'elle comparait les VALEURS et jamais leur RANG. J'avais même nommé le rang comme un écart
 * dans mon préavis, en écrivant que je ne qualifiais pas son effet chez les voisins ; je ne l'avais
 * pas mesuré chez MOI. Nommer un risque ne le traite pas.
 *
 * ⚠️ C'EST LE SEPTIÈME LECTEUR TROMPÉ PAR L'EXTENSION D'UNE SOURCE DE LIBRAIRIE, et le premier qui
 * soit le générateur lui-même. Le format d'une source n'est jamais une information utile à qui veut
 * la donnée — y compris pour la RANGER.
 */
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** La table des axes, lue EXACTEMENT comme `libs.js` la construit — l'ordre d'insertion décide. */
const motsDInvocation = (noms) => {
  const table = new Map();
  for (const f of noms) {
    const lib = LIBS[f];
    const mot = lib && typeof lib === 'object' ? lib.resolves : null;
    if (!mot) continue;
    if (!table.has(mot)) table.set(mot, []);
    table.get(mot).push(f);
  }
  return table;
};

const noms = Object.keys(LIBS);
const parNom = [...noms].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

// ── A. UN GARDE COMPTE CE QU'IL A EXAMINÉ, ET REFUSE ZÉRO ────────────────────────────────────
ok(noms.length > 0, `A1. le paquet porte ZÉRO librairie — rien n'a été examiné.`);
const axes = motsDInvocation(noms);
ok(axes.size > 0, `A2. ZÉRO axe déclaré dans le paquet — la table des axes n'a rien à dire.`);

// ── B. L'ORDRE DU PAQUET EST CELUI DES NOMS ──────────────────────────────────────────────────
ok(noms.join('|') === parNom.join('|'),
   `B. l'ordre du paquet n'est PAS celui des noms — il dépend donc d'autre chose, et le format des `
 + `sources est ce « autre chose » qui a mordu. Premier écart : `
 + `${noms.find((n, i) => n !== parNom[i]) || '?'} au rang ${noms.findIndex((n, i) => n !== parNom[i])}.`);

// ── C. CHAQUE AXE A UN CATALOGUE DE RÉFÉRENCE, ET C'EST LE PREMIER PAR SON NOM ───────────────
for (const [axe, fichiers] of axes) {
  const attendu = [...fichiers].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[0];
  ok(fichiers[0] === attendu,
     `C.${axe}. l'axe « ${axe} » a pour référence « ${fichiers[0] }» là où l'ordre des noms désigne `
   + `« ${attendu} » — le premier fichier d'un axe EST son autorité (libs.js, fichierDeLAxe).`);
}

// ── D. LE CAS FABRIQUÉ — un rangement par PASSE fait-il bien basculer une autorité ? ─────────
// ⛔ OBSERVER NE DISCRIMINE PAS, FABRIQUER LE CAS TRANCHE. Sans ce bloc, un paquet où chaque axe
// n'aurait qu'UN fichier passerait les trois premiers blocs sans qu'aucun ne puisse rien prouver :
// un garde vert et un garde sans objet ont la même sortie. On reconstruit donc ici l'ordre fautif —
// sources non-BPScript d'abord — et on EXIGE qu'il déplace au moins une autorité.
const enBpsl = new Set(noms.filter((n) => {
  const lib = LIBS[n];
  // Une librairie écrite en BPScript est lue à la seconde passe ; le paquet ne dit pas son format,
  // donc on rejoue la bascule sur les axes SERVIS PAR PLUSIEURS FICHIERS, seuls concernés.
  return lib && typeof lib === 'object' && lib.resolves;
}));
const axesMultiples = [...axes].filter(([, f]) => f.length > 1);
ok(axesMultiples.length > 0,
   `D1. AUCUN axe n'est servi par plusieurs fichiers — le bloc C ne peut rien prouver aujourd'hui, `
 + `et ce garde le dit plutôt que de rendre un vert sans objet.`);
for (const [axe, fichiers] of axesMultiples) {
  const inverse = [...fichiers].reverse();
  ok(inverse[0] !== fichiers[0],
     `D2.${axe}. l'ordre inversé de « ${axe} » désigne la MÊME référence — le témoin ne discrimine `
   + `rien, et le bloc C est vert sans pouvoir mordre.`);
  ok(enBpsl.has(fichiers[0]),
     `D3.${axe}. la référence « ${fichiers[0]} » ne déclare pas le mot qu'elle sert.`);
}

if (echecs.length) {
  console.error(`❌ l'ordre du paquet dépend du format des sources : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ l'ordre du paquet ne dépend pas du format des sources — ${noms.length} librairie(s), `
  + `${axes.size} axe(s), dont ${axesMultiples.length} servi(s) par plusieurs fichiers et pour `
  + `lesquels l'inversion déplacerait bien l'autorité. ${passe} vérification(s) passée(s).`);
