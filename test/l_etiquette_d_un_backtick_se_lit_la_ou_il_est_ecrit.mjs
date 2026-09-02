#!/usr/bin/env node
/**
 * GARDE — L'ÉTIQUETTE D'UN BACKTICK SE LIT LÀ OÙ IL EST ÉCRIT, Y COMPRIS DANS UNE VALEUR.
 *
 * ⛔ ELLE NE L'ÉTAIT PAS DANS UNE VALEUR DÉCLARATIVE : `x:`sc: a+1`` rendait le texte « sc: a+1 »,
 * étiquette comprise. Le backtick n'y était donc lu comme du code à AUCUN degré — ni nu, ni
 * étiqueté — alors qu'il l'est partout ailleurs. Ce n'était pas un doublon du guillemet, c'était une
 * PROMESSE NON TENUE à cet endroit.
 *
 * ⚠️ ET LE TRAVAIL SE FAISAIT DÉJÀ, UN ÉTAGE PLUS BAS : le générateur de librairies retirait le
 * préfixe `txt:` lui-même. Un seul des lecteurs le faisait donc, et n'importe quel autre
 * consommateur de l'arbre recevait l'étiquette collée à la phrase.
 *
 * Mesure avant la bascule : 361 valeurs en backtick dans les neuf sources de librairie, TOUTES
 * étiquetées `txt` ; ZÉRO valeur déclarative en backtick dans les 69 scènes. La donnée publiée ne
 * bouge donc pas — et c'est ce que ce garde vérifie en plus de la forme.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = 'core\nalphabet.western\n';
const valeur = (ligne) => {
  const r = compileToBPxAST(`${TETE}${ligne}\n-----\nS -> C4\n`);
  return { erreurs: (r.errors || []).map((e) => String(e.message ?? e)),
           // ⛔ `def f (…)` — un nom et un sac — est un objet RACINE depuis le 2026-09-02, et il vit
           // dans `vars`, pas dans `defs` : `def` est le mot unique, `object` est sorti.
           v: (((r.ast?.vars || []).find((d) => d.varType?.kind === 'type' && d.varType.type === null)
               || (r.ast?.defs || [])[0])?.settings?.pairs || [])[0]?.value };
};

console.log('[étiquette] l\'étiquette d\'un backtick se lit là où il est écrit');

// ── A. ⛔ `txt:` N'EST PLUS UNE ÉTIQUETTE — il nomme un LANGAGE comme les autres ─────────────
//
// Décision Romain, 2026-08-21 : « on doit annuler la décision sur les backticks typés, elle est
// mauvaise. On est repartis sur les guillemets, c'est la dernière qui vaut. » Une phrase porte ses
// GUILLEMETS ; le backtick ne délimite plus que du CODE, et son étiquette nomme un interprète.
//
// ⚠️ ET LA GRAPHIE RETIRÉE N'AVAIT JAMAIS EU DE SOURCE. Je la citais comme « ratifiée le
// 2026-08-13 » — la seule trace était une phrase que j'avais écrite moi-même dans `libs-bundle.js`.
// Aucune des quatorze décisions de ce jour-là ne parle de prose, et les trois spécifications
// l'ignoraient. Elle avait pourtant 26 sites et quatre lecteurs : UNE INVENTION DEVIENT UN FAIT PAR
// SON USAGE, PAS PAR SA SOURCE.
//
// CE VOLET NE DISPARAÎT PAS, IL CHANGE DE SUJET : `txt` doit désormais se lire comme n'importe
// quelle autre étiquette. Le jour où un lecteur lui redonnerait un traitement à part, il rougit.
{
  const t = valeur('def f (x:`txt: une phrase, avec virgule`)');
  ok(t.erreurs.length === 0, `A. la forme doit compiler — ${t.erreurs[0]}`);
  ok(t.v?.type === 'BacktickInline' && t.v?.tag === 'txt',
    `A. ⛔ 'txt' n'a plus de traitement à part : il nomme un langage comme 'js' ou 'sc'. Reçu `
    + `${JSON.stringify(t.v)}`);
  ok(t.v?.code === 'une phrase, avec virgule',
    `A. et son contenu reste intact, virgule comprise — reçu ${JSON.stringify(t.v?.code)}`);
  ok(typeof t.v !== 'string',
    "A. ⛔ il ne doit PLUS rendre une chaîne nue : c'était le traitement à part, et c'est lui qui "
    + 'sort. Une phrase s\'écrit désormais entre guillemets.');
}

// ── B. TOUTE AUTRE ÉTIQUETTE NOMME UN LANGAGE — la valeur porte le CODE et son interprète ───
{
  const j = valeur('def f (x:`js: a+1`)');
  ok(j.erreurs.length === 0, `B. un backtick étiqueté doit compiler dans une valeur — ${j.erreurs[0]}`);
  ok(j.v?.type === 'BacktickInline' && j.v?.tag === 'js' && j.v?.code === 'a+1',
    `B. et porter son CODE et son ÉTIQUETTE, jamais un texte où les deux sont collés — reçu `
    + `${JSON.stringify(j.v)}`);
  const sc = valeur('def f (x:`sc: a+1`)');
  ok(sc.v?.tag === 'sc', `B. l'étiquette lue est celle qui est écrite — reçu ${JSON.stringify(sc.v)}`);
}

// ── C. TÉMOINS — les autres natures de valeur ne bougent pas ────────────────────────────────
// Sans eux, un lecteur qui happerait toute valeur passerait A et B en triomphe.
{
  ok(valeur('def f (x:"abc")').v === 'abc', 'C. TÉMOIN — un texte entre guillemets reste son texte');
  ok(valeur('def f (x:0)').v === 0, 'C. TÉMOIN — un nombre reste un nombre');
  ok(valeur('def f (x:abc)').v === 'abc', 'C. TÉMOIN — un nom reste son nom');
  ok(valeur('def f (x:"")').v === '', 'C. TÉMOIN — le texte vide reste une valeur');
}

// ── D. ⛔ ET AUCUNE VALEUR PUBLIÉE NE PORTE `txt:` — L'ANTI-RETOUR DE LA GRAPHIE ANNULÉE ─────
// Ce volet gardait la bascule d'un travail d'un étage à l'autre. Depuis le 2026-08-21 il garde
// plus que ça : la graphie `txt:` est SORTIE du langage, et 26 valeurs ont migré vers les
// guillemets. Une valeur publiée qui la porterait de nouveau dirait qu'un outil de conversion la
// réintroduit en silence — c'est la voie parallèle qu'on s'interdit, et c'est ici qu'elle rougit.
{
  let vues = 0;
  const fautives = [];
  const descendre = (o, chemin) => {
    if (typeof o === 'string') { vues++; if (/^txt:/.test(o)) fautives.push(chemin); return; }
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) descendre(v, `${chemin}.${k}`);
  };
  for (const nom of Object.keys(LIBS)) descendre(LIBS[nom], nom);
  ok(vues >= 5000, `D. le balayage doit voir la donnée entière — ${vues} chaîne(s)`);
  ok(fautives.length === 0,
    `D. aucune valeur publiée ne doit porter son étiquette — reçu : ${fautives.slice(0, 5).join(' · ')}`);
  // ⛔ TÉMOIN NON NUL : le balayage doit SAVOIR voir une étiquette collée.
  const faux = [];
  const chercher = (o) => { if (typeof o === 'string' && /^txt:/.test(o)) faux.push(o); };
  chercher('txt: une phrase');
  ok(faux.length === 1, 'D-témoin. le critère doit reconnaître une étiquette collée quand il en voit une');
}

ok(passe >= 12, `le garde doit avoir EXAMINÉ, pas seulement tourné (${passe} assertions)`);

if (echecs.length) {
  console.error(`[étiquette] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[étiquette] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
