#!/usr/bin/env node
/**
 * UNE CLÉ DE MEMBRE PEUT ÊTRE UN TEXTE ENTRE GUILLEMETS.
 *
 * ARBITRAGE DE ROMAIN, 2026-08-23 : *« la forme propre est `alphabets.western.alterations =
 * {"bb":-2, "b":-1, "":0, "#":1, "##":2}` et il faut qu'elle passe »*. Une clé s'écrit NUE quand
 * c'est un identifiant, entre GUILLEMETS sinon, et les deux graphies désignent le même fait :
 * `x:1` vaut `"x":1`.
 *
 * ⛔ CETTE DÉCISION ANNULE CELLE DU MATIN, ET C'EST UNE MESURE QUI L'A TRANCHÉE. La forme ratifiée
 * à 11h17 modélisait chaque altération en exemplaire nommé — `alteration(signe:"#", demi_tons:1)`.
 * Elle COMPILAIT. Mais les trois paires portaient la MÊME clé `alteration`, et `sacEnObjet` écrase :
 * trois écrites, UNE rendue, sans un mot. La sur-modélisation fabriquait la perte qu'elle voulait
 * éviter — mesuré avant de frapper, sur la question qu'un voisin avait posée à temps.
 *
 * ⚠️ DEUX SITES DÉCIDENT DE CE QU'EST UNE CLÉ, et n'en corriger qu'un DÉPLACE le refus au lieu de le
 * lever : la branche des membres NUS happait le texte, puis la lecture ordinaire exigeait un IDENT.
 * Après le premier correctif le refus passait de « un membre est un nom » à « Expected IDENT, got
 * STRING ». C'est la même moitié manquante que le doublon d'acteur ce matin, au même endroit de la
 * journée.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const lire = (ligne) => {
  try {
    const r = compileToBPxAST(`core\nalphabet.western\n${ligne}\n-----\nS -> C4\n`, {});
    const errs = (r.errors || []).map((x) => x.message || String(x));
    return { ok: !errs.length, err: errs[0] || '', pairs: (r.ast?.defs || [])[0]?.settings?.pairs || [] };
  } catch (e) { return { ok: false, err: 'JET ' + e.message, pairs: [] }; }
};
/** ce que le bundle rendrait — la MÊME fonction que `libs-bundle.js`, à l'identique. */
const sacEnObjet = (sac) => {
  const out = {};
  for (const p of sac.pairs || []) out[p.key] = (p.value && p.value.type === 'SettingBag') ? sacEnObjet(p.value) : p.value;
  return out;
};

// ── A. LES QUATRE FAMILLES DE CLÉS QUE LE LANGAGE NE SAVAIT PAS ÉCRIRE ───────────────────────
// Elles viennent du périmètre mesuré de la décision : onze clés, quatre catalogues.
{
  const CAS = [
    ['un SIGNE',            'def a ("#":1)',                    'alphabets · homomorphism'],
    ['un signe VIDE',       'def a ("":0)',                     'la clé qui est la cause même'],
    ['un NOM CHIFFRÉ',      'def a ("12TET":1)',                'temperaments'],
    ['un NOM POINTÉ',       'def a ("trial.mohanam":1)',        'homomorphism'],
    ['un NOM À ESPACE',     'def a ("fatbass for:sub37":1)',    'voices'],
  ];
  for (const [quoi, ligne, ou] of CAS) {
    const r = lire(ligne);
    ok(r.ok, `A. ${quoi} en clé doit COMPILER (${ou}) — reçu : ${r.err.slice(0, 80)}`);
  }
}

// ── B. ⛔ LA FORME QUE ROMAIN DEMANDE, ET CE QUE LE BUNDLE EN RENDRAIT ────────────────────────
// ⛔ COMPILER NE SUFFIT PAS — c'est exactement le piège de la forme annulée. Elle compilait, et le
// bundle n'en publiait qu'une sur trois. Ce volet mesure ce qui SORT, pas ce qui entre.
{
  const r = lire('def w (alterations("bb":-2, "b":-1, "":0, "#":1, "##":2))');
  ok(r.ok, `B. la forme cible doit COMPILER — reçu : ${r.err.slice(0, 90)}`);
  if (r.ok) {
    const alt = r.pairs.find((p) => p.key === 'alterations');
    ok((alt?.value?.pairs || []).length === 5,
       `B. CINQ paires doivent être écrites — ${(alt?.value?.pairs || []).length}. La forme annulée en `
     + `écrivait trois et en rendait une.`);
    const rendu = JSON.stringify(sacEnObjet(alt.value));
    ok(rendu === '{"bb":-2,"b":-1,"":0,"#":1,"##":2}',
       `B. ⛔ ce que le BUNDLE rendrait doit être exactement la forme demandée — reçu ${rendu}. `
     + `C'est ici que la forme du matin tombait : cinq écrites, une rendue, sans un mot.`);
  }
}

// ── C. LES BORNES — ce que cette ouverture ne doit PAS avoir changé ──────────────────────────
{
  const BORNES = [
    ['une clé NUE reste une clé',        'def a (x:1)'],
    ['une VALEUR entre guillemets',      'def a (signe:"#")'],
    ['un membre NU en texte',            'def a ("abc")'],
    ['une clé nue et une clé textuelle', 'def a (x:1, "#":2)'],
  ];
  for (const [quoi, ligne] of BORNES) {
    const r = lire(ligne);
    ok(r.ok, `C-borne. ${quoi} doit rester vivant — reçu : ${r.err.slice(0, 80)}`);
  }
  // ⛔ LE TÉMOIN QUI DISCRIMINE : un membre nu en texte NE devient PAS une clé. Sans lui, « les
  // textes passent » se confondrait avec « le lecteur a cessé de distinguer ».
  const nu = lire('def a ("abc")');
  const p = nu.pairs.find((x) => x.key === 'abc');
  ok(p && p.value === true,
     `C-témoin. un texte SANS deux-points reste un MEMBRE NU (value:true) — reçu ${JSON.stringify(p)}. `
   + `Le discriminant est ce qui SUIT le texte, jamais le texte lui-même.`);
}

if (echecs.length) {
  console.error(`❌ une clé de membre peut être un texte : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ une clé de membre peut être un texte entre guillemets — les quatre familles que le `
  + `langage ne savait pas écrire compilent, la forme que Romain demande sort du bundle À L'IDENTIQUE `
  + `(cinq altérations, aucune écrasée), et ni la clé nue, ni la valeur textuelle, ni le membre nu `
  + `n'ont changé de nature. ${passe} vérification(s) passée(s).`);
