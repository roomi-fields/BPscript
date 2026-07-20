/**
 * PONT KAIROS — résout une session BPx en jetons PORTEURS DE HAUTEUR.
 *
 * POURQUOI CE MODULE EXISTE (recadrage Romain, note [651]) : la mesure se fait EN SORTIE DE
 * KAIROS, jamais en sortie BPx. `session.emit('timed-tokens')` est PRÉ-RÉSOLUTION — il rend
 * le nom écrit, sans hauteur. Comparer là revenait à imputer au langage des écarts qui ne
 * sont que « la chaîne n'est pas branchée » : mon classement des DIFF en quatre causes
 * (transposition, degré, octave, durée) était en réalité UNE seule cause — Kairos absent.
 *
 * OÙ IL VIT, ET POURQUOI PAS AILLEURS : à CÔTÉ de `compare_modal.cjs`, jamais dedans. Le
 * comparateur est le juge unique des deux voies et doit rester ignorant de BPx et de Kairos —
 * il compare des jetons, il ne sait pas les fabriquer. Ce module fabrique ; l'autre juge.
 *
 * UNION DES CATALOGUES À L'EXÉCUTION (approuvé archi [641], co-signé bp3-frontend [643]) :
 * mes catalogues AGNOSTIQUES sont la base, chaque voie passe LE SIEN en paramètre et il est
 * fusionné ici. C'est ce qui permet à la Voie A d'apporter ses alphabets `bp3_*` sans que
 * j'installe du vocabulaire BP3 dans une librairie qui se veut agnostique du moteur.
 * NE JAMAIS déplacer `bp3_english`/`bp3_fr`/`bp3_indian` dans `lib/alphabets.json`.
 *
 * FORME D'APPEL — calquée sur le golden de Kairos (`kairos/src/projection/c4key-octave-e2e.test.ts`),
 * pour que A et B appellent d'une seule voix : `session.derive().tree`, puis
 * `session.buildProjectionContext('chronological')` (le hook que BPx expose EXPRÈS), puis
 * `projeter(tree, ctx).query(...)`. Trois pièges que j'ai payés : l'arbre est le RETOUR de
 * `derive()` (pas `_lastTree`), le contexte prend l'ORDRE en argument, et la Timeline se lit
 * par `.query(début, fin)` — sans quoi elle paraît vide.
 *
 * ⚠️ `digitalLib` SE PREND DANS LE BUNDLE (`libs-data.js`, `LIBS['digital']`), JAMAIS en
 * lisant `lib/digital.json` sur le disque. Les deux ne portent pas la même chose et c'est
 * VOULU : la vérité d'un corps de manipulation est son fichier `lib/digital/<nom>.ts` (typé
 * contre le SDK Kairos) ; l'étape de bundle en capte la SOURCE et l'injecte dans le bundle.
 * `digital.json` ne porte que la déclaration (description, rang, paramètres) — sans corps.
 *
 * J'ai payé cette distinction : en lisant le JSON du disque, mon pont ne voyait aucun corps,
 * Kairos criait « déclarée au vocabulaire mais SANS fonction exécutable », et j'en ai conclu
 * à tort que la lib était un catalogue de noms vides. Elle ne l'était pas — je lisais le
 * mauvais artefact. Ne jamais passer `{objects:{}}` non plus : un vocabulaire vide ferait
 * passer `transpose` pour un contrôle runtime ordinaire, transmis verbatim donc
 * SILENCIEUSEMENT ignoré. Le bundle, et rien d'autre.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/**
 * Les catalogues de hauteur, côté bpscript — la BASE agnostique de l'union.
 *
 * `test_alphabets` est le SIXIÈME, ajouté le 2026-07-20 : il manquait, et son absence était
 * INVISIBLE. Une scène qui le déclare (`@test_alphabets.abc`) compilait sans une erreur, puis
 * ne produisait aucune hauteur — le fichier n'arrivait simplement jamais jusqu'à Kairos. Le
 * symptôme sortait tout en bas de la chaîne, très loin de sa cause, qui était ici.
 */
const FICHIERS_HAUTEUR = ['alphabets', 'tunings', 'temperaments', 'scales', 'octaves', 'test_alphabets'];

function catalaguesDeBase() {
  const lire = (nom) => JSON.parse(readFileSync(path.join(ROOT, 'lib', `${nom}.json`), 'utf-8'));
  return Object.fromEntries(FICHIERS_HAUTEUR.map((n) => [n, lire(n)]));
}

/**
 * Union catalogue de base ⊎ catalogue de la voie appelante. Fusion PAR AXE et par clé ;
 * l'appelant peut AJOUTER des entrées, jamais écraser silencieusement une entrée de base
 * portant le même nom — une collision est une erreur, pas une préférence (deux définitions
 * différentes du même nom rendraient A et B incomparables sans que rien ne le signale).
 */
