// orderTokens.js — Tokenisation « ORDRE » partagée de la production canonique BP3.
//
// POURQUOI. Les grammaires en mode TEXTE n'ont pas de timing : l'information est
// l'ORDRE des jetons produits (la séquence de production), pas leur position dans
// le temps. Le moteur natif l'expose via l'option `-o <fichier>` (sortie canonique
// BP3, lossless, structure conservée). Cette sortie alimente DEUX consommateurs qui
// doivent voir la MÊME séquence :
//   1. l'oracle de parité texte (snapshots s3_native des grammaires texte) ;
//   2. le runtime texte de Kanopi (affiche la production en entier, PAR ORDRE).
// Référence : hub/constats/2026-06-16-voie-texte-ordre.md.
//
// QUOI. `tokenizeOrder(canonical)` transforme la chaîne canonique en LISTE ORDONNÉE
// de jetons SONNANTS (symboles produits). Chaque jeton est : un terminal / silence /
// prolongation, ou un contrôle `_x(args)` gardé entier. Les délimiteurs de structure
// `{ } & / ,` sont des SÉPARATEURS (comme l'espace) : ils découpent mais ne sont pas
// émis — ce qui aligne la séquence sur ce qu'un runtime / BPx émet réellement
// (symboles, pas accolades) et reproduit la sémantique « ordre des jetons ».
//
// COMMENT. Balayage gauche→droite, classes reconnues dans cet ordre :
//   (1) séparateur     → espace, tab, fin de ligne, ou l'un de  { } & / ,  → ignoré
//   (2) contrôle        → `_` + identifiant + groupe `( … )` optionnel (parenthèses
//                         équilibrées) → UN jeton. Les `/` et `,` internes (ex.
//                         `_tempo(2/1)`) sont protégés car le groupe est consommé
//                         AVANT le découpage par séparateurs.
//                         ex. `_pitchrange(200)`, `_transpose(-2)`, `_pitchcont`
//   (3) jeton sonnant   → suite maximale de caractères hors séparateur
//                         ex. `a`, `b`, `A2`, `ek`, `do`, `-` (silence),
//                         `.` (fragment), `_` (prolongation), `4+4+4+4` (métrique),
//                         `(=` / `(:` / `)` (marqueurs de portée), entiers de polymétrie
//
// La forme (jeu de séparateurs) suit la spec hub/constats/2026-06-16-voie-texte-ordre.md
// et est COORDONNÉE avec Kanopi (runtime texte) : toute évolution se fait ICI, en un
// seul endroit partagé. Un consommateur qui veut la chaîne canonique brute la lit
// directement depuis `-o` ; ce tokeniseur donne la séquence ORDONNÉE comparable.

/** Séparateurs de structure : découpent la séquence mais ne sont pas émis. */
const SEPARATORS = new Set([' ', '\t', '\n', '\r', '{', '}', '&', '/', ',']);

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
