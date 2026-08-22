#!/usr/bin/env node
/**
 * LA BASCULE DU PAQUET — le seul site où mes artefacts publiés changent de contenu.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE. Mon dépôt est consommé VIVANT : sept voisins lisent
 * `src/transpiler/*-data.js` par lien symbolique, sans construction ni publication. Le geste qui les
 * atteint n'est donc PAS la poussée — c'est la RÉGÉNÉRATION. Or mon portillon ne tourne qu'au
 * crochet de poussée : `npm run bundle:libs` republiait tout mon paquet sans qu'aucun garde ne
 * s'exécute.
 *
 * ⛔ MESURÉ PAR INJECTION LE 2026-08-21, ET LE MODE D'ÉCHEC EST LE PIRE : j'ai retiré
 * `lib/midi.bpsl` dans une copie et lancé la bascule. CODE DE SORTIE 0. Le bundle est passé de 28 à
 * 27 clés, `midi` a disparu avec ses 37 contrôles, et RIEN N'A ROUGI — ni le générateur, ni le
 * garde de fraîcheur, qui vérifie que l'artefact est IDENTIQUE à sa régénération et trouve donc un
 * bundle amputé parfaitement frais.
 *
 * LE GESTE QUI SE VOIT N'EST PAS CELUI QUI AGIT. (Trouvé par BPx chez lui, même forme : son garde
 * était au crochet, trois commandes republiaient son paquet sans qu'aucun git n'intervienne.)
 *
 * ⚠️ CE QU'IL NE FAIT PAS : il ne juge pas le CONTENU d'une clé. Une valeur qui change n'est pas son
 * sujet — c'est celui du portillon, qui compare la donnée publiée champ par champ. Il tient une
 * seule chose : UNE CLÉ NE DISPARAÎT PAS EN SILENCE.
 *
 * Usage : npm run bundle:libs   (ce script, puis les générateurs)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');

/**
 * LES RETRAITS ASSUMÉS — une ligne par clé retirée du paquet, datée et motivée.
 * Y ajouter une entrée vaut « ce retrait est un geste, pas un accident ; j'ai mesuré ce qu'il
 * périme chez mes voisins et je les ai prévenus ».
 */
const RETRAITS_ASSUMES = [
  { cle: 'language', date: '2026-08-21',
    pourquoi: "le schéma de syntaxe n'est pas une librairie (décision Romain 2026-08-20) — il a sa "
            + "propre porte, `src/transpiler/syntaxe-data.js`, déclarée dans les exports. Atlas "
            + 'préavisé avec la porte exacte et une prédiction en quatre points AVANT la frappe.' },
  { cle: 'bp3-settings-template', date: '2026-08-21',
    pourquoi: "un gabarit de réglages natifs n'est pas une librairie (décision Romain 2026-08-21) — "
            + 'il a sa porte, `src/transpiler/gabarits-data.js`, et sa CLÉ ne change pas. '
            + 'bp3-frontend a simulé la bascule chez lui avant la frappe : 30/30 → 29/29, vert.' },
  { cle: 'modulation', date: '2026-08-22',
    pourquoi: "la librairie des cinq cibles de branchement est ARCHIVÉE (décision Romain "
            + '2026-08-22, « on l\'archive, elle va être remplacée par FaustX ») — elle vit '
            + 'désormais sous `docs/archive/modulation.json`, hors du dossier que le bundle '
            + 'balaie. MESURÉ AVANT LA FRAPPE sur les 390 scènes des deux dépôts : DEUX cessent '
            + 'de compiler, toutes deux chez kanopi (cv/cv-backtick.bps, '
            + "code-voices/cv-curve-js.bps), sur « attribut '(cutoff:…)' inconnu ». `cutoff`, "
            + '`amplitude`, `resonance` et `pitch` tombent sans recours ; `pan` SURVIT, tenu par '
            + 'sa déclaration de contrôle dans `lib/expression.bpsl`. kanopi préavisé avec la '
            + 'liste exacte, a répondu « frappe » et inscrit ses deux scènes en forme-à-venir '
            + 'dans le même mouvement.' },
];

