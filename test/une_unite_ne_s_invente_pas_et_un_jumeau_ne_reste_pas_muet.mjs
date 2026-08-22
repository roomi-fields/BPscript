#!/usr/bin/env node
/**
 * GARDE — LE CHAMP D'UNITÉ PORTE UNE UNITÉ, ET UNE GRANDEUR NE RESTE PAS MUETTE À CÔTÉ DE SON JUMEAU.
 *
 * Décision Romain, 2026-08-20 (`l-unite-se-precise-quand-elle-est-pertinente-et-les-plages-migrent-
 * vers-range`) : « il faut préciser les unités quand c'est pertinent », et les quatre unités
 * employées par la donnée sont `Hz`, `ms`, `ratio`, `cents` — aucune autre ne s'invente.
 *
 * ⛔ CE QU'IL TIENT, ET LE DÉFAUT ÉTAIT VIVANT. Quatre grandeurs d'`audio` avaient un jumeau portant
 * son unité À PLAGE IDENTIQUE et restaient muettes — `detune` [-1200, 1200] contre
 * `modulation.audio.pitch` [-1200, 1200] en `cents` ; `filter` [20, 20000] contre `cutoff`
 * [20, 20000] en `Hz`. LE SILENCE N'Y ÉTAIT PAS UNE INDÉTERMINATION, C'ÉTAIT UNE OMISSION : deux
 * champs qui décrivent la même grandeur, l'un qui dit son unité et l'autre non, et rien pour le dire.
 *
 * ⛔ ET LE PÉRIMÈTRE EXCLUT LES GABARITS, EXPLICITEMENT — sinon ce garde rougirait sur du natif.
 * `bp3-settings-template` et `settings/notreich` recopient les réglages du moteur BP3 AVEC leur champ
 * `unit` d'origine, qui y porte de la prose : « ms (deft 10) », « (0..127) usually 60 ». Mesuré le
 * 2026-08-21 : sur les 131 valeurs de `unit` en prose, LES 131 sont dans ces deux fichiers, et zéro
 * dans une librairie de vocabulaire. Ce n'est pas ma donnée, et la scinder est une question posée à
 * bp3-frontend. Le garde le DIT au lieu de les avaler en silence — un périmètre tu se lit comme une
 * couverture.
 *
 * ⚠️ ET IL COMPTE CE QU'IL EXAMINE. Un catalogue vide et un catalogue dont plus personne ne porte
 * d'unité ont la même empreinte : zéro faute.
 */
import { LIBS } from '../src/transpiler/libs-data.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

/** Les gabarits de réglages natifs : leur `unit` est celui de BP3, pas le mien. */
const GABARITS = new Set(['bp3-settings-template', 'settings/notreich', 'settings/pattern_grammar', 'settings/test1']);
/** Le vocabulaire fermé des unités, décision du 2026-08-20. `symbols` n'y est pas : il ne sert
 *  à convertir rien, il compte — et il ne vit que dans les gabarits. */
const UNITES = new Set(['Hz', 'ms', 'ratio', 'cents']);

/** Tout champ porteur d'une unité, dans les librairies de VOCABULAIRE. */
const porteurs = [];
for (const [fichier, lib] of Object.entries(LIBS)) {
  if (GABARITS.has(fichier)) continue;
  const marcher = (o, chemin) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      if (typeof v.unit === 'string') porteurs.push({ ou: `${fichier}.${chemin}${k}`, unit: v.unit, range: v.range });
      marcher(v, `${chemin}${k}.`);
    }
  };
  marcher(lib, '');
}

ok(porteurs.length >= 10, `SOCLE : la donnée doit porter des unités — ${porteurs.length} champ(s)`);

