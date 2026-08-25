#!/usr/bin/env node
/**
 * FABRIQUE L'ÉTAT VISÉ PAR LA PHASE 3, HORS DE L'ARBRE, ET REND SON ÉCART AU PAQUET PUBLIÉ.
 *
 * ⛔ CE QU'IL REMPLACE, ET POURQUOI. Mon préavis du 2026-08-25 portait un tableau de prédictions
 * RÉDIGÉ : quatre lignes, dont deux fausses, et l'une incompatible avec une autre du même tableau —
 * j'annonçais que le prototype existerait comme objet au sommet, et deux lignes plus bas que ma porte
 * rendrait seize entrées sans lui. **Trois dépôts ont mesuré ce texte**, proprement, et sont arrivés
 * à dix-sept ; deux ont retiré un garde ou un chiffre sur un cas qui venait de là.
 *
 * ⇒ **Une prédiction qui n'est pas une mesure n'est pas falsifiable : elle est falsifiée d'avance.**
 * J'avais six états mesurés sous la main quand j'ai rédigé ce tableau.
 *
 * ⇒ Et l'architecte l'a formulé le même soir, sur un autre cas : *« un zéro se suspecte, une
 * supposition n'en produit pas — celle qui rend un chiffre faux se rattrape, celle qui n'en rend
 * aucun voyage. »*
 *
 * ⛔ DONC : UN OUTIL, JAMAIS UN TABLEAU. Un tableau périme en silence dès que la forme bouge ; un
 * outil se relance. Ce script fabrique l'état, le mesure, et rend l'écart — chez moi comme chez un
 * voisin qui veut le vérifier sans me croire.
 *
 * ⚠️ IL N'ÉCRIT RIEN DANS CE DÉPÔT. Il copie les fichiers suivis dans un dossier temporaire, y
 * applique la transformation, régénère le paquet là-bas, compare, et efface. Un instrument qui
 * salirait l'arbre casserait la fenêtre de mesure d'un voisin en permanence — c'est le piège que
 * kronos a mesuré le 2026-08-14 en posant l'outil censé l'aider.
 *
 *     node scripts/etat-vise.mjs            l'écart, catalogue par catalogue
 *     node scripts/etat-vise.mjs --garder   garde le dossier et dit où il est
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const RACINE = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const garder = process.argv.includes('--garder');

/**
 * LA TRANSFORMATION, EN UN SEUL ENDROIT — c'est elle que le préavis décrit, et elle est ici sous
 * forme exécutable plutôt que sous forme de prose.
 *
 * ⛔ TROIS GESTES, ET LE TROISIÈME EST CELUI QUI COMPTE : la ligne de tête `def <fichier> (…)`
 * devient `object <type> (…)`, les entrées passent de `def <nom>` à `<type> <nom>`, et le générateur
 * apprend qu'une ligne de tête devient le CORPS du fichier au lieu d'une entrée. Sans ce troisième,
 * le prototype atterrit comme un membre et le compte d'entrées monte de un.
 */
const TRANSFORME = [
  ['lib/alphabets.bpsl',
   'def alphabets (documented:true, resolvedBy:Kairos, resolves:alphabet)',
   'object alphabet (documented:true, resolvedBy:Kairos)'],
];
const SITE_GENERATEUR = [
  'src/transpiler/libs-bundle.js',
  "      if (d.name === entry.replace('.bpsl', '')) {",
  "      if (d.name === entry.replace('.bpsl', '') || d.derivedeDe === 'object') {",
];

const bac = mkdtempSync(join(tmpdir(), 'bpscript-etat-vise-'));
try {
  // ── LA COPIE — les fichiers SUIVIS, jamais un balayage de dossier ────────────────────────────
  const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: RACINE })
    .split('\n').filter(Boolean);
  if (suivis.length < 100) throw new Error(`ASSIETTE VIDE : ${suivis.length} fichier(s) suivis.`);
  for (const f of suivis) {
    mkdirSync(join(bac, dirname(f)), { recursive: true });
    cpSync(join(RACINE, f), join(bac, f));
  }
  execFileSync('ln', ['-s', join(RACINE, 'node_modules'), join(bac, 'node_modules')]);

  // ── LA TRANSFORMATION ────────────────────────────────────────────────────────────────────────
  const patch = (chemin, avant, apres) => {
    const p = join(bac, chemin);
    const t = readFileSync(p, 'utf8');
    if (!t.includes(avant)) {
      throw new Error(`SITE INTROUVABLE dans ${chemin} — la source a changé, cet outil décrit un `
        + `état qui n'existe plus. Le corriger, ou le retirer : un outil qui ment est pire qu'aucun.`
        + `\n  cherché : ${avant.slice(0, 90)}`);
    }
    writeFileSync(p, t.replace(avant, apres, 1));
  };
  for (const [f, a, b] of TRANSFORME) patch(f, a, b);
  {
    const p = join(bac, TRANSFORME[0][0]);
    writeFileSync(p, readFileSync(p, 'utf8').replace(/^def /gm, 'alphabet '));
  }
  patch(...SITE_GENERATEUR);

  execFileSync('npm', ['run', 'bundle:libs', '--silent'], { cwd: bac, stdio: 'pipe' });

  // ── L'ÉCART, CATALOGUE PAR CATALOGUE ─────────────────────────────────────────────────────────
  const avant = (await import(`${RACINE}/src/transpiler/libs-data.js`));
  const apres = (await import(`${bac}/src/transpiler/libs-data.js`));
  const noms = [...new Set([...Object.keys(avant.LIBS), ...Object.keys(apres.LIBS)])].sort();

  console.log(`ÉTAT VISÉ PAR LA PHASE 3 — écart au paquet publié (${suivis.length} fichiers copiés)\n`);
  let bouge = 0;
  for (const n of noms) {
    const x = JSON.stringify(avant.LIBS[n]), y = JSON.stringify(apres.LIBS[n]);
    if (x === y) continue;
    bouge++;
    const ca = Object.keys(avant.LIBS[n] || {}), cb = Object.keys(apres.LIBS[n] || {});
    const partis = ca.filter((k) => !cb.includes(k)), venus = cb.filter((k) => !ca.includes(k));
    console.log(`  ${n}`);
    console.log(`      clés ${ca.length} → ${cb.length}`
      + (partis.length ? ` · PARTENT : ${partis.join(', ')}` : '')
      + (venus.length ? ` · ARRIVENT : ${venus.join(', ')}` : '')
      + (!partis.length && !venus.length ? ' · mêmes clés, contenu différent' : ''));
  }
  console.log(`\n  ${bouge} catalogue(s) bougent sur ${noms.length}.`);
  console.log(`  ⇒ Les autres sont identiques OCTET POUR OCTET : un consommateur qui ne lit qu'eux `
    + `ne verra rien changer, et c'est une issue à mesurer comme les autres.`);
  console.log(`\n  ⚠️ Cet écart est celui de la PHASE 3 SEULE. La phase 2 — la dérivation résolue — `
    + `attend\n     un arbitrage de Romain qui décide si un exemplaire hérite AUSSI les champs que son `
    + `prototype\n     porte : 1720 membres ajoutés sur 711 entrées si oui.`);
  if (garder) console.log(`\n  dossier gardé : ${bac}`);
} finally {
  if (!garder) rmSync(bac, { recursive: true, force: true });
}
