#!/usr/bin/env node
/**
 * GARDE — LE COUPLE GRAMMAIRE ↔ AUXILIAIRES N'A QU'UNE SOURCE : LA TABLE DE CORRESPONDANCE.
 *
 * La table (`kanopi/packages/library/test-assets/bp3/correspondance.json`, produite par
 * `bp3-engine/scripts/table-correspondance.py`) est la SEULE porteuse du couple. Ma bascule du
 * 2026-08-11 a supprimé les trois sources qui disaient la même chose chez moi :
 *   1. `grammars.json` → `php_ref.settings` / `php_ref.alphabet` — ma recopie ;
 *   2. le reniflage d'un `-se.X` dans le CORPS de la grammaire ;
 *   3. le reniflage d'un `-al.X` dans le CORPS.
 *
 * ⛔ POURQUOI CE GARDE, ET PAS SEULEMENT LA SUPPRESSION. Une voie parallèle ne revient jamais par
 * une décision : elle revient par un repli ajouté « le temps de », un jour où la table manque une
 * entrée. Et elle est MUETTE — les deux sources tombent d'accord presque partout, donc la seconde
 * ne se fait remarquer que là où elle contredit, c'est-à-dire précisément là où ça compte. La
 * règle de la maison le dit : le portillon échoue si du code voué au retrait garde un appelant
 * vivant.
 *
 * ⚠️ IL GARDE L'ESPACE, PAS L'ENDROIT OÙ LE DÉFAUT S'EST MONTRÉ. Ce ne sont pas les deux lignes
 * supprimées qu'il surveille, c'est TOUT le dossier de mesure : n'importe quel fichier qui
 * relirait le couple ailleurs rouvrirait le même trou.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** Le module autorisé — lui SEUL a le droit de nommer la table et de lire les auxiliaires. */
const PORTEUR = 'correspondance.mjs';

/**
 * LES FORMES QUI RESSUSCITENT UNE SECONDE SOURCE. Chacune est une manière d'obtenir le couple
 * sans passer par la table — recopie relue, ou nom deviné dans un texte.
 */
