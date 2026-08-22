#!/usr/bin/env node
/**
 * UN SAC EN FIN DE RÈGLE ENVELOPPE LA RÈGLE ; AU MILIEU, IL VAUT À PARTIR DE LÀ.
 *
 * ⚠️ CE GARDE EXISTE PARCE QUE LA DIFFÉRENCE EST MUSICALE ET MUETTE. `Up1 -> C4 E4 G4 C5 (vel:55)`
 * met TOUTE la règle à 55 ; le même sac lu comme un contrôle de flux ne vaudrait qu'à partir de
 * là. Les deux compilent, les deux produisent un arbre bien formé, et **rien ne distingue le juste
 * du faux** — sauf en comparant les arbres. Aucun message, aucun refus : la scène sonne autrement.
 *
 * ⚠️ ET CE N'EST PAS THÉORIQUE — c'est arrivé deux fois en dix minutes, le 2026-08-07, en branchant
 * `isEndOfRhs()` :
 *   · 1er défaut, **91 scènes** : la fonction SAUTAIT les fins de ligne avant de regarder ce qui
 *     suit, donc après une règle elle voyait le nom de la règle SUIVANTE et répondait « ce n'est
 *     pas la fin ». Elle ne pouvait rendre vrai qu'en toute fin de fichier. C'est pour ça qu'elle
 *     n'avait jamais été branchée : elle ne marchait pas. **Une fonction morte est plus discrète
 *     qu'un défaut — elle a l'air d'une couverture.**
 *   · 2e défaut, **7 scènes** : plusieurs sacs peuvent SE SUIVRE en suffixe
 *     (`… (*:cutoff:env1, wave:sawtooth) (weight:50)`) ; s'arrêter au premier faisait voir une
 *     parenthèse derrière lui, donc « pas la fin », donc le premier devenait un contrôle de flux.
 *
 * **La même correction, mesurée deux fois, a livré deux défauts distincts.** Une seule mesure
 * n'aurait montré que le premier — et le second serait parti en production.
 *
 * LA RÈGLE, tranchée par Romain le 2026-08-07 (« les règles et l'antécédent sont clairs ») :
 *   · un sac SÉPARÉ PAR UNE ESPACE et suivi de la FIN DE RÈGLE → **suffixe**, il enveloppe tout ;
 *   · le même sac au MILIEU → **contrôle posé dans le flux**, il vaut à partir de là. C'est la
 *     forme du moteur natif, mesurée : `_tempo(1/2) _rndtime(50) _scale(…)` (`-da.checkNoteOff`).
 *
 * CE QUE CE GARDE MESURE : la NATURE du nœud produit, pas « ça compile ». Un garde qui ne
 * vérifierait que la compilation serait resté vert sur les 98 scènes.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ⛔ LE SOCLE DECLARE SON DRAPEAU DEPUIS LE 2026-08-22 : un drapeau porte sa valeur initiale, et
// un nom employe sans declaration est refuse. Un des cas de ce banc mute `stage`.
const P = 'core\nalphabet.western\nflag stage:0\n-----\n';
const compiler = (rhs) => {
  // Une règle SUIVANTE est indispensable : le premier défaut ne se voyait QUE lorsqu'un jeton
  // suivait la fin de ligne. Mesurer une règle seule en fin de fichier l'aurait manqué.
  try { return compileToBPxAST(`${P}${rhs}\n-----\nAutre -> C4\n`); }
  catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message || e).join(' | ');
/** Compte les sacs posés DANS LE FLUX (nature `InstantControl`). */
const dansLeFlux = (n, vus = new WeakSet()) => {
  if (!n || typeof n !== 'object' || vus.has(n)) return 0;
  vus.add(n);
  if (Array.isArray(n)) return n.reduce((s, x) => s + dansLeFlux(x, vus), 0);
  return (n.type === 'InstantControl' ? 1 : 0)
       + Object.values(n).reduce((s, v) => s + dansLeFlux(v, vus), 0);
};

