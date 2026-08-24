#!/usr/bin/env node
/**
 * GÉNÉRATEUR DE LA CARTE DU RÉEL — `docs/arch/carte-reel.md`.
 *
 * ⛔ CE QUI RECENSE SE GÉNÈRE, CE QUI ENSEIGNE S'ÉCRIT. Décision de méthode de l'architecte,
 * 2026-08-24 : la carte recense l'état de mon code, donc elle se génère, chez moi, au portillon ; le
 * document d'architecture enseigne la cible et l'écart, il s'écrit chez Atlas, et il cite celle-ci.
 *
 * ⛔ CE QUI A COÛTÉ CE GÉNÉRATEUR. La carte était tenue à la main, générée une fois le 2026-06-29 et
 * jamais rejugée. Mesurée le 2026-08-24 :
 *
 *     parser.js      3075 annoncé  ·  7731 sur le disque      ×2,5
 *     bpxAst.js       205 annoncé  ·  3044 sur le disque      ×15
 *     libs.js         327 annoncé  ·  1341 sur le disque      ×4
 *     et QUATRE fichiers nommés qui n'existaient plus
 *
 * Son en-tête la donnait pour une mesure — *« photo du code, zéro orphelin prouvé »*. **Un
 * recensement tenu à la main périme sans rougir, et celui-ci se lisait comme une preuve.**
 *
 * ⚠️ ET UN FORMATEUR A FAILLI LA CERTIFIER : 33 lignes de colonnes réalignées, aucun chiffre touché,
 * sur un document faux. **Un diff qui ne change rien sur un document faux le certifie.**
 *
 * ⛔ CE QUE CETTE CARTE NE PORTE PLUS, ET POURQUOI. L'ancienne rangeait les fichiers en BLOCS —
 * FRONTAL, RESOLUTION, SORTIE_BP3, OUTILLAGE. C'était un JUGEMENT tenu à la main, et il a dérivé
 * avec le reste : trois de ses quatre blocs nommaient des fichiers supprimés. Un jugement ne se
 * génère pas ; il vit dans le document qui enseigne. **Cette carte ne porte que ce qui se mesure.**
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const RACINE = new URL('..', import.meta.url).pathname;
const DIR = join(RACINE, 'src', 'transpiler');

/** Le rôle d'un module : la première ligne de prose de son en-tête, telle qu'elle est écrite. */
function role(texte) {
  for (const l of texte.split('\n').slice(0, 40)) {
    const m = l.match(/^\s*\*\s+(.+?)\s*$/);
    if (!m) continue;
    const t = m[1].replace(/^[⛔⚠️✓·]+\s*/, '').trim();
    if (t && !/^[=─-]+$/.test(t) && t.length > 12) return t.replace(/\|/g, '\\|').slice(0, 96);
  }
  return '—';
}

