#!/usr/bin/env node
/**
 * LES DEUX MOITIÉS DU GESTE PROTOTYPAL — l'exemplaire ET la sorte, jamais l'une sans l'autre.
 *
 * DÉCISION DE ROMAIN, 2026-08-16 : « déclarer un type et instancier sont LE MÊME GESTE, et
 * s'écrivent pareil ». Elle pose les deux formes l'une sous l'autre :
 *     actor basse(out.midi(ch:1))        un exemplaire
 *     actor midi.actor(ch: required)     une sorte
 * Les deux étaient REFUSÉES — la première sur sa parenthèse, la seconde sur son point. Un garde qui
 * n'en tiendrait qu'une laisserait revenir exactement la moitié qui manquait.
 *
 * ⛔ CE QUE CE GARDE TIENT AUSSI, ET QUI COMPTE AUTANT : la forme NUE reste vivante. C'est le seul
 * témoin qui distingue « la parenthèse s'ajoute » de « la parenthèse remplace » — 398 acteurs du
 * corpus l'écrivent, et un retrait trop large aurait la même tête qu'une addition juste.
 *
 * ⚠️ AUCUNE DES DEUX FORMES N'A DE SITE VIVANT, mesuré au compilateur le 2026-08-22 sur les 390
 * scènes des deux dépôts et sur les sept librairies : `def` quatre-vingt-douze fois, aucun autre
 * mot. Elles naîtront avec la conversion des librairies. Ce garde ne répare donc aucune casse ; il
 * tient une forme que la décision pose et que le compilateur refusait.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const SOCLE = 'core\n';
const compiler = (decl) => {
  const src = `${SOCLE}${decl}\n-----\nS -> C4 D4\n`;
  try {
    const r = compileToBPxAST(src, {});
    const errs = (r.errors || []).map((e) => e.message || String(e));
    return { ok: !!r.ast && !errs.length, err: errs[0] || '', ast: r.ast };
  } catch (e) { return { ok: false, err: e.message, ast: null }; }
};
const acteur = (r) => (r.ast && r.ast.actors && r.ast.actors[0]) || null;

// ── SOCLE — il se prouve AVANT de servir ────────────────────────────────────────────────────
// Trois fois dans la semaine du 2026-08-22, un socle fautif a rendu des mesures identiques et
// fausses : une arobase sortie du langage, une flèche du moteur historique, un binding de sortie
// qui faisait refuser un acteur pour CHEVAUCHEMENT. Un socle non prouvé mesure le socle.
{
  const r = compileToBPxAST(`${SOCLE}-----\nS -> C4 D4\n`, {});
  ok(!!r.ast && !(r.errors || []).length,
     `SOCLE : la scène nue doit compiler — sinon toute mesure sous elle est le refus du socle. `
     + `Reçu : ${(r.errors || []).map((e) => e.message)[0] || ''}`);
}

// ── A. LES DEUX FORMES DE LA DÉCISION, MOT POUR MOT ─────────────────────────────────────────
{
  const ex = compiler('actor basse(out.midi(ch:1))');
  ok(ex.ok, `A. L'EXEMPLAIRE 'actor basse(out.midi(ch:1))' doit compiler — première ligne de code `
    + `de la décision du 2026-08-16. Reçu : ${ex.err}`);
  const a = acteur(ex);
  ok(a && a.name === 'basse', `A. son nom est 'basse'. Vu : ${a && a.name}`);
  ok(a && a.properties?.transport?.key === 'midi',
     `A. sa sortie est le canal 'midi'. Vue : ${JSON.stringify(a && a.properties?.transport)}`);
  ok(a && a.properties?.transport?.params?.ch === 1,
     `A. et le paramètre écrit DANS la parenthèse intérieure arrive — c'est le point de la forme : `
     + `deux parenthèses imbriquées, la valeur au fond. Vu : ${JSON.stringify(a && a.properties?.transport?.params)}`);
}
{
  const sorte = compiler('actor midi.actor(ch:required)');
  ok(sorte.ok, `A. LA SORTE 'actor midi.actor(ch:required)' doit compiler — seconde ligne de la `
    + `décision. Reçu : ${sorte.err}`);
  const a = acteur(sorte);
  ok(a && a.name === 'midi.actor',
     `A. son nom QUALIFIÉ voyage tel quel : le point porte la dérivation, et 'extends' a été effacé `
     + `pour ça. Vu : ${a && a.name}`);
}

// ── B. ⛔ LA FORME NUE RESTE — le témoin qui distingue AJOUTER de REMPLACER ─────────────────
for (const [quoi, decl] of [
  ['sur une ligne',        'actor basse out.midi(ch:1)'],
  ['sur deux lignes',      'actor basse\n  out.midi(ch:1)'],
  ['sans paramètre',       'actor basse out.audio'],
]) {
  const r = compiler(decl);
  ok(r.ok, `B. la forme NUE ${quoi} doit rester vivante — 398 acteurs du corpus l'écrivent. `
    + `Reçu : ${r.err}`);
}

// ── C. UNE PARENTHÈSE OUVERTE SE REFERME, ET LE REFUS NOMME CE QUI MANQUE ───────────────────
{
  const r = compiler('actor basse(out.midi(ch:1)');
  ok(!r.ok, 'C. une parenthèse non refermée doit être REFUSÉE');
  ok(/is not closed/.test(r.err),
     `C. et le refus doit NOMMER ce qui manque — sans ça il sort en « Expected IDENT » sur la ligne `
     + `suivante, qui accuse la ligne au lieu de dire la faute. Reçu : ${r.err}`);
}

// ── D. CE QUE LA DÉCISION NE MONTRE PAS RESTE REFUSÉ ───────────────────────────────────────
// Une forme non montrée qui refuse se répare en une ligne ; une forme inventée qui compile devient
// la spécification. Ce volet garde la frontière du geste : on n'a pas élargi le lecteur.
{
  const r = compiler('actor basse(zorglubinvente.chose)');
  ok(!r.ok, `D. une clé d'acteur INCONNUE reste refusée dans un corps parenthésé, exactement comme `
    + `dans un corps nu — la parenthèse change le délimiteur, jamais le vocabulaire. Reçu : `
    + `${r.ok ? 'ACCEPTÉE' : r.err.slice(0, 80)}`);
}

// ── E. LE TÉMOIN NON NUL DU JUGE ───────────────────────────────────────────────────────────
// Sans lui, « tout compile » et « je ne mesure rien » ont la même empreinte.
{
  const r = compiler('zorglubinvente basse(out.midi(ch:1))');
  ok(!r.ok, 'E. TÉMOIN — un mot qui n\'ouvre aucune déclaration reste refusé sous la même forme');
}

const ATTENDU = 1 + 6 + 3 + 2 + 1 + 1;
ok(passe + echecs.length === ATTENDU,
   `bilan : ${ATTENDU} vérifications attendues, ${passe + echecs.length} exécutées`);

if (echecs.length) {
  console.error(`❌ les deux moitiés du geste prototypal : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ les deux moitiés du geste prototypal — l'exemplaire ET la sorte compilent, la forme `
          + `nue reste vivante, une parenthèse ouverte se referme en nommant ce qui manque. `
          + `${passe} vérification(s) passée(s).`);
