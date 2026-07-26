#!/usr/bin/env node
/**
 * GARDE DU VOCABULAIRE DES APPELS `nom(…)` — et acte de décès de `script(…)`.
 *
 * POURQUOI CE GARDE EXISTE. `script(…)` était une FONCTION GÉNÉRIQUE : un seul mot qui portait
 * n'importe quelle intention (changer d'instrument, envoyer un CC, attendre une note, faire un
 * bip). Romain, 2026-07-26 : « en BPScript on n'est pas censés avoir de _script qui est une
 * fonction générique. On a remplacé par crochets == instruction moteur et parenthèses ==
 * instruction runtime » — « ce sont des erreurs GRAVES ». Une fonction générique dans un langage,
 * c'est une décision non prise qu'on repousse sur l'utilisateur.
 *
 * CE QUE LE GARDE PROTÈGE, et pas seulement pour `script`. Le retrait de `runtime.midi.script` de
 * `lib/controls.json` ne suffisait PAS : mesuré le 2026-07-26, un nom absent de tout vocabulaire
 * mais suivi d'une parenthèse était accepté comme TERMINAL SONNANT (`payload.nature:'sounding'`)
 * et traversait la chaîne en silence — 3 des 5 scènes concernées compilaient toujours sans un mot.
 * Le vrai fail-loud est donc la GARDE DE VOCABULAIRE (`validateCallVocabulary`, bpxAst.js), pas
 * une ligne retirée d'un JSON.
 *
 * PAS DE LISTE EN DUR : `script` tombe parce qu'il n'est plus DANS LA DONNÉE. Le garde vérifie
 * l'absence dans l'autorité (§1), le refus à la compilation (§2), l'absence de faux positif (§3),
 * et qu'AUCUN APPELANT VIVANT ne subsiste dans le corpus (§4) — « vivant » = qui passe encore.
 * Les 4 familles sans nom (Beep, Tick cycle, MIDI send Continue, wait for) restent écrites dans
 * les scènes et DOIVENT échouer : c'est l'intention, en attendant l'arbitrage de nommage.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { universeControlNames } from '../src/transpiler/libs.js';
import { DIR_BPS } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const scene = (regles) => `@core\n@controls\n@alphabet.western:midi\n@mode:ord\n${regles}\n`;
const erreursDe = (src) => {
  try { return (compileToBPxAST(src).errors || []).map((e) => (typeof e === 'string' ? e : e.message || '')); }
  catch (e) { return ['THROW ' + e.message]; }
};

// ─── §1. L'autorité ne déclare plus `script` ────────────────────────────────────────────────
ok(!universeControlNames().has('script'),
   "§1 'script' est encore déclaré dans l'univers des contrôles (lib/controls.json + bundle)");
ok(universeControlNames().has('ins') && universeControlNames().has('cc') && universeControlNames().has('chan'),
   '§1 les contrôles nommés qui remplacent script (ins, cc, chan) doivent exister');

// ─── §2. Un appel hors vocabulaire est REFUSÉ, et le message CITE le texte écrit ─────────────
for (const [appel, ce_que_c_est] of [
  ['script(MIDI program 5)', 'la forme historique la plus fréquente'],
  ['script(Beep)', 'un script sans argument numérique'],
  ['foobar(3)', "un nom quelconque : la règle vaut pour tout le vocabulaire, pas pour 'script' seul"],
]) {
  const errs = erreursDe(scene(`S -> ${appel} C4`));
  ok(errs.length > 0, `§2 '${appel}' (${ce_que_c_est}) doit être refusé — il est passé en silence`);
  ok(errs.some((m) => m.includes(appel)),
     `§2 le message d'erreur doit CITER l'appel tel qu'écrit '${appel}' — reçu : ${errs.join(' | ') || '(aucune erreur)'}`);
}

// Niché dans un groupe : un appel ne se cache pas derrière des accolades.
ok(erreursDe(scene('S -> {C4 script(Beep)} D4')).some((m) => m.includes('script(Beep)')),
   '§2 un appel hors vocabulaire NICHÉ dans un groupe doit être refusé lui aussi');

// Sans alphabet de notes en portée (scène à gates), le vocabulaire des appels reste vérifié.
ok(erreursDe('@core\n@controls\n@gate a:midi\n@mode:ord\nS -> a script(Beep) a\n').some((m) => m.includes('script(Beep)')),
   "§2 un appel hors vocabulaire doit être refusé même SANS alphabet de notes (scène à gates)");

// ─── §2bis. LE TÉMOIN DE BPx — un contrôle non importé ne doit pas SONNER ────────────────────
// Constat `hub/constats/2026-07-26-controle-non-declare-degenere-en-note.md` (bpx [790]) : même
// source, seule l'en-tête change. Sans la déclaration d'import, `ins(12)` n'était pas refusé —
// il était reclassé en appel de symbole SONNANT, donc en note, et le moteur le dérivait
// fidèlement : cinq feuilles sonnantes au lieu de deux, sans un mot. C'est le mode d'échec le
// plus coûteux d'un chantier de nommage : le nom tout neuf se met à sonner.
// Le message doit NOMMER LA CAUSE (import manquant), pas prétendre que le nom n'existe pas.
{
  const REGLES = 'S -> ins(12) chan(3) vel(80) cc(7,100) C4 D4';
  const sans = erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${REGLES}\n`);
  for (const appel of ['ins(12)', 'chan(3)', 'vel(80)']) {
    const m = sans.find((x) => x.includes(appel));
    ok(m !== undefined, `§2bis témoin bpx : '${appel}' sans import doit être refusé, jamais dégénérer en note`);
    ok(m !== undefined && /pas importé/.test(m) && !/n'existe pas/.test(m),
       `§2bis le message pour '${appel}' doit nommer la CAUSE (import manquant) — il existe bel et bien au registre`);
  }
  ok(erreursDe(`@core\n@controls\n@alphabet.western:midi\n@mode:ord\n${REGLES}\n`).length === 0,
     '§2bis le même témoin AVEC import doit rester accepté (aucun faux positif)');
}

// ─── §3. Aucun faux positif : ce qui est légitime passe toujours ─────────────────────────────
for (const [appel, pourquoi] of [
  ['ins(5)', 'contrôle nommé déclaré — la traduction de script(MIDI program 5)'],
  ['cc(98,0)', 'contrôle nommé déclaré — la traduction du controller'],
  ['chan(1)', 'contrôle nommé déclaré'],
  ['C4(vel:80)', 'terminal d\'alphabet porteur d\'un qualificatif de runtime'],
]) {
  const errs = erreursDe(scene(`S -> ${appel} C4`));
  ok(errs.length === 0, `§3 '${appel}' (${pourquoi}) doit rester accepté — reçu : ${errs.join(' | ')}`);
}
// Un non-terminal déclaré, appelé avec des arguments, reste valide.
ok(erreursDe(scene('S -> A(vel:80)\nA -> C4 D4')).length === 0,
   '§3 un non-terminal DÉCLARÉ appelé avec arguments doit rester accepté');

// ─── §4. Aucun appelant VIVANT dans le corpus ────────────────────────────────────────────────
// « Vivant » = qui compile encore. Les scènes qui portent une famille sans nom gardent leur
// `script(…)` écrit — et doivent échouer. Ce test mord si l'une d'elles redevient verte.
const RE_APPEL_SCRIPT = /(^|[^\w.])script\s*\(/;
const porteuses = readdirSync(DIR_BPS).filter((f) => f.endsWith('.bps')).filter((f) => {
  const lignes = readFileSync(path.join(DIR_BPS, f), 'utf8').split('\n')
    .filter((l) => !l.trimStart().startsWith('//'));   // le code seul : les notes de conversion en parlent
  return lignes.some((l) => RE_APPEL_SCRIPT.test(l));
});
for (const f of porteuses) {
  const errs = erreursDe(readFileSync(path.join(DIR_BPS, f), 'utf8'));
  ok(errs.length > 0, `§4 ${f} porte encore un appel script(…) ET COMPILE — appelant vivant, interdit`);
}
// Le corpus ne doit plus porter AUCUNE des deux familles traduisibles : elles ont un nom.
const TRADUISIBLES = /script\s*\(\s*MIDI\s+(program|controller)/i;
for (const f of readdirSync(DIR_BPS).filter((x) => x.endsWith('.bps'))) {
  const code = readFileSync(path.join(DIR_BPS, f), 'utf8').split('\n')
    .filter((l) => !l.trimStart().startsWith('//')).join('\n');
  ok(!TRADUISIBLES.test(code),
     `§4 ${f} porte encore une famille TRADUISIBLE (MIDI program → ins(N), MIDI controller → chan(N) cc(C,V))`);
}

// ─── Verdict ─────────────────────────────────────────────────────────────────────────────────
if (echecs.length) {
  console.error(`❌ vocabulaire des appels : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error('   -', e);
  process.exitCode = 1;
} else {
  console.log(`✅ vocabulaire des appels — ${passe} vérification(s) passée(s) ; ${porteuses.length} scène(s) portant script(…) refusée(s) comme prévu`);
}
