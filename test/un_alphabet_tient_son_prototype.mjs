#!/usr/bin/env node
/**
 * UN ALPHABET TIENT SON PROTOTYPE — les champs que la référence écrit, et rien d'autre.
 *
 * `LANGUAGE.md:860` pose le prototype d'un alphabet LITTÉRALEMENT, en JSON. Ce garde le confronte
 * à la donnée, champ par champ, alphabet par alphabet. Il ne juge PAS le contenu — quel accordage,
 * quelle voix : cela appartient à l'outil qui résout. Il juge la FORME, qui est ma part.
 *
 * ⚠️ POURQUOI IL EXISTE, ET C'EST KAIROS QUI L'A OUVERT. Il a mesuré ma donnée plutôt que de croire
 * ma description, et il en a rapporté un fait que je n'avais pas signalé : deux champs sont
 * APPARUS au reformatage du 2026-08-08 (`voice` et `runtime` au niveau de la collection). Je lui
 * avais écrit « deux champs seulement changent » — c'était vrai des champs qui PARTENT, et faux du
 * changement. **J'avais compté les modifications, pas les ajouts.**
 * Pour lui ce ne sont pas des renommages mais DEUX ÉTAGES DE CASCADE à écrire : la voix d'un
 * terminal se replie désormais sur celle de sa collection, et sa sortie aussi. La référence le dit
 * en toutes lettres (`LANGUAGE.md:880`) — « un terminal qui n'en declare pas prend celui de son
 * alphabet, et il en va de meme de sa voix ».
 *
 * ⚠️ ET LE FAIT QUI RASSURE, mesuré ici : les deux champs sont INERTES aujourd'hui — voix nulle
 * partout, sortie `audio` partout, qui sont les défauts écrits du prototype. Rien ne bouge en aval
 * tant que personne ne les remplit. Le volet D garde cette inertie : le jour où une valeur y entre,
 * il rougit, et c'est un préavis à envoyer à qui résout — pas un défaut.
 *
 * ⚠️ CE QUE CE GARDE ATTRAPE ET QU'AUCUN AUTRE NE VOIT : l'ancre à moitié posée. La référence est
 * catégorique — « L'ancre tient en trois champs, et il en faut trois. Le diapason seul ne suffit
 * pas : une frequence sans la note qu'elle designe ne place rien. » Un alphabet avec un diapason et
 * pas de note de référence compile, se charge, et donne une hauteur fausse SANS RIEN DIRE.
 * Mesuré ce jour : 13 alphabets portent l'ancre entière, 4 n'en portent aucune, ZÉRO à moitié —
 * et les 4 sont exactement ceux qui déclarent ne résoudre aucune hauteur. L'invariant tient
 * aujourd'hui ; rien ne le gardait.
 */
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/**
 * Le prototype de `LANGUAGE.md:860`, recopié champ pour champ, avec le TYPE de ce qu'il porte.
 *
 * ⚠️ UN CHAMP ABSENT VAUT SON DÉFAUT, et ce garde ne l'exige donc pas. La référence est explicite
 * (`LANGUAGE.md:830`) : « Le prototype porte toutes ses proprietes avec leur valeur par defaut ;
 * un terminal concret ne declare que ce qui differe. » Un alphabet de frappes n'écrit pas
 * `baseNote: null` — il n'écrit rien, et c'est la même chose.
 * De même le NOM : dans un catalogue indexé par nom, la clé EST le nom. L'écrire une seconde fois
 * en champ ouvrirait la porte à ce que les deux divergent.
 * Ce que ce garde exige, c'est donc : rien HORS prototype, et ce qui est ÉCRIT au bon type.
 */
const PROTOTYPE = {
  name: 'string', description: 'string', runtime: 'string', voice: 'string',
  tuning: 'string', octaves: 'string', diapason: 'number',
  baseNote: 'string', baseRegister: 'string',
  alterations: 'table', resolvesPitch: 'boolean', terminals: 'table',
};
/** Sans lui, ce n'est pas une collection de terminaux — c'est autre chose. */
const INDISPENSABLE = 'terminals';
const ANCRE = ['diapason', 'baseNote', 'baseRegister'];
/** `LANGUAGE.md:880` : « le runtime de sortie, pris parmi `audio`, `midi`, `osc` et `dmx` ». */
const SORTIES = ['audio', 'midi', 'osc', 'dmx'];

