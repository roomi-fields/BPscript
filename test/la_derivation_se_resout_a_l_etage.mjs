#!/usr/bin/env node
/**
 * GARDE — LA DÉRIVATION SE RÉSOUT À L'ÉTAGE, UNE FOIS, ET DES DEUX CÔTÉS.
 *
 * Phase 2 du chantier du compilateur. Un exemplaire hérite des membres de son prototype qu'il
 * n'écrit pas ; ce qu'il écrit gagne. Le lien parent est déjà dans l'arbre — `varType.type`.
 *
 * ⛔ CE QUE CE GARDE EXISTE POUR TENIR, ET C'EST LA RAISON D'ÊTRE DE L'ÉTAGE : la même règle vaut
 * dans une SCÈNE et dans une SOURCE DE LIBRAIRIE, parce que les deux entrent par la voie unique.
 * *« Une règle qui vaudrait à l'entrée et pas au fond d'un sac n'est pas une règle, c'est un cas. »*
 * Les deux côtés sont exercés ici, sur le même mécanisme.
 *
 * ⛔ ET IL TIENT LA SECONDE MOITIÉ DE L'ARBITRAGE. Romain, 2026-08-29 : *« dans les librairies,
 * porter sinon ça n'a aucun sens »* — l'arbre GRAVE, le paquet PORTE. La greffe est donc marquée, et
 * le générateur du bundle republie ce que la SOURCE écrit.
 *
 * ⚠️ ET LE CORPUS NE FOURNIT PAS CE CAS — MESURÉ, IL FAUT LE FABRIQUER. Sur les 190 exemplaires des
 * sources de librairie, 4 seulement ont leur parent dans le même arbre, et ces 4 parents sont VIDES
 * (`object gamut` : Romain, 2026-08-25, *« on ne fait pas de prédéfinition d'objet vide »*). La
 * résolution pose donc ZÉRO greffe sur le corpus d'aujourd'hui — le reste des parents vit dans une
 * AUTRE source, et n'est atteignable qu'une fois le prototype publié.
 *
 * ⇒ **Donc l'égalité du paquet ne prouve RIEN ici** : un filtre qui n'a rien à filtrer a la même
 * empreinte qu'un filtre qui ne filtre plus. Le volet G FABRIQUE une dérivation porteuse dans une
 * source de librairie, hors arbre, régénère le paquet, et exige que la greffe n'y soit pas — puis
 * RETIRE le filtre et exige que le paquet grossisse. C'est le retrait qui prouve le filtre.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { resoudre } from '../src/transpiler/resolution.js';

const RACINE = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** Les membres d'une déclaration, tels que l'arbre les porte — écrits et hérités, dans l'ordre. */
const membres = (ast, nom) => {
  const dans = [...((ast && ast.vars) || []), ...((ast && ast.defs) || [])];
  const n = dans.find((x) => (x.names || [x.name]).includes(nom));
  return n && n.settings ? (n.settings.pairs || []) : [];
};
const valeur = (ast, nom, cle) => (membres(ast, nom).find((p) => p.key === cle) || {}).value;
const herite = (ast, nom, cle) => Boolean((membres(ast, nom).find((p) => p.key === cle) || {}).herite);
const compile = (src) => {
  const r = compileToBPxAST(src, {});
  ok(!(r.errors || []).length,
     `SOCLE : la source témoin doit compiler, sinon ce qui suit mesure un arbre absent. `
     + `Reçu : ${(r.errors || [])[0]?.message?.slice(0, 90)}`);
  return r.ast || {};
};

