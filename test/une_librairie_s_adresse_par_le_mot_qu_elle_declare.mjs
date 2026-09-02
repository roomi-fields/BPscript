#!/usr/bin/env node
/**
 * UNE LIBRAIRIE S'ADRESSE PAR LE MOT QU'ELLE DÉCLARE — DANS LE CODE COMME DANS UNE SCÈNE.
 *
 * DÉCISION DE ROMAIN, 2026-08-17 : le nom du fichier cesse d'être une adresse. Une scène qui écrit
 * `test_alphabets.abc` est refusée avec sa réécriture, `alphabet.abc`.
 *
 * ⛔ CE QUE CE GARDE FERME EST L'AUTRE MOITIÉ, ET ELLE NE SE VOIT PAS. Le refus posé sur les scènes
 * ne dit rien du chargeur lui-même : deux appels internes nommaient encore `voices` et `tunings` —
 * les FICHIERS — là où le langage dit `voice` et `tuning`. Ils rendaient exactement la même chose,
 * et c'est précisément ce qui les rendait invisibles : un court-circuit qui donne le bon résultat
 * n'a aucun symptôme tant qu'un seul fichier porte le mot.
 *
 * ⚠️ CE QUI LE REND FAUX EST À VENIR, PAS PRÉSENT. Un mot peut désigner PLUSIEURS fichiers — c'est
 * déjà le cas d'`alphabet`, servi par `alphabets` et `test_alphabets`. Le jour où un second fichier
 * déclare `voice`, l'appel qui nomme le fichier reste vert et devient aveugle à la moitié de la
 * donnée. Compter les occurrences ne l'aurait jamais dit ; seule la question « cette adresse est-elle
 * un mot ? » le tranche, et elle se pose à la construction — sur CHAQUE littéral passé au chargeur.
 *
 * ⚠️ LA PORTÉE EST L'ESPACE, PAS LES DEUX SITES TROUVÉS : tout fichier de `src/transpiler/`, et tout
 * littéral en première position de `loadLib`. Un garde écrit pour les deux sites du jour laisse
 * entrer le troisième.
 *
 * LA LIMITE QUI RESTE, ÉCRITE PARCE QU'ELLE EST INVISIBLE : `loadLib(mot)` SANS entrée ne lit que
 * le PREMIER fichier du mot (`fichierDeLAxe`). Aucun appel actuel ne vise un mot multi-fichiers sans
 * entrée — le volet C le mesure et rougira le jour où l'un le fera.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(RACINE, 'src', 'transpiler');
const LIBS = createRequire(import.meta.url)(path.join(SRC, 'libs-data.js')).LIBS;

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** fichier → mot qu'il déclare (null s'il n'en déclare aucun). */
const motDuFichier = (f) => (LIBS[f] && typeof LIBS[f] === 'object' ? LIBS[f].resolves : null) || null;

/** mot → tous les fichiers qui le déclarent. */
const fichiersDuMot = new Map();
for (const f of Object.keys(LIBS)) {
  const m = motDuFichier(f);
  if (!m) continue;
  if (!fichiersDuMot.has(m)) fichiersDuMot.set(m, []);
  fichiersDuMot.get(m).push(f);
}

