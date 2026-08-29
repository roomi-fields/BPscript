#!/usr/bin/env node
/**
 * `terminal` NOMME LE PROTOTYPE QUE LA BIBLE DÉCRIT DÉJÀ — le type en tête, rien de plus.
 *
 * LA SOURCE EST LA BIBLE, pas une décision : `LANGUAGE.md:348-374` (« Déclarer un terminal », avec
 * ses trois formes) et `:863-900` (« Ce que porte un terminal » — les deux axes, hauteur et
 * réalisation, et le prototype complet). La forme cible est le TYPE EN TÊTE
 * (`hub/projets/2026-08-02-refonte-langage/FORME-OBJET.md`, § « le mot `terminal` »), donc
 * `terminal cloche(voice.bayan_muted)`. La section est nommée, jamais sa ligne : un numéro de ligne
 * ne traverse pas les dépôts.
 *
 * ⛔ AUCUNE VOIE PARALLÈLE, ET C'EST LE POINT. Le nœud existait déjà : `def ka voice.bayan_muted` rend
 * `DefDirective{kind:'terminal'}`, le `kind` DÉDUIT du corps. `terminal ka(voice.bayan_muted)` rend LE MÊME
 * nœud avec le `kind` ÉCRIT. Le mot n'ajoute aucun concept — s'il produisait un second nœud, deux
 * formes du langage décriraient la même chose dans deux structures, et l'aval devrait lire les deux.
 *
 * ⚠️ CE QUI LE SÉPARE D'`actor` EST ÉCRIT, ET C'EST CE QUI A LEVÉ MON BLOCAGE. `LANGUAGE.md:853` :
 * un terminal est « une chose entière », seul porteur d'une sortie ; un acteur porte un alphabet et
 * une sortie pour un ENSEMBLE de terminaux. Deux nœuds distincts, et ils l'étaient déjà.
 *
 * ⚠️ AUCUN SITE VIVANT — zéro scène des deux dépôts écrit `terminal`, mesuré au compilateur le
 * 2026-08-22. Ce banc ne répare aucune casse : il ferme un écart entre ce que la bible décrit et ce
 * que le compilateur acceptait.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const SOCLE = 'core\n';
const compiler = (decl) => {
  try {
    const r = compileToBPxAST(`${SOCLE}${decl}\n-----\nS -> C4 D4\n`, {});
    const errs = (r.errors || []).map((e) => e.message || String(e));
    return { ok: !!r.ast && !errs.length, err: errs[0] || '', def: r.ast?.defs?.[0] || null };
  } catch (e) { return { ok: false, err: e.message, def: null }; }
};

// ── SOCLE — il se prouve avant de servir ────────────────────────────────────────────────────
{
  const r = compileToBPxAST(`${SOCLE}-----\nS -> C4 D4\n`, {});
  ok(!!r.ast && !(r.errors || []).length,
     `SOCLE : la scène nue doit compiler — sinon toute mesure sous elle est le refus du socle`);
}

// ── A. LES TROIS FORMES DE LA BIBLE, ÉCRITES AVEC LE TYPE EN TÊTE ───────────────────────────
for (const [quoi, decl, cle, valeur, sorte] of [
  ['une référence      `voice.bayan_muted`',   'terminal ka(voice.bayan_muted)',        'voice',    'bayan_muted',   'ref'],
  ['une valeur         `hz:440`',      'terminal sirene(hz:440)',       'hz',       '440',   'value'],
  ['un booléen         `sounding:false`', 'terminal muet(sounding:false)', 'sounding', 'false', 'value'],
]) {
  const r = compiler(decl);
  ok(r.ok, `A. ${quoi} doit compiler — la bible l'écrit § « Déclarer un terminal ». Reçu : ${r.err}`);
  ok(r.def && r.def.keys?.[cle]?.value === valeur && r.def.keys?.[cle]?.kind === sorte,
     `A. et sa clé arrive dans l'arbre — ${cle} = ${sorte}:${valeur}. Vue : `
     + `${JSON.stringify(r.def && r.def.keys?.[cle])}`);
}
{
  const r = compiler('terminal cloche(register:5, degree:0, voice.dayan_ring)');
  ok(r.ok, `A. plusieurs clés, séparées par la virgule — « dans la partie DÉCLARATIVE, seule la `
    + `virgule sépare » (Romain, 2026-08-19). Reçu : ${r.err}`);
  ok(r.def && Object.keys(r.def.keys || {}).length === 3,
     `A. et les TROIS arrivent — une valeur qui avalerait la suivante rendrait un compte plus bas. `
     + `Vues : ${JSON.stringify(Object.keys((r.def && r.def.keys) || {}))}`);
}

// ── B. ⛔ LE MÊME NŒUD QUE `def`, ET LE `kind` EST ÉCRIT AU LIEU D'ÊTRE DÉDUIT ──────────────
{
  const parLeType = compiler('terminal ka(voice.bayan_muted)');
  const parDef = compiler('def ka  voice.bayan_muted');
  ok(parDef.ok && parLeType.ok, 'B. SOCLE : les deux écritures doivent compiler');
  ok(parLeType.def?.type === 'DefDirective' && parDef.def?.type === 'DefDirective',
     `B. les deux rendent un DefDirective — un second nœud ferait deux structures pour une notion. `
     + `Vus : ${parLeType.def?.type} et ${parDef.def?.type}`);
  ok(parLeType.def?.kind === 'terminal' && parDef.def?.kind === 'terminal',
     `B. et les deux portent kind:'terminal' — écrit d'un côté, déduit de l'autre`);
  ok(JSON.stringify(parLeType.def?.keys) === JSON.stringify(parDef.def?.keys),
     `B. ⛔ LES DEUX CORPS SONT IDENTIQUES À L'OCTET PRÈS. C'est ce qui prouve qu'aucune voie `
     + `parallèle n'est ouverte : le type en tête est une GRAPHIE, jamais une seconde sémantique. `
     + `Vus : ${JSON.stringify(parLeType.def?.keys)} vs ${JSON.stringify(parDef.def?.keys)}`);
}

// ── C. ⛔ LES FORMES DE `def` NE BOUGENT PAS — le témoin qui distingue AJOUTER de REMPLACER ──
for (const [quoi, decl] of [
  ['clés sur la même ligne', 'def ka  voice.bayan_muted'],
  ['clés en bloc indenté',   'def cloche\n  register:5\n  voice.dayan_ring'],
  ['une structure',          'def cadence sa re ga pa'],
]) {
  const r = compiler(decl);
  ok(r.ok, `C. la forme de \`def\` — ${quoi} — doit rester vivante. Reçu : ${r.err}`);
}
ok(compiler('def cadence sa re ga pa').def?.kind === 'structure',
   'C. et une STRUCTURE garde son kind — le type en tête ne l\'a pas absorbée');

// ── D. UN TERMINAL N'EST PAS UNE STRUCTURE, ET LE REFUS LE DIT ─────────────────────────────
// Sans ce refus, `terminal cadence(sa re ga pa)` rendrait un `kind:'terminal'` sur une suite de
// termes : un nœud PLAUSIBLE ET FAUX, la pire des sorties.
{
  const r = compiler('terminal cadence(sa re ga pa)');
  ok(!r.ok, 'D. une suite de termes sous `terminal` doit être REFUSÉE');
  ok(/se déclare par ses CLÉS/.test(r.err),
     `D. et le refus doit NOMMER les clés attendues ET la forme qui convient — un refus muet ferait `
     + `chercher une faute de syntaxe. Reçu : ${r.err}`);
}

// ── E. UNE PARENTHÈSE OUVERTE SE REFERME ───────────────────────────────────────────────────
{
  const r = compiler('terminal ka(voice.bayan_muted');
  ok(!r.ok && /n'est pas refermé/.test(r.err),
     `E. une parenthèse non refermée est refusée EN NOMMANT ce qui manque. Reçu : ${r.err}`);
}

// ── UN CATALOGUE S'ADRESSE PAR UN SEUL NIVEAU, DANS LES QUATRE GRAPHIES ──────────────────────
// ⛔ CE QU'IL FERME EST UN MESSAGE, PAS UN COMPORTEMENT. `voice.objects.wobble` était déjà refusé
// partout — le niveau interne d'un catalogue ne s'écrit pas. Mais AUCUNE des quatre graphies ne
// nommait le chemin fautif, et la parenthésée parlait d'une PONCTUATION :
//     terminal ka (voice.objects.wobble)  ⇒ « le corps ouvert par '(' n'est pas refermé »
// Un auteur qui écrit le niveau interne cherchait sa faute sur une parenthèse.
//
// ⚠️ TROUVÉ PAR KANOPI, PUIS LE DÉNOMINATEUR CORRIGÉ PAR BPx : j'avais annoncé « deux graphies sur
// trois », il y en a QUATRE et une seule différait. Le compte venait de mon propre préavis, qui en
// annonçait quatre — je l'avais rétréci en le rectifiant.
//
// ⛔ ET LE GARDE EXIGE LE MÊME TEXTE AUX QUATRE : un seul mécanisme ne rend qu'une seule phrase.
// C'est cette assertion qui empêche de réparer la graphie qui s'était montrée en laissant les trois.
{
  const GRAPHIES_CHEMIN = [
    ['parenthésée',      'terminal ka (voice.objects.wobble)'],
    ['sans parenthèse',  'terminal ka voice.objects.wobble'],
    ['par def',          'def ka voice.objects.wobble'],
    ['en bloc indenté',  'def ka\n  voice.objects.wobble'],
  ];
  const textes = new Set();
  let examinees = 0;
  for (const [quoi, forme] of GRAPHIES_CHEMIN) {
    examinees += 1;
    const r = compiler(forme);
    ok(!r.ok, `A-chemin. la graphie ${quoi} du niveau interne est REFUSÉE`);
    ok(/DEUX niveaux/.test(r.err),
       `A-chemin. et le refus nomme le CHEMIN, pas la ponctuation (${quoi}) — reçu : ${r.err.slice(0, 90)}`);
    ok(/objects/.test(r.err), `A-chemin. et il cite le niveau fautif (${quoi})`);
    textes.add(r.err.replace(/ at line \d+:\d+$/, ''));
  }
  ok(examinees === 4, `A-chemin. les 4 graphies ont été examinées (${examinees})`);
  ok(textes.size === 1,
     `A-chemin. les QUATRE rendent le MÊME texte — un seul mécanisme, une seule phrase (vu ${textes.size})`);

  // ⛔ ET LE POINT ESPACÉ N'EST PAS CE CAS — le témoin qui borne la condition.
  // Ma condition exige un point COLLÉ (`!spaceBefore`). Sans ce volet, la retirer ne faisait rougir
  // aucune assertion : le point espacé était déjà refusé pour une autre raison, donc l'injection
  // restait muette et je n'avais aucune preuve que ma condition ne coupe pas trop large.
  // ⚠️ Une injection qui ne mord pas se suspecte elle-même — ici elle accusait le garde, pas le code.
  for (const [quoi, forme] of [
    ['espacé des deux côtés', 'def ka voice.wobble . autre'],
    ['espacé avant seulement', 'def ka voice.wobble .autre'],
  ]) {
    const r = compiler(forme);
    ok(!r.ok, `A-chemin. le point ${quoi} reste REFUSÉ — il l'était déjà`);
    ok(!/DEUX niveaux/.test(r.err),
       `A-chemin. et il NE porte PAS le refus du chemin (${quoi}) : ma condition exige un point `
       + `COLLÉ, et ce volet est ce qui le prouve — reçu : ${r.err.slice(0, 70)}`);
  }
  // LE CONTRÔLE NÉGATIF — couper trop large est l'autre façon d'échouer.
  for (const forme of ['terminal ka (voice.bayan_muted)', 'def ka voice.wobble',
                       'terminal ka (tuning.western_just, octaves.western)', 'def ka  hz:440']) {
    ok(compiler(forme).ok, `A-chemin. « ${forme} » passe toujours`);
  }
}

// ── F. LE TÉMOIN NON NUL ───────────────────────────────────────────────────────────────────
{
  const r = compiler('zorglubinvente ka(voice.bayan_muted)');
  ok(!r.ok, 'F. TÉMOIN — un mot qui n\'ouvre aucune déclaration reste refusé sous la même forme');
}

// Le volet « un seul niveau » ajoute 18 vérifications : 4 graphies × 3, plus le compte des
// graphies examinées, l'unicité du texte, et 4 contrôles négatifs.
const ATTENDU = 1 + 6 + 2 + 4 + 4 + 2 + 1 + 1 + 18 + 4;
ok(passe + echecs.length === ATTENDU,
   `bilan : ${ATTENDU} vérifications attendues, ${passe + echecs.length} exécutées`);

if (echecs.length) {
  console.error(`❌ un terminal nomme son type en tête : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ un terminal nomme son type en tête — les trois formes de la bible compilent, le nœud `
          + `est celui de \`def\` avec son kind ÉCRIT, les corps sont identiques à l'octet près, et `
          + `une structure y est refusée en nommant les clés. ${passe} vérification(s) passée(s).`);