// ── A. UNE SCÈNE — l'héritage arrive, et il se distingue de ce qui est écrit ──────────────────
{
  const ast = compile('core\ndef alphabet (scope:scene, documented:true)\nalphabet western (scope:flow)\n'
    + '-----\nS -> C4\n');
  ok(valeur(ast, 'western', 'documented') === 'true',
     `A. ⛔ L'HÉRITAGE N'ARRIVE PAS : « western » dérive d'« alphabet » et ne porte pas son `
     + `« documented ». Le lien parent est dans l'arbre depuis toujours ; c'est la résolution qui `
     + `manquait. Membres reçus : ${JSON.stringify(membres(ast, 'western').map((p) => p.key))}`);
  ok(herite(ast, 'western', 'documented'),
     `A. le membre hérité n'est pas MARQUÉ — sans la marque, le générateur du bundle le republierait `
     + `et le paquet recopierait l'héritage sur chaque exemplaire, contre l'arbitrage du 2026-08-29.`);
  ok(!herite(ast, 'western', 'scope'),
     `A. un membre ÉCRIT par l'exemplaire est marqué hérité — la marque ne distinguerait plus rien.`);
  ok(membres(ast, 'alphabet').every((p) => !p.herite),
     `A. le PROTOTYPE a reçu une greffe — il ne dérive de rien de déclaré, il n'a rien à recevoir.`);
}

// ── B. CE QUI EST ÉCRIT GAGNE — le témoin qui ne discriminait pas avant ───────────────────────
{
  const ast = compile('core\ndef alphabet (scope:scene)\nalphabet western (scope:flow)\n-----\nS -> C4\n');
  ok(valeur(ast, 'western', 'scope') === 'flow',
     `B. ⛔ LA SURCHARGE EST ÉCRASÉE : « western » écrit scope:flow et rend `
     + `${JSON.stringify(valeur(ast, 'western', 'scope'))}. Un héritage qui écrase l'écrit est une `
     + `fusion, pas une dérivation.`);
  ok(membres(ast, 'western').filter((p) => p.key === 'scope').length === 1,
     `B. « scope » figure DEUX fois — l'écrit et l'hérité coexistent, et le lecteur choisit lequel. `
     + `C'est « deux mécanismes pour un seul fait, et la profondeur choisit lequel ».`);
}

// ── C. LA REMONTÉE EST TRANSITIVE, et le plus proche gagne sur le plus lointain ───────────────
{
  const ast = compile('core\ndef a (x:racine, y:racine)\na b (y:milieu)\nb c (z:feuille)\n-----\nS -> C4\n');
  ok(valeur(ast, 'c', 'x') === 'racine',
     `C. ⛔ LA REMONTÉE S'ARRÊTE AU PREMIER PARENT. Mesuré sur les librairies : 387 exemplaires `
     + `remontent d'un cran, 179 de deux, 7 de trois. Un mécanisme qui s'arrête au premier serait `
     + `juste sur 387 cas et faux sur 186, sans que rien ne rougisse.`);
  ok(valeur(ast, 'c', 'y') === 'milieu',
     `C. ⛔ LE PLUS LOINTAIN GAGNE — « c » reçoit ${JSON.stringify(valeur(ast, 'c', 'y'))} au lieu de `
     + `« milieu ». La chaîne se remonte du plus proche vers la racine, et le premier trouvé tient.`);
  ok(valeur(ast, 'c', 'z') === 'feuille' && !herite(ast, 'c', 'z'),
     `C. ce que la feuille écrit elle-même a été altéré.`);
}

// ── D. LA PARENTHÈSE ABSENTE VAUT PARENTHÈSE VIDE — et elle hérite ───────────────────────────
{
  const ast = compile('core\ndef alphabet (scope:scene)\nalphabet plain\n-----\nS -> C4\n');
  ok(valeur(ast, 'plain', 'scope') === 'scene' && herite(ast, 'plain', 'scope'),
     `D. ⛔ UN EXEMPLAIRE SANS CORPS N'HÉRITE PAS. « la parenthèse absente vaut parenthèse vide, et `
     + `le type voyage » — un sac fermé n'est pas une raison de ne rien recevoir. `
     + `Membres : ${JSON.stringify(membres(ast, 'plain').map((p) => p.key))}`);
}

