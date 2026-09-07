#!/usr/bin/env node
/**
 * GARDE — L'INVENTAIRE DES PLACES DU LANGAGE, ET CE QUE CHACUNE REFUSE.
 *
 * Un refus se pose à l'USAGE et il est POSITIONNEL — décision de Romain, 2026-08-23. Ce garde tient
 * l'inventaire : pour chaque place, une graphie SAINE qui doit passer et une graphie qui écrit un
 * nom que rien ne déclare. L'écart entre les deux est ce que la place refuse.
 *
 * ⛔ CE QU'IL CORRIGE, ET LE COMPTE ÉTAIT FAUX POUR ÇA. L'inventaire du 2026-08-24 annonçait « 14
 * places sur 19 n'exigent rien », puis 7 après la pose de l'étage de résolution. Les deux comptes
 * mélangeaient deux natures que rien ne séparait :
 *
 *     DÉCLARATION    un nom neuf y est LÉGITIME — c'est ainsi qu'une chose vient au monde
 *     USAGE          un nom neuf y est une FAUTE — la chose devait exister avant
 *
 * ⇒ **« L'incomplétude se refuse à l'USAGE, jamais à la déclaration. »** Une place de déclaration
 *   qui accepte un nom inconnu n'est pas un trou : c'est la règle prototypale qui fonctionne. La
 *   compter comme une place ouverte fabrique une dette qui n'existe pas — et, pire, elle motivait
 *   une question de forme posée à Romain sur un chiffre faux.
 *
 * ⚠️ QUATRE PLACES ÉTAIENT COMPTÉES OUVERTES À TORT, et chacune pour une raison mesurée :
 *
 *     objet imbriqué, clé      `def w(a(zzz:1))`   DÉCLARE le membre `zzz` ; à l'USAGE,
 *     objet imbriqué, valeur                       `C4(w.a.zzz:1)` est DÉJÀ refusé
 *     contexte de règle        `zzz S -> C4`       le côté GAUCHE de la flèche : un non-terminal
 *     contexte négatif         `#zzz M -> C4`      y NAÎT de son apparition, il ne se déclare jamais
 *
 * ⛔ DEUX PLACES ONT QUITTÉ CET INVENTAIRE LE 2026-09-07, avec leur forme : le sujet et la cible
 * d'une affectation de son. Romain : « la forme sort du langage ». Une place n'existe que tant
 * qu'une graphie l'ouvre — ce qui ne s'écrit plus n'a plus de place à garder.
 *
 * ⛔ ET C'EST POURQUOI CE GARDE POSE LES DEUX CÔTÉS DE LA FLÈCHE. Le juge des terminaux ne porte
 * que sur le côté DROIT, et c'est juste — mais rien ne le disait, et l'instrument qui mesurait
 * lisait l'acceptation à gauche comme un trou. La portée ET son complément, écrits tous les deux.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const S = 'core\nalphabet.western\n';
/** Le code du premier refus, ou `null` si la source est acceptée. */
const refus = (src) => {
  try {
    const r = compileToBPxAST(src);
    const x = (r.errors || [])[0];
    return x ? (x.code || String(x.message || x)) : null;
  } catch (err) { return `LEVE:${err.code || err.message.slice(0, 40)}`; }
};

/**
 * LES PLACES — [nom, nature, graphie SAINE, graphie au nom inconnu].
 *
 * `nature` vaut `usage` (la place doit REFUSER un nom que rien ne déclare) ou `declaration` (elle
 * doit l'ACCEPTER : le nom vient d'y naître). Les deux colonnes sont éprouvées, jamais une seule :
 * une place qui refuserait TOUT passerait la colonne du refus sans rien prouver.
 */