// ── LA MATRICE — POSITIONS × NATURE ATTENDUE ──────────────────────────────────────────────────
// Les cinq premières lignes sont les FINS DE RÈGLE que le corpus écrit réellement : nue, suivie
// d'un commentaire, suivie d'une mutation de drapeau, chaînée. Les trois dernières sont les
// milieux. Ajouter une terminaison la teste automatiquement contre la nature attendue.
const CAS = [
  // [ce qu'on écrit, nombre de sacs DANS LE FLUX attendu, pourquoi]
  ['S -> C4 D4 (vel:80)',                      0, 'fin de règle nue → suffixe'],
  ['S -> C4 D4 (vel:80)  // un commentaire',   0, 'fin de règle + commentaire → suffixe'],
  ['S -> C4 D4 (vel:80) [stage=1]',            0, 'fin de règle + mutation de drapeau → suffixe'],  // socle : `flag stage:0`
  ['S -> C4 D4 (vel:80) (pan:20)',             0, 'DEUX sacs chaînés en fin → deux suffixes'],
  ['S -> C4 D4 (vel:80) (pan:20) (weight:50)', 0, 'TROIS sacs chaînés en fin → trois suffixes'],
  ['S -> C4 (vel:80) D4',                      1, 'au milieu → posé dans le flux'],
  ['S -> C4 (rndtime:100) D4 E4',              1, 'la ligne de la bible → posé dans le flux'],
  ['S -> C4 (vel:80) D4 (pan:20)',             1, 'un au milieu, un en fin → un de chaque'],
  ['S -> C4 (vel:80) D4 (pan:20) E4',          2, 'deux au milieu → deux dans le flux'],
];
for (const [rhs, attendu, pourquoi] of CAS) {
  const r = compiler(rhs);
  const msg = messages(r);
  ok(msg === '', `'${rhs}' est REFUSÉ : ${msg.replace(/\s+/g, ' ').slice(0, 90)}`);
  if (msg) continue;
  const vu = dansLeFlux(r.ast);
  ok(vu === attendu,
     `'${rhs}' — ${pourquoi} : ${attendu} sac(s) attendu(s) dans le flux, ${vu} trouvé(s). `
     + `Les deux formes COMPILENT et produisent un arbre bien formé : seule la NATURE du nœud `
     + `distingue « le réglage enveloppe la règle » de « il vaut à partir de là ». La scène sonne `
     + `autrement, et rien d'autre ne le dirait.`);
}

// ── TÉMOIN — LE COMPTEUR DOIT SAVOIR COMPTER ──────────────────────────────────────────────────
// ⚠️ Sans lui, un compteur qui rendrait toujours 0 passerait les cinq premières lignes en
// triomphe, et ce sont elles qui portent le cas dangereux (le suffixe qui se transforme).
// C'est la moitié « le juge doit discriminer » : injecter la faute dans l'instrument, pas
// seulement dans le sujet.
{
  const r = compiler('S -> C4 !(vel:80) D4');
  ok(messages(r) === '' && dansLeFlux(r.ast) === 1,
     `TÉMOIN — le compteur ne voit plus le sac de flux le plus explicite du langage `
     + `('!(vel:80)') : il rend ${r.ast ? dansLeFlux(r.ast) : '—'} au lieu de 1. Tant qu'il est `
     + `aveugle, les lignes au-dessus ne prouvent rien.`);
}

// ── SOCLE ─────────────────────────────────────────────────────────────────────────────────────
ok(CAS.length >= 8 && CAS.filter(([, a]) => a === 0).length >= 4 && CAS.filter(([, a]) => a > 0).length >= 3,
   `SOCLE : la matrice doit porter les DEUX natures — ${CAS.length} cas, `
   + `${CAS.filter(([, a]) => a === 0).length} suffixes et ${CAS.filter(([, a]) => a > 0).length} `
   + `flux. Une matrice qui ne garderait qu'une nature ne mesurerait plus la frontière.`);

if (echecs.length) {
  console.error(`❌ la frontière suffixe / flux : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ un sac en fin de règle enveloppe la règle, au milieu il vaut à partir de là — `
          + `${passe} vérification(s) sur ${CAS.length} positions, NATURE du nœud mesurée et non `
          + `simple compilation.`);
