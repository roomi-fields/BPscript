#!/usr/bin/env node
// ⛔ MIGRE LE 2026-08-22 : une librairie s invoque par le mot qu elle DECLARE, jamais par le nom
// de son fichier (decision de Romain du 2026-08-17, frappee ce jour). `temperaments` →
// `temperament`, `test_alphabets` → `alphabet`, `voices` → `voice`, `tunings` → `tuning`,
// `scales` → `scale`, `sounds` → `sound`, `alphabets` → `alphabet`.
/**
 * LE NOM D'UNE ENTRÉE DE LIBRAIRIE PEUT COMMENCER PAR UN CHIFFRE.
 *
 * Romain, 2026-08-23 : un nom qui commence par un chiffre porte AU MOINS UNE LETTRE.
 * `12TET` et `22shruti` sont des noms, `12` est un nombre. Les accordages et les tempéraments
 * portent des noms d'usage qui commencent par leur nombre de degrés.
 *
 * ⛔ LA CLAUSE SE POSE AU PARSEUR, ET UNE MESURE LE DIT. La décision écrivait : « si le tokenizer
 * rend `12TET` et `12` sous le même jeton, la clause se pose chez lui ». Mesuré le 2026-08-24 :
 * `12TET` sort en DEUX jetons — `INT(12)` puis `IDENT(TET)` — et `12` en un seul. Il les distingue
 * déjà ; c'est le RECOLLAGE qui décide, et il vit dans le lecteur de nom.
 *
 * ⛔ C'EST UNE PRODUCTION DISTINCTE, PAS UN `IDENT` ÉLARGI. `IDENT` sert aussi aux acteurs et aux
 * terminaux ; la production `NOM_DECLARE` ne vaut qu'aux places où un nom se DÉCLARE, et l'acteur
 * n'en fait pas partie — volet C3.
 *
 * ⚠️ ET LA LECTURE EXISTAIT DÉJÀ, EN UN EXEMPLAIRE MAL PLACÉ. Le canal de provenance
 * (`@factory.`/`@mine.`) la portait — son commentaire nommait `12TET` et `22shruti` — et
 * l'invocation DIRECTE ne l'avait pas. Une garde de Kairos passait donc par la provenance pour
 * atteindre un tempérament, faute d'autre voie. Les deux lisent maintenant par la même fonction ;
 * le volet D garde ce partage, parce que deux lecteurs d'un même nom divergent au premier ajout.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');
const compiler = (tete) => {
  try { return compileToBPxAST(`core\n${tete}\n-----\nS -> C4\n`); }
  catch (e) { return { errors: [{ message: e.message }] }; }
};

// ── A. LES ENTRÉES À CHIFFRE DE LA DONNÉE — toutes atteignables ──────────────────────────────
// ⚠️ LA LISTE EST MESURÉE SUR LE BUNDLE, jamais écrite ici : une entrée ajoutée demain est
// couverte le jour même, et une entrée retirée ne laisse pas un cas fantôme.
{
  const aChiffre = [];
  for (const [lib, f] of Object.entries(LIBS)) {
    if (!f || typeof f !== 'object') continue;
    for (const k of Object.keys(f)) if (/^[0-9]/.test(k)) aChiffre.push([lib, k]);
  }
  ok(aChiffre.length > 0,
     `A. aucune entrée à chiffre dans le bundle — le garde serait creux. S'il n'y en a plus, c'est `
     + `la donnée qui a changé, et ce garde doit le dire au lieu de verdir sur zéro.`);
  // ⛔ L ADRESSE EST LE MOT DECLARE, PLUS LE NOM DU FICHIER (2026-08-22). La boucle lisait
  // `Object.entries(LIBS)`, donc elle ecrivait `temperaments.12TET` — l adresse PHYSIQUE, qui vient
  // d etre fermee. Le nom du fichier ne se lit plus dans une scene ; ce qui s y ecrit est ce que la
  // librairie DECLARE.
  for (const [lib, entree] of aChiffre) {
    const mot = (LIBS[lib] && LIBS[lib].resolves) || lib;
    const r = compiler(`${mot}.${entree}`);
    ok(messages(r) === '',
       `A. '${mot}.${entree}' doit être ACCEPTÉ — reçu : ${messages(r).slice(0, 90)}`);
  }
}

// ── B. UNE ENTRÉE INCONNUE EST REFUSÉE POUR SON ABSENCE, PAS POUR SA FORME ───────────────────
// ⚠️ LE TÉMOIN QUI COMPTE : sans lui, une lecture qui avalerait n'importe quoi passerait le volet
// A en triomphe. Le refus doit NOMMER l'entrée manquante — s'il parlait de forme, il enverrait
// l'auteur corriger une graphie qui est juste.
{
  const msg = messages(compiler('temperament.12zzz'));
  ok(/12zzz/.test(msg),
     `B. 'temperament.12zzz' doit REFUSER en nommant l'entrée absente. Reçu : ${msg.slice(0, 100) || 'aucune erreur'}`);
  ok(!/Expected/.test(msg),
     `B. le refus ne doit PAS être une faute de forme — reçu : ${msg.slice(0, 100)}. La graphie est `
     + `valide ; c'est l'entrée qui n'existe pas.`);
}

// ── C. LA MATRICE — chaque PLACE où un nom se DÉCLARE × chaque forme de NOM ─────────────────
// ⛔ CE VOLET DISAIT L'INVERSE, ET LA DÉCISION DU 2026-08-23 L'A RETOURNÉ. Il gardait que la
// production « ne vaut QUE pour un nom d'entrée » — un état antérieur, où l'invocation acceptait
// le chiffre et la déclaration le refusait. Romain a tranché la règle générale : *« un nom peut
// commencer par un chiffre s'il contient au moins une lettre »*, et son état d'avant cite
// `interval 12TET` — une DÉCLARATION.
//
// ⚠️ ET LE NOM SE DÉCLARE À QUATRE POINTS, PAS UN : `def`, la déclaration par le type, sa garde de
// reconnaissance, et le nom SUIVANT d'une liste (`symbol a12, 12TET`). Une liste aurait vérifié
// celui qui a mordu ; la matrice croise les places avec les noms de la donnée.
{
  const PLACES = [
    ['def',              (n) => `def ${n} (x:1)`],
    // ⛔ LA LIGNE `object` EST SORTIE LE 2026-09-02 AVEC LE MOT — décision de Romain, `def` est le mot
    // unique. La place qu'elle éprouvait — un nom chiffré en tête de déclaration de racine — est
    // désormais celle de la ligne `def` juste au-dessus : ce n'est plus deux points, c'est un seul.
    ['symbol seul',      (n) => `symbol ${n}`],
    ['symbol, 2e nom',   (n) => `symbol a12, ${n}`],
    ['symbol, 1er nom',  (n) => `symbol ${n}, a12`],
    ['valeur',           (n) => `def w (t:${n})`],
    ['clé texte',        (n) => `def w ("${n}":1)`],
  ];
  for (const [place, forme] of PLACES) {
    for (const n of ['12TET', '22shruti', '53TET', '24TET']) {
      const msg = messages(compiler(forme(n)));
      ok(msg === '', `C. « ${forme(n)} » doit compiler (${place}) : ${msg.slice(0, 70)}`);
    }
  }
}

// ── C2. ⛔ LA CLAUSE — un nombre pur n'est PAS un nom, et le refus le DIT ────────────────────
// Sans ce volet, « les noms chiffrés passent » ne se distingue pas de « le lecteur a cessé de
// distinguer un nom d'un nombre ». C'est la seule ambiguïté que la clause ferme.
{
  // `object 7 (x:1)` éprouvait la même clause par le mot `object`, sorti le 2026-09-02.
  for (const [place, tete] of [['def', 'def 12 (x:1)'], ['def, 2e forme', 'def 7 (x:1)'],
                               ['symbol', 'symbol a, 12']]) {
    ok(messages(compiler(tete)) !== '',
       `C2. « ${tete} » doit être REFUSÉ (${place}) — un nombre pur n'est pas un nom.`);
  }
  const msg = messages(compiler('symbol a, 12'));
  ok(/au moins une lettre/.test(msg),
     `C2. le refus doit NOMMER la clause — reçu : ${msg.slice(0, 90)}. Un « Expected IDENT » `
     + `envoie corriger une graphie au lieu de dire la règle.`);
}

// ── C3. L'ACTEUR EST UNE PLACE COMME LES AUTRES ─────────────────────────────────────────────
// ⛔ CE VOLET GARDAIT L'INVERSE, ET IL A BASCULÉ SUR UN MOT DE L'ARCHITECTE. J'avais laissé
// l'acteur refusé en remontant l'écart plutôt qu'en le tranchant : la décision cite des
// déclarations par le type et ne nomme pas l'acteur. Sa réponse : elle dit « un NOM », et elle
// cite ces formes parce que c'est ce que la mesure du jour avait sous la main — elle ne restreint
// rien. C'est la PORTÉE, pas l'exemple, pour la cinquième fois de la semaine.
{
  for (const [quoi, tete] of [
    ['nom d\'acteur',          'actor 12lead alphabet.western'],
    ['nom d\'acteur, 2 clés',  'actor 1perc alphabet.western out.midi'],
  ]) {
    ok(messages(compiler(tete)) === '',
       `C3. ${quoi} — « ${tete} » doit compiler : ${messages(compiler(tete)).slice(0, 70)}`);
  }
  // Et la clause vaut ici aussi : un nombre pur ne nomme pas un acteur.
  ok(messages(compiler('actor 12 alphabet.western')) !== '',
     `C3. « actor 12 » doit être REFUSÉ — un nombre pur n'est pas un nom, à cette place comme aux `
     + `autres. Si ce volet passe au vert, la clause a sauté au lieu de s'étendre.`);
  // ⛔ ET LE TÉMOIN QUI DISCRIMINE : le nom QUALIFIÉ d'un acteur ne doit pas avoir été mangé par
  // le lecteur de nom, qui recolle les jetons collés. Sans lui, « les chiffres passent » ne se
  // distingue pas de « le point a cessé de porter la dérivation ».
  const r = compiler('actor midi.actor(ch:1)');
  ok(messages(r) === '', `C3-témoin. le nom QUALIFIÉ doit rester lisible — ${messages(r).slice(0, 70)}`);
}

// ── D-bis. LE NOM DE LA LIBRAIRIE PORTE AUSSI UN TIRET ──────────────────────────────────────
// ⚠️ TROUVE PAR KANOPI EN RETIRANT LE PREFIXE DE PROVENANCE, qui le masquait. Le tokenizer detache
// le tiret partout depuis qu'il est un SILENCE dans le flux ; dans un nom de librairie il est une
// lettre. `ragas-tuning.X` cassait a l'ANALYSE — « Expected arrow, got PERIOD » — au lieu d'etre
// LU puis refuse pour son axe. La difference compte : un refus syntaxique envoie corriger une
// graphie juste.
{
  // ⚠️ CE NOM EST INVENTE ET IL PORTE UN `s` FINAL — mon remplacement global de `tunings.` en
  // `tuning.` le lui avait mange, pendant que la chaine ATTENDUE juste en dessous gardait le sien :
  // le volet accusait alors un ecart qu il venait de creer. Un renommage global se fait du plus
  // LONG au plus COURT, et celui-la contenait le motif.
  const msg = messages(compiler('ragas-tunings.sargam_12TET'));
  ok(!/Expected/.test(msg),
     `D-bis. 'ragas-tunings.X' doit etre LU, pas casser a l'analyse. Reçu : ${msg.slice(0, 100)}. `
     + `Un refus syntaxique sur un nom valide envoie l'auteur corriger ce qui est juste.`);
  ok(/aucune librairie ne sert l'axe 'ragas-tunings'/.test(msg),
     `D-bis. le refus doit nommer l'axe ENTIER, tiret compris — reçu : ${msg.slice(0, 100)}. `
     + `S'il nomme 'ragas' seul, le tiret a coupe le nom.`);
}

// ── D. UN SEUL LECTEUR — la voie directe et le canal de provenance lisent pareil ─────────────
// ⚠️ CE VOLET GARDE LA CAUSE, PAS LE SYMPTÔME. La lecture vivait dans le canal de provenance et
// manquait à la voie directe : deux endroits pour un même nom, un seul qui savait le lire.
{
  const direct = compiler('temperament.12TET');
  const provenance = compiler('temperament.12TET');
  ok(messages(direct) === '' && messages(provenance) === '',
     `D. les deux voies doivent lire le même nom — direct : ${messages(direct).slice(0, 50) || 'ok'} · `
     + `provenance : ${messages(provenance).slice(0, 50) || 'ok'}. Si l'une passe et pas l'autre, `
     + `il reste deux lecteurs.`);
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(passe >= 30, `SOCLE : ${passe} vérifications seulement — la matrice s'est vidée sans rougir.`);


// ─── H. LE REFUS ENSEIGNE LE CRITÈRE, ET LA TRONCATURE SE DIT ────────────────────────────────
// ⛔ UNE RÈGLE DU LANGAGE HABITE TROIS SURFACES : la spécification, le REFUS qui l'applique, le
// garde qui la tient. La troisième — celle qu'un auteur lit vraiment — ne portait AUCUN critère :
// `def _ab`, `def 12`, `def #a` et `def "ab"` rendaient le MÊME texte, « doit nommer ce qu'il
// définit », qui n'apprend pas ce qui fait un nom. Geste ouvert par l'architecte le 2026-08-24,
// après contre-mesure d'Atlas : écrire ce que le code applique déjà n'est pas définir une règle.
//
// ⛔ ET UN CAS COUPE LE NOM. `def ab_` cite `'def ab'` — le nom LU, pas le nom ÉCRIT. L'auteur relit
// sa ligne, y voit son nom entier, et cherche la faute dans le corps. Le message doit dire OÙ le nom
// s'est arrêté et QUEL signe l'a arrêté.
{
  const refuseAvecCritere = ['_ab', '12', '#a', '-ab', '"ab"', '$a'];
  for (const n of refuseAvecCritere) {
    const msg = messages(compileToBPxAST(`def ${n} (x:1)`));
    ok(/UN NOM COMMENCE PAR UNE LETTRE/.test(msg) && /12TET/.test(msg),
       `H. 'def ${n}' doit REFUSER en disant ce qui fait un nom — reçu : ${msg.slice(0, 120) || 'aucune erreur'}`);
    ok(/Reçu :/.test(msg),
       `H. et le refus doit citer LE SIGNE reçu, sinon l'auteur ne sait pas lequel de ses caractères `
       + `est en cause — reçu : ${msg.slice(0, 120)}`);
  }
  // ⚠️ LA TRONCATURE : le nom lu, le signe qui l'a arrêté, tous deux nommés.
  for (const [n, lu, signe] of [['ab_', 'ab', '_'], ['a.b', 'a', '.'], ['a$', 'a', '$']]) {
    const msg = messages(compileToBPxAST(`def ${n} (x:1)`));
    ok(new RegExp(`le nom lu s'arrête à '${lu.replace('$', '\\$')}'`).test(msg),
       `H. 'def ${n}' doit DIRE que le nom s'arrête à '${lu}' — reçu : ${msg.slice(0, 140)}`);
    ok(msg.includes(JSON.stringify(signe)),
       `H. et NOMMER le signe ${JSON.stringify(signe)} qui l'a arrêté — reçu : ${msg.slice(0, 140)}`);
  }
  // ⛔ ET LE COMPLÉMENT : un nom LÉGITIME ne déclenche aucun de ces deux messages. Sans lui, un refus
  // universel rendrait tout ce volet vert.
  for (const n of ['ab', 'a_b', '12a', 'a#', 'a-b', 'ab-', '12TET', 'bp3_Bohlen-Pierce']) {
    const msg = messages(compileToBPxAST(`def ${n} (x:1)`));
    ok(msg === '', `H. 'def ${n}' est un nom LÉGITIME et doit compiler — reçu : ${msg.slice(0, 100)}`);
  }
}

if (echecs.length) {
  console.error(`❌ un nom qui commence par un chiffre : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ Un nom qui commence par un chiffre porte au moins une lettre — mesuré sur les `
          + `entrées que la DONNÉE porte, dans sept places de déclaration et d'invocation, avec le `
          + `refus qui nomme l'entrée absente au lieu de la forme et celui qui nomme la clause pour `
          + `un nombre pur, à toutes les places, l'acteur compris. ${passe} vérification(s) passée(s).`);
