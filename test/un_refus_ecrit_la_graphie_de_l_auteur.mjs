#!/usr/bin/env node
/**
 * GARDE — UN REFUS ÉCRIT LA GRAPHIE QUE L'AUTEUR A ÉCRITE.
 *
 * ⛔ LE TROISIÈME DOMICILE. Une règle du langage habite TROIS endroits : la spécification, le REFUS
 * qui l'applique, et le garde qui le tient. La réparation du nom pointé du 2026-08-24 — `.` appelle
 * un composant, `:` affecte une valeur — a touché le lecteur et le garde. **Le refus est resté sur
 * l'ancien modèle** :
 *
 *     scène écrite    S -> C4(sound.bell_short)
 *     refus rendu     « attribut '(sound.bell_short:…)' inconnu »
 *                                            ▲  un DEUX-POINTS là où l'auteur a mis un POINT
 *
 * ⇒ **Celui qui lit un message de refus apprend la règle par lui**, et celui-ci enseignait la règle
 * d'or à l'envers : il invitait à poser une valeur là où la forme n'en admet aucune. Relevé le même
 * soir par BPx, par Kairos et par l'architecte, chacun de son côté — et Kairos avait payé la même
 * classe une heure plus tôt dans son propre rendu de trace.
 *
 * ⚠️ CE QUE CE GARDE MESURE, ET QUI N'EST PAS CE QUE MESURE `un_refus_de_prefixe_accuse_le_nom_fautif`.
 * Celui-là vérifie QUEL NOM est accusé — la chose qui envoie l'auteur au bon endroit. Celui-ci
 * vérifie que la GRAPHIE CITÉE est celle qui a été écrite. Un refus peut nommer le bon nom et
 * l'écrire dans une forme que le langage ne porte plus.
 *
 * ⛔ LA MATRICE COUVRE L'ESPACE DES FORMES QUE LE PARSEUR PRODUIT DANS UN SAC, pas la seule qui a
 * mordu — chacune avec un nom que rien ne déclare, pour que le refus tombe :
 *
 *     nom NU                a               →  `(a)`        aucune valeur écrite
 *     nom POINTÉ nu         a.b             →  `(a.b)`      une référence, aucune valeur
 *     affectation           a:1             →  `(a:…)`      une valeur écrite
 *     affectation pointée   a.b:1           →  `(a.b:…)`    un composant ET une valeur
 *
 * ⇒ **La règle tenue est unique** : le message ne porte un deux-points QUE si l'auteur en a écrit un.
 *
 * ⚠️ ET LE PARSEUR SAIT DÉJÀ LES DISTINGUER, mesuré avant d'écrire ce garde — il n'y avait rien à
 * inventer, seulement à lire ce qu'il rend :
 *     C4(zzznu)        →  { key:'zzznu', value: true }      le booléen : écrit NU
 *     C4(zzznu:true)   →  { key:'zzznu', value: "true" }    la chaîne : une valeur ÉCRITE
 *     C4(a.b)          →  { key:'a.b', value:true, reference:true }
 * La distinction est donc `value === true` au sens strict, jamais une heuristique sur le nom.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const SOCLE = 'core\nalphabet.western:midi\n';
/** Le premier message de refus d'une écriture entre parenthèses, ou null si ça compile. */
const refus = (ecrit) => {
  let r;
  try { r = compileToBPxAST(`${SOCLE}-----\nS -> C4(${ecrit})\n`); }
  catch (x) { return `EXCEPTION ${x.message}`; }
  const m = (r.errors || [])[0];
  return m ? String(m.message || m) : null;
};

// ── LA MATRICE — quatre formes, chacune avec sa graphie attendue ─────────────────────────────
// Les noms sont fabriqués pour n'être déclarés par rien : c'est ce qui fait tomber le refus.
const CAS = [
  ['nom NU',              'zzznu',            'un nom seul, aucune valeur',            false],
  ['nom POINTÉ nu',       'zzztete.zzzfeuille', 'une référence pointée, aucune valeur', false],
  ['affectation',         'zzzaffecte:1',     "une valeur écrite après ':'",            true],
  ['affectation pointée', 'zzztete.zzzf:1',   "un composant ET une valeur",             true],
];

let examines = 0;
for (const [quoi, ecrit, dit, porteDeuxPoints] of CAS) {
  const m = refus(ecrit);
  ok(m !== null, `${quoi} — « ${ecrit} » doit être REFUSÉ : rien ne déclare ce nom. Sinon ce cas ne `
    + `mesure aucun message.`);
  if (m === null) continue;
  examines++;
  // La clé telle que l'auteur l'a écrite, sans la valeur.
  const cle = ecrit.split(':')[0];
  ok(m.includes(cle),
    `${quoi} — le refus doit CITER la graphie écrite « ${cle} » (${dit}) — reçu : ${m.slice(0, 150)}`);
  if (porteDeuxPoints) {
    ok(new RegExp(`${cle.replace('.', '\\.')}\\s*:`).test(m),
      `${quoi} — l'auteur a écrit un deux-points, le refus doit le rendre — reçu : ${m.slice(0, 150)}`);
  } else {
    // ⛔ LE VOLET QUI A MORDU. Une graphie sans deux-points ne doit pas s'en voir ajouter un.
    ok(!new RegExp(`${cle.replace('.', '\\.')}\\s*:`).test(m),
      `⛔ ${quoi} — l'auteur a écrit « ${cle} » SANS deux-points, et le refus en ajoute un. Il `
      + `enseigne la règle d'or à l'envers : '.' appelle un composant, ':' affecte une valeur. `
      + `Reçu : ${m.slice(0, 150)}`);
  }
}

