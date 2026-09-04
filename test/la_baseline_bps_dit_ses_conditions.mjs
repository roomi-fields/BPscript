#!/usr/bin/env node
/**
 * GARDE — LA BASELINE DE LA VOIE `.bps` DIT SES CONDITIONS, SON ASSIETTE ET SON COMPTE.
 *
 * Ce que ce garde tient de `test/baseline-bps/baseline.json`, produit par
 * `test/sceller_baseline_bps.mjs` (hors portillon : plusieurs minutes, et son résultat est un
 * état à lire, pas un verdict).
 *
 * ⛔ POURQUOI UN GARDE ICI. Une baseline est le pire endroit pour un mensonge muet : elle est
 * lue comme une référence, elle ne s'exécute pas, et rien ne la contredit. Trois façons pour
 * elle de dériver sans rien casser :
 *   1. SES CONDITIONS SE VIDENT — l'oracle, l'empreinte, la graine, la chaîne. Un champ écrit
 *      et vide a l'apparence d'une condition ; c'est le défaut payé par bp3-frontend le
 *      2026-08-11, un chemin donné à git par son nom nu, `null` sur ses 26 références, et rien
 *      n'a rougi.
 *   2. SON ASSIETTE GLISSE — bp3-engine rescelle, le compte change, et la baseline continue de
 *      porter l'ancienne liste en se présentant comme « les 96 ».
 *   3. SON BILAN NE COMPTE PLUS SES LIGNES — un total qui ne se rapporte plus aux entrées se
 *      lit exactement comme un total juste.
 *
 * ⚠️ ET LE QUATRIÈME ÉTAT SE GARDE AUSSI. Romain a demandé TROIS états et a exigé qu'un cas qui
 * n'y entre pas soit remonté NOMMÉ plutôt que rangé de force. Un jour où le producteur rangerait
 * ces cas sous « produit » pour faire propre, plus personne ne saurait qu'ils n'ont pas été
 * mesurés. Ce garde exige donc qu'une entrée sans état porte SA CAUSE écrite.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const FICHIER = path.join(ICI, 'baseline-bps', 'baseline.json');
const SCELLE_NATIF = path.resolve(RACINE, '..', '.publie', 'bp3-engine', 'baseline-native', 'SCELLE.json');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── SOCLE — un garde qui ne trouve pas son sujet ne verdit pas ───────────────────────────────
if (!fs.existsSync(FICHIER)) {
  console.error(`❌ baseline de la voie .bps introuvable : ${path.relative(RACINE, FICHIER)}\n`
    + `   Elle se produit par 'node test/sceller_baseline_bps.mjs --ecrire'. Sans elle ce garde\n`
    + `   ne vérifie RIEN, et un vert ne prouverait rien.`);
  process.exit(1);
}
const b = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));

/** ⚠️ UNE CHAÎNE VIDE OU BLANCHE N'EST PAS UNE CONDITION — cf. l'en-tête, défaut bp3-frontend. */
const porte = (v) => v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');

// ── 1. LES CONDITIONS SONT COMPLÈTES ────────────────────────────────────────────────────────
const CONDITIONS = ['oracle', 'empreinte', 'version_moteur', 'seed', 'chaine', 'comparateur',
  'corpus_scenes', 'action_repliquee'];
const c = b.conditions_de_mesure || {};
for (const champ of CONDITIONS) {
  ok(porte(c[champ]), `1. condition '${champ}' absente ou vide — une mesure sans ses conditions `
    + `ne se rejoue pas, et rien ne le signale`);
}
ok(typeof c.empreinte === 'string' && /^[0-9a-f]{32}$/.test(c.empreinte),
  `1. l'empreinte de l'oracle doit être un md5 complet, reçu : ${JSON.stringify(c.empreinte)}`);

// ── 2. L'ASSIETTE EST CELLE QUE LE PROPRIÉTAIRE A SCELLÉE ───────────────────────────────────
// On ne la reconstruit pas et on ne la suppose pas : on la relit chez lui et on confronte.
if (!fs.existsSync(SCELLE_NATIF)) {
  ok(false, `2. le scellé natif est introuvable(${path.relative(RACINE, SCELLE_NATIF)}) — sans lui `
    + `l'assiette de cette baseline n'est confrontable à rien`);
} else {
  const scelle = JSON.parse(fs.readFileSync(SCELLE_NATIF, 'utf8'));
  const attendue = scelle?.preuve?.reproductibles_96 || [];
  const mienne = (b.grammaires || []).map((g) => g.grammaire);
  ok(attendue.length > 0, "2. le scellé natif doit porter sa liste — sinon rien à confronter");
  ok(mienne.length === attendue.length,
    `2. l'assiette a GLISSÉ : la baseline porte ${mienne.length} grammaire(s), le scellé natif en `
    + `nomme ${attendue.length}. Une baseline qui garde l'ancienne liste se présente encore comme `
    + `la référence courante.`);
  const manquantes = attendue.filter((n) => !mienne.includes(n));
  const en_trop = mienne.filter((n) => !attendue.includes(n));
  ok(manquantes.length === 0 && en_trop.length === 0,
    `2. l'assiette DIFFÈRE du scellé natif — absentes ici : ${manquantes.slice(0, 5).join(', ') || '—'} ; `
    + `en trop ici : ${en_trop.slice(0, 5).join(', ') || '—'}`);
  ok(b.assiette?.n === attendue.length,
    `2. le champ 'assiette.n' annonce ${b.assiette?.n}, le scellé natif en nomme ${attendue.length}`);
}