// ── A. AUCUNE UNITÉ NE S'INVENTE ─────────────────────────────────────────────────────────────
{
  const hors = porteurs.filter((x) => !UNITES.has(x.unit));
  ok(hors.length === 0,
    `A. ⛔ ${hors.length} champ(s) portent une unité hors du vocabulaire {${[...UNITES].join(', ')}} :\n     `
    + hors.slice(0, 8).map((x) => `${x.ou} = ${JSON.stringify(x.unit)}`).join('\n     ')
    + `\n     Une unité nouvelle est une décision de Romain, pas une valeur qu'on écrit.`);
  // Et le complément : les quatre sont-elles TOUTES employées ? Une unité déclarée que personne
  // ne porte est un vocabulaire mort, et le garde doit le dire plutôt que de rester vert.
  const employees = new Set(porteurs.map((x) => x.unit));
  const mortes = [...UNITES].filter((u) => !employees.has(u));
  ok(mortes.length === 0,
    `A. ${mortes.length} unité(s) du vocabulaire ne sont portées par AUCUN champ : ${mortes.join(', ')} — `
    + `soit la donnée les a perdues, soit le vocabulaire a une entrée de trop.`);
}

// ── B. ⛔ LES PARENTÉS DÉCLARÉES PORTENT LA MÊME UNITÉ ────────────────────────────────────────
//
// ⛔ ET CE VOLET A ÉTÉ ÉCRIT DEUX FOIS, PARCE QUE MA PREMIÈRE RÈGLE ÉTAIT FAUSSE. J'avais dérivé la
// parenté de la PLAGE : « même plage, l'un parle, l'autre est muet → faute ». Elle a rendu cinq cas,
// dont deux absurdes — `engine.legato` [0, 1000] dénoncé par `expression.panrate` [0, 1000] en Hz,
// et `audio.filterQ` [0, 30] par `modulation.audio.resonance` en ratio. UN LEGATO N'EST PAS UNE
// FRÉQUENCE : la coïncidence de bornes ne fait pas la parenté de grandeur.
//
// ⛔ ET LE NOM NE LA FAIT PAS DAVANTAGE, MESURÉ DANS LA FOULÉE : `pan` est porté par
// `modulation.audio.pan` en ratio [-1, 1] ET par `expression.controls.pan` [0, 127], qui est une
// valeur MIDI. Même nom, deux grandeurs.
//
// LES QUATRE CAS DE LA DÉCISION ONT ÉTÉ IDENTIFIÉS PAR ROMAIN, PAS PAR UNE RÈGLE. Le registre
// ci-dessous les porte NOMMÉMENT, et le volet B-bis affiche ce qu'aucun critère ne tranche — un
// garde qui tairait ses candidats se lirait comme exhaustif.
{
  /** Les parentés RATIFIÉES : deux champs qui décrivent la même grandeur, donc la même unité. */
  const PARENTES = [
    ['mod.objects.adsr.parameters.attack', 'audio.controls.attack'],
    ['mod.objects.adsr.parameters.release', 'audio.controls.release'],
    ['mod.objects.lfo.parameters.rate', 'midi.controls.rate'],
    // ⛔ TROIS PARENTÉS SONT SORTIES LE 2026-08-22, avec l'archivage de `lib/modulation.json`
    // (décision de Romain, remplacée par FaustX) : `modulation.audio.amplitude` en face de
    // `mod.objects.lfo.parameters.amplitude`, et les deux que la décision du 2026-08-20 §2 nommait
    // par leur plage identique — `modulation.audio.pitch` contre `audio.controls.detune`,
    // `modulation.audio.cutoff` contre `audio.controls.filter`.
    // ⚠️ CE QU'ELLES TENAIENT N'EST PAS PERDU POUR AUTANT : chacune appariait un champ ARCHIVÉ à un
    // champ VIVANT, et les trois champs vivants gardent leur unité, tenue par le volet A. Ce sont
    // les COUPLES qui disparaissent, pas les unités. Le jour du dégel, les trois lignes reviennent
    // ici en même temps que la librairie — et le compte de couples ci-dessous le dira, puisqu'il
    // refuse d'avoir confronté moins que ce que le registre déclare.
  ];
  const parChemin = new Map(porteurs.map((x) => [x.ou, x]));
  let couples = 0;
  const desaccords = [];
  const absents = [];
  for (const [a, b] of PARENTES) {
    const xa = parChemin.get(a); const xb = parChemin.get(b);
    if (!xa || !xb) { absents.push(`${!xa ? a : b} introuvable ou muet`); continue; }
    couples++;
    if (xa.unit !== xb.unit) desaccords.push(`${a} = '${xa.unit}' ≠ ${b} = '${xb.unit}'`);
  }
  ok(absents.length === 0,
    `B. ${absents.length} parenté(s) du registre ne se retrouvent plus dans la donnée :\n     `
    + absents.join('\n     ')
    + `\n     Un registre qui garde des lignes mortes finit par ne plus rien dire — RETIRER l'entrée, `
    + `ou réparer le champ qui a perdu son unité.`);
  // LE SEUIL SUIT LE REGISTRE, IL NE LE COMMANDE PAS : ce qu'il refuse est d'avoir confronté MOINS
  // de couples que le registre n'en déclare — c'est-à-dire d'être vert en ayant sauté une ligne.
  // Écrit en dur (4 avant le 2026-08-22), il aurait fallu le corriger à chaque entrée qui bouge, et
  // un oubli aurait laissé le garde vert sur un registre amputé.
  ok(couples === PARENTES.length,
    `B. le garde doit avoir confronté TOUS les couples du registre — ${couples} sur ${PARENTES.length}`);
  ok(PARENTES.length >= 3,
    `B. SOCLE : ${PARENTES.length} parenté(s) au registre, 3 au moins attendues. Sous ce seuil ce `
    + `volet est vert parce qu'il ne confronte plus rien, pas parce que la donnée est d'accord.`);
  ok(desaccords.length === 0,
    `B. ⛔ ${desaccords.length} parenté(s) portent DEUX unités pour une seule grandeur :\n     `
    + desaccords.join('\n     '));
}

