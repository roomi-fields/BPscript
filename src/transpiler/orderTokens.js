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
// QUOI. `tokenizeOrder(canonical)` transforme la chaîne canonique en une LISTE
// ORDONNÉE de jetons. Chaque jeton est une unité atomique de la production :
// terminal/silence/prolongation, contrôle `_x(args)` (gardé entier), ou délimiteur
// de structure. La séparation des délimiteurs évite l'artefact de collage du brut
// WASM (qui se contentait d'un `split(' ')` et soudait `_pitchrange(200)(={2,ek`
// en un seul morceau).
//
// COMMENT. Balayage gauche→droite, classes reconnues dans cet ordre :
//   (1) espace          → séparateur (ignoré)
//   (2) contrôle         → `_` + identifiant + groupe `( … )` optionnel (parenthèses
//                          équilibrées, 1 niveau d'imbrication) → UN jeton
//                          ex. `_pitchrange(200)`, `_transpose(-2)`, `_pitchcont`
//   (3) délimiteur seul  → l'un de  { } ( ) , & / = :  → un jeton chacun
//   (4) terminal         → suite maximale de caractères hors espace/délimiteur
//                          ex. `a`, `b`, `A2`, `ek`, `do`, `-` (silence),
//                          `.` (fragment), `_` (prolongation), entiers de polymétrie
//
// La forme exacte (jeu de délimiteurs) est COORDONNÉE avec Kanopi (runtime texte) :
// toute évolution se fait ici, en un seul endroit partagé.

/** Délimiteurs de structure émis comme jetons isolés. */
const DELIMS = new Set(['{', '}', '(', ')', ',', '&', '/', '=', ':']);

/**
 * Tokenise une production canonique BP3 (sortie `-o`) en séquence ORDONNÉE.
 * @param {string} canonical - contenu brut de la sortie `-o` (une ligne en général).
 * @returns {string[]} jetons dans l'ordre de production.
 */
export function tokenizeOrder(canonical) {
  const s = String(canonical);
  const out = [];
  let i = 0;
  const n = s.length;

  while (i < n) {
    const c = s[i];

    // (1) espaces / fins de ligne = séparateurs
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }

    // (2) contrôle : _ + identifiant + ( … ) équilibré optionnel
    if (c === '_' && i + 1 < n && /[A-Za-z]/.test(s[i + 1])) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9]/.test(s[j])) j++;
      // groupe d'arguments collé immédiatement : parenthèses équilibrées
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

    // (3) délimiteur de structure isolé
    if (DELIMS.has(c)) { out.push(c); i++; continue; }

    // (4) terminal / silence / prolongation : run jusqu'au prochain espace ou délimiteur
    let j = i;
    while (j < n) {
      const d = s[j];
      if (d === ' ' || d === '\t' || d === '\n' || d === '\r' || DELIMS.has(d)) break;
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