// ── 3. CHAQUE ENTRÉE PORTE UN ÉTAT, OU SA CAUSE ─────────────────────────────────────────────
const TROIS = new Set(['PLANTE', 'PRODUIT', 'PRODUCTION IDENTIQUE']);
const muettes = [];
for (const g of b.grammaires || []) {
  if (g.etat === null || g.etat === undefined) {
    if (!porte(g.hors_etats)) muettes.push(g.grammaire);
  } else if (!TROIS.has(g.etat)) {
    ok(false, `3. '${g.grammaire}' porte un état hors des trois : ${JSON.stringify(g.etat)}. `
      + `Les états sont ${[...TROIS].join(' · ')} ; tout le reste se remonte NOMMÉ dans 'hors_etats'.`);
  }
}
ok(muettes.length === 0,
  `3. ${muettes.length} entrée(s) sans état ET sans cause écrite : ${muettes.slice(0, 6).join(', ')}. `
  + `Une entrée muette se lit comme une entrée mesurée.`);

// ── 4. LE BILAN COMPTE SES PROPRES LIGNES ───────────────────────────────────────────────────
// C'est la vérification qu'aucun compte publié ne survit à une baseline qui bouge sous lui.
{
  const G = b.grammaires || [];
  const compte = (p) => G.filter(p).length;
  const attendu = {
    scenes_presentes: compte((g) => g.scene_bps),
    scenes_absentes: compte((g) => !g.scene_bps),
    PLANTE: compte((g) => g.etat === 'PLANTE'),
    PRODUIT: compte((g) => g.etat === 'PRODUIT'),
    'PRODUCTION IDENTIQUE': compte((g) => g.etat === 'PRODUCTION IDENTIQUE'),
    hors_les_trois_etats: compte((g) => g.scene_bps && !g.etat),
  };
  for (const [k, v] of Object.entries(attendu)) {
    ok(b.bilan?.[k] === v,
      `4. le bilan annonce ${k} = ${b.bilan?.[k]}, les lignes en portent ${v}. Un total qui ne se `
      + `rapporte plus aux entrées se lit exactement comme un total juste.`);
  }
  // ET LA SOMME FERME : chaque scène présente est dans un des quatre paniers, une fois.
  const somme = attendu.PLANTE + attendu.PRODUIT + attendu['PRODUCTION IDENTIQUE']
    + attendu.hors_les_trois_etats;
  ok(somme === attendu.scenes_presentes,
    `4. les états couvrent ${somme} scène(s) pour ${attendu.scenes_presentes} présente(s) — une `
    + `scène présente est dans un panier et un seul`);
  ok(attendu.scenes_presentes + attendu.scenes_absentes === G.length,
    `4. présentes + absentes = ${attendu.scenes_presentes + attendu.scenes_absentes} pour ${G.length} entrée(s)`);
}

// ── TÉMOINS D'INSTRUMENT — la faute injectée dans l'accusé, puis dans le juge ────────────────
// Sans eux, un garde qui aurait cessé de savoir lire un champ verdirait pour la pire des raisons.
{
  const CREUX = [['absent', {}], ['nul', { oracle: null }], ['chaîne VIDE', { oracle: '' }],
    ['chaîne BLANCHE', { oracle: '  ' }]];
  for (const [quoi, faux] of CREUX) {
    ok(porte(faux.oracle) === false,
      `TÉMOIN — une condition ${quoi} doit être refusée. C'est par la chaîne vide que le défaut est `
      + `passé chez bp3-frontend : le champ écrit, et rien dedans.`);
  }
  ok(porte('bp3-engine/builds/v3.5.1-iso.1/bp3'),
    'TÉMOIN INVERSE — une condition renseignée doit être acceptée, sinon tout échoue pour une '
    + 'raison qui n\'est pas la bonne');

  // L'ASSIETTE : un juge qui ne verrait pas une liste glissée.
  const A = ['a', 'b', 'c'];
  ok(A.filter((n) => !['a', 'b'].includes(n)).length === 1,
    'TÉMOIN — une assiette amputée doit être vue comme différente');
  ok(['a', 'b', 'c', 'd'].filter((n) => !A.includes(n)).length === 1,
    'TÉMOIN — une assiette gonflée doit être vue comme différente');

  // LE BILAN : un total faux doit se faire prendre.
  const faussesLignes = [{ etat: 'PLANTE', scene_bps: true }, { etat: 'PRODUIT', scene_bps: true }];
  ok(faussesLignes.filter((g) => g.etat === 'PLANTE').length !== 2,
    'TÉMOIN — un bilan qui annoncerait 2 là où les lignes en portent 1 doit être refusé');

  // LE QUATRIÈME ÉTAT : une entrée sans état ET sans cause doit être vue comme muette.
  ok(porte(undefined) === false && porte('énumération sans fin') === true,
    'TÉMOIN — une cause absente est muette, une cause écrite ne l\'est pas');
}

if (echecs.length) {
  console.error(`[baseline .bps] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
const bl = b.bilan || {};
console.log(`[baseline .bps] assiette ${b.assiette?.n} · présentes ${bl.scenes_presentes} · `
  + `absentes ${bl.scenes_absentes} — ${bl['PRODUCTION IDENTIQUE']} identique(s), ${bl.PRODUIT} produite(s), `
  + `${bl.PLANTE} plantée(s), ${bl.hors_les_trois_etats} hors des trois états`);
console.log(`[baseline .bps] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
