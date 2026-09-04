#!/usr/bin/env node
/**
 * CE QUE LA LISTE DE HUIT NOMS FERME, ET CE QUE SA DISPARITION OUVRE.
 *
 * La sonde `publier-rend-il-invocable.mjs` a établi le 2026-08-29 que **publier rend invocable**, et
 * que le seul discriminant est la liste de `libs-champs.js` — celle que la phase 3 supprime. Restait
 * à chiffrer ce que sa disparition ouvre, et à savoir ce que l'invocation ouverte PRODUIT.
 *
 * ⛔ ELLE FABRIQUE LE CAS : elle VIDE la liste dans une copie hors arbre — ce que la phase 3 fera —
 * puis invoque chaque clé que la liste fermait, une par une. Raisonner sur ce que le compilateur
 * ferait n'est pas une mesure ; un catalogue sans prototype et un catalogue dont le prototype serait
 * fermé ont la même empreinte.
 *
 * ⛔ ET ELLE SOUSTRAIT UNE LIGNE DE BASE. Un arbre de scène porte déjà des sous-grammaires et des
 * terminaux **sans aucune invocation** : sans cette soustraction, toute invocation paraît porter
 * quelque chose, et le compte est faux dans le sens qui rassure. Deux instruments successifs sont
 * tombés dessus le 2026-08-29 — le premier comptait ce que le séparateur de sous-grammaires crée.
 *
 * ⚠️ CE QU'ELLE NE DIT PAS : ce que l'aval FAIT de la trace qu'elle mesure. La qualifier appartient
 * à qui la lit. Cette sonde rend ce qui SORT d'ici, et s'arrête là.
 *
 * ⛔ ELLE N'ÉCRIT RIEN DANS L'ARBRE : elle copie les fichiers suivis dans un bac, vide la liste
 * là-bas, et efface.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const RACINE = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const bac = mkdtempSync(join(tmpdir(), 'bpscript-liste-fermee-'));
try {
  const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: RACINE }).split('\n').filter(Boolean);
  if (suivis.length < 100) throw new Error(`ASSIETTE VIDE : ${suivis.length} fichiers.`);
  for (const f of suivis) { mkdirSync(join(bac, dirname(f)), { recursive: true }); cpSync(join(RACINE, f), join(bac, f)); }
  execFileSync('ln', ['-s', join(RACINE, 'node_modules'), join(bac, 'node_modules')]);

  // ── LA GREFFE : la liste est VIDÉE, exactement ce que la phase 3 en fait ──────────────────
  const p = join(bac, 'src/transpiler/libs-champs.js');
  const t = readFileSync(p, 'utf8');
  const m = t.match(/new Set\(\[[^\]]*\]\)/);
  if (!m) throw new Error('ANCRE INTROUVABLE — la liste a changé de graphie, et vider ce qu\'on n\'a pas trouvé mesurerait le fichier intact.');
  const noms = [...m[0].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  writeFileSync(p, t.replace(m[0], 'new Set([])', 1));

  const { compileToBPxAST } = await import(`${bac}/src/transpiler/index.js`);
  await import(`${bac}/src/transpiler/index.js`);
const LIBS = (await import(`${bac}/src/transpiler/libs.js`)).leRegistre();
  const { CHAMPS_DE_FICHIER } = await import(`${bac}/src/transpiler/libs-champs.js`);
  console.log(`TÉMOIN — la liste portait ${noms.length} nom(s) : ${noms.join(', ')}`);
  console.log(`         elle en porte ${CHAMPS_DE_FICHIER.size} dans le bac.`);
  if (CHAMPS_DE_FICHIER.size !== 0) throw new Error('LA GREFFE N A PAS PRIS — tout compte qui suivrait mesurerait la greffe, pas le sujet.');

  // ⛔ LA LIGNE DE BASE : une scène SANS invocation. Ce qu'elle porte déjà n'appartient à personne.
  const empreinte = (a) => Object.fromEntries(Object.entries(a || {}).map(([k, v]) =>
    [k, Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : (v === undefined ? 0 : 1))]));
  const BASE = empreinte(compileToBPxAST('core\n-----\nS -> C4\n', {}).ast);
  const ecart = (invocation) => {
    const r = compileToBPxAST(`core\n${invocation}\n-----\nS -> C4\n`, {});
    if ((r.errors || []).length) return { refus: r.errors[0].message };
    const vu = empreinte(r.ast);
    return { ecart: Object.keys(vu).filter((k) => vu[k] !== BASE[k]).map((k) => `${k}:${BASE[k]}→${vu[k]}`),
             trace: r.ast.libRefs };
  };

  console.log(`\nLIGNE DE BASE — ce qu'une scène porte SANS invoquer : `
    + `${Object.entries(BASE).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(' ')}`);

  // ── LE BALAYAGE : chaque clé que la liste fermait, une par une ────────────────────────────
  // ⚠️ `resolves` SORT du paquet à l'état E : il ne devient pas invocable, il disparaît. Le
  // compter parmi les ouvertures gonflerait le chiffre d'un cinquième.
  let ferme = 0; let sortent = 0; let invocables = 0;
  const parChamp = {}; const refuses = {}; const portent = [];
  for (const [cat, contenu] of Object.entries(LIBS)) {
    if (!contenu || typeof contenu !== 'object') continue;
    for (const cle of Object.keys(contenu)) {
      if (!noms.includes(cle)) continue;
      ferme++;
      if (cle === 'resolves') { sortent++; continue; }
      const r = ecart(`${cat}.${cle}`);
      if (r.refus) {
        const motif = /NOM DU FICHIER/.test(r.refus) ? 'le mot du fichier, refusé depuis le 2026-08-20'
          : /introuvable dans le catalogue/.test(r.refus) ? 'catalogue non atteignable par ce chemin'
            : r.refus.slice(0, 60);
        refuses[motif] = (refuses[motif] || 0) + 1;
        continue;
      }
      invocables++;
      parChamp[cle] = (parChamp[cle] || 0) + 1;
      // ⛔ CE QUI COMPTE N'EST PAS « COMPILE », C'EST CE QUE ÇA MET EN PORTÉE. Une invocation qui
      // pose un vocabulaire et une invocation qui ne pose rien compilent toutes les deux.
      const pose = r.ecart.filter((e) => !/^directives:/.test(e) && !/^libRefs:/.test(e));
      if (pose.length) portent.push(`${cat}.${cle} → ${pose.join(' ')}`);
    }
  }

  console.log(`\nCLÉS DU PAQUET FERMÉES PAR LA LISTE            ${ferme}`);
  console.log(`   dont 'resolves', qui SORT du paquet          ${sortent}  ⇒ disparaît, ne s'ouvre pas`);
  console.log(`   ⇒ INVOCABLES une fois la liste vidée         ${invocables}`);
  console.log(`      ${Object.entries(parChamp).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · ')}`);
  console.log(`   ⇒ encore refusées, par un AUTRE mécanisme    ${ferme - sortent - invocables}`);
  for (const [motif, n] of Object.entries(refuses)) console.log(`      ${String(n).padStart(3)}  ${motif}`);
  console.log(`\n   ⇒ QUI METTENT QUELQUE CHOSE EN PORTÉE       ${portent.length}`);
  for (const l of portent.slice(0, 10)) console.log(`      ⚠️ ${l}`);

  // ── CE QUE L'INVOCATION OUVERTE PRODUIT, et le COMPLÉMENT : la même à d'autres places ─────
  console.log('\nCE QUE L\'INVOCATION PRODUIT — et ce qu\'elle produit AILLEURS QU\'EN TÊTE :');
  for (const [quoi, src] of [
    ['un catalogue ordinaire, repère', 'core\nalphabet.western\n-----\nS -> C4\n'],
    ['un prototype publié           ', 'core\ntypes.gamut\n-----\nS -> C4\n'],
    ['un champ de fichier, en tête  ', 'core\ncore.version\n-----\nS -> C4\n'],
    ['le même, après une invocation ', 'core\nalphabet.western\ncore.version\n-----\nS -> C4\n'],
    ['le même, en MEMBRE DROIT      ', 'core\n-----\nS -> core.version\n'],
    ['une clé inexistante, repère   ', 'core\ncore.rien_du_tout\n-----\nS -> C4\n'],
  ]) {
    const r = compileToBPxAST(src, {});
    const e = r.errors || [];
    console.log(`   ${(e.length ? '⛔ REFUS ' : '✓ COMPILE').padEnd(11)} ${quoi}  `
      + (e.length ? e[0].message.slice(0, 62) : `trace=${JSON.stringify(r.ast.libRefs)}`));
  }
} finally {
  rmSync(bac, { recursive: true, force: true });
}
