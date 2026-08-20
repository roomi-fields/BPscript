#!/usr/bin/env node
/**
 * GARDE — DANS UN ESPACE DE NOMS, DEUX CONTRIBUTEURS NE PORTENT PAS LA MÊME ENTRÉE.
 *
 * ⛔ UN MOT D'INVOCATION DÉSIGNE UN ESPACE, PAS UN FICHIER. Plusieurs librairies y contribuent —
 * `alphabets` et `test_alphabets` déclarent tous deux `alphabet` — et le chargeur les parcourt dans
 * l'ordre jusqu'à celle qui porte l'entrée cherchée.
 *
 * ⛔ CE QU'IL TIENT, ET C'EST MUET SANS LUI. Fabriqué le 2026-08-20 : un troisième contributeur
 * d'`alphabet` portant une entrée `western` imposteur. Le chargeur rend LE PREMIER TROUVÉ, sans un
 * mot. Rien ne distingue à l'arrivée une entrée unique d'une entrée qui en a écrasé une autre — le
 * consommateur reçoit un objet bien formé dans les deux cas. Un gagnant implicite, ce que la
 * résolution des noms interdit partout ailleurs.
 *
 * ⚠️ ET LA MESURE QUI RASSURAIT VIVAIT DANS UN COMMENTAIRE. `libs.js` porte « aucun nom d'entrée
 * n'est porté par les deux — mesure du 2026-08-17, zéro collision ». C'est vrai, et ça l'est encore.
 * Mais une mesure datée n'est pas un garde : elle était vraie le 17, elle est vraie aujourd'hui, et
 * rien ne la tenait demain. Même forme que la fiche d'état, qui a dérivé cinq jours sous une phrase
 * affirmant qu'un garde la surveillait.
 *
 * ⛔ ET IL PORTE SON PROPRE TÉMOIN. Un détecteur qui ne détecte plus rien rend « zéro collision »,
 * exactement comme un dépôt propre. Les deux se distinguent en FABRIQUANT le cas : le volet B monte
 * un jeu de contributeurs qui se marchent dessus et exige que le détecteur le voie. Sans lui, ce
 * garde resterait vert le jour où sa propre boucle cesserait de parcourir quoi que ce soit.
 */
import { LIBS } from '../src/transpiler/libs-data.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

/** Les entrées d'une librairie : ce qui n'est ni une méta (chaîne) ni un commentaire (souligné). */
const entrees = (lib) => Object.entries(lib || {})
  .filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object' && !Array.isArray(v))
  .map(([k]) => k);

/** Les espaces de noms d'un jeu de librairies : mot d'invocation → fichiers qui y contribuent. */
const espaces = (libs) => {
  const table = new Map();
  for (const [fichier, lib] of Object.entries(libs)) {
    const mot = lib && typeof lib === 'object' ? lib.resolves : null;
    if (!mot) continue;
    if (!table.has(mot)) table.set(mot, []);
    table.get(mot).push(fichier);
  }
  return table;
};

/** Les noms portés par PLUSIEURS contributeurs d'un même espace. */
const collisions = (libs) => {
  const out = [];
  for (const [mot, fichiers] of espaces(libs)) {
    if (fichiers.length < 2) continue;
    const vus = new Map();
    for (const f of fichiers) for (const n of entrees(libs[f])) {
      if (!vus.has(n)) vus.set(n, []);
      vus.get(n).push(f);
    }
    for (const [nom, fs] of vus) if (fs.length > 1) out.push(`${mot}.${nom} porté par ${fs.join(' et ')}`);
  }
  return out;
};

// ── A. LA DONNÉE PUBLIÉE — aucun espace ne porte deux fois le même nom ───────────────────────────
{
  const table = espaces(LIBS);
  ok(table.size > 0, "A. la donnée doit déclarer des mots d'invocation — sans eux le garde examine zéro");
  const partages = [...table].filter(([, f]) => f.length > 1);
  ok(partages.length > 0,
    "A. au moins un espace doit avoir PLUSIEURS contributeurs — sinon ce garde ne peut rien examiner "
    + "et son vert ne dit rien. Si le jour vient où chaque mot n'a qu'un fichier, ce volet doit le DIRE, "
    + `pas passer en silence. Espaces : ${[...table].map(([m, f]) => `${m}×${f.length}`).join(' ')}`);
  const c = collisions(LIBS);
  ok(c.length === 0,
    `A. ⛔ ${c.length} entrée(s) portée(s) par deux contributeurs d'un même espace : ${c.join(' · ')} — `
    + `le chargeur rendrait LE PREMIER TROUVÉ sans un mot, et rien ne le dirait au consommateur`);
}

// ── B. ⛔ LE TÉMOIN — le détecteur voit-il une collision quand il y en a une ? ────────────────────
// Sans ce volet, un détecteur cassé rendrait « zéro collision » exactement comme un dépôt propre.
{
  const jeu = {
    vrai: { resolves: 'axe_temoin', western: { description: 'authentique' }, autre: { description: 'x' } },
    faux: { resolves: 'axe_temoin', western: { description: 'IMPOSTEUR' } },
    seul: { resolves: 'axe_solitaire', western: { description: 'sans rival' } },
  };
  const c = collisions(jeu);
  ok(c.length === 1, `B. le détecteur doit voir LA collision fabriquée — reçu ${JSON.stringify(c)}`);
  ok(c[0]?.includes('axe_temoin.western'), `B. et la NOMMER — reçu ${JSON.stringify(c[0])}`);
  ok(!c.some((x) => x.includes('axe_solitaire')),
    "B. un nom identique dans DEUX ESPACES DIFFÉRENTS n'est pas une collision — les espaces sont étanches");
  ok(!c.some((x) => x.includes('autre')), "B. ni une entrée que seul un contributeur porte");
}

// ── C. LE FILTRE — une méta ou un commentaire n'est pas une entrée ───────────────────────────────
{
  const jeu = {
    a: { resolves: 'axe_c', resolvedBy: 'Kairos', _comment: { x: 1 }, vrai: { d: 1 } },
    b: { resolves: 'axe_c', resolvedBy: 'Kairos', _comment: { x: 2 } },
  };
  const c = collisions(jeu);
  ok(c.length === 0,
    `C. une méta ni un commentaire souligné ne comptent comme entrée — reçu ${JSON.stringify(c)}`);
}

const ATTENDU = 3 + 4 + 1;
ok(p + e.length === ATTENDU, `le garde doit éprouver ${ATTENDU} cas — ${p + e.length} seulement`);

if (e.length) { console.error(`[espaces] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[espaces] ${p} PASS / 0 FAIL — ${p} assertion(s), ${espaces(LIBS).size} espace(s) examiné(s)`);
