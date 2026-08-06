// LA VOIX N'EST PLUS UNE CLÉ D'ACTEUR — pierre tombale et intégrité de la librairie.
//
// ⚠️ CE FICHIER A CHANGÉ DE SUJET LE 2026-08-06, ET LE POURQUOI IMPORTE.
// Il exerçait `voice.<nom>` comme septième clé d'entité d'un acteur — neuf assertions. Romain a
// tranché ce jour-là : « voice est maintenant la librairie des voix et est liée au TERMINAL, pas
// à l'acteur ». Le motif n'est PAS que la clé était inemployée — aucune scène ne l'écrivait, mais
// ce n'est pas ce qui a décidé : c'est qu'une voix n'est pas une propriété de l'acteur.
//
// ⚠️ CE QUE CE FICHIER NE TESTE PAS, ET IL FAUT LE DIRE : l'attache au TERMINAL. Mesuré le même
// jour — elle n'existe pas encore dans le code, et aucune scène ne l'écrit. C'est l'état CIBLE,
// pas l'état actuel. Écrire ici des assertions dessus reviendrait à tester une intention ; les
// écrire quand elle existera est le geste juste. Ce fichier garde donc les DEUX choses qui sont
// vraies aujourd'hui : la clé refuse, et la librairie tient.
//
// Run: node test/test_voices.js

import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let pass = 0, fail = 0;
const check = (cond, label) => { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + label); } };
const erreurs = (src) => {
  try { const r = compileToBPxAST(src); return (r.errors || []).map((e) => e.message); }
  catch (e) { return [e.message]; }
};

console.log('--- 1. `voice.<nom>` sur un acteur REFUSE, et le refus dit où la voix vit ---');
{
  const e = erreurs('@core\n@actor lead  alphabet.western voice.wobble out.audio\nS -> C4\n');
  check(e.length > 0, 'voice.wobble sur un acteur doit être REFUSÉ');
  check(e.some((m) => /voix s'attache au TERMINAL/.test(m)),
        'le refus doit nommer la relève, pas dire « flèche attendue » : ' + e.join(' | ').slice(0, 120));
}

console.log('--- 2. TOUTE clé hors liste refuse — liste blanche, pas liste noire ---');
// Exigence de Romain le 2026-08-06 : « ce qui est refusé, ça devrait être tout ce qui n'est pas
// accepté ». Une liste noire ne ferme que ce qu'on a pensé à y mettre ; ce témoin passe donc par
// une clé que PERSONNE n'a jamais écrite — une faute de frappe.
{
  const e = erreurs('@core\n@actor lead  alphabt.western\nS -> C4\n');
  check(e.length > 0, "une clé inconnue (faute de frappe) doit REFUSER, pas finir le bloc en silence");
  check(e.some((m) => /n'est pas une clé d'acteur/.test(m)), 'le refus la nomme : ' + e.join(' | ').slice(0, 100));
}

console.log('--- 3. LES CINQ CLÉS VIVANTES passent — la moitié qui doit se taire ---');
// Sans ce cas, une règle qui refuserait TOUT resterait verte.
{
  const e = erreurs('@core\n@actor lead  alphabet.western tuning.western_12TET octaves.western out.audio\nS -> C4\n');
  check(e.length === 0, 'les clés valides doivent passer : ' + e.join(' | ').slice(0, 120));
  const e2 = erreurs('@core\n@actor d  eval.strudel(bank:gm)\nS -> d_r\nd_r -> d.`s("bd")`\n');
  check(e2.length === 0, 'eval avec son paramètre propre doit passer : ' + e2.join(' | ').slice(0, 120));
}

console.log('--- 4. LA LIBRAIRIE DES VOIX TIENT — elle ne part pas avec la clé ---');
{
  const objets = (LIBS.voices || {}).objects || {};
  const noms = Object.keys(objets);
  check(noms.length >= 10, `lib/voices.json doit rester peuplée — ${noms.length} entrée(s)`);
  // Les deux réalisations que la spec LANG-SONS distingue : le code qui synthétise, le preset
  // d'un appareil. Une entrée de chaque au moins, sinon la librairie a perdu la moitié de sa forme.
  check(noms.some((n) => objets[n].audio), 'au moins une voix porte une réalisation `audio`');
  check(noms.some((n) => objets[n].device), 'au moins une voix porte une réalisation `device`');
}

console.log(`\n${pass} OK / ${fail} KO`);
if (fail > 0) process.exit(1);
