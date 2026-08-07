#!/usr/bin/env node
/**
 * GARDE — toute librairie que le corpus INVOQUE déclare son domaine DEDANS.
 *
 * DÉCISION Romain 2026-07-13 (`hub ef75ec6`, `decisions/2026-07-13-invocation-librairies-factory-
 * mine.md`) : une librairie est un FICHIER qui déclare son domaine. Le domaine n'est PAS déduit
 * d'un axe figé lu dans l'invocation — il est LU dans le fichier au chargement. L'invocation nomme
 * un fichier et une entrée ; le domaine dit à l'aval dans quel casier ranger l'entrée.
 *
 * SIGNALÉ par Kairos le 2026-07-27 : `lib/homomorphism.json` ne le déclarait pas. La scène
 * `transposition1.bps` l'invoque, le fichier existe, l'hôte le fournissait — et Kairos refusait
 * bruyamment de résoudre. Il avait raison : il n'invente pas le domaine d'une librairie qui ne lui
 * appartient pas. Son banc d'iso sur les 75 notes de cette scène était suspendu là-dessus.
 *
 * POURQUOI CE GARDE MESURE SUR LE CORPUS, et pas sur une liste de fichiers. Le trou n'est pas
 * « homomorphism.json manque un champ », c'est « une librairie peut être invoquée sans qu'on
 * sache où ranger ce qu'elle rend ». Le garde part donc des adresses que les scènes PRODUISENT
 * vraiment : il attrape le jour où une scène invoque un fichier sans domaine, quel qu'il soit.
 * Écrire la liste à la main aurait gardé le fichier du ticket, pas la construction.
 *
 * ⚠️ UNE EXCEPTION NOMMÉE, ET UNE SEULE — `settings`, ARBITRÉE le 2026-07-27. Deux scènes du
 * corpus l'invoquent (`all-items1` → `settings.test1`, `not-reich` → `settings.notreich`) et le
 * fichier servi ne déclare aucun domaine. VERDICT de l'architecte : les réglages NE SONT PAS une
 * librairie. Un domaine identifie un catalogue d'ENTITÉS qu'on invoque par provenance ; des
 * réglages moteur par grammaire ne sont pas un catalogue — on ne les invoque pas, on les APPLIQUE.
 * Leur poser un domaine pour faire verdir un garde aurait décidé PAR EFFET DE BORD qu'ils sont une
 * librairie comme les autres. Le jour où quelqu'un voudra en faire une, ce sera une décision
 * datée, pas un champ ajouté au passage.
 *
 * L'exception reste donc écrite, datée et VISIBLE plutôt que fondue dans une condition — et son
 * témoin rougit le jour où un domaine serait posé, pour qu'un tel geste ne passe pas inaperçu.
 *
 * ⚠️ CE QU'IL NE COUVRE PAS ENCORE, et c'est mesuré : quatre autres fichiers du bundle restent
 * invocables sans domaine — `core`, `language`, `modulation`, `sub`. Les deux premiers ne sont pas
 * des catalogues mais le schéma et la configuration du langage : ils ne devraient pas être
 * invocables du tout. Les deux autres sont peut-être de vraies librairies sans domaine. Aucune
 * scène du corpus ne les invoque aujourd'hui — ce garde rougira le jour où l'une le fera, ce qui
 * est exactement le moment où il faudra trancher.
 */
