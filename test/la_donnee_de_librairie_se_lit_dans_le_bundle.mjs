#!/usr/bin/env node
/**
 * LA DONNÉE D'UNE LIBRAIRIE SE LIT DANS LE BUNDLE, JAMAIS À UN CHEMIN DE FICHIER.
 *
 * `libs-data.js` est la surface publiée : elle rend la même donnée quelle que soit la source —
 * `.bpsl`, `.json`, ou ce qui viendra. Un lecteur qui construit `lib/<axe>.json` fait de
 * l'EXTENSION une interface, et casse net le jour où le catalogue change de format.
 *
 * ⛔ TROIS LECTEURS SE SONT MONTRÉS UN PAR UN, chacun découvert par la casse suivante — le pont
 * vers Kairos, le garde du résolveur, le garde des notes. Les chercher un par un les répare ; ce
 * garde ferme l'ESPACE où le quatrième vivrait. Le chemin peut s'écrire de plusieurs façons —
 * concaténé, en gabarit, par `path.join`, par `new URL` — donc la mesure porte sur la GRAPHIE que
 * le code écrit, chacune éprouvée par injection.
 *
 * ⚠️ LA GRAPHIE VARIE, PAS LA FAUTE. Un motif qui ne verrait que `'lib/' + n + '.json'` laisserait
 * passer `` `lib/${n}.json` `` et `path.join(ROOT, 'lib', n + '.json')`. Le volet B éprouve les
 * quatre formes sur le juge lui-même.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** Les graphies par lesquelles un chemin de catalogue s'écrit. Une par forme, toutes éprouvées. */
