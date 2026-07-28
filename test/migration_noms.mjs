#!/usr/bin/env node
/**
 * OUTIL DE MIGRATION — renommer les noms en collision SANS changer la musique.
 *
 * ⚠️ LE PIÈGE QU'IL EXISTE POUR PARER, et il est silencieux : une tête de règle nommée comme une
 * note MASQUE cette note. Renommer la tête sans renommer TOUS ses usages fait redevenir le nom une
 * NOTE — la pièce sonne autre chose, sans qu'aucune erreur ne se produise nulle part. Et une
 * partie de ces scènes sont le corpus qui mesure notre conformité au moteur natif : une migration
 * qui change une production ferait diverger la campagne, et on la lirait comme un bug moteur
 * pendant des jours.
 *
 * LA PARADE N'EST PAS LA PRUDENCE, C'EST LA MESURE : l'outil dérive la scène AVANT et APRÈS avec
 * la MÊME graine, compare les jetons produits, et REFUSE d'écrire si un seul diffère. Relire un
 * renommage ne prouve rien ; comparer deux productions, si.
 *
 * IL NE CORRIGE PAS TOUT SEUL CE QU'IL NE SAIT PAS VÉRIFIER : sur une scène qu'il ne parvient pas
 * à dériver (moteur absent, scène incomplète), il REFUSE de migrer plutôt que de renommer à
 * l'aveugle. Un renommage non vérifié vaut moins que pas de renommage.
 *
 * USAGE — par défaut il n'écrit RIEN :
 *   node test/migration_noms.mjs <fichier.bps|dossier> [...]        → rapport seul (essai à blanc)
 *   node test/migration_noms.mjs --ecrire <fichier.bps|dossier>     → applique, si et seulement si
 *                                                                     la production est identique
 *   node test/migration_noms.mjs --suffixe=_nt <fichier.bps>        → choisir le suffixe (défaut `_r`)
 *
 * Chaque propriétaire le lance SUR SON PROPRE DÉPÔT. Cet outil ne va écrire nulle part de lui-même.
 *
 * ⚠️ CE QU'IL NE COUVRE PAS, ET LE PIÈGE QUI ATTEND CELUI QUI VOUDRA L'ÉLARGIR.
 * Il ne parcourt que les fichiers de SCÈNE. Or des grammaires vivent aussi DANS des fichiers de
 * test, écrites en chaînes de caractères — elles échappent donc à la migration et rougissent quand
 * la règle d'unicité est posée (4 cas chez BPx, repris à la main ; Kanopi a le même angle mort).
 *
 * ET LE PIÈGE EST PIRE QUE L'OUBLI : dans une chaîne, le retour à la ligne s'écrit avec DEUX
 * caractères, la barre et la lettre `n`. Une tête de règle y est donc précédée de la LETTRE `n`,
 * que l'ancrage compte comme un caractère de nom — il ne renomme alors que le membre droit. C'est
 * EXACTEMENT le renommage à moitié que cet outil existe pour empêcher, et BPx se l'est fait à
 * lui-même au premier essai.
 * Élargir la collecte aux chaînes n'est donc pas « ajouter une extension de fichier » : ça
 * commence par corriger l'ancrage pour ce cas, sinon l'outil fabrique en silence le défaut qu'il
 * est censé prévenir.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { expandAlphabetTerminals } from '../src/transpiler/actorResolver.js';
import { resolveActorAlphabet } from '../src/transpiler/libs.js';
import { LIBS } from '../src/transpiler/libs-data.js';

const GRAINE = 12345;   // fixe : deux dérivations ne sont comparables qu'à tirage identique.

/** Le moteur, chargé au besoin. Absent ⇒ on le DIT et on ne migre rien (jamais en silence). */
let Session = null;
export async function chargerMoteur(chemin) {
  const url = chemin
    ? pathToFileURL(path.resolve(chemin)).href
    : pathToFileURL(path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'BPx', 'dist', 'index.js')).href;
  try {
    ({ Session } = await import(url));
    return typeof Session === 'function';
  } catch { return false; }
}

/**
 * Les terminaux de l'alphabet RÉELLEMENT ACTIF de cette scène, et de lui seul.
 *
 * ⚠️ Jamais « les trois conventions à la fois » : un nom d'allure sargam dans une scène
 * occidentale n'est PAS une collision. Un voisin a doublé son chiffre sur cette confusion —
 * ici c'est l'alphabet résolu qui décide, et rien d'autre.
 */
