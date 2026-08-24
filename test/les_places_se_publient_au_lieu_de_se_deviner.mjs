#!/usr/bin/env node
/**
 * GARDE — LE PAQUET DIT SES PLACES, ET UN LECTEUR N'A PLUS À LES DEVINER.
 *
 * Un catalogue mêle à la même profondeur ce qui parle DU FICHIER (`resolves`, `documented`), ce qui
 * EST une entrée (`western`, `12TET`), et ce qui CONTIENT des entrées (`objects`, `controls`,
 * `tables`). Les champs de fichier se lisent par leur nom, dans `libs-champs.js`. **Les places, non :
 * leurs noms sont libres, et un catalogue peut en inventer un.**
 *
 * ⛔ ET LA FORME NE LES SÉPARE PAS DES ENTRÉES — deux mesures le disent, pas un raisonnement :
 *
 *     core.symbols                une PLACE vide  →  « tous les membres sont des objets » est FAUX
 *     voices."fatbass for:sub37"  une ENTRÉE      →  la même règle la classait PLACE, jusqu'au
 *                                                    2026-08-24 où la relation a quitté le nom
 *
 * ⇒ **Kairos a verrouillé ce trou chez lui plutôt que de deviner**, avec un témoin discriminant, et
 * il a demandé la porte. `PLACES` la lui ferme : pour une source écrite dans le langage, le
 * générateur CONNAÎT la place — il vient de la créer ; pour un catalogue encore en JSON, il la
 * déduit, et `PLACES._deduites` **nomme lesquels**, pour qu'un lecteur sache où sa confiance
 * s'arrête. Une déduction qui ne se dit pas se lit comme une mesure.
 *
 * LES VOLETS :
 *   A. chaque place publiée EXISTE dans la donnée et porte des entrées
 *   B. la provenance est dite — les déduites sont nommées, et ce sont bien les catalogues en JSON
 *   C. aucune place n'est un champ de fichier, et réciproquement
 *   D. ce que la porte ferme : on FABRIQUE le cas que la forme seule rate
 */
import { LIBS, PLACES } from '../src/transpiler/libs-data.js';
import { CHAMPS_DE_FICHIER } from '../src/transpiler/libs-champs.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const nomsDePlaces = Object.entries(PLACES).filter(([k]) => k !== '_deduites');

// ── A. CHAQUE PLACE PUBLIÉE EXISTE ET CONTIENT ───────────────────────────────────────────────
{
  ok(nomsDePlaces.length >= 10,
    `A. SOCLE : au moins dix catalogues doivent déclarer une place — ${nomsDePlaces.length}. Un `
    + `registre vide serait vert sans rien dire.`);
  let comptees = 0;
  const fautives = [];
  for (const [lib, cles] of nomsDePlaces) {
    for (const cle of cles) {
      comptees++;
      const v = LIBS[lib] && LIBS[lib][cle];
      if (!v || typeof v !== 'object' || Array.isArray(v)) fautives.push(`${lib}.${cle} n'est pas un objet`);
    }
  }
  ok(comptees >= 15, `A. SOCLE : au moins quinze places attendues — ${comptees}`);
  ok(fautives.length === 0,
    `A. ⛔ ${fautives.length} place(s) publiée(s) ne désignent rien : ${fautives.slice(0, 4).join(' · ')}. `
    + `Une place qui nomme un chemin mort est pire qu'une absence : elle a l'air vérifiable.`);
  console.log(`[places] ${nomsDePlaces.length} catalogue(s) · ${comptees} place(s) publiée(s)`);
}

// ── B. LA PROVENANCE EST DITE ────────────────────────────────────────────────────────────────
{
  ok(Array.isArray(PLACES._deduites),
    "B. ⛔ le paquet doit dire QUELLES places sont déduites par la forme. Sans ce champ, une "
    + "déduction se lit comme une mesure, et un lecteur accorde la même confiance aux deux.");
  const deduites = PLACES._deduites || [];
  for (const lib of deduites) {
    ok(Object.prototype.hasOwnProperty.call(PLACES, lib),
      `B. '${lib}' est annoncé déduit et ne figure pas dans le registre`);
  }
  // ⛔ ET LA DÉDUCTION NE VAUT QUE POUR CE QUI N'EST PAS ÉCRIT DANS LE LANGAGE. Le jour où le
  // dernier catalogue est converti, cette liste tombe à zéro — et ce volet le dira sans rougir.
  ok(deduites.every((l) => LIBS[l] && typeof LIBS[l] === 'object'),
    `B. chaque catalogue déclaré déduit doit exister — ${deduites.join(', ')}`);
}

