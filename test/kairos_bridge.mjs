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
 * ⚠️ `digitalLib` : je passe DÉLIBÉRÉMENT `lib/digital.json` et non `{objects:{}}`. Un
 * vocabulaire vide ferait passer `transpose`/`chromashift` pour des contrôles runtime
 * ordinaires, transmis verbatim et donc SILENCIEUSEMENT ignorés — un fantôme. Avec la vraie
 * lib, Kairos crie sur toute manipulation déclarée sans corps exécutable. Ce cri est VOULU :
 * mes 5 manipulations sont aujourd'hui déclarées sans `body` (voir l'en-tête de digital.json),
 * et je préfère une chaîne qui hurle à une chaîne qui ment.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/** Les 5 catalogues de hauteur, côté bpscript — la BASE agnostique de l'union. */
function catalaguesDeBase() {
  const lire = (nom) => JSON.parse(readFileSync(path.join(ROOT, 'lib', `${nom}.json`), 'utf-8'));
  return {
    alphabets: lire('alphabets'),
    tunings: lire('tunings'),
    temperaments: lire('temperaments'),
    scales: lire('scales'),
    octaves: lire('octaves'),
  };
}

/**
 * Union catalogue de base ⊎ catalogue de la voie appelante. Fusion PAR AXE et par clé ;
 * l'appelant peut AJOUTER des entrées, jamais écraser silencieusement une entrée de base
 * portant le même nom — une collision est une erreur, pas une préférence (deux définitions
 * différentes du même nom rendraient A et B incomparables sans que rien ne le signale).
 */
export function unirCatalogues(base, apport = {}) {
  const out = {};
  for (const axe of ['alphabets', 'tunings', 'temperaments', 'scales', 'octaves']) {
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
  const digitalLib = JSON.parse(readFileSync(path.join(ROOT, 'lib', 'digital.json'), 'utf-8'));

  const tree = session.derive().tree;
  const contexte = {
    ...session.buildProjectionContext(opts.ordre || 'chronological'),
    pitchLib,
    digitalLib,
  };
  const timeline = projeter(tree, contexte);
  const evenements = timeline.query(0, Number.MAX_SAFE_INTEGER);

  const tokens = [];
  for (const e of evenements) {
    if (e.kind !== 'note') continue;
    const c = e.content;
    if (!c || c.pitch === undefined) continue; // feuille sans hauteur résolue : on ne l'invente pas
    const start = Math.round(c.startSec * 1000);
    tokens.push({ token: c.token, start, end: Math.round((c.startSec + c.durSec) * 1000), hz: c.pitch.hz });
  }
  return { tokens, duration: timeline.duration };
}
