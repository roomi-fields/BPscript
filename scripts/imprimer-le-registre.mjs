#!/usr/bin/env node
/**
 * IMPRIME LE REGISTRE DES LIBRAIRIES, EN JSON, SUR LA SORTIE STANDARD.
 *
 * ⛔ CE N'EST PAS LE BUNDLE QUI REVIENT. `libs-data.js` était un artefact ENREGISTRÉ que le
 * compilateur relisait — donc une seconde autorité sur la même donnée, et c'est pour ça qu'il est
 * sorti le 2026-09-04 (décision de Romain). Ici rien n'est écrit : le registre est construit en
 * compilant les sources, imprimé, et il disparaît avec le processus.
 *
 * ⇒ CE QUE ÇA SERT : un garde qui éprouve la donnée publiée dans un BAC DE SABLE — une copie du
 *   dépôt où l'on modifie une source pour voir ce que ça change. Il lui faut la donnée du BAC, pas
 *   celle d'ici, et un `import` la prendrait dans mon propre arbre.
 *
 * ⚠️ ET IL REFUSE D'IMPRIMER LE VIDE : un registre à zéro clé rendrait `{}`, qu'un garde comparerait
 * à `{}` sans rien voir. Un catalogue vide et un catalogue mort ont la même empreinte.
 */
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';

const registre = leRegistre();
const clés = Object.keys(registre);
if (clés.length < 5) {
  console.error(`[registre] ⛔ ${clés.length} librairie(s) — le registre ne s'est pas construit. `
    + `Un imprimeur qui rend le vide fait passer une mesure morte pour une mesure juste.`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify(registre, null, 1)}\n`);
