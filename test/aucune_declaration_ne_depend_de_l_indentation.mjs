#!/usr/bin/env node
/**
 * GARDE — AUCUNE DÉCLARATION DE LIBRAIRIE NE SE RATTACHE PAR SON INDENTATION.
 *
 * Romain, 2026-08-19 : « je m'oppose formellement à toute forme d'analyse en fonction de
 * l'indentation ». Une clé appartient à une déclaration parce qu'une PARENTHÈSE le dit, jamais parce
 * qu'elle est décalée de deux espaces.
 *
 * ⛔ LE DERNIER SITE, ET C'ÉTAIT CELUI QUI DÉCLARE LE FICHIER. `lib/scales.bpsl` portait encore
 * `def scales` suivi de `resolvedBy` et `resolves` rattachés par leur seul décalage — alors que ses
 * 185 entrées avaient été réécrites le jour même en quatre prototypes dérivants. J'ai refait tout ce
 * qui était DEDANS sans regarder la ligne qui le NOMME.
 *
 * ⚠️ ET LA FORME QUI LE REMPLACE S'EST DÉCIDÉE AU COMPILATEUR, PAS DE MÉMOIRE. `def scales(…)` collé
 * est REFUSÉ — « la liste de paramètres ne porte que des NOMS » : la parenthèse collée fait une
 * DÉFINITION À PARAMÈTRES. C'est `def scales (…)`, avec l'espace, qui porte un sac de réglages. Un
 * signe de ponctuation porte des rôles que personne n'a écrits, et l'espace est le signe ici.
 *
 * ⛔ CE QUE CE GARDE NE REFUSE PAS, ET C'EST MESURÉ : les 57 lignes indentées de `lib/engine.bpsl`
 * vivent DANS une parenthèse ouverte. Leur décalage est une MISE EN FORME, pas une analyse — le
 * parseur les rattache à la parenthèse, pas à leur colonne. Un garde qui refuserait toute indentation
 * les emporterait avec la faute.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

// ⛔ L'APPEL EST ANCRÉ, JAMAIS LAISSÉ AU RÉPERTOIRE COURANT — git REMONTE jusqu'au premier dépôt
// trouvé au-dessus, et rend alors un résultat plausible sur un autre dépôt.
const RACINE = new URL('..', import.meta.url).pathname;
const fichiers = execFileSync('git', ['-C', RACINE, 'ls-files', 'lib/'], { encoding: 'utf8' })
  .split('\n').filter((f) => f.endsWith('.bpsl'));
ok(fichiers.length > 0, "le dossier doit porter des librairies en BPScript — sans elles le garde examine zéro");

/** Une clé rattachée par son seul décalage à une déclaration SANS parenthèse. */
const fautives = [];
let lignesExaminees = 0;
for (const f of fichiers) {
  const lignes = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').split('\n');
  let ouverte = false;   // une parenthèse de déclaration est-elle en cours ?
  let dernierDef = null;
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    lignesExaminees++;
    // Ouverture / fermeture grossière : ce qui compte est de savoir si l'on est DANS une parenthèse.
    const ouvre = (l.match(/\(/g) || []).length;
    const ferme = (l.match(/\)/g) || []).length;
    if (/^def\s+\S+\s*$/.test(l)) { dernierDef = { nom: l.trim(), ligne: i + 1 }; ouverte = false; continue; }
    if (ouvre > ferme) ouverte = true;
    else if (ferme >= ouvre && ferme > 0) ouverte = false;
    if (ouverte) continue;                                  // DANS une parenthèse : mise en forme
    if (dernierDef && /^\s+[A-Za-z_][A-Za-z0-9_]*\s*:/.test(l)) {
      fautives.push(`${f}:${i + 1} — « ${l.trim().slice(0, 40)} » rattachée à « ${dernierDef.nom} » (ligne ${dernierDef.ligne}) par son seul décalage`);
    }
    if (l.trim() !== '' && !/^\s/.test(l)) dernierDef = null;
  }
}

ok(lignesExaminees > 0, 'le garde doit avoir lu des lignes — il refuse d\'avoir examiné zéro');
ok(fautives.length === 0,
  `⛔ ${fautives.length} clé(s) rattachée(s) par l'indentation :\n     ${fautives.slice(0, 6).join('\n     ')}`);

// ── ⛔ LE TÉMOIN — le détecteur voit-il une faute quand il y en a une ? ───────────────────────────
// Sans lui, un détecteur qui ne détecte plus rien rend « zéro faute » exactement comme un dossier
// propre. Les deux sorties sont identiques.
{
  const faux = ['def zorglub', '  cle:valeur', ''].join('\n');
  const lignes = faux.split('\n');
  let vu = 0, dernierDef = null;
  for (const l of lignes) {
    if (/^def\s+\S+\s*$/.test(l)) { dernierDef = l.trim(); continue; }
    if (dernierDef && /^\s+[A-Za-z_][A-Za-z0-9_]*\s*:/.test(l)) vu++;
  }
  ok(vu === 1, `TÉMOIN — le détecteur doit voir la faute fabriquée (reçu ${vu})`);
  // Et son complément : la MÊME clé, dans une parenthèse, n'est pas une faute.
  const bon = ['def zorglub (', '  cle:valeur', ')'].join('\n');
  let vuBon = 0, ouverte = false, def2 = null;
  for (const l of bon.split('\n')) {
    const o = (l.match(/\(/g) || []).length, c = (l.match(/\)/g) || []).length;
    if (/^def\s+\S+\s*$/.test(l)) { def2 = l.trim(); ouverte = false; continue; }
    if (o > c) { ouverte = true; continue; }
    if (c > 0) { ouverte = false; continue; }
    if (ouverte) continue;
    if (def2 && /^\s+[A-Za-z_][A-Za-z0-9_]*\s*:/.test(l)) vuBon++;
  }
  ok(vuBon === 0, `TÉMOIN — une clé DANS une parenthèse n'est pas une faute (reçu ${vuBon})`);
}

const ATTENDU = 5;
ok(p + e.length === ATTENDU, `le garde doit éprouver ${ATTENDU} cas — ${p + e.length} seulement`);

if (e.length) { console.error(`[indentation] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[indentation] ${p} PASS / 0 FAIL — ${p} assertion(s), ${fichiers.length} librairie(s), ${lignesExaminees} lignes`);
