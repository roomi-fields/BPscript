#!/usr/bin/env node
/**
 * UNE ENTRÉE DÉCLARE SON CANAL — ET LA FORME NUE TRAVERSAIT TROIS FRONTIÈRES POUR MOURIR MUETTE.
 *
 * DÉCISION DE ROMAIN, 2026-08-23 : *« si on ne le déclare pas là, on le déclarerait quand ? à un
 * moment on doit savoir quel runtime d'entrée est adressé »*, puis *« on empêche car ça n'a pas de
 * sens »*. `in <rôle>` seul est refusé ; le champ `transport` cesse d'être nullable.
 *
 * ⛔ CE QUE CE GARDE FERME N'ÉTAIT PAS UNE ERREUR DE FRAPPE, C'ÉTAIT UNE FORME QUE J'ÉMETTAIS.
 * Ma frappe `15ae763` avait rendu `in pedale` légal avec `transport: null`, au nom de l'incomplétude
 * qui se refuse à l'usage. Le canal n'est pas un membre de l'entrée : c'est ce qui DÉSIGNE le
 * destinataire, et aucune graphie ne permettait de le poser après coup. Un rôle sans canal n'était
 * donc pas une déclaration partielle — c'était une entrée qui n'adressait personne.
 *
 * ⚠️ ET TROIS DÉPÔTS EN PORTAIENT DÉJÀ LA CONSÉQUENCE pendant que je l'émettais : le validateur de
 * BPx la refusait, le type publié de runtime-in la déclarait impossible, et son code l'ignorait en
 * silence — un `null` n'apparie aucun canal. C'est le patron du poids muet : ce que j'émets est
 * refusé plus loin, ou pire, ignoré, et l'auteur n'apprend rien à aucune des trois frontières.
 *
 * ⚠️ LA PORTÉE EST L'ESPACE, PAS LA LIGNE SIGNALÉE. Le volet C ne juge pas trois exemples choisis :
 * il compile TOUT le corpus et exige qu'aucune entrée émise, nulle part, ne porte un canal absent.
 * Un garde écrit pour la forme du jour laisserait entrer celle de demain.
 */
import { canaux, clesDActeur, axesDeCatalogue } from '../src/transpiler/index-des-objets.js';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compile = (lignes) => {
  const src = `core\ntempo:120\n${lignes.join('\n')}\n\n-----\nS -> -\n`;
  try {
    const r = compileToBPxAST(src, {});
    const errs = (r.errors || []).map((x) => x.message || String(x));
    return { ok: !!r.ast && !errs.length, err: errs[0] || '', ast: r.ast };
  } catch (e) { return { ok: false, err: 'JET ' + e.message, ast: null }; }
};

// ── SOCLE — les canaux viennent de la DONNÉE, jamais d'une liste écrite ici ───────────────────
// Une liste recopiée resterait verte le jour où le catalogue en gagne ou en perd un, et ce garde
// éprouverait alors un langage qui n'existe plus.
const CANAUX = Object.entries(canaux())
  .filter(([, c]) => c && typeof c === 'object' && c.in === true)
  .map(([nom]) => nom).sort();
ok(CANAUX.length >= 2,
   `SOCLE : ${CANAUX.length} canal/canaux d'entrée lus dans la donnée, 2 au moins attendus. Sous ce `
 + `seuil, ce garde est vert parce qu'il n'a plus rien à éprouver.`);

// ── A. LA FORME NUE EST REFUSÉE, ET LE REFUS DONNE SA RÉÉCRITURE ─────────────────────────────
// ⛔ UN REFUS QUI NE RÉÉCRIT PAS EST UNE IMPASSE : l'auteur sait que c'est faux et pas quoi écrire.
{
  const r = compile(['in pedale']);
  ok(!r.ok, `A. 'in pedale' — une entrée SANS canal doit être REFUSÉE. Elle est ACCEPTÉE : l'arbre `
          + `part avec transport:null, que trois dépôts en aval refusent ou ignorent en silence.`);
  if (r.ok) { /* le reste du volet n'a plus de sens */ }
  else {
    ok(/in\.<canal> pedale/.test(r.err),
       `A. le refus doit NOMMER LA RÉÉCRITURE — 'in.<canal> pedale'. Reçu : ${r.err.slice(0, 120)}`);
    for (const c of CANAUX) {
      ok(r.err.includes(c),
         `A. le refus doit énumérer les canaux d'entrée que la donnée déclare — '${c}' manque. `
       + `Reçu : ${r.err.slice(0, 140)}`);
    }
  }
}

