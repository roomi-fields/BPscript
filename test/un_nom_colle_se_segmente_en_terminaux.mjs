#!/usr/bin/env node
/**
 * UN NOM COLLÉ SE SEGMENTE EN TERMINAUX — plus long préfixe, glouton, sans retour arrière.
 *
 * `dhagenateena` n'est pas un mot : c'est une suite de bols écrite sans espaces. La segmentation
 * la dissout AVANT que la grammaire travaille, et le nom collé n'est donc un mot pour personne.
 *
 * ⛔ TOUT CE QUI EST GARDÉ ICI EST MESURÉ SUR LE BINAIRE NATIF par bp3-engine (md5 372dd047), sur
 * les 38 fichiers d'alphabet du corpus qui se chargent. Rien n'y est déduit d'une ressemblance.
 *
 * ⚠️ LE CAS DÉCISIF A DÛ ÊTRE FABRIQUÉ, et c'est la leçon de méthode de ce garde. Sur `dhati`, les
 * dix bols ne sont JAMAIS préfixes l'un de l'autre : tout algorithme — glouton, avec ou sans retour
 * arrière — y donne le même résultat. Le corpus entier ne pouvait donc pas départager. Il a fallu
 * un alphabet `{ta, tak, ka}` écrit pour l'occasion : `taka` y échoue là où un retour arrière
 * aurait réussi. **Un corpus qui ne distingue pas deux implémentations ne prouve ni l'une ni
 * l'autre** — c'est ce que le volet A garde, et lui seul.
 *
 * ⚠️ ET IL SE GARDE EN DEUX ÉTAGES, PARCE QUE LES DEUX PEUVENT DIVERGER. Le volet A éprouve la
 * RÈGLE sur un alphabet fabriqué ; le volet B éprouve qu'elle est BRANCHÉE dans le pipeline, sur
 * une scène réelle. Une règle juste que rien n'appelle reste verte des deux côtés.
 */