export function terminauxActifs(ast) {
  const t = new Set();
  const ajouter = (nom, oct) => {
    const lib = resolveActorAlphabet(nom, ast.directives);
    if (!lib || !lib.notes) return;
    for (const x of expandAlphabetTerminals(lib, oct)) t.add(x);
    const alts = lib.alterations && typeof lib.alterations === 'object' && !Array.isArray(lib.alterations)
      ? Object.keys(lib.alterations) : [''];
    for (const n of lib.notes) for (const al of alts) t.add(n + al);   // forme nue
  };
  const sa = (ast.directives || []).find((d) => d.name === 'alphabet' && d.subkey);
  const so = (ast.directives || []).find((d) => d.name === 'octaves' && (d.subkey || d.runtime));
  if (sa) ajouter(sa.subkey, so ? (so.subkey || so.runtime) : null);
  for (const a of ast.actors || []) {
    const p = a.properties || {};
    if (p.alphabet) ajouter(p.alphabet, p.octaves || null);
  }
  return t;
}

/**
 * Les noms EN COLLISION avec un terminal, par sorte.
 *
 * ⚠️ Le critère est CE QUI CRÉE UN NOM, jamais « ce qui commence par une directive ». Une
 * déclaration `gate Sa:sc` pose une PROPRIÉTÉ sur un nom existant : mesuré, le nœud produit est
 * identique avec et sans elle, elle ne crée aucun nom rival. Elle n'est donc PAS une collision et
 * ne figure pas ici. Un garde qui filtrerait sur la forme de la ligne se tromperait.
 */
export function collisions(ast) {
  const T = terminauxActifs(ast);
  const trouve = new Map();   // nom → sortes
  const noter = (nom, sorte) => {
    if (!nom || !T.has(nom)) return;
    if (!trouve.has(nom)) trouve.set(nom, new Set());
    trouve.get(nom).add(sorte);
  };
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) for (const s of r.lhs || []) noter(s?.name, 'tête de règle');
  }
  for (const m of ast.macros || []) noter(m?.name, 'macro');
  for (const a of ast.aliases || []) noter(a?.name, 'alias');
  for (const e of ast.inputs || []) noter(e?.name, 'entrée');
  for (const v of ast.vars || []) noter(typeof v === 'string' ? v : v?.name, 'variable de travail');
  for (const a of ast.actors || []) if (!a.synthetic) noter(a?.name, 'acteur');
  for (const s of ast.scenes || []) noter(s?.name, 'scène');
  for (const c of ast.cvInstances || []) noter(c?.name, 'objet CV');
  return trouve;
}

/**
 * Renommage PRUDENT — identifiants ENTIERS uniquement.
 *
 * `A` ne doit jamais toucher `A4` : c'est exactement l'erreur qui transforme une note en autre
 * chose. On ancre des deux côtés sur « pas un caractère de nom ».
 */
/**
 * Ce qui peut CONTINUER un terminal, mesuré sur les alphabets — jamais deviné.
 *
 * ⚠️ L'ancrage n'interdisait que lettres, chiffres et souligné. Il ne connaissait pas le DIÈSE :
 * `A` protégeait bien `A4` — c'était écrit et c'était vrai — mais mordait `A#5`, qui devenait
 * `A_r#5`. Une note redevenue autre chose en silence, TEXTUELLEMENT le piège que cet outil existe
 * pour parer. Trois scènes cassées chez BPx avant qu'il le voie.
 * La parade n'est pas d'ajouter le dièse : c'est de LIRE les signes d'altération dans les
 * bibliothèques. Un alphabet qui en apporterait un nouveau étend l'ancrage tout seul — rien à
 * penser au bon moment, et c'est ce qui manquait la première fois.
 */
function signesDAlteration() {
  const cars = new Set();
  const parcourir = (o) => {
    if (!o || typeof o !== 'object') return;
    if (o.alterations && typeof o.alterations === 'object' && !Array.isArray(o.alterations)) {
      for (const k of Object.keys(o.alterations)) for (const c of k) if (!/[A-Za-z0-9_]/.test(c)) cars.add(c);
    }
    for (const k in o) if (o[k] && typeof o[k] === 'object') parcourir(o[k]);
  };
  for (const nom of Object.keys(LIBS)) parcourir(LIBS[nom]);
  return [...cars];
}