const alphabets = (lib) => Object.entries(lib || {})
  .filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object' && !Array.isArray(v) && v.terminals);

/**
 * Les fautes de forme d'une collection, nommées. Rendu en liste pour que le témoin du volet E
 * puisse exiger qu'une faute INJECTÉE soit vue — et qu'une donnée saine n'en produise aucune.
 */
function fautesDe(nom, a) {
  const f = [];
  if (!(INDISPENSABLE in a)) f.push(`${nom} : pas de '${INDISPENSABLE}' — une collection sans terminaux ne collectionne rien`);
  for (const [cle, type] of Object.entries(PROTOTYPE)) {
    const v = a[cle];
    if (v === null || v === undefined) continue;   // absent ou nul : il vaut son défaut
    if (type === 'table' && (typeof v !== 'object' || Array.isArray(v)))
      f.push(`${nom} : '${cle}' doit être une TABLE, reçu ${Array.isArray(v) ? 'une LISTE' : typeof v}. `
           + `Une liste vide se comporte comme une table vide — elle passe partout et n'est pas du bon type.`);
    // ⛔ `baseRegister` NOMME SON REGISTRE DEPUIS LE 2026-08-20 — un texte, jamais un rang. QUATRE
    // collections le portent encore en nombre : arabic, gamelan_pelog, gamelan_slendro,
    // bohlen_pierce, celles qui ne déclarent AUCUNE table de registres. Romain a tranché qu'un
    // alphabet sans liste n'a pas de rang du tout, donc le champ y disparaîtra ; sa sortie est
    // appariée au retrait du repli d'un consommateur et ne peut pas partir seule.
    // Le périmètre est donc GELÉ ici, et compté plus bas : ce garde n'affirme pas que cet état est
    // bon, il exige qu'il ne BOUGE PAS sans un mot.
    if (cle === 'baseRegister' && typeof v === 'number' && !('octaves' in a)) continue;
    if (type !== 'table' && typeof v !== type)
      f.push(`${nom} : '${cle}' doit être ${type}, reçu ${typeof v}`);
  }
  for (const cle of Object.keys(a)) {
    if (cle.startsWith('_')) continue;
    if (!(cle in PROTOTYPE)) f.push(`${nom} : le champ '${cle}' n'est PAS au prototype — un champ hors prototype agrandit la donnée sans que rien ne le lise`);
  }
  // ⛔ UN CHAMP À SA VALEUR PAR DÉFAUT NE S'ÉCRIT PAS — et le contraire a cassé un voisin.
  // Ma donnée appliquait DEUX RÉGIMES à la fois : `baseNote` ABSENT sur les collections sans
  // hauteur, `tuning` PRÉSENT À NUL sur les mêmes. Kairos comparait strictement à « non défini » ;
  // le nul explicite passait pour une valeur DÉCLARÉE, court-circuitait sa branche sans-hauteur et
  // faisait jeter sur les quatre alphabets de percussion. Sa phrase, qui est la règle :
  // « absent et présent-à-nul ne sont pas la même chose pour un consommateur, et un tableau
  // AVANT/APRÈS de noms de clés ne le distingue pas. »
  // ⚠️ `resolvesPitch` à faux est l'EXCEPTION NOMMÉE par la référence — « un alphabet de frappes
  // n'en resout aucune, et l'ecrire evite qu'on lui en invente une » (LANGUAGE.md:878). Écrit
  // exprès, il ne tombe pas sous cette règle.
  for (const cle of Object.keys(a)) {
    if (a[cle] === null) f.push(`${nom} : '${cle}' est écrit à NUL alors qu'un champ à sa valeur par défaut ne s'écrit pas `
      + `(LANGUAGE.md:830). Absent et présent-à-nul ne sont pas la même chose pour qui lit — deux régimes dans un `
      + `fichier, c'est une donnée qui dit deux choses à la fois.`);
  }
  // ⛔ L'ANCRE TIENT EN TROIS CHAMPS QUAND L'ALPHABET DÉCLARE SES REGISTRES, EN DEUX SINON.
  // Décision Romain, 2026-08-20 : un alphabet qui ne déclare aucune liste de registres n'a pas de
  // RANG de registre — sa note et son diapason portent l'ancre entièrement. `husayni` vaut 440 Hz,
  // sans cran. Romain a nommé l'incohérence lui-même : « comment peut-il se baser sur une
  // définition basée sur le registre 4 s'il n'a pas de registres ? »
  // Avant cette décision, quatre alphabets empruntaient SILENCIEUSEMENT les registres occidentaux
  // par le repli d'un consommateur, sans que rien ne le déclare ni ne le garantisse.
  const ancreDe = (x) => (x.octaves ? ANCRE : ANCRE.filter((c) => c !== 'baseRegister'));
  const ANCRE_ATTENDUE = ancreDe(a);
  const posees = ANCRE_ATTENDUE.filter((c) => a[c] !== null && a[c] !== undefined);
  if (posees.length > 0 && posees.length < ANCRE_ATTENDUE.length)
    f.push(`${nom} : ANCRE À MOITIÉ POSÉE — ${posees.join(', ')} sans `
         + `${ANCRE_ATTENDUE.filter((c) => !posees.includes(c)).join(', ')}. `
         + `« Le diapason seul ne suffit pas : une frequence sans la note qu'elle designe ne place rien. »`);
  if (a.resolvesPitch === true && posees.length < ANCRE_ATTENDUE.length)
    f.push(`${nom} : déclare RÉSOUDRE une hauteur avec une ancre à ${posees.length}/`
         + `${ANCRE_ATTENDUE.length} — la résolution se fera sur du vide`);
  if (a.runtime != null && !SORTIES.includes(a.runtime))
    f.push(`${nom} : sortie '${a.runtime}' hors des quatre — ${SORTIES.join(', ')}`);
  return f;
}

