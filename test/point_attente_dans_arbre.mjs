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
  const o = compileToBPxAST(`@core\n@controls\n@alphabet.western:midi\n@trigger sync1:midi\n@mode:ord\n${regle}\n`);
  return { err: o.errors || [], rhs: o.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [] };
};

// ─── 1. Le point d'attente est un ÉLÉMENT, à sa position ─────────────────────────────────────
{
  const { err, rhs: r } = rhs('S -> <!sync1 C4 D4');
  ok(err.length === 0, `1. '<!sync1' doit compiler — reçu : ${err.map((e) => e.message || e).join(' | ')}`);
  ok(r[0]?.type === 'TriggerIn' && r[0]?.name === 'sync1',
     `1. il doit être le PREMIER élément du RHS, pas une sentinelle ni un oubli — reçu : ${JSON.stringify(r.map((e) => e.type))}`);
  ok(r.length === 3, `1. il ne doit ni remplacer ni absorber ce qui suit — reçu ${r.length} éléments`);
}
{
  const { rhs: r } = rhs('S -> -<!sync1 C4 D4');
  ok(r.map((e) => e.type).join(',') === 'Rest,TriggerIn,Symbol,Symbol',
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
  ok(r[0]?.type === 'SymbolWithTriggerIn', `3. la forme ancrée doit être portée — reçu : ${r[0]?.type}`);
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
// ⚠️ LE NOM DIT LE RÔLE, PAS LA GRAPHIE : `<!nom` est la surface, `TriggerIn` le type de nœud,
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

// ─── 6. TOUTES LES FORMES QUE LE PARSER PRODUIT, pas seulement celle du jour ─────────────────
// Mesuré par BPx le 2026-07-27 : l'attente ANCRÉE (`C4<!sync1`) n'avait pas de nature. Le §4
// ci-dessus ne l'attrapait pas — il n'inspectait que le premier niveau du membre droit, et une
// attente ancrée vit SOUS un `SymbolWithTriggerIn`. C'est la même faute que les trois gardes
// précédentes : écrite pour la forme signalée, aveugle à la construction.
//
// ⚠️ ET CE N'EST PAS UN CAS DE BORD : le parser ancre l'attente sur le symbole qui précède MÊME
// séparée par une espace — `C4 <!sync1` produit un `SymbolWithTriggerIn`, exactement comme
// `C4<!sync1`. Donc toute attente précédée d'une note tombait dans le trou, soit l'écriture
// courante. D'où l'énumération : attente seule, collée, espacée, multiple, qualifiée, sous
// silence, sous groupe polymétrique.
//
// Le wrapper `SymbolWithTriggerIn` ne porte PAS de nature et n'en portera pas : ce n'est pas une
// feuille, c'est un assemblage. Ses deux parts en portent une chacune, et ce sont elles qu'on
// observe. On descend donc jusqu'aux feuilles au lieu de compter des voisins de surface.
{
  const feuilles = (n, out = []) => {
    if (Array.isArray(n)) { for (const x of n) feuilles(x, out); return out; }
    if (!n || typeof n !== 'object') return out;
    if (n.type === 'TriggerIn') out.push(n);
    for (const k of ['symbol', 'triggers', 'voices', 'elements', 'content', 'items']) {
      if (n[k]) feuilles(n[k], out);
    }
    return out;
  };
  for (const [regle, quoi] of [
    ['S -> <!sync1 C4', 'attente SEULE'],
    ['S -> C4<!sync1 D4', 'attente ANCRÉE, collée'],
    ['S -> C4 <!sync1 D4', "attente ANCRÉE par une espace — le parser l'ancre quand même"],
    ['S -> C4<!sync1<!sync2 D4', 'DEUX attentes sur la même note'],
    ['S -> C4<!sync1(chan:1) D4', 'attente ancrée AVEC son canal'],
    ['S -> - <!sync1', 'attente après un silence'],
    ['S -> {C4 <!sync1} D4', 'attente DANS un groupe polymétrique'],
  ]) {
    const { err, rhs: r } = rhs(regle);
    const trouvees = feuilles(r);
    ok((err || []).length === 0 && trouvees.length > 0,
       `6. ${quoi} : l'attente doit ARRIVER dans l'arbre — '${regle}'`);
    const nues = trouvees.filter((t) => t.payload?.nature !== 'wait');
    ok(nues.length === 0,
       `6. ${quoi} : CHAQUE attente porte 'wait', à quelque profondeur qu'elle vive — ${nues.length} nue(s) sur ${trouvees.length} dans '${regle}'`);
  }
}

if (echecs.length) {
  console.error(`❌ point d'attente : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ point d'attente dans l'arbre — ${passe} vérification(s) passée(s)`);
}
