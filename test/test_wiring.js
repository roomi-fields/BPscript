// test_wiring.js — Câblage : opérateurs >> / \>> , corps de @macro ET flux d'une règle.
// Vérifie le PARSER/AST (PORTER≠RÉSOUDRE : BPScript émet le Wiring, l'aval résout).
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ok(name, cond) { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } }

function macros(src) {
  const r = compileToBPxAST('@core\n@controls\n' + src + '\nS -> lead');
  return { errors: r.errors, macros: r.ast?.macros || [] };
}

console.log('=== Câblage >> / \\>> ===');

// 1. Série simple : saw >> lpf >> audio
{
  const { errors, macros: m } = macros('@macro lead saw >> lpf >> audio');
  ok('série 3 étages, 0 erreur', errors.length === 0 && m[0].body[0].type === 'Wiring');
  ok('3 étages câblés', eq(m[0].body[0].stages.map((s) => s.module), ['saw', 'lpf', 'audio']));
  ok('aucun cut sur une série', m[0].body[0].stages.every((s) => s.cut === false));
}

// 2. Ports + valeurs (ref, backtick, nombre)
{
  const { macros: m } = macros('@macro v saw.freq: pitch >> lpf.cutoff:`js: lfo(2)` >> audio');
  const s = m[0].body[0].stages;
  ok('port adressé par le point', s[0].module === 'saw' && s[0].port === 'freq');
  ok('valeur ref (pitch)', eq(s[0].value, { kind: 'ref', name: 'pitch' }));
  ok('valeur backtick typée', s[1].value.kind === 'backtick' && s[1].value.tag === 'js');
  ok('étage terminal sans port ni valeur', s[2].module === 'audio' && s[2].port === null);
}

// 3. Valeur nombre + unité
{
  const { macros: m } = macros('@macro d env.decay: 350ms >> audio');
  ok('valeur nombre + unité', eq(m[0].body[0].stages[0].value, { kind: 'number', value:350, unit: 'ms' }));
}

// 4. Débranchement \>> (patchbay dynamique)
{
  const { errors, macros: m } = macros('@macro mute \\>> out.in');
  ok('\\>> = Wiring cut, 0 erreur', errors.length === 0 && m[0].body[0].type === 'Wiring' && m[0].body[0].cut === true);
  ok('cible du cut', m[0].body[0].stages[0].module === 'out' && m[0].body[0].stages[0].port === 'in');
}

// 5. Cut en milieu de chaîne : a >> b \>> c
{
  const { macros: m } = macros('@macro cx a >> b \\>> c');
  const s = m[0].body[0].stages;
  ok('lien >> non-cut, lien \\>> cut', s[1].cut === false && s[2].cut === true);
}

// 6. Substitution INCHANGÉE (corps sans >> ni point glué = ancien @macro)
{
  const { errors, macros: m } = macros('@macro accent(x) x(vel:120)');
  ok('substitution reste RhsElement (pas Wiring)', errors.length === 0 && m[0].body[0].type !== 'Wiring');
}

// 6b. Corps par-le-POINT = APPEL-COMPOSANT OPAQUE, PAS un Wiring (décision [489]).
// Le parser NE CLASSE PAS son-vs-substitution : le point glué → même nœud que actor.terminal
// (Symbol{name,actor}), OPAQUE ; la classe (module/acteur/homo) est décidée à la RÉSOLUTION.
{
  const trig = macros('@macro strike drum.on');
  const b = trig.macros[0].body[0];
  ok('drum.on → appel-composant Symbol{name:on, actor:drum}, PAS Wiring',
    b.type === 'Symbol' && b.name === 'on' && b.actor === 'drum' && trig.errors.length === 0);
  const cv = macros('@macro open lpf.cutoff:8000');
  ok('lpf.cutoff:8000 → composant opaque (pas Wiring), 0 erreur',
    cv.macros[0].body[0].type !== 'Wiring' && cv.errors.length === 0);
  const spaced = macros('@macro per A . B');
  ok('point ESPACÉ (A . B) = notation période inchangée',
    spaced.macros[0].body.map((e) => e.type).join(',') === 'Symbol,Period,Symbol');
  const wire = macros('@macro w a >> b');
  ok('SEUL >> fait un Wiring', wire.macros[0].body[0].type === 'Wiring');
}

