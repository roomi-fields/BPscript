#!/usr/bin/env node
/**
 * GARDE — une macro ne peut pas s'appeler comme un TERMINAL de l'alphabet actif.
 *
 * RÈGLE DE ROMAIN (2026-07-28) : « une macro nommée G4 (lettre de l'alphabet actif) doit tomber en
 * erreur LORS DE LA DÉCLARATION. »
 *
 * CE QU'ELLE VISE — et ce n'est PAS un défaut d'exécution. Kairos a mesuré que la macro l'emporte
 * sur l'alphabet : une macro nommée comme une note reçoit son action, pas une hauteur, et il n'y a
 * pas de son fantôme. Le problème est pour l'AUTEUR : en lisant la règle, il ne peut pas savoir si
 * le mot joue la note ou la macro. On refuse l'ambiguïté À LA SOURCE plutôt que de s'en remettre à
 * une précédence — un lecteur ne devrait jamais avoir à connaître un ordre de priorité pour lire
 * une règle.
 *
 * PORTÉE, ET SON COMPLÉMENT, parce qu'un balayage qui tait ce qu'il laisse dehors fait retrouver
 * les mêmes survivants :
 *   COUVERT — `@macro`, sur consigne EXPLICITE (Romain a dit macro), quel que soit l'ordre dans le
 *     fichier, que le nom soit employé ou non, et sur les deux formes d'un terminal (nue et
 *     décorée du registre).
 *   PAS COUVERT — les AUTRES déclarations qui créent un nom (alias, entrée, acteur, variable de
 *     travail, déclaration de symbole). Elles portent la MÊME ambiguïté ; les couvrir serait
 *     appliquer la règle plus large que la directive. Elles sont nommées et remontées, et
 *     l'arbitrage est chez Romain. Ce garde le VÉRIFIE plus bas : si l'une d'elles se mettait à
 *     refuser, il rougirait — une extension silencieuse est aussi une dérive.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const refus = (src) => (compileToBPxAST(src).errors || [])
  .map((e) => e.message ?? String(e)).filter((m) => /porte le nom d'un TERMINAL/.test(m));

// L'espace des SITUATIONS, pas la graphie du ticket : ce qui varie, c'est d'où vient l'alphabet et
// où se trouve la macro par rapport à lui.
const AMBIGUES = [
  ['alphabet de scène, macro après',  '@core\n@alphabet.western\n@macro G4 saw >> audio\nS -> C4 D4'],
  ['alphabet de scène, macro AVANT',  '@core\n@macro G4 saw >> audio\n@alphabet.western\nS -> C4 D4'],
  ['macro jamais employée',           '@core\n@alphabet.western\n@macro G4 saw >> audio\nS -> C4'],
  ['deux macros, une seule fautive',  '@core\n@alphabet.western\n@macro sain saw >> audio\n@macro G4 saw >> audio\nS -> C4'],
  ['alphabet porté par un acteur',    '@core\n@actor v\n  alphabet.western\n  transport.audio\n@macro G4 saw >> audio\nS -> v.C4'],
];
const PROPRIETES = [
  ['est refusée', (r) => r.length >= 1],
  ['le refus NOMME le conflit (un terminal de l\'alphabet)', (r) => r.some((m) => /TERMINAL de l'alphabet actif/.test(m))],
  ['le refus dit que l\'ambiguïté est de LECTURE', (r) => r.some((m) => /ne dirait plus si elle joue la note ou la macro/.test(m))],
  ['le refus propose la SORTIE (changer de nom)', (r) => r.some((m) => /Choisir un autre nom/.test(m))],
  ['le refus dit qu\'il tombe à la DÉCLARATION', (r) => r.some((m) => /DÉCLARATION/.test(m))],
];
console.log(`[macro homonyme] ${AMBIGUES.length} situations × ${PROPRIETES.length} propriétés`);
for (const [nom, src] of AMBIGUES) {
  const r = refus(src);
  for (const [prop, verif] of PROPRIETES) ok(verif(r), `${nom} — ${prop}`);
}

// TÉMOINS QUE LA RÈGLE N'EMPORTE PAS LES CAS VALIDES. Un refus qui déborde est une régression,
// pas une garde — et il ne se verrait QUE par ces lignes-ci.
const LEGITIMES = [
  ['un mot du geste',                 '@core\n@alphabet.western\n@macro grondement saw >> audio\nS -> C4 D4'],
  ['un nom PROCHE d\'un terminal',    '@core\n@alphabet.western\n@macro G4_v saw >> audio\nS -> C4 D4'],
  ['un terminal d\'un AUTRE alphabet','@core\n@alphabet.western\n@macro sa saw >> audio\nS -> C4 D4'],
  ['aucun alphabet résolu',           '@core\n@macro G4 saw >> audio\nS -> C4 D4'],
];
for (const [nom, src] of LEGITIMES) ok(refus(src).length === 0, `LÉGITIME ${nom} — doit passer`);

// LA PORTÉE NE S'EST PAS ÉTENDUE TOUTE SEULE. Ces déclarations portent la même ambiguïté et
// restent VOLONTAIREMENT permises : l'arbitrage est chez Romain. Si l'une se met à refuser, ce
// témoin rougit et la portée doit être re-décidée, pas constatée après coup.
const HORS_PORTEE_ASSUMEE = [
  ['un alias',                 '@core\n@alphabet.western\n@alias G4 cc:2\nS -> C4 D4'],
  ['une variable de travail',  '@core\n@alphabet.western\n@var G4\nS -> C4 G4'],
  ['une déclaration de gate',  '@core\n@alphabet.western\ngate G4:sc\nS -> C4'],
];
for (const [nom, src] of HORS_PORTEE_ASSUMEE) {
  ok(refus(src).length === 0,
    `HORS PORTÉE ${nom} — doit rester permis tant que Romain n'a pas étendu la règle`);
}

if (echecs.length) {
  console.error(`[macro homonyme] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[macro homonyme] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
