#!/usr/bin/env node
/**
 * GARDE — la prudence du juge partagé regarde LES DEUX CÔTÉS, jamais la seule référence.
 *
 * LE DÉFAUT QUE CE GARDE FIGE. Le juge renonce à conclure quand la référence porte une structure
 * que la voie candidate ne rend pas. Son déclencheur ne testait QUE la référence : il suffisait
 * que le NATIF porte une accolade pour que la prudence tombe — y compris sur une voie qui rend
 * parfaitement la structure. Mesuré par bp3-frontend sur sa propre voie : huit verdicts effacés
 * en non-mesurable alors que sa chaîne rendait groupes, imbrication et virgules. Le juge est
 * PARTAGÉ : une prudence juste chez l'un devenait un faux non-mesurable chez l'autre.
 *
 * LA MATRICE, ses quatre cases — c'est elle qui écrit la portée ET son complément :
 *   référence structurée · candidat plat        → on renonce, et on dit pourquoi
 *   référence structurée · candidat structuré   → on CONCLUT
 *   référence plate      · candidat plat        → on conclut
 *   référence plate      · candidat structuré   → on conclut
 */
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.error(`FAIL — ${quoi}`); } };

// Une baseline factice, chez MOI, pour éprouver le juge sans toucher à celle d'un voisin.
const racine = mkdtempSync(path.join(tmpdir(), 'juge-prudence-'));
mkdirSync(path.join(racine, 'captures'), { recursive: true });
const entrees = {};
const poser = (nom, texte) => {
  writeFileSync(path.join(racine, 'captures', `${nom}.text.txt`), texte);
  entrees[nom] = { grammaire: nom, produit: true, modalite: 'TEXTE', action: 'produce-all', capture: path.join('captures', `${nom}.text.txt`) };
};
const STRUCTUREE = 'a{- b,a c} d';
const PLATE = 'a b a c d';
poser('refStructuree', STRUCTUREE);
poser('refPlate', PLATE);
writeFileSync(path.join(racine, 'baseline.json'), JSON.stringify({ grammaires: entrees }));

process.env.BASELINE_DIR = racine;
const J = require('./compare_modal.cjs');
const { NON_MESURABLE, ISO, DIFF } = J;

// L'instrument d'abord : la baseline factice se charge, sinon les quatre cases ne mesurent rien.
verifier(J.referenceFor('refStructuree') !== null, 'la baseline factice se charge');
verifier(String(J.referenceFor('refStructuree').text).includes('{'), 'et sa référence porte bien une structure');

const juger = (nom, texte) => J.compare(nom, { text: texte }).status;

// ── LA MATRICE ────────────────────────────────────────────────────────────────────────────────
verifier(juger('refStructuree', PLATE) === NON_MESURABLE,
  'référence structurée + candidat plat : le juge RENONCE');
verifier(juger('refStructuree', STRUCTUREE) === ISO,
  'référence structurée + candidat structuré ET identique : le juge CONCLUT, et il conclut ISO');
verifier(juger('refStructuree', 'a{- b,a z} d') === DIFF,
  'référence structurée + candidat structuré mais DIFFÉRENT : le juge CONCLUT, et il conclut DIFF');
verifier(juger('refPlate', PLATE) === ISO,
  'référence plate + candidat plat identique : le juge conclut ISO');
verifier(juger('refPlate', 'a b a z d') === DIFF,
  'référence plate + candidat plat différent : le juge conclut DIFF');
verifier(juger('refPlate', 'a{- b,a c} d') === DIFF,
  'référence plate + candidat structuré : le juge conclut, il ne renonce pas');

// ── LA GRAPHIE NE COMPTE TOUJOURS PAS, ET LA PRUDENCE NE LA MANGE PAS ─────────────────────────
verifier(juger('refStructuree', 'a { - b , a c } d') === ISO,
  "même structure, espacement différent : ISO — l'espacement ne se compare pas");
verifier(juger('refPlate', 'abacd') === ISO,
  'même suite de terminaux, tout collé : ISO');

// ── LE JUGE MORD : on injecte le DÉFAUT D'ORIGINE et on exige qu'il se voie ────────────────────
{
  // Le défaut = ne regarder que la référence. On le simule et on montre qu'il donne un AUTRE
  // verdict sur la case qui compte — sans quoi le garde ne prouverait rien.
  const declencheurFautif = (ref) => /[{},()]/.test(ref);
  const verdictFautif = declencheurFautif(STRUCTUREE) ? NON_MESURABLE : ISO;
  verifier(verdictFautif === NON_MESURABLE && juger('refStructuree', STRUCTUREE) === ISO,
    "le déclencheur d'origine aurait rendu NON-MESURABLE là où le juge corrigé conclut : le garde mord");
}

console.log(`Résultat une_prudence_regarde_les_deux_cotes : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