// 6c. Champ VALEUR sur appel-composant opaque (§4/§9 activés [502]) — cv-set/ref/backtick.
{
  const num = macros('@macro open lpf.cutoff:8000');
  ok('cv-set number → Symbol.value {kind:number}', eq(num.macros[0].body[0].value, { kind: 'number', value:8000 })
    && num.macros[0].body[0].actor === 'lpf' && num.macros[0].body[0].name === 'cutoff');
  const ref = macros('@macro f saw.freq: pitch');
  ok('valeur ref (saw.freq: pitch) parse (bug corrigé) → {kind:ref}', ref.errors.length === 0
    && eq(ref.macros[0].body[0].value, { kind: 'ref', name: 'pitch' }));
  const bt = macros('@macro c lpf.cutoff:`js: lfo(2)`');
  ok('valeur backtick typée', bt.macros[0].body[0].value.kind === 'backtick' && bt.macros[0].body[0].value.tag === 'js');
  const trig = macros('@macro s drum.on');
  ok('appel sans valeur (trig) → pas de champ value', trig.macros[0].body[0].value === undefined);
}

// 7. BP3 byte : un câblage n'apparaît pas dans la grammaire BP3 (feature BPScript/BPx)
{
  const r = compileToBPxAST('@core\n@controls\n@macro lead saw >> lpf >> audio\nS -> Sa');
  // ⚠️ ASSERTION DE TEXTE BP3 RETIRÉE le 2026-07-19 — la certification grammaire-texte est
  // abandonnée (arbitrage Romain) et l'encodeur supprimé : il n'y a plus de texte à vérifier.
  // ancienne assertion : ok('compileBPS ne crashe pas sur un câblage', typeof r.grammar === 'string');
}

// (bilan intermédiaire RETIRÉ : le lanceur lit le PREMIER compte qu'il trouve dans la sortie,
//  donc ce bilan-là masquait les 108 assertions du §7 — le garde annonçait 20 et en exécutait 128.
//  Un compte qui sous-estime est pire qu'absent : il donne l'air couvert.)
if (fail > 0) process.exit(1);

// ============================================================================
// §7. LE CÂBLAGE DANS LE FLUX D'UNE RÈGLE (décidé Romain 2026-07-28)
//
// Écrit en MATRICE et pas en liste, parce qu'une garde construite incident par incident
// n'énumère complètement que sa section la plus récente — payé cinq fois. Ici, ajouter une
// FORME les teste toutes automatiquement, ajouter une PROPRIÉTÉ pareil. Rien à penser au bon
// moment : c'est le produit croisé qui garde, pas la mémoire de celui qui écrit.
// ============================================================================

function fluxRhs(regle) {
  const r = compileToBPxAST('@core\n@controls\n' + regle);
  return { errors: r.errors, rhs: r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [] };
}
const cablagesDe = (rhs) => rhs.filter((e) => e && e.type === 'Wiring');

// Toutes les graphies que l'analyseur peut rencontrer — pas celle du ticket.
const FORMES_FLUX = [
  ['câblage seul dans le flux',        'S -> C4 !osc >> filtre D4',              1, [false]],
  ['câblage en tête de règle',         'S -> !osc >> audio',                     1, [false]],
  ['coupure seule',                    'S -> C4 !\\>> out.in D4',                1, [true]],
  ['coupure en milieu de chaîne',      'S -> C4 !a >> b \\>> c D4',              1, [false]],
  ['câblage avec port',                'S -> C4 !pot >> tempo.bpm D4',           1, [false]],
  ['câblage avec port et valeur',      'S -> C4 !pot >> tempo.bpm: 120 D4',      1, [false]],
  ['deux câblages enchaînés',          'S -> C4 !a >> b !c >> d D4',             2, [false, false]],
  ['un câblage et une coupure',        'S -> C4 !a >> b !\\>> out.in D4',        2, [false, true]],
  ['après un accord',                  'S -> C4 !dha !osc >> filtre D4',         1, [false]],
  ['après un silence',                 'S -> - !osc >> filtre D4',               1, [false]],
  ['dans une voix polymétrique',       'S -> {C4 !osc >> filtre, D4}',           0, []],
];

