#!/usr/bin/env node
/**
 * GARDE — toute librairie que le corpus INVOQUE déclare son domaine DEDANS.
 *
 * DÉCISION Romain 2026-07-13 (`hub ef75ec6`, `decisions/2026-07-13-invocation-librairies-factory-
 * mine.md`) : une librairie est un FICHIER qui déclare son domaine. Le domaine n'est PAS déduit
 * d'un axe figé lu dans l'invocation — il est LU dans le fichier au chargement. L'invocation nomme
 * un fichier et une entrée ; le domaine dit à l'aval dans quel casier ranger l'entrée.
 *
 * SIGNALÉ par Kairos le 2026-07-27 : `lib/transcription.json` ne le déclarait pas. La scène
 * `transposition1.bps` l'invoque, le fichier existe, l'hôte le fournissait — et Kairos refusait
 * bruyamment de résoudre. Il avait raison : il n'invente pas le domaine d'une librairie qui ne lui
 * appartient pas. Son banc d'iso sur les 75 notes de cette scène était suspendu là-dessus.
 *
 * POURQUOI CE GARDE MESURE SUR LE CORPUS, et pas sur une liste de fichiers. Le trou n'est pas
 * « transcription.json manque un champ », c'est « une librairie peut être invoquée sans qu'on
 * sache où ranger ce qu'elle rend ». Le garde part donc des adresses que les scènes PRODUISENT
 * vraiment : il attrape le jour où une scène invoque un fichier sans domaine, quel qu'il soit.
 * Écrire la liste à la main aurait gardé le fichier du ticket, pas la construction.
 *
 * ⚠️ UNE EXCEPTION NOMMÉE, ET UNE SEULE — `settings`, EN ATTENTE D'ARBITRAGE. Deux scènes du
 * corpus l'invoquent (`all-items1` → `settings.test1`, `not-reich` → `settings.notreich`) et le
 * fichier servi ne déclare aucun domaine. Ce sont les RÉGLAGES MOTEUR par grammaire, pas un
 * catalogue d'entités : leur donner un domaine serait décider qu'ils sont une librairie comme les
 * autres, ce qui n'est pas à moi de trancher (PORTER ≠ RÉSOUDRE). Je n'invente donc PAS un domaine
 * pour faire verdir — je nomme le trou ici, il est reporté, et cette exception disparaît le jour
 * de l'arbitrage. Une exception écrite et datée reste visible ; un garde qu'on n'a pas branché ne
 * garde rien.
 *
 * ⚠️ CE QU'IL NE COUVRE PAS ENCORE, et c'est mesuré : quatre autres fichiers du bundle restent
 * invocables sans domaine — `core`, `language`, `modulation`, `sub`. Les deux premiers ne sont pas
 * des catalogues mais le schéma et la configuration du langage : ils ne devraient pas être
 * invocables du tout. Les deux autres sont peut-être de vraies librairies sans domaine. Aucune
 * scène du corpus ne les invoque aujourd'hui — ce garde rougira le jour où l'une le fera, ce qui
 * est exactement le moment où il faudra trancher.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';
import { fichierDeLAxe } from '../src/transpiler/libs.js';
import { nomsBps, lireBps, exigerCorpus } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ─── 1. SOCLE — le cas signalé, nommément ────────────────────────────────────────────────────
// Ancré à part : le garde du corpus ci-dessous rétrécit avec le corpus, celui-ci non.
ok(LIBS.transcription?.domain === 'transcription',
   `1. lib/transcription.json doit déclarer son domaine — reçu : ${JSON.stringify(LIBS.transcription?.domain)}`);
{
  const o = compileToBPxAST('@core\n@controls\n@alphabet.western:midi\n@transcription.transposition\n@mode:ord\nS -> C4\n');
  ok((o.errors || []).length === 0,
     `1. la scène qui invoque la table de transposition doit compiler — reçu : ${(o.errors || []).map((e) => e.message || e).join(' | ')}`);
  ok((o.ast?.libRefs || []).includes('transcription.transposition'),
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

// L'exception, écrite ici et pas cachée dans une condition — cf. l'en-tête.
const EN_ATTENTE_D_ARBITRAGE = new Set(['settings']);
ok(EN_ATTENTE_D_ARBITRAGE.size === 1,
   `2. une seule exception est tolérée, et elle est nommée — reçu ${EN_ATTENTE_D_ARBITRAGE.size}`);

for (const [fichier, portees] of [...invoquees].sort()) {
  const lib = LIBS[fichier];
  if (EN_ATTENTE_D_ARBITRAGE.has(fichier)) {
    // On vérifie quand même que l'exception est encore JUSTIFIÉE : le jour où le domaine est posé,
    // ce témoin rougit et force à retirer l'exception au lieu de la laisser dormir.
    ok(lib?.domain === undefined,
       `2. '${fichier}' déclare désormais un domaine (${JSON.stringify(lib?.domain)}) — RETIRER `
       + `l'exception d'arbitrage, elle n'a plus lieu d'être`);
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
