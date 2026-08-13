#!/usr/bin/env node
/**
 * GARDE — le destinataire d'un contrôle se SURCHARGE : le fichier donne le défaut, l'entrée tranche.
 *
 * RÈGLE DE ROMAIN (2026-08-13) : « si je définis le destinataire pour la librairie, c'est le défaut
 * de la librairie ; si je le définis sur le contrôle, c'est celui du contrôle qui surcharge. »
 * C'est le principe du langage partout ailleurs — le plus LOCAL gagne.
 *
 * ⚠️ CE QUE ÇA RÉPARE, ET LE CAS EST DU JOUR MÊME. Sans surcharge, un fichier ne porte qu'UN
 * destinataire : un contrôle dont le résolveur diffère de ses frères doit CHANGER DE FICHIER.
 * C'est ce qui est arrivé le matin même à `articulcont` et `transposecont` — les modes continus
 * partent aux sorties, or ils vivaient chez `engine` (BPx) et `transpo` (Kairos), et j'ai dû les
 * déménager LOIN DE LEUR PARAMÈTRE pour respecter la règle « une librairie, un destinataire ». Le
 * rangement était dicté par une contrainte de fichier, pas par le sens.
 *
 * ⚠️ CE GARDE FABRIQUE SA SURCHARGE, EN MÉMOIRE, parce qu'aucune entrée n'en porte aujourd'hui. Un
 * garde qui attendrait qu'une surcharge existe ne préviendrait rien. Et il la fabrique par le
 * REGISTRE, jamais sur le disque : une librairie modifiée sur disque atteint mes consommateurs à la
 * seconde où j'enregistre — payé le 2026-08-13, un témoin posé quelques minutes dans `audio.json` a
 * cassé une démo et bloqué le portillon de Kairos.
 *
 * CE QU'IL MESURE :
 *   1. sans surcharge, le contrôle prend le destinataire du FICHIER ;
 *   2. avec une surcharge sur l'entrée, c'est ELLE qui gagne ;
 *   3. ses VOISINS du même fichier ne bougent pas — la surcharge est locale, pas contagieuse ;
 *   4. la forme PRÉFIXÉE porte le même destinataire que la forme nue — deux graphies, une réponse ;
 *   5. l'état réel est restauré, et vérifié restauré.
 *
 * INJECTION dans l'ACCUSÉ (la surcharge ignorée) et dans le JUGE.
 */
import { createRequire } from 'node:module';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { registerLib, clearRegistry, registerAll } from '../src/transpiler/libs.js';

const require = createRequire(import.meta.url);
const { LIBS } = require('../src/transpiler/libs-data.js');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = '@core\n@alphabet.western\n';
/** Le destinataire que l'ARBRE porte pour une clé — la seule mesure qui compte, l'aval ne lit que ça. */
const destinataireDe = (src, cle) => {
  let r; try { r = compileToBPxAST(src); } catch { return '(refusé)'; }
  const out = [];
  (function marche(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(marche); return; }
    if (n.payload?.resolvedBy?.[cle]) out.push(n.payload.resolvedBy[cle]);
    Object.values(n).forEach(marche);
  })(r.ast?.subgrammars);
  return [...new Set(out)].join(' ') || '(aucun)';
};

// ─── 0. TÉMOIN — l'état réel, celui qu'on devra retrouver ────────────────────────────────────
clearRegistry();
registerAll(LIBS);
ok(destinataireDe(`${TETE}S -> C4(vel:100)\n`, 'vel') === 'toutes les sorties',
   "0. TÉMOIN : sans surcharge, `vel` prend le destinataire du FICHIER — sinon le garde mesure "
   + 'autre chose que ce qu\'il croit');
ok(LIBS.expression.controls.vel.resolvedBy === undefined,
   "0. TÉMOIN : aucune entrée ne porte de surcharge aujourd'hui — c'est pourquoi ce garde doit la "
   + 'fabriquer au lieu de l\'attendre');

// ─── L'ENTRÉE QUI SURCHARGE, fabriquée EN MÉMOIRE ────────────────────────────────────────────
const expressionSurchargee = JSON.parse(JSON.stringify(LIBS.expression));
expressionSurchargee.controls.vel = {
  ...expressionSurchargee.controls.vel,
  resolvedBy: 'runtime-audio',   // ≠ 'toutes les sorties', le défaut du fichier
};
registerLib('expression', expressionSurchargee);

