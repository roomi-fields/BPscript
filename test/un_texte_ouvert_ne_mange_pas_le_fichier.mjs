#!/usr/bin/env node
/**
 * UN TEXTE OUVERT ET JAMAIS FERMÉ EST REFUSÉ — SINON IL AVALE LE RESTE DU FICHIER.
 *
 * ⛔ CE QUI SE PASSAIT, MESURÉ SUR L'ARBRE LE 2026-08-24 :
 *
 *     def x a:1 "b
 *     -----
 *     S -> C4
 *
 *     ⇒ COMPILE, zéro erreur, et la scène rend ZÉRO RÈGLE au lieu d'une.
 *     ⇒ a = ["1", "b\n\n-----\nS -> C4\n"]  — le séparateur et la grammaire dans une valeur.
 *
 * Le tokenizer sortait de sa boucle en SILENCE quand le texte n'était pas fermé. C'est ma propre
 * frappe du guillemet doublé qui a laissé cette sortie muette.
 *
 * ⚠️ TROUVÉ PAR BP3-FRONTEND, en balayant les 32 signes ASCII non alphanumériques là où ma liste en
 * nommait quinze. Six des sept trouvailles étaient légitimes ; la septième était ce défaut. Une
 * liste re-vérifie ce qu'on lui a donné, un motif rend du bruit AVEC la réponse — et c'est le prix
 * pour voir ce qu'on n'a pas nommé.
 *
 * ⚠️ ET LE REFUS SE POSE À LA FIN DU FICHIER, PAS À LA FIN DE LIGNE : un texte sur plusieurs lignes
 * est légitime et vit dans la donnée. La fin de ligne refuserait une forme vivante.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { tokenize } from '../src/transpiler/tokenizer.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const lire = (corps) => {
  const r = compileToBPxAST(`core\n${corps}\n\n-----\nS -> C4\n`, {});
  return { ok: !(r.errors || []).length, err: String((r.errors || [])[0]?.message || ''),
           regles: (r.ast?.subgrammars?.[0]?.rules || []).length };
};

// ── A. LE DÉFAUT — un texte ouvert doit être REFUSÉ, dans chaque position du corps nu ────────
{
  for (const [quoi, corps] of [
    ['seconde partie d\'une valeur', 'def x a:1 "b'],
    ['valeur entière',              'def x a:"b'],
    ['clé de terminal',             'def x "b'],
  ]) {
    const r = lire(corps);
    ok(!r.ok, `A. ${quoi} — « ${corps} » doit être REFUSÉ. Reçu : compile avec ${r.regles} règle(s) `
            + `au lieu d'une — le séparateur et la grammaire sont partis dans la valeur.`);
  }
  // ⛔ ET LE REFUS DOIT NOMMER LE GUILLEMET OUVRANT, pas la fin du fichier : c'est là que l'auteur
  // doit regarder. Un refus qui accuse l'endroit où l'on s'arrête envoie chercher au mauvais bout.
  const r = lire('def x a:1 "b');
  ok(/ouvert à la ligne 2/.test(r.err),
     `A. le refus doit nommer la LIGNE DU GUILLEMET OUVRANT — reçu : ${r.err.slice(0, 90)}`);
}

// ── B. ⛔ LE TÉMOIN QUI DISCRIMINE — la même scène FERMÉE rend sa règle ──────────────────────
// Sans lui, « la scène est refusée » ne se distingue pas de « le lecteur de texte est mort ».
{
  const r = lire('def x a:1 "b"');
  ok(r.ok && r.regles === 1,
     `B-témoin. la même scène avec le texte FERMÉ doit compiler et rendre UNE règle — `
   + `reçu ok=${r.ok} règles=${r.regles}. C'est ce chiffre qui prouve que le défaut mangeait la `
   + `grammaire, et pas seulement qu'une forme était acceptée.`);
}

// ── C. LES BORNES — ce que ce refus ne doit PAS avoir emporté ────────────────────────────────
{
  // ⛔ UN TEXTE SUR PLUSIEURS LIGNES EST LÉGITIME. Poser le refus à la fin de LIGNE le tuerait.
  const multi = compileToBPxAST('core\ndef w (d:"une\nphrase sur deux lignes")\n\n-----\nS -> C4\n', {});
  ok(!(multi.errors || []).length,
     `C. un texte sur DEUX LIGNES doit rester vivant — c'est pourquoi le refus se pose à la fin du `
   + `FICHIER : ${String((multi.errors || [])[0]?.message || '').slice(0, 70)}`);

  // ⛔ ET LE GUILLEMET DANS UN NOM N'OUVRE AUCUN TEXTE — le signe second des grammaires de Bernard.
  // `not-reich.bps` en porte CINQ, donc un compte IMPAIR, et ne produit AUCUN jeton texte. Trois
  // dépôts l'ont signalé comme un candidat ; c'est un faux positif de la PARITÉ, pas une forme
  // menacée. L'EBNF le porte depuis avant ce chantier : « l'apostrophe et le guillemet
  // appartiennent au nom, à la suite d'une lettre ».
  const nom = compileToBPxAST('core\n\n-----\nB_r\' -> B_r" B_r" C4\nB_r" -> {C4, - F5}\nS -> B_r\'\n', {});
  ok(!(nom.errors || []).length && (nom.ast?.subgrammars?.[0]?.rules || []).length === 3,
     `C. le signe SECOND dans un nom ne doit ouvrir aucun texte — reçu `
   + `${String((nom.errors || [])[0]?.message || 'ok')} · `
   + `${(nom.ast?.subgrammars?.[0]?.rules || []).length} règle(s) au lieu de 3.`);
  ok(tokenize('B_r" -> C4').filter((t) => t.type === 'STRING').length === 0,
     `C. le tokenizer ne doit produire AUCUN jeton texte sur un nom à signe second.`);

  // Le double prime accolé, cas limite que la question de Kanopi supposait.
  const dbl = compileToBPxAST('core\n\n-----\nX"" -> C4\nS -> X""\n', {});
  ok(!(dbl.errors || []).length, `C. un DOUBLE prime accolé dans un nom doit rester vivant.`);

  // La chaîne VIDE se ferme sur un guillemet suivi d'autre chose — huit emplois dans la donnée.
  const vide = compileToBPxAST('core\ndef w (separator:"")\n\n-----\nS -> C4\n', {});
  ok(!(vide.errors || []).length, `C. la chaîne VIDE doit rester vivante — huit emplois dans lib/.`);
}

ok(passe > 0, `D. ZÉRO vérification exécutée — ce garde n'a rien examiné.`);

if (echecs.length) {
  console.error(`❌ un texte ouvert mange le fichier : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ un texte ouvert et jamais fermé est refusé en nommant son guillemet — la même scène `
  + `fermée rend sa règle, le texte sur plusieurs lignes vit, et le signe second d'un nom n'ouvre `
  + `aucun texte. ${passe} vérification(s) passée(s).`);