// ── E. CE QUI N'EST PAS DÉCLARÉ N'EST PAS REFUSÉ, et rien ne boucle ──────────────────────────
{
  const ast = compile('core\nalphabet.western\ndef seul (a:1)\n-----\nS -> C4\n');
  ok(membres(ast, 'seul').length === 1,
     `E. « def seul » a reçu une greffe : « def » est la RACINE du prototypal, elle ne se `
     + `déclare jamais et ne transmet rien.`);

  // ⛔ LE CYCLE SE FABRIQUE DANS L'ARBRE : le langage ne l'écrit pas, l'étage doit y survivre.
  const boucle = { vars: [
    { varType: { kind: 'type', type: 'q' }, names: ['p'], settings: { type: 'SettingBag', pairs: [{ key: 'a', value: 1 }] } },
    { varType: { kind: 'type', type: 'p' }, names: ['q'], settings: { type: 'SettingBag', pairs: [{ key: 'b', value: 2 }] } },
  ] };
  const r = resoudre(boucle, {});
  ok(r.greffes === 2,
     `E. ⛔ UN CYCLE DE DÉRIVATION NE REND PAS DEUX GREFFES — reçu ${r.greffes}. Chacun doit recevoir `
     + `l'unique membre de l'autre, une fois, sans boucler.`);
}

// ── F. UNE SOURCE DE LIBRAIRIE — la même règle, l'autre côté ──────────────────────────────────
{
  const ast = compile('def temoin (documented:true, section:controls)\n'
    + 'def reglage (scope:scene, bp3:none)\nreglage vitesse (bp3:tempo)\n');
  ok(valeur(ast, 'vitesse', 'scope') === 'scene' && herite(ast, 'vitesse', 'scope'),
     `F. ⛔ L'HÉRITAGE N'ARRIVE PAS DANS UNE SOURCE DE LIBRAIRIE. C'est la raison d'être de l'étage : `
     + `une scène et une librairie passent par la MÊME voie, donc par le même mécanisme. Si ce volet `
     + `rougit alors que A passe, la résolution est branchée sur un chemin et pas sur l'autre.`);
  ok(valeur(ast, 'vitesse', 'bp3') === 'tempo',
     `F. la surcharge ne tient pas du côté librairie.`);
}