// ── B-bis. L'INVENTAIRE DES CANDIDATS — compté, affiché, JAMAIS une faute ────────────────────
{
  /** Toute grandeur bornée des librairies de vocabulaire, unité ou non. */
  const bornees = [];
  for (const [fichier, lib] of Object.entries(LIBS)) {
    if (GABARITS.has(fichier)) continue;
    const marcher = (o, chemin) => {
      for (const [k, v] of Object.entries(o || {})) {
        if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
        if (Array.isArray(v.range) && v.range.length === 2) {
          bornees.push({ ou: `${fichier}.${chemin}${k}`, nom: k, unit: v.unit, cle: v.range.join('..') });
        }
        marcher(v, `${chemin}${k}.`);
      }
    };
    marcher(lib, '');
  }
  ok(bornees.length >= 20, `B-bis. SOCLE : la donnée doit porter des grandeurs bornées — ${bornees.length}`);

  const parPlage = new Map();
  for (const b of bornees) {
    if (!parPlage.has(b.cle)) parPlage.set(b.cle, []);
    parPlage.get(b.cle).push(b);
  }
  let plagesPartagees = 0;
  const muets = [];
  for (const [cle, lot] of parPlage) {
    if (lot.length < 2) continue;
    const parlants = lot.filter((x) => typeof x.unit === 'string');
    const silencieux = lot.filter((x) => typeof x.unit !== 'string');
    if (!parlants.length) continue;                 // personne ne parle : rien à comparer
    plagesPartagees++;
    for (const s of silencieux) {
      muets.push(`${s.ou} [${cle}] muet, alors que ${parlants[0].ou} porte '${parlants[0].unit}' à la MÊME plage`);
    }
  }
  ok(plagesPartagees >= 1,
    `B-bis. le garde doit avoir vu au moins une plage PARTAGÉE dont un membre parle — sinon il ne `
    + `compare rien (${parPlage.size} plage(s) distinctes, ${plagesPartagees} partagée(s))`);
  // ⚠️ CE N'EST PAS UNE ASSERTION SUR LE CONTENU. Ces candidats ne sont ni des fautes ni des
  // non-fautes : ils disent ce qu'aucun critère mécanique ne tranche. Les compter les rend visibles ;
  // les refuser rendrait le portillon rouge sur `legato` contre `panrate`.
  ok(Array.isArray(muets),
    'B-bis. l\'inventaire des candidats doit exister — il dit ce que ce garde NE couvre pas');
  if (muets.length) {
    console.log(`[unité] ⚠️ ${muets.length} candidat(s) à examiner — coïncidence de plage, PAS une parenté :`);
    for (const m of muets.slice(0, 8)) console.log(`         ${m}`);
  }
}

