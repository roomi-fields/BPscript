// TOMBSTONE de migration — `rotate` de HAUTEUR a été renommé `scaleshift` (décision 2026-07-11 :
// deux transpositions nommées, réelle vs scalaire). Ce corps JETTE pour qu'une scène NON migrée
// reçoive un cri LOCAL nommé (fail-loud local Kairos : isole la feuille, pas de hauteur fausse)
// au lieu d'un contrôle qui dort. À retirer une fois tout le corpus migré.
// ⚠️ NE PAS confondre avec le ![rotate] de STRUCTURE (RotateSequence, séquence, moteur BPx) — intact.
import type { DigitalFn } from '@kairos/core';

const rotate: DigitalFn = () => {
  throw new Error("rotate (hauteur) a été renommé 'scaleshift' (décision 2026-07-11) — migrez la scène : rotate:N → scaleshift:N.");
};

export default rotate;
