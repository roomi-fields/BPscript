#!/usr/bin/env node
/**
 * GARDE — le POINT D'ATTENTE `<!nom` est un élément de plein droit du RHS, porté jusqu'à l'arbre.
 *
 * Décision Romain 2026-07-26 (`hub/decisions/2026-07-26-architecture-des-entrees-point-d-attente-
 * dans-l-arbre.md`) : « le point d'attente DOIT vivre dans l'arbre ». Elle révoque le choix du
 * contrat aval qui le posait **délibérément hors** de l'union des éléments de RHS
 * (`BPx/docs/AST_SPEC.md:250-253`) et le réécrivait en sentinelle avant chargement.
 *
 * CE QUE CE GARDE TIENT, côté émission — la seule part qui soit de nous :
 *   il est ÉMIS comme élément du RHS, à sa position, avec ses qualificatifs ;
 *   une note qui en porte un reste une NOTE.
 *
 * SA NATURE EST `wait` depuis le 2026-07-26 (contrat BPx AST_SPEC.md:461, c96deb3). C'était le
 * SEUL élément de RHS sans nature ; un élément qui vit dans l'arbre sans en porter une n'y vit
 * qu'à moitié. Le témoin qui CONSTATAIT ce manque a été RETOURNÉ, pas retiré : il exige
 * désormais la valeur (§4).
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const rhs = (regle) => {
  const o = compileToBPxAST(`core\nalphabet.western:midi\nin.midi sync1\nin.midi sync2\nmode:ord\n-----\n${regle}\n`);
  return { err: o.errors || [], rhs: o.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [] };
};

// ─── 1. Le point d'attente est un ÉLÉMENT, à sa position ─────────────────────────────────────
{
  const { err, rhs: r } = rhs('S -> <!sync1 C4 D4');
  ok(err.length === 0, `1. '<!sync1' doit compiler — reçu : ${err.map((e) => e.message || e).join(' | ')}`);
  ok(r[0]?.type === 'Wait' && r[0]?.name === 'sync1',
     `1. il doit être le PREMIER élément du RHS, pas une sentinelle ni un oubli — reçu : ${JSON.stringify(r.map((e) => e.type))}`);
  ok(r.length === 3, `1. il ne doit ni remplacer ni absorber ce qui suit — reçu ${r.length} éléments`);
}
{
  const { rhs: r } = rhs('S -> -<!sync1 C4 D4');
  ok(r.map((e) => e.type).join(',') === 'Rest,Wait,Symbol,Symbol',
     `1. sa POSITION dans la séquence est portée telle qu'écrite — reçu : ${JSON.stringify(r.map((e) => e.type))}`);
}

// ─── 2. Son qualificatif survit — le canal doit arriver avec lui ─────────────────────────────
{
  const { err, rhs: r } = rhs('S -> <!sync1(chan:1) C4');
  ok(err.length === 0, `2. '<!sync1(chan:1)' doit compiler — reçu : ${err.map((e) => e.message || e).join(' | ')}`);
  const paires = (r[0]?.suffixQualifiers || []).flatMap((q) => q.pairs || []);
  ok(paires.some((p) => p.key === 'chan' && p.value === 1),
     `2. le CANAL doit arriver dans l'arbre avec le point d'attente — reçu : ${JSON.stringify(r[0])}`);
}

// ─── 3. Une note qui porte un point d'attente reste une NOTE ─────────────────────────────────
// Corrigé le 2026-07-26 : l'annotateur ne descendait pas dans le symbole ancré, donc `C4<!sync1`
// perdait sa nature alors que `C4` seul la portait. Un consommateur qui trie les feuilles par
// nature perdait la note sans un mot.
{
  const { rhs: r } = rhs('S -> C4<!sync1 D4');
  ok(r[0]?.type === 'SymbolWithWait', `3. la forme ancrée doit être portée — reçu : ${r[0]?.type}`);
  ok(r[0]?.symbol?.payload?.nature === 'sounding',
     `3. la note ancrée garde sa nature SOUNDING — reçu : ${JSON.stringify(r[0]?.symbol?.payload)}`);
  ok(r[0]?.triggers?.[0]?.name === 'sync1', '3. le point d\'attente reste attaché à sa note');
}

// ─── 4. TÉMOIN RETOURNÉ — il EXIGE la nature, il ne constate plus son absence ────────────────
// Ce témoin constatait un MANQUE : le point d'attente était le seul élément de RHS sans nature,
// et le vocabulaire était clos. La nature est posée depuis — `wait`, contrat BPx AST_SPEC.md:461,
// en conséquence de la décision Romain « le point d'attente doit vivre dans l'arbre ».
// On ne RETIRE pas un témoin quand le trou se comble, on le RETOURNE : il gardait l'absence,
// il garde maintenant la présence. Sinon la valeur pourrait disparaître sans que rien ne bronche.
//
// ⚠️ LE NOM DIT LE RÔLE, PAS LA GRAPHIE : `<!nom` est la surface, `Wait` le type de nœud,
// `wait` ce que le jeton EST pour le temps. Et NE PAS CONFONDRE AVEC UN SILENCE — un silence
// OCCUPE du temps, une attente le SUSPEND. Les deux se ressemblent en prose et se comportent à
// l'opposé ; c'est pourquoi `rest` aurait été le pire choix possible.
{
  const { rhs: r } = rhs('S -> <!sync1 C4');
  ok(r[0]?.payload?.nature === 'wait',
     `4. le point d'attente porte la nature 'wait' — reçu : ${JSON.stringify(r[0]?.payload)}`);
  ok(r[0]?.payload?.nature !== 'rest',
     "4. et surtout PAS 'rest' : un silence occupe le temps, une attente le suspend");
}
// Tous les éléments de RHS portent désormais une nature — plus aucun trou dans le vocabulaire.
{
  const { rhs: r } = rhs('S -> C4 - _ <!sync1 !(vel:80)');
  const sans = r.filter((e) => !e.payload || !e.payload.nature).map((e) => e.type);
  ok(sans.length === 0,
     `4. AUCUN élément de RHS ne doit rester sans nature — reçu sans nature : ${JSON.stringify(sans)}`);
}

// ─── 6. LA MATRICE — FORMES × PROPRIÉTÉS, en PRODUIT CROISÉ ─────────────────────────────────
//
// ⚠️ POURQUOI UNE MATRICE ET PAS UNE LISTE, et c'est le vrai sujet. J'ai inscrit le 2026-07-26 la
// règle « énumérer TOUTES les formes que le parser peut produire ». Je la connaissais, je l'avais
// écrite — et je l'ai repayée le lendemain. Diagnostic, mesuré sur ce fichier même : j'avais bien
// énuméré les sept formes… pour la PROPRIÉTÉ DU JOUR (la nature). Le §2, plus ancien, testait le
// sac d'annotations sur UNE seule forme. **L'énumération était une propriété de la SECTION, pas du
// garde.** Un garde grandit incident par incident, et seule la section la plus récente porte
// l'énumération complète.
//
// LA MÉCANISATION : on ne s'en remet plus à la discipline d'énumérer. Le garde CONSTRUIT le produit
// croisé de deux listes — les formes que le parser produit, les propriétés qu'un point d'attente
// peut porter. Ajouter une propriété la teste AUTOMATIQUEMENT sur les sept formes ; ajouter une
// forme teste automatiquement toutes les propriétés. Il n'y a plus rien à penser au bon moment.
const FORMES = [
  ['seule', (n, ann) => `S -> <!${n}${ann} C4`],
  ['ancrée, collée', (n, ann) => `S -> C4<!${n}${ann} D4`],
  ['ancrée, séparée par une espace', (n, ann) => `S -> C4 <!${n}${ann} D4`],
  ['double sur la même note', (n, ann) => `S -> C4<!${n}${ann}<!sync2 D4`],
  ['après un silence', (n, ann) => `S -> - <!${n}${ann} C4`],
  ['dans un groupe polymétrique', (n, ann) => `S -> {C4 <!${n}${ann}} D4`],
  ['en fin de règle', (n, ann) => `S -> C4 <!${n}${ann}`],
];
const PROPRIETES = [
  ['la nature', '', (t) => t.payload?.nature === 'wait'],
  ["le sac d'ANNOTATIONS", '(chan:1)',
    (t) => (t.suffixQualifiers || []).flatMap((q) => q.pairs || []).some((p) => p.key === 'chan' && p.value === 1)],
  // ⚠️ L'EXEMPLE A CHANGÉ deux fois. Le 2026-08-05 : `weight` est un RÉGLAGE, il s'écrit
  // désormais en PARENTHÈSES (décision Romain 2026-08-02, LANGUAGE.md:773-800) — `[weight:…]`
  // est REFUSÉ, remplacé par `rotate`. Le 2026-08-06 : `rotate` a rejoint la même liste de
  // réglages réservés (mesuré au corpus : usage FLUX uniquement, jamais en suffixe de règle —
  // sûr côté BPx, cf. lib/core.json `_qualifierKeys_doc`) — `[rotate:…]` est REFUSÉ à son tour,
  // remplacé par `rndtime` : un contrôle du sac MOTEUR resté au crochet parce qu'il porte
  // `scope:"rule"`-adjacent une lecture dédiée côté BPx (`ast.qualifiers`), non couverte par la
  // migration. Sa valeur est ici une CHAÎNE ('2', pas 2) : `core` est chargé par ce fichier,
  // donc `rndtime` — déclaré dans `lib/controls.json` — passe par le lecteur brut de
  // `libCtx.controlNames` (parser.js), pas par le lecteur numérique partagé des réglages réservés.
  // ⚠️ CE DÉCOR A MIGRÉ TROIS FOIS POUR LA MÊME RAISON — `weight` (2026-08-05), `rotate`
  // (2026-08-06), `rndtime` (2026-08-08) : chaque contrôle choisi pour illustrer « un sac collé »
  // a fini par sortir du CROCHET. La cause de fond est l'arbitrage de Romain du 2026-08-08 — le
  // crochet ne porte que ce qui gouverne la DÉRIVATION, et le tableau de ses places ne nomme
  // AUCUN crochet collé à un élément. Chercher un quatrième contrôle rejouerait la faute : le sac
  // COLLÉ vivant est la PARENTHÈSE, et c'est elle qui est mesurée ici.
  // La propriété reste la même et c'est tout l'enjeu : le sac doit être porté PAR LE POINT
  // D'ATTENTE, pas par l'assemblage qui le contient — le défaut « déplacé, pas perdu » du
  // 2026-07-27, que rien ne signale puisque rien ne manque.
  ['le sac de RÉGLAGES', '(vel:80)',
    (t) => (t.suffixQualifiers || []).flatMap((q) => q.pairs || []).some((p) => p.key === 'vel' && p.value === 80)],
  ["l'ADRESSE de sa source", '.60', (t) => t.address === 60],
  ['son NOM', '', (t) => t.name === 'sync1'],
];

const pointsDe = (rhs, out = []) => {
  if (Array.isArray(rhs)) { for (const x of rhs) pointsDe(x, out); return out; }
  if (!rhs || typeof rhs !== 'object') return out;
  if (rhs.type === 'Wait') out.push(rhs);
  for (const k of ['symbol', 'triggers', 'voices', 'elements', 'content']) if (rhs[k]) pointsDe(rhs[k], out);
  return out;
};

let cellules = 0;
for (const [nomForme, ecrire] of FORMES) {
  for (const [nomProp, annotation, verifie] of PROPRIETES) {
    cellules++;
    const { err, rhs: r } = rhs(ecrire('sync1', annotation));
    ok((err || []).length === 0,
       `6. ${nomForme} + ${nomProp} : doit compiler — reçu : ${(err || []).map((e) => e.message || e).join(' | ')}`);
    const vus = pointsDe(r).filter((t) => t.name === 'sync1');
    ok(vus.length > 0, `6. ${nomForme} + ${nomProp} : le point d'attente doit ARRIVER dans l'arbre`);
    ok(vus.some(verifie),
       `6. ${nomForme} : ${nomProp} doit être portée PAR LE POINT D'ATTENTE lui-même — reçu : `
       + `${JSON.stringify(vus)}`);
  }
}
// TÉMOIN ANTI-RÉTRÉCISSEMENT : la matrice doit rester pleine. Si quelqu'un retire une forme ou une
// propriété pour faire passer un cas gênant, le compte tombe et le garde le dit.
ok(cellules === FORMES.length * PROPRIETES.length && cellules >= 35,
   `6. la matrice doit être PLEINE — ${cellules} cellule(s) pour ${FORMES.length} forme(s) × `
   + `${PROPRIETES.length} propriété(s)`);

// ⚠️ ET LE SAC APPARTIENT AU POINT, PAS À L'ASSEMBLAGE. Mesuré le 2026-07-27 : écrit sur une forme
// ancrée, il atterrissait sur le nœud `SymbolWithWait`. Ce n'était pas une PERTE mais un
// DÉPLACEMENT — et c'est pire à sa façon : rien ne manque, donc rien ne peut le signaler.
{
  const { rhs: r } = rhs('S -> C4 <!sync1(chan:1) D4');
  ok(r[0]?.suffixQualifiers === undefined,
     `6. l'assemblage ne doit PAS porter le sac du point d'attente — reçu : ${JSON.stringify(r[0]?.suffixQualifiers)}`);
}
// Et la note garde le SIEN : le sac écrit AVANT le point d'attente appartient toujours à la note.
{
  const { rhs: r } = rhs('S -> C4(vel:80)<!sync1 D4');
  const surLaNote = (r[0]?.symbol?.suffixQualifiers || r[0]?.suffixQualifiers || [])
    .flatMap((q) => q.pairs || []).some((p) => p.key === 'vel');
  ok(surLaNote, `6. le sac écrit AVANT le point reste celui de la NOTE — reçu : ${JSON.stringify(r[0])}`);
}

// ─── 7. UNE ADRESSE MAL FORMÉE REFUSE — elle ne se DÉFAIT jamais en silence ──────────────────
//
// MESURÉ ET SIGNALÉ PAR BPx le 2026-07-27, et c'était le pire mode d'échec possible. Un point collé
// au nom mais suivi d'autre chose qu'un identifiant ou un entier ne tombait dans AUCUNE branche :
// le point restait dans le flux et la ligne se relisait en éléments FANTÔMES — `<!pedale.-1`
// devenait un point d'attente SANS ADRESSE, puis un découpage, puis un silence, puis un terminal.
// Trois éléments que personne n'a écrits, et l'adresse écrite disparue.
//
// ⚠️ POURQUOI CE N'EST PAS COSMÉTIQUE — c'est BPx qui l'a vu depuis son côté, et l'argument est
// décisif : une attente SANS adresse se lève sur N'IMPORTE QUEL événement de son rôle (c'est la
// forme voulue, celle du sustain). Une adresse qui s'évapore transforme donc une barrière PRÉCISE
// en barrière PROMISCUE : la pièce repart au premier événement venu, l'exact contraire de ce qui
// est écrit, et rien ne le dit à personne. L'aval ne peut rien rattraper — il ne distingue pas une
// attente écrite sans adresse d'une adresse évaporée. L'information est détruite au parse, donc le
// refus est au parse.
//
// ⚠️ ET C'EST UNE MATRICE, pas la graphie du ticket. BPx en a signalé DEUX ; j'énumère l'espace des
// façons dont une adresse peut être mal formée, et je vérifie que chaque refus DIT quoi écrire.
const ADRESSES_MALFORMEES = [
  ['un signe moins', 'S -> C4 <!sync1.-1 D4'],
  ['un nombre décimal', 'S -> C4 <!sync1.1.5 D4'],
  ['une chaîne', 'S -> C4 <!sync1."x" D4'],
  ['un exposant collé après l\'entier', 'S -> C4 <!sync1.1e999 D4'],
  ['un identifiant collé après l\'entier', 'S -> C4 <!sync1.60bis D4'],
];
// ⛔ « UN POINT COLLÉ PUIS UNE ESPACE » A QUITTÉ CETTE MATRICE le 2026-08-30, et c'est un
// DÉMÉNAGEMENT, pas un retrait. Ce n'est plus une adresse mal formée : c'est une faute de COLLAGE,
// et Romain l'a étendue à tout le langage — le lexeur la refuse avant que le point d'attente soit
// lu. Son témoin vit dans `un_point_se_colle_des_deux_cotes_ou_d_aucun.mjs`.
// ⚠️ LES CINQ AUTRES RESTENT ICI, ET L'EXIGENCE NE BAISSE PAS : leur point est collé des DEUX
// côtés, elles passent donc le lexeur et leur refus doit toujours parler d'ADRESSE.
for (const [quoi, regle] of ADRESSES_MALFORMEES) {
  const { err } = rhs(regle);
  const msg = (err || []).map((e) => e.message || e).join(' | ');
  ok((err || []).length > 0,
     `7. une adresse formée avec ${quoi} doit REFUSER, jamais se défaire en silence — '${regle}'`);
  ok(/adresse/i.test(msg),
     `7. et le refus doit parler d'ADRESSE, pas retomber sur un message de parse générique — reçu : ${msg.slice(0, 120)}`);
  ok(/<!sync1\.60|<!sync1\.suivant|<!sync1'|ADRESSE/.test(msg),
     `7. et DONNER la forme attendue, pas seulement constater — reçu : ${msg.slice(0, 120)}`);
}
// ⚠️ ET LES DEUX FORMES LÉGITIMES SURVIVENT — un fail-loud qui emporte le cas valide avec le cas
// fautif n'est pas une garde, c'est une régression. Le témoin est ici pour que le refus reste étroit.
for (const [quoi, regle, attendu] of [
  ["l'adresse COLLÉE des deux côtés", 'S -> C4 <!sync1.60 D4', ['SymbolWithWait', 'Symbol']],
  ['le découpage ESPACÉ des deux côtés', 'S -> C4 <!sync1 . 60 D4', ['SymbolWithWait', 'Period', 'NumericTerminal', 'Symbol']],
  ["l'attente SANS adresse", 'S -> C4 <!sync1 D4', ['SymbolWithWait', 'Symbol']],
]) {
  const { err, rhs: r } = rhs(regle);
  ok((err || []).length === 0,
     `7. ${quoi} doit rester VALIDE — reçu : ${(err || []).map((e) => e.message || e).join(' | ')}`);
  ok(r.map((e) => e.type).join(',') === attendu.join(','),
     `7. ${quoi} doit se lire tel quel — reçu : ${JSON.stringify(r.map((e) => e.type))}`);
}

if (echecs.length) {
  console.error(`❌ point d'attente : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ point d'attente dans l'arbre — ${passe} vérification(s) passée(s)`);
}
