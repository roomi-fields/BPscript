#!/usr/bin/env node
/**
 * GARDE — UNE DÉCLARATION DE TERMINAL PORTE `temporalType`, ET SON ABSENCE EST MUETTE.
 *
 * ⛔ CE QUE CE GARDE FERME, mesuré le 2026-08-18. `gate` est sorti du langage et un terminal se
 * déclare `<nom>:<canal>` directement. Ma première écriture du nœud omettait `temporalType` — le
 * mot avait disparu de la surface, j'ai cru que le champ partait avec lui.
 *
 * LE CHAMP EST UNE FRONTIÈRE, PAS UNE GRAPHIE. `BPx/src/types/ast.ts` le déclare REQUIS
 * (`temporalType: 'gate' | 'trigger'`) et `BPx/src/load/loadGrammar.ts:1613` le LIT : un nom
 * déclaré n'entre dans les TERMINAUX D'ALPHABET que si `decl.temporalType === 'gate'`.
 *
 * ⚠️ LE COÛT, ET IL EST DU GENRE QUE RIEN NE SIGNALE : l'arbre dérivé de `koto3` a maigri de 26 %
 * — 2919 octets — SANS UNE SEULE ERREUR. Ses terminaux cessaient d'être des terminaux d'alphabet,
 * ce qui se voit sur l'OBJET HORS-TEMPS (`Y -> !f`) et nulle part ailleurs : douze scènes sur
 * treize rendaient un arbre identique à l'octet. Une perte SILENCIEUSE de production ne se
 * découvre pas par un refus, et un compte de scènes qui compilent ne la voit pas non plus.
 *
 * ⚠️ ET `trigger` N'A PLUS DE GRAPHIE. `<nom>:<canal>` ne distingue pas les deux types temporels ;
 * on émet `gate`, le seul que BPx collecte. L'écart est SIGNALÉ à l'architecte, pas comblé par une
 * graphie inventée. Le jour où le second type revient, ce garde dit où le poser.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const SOCLE = 'core\nalphabet.western\n';
const compile = (src) => compileToBPxAST(SOCLE + src);

// ── 1. LE CHAMP EST LÀ, SUR CHAQUE CANAL DE SORTIE ───────────────────────────────────────────
// Une matrice, pas un cas : le nœud se construit dans UNE branche, mais un canal est lu dans la
// donnée et rien ne garantit qu'ils passent tous par elle.
const CANAUX = ['midi', 'audio', 'osc', 'dmx', 'text'];
console.log(`[type temporel] ${CANAUX.length} canaux de sortie x la forme déclarée`);
for (const canal of CANAUX) {
  const r = compile(`zz:${canal}\n-----\nS -> zz`);
  const d = (r.ast?.declarations || [])[0];
  ok((r.errors || []).length === 0, `1. 'zz:${canal}' doit compiler — reçu : ${(r.errors || []).map((e) => e.message).join(' | ').slice(0, 90)}`);
  ok(d && d.type === 'Declaration' && d.name === 'zz' && d.runtime === canal,
     `1. 'zz:${canal}' doit poser une Declaration nommée — reçu ${JSON.stringify(d)}`);
  ok(d && d.temporalType === 'gate',
     `1. 'zz:${canal}' doit porter temporalType 'gate' — BPx ne collecte un terminal d'alphabet `
     + `qu'à cette condition (loadGrammar.ts:1613). Reçu ${JSON.stringify(d && d.temporalType)}`);
}

// ── 2. L'OBJET HORS-TEMPS — le seul endroit où l'absence se voyait ───────────────────────────
// `koto3` est la seule scène du corpus dont un terminal déclaré est employé en objet hors-temps.
// C'est ce qui l'a distinguée des douze autres, et c'est donc ce cas-là qui se garde ici.
{
  const r = compile('f:midi\n-----\nmode:random\nY -> !f\nS -> Y');
  ok((r.errors || []).length === 0,
     `2. un terminal déclaré employé en OBJET HORS-TEMPS doit compiler — reçu : `
     + `${(r.errors || []).map((e) => e.message).join(' | ').slice(0, 100)}`);
  const trouve = JSON.stringify(r.ast?.subgrammars || []).includes('"OutTimeObject"');
  ok(trouve, `2. et l'arbre doit porter un OutTimeObject`);
  ok((r.ast?.declarations || []).some((d) => d.name === 'f' && d.temporalType === 'gate'),
     `2. et sa déclaration doit porter son type temporel — sans lui, BPx ne le compte pas parmi `
     + `les terminaux d'alphabet et la production maigrit SANS erreur`);
}

// ── 3. LE COMPLÉMENT — ce qui n'est pas une déclaration n'en reçoit pas ──────────────────────
// Sans cette moitié, une branche qui poserait le champ sur TOUTE ligne de tête serait verte.
for (const [quoi, src] of [
  ['un réglage de scène', 'tempo:120\n-----\nS -> C4'],
  ['une propriété sur un composant', 'alphabet.western:midi\n-----\nS -> C4'],
]) {
  const r = compile(src);
  ok((r.ast?.declarations || []).length === 0,
     `3. ${quoi} ne doit poser AUCUNE déclaration — reçu ${JSON.stringify(r.ast?.declarations)}`);
}

// ── 4. TÉMOIN D'INSTRUMENT — le garde sait mordre ────────────────────────────────────────────
// Un fichier qui ne lirait jamais le champ passerait au vert sur une déclaration absente.
{
  const r = compile('-----\nS -> C4');
  ok((r.ast?.declarations || []).length === 0,
     '4. TÉMOIN — une scène sans déclaration en rend zéro : la section 1 mesure donc bien '
     + 'quelque chose quand elle en trouve');
}

if (echecs.length) {
  console.error(`❌ le type temporel d'une déclaration : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error('   - ' + e);
  process.exit(1);
}
console.log(`✅ une déclaration de terminal porte son type temporel — ${passe} vérification(s)`);