/** Ce qu'un module importe DE SES VOISINS DE DOSSIER — la seule arête que ce dossier porte. */
function importsLocaux(texte) {
  const out = new Set();
  for (const m of texte.matchAll(/(?:from|import)\s*\(?\s*['"]\.\/([\w.-]+\.m?js)['"]/g)) out.add(m[1]);
  return [...out];
}

const fichiers = readdirSync(DIR).filter((f) => /\.(m?js)$/.test(f) && !f.endsWith('.d.ts')).sort();
if (!fichiers.length) {
  console.error('[carte] ⛔ ZÉRO module examiné — le générateur ne mesure rien et refuse de publier.');
  process.exit(1);
}

const mods = fichiers.map((f) => {
  const texte = readFileSync(join(DIR, f), 'utf8');
  return {
    nom: f,
    lignes: texte.split('\n').length,
    genere: /Auto-generated|do not edit/i.test(texte.slice(0, 400)),
    role: role(texte),
    importe: importsLocaux(texte).filter((x) => fichiers.includes(x)),
  };
});
const parNom = new Map(mods.map((m) => [m.nom, m]));
for (const m of mods) m.importeurs = mods.filter((x) => x.importe.includes(m.nom)).map((x) => x.nom);

// ⛔ LES CYCLES SE CHERCHENT, ils ne se supposent pas absents.
const cycles = [];
{
  const etat = new Map();
  const pile = [];
  const marcher = (n) => {
    if (etat.get(n) === 'fini') return;
    if (etat.get(n) === 'encours') { cycles.push([...pile.slice(pile.indexOf(n)), n].join(' → ')); return; }
    etat.set(n, 'encours'); pile.push(n);
    for (const v of parNom.get(n).importe) marcher(v);
    pile.pop(); etat.set(n, 'fini');
  };
  for (const m of mods) marcher(m.nom);
}

const total = mods.reduce((s, m) => s + m.lignes, 0);
const orphelins = mods.filter((m) => !m.importe.length && !m.importeurs.length);
// ⛔ AUCUN COMMIT DANS CETTE CARTE, ET C'EST UNE MESURE QUI L'A EXIGÉ. Ma première écriture gravait
// la révision courante — et le portillon de poussée a REFUSÉ la poussée : committer la carte change
// le commit, donc la carte se périmait elle-même à l'instant où elle était enregistrée. Un artefact
// qui porte l'état du dépôt AU MOMENT où il y entre ne peut jamais être à jour.
//
// ⚠️ Le patron de publication le dit d'une autre façon : « une ligne d'empreinte n'est pas
// reproductible, elle porte une date ». Une CARTE n'est pas une empreinte : ce qu'on lui demande est
// ce que le code EST, pas quand elle a été prise. La provenance vit dans l'historique du fichier.

const l = [];
l.push('# Carte du réel — transpileur BPScript (`src/transpiler/`)');
l.push('');
l.push('> **CE DOCUMENT SE GÉNÈRE** — `npm run carte`, appelé par le portillon. Toute édition à la');
l.push('> main est écrasée à la passe suivante. Ce qui ENSEIGNE — la cible, l\'écart, le jugement —');
l.push('> vit dans le document d\'architecture, chez Atlas, qui cite celui-ci.');
l.push('## Ce qui est mesuré');
l.push('');
l.push(`- **${mods.length} modules** dans \`src/transpiler/\`, **${total} lignes**.`);
l.push('- Le **rôle** est lu dans l\'en-tête de chaque fichier, verbatim — jamais interprété.');
l.push('- Les **arêtes** sont les imports d\'un module vers un voisin du même dossier.');
l.push('');
l.push('## Modules');
l.push('');
l.push('| Module | Lignes | Importe | Importé par | Rôle (lu dans l\'en-tête) |');
l.push('| --- | ---: | ---: | ---: | --- |');
for (const m of [...mods].sort((a, b) => b.lignes - a.lignes)) {
  l.push(`| \`${m.nom}\`${m.genere ? ' *(généré)*' : ''} | ${m.lignes} | ${m.importe.length} | ${m.importeurs.length} | ${m.role} |`);
}
l.push('');
l.push('## Flux réel');
l.push('');
l.push('```mermaid');
l.push('flowchart LR');
for (const m of mods) {
  const id = m.nom.replace(/\W/g, '_');
  l.push(`  ${id}["${m.nom}"]`);
}
for (const m of mods) {
  for (const v of m.importe) l.push(`  ${m.nom.replace(/\W/g, '_')} --> ${v.replace(/\W/g, '_')}`);
}
l.push('```');
l.push('');
l.push('## Ce que la mesure trouve');
l.push('');
l.push(`- **Cycles d'import** : ${cycles.length}${cycles.length ? ` — ${cycles.join(' · ')}` : ''}.`);
l.push(`- **Modules sans aucune arête** : ${orphelins.length}`
  + `${orphelins.length ? ` — ${orphelins.map((m) => `\`${m.nom}\``).join(', ')}` : ''}.`);
l.push('  Un module sans arête dans ce dossier n\'est pas mort : il peut être un point d\'entrée, ou');
l.push('  être importé depuis `test/`, `scripts/` ou par un voisin. La mesure porte sur CE dossier.');
l.push(`- **Modules générés** : ${mods.filter((m) => m.genere).length}`
  + ` — ${mods.filter((m) => m.genere).map((m) => `\`${m.nom}\``).join(', ')}.`);
l.push('');

const sortie = join(RACINE, 'docs', 'arch', 'carte-reel.md');
const texte = l.join('\n') + '\n';
if (process.argv.includes('--verifier')) {
  const actuel = (() => { try { return readFileSync(sortie, 'utf8'); } catch { return null; } })();
  if (actuel === texte) {
    console.log(`[carte] ✓ à jour — ${mods.length} modules · ${total} lignes · ${cycles.length} cycle(s)`);
    process.exit(0);
  }
  console.error('[carte] ⛔ LA CARTE DU RÉEL EST PÉRIMÉE — régénérer par `npm run carte`.');
  console.error('        Un recensement tenu à la main périme sans rougir, et celui-ci se lit comme');
  console.error('        une preuve : son en-tête le dit « ce qui EST ». Mesuré une fois : il annonçait');
  console.error('        parser.js à 3075 lignes pour 7731, et nommait quatre fichiers supprimés.');
  process.exit(1);
}
writeFileSync(sortie, texte);
console.log(`[carte] écrite — ${mods.length} modules · ${total} lignes · ${cycles.length} cycle(s) · `
  + `${orphelins.length} sans arête`);
