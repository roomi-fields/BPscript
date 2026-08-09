#!/usr/bin/env node
/**
 * UN CONTEXTE NE SE POSE QU'AUX EXTRÉMITÉS DU MEMBRE GAUCHE.
 *
 * ⛔ DÉCISION DE ROMAIN, 2026-08-09 : « tu ne dois pas l'accepter, d'autant qu'on l'a sorti du
 * langage. » La place du milieu — `x (A) B -> …` — est fermée.
 *
 * ⚠️ L'ARGUMENT EST UNE MESURE DE BPx SUR LE MOTEUR D'ORIGINE, pas un raisonnement : le contexte y
 * OUVRE le membre gauche, derrière le seul préfixe de poids, ou il le FERME. Aucune grammaire
 * native ne le pose après un élément — assiette : `bp3-engine/test-data` et le corpus BP3 de
 * kanopi. Ils ont joint le falsifiable qui les contredirait : une seule grammaire native qui le
 * ferait suffit à rouvrir la place.
 *
 * ⚠️ ET LA MESURE QUI M'AVAIT FAIT CROIRE AU PIRE ÉTAIT FAUSSE. Je regardais le champ `contexts`
 * de la règle : il valait ZÉRO pour les trois formes non-tête, et j'en avais conclu « le contexte
 * est perdu en silence ». Il ne l'est pas — le contexte DROIT vit dans le membre gauche, par
 * construction. **Chercher au mauvais endroit et conclure à l'absence**, une fois de plus : ce
 * garde vérifie donc les DEUX rangements, jamais un seul.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compiler = (regle) => {
  try { return compileToBPxAST(`@core\n@alphabet.sargam\n${regle}\nS -> sa\n`); }
  catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');
const regle = (r) => r.ast?.subgrammars?.[0]?.rules?.[0];

// ── A. LES DEUX PLACES LÉGITIMES, ET OÙ CHACUNE ATTERRIT ────────────────────────────────────
// Elles ne se rangent PAS au même endroit, et c'est ce qui rend la mesure piégeuse : la tête
// remplit `contexts`, la queue vit dans `lhs`. Un garde qui n'en regarderait qu'un déclarerait
// l'autre absente.
const LEGITIMES = [
  ['en TÊTE',  '(A) x B -> sa re', (rg) => (rg.contexts || []).length === 1],
  ['en QUEUE', 'x B (A) -> sa re', (rg) => (rg.lhs || []).some((e) => e.type === 'Context')],
  ['en tête, avec dièse', '#(A B) x -> sa re', (rg) => (rg.contexts || []).length === 1],
];
for (const [quoi, src, arrive] of LEGITIMES) {
  const r = compiler(src);
  ok(messages(r) === '', `A. un contexte ${quoi} doit passer — REFUSÉ : ${messages(r).slice(0, 90)}`);
  if (messages(r)) continue;
  ok(arrive(regle(r) || {}),
     `A. un contexte ${quoi} doit ARRIVER dans l'arbre — accepter n'est pas transmettre. `
     + `Reçu contexts=${(regle(r)?.contexts || []).length}, `
     + `lhs=${JSON.stringify((regle(r)?.lhs || []).map((e) => e.type))}`);
}

// ── B. LA PLACE DU MILIEU REFUSE, ET LE REFUS DIT LES DEUX PLACES QUI RESTENT ────────────────
// ⚠️ Un refus qui ne nomme pas la réécriture envoie l'auteur dans un mur — payé trois fois le
// 2026-08-09, dont une fois où mon message prescrivait une forme que la fermeture voisine
// interdisait. Ce témoin garde le TEXTE, pas seulement le refus.
for (const [quoi, src] of [
  ['après un élément',            'x (A) B -> sa re'],
  ['après deux éléments',         'x B (A) C -> sa re'],
  ['après un nom entre barres',   '|x| (A) x B -> sa re'],
]) {
  const msg = messages(compiler(src));
  ok(msg !== '', `B. un contexte ${quoi} doit REFUSER, et il passe. Un arbre que rien en aval ne `
                 + `sait lire est pire qu'un refus.`);
  ok(/EXTREMITES du membre gauche/.test(msg),
     `B. ${quoi} — le refus doit nommer les DEUX places qui restent. Reçu : ${msg.slice(0, 90)}`);
}

// ── SOCLE — contre le vert obtenu en ne mesurant plus rien ───────────────────────────────────
ok(LEGITIMES.length >= 3,
   `SOCLE : ${LEGITIMES.length} formes légitimes mesurées, 3 au moins attendues. Un garde qui ne `
 + `garde plus que les refus laisse la moitié « doit passer » sans témoin — et c'est celle-là qui `
 + `démasque une règle devenue trop sévère.`);

if (echecs.length) {
  console.error(`❌ un contexte aux extrémités : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ un contexte ne se pose qu'aux extrémités du membre gauche — tête et queue passent et `
          + `ARRIVENT dans l'arbre (à deux endroits différents), le milieu refuse en nommant les deux `
          + `places qui restent. ${passe} vérification(s) passée(s).`);
