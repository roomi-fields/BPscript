// orderTokens.js — Tokenisation « ORDRE » partagée de la production canonique BP3.
//
// POURQUOI. Les grammaires en mode TEXTE n'ont pas de timing : l'information est
// l'ORDRE des jetons produits (la séquence de production), pas leur position dans
// le temps. Le moteur natif l'expose via l'option `-o <fichier>` (sortie canonique
// BP3, lossless, structure conservée). Référence : hub/constats/2026-06-16-voie-texte-ordre.md.
//
// QUI LIT CETTE RECETTE, MESURÉ LE 2026-08-11 et non plus supposé :
//   1. mon banc de non-régression d'ordre (`test/order_parity.mjs`), qui pose les instantanés
//      `s3_native` mode 'text' ;
//   2. le capteur d'oracle de BPx, qui l'IMPORTE par chemin (`scripts/capture-oracle.mjs:90`)
//      au lieu d'en garder une copie — donc sans seconde autorité ;
//   3. chez Kanopi, un ORACLE DE TEST seulement (runtime-ui `bpx-tree-annotations.test.ts`),
//      qui prouve que sa vue texte ne réimplémente pas cette coupe.
//
// ⚠️ CE FICHIER A ANNONCÉ PENDANT DES SEMAINES que « le runtime texte de Kanopi » était le
// second consommateur, affichant la production PAR ORDRE. Le consommateur de production a été
// supprimé chez eux le 2026-07-24 (`bpx-tree-canonical.ts`, aucun appelant vivant). Une liste de
// lecteurs écrite une fois et jamais remesurée fait croire à une portée qu'on n'a plus — et
// c'est sur cette phrase que j'ai annoncé Kanopi comme atteint par un changement de règle qui ne
// touche aucun de ses chemins vivants.
//
// QUOI. `tokenizeOrder(canonical)` transforme la chaîne canonique en LISTE ORDONNÉE
// de jetons SONNANTS (symboles produits). Chaque jeton est : un terminal / silence /
// prolongation, ou un contrôle `_x(args)` gardé entier. Les délimiteurs de structure
// `{ } & ,` sont des SÉPARATEURS (comme l'espace) : ils découpent mais ne sont pas
// émis — ce qui aligne la séquence sur ce qu'un runtime / BPx émet réellement
// (symboles, pas accolades) et reproduit la sémantique « ordre des jetons ».
//
// COMMENT. Balayage gauche→droite, classes reconnues dans cet ordre :
//   (1) séparateur     → espace, tab, fin de ligne, ou l'un de  { } & ,  → ignoré
//   (2) contrôle        → `_` + identifiant + groupe `( … )` optionnel (parenthèses
//                         équilibrées) → UN jeton. Les `,` internes sont protégés car le
//                         groupe est consommé AVANT le découpage par séparateurs. La barre,
//                         elle, n'a plus besoin de cette protection : elle ne sépare nulle part.
//                         ex. `_pitchrange(200)`, `_transpose(-2)`, `_pitchcont`
//   (3) jeton sonnant   → suite maximale de caractères hors séparateur
//                         ex. `a`, `b`, `A2`, `ek`, `do`, `-` (silence),
//                         `.` (fragment), `_` (prolongation), `4+4+4+4/6` (métrique
//                         composée, ENTIÈRE), `5/3` (rapport), `*1/4` (vitesse),
//                         `(=` / `(:` / `)` (marqueurs de portée), entiers de polymétrie
//
// La forme (jeu de séparateurs) suit la spec hub/constats/2026-06-16-voie-texte-ordre.md
// et est COORDONNÉE avec Kanopi (runtime texte) : toute évolution se fait ICI, en un
// seul endroit partagé. Un consommateur qui veut la chaîne canonique brute la lit
// directement depuis `-o` ; ce tokeniseur donne la séquence ORDONNÉE comparable.

/**
 * Séparateurs de structure : découpent la séquence mais ne sont pas émis.
 *
 * ⚠️ LA BARRE N'EN EST PAS UN — décision de Romain du 2026-08-11,
 * `hub/decisions/2026-08-11-un-rapport-ne-se-decoupe-pas-la-barre-ne-separe-rien.md` :
 * « `5/3` est UNE unité. La barre ne coupe pas, qu'elle soit à l'intérieur d'un contrôle ou à
 * l'extérieur. » Un rapport de polymétrie, une métrique composée, une vitesse portent une
 * information et se comptent comme une.
 *
 * ELLE Y ÉTAIT, ET LA DISSYMÉTRIE SE VOYAIT DÉJÀ : le groupe d'un contrôle étant consommé avant
 * le découpage, `_tempo(11/5)` restait entier pendant que le `4+4+4+4/6` d'à côté se cassait en
 * deux. La même écriture rendait une information ou deux selon qu'elle était dans des
 * parenthèses. Mesuré sur l'assiette avant la décision : seize grammaires portent un rapport,
 * neuf nu et sept en métrique composée.
 *
 * L'accolade, la virgule et l'esperluette gardent leur rôle — la décision le dit, et ce n'est
 * pas parce que l'accolade touche plus de grammaires (34 mesurées) qu'elle relève de la même
 * question.
 */
const SEPARATORS = new Set([' ', '\t', '\n', '\r', '{', '}', '&', ',']);

/**
 * Tokenise une production canonique BP3 (sortie `-o`) en séquence ORDONNÉE.
 * @param {string} canonical - contenu brut de la sortie `-o` (une ligne en général).
 * @returns {string[]} jetons sonnants dans l'ordre de production.
 */
export function tokenizeOrder(canonical) {
  const s = String(canonical);
  const out = [];
  let i = 0;
  const n = s.length;

  while (i < n) {
    const c = s[i];

    // (1) séparateur (espace ou délimiteur de structure) → ignoré
    if (SEPARATORS.has(c)) { i++; continue; }

    // (2) contrôle : _ + identifiant + ( … ) équilibré optionnel, gardé ENTIER
    if (c === '_' && i + 1 < n && /[A-Za-z]/.test(s[i + 1])) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9]/.test(s[j])) j++;
      if (j < n && s[j] === '(') {
        let depth = 0;
        let k = j;
        for (; k < n; k++) {
          if (s[k] === '(') depth++;
          else if (s[k] === ')') { depth--; if (depth === 0) { k++; break; } }
        }
        out.push(s.slice(i, k));
        i = k;
      } else {
        out.push(s.slice(i, j)); // contrôle sans argument, ex. _pitchcont
        i = j;
      }
      continue;
    }

    // (3) jeton sonnant : run jusqu'au prochain séparateur (ou début de contrôle)
    let j = i;
    while (j < n) {
      const d = s[j];
      if (SEPARATORS.has(d)) break;
      // un `_` suivi d'une lettre démarre un contrôle → on coupe ici
      if (d === '_' && j > i && j + 1 < n && /[A-Za-z]/.test(s[j + 1])) break;
      j++;
    }
    out.push(s.slice(i, j));
    i = j;
  }

  return out;
}

export default tokenizeOrder;