export function renommer(source, avant, apres) {
  const suite = ('A-Za-z0-9_' + signesDAlteration().map((c) => c.replace(/[.*+?^${}()|[\]\\\-]/g, '\\$&')).join(''));
  const motif = new RegExp(`(^|[^${suite}])${avant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![${suite}])`, 'g');
  // ⚠️ LE CODE ENTRE BACKTICKS EST INTOUCHABLE, et ce n'est pas un scrupule : le comparateur de
  // production est AVEUGLE à ce qu'il contient. Le code est porté opaque jusqu'au runtime, donc
  // le réécrire ne change AUCUN jeton produit — l'outil déclarerait « production identique » sur
  // une scène dont il vient de casser le code. Mesuré le 2026-07-28 : `A -> C4 \`js: A + 1\``
  // devenait `A_r -> C4 \`js: A_r + 1\`` et l'outil disait OK.
  // C'est la limite exacte de la garantie : elle porte sur ce que la dérivation produit, pas sur
  // ce qu'un runtime exécutera plus tard. Là où on ne peut pas prouver, on ne touche pas.
  // ⚠️ LES COMMENTAIRES AUSSI SONT INTOUCHABLES (mesuré par Kanopi le 2026-07-28). L'outil y
  // renommait, et le cas grave n'est pas la prose abîmée : c'est qu'une CITATION de la grammaire
  // native se met à suivre nos renommages. Une citation qui change avec nous n'est plus une
  // citation — elle devient un faux témoin, et c'est précisément sur ces conversions que la
  // comparaison au natif doit rester lisible.
  const zonesProtegees = /(`[^`]*`|\/\/[^\n]*)/;
  return source.split(zonesProtegees).map((bout) =>
    (bout.startsWith('`') && bout.endsWith('`') && bout.length > 1) || bout.startsWith('//')
      ? bout                                   // backtick et commentaire traversent intacts
      : bout.replace(motif, `$1${apres}`)).join('');
}

/**
 * L'empreinte d'une production : L'ARBRE DÉRIVÉ ENTIER, chronomètres neutralisés.
 *
 * ⚠️ ELLE A ÉTÉ UNE LISTE DE CHAMPS CHOISIS, ET C'ÉTAIT LE DÉFAUT DE FOND. D'abord le rang du
 * symbole — aveugle à un renommage cohérent. Puis le nom — aveugle aux feuilles qui portent leur
 * note ailleurs : sur les scènes converties du natif, Kanopi a mesuré qu'on pouvait remplacer
 * `E2` par `C7` sans que le verdict bouge. Deux corrections successives du MÊME défaut : une
 * empreinte bâtie sur des champs choisis ne vaut que ce que valait le choix, et le prochain angle
 * mort sera invisible de la même façon.
 *
 * On compare donc TOUT, et on retire seulement ce qui n'est pas de la musique : les chronomètres.
 * Le juge devient plus sévère que nécessaire — c'est voulu. S'il se trompe, il REFUSE : l'erreur
 * se voit et s'inspecte, au lieu de certifier à tort. Mesuré : stable sur deux dérivations d'une
 * même source, et aucun faux refus sur les scènes migrables.
 *
 * (Proposition de Kanopi, retenue telle quelle.)
 */
const CHRONOMETRES = /^(derivation[A-Za-z]*Ms|[a-z][A-Za-z]*TimeMs|elapsed[A-Za-z]*|timestamp[A-Za-z]*)$/;
export function production(source) {
  const { ast, errors } = compileToBPxAST(source);
  if (!ast) return { erreur: (errors || []).map((e) => e.message ?? String(e)).join(' | ') || 'aucun arbre' };
  if (!Session) return { erreur: 'moteur absent' };
  let session;
  try { session = new Session(ast, { seed: GRAINE }); }
  catch (e) { return { erreur: 'chargement refusé : ' + String(e.message).slice(0, 160) }; }
  for (const m of ['derive', 'step', 'tick', 'produce', 'run']) {
    if (typeof session[m] === 'function') { try { session[m](); } catch { /* la dérivation suffit */ } }
  }
  const arbre = session.tree ?? session._lastTree ?? null;
  if (!arbre) return { erreur: 'aucun arbre dérivé' };
  return { jetons: JSON.stringify(arbre, (k, v) => (CHRONOMETRES.test(k) ? undefined : v)) };
}

/**
 * Migre UNE source en mémoire et VÉRIFIE. Rend toujours un verdict explicite ; ne décide jamais
 * d'écrire — c'est l'appelant qui écrit, et seulement sur `ok:true`.
 */
export function migrerSource(source, suffixe = '_r') {
  const { ast } = compileToBPxAST(source);
  // Une scène qui ne compile PAS n'a rien à migrer : elle est HORS SUJET, pas refusée. La
  // distinction n'est pas cosmétique — un outil qui sort en erreur pour une raison qui n'est pas
  // la sienne apprend à son propriétaire à ignorer son code de sortie, et le jour où il refuse
  // pour une vraie raison, personne ne le lit.
  if (!ast) return { ok: true, horsSujet: true, renommages: [] };
  const enCollision = collisions(ast);
  if (!enCollision.size) return { ok: true, aucunChangement: true, renommages: [] };

  const avant = production(source);
  if (avant.erreur) {
    return { ok: false, motif: `production INVÉRIFIABLE avant migration (${avant.erreur}) — on ne renomme pas ce qu'on ne sait pas comparer` };
  }
  let migre = source;
  const renommages = [];
  for (const [nom, sortes] of enCollision) {
    let cible = `${nom}${suffixe}`;
    // Le nom d'arrivée ne doit être pris par RIEN — ni une note, ni un autre nom déjà là.
    const T = terminauxActifs(ast);
    let n = 2;
    while (T.has(cible) || new RegExp(`(^|[^A-Za-z0-9_])${cible}(?![A-Za-z0-9_])`).test(source)) {
      cible = `${nom}${suffixe}${n++}`;
    }
    migre = renommer(migre, nom, cible);
    renommages.push({ de: nom, vers: cible, sortes: [...sortes] });
  }
  const apres = production(migre);
  if (apres.erreur) return { ok: false, motif: `après migration : ${apres.erreur}`, renommages };
  if (avant.jetons !== apres.jetons) {
    return { ok: false, renommages,
      motif: 'LA PRODUCTION A CHANGÉ — le renommage a modifié la musique. On n\'écrit pas.' };
  }
  const restantes = collisions(compileToBPxAST(migre).ast || {});
  if (restantes.size) {
    return { ok: false, renommages,
      motif: `il reste ${restantes.size} collision(s) après migration : ${[...restantes.keys()].join(', ')}` };
  }
  return { ok: true, source: migre, renommages };
}

