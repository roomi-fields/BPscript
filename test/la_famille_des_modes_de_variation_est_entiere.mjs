#!/usr/bin/env node
/**
 * GARDE — les NEUF paramètres de jeu portent chacun leurs TROIS modes, et chaque mot est rangé
 * chez celui qui le RÉSOUT.
 *
 * CE QUE LA FAMILLE EST. Entre deux valeurs écrites d'un même paramètre, le mode dit si la
 * première TIENT jusqu'à la seconde (fixe), si elle GLISSE de note en note (paliers), ou si elle
 * glisse PENDANT les notes par messages intermédiaires (continu). Neuf paramètres, trois modes,
 * vingt-sept mots — la forme du moteur natif, arrêtée par Romain le 2026-08-12 : le mot se lit
 * d'un seul tenant, le paramètre puis son mode.
 *
 * POURQUOI UN GARDE, ET POURQUOI EN MATRICE. Une famille de vingt-sept mots posée à la main se
 * dépeuple en silence : il suffit d'un mot oublié pour qu'une écriture légitime soit refusée avec
 * le message d'un mot inconnu, et rien ne le dirait. Le garde énumère donc le PRODUIT des neuf
 * paramètres par les trois modes — pas une liste de noms recopiée — et exige les trois choses qui
 * font qu'un mot existe vraiment : il est DÉCLARÉ, il est RANGÉ chez son résolveur, et il
 * S'ÉCRIT dans les positions où un réglage de jeu s'écrit.
 *
 * LE RANGEMENT, ET C'EST LA RÈGLE QUI L'IMPOSE. Une librairie déclare UN destinataire ; le
 * destinataire d'un mode est celui qui le résout. Le fixe et les paliers se calculent note à
 * note, donc chez Kairos — les dix-huit vivent dans `lib/variation.json`. Le continu exige des
 * messages pendant la note, donc chez celui qui sonne — les neuf vivent dans la librairie de leur
 * paramètre. Un paramètre tient donc dans DEUX fichiers, et le garde vérifie exactement ça.
 *
 * INJECTION : la faute est portée dans l'ACCUSÉ (un univers privé d'un mot, un mot déplacé chez
 * le mauvais résolveur) puis dans le JUGE (les deux comparaisons rejouées isolées).
 */
import { universeControlNames } from '../src/transpiler/libs.js';
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ─── LA MATRICE — le PRODUIT, jamais une liste recopiée ──────────────────────────────────────
const PARAMETRES = ['vel', 'mod', 'pitch', 'press', 'volume', 'articul', 'pan', 'map', 'transpose'];
const MODES = ['fixed', 'step', 'cont'];
// `press` + `step` s'écrit avec un seul `s` — c'est le mot du moteur (`_presstep`,
// console_strings.json), pas une coquille. La forme régulière n'existe nulle part.
const mot = (p, m) => (p === 'press' && m === 'step' ? 'presstep' : `${p}${m}`);

// Le fichier attendu pour chaque mot : les discrets chez Kairos, le continu chez le paramètre.
const LIB_DU_PARAMETRE = {
  vel: 'expression', mod: 'midi', pitch: 'midi', press: 'midi', volume: 'midi',
  articul: 'engine', pan: 'expression', map: 'midi', transpose: 'transpo',
};
const libAttendue = (p, m) => (m === 'cont' ? LIB_DU_PARAMETRE[p] : 'variation');

// Où un mot est RÉELLEMENT déclaré — lu sur le bundle, section par section, jamais supposé.
const declarations = new Map();
for (const [nomLib, lib] of Object.entries(LIBS)) {
  for (const section of ['controls', 'engine']) {
    for (const [n, d] of Object.entries(lib?.[section] || {})) {
      if (n.startsWith('_') || !d || typeof d !== 'object' || !('args' in d)) continue;
      declarations.set(n, { lib: nomLib, resolvedBy: lib.resolvedBy ?? null });
    }
  }
}

// ─── 0. Témoin anti-rétrécissement — la matrice n'est pas vide et fait bien vingt-sept ───────
const tous = PARAMETRES.flatMap((p) => MODES.map((m) => mot(p, m)));
ok(tous.length === 27, `0. la matrice doit produire 27 mots (produite : ${tous.length})`);
ok(new Set(tous).size === 27, '0. les 27 mots doivent être distincts');

// ─── 1. CHAQUE MOT EST DÉCLARÉ ───────────────────────────────────────────────────────────────
const noms = universeControlNames();
for (const p of PARAMETRES) for (const m of MODES) {
  const n = mot(p, m);
  ok(noms.has(n), `1. '${n}' n'est déclaré nulle part — le mode ${m} de ${p} manque à la famille`);
}

