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
import '../src/transpiler/index.js';
import { leRegistre, fichierDeLAxe } from '../src/transpiler/libs.js';
const LIBS = leRegistre();

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/**
 * ⛔ CE QUI EST GARDÉ A CHANGÉ DE PLACE LE 2026-09-04, PAS DE NATURE. Ce garde exigeait que le
 * PAQUET soit rangé par nom : c'était vrai du bundle, dont le générateur triait. Le bundle est
 * sorti (Romain : « ça sort ») et le registre s'ordonne par passes de dépendances — donc l'ordre
 * brut n'est plus la propriété à tenir.
 *
 * ⇒ CE QU'IL FALLAIT VRAIMENT TENIR, et que le tri du générateur donnait par ricochet : **l'autorité
 *   d'un axe ne dépend d'aucun ordre d'arrivée**. Elle est désormais posée là où elle se décide —
 *   `libs.js:motsDInvocation` trie ses fichiers — et c'est ÇA que ce garde éprouve.
 * ⚠️ Le volet C ne bouge pas d'une ligne : il vérifiait déjà que le catalogue de référence de chaque
 *   axe est le premier PAR SON NOM. C'est lui qui mord si le tri disparaît, à n'importe quel étage.
 */

/** La table des axes, lue EXACTEMENT comme `libs.js` la construit — le TRI décide, plus l'insertion. */
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
{
  // L'autorité que le REGISTRE sert, contre celle qu'un ordre PAR NOM servirait. Les deux doivent
  // dire la même chose : sinon un ordre d'arrivée décide encore de qui fait autorité.
  // ⛔⛔ OBSERVER NE DISCRIMINE PAS — IL FAUT FABRIQUER LE CAS. Deux écritures de ce volet sont
  //   restées VERTES sous injection, le tri retiré de `libs.js` : la première recalculait la table
  //   ici même (elle éprouvait sa propre arithmétique — un banc qui appelle sa propre porte prouve
  //   la porte, jamais le branchement) ; la seconde appelait bien `fichierDeLAxe`, mais l'état
  //   ACTUEL du registre donne le bon résultat des deux façons — `alphabets` y arrive au rang 9,
  //   `test_alphabets` au rang 19. Le tri ne change rien AUJOURD'HUI, et un garde qui regarde
  //   aujourd'hui ne peut pas voir ce qui protège demain.
  //
  // ⇒ On fabrique donc l'état où la question se POSE : un registre où le catalogue de TEST arrive
  //   avant celui de référence. C'est l'état exact du 2026-08-24, celui qui a coûté sept gardes de
  //   cascade. `fichierDeLAxe` doit rendre `alphabets` quand même — sinon un ordre d'arrivée décide
  //   encore de l'autorité, et il suffira qu'une source gagne une dépendance pour que ça bascule.
  const parLeNom = motsDInvocation(parNom);
  ok(parLeNom.size >= 15,
     `B-socle. ${parLeNom.size} axe(s) lus — sous ce seuil, ce volet ne mesure plus rien.`);
  const partages = [...parLeNom.entries()].filter(([, f]) => f.length > 1);
  ok(partages.length > 0,
     `B-socle. AUCUN axe n'est servi par deux catalogues — l'ordre ne peut alors rien décider, et la `
   + `fabrication ci-dessous ne prouve rien. Le cas existait le 2026-08-24 (alphabets/test_alphabets).`);

  const registre = leRegistre();
  const original = Object.keys(registre);
  const inverse = [...original].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const copie = Object.fromEntries(original.map((k) => [k, registre[k]]));
  for (const [axe, fichiers] of partages) {
    const attendu = [...fichiers].sort()[0];
    for (const k of original) delete registre[k];
    for (const k of inverse) registre[k] = copie[k];
    let rendu;
    try { rendu = fichierDeLAxe(axe); } finally {
      for (const k of inverse) delete registre[k];
      for (const k of original) registre[k] = copie[k];
    }
    ok(rendu === attendu,
       `B. ⛔ l'axe « ${axe} » change d'AUTORITÉ quand l'ordre d'arrivée s'inverse : ${rendu} au lieu `
     + `de ${attendu}. L'ordre de chargement suit les dépendances et bouge sans prévenir ; l'autorité, `
     + `non. Le tri se pose dans 'libs.js:motsDInvocation', là où l'autorité se DÉCIDE.`);
  }
  ok(Object.keys(registre).join('|') === original.join('|'),
     `B. et le registre doit être RENDU intact après la fabrication — sinon ce garde en casse d'autres.`)
;
}

// ── C. CHAQUE AXE A UN CATALOGUE DE RÉFÉRENCE, ET C'EST LE PREMIER PAR SON NOM ───────────────
for (const [axe, fichiers] of axes) {
  const attendu = [...fichiers].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[0];
  ok(fichiers[0] === attendu,
     `C.${axe}. l'axe « ${axe} » a pour référence « ${fichiers[0] }» là où l'ordre des noms désigne `
   + `« ${attendu} » — le premier fichier d'un axe EST son autorité(libs.js, fichierDeLAxe).`);
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
