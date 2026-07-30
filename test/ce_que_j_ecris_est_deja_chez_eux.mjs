#!/usr/bin/env node
/**
 * GARDE — CE QUE J'ÉCRIS EST DÉJÀ CHEZ EUX.
 *
 * ⚠️ POURQUOI IL EXISTE, ET C'EST UNE RÈGLE QUE J'AI ÉCRITE PUIS RE-VIOLÉE DEUX FOIS EN DEUX JOURS.
 * Dans cet atelier les dépôts consomment la SOURCE les uns des autres — pas un paquet publié. Une
 * modification d'une surface partagée est donc EN PRODUCTION À LA SECONDE OÙ ELLE EST ÉCRITE ; le
 * push ne la rend qu'IRRÉVERSIBLE. J'ai fait inscrire cette règle le 2026-07-29 après avoir cassé
 * trois bancs chez Kairos, je l'ai citée à trois agents dans la semaine — et le 2026-07-30 j'ai
 * écrit une ancre de hauteur puis demandé à Kanopi si sa scène risquait de se mettre à sonner.
 * Elle SONNAIT DÉJÀ : leur dépendance est un lien vers mon arbre de travail, et leur portillon vert
 * de l'heure précédente avait tourné avec mon fichier non commité.
 *
 * CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS — je l'écris pour ne pas me raconter qu'il ferme le cas.
 *  · IL FAIT : mesurer QUI lit ce dépôt en direct, l'AFFICHER à chaque portillon, et ROUGIR si un
 *    consommateur apparaît ou disparaît. « Surface partagée » cesse d'être une abstraction : c'est
 *    une liste chiffrée qu'on relit à chaque passage.
 *  · IL NE FAIT PAS : agir au moment de l'écriture. Le portillon tourne au push, donc APRÈS. Ce
 *    garde réduit l'oubli, il ne le supprime pas — et prétendre l'inverse serait exactement la
 *    « clame » que Kairos a mesurée chez lui le même jour. Le mécanisme qui agirait au bon moment
 *    reste à trouver.
 */
