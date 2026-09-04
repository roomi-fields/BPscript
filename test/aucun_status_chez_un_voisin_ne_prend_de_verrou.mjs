#!/usr/bin/env node
// @isole — il ECRIT sur le disque : dans un processus partage il contaminerait ses voisins.
/**
 * GARDE — aucun `git status` que MON PORTILLON lance chez un VOISIN ne peut prendre son verrou.
 *
 * ⛔ CE QU'IL FERME : UNE PROTECTION QUE JE NE CONTRÔLE PAS. Mesuré le 2026-08-30 — mon portillon
 * lance 30 `git -C /home/romi/dev/bp/hub/tools status --porcelain`, par `garde:documentaires`, qui
 * délègue aux outils du hub. Ils ne prennent aucun verrou parce que ces outils portent
 * `--no-optional-locks` — et **ce drapeau n'est écrit nulle part chez moi** :
 *
 *     scripts/garde-documentaires.sh        occurrences  0
 *     hub/tools/garde-copies.py                          2
 *     hub/tools/garde-navigation.py                      2
 *
 * ⇒ Si son propriétaire le retire, mon portillon verrouille le hub à chaque poussée **et rien chez
 * moi ne rougit**. Ma délégation est saine — « un appel, jamais une copie » — ma DÉPENDANCE était
 * muette. Ce garde la rend bruyante.
 *
 * ⛔ IL EXERCE, IL NE COMPTE PAS. Compter les occurrences du drapeau dans le code d'un autre serait
 * un garde sur une graphie que je ne possède pas, et qui verdirait sur un appel jamais lancé. Ici on
 * FABRIQUE un dépôt jetable et on regarde ce qui s'ouvre.
 *
 * ⚠️ ET SON TÉMOIN EST NON NUL PAR CONSTRUCTION : la même épreuve SANS le drapeau doit prendre le
 * verrou. Sans ce volet, un zéro dirait « rien ne verrouille » aussi bien qu'« aucune commande n'a
 * tourné », et un index déjà frais rendrait zéro des deux côtés — la cécité que l'architecte a
 * nommée le 2026-08-30 : « un appel présent est une preuve ; un verrou absent n'en est pas une. »
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.error(`FAIL — ${quoi}`); } };

// ── LE DÉPÔT JETABLE, HORS DE TOUTE RACINE DE LA TOUR ─────────────────────────────────────────
// ⛔ Il ne vit ni chez moi ni chez un voisin : fabriquer le cas ne doit basculer aucun fichier que
// quelqu'un mesure. C'est la leçon de la nuit — une épreuve est une écriture qui dure.
const fabriquerDepotAIndexPerime = () => {
  const d = mkdtempSync(join(tmpdir(), 'verrou-'));
  const git = (...a) => execFileSync('git', ['-C', d, ...a], { stdio: 'pipe' });
  git('init', '-q', '.');
  writeFileSync(join(d, 'f.txt'), 'a\n');
  git('add', 'f.txt');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'i');
  // ⚠️ CE DÉPÔT NE PÉRIME PAS SON INDEX, ET C'EST UNE MESURE QUI L'A DÉCIDÉ. Ma première rédaction
  // vieillissait le fichier pour forcer un rafraîchissement — par prudence, pas sur une mesure. Puis
  // l'injection qui la neutralisait N'A PAS MORDU : le garde restait vert sans elle.
  // ⇒ Mesuré alors des deux façons, deux passes : sur un dépôt NEUF comme sur un dépôt à index
  // vieilli, `git status` prend le verrou (1) et `--no-optional-locks` ne le prend pas (0). La
  // périmation ne changeait rien — c'était du code mort qui se lisait comme une précaution.
  // ⇒ Ce que ce garde ne suppose donc PAS, c'est que le dépôt neuf verrouille toujours : le volet 1
  // le VÉRIFIE à chaque passage, et échoue le jour où ce ne serait plus vrai.
  return d;
};

// Combien d'ouvertures de `index.lock` une forme donnée provoque-t-elle ?
const verrousPris = (args, depot) => {
  const trace = join(tmpdir(), `tr-${process.pid}-${args.length}-${Math.floor(process.hrtime()[1] / 1e3)}`);
  try {
    execFileSync('strace', ['-f', '-e', 'trace=openat', '-o', trace, 'git', ...args, '-C', depot,
      'status', '--porcelain'], { stdio: 'pipe' });
  } catch { /* le code de sortie de git ne nous intéresse pas, la trace si */ }
  let n = 0;
  try { n = readFileSync(trace, 'utf-8').split('\n').filter((l) => l.includes('index.lock')).length; }
  finally { try { rmSync(trace); } catch { /* rien */ } }
  return n;
};