// Ce qu'on exige de CHAQUE forme. La dernière est celle qui a manqué quatre fois ailleurs :
// descendre jusqu'aux feuilles, parce qu'un élément DÉPLACÉ sous son voisin n'est pas ABSENT —
// rien ne manque, donc rien ne peut le signaler.
const PROPRIETES_FLUX = [
  ['compile sans erreur', ({ errors }) => errors.length === 0],
  ['produit le bon NOMBRE de câblages', ({ rhs }, attendu) => cablagesDe(rhs).length === attendu],
  ['chaque câblage est INSTANTANÉ (zéro durée)',
    ({ rhs }) => cablagesDe(rhs).every((w) => w.payload?.nature === 'instant' && w.payload?.flux === true)],
  ['aucun câblage n\'est SONNANT (il ne prend jamais un pas)',
    ({ rhs }) => cablagesDe(rhs).every((w) => w.payload?.nature !== 'sounding')],
  ['le marqueur de coupure est celui attendu',
    ({ rhs }, _n, cuts) => JSON.stringify(cablagesDe(rhs).map((w) => w.cut)) === JSON.stringify(cuts)],
  // Un groupe polymétrique est un CONTENEUR de séquences : un câblage y vit dans une VOIX, et
  // c'est légitime. Ce qui est interdit, c'est de se retrouver sous un élément SONNANT — là, le
  // câblage aurait été absorbé par son voisin au lieu d'être son frère. Distinction mesurée : ma
  // première écriture de cette propriété faisait rougir le cas polymétrique, qui est correct.
  ['ÉLÉMENT À PART ENTIÈRE : jamais absorbé par un voisin SONNANT',
    ({ rhs }) => !rhs.some((e) => e && ['Symbol', 'SymbolCall', 'SimultaneousGroup', 'OutTimeObject']
      .includes(e.type) && JSON.stringify(e).includes('"Wiring"'))],
  ['dans un groupe, le câblage vit dans une VOIX et y reste instantané',
    ({ rhs }) => rhs.filter((e) => e && e.type === 'Polymetric')
      .flatMap((p) => (p.voices || []).flat())
      .filter((e) => e && e.type === 'Wiring')
      .every((w) => w.payload?.nature === 'instant')],
];

console.log('\n=== §7. Câblage DANS LE FLUX — ' + FORMES_FLUX.length + ' formes × '
  + PROPRIETES_FLUX.length + ' propriétés ===');
for (const [nomForme, src, nb, cuts] of FORMES_FLUX) {
  const mesure = fluxRhs(src);
  for (const [nomProp, verif] of PROPRIETES_FLUX) {
    ok(`${nomForme} — ${nomProp}`, verif(mesure, nb, cuts));
  }
}
// TÉMOIN ANTI-RÉTRÉCISSEMENT : une matrice vidée passerait en silence.
ok('§7. la matrice ne s\'est pas vidée', FORMES_FLUX.length >= 11 && PROPRIETES_FLUX.length >= 7);

// §7bis. L'ANCIENNE COUPURE A DISPARU — partout où elle pouvait s'écrire, pas seulement
// là où on l'a vue. Et le refus doit NOMMER la disparition ET donner la réécriture : un refus
// qui constate sans corriger renvoie lire la spec pour une faute d'un caractère.
const OU_ELLE_POUVAIT_S_ECRIRE = [
  ['dans un corps de macro',      '@core\n@macro mute !>> out.in\nS -> mute'],
  ['au milieu d\'une chaîne',     '@core\n@macro cx a >> b !>> c\nS -> cx'],
  ['dans le flux d\'une règle',   '@core\nS -> C4 !>> out.in D4'],
  ['en tête de règle',            '@core\nS -> !>> out.in'],
];
console.log('\n=== §7bis. \'!>>\' a disparu ===');
for (const [ou, src] of OU_ELLE_POUVAIT_S_ECRIRE) {
  const r = compileToBPxAST(src);
  const msg = (r.errors || []).map((e) => e.message ?? String(e)).join(' ');
  ok(`${ou} — refusé`, !r.ast);
  ok(`${ou} — le refus NOMME la disparition`, /n'est plus la coupure/.test(msg));
  ok(`${ou} — le refus donne la réécriture`, msg.includes('\\>>'));
}

// §7ter. CE QUE LE CÂBLAGE NE DOIT PAS AVOIR CASSÉ. Sans ces témoins, on ne saurait pas si la
// désambiguïsation a mangé les formes voisines — le `!` en portait déjà cinq.
console.log('\n=== §7ter. les voisins du point d\'exclamation sont intacts ===');
const INTACTS = [
  ['accord collé',                 'S -> C4!dha D4',            'SimultaneousGroup'],
  ['accord espacé',                'S -> C4 !dha D4',           'SimultaneousGroup'],
  ['accord à deux secondaires',    'S -> C4!dha!phase D4',      'SimultaneousGroup'],
  ['objet hors-temps',             'S -> !f D4',                'OutTimeObject'],
  ['contrôle instantané',          'S -> C4 !(vel:80) D4',      'InstantControl'],
  ['contrôle moteur instantané',   'S -> C4 ![retro] D4',       'InstantControl'],
];
for (const [nom, src, attendu] of INTACTS) {
  const { errors, rhs } = fluxRhs(src);
  ok(`${nom} — compile`, errors.length === 0);
  ok(`${nom} — reste un ${attendu}`, rhs.some((e) => e && e.type === attendu));
  ok(`${nom} — n'est PAS devenu un câblage`, cablagesDe(rhs).length === 0);
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