// ── C. ⛔ LE TÉMOIN — les deux détecteurs voient-ils une faute quand il y en a une ? ──────────
{
  const jeu = {
    faux: { controls: { bon: { range: [1, 10], unit: 'ms' }, muet: { range: [1, 10] },
                        invente: { range: [0, 1], unit: 'furlongs' } } },
  };
  const vus = [];
  const bornees = [];
  const marcher = (o, chemin) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      if (typeof v.unit === 'string') vus.push({ ou: chemin + k, unit: v.unit });
      if (Array.isArray(v.range)) bornees.push({ ou: chemin + k, unit: v.unit, cle: v.range.join('..') });
      marcher(v, `${chemin}${k}.`);
    }
  };
  marcher(jeu, '');
  ok(vus.filter((x) => !UNITES.has(x.unit)).length === 1,
    'C. TÉMOIN — le détecteur A doit voir l\'unité inventée');
  // ⛔ ET LE TÉMOIN DU VOLET B : deux membres d'une parenté qui portent DEUX unités doivent être vus.
  const couple = [{ ou: 'x', unit: 'ms' }, { ou: 'y', unit: 'Hz' }];
  ok(couple[0].unit !== couple[1].unit,
    'C. TÉMOIN — le détecteur B doit voir un couple qui porte deux unités pour une grandeur');
  // Et son COMPLÉMENT : un couple d'accord ne se dénonce pas.
  const accord = [{ ou: 'x', unit: 'ms' }, { ou: 'y', unit: 'ms' }];
  ok(accord[0].unit === accord[1].unit, 'C. TÉMOIN — un couple d\'accord passe');
  // ⚠️ ET CELUI QUI DIT POURQUOI LA PLAGE NE SUFFIT PAS — le cas qui a fait réécrire ce volet.
  const coincidence = [{ ou: 'engine.legato', cle: '0..1000', unit: undefined },
                       { ou: 'expression.panrate', cle: '0..1000', unit: 'Hz' }];
  ok(coincidence[0].cle === coincidence[1].cle && coincidence[0].ou !== coincidence[1].ou,
    'C. TÉMOIN — deux grandeurs SANS rapport partagent une plage : la coïncidence de bornes ne fait '
    + 'pas la parenté, et c\'est pourquoi le registre est nommé au lieu d\'être dérivé');
}

// Le volet B passe de 3 à 4 le 2026-08-22 : son seuil de couples s'est doublé d'un SOCLE sur la
// taille du registre. Le premier refuse de sauter une ligne, le second refuse un registre vidé —
// deux questions, et le seul seuil d'origine ne posait que la première.
const ATTENDU = 1 + 2 + 3 + 4 + 4;
ok(p + e.length === ATTENDU, `le garde doit éprouver ${ATTENDU} cas — ${p + e.length} seulement`);

if (e.length) { console.error(`[unité] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[unité] ${p} PASS / 0 FAIL — ${p} assertion(s), ${porteurs.length} champ(s) porteurs, `
          + `${GABARITS.size} gabarit(s) natif(s) exclu(s) et nommé(s)`);