// ⚠️ `@transcription` est REMPLACÉE par `@homomorphism` (Romain, 2026-08-07, « oui on renomme ») :
// la bible n'a jamais écrit que `@homomorphism.<table>`. Les tables ont rejoint
// `lib/homomorphism.json` (clé `tables`), `lib/transcription.json` est SUPPRIMÉ, et les 13 scènes
// de l'écosystème qui écrivaient l'ancien mot sont migrées. Ce garde suit le mot vivant.
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';
import { fichierDeLAxe } from '../src/transpiler/libs.js';
import { nomsBps, lireBps, exigerCorpus } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ─── 1. SOCLE — le cas signalé, nommément ────────────────────────────────────────────────────
// Ancré à part : le garde du corpus ci-dessous rétrécit avec le corpus, celui-ci non.
ok(LIBS.homomorphism?.domain === 'homomorphism',
   `1. lib/homomorphism.json doit déclarer son domaine — reçu : ${JSON.stringify(LIBS.homomorphism?.domain)}`);
{
  const o = compileToBPxAST('@core\n@controls\n@alphabet.western:midi\n@homomorphism.transposition\n@mode:ord\nS -> C4\n');
  ok((o.errors || []).length === 0,
     `1. la scène qui invoque la table de transposition doit compiler — reçu : ${(o.errors || []).map((e) => e.message || e).join(' | ')}`);
  ok((o.ast?.libRefs || []).includes('homomorphism.transposition'),
     "1. et l'adresse doit sortir — c'est elle que l'aval range par domaine");
}

// ─── 2. TOUTES les librairies que le corpus invoque déclarent leur domaine ───────────────────
exigerCorpus();
const invoquees = new Map(); // fichier → scènes qui l'invoquent
let scenes = 0;
for (const nom of nomsBps()) {
  let o;
  try { o = compileToBPxAST(lireBps(nom)); } catch { continue; }
  if ((o.errors || []).length > 0) continue;
  scenes++;
  for (const adresse of (o.ast?.libRefs || [])) {
    // L'adresse porte l'AXE, la donnée vit sous le nom du FICHIER : `sound.tabla_perc` habite
    // `sounds.json`. Le passage se fait par la table du chargeur, jamais par une copie ici.
    const fichier = fichierDeLAxe(String(adresse).split('.')[0]);
    if (!invoquees.has(fichier)) invoquees.set(fichier, []);
    invoquees.get(fichier).push(nom);
  }
}
ok(scenes > 40, `2. le corpus doit fournir de quoi mesurer — ${scenes} scène(s) compilée(s)`);
ok(invoquees.size > 0, '2. le corpus doit invoquer au moins une librairie — sinon ce garde est creux');

// L'exception, écrite ici et pas cachée dans une condition — cf. l'en-tête. ARBITRÉE le
// 2026-07-27 : les réglages ne sont pas une librairie, on ne les invoque pas, on les APPLIQUE.
// À NE PAS transformer en règle générale : les quatre autres fichiers sans domaine restent hors
// garde tant qu'aucune scène ne les invoque.
const PAS_UNE_LIBRAIRIE = new Set(['settings']);
ok(PAS_UNE_LIBRAIRIE.size === 1,
   `2. une seule exception est tolérée, et elle est nommée — reçu ${PAS_UNE_LIBRAIRIE.size}`);

for (const [fichier, portees] of [...invoquees].sort()) {
  const lib = LIBS[fichier];
  if (PAS_UNE_LIBRAIRIE.has(fichier)) {
    // Le témoin garde la décision DANS LES DEUX SENS : si un domaine apparaît sur ce fichier, il
    // rougit — parce que ce serait revenir sur l'arbitrage du 2026-07-27 sans décision datée.
    ok(lib?.domain === undefined,
       `2. '${fichier}' déclare désormais un domaine (${JSON.stringify(lib?.domain)}) — or il a été `
       + `tranché le 2026-07-27 que les réglages NE SONT PAS une librairie. Revenir dessus demande `
       + `une décision datée, pas un champ ajouté au passage`);
    continue;
  }
  ok(lib !== undefined,
     `2. la librairie '${fichier}' invoquée par ${portees[0]} doit exister dans le bundle`);
  ok(lib?.domain !== undefined && lib?.domain !== null && lib?.domain !== '',
     `2. la librairie '${fichier}' est invoquée par ${portees.length} scène(s) (dont ${portees[0]}) `
     + `et NE DÉCLARE PAS son domaine — l'aval ne peut pas ranger ce qu'elle rend `
     + `(décision Romain 2026-07-13)`);
}

if (echecs.length) {
  console.error(`❌ domaine des librairies : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ toute librairie invoquée déclare son domaine — ${passe} vérification(s) passée(s) `
            + `sur ${invoquees.size} librairie(s) invoquée(s) par ${scenes} scène(s)`);
}