// ── A. LA DONNÉE VIVANTE TIENT SON PROTOTYPE ────────────────────────────────────────────────
const TABLES = [['alphabets', LIBS.alphabets], ['test_alphabets', LIBS.test_alphabets]];
let mesures = 0;
for (const [nomTable, table] of TABLES) {
  for (const [nom, a] of alphabets(table)) {
    mesures++;
    const f = fautesDe(`${nomTable}.${nom}`, a);
    ok(f.length === 0, f.join(' | '));
  }
}

// ── B. L'ANCRE, ET CE QUE SON ABSENCE DIT ───────────────────────────────────────────────────
// ⚠️ Kairos écrit : « leur absence a un sens que je dois traiter, pas un defaut ». Elle en a un,
// et il est ÉCRIT en donnée — inutile de le déduire : `resolvesPitch` le nomme. Ce volet garde
// l'équivalence dans les DEUX SENS, parce qu'une seule direction laisserait passer la moitié :
// un alphabet à ancre complète qui ne résoudrait rien porterait une ancre morte.
{
  const tous = alphabets(LIBS.alphabets);
  for (const [nom, a] of tous) {
    // ⛔ « ENTIÈRE » DÉPEND DE CE QUE L'ALPHABET DÉCLARE. Trois champs quand il nomme une table de
    // registres, DEUX sinon : sans liste, il n'a pas de rang, et sa note plus son diapason portent
    // l'ancre à eux seuls (décision Romain, 2026-08-20). Quatre alphabets sont dans ce cas.
    const attendus = a.octaves ? ANCRE : ANCRE.filter((c) => c !== 'baseRegister');
    const complete = attendus.every((c) => a[c] !== null && a[c] !== undefined);
    ok(complete === (a.resolvesPitch === true),
       `B. '${nom}' : ancre ${complete ? 'COMPLÈTE' : 'absente'} mais resolvesPitch=${a.resolvesPitch}. `
       + `Les deux se disent la même chose ; l'un sans l'autre est une donnée qui se contredit.`);
  }
  const avec = tous.filter(([, a]) => a.resolvesPitch === true).length;
  console.log(`   ℹ️ ${avec}/${tous.length} collections résolvent une hauteur et portent l'ancre entière ; `
            + `${tous.length - avec} n'en résolvent aucune et n'en portent aucune.`);
}

// ── C. LES NOMS SURVIVENT AU PASSAGE EN TABLE ───────────────────────────────────────────────
// La liste `notes` est devenue une table `terminals`. Kairos l'a vérifié plutôt que de me croire :
// sur `western` les sept terminaux sont des objets VIDES — la table porte donc les NOMS même sans
// aucune propriété, ce qui rend ses clés équivalentes à l'ancienne liste. Ce volet garde ce fait,
// qui est la seule raison pour laquelle la réécriture d'en face est mécanique.
{
  for (const [nom, a] of alphabets(LIBS.alphabets)) {
    const cles = Object.keys(a.terminals);
    ok(cles.length > 0, `C. '${nom}' : table de terminaux VIDE — un alphabet sans terminal ne collectionne rien.`);
    ok(cles.every((k) => typeof k === 'string' && k.length > 0),
       `C. '${nom}' : un nom de terminal vide dans la table.`);
    ok(Object.values(a.terminals).every((t) => t !== null && typeof t === 'object' && !Array.isArray(t)),
       `C. '${nom}' : un terminal qui n'est pas une TABLE de propriétés — la forme vide est '{}', pas 'null'.`);
  }
}

