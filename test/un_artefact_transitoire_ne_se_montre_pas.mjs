#!/usr/bin/env node
/**
 * GARDE — TOUT FICHIER TEMPORAIRE QU'UN GENERATEUR ECRIT EST IGNORE PAR GIT.
 *
 * ⛔ D'OU IL VIENT, ET C'EST UN VOISIN QUI L'A PAYE. Mes generateurs ecrivent dans un `.tmp` puis
 * font un `mv` — le fichier vit une fraction de seconde. DEUX DES TROIS NAISSENT DANS
 * `src/transpiler/`, une racine que kanopi, kairos et bp3-frontend lisent EN DIRECT par lien
 * symbolique. Le 2026-08-21, la fenetre de mesure de kanopi s'est bloquee sur
 * `baseline-status.json.tmp`, apparu pile pendant son tir : la tour refuse d'ouvrir une fenetre
 * quand un depot porte un etat non publie, et elle raisonne par DEPOT quand lui lit par RACINE.
 *
 * ⚠️ ET LE DEFAUT EST DE CEUX QU'ON NE REPRODUIT PAS. Il ne se declenche que si le voisin mesure
 * pendant les quelques millisecondes ou le fichier existe. Kanopi a refuse de forcer et a rendu la
 * mesure ; sans ça, personne n'aurait su pourquoi une fenetre se bloquait de temps en temps.
 *
 * ⛔ ET IL FERME L'ESPACE, PAS LE POINT. Ignorer les trois noms d'aujourd'hui laisserait le
 * quatrieme generateur rouvrir le trou en silence. Ce garde LIT `package.json`, extrait TOUTE cible
 * `.tmp` que ses scripts ecrivent, et exige que git l'ignore. Un script ajoute demain est couvert
 * sans que personne y pense.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const RACINE = new URL('..', import.meta.url).pathname;
const paquet = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const scripts = paquet.scripts || {};
ok(Object.keys(scripts).length >= 5, `SOCLE : le paquet doit porter des scripts — ${Object.keys(scripts).length}`);

/** Toute cible `.tmp` qu'une ligne de script ecrit — redirection `> x.tmp` ou `mv x.tmp y`. */
const cibles = new Set();
for (const ligne of Object.values(scripts)) {
  for (const m of String(ligne).matchAll(/(?:>\s*|mv\s+)([^\s|&;]+\.tmp)\b/g)) cibles.add(m[1]);
}
ok(cibles.size >= 3,
  `SOCLE : le garde doit avoir trouve des cibles temporaires dans package.json — ${cibles.size} vue(s). `
  + `Zero voudrait dire que le motif ne lit plus les scripts, pas que le depot est propre.`);

/** git ignore-t-il ce chemin ? `check-ignore` sort 0 quand oui, 1 quand non. */
const estIgnore = (chemin) => {
  try { execFileSync('git', ['check-ignore', '-q', chemin], { cwd: RACINE }); return true; }
  catch { return false; }
};

const nus = [...cibles].filter((c) => !estIgnore(c));
ok(nus.length === 0,
  `⛔ ${nus.length} artefact(s) transitoire(s) ne sont pas ignore(s) : ${nus.join(', ')}\n     `
  + `Ils apparaissent dans l'arbre de travail le temps d'un \`mv\`, et un voisin qui mesure mon etat `
  + `a cet instant se bloque sur un fichier qui n'existe deja plus. Ajouter le chemin a .gitignore.`);

// ── ⛔ LE TEMOIN — le detecteur voit-il un artefact NU quand il y en a un ? ───────────────────
// Sans lui, un `check-ignore` qui repondrait toujours « oui » rendrait zero faute exactement comme
// un depot propre. On interroge un chemin `.tmp` qu'aucune regle ne couvre.
{
  ok(!estIgnore('zzz-temoin-du-garde.tmp'),
    'TEMOIN — un `.tmp` que rien ne declare NE DOIT PAS etre vu comme ignore ; si ce volet echoue, '
    + 'une regle trop large (`*.tmp`) masque tout et le volet principal ne mesure plus rien');
  // Et son complement : un chemin que .gitignore couvre VRAIMENT doit sortir ignore.
  ok(estIgnore('baseline-status.json.tmp'),
    'TEMOIN — et le detecteur doit reconnaitre un chemin reellement ignore, sinon il rend faux des '
    + 'deux cotes');
}

// ── ET LE MOTIF LIT BIEN LES SCRIPTS, pas une liste que j'aurais recopiee ────────────────────
{
  const attendus = ['baseline-status.json.tmp', 'src/transpiler/libs-data.js.tmp'];
  const manques = attendus.filter((a) => !cibles.has(a));
  ok(manques.length === 0,
    `le motif doit retrouver les cibles connues dans package.json — manque(nt) : ${manques.join(', ')}. `
    + `Si un script a change de forme, c'est le MOTIF qu'il faut relire, pas cette liste qu'il faut `
    + `allonger : une liste recopiee cesse de mesurer ce que le paquet fait.`);
}

const ATTENDU = 6;
ok(p + e.length === ATTENDU, `le garde doit eprouver ${ATTENDU} cas — ${p + e.length} seulement`);

if (e.length) { console.error(`[transitoire] ${e.length} ECHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[transitoire] ${p} PASS / 0 FAIL — ${p} assertion(s), ${cibles.size} artefact(s) lu(s) dans package.json`);
