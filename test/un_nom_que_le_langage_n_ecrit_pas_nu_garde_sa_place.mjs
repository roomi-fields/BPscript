#!/usr/bin/env node
// @isole — il ECRIT sur le disque : dans un processus partage il contaminerait ses voisins.
/**
 * GARDE — LA CONVERSION D'UN CATALOGUE PRÉSERVE L'ORDRE, ET DONNE UNE GRAPHIE AUX NOMS QU'ELLE
 * NE PEUT PAS ÉCRIRE NUS.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE, LE 2026-08-24, EN CONVERTISSANT `voices`. Sur les 659 noms d'entrée du
 * paquet, HUIT ne s'écrivent pas nus : sept réglages BP3 à dièse (`B#_instead_of_C`) et
 * `fatbass for:sub37`. Le langage refuse `def "a b"` — un nom entre guillemets n'est pas lu en tête
 * de `def` — et la seule place qui accepte un nom quelconque est une CLÉ DE MEMBRE.
 *
 * ⛔ ET LE PIÈGE N'ÉTAIT PAS LA GRAPHIE, C'ÉTAIT LE RANG. Deux fois de suite, la conversion rendait
 * la MÊME donnée dans un ORDRE différent :
 *
 *     [wobble, fatbass, fatbass for:sub37, …]   →   [fatbass for:sub37, wobble, fatbass, …]
 *     [documented, resolvedBy, name, objects…]  →   [resolvedBy, resolves, name, documented…]
 *
 * Le premier parce qu'une place ne se pose que sur la déclaration DU FICHIER, donc en tête ; le
 * second parce que l'en-tête suivait l'ordre de MA liste de champs au lieu de celui de la source.
 *
 * ⚠️ ET LE RANG DÉSIGNE UNE AUTORITÉ. Le 2026-08-23, la conversion d'`alphabets` a changé son rang
 * dans le bundle : le catalogue de TEST est devenu l'autorité de l'axe `alphabet`, et sept gardes
 * sont tombés d'un coup. Une preuve d'égalité qui compare les VALEURS ne voit pas le rang.
 *
 * CE QU'IL FABRIQUE : un catalogue témoin dont le nom non écrivable est AU MILIEU — jamais en
 * premier ni en dernier, les deux rangs qu'un tri accidentel rendrait juste par chance.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();
import { CHAMPS_DE_FICHIER, entreesDe } from '../src/transpiler/libs-champs.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const RACINE = new URL('..', import.meta.url).pathname;
const NU = (s) => /^[A-Za-z0-9_-]+$/.test(s) && /[A-Za-z]/.test(s);

/** Le convertisseur, exercé sur un catalogue FABRIQUÉ, hors du dépôt. */
function convertir(source) {
  const bac = mkdtempSync(join(tmpdir(), 'zz-nomnu-'));
  try {
    mkdirSync(join(bac, 'lib'), { recursive: true });
    writeFileSync(join(bac, 'lib', 'zz_temoin.json'), JSON.stringify(source));
    return execFileSync(process.execPath,
      [join(RACINE, 'scripts', 'json-vers-bpsl.mjs'), 'zz_temoin', '--essai'],
      { cwd: bac, encoding: 'utf8' });
  } catch (x) {
    return `⛔ REFUS ${(x.stderr || x.message || '').slice(0, 200)}`;
  } finally { rmSync(bac, { recursive: true, force: true }); }
}

