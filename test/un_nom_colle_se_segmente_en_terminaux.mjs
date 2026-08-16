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
  // Un nom déclaré qui NE se segmente PAS reste entier : la segmentation porte sur l'alphabet.
  //
  // ⚠️ CE TÉMOIN A CHANGÉ DE SUJET LE 2026-08-16, ET LE DÉPLACEMENT EST INSTRUCTIF. Il exigeait
  // qu'un non-terminal nommé `taka` reste ENTIER — ce qui était vrai tant que la position seule
  // déclarait. La décision de Romain du même jour renverse ce cas précis : un nom SEGMENTABLE posé
  // à gauche est une suite, `taka -> dha` vaut `ta ka -> dha`. La règle que le témoin gardait n'a
  // pas disparu, son sujet a changé — elle vit maintenant sur un nom insegmentable. Effacer le
  // témoin sans le rejouer ici aurait retiré la garde de l'épargne en croyant suivre une décision.
  const nt = compiler('S -> zzz\n-----\nzzz -> dha\n');
  ok(messages(nt) === '' && JSON.stringify(noms(nt)) === JSON.stringify(['zzz']),
     `D-témoin. un NON-TERMINAL INSEGMENTABLE doit rester ENTIER — reçu ${JSON.stringify(noms(nt))} `
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

// ── F. LES DEUX CÔTÉS DE LA FLÈCHE — la segmentation gagne sur la déclaration par position ───
// Décision de Romain, 2026-08-16 (`hub/decisions/2026-08-16-un-non-terminal-se-declare-par-sa-
// position-la-casse-ne-porte-rien.md`). Un nom qui SE SEGMENTE est une suite de terminaux, à
// gauche comme à droite ; un nom qui NE se segmente pas reste déclaré par sa position.
//
// ⚠️ ET LA CASSE NE PORTE RIEN, C'EST LA MOITIÉ DU NATIF QU'ON REFUSE. Au moteur natif, une
// minuscule initiale fait un terminal et une majuscule un non-terminal. Le suivre ferait changer
// un nom de nature par un simple renommage. Le témoin sur `Zzz` garde ce refus : sans lui, une
// implémentation qui recopierait la règle native passerait tout le reste du volet.
{
  const SG = (regle) => `@core\n@alphabet.tabla\nS -> dha\n-----\n${regle}\n`;
  const lhsDe = (r, i = 1) => ((r.ast?.subgrammars?.[i]?.rules?.[0]?.lhs) || []).map((e) => e.name);

  const suite = compileToBPxAST(SG('taka -> dha'));
  ok(JSON.stringify(lhsDe(suite)) === JSON.stringify(['ta', 'ka']),
     `F. un membre gauche SEGMENTABLE devient une SUITE — 'taka -> dha' doit porter ['ta','ka'] à `
     + `gauche, reçu ${JSON.stringify(lhsDe(suite))} (${messages(suite).slice(0, 60)}).`);

  // ⛔ LE CAS DÉCISIF DE LA CASSE — un nom SEGMENTABLE à initiale MAJUSCULE.
  //
  // ⚠️ IL A FALLU LE CHERCHER, ET SON ABSENCE RENDAIT LE VOLET AVEUGLE. Mon premier témoin sur la
  // casse posait `Zzz`, qui n'est segmentable dans aucun alphabet : il est épargné de toute façon,
  // donc une implémentation qui ferait porter la nature à la casse le passait EN VERT. L'injection
  // ne mordait pas — et une injection qui ne mord pas se suspecte elle-même, jamais le code.
  // `C4D4` sous alphabet occidental départage : deux notes collées, initiale majuscule. Il DOIT se
  // segmenter, ce qu'une règle fondée sur la casse refuserait.
  const casse = compileToBPxAST('@core\n@alphabet.western\nS -> E4\n-----\nC4D4 -> E4\n');
  ok(JSON.stringify(lhsDe(casse)) === JSON.stringify(['C4', 'D4']),
     `F. la CASSE ne porte rien : 'C4D4 -> E4' est SEGMENTABLE malgré sa majuscule initiale et doit `
     + `porter ['C4','D4'], reçu ${JSON.stringify(lhsDe(casse))}. C'est la moitié du natif qu'on `
     + `refuse — au moteur, une majuscule ferait un non-terminal.`);

  for (const [quoi, nom] of [['minuscule', 'zzz'], ['MAJUSCULE', 'Zzz']]) {
    const r = compileToBPxAST(SG(`${nom} -> dha`));
    ok(messages(r) === '' && JSON.stringify(lhsDe(r)) === JSON.stringify([nom]),
       `F. un membre gauche INSEGMENTABLE reste un non-terminal, ${quoi} comprise — '${nom}' doit `
       + `rester entier, reçu ${JSON.stringify(lhsDe(r))}. La casse ne porte rien : la faire porter `
       + `ferait changer un nom de nature par un simple renommage.`);
  }

  // Un membre gauche peut porter PLUSIEURS éléments, et la passe ne doit pas y toucher.
  const multi = compileToBPxAST(SG('na V V -> dha'));
  ok(JSON.stringify(lhsDe(multi)) === JSON.stringify(['na', 'V', 'V']),
     `F. un membre gauche à plusieurs termes reste intact — reçu ${JSON.stringify(lhsDe(multi))}.`);

  // ⚠️ LE TÉMOIN QUI COMPTE : un nom segmentable ne peut PLUS servir de non-terminal. C'est le coût
  // de la décision, et il doit se voir — mesuré sur le corpus avant de graver : UNE ligne, `trkt`
  // dans `dhati2`, et sa conversion garde le compte des unités des deux côtés.
  const perdu = compileToBPxAST(`@core\n@alphabet.tabla\nS -> taka\n-----\ntaka -> dha\n`);
  const rhs0 = ((perdu.ast?.subgrammars?.[0]?.rules?.[0]?.rhs) || []).map((e) => e.name);
  ok(JSON.stringify(rhs0) === JSON.stringify(['ta', 'ka']),
     `F-témoin. 'taka' posé à gauche ne le déclare plus : son emploi à DROITE se segmente aussi. `
     + `Reçu ${JSON.stringify(rhs0)}. S'il restait entier, un même nom serait une suite d'un côté `
     + `et un nom de l'autre.`);
}

// ── G. L'ARBRE NE PORTE AUCUNE TRACE DE LA PASSE — ce que j'expose est déclaré ───────────────
// ⚠️ LA PASSE A POSÉ DEUX CHAMPS SUR LES NŒUDS AVANT D'ÊTRE RELUE : `segmenteDe` sur chaque nœud
// issu d'un découpage, `resteDeSegmentation` sur un nom refusé. Les deux SORTAIENT dans l'arbre
// livré à BPx et Kairos — une surface publiée que ni `AST.md` ni `LANGUAGE.md` ne décrivent. Un
// champ qui traverse la frontière sans y être déclaré est une interface qu'on ne contrôle pas.
// Le reste inconsommé vit maintenant hors des nœuds, et le refus le nomme toujours.
{
  const CHAMPS = ['segmenteDe', 'resteDeSegmentation'];
  const parcourir = (r) => {
    const vus = new Set();
    const w = (el) => {
      if (!el || typeof el !== 'object') return;
      if (Array.isArray(el)) { el.forEach(w); return; }
      for (const c of CHAMPS) if (c in el) vus.add(c);
      for (const k of ['voices', 'elements', 'content', 'symbol', 'triggers', 'primary', 'secondaries']) w(el[k]);
    };
    for (const sg of r.ast?.subgrammars || []) for (const rg of sg.rules || []) { w(rg.rhs); w(rg.lhs); }
    return vus;
  };
  for (const [quoi, source] of [
    ['un nom découpé',   'S -> taka\n'],
    ['un membre gauche', 'S -> dha\n-----\ntaka -> dha\n'],
    ['un nom refusé',    'S -> dhaXY\n'],
  ]) {
    const vus = parcourir(compiler(source));
    ok(vus.size === 0,
       `G. ${quoi} — l'arbre porte ${JSON.stringify([...vus])}, un champ que la frontière ne déclare `
       + `pas. La trace de la passe reste chez la passe.`);
  }

  // ⚠️ ET LA MOITIÉ QUI EMPÊCHE DE « RÉPARER » EN JETANT L'INFORMATION : le refus doit toujours
  // nommer le reste. Sortir le champ de l'arbre sans le conserver ailleurs rendrait ce volet vert
  // et le message muet.
  ok(/segmentation bloquée sur 'XY'/.test(messages(compiler('S -> dhaXY\n'))),
     `G. le refus nomme toujours le reste alors que l'arbre n'en porte rien — sinon l'information a `
     + `été jetée au lieu d'être déplacée.`);
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(passe >= 41, `SOCLE : ${passe} vérifications seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ un nom collé se segmente en terminaux : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ La segmentation suit le natif — plus long préfixe, glouton, SANS retour arrière `
          + `(cas décisif sur alphabet fabriqué), branchée AVANT la validation, descendue dans les `
          + `six contenants du parseur, et confinée à UN alphabet — un mot à cheval est refusé. Elle `
          + `vaut DES DEUX CÔTÉS de la flèche et gagne sur la déclaration par position, sans que la `
          + `CASSE porte rien. Elle `
          + `épargne les noms déclarés et les terminaux, et son refus nomme le RESTE inconsommé. `
          + `${passe} vérification(s) passée(s).`);