const PLACES = [
  // ── USAGE — la chose doit exister avant qu'on l'écrive ──────────────────────────────────────
  ['terme du flux, à DROITE', 'usage', `${S}-----\nS -> C4\n`, `${S}-----\nS -> zzz\n`],
  ['clé d un sac', 'usage', `${S}-----\nS -> C4(vel:64)\n`, `${S}-----\nS -> C4(zzz:64)\n`],
  ['point d attente', 'usage', `${S}in.midi touches\n-----\nS -> <!touches.Space C4\n`, `${S}-----\nS -> <!zzz.Space C4\n`],
  ['garde de règle', 'usage', `${S}flag f:1\n-----\n[f==1] S -> C4\n`, `${S}-----\n[zzz==1] S -> C4\n`],
  ['mutation de drapeau', 'usage', `${S}flag f:1\n-----\nS -> C4 [f=2]\n`, `${S}-----\nS -> C4 [zzz=2]\n`],
  ['rejeu de gabarit &', 'usage', `${S}-----\nS -> $m C4 &m\n`, `${S}-----\nS -> C4 &zzz\n`],
  ['valeur de départ d un drapeau', 'usage', `${S}flag f:1\n-----\nS -> C4\n`, `${S}flag f:zzz\n-----\nS -> C4\n`],
  ['corps d un def, terme', 'usage', `${S}def m C4 D4\n-----\nS -> m\n`, `${S}def m zzz D4\n-----\nS -> m\n`],
  ['axe d invocation', 'usage', `${S}-----\nS -> C4\n`, `${S}zzz.western\n-----\nS -> C4\n`],
  ['entrée d invocation', 'usage', `${S}-----\nS -> C4\n`, `${S}alphabet.zzz\n-----\nS -> C4\n`],
  ['tag de backtick', 'usage', `${S}-----\nS -> \`js: 1+1\`\n`, `${S}-----\nS -> \`zzz: 1+1\`\n`],
  ['sortie d acteur', 'usage', `${S}actor a(out.midi)\n-----\nS -> C4\n`, `${S}actor a(out.zzz)\n-----\nS -> C4\n`],
  ['membre imbriqué, à l USAGE', 'usage', `${S}def w(a(b:1))\n-----\nS -> C4\n`, `${S}def w(a(b:1))\n-----\nS -> C4(w.a.zzz:1)\n`],

  // ── LE PLANCHER EST LEVÉ — les deux familles que l inventaire déclarait NON COUVERTES ───────
  // « Le compte est un plancher sur deux familles : les positions propres à une sous-grammaire, et
  // le contenu d un `init`. » Elles sont construites ici, et elles n ajoutent AUCUNE place propre :
  // une sous-grammaire rejoue les mêmes places avec les mêmes verdicts — c est la même règle à une
  // autre profondeur, pas un second mécanisme — et `init` n a qu une place, le TAG de son backtick.
  ['sous-grammaire · terme, à DROITE', 'usage', `${S}-----\nS -> C4\n-----\nC4 -> D4\n`, `${S}-----\nS -> C4\n-----\nC4 -> zzz\n`],
  ['sous-grammaire · clé d un sac', 'usage', `${S}-----\nS -> C4\n-----\nC4 -> D4(vel:64)\n`, `${S}-----\nS -> C4\n-----\nC4 -> D4(zzz:1)\n`],
  ['sous-grammaire · garde de règle', 'usage', `${S}flag f:1\n-----\nS -> C4\n-----\n[f==1] C4 -> D4\n`, `${S}-----\nS -> C4\n-----\n[zzz==1] C4 -> D4\n`],
  // ⚠️ `init` PORTE DU CODE LANCÉ UNE FOIS, jamais un drapeau — un drapeau écrit son état de départ
  // là où il NAÎT (bible, § « l état de départ »). Mon premier témoin écrivait `init f=2` et se
  // faisait refuser : une place qu on n a pas su construire ne compte pas comme une absence.
  ['contenu d un init · tag', 'usage', `${S}init\n  \`js: 1+1\`\n-----\nS -> C4\n`, `${S}init\n  \`zzz: 1+1\`\n-----\nS -> C4\n`],

  // ── DÉCLARATION — le nom vient d y naître, l accepter EST la règle ──────────────────────────
  ['terme du flux, à GAUCHE', 'declaration', `${S}-----\nS -> C4\n`, `${S}-----\nzzz -> C4\n`],
  ['second terme, à GAUCHE', 'declaration', `${S}-----\nS -> C4\n`, `${S}-----\nS zzz -> C4\n`],
  ['contexte négatif, à GAUCHE', 'declaration', `${S}symbol K1\n-----\n#K1 M -> C4 D4\n`, `${S}-----\n#zzz M -> C4 D4\n`],
  ['membre imbriqué, clé', 'declaration', `${S}def w(a(b:1))\n-----\nS -> C4\n`, `${S}def w(a(zzz:1))\n-----\nS -> C4\n`],
  ['membre imbriqué, valeur', 'declaration', `${S}def w(a(b:1))\n-----\nS -> C4\n`, `${S}def w(a(b:zzz))\n-----\nS -> C4\n`],
  ['sous-grammaire · terme, à GAUCHE', 'declaration', `${S}-----\nS -> C4\n-----\nC4 -> D4\n`, `${S}-----\nS -> C4\n-----\nzzz -> D4\n`],
];

// ── A. CHAQUE PLACE, LES DEUX COLONNES ───────────────────────────────────────────────────────
const ouvertes = [];
for (const [nom, nature, sain, inconnu] of PLACES) {
  const bon = refus(sain);
  ok(bon === null,
    `A. « ${nom} » : la graphie SAINE doit passer, sinon la colonne du refus ne prouve rien — `
    + `reçu ${bon}. Un témoin faux rend une place « fermée » qui refuse simplement tout.`);
  const mauvais = refus(inconnu);
  if (nature === 'usage') {
    ok(mauvais !== null,
      `A. « ${nom} » est une place d USAGE : un nom que rien ne déclare doit y être REFUSÉ.`);
    if (mauvais === null) ouvertes.push(nom);
  } else {
    ok(mauvais === null,
      `A. « ${nom} » est une place de DÉCLARATION : le nom vient d y naître, l accepter EST la `
      + `règle prototypale. Reçu ${mauvais} — un refus ici ferme une porte du langage.`);
  }
}

