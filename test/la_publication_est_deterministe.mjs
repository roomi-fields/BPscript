#!/usr/bin/env node
/**
 * GARDE — DEUX CONSTRUCTIONS DU MÊME COMMIT SONT IDENTIQUES, OCTET POUR OCTET, SANS UNE EXCLUSION.
 *
 * ⛔ POURQUOI « SANS UNE EXCLUSION » EST LE CŒUR DE CE BANC. Le patron grave l'instant en appelant
 * l'horloge DANS la construction : deux constructions y diffèrent toujours par leur date, et le banc
 * doit alors EXCLURE ce champ. **Une empreinte compare tout, sauf ce qui est prouvé hors sujet — et
 * choisir un champ à exclure, c'est choisir ce qu'on ne verra pas.** Ici l'instant est un fait DONNÉ,
 * le banc le fixe, et la comparaison porte sur l'intégralité des deux arbres.
 *
 * ⛔ ET LA COMPARAISON SE FAIT À LA MÊME PROFONDEUR. Comparer deux listes d'entrées de premier niveau
 * rend « identiques » sur deux arbres dont tous les contenus diffèrent : ce banc descend, empreinte
 * CHAQUE fichier, et compare l'ensemble des chemins ET des contenus.
 *
 * ⛔ IL APPELLE LA VRAIE CONSTRUCTION, jamais une imitation. Un banc qui referait la copie et la
 * gravure de son côté mesurerait sa propre copie du geste, et resterait vert le jour où la
 * construction changerait.
 *
 * ⚠️ ET IL NE PUBLIE RIEN : les deux chantiers vivent dans un dossier temporaire, jamais dans la
 * racine des paquets, et le lien que mes consommateurs suivent n'est pas touché.
 */
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { construire, LIGNE_SOURCE, MODULE_EMPREINTE } from '../scripts/publier.mjs';

const RACINE = new URL('..', import.meta.url).pathname;
let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

/** Chaque fichier de l'arbre, par chemin relatif, avec l'empreinte de son CONTENU. */
async function arbre(racine, prefixe = '') {
  const out = new Map();
  for (const ent of await readdir(path.join(racine, prefixe), { withFileTypes: true })) {
    const rel = path.join(prefixe, ent.name);
    if (ent.isDirectory()) {
      for (const [k, v] of await arbre(racine, rel)) out.set(k, v);
    } else {
      out.set(rel, createHash('sha256').update(await readFile(path.join(racine, rel))).digest('hex'));
    }
  }
  return out;
}

const pkg = JSON.parse(await readFile(path.join(RACINE, 'package.json'), 'utf8'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RACINE, encoding: 'utf8' }).trim();
const abrege = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: RACINE, encoding: 'utf8' }).trim();
const faits = {
  commit, abrege, version: pkg.version, propre: true, entrant: pkg.files,
  // ⛔ L'INSTANT EST FIXE, ET C'EST CE QUI REND LA COMPARAISON TOTALE POSSIBLE.
  instant: '2026-01-01 00:00:00',
};

// ⛔ LA SOURCE S'EMPREINTE AVANT, ET LA COMPARAISON EST TOTALE. Une première écriture visait la
// disparition de la ligne du régime source — et ce volet ne mordait JAMAIS : quand cette ligne
// disparaît, la construction suivante lève, et le banc mourait avant d'y arriver. Un garde
// inatteignable ne préviendra personne. Ici l'empreinte est prise avant tout geste, la construction
// est enveloppée, et le volet se pose quoi qu'il arrive.
const CHEMIN_SOURCE = path.join(RACINE, MODULE_EMPREINTE);
const sourceAvant = createHash('sha256').update(await readFile(CHEMIN_SOURCE)).digest('hex');

