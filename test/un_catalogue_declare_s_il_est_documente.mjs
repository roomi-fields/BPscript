#!/usr/bin/env node
/**
 * GARDE — CHAQUE CATALOGUE QUI DÉCLARE UN MOT DIT S'IL ENTRE DANS L'AIDE PUBLIÉE.
 *
 * Décision Romain, 2026-08-24 (`un-catalogue-declare-s-il-est-documente`) : *« je veux que les
 * alphabets de test restent invocables par `alphabet` mais ne soient pas documentés »*.
 *
 * ⛔ LA SÉPARATION SE FAIT À LA DOCUMENTATION, PAS À L'INVOCATION. `alphabet.abc` compile
 * exactement comme avant — c'est le volet C, et il FABRIQUE le cas au lieu de le supposer.
 *
 * ⛔ LE CHAMP PORTE UN MOT, ET LE TROISIÈME MOT EST REFUSÉ — une faute de frappe (`non`, `No`) se
 * lit comme `yes` chez qui compare la vérité de la valeur, et comme rien chez qui compte.
 *
 * ⚠️ ET LA RAISON QUE CE GARDE PORTAIT ÉTAIT FAUSSE. Il disait « le langage n'a pas de littéral
 * booléen : `documented:false` rend la CHAÎNE "false" ». Mesuré au PARSEUR — vrai — et conclu sur le
 * PAQUET, où c'est faux : `libs-bundle.js` rend `'true'` et `'false'` à leur nature, et mon paquet
 * porte 74 booléens réels. **J'ai mesuré à un étage et conclu sur le suivant**, puis routé
 * l'argument à quatre destinataires. runtime-midi l'a réfuté avec mon propre paquet publié.
 *
 * ⇒ Ce qui reste vrai est plus étroit : le champ porte UNE graphie. Deux graphies pour un fait — un
 * mot ici, un booléen là — se lisent différemment chez deux lecteurs, et c'est ce que ce garde tient.
 * **Le choix entre le mot et le booléen se refait sur la mesure juste ; il n'est pas tranché ici.**
 *
 * ⚠️ CE QUI A RENDU LA DÉCISION NÉCESSAIRE, ET QUI EST DE MOI : `test_alphabets` et `alphabets`
 * déclarent LE MÊME MOT. Le 2026-08-23 la conversion d'`alphabets` a changé son rang dans le
 * bundle, le catalogue de TEST est devenu l'autorité de l'axe `alphabet`, et sept gardes sont
 * tombés d'un coup. Le mélange était déjà là ; le rang l'a seulement rendu visible.
 *
 * LES VOLETS :
 *   A. tout catalogue qui déclare un mot porte le champ — et le compte refuse d'avoir vu zéro
 *   B. TOUT le paquet le porte — l'absence était un TROISIÈME état, mesuré par runtime-midi
 *
 * ⛔ ET LE CHAMP EST UN BOOLÉEN DEPUIS LE 2026-08-24 — arbitrage de Romain, ouvert par ma raison
 * fausse. `!lib.documented` est JUSTE ; avec les deux mots, `Boolean("no")` valait VRAI et piégeait
 * tout lecteur qui l'ignorait. La graphie qui a remplacé l'autre est celle que j'avais refusée.
 *   C. la séparation n'est PAS à l'invocation : une entrée non documentée compile
 *   D. le champ DISCRIMINE — un champ qui dirait `yes` partout n'exercerait rien chez le lecteur
 *   E. le convertisseur rend le champ, et on l'EXERCE au lieu de le compter
 *   F. injection dans le JUGE, sur les quatre formes qu'il doit refuser
 *   G. aucune SECONDE liste des champs de fichier — poser ce champ en a trouvé SIX
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LIBS } from '../src/transpiler/libs-data.js';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { CHAMPS_DE_FICHIER, entreesDe } from '../src/transpiler/libs-champs.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

// ⛔ DEUX VALEURS, ET CE SONT DES BOOLÉENS DEPUIS LE 2026-08-24 — arbitrage de Romain, ouvert par
// une raison FAUSSE de ma part. Voir l'en-tête : j'avais mesuré au parseur et conclu sur le paquet.
const VALEURS = [true, false];

/**
 * LE JUGE — écrit une fois, employé par le volet A et par son injection. Un juge recopié dans
 * l'injection ne prouve que la copie.
 */