// ─── 1 à 3. LA RÈGLE, ET SON COMPLÉMENT ──────────────────────────────────────────────────────
ok(destinataireDe(`${TETE}S -> C4(vel:100)\n`, 'vel') === 'runtime-audio',
   "1. l'entrée qui déclare son destinataire l'emporte sur celui du fichier — sinon la surcharge "
   + 'est acceptée et IGNORÉE, le pire des deux mondes : elle rassure sans agir');
for (const [voisin, attendu] of [['pan', 'toutes les sorties'], ['pancont', 'toutes les sorties']]) {
  ok(destinataireDe(`${TETE}S -> C4(${voisin}:20)\n`, voisin) === attendu
     || destinataireDe(`${TETE}S -> !(${voisin}) C4\n`, voisin) === attendu,
     `2. '${voisin}', voisin de la clé surchargée dans le MÊME fichier, garde le défaut — une `
     + 'surcharge est locale, elle ne déteint pas sur le fichier');
}

// ─── 4. LES DEUX GRAPHIES DONNENT LA MÊME RÉPONSE ────────────────────────────────────────────
// La forme préfixée existe partout ; si elle lisait une autre table, un auteur obtiendrait deux
// destinataires pour un seul contrôle selon la façon dont il l'écrit.
ok(destinataireDe(`${TETE}S -> C4(expression.vel:100)\n`, 'vel') === 'runtime-audio',
   '4. la forme PRÉFIXÉE doit porter le même destinataire que la forme nue — deux graphies, une '
   + 'seule réponse');

// ─── 4bis. UNE SURCHARGE VIDE N'EST PAS UNE SURCHARGE ────────────────────────────────────────
// ⚠️ CE VOLET COMBLE UNE MORSURE MANQUANTE, trouvée en injectant : le volet 6 éprouvait ce cas sur
// le JUGE seul, et l'accusé passait donc au vert avec un test de présence (`'resolvedBy' in def`)
// au lieu d'un test de VALEUR. Une entrée qui porte une chaîne vide effacerait alors le défaut du
// fichier, et le contrôle arriverait en aval SANS destinataire — un trou silencieux, exactement ce
// que la surcharge existe pour éviter.
{
  const vide = JSON.parse(JSON.stringify(LIBS.expression));
  vide.controls.vel = { ...vide.controls.vel, resolvedBy: '' };
  registerLib('expression', vide);
  ok(destinataireDe(`${TETE}S -> C4(vel:100)\n`, 'vel') === 'toutes les sorties',
     "4bis. une surcharge VIDE doit laisser le défaut du fichier — une chaîne vide n'est pas un "
     + 'destinataire, et l\'effacer laisserait le contrôle sans personne pour le résoudre');
  registerLib('expression', expressionSurchargee);   // on rend la surcharge réelle au volet suivant
}

// ─── 5. RETOUR À L'ÉTAT RÉEL — un garde ne laisse pas son témoin derrière lui ────────────────
clearRegistry();
registerAll(LIBS);
ok(destinataireDe(`${TETE}S -> C4(vel:100)\n`, 'vel') === 'toutes les sorties',
   '5. après restauration, `vel` doit reprendre le défaut du fichier — sinon le témoin fuit sur '
   + 'les gardes suivants');

// ─── 6. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const juger = (surEntree, surFichier) => surEntree || surFichier;
ok(juger('runtime-audio', 'toutes les sorties') === 'runtime-audio', '6. (mord) le plus local gagne');
ok(juger(undefined, 'toutes les sorties') === 'toutes les sorties', '6. (se tait) sans surcharge, le fichier donne');
ok(juger('', 'toutes les sorties') === 'toutes les sorties',
   "6. (se tait) une surcharge VIDE n'est pas une surcharge — sinon une chaîne vide effacerait le défaut");

if (echecs.length) {
  console.error(`❌ surcharge du destinataire : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ le fichier donne le défaut, l'entrée tranche — ${passe} vérification(s) passée(s)`);
}
