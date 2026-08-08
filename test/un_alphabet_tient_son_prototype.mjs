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
import { LIBS } from '../src/transpiler/libs-data.js';

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
  baseNote: 'string', baseRegister: 'number',
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
    if (type !== 'table' && typeof v !== type)
      f.push(`${nom} : '${cle}' doit être ${type}, reçu ${typeof v}`);
  }
  for (const cle of Object.keys(a)) {
    if (cle.startsWith('_')) continue;
    if (!(cle in PROTOTYPE)) f.push(`${nom} : le champ '${cle}' n'est PAS au prototype — un champ hors prototype agrandit la donnée sans que rien ne le lise`);
  }
  const posees = ANCRE.filter((c) => a[c] !== null && a[c] !== undefined);
  if (posees.length > 0 && posees.length < ANCRE.length)
    f.push(`${nom} : ANCRE À MOITIÉ POSÉE — ${posees.join(', ')} sans ${ANCRE.filter((c) => !posees.includes(c)).join(', ')}. `
         + `« Le diapason seul ne suffit pas : une frequence sans la note qu'elle designe ne place rien. »`);
  if (a.resolvesPitch === true && posees.length < ANCRE.length)
    f.push(`${nom} : déclare RÉSOUDRE une hauteur avec une ancre à ${posees.length}/3 — la résolution se fera sur du vide`);
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
    const complete = ANCRE.every((c) => a[c] !== null && a[c] !== undefined);
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
  const sain = { name: 'x', description: '', runtime: 'audio', voice: null, tuning: 't', octaves: 'o',
                 diapason: 440, baseNote: 'A', baseRegister: 4, alterations: {}, resolvesPitch: true,
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
