#!/usr/bin/env node
// AUCUNE FORME NE FAIT BOUCLER LE COMPILATEUR — le mode d'échec le plus cher de tous.
//
// CE QUI A COÛTÉ CE GARDE. Le 2026-08-06, `$A16 (meter:4/4)` — une ancre de gabarit suivie d'un
// réglage à valeur fractionnaire — faisait tourner sans fin la lecture d'arguments de gabarit :
// un jeton qu'aucune branche ne consommait laissait le curseur en place, et la boucle empilait
// des arguments vides. Mesuré : 6,6 Go en 45 s, puis mort par saturation. Romain a perdu sa
// session distante pendant que je mesurais.
//
// ⚠️ POURQUOI CE MODE EST PIRE QUE TOUS CEUX QUE JE CHASSE. Un fail-loud crie ; un défaut muet
// se découvre tard ; celui-ci EMPORTE LA MACHINE — il ne laisse ni message, ni mesure, ni
// même la session dans laquelle on l'aurait lu. Et il ment sur son auteur : j'ai d'abord cru
// que ma propre mesure était gloutonne, et j'ai « réparé » le marcheur d'arbre avant de
// comprendre que le compilateur était en cause. Deux corrections à côté de la plaque avant la
// bonne, exactement parce que l'instrument accusé était le mien.
//
// CE QU'IL GARDE, ET C'EST L'ESPACE, PAS L'INCIDENT :
//   1. LE CORPUS ENTIER, sous plafond de mémoire et de temps, dans un processus FILS. Si une
//      seule scène s'emballe, le fils meurt et ce garde rougit — quelle que soit la cause, y
//      compris une cause qui n'existe pas encore. C'est le seul filet qui ne dépende pas de
//      savoir d'avance par où ça peut boucler.
//   2. UNE MATRICE de formes : un gabarit nommé × chaque nature de jeton qui peut paraître
//      dans ses arguments. Chaque cellule doit rendre un verdict — compilation ou refus NOMMÉ
//      — en un temps borné. Ajouter un jeton teste toutes les positions ; ajouter une position
//      teste tous les jetons.
//
// LES DEUX SENS SONT PROUVÉS : la matrice contient des cellules qui doivent PASSER et des
// cellules qui doivent REFUSER. Un garde qui ne verrait que des refus laisserait passer une
// règle qui refuse tout.
//
// ⚠️ ET LA PORTÉE DE CHAQUE VOLET EST MESURÉE, PAS SUPPOSÉE. À l'injection du défaut d'origine,
// le volet 1 est resté VERT : les scènes du corpus écrivent leur réglage DÉTACHÉ du gabarit,
// donc elles n'entrent jamais dans la lecture d'arguments. Seul le volet 2 a rougi. Le corpus
// ne garde que ce que le corpus écrit AUJOURD'HUI — il ne remplace pas l'énumération des
// formes, il attrape ce qu'aucune énumération n'avait prévu. Les deux volets ne se
// substituent pas : l'un couvre les causes inconnues sur les écritures connues, l'autre les
// écritures inconnues sur une cause connue.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');

// Plafonds : larges pour le travail normal, étroits devant un emballement. Le corpus mesuré
// tient en ~150 Mo et quelques secondes ; un fils qui touche ces bornes ne ralentit pas, il
// s'emballe.
//
// ⛔ LE TEMPS SE MESURE EN CPU, JAMAIS À L'HORLOGE MURALE. Ce garde a rougi le 2026-09-07 sous
// une borne murale de 120 s : le portillon lance DOUZE gardes en parallèle, et le fils a mis
// 129 s d'horloge sans consommer une seconde de plus qu'à l'ordinaire. *Un emballement consomme
// du processeur sans fin ; une contention ATTEND.* Borner l'horloge, c'est mesurer la charge de
// la machine et l'appeler « emballement » — et la parade tentante, relever la borne, ajuste
// l'instrument à ce qui sort au lieu de mesurer la bonne grandeur.
//
// ⇒ Le fils rend son PROPRE temps processeur, et c'est lui qui est borné. L'horloge garde un
//   filet, cinq fois plus large : il n'attrape plus qu'un fils qui ne rendrait JAMAIS la main —
//   une attente, pas une boucle, que le compteur CPU ne verrait pas.
const PLAFOND_MO = 1024;
const PLAFOND_CPU_S = 120;
// ⚠️ LE FILET MURAL EST UNE CONSTANTE PROPRE, PAS UN MULTIPLE DE L'AUTRE. Il l'était, et mon
// injection dans la borne CPU resserrait le filet du même coup : le fils mourait de l'horloge et
// je lisais ça comme « le compteur CPU a mordu ». *Deux bornes dérivées l'une de l'autre ne se
// distinguent pas sous injection.* Celle-ci se dimensionne sur ce qu'elle attrape — un fils qui ne
// rend JAMAIS la main —, jamais sur le travail normal, qui tient en ~37 s de processeur.
const FILET_MURAL_S = 600;