// ── D. LES DEUX CHAMPS APPARUS SONT INERTES — et le jour où ils ne le seront plus, ça se dit ──
// ⚠️ CE VOLET EST UN PRÉAVIS MÉCANIQUE, pas une interdiction. Kairos a écrit deux étages de
// cascade pour ces champs ; tant qu'ils valent leur défaut, ses étages ne changent rien. Le jour
// où une valeur y entre, ce garde rougit — et le message qu'il porte est ce qu'il faut envoyer.
{
  const tous = alphabets(LIBS.alphabets);
  const voix = tous.filter(([, a]) => a.voice != null).map(([n]) => n);
  const sorties = tous.filter(([, a]) => a.runtime !== 'audio').map(([n]) => n);
  ok(voix.length === 0,
     `D-PRÉAVIS. Une voix de COLLECTION est désormais posée sur : ${voix.join(', ')}. Ce n'est pas une `
   + `faute — c'est un étage de cascade qui cesse d'être inerte chez qui résout. PRÉVENIR kairos `
   + `À LA FRAPPE (il a écrit l'étage, il ne l'a jamais vu servir), puis inscrire l'attendu ici.`);
  ok(sorties.length === 0,
     `D-PRÉAVIS. Une sortie de COLLECTION quitte le défaut 'audio' sur : ${sorties.join(', ')}. Même `
   + `geste : le repli d'alphabet cesse d'être inerte, kairos doit le savoir avant, pas après.`);
}

