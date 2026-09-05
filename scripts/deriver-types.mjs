#!/usr/bin/env node
/**
 * LA DESCRIPTION DE MES PORTES SE DÉRIVE DE MON CODE — elle n'est écrite nulle part.
 *
 * Décision de Romain, 2026-09-05 : *« je pense que chaque agent doit décrire les portes qu'il publie
 * de façon formelle, que ça devrait faire partie de son contrat »*
 * (`hub/decisions/2026-09-05-un-depot-decrit-formellement-chaque-porte-qu-il-publie.md`).
 *
 * ⛔ CE QUE LA RÈGLE DEMANDE, ET CE QU'ELLE REFUSE. Elle ne demande pas une fiche : une description
 * écrite à la main vieillit sans rougir, c'est un second document qui prétend dire ce que le code
 * fait et rien ne les confronte. Elle demande une description **qui casse quand la surface change**.
 * Ici la description est ÉMISE PAR LE COMPILATEUR TYPESCRIPT depuis les sources de mes portes : elle
 * ne peut pas diverger, parce qu'elle n'a pas d'existence propre.
 *
 * ⛔ ET C'EST LE GARDE DE CONSTRUCTION QUI LA TIENT, sans une ligne de plus. Les fichiers produits
 * ici entrent dans `dist/` comme les portes elles-mêmes, donc `construire.mjs --verifier` les
 * recompare à ce qui est enregistré : une signature qui bouge sans être régénérée fait rougir le
 * portillon, exactement comme un artefact dérivé de sa source.
 *
 * ⚠️ CE QUE LE PONT RÉSOUT. TypeScript émet une déclaration PAR MODULE du graphe, jamais une par
 * porte — mes portes, elles, sont des regroupements. Les déclarations vivent donc sous `types/`, et
 * chaque porte reçoit un fichier d'une ligne qui réexporte la sienne. Un consommateur n'atteint que
 * la porte ; ce qui est sous `types/` n'est ouvert par aucun `exports` et n'est pas importable.
 *
 * ⚠️ ET UNE DÉCLARATION N'EST PAS UN CHEMIN D'EXÉCUTION : rien sous `types/` ne s'exécute, rien n'y
 * porte d'état. La règle « ce qui n'est pas une porte n'est plus atteignable » vise le code, et elle
 * reste tenue — les dix portes construites restent les dix seuls modules exécutables publiés.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const RACINE = new URL('..', import.meta.url).pathname;
const TABLE = JSON.parse(readFileSync(join(RACINE, 'build.portes.json'), 'utf8'));

/** Le module que TypeScript émettra pour une source, relativement à la racine des déclarations. */
export function cheminDeDeclaration(source) {
  return './types/' + source.replace(/\.m?js$/, '.js');
}

/**
 * Le pont d'une porte — ce qu'un consommateur lit quand il importe cette porte.
 *
 * ⛔ `export *` NE PORTE PAS LE DÉFAUT, et c'est le piège de cette forme : une porte dont le geste
 * central est un export par défaut — la mienne l'est — se décrirait comme une porte VIDE, sans que
 * rien ne rougisse. Le défaut se réexporte donc explicitement, et seulement quand la source en a un.
 */
export function pontDePorte(source, aUnDefaut) {
  const d = cheminDeDeclaration(source);
  const l = [`export * from '${d}';`];
  if (aUnDefaut) l.push(`export { default } from '${d}';`);
  return l.join('\n') + '\n';
}

/** Une source déclare-t-elle un export par défaut ? Lu dans le texte, jamais supposé. */
export function porteUnDefaut(texte) {
  return /^\s*export\s+default\s/m.test(texte);
}

/** Tous les fichiers d'un dossier, récursivement, chemins relatifs à lui. */
function tousLesFichiers(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...tousLesFichiers(p, base));
    else out.push(relative(base, p));
  }
  return out;
}

/**
 * Émet les déclarations de toutes les portes dans `sortie` — `types/` plus un pont par porte.
 *
 * ⛔ UN GARDE COMPTE CE QU'IL A EXAMINÉ. Zéro déclaration émise est un échec de dérivation, pas un
 * dossier propre : sans ce refus, une invocation qui échoue silencieusement publierait des ponts
 * qui ne résolvent rien, et le consommateur lirait « module introuvable » sans savoir pourquoi.
 */
export function deriverLesTypes(sortie) {
  const portes = sourcesADecrire();
  if (!portes.length) throw new Error('[types] ⛔ ZÉRO porte déclarée — rien à décrire.');

  const dossierTypes = join(sortie, 'types');
  mkdirSync(dossierTypes, { recursive: true });
  execFileSync(process.execPath, [
    join(RACINE, 'node_modules', 'typescript', 'bin', 'tsc'),
    '--declaration', '--emitDeclarationOnly', '--allowJs',
    '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022',
    '--skipLibCheck', '--rootDir', RACINE, '--outDir', dossierTypes,
    ...portes.map(([, source]) => join(RACINE, source)),
  ], { cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });

  const emis = tousLesFichiers(dossierTypes);
  if (!emis.length) throw new Error('[types] ⛔ ZÉRO déclaration émise — la dérivation a échoué en silence.');

  const ponts = [];
  for (const [cible, source] of portes) {
    const nom = cible.replace(/^dist\//, '').replace(/\.js$/, '.d.ts');
    const chemin = join(sortie, nom);
    mkdirSync(dirname(chemin), { recursive: true });
    const aUnDefaut = porteUnDefaut(readFileSync(join(RACINE, source), 'utf8'));
    writeFileSync(chemin, pontDePorte(source, aUnDefaut));
    ponts.push(nom);
  }
  return { declarations: emis.length, ponts };
}

/**
 * TOUT CE QUI EST PUBLIÉ EN CODE SE DÉCRIT — les portes regroupées ET les fichiers COPIÉS.
 *
 * ⛔ MA PREMIÈRE ÉCRITURE NE LISAIT QUE `portes`, ET `./empreinte` EST SORTIE SANS DESCRIPTION.
 * C'est une porte publiée comme les autres ; elle est seulement COPIÉE au lieu d'être regroupée,
 * parce que le publieur y grave le commit et qu'un regroupeur réécrirait la ligne gravée. La façon
 * dont un fichier arrive dans `dist/` ne change rien à ce que le consommateur en voit.
 *
 * ⚠️ Le garde `une_porte_publiee_se_decrit.mjs` l'a trouvée à la première exécution : il compte les
 * portes du MANIFESTE, pas celles de la table. *Un garde qui énumère la source du geste ne voit
 * jamais ce que le geste a oublié.*
 */
export function sourcesADecrire() {
  return [...Object.entries(TABLE.portes), ...Object.entries(TABLE.copies || {})]
    .filter(([cible]) => cible.endsWith('.js'));
}

/** Les cibles `.d.ts` que ce script produit — la liste opposable, dérivée de la table. */
export function ciblesDeTypes() {
  return sourcesADecrire().map(([c]) => c.replace(/\.js$/, '.d.ts')).sort();
}

if (process.argv[1] && process.argv[1].endsWith('deriver-types.mjs')) {
  const { declarations, ponts } = deriverLesTypes(join(RACINE, 'dist'));
  console.log(`[types] ${ponts.length} porte(s) décrite(s) — ${declarations} déclaration(s) dérivée(s) du code`);
}
