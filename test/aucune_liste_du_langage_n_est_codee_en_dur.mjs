#!/usr/bin/env node
// AUCUNE LISTE DU LANGAGE N'EST CODÉE EN DUR — la donnée dit le vocabulaire, le code le lit.
//
// ⚠️ CE GARDE VIENT D'UN DÉFAUT PAYÉ LE 2026-08-06, ET SA CAUSE EST INSTRUCTIVE.
// `lib/core.json` déclare `schema.catalogAxes` depuis le 2026-07-05, précisément pour qu'un axe
// déclaré UNE FOIS vaille partout (Romain : « le schéma structurel est une DONNÉE, plus en dur
// dans le code »). Le parseur en gardait pourtant une COPIE littérale. Le jour où `eval` a été
// ajouté à la donnée, rien n'a bougé — le parseur lisait toujours ses cinq noms.
//
// ⚠️ ET LE DÉFAUT ÉTAIT MUET, C'EST LÀ QU'IL COÛTE. La déclaration semblait posée, la garde ne
// mordait pas, et j'en ai conclu « configuration sans effet » — une conclusion tirée d'une mesure
// qui ne mesurait pas ce que je croyais. J'ai failli retirer la bonne déclaration au motif qu'elle
// ne servait à rien. Un double ne se contente pas de diverger : il fabrique des conclusions
// fausses sur la donnée elle-même.
//
// CE QU'IL VÉRIFIE : pour chaque liste que `lib/core.json` déclare, le code ne doit pas porter la
// même énumération en littéral. On ne cherche pas un NOM de variable — on cherche la SUBSTANCE :
// un ensemble littéral dont les membres reproduisent une liste déclarée.
//
// CE QU'IL NE VÉRIFIE PAS : les listes du langage qui n'ont PAS de domicile dans la donnée. Elles
// sont inventoriées plus bas, avec leur écart mesuré — ce garde les nomme au lieu de les couvrir.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIBS } from '../src/transpiler/libs-data.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ICI, '..', 'src', 'transpiler');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const schema = LIBS?.core?.schema || {};
const listes = Object.entries(schema).filter(([k, v]) => !k.startsWith('_') && Array.isArray(v) && v.length >= 2);

// SOCLE — un schéma vide rendrait ce garde muet et vert.
ok(listes.length >= 4,
   `SOCLE : ${listes.length} liste(s) déclarée(s) dans lib/core.json schema — la donnée a changé de forme`);

const FICHIERS = ['parser.js', 'tokenizer.js', 'bpxAst.js', 'libs.js', 'actorResolver.js'];
const sources = FICHIERS.map((f) => {
  let texte = '';
  try { texte = readFileSync(path.join(SRC, f), 'utf-8'); } catch { /* absent : le socle le dira */ }
  // On retire les COMMENTAIRES : une liste citée dans une explication n'est pas un double, et
  // ce fichier lui-même en cite. Sans ce retrait, le garde s'accuserait de ce qu'il documente.
  return [f, texte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')];
});
ok(sources.every(([, t]) => t.length > 1000), `SOCLE : un fichier source n'a pas été lu`);

// UN DOUBLE, C'EST QUOI : un ensemble ou tableau littéral qui contient TOUS les membres d'une
// liste déclarée. Deux membres communs ne suffisent pas — `ch` peut apparaître ailleurs ; c'est
// la liste ENTIÈRE reproduite qui trahit la copie.
const litteraux = [];
for (const [f, t] of sources) {
  for (const m of t.matchAll(/(?:new Set\(\[|\[)((?:\s*['"][a-z_][\w-]*['"]\s*,?)+)\]/gi)) {
    const membres = [...m[1].matchAll(/['"]([a-z_][\w-]*)['"]/gi)].map((x) => x[1]);
    if (membres.length >= 2) litteraux.push({ f, membres: new Set(membres), n: membres.length });
  }
}
ok(litteraux.length >= 5, `SOCLE : ${litteraux.length} littéral(aux) trouvé(s) — le lecteur ne voit plus le code`);

for (const [nom, valeurs] of listes) {
  const copies = litteraux.filter((l) => valeurs.every((v) => l.membres.has(v)));
  ok(copies.length === 0,
     `'${nom}' est déclaré dans lib/core.json ET reproduit en littéral dans ${[...new Set(copies.map((c) => c.f))].join(', ')} — `
     + `un double ne diverge pas seulement, il fait conclure faux sur la donnée. Lire la donnée.`);
}

// ────────────────────────────────────────────────────────────────────────────
// INVENTAIRE — les listes du langage SANS domicile dans la donnée
// ────────────────────────────────────────────────────────────────────────────
// Elles ne peuvent pas être « dé-codées en dur » : il n'y a nulle part où les mettre. Les nommer
// vaut mieux que les taire — et l'écart mesuré ci-dessous dit pourquoi ça compte.
const SANS_DOMICILE = [
  // ⚠️ CET INVENTAIRE EST VIDE DEPUIS LE 2026-08-06, ET C'EST SON TÉMOIN QUI L'A VIDÉ.
  // Il portait `VAR_CONVENTIONS` et `ACTOR_ENTITY_KEYS` — les deux dernières listes du langage
  // sans domicile dans la donnée. Romain a tranché le jour même (« qu'est-ce qui t'empêche de
  // créer les déclarations en librairies ? ») : elles vivent désormais dans
  // `lib/core.json` schema (`actorKeys`, `deprecatedActorKeys`, `varConventions`), et le témoin
  // ci-dessous a EXIGÉ leur retrait d'ici en rougissant. Un inventaire qui ne se vide jamais
  // n'est qu'une liste de regrets.
]; 
for (const e of SANS_DOMICILE) {
  const vue = sources.some(([f, t]) => f === e.ou && t.includes(e.nom));
  ok(vue, `l'inventaire cite '${e.nom}' dans ${e.ou}, introuvable — entrée périmée, à retirer`);
}

if (echecs.length) {
  console.error(`❌ le vocabulaire du langage est dupliqué : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ aucune liste déclarée n'est reproduite en dur — ${passe} vérification(s) : `
          + `${listes.length} liste(s) de lib/core.json confrontées à ${litteraux.length} littéral(aux) `
          + `dans ${FICHIERS.length} fichiers. ${SANS_DOMICILE.length} liste(s) du langage sans domicile `
          + `dans la donnée.`);
