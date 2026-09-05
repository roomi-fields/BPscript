#!/usr/bin/env node
/**
 * UNE PORTE PUBLIÉE SE DÉCRIT, ET SA DESCRIPTION MORD CHEZ LE CONSOMMATEUR.
 *
 * Décision de Romain, 2026-09-05 : *« chaque agent doit décrire les portes qu'il publie de façon
 * formelle, que ça devrait faire partie de son contrat »*
 * (`hub/decisions/2026-09-05-un-depot-decrit-formellement-chaque-porte-qu-il-publie.md`).
 * La description doit être DÉRIVÉE du code ou confrontée à lui par un garde qui refuse.
 *
 * ⛔ CE QUE CE GARDE MESURE, ET CE QU'IL NE MESURE PAS. La fraîcheur des descriptions est déjà tenue
 * par `construire.mjs --verifier` : une déclaration qui a dérivé de sa source y rougit. Ce garde-ci
 * pose l'autre question, celle qu'aucun compte ne tranche : **est-ce que la description ARRIVE chez
 * le consommateur, et est-ce qu'elle lui oppose quelque chose ?**
 *
 * ⛔ ET IL S'EXERCE SUR LE PAQUET SEUL, JAMAIS SUR LE DÉPÔT. Un consommateur ne reçoit que ce que
 * `files` déclare. Mesurer depuis l'arbre laisserait passer une description publiée nulle part :
 * c'est le mode d'échec qu'Atlas a payé le 2026-09-02 sur un morceau de regroupeur absent du champ,
 * et rien n'avait rougi ici.
 *
 * ⚠️ ⛔ ET LE TÉMOIN QUI OBSERVE NE DISCRIMINE PAS — mesuré à l'écriture de ce fichier. Mon premier
 * témoin compilait du code JUSTE et vérifiait qu'il passe. Description retirée du paquet : **il
 * passait toujours**, code 0. Il ne pouvait pas échouer, parce qu'une description absente ne rend
 * pas un code juste faux — elle rend tout permis. *Un témoin qui observe ne discrimine pas ; celui
 * qui FABRIQUE le cas tranche.* Le cas fabriqué est donc du code FAUX : il ne peut être refusé que
 * par une description effectivement lue.
 */
import { readFileSync, mkdirSync, copyFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const TSC = join(RACINE, 'node_modules', 'typescript', 'bin', 'tsc');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** Le paquet tel qu'un consommateur le reçoit : `files`, et rien d'autre. */
function poserLePaquet(dans) {
  const pkg = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
  const cible = join(dans, 'node_modules', 'bpscript');
  let n = 0;
  for (const f of pkg.files || []) {
    const src = join(RACINE, f);
    if (!existsSync(src)) continue;   // un fichier déclaré et absent est le sujet d'un AUTRE garde
    mkdirSync(join(cible, dirname(f)), { recursive: true });
    copyFileSync(src, join(cible, f));
    n++;
  }
  copyFileSync(join(RACINE, 'package.json'), join(cible, 'package.json'));
  return { copies: n, portes: Object.keys(pkg.exports || {}).filter((k) => k !== './package.json') };
}

/** Le verdict de TypeScript sur un fichier, depuis le dossier du consommateur. */
function juger(dans, fichier) {
  try {
    execFileSync(process.execPath, [TSC, '--module', 'esnext', '--moduleResolution', 'bundler',
      '--target', 'es2022', '--strict', '--skipLibCheck', '--noEmit', fichier],
      { cwd: dans, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    return { refus: 0, sortie: '' };
  } catch (e) {
    const sortie = String(e.stdout || '') + String(e.stderr || '');
    return { refus: sortie.split('\n').filter((l) => /error TS\d+/.test(l)).length, sortie };
  }
}

const dans = mkdtempSync(join(tmpdir(), 'bpscript-porte-'));
try {
  const { copies, portes } = poserLePaquet(dans);

  // ── SOCLE — un paquet vide passerait tout, et un dépôt sans porte ne prouve rien ─────────────
  ok(copies > 10, `SOCLE : ${copies} fichier(s) dans le paquet — sous ce seuil le garde mesure un `
    + `paquet qui n'existe pas, pas une description qui manque.`);
  ok(portes.length >= 10, `SOCLE : ${portes.length} porte(s) publiée(s) — le manifeste en déclarait `
    + `dix quand ce garde a été écrit ; en dessous, vérifier ce qui a disparu.`);

  // ── TOUTE PORTE PUBLIÉE PORTE UNE DESCRIPTION, ET ELLE EST DANS LE PAQUET ────────────────────
  const pkg = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
  const sansTypes = [];
  const absentes = [];
  for (const [chemin, v] of Object.entries(pkg.exports || {})) {
    if (chemin === './package.json') continue;
    const types = v && typeof v === 'object' ? v.types : null;
    if (!types) { sansTypes.push(chemin); continue; }
    if (!existsSync(join(dans, 'node_modules', 'bpscript', types.replace(/^\.\//, '')))) absentes.push(chemin);
  }
  ok(sansTypes.length === 0, `⛔ ${sansTypes.length} porte(s) publiée(s) SANS description : `
    + `${sansTypes.join(', ')}. Une porte que rien ne décrit oblige son consommateur à décrire mon `
    + `code chez lui — un calque qui vieillit sans rougir des deux côtés.`);
  ok(absentes.length === 0, `⛔ ${absentes.length} description(s) déclarée(s) et ABSENTE(S) du paquet : `
    + `${absentes.join(', ')}. Un \`types\` qui ne résout rien chez le consommateur est pire qu'absent : `
    + `il annonce une surface décrite et n'en oppose aucune.`);

  // ── LE CAS FABRIQUÉ — du code FAUX, que seule une description LUE peut refuser ───────────────
  writeFileSync(join(dans, 'faux.ts'),
    "import { compileToBPxAST } from 'bpscript';\n"
  + "const r = compileToBPxAST('S -> C4');\n"
  + "const n: number = r.errors[0].code;   // `code` est une CHAÎNE\n"
  + "const x = r.champInexistant;          // n'existe pas sur le résultat\n"
  + "console.log(n, x);\n");
  const faux = juger(dans, 'faux.ts');
  ok(faux.refus >= 2, `⛔ le code FAUX est passé — ${faux.refus} refus au lieu de 2 au moins. La `
    + `description n'atteint pas le consommateur, ou elle ne lui oppose rien. Sortie : ${faux.sortie.slice(0, 300)}`);

  // ── ET LE CAS JUSTE PASSE — sans quoi le garde mesurerait une description qui refuse TOUT ────
  writeFileSync(join(dans, 'juste.ts'),
    "import { compileToBPxAST } from 'bpscript';\n"
  + "const r = compileToBPxAST('core\\nalphabet.western\\n-----\\nS -> C4\\n');\n"
  + "if (r.errors.length) { const c: string = r.errors[0].code; console.log(c); }\n"
  + "if (r.ast) console.log(Object.keys(r.ast).length);\n");
  const juste = juger(dans, 'juste.ts');
  ok(juste.refus === 0, `⛔ le code JUSTE est refusé — ${juste.refus} refus. Une description qui `
    + `refuse tout a la même sortie qu'une description exacte sur le cas faux, et elle est `
    + `inutilisable. Sortie : ${juste.sortie.slice(0, 300)}`);
} finally {
  rmSync(dans, { recursive: true, force: true });
}

if (echecs.length) {
  console.error(`[porte décrite] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[porte décrite] ${passe} PASS / 0 FAIL — ${passe} assertion(s) · le paquet SEUL, hors du `
  + `dépôt, décrit ses portes et REFUSE un usage faux`);