// ── G. LE PAQUET NE RECOPIE PAS L'HÉRITAGE — cas FABRIQUÉ, puis filtre RETIRÉ ─────────────────
{
  // Le corpus ne porte aucune dérivation porteuse : on l'écrit, hors arbre, et on régénère.
  const bac = mkdtempSync(join(tmpdir(), 'bpscript-derivation-'));
  try {
    const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: RACINE }).split('\n').filter(Boolean);
    ok(suivis.length >= 100, `G. SOCLE : assiette de ${suivis.length} fichier(s) — trop peu pour régénérer.`);
    for (const f of suivis) { mkdirSync(join(bac, dirname(f)), { recursive: true }); cpSync(join(RACINE, f), join(bac, f)); }
    execFileSync('ln', ['-s', join(RACINE, 'node_modules'), join(bac, 'node_modules')]);

    // LA DÉRIVATION PORTEUSE : un prototype qui porte VRAIMENT un membre, et un exemplaire qui
    // ne l'écrit pas. Le membre choisi est absent de tout le reste, pour qu'aucun homonyme ne
    // brouille le compte.
    const source = 'def temoin_derivation (documented:true, section:controls)\n'
      + 'def socle_temoin (marque_heritee:oui)\n'
      + 'socle_temoin exemplaire_temoin (bp3:none)\n';
    writeFileSync(join(bac, 'lib/temoin_derivation.bpsl'), source);

    // ⛔ LE JUGE VISE L'ENTRÉE, JAMAIS LE TEXTE. Ma première écriture cherchait le membre partout
    // dans le paquet régénéré, et elle rougissait sur un filtre qui fonctionne : le PROTOTYPE porte
    // ce membre, écrit dans sa source, et il a toute raison d'être publié. Un juge qui ne distingue
    // pas le prototype de son exemplaire accuse la donnée correcte.
    const regenerer = () => {
      const brut = execFileSync('node', ['src/transpiler/libs-bundle.js'], { cwd: bac, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const ligne = brut.split('\n').find((l) => l.startsWith('LIBS["temoin_derivation"] ='));
      if (!ligne) return null;
      return JSON.parse(ligne.replace('LIBS["temoin_derivation"] = ', '').replace(/;\s*$/, ''));
    };
    const avec = regenerer();
    const entree = (lib) => lib && lib.controls && lib.controls.exemplaire_temoin;
    ok(entree(avec) && entree(avec).bp3 === 'none',
       `G. SOCLE : l'exemplaire témoin n'est pas dans le paquet régénéré — tout zéro qui suivrait `
       + `mesurerait la greffe manquée, pas le filtre. Reçu : ${JSON.stringify(avec)?.slice(0, 120)}`);
    ok(entree(avec) && !('marque_heritee' in entree(avec)),
       `G. ⛔ LE PAQUET RECOPIE L'HÉRITAGE. Romain, 2026-08-29 : « dans les librairies, porter sinon `
       + `ça n'a aucun sens ». L'arbre grave, le paquet porte — un membre hérité n'a rien à faire `
       + `sur l'exemplaire publié. Reçu : ${JSON.stringify(entree(avec))}`);
    ok(avec && avec.controls && avec.controls.socle_temoin
       && avec.controls.socle_temoin.marque_heritee === 'oui',
       `G. le PROTOTYPE a perdu son membre — il l'écrit dans sa source, le filtre n'a pas à le lui `
       + `retirer. Un filtre qui emporte l'écrit avec l'hérité coupe trop large.`);

    // ⛔ L'INJECTION QUI PROUVE LE FILTRE : on le RETIRE, et le paquet doit grossir. Sans ce
    // retrait, ce volet serait vert dans un dépôt où le filtre n'existe pas — le corpus ne pose
    // aucune greffe, et « rien à filtrer » a la même empreinte que « ne filtre plus ».
    const chemin = join(bac, 'src/transpiler/libs-bundle.js');
    const texte = readFileSync(chemin, 'utf8');
    const ancre = '        if (p.herite) continue;';
    ok(texte.includes(ancre),
       `G. ⛔ ANCRE INTROUVABLE « ${ancre} » — le filtre a changé de graphie, et l'injection `
       + `mesurerait un fichier qu'elle n'a pas modifié. Un garde se prouve sur la graphie que le `
       + `code ÉCRIT, jamais sur celle qu'on croit qu'il écrit.`);
    writeFileSync(chemin, texte.replace(ancre, '        // filtre retiré par injection'));
    const sans = regenerer();
    ok(entree(sans) && 'marque_heritee' in entree(sans),
       `G. ⛔ LE FILTRE RETIRÉ NE CHANGE RIEN — l'injection ne mord pas, donc le volet précédent ne `
       + `prouvait pas le filtre. Une injection qui ne mord pas se suspecte elle-même.`);
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}

// ── H. LE COMPTE DE GREFFES DISCRIMINE — un corpus sans dérivation et une résolution morte ────
{
  const rien = resoudre({ vars: [{ varType: { kind: 'type', type: 'object' }, names: ['x'] }] }, {});
  ok(rien.greffes === 0, `H. une déclaration sans parent déclaré rend ${rien.greffes} greffe(s).`);
  const une = resoudre({ vars: [
    { varType: { kind: 'type', type: 'object' }, names: ['p'], settings: { type: 'SettingBag', pairs: [{ key: 'a', value: 1 }] } },
    { varType: { kind: 'type', type: 'p' }, names: ['e'] },
  ] }, {});
  ok(une.greffes === 1,
     `H. ⛔ LE COMPTE NE MONTE PAS sur une dérivation réelle — reçu ${une.greffes}. Sans lui, une `
     + `résolution morte et un corpus sans dérivation ont la même empreinte, et c'est exactement `
     + `l'état du corpus d'aujourd'hui : zéro greffe sur les 22 sources de librairie.`);
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(passe >= 20, `SOCLE : ${passe} vérification(s) seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ la dérivation à l'étage : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   ✗ ${e}`);
  process.exit(1);
}
console.log(`✓ ${passe} vérification(s) passée(s) — la dérivation se résout à l'étage, l'arbre grave, le paquet porte.`);