// ── E. TÉMOIN QUI MORD DANS LES DEUX SENS ───────────────────────────────────────────────────
// ⚠️ Le volet A ne mesure que des cas qui RÉUSSISSENT : tant que la donnée est saine, il serait
// vert même si `fautesDe` ne regardait rien. Ce volet injecte chaque faute et exige qu'elle soit
// VUE — puis exige qu'un alphabet sain n'en produise AUCUNE. Une règle qui refuserait tout
// laisserait la première moitié verte ; c'est la seconde qui la démasque.
{
  // ⚠️ Pas de `voice: null` ici : un champ à sa valeur par défaut ne s'écrit pas — la règle que ce
  // garde applique désormais. Le témoin sain doit obéir à la règle qu'il sert à prouver, sinon il
  // devient un contre-exemple qu'on finit par tolérer.
  const sain = { name: 'x', description: '', runtime: 'audio', tuning: 't', octaves: 'o',
                 diapason: 440, baseNote: 'A', baseRegister: '4', alterations: {}, resolvesPitch: true,
                 terminals: { a: {} } };
  ok(fautesDe('témoin', sain).length === 0,
     `E-témoin. Un alphabet SAIN produit des fautes : ${fautesDe('témoin', sain).join(' | ')}. `
   + `Une règle qui refuse tout ne garde rien.`);

  const INJECTIONS = [
    ['aucun terminal',                   (a) => { delete a.terminals; },                /ne collectionne rien/],
    ['un champ hors prototype',          (a) => { a.couleur = 'bleu'; },                /n'est PAS au prototype/],
    ['une ancre à moitié posée',         (a) => { a.baseNote = null; },                 /ANCRE À MOITIÉ POSÉE/],
    ['une ancre à moitié, par ABSENCE',  (a) => { delete a.baseRegister; },             /ANCRE À MOITIÉ POSÉE/],
    ['résoudre sans aucune ancre',       (a) => { a.diapason = a.baseNote = a.baseRegister = null; }, /RÉSOUDRE une hauteur/],
    ['une sortie hors des quatre',       (a) => { a.runtime = 'papier'; },              /hors des quatre/],
    ['les terminaux en LISTE',           (a) => { a.terminals = ['a', 'b']; },          /doit être une TABLE/],
    ['les altérations en LISTE VIDE',    (a) => { a.alterations = []; },                /doit être une TABLE/],
    ['un diapason en texte',             (a) => { a.diapason = '440'; },                /doit être number/],
    ['un champ écrit à NUL',             (a) => { a.octaves = null; },                  /écrit à NUL/],
  ];
  for (const [quoi, casser, attendu] of INJECTIONS) {
    const copie = JSON.parse(JSON.stringify(sain));
    casser(copie);
    const f = fautesDe('injecté', copie).join(' | ');
    ok(attendu.test(f),
       `E-témoin. ${quoi} — doit être VU et nommé. Reçu : ${f || 'AUCUNE faute'}. Une garde aveugle `
     + `à sa propre faute est verte pour la mauvaise raison.`);
  }
  ok(INJECTIONS.length >= 8, `E-SOCLE : ${INJECTIONS.length} injections, 8 au moins attendues.`);
}

// ── SOCLE — contre le vert obtenu en ne mesurant plus rien ───────────────────────────────────
// ── LE PÉRIMÈTRE GELÉ DU RANG SURVIVANT ─────────────────────────────────────────────────────
// ⛔ Décision Romain, 2026-08-20 : un alphabet qui ne déclare pas de liste de registres n'a pas de
// RANG de registre. Quatre le portent encore, et leur sortie est APPARIÉE au retrait du repli d'un
// consommateur — la retirer seule ferait tomber leur note de quatre octaves, sans un cri, parce
// qu'un repli à 4 prend la place de ce qu'on enlève.
// Ce volet ne dit pas que c'est bon : il exige que la liste ne bouge pas d'elle-même.
{
  const alph = LIBS.alphabets || {};
  const rangSurvivant = Object.entries(alph)
    .filter(([, a]) => a && typeof a === 'object' && typeof a.baseRegister === 'number')
    .map(([n]) => n).sort();
  ok(JSON.stringify(rangSurvivant)
       === JSON.stringify([]),
    `PÉRIMÈTRE GELÉ : AUCUN alphabet ne doit porter un RANG de registre — reçu ${JSON.stringify(rangSurvivant)}. Un nom qui entre ici est un `
    + `alphabet qui a perdu son nom de registre ; un nom qui en sort est le geste apparié, et il se `
    + `dit.`);
  // ⛔ ET AUCUN DES QUATRE NE DÉCLARE DE TABLE — c'est ce qui les met dans cette liste, jamais leur
  // nom. Sans ce volet, la liste ci-dessus serait une photographie sans raison.
  for (const n of rangSurvivant) {
    ok(!('octaves' in (alph[n] || {})),
      `PÉRIMÈTRE GELÉ : '${n}' porte un rang ET déclare une table — il doit alors NOMMER son `
      + `registre comme les neuf autres.`);
  }
  // ⛔ ET LE COMPLÉMENT : tout alphabet qui DÉCLARE une table nomme son registre, et ce nom existe.
  let nommes = 0;
  for (const [n, a] of Object.entries(alph)) {
    if (!a || typeof a !== 'object' || a.baseRegister === undefined || !a.octaves) continue;
    nommes++;
    const t = (LIBS.octaves || {})[a.octaves];
    ok(typeof a.baseRegister === 'string' && Array.isArray(t?.registers)
       && t.registers.includes(a.baseRegister),
      `'${n}' déclare la table '${a.octaves}' : son registre de base doit être un NOM qui y existe — `
      + `reçu ${JSON.stringify(a.baseRegister)} contre ${JSON.stringify(t?.registers)}`);
  }
  ok(nommes === 9, `PÉRIMÈTRE GELÉ : neuf alphabets déclarent une table et nomment leur registre — reçu ${nommes}`);
}

ok(mesures >= 17,
   `SOCLE : ${mesures} collection(s) mesurée(s), 17 au moins attendues. Sous ce seuil ce garde est `
 + `vert parce qu'il ne regarde plus la donnée, pas parce qu'elle est saine.`);
ok(Object.keys(PROTOTYPE).length === 12,
   `SOCLE : le prototype de LANGUAGE.md:860 porte 12 champs, ${Object.keys(PROTOTYPE).length} recopiés. `
 + `S'il en gagne un, il se recopie ici — sinon ce garde certifie un prototype périmé.`);

if (echecs.length) {
  console.error(`❌ un alphabet tient son prototype : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ un alphabet tient son prototype — ${mesures} collections aux 12 champs de la référence, `
          + `ancre entière ou absente jamais à moitié, sortie parmi les quatre, voix et sortie de `
          + `collection encore inertes. ${passe} vérification(s) passée(s).`);
