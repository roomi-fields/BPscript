#!/usr/bin/env node
/**
 * GARDE — CE QUE JE PUBLIE NE NOMME AUCUN FORMAT DE SOURCE, ET LE DIT COMPLET.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE. `src/transpiler/libs-data.js` est déclaré en export dans mon
 * `package.json` : c'est une surface publique. Son en-tête annonçait « Contains all lib/*.json
 * data » alors que NEUF de mes vingt-neuf librairies n'existent plus qu'en `.bpsl`. Atlas l'a lu
 * le 2026-08-19, en a conclu que le bundle était PARTIEL depuis la conversion, et allait chercher
 * les sources à la main — donc écrire un lecteur qui se recasserait à ma prochaine bascule.
 *
 * C'est le SIXIÈME lecteur trompé par l'extension d'un fichier de librairie, et le premier qui
 * n'est pas du code : une PHRASE. **Le format d'une source n'est jamais une information utile à
 * qui veut la donnée** — et une phrase fausse dans une surface publiée ne casse rien, ne rougit
 * nulle part, et oriente le voisin pendant des semaines.
 *
 * ⛔ ET LE GARDE MESURE LES DEUX MOITIÉS. Vérifier que la phrase ne nomme pas d'extension
 * laisserait passer un bundle réellement partiel ; vérifier la complétude laisserait passer une
 * phrase qui ment sur un bundle juste. Ce sont deux défauts distincts, et c'est la paire qui a
 * mordu ici : le contenu était juste, la phrase avait vieilli.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** Les FORMATS de source que `lib/` porte aujourd'hui. Le garde ne les code pas en dur — il les
 *  découvre, sans quoi il deviendrait lui-même un lecteur par extension. */