// ── C. UNE PLACE N'EST PAS UN CHAMP DE FICHIER ───────────────────────────────────────────────
{
  const melange = [];
  for (const [lib, cles] of nomsDePlaces) {
    for (const cle of cles) if (CHAMPS_DE_FICHIER.has(cle)) melange.push(`${lib}.${cle}`);
  }
  ok(melange.length === 0,
    `C. ⛔ ${melange.join(', ')} est publié À LA FOIS comme place et comme champ de fichier. Les deux `
    + `listes partagent l'espace des noms au sommet d'un sac : un nom dans les deux rend le sommet `
    + `illisible.`);
}

// ── D. ⛔ CE QUE LA PORTE FERME — on FABRIQUE le cas que la forme seule rate ──────────────────
// Compter dirait « le registre est cohérent » ; c'est vrai et sans intérêt. La question est : la
// porte dit-elle quelque chose que la FORME ne dit pas ? On rejoue la règle de forme sur la donnée
// publiée et on compare — l'écart EST la valeur de la porte.
{
  const tousObjets = (v) => {
    const m = Object.keys(v).filter((k) => !k.startsWith('_'));
    return m.length > 0 && m.every((k) => v[k] && typeof v[k] === 'object' && !Array.isArray(v[k]));
  };
  const parLaForme = new Set();
  for (const [lib, data] of Object.entries(LIBS)) {
    if (!data || typeof data !== 'object') continue;
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith('_') || CHAMPS_DE_FICHIER.has(k)) continue;
      if (v && typeof v === 'object' && !Array.isArray(v) && tousObjets(v)) parLaForme.add(`${lib}.${k}`);
    }
  }
  const publiees = new Set(nomsDePlaces.flatMap(([lib, cles]) => cles.map((c) => `${lib}.${c}`)));
  const vuesParLaPorteSeule = [...publiees].filter((x) => !parLaForme.has(x));
  const vuesParLaFormeSeule = [...parLaForme].filter((x) => !publiees.has(x));
  console.log(`[places] la forme en voit ${parLaForme.size}, la porte en publie ${publiees.size}`);
  ok(vuesParLaFormeSeule.length === 0,
    `D. ⛔ ${vuesParLaFormeSeule.join(', ')} : la FORME les voit comme des places et la porte ne les `
    + `publie pas. Un lecteur qui descend dedans irait plus loin que ce que je déclare.`);
  // ⚠️ L'ÉCART INVERSE EST LA RAISON D'ÊTRE DE LA PORTE, et il peut être VIDE aujourd'hui sans que
  // la porte devienne inutile : `core.symbols` est une place vide, donc invisible à la forme, et
  // elle n'est pas publiée non plus — parce que `core` est le catalogue DÉDUIT. C'est exactement ce
  // que `_deduites` sert à dire, et ce volet le CONSTATE au lieu de l'exiger.
  console.log(`[places] connues par la porte seule : ${vuesParLaPorteSeule.length ? vuesParLaPorteSeule.join(', ') : 'aucune aujourd\'hui'}`);
  const placeVideNonPubliee = Object.entries(LIBS).flatMap(([lib, d]) => (d && typeof d === 'object'
    ? Object.keys(d).filter((k) => !k.startsWith('_') && !CHAMPS_DE_FICHIER.has(k)
      && d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && Object.keys(d[k]).length === 0)
      .map((k) => `${lib}.${k}`) : []));
  ok(placeVideNonPubliee.every((x) => publiees.has(x) || (PLACES._deduites || []).includes(x.split('.')[0])),
    `D. ⛔ ${placeVideNonPubliee.join(', ')} : un conteneur VIDE que ni la porte ni la forme ne voient, `
    + `dans un catalogue qui n'est pas annoncé déduit. C'est le cas que ce garde existe pour nommer.`);
}

if (e.length) {
  console.error(`[places] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[places] ${p} PASS / 0 FAIL`);