import { readdirSync, existsSync, lstatSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const MOI = path.resolve(ICI, '..');
const ATELIER = path.resolve(MOI, '..');

/**
 * LES CONSOMMATEURS CONNUS, MESURÉS LE 2026-07-30. Le nombre de fichiers est un ORDRE DE GRANDEUR
 * qui bouge tous les jours : on garde l'EXISTENCE du lien, pas le compte exact — un garde qui
 * rougirait à chaque fichier ajouté chez un voisin serait débranché en une semaine.
 */
const CONSOMMATEURS = [
  { depot: 'kanopi', lienDirect: true, note: 'packages/ui/node_modules/bpscript est un LIEN vers mon arbre : il consomme mes fichiers NON COMMITÉS' },
  { depot: 'kairos', lienDirect: false, note: 'importe par chemin relatif — le plus gros lecteur' },
  { depot: 'BPx', lienDirect: false, note: 'importe par chemin relatif' },
  { depot: 'bp3-frontend', lienDirect: false, note: 'importe par chemin relatif' },
  { depot: 'runtime-MIDI', lienDirect: false, note: 'lit lib/ en direct via AUTORITE_LIB' },
  { depot: 'atlas', lienDirect: false, note: "l'oracle du langage et les outils de doc compilent avec MON compilateur — une forme que je refuse casse sa mesure" },
  { depot: 'runtime-audio', lienDirect: false, note: 'bancs de frontière et de voix' },
  { depot: 'runtime-ui', lienDirect: false, note: "vues de texte : lit l'arbre et ses annotations" },
];
// ⚠️ CES TROIS-LÀ ONT ÉTÉ TROUVÉS PAR CE GARDE À SON PREMIER PASSAGE, le 2026-07-30. Je croyais
// avoir CINQ consommateurs, il y en a HUIT — et l'un des trois est `atlas`, dont l'oracle du
// langage COMPILE avec mon compilateur : une forme que je refuse casse sa mesure, et c'est
// l'outil que tout l'écosystème interroge pour savoir ce qui est valide. Je ne l'aurais pas
// prévenu. C'est la meilleure preuve que la liste ne devait pas rester dans ma tête.

let passe = 0;
const echecs = [];
const ok = (c, q) => { if (c) passe++; else echecs.push(q); };

/** Fichiers d'un dépôt qui référencent ce dépôt-ci. */
function lecteurs(depot) {
  const racine = path.join(ATELIER, depot);
  if (!existsSync(racine)) return null;
  try {
    const trouves = execFileSync('bash', ['-c',
      `find ${JSON.stringify(racine)} \\( -name '*.ts' -o -name '*.js' -o -name '*.mjs' \\) `
      + "-not -path '*/node_modules/*' -not -path '*/.claude/worktrees/*' -not -path '*/dist/*' 2>/dev/null "
      + "| xargs grep -l \"BPscript/lib\\|BPscript/src\\|from 'bpscript\\|require('bpscript\" 2>/dev/null | wc -l",
    ], { encoding: 'utf-8' });
    return parseInt(trouves.trim(), 10) || 0;
  } catch { return 0; }
}

/** Le dépôt pointe-t-il vers mon arbre par un lien symbolique ? */
function lienVersMoi(depot) {
  const racine = path.join(ATELIER, depot);
  if (!existsSync(racine)) return false;
  try {
    const sortie = execFileSync('bash', ['-c',
      `find ${JSON.stringify(racine)} -maxdepth 8 -type l -not -path '*/.git/*' `
      + "-not -path '*/.claude/worktrees/*' 2>/dev/null | head -400",
    ], { encoding: 'utf-8' });
    for (const l of sortie.split('\n').filter(Boolean)) {
      try { if (realpathSync(l) === MOI) return true; } catch { /* lien mort */ }
    }
  } catch { /* rien */ }
  return false;
}

const presents = readdirSync(ATELIER, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(path.join(ATELIER, e.name, '.git')))
  .map((e) => e.name);

// ── SOCLE : un garde qui n'examine rien ne prouve rien ────────────────────────
ok(presents.length > 1, `SOCLE — l'atelier doit contenir plusieurs dépôts (vu : ${presents.length})`);
ok(existsSync(MOI), 'SOCLE — ce dépôt existe');

// ── CHAQUE CONSOMMATEUR DÉCLARÉ EN EST TOUJOURS UN ────────────────────────────
console.log('[surface partagée] ce que j\'écris part chez :');
for (const c of CONSOMMATEURS) {
  if (!presents.includes(c.depot)) {
    console.log(`   ${c.depot.padEnd(14)} ABSENT de cette machine — non mesurable ici`);
    continue;
  }
  const n = lecteurs(c.depot);
  const lien = lienVersMoi(c.depot);
  console.log(`   ${c.depot.padEnd(14)} ${String(n).padStart(3)} fichier(s)${lien ? '  + LIEN DIRECT vers mon arbre de travail' : ''}`);
  ok(n > 0 || lien,
    `${c.depot} est déclaré consommateur mais ne lit plus rien — si c'est vrai, le RETIRER de la liste `
    + '(une entrée sans réalité rend le garde décoratif)');
  if (c.lienDirect) {
    ok(lien,
      `${c.depot} portait un LIEN vers mon arbre et ne l'a plus — c'est un changement de la nature du `
      + 'risque, pas un détail : sans lien, mes fichiers non commités cessent d\'être chez lui');
  }
}

// ── L'AUTRE SENS : un consommateur NOUVEAU doit se déclarer ───────────────────
const declares = new Set(CONSOMMATEURS.map((c) => c.depot));
const nouveaux = presents
  .filter((d) => d !== path.basename(MOI) && !declares.has(d))
  .filter((d) => lecteurs(d) > 0 || lienVersMoi(d));
ok(nouveaux.length === 0,
  `DÉPÔT(S) qui lisent ce dépôt sans être déclarés ici : ${nouveaux.join(' ')} — les inscrire, `
  + 'sinon la prochaine surface partagée sera modifiée sans que personne sache qui elle atteint');

// ── TÉMOIN ANTI-RÉTRÉCISSEMENT ───────────────────────────────────────────────
ok(CONSOMMATEURS.length >= 8, 'TÉMOIN — la liste ne s\'est pas vidée');
ok(CONSOMMATEURS.some((c) => c.lienDirect),
  'TÉMOIN — au moins un consommateur par LIEN doit être suivi : c\'est le cas où écrire = publier');

if (echecs.length) {
  console.error(`[surface partagée] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log('[surface partagée] ⚠️ ce garde tourne au PUSH, donc APRÈS l\'écriture — il réduit l\'oubli, il ne le supprime pas.');
console.log(`[surface partagée] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