const fichiersDeLib = readdirSync(join(RACINE, 'lib'), { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && /\.(json|bpsl)$/.test(d.name));
const formats = [...new Set(fichiersDeLib.map((d) => d.name.split('.').pop()))].sort();

console.log(`[surface] ${fichiersDeLib.length} fichiers de lib, ${formats.length} format(s) : `
  + `${formats.join(', ')} · ${Object.keys(LIBS).length} clés au bundle`);

// ── 1. LE BUNDLE EST COMPLET — chaque fichier de lib a sa clé, et réciproquement ─────────────
// Les deux inclusions : une clé en trop est un fantôme, une clé manquante est une librairie muette.
{
  // ⛔ UN FICHIER DE CORPS N'EST PAS UNE LIBRAIRIE — depuis le 2026-09-03, une librairie DÉCLARE ses
  //   fichiers de corps (`transpo/foobar`) et leur contenu se pose sur ses objets. Ils ne portent
  //   donc aucune clé au bundle, et c'est voulu : les compter comme des librairies muettes ferait
  //   rougir ce garde sur une forme juste.
  // La déclaration se lit dans la SOURCE de la racine — une ligne `transpo/foobar` en tête. Le
  // bundle, lui, n'en porte rien : un corps se pose sur les objets, il ne devient pas une clé.
  const corpsDeclares = new Set();
  for (const d of fichiersDeLib) {
    const sous = d.parentPath ?? d.path ?? '';
    if (sous.endsWith('lib') || sous.endsWith('lib/')) continue;
    const parent = sous.split('/').pop();
    const nom = `${parent}/${d.name.replace(/\.(json|bpsl)$/, '')}`;
    let racine = '';
    try { racine = readFileSync(new URL(`../lib/${parent}.bpsl`, import.meta.url), 'utf8'); } catch { /* pas une librairie du langage */ }
    if (new RegExp(`^${nom}\\s*$`, 'm').test(racine)) corpsDeclares.add(nom);
  }
  const attendus = new Set(fichiersDeLib.map((d) => {
    const sous = d.parentPath ?? d.path ?? '';
    const prefixe = sous.endsWith('lib') || sous.endsWith('lib/') ? '' : sous.split('/').pop() + '/';
    return prefixe + d.name.replace(/\.(json|bpsl)$/, '');
  }).filter((n) => !corpsDeclares.has(n)));
  const presents = new Set(Object.keys(LIBS));
  for (const a of attendus) ok(presents.has(a), `1. la librairie '${a}' existe en fichier et MANQUE au bundle`);
  for (const p of presents) ok(attendus.has(p), `1. le bundle porte '${p}', qui n'a aucun fichier source`);
  // 25 → 24 le 2026-09-03 : `digital` sort, ses quatre manipulations sont les contrôles de `transpo`
  // qui les nommaient déjà, et leurs corps ont suivi leur objet (arbitrage Romain).
  ok(attendus.size >= 24, `1. le garde doit avoir EXAMINÉ des librairies(${attendus.size} trouvée(s))`);
  // ⛔ ET UNE CLÉ PRÉSENTE NE PROUVE PAS UN CONTENU. Ce volet comptait les clés du bundle et
  // n'aurait pas vu une librairie SORTIE VIDE — le mode d'échec exact de la réécriture des neuf
  // fichiers : le générateur ne lisait qu'une des deux graphies de déclaration, donc réécrire un
  // fichier le vidait EN SILENCE, sans qu'aucun refus du compilateur ne le voie (le fichier
  // compile parfaitement). La plus petite librairie légitime pèse 214 caractères ; une coquille
  // vide en pèse 15.
  for (const [nom, contenu] of Object.entries(LIBS)) {
    ok(JSON.stringify(contenu ?? {}).length >= 100,
      `1. la librairie '${nom}' est PRESQUE VIDE dans le bundle — une clé présente ne prouve pas `
      + `un contenu. Vérifier que le générateur sait lire la graphie de sa source.`);
  }
}

// ── 2. AUCUN FORMAT DE SOURCE N'EST NOMMÉ DANS CE QUE JE PUBLIE ─────────────────────────────
// ⛔ Mesuré sur les fichiers que `package.json` DÉCLARE EN EXPORT, pas sur ceux que je crois
// publier : une surface publiée se dérive de sa déclaration, jamais d'une liste tenue à la main.
const paquet = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf-8'));
const exportes = [...new Set(
  JSON.stringify(paquet.exports ?? {}).match(/\.\/[\w./-]+\.(?:js|d\.ts)/g) ?? [],
)];
ok(exportes.length >= 2, `2. le garde doit trouver des chemins exportés(${exportes.length} trouvé(s))`);

for (const rel of exportes) {
  let texte;
  try { texte = readFileSync(join(RACINE, rel), 'utf-8'); } catch { continue; }
  // On ne lit que l'EN-TÊTE : c'est ce qu'un consommateur voit en ouvrant le fichier, et le corps
  // d'un bundle contient légitimement les noms de fichiers de ses sources.
  //
  // ⛔ L'EN-TÊTE EST LE BLOC DE COMMENTAIRE DE TÊTE, JAMAIS « LES N PREMIÈRES LIGNES ». Ma première
  // écriture prenait douze lignes : le corps du bundle commence à la quatrième, et une seule de ses
  // lignes de données porte des milliers de caractères. Le garde a rougi sur du CONTENU en croyant
  // lire une phrase — un découpage par compteur ne connaît pas la structure de ce qu'il coupe.
  const entete = [];
  for (const ligne of texte.split('\n')) {
    const t = ligne.trim();
    if (t === '') continue;
    if (!t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')) break;
    entete.push(ligne);
  }
  for (const f of formats) {
    ok(!new RegExp(`\\*\\.${f}|\\.${f}\\b`).test(entete.join('\n')),
      `2. ${rel} nomme le format '.${f}' dans son en-tête — une surface publiée qui annonce un `
      + `format de source fait conclure à un contenu PARTIEL, et envoie le lecteur vers mes `
      + `fichiers. Dire ce qu'elle contient, jamais d'où ça vient.`);
  }
}

// ── 3. TÉMOIN NON NUL — le garde sait LIRE un en-tête, sinon tout ce fichier ment ───────────
{
  // ⛔ LE TÉMOIN A CHANGÉ DE FICHIER LE 2026-09-04, PAS D'OBJET. `libs-data.js`, la surface que ce
  //   garde lisait, est sorti avec le bundle (Romain : « ça sort »). La surface publiée qui sert la
  //   même donnée est la PORTE DES OBJETS — c'est elle qu'un voisin lit désormais, et c'est donc
  //   son en-tête qui peut mentir sur le format de mes sources. Le défaut est intact, il a déménagé.
  const tete = readFileSync(join(RACINE, 'src/transpiler/objets.js'), 'utf-8')
    .split('\n').filter((l) => l.trim().startsWith('//') || l.trim().startsWith('*'));
  ok(tete.length >= 2, '3. TÉMOIN — le garde doit trouver un en-tête de commentaire à lire');
  ok(tete.join(' ').length > 40, '3. TÉMOIN — et cet en-tête doit porter du texte');
}

if (echecs.length) {
  console.error(`[surface] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[surface] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
