// correspondance.mjs — LE COUPLE GRAMMAIRE ↔ AUXILIAIRES, lu chez son propriétaire.
//
// LA TABLE FAIT FOI : `kanopi/packages/library/test-assets/bp3/correspondance.json`, produite par
// `bp3-engine/scripts/table-correspondance.py`. Elle est la SEULE porteuse du couple. Avant elle,
// la correspondance survivait dans le nom partagé — `-gr.trial.mohanam` allait avec
// `-se.trial.mohanam` — et le renommage du versement l'a rompue.
//
// ⛔ CE MODULE REMPLACE TROIS SOURCES QUI DISAIENT LA MÊME CHOSE CHEZ MOI, et les trois sont
// supprimées dans le même mouvement :
//   1. `grammars.json` → `php_ref.settings` et `php_ref.alphabet` — ma recopie du couple ;
//   2. le reniflage du CORPS de la grammaire pour un `-se.X` ;
//   3. le reniflage du CORPS pour un `-al.X`.
// Les deux reniflages étaient le mécanisme même que la table existe pour remplacer : deviner le
// couple d'après ce qui traîne dans le texte. Les garder « en repli » aurait fait exactement ce
// qu'une voie parallèle fait toujours — servir en silence là où la table n'est pas d'accord.
//
// ⚠️ CE QUE LA BASCULE A APPORTÉ, MESURÉ AVANT DE LA FAIRE : la table déclare 96 réglages et 53
// alphabets, tous présents dans `test-data`. Mon catalogue en déclarait 13 et 22 de moins — elle
// est plus riche, pas seulement différente.
//
// ⚠️ ET DEUX DÉSACCORDS VONT DANS L'AUTRE SENS, ils sont NOMMÉS et non arbitrés ici :
// `checkVolChan` et `tryConsoleMaxTime`, où je déclarais un réglage que la table met à `null`.
// La question est chez bp3-engine, propriétaire de la table. En attendant, la table fait foi —
// c'est le sens de la bascule — et l'écart est porté au rapport, jamais compensé par un repli.
//
// La table porte aussi des rôles que je ne passe pas au binaire (`-cs`, `-so`, `-to`). Ne pas les
// passer est un état mesuré, pas un oubli : les ajouter changerait des productions scellées.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FICHIER_CORRESPONDANCE } from './corpus.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
// La table vit chez Kanopi, à côté du corpus qu'elle décrit — son adresse est DÉCLARÉE là-bas,
// jamais recomposée ici : un chemin recopié rend zéro en silence le jour où la racine bouge.
export const FICHIER_TABLE = FICHIER_CORRESPONDANCE;

let _cache = null;
function charger() {
  if (_cache) return _cache;
  if (!fs.existsSync(FICHIER_TABLE)) {
    // ⛔ PAS DE REPLI. Un repli sur l'ancienne recopie rendrait une mesure sous une autre source
    // sans le dire — et c'est précisément ce qu'on vient de supprimer.
    throw new Error(`table de correspondance introuvable : ${FICHIER_TABLE}. Elle est la SEULE `
      + `porteuse du couple grammaire↔auxiliaires ; il n'y a pas de seconde source à interroger.`);
  }
  const t = JSON.parse(fs.readFileSync(FICHIER_TABLE, 'utf8'));
  const par = new Map();
  for (const e of Object.values(t.grammaires || {})) if (e && e.nom) par.set(e.nom, e);
  _cache = { par, meta: { produit_par: t.produit_par, moteur: t.moteur, n: t.n } };
  return _cache;
}

/** Les métadonnées de la table — pour qu'une mesure puisse citer d'où vient son couple. */
export function metaTable() { return charger().meta; }

/**
 * Le couple d'une grammaire, par son nom DE CORPUS — celui de la scène chez Kanopi, qui est aussi
 * la clé de mon catalogue.
 *
 * ⚠️ CE N'EST PAS LE NOM AMONT, et la distinction m'a coûté deux grammaires à la bascule. La table
 * porte les DEUX : `nom` est le nom de corpus, `nom_amont` est celui du fichier `-gr.` d'origine.
 * Les deux coïncident presque partout, ce qui rend l'erreur invisible — `asymmetric` s'appelle
 * `asymmetric1` en amont, `flags` s'appelle `tryFlags`, et interroger la table par le nom amont
 * rendait `null` pour elles seules. Une production VIDE, pas une erreur.
 *
 * @param {string} nomCorpus
 * @returns {{settings: string|null, alphabet: string|null, convention: string|null}|null}
 *   `null` si la table ne connaît pas ce nom. Les champs valent `null` quand la table déclare
 *   explicitement qu'il n'y a pas d'auxiliaire — une absence déclarée, pas une absence devinée.
 */
export function coupleDe(nomCorpus) {
  const { par } = charger();
  const e = par.get(nomCorpus);
  if (!e) return null;
  const aux = e.auxiliaires || {};
  return {
    settings: aux['-se']?.nom_amont ?? null,
    alphabet: aux['-al']?.nom_amont ?? null,
    convention: e.convention ?? null,
  };
}