// ── A. LE CAS FABRIQUÉ — un nom non écrivable AU MILIEU d'une place ──────────────────────────
{
  // ⛔ LA PLACE N'EST PAS LE DERNIER CHAMP DE LA SOURCE, ET C'EST LE POINT. Mon premier témoin la
  // mettait en dernier : l'injection qui reposait la place À LA FIN de l'en-tête ne mordait pas,
  // parce que la fin ÉTAIT son rang. Un témoin qui ne peut pas distinguer les deux comportements
  // rend « vert » sans rien mesurer — et `voices.json` porte justement `objects` AVANT `resolves`.
  const texte = convertir({
    documented: 'yes', resolvedBy: 'Kairos', name: 'zz_temoin',
    objects: {
      premier: { audio: 'un' },
      'nom avec espace:et_deux_points': { device: { preset: 'p' } },
      dernier: { audio: 'deux' },
    },
    resolves: 'zz_temoin',
  });
  ok(!texte.startsWith('⛔ REFUS'),
    `A. ⛔ le convertisseur REFUSE un nom que le langage n'écrit pas nu : ${texte.slice(0, 200)}. `
    + `Huit noms du paquet sont dans ce cas — le refus les laisserait sans aucune graphie.`);
  ok(/"nom avec espace:et_deux_points"\(/.test(texte),
    `A. le nom non écrivable doit sortir en CLÉ DE MEMBRE entre guillemets — la seule place du `
    + `langage qui accepte un nom quelconque. Reçu : ${texte.slice(0, 200)}`);
  ok(/\bpremier\(/.test(texte) && !/"premier"\(/.test(texte),
    `A. un nom ÉCRIVABLE reste NU — le guillemeter partout ferait deux graphies pour un seul fait.`);

  // ⛔ LE RANG : les trois entrées dans l'ordre de la source, le nom non écrivable au MILIEU.
  const rang = (m) => texte.indexOf(m);
  ok(rang('premier(') >= 0 && rang('premier(') < rang('"nom avec espace')
    && rang('"nom avec espace') < rang('dernier('),
    `A. ⛔ L'ORDRE DE LA SOURCE DOIT TENIR — reçu premier@${rang('premier(')} · `
    + `nonNu@${rang('"nom avec espace')} · dernier@${rang('dernier(')}. Une place posée en tête `
    + `remonte l'entrée au premier rang, et le rang désigne une autorité.`);

  // ⛔ LA PLACE SE POSE À SON RANG PARMI LES CHAMPS DE FICHIER — `objects` AVANT `resolves`.
  ok(rang('objects(') >= 0 && rang('objects(') < rang('resolves:'),
    `A. ⛔ la PLACE doit garder son rang dans la source — reçu objects@${rang('objects(')} · `
    + `resolves@${rang('resolves:')}. Ajoutée en fin d'en-tête, elle déplace la clé publiée.`);

  // ⛔ ET L'ORDRE DES CHAMPS DE FICHIER AUSSI — `documented` en tête, comme dans la source.
  ok(/def zz_temoin\(documented:yes, resolvedBy:/.test(texte),   // collé (Romain, 2026-09-03)
    `A. ⛔ les champs de fichier gardent l'ordre de la SOURCE, jamais celui de la liste du `
    + `convertisseur. Reçu : ${(texte.match(/^def zz_temoin \(.{0,80}/m) || [''])[0]}`);
}

// ── B. INJECTION DANS LE JUGE — un ordre inversé doit être vu ─────────────────────────────────
{
  const juger = (t) => {
    const a = t.indexOf('premier('), b = t.indexOf('"nom avec espace'), c = t.indexOf('dernier(');
    return a >= 0 && a < b && b < c;
  };
  ok(juger('premier( "nom avec espace dernier(') === true, 'B. (se tait) sur un ordre juste');
  ok(juger('"nom avec espace premier( dernier(') === false, "B. (mord) sur l'entrée remontée en tête");
  ok(juger('premier( dernier( "nom avec espace') === false, "B. (mord) sur l'entrée repoussée en fin");
}

// ── C. LE PAQUET PUBLIÉ PORTE ENCORE LES NOMS NON ÉCRIVABLES, VERBATIM ───────────────────────
// ⚠️ CE VOLET GARDE LA DONNÉE, PAS L'OUTIL. Un nom qui disparaîtrait du paquet à la faveur d'une
// conversion serait exactement la perte muette que la preuve d'égalité existe pour attraper — et
// `fatbass for:sub37` est le SEUL exemplaire vivant du mécanisme de spécialisation par appareil.
{
  const nonNus = [];
  const descendre = (obj, chemin) => {
    for (const k of entreesDe(obj)) {
      const v = obj[k];
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      if (!NU(k)) nonNus.push(`${chemin}.${k}`);
      if (['objects', 'controls', 'tables'].includes(k)) descendre(v, `${chemin}.${k}`);
    }
  };
  for (const [nom, lib] of Object.entries(LIBS)) if (lib && typeof lib === 'object') descendre(lib, nom);
  ok(nonNus.length > 0,
    `C. SOCLE : le paquet doit porter au moins un nom non écrivable nu, sinon ce garde protège une `
    + `classe vide et le volet A mesure un cas de laboratoire.`);
  // ⛔ ET LA SPÉCIALISATION PAR APPAREIL N'EN FAIT PLUS PARTIE — décision Romain, 2026-08-24. Ce
  // volet EXIGEAIT `voices.objects.fatbass for:sub37` : c'était juste au pas 1, où la conversion ne
  // devait rien changer, et FAUX au pas 3, où la relation quitte le nom. Un garde de conversion
  // n'est pas un garde de conservation : il tient que rien ne se perd EN CONVERTISSANT, pas qu'une
  // forme survive à une décision qui la retire.
  ok(!nonNus.some((n) => /\s+for:/.test(n)),
    `C. ⛔ un nom de voix porte de nouveau sa destination : ${nonNus.filter((n) => /\s+for:/.test(n)).join(', ')}. `
    + `La relation vit dans le membre 'for', jamais dans le nom.`);
  console.log(`[nom non nu] ${nonNus.length} nom(s) non écrivable(s) dans le paquet : ${nonNus.join(' · ')}`);
}

// ── D. ET `voices` EST BIEN PASSÉ AU LANGAGE ─────────────────────────────────────────────────
{
  const suivis = execFileSync('git', ['ls-files', 'lib'], { encoding: 'utf8', cwd: RACINE }).split('\n');
  ok(suivis.includes('lib/voices.bpsl'),
    'D. le catalogue des voix est écrit dans le langage qu\'il sert — pas 1 de la décision '
    + '`une-specialisation-par-appareil-est-un-membre-jamais-un-nom`');
  ok(!suivis.includes('lib/voices.json'),
    "D. ⛔ et l'ancienne source est SUPPRIMÉE dans le même mouvement — deux fichiers pour un mot, "
    + "c'est la voie parallèle que le dépôt refuse, et le rang décide alors laquelle gagne.");
  ok(CHAMPS_DE_FICHIER.has('documented'), 'D. socle : la liste unique des champs de fichier est lisible ici');
}

if (e.length) {
  console.error(`[nom non nu] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[nom non nu] ${p} PASS / 0 FAIL`);
