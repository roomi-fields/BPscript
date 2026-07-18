#!/usr/bin/env node
/**
 * LE comparateur — unique, MODALITÉ-CONSCIENT, partagé.
 *
 * Décision 2026-07-18 (procédure de test suivi normée, 113 modalité) : on abandonne
 * s1/s2/s3 comme critère. On compare une production CANDIDATE à la baseline native,
 * DANS SA MODALITÉ, bit-à-bit :
 *   MIDI  → jetons timés vs jetons timés  ({token, start, end})
 *   TEXTE → texte vs texte
 * Comparer une modalité avec l'autre n'a pas de sens et rendrait un DIFF trompeur.
 *
 * AUTORITÉ DE LA MODALITÉ : bp3-engine/baseline-native/baseline.json. Elle n'est jamais
 * devinée ni déduite du contenu — c'est la baseline qui la déclare.
 *
 * PARTAGEABLE PAR CONSTRUCTION : ce module ne connaît NI BPScript, NI BPx, NI le frontal.
 * Il prend une production candidate déjà capturée et la confronte à la référence.
 * bp3-frontend l'utilise tel quel pour la Voie A, ce dépôt pour la Voie B.
 *
 * Usage bibliothèque :
 *   const { compare, loadBaseline } = require('./compare_modal.cjs');
 *   compare('765432', { tokens: [...] })        // MIDI
 *   compare('acceleration', { text: '…' })      // TEXTE
 *
 * Usage CLI (diagnostic) :
 *   node compare_modal.cjs --list                 statut déclaré de chaque grammaire
 *   node compare_modal.cjs <grammaire>            modalité + taille de la référence
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_BASELINE = path.resolve(
  __dirname, '..', '..', 'bp3-engine', 'baseline-native',
);

/** Statuts rendus. NON_MESURABLE n'est PAS un échec : la référence elle-même est muette. */
const ISO = 'ISO';
const DIFF = 'DIFF';
const NON_MESURABLE = 'NON-MESURABLE';
const ABSENT = 'ABSENT';

let _cache = null;

