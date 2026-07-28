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
 *
 * ⚠️ ET UNE CONSÉQUENCE DE LA RÈGLE D'UNICITÉ, POUR QUI VOUDRA COMPARER À L'HISTOIRE.
 * Depuis qu'elle est posée, une scène d'AVANT la migration NE COMPILE PLUS avec le compilateur
 * d'aujourd'hui — c'est le but, mais ça rend l'histoire inmesurable par la voie évidente. Toute
 * comparaison avant/après doit donc extraire AUSSI LE COMPILATEUR D'AVANT, sinon le « avant » ne
 * produit rien et l'on conclut sur un vide en croyant conclure sur une différence.
 * bp3-frontend a failli s'y prendre, l'a vu, et l'a dit (2026-07-28). Quiconque re-mesurera une
 * scène ancienne dans trois mois tombera dessus : c'est écrit ici, pas dans un fil de messages.
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
/**
 * L'identifiant généré d'un bloc de code — EXCLUSION NOMMÉE, arbitrée par Romain (2026-07-28).
 *
 * Il encode COMMENT le langage a été connu : `BTauto0` quand il restait à résoudre, `BTstrudel0`
 * quand il est déclaré. Migrer une voix de code vers le tag le fait donc changer — parce qu'un
 * FAIT a changé, pas la musique : même code, même langage, même instant.
 * Romain, mot pour mot : « c'est juste un identifiant dans l'AST, on s'en fout de comment il
 * s'appelle ».
 *
 * ⚠️ C'est une exclusion ARBITRÉE, pas un champ que j'ai écarté parce qu'il me gênait. La
 * distinction est celle qui m'a coûté trois corrections aujourd'hui : une empreinte qui CHOISIT
 * ses champs ne vaut que le choix. Ici le choix n'est pas le mien, il est écrit, daté et motivé.
 */
/**
 * ⚠️ NEUTRALISÉ PAR SA FORME, JAMAIS PAR SA CLÉ. L'identifiant vit sous la clé `token` — la MÊME
 * que celle qui porte les notes. Écarter la clé rouvrirait exactement le trou que Kanopi a trouvé
 * ce soir (un comparateur aveugle aux hauteurs). On ne neutralise donc que les VALEURS de la forme
 * `BT<langage><rang>`, qui ne peuvent être qu'un identifiant généré de bloc de code.
 */
const NOM_GENERE_DE_CODE = /^BT[A-Za-z]*\d+$/;
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
  // ⚠️ LE CODE D'UN BLOC N'EST PAS DANS L'ARBRE DÉRIVÉ — seul son identifiant y voyage. Mesuré :
  // on remplace tout le contenu d'un bloc, l'arbre sort STRICTEMENT identique. Or c'est DANS ces
  // blocs que la migration de l'amalgame écrit (elle y pose le tag). Mon juge était donc aveugle
  // à l'endroit exact où mon outil agit — la même faute que ce matin, un cran plus loin.
  // Trouvé par Kanopi le 2026-07-28, en refusant de signer 44 migrations sur une seule mesure.
  const codes = [];
  const ramasserCode = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(ramasserCode);
    if (typeof n.type === 'string' && /Backtick/.test(n.type)) codes.push(`${n.payload?.interp ?? '?'}::${n.code ?? ''}`);
    for (const k in n) if (n[k] && typeof n[k] === 'object') ramasserCode(n[k]);
  };
  ramasserCode(ast);
  return {
    codes,
    jetons: JSON.stringify(arbre, (k, v) => {
      if (CHRONOMETRES.test(k)) return undefined;
      if (typeof v === 'string' && NOM_GENERE_DE_CODE.test(v)) return 'BT<identifiant généré>';
      return v;
    }),
  };
}

/**
 * L'AMALGAME acteur / tête de règle — la migration des voix de code (Romain, 2026-07-28).
 *
 * ⚠️ CE QUE C'EST, ET POURQUOI C'EST UNE ERREUR : écrire une règle dont la tête porte le nom d'un
 * acteur fait que le code du membre droit tire son langage DU NOM DE LA RÈGLE. Romain :
 * « ça amalgame un nom d'acteur et un nom de règle, c'est une erreur grave ». Un nom de règle est
 * une étiquette pour appeler la règle — il ne porte pas d'identité d'acteur.
 *
 * LA MIGRATION A DEUX GESTES, ET LE SECOND EST OBLIGATOIRE : renommer la tête NE SUFFIT PAS. En
 * perdant le nom de l'acteur, le code perd son langage et la scène est REFUSÉE. Il faut donc, dans
 * le même mouvement, donner au code son TAG — la forme qui annonce son langage elle-même.
 * Mesuré : tête renommée seule → « Backtick sans langage » ; tête renommée + tag → identique.
 */
