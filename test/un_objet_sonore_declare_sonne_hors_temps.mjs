#!/usr/bin/env node
/**
 * GARDE — UN OBJET DÉCLARÉ PAR LE TYPE `sound` SONNE ; UNE VARIABLE RESTE UNE VARIABLE.
 *
 * Arbitrage de Romain, 2026-09-03 (point 4 des cinq arbitrages) : l'objet hors-temps SONNANT se
 * déclare par le type `sound` — `sound metro(vel:120)` puis `S -> !metro A`. Son nœud rend
 * `nature:'sounding'` et porte les membres de la déclaration dans `payload.params`. Un nom déclaré
 * par `def`, ou par un type dont la racine n'est pas `sound`, reste `nature:'var'` : c'est ce que
 * `def` dit depuis que les déclarations n'ont qu'un mot (3447e05), et ce garde le tient AUSSI —
 * sinon il suffirait de rendre tout sonnant pour le passer au vert.
 *
 * LA MATRICE — le type en tête × la forme dans le flux :
 *   `sound x(…)`            · `!x` seul  → sounding, params = membres
 *   `<dérivé de sound> x (…)` · `!x`       → sounding (la racine décide, pas le mot écrit)
 *   `def x(…)`              · `!x`       → var, sans params
 *   `flag x:1` / autre type  · `!x`       → var
 *   occurrence `!x(vel:90)`  → l'occurrence gagne sur le membre déclaré
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const TETE = 'core\nalphabet.simple\n';
const noeud = (src, nom) => {
  const r = compileToBPxAST(src, {});
  if (!r.ast) return { erreurs: (r.errors || []).map((e) => e.message) };
  let trouve = null;
  (function m(n) { if (!n || typeof n !== 'object' || trouve) return; if (Array.isArray(n)) { n.forEach(m); return; } if ((n.type === 'OutTimeObject' || n.type === 'Symbol') && n.name === nom) { trouve = n; return; } Object.values(n).forEach(m); })(r.ast.subgrammars);
  return { erreurs: (r.errors || []).map((e) => e.message), noeud: trouve };
};

// ── 1. `sound x` sonne, avec ses membres ───────────────────────────────────────────────────────
{
  const r = noeud(`${TETE}sound metro(vel:120)\n-----\nS -> !metro a\n`, 'metro');
  ok(r.erreurs.length === 0, `1. 'sound metro(vel:120)' + '!metro' compile — reçu ${JSON.stringify(r.erreurs)}`);
  ok(r.noeud && r.noeud.type === 'OutTimeObject' && r.noeud.payload && r.noeud.payload.nature === 'sounding',
     `1. '!metro' est un OutTimeObject SONNANT — reçu ${JSON.stringify(r.noeud)}`);
  ok(r.noeud && r.noeud.payload && r.noeud.payload.params && r.noeud.payload.params.vel === 120,
     `1. ses membres voyagent dans payload.params — reçu ${JSON.stringify(r.noeud && r.noeud.payload)}`);
  // ⚠️ Un son POSÉ DANS LE TEMPS (`S -> metro a`, sans `!`) n'est pas décidé : la forme arbitrée est
  // l'objet HORS-TEMPS, `!metro`. Le parseur lit aujourd'hui `metro` nu comme une variable de flux ;
  // ce garde ne le juge pas — il se fabriquera le jour où Romain dit ce qu'un son posé dans le temps
  // est.
}

// ── 2. la racine décide : un type dérivé de `sound` sonne ──────────────────────────────────────
{
  const r = noeud(`${TETE}sound click(vel:100)\nclick metro(vel:120)\n-----\nS -> !metro a\n`, 'metro');
  ok(r.erreurs.length === 0 && r.noeud && r.noeud.payload && r.noeud.payload.nature === 'sounding' && r.noeud.payload.params && r.noeud.payload.params.vel === 120,
     `2. 'click metro' (click dérive de sound) sonne avec SES membres — reçu ${JSON.stringify(r.noeud && r.noeud.payload)} ${JSON.stringify(r.erreurs)}`);
}

// ── 3. le complément : `def` et les autres types restent des variables ─────────────────────────
{
  const d = noeud(`${TETE}def metro(vel:120)\n-----\nS -> !metro a\n`, 'metro');
  ok(d.noeud && d.noeud.payload && d.noeud.payload.nature === 'var' && !('params' in d.noeud.payload),
     `3. 'def metro(vel:120)' + '!metro' reste une VARIABLE sans params — reçu ${JSON.stringify(d.noeud && d.noeud.payload)}`);
  const f = noeud(`${TETE}flag metro:1\n-----\nS -> !metro a\n`, 'metro');
  ok(f.noeud && f.noeud.payload && f.noeud.payload.nature === 'var', `3. un drapeau reste une variable — reçu ${JSON.stringify(f.noeud && f.noeud.payload)}`);
}

// ── 4. l'occurrence gagne sur le membre déclaré ────────────────────────────────────────────────
{
  const r = noeud(`${TETE}sound metro(vel:120, pan:64)\n-----\nS -> !metro(vel:90) a\n`, 'metro');
  ok(r.noeud && r.noeud.payload && r.noeud.payload.params && r.noeud.payload.params.vel === 90 && r.noeud.payload.params.pan === 64,
     `4. '!metro(vel:90)' : vel 90 (occurrence), pan 64 (déclaration) — reçu ${JSON.stringify(r.noeud && r.noeud.payload)} ${JSON.stringify(r.erreurs)}`);
}

ok(passe >= 7, `SOCLE : ${passe} vérifications — la matrice s'est vidée`);
if (echecs.length) {
  console.error(`[objet sonore hors-temps] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[objet sonore hors-temps] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
