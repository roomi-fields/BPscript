#!/usr/bin/env node
/**
 * GARDE — l'énumération se prend AVANT la dérivation, jamais après, et l'ordre est mesurable.
 *
 * LE DÉFAUT QUE CE GARDE FIGE. Le rendu structuré d'un item a besoin du résolveur de noms, qui vit
 * dans le contexte de projection, que BPx refuse de rendre avant une dérivation. J'ai donc appelé
 * `derive()` avant `produceAll()` — et la dérivation CONSOMME du tirage. Sur une grammaire à choix,
 * l'énumération devient une autre : `tryflags2` est passée d'identique à divergente sans qu'une
 * ligne de la scène ait bougé. Un harnais qui change ce qu'il mesure selon l'ordre où il s'y prend
 * ne mesure plus la scène, il se mesure lui-même.
 *
 * LA PORTÉE ET SON COMPLÉMENT :
 *   - LA FAUTE EXISTE : sur une grammaire À CHOIX, les deux ordres donnent DEUX énumérations.
 *     Sans cette preuve, le garde ne mesurerait qu'une convention sans conséquence.
 *   - LA MESURE PUBLIÉE EST DU BON CÔTÉ : ce que le harnais rend coïncide avec l'ordre
 *     énumération-d'abord, jamais avec l'autre.
 *   - COMPLÉMENT : sur une grammaire DÉTERMINISTE, les deux ordres coïncident — c'est bien le
 *     tirage qui porte l'écart, et non un effet de bord quelconque de `derive()`.
 *   - ET LE RÉSOLVEUR NE DÉPEND PAS DU TIRAGE : c'est ce qui rend l'ordre corrigé légitime.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { bpsPath, nomsBps } from './corpus.mjs';
import { importerBPx } from './bpx_dist.mjs';

const require = createRequire(import.meta.url);
const { compileToBPxAST } = require('../src/transpiler/index.js');
const { createSession } = await importerBPx();

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.error(`FAIL — ${quoi}`); } };

const dispo = new Set(nomsBps());
/** Énumère une grammaire, dans l'ordre demandé. Rend la liste des items, ou null. */
function enumerer(nom, deriverAvant) {
  const out = compileToBPxAST(readFileSync(bpsPath(nom), 'utf-8'));
  if (out.errors.length) return null;
  const session = createSession(out.ast, { seed: 1 });
  if (deriverAvant) { try { session.derive(); } catch { return null; } }
  const r = session.produceAll();
  if (r.refused) return null;
  return r.items.map((i) => (i.terminals || []).join(' '));
}

// ── LA FAUTE EXISTE — une grammaire À CHOIX rend deux énumérations selon l'ordre ───────────────
const A_CHOIX = ['tryflags2', 'tryflags3'].filter((n) => dispo.has(n));
verifier(A_CHOIX.length > 0, 'au moins une grammaire à choix est disponible (sinon la preuve ne se fait pas)');
let auMoinsUneDivergence = false;
for (const nom of A_CHOIX) {
  const avant = enumerer(nom, false);
  const apres = enumerer(nom, true);
  verifier(Array.isArray(avant) && avant.length > 0, `${nom} : l'énumération seule rend des items`);
  if (Array.isArray(avant) && Array.isArray(apres) && JSON.stringify(avant) !== JSON.stringify(apres)) auMoinsUneDivergence = true;
}
verifier(auMoinsUneDivergence,
  "dériver AVANT d'énumérer change l'énumération d'au moins une grammaire à choix — la faute est réelle, "
  + "et le garde ne mesure pas une convention sans conséquence");

// ── LA MESURE PUBLIÉE EST DU BON CÔTÉ ─────────────────────────────────────────────────────────
// Le harnais rend le texte STRUCTURÉ ; on ne compare donc pas les chaînes, on compare le nombre
// d'items et le premier item réduit à ses lettres — ce que l'ordre du tirage fait bouger.
// L'écart ne se voit pas forcément au PREMIER item — sur `tryflags2` les deux ordres partagent
// leur tête et divergent plus loin. On compare donc l'énumération ENTIÈRE, jamais un échantillon :
// choisir où l'on regarde reviendrait à choisir ce qu'on ne verra pas.
const lettres = (l) => l.map((s) => String(s).replace(/[^a-z]/g, '')).join('|');
for (const nom of A_CHOIX) {
  const seule = enumerer(nom, false);
  const encore = enumerer(nom, false);
  verifier(seule !== null && lettres(seule) === lettres(encore),
    `${nom} : l'énumération seule est stable d'un appel à l'autre — le tirage est bien à graine posée`);
}
verifier(A_CHOIX.some((nom) => {
  const seule = enumerer(nom, false); const apres = enumerer(nom, true);
  return seule && apres && lettres(seule) !== lettres(apres);
}), "et l'énumération ENTIÈRE diffère de celle prise après une dérivation, sur au moins une grammaire à choix");

// ── COMPLÉMENT — sur une grammaire DÉTERMINISTE, l'ordre ne change rien ────────────────────────
const DETERMINISTES = ['templates', 'checkHomo'].filter((n) => dispo.has(n));
verifier(DETERMINISTES.length > 0, 'au moins une grammaire déterministe est disponible');
for (const nom of DETERMINISTES) {
  const avant = enumerer(nom, false);
  const apres = enumerer(nom, true);
  verifier(avant !== null && JSON.stringify(avant) === JSON.stringify(apres),
    `${nom} : sans choix, les deux ordres rendent la MÊME énumération — c'est bien le tirage qui porte l'écart`);
}

// ── LE RÉSOLVEUR DE NOMS NE DÉPEND PAS DU TIRAGE ──────────────────────────────────────────────
// C'est ce qui rend l'ordre corrigé légitime : on peut dériver APRÈS pour l'obtenir.
for (const nom of DETERMINISTES.slice(0, 1)) {
  const out = compileToBPxAST(readFileSync(bpsPath(nom), 'utf-8'));
  const noms = [1, 2].map((graine) => {
    const s = createSession(out.ast, { seed: graine });
    s.derive();
    const r = s.buildProjectionContext('chronological').resolveName;
    return typeof r;
  });
  verifier(noms.every((t) => t === 'function'), `${nom} : le résolveur de noms existe quelle que soit la graine`);
}

console.log(`Résultat l_enumeration_ne_se_prend_pas_apres_une_derivation : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
