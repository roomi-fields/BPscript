#!/usr/bin/env node
/**
 * CONVERTISSEUR MÉCANIQUE VERS LA FORME REFONDUE — Temps 0, il ne migre RIEN.
 *
 * Il prend une scène (`.bps`) ou une librairie (`.bpsl`) et rend sa forme neuve sur la sortie
 * standard. Il n'écrit dans aucun dépôt : c'est l'appelant qui redirige, et le rapport est le vrai
 * livrable.
 *
 * ⛔ IL SIGNALE CE QU'IL NE SAIT PAS CONVERTIR PLUTÔT QUE DE DEVINER. Chaque ligne sort dans l'une
 * de trois natures, et le compte de chacune est ce que le rapport porte :
 *   MECANIQUE  la règle est écrite dans une décision, la transformation est déterministe ;
 *   DECISION   la forme se lit, mais ce qu'elle doit devenir n'est pas tranché — la ligne est
 *              rendue INCHANGÉE et marquée, jamais devinée ;
 *   REFUS      la ligne n'est pas reconnue du tout.
 *
 * LES CINQ DÉCISIONS QU'IL APPLIQUE, du 2026-08-16 (hub/decisions/) :
 *   · trois mots restent — `object`, `def`, `init` ; `var` sort ; l'arobase sort ;
 *   · un `-----` obligatoire entre la partie déclarative et la première sous-grammaire ;
 *   · trois branches de lecture — un TYPE crée, un NOM connu pose, une LIBRAIRIE invoque ;
 *   · quatre types en librairie — `control`, `addresskey`, `native`, `destination` ; un `enum` ;
 *   · un alphabet déclare son `reads`, et `runtime` en sort.
 *
 * ⚠️ CE QU'IL NE FAIT PAS, ET C'EST DÉLIBÉRÉ. Il ne décide pas qu'une déclaration est INUTILE. Sur
 * `dhati.bps`, 61 terminaux déclarés tombent à zéro parce que l'alphabet les génère ou les segmente
 * — mais la clé `reads` qui le dirait N'EXISTE DANS AUCUNE DONNÉE, et la décision qui l'introduit
 * note elle-même que sa valeur a été DÉDUITE, jamais mesurée. Décider sur une valeur déduite serait
 * la faute que ce Temps 0 existe pour éviter. Ces lignes sortent donc en DECISION, comptées.
 */
import { readFileSync } from 'node:fs';

/** Les mots qui INVOQUENT une librairie — un mot seul, éventuellement pointé. */
const LIBRAIRIES = new Set([
  'core', 'alphabet', 'alphabets', 'tuning', 'tunings', 'octaves', 'sound', 'sounds',
  'homomorphism', 'test_alphabets', 'settings', 'scales', 'temperaments', 'voices',
  'digital', 'mod', 'eval', 'engine', 'expression', 'midi', 'transpo', 'variation', 'audio',
]);

/**
 * Les mots qui POSENT une valeur sur un nom déjà connu — mesurés dans le corpus, pas devinés.
 * Chacun est déclaré par une librairie aujourd'hui ; après la refonte il se pose sans arobase.
 */
const POSES = new Set([
  'tempo', 'mode', 'seed', 'meter', 'maxitems', 'allitems', 'quantization', 'qclock',
  'timepatterns', 'improvize', 'striated', 'smooth', 'randomize', 'scan', 'weight', 'on_fail',
  'diapason', 'transpose', 'chromashift', 'scaleshift', 'duration', 'mm', 'rndtime', 'repeat',
  'retro', 'rotate', 'shuffle', 'order', 'destru', 'stop', 'goto', 'failed', 'ins', 'cv', 'out',
]);

/** Les types qui remplacent `@var <nom> <type>` — conventions, drapeau, entrée, module. */
const CONVENTIONS = new Set(['signal', 'pitch', 'phase', 'logic']);