const FORMES = [
  { nom: 'recopie du couple dans le catalogue',
    motif: /php_ref\s*(?:\?\.|\.)\s*(?:settings|alphabet)/,
    quoi: "lit `php_ref.settings` / `php_ref.alphabet` — les champs SUPPRIMÉS de grammars.json le 2026-08-11" },
  { nom: 'reniflage d’un réglage dans un texte',
    motif: /match\s*\(\s*\/\s*-se\\?\./,
    quoi: 'devine un `-se.` en cherchant le nom dans un texte — c’est le mécanisme que la table remplace' },
  { nom: 'recopie de la convention de notes dans le catalogue',
    motif: /note_convention/,
    quoi: "lit `note_convention` — le champ SUPPRIMÉ de grammars.json le 2026-08-11, la table le porte (107 contre 97, zéro désaccord)" },
  { nom: 'reniflage d’un alphabet dans un texte',
    motif: /match\s*\(\s*\/\s*-(?:al|ho)\\?\./,
    quoi: 'devine un `-al.`/`-ho.` en cherchant le nom dans un texte — même mécanisme' },
];

// ── SOCLE — un balayage qui ne trouve rien passerait au vert sans avoir rien examiné ────────
const fichiers = fs.readdirSync(ICI)
  .filter((f) => /\.(mjs|cjs|js)$/.test(f))
  .filter((f) => f !== path.basename(fileURLToPath(import.meta.url)) && f !== PORTEUR);
ok(fichiers.length >= 40,
  `le dossier de mesure s'est vidé : ${fichiers.length} fichier(s) balayé(s), attendu ≥ 40 — `
  + `un garde qui n'examine rien rend vert pour la pire des raisons`);

// ── 1. AUCUN FICHIER NE RESSUSCITE UNE SECONDE SOURCE ───────────────────────────────────────
for (const f of fichiers) {
  const src = fs.readFileSync(path.join(ICI, f), 'utf8');
  // Les COMMENTAIRES ont le droit de citer la forme supprimée : c'est même là qu'on explique
  // pourquoi elle est partie. On ne juge que le code.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter((l) => !l.trimStart().startsWith('//')).join('\n');
  for (const { nom, motif, quoi } of FORMES) {
    ok(!motif.test(code),
      `1. '${f}' ${quoi} (forme : ${nom}). Le couple se lit par '${PORTEUR}', et par lui seul — `
      + `une seconde source tombe d'accord partout SAUF là où ça compte, et personne ne sait `
      + `laquelle a parlé.`);
  }
}

// ── 2. LA RECOPIE EST BIEN PARTIE DE LA DONNÉE, PAS SEULEMENT DU CODE ───────────────────────
// Supprimer le lecteur en laissant le champ, c'est laisser la prochaine personne le relire.
{
  const cat = JSON.parse(fs.readFileSync(path.join(ICI, 'grammars', 'grammars.json'), 'utf8'));
  const restants = [];
  for (const [nom, e] of Object.entries(cat)) {
    if (!e || typeof e !== 'object') continue;
    if ('note_convention' in e) { restants.push(nom); continue; }
    if (!e.php_ref) continue;
    if ('settings' in e.php_ref || 'alphabet' in e.php_ref
      || 'note_convention' in e.php_ref) restants.push(nom);
  }
  ok(restants.length === 0,
    `2. ${restants.length} entrée(s) du catalogue portent encore le couple : `
    + `${restants.slice(0, 6).join(', ')}. Un champ laissé se relit.`);
}

// ── 3. LE PORTEUR EXISTE, ET IL REFUSE DE SE REPLIER ────────────────────────────────────────
{
  const p = path.join(ICI, PORTEUR);
  ok(fs.existsSync(p), `3. le porteur '${PORTEUR}' est introuvable — le couple n'a plus de source du tout`);
  if (fs.existsSync(p)) {
    const src = fs.readFileSync(p, 'utf8');
    ok(/throw new Error/.test(src),
      `3. '${PORTEUR}' doit ÉCHOUER quand la table manque, jamais se replier. Un repli rendrait `
      + `une mesure sous une autre source sans le dire.`);
    ok(/correspondance\.json/.test(src),
      `3. '${PORTEUR}' doit nommer la table qu'il lit`);
  }
}

// ── TÉMOINS D'INSTRUMENT — la faute injectée dans le juge ───────────────────────────────────
// Sans eux, un motif devenu inopérant laisserait passer tout le monde en rendant vert.
{
  const FAUX = [
    ['recopie directe', 'const s = gd.php_ref.settings;'],
    ['recopie optionnelle', 'if (gd?.php_ref?.alphabet) {}'],
    ['reniflage réglage', "const m = gr.match(/-se\\.(\\S+)/);"],
    ['reniflage alphabet', "const m = gr.match(/-al\\.(\\S+)/);"],
    ['reniflage homomorphisme', "const m = txt.match(/-ho\\.(\\S+)/);"],
    ['recopie de convention', 'const c = GRAMMARS[name].note_convention;'],
  ];
  for (const [quoi, ligne] of FAUX) {
    ok(FORMES.some(({ motif }) => motif.test(ligne)),
      `TÉMOIN — la forme « ${quoi} » doit être ATTRAPÉE : ${ligne}. Un motif qui ne mord plus rend `
      + `ce garde décoratif, et il rendrait vert.`);
  }
  // ET SON COMPLÉMENT : le code légitime ne doit PAS être accusé, sinon le garde devient un bruit
  // qu'on apprend à contourner.
  const LEGITIME = [
    'const couple = coupleDe(name);',
    "if (couple?.settings) pushSettings(path.join(TD, couple.settings));",
    "args.push('-al', f);",
    "const gd = GRAMMARS[name] || null;",
  ];
  for (const ligne of LEGITIME) {
    ok(!FORMES.some(({ motif }) => motif.test(ligne)),
      `TÉMOIN INVERSE — la lecture LÉGITIME par la table ne doit pas être accusée : ${ligne}`);
  }
}

if (echecs.length) {
  console.error(`[couple] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[couple] une seule source pour le couple grammaire↔auxiliaires — ${fichiers.length} `
  + `fichier(s) de mesure balayé(s), ${FORMES.length} forme(s) de rechute surveillée(s)`);
console.log(`[couple] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