// ── Ligne de commande ────────────────────────────────────────────────────────
const estPrincipal = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (estPrincipal) {
  const args = process.argv.slice(2);
  const ecrire = args.includes('--ecrire');
  const suffixe = (args.find((a) => a.startsWith('--suffixe=')) || '--suffixe=_r').split('=')[1];
  const cibles = args.filter((a) => !a.startsWith('--'));
  if (!cibles.length) {
    console.error('usage : node test/migration_noms.mjs [--ecrire] [--suffixe=_r] <fichier.bps|dossier> ...');
    console.error('        sans --ecrire, rien n\'est modifié : c\'est un essai à blanc.');
    process.exit(2);
  }
  if (!await chargerMoteur()) {
    console.error('Le moteur (BPx dist) est introuvable : `npm run build` côté BPx.');
    console.error('SANS LUI, AUCUNE MIGRATION — la production ne peut pas être comparée, et un');
    console.error('renommage non vérifié change la musique en silence. Refus délibéré.');
    process.exit(1);
  }
  const fichiers = [];
  const collecter = (p) => {
    if (!existsSync(p)) return;
    if (statSync(p).isDirectory()) { for (const e of readdirSync(p)) collecter(path.join(p, e)); return; }
    if (p.endsWith('.bps')) fichiers.push(p);
  };
  cibles.forEach(collecter);

  let migres = 0, inchanges = 0, refuses = 0, horsSujet = 0;
  for (const f of fichiers.sort()) {
    const source = readFileSync(f, 'utf8');
    const r = migrerSource(source, suffixe);
    const nom = path.relative(process.cwd(), f);
    if (r.horsSujet) { horsSujet++; continue; }
    if (r.aucunChangement) { inchanges++; continue; }
    if (!r.ok) {
      refuses++;
      console.log(`✗ ${nom}\n    ${r.motif}`);
      if (r.renommages?.length) console.log(`    renommages tentés : ${r.renommages.map((x) => `${x.de}→${x.vers}`).join(', ')}`);
      continue;
    }
    migres++;
    console.log(`✔ ${nom}  production IDENTIQUE  ${r.renommages.map((x) => `${x.de}→${x.vers} (${x.sortes.join('+')})`).join(', ')}`);
    if (ecrire) writeFileSync(f, r.source);
  }
  console.log(`\n${fichiers.length} scène(s) · ${migres} à migrer (production vérifiée identique)`
    + ` · ${inchanges} sans collision · ${horsSujet} qui ne compilent pas (hors sujet)`
    + ` · ${refuses} REFUSÉE(S)`);
  console.log(ecrire ? 'Écriture effectuée sur les scènes vérifiées.'
    : 'Essai à blanc : RIEN n\'a été écrit. Relancer avec --ecrire pour appliquer.');
  if (refuses) {
    console.log('⚠️ Une scène refusée n\'est PAS un détail : soit sa production changerait, soit');
    console.log('   elle n\'est pas vérifiable. Dans les deux cas elle se migre à la main, et la');
    console.log('   production se compare avant de committer.');
    process.exit(1);
  }
}
