#!/usr/bin/env node
/**
 * GARDE — UNE RÈGLE QUE RIEN N'INVOQUE S'ANNONCE, ET L'AXIOME SE TAIT.
 *
 * Demande de Romain, 2026-09-06 : *« à un moment voir que ce non terminal n'est nommé qu'une seule
 * fois et présent dans aucune autre règle → à ce moment-là il peut émettre un warning ? »*
 *
 * ⛔ C'EST UN AVERTISSEMENT, PAS UN REFUS. Une règle morte ne rend pas la scène fausse : elle ne
 * s'exécute simplement jamais. Le canal est donc `warnings`, et ce garde vérifie AUSSI que `errors`
 * reste vide — mêler les deux ferait d'une règle morte une faute.
 *
 * ⛔ ET IL NE SE JUSTIFIE PAS PAR LE NATIF — mesuré par bp3-engine le 2026-09-06 : sur deux règles
 * mortes, le moteur produit sans un mot, `Errors: 0`, aucune trace. *« BPScript fait ce que BP3 sait
 * faire »* est satisfait par le SILENCE ; cet avertissement est un AJOUT délibéré. Sans cette ligne,
 * quelqu'un le supprimera un jour au nom de la conformité au moteur.
 *
 * ⛔ CE QUI REND CE GARDE NÉCESSAIRE : L'AXIOME ET UN ORPHELIN SONT STRUCTURELLEMENT IDENTIQUES —
 * définis tous les deux, invoqués ni l'un ni l'autre. Rien dans l'arbre ne les sépare, et deux
 * tentatives de les distinguer par CALCUL ont échoué sur mesure :
 *
 *     « la première règle écrite »          436 signalements, dont 3 FAUX
 *     « plusieurs points d'entrée par sg »  966 signalements — une sous-grammaire est invoquée
 *                                           depuis une AUTRE, et je ne cherchais que dans la sienne
 *     l'axiome DÉCLARÉ, lu au schéma        110, sur 28 scènes des 377 du corpus publié
 *
 * ⚠️ LES TROIS FAUX DE LA PREMIÈRE TENTATIVE ÉTAIENT `kairos-octave-transpose-*`, où `MOTIF` précède
 * `S`. Romain les soupçonnait non conformes ; bp3-engine a mesuré le contraire — le natif produit
 * cette forme sans un mot, l'ordre d'écriture n'ayant AUCUN effet sur le point de départ. Le volet C
 * ci-dessous fige ce cas, parce que c'est lui qui a démasqué le calcul fautif.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { SYNTAXE } from '../src/transpiler/syntaxe-data.js';
import { TYPES_QUI_INVOQUENT } from '../src/transpiler/resolution.js';
import { bpsPath, aBps } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const S = 'core\nalphabet.western\n-----\n';
const lire = (corps) => {
  const r = compileToBPxAST(`${S}${corps}`);
  return {
    erreurs: (r.errors || []).map((e) => e.code || String(e)),
    morts: (r.warnings || []).filter((w) => w && w.code === 'RESOLVE_RULE_NEVER_REACHED')
      .map((w) => w.message),
  };
};

// ── SOCLE — l'axiome doit être DÉCLARÉ, sinon ce garde mesure un juge qui se tait ────────────────
// `avertirNonTerminalJamaisInvoque` rend [] quand l'axiome manque, et c'est la sortie JUSTE : sans
// lui, il crierait sur le point d'entrée des 372 scènes qui en portent un. Mais un garde qui compte
// zéro avertissement ne distingue alors pas « rien à signaler » de « juge débranché ».
ok(typeof SYNTAXE?.axiome?.mot === 'string' && SYNTAXE.axiome.mot.length > 0,
   `SOCLE : le schéma de syntaxe doit DÉCLARER l'axiome — reçu ${JSON.stringify(SYNTAXE?.axiome)}. `
   + `Sans lui le juge se tait par conception, et tous les volets ci-dessous passeraient sur du vide.`);
const AXIOME = SYNTAXE?.axiome?.mot;

// ── A. CE QUI DOIT AVERTIR ───────────────────────────────────────────────────────────────────────
{
  const un = lire(`${AXIOME} -> C4\nORPH -> E4\n`);
  ok(un.morts.length === 1, `A. une règle morte doit s'annoncer — reçu ${un.morts.length}`);
  ok(un.erreurs.length === 0,
     `A. et NE PAS être une erreur — reçu ${JSON.stringify(un.erreurs)}. Un avertissement qui remplit `
     + `'errors' arrête la compilation d'une scène valide.`);
  ok(/ORPH/.test(un.morts[0] || ''),
     `A. le message doit NOMMER la règle — reçu ${JSON.stringify(un.morts[0])}`);

  // DEUX règles mortes rendent DEUX avertissements : un juge qui s'arrête au premier laisse
  // l'auteur corriger, recompiler, et retrouver la suivante — un aller-retour par faute.
  const deux = lire(`${AXIOME} -> C4\nO1 -> E4\nO2 -> F4\n`);
  ok(deux.morts.length === 2, `A. DEUX règles mortes doivent rendre DEUX avertissements — reçu ${deux.morts.length}`);
}

// ── B. CE QUI DOIT SE TAIRE — la moitié qui démasque une règle trop large ────────────────────────
{
  const saine = lire(`${AXIOME} -> M\nM -> C4\n`);
  ok(saine.morts.length === 0, `B. une grammaire saine ne dit rien — reçu ${JSON.stringify(saine.morts)}`);

  // ⛔ L'AXIOME EST DÉFINI ET JAMAIS INVOQUÉ, comme un orphelin. C'est LE cas que seule la
  // déclaration sépare, et il vaut pour 372 des 377 scènes du corpus.
  const axiome = lire(`${AXIOME} -> C4 D4\n`);
  ok(axiome.morts.length === 0,
     `B. l'AXIOME ne s'annonce jamais — reçu ${JSON.stringify(axiome.morts)}. Il est défini et jamais `
     + `invoqué, exactement comme un orphelin : seule sa déclaration au schéma les sépare.`);

  // ⚠️ ET `S` INVOQUÉ PAR UNE AUTRE RÈGLE RESTE L'AXIOME — borne mesurée au natif par bp3-engine :
  // « être invoqué ne le disqualifie pas ». Un juge qui exigerait qu'il ne soit jamais invoqué
  // rendrait la scène ci-dessous fautive.
  const rappele = lire(`${AXIOME} -> M\nM -> C4 ${AXIOME}\n`);
  ok(rappele.morts.length === 0,
     `B. l'axiome INVOQUÉ par une autre règle reste l'axiome — reçu ${JSON.stringify(rappele.morts)}`);
}

// ── C. LE CAS QUI A DÉMASQUÉ LE CALCUL FAUTIF, ET QUI EST CONFORME ───────────────────────────────
// `MOTIF` écrit AVANT `S`. Mon premier juge prenait « la première règle écrite » pour l'axiome et
// signalait `S` — trois scènes du corpus, toutes justes. bp3-engine a mesuré le natif : cette forme
// produit sans un mot, l'ordre d'écriture n'a aucun effet sur le point de départ.
{
  const ordre = lire(`MOTIF -> C4\n${AXIOME} -> MOTIF MOTIF\n`);
  ok(ordre.morts.length === 0,
     `C. l'ordre d'écriture des règles n'a AUCUN effet sur le point de départ — reçu `
     + `${JSON.stringify(ordre.morts)}. Le natif produit cette forme sans un mot (bp3-engine, `
     + `2026-09-06) : un juge qui prend la PREMIÈRE RÈGLE ÉCRITE pour l'axiome signale ici à tort.`);
  ok(ordre.erreurs.length === 0, `C. et elle doit compiler — reçu ${JSON.stringify(ordre.erreurs)}`);
}

// ── D. LE TÉMOIN QUI DISCRIMINE — sans lui, un juge DÉBRANCHÉ passerait tout ────────────────────
// Les volets B et C attendent le SILENCE. Un juge qui ne tourne plus les passerait tous les trois,
// et seul le volet A le rattrape. Ce témoin le dit autrement : le mécanisme doit distinguer deux
// scènes qui ne diffèrent que par la règle morte.
{
  const avec = lire(`${AXIOME} -> C4\nORPH -> E4\n`);
  const sans = lire(`${AXIOME} -> C4\n`);
  ok(avec.morts.length > sans.morts.length,
     `D. TÉMOIN — le juge doit DISCRIMINER : la même scène avec et sans règle morte rend `
     + `${avec.morts.length} et ${sans.morts.length}. Égaux, il ne mesure rien.`);
}

// ── E. CE QUI N'EST PAS UNE RÈGLE NE S'ANNONCE PAS COMME UNE RÈGLE ──────────────────────────────
// ⛔ MESURÉ : le juge affirmait « la règle X » sur 11 des 58 avertissements du corpus, où X n'était
// pas une règle — le SILENCE `-` de `dhati2:28`, les accolades brutes `{` `}` de `koto3:43`, le
// motif `Step3Up ?1 ?2 ?3` de `mohanam:173`. Une règle n'a de nom que si son membre gauche est UN
// SEUL symbole ; au-delà c'est un MOTIF, et ses éléments ne définissent rien.
{
  const cas = [
    ['un membre gauche à plusieurs symboles est un MOTIF', `zzz ${AXIOME} -> C4\n${AXIOME} -> D4\n`],
    ['et l\'ordre dans le motif n\'y change rien',          `${AXIOME} zzz -> C4\n${AXIOME} -> D4\n`],
    ['un symbole NÉGÉ occupe une position',                 `#zzz ${AXIOME} -> C4\n${AXIOME} -> D4\n`],
    ['un négé PARENTHÉSÉ aussi',                            `#(zzz) ${AXIOME} -> C4\n${AXIOME} -> D4\n`],
    ['un JOKER occupe une position',                        `?zzz ${AXIOME} -> C4\n${AXIOME} -> D4\n`],
    ['un contexte REGARDE sans définir',                    `(zzz) ${AXIOME} -> C4\n${AXIOME} -> D4\n`],
  ];
  for (const [quoi, corps] of cas) {
    const r = lire(corps);
    ok(r.morts.length === 0,
       `E. ${quoi} — reçu ${JSON.stringify(r.morts)}. Dire « la règle 'zzz' est morte » là où 'zzz' `
       + `n'est pas une règle apprend à ignorer le canal entier.`);
  }
}

// ── F. UN GABARIT NOMME SA RÈGLE AUTANT QU'UN SYMBOLE ───────────────────────────────────────────
// ⛔ `dhati2` invoque ses sept motifs PAR GABARIT (`S <> $A16 $V8 $A'8 …`) : un juge qui ne lit que
// les nœuds `Symbol` les déclarait tous morts. C'est le cas qui a fait passer le corpus de 58
// avertissements à 32.
{
  const maitre = lire(`${AXIOME} -> $M\nM -> C4 D4\n`);
  ok(maitre.morts.length === 0,
     `F. un gabarit MAÎTRE '$M' invoque la règle 'M' — reçu ${JSON.stringify(maitre.morts)}`);
  const esclave = lire(`${AXIOME} -> $M &M\nM -> C4 D4\n`);
  ok(esclave.morts.length === 0,
     `F. et le REJOUÉ '&M' aussi — reçu ${JSON.stringify(esclave.morts)}`);
}

// ── G. LA MATRICE DES TYPES QUI INVOQUENT — un garde de CONSTRUCTION, pas de graphie ────────────
// ⛔ Réparer « le gabarit » seul aurait réparé la forme qui s'est montrée. Ce volet relève TOUT type
// de nœud porteur d'un `name` sur le corpus entier et exige que chacun soit tranché : soit il
// invoque (il est dans `TYPES_QUI_INVOQUENT`), soit il est ici, mesuré à ZÉRO coïncidence avec une
// tête de règle. Une graphie neuve rougit au lieu de passer en silence.
const NE_NOMME_AUCUNE_REGLE = new Set(['Control', 'OutTimeObject']);
{
  const ROOT = path.join(import.meta.dirname, '..');
  const cibles = [];
  const g = JSON.parse(readFileSync(path.join(ROOT, 'test/grammars/grammars.json'), 'utf8'));
  for (const [n, m] of Object.entries(g)) if (m && m.status === 'active' && aBps(n)) cibles.push(bpsPath(n));
  const demos = path.join(ROOT, 'public/demos');
  if (existsSync(demos)) for (const f of readdirSync(demos).filter((f) => f.endsWith('.bps')))
    cibles.push(path.join(demos, f));

  const vus = new Map();            // type → nb de noms qui SONT des têtes de règle
  let scenes = 0;
  for (const f of cibles) {
    let r; try { r = compileToBPxAST(readFileSync(f, 'utf8')); } catch { continue; }
    if (!r.ast) continue;
    scenes++;
    const tetes = new Set();
    for (const sg of r.ast.subgrammars || []) for (const rg of sg.rules || [])
      if ((rg.lhs || []).length === 1 && rg.lhs[0]?.type === 'Symbol' && !rg.lhs[0].negated)
        tetes.add(rg.lhs[0].name);
    const w = (n, deja = new Set()) => {
      if (!n || typeof n !== 'object' || deja.has(n)) return;
      deja.add(n);
      if (Array.isArray(n)) { for (const e of n) w(e, deja); return; }
      if (typeof n.name === 'string' && n.type)
        vus.set(n.type, (vus.get(n.type) || 0) + (tetes.has(n.name) ? 1 : 0));
      for (const k of Object.keys(n)) w(n[k], deja);
    };
    for (const sg of r.ast.subgrammars || []) for (const rg of sg.rules || []) { w(rg.rhs); w(rg.contexts); w(rg.lhs); }
  }

  // ⛔ UN GARDE COMPTE CE QU'IL A EXAMINÉ ET REFUSE ZÉRO : sur un corpus introuvable, tous les
  // volets ci-dessous passeraient sur du vide.
  ok(scenes >= 100, `G. le corpus doit être ATTEINT — ${scenes} scène(s) compilée(s) sur ${cibles.length} cible(s)`);

  for (const [type, combien] of vus) {
    if (TYPES_QUI_INVOQUENT.has(type)) {
      ok(combien > 0,
         `G. '${type}' est déclaré INVOQUANT mais aucun de ses noms n'est une tête de règle sur le `
         + `corpus — la liste porte un type mort, ou le corpus a changé.`);
    } else {
      ok(NE_NOMME_AUCUNE_REGLE.has(type),
         `G. TYPE NEUF PORTEUR D'UN NOM : '${type}' (${combien} de ses noms sont des têtes de règle). `
         + `Trancher : s'il désigne une règle, l'ajouter à TYPES_QUI_INVOQUENT ; sinon, à la liste `
         + `NE_NOMME_AUCUNE_REGLE de ce garde. Le laisser dehors rend un avertissement FAUX.`);
      ok(combien === 0,
         `G. '${type}' est réputé ne nommer aucune règle, or ${combien} de ses noms sont des têtes `
         + `de règle — le juge crie donc sur des règles vivantes.`);
    }
  }
}

if (echecs.length) {
  console.error(`[règle morte] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[règle morte] ${passe} PASS / 0 FAIL — ${passe} assertion(s) · une règle que rien `
  + `n'invoque s'annonce, l'axiome '${AXIOME}' se tait`);