// ─── 2. CHAQUE MOT EST RANGÉ CHEZ SON RÉSOLVEUR ──────────────────────────────────────────────
//
// ⚠️ CE VOLET TENAIT UNE RÈGLE QUE ROMAIN A REMPLACÉE le 2026-08-13, et il l'a fallu dire plutôt
// que l'ajuster. Il exigeait que le continu vive dans la librairie de SON PARAMÈTRE — d'où
// `articulcont` chez `engine` (BPx) et `transposecont` chez `transpo` (Kairos). L'arbitrage :
// « les contrôles continus partent aux RUNTIMES, SANS EXCEPTION ; la destination suit la NATURE du
// mot, pas le comportement du moteur ». Or ni le moteur ni le résolveur d'arbre ne SONNENT — tous
// deux travaillent note à note, et un mode continu se définit par des messages intermédiaires
// PENDANT la note. La règle exacte est donc : un mode continu vit dans une librairie dont le
// destinataire est une SORTIE.
//
// Les modes discrets ne bougent pas : ils se résolvent à la note, donc chez Kairos (`variation`).
const SORTIES = new Set(['toutes les sorties', 'runtime-MIDI', 'runtime-audio', 'runtime-OSC',
                         'runtime-codevoices']);
for (const p of PARAMETRES) for (const m of MODES) {
  const n = mot(p, m);
  const d = declarations.get(n);
  if (!d) continue;   // déjà signalé en 1
  if (m === 'cont') {
    ok(SORTIES.has(d.resolvedBy),
       `2. '${n}' est déclaré dans lib/${d.lib}.json, dont le destinataire est `
       + `'${d.resolvedBy}' — un mode CONTINU part à une SORTIE, sans exception(arbitrage Romain, `
       + `2026-08-13) : il exige des messages intermédiaires pendant la note, et ni le moteur ni le `
       + `résolveur d'arbre ne sonnent.`);
  } else {
    ok(d.lib === 'variation',
       `2. '${n}' est déclaré dans lib/${d.lib}.json ; il doit vivre dans lib/variation.json — `
       + `les modes discrets se résolvent à la note, donc chez Kairos`);
  }
}
// TÉMOIN D'INSTRUMENT — la liste des sorties doit EXCLURE le moteur et le résolveur, sinon le
// volet accepterait exactement ce que l'arbitrage refuse.
ok(!SORTIES.has('BPx') && !SORTIES.has('Kairos'),
   "2. TÉMOIN : ni 'BPx' ni 'Kairos' ne comptent comme une sortie — sans quoi ce volet validerait "
   + "le rangement que Romain vient d'écarter");
ok(LIBS.variation?.resolvedBy === 'Kairos',
   `2. lib/variation.json doit déclarer Kairos comme destinataire(déclaré : ${LIBS.variation?.resolvedBy})`);

// ─── 3. CHAQUE MOT S'ÉCRIT — dans le flux ET sur un symbole ──────────────────────────────────
for (const p of PARAMETRES) for (const m of MODES) {
  const n = mot(p, m);
  for (const [ou, src] of [
    ['dans le flux', `core\nalphabet.western:midi\n\n-----\nS -> !(${n}) C4\n`],
    ['sur un symbole', `core\nalphabet.western:midi\n\n-----\nS -> C4(${n})\n`],
  ]) {
    const r = compileToBPxAST(src);
    const errs = r.errors ?? [];
    ok(errs.length === 0,
       `3. '${n}' est refusé ${ou} : ${String(errs[0]?.message ?? errs[0]).slice(0, 110)}`);
  }
}

// ─── 4. INJECTION DANS LE JUGE — les deux comparaisons, rejouées isolées ─────────────────────
const manquants = (matrice, univers) => matrice.filter((n) => !univers.has(n));
ok(manquants(['velfixed', 'velstep'], new Set(['velfixed'])).length === 1,
   "4. (mord) la comparaison doit signaler 'velstep' absent d'un univers qui ne le porte pas");
ok(manquants(['velfixed'], new Set(['velfixed'])).length === 0,
   '4. (se tait) rien à signaler quand la matrice est couverte');

const malRange = (n, reelle, attendue) => reelle !== attendue;
ok(malRange('mapstep', 'midi', 'variation'), "4. (mord) 'mapstep' déclaré côté MIDI doit être signalé");
ok(!malRange('mapcont', 'midi', 'midi'), "4. (se tait) 'mapcont' déclaré côté MIDI est à sa place");

if (echecs.length) {
  console.error(`❌ famille des modes de variation : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ les 9 paramètres portent leurs 3 modes, rangés chez leur résolveur — ${passe} vérification(s) passée(s)`);
}
