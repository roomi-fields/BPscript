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
 * LES PLACES — [nom, nature, graphie SAINE, graphie au nom inconnu, code du refus attendu].
 *
 * `nature` vaut `usage` (la place doit REFUSER un nom que rien ne déclare) ou `declaration` (elle
 * doit l'ACCEPTER : le nom vient d'y naître). Les deux colonnes sont éprouvées, jamais une seule :
 * une place qui refuserait TOUT passerait la colonne du refus sans rien prouver.
 *
 * ⛔ LE CODE ATTENDU EST LA COLONNE QUI MANQUAIT, ET SON ABSENCE COÛTAIT DEUX CHOSES. Ce garde
 * mesurait « y a-t-il un refus », jamais « LEQUEL » — donc une place qui refuse pour la MAUVAISE
 * RAISON y passait en vert, et l'inventaire ne disait nulle part ce qu'une place ATTEND. Mesuré le
 * 2026-09-07 : `C4:zzz.bell` rendait `PARSE_EXPECTED_GOT`, un refus de syntaxe là où l'auteur avait
 * écrit un nom d'axe inconnu.
 *
 * ⚠️ ET LE PRÉFIXE DIT L'ÉTAGE. `RESOLVE_` est rendu par l'étage qui résout les noms ; `PARSE_` par
 * l'étage qui lit la forme — vérifié dans le code, pas déduit du nom : les quatre `PARSE_` de cet
 * inventaire sont bel et bien levés dans `parser.js`. Or la décision du 2026-08-24 prescrit que le
 * parseur ne connaisse RIEN du vocabulaire et que les refus qui parlent d'un NOM vivent à l'étage
 * de résolution. Six places sur dix-sept y contreviennent, et le volet E ci-dessous les tient : leur
 * compte ne peut que DESCENDRE.
 */