// ── B. LE TÉMOIN NON NUL — la forme AVEC canal passe, et le canal ARRIVE dans l'arbre ─────────
// ⛔ Sans lui, « il refuse la forme nue » ne se distingue pas de « il refuse toute entrée ». Et
// compiler ne suffit pas : un canal accepté puis perdu en route serait vert ici et muet à l'arrivée.
for (const canal of CANAUX) {
  const r = compile([`in.${canal} pedale`]);
  ok(r.ok, `B-témoin. 'in.${canal} pedale' doit COMPILER — reçu : ${r.err.slice(0, 90)}`);
  if (!r.ok) continue;
  const e = (r.ast.inputs || []).find((x) => x && x.name === 'pedale');
  ok(!!e, `B-témoin. 'in.${canal} pedale' compile mais l'entrée n'arrive PAS dans l'arbre — `
        + `inputs : ${JSON.stringify(r.ast.inputs)}`);
  ok(e && e.transport === canal,
     `B-témoin. l'entrée arrive mais son canal ne la suit pas : transport=${JSON.stringify(e && e.transport)}, `
   + `attendu '${canal}'. Une entrée acceptée puis vidée de son canal est le défaut que ce garde ferme.`);
}

// ── C. LA CONSTRUCTION, PAS LE CAS — aucune entrée du CORPUS ne sort sans canal ───────────────
// ⚠️ Ce volet est celui qui vaut : les volets A et B jugent trois formes que j'ai écrites, celui-ci
// juge tout ce que le corpus produit. Le champ n'est pas nullable — il faut donc le prouver sur ce
// qui EXISTE, pas sur ce que j'ai pensé à taper.
{
  const { toutesLesScenes } = await import('./corpus.mjs');
  let scenes = 0, entrees = 0;
  const fautives = [];
  for (const [nom, src] of toutesLesScenes()) {
    scenes++;
    let r;
    try { r = compileToBPxAST(src, {}); } catch { continue; }
    if (!r.ast || (r.errors || []).length) continue;
    for (const e of r.ast.inputs || []) {
      entrees++;
      if (!e || !e.transport) fautives.push(`${nom} : l'entrée '${e && e.name}' (ligne ${e && e.line}) `
        + `sort avec transport=${JSON.stringify(e && e.transport)} — le champ n'est pas nullable.`);
    }
  }
  ok(scenes >= 300, `C-socle : ${scenes} scène(s) compilées, 300 au moins attendues.`);
  ok(entrees >= 3,
     `C-socle : ${entrees} entrée(s) émise(s) examinée(s), 3 au moins attendues. Sous ce seuil, ce `
   + `volet est vert parce qu'il ne voit plus d'entrée, pas parce qu'elles portent leur canal. `
   + `(Il y en avait 3 le 2026-08-23, dans wait-for-key, kairos-scene-point-attente-sustain et `
   + `attente-la-derivation-qui-guette.)`);
  for (const f of fautives) echecs.push(`C. ${f}`);
  passe += entrees - fautives.length;
}