let rouge = false;
const dire = (ok, texte) => { console.log(`${ok ? '✅' : '❌'} ${texte}`); if (!ok) rouge = true; };

// ────────────────────────────────────────────────────────────────────────────
// 1. LE CORPUS ENTIER, sous plafond — le filet qui ne présume rien de la cause
// ────────────────────────────────────────────────────────────────────────────
const scriptCorpus = `
  const { compileToBPxAST } = await import(${JSON.stringify(path.join(RACINE, 'src/transpiler/index.js'))});
  const { toutesLesScenes } = await import(${JSON.stringify(path.join(ICI, 'corpus.mjs'))});
  let n = 0;
  for (const [, src] of toutesLesScenes()) { try { compileToBPxAST(src); } catch {} n++; }
  if (n < 150) { console.error('SOCLE:' + n); process.exit(2); }
  // Le temps PROCESSEUR de ce fils — insensible à ce que la machine fait par ailleurs.
  const u = process.cpuUsage();
  console.log('SCENES:' + n);
  console.log('CPU:' + Math.round((u.user + u.system) / 1000));
`;
const fils = spawnSync(process.execPath,
  ['--max-old-space-size=' + PLAFOND_MO, '--input-type=module', '-e', scriptCorpus],
  { encoding: 'utf-8', timeout: FILET_MURAL_S * 1000, cwd: RACINE });

const compte = /SCENES:(\d+)/.exec(fils.stdout || '');
const cpuMs = Number(/CPU:(\d+)/.exec(fils.stdout || '')?.[1] ?? NaN);
if (fils.signal === 'SIGTERM') {
  dire(false, `le corpus n'a pas rendu la main en ${FILET_MURAL_S} s d'horloge — il ne compile plus, il attend.`);
} else if (fils.status === 2) {
  dire(false, `SOCLE : le fils n'a vu que ${/SOCLE:(\d+)/.exec(fils.stderr || '')?.[1] ?? '0'} scènes — le corpus est absent, ce garde ne prouverait rien.`);
} else if (fils.status !== 0) {
  dire(false, `le compilateur s'est effondré sur le corpus sous ${PLAFOND_MO} Mo (code ${fils.status}, `
            + `signal ${fils.signal ?? 'aucun'}) — emballement, pas une simple erreur de compilation.`);
} else if (!Number.isFinite(cpuMs)) {
  dire(false, `le fils n'a pas rendu son temps processeur — sans lui ce volet ne mesure plus rien, `
            + `et un emballement passerait pour un succès.`);
} else if (cpuMs > PLAFOND_CPU_S * 1000) {
  dire(false, `le corpus a consommé ${(cpuMs / 1000).toFixed(1)} s de PROCESSEUR, plafond ${PLAFOND_CPU_S} s — `
            + `une scène fait boucler le compilateur. Ce compte ne dépend pas de la charge de la machine.`);
} else {
  dire(true, `${compte?.[1] ?? '?'} scènes compilées sous ${PLAFOND_MO} Mo et ${(cpuMs / 1000).toFixed(1)} s `
           + `de PROCESSEUR (plafond ${PLAFOND_CPU_S} s) — aucun emballement.`);
}

// ────────────────────────────────────────────────────────────────────────────
// 2. LA MATRICE — un gabarit nommé × chaque nature de jeton dans ses arguments
// ────────────────────────────────────────────────────────────────────────────
// Le défaut s'est montré sur la barre de fraction. Il pouvait vivre sur TOUT jeton qu'aucune
// branche ne consomme : on parcourt donc les natures, pas la graphie du jour.
//
// ⚠️ CE GARDE MESURAIT « UN ARBRE SORT-IL ? » ET CROYAIT MESURER « EST-CE ACCEPTÉ ? » — le même
// défaut d'instrument que mon empreinte de corpus, trouvé le même jour (2026-08-08). Le compilateur
// rend un arbre ET une liste d'erreurs : `$T(k:2)` portait un refus depuis toujours et cette matrice
// le comptait « compile ». Trois de ses attendus étaient donc faux sans que rien ne le dise.
// On mesure désormais les ERREURS. Le sujet du fichier — aucune forme ne fait BOUCLER — est mesuré
// par le chronomètre du sous-processus, pas par cette colonne ; elle ne sert qu'à figer ce que
// chaque nature de jeton PRODUIT, pour qu'un changement de lecture se voie.
const JETONS = [
  // `$T(2)` : le seul argument qu'un gabarit accepte est son RANG, un entier collé.
  { nom: 'entier',        arg: '2',        attendu: 'passe'  },
  // Tout le reste refuse, et pour deux familles de raison : le jeton n'a pas sa place dans des
  // arguments de gabarit (`/ - * [ { .`), ou la parenthèse est lue comme un sac dont la clé
  // n'existe pas (`x`, `k:2`, `k:1/2`). Les deux sont des refus NOMMÉS.
  { nom: 'nom',           arg: 'x',        attendu: 'refus'   },
  { nom: 'clé:entier',    arg: 'k:2',      attendu: 'refus'   },
  { nom: 'fraction',      arg: '1/2',      attendu: 'refus'   },
  { nom: 'clé:fraction',  arg: 'k:1/2',    attendu: 'refus'   },
  { nom: 'signe moins',   arg: '-',        attendu: 'refus'   },
  { nom: 'astérisque',    arg: '*',        attendu: 'refus'   },
  { nom: 'crochet',       arg: '[',        attendu: 'refus'   },
  { nom: 'accolade',      arg: '{',        attendu: 'refus'   },
  { nom: 'point',         arg: '.',        attendu: 'refus'   },
];

