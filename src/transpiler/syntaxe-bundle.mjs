/**
 * GÉNÉRATEUR DE LA PORTE DU SCHÉMA DE SYNTAXE.
 *
 * ⛔ LE SCHÉMA DE SYNTAXE N'EST PAS UNE LIBRAIRIE — décision Romain, 2026-08-20
 * (`le-schema-de-syntaxe-sort-des-librairies`). Il ne se déclare pas, il ne s'invoque pas, aucune
 * scène ne l'écrit : c'est ce que le LANGAGE EST, lu par le compilateur et par les outils qui
 * décrivent le vocabulaire. Il vivait dans `lib/`, où chaque règle sur les librairies devait
 * l'excepter.
 *
 * ⛔ ET IL LUI FAUT UN ARTEFACT, PAS UNE FONCTION — exigence 4 d'Atlas, 2026-08-21. Son contrat
 * (`ce-qu-un-banc-lit-chez-son-voisin`) lui INTERDIT l'arbre de travail d'un voisin : il lit
 * `git show <branche publiée>:<chemin>` et importe le résultat. `describeVocabulary()` ne peut donc
 * pas le servir — une fonction ne s'appelle qu'après avoir chargé un paquet DEPUIS UN DISQUE,
 * c'est-à-dire depuis un arbre qui bouge sous lui.
 *
 * ⚠️ LA DISTINCTION QUI L'AVAIT MASQUÉ : « par la porte » contre « par le chemin » était juste pour
 * Kanopi, qui consomme le paquet installé, et FAUSSE pour Atlas, qui lit un commit. Deux voisins,
 * deux contraintes, et ils avaient été mis dans le même sac.
 *
 * CE QUE LA PORTE PORTE, ET RIEN DE PLUS : les 7 mots de syntaxe et les 2 entrées de valeurs de
 * directive qu'Atlas consomme — mesuré chez lui, `lib('language')` ne prend même pas `name`.
 * Elle porte AUSSI sa PROVENANCE (exigence 3), pour que la ligne `source:` de son inventaire se
 * DÉRIVE au lieu de se recopier.
 *
 * Usage : node src/transpiler/syntaxe-bundle.mjs > src/transpiler/syntaxe-data.js
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = 'schema-syntaxe/language.json';
const schema = JSON.parse(readFileSync(join(__dirname, '..', '..', SOURCE), 'utf-8'));

// ⛔ ON NE RECOPIE PAS LE FICHIER, ON EN DÉRIVE LA SURFACE. Les champs de fichier — `name`,
// `description`, `version` — décrivent la source, pas le langage ; les publier ferait croire que
// le consommateur peut s'y fier. La porte rend ce que le langage EST.
const porte = {
  _source: `BPscript/${SOURCE}`,
  syntaxWords: schema.syntaxWords,
  directiveValues: schema.directiveValues,
  // ⛔ LES MOTS DE LA GRAMMAIRE — dissous du schéma de `core` le 2026-09-03 (Romain) : ce sont les
  // mots avec lesquels on écrit la STRUCTURE, et ils appartiennent au langage, pas à une librairie.
  // Décision du 2026-08-21 : le vocabulaire se partage en trois — la GRAMMAIRE, qu'un auteur ne peut
  // jamais ombrer ; le SOCLE, qui ne bouge pas ; les LIBRAIRIES, ombrables et dont l'ombrage
  // s'annonce. Cette liste porte la première catégorie, et elle est un PLANCHER : ce qui n'a pas su
  // être construit ne compte pas comme une absence.
  //
  // COMMENT LES DIX ONT ÉTÉ ÉTABLIS — 19 candidats éprouvés le 2026-08-24, tirés de trois sources :
  // les comparaisons du parseur, le schéma de syntaxe publié, et les cinq mots que la décision du
  // 2026-08-21 nomme. Chaque candidat passe une EPREUVE DE SUBSTITUTION A TROIS TEMOINS, la même
  // ligne écrite quatre fois : un nom FABRIQUÉ teste l'existence et ne prouve rien sur la structure ;
  // un nom de CATALOGUE teste l'invocation et passe en tête sans porter de structure ; une ENTRÉE de
  // catalogue invoquée teste la STRUCTURE et elle seule — le langage la déclare légale à la place
  // d'un type, donc si le mot passe là où une entrée échoue, c'est le langage qui le porte.
  // ⚠️ Un témoin à UN SEUL nom fabriqué ne suffit pas : mesure du 2026-08-31, il rendait `core`
  // porteur de structure alors qu'il est un catalogue, et laissait `init` indécidable. Et un relevé
  // sur le CODE ne l'établit pas — il mélange natures de nœud et mots du langage.
  // ⛔ CETTE MÉTHODE VIT EN COMMENTAIRE, PLUS DANS LA DONNÉE — décision de Romain, 2026-09-01 : elle
  // pesait 925 octets dans le paquet que tout consommateur reçoit, et n'a de lecteur qu'ici.
  grammarWords: schema.grammarWords,
  // Les pierres tombales de graphie — dissoutes du schéma de `core` le 2026-09-03. Elles disent ce
  // qui REMPLACE un mot retiré, là où le refus générique n'apprendrait rien.
  bracketRewrites: schema.bracketRewrites,
  actorKeyRewrites: schema.actorKeyRewrites,
};

// ⛔ ET LE GÉNÉRATEUR REFUSE DE PRODUIRE UNE PORTE VIDE — exigence 2 d'Atlas. Un `?? {}` chez moi
// publie « zéro mot de syntaxe » chez lui, et ZÉRO MOT A LA MÊME GRAPHIE QU'UNE MESURE. Le refus
// se pose ICI, à la production : une porte vide ne peut pas exister, donc aucun consommateur n'a
// à s'en défendre.
for (const [nom, valeur] of Object.entries(porte)) {
  if (nom === '_source') continue;
  if (!valeur || typeof valeur !== 'object' || !Object.keys(valeur).length) {
    console.error(`[syntaxe] ⛔ '${nom}' est vide ou absent dans ${SOURCE} — la porte du schéma de `
      + `syntaxe ne se publie pas vide. Un consommateur lirait « le langage n'a aucun mot », qui a `
      + `exactement la graphie d'une mesure.`);
    process.exit(1);
  }
}

let sortie = '// Auto-generated by syntaxe-bundle.mjs — do not edit\n';
sortie += '// LA PORTE DU SCHÉMA DE SYNTAXE — ce que le langage EST : ses mots et les valeurs de\n';
sortie += '// ses directives. Artefact VERSIONNÉ, lisible par `git show` sans construction.\n\n';
sortie += `const SYNTAXE = ${JSON.stringify(porte, null, 1)};\n\n`;
sortie += 'export { SYNTAXE };\n';
process.stdout.write(sortie);