const PLACES = [
  // ── USAGE — la chose doit exister avant qu'on l'écrive ──────────────────────────────────────
  ['terme du flux, à DROITE', 'usage', `${S}-----\nS -> C4\n`, `${S}-----\nS -> zzz\n`, 'RESOLVE_TERMINAL_UNDECLARED'],
  ['clé d un sac', 'usage', `${S}-----\nS -> C4(vel:64)\n`, `${S}-----\nS -> C4(zzz:64)\n`, 'RESOLVE_UNKNOWN_ATTRIBUTE'],
  ['point d attente', 'usage', `${S}in.midi touches\n-----\nS -> <!touches.Space C4\n`, `${S}-----\nS -> <!zzz.Space C4\n`, 'RESOLVE_WAIT_UNDECLARED'],
  ['garde de règle', 'usage', `${S}flag f:1\n-----\n[f==1] S -> C4\n`, `${S}-----\n[zzz==1] S -> C4\n`, 'PARSE_FLAG_USAGES_DESIGNATE_NOTHING'],
  ['mutation de drapeau', 'usage', `${S}flag f:1\n-----\nS -> C4 [f=2]\n`, `${S}-----\nS -> C4 [zzz=2]\n`, 'PARSE_FLAG_USAGES_DESIGNATE_NOTHING'],
  ['rejeu de gabarit &', 'usage', `${S}-----\nS -> $m C4 &m\n`, `${S}-----\nS -> C4 &zzz\n`, 'RESOLVE_REPLAY_WITHOUT_MASTER'],
  ['valeur de départ d un drapeau', 'usage', `${S}flag f:1\n-----\nS -> C4\n`, `${S}flag f:zzz\n-----\nS -> C4\n`, 'PARSE_FLAG_PREMIER_INITIAL_VALUE'],
  ['corps d un def, terme', 'usage', `${S}def m C4 D4\n-----\nS -> m\n`, `${S}def m zzz D4\n-----\nS -> m\n`, 'RESOLVE_TERMINAL_UNDECLARED'],
  ['axe d invocation', 'usage', `${S}-----\nS -> C4\n`, `${S}zzz.western\n-----\nS -> C4\n`, 'RESOLVE_AXIS_SERVED_BY_NONE'],
  ['entrée d invocation', 'usage', `${S}-----\nS -> C4\n`, `${S}alphabet.zzz\n-----\nS -> C4\n`, 'RESOLVE_FOUND_CATALOG_REFERENCE_DOES'],
  ['tag de backtick', 'usage', `${S}-----\nS -> \`js: 1+1\`\n`, `${S}-----\nS -> \`zzz: 1+1\`\n`, 'RESOLVE_NAMES_EVALUATOR_DECLARED_BACKTICK'],
  ['sortie d acteur', 'usage', `${S}actor a(out.midi)\n-----\nS -> C4\n`, `${S}actor a(out.zzz)\n-----\nS -> C4\n`, 'PARSE_ACTOR_ACTORNAME_OUTPUT_OUTPUT'],
  ['membre imbriqué, à l USAGE', 'usage', `${S}def w(a(b:1))\n-----\nS -> C4\n`, `${S}def w(a(b:1))\n-----\nS -> C4(w.a.zzz:1)\n`, 'PARSE_NAME_READABLE_NEITHER_SETTING'],

  // ── LE PLANCHER EST LEVÉ — les deux familles que l inventaire déclarait NON COUVERTES ───────
  // « Le compte est un plancher sur deux familles : les positions propres à une sous-grammaire, et
  // le contenu d un `init`. » Elles sont construites ici, et elles n ajoutent AUCUNE place propre :
  // une sous-grammaire rejoue les mêmes places avec les mêmes verdicts — c est la même règle à une
  // autre profondeur, pas un second mécanisme — et `init` n a qu une place, le TAG de son backtick.
  ['sous-grammaire · terme, à DROITE', 'usage', `${S}-----\nS -> C4\n-----\nC4 -> D4\n`, `${S}-----\nS -> C4\n-----\nC4 -> zzz\n`, 'RESOLVE_TERMINAL_UNDECLARED'],
  ['sous-grammaire · clé d un sac', 'usage', `${S}-----\nS -> C4\n-----\nC4 -> D4(vel:64)\n`, `${S}-----\nS -> C4\n-----\nC4 -> D4(zzz:1)\n`, 'RESOLVE_UNKNOWN_ATTRIBUTE'],
  ['sous-grammaire · garde de règle', 'usage', `${S}flag f:1\n-----\nS -> C4\n-----\n[f==1] C4 -> D4\n`, `${S}-----\nS -> C4\n-----\n[zzz==1] C4 -> D4\n`, 'PARSE_FLAG_USAGES_DESIGNATE_NOTHING'],
  // ⚠️ `init` PORTE DU CODE LANCÉ UNE FOIS, jamais un drapeau — un drapeau écrit son état de départ
  // là où il NAÎT (bible, § « l état de départ »). Mon premier témoin écrivait `init f=2` et se
  // faisait refuser : une place qu on n a pas su construire ne compte pas comme une absence.
  ['contenu d un init · tag', 'usage', `${S}init\n  \`js: 1+1\`\n-----\nS -> C4\n`, `${S}init\n  \`zzz: 1+1\`\n-----\nS -> C4\n`, 'RESOLVE_NAMES_EVALUATOR_DECLARED_BACKTICK'],

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
for (const [nom, nature, sain, inconnu, attendu] of PLACES) {
  const bon = refus(sain);
  ok(bon === null,
    `A. « ${nom} » : la graphie SAINE doit passer, sinon la colonne du refus ne prouve rien — `
    + `reçu ${bon}. Un témoin faux rend une place « fermée » qui refuse simplement tout.`);
  const mauvais = refus(inconnu);
  if (nature === 'usage') {
    ok(mauvais !== null,
      `A. « ${nom} » est une place d USAGE : un nom que rien ne déclare doit y être REFUSÉ.`);
    if (mauvais === null) ouvertes.push(nom);
    // ⛔ ET C'EST LE MÊME REFUS QU'HIER. Un refus qui change de code change ce que l'auteur lit :
    // la place cesse de dire ce qu'elle attendait, sans qu'aucun compte ne bouge.
    ok(mauvais === null || mauvais === attendu,
      `A. « ${nom} » doit rendre « ${attendu} » — reçu « ${mauvais} ». Le refus a changé de nature : `
      + `vérifier ce que l auteur lit désormais avant de fixer la nouvelle valeur.`);
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

// ── D. LES PLACES ENCORE OUVERTES — inscrites, avec leur cause MESURÉE ───────────────────────
// ⛔ UN INVENTAIRE QUI NE PORTE QUE CE QUI PASSE CHOISIT CE QU ON NE VERRA PAS. Ces deux places
// acceptent un nom que rien ne déclare, et ce garde le DIT. L assertion est inversée : le jour où
// l une se ferme, il rougit et demande qu on la remonte au tableau.
//
// ⚠️ ET LEUR CAUSE N EST PLUS UNE HYPOTHÈSE — j ai POSÉ les deux refus le 2026-09-07, et les DEUX
// étaient faux. Huit gardes l ont montré, et c est ce que ce volet garde désormais : la raison pour
// laquelle un refus naïf ne tient pas, écrite au lieu d être redécouverte.
{
  const OUVERTES = [
    ['valeur d un sac', `${S}-----\nS -> C4(vel:zzz)\n`,
      "⛔ L ARBRE NE DIT PAS SI LA VALEUR EST UN LITTÉRAL OU UNE RÉFÉRENCE : `vel:_srand` et "
      + "`vel:zzz` arrivent au juge sous la MÊME forme, une chaîne. Et le flux accepte "
      + "délibérément ce que le déclaratif refuse — un mot sorti passe en valeur de flux, un garde "
      + "le prouve. Un refus « plage ⇒ nombre » casse donc trois formes légitimes. La plage de "
      + "`keymap` n est en outre rattachée à AUCUN de ses quatre arguments (BPS-116)."],
    ['clé d un corps d acteur', `${S}actor a\n  zzz:quelconque\n-----\nS -> C4\n`,
      "⛔ LES CLÉS PERMISES SE DÉRIVENT DU PROTOTYPE, pas des cinq membres d `actor` : "
      + "`actor midi.actor(ch:required)` porte `ch`, qui vient de `midi`. Un juge bâti sur "
      + "`clesDActeur()` seul refuse la seconde moitié du geste prototypal. Le corpus, lui, "
      + "n écrit que les cinq : 327 acteurs sur 321 scènes, mesuré à l exécution."],
  ];
  for (const [nom, src, cause] of OUVERTES) {
    ok(refus(src) === null,
      `D. « ${nom} » est inscrite OUVERTE et elle REFUSE désormais — remonte-la au tableau des `
      + `places d USAGE et retire-la d ici. Cause inscrite : ${cause}`);
  }
  ok(OUVERTES.length === 2, `D. SOCLE : ${OUVERTES.length} place(s) ouverte(s) inscrite(s).`);
}

// ── E. L'ÉTAGE QUI REFUSE — le parseur ne doit RIEN connaître du vocabulaire ─────────────────
// Décision de Romain, 2026-08-24 : quatre étages, et les refus qui parlent d'un NOM vivent à
// l'étage de résolution. Un refus rendu par la LECTURE arrive avant le juge qui aurait nommé la
// référence — c'est ce qui a fait précéder un plantage d'un refus, le 2026-08-24.
// ⇒ Ce compte ne peut que DESCENDRE. Il monte le jour où l'on pose un refus de nom au mauvais
//   étage, et il descend à chaque refus qu'on déplace.
{
  const aLaLecture = PLACES.filter(([, n, , , code]) => n === 'usage' && /^PARSE_/.test(code || ''));
  ok(aLaLecture.length <= 6,
    `E. ⛔ ${aLaLecture.length} place(s) rendent leur refus de NOM à l ÉTAGE DE LECTURE, plafond 6 : `
    + `${aLaLecture.map(([n]) => n).join(' · ')}. Le parseur ne connaît rien du vocabulaire.`);
  ok(aLaLecture.length > 0,
    `E. TÉMOIN NON NUL : si plus aucune place ne refuse à la lecture, ce volet a fini son travail — `
    + `descendre le plafond à zéro et le dire, au lieu de le laisser garder un espace vide.`);
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
  + `un nom inconnu, ${decls} de DÉCLARATION qui l accueillent, 2 encore OUVERTES et inscrites, chaque refus comparé à son CODE`
  + (ouvertes.length ? ` · ⛔ OUVERTES : ${ouvertes.join(', ')}` : ''));