// Les DEUX positions où la même parenthèse se lit autrement : collée au gabarit (arguments),
// détachée par une espace (réglage de règle). C'est l'espace qui tranche — la même loi que le
// tableau des portées d'AST.md.
const POSITIONS = [
  { nom: 'collée',  forme: (a) => `S -> $T(${a})` },
  { nom: 'espacée', forme: (a) => `S -> $T (${a})` },
];

const scriptMatrice = `
  const { compileToBPxAST } = await import(${JSON.stringify(path.join(RACINE, 'src/transpiler/index.js'))});
  const cas = JSON.parse(process.env.CAS);
  const out = [];
  for (const { cle, source } of cas) {
    let verdict;
    // ⚠️ ON REGARDE LES ERREURS, PAS L'ARBRE : un arbre sort MÊME quand la scène est refusée.
    try { const r = compileToBPxAST(source); verdict = (r.errors || []).length ? 'refus' : 'passe'; }
    catch { verdict = 'refus'; }
    out.push(cle + '=' + verdict);
  }
  console.log(out.join('\\n'));
`;
const cas = [];
for (const p of POSITIONS) for (const j of JETONS)
  cas.push({ cle: `${p.nom}/${j.nom}`, source: `core\n-----\n${p.forme(j.arg)}\n` });

const filsM = spawnSync(process.execPath,
  ['--max-old-space-size=512', '--input-type=module', '-e', scriptMatrice],
  { encoding: 'utf-8', timeout: 60_000, cwd: RACINE, env: { ...process.env, CAS: JSON.stringify(cas) } });

if (filsM.signal === 'SIGTERM' || filsM.status !== 0) {
  dire(false, `la matrice ${POSITIONS.length}×${JETONS.length} n'a pas rendu de verdict `
            + `(code ${filsM.status}, signal ${filsM.signal ?? 'aucun'}) — une cellule fait boucler le compilateur.`);
} else {
  const rendu = new Map((filsM.stdout || '').trim().split('\n').filter(Boolean).map(l => l.split('=')));
  // TÉMOIN ANTI-RÉTRÉCISSEMENT : la matrice doit rester pleine. Vidée, elle passerait au vert
  // en ne mesurant rien — le faux vert exact que ce fichier existe pour empêcher.
  const cellules = POSITIONS.length * JETONS.length;
  dire(rendu.size === cellules, `${rendu.size}/${cellules} cellules ont rendu un verdict borné.`);
  // La COLONNE COLLÉE porte les attentes : c'est elle qui lit des arguments de gabarit.
  // La colonne ESPACÉE lit un réglage de règle : toute nature y a un verdict, aucune n'y boucle
  // — c'est le seul invariant qu'on lui demande, et il est déjà rendu par le compte ci-dessus.
  const fautes = [];
  for (const j of JETONS) {
    const eu = rendu.get(`collée/${j.nom}`);
    if (eu !== j.attendu) fautes.push(`collée/${j.nom} : attendu ${j.attendu}, obtenu ${eu}`);
  }
  dire(fautes.length === 0, fautes.length === 0
    ? `les ${JETONS.length} natures de jeton rendent le verdict attendu en position collée `
      + `(${JETONS.filter(j => j.attendu === 'passe').length} passent, `
      + `${JETONS.filter(j => j.attendu === 'refus').length} refusent — les deux sens sont prouvés).`
    : `verdicts inattendus en position collée :\n     ` + fautes.join('\n     '));

  // ⚠️ TÉMOIN DES DEUX SENS — et il vient d'échouer à son office. Le compte au-dessus lisait encore
  // le mot 'compile', abandonné en corrigeant la mesure : il annonçait « 0 passent » sur une
  // matrice qui en attend un, et personne n'aurait relevé la phrase. Une matrice qui ne
  // contiendrait QUE des refus ne prouve rien — un compilateur qui refuserait tout la passerait.
  dire(JETONS.some(j => j.attendu === 'passe') && JETONS.some(j => j.attendu === 'refus'),
       `la matrice doit porter les DEUX verdicts — ${JETONS.filter(j => j.attendu === 'passe').length} `
       + `qui passent, ${JETONS.filter(j => j.attendu === 'refus').length} qui refusent. Avec un seul `
       + `des deux, elle ne mesure plus une frontière, elle décrit une humeur.`);
}

process.exit(rouge ? 1 : 0);
