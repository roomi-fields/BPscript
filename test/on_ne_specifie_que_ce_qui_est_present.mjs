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
import { readFileSync, readdirSync } from 'node:fs';
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
const fichiers = readdirSync(LIB).filter((f) => f.endsWith('.json')).sort();
let champs = 0;
for (const f of fichiers) {
  let donnee;
  try { donnee = JSON.parse(readFileSync(path.join(LIB, f), 'utf8')); }
  catch (e) { echecs.push(`${f} : illisible — ${e.message}`); continue; }
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
ok(champs >= 15,
   `SOCLE : ${champs} librairie(s) lue(s), 15 au moins attendues. Sous ce seuil ce garde est vert `
 + `parce qu'il ne balaie plus la donnée, pas parce qu'elle est propre.`);

if (echecs.length) {
  console.error(`❌ on ne spécifie que ce qui est présent : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ on ne spécifie que ce qui est présent — ${champs} librairies balayées jusqu'aux feuilles, `
          + `zéro champ écrit à nul ; le faux, le vide et le zéro passent car ils affirment. `
          + `${passe} vérification(s) passée(s).`);
