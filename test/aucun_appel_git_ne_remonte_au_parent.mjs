#!/usr/bin/env node
/**
 * GARDE — AUCUN APPEL À `git` NE LAISSE LE DÉPÔT SE DEVINER.
 *
 * `git` REMONTE : lancé depuis un dossier sans dépôt, il cherche le premier dépôt AU-DESSUS et
 * répond sur celui-là. **Il ne se plaint pas, il répond** — et sa réponse est plausible.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE, ET C'EST CHEZ UN VOISIN. BPx a payé cette remontée DEUX FOIS EN DIX
 * MINUTES le 2026-08-24 : une mesure d'état sur un dossier sans dépôt lui a rendu **« 28 fichiers
 * sales »** qui étaient ceux d'un dossier parent. ⇒ *« Une sonde qui RÉSOUT rend un résultat
 * plausible sur une question qu'on n'a pas posée. »*
 *
 * ⚠️ ET CHEZ MOI LE PIÈGE ÉTAIT LATENT, PAS ACTIF : mes deux appels sans ancre étaient lancés depuis
 * la racine par `npm`, donc justes — **par la position de l'appelant, jamais par leur écriture**. Un
 * banc déplacé dans un sous-dossier, un script appelé depuis un dossier temporaire, et ils
 * mesuraient un autre dépôt sans qu'une seule ligne change.
 *
 * ⇒ **On répare l'ESPACE où le défaut peut vivre** : tout appel porte son ancre, `-C <racine>`, ou
 * son `cwd`. Les deux formes sont acceptées — elles disent la même chose — et l'absence des deux est
 * refusée.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const RACINE = new URL('..', import.meta.url).pathname;
const suivis = execFileSync('git', ['-C', RACINE, 'ls-files'], { encoding: 'utf8' })
  .split('\n').filter((f) => /^(src|scripts|test|editor|public)\/.*\.(m?js|cjs)$/.test(f));

// La graphie que mon code écrit : `execFileSync('git', [...], {...})`, `execSync('git …')`,
// `spawnSync('git', [...], {...})`. On prend l'appel ENTIER, arguments et options compris.
const APPEL = /(?:execFileSync|spawnSync|execSync)\(\s*['"`]git['"`][\s\S]{0,400}?\)\s*[;,.\n]/g;

let balayes = 0;
let appels = 0;
const nus = [];
for (const f of suivis) {
  const texte = readFileSync(RACINE + f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  balayes++;
  for (const m of texte.match(APPEL) || []) {
    appels++;
    // ANCRÉ = `-C <quelque chose>` dans les arguments, OU `cwd:` dans les options.
    if (/['"`]-C['"`]/.test(m) || /\bcwd\s*:/.test(m)) continue;
    nus.push(`${f} — ${m.replace(/\s+/g, ' ').slice(0, 80)}`);
  }
}

ok(balayes > 50,
  `SOCLE : le balayage doit voir un dépôt, pas un dossier — ${balayes} fichier(s). Une recherche qui `
  + `rend zéro se mesure elle-même avant de conclure qu'il n'y a rien.`);
ok(appels >= 5,
  `SOCLE : au moins cinq appels à git attendus — ${appels}. À zéro, ce garde serait vert sans avoir `
  + `rien examiné, et il le resterait le jour où le premier appel nu s'écrit.`);
ok(nus.length === 0,
  `⛔ ${nus.length} appel(s) à git SANS ANCRE : ${nus.slice(0, 4).join(' · ')}. git remonte jusqu'au `
  + `premier dépôt trouvé au-dessus et répond sur celui-là — sans se plaindre, et de façon plausible.`);

// ⛔ INJECTION DANS LE JUGE — sur la graphie exacte, pas sur une idée de la graphie.
//
// ⚠️ ET LES CAS SE FABRIQUENT PAR MORCEAUX, jamais écrits en toutes lettres. Ma première écriture les
// posait littéralement : **ce garde s'est accusé lui-même** à sa première passe au portillon, en
// lisant ses propres injections comme deux vrais appels nus. Un garde qui balaie du texte trouve ce
// qu'il documente — même patron que `le_schema_de_syntaxe_n_est_pas_une_librairie`, qui retire ses
// commentaires pour la même raison.
//
// ⚠️ ET IL ÉTAIT VERT AVANT D'ÊTRE COMMITÉ, POUR UNE RAISON FAUSSE : son périmètre est `git ls-files`,
// donc il ne se voyait pas tant qu'il n'était pas suivi. **Un garde neuf ne s'examine lui-même qu'une
// fois enregistré**, et c'est le portillon de poussée qui l'a montré.
{
  const G = String.fromCharCode(103, 105, 116);          // le nom de la commande, jamais en clair
  const appel = (fn, args, opts) => `${fn}('${G}', [${args}], ${opts});`;
  const juger = (src) => (src.match(APPEL) || [])
    .filter((m) => !/['"`]-C['"`]/.test(m) && !/\bcwd\s*:/.test(m)).length;
  ok(juger(appel('execFileSync', "'status'", "{ encoding: 'utf8' }")) === 1,
    '(mord) un appel sans ancre ni cwd doit être vu');
  ok(juger(appel('execFileSync', "'-C', RACINE, 'status'", "{ encoding: 'utf8' }")) === 0,
    "(se tait) l'ancre `-C` suffit");
  ok(juger(appel('execFileSync', "'status'", '{ cwd: RACINE }')) === 0,
    '(se tait) le `cwd` suffit');
  ok(juger(appel('spawnSync', "'log'", '{}')) === 1, '(mord) sur `spawnSync` aussi');
}

console.log(`[git ancré] ${balayes} fichier(s) balayés · ${appels} appel(s) à git · ${nus.length} sans ancre`);
if (e.length) {
  console.error(`[git ancré] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[git ancré] ${p} PASS / 0 FAIL`);
