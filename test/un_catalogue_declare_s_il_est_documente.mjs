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
 * ⛔ ET LE CHAMP N'EST PAS UN BOOLÉEN, PAR MESURE. Le langage n'a pas de littéral booléen : dans un
 * `.bpsl`, `documented:false` rend la CHAÎNE "false", qui est VRAIE. Un lecteur qui teste la vérité
 * de la valeur publie exactement ce que la donnée lui demande de cacher. Deux mots, `yes` et `no`,
 * et le troisième est refusé — sans quoi une faute de frappe (`non`, `No`) se lit comme `yes` chez
 * qui compare, et comme rien chez qui compte.
 *
 * ⚠️ CE QUI A RENDU LA DÉCISION NÉCESSAIRE, ET QUI EST DE MOI : `test_alphabets` et `alphabets`
 * déclarent LE MÊME MOT. Le 2026-08-23 la conversion d'`alphabets` a changé son rang dans le
 * bundle, le catalogue de TEST est devenu l'autorité de l'axe `alphabet`, et sept gardes sont
 * tombés d'un coup. Le mélange était déjà là ; le rang l'a seulement rendu visible.
 *
 * LES VOLETS :
 *   A. tout catalogue qui déclare un mot porte le champ — et le compte refuse d'avoir vu zéro
 *   B. la valeur est l'un des DEUX MOTS, jamais un booléen, jamais un troisième mot
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

const MOTS = new Set(['yes', 'no']);

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
  if (typeof v !== 'string') {
    return `${nom}.documented porte un ${typeof v} (${JSON.stringify(v)}) — le champ est un MOT. `
      + `Un booléen ne survit pas à l'authoring \`.bpsl\` : il en ressort en chaîne, et "false" est vrai.`;
  }
  if (!MOTS.has(v)) {
    return `${nom}.documented vaut ${JSON.stringify(v)} — les deux mots sont ${[...MOTS].join(' et ')}. `
      + `Un troisième mot se lit comme 'yes' chez qui compare la vérité de la valeur.`;
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

// ── B. LES TROIS CATALOGUES SANS MOT NE LE PORTENT PAS ───────────────────────────────────────
// ⛔ ET CE VOLET DIT LE PROPOS, PAS L'INVENTAIRE. Les instantanés de réglages BP3 ne déclarent
// aucun mot, donc aucune fiche ne les recense : leur donner le champ affirmerait qu'ils sont
// documentés. On n'exige pas leur nombre — on exige que le champ ne s'y invite pas.
{
  const sansMot = Object.entries(LIBS).filter(([, l]) => l && typeof l === 'object' && !l.resolves);
  const bavards = sansMot.filter(([, l]) => 'documented' in l).map(([n]) => n);
  ok(bavards.length === 0,
    `B. ${bavards.join(', ')} ne déclare aucun mot et porte pourtant 'documented' — le champ dirait `
    + `d'une donnée qu'elle est documentée là où aucune fiche ne la recense.`);
}

// ── C. LA SÉPARATION EST À LA DOCUMENTATION, PAS À L'INVOCATION ──────────────────────────────
// ⛔ ON FABRIQUE LE CAS. « Rien ne change à l'invocation » est précisément ce qu'un garde qui
// COMPTE ne peut pas dire : un catalogue retiré du langage et un catalogue caché de l'aide ont la
// même empreinte dans la donnée. Seule la compilation les distingue.
{
  const nonDocumentes = catalogues.filter(([, l]) => l.documented === 'no');
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
        `C. ⛔ '${mot}.${entree}' (${nom}, documented:no) NE COMPILE PLUS — la décision sépare à la `
        + `DOCUMENTATION, pas à l'invocation. Reçu : ${JSON.stringify((r.errors ?? [])[0]?.message ?? null)}`);
    }
  }
}

// ── D. LE CHAMP DISCRIMINE ───────────────────────────────────────────────────────────────────
// Assertion d'INCLUSION, jamais un compte : elle rougit le jour où le champ cesse de séparer deux
// familles, et se tait quand un catalogue s'ajoute d'un côté ou de l'autre.
{
  const oui = catalogues.filter(([, l]) => l.documented === 'yes').length;
  const non = catalogues.filter(([, l]) => l.documented === 'no').length;
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
    porte = /^def zz_temoin \(.*\bdocumented:no\b/m.test(r);
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
  ok(juger('zz', { resolves: 'zz', documented: true }) !== null, 'F. (mord) un booléen VRAI doit être refusé');
  ok(juger('zz', { resolves: 'zz', documented: false }) !== null, 'F. (mord) un booléen FAUX doit être refusé');
  ok(juger('zz', { resolves: 'zz', documented: 'non' }) !== null, "F. (mord) un troisième mot doit être refusé");
  ok(juger('zz', { resolves: 'zz', documented: 'yes' }) === null, 'F. (se tait) le mot yes passe');
  ok(juger('zz', { resolves: 'zz', documented: 'no' }) === null, 'F. (se tait) le mot no passe');
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