function loadBaseline(baselineDir = DEFAULT_BASELINE) {
  if (_cache && _cache.dir === baselineDir) return _cache;
  const file = path.join(baselineDir, 'baseline.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const byName = {};
  for (const e of Object.values(raw.grammaires)) byName[e.grammaire] = e;
  _cache = { dir: baselineDir, meta: { date: raw.date, binaire: raw.binaire, seed: raw.seed, n: raw.n }, byName };
  return _cache;
}

/**
 * Référence d'une grammaire : sa modalité déclarée et sa capture.
 * Rend `produit:false` + `raison` pour les grammaires que le natif lui-même ne produit pas.
 */
function referenceFor(name, baselineDir = DEFAULT_BASELINE) {
  const { byName, dir } = loadBaseline(baselineDir);
  const e = byName[name];
  if (!e) return null;
  const out = { name, modalite: e.modalite, produit: !!e.produit, raison: e.raison || null };
  if (!e.produit) return out;
  if (e.modalite === 'MIDI') {
    const f = path.join(dir, 'captures', `${name}.tokens.json`);
    if (fs.existsSync(f)) out.tokens = JSON.parse(fs.readFileSync(f, 'utf-8'));
  } else if (e.modalite === 'TEXTE') {
    const f = path.join(dir, 'captures', `${name}.text.txt`);
    if (fs.existsSync(f)) out.text = fs.readFileSync(f, 'utf-8');
  }
  return out;
}

/** Texte : on normalise UNIQUEMENT les blancs et les fins de ligne, jamais le contenu. */
const normText = (s) => String(s).replace(/\r\n?/g, '\n').trim().split(/\s+/).join(' ');

/** Jeton timé → forme comparable stable. */
const keyTok = (t) => `${t.token}@${t.start}-${t.end}`;

/**
 * Confronte une production candidate à la référence, DANS LA MODALITÉ DÉCLARÉE.
 *
 * @param {string} name        nom de grammaire (clé baseline)
 * @param {object} candidate   { tokens:[{token,start,end}] } ou { text:string }
 *                             `null`/absent = la voie candidate ne produit rien
 * @returns {{status, modalite, produit, n_ref, n_cand, detail}}
 */
function compare(name, candidate, baselineDir = DEFAULT_BASELINE) {
  const ref = referenceFor(name, baselineDir);
  if (!ref) return { status: ABSENT, modalite: null, detail: 'absente de la baseline' };

  // La RÉFÉRENCE est muette : rien à mesurer, ce n'est pas un échec de la voie candidate.
  if (!ref.produit) {
    return {
      status: NON_MESURABLE, modalite: null, produit: false,
      n_ref: 0, n_cand: candidate ? sizeOf(candidate) : 0,
      detail: `le natif ne produit pas — ${ref.raison || 'raison non déclarée'}`,
    };
  }

  const produitCand = !!candidate && sizeOf(candidate) > 0;
  if (!produitCand) {
    return {
      status: DIFF, modalite: ref.modalite, produit: false,
      n_ref: sizeOf(ref), n_cand: 0,
      detail: 'la voie candidate ne produit rien alors que la référence produit',
    };
  }

  if (ref.modalite === 'MIDI') {
    if (!Array.isArray(candidate.tokens)) {
      return { status: NON_MESURABLE, modalite: 'MIDI', produit: true, n_ref: (ref.tokens || []).length, n_cand: 0,
        detail: 'référence MIDI mais candidat sans jetons timés — modalités non comparables' };
    }
    const a = (ref.tokens || []).map(keyTok);
    const b = candidate.tokens.map(keyTok);
    if (a.length === b.length && a.every((x, i) => x === b[i])) {
      return { status: ISO, modalite: 'MIDI', produit: true, n_ref: a.length, n_cand: b.length, detail: null };
    }
    return {
      status: DIFF, modalite: 'MIDI', produit: true, n_ref: a.length, n_cand: b.length,
      detail: firstDiff(a, b),
    };
  }

  if (ref.modalite === 'TEXTE') {
    if (typeof candidate.text !== 'string') {
      return { status: NON_MESURABLE, modalite: 'TEXTE', produit: true, n_ref: normText(ref.text || '').split(' ').length, n_cand: 0,
        detail: 'référence TEXTE mais candidat sans texte — modalités non comparables' };
    }
    const a = normText(ref.text || '').split(' ');
    const b = normText(candidate.text).split(' ');
    if (a.length === b.length && a.every((x, i) => x === b[i])) {
      return { status: ISO, modalite: 'TEXTE', produit: true, n_ref: a.length, n_cand: b.length, detail: null };
    }
    return {
      status: DIFF, modalite: 'TEXTE', produit: true, n_ref: a.length, n_cand: b.length,
      detail: firstDiff(a, b),
    };
  }

  return { status: NON_MESURABLE, modalite: ref.modalite, produit: true, detail: `modalité inconnue : ${ref.modalite}` };
}

function sizeOf(x) {
  if (!x) return 0;
  if (Array.isArray(x.tokens)) return x.tokens.length;
  if (typeof x.text === 'string') return normText(x.text) ? normText(x.text).split(' ').length : 0;
  return 0;
}

function firstDiff(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return `1re divergence au rang ${i} : référence «${a[i] ?? '∅'}» vs candidat «${b[i] ?? '∅'}»`;
  }
  return `longueurs différentes : ${a.length} vs ${b.length}`;
}

module.exports = { compare, referenceFor, loadBaseline, ISO, DIFF, NON_MESURABLE, ABSENT };

// ── CLI de diagnostic ────────────────────────────────────────────────────────
if (require.main === module) {
  const arg = process.argv[2];
  const { byName, meta } = loadBaseline();
  if (!arg || arg === '--list') {
    console.log(`baseline ${meta.date} · ${meta.binaire} · seed ${meta.seed} · ${meta.n} grammaires`);
    const mods = {};
    for (const e of Object.values(byName)) {
      const k = e.produit ? e.modalite : 'ne produit pas';
      mods[k] = (mods[k] || 0) + 1;
    }
    for (const [k, n] of Object.entries(mods)) console.log(`  ${String(k).padEnd(16)} ${n}`);
  } else {
    const r = referenceFor(arg);
    if (!r) { console.error(`${arg} : absente de la baseline`); process.exit(1); }
    console.log(`${arg} · modalité ${r.modalite ?? '—'} · produit ${r.produit}`);
    if (!r.produit) console.log(`  raison : ${r.raison}`);
    else console.log(`  référence : ${r.tokens ? r.tokens.length + ' jetons timés' : (r.text ? normText(r.text).split(' ').length + ' mots' : 'capture absente')}`);
  }
}
