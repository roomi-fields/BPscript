#!/usr/bin/env node
/**
 * ON NE SPÉCIFIE QUE CE QUI EST PRÉSENT — aucune librairie n'écrit un champ à NUL.
 *
 * ⛔ DÉCISION DE ROMAIN, 2026-08-08 : « on ne spécifie que ce qui est présent. Les champs à nul
 * sortent. » Transmise le jour même à BPx et à l'architecte.
 *
 * **CE QUE LA DISTINCTION VEUT DIRE**, dans la formulation de Kairos, qui est la plus claire :
 * un champ **ABSENT** dit « rien n'a été déclaré ». Un champ à **NUL** AFFIRME quelque chose —
 * « cette collection a un accordage, et cet accordage est rien ». Ce n'est pas ce qu'on veut dire,
 * et personne ne le lit ainsi.
 *
 * ⚠️ CE QUE ÇA A COÛTÉ LE JOUR MÊME, et c'est pourquoi ce garde balaie TOUT `lib/` et pas seulement
 * l'endroit où le défaut s'est montré. Mon reformatage des alphabets écrivait l'accordage à nul
 * explicite là où l'ancien champ était ABSENT. La comparaison stricte de Kairos prenait ce nul pour
 * une valeur DÉCLARÉE : elle court-circuitait sa branche sans-hauteur et faisait jeter sur les
 * quatre alphabets de percussion. **La différence ne se voyait pas dans une comparaison de noms de
 * clés** — les deux formats avaient exactement les mêmes clés.
 * Pire : ma donnée appliquait DEUX RÉGIMES à la fois, `baseNote` absent et `tuning` à nul sur les
 * MÊMES quatre collections. Sa comparaison n'était pas trop raide ; ma donnée disait deux choses.
 *
 * **L'ARGUMENT QUI PORTE AU-DELÀ DU CAS**, et il est de Kairos aussi : une fois que nul veut dire
 * « non déclaré », plus personne ne peut exprimer « déclaré vide » le jour où ça signifiera quelque
 * chose. **On perd une distinction pour toujours, et en silence.**
 *
 * ⚠️ CE QUI N'EST PAS UN NUL, pour qu'on ne le corrige pas par excès de zèle : un booléen à FAUX
 * AFFIRME, et c'est parfois voulu. `resolvesPitch: false` est écrit exprès — « un alphabet de
 * frappes n'en resout aucune, et l'ecrire evite qu'on lui en invente une » (`LANGUAGE.md:878`).
 * Une chaîne vide et un tableau vide affirment de même. Ce garde ne refuse QUE le nul.
 *
 * ⚠️ ET IL A TROUVÉ AUTRE CHOSE QU'UN NUL EN BALAYANT, ce qui est la raison de balayer : le
 * tempérament `bp3_meantone1` porte CINQ ratios sur cinq à `NaN/NaN` — le seul sur 174, référencé
 * nulle part. Le nul n'en était que le symptôme visible ; l'entrée est corrompue. Signalé à
 * l'architecte pour routage, PAS corrigé ici : le contenu appartient à qui le spécifie, la forme
 * seule est ma part.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();
import path from 'node:path';

const LIB = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'lib');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** Tous les chemins d'un objet dont la valeur est NUL, en descendant jusqu'aux feuilles. */
function cheminsNuls(valeur, prefixe = '') {
  const trouves = [];
  if (!valeur || typeof valeur !== 'object') return trouves;
  for (const [cle, v] of Object.entries(valeur)) {
    const ici = prefixe ? `${prefixe}.${cle}` : cle;
    if (v === null) trouves.push(ici);
    else if (typeof v === 'object') trouves.push(...cheminsNuls(v, ici));
  }
  return trouves;
}

// ── A. AUCUNE LIBRAIRIE N'ÉCRIT UN NUL ──────────────────────────────────────────────────────
// ⚠️ La portée est L'ESPACE — tous les fichiers de données — et non les alphabets, où le défaut
// s'est montré. Une garde écrite pour l'endroit du ticket laisse vivre la même faute à côté.
// ⛔ CE GARDE ÉNUMÉRAIT `lib/` PAR EXTENSION, ET IL EST DEVENU AVEUGLE À UNE BASCULE. Le
// 2026-08-23, quatre catalogues sont passés de JSON à `.bpsl` : il n'en lisait plus que 9 sur 13,
// et seul son socle l'a dit. « Le format d'un fichier n'est pas une information utile à qui veut la
// donnée » — un lecteur qui range par extension continue sur moins de données, et son portillon
// reste vert tant qu'un socle ne le rattrape pas. Cinq lecteurs s'y sont pris le même jour.
// ⇒ LA PORTE EST LE BUNDLE : il rend la même donnée quel que soit le format de la source, et une
//   bascule ne le regarde plus.
let champs = 0;
for (const [f, donnee] of Object.entries(LIBS)) {
  champs++;
  const nuls = cheminsNuls(donnee);
  ok(nuls.length === 0,
     `${f} : ${nuls.length} champ(s) écrit(s) à NUL — ${nuls.slice(0, 5).join(', ')}`
   + `${nuls.length > 5 ? ` … et ${nuls.length - 5} autre(s)` : ''}. `
   + `« On ne spécifie que ce qui est présent » (Romain, 2026-08-08). Un champ absent dit « rien n'a `
   + `été déclaré » ; un champ à nul AFFIRME que la chose existe et vaut rien — ce que personne ne lit `
   + `ainsi. Retirer la clé, ou lui donner sa vraie valeur.`);
}

