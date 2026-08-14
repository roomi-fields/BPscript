#!/usr/bin/env node
/**
 * GARDE — une PROCÉDURE DE NIVEAU RÈGLE doit atteindre la métadonnée de sa règle.
 *
 * CE QU'ELLE PROTÈGE, et pourquoi elle compte des JETONS plutôt que de lire un arbre.
 * `goto`, `failed`, `repeat`, `stop` ne s'appliquent pas à une POSITION : elles valent pour la
 * règle entière, et le moteur les extrait en métadonnée. Écrites dans le flux (`![repeat:3]`),
 * elles restent dans la séquence : la règle ne les reçoit jamais, et un **jeton de contrôle
 * inerte** apparaît dans la production. L'effet est AUDIBLE, pas théorique — un `repeat` qui
 * n'a pas lieu, ce sont des notes en moins.
 *
 * C'est né d'une erreur à moi : le 2026-07-26 j'ai migré toute forme d'appel autonome vers `!`,
 * la position, sans distinguer les procédures qui n'en ont pas. Une garde qui aurait lu la
 * forme de l'arbre n'aurait rien vu — l'arbre était bien formé. Seul l'effet le disait. D'où
 * cette garde : elle **dérive** et compte ce qui sort.
 *
 * LA FAMILLE VIENT DE LA DONNÉE (`scope:"rule"` dans `lib/controls.json`), jamais d'une liste
 * écrite ici : une procédure ajoutée demain est gardée sans qu'on touche ce fichier.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { universeRuleScopeControls } from '../src/transpiler/libs.js';
import { importerBPx } from './bpx_dist.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const FAMILLE = [...universeRuleScopeControls()].sort();

// TÉMOIN ANTI-RÉTRÉCISSEMENT. La famille vient de la donnée — c'est voulu — mais une garde qui
// n'itère QUE la donnée disparaît avec elle : retirer `scope:"rule"` d'un contrôle retirait
// silencieusement ses vérifications, et le vert restait. Vérifié : en supprimant le marqueur de
// `repeat`, la garde passait de 23 à 18 vérifications SANS ROUGIR. On ancre donc le socle connu.
// Ce n'est pas une classification en dur : c'est la liste que l'AUTORITÉ MOTEUR énumère
// (BP3 `Encode.c:367`, portée BPx `loadGrammar.ts:1210` : _goto / _failed / _repeat / _stop /
// _print* / _step* / _trace*), restreinte à ce que notre registre déclare aujourd'hui.
for (const attendu of ['goto', 'failed', 'repeat', 'stop']) {
  ok(FAMILLE.includes(attendu),
     `SOCLE : '${attendu}' doit porter scope:"rule" dans lib/controls.json — c'est une procédure de `
     + `niveau règle pour le moteur (Encode.c:367). Sans le marqueur, elle n'est plus gardée du tout`);
}

const compile = (regles) => {
  try {
    return compileToBPxAST(`@core\n@alphabet.western:midi\n@mode:ord\n${regles}\n`);
  } catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};

// ─── 1. Écrite dans le FLUX : REFUSÉE, et le message donne la réécriture ─────────────────────
for (const nom of FAMILLE) {
  const r = compile(`S -> C4 ![${nom}:1] D4`);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok(r.errors && r.errors.length > 0, `1. '![${nom}:…]' dans le flux doit être refusé — une procédure de règle n'a pas de position`);
  ok(/niveau RÈGLE/.test(msg) && msg.includes(`[${nom}:`),
     `1. le refus de '![${nom}: …]' doit NOMMER la cause et donner la réécriture '[${nom}:…]' — reçu : ${msg}`);
}

// ─── 2. Écrite en SUFFIXE : elle ATTEINT la métadonnée de la règle ───────────────────────────
for (const [nom, valeur] of [['repeat', '3'], ['goto', '2 1'], ['failed', '2 1'], ['stop', '1']]) {
  if (!FAMILLE.includes(nom)) continue;
  const r = compile(`S -> C4 D4 [${nom}:${valeur}]`);
  ok((r.errors || []).length === 0, `2. '[${nom}:${valeur}]' en suffixe doit compiler — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
  const regle = r.ast?.subgrammars?.[0]?.rules?.[0];
  const auNiveauRegle = (regle?.qualifiers || []).some((q) => (q.pairs || []).some((p) => p.key === nom));
  ok(auNiveauRegle, `2. '[${nom}:${valeur}]' doit atteindre rule.qualifiers — c'est là que le moteur la lit (BPx mergeQualifierProcedures)`);
  const dansLeFlux = JSON.stringify(regle?.rhs || []).includes(`"${nom}"`);
  ok(!dansLeFlux, `2. '[${nom}:${valeur}]' ne doit PAS rester dans la RHS — un jeton de contrôle inerte y sortirait dans la production`);
}

// ─── 3. LE TÉMOIN PAR L'EFFET — on dérive et on compte ce qui SORT ───────────────────────────
// Une garde qui lit l'arbre voit une forme bien construite ; seule la production dit si la
// procédure a eu lieu. On charge BPx s'il est là ; sinon on le DIT, on ne fait pas semblant.
{
  const grammaire = 'S -> X\nX -> a X [repeat:3]\nX -> b\na -> C4\nb -> D4';
  const r = compile(grammaire);
  ok((r.errors || []).length === 0, `3. le témoin doit compiler — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
  let session = null;
  try {
    ({ createSession: session } = await importerBPx());
  } catch { /* BPx absent de ce poste */ }
  if (!session || !r.ast) {
    console.log('   ⓘ BPx introuvable — le témoin par l\'effet n\'a pas tourné (les points 1 et 2 restent vérifiés).');
  } else {
    const jetons = [];
    const parcours = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(parcours); return; }
      if (typeof n.token === 'string') jetons.push(n.token);
      for (const k in n) if (k !== 'parent') parcours(n[k]);
    };
    parcours(session(r.ast, { seed: 42 }).derive());
    ok(!jetons.some((t) => /ctrl/i.test(t)),
       `3. aucun JETON DE CONTRÔLE INERTE ne doit sortir dans la production — obtenu : ${jetons.join(' ')}`);
  }
}

if (echecs.length) {
  console.error(`❌ procédures de niveau règle : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ procédures de niveau règle — ${passe} vérification(s) passée(s) sur la famille [${FAMILLE.join(', ')}]`);
}