// ── D. LES BORNES — ce que ce refus ne doit PAS avaler ────────────────────────────────────────
// ⛔ UNE BORNE TROP GOURMANDE MANGE LES REFUS VOISINS, et la leçon a déjà été payée deux fois dans
// ce parseur. Chacun de ces cas a son refus PROPRE : il doit rester le sien.
{
  const bornes = [
    ['in.zorglub pedale', /n'est pas une entrée/, `un canal INCONNU garde son refus nommé`],
    ['in.midi pedale alphabet.western', /AUCUN alphabet/, `une entrée ne porte pas d'alphabet`],
    ['in.midi pedale (mapping.t)', /Expected|refus/i, `les parenthèses restent refusées à la forme`],
    ['in.midi pedale [mapping.t]', /Expected|refus/i, `les crochets restent refusés à la forme`],
  ];
  for (const [ligne, motif, quoi] of bornes) {
    const r = compile([ligne]);
    ok(!r.ok, `D-borne. '${ligne}' doit rester REFUSÉ (${quoi}) — il est ACCEPTÉ.`);
    if (r.ok) continue;
    ok(motif.test(r.err),
       `D-borne. '${ligne}' — ${quoi}, et son refus PROPRE a été avalé par celui de la forme nue. `
     + `Reçu : ${r.err.slice(0, 120)}`);
  }
  // Et la borne inverse : un mot qui n'est pas `in` ne tombe pas dans ce refus.
  const r = compile(['flag zz']);
  ok(r.ok || !/in\.<canal>/.test(r.err),
     `D-borne. 'flag zz' ne doit pas recevoir le refus des entrées — le refus vise 'in', pas toute `
   + `déclaration nue. Reçu : ${r.err.slice(0, 100)}`);
}

// ── E. L'EMPLOI PAR LE FLUX — repris du banc que ce geste a périmé ────────────────────────────
// ⛔ CES DEUX VOLETS VENAIENT DE `une_entree_nue_est_un_modele_et_se_refuse_a_l_usage.mjs`, supprimé
// le 2026-08-23 : il gardait la forme nue que Romain vient de retirer. Trois de ses cinq volets sont
// morts avec elle, ces deux-là restaient VRAIS et n'étaient couverts nulle part ailleurs. Un banc
// qu'on supprime emporte en silence ce qu'il gardait de juste — c'est ce qui ne rougit jamais.
{
  const r = compile(['in.midi zz'].concat([])); // déclarée et employée dans le même flux
  ok(r.ok, `E. 'in.midi zz' déclarée seule doit rester vivante. Reçu : ${r.err.slice(0, 90)}`);

  const src = 'core\ntempo:120\nin.midi zz\n\n-----\nS -> C4 <!zz\n';
  let err = '';
  try { const x = compileToBPxAST(src, {}); err = ((x.errors || [])[0] || {}).message || ''; }
  catch (x) { err = x.message; }
  ok(err === '',
     `E. une entrée AVEC son canal doit pouvoir être EMPLOYÉE par un point d'attente — c'est la `
   + `raison d'être de la déclaration. Reçu : ${err.slice(0, 100)}`);
}

// ── F. LE TÉMOIN QUI DISCRIMINE — un rôle JAMAIS déclaré garde son refus PROPRE ───────────────
// Sans lui, « le point d'attente refuse » se confondrait avec « tout point d'attente refuse ». Et
// les deux causes mènent à deux réparations opposées : déclarer le rôle, ou lui donner son canal.
{
  const src = 'core\ntempo:120\n\n-----\nS -> C4 <!zz\n';
  let err = '';
  try { const x = compileToBPxAST(src, {}); err = ((x.errors || [])[0] || {}).message || ''; }
  catch (x) { err = x.message; }
  ok(err !== '', `F-témoin. un rôle JAMAIS déclaré doit rester refusé au point d'attente.`);
  ok(/rien ne déclare/.test(err),
     `F-témoin. et son refus est l'AUTRE — celui du nom inconnu, pas celui du canal manquant. `
   + `Reçu : ${err.slice(0, 100)}`);
}

if (echecs.length) {
  console.error(`❌ une entrée déclare son canal : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ une entrée déclare son canal — la forme nue est refusée avec sa réécriture, les `
  + `${CANAUX.length} canaux que la donnée déclare (${CANAUX.join(', ')}) compilent et arrivent dans `
  + `l'arbre avec leur canal, aucune entrée du corpus ne sort sans le sien, et les quatre refus `
  + `voisins gardent le leur. ${passe} vérification(s) passée(s).`);