// ── 1. LE TÉMOIN NON NUL — sans le drapeau, le verrou se prend ─────────────────────────────────
// ⛔ CE VOLET EST CE QUI DONNE SA VALEUR AU SUIVANT. S'il rend zéro, l'épreuve ne discrimine pas
// (index déjà frais, `strace` absent, git qui a changé) et le garde doit ÉCHOUER, pas se taire.
{
  const d = fabriquerDepotAIndexPerime();
  try {
    const sans = verrousPris([], d);
    verifier(sans > 0,
      `1. TÉMOIN NON NUL — sans '--no-optional-locks', un 'git status' doit `
      + `prendre le verrou. Reçu ${sans}. Si c'est zéro, ce garde ne mesure RIEN et son volet 2 `
      + `serait vert sans rien prouver.`);
  } finally { rmSync(d, { recursive: true, force: true }); }
}

// ── 2. LE DRAPEAU EST LE REMÈDE, sur la MÊME condition ────────────────────────────────────────
{
  const d = fabriquerDepotAIndexPerime();
  try {
    const avec = verrousPris(['--no-optional-locks'], d);
    verifier(avec === 0,
      `2. avec '--no-optional-locks', le même 'git status' ne prend AUCUN verrou. Reçu ${avec}.`);
  } finally { rmSync(d, { recursive: true, force: true }); }
}

// ── 3. ET CE QUE MON PORTILLON LANCE VRAIMENT LE PORTE ────────────────────────────────────────
// ⛔ Les deux volets précédents prouvent une PROPRIÉTÉ DE GIT ; celui-ci prouve que MON portillon
// en bénéficie. Sans lui, le garde resterait vert le jour où le drapeau disparaît de l'outil appelé.
// ⚠️ On lit le code de l'outil DU HUB, pas le mien : c'est une dépendance, et c'est exactement ce
// que ce garde existe pour rendre visible. S'il devient introuvable, on ÉCHOUE — on ne saute pas.
{
  const OUTILS = ['garde-copies.py', 'garde-navigation.py'];
  let examines = 0;
  for (const outil of OUTILS) {
    const chemin = join(process.env.HOME, 'dev/bp/hub/tools', outil);
    let source = null;
    try { source = readFileSync(chemin, 'utf-8'); } catch { /* absent */ }
    verifier(source !== null,
      `3. l'outil délégué '${outil}' doit être lisible — mon portillon l'appelle`);
    if (source === null) continue;
    examines += 1;
    const lanceUnStatus = /['"]status['"]/.test(source);
    if (!lanceUnStatus) continue;   // cet outil ne lance plus de status : rien à protéger
    verifier(/--no-optional-locks/.test(source),
      `3. ⛔ '${outil}' lance un 'git status' et NE porte PLUS '--no-optional-locks' — mon portillon `
      + `verrouillerait le dépôt qu'il interroge à chaque poussée. Le drapeau vit chez le hub, pas `
      + `chez moi : c'est la dépendance que ce garde rend bruyante.`);
  }
  verifier(examines === OUTILS.length,
    `3. les ${OUTILS.length} outils délégués ont été examinés (${examines})`);
}

console.log(`Résultat aucun_status_chez_un_voisin_ne_prend_de_verrou : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