const GRAPHIES = [
  { nom: 'concaténation',   motif: /['"]lib\/['"]\s*\+/ },
  { nom: 'gabarit',         motif: /`[^`]*\blib\/\$\{/ },
  { nom: 'chemin littéral', motif: /['"`][^'"`]*\blib\/[A-Za-z0-9_-]+\.json['"`]/ },
  { nom: 'segments joints', motif: /\b(?:join|resolve)\s*\([^)]*['"]lib['"]\s*,/ },
];

/**
 * La ligne LIT-ELLE le chemin, ou ne fait-elle que le nommer ?
 *
 * Elle lit si elle appelle une lecture, ou si elle RETIENT le chemin dans une constante pour qu'on
 * le lise plus loin. `existsSync` en est exclu : mesurer qu'un fichier a bien DISPARU est le geste
 * qu'on veut garder possible, pas celui qu'on refuse.
 */
const lit = (ligne) => (/\b(readFileSync|readFile|createReadStream|loadJsonFile|require)\s*\(/.test(ligne)
    || /^\s*(const|let|var)\s+[A-Za-z0-9_]*(PATH|CHEMIN|FICHIER|FILE)\b/i.test(ligne))
  && !/\bexistsSync\s*\(/.test(ligne);

/**
 * Ceux dont le métier EST de lire une source de librairie : ils la convertissent. Nommés un par
 * un — leur exemption est un fait vérifiable, pas une zone franche.
 */
const CONVERTISSEURS = ['scripts/convert_tunings.js', 'scripts/json-vers-bpsl.mjs'];

/** Les fichiers de code du dépôt, hors données et hors dépendances. */
function fichiersDeCode(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === 'dist' || e === 'lib') continue;
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) fichiersDeCode(p, out);
    else if (/\.(m?js|ts)$/.test(e) && !/\.d\.ts$/.test(e)) out.push(p);
  }
  return out;
}

// ── A. AUCUN LECTEUR PAR CHEMIN dans le code du dépôt ────────────────────────────────────────
{
  const fichiers = fichiersDeCode(RACINE);
  ok(fichiers.length > 20,
     `A. ${fichiers.length} fichier(s) de code examiné(s) — un périmètre qui fond ne prouve rien.`);

  const coupables = [];
  for (const f of fichiers) {
    // Ce garde CITE les graphies qu'il refuse : il ne s'accuse pas lui-même.
    if (f.endsWith('la_donnee_de_librairie_se_lit_dans_le_bundle.mjs')) continue;
    // ⚠️ UN CONVERTISSEUR LIT LA SOURCE, c'est son travail — l'exempter par NOM, jamais par
    // dossier : `scripts/` entier laisserait passer un vrai lecteur qu'on y rangerait demain.
    if (CONVERTISSEURS.some((c) => f.endsWith(c))) continue;
    const src = readFileSync(f, 'utf-8');
    src.split('\n').forEach((ligne, i) => {
      if (/^\s*(\/\/|\*)/.test(ligne)) return;                 // un commentaire ne lit rien
      // ⚠️ UNE MENTION N'EST PAS UNE LECTURE. Un message d'erreur qui NOMME `lib/mod.json` ne lit
      // rien ; l'accuser rendrait ce garde inutilisable et pousserait à le contourner. La ligne
      // doit LIRE — ou retenir le chemin pour qu'on le lise — et `existsSync` mesure une ABSENCE,
      // ce qui est justement le geste qu'on veut garder possible.
      if (!lit(ligne)) return;
      for (const g of GRAPHIES) {
        if (!g.motif.test(ligne)) continue;
        if (!/\.json/.test(ligne) && g.nom !== 'segments joints') continue;
        coupables.push(`${path.relative(RACINE, f)}:${i + 1} (${g.nom}) — ${ligne.trim().slice(0, 90)}`);
      }
    });
  }
  ok(coupables.length === 0,
     `A. ${coupables.length} lecteur(s) construisent un chemin vers un catalogue au lieu de lire le `
     + `bundle. L'extension d'un fichier n'est pas une interface : ces lignes cassent au prochain `
     + `changement de format.\n       ${coupables.join('\n       ')}`);
}

// ── B. LE JUGE MORD SUR LES QUATRE GRAPHIES ─────────────────────────────────────────────────
// ⚠️ SANS CE VOLET, un motif trop étroit rendrait le volet A vert sur un dépôt fautif.
{
  for (const [graphie, ligne] of [
    ['concaténation',   `const c = JSON.parse(readFileSync('lib/' + n + '.json', 'utf-8'));`],
    ['gabarit',         'const c = JSON.parse(readFileSync(`lib/${n}.json`, "utf-8"));'],
    ['chemin littéral', `const c = JSON.parse(readFileSync('../lib/octaves.json', 'utf-8'));`],
    ['segments joints', `const c = readFileSync(path.join(ROOT, 'lib', n + '.json'));`],
  ]) {
    const vu = lit(ligne) && GRAPHIES.some((g) => g.motif.test(ligne) && (/\.json/.test(ligne) || g.nom === 'segments joints'));
    ok(vu, `B. la graphie « ${graphie} » n'est PAS vue par le juge — un lecteur écrit ainsi passerait `
           + `le volet A en triomphe. Ligne : ${ligne}`);
  }
  // Le témoin inverse : ce qui lit le bundle ne doit JAMAIS être accusé.
  for (const innocent of [
    `import { LIBS } from '../src/transpiler/libs-data.js';`,
    `const registres = LIBS.octaves;`,
    `const p = path.join(ROOT, 'test', 'corpus.mjs');`,
    "throw new Error(`module inconnu — voir lib/mod.json`);",
    `check(!existsSync(new URL('../lib/routing.json', import.meta.url)), 'supprimé');`,
  ]) {
    const accuse = lit(innocent) && GRAPHIES.some((g) => g.motif.test(innocent) && (/\.json/.test(innocent) || g.nom === 'segments joints'));
    ok(!accuse, `B. le juge accuse une ligne INNOCENTE — il ferait refuser la voie correcte : ${innocent}`);
  }
}

// ── SOCLE ───────────────────────────────────────────────────────────────────────────────────
ok(passe >= 8, `SOCLE : ${passe} vérifications seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ la donnée de librairie se lit dans le bundle : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ Aucun lecteur ne construit un chemin vers un catalogue : la donnée se prend dans le `
          + `bundle, insensible au format de la source. Les quatre graphies du chemin sont vues par `
          + `le juge, et la voie correcte n'est pas accusée. ${passe} vérification(s) passée(s).`);
