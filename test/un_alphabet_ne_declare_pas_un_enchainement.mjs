#!/usr/bin/env node
/**
 * GARDE — UN ALPHABET DÉCLARE DES TERMINAUX SIMPLES, JAMAIS LEURS ENCHAÎNEMENTS.
 *
 * ⚠️ CE QUI A COÛTÉ CE GARDE, ET C'EST DE MOI. `alphabets.dhadhatite` déclarait `dhadha`,
 * `dhadhateena`, `dhadhatitedhadhadheena` et `dhadhatitedhadhateena` comme des bols. Ce sont des
 * ENCHAÎNEMENTS — `dha`+`dha`, `dha`+`dha`+`teena`. L'alphabet natif `-al.dhadhatite` n'en déclare
 * aucun : il porte six bols simples.
 *
 * ⛔ ET LA PROVENANCE LE DISAIT ELLE-MÊME, dans le champ `_source` de l'entrée : « Vocabulaire
 * relevé AU COMPILATEUR sur kanopi .../dhadhatite_v2.bps (8 terminaux employés) ». L'alphabet a
 * été fabriqué en lisant ce qu'une scène EMPLOYAIT, pas ce que l'instrument DÉCLARE — une
 * réparation au point d'observation, écrite noir sur blanc et jamais relue.
 *
 * CE QUE ÇA PRODUISAIT, mesuré par Kanopi le 2026-08-19 sur sa scène :
 *     alphabet.dhadhatite  →  16 feuilles, dont `dhadhatitedhadhateena` entière
 *     alphabet.tabla       →  64 feuilles : dha dha dha ti te dha …
 * La capture native rend 64 bols. Un nom composé est une STRUCTURE — `def dhadha dha dha`, la
 * forme que Romain arbitre le 2026-08-19 — jamais une feuille d'alphabet.
 *
 * ⚠️ ET L'INSTRUMENT S'EST TROMPÉ AVANT LE SUJET. Mon premier découpeur refusait de réutiliser un
 * terminal au second pas et rendait ZÉRO sur les dix-sept alphabets — un compte vide qui ressemble
 * exactement à « aucun enchaînement nulle part ».
 */
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** Un nom se découpe-t-il entièrement en DEUX terminaux ou plus du même alphabet ? */
const enchainement = (mot, terminaux) => {
  const marche = (reste, pas) => {
    if (reste === '') return pas > 1;
    for (const t of terminaux) if (t && reste.startsWith(t) && marche(reste.slice(t.length), pas + 1)) return true;
    return false;
  };
  return marche(mot, 0);
};

// ⛔ L'EXEMPTION EST MESURÉE, PAS SUPPOSÉE. `simple` déclare les vingt-six lettres comme terminaux ;
// TOUT nom de plus d'une lettre s'y découpe, et `filler` n'est pas plus un enchaînement que `chat`
// ne l'est en français. La borne est donc la NATURE de l'alphabet : une majorité de terminaux d'un
// seul caractère en fait un alphabet de LETTRES, où la concaténation ne veut rien dire.
const alphabetDeLettres = (t) => t.filter((x) => x.length === 1).length > t.length / 2;

const familles = ['alphabets', 'test_alphabets'];
let examines = 0;
const lettres = [];

for (const famille of familles) {
  for (const [nom, entree] of Object.entries(LIBS[famille] || {})) {
    if (!entree || typeof entree !== 'object' || !entree.terminals) continue;
    const T = Object.keys(entree.terminals);
    if (!T.length) continue;
    examines++;
    if (alphabetDeLettres(T)) { lettres.push(`${famille}.${nom}`); continue; }
    const composes = T.filter((m) => enchainement(m, T));
    ok(composes.length === 0,
      `${famille}.${nom} déclare ${composes.length} ENCHAÎNEMENT(S) comme terminal : `
      + `${composes.slice(0, 4).join(', ')}. Un nom qui se découpe en d'autres terminaux du même `
      + `alphabet est une STRUCTURE — il s'écrit 'def <nom> <bols…>' — et le déclarer terminal fait `
      + `sonner une feuille entière là où l'oracle natif rend une séquence.`);
  }
}

// ── ET LA PROVENANCE : ce qui fait autorité sur un alphabet est l'INSTRUMENT, jamais une scène ──
// C'est la cause, pas le symptôme : l'entrée fautive s'est écrite en relevant ce qu'une scène
// employait. Un `_source` qui nomme un `.bps` avoue la réparation au point d'observation.
for (const famille of familles) {
  for (const [nom, entree] of Object.entries(LIBS[famille] || {})) {
    if (!entree || typeof entree !== 'object' || !entree._source) continue;
    examines++;
    ok(!/\.bps\b/.test(entree._source),
      `${famille}.${nom} déclare une provenance de SCÈNE : « ${String(entree._source).slice(0, 90)} ». `
      + `Un alphabet se relève sur l'instrument natif — une scène dit ce qu'elle emploie, jamais ce `
      + `qui existe.`);
  }
}

// ⛔ UN GARDE QUI A EXAMINÉ ZÉRO N'A RIEN PROUVÉ.
ok(examines >= 20,
  `ce garde n'a examiné que ${examines} entrée(s) — sous ce seuil il ne mesure plus rien : soit le `
  + `paquet a changé de forme, soit le champ des terminaux a changé de nom.`);

console.log(`[alphabet] ${examines} entrée(s) examinée(s) sur ${familles.length} famille(s)`);
if (lettres.length) console.log(`[alphabet] ${lettres.length} alphabet(s) de LETTRES exemptés, nommés : ${lettres.join(', ')}`);

if (echecs.length) {
  console.error(`[alphabet] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[alphabet] ${passe} PASS / 0 FAIL`);