function juger(nom, lib) {
  if (!Object.prototype.hasOwnProperty.call(lib, 'documented')) {
    return `${nom} : AUCUN champ 'documented' — le catalogue déclare le mot '${lib.resolves}' et `
      + `n'a jamais dit s'il entre dans l'aide. Le silence a voulu dire 'publie-le' pendant que huit `
      + `montages de test se documentaient sous le mot 'alphabet'.`;
  }
  const v = lib.documented;
  if (typeof v !== 'boolean') {
    return `${nom}.documented porte un ${typeof v} (${JSON.stringify(v)}) — le champ est un BOOLÉEN. `
      + `Une CHAÎNE y est le piège que ce champ a porté jusqu'au 2026-08-24 : \`Boolean("no")\` vaut `
      + `VRAI, donc un lecteur qui teste la vérité publie exactement ce que la donnée demande de cacher.`;
  }
  return null;
}

// ── A. TOUT CATALOGUE QUI DÉCLARE UN MOT PORTE LE CHAMP ──────────────────────────────────────
// Le périmètre vient de la DONNÉE, jamais d'une liste de noms : ce sont les catalogues qui
// déclarent `resolves`, exactement ceux que le générateur de fiches lit (il écarte les autres en
// comptant `sansMot`). Une liste tenue à la main ici périmerait au premier catalogue ajouté.
const catalogues = Object.entries(LIBS).filter(([, l]) => l && typeof l === 'object' && l.resolves);
ok(catalogues.length >= 20,
  `A. SOCLE : le bundle doit porter au moins 20 catalogues déclarant un mot — ${catalogues.length}. `
  + `Un garde qui n'a rien examiné serait vert sans rien voir.`);
{
  const fautifs = catalogues.map(([n, l]) => juger(n, l)).filter(Boolean);
  ok(fautifs.length === 0, `A. ${fautifs.length} catalogue(s) fautif(s) : ${fautifs.slice(0, 4).join(' · ')}`);
  console.log(`[documented] ${catalogues.length} catalogue(s) examiné(s) sur ${Object.keys(LIBS).length} clés publiées`);
}

// ── B. ⛔ TOUT LE PAQUET LE PORTE — L'ABSENCE ÉTAIT UN TROISIÈME ÉTAT ─────────────────────────
// ⛔ CE VOLET DISAIT L'INVERSE, ET C'EST runtime-midi QUI L'A RENVERSÉ, LE JOUR MÊME. J'avais borné
// le champ aux catalogues qui déclarent un mot, parce que c'est ce que le générateur de fiches lit.
// Sa mesure :
//
//     23 catalogues le portent · 3 ne le portent pas · ABSENT n'est pas "no"
//
// ⇒ Un lecteur qui énumère TOUT le paquet et écrit `=== "yes"` a raison 23 fois et se trompe 3 fois
//   EN SILENCE. Un champ qui dit un fait à deux états en portait TROIS à la lecture.
//
// Les trois instantanés de réglages BP3 portent donc `documented:false`, et c'est vrai : aucune fiche
// ne les recense. Le périmètre du générateur de fiches n'a pas à décider de la forme d'un champ que
// tout le monde lit.
{
  const muets = Object.entries(LIBS)
    .filter(([, l]) => l && typeof l === 'object' && !Object.prototype.hasOwnProperty.call(l, 'documented'))
    .map(([n]) => n);
  ok(muets.length === 0,
    `B. ⛔ ${muets.join(', ')} ne porte pas 'documented' — l'absence rouvre le TROISIÈME ÉTAT : un `
    + `lecteur qui compare au mot y lit \`undefined\`, et ABSENT n'est ni "yes" ni "no".`);
  // ⚠️ ET LE COMPTE COUVRE PLUS QUE LES CATALOGUES À MOT, sinon ce volet répéterait le volet A.
  const porteurs = Object.values(LIBS).filter((l) => l && typeof l === 'object' && 'documented' in l).length;
  ok(porteurs > catalogues.length,
    `B. le champ doit couvrir le paquet ENTIER, pas les seuls catalogues qui déclarent un mot — `
    + `${porteurs} porteur(s) pour ${catalogues.length} catalogue(s) à mot sur ${Object.keys(LIBS).length} clés.`);
}