function migrerAmalgame(source, ast, suffixe) {
  const moteurDe = {};
  for (const a of ast.actors || []) if (!a?.synthetic && a.properties?.eval) moteurDe[a.name] = a.properties.eval;
  if (!Object.keys(moteurDe).length) return null;

  // Les têtes de règle qui portent un nom d'acteur À MOTEUR D'ÉVALUATION. Un acteur SANS moteur
  // n'est pas concerné : rien n'hérite de lui, donc rien à migrer — c'est le troisième cas que
  // Kanopi a testé sur son propre instrument avant de donner son chiffre.
  const tetes = new Set();
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      for (const t of r.lhs || []) if (t?.name && !t.negated && moteurDe[t.name]) tetes.add(t.name);
    }
  }
  if (!tetes.size) return null;

  let migre = source;
  const gestes = [];
  for (const nom of tetes) {
    const moteur = moteurDe[nom];
    // 1. LE TAG D'ABORD, tant que la tête porte encore le nom : c'est lui qui identifie les lignes
    //    concernées. Seuls les backticks SANS tag sont touchés (`langage: …` est déjà explicite).
    migre = migre.replace(
      new RegExp(`(^${nom}\\s*->[^\n]*?)\`(?![A-Za-z_][A-Za-z0-9_]*\\s*:)`, 'gm'),
      `$1\`${moteur}: `);
    // 2. PUIS la tête et ses appels cessent de porter le nom de l'acteur.
    //    ⚠️ La ligne de DÉCLARATION est épargnée — l'acteur garde son nom, c'est la règle qui cède.
    //    ⚠️ Et un renvoi POINTÉ (`nom.terminal`) est épargné aussi : là le nom désigne bien
    //       l'acteur, c'est son emploi légitime, et le renommer casserait la qualification.
    let cible = `${nom}${suffixe}`;
    let n = 2;
    while (new RegExp(`(^|[^A-Za-z0-9_])${cible}(?![A-Za-z0-9_])`).test(source)) cible = `${nom}${suffixe}${n++}`;
    migre = migre.split('\n').map((l) => (l.trimStart().startsWith('@actor')
      ? l
      : l.replace(new RegExp(`(^|[^A-Za-z0-9_])${nom}(?![A-Za-z0-9_.])`, 'g'), `$1${cible}`))).join('\n');
    gestes.push({ de: nom, vers: cible, sortes: [`voix de code ${moteur}`] });
  }
  return { source: migre, gestes };
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
  const amalgame = migrerAmalgame(source, ast, suffixe);
  if (!enCollision.size && !amalgame) return { ok: true, aucunChangement: true, renommages: [] };

  const avant = production(source);
  if (avant.erreur) {
    return { ok: false, motif: `production INVÉRIFIABLE avant migration (${avant.erreur}) — on ne renomme pas ce qu'on ne sait pas comparer` };
  }
  let migre = amalgame ? amalgame.source : source;
  const renommages = amalgame ? [...amalgame.gestes] : [];
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
  // ── LE CODE DES BLOCS ────────────────────────────────────────────────────────
  // ⚠️ POSER LE TAG TRIME LE BLOC : le langage retire le saut de ligne d'ouverture et celui de
  // fermeture d'un bloc TAGUÉ, et ne les retire pas d'un bloc hérité. Deux caractères de bord.
  // Mesuré par Kanopi sur 9 scènes p5, reproduit ici sur deux scènes minimales.
  // CE N'EST PAS un effet de l'insertion (essayé avec un saut de ligne après le tag : même
  // résultat) — c'est une ASYMÉTRIE DU LANGAGE, remontée à Romain, pas tranchée ici.
  //
  // On NE LE TAIT PAS. Le code a changé, et le dire est le minimum : l'outil l'ANNONCE à chaque
  // scène concernée. On ne certifie « identique » que ce qui l'est.
  const avantC = avant.codes ?? [], apresC = apres.codes ?? [];
  const memeCodeAuBordPres = avantC.length === apresC.length
    && avantC.every((c, i) => c.trim() === (apresC[i] ?? '').trim());
  const codeIdentique = JSON.stringify(avantC) === JSON.stringify(apresC);
  let avertissement = null;
  if (!codeIdentique && memeCodeAuBordPres) {
    avertissement = 'le code des blocs est TRIMÉ par la pose du tag (saut de ligne d\'ouverture et '
      + 'de fermeture) — asymétrie du langage, inerte pour js/p5/csound, remontée à Romain';
  } else if (!codeIdentique) {
    return { ok: false, renommages,
      motif: 'LE CODE D\'UN BLOC A CHANGÉ autrement que par le trim des bords. On n\'écrit pas.' };
  }
  // L'amalgame doit avoir DISPARU, pas seulement les collisions de noms : sans ce contrôle, une
  // migration qui renomme la tête sans poser le tag passerait pour un succès — or c'est justement
  // la moitié qui casse la scène.
  const astApres = compileToBPxAST(migre).ast || {};
  if (migrerAmalgame(migre, astApres, suffixe)) {
    return { ok: false, renommages, motif: "l'amalgame acteur/tête de règle subsiste après migration" };
  }
  const restantes = collisions(astApres);
  if (restantes.size) {
    return { ok: false, renommages,
      motif: `il reste ${restantes.size} collision(s) après migration : ${[...restantes.keys()].join(', ')}` };
  }
  return { ok: true, source: migre, renommages, ...(avertissement ? { avertissement } : {}) };
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
    if (r.avertissement) console.log(`    ⚠️ ${r.avertissement}`);
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