import { segmenter } from '../src/transpiler/segmentation.js';
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compiler = (corps) => {
  try { return compileToBPxAST(`@core\n@alphabet.tabla\n${corps}`); }
  catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');
const noms = (r, i = 0) => ((r.ast?.subgrammars?.[i]?.rules?.[0]?.rhs) || []).map((e) => e.name);

// ── A. LA RÈGLE — plus long préfixe, glouton, SANS RETOUR ARRIÈRE ────────────────────────────
// L'alphabet fabriqué de bp3-engine, et la mesure native mot pour mot.
{
  const A = new Set(['ta', 'tak', 'ka']);
  const CAS = [
    ['le cas décisif : glouton gagne',   'takka', ['tak', 'ka'], null],
    ['le cas décisif : PAS de retour',   'taka',  null,          'a'],
    ['un terminal seul ne se touche pas','ta',    null,          null],
    ['deux terminaux courts',            'taka'.replace('taka', 'kaka'), ['ka', 'ka'], null],
    ['un préfixe inconnu refuse d\'emblée', 'zta', null,         'zta'],
  ];
  for (const [quoi, nom, parts, reste] of CAS) {
    const r = segmenter(nom, A);
    const vus = r?.parts ?? null;
    ok(JSON.stringify(vus) === JSON.stringify(parts),
       `A. ${quoi} — '${nom}' doit rendre ${JSON.stringify(parts)}, reçu ${JSON.stringify(vus)}. `
       + `Un algorithme qui rebrousse chemin lit 'taka' comme 'ta ka' et diverge du natif ICI, `
       + `et NULLE PART ailleurs dans le corpus.`);
    ok((r?.reste ?? null) === reste,
       `A. ${quoi} — le reste non consommé doit être ${JSON.stringify(reste)}, reçu `
       + `${JSON.stringify(r?.reste ?? null)}. C'est LUI que le refus doit nommer, pas le mot.`);
  }
}

// ── B. ELLE EST BRANCHÉE — sur une scène réelle, à travers le compilateur ────────────────────
// ⚠️ LE VOLET QUI COMPTE. La règle du volet A peut être parfaite et n'être appelée par personne :
// abonné des deux côtés et branché nulle part reste vert de bout en bout.
{
  const r = compiler('S -> taka\n');
  ok(messages(r) === '', `B. 'taka' doit être ACCEPTÉ sous l'alphabet tabla — reçu : ${messages(r).slice(0, 90)}`);
  ok(JSON.stringify(noms(r)) === JSON.stringify(['ta', 'ka']),
     `B. 'taka' doit rendre DEUX nœuds ['ta','ka'], reçu ${JSON.stringify(noms(r))}. Un seul nœud `
     + `signifie que la passe n'est pas appelée par le pipeline.`);

  // ⚠️ ET ELLE PASSE AVANT LA VALIDATION. Si l'ordre s'inversait, la scène serait refusée sur un
  // nom que la segmentation sait lire — le vert ci-dessus est aussi celui de l'ordre des passes.
  ok(messages(compiler('S -> tadha\n')) === '',
     `B. l'ordre des passes : 'tadha' est refusé, donc la validation tourne AVANT la segmentation.`);
}

// ── C. LA MATRICE DES CONTENANTS — toutes les sections où le parseur pose un terminal ────────
// ⚠️ ÉCRITE POUR L'ESPACE, PAS POUR LA FORME QUI S'EST MONTRÉE. Le validateur d'à côté a payé
// exactement cette faute : sa boucle ne lisait que le premier niveau, et un terminal inconnu placé
// dans un GROUPE passait sans un mot. Une passe qui transforme l'arbre a le même espace à couvrir,
// et une liste de cas vus n'est pas une matrice.
{
  const CONTENANTS = [
    ['au premier niveau',        'S -> taka\n'],
    ['dans un GROUPE',           'S -> {taka}\n'],
    ['dans une POLYMÉTRIE',      'S -> {taka, dha}\n'],
    ['après un SILENCE',         'S -> - taka\n'],
    ['sur un ÉVÉNEMENT SIMULTANÉ', 'S -> dha!taka\n'],
    ['dans une SOUS-GRAMMAIRE',  'S -> dha\n-----\ndha -> taka\n'],
  ];
  for (const [quoi, source] of CONTENANTS) {
    const r = compiler(source);
    ok(messages(r) === '', `C. ${quoi} — REFUSÉ : ${messages(r).slice(0, 90)}`);
    if (messages(r)) continue;
    const noeuds = [];
    const descendre = (el) => {
      if (!el || typeof el !== 'object') return;
      if (Array.isArray(el)) { el.forEach(descendre); return; }
      if (el.type === 'Symbol' && el.name) noeuds.push(el.name);
      for (const k of ['voices', 'elements', 'content', 'symbol', 'triggers', 'primary', 'secondaries']) descendre(el[k]);
    };
    (r.ast?.subgrammars || []).forEach((sg) => (sg.rules || []).forEach((rg) => descendre(rg.rhs)));
    ok(noeuds.includes('ta') && noeuds.includes('ka') && !noeuds.includes('taka'),
       `C. ${quoi} — 'taka' doit être DISSOUS en 'ta' et 'ka' jusque dans ce contenant. Noms vus : `
       + `${JSON.stringify(noeuds)}. Un contenant que la passe ne descend pas garde le nom collé, `
       + `et la scène joue un terminal qui n'existe pour personne.`);
  }
}

// ── D. LES TÉMOINS QUI MORDENT — ce que la passe doit ÉPARGNER et REFUSER ────────────────────
// ⚠️ SANS EUX, UNE PASSE QUI DÉCOUPE TOUT PASSERAIT LES TROIS VOLETS EN TRIOMPHE.
{
  // Un nom DÉCLARÉ n'est pas un mot collé : le découper le ferait disparaître de sa grammaire.
  const nt = compiler('S -> taka\n-----\ntaka -> dha\n');
  ok(messages(nt) === '' && JSON.stringify(noms(nt)) === JSON.stringify(['taka']),
     `D-témoin. un NON-TERMINAL nommé 'taka' doit rester ENTIER — reçu ${JSON.stringify(noms(nt))} `
     + `(${messages(nt).slice(0, 60)}). La segmentation porte sur l'alphabet, pas sur les noms `
     + `qu'une grammaire s'est donnés.`);

  // Un terminal DÉCLARÉ ne se redécoupe pas, même si ses lettres se segmentent.
  const t = compiler('S -> dhagena\n');
  ok(JSON.stringify(noms(t)) === JSON.stringify(['dhagena']),
     `D-témoin. 'dhagena' est un terminal de l'alphabet : il reste UN nœud. Reçu `
     + `${JSON.stringify(noms(t))}. Un terminal qu'on redécoupe perd sa voix déclarée.`);

  // Le refus NOMME LE RESTE, pas le mot — « Can't make sense of "a" » sur le natif.
  for (const [nom, reste] of [['dhaXY', 'XY'], ['dhagenaZ', 'Z']]) {
    const msg = messages(compiler(`S -> ${nom}\n`));
    ok(new RegExp(`segmentation bloquée sur '${reste}'`).test(msg),
       `D-témoin. '${nom}' doit REFUSER en nommant le reste '${reste}'. Reçu : ${msg.slice(0, 110)}. `
       + `Nommer le mot entier envoie chercher un terminal qui n'a jamais eu à exister.`);
  }

  // Un nom qu'AUCUN préfixe n'entame refuse sans parler de segmentation.
  ok(/absent des alphabets en portée/.test(messages(compiler('S -> zzz\n')))
     && !/segmentation bloquée/.test(messages(compiler('S -> zzz\n'))),
     `D-témoin. 'zzz' n'entame aucun terminal : le refus reste celui d'un terminal inconnu, sans `
     + `invoquer une segmentation qui n'a rien commencé.`);
}

// ── E. ELLE NE TRAVERSE PAS LES ALPHABETS — un mot tient dans UN vocabulaire ─────────────────
// Décision de Romain, 2026-08-16 : un mot se segmente ENTIÈREMENT dans un seul alphabet.
//
// ⚠️ CE VOLET GARDE UN DÉFAUT QUI A VÉCU DANS LA PREMIÈRE LIVRAISON. La passe travaillait sur
// l'UNION des terminaux en portée — la même que la validation consulte — et `taC4` s'y lisait `ta`
// (tabla) + `C4` (occidental) : un mot construit avec des morceaux de deux langues. L'union répond
// à « ce nom est-il connu » ; la segmentation pose une autre question, « ce mot tient-il dans un
// vocabulaire », et la même donnée ne répond pas aux deux.
{
  const DEUX = '@core\n@actor perc alphabet.tabla\n@actor lahra alphabet.western\n';
  const cheval = compileToBPxAST(`${DEUX}S -> taC4\n`);
  ok((cheval.errors || []).length > 0,
     `E. un mot À CHEVAL sur deux alphabets doit être REFUSÉ — 'taC4' mêle un bol et une note. `
     + `Reçu : ${JSON.stringify(((cheval.ast?.subgrammars?.[0]?.rules?.[0]?.rhs) || []).map((x) => x.name))}.`);

  // ⚠️ ET L'AUTRE MOITIÉ : refuser la traversée ne doit pas fermer la segmentation quand DEUX
  // alphabets sont en portée. Sans ce témoin, une passe qui abandonnerait des qu'il y a deux
  // alphabets passerait la ligne du dessus en triomphe.
  const propre = compileToBPxAST(`${DEUX}S -> taka\n`);
  ok((propre.errors || []).length === 0
     && JSON.stringify(((propre.ast?.subgrammars?.[0]?.rules?.[0]?.rhs) || []).map((x) => x.name)) === JSON.stringify(['ta', 'ka']),
     `E. avec DEUX alphabets en portée, un mot qui tient dans UN d'eux se segmente quand même — `
     + `'taka' doit rendre ['ta','ka']. Reçu ${JSON.stringify(((propre.ast?.subgrammars?.[0]?.rules?.[0]?.rhs) || []).map((x) => x.name))} `
     + `(${messages(propre).slice(0, 60)}).`);
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(passe >= 32, `SOCLE : ${passe} vérifications seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ un nom collé se segmente en terminaux : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ La segmentation suit le natif — plus long préfixe, glouton, SANS retour arrière `
          + `(cas décisif sur alphabet fabriqué), branchée AVANT la validation, descendue dans les `
          + `six contenants du parseur, et confinée à UN alphabet — un mot à cheval est refusé. Elle `
          + `épargne les noms déclarés et les terminaux, et son refus nomme le RESTE inconsommé. `
          + `${passe} vérification(s) passée(s).`);
