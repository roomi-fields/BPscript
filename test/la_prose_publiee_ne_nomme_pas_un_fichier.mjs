#!/usr/bin/env node
/**
 * LA PROSE PUBLIÉE NOMME UN MOT DÉCLARÉ, JAMAIS UN FICHIER.
 *
 * Une description voyage dans le paquet jusqu'aux consommateurs et jusqu'à l'aide publiée. Quand
 * elle écrit `lib/variation.json`, elle apprend au lecteur une adresse que le langage a fermée — et
 * elle devient fausse le jour où la source change de format, sans que rien ne rougisse.
 *
 * ⛔ SIX DESCRIPTIONS ÉTAIENT DANS CE CAS, ET C'EST ATLAS QUI LES A VUES — dans son aide publiée,
 * pas dans ma donnée. Cinq citaient `lib/variation.json`, dont la source est en BPScript depuis
 * une bascule antérieure ; la sixième citait `lib/mod.json`, archivé. La librairie `variation`, elle,
 * existe : c'est le CHEMIN qui était périmé, pas le vocabulaire.
 *
 * ⚠️ ET C'EST MA PROPRE RÈGLE, RETOURNÉE CONTRE MA PROSE. « Le format d'un fichier n'est pas une
 * information utile à qui veut la donnée » gouvernait mon code depuis six lecteurs trompés ; ma
 * donnée publiée l'enseignait à l'envers dans le même mouvement.
 *
 * ⚠️ SON PORTILLON N'EN AVAIT NOMMÉ QUE DEUX SUR SEPT chez lui. « Un garde qui nomme deux défauts
 * sur sept dit surtout où il ne regarde pas » — d'où celui-ci, qui balaye le paquet ENTIER.
 */
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// Un chemin de fichier de librairie, quelle que soit son extension — la règle porte sur le CHEMIN,
// pas sur le format, sans quoi elle se périmerait à la prochaine bascule.
const CHEMIN = /\blib\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+/;

// ⚠️ LES CORPS DE FONCTION SONT DU CODE, PAS DE LA PROSE. Ils portent leurs propres commentaires
// d'auteur, qui nomment légitimement les fichiers du dépôt ; les exclure est une exclusion PROUVÉE,
// pas un confort — le champ s'appelle `body` et il est rempli par la capture des sources TypeScript.
const EXCLU = new Set(['body']);

let examines = 0;
const fautes = [];
const marche = (o, chemin) => {
  for (const [k, v] of Object.entries(o || {})) {
    if (EXCLU.has(k)) continue;
    const ici = [...chemin, k];
    if (typeof v === 'string') { examines++; if (CHEMIN.test(v)) fautes.push([ici.join('.'), v]); }
    else if (v && typeof v === 'object') marche(v, ici);
  }
};
marche(LIBS, []);

ok(examines > 0, `A. ZÉRO texte examiné dans le paquet — ce garde n'a rien lu.`);
for (const [ou, texte] of fautes) {
  const m = CHEMIN.exec(texte);
  ok(false, `B. « ${ou} » nomme un FICHIER — ${m[0]}. Une prose publiée nomme le MOT que la `
          + `librairie déclare, jamais son chemin : le format d'une source change, le mot non.`);
}
if (!fautes.length) passe++;

// ⛔ ET LE TÉMOIN QUI DISCRIMINE — sans lui, « zéro faute » ne se distingue pas de « la sonde ne
// voit rien ». On fabrique le cas au lieu de l'observer.
{
  const faux = { controls: { x: { description: 'les freres vivent dans lib/variation.json ; voir' } } };
  let vu = 0;
  const sonde = (o) => { for (const [k, v] of Object.entries(o || {})) {
    if (EXCLU.has(k)) continue;
    if (typeof v === 'string') { if (CHEMIN.test(v)) vu++; } else if (v && typeof v === 'object') sonde(v); } };
  sonde(faux);
  ok(vu === 1, `C-témoin. la sonde doit voir un chemin FABRIQUÉ — vu ${vu}. Un zéro rendu par une `
             + `sonde muette a la même forme qu'un zéro rendu par une donnée propre.`);
}

if (echecs.length) {
  console.error(`❌ la prose publiée nomme un fichier : ${echecs.length} occurrence(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ la prose publiée ne nomme aucun fichier — ${examines} texte(s) du paquet examiné(s), `
  + `corps de fonction exclus, sonde éprouvée sur un cas fabriqué. ${passe} vérification(s) passée(s).`);