// ── C. LA SÉPARATION EST À LA DOCUMENTATION, PAS À L'INVOCATION ──────────────────────────────
// ⛔ ON FABRIQUE LE CAS. « Rien ne change à l'invocation » est précisément ce qu'un garde qui
// COMPTE ne peut pas dire : un catalogue retiré du langage et un catalogue caché de l'aide ont la
// même empreinte dans la donnée. Seule la compilation les distingue.
{
  const nonDocumentes = catalogues.filter(([, l]) => l.documented === false);
  ok(nonDocumentes.length >= 1,
    `C. SOCLE : au moins un catalogue doit se déclarer non documenté, sinon ce volet compile une `
    + `invocation ordinaire et ne prouve rien.`);
  for (const [nom, lib] of nonDocumentes) {
    const mot = lib.resolves;
    // Les entrées d'un catalogue d'alphabets vivent à sa racine, à côté de ses champs de fichier.
    // ⛔ ET LA LISTE NE SE RECOPIE PAS ICI. J'en avais écrit une SIXIÈME copie dans ce fichier, le
    // jour même où le champ neuf a fait rougir deux gardes qui portaient la leur.
    const entrees = entreesDe(lib).filter((k) => lib[k] && typeof lib[k] === 'object');
    ok(entrees.length > 0, `C. ${nom} doit porter des entrées, sinon rien n'est à invoquer`);
    for (const entree of entrees) {
      const r = compileToBPxAST(`core\n${mot}.${entree}\n\n-----\nS -> -\n`);
      ok((r.errors ?? []).length === 0,
        `C. ⛔ '${mot}.${entree}' (${nom}, documented:false) NE COMPILE PLUS — la décision sépare à la `
        + `DOCUMENTATION, pas à l'invocation. Reçu : ${JSON.stringify((r.errors ?? [])[0]?.message ?? null)}`);
    }
  }
}

// ── D. LE CHAMP DISCRIMINE ───────────────────────────────────────────────────────────────────
// Assertion d'INCLUSION, jamais un compte : elle rougit le jour où le champ cesse de séparer deux
// familles, et se tait quand un catalogue s'ajoute d'un côté ou de l'autre.
{
  const oui = catalogues.filter(([, l]) => l.documented === true).length;
  const non = catalogues.filter(([, l]) => l.documented === false).length;
  ok(oui > 0 && non > 0,
    `D. le champ doit SÉPARER deux familles — ${oui} documenté(s), ${non} non documenté(s). Un champ `
    + `qui dirait le même mot partout n'exercerait jamais la lecture du générateur de fiches, et sa `
    + `branche mourrait sans qu'aucun portillon ne le dise.`);
}

