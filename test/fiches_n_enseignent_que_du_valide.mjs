#!/usr/bin/env node
/**
 * GARDE — une FICHE de l'autorité ne doit enseigner que des graphies que le compilateur accepte.
 *
 * POURQUOI ELLE EXISTE, et c'est une leçon payée en une journée. La forme positionnelle
 * `cc(98,0)` n'est pas née dans le code d'un frontal : elle était **écrite dans la fiche du
 * contrôle**, `lib/controls.json`, description littérale « Generic MIDI CC: cc(number, value) ».
 * Deux agents l'ont réécrite de bonne foi en traduisant `_script`, parce qu'ils lisaient
 * l'autorité. Retirer le code qui la fait survivre ne suffit pas : tant que la fiche
 * l'ENSEIGNE, la forme renaît à la première lecture.
 *
 * Le hardcode faisait survivre la forme ; la description, elle, l'apprend à qui la lit.
 *
 * COMMENT ELLE MARCHE, et pourquoi elle ne nomme aucune forme. Elle n'a pas de liste de
 * graphies interdites — elle EXTRAIT ce que les fiches montrent et le passe au COMPILATEUR.
 * Ce que le compilateur refuse, la garde le refuse. Elle suit donc le langage sans qu'on la
 * mette à jour : le jour où une forme devient invalide, toute fiche qui l'enseigne encore fait
 * échouer le portillon, sans qu'une ligne de ce fichier ait bougé.
 *
 * CE QU'ELLE NE COUVRE PAS, et il faut le savoir : elle ne juge que les extraits qu'elle sait
 * RECONNAÎTRE comme du BPScript (appel `nom(args)` d'un contrôle déclaré, et paire
 * `(clé:valeur)`). Une prose qui décrit une forme invalide sans l'écrire lui échappe. Elle
 * prouve qu'aucune fiche ne MONTRE d'exemple mort — rien d'autre.
 */
import { LIBS } from '../src/transpiler/libs-data.js';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { universeControlNames } from '../src/transpiler/libs.js';

const NOMS = universeControlNames();
const EN_TETE = '@core\n@alphabet.western:midi\n@mode:ord\n';

/** Compile un extrait dans les DEUX régimes ; il suffit qu'un des deux l'accepte pour qu'il soit
 *  une graphie vivante (un contrôle de flux n'a pas à compiler en contenance et réciproquement). */
function accepte(extrait) {
  for (const regle of [`S -> ${extrait} C4 D4`, `S -> C4 D4 ${extrait}`, `S -> !${extrait} C4`]) {
    try {
      const r = compileToBPxAST(`${EN_TETE}${regle}\n`);
      if (!r.errors || r.errors.length === 0) return true;
    } catch { /* forme illisible dans ce régime : on essaie le suivant */ }
  }
  return false;
}

/** Extraits RECONNAISSABLES comme du BPScript dans une chaîne de fiche.
 *  Le `_` en tête est exclu : `_script(CTn)`, `_rndseq`, `_srand(N)` sont du texte BP3 hérité,
 *  cité comme référence au moteur — pas du BPScript, et ce garde n'a pas à les juger. */
function extraits(texte) {
  const out = [];
  for (const m of texte.matchAll(/(?<![_\w`])([a-zA-Z][\w]*)\s*\(([^)]*)\)/g)) {
    // Appel `nom(args)` d'un contrôle DÉCLARÉ, dont les arguments ressemblent à des valeurs
    // (chiffres, virgules, signes) — sinon c'est de la prose entre parenthèses.
    if (NOMS.has(m[1]) && /^[\d\s,.\-+/]*$/.test(m[2]) && m[2].trim() !== '') out.push(m[0]);
  }
  for (const m of texte.matchAll(/\(([a-zA-Z][\w]*)\s*:\s*([^)]+)\)/g)) {
    if (NOMS.has(m[1])) out.push(m[0]);
  }
  // Composant pointé : `(cc.98:45)`. Le sous-nom est capté QUEL QU'IL SOIT, pas seulement
  // numérique — sinon la garde ne verrait jamais la faute qu'elle est censée attraper : une fiche
  // qui écrirait `(cc.foo:45)` lui échapperait exactement parce que c'est invalide. (Vérifié : ma
  // première version, restreinte aux chiffres, ne mordait pas sur l'injection de contrôle.)
  for (const m of texte.matchAll(/\(([a-zA-Z][\w]*)\.([\w]+)\s*:\s*([^)]+)\)/g)) {
    if (NOMS.has(m[1])) out.push(m[0]);
  }
  return out;
}

const morts = [];
let examines = 0;
const parcourir = (o, chemin) => {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach((v, i) => parcourir(v, `${chemin}[${i}]`)); return; }
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') {
      for (const e of extraits(v)) {
        examines++;
        if (!accepte(e)) morts.push({ chemin: `${chemin}.${k}`, extrait: e });
      }
    } else parcourir(v, `${chemin}.${k}`);
  }
};
for (const [nom, lib] of Object.entries(LIBS)) parcourir(lib, nom);

// TÉMOIN ANTI-VACUITÉ. Un garde qui n'extrait rien, ou qui accepte tout, passerait au vert sans
// rien prouver — c'est exactement ce qu'on a payé ailleurs. Deux preuves : qu'il a bien du
// matériau, et que son critère DISCRIMINE (une graphie qu'on sait morte doit être refusée).
const temoins = [];
if (examines < 2) temoins.push(`n'a extrait que ${examines} graphie(s) — trop peu pour qu'un vert veuille dire quoi que ce soit`);
if (accepte('(cc.98)')) temoins.push("accepte '(cc.98)' (composant sans valeur) — son critère ne discrimine pas");
if (accepte('(cc.foo:45)')) temoins.push("accepte '(cc.foo:45)' (composant non numéroté) — son critère ne discrimine pas");

if (temoins.length) {
  console.error('❌ fiches : le garde lui-même est creux');
  for (const t of temoins) console.error(`   - ${t}`);
  process.exitCode = 1;
} else if (morts.length) {
  console.error(`❌ fiches : ${morts.length} graphie(s) enseignée(s) que le compilateur REFUSE`);
  for (const m of morts) console.error(`   - ${m.chemin} montre « ${m.extrait} »`);
  console.error('   Une fiche qui enseigne une forme morte la fait renaître à la première lecture.');
  process.exitCode = 1;
} else {
  console.log(`✅ fiches des librairies — ${examines} graphie(s) extraite(s) et compilée(s), toutes acceptées`);
}