// ── B. LE SOCLE — un garde compte ce qu il a examiné et refuse zéro ──────────────────────────
const usages = PLACES.filter(([, n]) => n === 'usage').length;
const decls = PLACES.length - usages;
ok(usages >= 17, `B. SOCLE : ${usages} place(s) d USAGE éprouvée(s) — sous ce seuil l inventaire ne mesure plus.`);
ok(decls >= 6,
  `B. SOCLE : ${decls} place(s) de DÉCLARATION éprouvée(s). ⛔ SANS ELLES CE GARDE EST UNE LISTE `
  + `SUR UN SEUL AXE, et c est exactement ce qui a rendu le comptage faux : une place de `
  + `déclaration comptée comme un trou.`);

// ── D. LES PLACES ENCORE OUVERTES — inscrites, avec leur cause ───────────────────────────────
// ⛔ UN INVENTAIRE QUI NE PORTE QUE CE QUI PASSE CHOISIT CE QU ON NE VERRA PAS. Ces trois places
// acceptent aujourd hui un nom que rien ne déclare, et ce garde le DIT au lieu de les omettre.
// L assertion est inversée : le jour où l une se ferme, il rougit et demande qu on la remonte
// au tableau ci-dessus. Une dette qui pourrit dans un sens comme dans l autre est une dette
// qu on ne mesure plus.
let nbOuvertes = 0;
{
  const OUVERTES = [
    ['valeur d un sac', `${S}-----\nS -> C4(vel:zzz)\n`,
      "le juge de la valeur SORT EN SILENCE quand elle n est pas un nombre "
      + "(`controlValidation.js`), et la plage est rattachée au CONTRÔLE au lieu de son ARGUMENT — "
      + "arbitrage de Romain rendu le 2026-09-06, pas encore posé (BACKLOG BPS-116). Trois formes "
      + "du corpus en vivent : keymap:C3, ins:Vina, pan:sweep."],
    // ⛔ TROUVÉE PAR LE RETRAIT, PAS PAR L INVENTAIRE. Une clé quelconque dans un corps d acteur
    // pose une PROPRIÉTÉ du même nom, en silence : `Sa:drum_kick` rend `properties.Sa`. Les clés
    // d un acteur sont pourtant DÉCLARÉES — les membres typés du prototype `actor` de `types` —
    // et ce qui n en est pas une devrait se refuser. La place n était dans aucun des deux comptes.
    ['clé d un corps d acteur', `${S}actor a\n  zzz:quelconque\n-----\nS -> C4\n`,
      "une clé hors des membres déclarés du prototype `actor` devient une propriété silencieuse. "
      + "Découverte le 2026-09-07 en sortant l affectation de son : la forme nue v0.7 `Sa:X` ne "
      + "disparaissait pas avec elle, parce qu une AUTRE place la recueillait."],
  ];
  for (const [nom, src, cause] of OUVERTES) {
    ok(refus(src) === null,
      `D. « ${nom} » est inscrite OUVERTE et elle REFUSE désormais — c est une bonne nouvelle : `
      + `remonte-la au tableau des places d USAGE et retire-la d ici. Cause inscrite : ${cause}`);
  }
  // ⚠️ DEUX, ET LE COMPTE A BOUGÉ DANS LES DEUX SENS le 2026-09-07 : les deux places d une
  // affectation de son sont sorties avec leur forme, et la clé d un corps d acteur est ENTRÉE —
  // découverte par ce retrait même. Un compte qui ne peut que descendre suppose qu on connaît
  // déjà toutes les places ; celui-ci les cherche encore.
  nbOuvertes = OUVERTES.length;
  ok(OUVERTES.length === 2,
    `D. SOCLE : ${OUVERTES.length} place(s) ouverte(s) inscrite(s).`);
}

// ── C. LE TÉMOIN QUI MORD — l instrument voit-il une place ouverte quand il y en a une ? ──────
// ⛔ Sans lui, un `refus()` cassé rendrait « tout fermé » exactement comme un langage sain.
{
  ok(refus(`${S}-----\nS -> zzz\n`) !== null, 'C. (mord) un terme inconnu à DROITE est vu comme refusé');
  ok(refus(`${S}-----\nzzz -> C4\n`) === null, 'C. (se tait) le même nom à GAUCHE est vu comme accepté');
  ok(refus(`${S}-----\nS -> C4\n`) === null, 'C. (se tait) la scène saine passe');
}

if (e.length) {
  console.error(`[places] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error(`  ✗ ${x}`);
  process.exit(1);
}
console.log(`[places] ${p} PASS / 0 FAIL — ${PLACES.length} place(s) : ${usages} d USAGE qui refusent `
  + `un nom inconnu, ${decls} de DÉCLARATION qui l accueillent, ${nbOuvertes} encore OUVERTE(S) et inscrite(s)`
  + (ouvertes.length ? ` · ⛔ OUVERTES : ${ouvertes.join(', ')}` : ''));