// ── E. LE CONVERTISSEUR REND LE CHAMP — et on l'EXERCE ───────────────────────────────────────
// ⛔ COMPTER DIRAIT CE QUI EST ÉCRIT, EXERCER DIT CE QUI SE PASSE. Le convertisseur portait sa
// propre copie de la liste des champs de fichier — c'est le volet G qui tient l'unicité — et Atlas
// en porte une
// TROISIÈME, déjà divergente (elle ignore `section`). Le mode d'échec du convertisseur est MUET :
// un champ hors de sa liste devient un COMMENTAIRE, donc il disparaît de la donnée sans un mot.
{
  const bac = mkdtempSync(join(tmpdir(), 'zz-documented-'));
  let sortie = '';
  let porte = false;
  try {
    mkdirSync(join(bac, 'lib'), { recursive: true });
    writeFileSync(join(bac, 'lib', 'zz_temoin.json'), JSON.stringify({
      resolves: 'zz_temoin', resolvedBy: 'Kairos', documented: 'no',
      quelquechose: { description: 'une entrée pour que le compte examine quelque chose' },
    }));
    const r = execFileSync(process.execPath,
      [join(new URL('..', import.meta.url).pathname, 'scripts', 'json-vers-bpsl.mjs'), 'zz_temoin', '--essai'],
      { cwd: bac, encoding: 'utf8' });
    sortie = r;
    // La FORME attendue : une clé du def de fichier, jamais une ligne de commentaire.
    porte = /^def zz_temoin\(.*\bdocumented:no\b/m.test(r);   // collé (Romain, 2026-09-03)
  } catch (x) { sortie = `EXCEPTION ${x.message}`.slice(0, 200); }
  finally { rmSync(bac, { recursive: true, force: true }); }
  ok(porte,
    `E. ⛔ le convertisseur doit rendre 'documented' comme un CHAMP DE FICHIER. Hors de sa liste, il `
    + `l'écrit en commentaire et le champ quitte la donnée en silence. Sortie : `
    + `${JSON.stringify(sortie.split('\n').filter((l) => /documented|zz_temoin/.test(l)).slice(0, 3))}`);
}

// ── F. INJECTION DANS LE JUGE — les quatre formes qu'il doit refuser ─────────────────────────
{
  ok(juger('zz', { resolves: 'zz' }) !== null, "F. (mord) un catalogue SANS le champ doit être refusé");
  ok(juger('zz', { resolves: 'zz', documented: 'yes' }) !== null, "F. (mord) l'ANCIENNE graphie doit être refusée");
  ok(juger('zz', { resolves: 'zz', documented: 'no' }) !== null, "F. (mord) et l'autre — sinon les deux graphies coexistent");
  ok(juger('zz', { resolves: 'zz', documented: 'true' }) !== null, 'F. (mord) la CHAÎNE "true" est le piège exact, pas le booléen');
  ok(juger('zz', { resolves: 'zz', documented: 1 }) !== null, 'F. (mord) un nombre non plus');
  ok(juger('zz', { resolves: 'zz', documented: true }) === null, 'F. (se tait) le booléen VRAI passe');
  ok(juger('zz', { resolves: 'zz', documented: false }) === null, 'F. (se tait) le booléen FAUX passe');
  ok(VALEURS.length === 2, 'F. socle : le champ a exactement deux valeurs');
}

// ── G. AUCUNE SECONDE LISTE DES CHAMPS DE FICHIER ────────────────────────────────────────────
// ⛔ CE VOLET EST LA LEÇON DE LA JOURNÉE, ET ELLE M'A COÛTÉ SIX COPIES. Poser `documented` a
// trouvé CINQ listes tenues à la main pour un seul fait — deux chez moi, deux dans mes gardes, une
// chez Atlas — et j'en ai écrit une SIXIÈME dans ce fichier avant de m'en apercevoir. Deux avaient
// déjà divergé, et les deux qui vérifiaient quelque chose ont rougi ; les autres se sont taises.
//
// ⚠️ LE GARDE SE POSE SUR LA GRAPHIE QUE LE CODE ÉCRIT : un ensemble littéral qui nomme au moins
// TROIS des champs. Le seuil de trois n'est pas un goût — deux noms se rencontrent dans une
// signature ou un message d'erreur, trois dans la même paire de crochets sont un recensement.
{
  const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname })
    .split('\n').filter((f) => /^(src|scripts|test|editor|public)\/.*\.(m?js|cjs|ts)$/.test(f));
  const RACINE = new URL('..', import.meta.url).pathname;
  const SEULE = 'src/transpiler/libs-champs.js';
  const copies = [];
  let balayes = 0;
  for (const f of suivis) {
    if (f === SEULE) continue;
    balayes++;
    const texte = readFileSync(RACINE + f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    // Chaque littéral de tableau ou de liste d'arguments, pris isolément.
    for (const bloc of texte.match(/\[[^[\]]{0,400}\]/g) || []) {
      const noms = [...CHAMPS_DE_FICHIER].filter((c) => new RegExp(`['"\`]${c}['"\`]`).test(bloc));
      if (noms.length >= 3) copies.push(`${f} : ${noms.join(', ')}`);
    }
  }
  ok(balayes > 50,
    `G. SOCLE : le balayage doit voir un dépôt, pas un dossier — ${balayes} fichier(s). Une recherche `
    + `qui rend zéro se mesure elle-même avant de conclure qu'il n'y a rien.`);
  ok(copies.length === 0,
    `G. ⛔ ${copies.length} SECONDE(S) LISTE(S) des champs de fichier hors de \`${SEULE}\` : `
    + `${copies.slice(0, 4).join(' · ')}. Une liste tenue à la main périme SANS ROUGIR — celle du `
    + `convertisseur avait perdu 'section', celles de deux gardes portaient 'domain', qui n'existe `
    + `dans aucune donnée publiée.`);
  console.log(`[documented] ${balayes} fichier(s) balayés pour une seconde liste`);
}

if (e.length) {
  console.error(`[documented] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[documented] ${p} PASS / 0 FAIL`);