/** Les cinq mots SORTIS du langage — leur ligne se retire, elle ne se convertit pas. */
const SORTIS = new Set(['macro', 'template', 'mine', 'factory']);

export function convertir(source, nomFichier = '(entrée)') {
  const lignes = source.split('\n');
  const sortie = [];
  const notes = { mecanique: 0, decision: [], refus: [], retraits: [] };
  let delimiteurPose = false;
  let vuDeclaration = false;
  const estLibrairie = nomFichier.endsWith('.bpsl');
  const nomBase = nomFichier.replace(/^.*\//, '').replace(/\.(bps|bpsl)$/, '');

  // ⚠️ LE PRÉAMBULE FINIT À LA DERNIÈRE LIGNE DÉCLARATIVE QUI N'OUVRE PAS UNE SECTION. `mode` est
  // le seul ouvreur mesuré — la décision le nomme : « `mode:lin` ouvre une sous-grammaire, avant
  // ses règles ». Les commentaires qui suivent appartiennent alors à la section, comme dans
  // l'épreuve manuelle.
  let finPreambule = lignes.length;
  for (let k = lignes.length - 1; k >= 0; k--) {
    const t = lignes[k].trim();
    if (!t || t.startsWith('//')) continue;
    if (/^@?mode\b/.test(t)) continue;
    if (/(->|<->|<-)/.test(t) || /^-----/.test(t)) continue;
    if (t.startsWith('@')) { finPreambule = k + 1; break; }
  }

  const marque = (nature, ligne, i, cause) => {
    if (nature === 'DECISION') notes.decision.push({ ligne: i + 1, texte: ligne.trim(), cause });
    else notes.refus.push({ ligne: i + 1, texte: ligne.trim(), cause });
  };

  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    const nu = l.trim();

    // Commentaires et lignes vides traversent VERBATIM — y compris les métadonnées `// @name:`,
    // dont la décision note qu'elles sont le SEUL endroit où l'arobase survit.
    // ⚠️ LE DÉLIMITEUR SE POSE AVANT LES COMMENTAIRES QUI OUVRENT LA SECTION, pas après : le bloc
    // « --- Sous-grammaire 1 --- » DÉCRIT la section, il lui appartient. Ma première version le
    // posait après et les rangeait dans le préambule ; la confrontation à l'épreuve manuelle a
    // réduit l'écart à cette seule ligne, puis à zéro.
    if (!delimiteurPose && !estLibrairie && vuDeclaration && i >= finPreambule) {
      sortie.push('-----');
      delimiteurPose = true;
    }
    if (!nu || nu.startsWith('//')) { sortie.push(l); continue; }

    // ⛔ LE DÉLIMITEUR SE POSE À LA FIN DU PRÉAMBULE, pas devant la première flèche. Le `-----`
    // sépare des SECTIONS, et chaque section porte SES POSES AVANT SES RÈGLES : `mode:random`
    // ouvre une sous-grammaire, il appartient donc à la section qui SUIT le délimiteur, pas au
    // préambule. Ma première version le posait devant la première production et rangeait `mode`
    // du mauvais côté — l'épreuve manuelle de l'architecte l'avait placé juste, et c'est en
    // confrontant les deux que la règle s'est précisée.
    const estProduction = /(->|<->|<-)/.test(nu) || /^-----/.test(nu);
    if (estProduction) { sortie.push(l); if (/^-----/.test(nu)) delimiteurPose = true; continue; }

    if (!nu.startsWith('@')) { sortie.push(l); continue; }
    vuDeclaration = true;

    const m = nu.match(/^@([a-zA-Z_][\w]*)(.*)$/);
    if (!m) { sortie.push(l); marque('REFUS', l, i, "ligne ouverte par '@' sans nom lisible"); continue; }
    const [, mot, reste] = m;

    // ── @var <nom> <type> → <type> <nom> ────────────────────────────────────────────────────
    if (mot === 'var') {
      const r = reste.trim();
      let f;
      if ((f = r.match(/^([\w-]+)\s+flag\s*:\s*(.+)$/))) {
        sortie.push(`flag ${f[1]}(${f[2].trim()})`); notes.mecanique++;
      } else if ((f = r.match(/^([\w-]+)\s+in\.([\w-]+)\s*$/))) {
        sortie.push(`in.${f[2]} ${f[1]}`); notes.mecanique++;
      } else if ((f = r.match(/^([\w-]+)\s+([\w-]+)\s*$/)) && CONVENTIONS.has(f[2])) {
        sortie.push(`${f[2]} ${f[1]}`); notes.mecanique++;
      } else if ((f = r.match(/^([\w-]+)\s+([\w-]+)\s*$/))) {
        sortie.push(`${f[2]} ${f[1]}`); notes.mecanique++;   // instance d'un module du catalogue
      } else if (/^[\w-]+$/.test(r)) {
        sortie.push(`symbol ${r}`); notes.mecanique++;        // une variable sans type
      } else if (/^[\w-]+(\s*,\s*[\w-]+)+$/.test(r)) {
        // ⛔ UNE LISTE DE NOMS SANS TYPE — tranchée le 2026-08-16 « selon ce que les noms
        // désignent ». Mesuré sur la seule scène qui la porte (`tryhomomorphism.bps`) :
        // `S -> a b c $X * &X` les écrit DANS LE FLUX, et la table d'homomorphisme les traduit
        // (`a-->b`, `c-->fa4`). Ils ne sonnent pas — ce sont des opérandes, à côté desquels
        // `do4`, `mi4`, `fa4` sont, eux, des notes. C'est la définition même de `symbol` :
        // « s'écrit dans le flux, ne sonne pas, l'aval le porte opaquement ».
        for (const n of r.split(',').map((x) => x.trim()).filter(Boolean)) {
          sortie.push(`symbol ${n}`); notes.mecanique++;
        }
      } else {
        sortie.push(l); marque('DECISION', l, i, "forme de `@var` hors des cinq emplois mesurés");
      }
      continue;
    }

    // ── @gate <nom>:<canal> → terminal <nom>(out.<canal>) ───────────────────────────────────
    if (mot === 'gate') {
      const g = reste.trim().match(/^([^\s:]+)\s*:\s*([\w-]+)\s*$/);
      if (g) {
        // ⛔ LA QUESTION QUI MARQUAIT CES LIGNES EST TRANCHÉE (2026-08-16) : la clé `reads`
        // N'EXISTE PAS. bp3-engine a mesuré sur le binaire natif — SEGMENTED sur 38 alphabets
        // sur 38, zéro composed, et les NOTES ne passent pas par l'alphabet du tout : `do5`
        // sonne sans aucun fichier d'alphabet, la composition est un CALCUL. Une clé qui vaut
        // la même chose partout ne porte rien. La traduction est donc purement mécanique.
        sortie.push(`terminal ${g[1]}(out.${g[2]})`);
        notes.mecanique++;
      } else { sortie.push(l); marque('REFUS', l, i, "`@gate` sans la forme `<nom>:<canal>`"); }
      continue;
    }

    // ── @actor <nom> <producteurs…> → actor <nom>(<producteurs…>) ───────────────────────────
    if (mot === 'actor') {
      const a = reste.trim().match(/^([\w-]+)\s*(.*)$/);
      if (a && a[2]) { sortie.push(`actor ${a[1]}(${a[2].trim()})`); notes.mecanique++; }
      else if (a) { sortie.push(`actor ${a[1]}`); notes.mecanique++; }
      else { sortie.push(l); marque('REFUS', l, i, '`@actor` sans nom'); }
      continue;
    }

    // ── CINQ MOTS SORTENT DU LANGAGE — la ligne se SUPPRIME, elle ne se traduit pas ────────
    // Décision du 2026-08-16. `macro` était sorti le 2026-08-09 ; `mine` et `factory` l'étaient
    // depuis le 2026-07-13 — « REMPLACÉE : la provenance ne figure plus dans l'invocation » —
    // et vingt occurrences traînaient encore. Un retrait acté qui n'avait jamais été exécuté.
    // ⚠️ SUPPRIMER N'EST PAS CONVERTIR : ces lignes ne comptent pas comme une transformation,
    // elles comptent comme un RETRAIT, et le rapport les nomme séparément.
    if (SORTIS.has(mot)) { notes.retraits.push({ ligne: i + 1, mot, texte: nu }); continue; }

    // ── invocation d'une librairie : un mot seul, éventuellement pointé ─────────────────────
    const racine = mot;
    if (LIBRAIRIES.has(racine)) { sortie.push(nu.slice(1)); notes.mecanique++; continue; }

    // ── pose d'une valeur sur un nom connu ──────────────────────────────────────────────────
    if (POSES.has(racine)) { sortie.push(nu.slice(1)); notes.mecanique++; continue; }

    // ── `@def` DANS UNE LIBRAIRIE : le mot devient le TYPE de ce qu'il déclare ──────────────
    // ⛔ LES QUATRE TYPES SE LISENT DANS LA DONNÉE, ils ne se devinent pas :
    //     `bpscript:false`            → `native`      — aucune forme BPScript, il traduit
    //     `section:schema.addressKeys`→ `addresskey`  — il atterrit dans `payload.address`
    //     une clé `scope`             → `control`     — il module
    //     le `@def` qui porte le NOM DU FICHIER → `destination` — il porte `resolvedBy`
    // Mesuré sur les six librairies : 142 déclarations, 142 classées, ZÉRO orpheline —
    //     destination 6 · native 6 · addresskey 5 · control 125.
    if (racine === 'def' && estLibrairie) {
      const nom = reste.trim().split(/\s+/)[0];
      let j = i + 1; let type = 'control'; let vuScope = false;
      while (j < lignes.length && /^\s+\S/.test(lignes[j])) {
        const c = lignes[j].trim();
        if (/^bpscript\s*:\s*false/.test(c)) type = 'native';
        if (/^section\s*:\s*schema\.addressKeys/.test(c)) type = 'addresskey';
        if (/^scope\s*:/.test(c)) vuScope = true;
        j++;
      }
      if (nom === nomBase) type = 'destination';
      else if (type === 'control' && !vuScope) type = 'control';
      sortie.push(`${type} ${nom}`); notes.mecanique++; continue;
    }
    if (racine === 'def' || racine === 'init' || racine === 'object') {
      sortie.push(nu.slice(1)); notes.mecanique++; continue;
    }

    // Tout le reste : le mot n'est ni un type, ni une pose connue, ni une librairie.
    sortie.push(nu.slice(1));
    marque('DECISION', l, i,
      `\`@${racine}\` n'est ni une librairie ni une pose mesurée — l'arobase tombe, mais sa BRANCHE `
      + 'de lecture (crée / pose / invoque) n\'est pas établie');
  }

  return { texte: sortie.join('\n'), notes };
}

// ── Ligne de commande ───────────────────────────────────────────────────────────────────────
const cible = process.argv[2];
if (cible) {
  const src = readFileSync(cible, 'utf-8');
  const { texte, notes } = convertir(src, cible);
  if (process.argv.includes('--notes')) {
    process.stderr.write(`${cible}\tMECANIQUE ${notes.mecanique}\tDECISION ${notes.decision.length}\tREFUS ${notes.refus.length}\n`);
    for (const d of notes.decision) process.stderr.write(`  DECISION l.${d.ligne}\t${d.texte}\t${d.cause}\n`);
    for (const r of notes.refus) process.stderr.write(`  REFUS    l.${r.ligne}\t${r.texte}\t${r.cause}\n`);
  }
  process.stdout.write(texte);
}