/** Les clés du paquet publié, telles que le commit les porte. */
const clesCommitees = () => {
  let texte;
  try {
    texte = execFileSync('git', ['show', 'HEAD:src/transpiler/libs-data.js'],
      { encoding: 'utf8', cwd: RACINE, maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;              // pas de commit, pas de dépôt : rien à comparer, on laisse passer
  }
  return [...texte.matchAll(/^LIBS\["([^"]+)"\]/gm)].map((m) => m[1]);
};

/**
 * Les clés que la régénération produit — lues sur le CANDIDAT, pas sur le fichier posé.
 *
 * ⛔ ET CETTE DISTINCTION EST LE GESTE. Ma première écriture lisait `libs-data.js`, donc APRÈS le
 * `mv` : le refus criait sur un paquet DÉJÀ BASCULÉ. Mesuré par injection — la suppression de
 * `lib/midi.bpsl` était bien refusée, et le bundle portait quand même 27 clés au lieu de 28, midi
 * absent. Sept voisins l'avaient déjà.
 *
 * UN REFUS QUI ARRIVE APRÈS L'EFFET N'EST PAS UNE PORTE, C'EST UN CONSTAT. On lit donc le `.tmp`,
 * avant qu'il ne remplace quoi que ce soit : l'effet devient impossible au lieu d'être surveillé.
 */
const clesFraiches = () => {
  const candidat = process.argv[2];
  if (!candidat) {
    console.error('[bascule] ⛔ ce script attend le CANDIDAT en argument — le fichier `.tmp`, jamais '
      + "le paquet posé. Lu après le `mv`, son refus arriverait sur un paquet déjà basculé.");
    process.exit(1);
  }
  const texte = readFileSync(candidat, 'utf8');
  return [...texte.matchAll(/^LIBS\["([^"]+)"\]/gm)].map((m) => m[1]);
};

const avant = clesCommitees();
if (avant === null) process.exit(0);
const apres = new Set(clesFraiches());
const assumes = new Set(RETRAITS_ASSUMES.map((r) => r.cle));

// ⛔ UN GARDE COMPTE CE QU'IL A EXAMINÉ. Zéro clé lue voudrait dire que le motif ne lit plus le
// format du bundle — pas que le paquet est vide.
if (!avant.length || !apres.size) {
  console.error('[bascule] ⛔ aucune clé lue dans le paquet — le motif ne reconnaît plus le format '
    + `du bundle (commité : ${avant.length}, frais : ${apres.size}). Relire ce script, pas la donnée.`);
  process.exit(1);
}

const perdues = avant.filter((c) => !apres.has(c) && !assumes.has(c));
if (perdues.length) {
  console.error(`[bascule] ⛔ ${perdues.length} clé(s) DISPARAISSENT du paquet publié sans être `
    + `assumées : ${perdues.join(', ')}\n`
    + '          Sept voisins lisent ce fichier par lien symbolique : la bascule les atteint AVANT\n'
    + '          toute poussée, et le garde de fraîcheur ne la verra pas — un bundle amputé est\n'
    + "          parfaitement frais.\n"
    + "          Si le retrait est voulu : mesurer ce qu'il périme, prévenir les consommateurs, puis\n"
    + '          inscrire la clé dans RETRAITS_ASSUMES avec sa date et sa raison.');
  process.exit(1);
}

// ET LE REGISTRE NE RANCIT PAS : une entrée dont la clé est revenue ne protège plus rien.
const revenues = RETRAITS_ASSUMES.filter((r) => apres.has(r.cle));
if (revenues.length) {
  console.error(`[bascule] ⛔ ${revenues.length} retrait(s) inscrit(s) mais la clé est REVENUE dans `
    + `le paquet : ${revenues.map((r) => r.cle).join(', ')} — RETIRER l'entrée. Un registre qui `
    + 'garde des lignes mortes finit par ne plus rien dire.');
  process.exit(1);
}

console.log(`[bascule] ✓ ${apres.size} clé(s) publiées · ${avant.length} au commit · `
          + `${RETRAITS_ASSUMES.length} retrait(s) assumé(s) — aucune disparition silencieuse.`);
