#!/usr/bin/env node
/**
 * GARDE — une invocation de librairie ÉCRITE dans une scène doit ressortir ÉMISE.
 *
 * IDÉE DE KAIROS, le 2026-07-27, et elle est juste : « une déclaration de scène qui disparaît sans
 * erreur, c'est une source examinée dont le résultat s'évapore ; un garde qui compte les références
 * ÉMISES contre les références ÉCRITES l'aurait vu tout de suite ». Il proposait ça en pensant à une
 * régression qui n'en était pas une — mais le garde, lui, manquait vraiment, et il a trouvé un cas.
 *
 * CE QUI LE REND NON TAUTOLOGIQUE, et c'est tout son intérêt : le côté ÉCRIT se lit dans le TEXTE
 * SOURCE, le côté ÉMIS dans l'arbre. Deux chemins indépendants. Un garde qui recompterait les
 * invocations depuis l'arbre des deux côtés ne pourrait jamais voir une perte — il compterait deux
 * fois le même résultat.
 *
 * LES AXES DE HAUTEUR sont exclus du décompte des adresses parce qu'ils voyagent par un AUTRE
 * PORTEUR (le bloc hauteur), pas parce qu'on les tolère absents : les compter ici les ferait
 * paraître perdus alors qu'ils arrivent ailleurs. C'est exactement le piège dans lequel une mesure
 * par préfixe est tombée le même jour — deux porteurs lus comme un filtre.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { nomsBps, lireBps, exigerCorpus } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** Axes portés par le bloc hauteur, hors du canal neutre des adresses. */
const AXES_HAUTEUR = new Set(['alphabet', 'tuning', 'octaves', 'scale']);

/**
 * PERTES CONNUES, datées et motivées — pas un tapis sous lequel glisser les suivantes.
 * Y ajouter une ligne vaut « j'ai mesuré la cause et je l'assume en attendant l'arbitrage ».
 */
const PERTES_CONNUES = [
  // VIDE — et c'est le témoin §3 qui l'a exigé, pas moi. La seule perte inscrite (`dhin1` invoquait
  // `transcription.dhinOO`, une entrée qui n'existait pas) a été corrigée par Kanopi le 2026-07-27
  // (`5dd7798`) ; l'adresse résout désormais, vérifié. Le registre a donc rougi POUR SIGNALER QU'IL
  // ÉTAIT PÉRIMÉ — c'est exactement ce qu'on lui demandait, et c'est ce qui empêche un registre de
  // survivre à ce qu'il enregistrait.
];

// ─── 1. SOCLE — refuser de conclure sur du vide ──────────────────────────────────────────────
const { bps: nbCorpus } = exigerCorpus();
ok(nbCorpus > 40, `1. le corpus doit fournir de quoi mesurer — ${nbCorpus} scène(s)`);

// ─── 2. Écrites contre émises, scène par scène ───────────────────────────────────────────────
const RE_INVOCATION = /^@([a-z_][a-z0-9_]*)\.([A-Za-z0-9_.-]+)/gm;
const cle = (p) => `${p.scene}::${p.adresse}`;
const connues = new Set(PERTES_CONNUES.map(cle));

let ecrites = 0;
let emises = 0;
let scenes = 0;
const vues = new Set();
for (const nom of nomsBps()) {
  const src = lireBps(nom);
  let o;
  try { o = compileToBPxAST(src); } catch { continue; }
  if ((o.errors || []).length > 0) continue;
  scenes++;
  const code = src.split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
  for (const m of code.matchAll(RE_INVOCATION)) {
    const axe = m[1];
    ecrites++;
    if (AXES_HAUTEUR.has(axe)) continue;             // autre porteur, cf. l'en-tête
    const adresse = `${axe}.${m[2].replace(/:.*$/, '')}`;
    if ((o.ast?.libRefs || []).includes(adresse)) { emises++; continue; }
    const p = { scene: nom, adresse };
    vues.add(cle(p));
    ok(connues.has(cle(p)),
       `2. '${nom}' ÉCRIT l'invocation '${adresse}' et rien ne SORT — la déclaration disparaît sans `
       + `erreur. Une invocation acceptée qui n'émet rien est indistinguable, côté consommateur, `
       + `d'une scène qui n'a rien déclaré. Mesurer la cause, puis corriger — ou l'inscrire dans `
       + `PERTES_CONNUES avec sa date et sa raison.`);
  }
}

ok(ecrites > 40, `2. le corpus doit ÉCRIRE des invocations — ${ecrites} trouvée(s), garde creux sinon`);
ok(emises > 15, `2. et il doit en ÉMETTRE — ${emises} adresse(s) sortie(s)`);

// ─── 3. Le registre ne rancit pas ────────────────────────────────────────────────────────────
for (const p of PERTES_CONNUES) {
  ok(vues.has(cle(p)),
     `3. '${p.adresse}' est inscrite comme perdue dans '${p.scene}' (${p.date}) mais ne l'est plus — `
     + `RETIRER l'entrée, sinon le registre finit par ne plus rien dire`);
  ok(typeof p.pourquoi === 'string' && p.pourquoi.length > 40,
     `3. l'entrée '${p.adresse}' doit dire POURQUOI la perte est tolérée, et jusqu'à quoi`);
}

if (echecs.length) {
  console.error(`❌ invocation écrite ≠ invocation émise : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ toute invocation écrite ressort émise — ${passe} vérification(s) passée(s) ; `
            + `${ecrites} invocation(s) écrite(s) dans ${scenes} scène(s), ${emises} adresse(s) émise(s), `
            + `${PERTES_CONNUES.length} perte(s) connue(s)`);
}
