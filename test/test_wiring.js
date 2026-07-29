// test_wiring.js — Câblage : opérateurs >> / \>> , corps de @macro ET flux d'une règle.
// Vérifie le PARSER/AST (PORTER≠RÉSOUDRE : BPScript émet le Wiring, l'aval résout).
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ok(name, cond) { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } }

function macros(src) {
  // ⚠️ LA RÈGLE DE CE HARNAIS ÉCRIVAIT `S -> lead` — un symbole qu'AUCUN cas ne déclare, et qui
  // traversait sans un mot parce que la scène n'avait pas de convention de notes en portée.
  // Depuis la cascade @core (2026-07-29), toute scène en a une : le harnais écrit donc une note,
  // et ce qu'il mesure — la forme des corps de macro — n'en dépendait de toute façon pas.
  const r = compileToBPxAST('@core\n@controls\n' + src + '\nS -> C4');
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
  ['après un accord',                  'S -> C4 !E4 !osc >> filtre D4',         1, [false]],
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
  ['accord collé',                 'S -> C4!E4 D4',            'SimultaneousGroup'],
  ['accord espacé',                'S -> C4 !E4 D4',           'SimultaneousGroup'],
  ['accord à deux secondaires',    'S -> C4!E4!G4 D4',      'SimultaneousGroup'],
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


// ============================================================================
// §8. LA FORME DOCUMENTÉE, COMPILÉE ET CHARGÉE (docs/design/SCENES.md §6.4)
//
// Pourquoi ici et pas seulement dans la démo : le dossier des démos n'est PAS versionné. Une
// pièce qui exerce la capacité doit vivre quelque part de SUIVI, sinon la preuve est locale et
// disparaît au prochain clone — payé le 2026-07-28, où j'ai cité une démo non versionnée comme
// preuve qu'une forme était en service.
//
// Et la mesure va jusqu'au CHARGEMENT chez le moteur, pas seulement jusqu'à mon arbre : c'est là
// que la forme directe s'arrête, et une garde qui ne regarderait que mon étage dirait « ça
// marche » d'une écriture que personne ne peut jouer.
// ============================================================================
// Même motif que le garde de conformité : si la dist du moteur manque ou est périmée, ce garde
// DOIT le dire en le nommant, et échouer. Ni crash obscur (qu'on lirait comme un défaut de
// langage), ni saut silencieux (qui verdirait sans rien examiner — la famille fermée le 2026-07-27).
let Session;
try {
  ({ Session } = await import('../../BPx/dist/index.js'));
} catch (e) {
  console.error('§8 — dist BPx introuvable ou illisible : `npm run build` côté BPx. '
    + 'Ce n\'est PAS un défaut du langage. (' + String(e.message).slice(0, 100) + ')');
  process.exit(1);
}
if (typeof Session !== 'function') {
  console.error('§8 — `Session` absente de la dist BPx : dist périmée ? (npm run build côté BPx)');
  process.exit(1);
}

const EXEMPLE_DOCUMENTE = `@core
@controls
@macro prise    pot >> tempo.bpm
@macro lache    \\>> tempo.bpm

S -> A4 prise  B4 C4 D4  lache  E4`;

console.log('\n=== §8. la forme documentée ===');
{
  const r = compileToBPxAST(EXEMPLE_DOCUMENTE);
  ok('§8. l\'exemple de la doc compile', !!r.ast && r.errors.length === 0);
  const rhs = r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs ?? [];
  // La forme documentée est le nom NU : il occupe un pas, comme un terminal.
  ok('§8. le nom nu est un élément de séquence à lui seul',
    rhs.length === 7 && rhs.every((e) => e.type === 'Symbol'));
  ok('§8. et les deux noms de macro y sont', ['prise', 'lache'].every((n) => rhs.some((e) => e.name === n)));
  // Le corps de macro ne porte PAS le signe d'instantané — le piège mesuré par BPx.
  const avecSigne = compileToBPxAST(EXEMPLE_DOCUMENTE.replace('@macro lache    \\>>', '@macro lache    !\\>>'));
  ok('§8. le signe DANS un corps de macro ne passe pas (piège documenté)', !avecSigne.ast);
  let charge = null;
  try { new Session(r.ast, {}); charge = true; } catch (e) { charge = String(e.message); }
  ok('§8. la forme documentée CHARGE chez le moteur', charge === true);
}

// §8bis. LE PIÈGE DU SON FANTÔME — trouvé par BPx le 2026-07-28 sur une version de ma doc qui
// conseillait cette écriture. Elle COMPILE : rien ne peut la signaler, et c'est tout le problème.
// Ce témoin ne demande pas qu'elle soit refusée — l'accord est une graphie légitime — il vérifie
// qu'elle produit bien un co-attaqué SONNANT, donc que le conseil reste faux tant que c'est vrai.
// Si un jour un nom de macro cessait d'être sonnant dans un accord, cette ligne rougirait et la
// mise en garde de la doc devrait être relue.
console.log('\n=== §8bis. la forme ATTACHÉE — le point d\'application ===');
{
  const base = '@core\n@controls\n@macro voix saw >> audio\n';
  // Collé et espacé sont la MÊME forme : la règle d'espace ne joue que sur `!(…)`.
  const colle = compileToBPxAST(base + 'S -> C4!voix D4');
  const espace = compileToBPxAST(base + 'S -> C4 !voix D4');
  const rhsDe = (r) => JSON.stringify(r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs);
  ok('§8bis. collé et espacé donnent le MÊME arbre', rhsDe(colle) === rhsDe(espace));
  const g = colle.ast?.subgrammars?.[0]?.rules?.[0]?.rhs?.[0];
  ok('§8bis. le nom est ATTACHÉ au terminal, pas posé à côté', g?.type === 'SimultaneousGroup');
  ok('§8bis. et c\'est bien le nom de la macro', g?.secondaries?.[0]?.name === 'voix');
  // LA propriété qui fonde la forme, mesurée DANS LE MOTEUR : le secondaire copie l'étendue du
  // primaire, donc il n'allonge pas la pièce. Sans cette mesure, « sans occuper de pas » serait
  // une affirmation de doc — c'est ici qu'elle devient vérifiable.
  const etendues = (ast) => {
    const s2 = new Session(ast, {});
    for (const m of ['derive', 'step', 'tick', 'produce', 'run']) {
      if (typeof s2[m] === 'function') { try { s2[m](); } catch { /* la dérivation suffit */ } }
    }
    const t = s2.tree ?? s2._lastTree ?? null;
    const spans = [];
    const walk = (n) => { if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      if (n.span && typeof n.span.startBeat === 'number') spans.push([n.span.startBeat, n.span.endBeat]);
      for (const k in n) if (n[k] && typeof n[k] === 'object') walk(n[k]); };
    walk(t);
    return spans;
  };
  const sAttache = etendues(colle.ast);
  const sNu = etendues(compileToBPxAST(base + 'S -> C4 voix D4').ast);
  const fin = (sp) => Math.max(0, ...sp.map((x) => x[1]));
  ok('§8bis. ATTACHÉ, la pièce dure 2 temps — le nom n\'occupe aucun pas', fin(sAttache) === 2);
  ok('§8bis. NU, la même pièce dure 3 temps — le nom prend un pas', fin(sNu) === 3);
  ok('§8bis. et deux feuilles partagent la même étendue (la co-attaque)',
    sAttache.filter(([a, b]) => a === 0 && b === 1).length === 2);
}

// §8ter. LE SUFFIXE ARROBASE A DISPARU — partout où il pouvait s'écrire, et la directive avec lui.
// Chaque refus doit NOMMER la disparition ET donner LES DEUX réécritures : la dichotomie de Romain
// (associer dans la production / déclarer en déclaratif) est le motif du retrait, un refus qui n'en
// donnerait qu'une moitié laisserait choisir au hasard.
console.log('\n=== §8ter. le suffixe arobase a disparu ===');
const OU_LE_SUFFIXE_POUVAIT_S_ECRIRE = [
  ['sur un terminal',            '@core\nS -> C4@kick D4'],
  ['sur un groupe',              '@core\nS -> {C4 D4}@groove'],
  ['sur une variable',           '@core\n@var a\nS -> C4 a@lbl'],
  ['en fin de règle',            '@core\nS -> C4 D4@fin'],
  ['dans une voix polymétrique', '@core\nS -> {C4@kick D4, E4}'],
  ['dans un groupe de gabarit maître',  '@core\nS -> ${C4@kick D4}'],
  ['dans un groupe de gabarit esclave', '@core\nS -> &{C4@kick D4}'],
  ['la directive elle-même',     '@core\n@label groove\nS -> C4 D4'],
];
// ⚠️ CETTE LISTE EST L'ESPACE, PAS LE TICKET. Écrite d'abord avec le seul flux de premier niveau,
// elle laissait TROIS positions refuser par un message générique — voix polymétrique et les deux
// groupes de gabarit — parce que quatre endroits du parser lisent un élément et qu'un seul avait
// la pierre tombale. La forme disparaissait bien partout ; ce qui manquait, c'est ce que le
// lecteur apprend. Trouvé par la matrice, pas par relecture.
for (const [ou, src] of OU_LE_SUFFIXE_POUVAIT_S_ECRIRE) {
  const r = compileToBPxAST(src);
  const msg = (r.errors || []).map((e) => e.message ?? String(e)).join(' ');
  ok(`${ou} — refusé`, !r.ast);
  ok(`${ou} — le refus NOMME la disparition`, /SUPPRIM/.test(msg));
  ok(`${ou} — donne la réécriture pour ASSOCIER (le point d'exclamation)`, /!/.test(msg) && /production/i.test(msg));
  ok(`${ou} — donne la réécriture pour DÉCLARER (le déclaratif)`, /déclarati/i.test(msg));
}
// Le champ quitte l'arbre AVEC le mot : un champ émis et toujours vide fait conclure « cette scène
// n'étiquette rien » au lieu de « ce canal n'existe plus ».
{
  const r = compileToBPxAST('@core\nS -> C4 D4');
  ok('§8ter. le champ des étiquettes a quitté l\'arbre', r.ast?.labels === undefined);
  ok('§8ter. et aucun élément ne porte plus d\'étiquette',
    !JSON.stringify(r.ast?.subgrammars ?? {}).includes('"label"'));
}
// TÉMOIN INVERSE — l'étiquette de GROUPE polymétrique est une AUTRE graphie et elle RESTE.
// Sans lui, un retrait trop large passerait pour un succès.
{
  const r = compileToBPxAST('@core\nS -> groove:{C4 D4, E4}');
  ok('§8ter. l\'étiquette de groupe polymétrique (deux-points) survit', !!r.ast && r.errors.length === 0);
  ok('§8ter. et elle porte bien son nom',
    r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs?.[0]?.label === 'groove');
}

// L'ÉTAT DATÉ que la doc affirme : la forme directe est acceptée par le langage et REFUSÉE au
// chargement. Témoin des deux sens — si le moteur se met à la porter, cette ligne rougit et la
// doc doit changer le jour même, au lieu de rester périmée sans que rien ne le dise.
{
  const r = compileToBPxAST('@core\n@controls\nS -> C4 !lpf \\>> out.in D4');
  ok('§8. la forme DIRECTE est acceptée par le langage', !!r.ast && r.errors.length === 0);
  let refus = null;
  try { new Session(r.ast, {}); } catch (e) { refus = String(e.message); }
  ok('§8. et REFUSÉE au chargement par le moteur', refus !== null);
  ok('§8. le refus du moteur donne la réécriture (écrire dans une macro)',
    refus !== null && /macro/i.test(refus));
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