const bac = await mkdtemp(path.join(os.tmpdir(), 'bpscript-deterministe-'));
try {
  const a = path.join(bac, 'a');
  const b = path.join(bac, 'b');
  let empA = null;
  let empB = null;
  try {
    empA = await construire(a, faits);
    empB = await construire(b, faits);
  } catch (err) {
    e.push(`la construction a LEVÉ : ${err.message}`);
  }

  // ── C. LA GRAVURE A EU LIEU DANS LE PAQUET, ET PAS DANS MA SOURCE ──────────────────────────
  // Ce volet se pose même quand la construction a levé : c'est précisément l'état où la source a
  // pu être écrite, et où le reste du banc ne tourne plus.
  ok(createHash('sha256').update(await readFile(CHEMIN_SOURCE)).digest('hex') === sourceAvant,
    `C. ⛔ LA CONSTRUCTION A ÉCRIT DANS MA SOURCE. ${MODULE_EMPREINTE} a changé pendant la `
    + `construction : un chemin mal calculé réécrit l'original, et mon arbre de travail porterait `
    + `un commit gravé. La comparaison est TOTALE — pas seulement la ligne du régime source, dont `
    + `la disparition fait lever la construction avant que ce volet s'exécute.`);

  if (!empA || !empB) throw new Error('construction interrompue');

  const arbA = await arbre(a);
  const arbB = await arbre(b);

  // ── A. LE TÉMOIN ANTI-VACUITÉ — un arbre vide rend toute comparaison verte en ne regardant rien.
  ok(arbA.size > 0, `A. ⛔ la construction a émis ZÉRO fichier — la comparaison serait verte en `
    + `n'ayant rien examiné.`);
  ok(arbA.size === empA.fichiers,
    `A. le compte gravé doit être celui des fichiers ÉMIS — gravé ${empA.fichiers}, émis ${arbA.size}. `
    + `Un compte déduit au lieu d'être compté ne mesure que lui-même.`);

  // ── B. LES DEUX ARBRES, À LA MÊME PROFONDEUR, CONTENUS COMPRIS ─────────────────────────────
  const cheminsA = [...arbA.keys()].sort();
  const cheminsB = [...arbB.keys()].sort();
  ok(cheminsA.join('\n') === cheminsB.join('\n'),
    `B. les deux constructions n'émettent pas les mêmes CHEMINS : `
    + `${cheminsA.filter((c) => !arbB.has(c)).join(', ') || '—'} / `
    + `${cheminsB.filter((c) => !arbA.has(c)).join(', ') || '—'}`);
  const differents = cheminsA.filter((c) => arbA.get(c) !== arbB.get(c));
  ok(differents.length === 0,
    `B. ⛔ ${differents.length} fichier(s) DIFFÈRENT entre deux constructions du même commit : `
    + `${differents.join(', ')}. Le déterminisme est structurel — aucun de mes générateurs ne lit `
    + `une horloge, et l'instant de la gravure est un fait donné. Un écart ici dit qu'une entrée `
    + `non déclarée est entrée dans la construction.`);
  ok(JSON.stringify(empA) === JSON.stringify(empB),
    `A. les deux empreintes gravées diffèrent : ${JSON.stringify(empA)} / ${JSON.stringify(empB)}`);

  // ── C2. LE MODULE ÉMIS, LUI, PORTE BIEN LA GRAVURE ────────────────────────────────────────
  const graveA = await readFile(path.join(a, MODULE_EMPREINTE), 'utf8');
  ok(!graveA.match(new RegExp(`^${LIGNE_SOURCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm')),
    'C2. le module ÉMIS porte encore la ligne du régime source — la gravure a visé à côté.');
  ok(graveA.includes(`"regime": "paquet"`) && graveA.includes(commit),
    'C2. le module émis ne porte pas le régime « paquet » et le commit.');

  // ── D. LE PAQUET PORTE SON MANIFESTE, sinon rien ne s'y résout ─────────────────────────────
  ok(arbA.has('package.json'), 'D. le paquet n\'embarque pas son manifeste — rien ne s\'y résout.');
} catch (err) {
  if (err.message !== 'construction interrompue') e.push(`le banc a LEVÉ : ${err.message}`);
} finally {
  await rm(bac, { recursive: true, force: true });
}

if (e.length) {
  console.error(`[publication déterministe] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[publication déterministe] ${p} PASS / 0 FAIL — deux constructions comparées fichier par `
  + `fichier, contenus compris, ZÉRO champ exclu`);