export function unirCatalogues(base, apport = {}) {
  const out = {};
  for (const axe of FICHIERS_HAUTEUR) {
    const a = base[axe] || {};
    const b = apport[axe] || {};
    const collisions = Object.keys(b).filter(
      (k) => !k.startsWith('_') && k !== 'domain' && Object.prototype.hasOwnProperty.call(a, k),
    );
    if (collisions.length) {
      throw new Error(
        `[pont-kairos] collision de catalogue sur '${axe}' : ${collisions.join(', ')}. `
        + `L'apport d'une voie AJOUTE des entrées, il n'en redéfinit aucune — sinon les deux `
        + `voies résoudraient le même nom différemment sans que la comparaison le voie.`,
      );
    }
    out[axe] = { ...a, ...b };
  }
  return out;
}

/**
 * Résout une session BPx DÉJÀ construite en jetons porteurs de hauteur.
 *
 * @param session      session BPx (non dérivée : on appelle `derive()` ici pour tenir l'arbre).
 * @param opts.apport  catalogues propres à la voie appelante (fusionnés à la base).
 * @param opts.ordre   'chronological' (défaut) | 'voice-major'.
 * @returns {{tokens: Array<{token,start,end,hz}>, duration: number}}
 *          `start`/`end` en MILLISECONDES — l'unité de la forme canonique de parité
 *          (`kairos/docs/PROJECTION.md` §2) et celle des captures natives. Kairos rend des
 *          secondes ; la conversion vit ici, pas chez le comparateur.
 */
export async function resoudreViaKairos(session, opts = {}) {
  const { projeter } = await import('/home/romi/dev/bp/kairos/dist/index.js');
  const pitchLib = unirCatalogues(catalaguesDeBase(), opts.apport);
  // Le BUNDLE, pas le JSON du disque : lui seul porte les corps (cf. en-tête).
  const { LIBS } = require('../src/transpiler/libs-data.js');
  const digitalLib = LIBS.digital;
  // REGISTRE D'HOMOMORPHISME — jumeau structurel de `digitalLib`, et il manquait.
  //
  // Kairos SUBSTITUE l'étiquette à la résolution (modèle carry-only : BPScript porte la
  // table, BPx la porte aussi sans réécrire l'arbre, Kairos résout). Sa fabrique de
  // substituteur rend `undefined` si la LIB *ou* les tables manquent, et retombe alors sur
  // l'identité — donc des terminaux BRUTS, sans la moindre erreur. Tables présentes mais
  // lib absente : c'était exactement notre symptôme sur `tryhomomorphism`.
  //
  // ⚠️ Passer cette lib n'est sûr QUE parce que BPx est carry-only sur ce chemin. La preuve
  // est dans la mesure elle-même : l'arbre dérivé rend le jeton BRUT `a`, pas `do4` déjà
  // substitué. Si la substitution avait lieu en amont, l'ajouter ici la DOUBLERAIT.
  const homomorphismeLib = LIBS.homomorphism;

  const tree = session.derive().tree;
  const contexte = {
    ...session.buildProjectionContext(opts.ordre || 'chronological'),
    pitchLib,
    digitalLib,
    homomorphismeLib,
  };
  const timeline = projeter(tree, contexte);

  // Le TEMPS devient réel ici, et nulle part ailleurs : Kronos possède l'unique pont
  // t_scène ↔ t_audio (forme d'appel donnée par kronos, note [301], `resolveSchedule`).
  // Déterministe : horloge virtuelle, aucun temps réel, deux appels rendent le même flux.
  // `derivedTempo` est le tempo FROID de la dérivation, pas un tempo de session.
  const { resolveSchedule } = await import('/home/romi/dev/bp/kronos/dist/index.js');
  // Forme de retour `{ events, totalDurationSec }` (kronos [302], 5ceaeec — la note [301]
  // rendait un tableau nu). La durée totale vient de Kronos : c'est LUI qui résout le temps,
  // la `duration` de la Timeline Kairos est encore en secondes de SCÈNE.
  const planifie = resolveSchedule(timeline, { derivedTempo: tree.metadata?.tempo });

  const tokens = [];
  for (const e of planifie.events) {
    const c = e.content;
    // ⚠️ CE FILTRE PORTAIT SUR LA HAUTEUR, ET C'ÉTAIT UN DÉFAUT DE MESURE.
    // Il écartait toute feuille sans `pitch` — donc TOUTE LA PERCUSSION. Les grammaires de
    // bols (dhati2, la famille tabla) dérivent parfaitement : mesuré sur dhati2, Kronos rend
    // 12 événements, tous porteurs d'un jeton (`dha`, `ti`, `trkt`…), et TOUS sans hauteur.
    // Le pont les jetait tous et je lisais « 0 jeton », que j'ai failli imputer à la dérivation.
    // Un bol n'a pas de hauteur et n'a pas à en avoir : la référence native de ces grammaires
    // est de modalité TEXTE et ne compare que des NOMS.
    // Ce qui fait qu'une feuille est mesurable, c'est donc qu'elle porte un JETON — pas une
    // hauteur. La hauteur reste facultative et n'est jamais inventée : `hz` n'est renseigné
    // que lorsque Kairos l'a réellement résolu.
    if (!c || c.token === undefined) continue;
    tokens.push({
      token: c.token,
      start: Math.round(e.onset * 1000),
      end: Math.round((e.onset + e.duration) * 1000),
      hz: c.pitch ? c.pitch.hz : undefined,
    });
  }
  return { tokens, duration: planifie.totalDurationSec };
}
