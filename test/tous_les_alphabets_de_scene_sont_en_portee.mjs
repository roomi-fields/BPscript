#!/usr/bin/env node
/**
 * TOUS LES ALPHABETS QU'UNE SCÈNE DÉCLARE SONT EN PORTÉE — pas seulement le premier.
 *
 * ⚠️ CE QUE ÇA FERME, ET LE DÉFAUT ÉTAIT MUET DU CÔTÉ DE LA DÉCLARATION. La bible écrit
 * (`LANGUAGE.md` §« Déclarer un symbole : convention de lecture et sortie ») :
 *
 *     @alphabet.sargam:audio           // les terminaux de sargam sortent par l'audio
 *     @alphabet.tabla:osc              // ceux de tabla sortent par l'OSC
 *     S -> sa dhin
 *
 * Le calcul des terminaux en portée prenait le PREMIER alphabet déclaré (`find`) et ignorait les
 * suivants. `dhin` était donc refusé comme « terminal non déclaré » — un message qui accuse la
 * RÈGLE alors que la scène déclare l'alphabet deux lignes plus haut. La seconde déclaration n'était
 * pas refusée, elle était **ignorée** : rien ne disait qu'une ligne entière ne servait à rien.
 *
 * ⚠️ ET C'EST MA MESURE QUI AVAIT MENTI D'ABORD. J'ai rapporté ce bloc comme « erreur de doc — un
 * bol de tabla sous un alphabet sargam », parce que mon essai avait **laissé tomber la seconde
 * ligne du bloc**. Romain a demandé « et ? quel est le problème ? » ; en relisant le bloc ENTIER,
 * le problème a changé de camp. Mesurer un extrait d'un exemple, c'est mesurer autre chose que
 * l'exemple.
 *
 * CE QUE CE GARDE NE COUVRE PAS, ET C'EST ÉCRIT PLUTÔT QUE SOUS-ENTENDU : la scène ci-dessus lie
 * chaque alphabet à une SORTIE différente (`:audio`, `:osc`). Un acteur ne porte qu'un alphabet et
 * qu'une sortie (règle de Romain, 2026-08-07), donc deux alphabets appellent DEUX acteurs
 * implicites — et la décision `2026-07-30-l-acteur-implicite-s-appelle-scene.md` n'en nomme
 * qu'UN. Nommer le second est une décision de structure, pas une déduction : elle est en attente.
 * Ce garde mesure la PORTÉE DES TERMINAUX, pas la matérialisation des acteurs.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compiler = (src) => {
  try { return compileToBPxAST(src); } catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message || e).join(' | ');

// ── A. LE BLOC DE LA BIBLE, ET SES VARIANTES D'ORDRE ──────────────────────────────────────────
// ⚠️ LES DEUX ORDRES, ET LES DEUX SENS DE LECTURE. Un correctif qui n'ajouterait le second
// alphabet qu'à la fin passerait la première ligne et échouerait sur la seconde.
const DOIVENT_PASSER = [
  ['le bloc de la bible, avec les sorties',
   '@core\n@alphabet.sargam:audio\n@alphabet.tabla:osc\nS -> sa dhin\n'],
  ['les deux alphabets, sans sortie',
   '@core\n@alphabet.sargam\n@alphabet.tabla\nS -> sa dhin\n'],
  ['ordre inverse — le terminal du PREMIER déclaré',
   '@core\n@alphabet.tabla\n@alphabet.sargam\nS -> dhin sa\n'],
  ['trois alphabets',
   '@core\n@alphabet.sargam\n@alphabet.tabla\n@alphabet.western\nS -> sa dhin C4\n'],
  ['un seul alphabet — le cas ordinaire ne bouge pas',
   '@core\n@alphabet.sargam\nS -> sa re\n'],
];
for (const [quoi, src] of DOIVENT_PASSER) {
  const msg = messages(compiler(src));
  ok(msg === '', `A. ${quoi} — REFUSÉ : ${msg.replace(/\s+/g, ' ').slice(0, 100)}`);
}

// ── B. TÉMOIN QUI MORD — la portée reste une PORTÉE, pas un passe-droit ───────────────────────
// ⚠️ Sans ce volet, un correctif qui aurait simplement cessé de vérifier les terminaux passerait
// le volet A en triomphe. C'est la moitié « doit refuser », et c'est elle qui démasque.
const DOIVENT_REFUSER = [
  ['un mot qui n\'est dans AUCUN des alphabets déclarés',
   '@core\n@alphabet.sargam\n@alphabet.tabla\nS -> sa dhin zzz\n'],
  ['un bol de tabla quand SEUL sargam est déclaré',
   '@core\n@alphabet.sargam\nS -> sa dhin\n'],
  ['une note occidentale quand seuls sargam et tabla sont déclarés',
   '@core\n@alphabet.sargam\n@alphabet.tabla\nS -> sa C4\n'],
];
for (const [quoi, src] of DOIVENT_REFUSER) {
  const msg = messages(compiler(src));
  ok(/non déclaré|absent des alphabets/.test(msg),
     `B-témoin. ${quoi} — doit être REFUSÉ, et ne l'est plus (${msg.slice(0, 80) || 'aucune erreur'}). `
     + `Une portée qui accepte tout n'est plus une portée : le volet A ne prouverait alors rien.`);
}

// ── SOCLE ─────────────────────────────────────────────────────────────────────────────────────
ok(DOIVENT_PASSER.length >= 5 && DOIVENT_REFUSER.length >= 3,
   `SOCLE : les deux sens doivent être peuplés — ${DOIVENT_PASSER.length} formes qui passent, `
   + `${DOIVENT_REFUSER.length} qui refusent.`);

if (echecs.length) {
  console.error(`❌ les alphabets de scène : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ tous les alphabets déclarés par une scène sont en portée — ${passe} vérification(s) : `
          + `${DOIVENT_PASSER.length} formes lues (jusqu'à trois alphabets, dans les deux ordres) et `
          + `${DOIVENT_REFUSER.length} refus qui prouvent que la portée mord encore.`);