ok(examines === CAS.length,
  `⛔ ${examines} forme(s) examinée(s) sur ${CAS.length} — une matrice dont une classe ne tombe pas `
  + `ne mesure pas cette classe, et son total non nul le cache.`);

// ── LE COMPLÉMENT — les formes JUSTES compilent ──────────────────────────────────────────────
// Sans lui, un compilateur qui refuserait TOUT passerait la matrice entière.
for (const [quoi, ecrit] of [
  ['une affectation ordinaire', 'vel:120'],
  ['un nom pointé RÉEL',        'midi.volume:80'],
]) {
  ok(refus(ecrit) === null, `COMPLÉMENT — ${quoi} « ${ecrit} » doit COMPILER — reçu : ${refus(ecrit)}`);
}

// ── ⛔ ET LE REFUS D'UNE TABLE D'ENTRÉE NE CITE PLUS UNE LIBRAIRIE SUPPRIMÉE ──────────────────
// `lib/mapping.json` est retiré le 2026-08-24 (décision de Romain : une place qui ne porte aucune
// donnée n'a pas de fichier). Le refus disait « la table n'existe pas dans la librairie 'mapping' » —
// il enseignait qu'il suffirait de l'y ajouter, en nommant un fichier qui n'existe plus.
{
  let m = null;
  try {
    const r = compileToBPxAST('core\nin.midi pedale mapping.fcb_std\nmode:ord\n-----\nS -> C4\n');
    m = ((r.errors || [])[0] || {}).message || null;
  } catch (x) { m = `EXCEPTION ${x.message}`; }
  ok(m !== null, "TABLE — une table invoquée doit CRIER : aucune n'existe.");
  ok(m === null || m.includes('fcb_std'), `TABLE — le refus doit nommer la table demandée — reçu : ${m}`);
  ok(m === null || !/librairie 'mapping'/.test(m),
    `⛔ TABLE — le refus cite « la librairie 'mapping' », qui n'existe plus. Il envoie l'auteur y `
    + `ajouter une table dans un fichier supprimé. Reçu : ${m}`);
}

// ── ⛔ ET UN REFUS N'ACCUSE PAS « PAS INVOQUÉE » UNE LIBRAIRIE QUI L'EST ─────────────────────
// Troisième message de la même cause : le refus décrit un état qui n'est plus celui de la chaîne.
// `digital` déclare le mot `function` et ne porte AUCUN contrôle — elle n'entre donc pas dans la
// table des contrôles qualifiés, dont le parseur dérivait ses préfixes connus. Une scène qui
// l'invoque en tête s'entendait répondre qu'elle ne l'était pas.
{
  // `digital` est sortie le 2026-09-03 (une manipulation est un contrôle, son corps se rattache à
  // lui) ; `settings` porte la même forme : une librairie invoquée qui ne déclare aucun contrôle.
  const SOCLE2 = 'core\nalphabet.western:midi\nsettings\n';
  const refusSac = (ecrit) => {
    try {
      const r = compileToBPxAST(`${SOCLE2}-----\nS -> C4 !(${ecrit})\n`);
      const m = (r.errors || [])[0];
      return m ? String(m.message || m) : null;
    } catch (x) { return `EXCEPTION ${x.message}`; }
  };
  // Le mot DÉCLARÉ d'une librairie invoquée sans contrôle.
  const m = refusSac('settings.transpose:2');
  ok(m !== null, "INVOQUÉE — « settings.transpose:2 » doit être REFUSÉ : cette librairie ne porte "
    + 'aucun contrôle. Si elle passe, ce volet ne mesure plus aucun message.');
  ok(m === null || !/neither an invoked library/.test(m),
    `⛔ INVOQUÉE — le refus dit que « settings » n'est PAS une librairie invoquée, alors qu'elle est `
    + `écrite en tête de la scène. Il accuse le mauvais fait, et celui qui lit un refus apprend la `
    + `règle par lui. Reçu : ${m}`);
  // ⚠️ LE TÉMOIN QUI DISCRIMINE : un préfixe que RIEN n'invoque doit garder l'ancien diagnostic,
  // sinon la réparation aurait simplement supprimé un message juste.
  const inconnu = refusSac('zzzjamais.transpose:2');
  ok(inconnu !== null && /neither an invoked library/.test(inconnu),
    `INVOQUÉE-témoin — un préfixe que rien n'invoque doit GARDER ce diagnostic : il est vrai pour `
    + `lui. Sans ce témoin, retirer le message partout passerait le volet précédent. Reçu : ${inconnu}`);
}

if (e.length) {
  console.error(`[refus · graphie] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[refus · graphie] ${p} PASS / 0 FAIL — ${examines} forme(s) de sac traversée(s), `
  + `le complément et le refus de table compris`);
