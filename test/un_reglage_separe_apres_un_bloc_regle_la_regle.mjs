#!/usr/bin/env node
/**
 * APRÈS UNE ACCOLADE FERMANTE, L'ESPACE DÉCIDE DE LA PORTÉE — mesuré sur les SCÈNES RÉELLES.
 *
 * `EBNF.md` §4.12 : un sac COLLÉ à l'accolade fermante règle le GROUPE, un sac SÉPARÉ par une
 * espace règle la RÈGLE. `parsePolymetric` happait tout `(…)` suivant un bloc sans consulter
 * l'espace, et posait donc sur le groupe des réglages qui visaient la règle.
 *
 * ⚠️ LA CONSÉQUENCE NE SE VOYAIT PAS DANS L'ARBRE, ELLE SE VOYAIT EN TEMPS DE CALCUL. Sur
 * `tryRotate.bps:11`, le poids `(weight:5-1)` atterrissait dans le bloc ; le chargeur BPx le
 * cherche sur la RÈGLE, ne le trouve pas, et retombe sur le défaut du moteur d'origine — poids
 * 127, décrément ZÉRO. Avec un décrément nul le poids ne décroît jamais, et cette règle est
 * RÉCURSIVE : ce décrément est précisément ce qui la BORNE. La dérivation ne rendait jamais la
 * main. Mesures indépendantes : tuée à 45 s chez BPx, 150 s chez Kairos, DIX MINUTES chez Kanopi
 * (qui l'a rencontrée sans la chercher, en voulant comparer les productions), quand le moteur
 * natif termine en 25 ms sur la même grammaire.
 *
 * ⚠️ POURQUOI CE GARDE MESURE DES FICHIERS ET NON DES CAS FABRIQUÉS — c'est la leçon, et elle m'a
 * coûté une tentative ratée. J'ai d'abord écrit des cas synthétiques ; AUCUN ne discrimine, ils
 * placent le poids sur la règle AVEC ET SANS le correctif. BPx l'avait dit avant moi (« mes
 * réductions minimales NON ») et avait eu l'honnêteté de ne pas livrer un cas minimal faux. J'ai
 * cru l'avoir réduit ; c'est l'INJECTION qui m'a démasqué — le garde restait vert avec le défaut
 * remis. Un garde qui ne mord pas est pire que pas de garde : il certifie.
 * Le déclencheur tient à quelque chose du contexte du fichier que personne n'a isolé. Tant qu'il
 * ne l'est pas, **la scène réelle EST le cas de test**, et c'est plus honnête qu'une réduction qui
 * ne reproduit pas.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { toutesLesScenes } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** Où atterrit un réglage portant cette clé : sur quelles natures de nœud ? */
function porteursDe(ast, cle) {
  const vus = [];
  const w = (n, s = new WeakSet()) => {
    if (!n || typeof n !== 'object' || s.has(n)) return; s.add(n);
    if (Array.isArray(n)) { n.forEach((x) => w(x, s)); return; }
    if (n.settings && Array.isArray(n.settings.pairs)
        && n.settings.pairs.some((p) => p.key === cle)) vus.push(n.type);
    Object.values(n).forEach((v) => w(v, s));
  };
  w(ast);
  return vus;
}

// ── LES SCÈNES DU CORPUS QUI ÉCRIVENT LA FORME — trouvées par MESURE, pas listées de mémoire ──
// ⚠️ La liste se CALCULE à chaque passage : une scène qui adopterait la forme demain entre dans le
// garde sans que personne y pense, et une scène qui la perdrait en sort. Une liste écrite à la
// main aurait figé l'état d'un jour.
const MOTIF = /\}\s+\([A-Za-z_]/;      // accolade fermante, ESPACE, puis un sac
const concernees = [];
for (const [nom, src] of toutesLesScenes()) {
  if (MOTIF.test(src)) concernees.push([nom, src]);
}

ok(concernees.length >= 5,
   `SOCLE : ${concernees.length} scène(s) du corpus écrivent une accolade fermante suivie d'une `
   + `ESPACE puis d'un sac. Sous ce seuil, ce garde ne mesure plus la forme qu'il prétend garder — `
   + `il ne dirait pas que le corpus a changé, il dirait qu'il ne le lit plus.`);

// ── A. LE RÉGLAGE SÉPARÉ NE DOIT JAMAIS ATTERRIR DANS LE BLOC ────────────────────────────────
let cellules = 0;
for (const [nom, src] of concernees) {
  let r;
  try { r = compileToBPxAST(src); } catch (e) { r = { errors: [{ message: e.message }] }; }
  if (!r.ast) continue;                       // scène déjà rouge pour une autre cause : hors sujet
  // On regarde TOUTES les clés que ces sacs portent, pas seulement `weight` : le défaut était
  // d'aiguillage, il ne connaissait aucune clé en particulier.
  for (const cle of ['weight', 'vel', 'rndtime', 'mode', 'meter']) {
    const porteurs = porteursDe(r.ast, cle);
    if (porteurs.length === 0) continue;
    cellules++;
    ok(!porteurs.includes('Polymetric') || src.includes(`}(${cle}`),
       `A. ${nom} : le réglage '${cle}' atterrit sur un ${porteurs.join('/')} alors que la scène `
       + `l'écrit SÉPARÉ par une espace après un bloc — il vise la RÈGLE. Un réglage mal aiguillé `
       + `ne se voit pas dans l'arbre : sur tryRotate il faisait tourner la dérivation sans fin.`);
  }
}

// ── B. LE CAS NOMMÉ — tryRotate, celui qui a coûté la dérivation infinie ─────────────────────
// ⚠️ CE VOLET EST CELUI QUI MORD. Le §A balaye large et reste vert sur beaucoup de scènes ; c'est
// ce site précis qui distingue le correctif de son absence, et c'est pour ça qu'il est nommé.
{
  const entree = concernees.find(([n]) => n.endsWith('tryRotate.bps'));
  ok(!!entree,
     `B. la scène tryRotate n'est plus dans le corpus — c'est ELLE qui discrimine. Sans elle, ce `
     + `garde ne prouve plus rien : aucun cas fabriqué ne reproduit le défaut (mesuré, et signalé `
     + `par BPx avant moi).`);
  if (entree) {
    const r = compileToBPxAST(entree[1]);
    const porteurs = porteursDe(r.ast, 'weight');
    ok(porteurs.includes('Rule'),
       `B. tryRotate : le poids doit être porté par la RÈGLE, il l'est par ${porteurs.join('/') || 'rien'}. `
       + `C'est le décrément de ce poids qui BORNE une règle récursive ; sans lui, la dérivation ne `
       + `rend jamais la main (45 s chez BPx, 150 s chez Kairos, 10 min chez Kanopi, 25 ms au natif).`);
    ok(!porteurs.includes('Polymetric'),
       `B. tryRotate : le poids est ENCORE dans le bloc (${porteurs.join('/')}) — le défaut est revenu.`);
  }
}

if (echecs.length) {
  console.error(`❌ la portée d'un réglage après un bloc : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ un réglage séparé après un bloc règle la RÈGLE — ${passe} vérification(s) sur `
          + `${concernees.length} scène(s) du corpus qui écrivent la forme (liste CALCULÉE, pas `
          + `écrite), ${cellules} réglage(s) suivis, dont le cas nommé tryRotate.`);
