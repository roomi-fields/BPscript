#!/usr/bin/env node
/**
 * GARDE — LA LISTE PUBLIÉE DES MOTS DE GRAMMAIRE SE REMESURE À CHAQUE PASSE.
 *
 * Décision Romain, 2026-08-21 (`trois-categories-de-noms-la-grammaire-le-socle-et-les-librairies`) :
 * le vocabulaire se partage en trois, et le partage commande ce qu'un auteur peut redéfinir. La
 * décision dit aussi ce qui manquait : *« La liste exacte des mots de grammaire n'existe nulle part.
 * Elle s'établit avant que le refus se pose : une liste supposée protégerait les mauvais mots. »*
 *
 * ⛔ ET UNE LISTE ÉCRITE À LA MAIN EST EXACTEMENT CE QUE CE DÉPÔT A PASSÉ LA JOURNÉE À RETIRER. Sept
 * copies de la liste des champs de fichier, dont deux avaient divergé sans que rien ne rougisse.
 * Publier une liste de mots sans la remesurer en écrirait une huitième.
 *
 * ⇒ CE GARDE EST CE QUI TIENT LIEU DE GÉNÉRATION : il REJOUE l'épreuve qui a établi la liste, à
 * chaque passe du portillon, et refuse tout écart avec la donnée publiée. La liste ne peut donc pas
 * dériver du code sans être vue — ni en gagnant un mot, ni en en perdant un.
 *
 * ⛔ L'ÉPREUVE, ET UN RELEVÉ SUR LE CODE NE LA REMPLACE PAS. Mon premier instrument était un motif
 * sur les comparaisons du parseur : il rend `'string'`, `'prereglage'`, `'structure'` — des natures
 * de nœud, pas des mots du langage. **L'épreuve de substitution** écrit la même ligne avec le mot,
 * puis avec un nom fabriqué : si la ligne cesse d'être lue de la même façon, le mot porte la
 * structure.
 *
 * ⚠️ ET LA LISTE EST UN PLANCHER, la donnée le dit. Neuf candidats sur dix-neuf n'ont donné aucune
 * ligne légitime que je sache écrire — `gate`, `trigger` et `cv` parce qu'ils sont SORTIS (retirés du
 * lexeur le 2026-08-24) ; `var`, `scene`, `expose`, `template` parce que la table des mots sortis les
 * porte aussi. **Une position qu'on ne sait pas construire n'est pas une absence.**
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { readFileSync } from 'node:fs';
import { LIBS } from '../src/transpiler/libs-data.js';
import { SYNTAXE } from '../src/transpiler/syntaxe-data.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

// ⛔ LES DIX-NEUF CANDIDATS AVEC LEUR LIGNE LÉGITIME. Chacune est passée au compilateur : une ligne
// qui ne compile pas ne juge rien, et le volet A l'exige explicitement plutôt que de la compter
// comme un verdict — c'est le défaut qui a fait rendre « socle cassé » à ma première matrice.
const CAS = [
  ['def', 'def a C4'],
  ['actor', 'actor a alphabet.western'],
  ['object', 'object zz (x:1)'],
  ['var', 'var a'],
  ['in', 'in.midi pedale'],
  ['out', 'out.midi'],
  ['init', 'init\n  `js: 1`'],
  ['gate', 'gate x:midi'],
  ['trigger', 'trigger x:midi'],
  ['cv', 'cv x:midi'],
  ['terminal', 'terminal a voice.wobble'],
  ['mode', 'mode:ord'],
  ['seed', 'seed:1'],
  ['scene', 'scene s'],
  ['expose', 'expose a'],
  ['template', 'template t'],
  ['timepatterns', 'timepatterns t'],
  ['duration', 'duration:2'],
  ['core', 'core'],
];

const scene = (tete) => `core\nalphabet.western\n${tete}\n-----\nS -> C4\n`;
const CHAMPS = ['defs', 'actors', 'vars', 'inputs', 'declarations', 'scenes', 'exposes', 'backticks', 'homomorphisms'];
const empreinte = (src) => {
  const r = compileToBPxAST(src);
  if ((r.errors || []).length) return 'REFUSÉ';
  const a = r.ast || {};
  return CHAMPS.filter((c) => Array.isArray(a[c]) && a[c].length).join(',')
    + (a.init && a.init.length ? ',init' : '') || 'directives';
};

// ── A. L'ÉPREUVE, REJOUÉE ────────────────────────────────────────────────────────────────────
const structurels = [];
const socleCasse = [];
for (const [mot, ligne] of CAS) {
  const avec = empreinte(scene(ligne));
  if (avec === 'REFUSÉ') { socleCasse.push(mot); continue; }
  const sans = empreinte(scene(ligne.replace(new RegExp(`\\b${mot}\\b`), 'zzzq')));
  if (avec !== sans) structurels.push(mot);
}
structurels.sort();
ok(CAS.length >= 15, `A. SOCLE : au moins quinze candidats doivent être éprouvés — ${CAS.length}`);
ok(structurels.length > 0,
  `A. SOCLE : l'épreuve doit trouver au moins un mot structurel, sinon elle ne mesure plus rien. `
  + `Socle cassé sur : ${socleCasse.join(', ')}`);
console.log(`[mots de grammaire] ${CAS.length} candidats · ${structurels.length} structurels · `
  + `${socleCasse.length} sans ligne légitime (${socleCasse.join(' ')})`);

// ── B. LA DONNÉE PUBLIÉE DIT EXACTEMENT CE QUE L'ÉPREUVE MESURE ──────────────────────────────
{
  const g = SYNTAXE.grammarWords;
  ok(g && typeof g === 'object', 'B. `grammarWords` doit exister dans la porte du schéma de syntaxe');
  const publies = [...(g?.mots || [])].sort();
  const enTrop = publies.filter((m) => !structurels.includes(m));
  const manquants = structurels.filter((m) => !publies.includes(m));
  ok(enTrop.length === 0,
    `B. ⛔ ${enTrop.join(', ')} : publié comme mot de grammaire, et l'épreuve ne le trouve PAS `
    + `structurel. Une liste qui protège un mot que le code ne porte plus protège le mauvais mot — `
    + `c'est le risque exact que la décision du 2026-08-21 nomme.`);
  ok(manquants.length === 0,
    `B. ⛔ ${manquants.join(', ')} : l'épreuve le trouve structurel et la donnée ne le publie pas. `
    + `Un mot de grammaire absent de la liste est un mot qu'un auteur pourra ombrer.`);
}

// ── C. LA QUALITÉ EST PUBLIÉE AVEC LA LISTE ──────────────────────────────────────────────────
// ⛔ UNE LISTE SANS SA QUALITÉ SE LIT COMME UN INVENTAIRE. Atlas a nommé ce risque avant la pose :
// un lecteur qui reçoit dix mots sans savoir que c'est un PLANCHER conclut qu'il n'y en a que dix.
{
  const g = SYNTAXE.grammarWords || {};
  ok(g.qualite === 'plancher',
    `C. la liste doit publier sa QUALITÉ — reçu ${JSON.stringify(g.qualite)}. Neuf candidats sur `
    + `dix-neuf n'ont donné aucune ligne légitime ; sans ce mot, la liste se lit comme exhaustive.`);
  // ⛔ LA MÉTHODE ET LE PÉRIMÈTRE ONT CHANGÉ DE DOMICILE, ILS N'ONT PAS DISPARU — décision de
  // Romain, 2026-09-01 : *« pourquoi tu notes des principes consignés dans une librairie ? d'autant
  // que c'est incompréhensible pour un utilisateur »*. Ils pesaient 925 octets dans la donnée
  // PUBLIÉE, que tout consommateur reçoit ; ils vivent désormais en COMMENTAIRE de `lib/core.bpsl`,
  // où un mainteneur les lit et où aucun paquet ne les transporte.
  // ⚠️ CE GARDE CHANGE DONC DE CIBLE, IL NE SE TAIT PAS : l'exigence reste entière — *« une absence
  // n'est une preuve que si le périmètre de recherche est établi »* —, elle porte sur la SOURCE au
  // lieu du bundle. Faire simplement tomber ces deux volets aurait été ajuster l'assertion à ce qui
  // sort.
  // La liste a QUITTÉ `core` le 2026-09-03 (le schéma est dissous) : elle vit dans le schéma de
  // SYNTAXE, et sa méthode en commentaire du générateur de sa porte.
  const source = readFileSync(new URL('../src/transpiler/syntaxe-bundle.mjs', import.meta.url), 'utf8');
  const entete = source;
  ok(/EPREUVE DE SUBSTITUTION A TROIS TEMOINS/i.test(entete),
    `C. et sa MÉTHODE — comment la liste a été établie, en COMMENTAIRE de src/transpiler/syntaxe-bundle.mjs. Un relevé `
    + `sur le code rend un mélange inutilisable ; qui veut la refaire doit savoir par quoi.`);
  ok(/19 candidats/i.test(entete),
    `C. et son PÉRIMÈTRE — combien de candidats, tirés d'où, en COMMENTAIRE de src/transpiler/syntaxe-bundle.mjs. Une `
    + `absence n'est une preuve que si le périmètre de recherche est établi.`);
  ok(g.methode === undefined && g.perimetre === undefined,
    `C. et ils ne sont PLUS dans la donnée publiée — une librairie dit ce que le langage porte, `
    + `jamais la méthode qui a servi à l'établir. Reçu : ${JSON.stringify(Object.keys(g))}`);
}

// ── D. LES MOTS DÉCIDÉS SORTIS SONT NOMMÉS, PAS TUS ──────────────────────────────────────────
// ⛔ `object` EST STRUCTUREL DANS LE CODE ET SORTI PAR DÉCISION (`MOTS-SORTIS.md`, 2026-08-16, « non
// câblé »). Le taire ferait mentir la liste dans un sens ou dans l'autre : l'omettre contredirait
// l'épreuve, le publier sans le dire ferait protéger un mot retiré. La donnée porte les deux faits.
{
  const g = SYNTAXE.grammarWords || {};
  const sortis = g.sortisDuLangage || [];
  ok(Array.isArray(sortis),
    'D. la liste doit nommer ceux de ses mots qu\'une décision a retirés, même s\'ils sont encore lus');
  for (const m of sortis) {
    ok((g.mots || []).includes(m),
      `D. '${m}' est annoncé sorti et ne figure pas dans la liste — un mot sorti QU'ON NE LIT PLUS `
      + `n'a rien à faire ici : ce champ ne nomme que l'écart entre une décision et le code.`);
    ok(structurels.includes(m),
      `D. '${m}' est annoncé sorti-mais-câblé et l'épreuve ne le trouve plus structurel : l'écart est `
      + `CLOS, retire-le de ce champ et de la liste.`);
  }
}

if (e.length) {
  console.error(`[mots de grammaire] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[mots de grammaire] ${p} PASS / 0 FAIL — ${structurels.join(' ')}`);