// ── B. TÉMOIN QUI MORD DANS LES DEUX SENS ───────────────────────────────────────────────────
// ⚠️ Le volet A ne mesure que des cas qui RÉUSSISSENT : tant que la donnée est propre, il resterait
// vert même si `cheminsNuls` ne regardait rien. Et la seconde moitié compte autant — une règle qui
// refuserait aussi le faux, le vide ou le zéro serait débranchée en une semaine.
{
  const VU = [
    ['un nul à la racine',            { a: null },                          ['a']],
    ['un nul imbriqué',               { a: { b: { c: null } } },            ['a.b.c']],
    ['un nul dans un tableau',        { a: [{ b: null }] },                 ['a.0.b']],
    ['deux nuls à des profondeurs différentes', { x: null, y: { z: null } },['x', 'y.z']],
  ];
  for (const [quoi, donnee, attendu] of VU) {
    const trouve = cheminsNuls(donnee);
    ok(JSON.stringify(trouve) === JSON.stringify(attendu),
       `B-témoin. ${quoi} — attendu ${JSON.stringify(attendu)}, trouvé ${JSON.stringify(trouve)}. `
     + `Un balayage qui ne descend pas jusqu'aux feuilles rapporte « aucun » sur une donnée qui en porte.`);
  }
  const TAIT = [
    ['un booléen à FAUX',   { resolvesPitch: false }],
    ['une chaîne VIDE',     { description: '' }],
    ['un tableau VIDE',     { ratios: [] }],
    ['une table VIDE',      { alterations: {} }],
    ['le nombre ZÉRO',      { transpose: 0 }],
  ];
  for (const [quoi, donnee] of TAIT) {
    ok(cheminsNuls(donnee).length === 0,
       `B-témoin. ${quoi} ne doit PAS être signalé — il AFFIRME, et c'est parfois voulu `
     + `(resolvesPitch à faux est écrit exprès, LANGUAGE.md:878). Une règle qui refuse tout ne garde rien.`);
  }
}

// ── SOCLE — contre le vert obtenu en ne lisant plus rien ─────────────────────────────────────
//
// ⛔ CE SOCLE ÉTAIT UN SEUIL CALÉ SUR L'EXISTANT, ET IL PORTAIT LE DÉFAUT QUE ROMAIN A NOMMÉ LE
// 2026-08-24 : il s'écrivait `champs >= 26`, et il a été abaissé trois fois — 15, puis 14, puis 13,
// puis recompté en clés à 26. **Un seuil réajusté à chaque retrait ne mord jamais sur le retrait
// qu'il accompagne : il mord sur le SUIVANT, avec un message qui parle du PRÉCÉDENT.** Il refusait
// donc toujours le mauvais geste, un cran trop tard.
//
// ⇒ IL DEVIENT UNE ASSERTION D'INCLUSION, DANS LES DEUX SENS, et plus aucun nombre ne s'y écrit :
//     tout fichier posé à la racine de `lib/` a sa clé dans le paquet   — sinon le producteur
//                                                                        a cessé de le lire en silence
//     toute clé non préfixée du paquet a son fichier à la racine        — sinon le paquet publie
//                                                                        un fantôme
// Un retrait VOULU retire les deux ensemble et reste vert. Un rétrécissement SUBI en casse un seul
// et rougit — ce qu'aucun seuil ne distinguait.
//
// ⚠️ ET L'INCLUSION NE CONNAÎT AUCUNE EXTENSION. C'est exactement le point qui a rendu ce garde
// aveugle le 2026-08-23, quand quatre catalogues sont passés de `.json` à `.bpsl` : il n'en lisait
// plus que 9 sur 13, et seul le socle l'a dit. On compare des NOMS, jamais des formats.
{
  const racine = readdirSync(LIB).filter((e) => !statSync(path.join(LIB, e)).isDirectory());
  const nomDe = (f) => f.slice(0, f.lastIndexOf('.'));
  const clesNues = Object.keys(LIBS).filter((k) => !k.includes('/'));

  ok(racine.length > 0 && clesNues.length > 0,
     `SOCLE : ${racine.length} fichier(s) à la racine de lib/ et ${clesNues.length} clé(s) nue(s) au `
   + `paquet. Un ensemble vide rend l'inclusion vraie sans rien avoir comparé.`);

  const nonLus = racine.filter((f) => !clesNues.includes(nomDe(f)));
  ok(nonLus.length === 0,
     `SOCLE : ${nonLus.length} fichier(s) de lib/ SANS clé au paquet — ${nonLus.join(', ')}. Le `
   + `producteur a cessé de les lire, et rien d'autre ne le dirait : un lecteur qui range par `
   + `extension continue sur moins de données en restant vert.`);

  const fantomes = clesNues.filter((k) => !racine.some((f) => nomDe(f) === k));
  ok(fantomes.length === 0,
     `SOCLE : ${fantomes.length} clé(s) publiée(s) SANS fichier à la racine — ${fantomes.join(', ')}. `
   + `Le paquet publie une librairie que la source ne porte plus.`);

  ok(champs === Object.keys(LIBS).length,
     `SOCLE : ${champs} librairie(s) balayée(s) pour ${Object.keys(LIBS).length} clé(s) au paquet — `
   + `le volet A n'a pas traversé tout l'espace qu'il prétend couvrir.`);
}

if (echecs.length) {
  console.error(`❌ on ne spécifie que ce qui est présent : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ on ne spécifie que ce qui est présent — ${champs} librairies balayées jusqu'aux feuilles, `
          + `zéro champ écrit à nul ; le faux, le vide et le zéro passent car ils affirment. `
          + `${passe} vérification(s) passée(s).`);
