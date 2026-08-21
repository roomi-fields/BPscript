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
 * ⛔ LE POINT NE FAIT PAS TOUJOURS UNE INVOCATION — depuis le 2026-08-16 il QUALIFIE AUSSI UN TYPE.
 * `in.midi sustain` n'invoque aucune librairie : c'est le type d'une entrée, et il voyage par
 * `ast.inputs`. Ce garde le lisait comme une adresse de catalogue, ne la trouvait pas dans le canal
 * neutre, et accusait la scène d'un silence qui n'existait pas — le pire faux positif, celui qui
 * ressemble au défaut qu'on chasse. Même motif que `factory.` deux paragraphes plus haut : un garde
 * qui ne connaît pas la nature de ce qu'il mesure accuse le producteur.
 *
 * ⚠️ SA VÉRIFICATION VIT AILLEURS, ET C'EST POURQUOI L'EXCLUSION NE CREUSE RIEN :
 * `declaration_d_entree.mjs` éprouve les trois canaux d'entrée et exige que chacun ARRIVE dans
 * `ast.inputs`, avec son rôle et sa table. Exclure ici, c'est renvoyer à qui mesure, pas taire.
 */
const TYPES_QUALIFIES_PAR_LE_POINT = new Set(['in', 'out']);

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
const RE_INVOCATION = /^([a-z_][a-z0-9_]*)\.([A-Za-z0-9_.-]+)/gm;
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
    if (TYPES_QUALIFIES_PAR_LE_POINT.has(axe)) continue;   // un TYPE, pas une invocation
    // ⚠️ `factory.` EST UN SUCRE NORMALISÉ AU NOM NU — contrat bpscript-bpx.md, et le parseur le
    // documente : « nom nu et `factory.` confondus AVANT émission ». Seul `mine.` reste préfixé,
    // parce que c'est LUI qui porte une information : la librairie personnelle de l'auteur, injectée
    // par l'hôte. `factory` est la provenance par DÉFAUT, donc implicite.
    // ⛔ CE GARDE L IGNORAIT et cherchait l'adresse préfixée : il déclarait « écrit et rien ne sort »
    // sur six scènes de kairos qui sortaient parfaitement, sous leur forme canonique. Un garde qui
    // ne connaît pas la normalisation de ce qu'il mesure accuse le producteur d'un silence qui
    // n'existe pas — et c'est le pire faux positif, parce qu'il ressemble au défaut qu'on chasse.
    const adresse = `${axe}.${m[2].replace(/:.*$/, '')}`;
    // ⛔ LA NORMALISATION DU PRÉFIXE DE PROVENANCE EST PARTIE AVEC LUI (2026-08-20). Elle retirait
    // `factory.` de l'adresse avant comparaison, parce que le parseur confondait le préfixé et le
    // nu avant émission. Le mot est sorti : une adresse écrite est désormais l'adresse émise, sans
    // transformation intermédiaire — et un garde qui garderait la normalisation d'une forme morte
    // la maintiendrait en vie mieux qu'un oubli.
    const canonique = adresse;
    if ((o.ast?.libRefs || []).includes(canonique)) { emises++; continue; }
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
// ⛔ SEUIL RECALIBRÉ DE 15 À 10 LE 2026-08-21, ET LA CAUSE EST MESURÉE — sans elle, le prochain
// lecteur verrait un seuil baissé et rien d'autre.
//
// Ce socle comptait les invocations du canal NEUTRE. Kanopi a réécrit 22 scènes qui invoquaient
// `test_alphabets.<entrée>` en `alphabet.<entrée>` (son `9cc575a`) — et `alphabet` est un AXE DE
// HAUTEUR, exclu du décompte quinze lignes plus haut parce qu'il voyage par un AUTRE PORTEUR.
//
//     avant   167 écrites · 130 hauteur · 22 alphabets comptés au canal NEUTRE À CAUSE DE LEUR
//             GRAPHIE de nom de fichier
//     après   167 écrites · 152 hauteur · 14 neutres · 14 émises · 0 perdue
//
// ⛔ LE SOCLE MESURAIT DONC UN ARTEFACT DE GRAPHIE. Le canal neutre ne perd rien : ces 22 n'y
// avaient jamais leur place, et la migration les remet dans le leur. Recalibrer n'est pas
// affaiblir — c'est compter ce que ce volet est censé compter.
//
// ⚠️ ET CE GESTE N'EST PAS À MOI SEUL. « Une assertion ajustée à ce qui sort » est un repli ; la
// différence tient à ce que la CAUSE a été établie AVANT le geste et vue par deux — mesure rendue
// à l'architecte, arbitrage rendu le même jour. Un seuil qu'on baisse parce que ça rougit, sans
// savoir pourquoi, reste interdit.
ok(emises > 10, `2. et il doit en ÉMETTRE — ${emises} adresse(s) sortie(s)`);

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
