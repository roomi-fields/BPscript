#!/usr/bin/env node
/**
 * GARDE — une DÉCLARATION écrite après les règles est REFUSÉE, elle ne se perd plus en silence.
 *
 * Décision Romain, transmise le 2026-07-29 : « une directive après les règles doit être une
 * erreur ». Mesure de l'architecte, reproduite ici : elle était ACCEPTÉE ET SILENCIEUSEMENT
 * IGNORÉE — `@var v` posé après une règle compilait sans un mot, et `v` n'existait dans aucun
 * arbre. La même ligne posée avant la règle le crée.
 *
 * ⚠️ POURQUOI C'EST LE PIRE MODE D'ÉCHEC, et pas une coquille : l'auteur CROIT avoir déclaré.
 * Rien ne le détrompe — ni le compilateur, ni l'arbre, ni l'aval. C'est le mode d'échec de la
 * flèche du moteur historique, en pire : celle-là au moins ne compilait pas.
 *
 * ⚠️ LE GARDE PORTE SUR L'ESPACE, PAS SUR LA FORME DU TICKET. Le signalement nommait `@var`. Le
 * balayage des directives réservées en a trouvé VINGT-QUATRE dans le même cas. Réparer la seule
 * forme signalée aurait laissé vivre les vingt-trois autres — c'est la faute que je paie le plus
 * souvent, et elle est ici mécanisée : la liste des directives est CONSTRUITE, pas écrite à la
 * main, et chacune est éprouvée dans les deux positions.
 *
 * ⚠️ ET `@mode` DOIT PASSER — ce n'est pas une exception de complaisance. Il porte le mode de la
 * sous-grammaire QUI SUIT, et 67 scènes du corpus en vivent. Un refus en bloc les aurait toutes
 * cassées : exactement le témoin qui aurait refusé 120 scènes sur 333 le 2026-07-28, retrouvé une
 * semaine plus tard sur un autre sujet. C'est la moitié « doit passer » qui démasque une règle
 * trop large, et elle est ici la plus fournie.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const err = (src) => {
  try { return (compileToBPxAST(src).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};
// ⚠️ LE SOCLE EST CONDITIONNEL DEPUIS LE 2026-08-07 : une scène ne déclare qu'UN alphabet
// (l'acteur implicite est unique, règle de Romain). Poser `@alphabet.western` autour d'un
// `@alphabet.sargam` testé fabriquait un refus qui n'a rien à voir avec ce qu'on mesure.
const socle = (d) => `@core\n${/^@alphabet[.:]/.test(d) ? '' : '@alphabet.western\n'}`;
const S = '@core\n@alphabet.western\n';

// ── 1. LA MATRICE — chaque déclaration, dans les DEUX positions ──────────────────────────────
// Une écriture plausible par directive. Elles ne sont pas inventées : chacune est la forme que le
// parseur accepte AVANT les règles, vérifiée par la moitié « doit passer » de cette même matrice.
const DECLARATIONS = [
  // `western` et non `sargam` : depuis que le socle est conditionnel, la scène ne porte plus que
  // l'alphabet TESTÉ, et la règle témoin joue `C4`. Mesurer un refus de POSITION ne doit pas
  // buter sur un vocabulaire qui ne contient pas la note de l'exemple.
  ['alphabet', '@alphabet.western'], ['tuning', '@tuning.western_just'], ['octaves', '@octaves.bp3'],
  // ⚠️ COBAYE CHANGÉ le 2026-08-08 : ce garde mesure la POSITION d'une déclaration dans le
  // fichier (avant / après les règles), pas la légitimité du mot. `@scan` ne s'écrit plus en
  // tête de scène depuis que la portée est validée ; `@mm` est SORTIE du langage le 2026-08-09 et vaut.
  ['eval', '@eval.sc'], ['actor', '@actor v\n  out.audio'],
  // ⚠️⚠️ `transport` ET `out` SONT SORTIS DE LA MATRICE le 2026-08-04, remplacés 1-pour-1 par
  // `scan` et `sound` — le témoin anti-rétrécissement (>= 24) reste tenu, et les deux remplaçants
  // ont été MESURÉS génériques avant d'être choisis (acceptés avant les règles, refusés après),
  // pas supposés tels. Raison de leur sortie : Atlas a signalé que `@transport.midi` en tête de
  // scène compilait SANS ERREUR alors que le mot a quitté le langage — mesuré, la directive
  // orpheline ne produisait AUCUN effet (l'acteur implicite gardait `audio` avec ou sans elle).
  // Le trou était PRÉEXISTANT, pas ouvert par le renommage : il n'avait simplement jamais été
  // fermé. Les deux sont désormais des TOMBSTONES INCONDITIONNELS, donc sans comportement
  // générique à éprouver ici — leur refus est gardé par
  // `test/transport_et_out_ne_sont_pas_des_directives_de_scene.mjs`.
  // ⚠️ `in` REMPLACÉ par `out` dans la matrice le 2026-08-04 (in/out remplacent transport, ligne
  // réservée ajoutée avec le mot) : `@in` seul est désormais un TOMBSTONE INCONDITIONNEL (refusé
  // dans LES DEUX positions, avant comme après les règles — cf. `test/declaration_d_entree.mjs`),
  // pas une déclaration mal placée. La prémisse de cette matrice (« la forme PASSE avant les
  // règles ») ne tient plus pour ce mot précis — la déclaration d'entrée s'écrit maintenant
  // '@var <rôle> in.<canal>', couverte par la ligne 'var'. `out`, mot NOUVEAU du même jour, garde
  // lui le comportement générique (accepté-ignoré avant, refusé-nommé après) : il prend la place
  // dans la matrice SANS la rétrécir.
  ['sound', '@sound.tabla_perc'],
  // ⚠️ `controls` N'EST PLUS UNE DIRECTIVE RÉSERVÉE (controls.json supprimé, Romain 2026-08-10) —
  // mais `@controls` reste une ligne SYNTAXIQUEMENT valide (bare directive, comme n'importe quel
  // mot), donc le refus générique « déclaration après les règles » la mord toujours, nommément.
  // Ce cobaye prouve que le refus ne dépend pas d'être une directive CONNUE.
  // `controls` EST SORTI de la matrice le 2026-08-10 : la librairie a été SCINDÉE par destinataire
  // (expression, midi, audio, transpo) puis SUPPRIMÉE, et `@core` les apporte toutes. Le mot ne
  // désigne plus rien. Remplacé 1-pour-1 par `timepatterns`, mesuré générique avant d'être choisi
  // — accepté avant les règles, refusé après — pour que le socle anti-rétrécissement reste tenu.
  ['timepatterns', '@timepatterns: t1=1/1'], ['var', '@var v'],
  ['alias', '@alias g cc:2'], ['tempo', '@tempo:90'], ['duration', '@duration:4'],
  ['meter', '@meter:4'], ['quantization', '@quantization:50'], ['qclock', '@qclock:10'],
  ['transpose', '@transpose:2'], ['diapason', '@diapason:442'], ['homomorphism', '@homomorphism.dhati'],
  ['settings', '@settings'], ['transpose', '@transpose:1/2'], ['modulation', '@modulation'], ['ins', '@ins:3'],
  ['test_alphabets', '@test_alphabets.abc'],
];
console.log(`[declaration apres regles] ${DECLARATIONS.length} declarations x 2 positions`);
for (const [nom, forme] of DECLARATIONS) {
  // APRÈS une règle → REFUSÉE, et le refus doit NOMMER la directive et donner la réécriture.
  const apres = err(`${socle(forme)}S -> C4\n${forme}\nT -> D4\n`);
  ok(apres.length >= 1, `1. '@${nom}' après une règle doit être REFUSÉE (elle se perdait en silence)`);
  ok(apres.some((m) => m.includes(`'@${nom}'`)),
    `1. '@${nom}' — le refus doit NOMMER la directive, pas dire « ligne non reconnue » (reçu : ${apres[0]})`);
  ok(apres.some((m) => /avant la première règle/.test(m)),
    `1. '@${nom}' — le refus doit donner la RÉÉCRITURE, sinon il constate sans aider`);
  // AVANT les règles → PASSE. Sans cette moitié, une règle qui refuserait tout aurait l'air juste.
  ok(err(`${socle(forme)}${forme}\nS -> C4\n`).length === 0,
    `1. '@${nom}' AVANT les règles doit PASSER — c'est la moitié qu'on casse sans s'en apercevoir`);
}

// ── 2. `@mode` EST LA SEULE LÉGITIME À CETTE PLACE ───────────────────────────────────────────
// 67 scènes du corpus sur 263 en vivent. Ce témoin est la preuve que la règle ne déborde pas.
ok(err(`${S}S -> C4\n@mode:sub\nT -> D4\n`).length === 0,
  '2. SE TAIT — `@mode` après une règle gouverne la sous-grammaire suivante, et doit passer');
{
  const r = compileToBPxAST(`${S}S -> C4\n@mode:sub\nT -> D4\n`);
  ok((r.ast?.subgrammars || []).some((g) => g.mode === 'sub'),
    '2. et il AGIT — sinon il « passerait » en ne faisant rien, ce qui est le défaut qu\'on répare');
}
ok(err(`${S}S -> C4\n-----\n@mode:lin\nT -> D4\n`).length === 0,
  '2. SE TAIT — `@mode` après un séparateur de bloc aussi');

// ── 3. LE REFUS NE DÉBORDE PAS SUR LES AUTRES FORMES DE FIN DE SCÈNE ─────────────────────────
// La section `@template` vient APRÈS toutes les sous-grammaires : c'est sa place, pas une faute.
ok(err(`${S}S -> C4\n@template\n  t1 = C4 D4\n`).length === 0,
  '3. SE TAIT — la section `@template` se place après les règles, c\'est sa définition');
ok(err(`${S}S -> C4\n-----\nT -> D4\n`).length === 0,
  '3. SE TAIT — un séparateur de bloc n\'est pas une directive');

// ── 4. SOCLE ET ANTI-RÉTRÉCISSEMENT ─────────────────────────────────────────────────────────
// L'espace se lit dans la DONNÉE : si le vocabulaire de directives grandit, ce compte le dit.
// ⚠️ MESURE ÉTENDUE À L'UNION DU REGISTRE le 2026-08-10 (mise en conformité des librairies).
// Compter SEUL `core.schema.reservedDirectives` mesurait juste ce fichier — exact tant que lui
// seul en portait. Les 15 clés qui vivaient EN DOUBLE ici et dans lib/engine.json (mode, seed,
// maxitems, items, allitems, all_items, improvize, duration, meter, scan, weight, on_fail,
// quantization, qclock, timepatterns) l'ont QUITTÉ (une clé ne vit que dans UNE librairie) : le
// vocabulaire RÉEL du langage n'a pas rétréci, il s'est redistribué — c'est l'UNION, pas la seule
// part de `core`, que ce témoin doit garder. `reservedDirectives` porte deux formes (array plat
// ou objet {nom:{description,scope}}) ; les deux se comptent par leurs noms.
const nomsReserves = (rd) => (Array.isArray(rd) ? rd : Object.keys(rd || {}));
const RESERVEES = new Set(Object.values(LIBS).flatMap((f) => nomsReserves(f?.schema?.reservedDirectives))).size;
ok(RESERVEES >= 40, `4. le vocabulaire de directives doit être chargé — ${RESERVEES} mot(s)`);
// Le seuil est passé de 24 à 22 le 2026-08-09, et le motif s'écrit ici plutôt que dans un commit :
// `@mm` est SORTIE du langage (Romain 2026-06-26, fermée le 2026-08-09), donc elle disparaît des
// deux listes — une forme qui n'existe plus ne peut pas être éprouvée. C'est le seul abaissement
// légitime de ce socle : une forme RETIRÉE du langage. Un seuil qu'on baisse parce qu'un cas
// « ne passe plus » est un socle qu'on désarme ; celui-ci se baisse parce que l'espace lui-même a
// rétréci, et le compte des directives réservées ci-dessus reste, lui, à 40 pour le prouver.
ok(DECLARATIONS.length >= 22,
  `4. la matrice ne s'est pas vidée — ${DECLARATIONS.length} déclarations éprouvées`);
// TÉMOIN D'INSTRUMENT : sans lui, une régression rendant le refus muet laisserait tout au vert.
ok(err(`${S}S -> C4\n@var v\n`).length >= 1,
  '4. TÉMOIN — la règle doit savoir MORDRE même en toute fin de scène (aucune règle après)');

if (echecs.length) {
  console.error(`[declaration apres regles] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[declaration apres regles] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
