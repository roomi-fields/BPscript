#!/usr/bin/env node
/**
 * ⛔ GARDE SUSPENDU — GEL MODULATION / PATCHING (Romain, 2026-08-09).
 *
 * « On gèle tout ce qui est modulation/patching. » Et geler un sujet gèle CE QUI LE SERT : on ne
 * SUPPRIME pas, on SUSPEND avec motif daté, et on attend.
 *
 * ⚠️ CE GARDE AVAIT ÉTÉ SUPPRIMÉ le 2026-08-09 au motif que « son sujet n'existe plus », les
 * directives qu'il éprouve ayant été retirées du langage le matin même. C'ÉTAIT LE MAUVAIS GESTE :
 * le sujet ne disparaît pas, il DORT — il revient avec le remaniement Dedale/FaustX, sous une
 * autre graphie. Un garde supprimé emporte avec lui ce qu'il gardait ; un garde suspendu le dit.
 *
 * ⚠️ ET LE JOUR MÊME, CETTE SUPPRESSION A COÛTÉ : le garde de la validation de modulation a été
 * retiré parce que « son sujet n'existe plus », alors que le CODE qu'il surveillait tournait
 * toujours — il lit une section supprimée, rend donc toujours vide, et accepte désormais une
 * modulation vers une source inexistante. Le sujet du GARDE avait disparu ; celui du CODE non.
 *
 * RALLUMAGE : au dégel du chantier Dedale/FaustX. L'ordre des chantiers est fixé par Romain —
 * 1. conformité à LANGUAGE.md hors patching, 2. un point ISO-100, 3. et seulement ensuite FaustX.
 *
 * Le corps du garde est CONSERVÉ INTACT sous ce drapeau : il n'y a rien à réinventer au dégel.
 */
const GEL_MODULATION_PATCHING = true;
if (GEL_MODULATION_PATCHING) {
  console.log('⏸️  SUSPENDU — gel modulation/patching (Romain 2026-08-09), rallumage au dégel Dedale/FaustX.');
  process.exit(0);
}

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
  .map((e) => e.message ?? String(e))
  .filter((m) => /TERMINAL de l'alphabet actif|déjà pris/.test(m));

// L'espace des SITUATIONS, pas la graphie du ticket : ce qui varie, c'est d'où vient l'alphabet et
// où se trouve la macro par rapport à lui.
const AMBIGUES = [
  ['alphabet de scène, macro après',  'core\nalphabet.western\nmacro G4 saw >> audio\n-----\nS -> C4 D4'],
  ['alphabet de scène, macro AVANT',  'core\nmacro G4 saw >> audio\nalphabet.western\n-----\nS -> C4 D4'],
  ['macro jamais employée',           'core\nalphabet.western\nmacro G4 saw >> audio\n-----\nS -> C4'],
  ['deux macros, une seule fautive',  'core\nalphabet.western\nmacro sain saw >> audio\nmacro G4 saw >> audio\n-----\nS -> C4'],
  ['alphabet porté par un acteur',    'core\nactor v\n  alphabet.western\n  out.audio\nmacro G4 saw >> audio\n-----\nS -> v.C4'],
];
const PROPRIETES = [
  ['est refusée', (r) => r.length >= 1],
  ['le refus NOMME le conflit (un terminal de l\'alphabet)', (r) => r.some((m) => /TERMINAL de l'alphabet actif/.test(m))],
  ['le refus dit que l\'ambiguïté est de LECTURE', (r) => r.some((m) => /ne dirait plus si elle joue la note/.test(m))],
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
  ['un mot du geste',                 'core\nalphabet.western\nmacro grondement saw >> audio\n-----\nS -> C4 D4'],
  ['un nom PROCHE d\'un terminal',    'core\nalphabet.western\nmacro G4_v saw >> audio\n-----\nS -> C4 D4'],
  ['un terminal d\'un AUTRE alphabet','core\nalphabet.western\nmacro sa saw >> audio\n-----\nS -> C4 D4'],
  // ⚠️ UN TÉMOIN « aucun alphabet résolu » VIVAIT ICI — RETIRÉ le 2026-07-29, et son retrait
  // DURCIT la règle. Il affirmait qu'une scène sans convention de notes laisse `macro G4`
  // légitime : c'était la description de ma zone aveugle, pas d'une règle. Depuis la cascade
  // core, une scène qui se tait hérite de `western`, donc `G4` y est une note et la règle mord.
  // Ce qui reste légitime, c'est la hauteur OPAQUE — et elle, elle est testée ci-dessous.
  ['hauteur OPAQUE invoquée : l\'alphabet est ABSENT pour de vrai (loi 35)',
   'core\nmine.perso.gamme\nmacro G4 saw >> audio\n-----\nS -> C4 D4'],
];
for (const [nom, src] of LEGITIMES) ok(refus(src).length === 0, `LÉGITIME ${nom} — doit passer`);

// LA PORTÉE NE S'EST PAS ÉTENDUE TOUTE SEULE. Ces déclarations portent la même ambiguïté et
// restent VOLONTAIREMENT permises : l'arbitrage est chez Romain. Si l'une se met à refuser, ce
// témoin rougit et la portée doit être re-décidée, pas constatée après coup.
// ⚠️ LES TROIS TÉMOINS « HORS PORTÉE » ONT ÉTÉ RETIRÉS ICI le 2026-07-28, ET C'EST DÉLIBÉRÉ.
// Ils gardaient que l'alias, la variable de travail et la déclaration de symbole restent PERMIS
// tant que la règle ne couvrait que la macro. Romain a étendu : un seul espace de noms, tout ce
// qui CRÉE un nom est unique. Deux d'entre eux sont donc devenus FAUX — un alias ou une variable
// nommés comme une note sont maintenant refusés — et les garder aurait fait rougir la règle même
// qu'ils étaient censés protéger.
// Le troisième, la déclaration de symbole, n'a PAS disparu : il a déménagé dans la garde générale,
// où il tient la distinction ratifiée (une PROPRIÉTÉ posée sur un nom existant reste permise).
// Retirer un témoin est un rétrécissement : il se justifie, il ne se fait pas en silence.
const COUVERTES_AILLEURS = [
  ['un alias nommé comme une note',      'core\nalphabet.western\nalias G4 cc:2\n-----\nS -> C4 D4'],
  ['une variable nommée comme une note', 'core\nalphabet.western\nsymbol G4\n-----\nS -> C4 G4'],
];
for (const [nom, src] of COUVERTES_AILLEURS) {
  ok(refus(src).length >= 1,
    `${nom} — désormais REFUSÉ par la règle générale (l'était pas quand seule la macro comptait)`);
}

if (echecs.length) {
  console.error(`[macro homonyme] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[macro homonyme] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
