#!/usr/bin/env node
/**
 * GARDE — une entrée INCONNUE crie, même dans une librairie SANS CATALOGUE.
 *
 * PAYÉ SUR PIÈCE. `dhin1.bps` invoquait `@transcription.dhinOO`, une entrée qui n'existe pas : la
 * librairie nomme `dhin`, la grammaire d'origine déclare son homomorphisme avec deux TIRETS, et la
 * migration les a rendus par deux O. Le compilateur l'a accepté EN SILENCE pendant toute la
 * migration — la scène croyait charger un homomorphisme et n'en chargeait AUCUN. Trouvé le
 * 2026-07-27 par le garde des invocations écrites contre émises, corrigé chez Kanopi (`5dd7798`).
 *
 * POURQUOI LE TROU EXISTAIT : les axes à CATALOGUE (alphabet, tuning, octaves, scale, sound) crient
 * depuis toujours sur une référence inexistante. Les autres — `transcription`, `test_alphabets`,
 * `settings` — n'ont pas de catalogue déclaré, donc rien n'y criait.
 *
 * L'ARGUMENT QUI TRANCHE (architecte 2026-07-27) : **ne rien pouvoir vérifier n'est pas une raison
 * de ne rien vérifier, c'est une raison de vérifier AUTRE CHOSE.** Ici le vérifiable est trivial —
 * l'entrée existe-t-elle dans le fichier invoqué. Aucun catalogue n'est requis pour poser ça.
 *
 * FRONTIÈRE MESURÉE AVANT DE LIVRER, sur 447 fichiers de scène (bibliothèque Kanopi entière, démos,
 * scènes de BPx) : QUATRE invocations ne résolvent pas, et les quatre sont DÉJÀ refusées
 * aujourd'hui (`@alphabet.raga`, axe à catalogue). Ce fail-loud n'ajoute AUCUNE casse.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compile = (directive) => {
  try { return compileToBPxAST(`@core\n@controls\n@alphabet.western:midi\n${directive}\n@mode:ord\nS -> C4\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};

// ─── 1. SOCLE — les librairies sans catalogue existent et portent des entrées ────────────────
// Piloté par la DONNÉE : le jour où une librairie sans catalogue s'ajoute, elle est couverte sans
// qu'on touche ce fichier. Une liste écrite à la main ne garderait que les trois du ticket.
const CATALOGUES = new Set(LIBS.core?.schema?.catalogAxes || []);
const SANS_CATALOGUE = Object.entries(LIBS)
  .filter(([nom, lib]) => !CATALOGUES.has(nom) && lib && typeof lib === 'object' && lib.domain)
  .map(([nom, lib]) => [nom, Object.keys(lib).filter((k) => !k.startsWith('_') && !['name', 'description', 'version', 'domain'].includes(k))])
  .filter(([, entrees]) => entrees.length > 0);

ok(CATALOGUES.size >= 5, `1. les axes à catalogue doivent être chargés — reçu ${CATALOGUES.size}`);
ok(SANS_CATALOGUE.length >= 2,
   `1. il faut des librairies SANS catalogue à garder — reçu ${SANS_CATALOGUE.length}`);

// ─── 2. LE CAS SIGNALÉ, nommément ────────────────────────────────────────────────────────────
{
  const r = compile('@transcription.dhinOO');
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, "2. '@transcription.dhinOO' doit CRIER — c'est le cas qui a fait naître ce garde");
  ok(msg.includes('dhinOO') && msg.includes('transcription'),
     `2. et le refus doit NOMMER l'entrée ET la librairie — reçu : ${msg.slice(0, 120)}`);
  ok((compile('@transcription.dhin').errors || []).length === 0,
     "2. l'entrée CORRIGÉE doit passer — le cri vise l'inexistant, pas la librairie");
}

// ─── 3. TOUTE librairie sans catalogue, pas celle du ticket ──────────────────────────────────
for (const [lib, entrees] of SANS_CATALOGUE) {
  const r = compile(`@${lib}.zzz_nexiste_pas_9`);
  ok((r.errors || []).length > 0,
     `3. '@${lib}.<inconnu>' doit CRIER — une invocation qui ne résout rien est indistinguable, `
     + `côté consommateur, d'une scène qui n'a rien déclaré`);
  // Et une entrée VRAIE de la même librairie passe : on garde l'inexistant, pas la librairie.
  // Une entrée VRAIE passe — on garde l'inexistant, pas la librairie. On choisit un nom qui soit
  // un IDENTIFIANT valide : certaines entrées commencent par un chiffre (`12TET`) et ne peuvent
  // pas s'écrire nues dans une directive, ce qui est une autre limite, pas celle qu'on garde ici.
  const nommable = entrees.find((e) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(e));
  if (nommable) {
    const bonne = compile(`@${lib}.${nommable}`);
    ok((bonne.errors || []).length === 0,
       `3. mais '@${lib}.${nommable}' doit passer — reçu : ${(bonne.errors || []).map((e) => e.message || e).join(' | ')}`);
  }
}

// ─── 4. LES AXES À CATALOGUE criaient DÉJÀ — on ne les a pas dédoublés ───────────────────────
for (const axe of CATALOGUES) {
  const r = compile(`@${axe}.zzz_nexiste_pas_9`);
  const msgs = (r.errors || []).map((e) => e.message || e);
  ok(msgs.length > 0, `4. '@${axe}.<inconnu>' doit toujours crier`);
  // UNE SEULE fois SUR CETTE FAUTE — deux messages sur la même question voudraient dire deux
  // validations concurrentes. Les erreurs EN CASCADE (un axe cassé fait tomber la validation des
  // terminaux qui en dépendent) sont légitimes et ne comptent pas ici : mesuré sur `octaves`, où
  // le refus entraîne la chute de l'expansion des terminaux.
  const surLaReference = msgs.filter((m) => m.includes('zzz_nexiste_pas_9'));
  ok(surLaReference.length === 1,
     `4. et UNE SEULE fois sur la référence elle-même — reçu ${surLaReference.length} : `
     + `${JSON.stringify(surLaReference).slice(0, 160)}`);
}

// ─── 5. RIEN D'AUTRE N'EST TOUCHÉ ────────────────────────────────────────────────────────────
// Un nom de directive qui n'est pas une librairie n'a rien à faire ici : c'est une autre faute,
// avec un autre message. Le cri ne doit pas se mettre à parler à sa place.
{
  const r = compile('@transcription.dhin\n@meter:4/4');
  ok((r.errors || []).length === 0,
     `5. une directive ordinaire à côté ne doit pas être happée — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
}

// ─── 6. POINT OUVERT ÉPINGLÉ — la table d'une entrée n'est PAS soumise au cri ────────────────
// ⚠️ La règle voudrait qu'elle le soit : c'est une invocation de librairie comme une autre. Mais
// `lib/mapping.json` est DÉLIBÉRÉMENT VIDE tant que Romain n'a pas donné de vraie table, donc
// appliquer le cri ici rendrait NON COMPILABLE chacun des exemples ratifiés une heure plus tôt.
// Les deux issues sont défendables et choisir n'est pas à moi — donc on épingle l'état, on ne le
// comble pas en douce. Ce témoin ROUGIRA le jour où quelqu'un tranche dans un sens ou dans l'autre,
// ce qui est exactement le moment où il faut le savoir.
{
  const r = compile('@in p transport.midi mapping.fcb_std');
  ok((r.errors || []).length === 0,
     `6. POINT OUVERT : la table d'une entrée n'est pas encore soumise au cri (librairie vide par `
     + `décision). Si ce témoin rougit, c'est que le sujet a été tranché — mettre à jour ce garde. `
     + `Reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
}

if (echecs.length) {
  console.error(`❌ entrée inconnue : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ une entrée inconnue crie — ${passe} vérification(s) passée(s) sur `
            + `${SANS_CATALOGUE.length} librairie(s) sans catalogue et ${CATALOGUES.size} axe(s) à catalogue`);
}
