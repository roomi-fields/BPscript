#!/usr/bin/env node
/**
 * GARDE — LE SCHÉMA DE SYNTAXE VIT HORS DES LIBRAIRIES, ET SA PORTE TIENT LES QUATRE EXIGENCES.
 *
 * Décision Romain, 2026-08-20 (`le-schema-de-syntaxe-sort-des-librairies`) : ce n'est pas une
 * librairie. Aucune scène ne l'invoque, il ne déclare aucun mot d'invocation, et il porte ce que le
 * LANGAGE EST. Tant qu'il vivait dans `lib/`, chaque règle sur les librairies devait l'excepter.
 *
 * ⛔ ET IL LUI FAUT UN ARTEFACT, PAS UNE FONCTION — exigence 4 d'Atlas, 2026-08-21. Son contrat
 * (`ce-qu-un-banc-lit-chez-son-voisin`) lui interdit l'arbre de travail d'un voisin : il lit
 * `git show <branche publiée>:<chemin>`. `describeVocabulary()` ne peut pas le servir — une
 * fonction ne s'appelle qu'après avoir chargé un paquet depuis un disque qui bouge sous lui.
 *
 * ⚠️ ET LA DISTINCTION QUI AVAIT MASQUÉ ÇA : « par la porte » contre « par le chemin » était juste
 * pour Kanopi, qui consomme le paquet installé, et FAUSSE pour Atlas, qui lit un commit. Deux
 * voisins, deux contraintes, mis dans le même sac pendant une journée.
 *
 * LES QUATRE EXIGENCES, UNE PAR VOLET :
 *   A. le schéma ne vit PLUS dans `lib/`, et rien ne l'y cherche
 *   B. la porte est DÉCLARÉE dans le champ d'exports — une surface publique, pas un chemin interne
 *   C. elle REFUSE de se publier vide — zéro mot a la graphie d'une mesure
 *   D. elle porte sa PROVENANCE, pour que la ligne `source:` d'un voisin se DÉRIVE
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { SYNTAXE } from '../src/transpiler/syntaxe-data.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const RACINE = new URL('..', import.meta.url).pathname;
const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: RACINE }).split('\n').filter(Boolean);
ok(suivis.length > 100, `SOCLE : le dépôt doit porter des fichiers suivis — ${suivis.length}`);

// ── A. LE SCHÉMA A QUITTÉ LES LIBRAIRIES, ET RIEN NE L'Y CHERCHE ─────────────────────────────
{
  const dansLib = suivis.filter((f) => /^lib\/.*language.*\.json$/.test(f));
  ok(dansLib.length === 0,
    `A. ⛔ le schéma de syntaxe est revenu dans les librairies : ${dansLib.join(', ')} — il n'en est `
    + `pas une, et l'y remettre force chaque règle sur les librairies à l'excepter de nouveau.`);
  ok(!Object.prototype.hasOwnProperty.call(LIBS, 'language'),
    "A. ⛔ la clé 'language' est de retour dans le bundle des librairies — le schéma s'y publierait "
    + 'de nouveau, et un consommateur aurait DEUX portes pour une seule donnée.');
  // ⛔ ET AUCUN CODE NE LE CHERCHE PAR LE REGISTRE. `loadLib('language')` rendait `null` après le
  // déménagement — silencieusement. Un lecteur qui n'a pas suivi ne crie pas, il compte zéro.
  const parLeRegistre = [];
  for (const f of suivis.filter((x) => /^(src|test|scripts|editor)\/.*\.(m?js|cjs|ts)$/.test(x))) {
    // ⚠️ ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER, et ce volet s'est accusé lui-même sans ça :
    // les deux fichiers que je venais de brancher sur la porte CITENT l'ancienne forme dans le
    // commentaire qui explique le déménagement. Un garde qui lit le texte brut s'accuse de ce
    // qu'il documente — même patron que `aucune_liste_du_langage_n_est_codee_en_dur`, qui retire
    // ses commentaires pour la même raison.
    const t = readFileSync(`${RACINE}${f}`, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    if (/load(Lib|JsonFile)\(\s*['"]language['"]/.test(t)) parLeRegistre.push(f);
  }
  ok(parLeRegistre.length === 0,
    `A. ⛔ ${parLeRegistre.length} fichier(s) cherchent encore le schéma par le REGISTRE DES `
    + `LIBRAIRIES : ${parLeRegistre.join(', ')} — l'appel rend \`null\` sans un mot, et le lecteur `
    + `compte zéro mot de syntaxe au lieu de crier.`);
}

// ── B. LA PORTE EST DÉCLARÉE DANS LES EXPORTS ────────────────────────────────────────────────
{
  const paquet = JSON.parse(readFileSync(`${RACINE}package.json`, 'utf8'));
  const exports = paquet.exports || {};
  const chemin = './src/transpiler/syntaxe-data.js';
  ok(Object.prototype.hasOwnProperty.call(exports, chemin),
    `B. ⛔ la porte '${chemin}' n'est pas déclarée dans le champ d'exports. Ce qui n'y est pas est un `
    + `INTERNE qu'un voisin n'a pas le droit de lire — exigence 1 d'Atlas, et sans elle il lirait un `
    + `chemin que je peux déplacer sans le prévenir.`);
  ok(suivis.includes('src/transpiler/syntaxe-data.js'),
    "B. ⛔ l'artefact doit être VERSIONNÉ — exigence 4 : Atlas lit `git show <branche>:<chemin>`, "
    + 'donc un fichier généré à la construction et non commité ne lui rend RIEN.');
  ok(suivis.some((f) => f.startsWith('schema-syntaxe/')),
    'B. la source du schéma doit être versionnée elle aussi, hors de `lib/`');
}

// ── C. ⛔ LA PORTE REFUSE DE SE PUBLIER VIDE — et le refus se prouve en FABRIQUANT le cas ─────
{
  // ⛔ CE VOLET EXIGEAIT `>= 7`, ET C'ÉTAIT UN SEUIL CALÉ SUR LE COMPTE DU JOUR. Il a rougi le
  // 2026-08-24 quand `lambda` est sorti du langage — un RETRAIT décidé, pas une régression. Son
  // propos est écrit dans son titre : la porte refuse de se publier VIDE. Un seuil serré ne garde
  // pas ce propos, il garde un inventaire.
  //
  // ⚠️ KAIROS A PAYÉ EXACTEMENT CELA, DEUX FOIS SUR LE MÊME BANC : un seuil « plus de 40 » qui
  // rougissait dès qu'une clé sortait, puis une égalité sur l'ensemble des formes qui a rougi le
  // 2026-08-17. Sa réparation est la règle générale — une assertion d'INCLUSION, jamais une égalité
  // ni un seuil : elle garde contre ce qui APPARAÎT sans se périmer sur ce qui DISPARAÎT.
  ok(Object.keys(SYNTAXE.syntaxWords || {}).length > 0,
    `C. la porte ne doit pas se publier VIDE de mots de syntaxe — ${Object.keys(SYNTAXE.syntaxWords || {}).length}`);
  ok(Object.keys(SYNTAXE.directiveValues || {}).length > 0,
    `C. ni vide de valeurs de directive — ${Object.keys(SYNTAXE.directiveValues || {}).length}`);
  // ⛔ LE VOLET QUI COMPTE : le générateur REFUSE-T-IL une source vidée ? Un `?? {}` publierait
  // « zéro mot de syntaxe », qui a EXACTEMENT la graphie d'une mesure — exigence 2 d'Atlas. On
  // fabrique le cas au lieu de lire le code : compter dit ce qui est écrit, exercer dit ce qui se
  // passe.
  // ⛔ ON L'EXERCE POUR DE VRAI, dans une COPIE hors dépôt : source amputée + générateur, et on
  // regarde le CODE DE SORTIE. Ma première écriture LISAIT le code du générateur en prétendant
  // fabriquer le cas — le commentaire disait « on fabrique au lieu de lire » au-dessus d'un
  // `readFileSync` qui lisait. Un garde qui décrit un exercice qu'il ne fait pas est pire qu'un
  // garde absent : il porte la preuve dans son texte et rien dans son geste.
  let refuse = false;
  let sortie = '';
  {
    const bac = mkdtempSync(join(tmpdir(), 'zz-syntaxe-'));
    try {
      mkdirSync(join(bac, 'schema-syntaxe'), { recursive: true });
      mkdirSync(join(bac, 'src', 'transpiler'), { recursive: true });
      const source = JSON.parse(readFileSync(`${RACINE}schema-syntaxe/language.json`, 'utf8'));
      source.syntaxWords = {};                       // LA FAUTE : le langage n'a plus de mots
      writeFileSync(join(bac, 'schema-syntaxe', 'language.json'), JSON.stringify(source));
      writeFileSync(join(bac, 'src', 'transpiler', 'syntaxe-bundle.mjs'),
        readFileSync(`${RACINE}src/transpiler/syntaxe-bundle.mjs`, 'utf8'));
      const r = spawnSync(process.execPath, [join(bac, 'src', 'transpiler', 'syntaxe-bundle.mjs')],
        { encoding: 'utf8' });
      refuse = r.status === 1 && /ne se publie pas vide/.test(r.stderr || '');
      sortie = `code ${r.status} · ${(r.stderr || r.stdout || '').slice(0, 70).replace(/\n/g, ' ')}`;
    } catch (x) { sortie = `EXCEPTION ${x.message}`; }
    finally { rmSync(bac, { recursive: true, force: true }); }
  }
  ok(refuse,
    `C. ⛔ le générateur de la porte doit REFUSER une source vidée, pas publier un objet vide — `
    + `${sortie}. Un consommateur lirait « le langage n'a aucun mot » avec la graphie d'une mesure.`);
}

// ── D. LA PORTE PORTE SA PROVENANCE ──────────────────────────────────────────────────────────
{
  ok(typeof SYNTAXE._source === 'string' && SYNTAXE._source.length > 10,
    `D. ⛔ la porte doit porter sa PROVENANCE — exigence 3 d'Atlas : sa ligne \`source:\` se DÉRIVE `
    + `de ce champ au lieu de se recopier, et une provenance recopiée MENT au premier déménagement `
    + `sans que rien ne rougisse. Reçu : ${JSON.stringify(SYNTAXE._source)}`);
  ok(suivis.includes(String(SYNTAXE._source).replace(/^BPscript\//, '')),
    `D. et la provenance doit désigner un fichier QUI EXISTE — ${SYNTAXE._source}. Une provenance `
    + `qui nomme un chemin mort est pire qu'aucune : elle a l'air vérifiable.`);
}

const ATTENDU = 1 + 3 + 3 + 3 + 2;
ok(p + e.length === ATTENDU, `le garde doit éprouver ${ATTENDU} cas — ${p + e.length} seulement`);

if (e.length) { console.error(`[syntaxe] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[syntaxe] ${p} PASS / 0 FAIL — ${p} assertion(s), `
          + `${Object.keys(SYNTAXE.syntaxWords).length} mot(s), ${Object.keys(SYNTAXE.directiveValues).length} entrée(s)`);
