#!/usr/bin/env node
/**
 * PUBLIER UN PROTOTYPE LE REND-IL INVOCABLE ? — la question est tranchée en FABRIQUANT le cas.
 *
 * Décision de Romain, 2026-08-29, `le-paquet-publie-les-prototypes-et-un-catalogue-est-un-objet-distinct` :
 * le prototype entre dans la DONNÉE que les consommateurs remontent, et reste hors du VOCABULAIRE que
 * le compilateur accepte. **Deux surfaces.** Cette sonde mesure si le code les sépare.
 *
 * ⛔ CE QU'ELLE A ÉTABLI, LE 2026-08-29 : **il ne les sépare pas.** Une clé fabriquée, posée dans un
 * catalogue du paquet, est invocable en scène immédiatement — aucun geste n'est nécessaire pour
 * l'ouvrir. La seule chose qui ferme une clé est son NOM : les huit de `libs-champs.js:59`. Or cette
 * liste est fermée, et c'est celle que la phase 3 supprime.
 *
 * ⚠️ ELLE ÉCRIT LA PORTÉE ET SON COMPLÉMENT — un nom libre ET un nom réservé — parce qu'un seul des
 * deux ne dit rien : « invocable » sans « et voilà ce qui ne l'est pas » ne montre aucun mécanisme.
 *
 * ⇒ Elle se rejoue après la bascule : le jour où un prototype publié est refusé à l'invocation, sa
 * première ligne rougit et la séparation est prouvée. Tant qu'elle compile, elle n'existe pas.
 *
 * ⛔ ELLE N'ÉCRIT RIEN DANS L'ARBRE : elle copie les fichiers suivis dans un bac, greffe là-bas, et
 * efface. Un instrument qui salirait l'arbre casserait la fenêtre de mesure d'un voisin.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const RACINE = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const bac = mkdtempSync(join(tmpdir(), 'bpscript-proto-invocable-'));
try {
  const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: RACINE })
    .split('\n').filter(Boolean);
  if (suivis.length < 100) throw new Error(`ASSIETTE VIDE : ${suivis.length} fichiers.`);
  for (const f of suivis) { mkdirSync(join(bac, dirname(f)), { recursive: true }); cpSync(join(RACINE, f), join(bac, f)); }
  execFileSync('ln', ['-s', join(RACINE, 'node_modules'), join(bac, 'node_modules')]);

  // ── LA GREFFE : une clé fabriquée, posée dans le catalogue `types` du PAQUET ────────────────
  // Elle ne prétend rien être : c'est exactement ce qu'un prototype publié serait, une clé de plus
  // dans l'espace où vivent les entrées. Sa valeur est un objet vide — un prototype qui ne déclare
  // rien, la forme même que `object gamut` prend aujourd'hui dans la source.
  const p = join(bac, 'src/transpiler/libs-data.js');
  const t = readFileSync(p, 'utf8');
  const ancre = 'LIBS["types"] = {';
  if (!t.includes(ancre)) throw new Error(`ANCRE INTROUVABLE « ${ancre} » — le paquet a changé de graphie.`);
  // Deux greffes : l'une sous un nom LIBRE, l'autre sous un nom de la liste des champs de fichier.
  // ⇒ Écrire la portée ET SON COMPLÉMENT : si la seconde échappe à l'invocation, alors le seul
  // mécanisme d'exclusion du paquet est cette liste de huit noms — celle que la phase 3 supprime.
  writeFileSync(p, t.replace(ancre,
    `${ancre}\n    "sonde_prototype_publie": {},\n    "version": {"sonde": "sous un nom de champ de fichier"},`, 1));

  const { compileToBPxAST } = await import(`${bac}/src/transpiler/index.js`);
  const { LIBS } = await import(`${bac}/src/transpiler/libs-data.js`);

  console.log('TÉMOIN — la greffe a-t-elle pris dans le paquet ?');
  console.log(`   LIBS.types.sonde_prototype_publie = ${JSON.stringify(LIBS.types?.sonde_prototype_publie)}`);
  if (!('sonde_prototype_publie' in (LIBS.types || {}))) throw new Error('LA GREFFE N A PAS PRIS — tout zéro qui suivrait mesurerait la greffe, pas le sujet.');

  console.log('\nCE QUE LE COMPILATEUR ACCEPTE, sur le paquet greffé :');
  for (const [nom, src] of [
    ['types.sonde_prototype_publie', 'core\ntypes.sonde_prototype_publie\n-----\nS -> C4\n'],
    ['types.gamut (repère)', 'core\ntypes.gamut\n-----\nS -> C4\n'],
    ['types.version (nom réservé)', 'core\ntypes.version\n-----\nS -> C4\n'],
    ['types.absent (repère)', 'core\ntypes.rien_du_tout\n-----\nS -> C4\n'],
  ]) {
    const r = compileToBPxAST(src, {});
    const e = r.errors || [];
    console.log(`   ${(e.length ? '⛔ REFUS ' : '✓ COMPILE').padEnd(11)} ${nom.padEnd(30)} ${e.length ? e[0].message.slice(0, 70) : ''}`);
  }
} finally {
  rmSync(bac, { recursive: true, force: true });
}
