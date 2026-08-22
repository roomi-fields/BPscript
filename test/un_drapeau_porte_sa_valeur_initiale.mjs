#!/usr/bin/env node
/**
 * UN DRAPEAU PORTE SA VALEUR INITIALE DANS SA DÉCLARATION — `flag steps:0`.
 *
 * DÉCISION DE ROMAIN, 2026-08-22 : « oui on fait `flag steps:0`, et le frontal BP3 s'arrange pour
 * initialiser explicitement ce qui est implicite en BP3 ».
 *
 * ⚠️ ELLE NE CHANGE AUCUN COMPORTEMENT, ELLE LE REND LISIBLE. Le natif ne plante ni n'invente :
 * `ResetFlags` — « Reset rule flags », valeur 1 par défaut — remet les drapeaux à zéro à chaque
 * production, donc un drapeau jamais affecté vaut `0`. C'est pourquoi les 26 scènes du corpus natif
 * marchent sans déclarer quoi que ce soit. Écrire la valeur dit ce que le moteur faisait en silence.
 *
 * ⛔ C'EST UN AJOUT, ET RIEN NE SORT — c'est le volet B, et il vaut autant que le reste. Les deux
 * formes qui existaient compilent comme avant. Le sort de la forme nue n'est pas tranché : un ajout
 * qui retirerait au passage ferait mourir une forme vivante sans décision.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compiler = (decl) => {
  try {
    const r = compileToBPxAST(`core\n${decl}\n-----\nS -> C4 D4\n`, {});
    const errs = (r.errors || []).map((e) => e.message || String(e));
    return { ok: !!r.ast && !errs.length, err: errs[0] || '', vt: r.ast?.vars?.[0]?.varType || null };
  } catch (e) { return { ok: false, err: e.message, vt: null }; }
};

// ── SOCLE ───────────────────────────────────────────────────────────────────────────────────
{
  const r = compileToBPxAST('core\n-----\nS -> C4 D4\n', {});
  ok(!!r.ast && !(r.errors || []).length, 'SOCLE : la scène nue doit compiler');
}

// ── A. LA VALEUR INITIALE ARRIVE DANS L'ARBRE ───────────────────────────────────────────────
for (const [decl, attendue] of [['flag steps:0', 0], ['flag steps:5', 5], ['flag steps:100', 100]]) {
  const r = compiler(decl);
  ok(r.ok, `A. '${decl}' doit compiler. Reçu : ${r.err}`);
  ok(r.vt?.initiale === attendue,
     `A. et sa valeur initiale voyage — ${attendue} attendu. Vue : ${JSON.stringify(r.vt)}`);
}

// ── B. ⛔ RIEN NE SORT — le témoin qui distingue AJOUTER de REMPLACER ───────────────────────
for (const [quoi, decl] of [
  ['la forme NUE',        'flag steps'],
  ['les états nommés',    'flag section(calm:1, full:2)'],
]) {
  const r = compiler(decl);
  ok(r.ok, `B. ${quoi} doit rester vivante — la valeur initiale s'AJOUTE. Reçu : ${r.err}`);
}

// ── C. ⛔ LE MÊME NŒUD, À LA VALEUR PRÈS ────────────────────────────────────────────────────
// C'est ce qui interdit la voie parallèle au lieu de la surveiller : si la forme à valeur rendait
// une autre structure, l'aval devrait lire les deux pour une seule notion.
{
  const nu = compiler('flag steps');
  const avec = compiler('flag steps:0');
  ok(nu.ok && avec.ok, 'C. SOCLE : les deux formes doivent compiler');
  ok(nu.vt?.kind === 'flag' && avec.vt?.kind === 'flag',
     `C. les deux rendent kind:'flag'. Vus : ${nu.vt?.kind} et ${avec.vt?.kind}`);
  ok(JSON.stringify(nu.vt?.states) === JSON.stringify(avec.vt?.states),
     `C. et leurs états sont IDENTIQUES — la valeur initiale n'en fabrique aucun. `
     + `Vus : ${JSON.stringify(nu.vt?.states)} vs ${JSON.stringify(avec.vt?.states)}`);
  const { initiale: _i, ...resteAvec } = avec.vt || {};
  ok(JSON.stringify(resteAvec) === JSON.stringify(nu.vt),
     `C. ⛔ À LA VALEUR PRÈS, LES DEUX NŒUDS SONT LE MÊME. C'est le geste qui interdit la voie `
     + `parallèle. Vus : ${JSON.stringify(resteAvec)} vs ${JSON.stringify(nu.vt)}`);
}

// ── D. LE TÉMOIN NON NUL — une valeur non entière est refusée EN NOMMANT ce qui est attendu ──
{
  const r = compiler('flag steps:zero');
  ok(!r.ok, 'D. une valeur NON ENTIÈRE doit être refusée');
  ok(/valeur initiale est un ENTIER/.test(r.err),
     `D. et le refus doit NOMMER ce qui est attendu, plus la forme des états nommés — sans ça `
     + `l'auteur ne sait pas laquelle des deux écritures il visait. Reçu : ${r.err}`);
}

// ── E. LE DRAPEAU S'EMPLOIE, ET LE CRI RESTE À L'USAGE ─────────────────────────────────────
// Déclarer sa valeur ne fabrique pas d'états : un état NOMMÉ reste refusé, comme sur la forme nue.
{
  const emploi = compileToBPxAST('core\nflag steps:0\n-----\nS -> C4\n[steps==100] S -> D4\n', {});
  ok(!!emploi.ast && !(emploi.errors || []).length,
     `E. un drapeau à valeur initiale se compare à un ENTIER. Reçu : `
     + `${(emploi.errors || []).map((e) => e.message)[0] || ''}`);
  const nomme = compileToBPxAST('core\nflag steps:0\n-----\nS -> C4\n[steps==a] S -> D4\n', {});
  ok((nomme.errors || []).length > 0,
     "E. et un état NOMMÉ reste refusé — la valeur initiale n'en déclare aucun");
}

const ATTENDU = 1 + 6 + 2 + 4 + 2 + 2;
ok(passe + echecs.length === ATTENDU,
   `bilan : ${ATTENDU} vérifications attendues, ${passe + echecs.length} exécutées`);

if (echecs.length) {
  console.error(`❌ un drapeau porte sa valeur initiale : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ un drapeau porte sa valeur initiale — elle voyage dans l'arbre, les deux formes qui `
          + `existaient restent vivantes, le nœud est le même à la valeur près, et une valeur non `
          + `entière est refusée en nommant les deux écritures. ${passe} vérification(s) passée(s).`);