/** Tous les appels littéraux au chargeur, fichier par fichier — la construction, pas une liste. */
function appels() {
  const trouves = [];
  for (const f of readdirSync(SRC).filter((n) => n.endsWith('.js')).sort()) {
    const lignes = readFileSync(path.join(SRC, f), 'utf8').split('\n');
    lignes.forEach((ligne, i) => {
      // Un commentaire porte des adresses MORTES — `loadLib('language')` y survit à sa porte.
      if (/^\s*(\/\/|\*|\/\*)/.test(ligne)) return;
      for (const m of ligne.matchAll(/loadLib\(\s*'([A-Za-z0-9_/]+)'\s*(,)?/g)) {
        trouves.push({ fichier: f, ligne: i + 1, axe: m[1], avecEntree: !!m[2], source: ligne.trim() });
      }
    });
  }
  return trouves;
}

const APPELS = appels();

// ── SOCLE — un garde qui n'a rien examiné est vert pour la mauvaise raison ───────────────────
// Le plancher était à 20 pour une vingtaine d'appels ; le 2026-09-02 les tables du socle ont cessé
// de se lire par `loadLib('core')` (elles se lisent par l'objet `schema`), et les catalogues
// `voice`, `octaves`, `eval` par l'index des objets : il reste NEUF appels littéraux, tous des
// lectures d'une entrée par le mot qui l'invoque. Le plancher suit la mesure, sous elle d'un seul.
ok(APPELS.length >= 8,
   `SOCLE : ${APPELS.length} appel(s) au chargeur trouvé(s), 8 au moins attendus. Sous ce seuil, `
 + `ce garde est vert parce qu'il ne lit plus le code, pas parce que les adresses sont justes.`);
ok(fichiersDuMot.size >= 20,
   `SOCLE : ${fichiersDuMot.size} mot(s) déclaré(s) lus dans le bundle, 20 au moins attendus.`);

// ── A. AUCUNE ADRESSE N'EST UN NOM DE FICHIER QUAND UN MOT LA PORTE ──────────────────────────
for (const a of APPELS) {
  const mot = motDuFichier(a.axe);
  ok(!(mot && mot !== a.axe),
     `A. ${a.fichier}:${a.ligne} adresse '${a.axe}' — c'est le NOM DU FICHIER, et la librairie `
   + `déclare '${mot}'. Écrire loadLib('${mot}'…). Les deux rendent la même chose tant qu'un seul `
   + `fichier porte le mot ; au second, celle-ci devient aveugle à la moitié de la donnée. `
   + `Ligne : ${a.source.slice(0, 90)}`);
}

// ── B. TÉMOIN — le garde distingue une adresse JUSTE d'une adresse par fichier ────────────────
// Sans lui, « aucune adresse fautive » se confond avec « la table des mots est vide ».
{
  ok(motDuFichier('voices') === 'voice' && motDuFichier('tunings') === 'tuning',
     `B-témoin. les deux fichiers qui ont porté ce défaut déclarent bien un mot DIFFÉRENT de leur `
   + `nom — sans cet écart, le volet A ne pourrait rien trouver nulle part.`);
  ok(motDuFichier('core') === 'core',
     `B-témoin. un fichier dont le nom EST son mot ne doit pas être accusé — sinon le volet A `
   + `refuserait la moitié des appels justes.`);
  ok(motDuFichier('zorglub') === null,
     `B-témoin. un nom qui n'est pas une librairie ne déclare rien — le volet A le laisse passer, `
   + `parce qu'il ne juge que ce que la donnée nomme.`);
}

// ── C. LA LIMITE NOMMÉE — aucun appel SANS entrée ne vise un mot servi par plusieurs fichiers ─
// `loadLib(mot)` sans entrée ne lit que le PREMIER fichier du mot. Tant qu'aucun appel n'est dans
// ce cas, la limite dort ; ce volet la réveille au premier qui l'atteint.
{
  const multi = [...fichiersDuMot].filter(([, fs]) => fs.length > 1).map(([m]) => m);
  ok(multi.length >= 1,
     `C-témoin. aucun mot n'est servi par plusieurs fichiers — ce volet ne garde plus rien. `
   + `('alphabet' l'était le 2026-08-22, servi par alphabets et test_alphabets.)`);
  for (const a of APPELS.filter((x) => !x.avecEntree && multi.includes(x.axe))) {
    echecs.push(`C. ${a.fichier}:${a.ligne} charge '${a.axe}' SANS entrée, alors que `
      + `${fichiersDuMot.get(a.axe).join(' et ')} le servent tous les deux. Cet appel ne verra que `
      + `le premier. Passer par une entrée nommée, ou fusionner les fichiers du mot.`);
  }
  passe += APPELS.filter((x) => !x.avecEntree).length;
}

// ── D. L'AUTRE DIRECTION — aucune ADRESSE ÉMISE ne porte un nom de fichier ───────────────────
// ⛔ LA RÈGLE A DEUX SENS, ET J'AVAIS FERMÉ UN SEUL. Les volets ci-dessus tiennent l'ENTRÉE : ce que
// mon code demande au chargeur. Ce volet tient la SORTIE : ce que mon émission dit à l'aval. Le
// 2026-08-22, l'entrée était close — une scène n'écrit plus `test_alphabets.abc` — et l'adresse
// émise portait encore le nom physique : le fichier redevenait une adresse au seul endroit qui
// compte pour un voisin. Kairos l'a mesuré chez lui et me l'a renvoyé ; aucun garde d'ici ne le
// voyait.
//
// ⚠️ ET LA MESURE DISAIT DÉJÀ TOUT : sur les 17 adresses que le corpus émet, `test_alphabets` était
// le SEUL nom de fichier — les seize autres disaient leur mot. Un seul chemin réécrivait.
{
  const { toutesLesScenes } = await import('./corpus.mjs');
  const { compileToBPxAST } = await import('../src/transpiler/index.js');
  const nomsDeFichier = new Set(Object.keys(LIBS).filter((f) => motDuFichier(f) && motDuFichier(f) !== f));
  ok(nomsDeFichier.size >= 1,
     `D-témoin. aucun fichier ne porte un nom différent de son mot — ce volet ne garde plus rien. `
   + `(Il y en avait 8 le 2026-08-22 : alphabets, scales, sounds, temperaments, tunings, voices, `
   + `digital, test_alphabets.)`);

  let scenes = 0, adresses = 0;
  const fautives = [];
  for (const [nom, src] of toutesLesScenes()) {
    scenes++;
    let r;
    try { r = compileToBPxAST(src, {}); } catch { continue; }
    if (!r.ast || (r.errors || []).length) continue;
    const emises = [];
    for (const a of r.ast.actors || []) for (const x of a.libRefs || []) emises.push([`acteur '${a.name}'`, x]);
    for (const x of r.ast.libRefs || []) emises.push(['scène', x]);
    for (const [ou, adresse] of emises) {
      adresses++;
      const axe = String(adresse).split('.')[0];
      if (nomsDeFichier.has(axe)) fautives.push(`${nom} (${ou}) émet '${adresse}' — '${axe}' est le `
        + `NOM DU FICHIER, la librairie déclare '${motDuFichier(axe)}'. L'aval reçoit une adresse que `
        + `le langage refuse en entrée.`);
    }
  }
  ok(scenes >= 300, `D-socle : ${scenes} scène(s) compilées, 300 au moins attendues.`);
  ok(adresses >= 10,
     `D-socle : ${adresses} adresse(s) émise(s) examinée(s), 10 au moins attendues. Sous ce seuil, `
   + `ce volet est vert parce qu'il ne voit plus d'adresse, pas parce qu'elles sont justes.`);
  for (const f of fautives) echecs.push(`D. ${f}`);
  passe += adresses - fautives.length;
}

if (echecs.length) {
  console.error(`❌ une librairie s'adresse par le mot qu'elle déclare : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ une librairie s'adresse par le mot qu'elle déclare — ${APPELS.length} appel(s) au `
  + `chargeur examinés dans ${readdirSync(SRC).filter((n) => n.endsWith('.js')).length} fichiers, `
  + `aucun ne nomme un fichier à la place de son mot, et aucun ne charge sans entrée un mot que `
  + `plusieurs fichiers servent — et dans l'autre sens, aucune adresse ÉMISE vers l'aval ne porte `
  + `un nom de fichier. ${passe} vérification(s) passée(s).`);
