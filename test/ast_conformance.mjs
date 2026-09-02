// Garde d'ÉMISSION de la frontière bpscript-bpx (FRONTIÈRES-V2, modèle G1 :
// « l'autorité fournit le validateur, l'émetteur l'exécute »).
//
// POURQUOI. La parité prouve le COMPORTEMENT (dérivation ≡ oracle natif), pas la
// FORME : une émission hors AST_SPEC tolérée par l'absorption passe la parité verte
// (vu au Palier 3 : soundAssignments:null, Variable{name}, contextes bruts). Ce test
// mord AU BON BORD : il casse MON push si compileToBPxAST émet une forme hors-spec.
//
// AUTORITÉ. validateSceneAST est exporté par BPx (src/index.ts, commit 27ac59d) —
// zéro schéma dupliqué ici. Il vérifie champs requis + interdictions canoniques par
// forme (AST_SPEC §1.1/§1.2.1/§1.3) et laisse libres les clés opaques (payload…).
//
// CORPUS. Les grammaires actives de test/grammars (même résolution de source que les
// harnais S1) + les démos public/demos si présentes (dossier non versionné, hérité).
//
// USAGE. node test/ast_conformance.mjs [moduleValidateur]
//   Sans argument : importe la dist canonique BPx (dépôt frère ../BPx).
//   L'argument (dev seulement) pointe un module alternatif exportant validateSceneAST.
import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';
import { bpsPath, aBps } from './corpus.mjs';
import { importerArtefact } from './artefact_voisin.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
// La surcharge de développement seule garde un chemin explicite ; le défaut passe par la porte.
const VALIDATOR_MODULE = process.argv[2] ? pathToFileURL(path.resolve(process.argv[2])).href : null;

// ⛔ ET IL PASSE PAR LA PORTE UNIQUE, `artefact_voisin.mjs`. Il ne le faisait pas : il résolvait le chemin
// lui-même, donc il jetait un `ERR_MODULE_NOT_FOUND` brut là où les sept autres bancs nomment déjà
// le voisin. J'ai écrit cette porte le 2026-08-14 en tirant la leçon de ce rouge intermittent, et
// je ne suis pas allé vérifier qu'elle était le SEUL chemin — j'ai ensuite rapporté DEUX FOIS la
// même intermittence comme « non reproduite », faute d'un message qui la nomme.
//
// ⚠️ UNE PORTE QUI N'EST PAS L'UNIQUE ENTRÉE N'EST PAS UNE PORTE. Fermer l'espace, ce n'est pas
// écrire la porte : c'est vérifier qu'aucun mur n'est resté ouvert à côté.
let validateSceneAST;
try {
  ({ validateSceneAST } = process.argv[2]
    ? await import(VALIDATOR_MODULE)      // surcharge de développement, chemin explicite
    : await importerArtefact('BPx'));
} catch (e) {
  console.error(`[ast-conformance] ${String(e && e.message)}`);
  process.exit(1);
}
if (typeof validateSceneAST !== 'function') {
  console.error(`[ast-conformance] validateSceneAST introuvable dans ${VALIDATOR_MODULE}`
    + ' — dist BPx périmée ? (npm run build côté BPx)');
  process.exit(1);
}

// ── Corpus : grammaires actives + démos ────────────────────────────────────
const targets = [];
const skipped = [];
const grammars = JSON.parse(readFileSync(path.join(ROOT, 'test/grammars/grammars.json'), 'utf8'));
for (const [name, meta] of Object.entries(grammars)) {
  if (!meta || meta.status !== 'active') continue;
  const src = aBps(name) ? bpsPath(name) : undefined;
  if (!src) { skipped.push(name); continue; } // grammaire .gr seule : n'exerce pas l'émission .bps
  targets.push({ label: name, file: src, isDemo: false });
}
const demosDir = path.join(ROOT, 'public/demos');
if (existsSync(demosDir)) {
  for (const f of readdirSync(demosDir).filter((f) => f.endsWith('.bps')).sort()) {
    targets.push({ label: `demo:${f}`, file: path.join(demosDir, f), isDemo: true });
  }
}

// ── Validation ─────────────────────────────────────────────────────────────
// Portée = émission conforme AST_SPEC : on valide l'AST DÈS QU'IL EST ÉMIS. Une
// source qui NE compile PAS (erreurs claires, pas d'AST) n'a rien à valider — ce
// n'est pas une non-conformité d'émission. On distingue donc 3 issues :
//   • AST émis non conforme      → bad (frontière violée)
//   • AST null SANS erreur       → bad (« silence » = le vrai piège à traquer)
//   • AST null AVEC erreur(s)    → compile-error : bad, SAUF entrée nommée au registre ci-dessous.
//
// ⚠️ LA TOLÉRANCE EN BLOC A ÉTÉ SUPPRIMÉE le 2026-07-27, sur mesure. Une démo qui ne compilait pas
// passait, quelle que soit la raison — la ligne était seulement JOURNALISÉE. Mesuré par injection :
// une forme MORTE (`alias`, supprimée le jour même) ajoutée à une démo laissait le portillon VERT,
// avec sa cause écrite en toutes lettres dans la sortie. C'est la famille « verdir sans avoir
// examiné », fermée dans sept gardes le même jour — celui-ci était le huitième survivant, et il a
// survécu pour la raison habituelle : il n'était pas dans la portée du balayage.
//
// Et la porte n'abritait PERSONNE : zéro démo en erreur au moment du retrait. Une dérogation sans
// bénéficiaire n'est pas une tolérance, c'est un trou. Le registre la remplace — nommée, datée,
// motivée, avec un témoin qui exige qu'elle serve encore (§ après la boucle).
//
// ⚠️ ET LE REGISTRE NE COUVRAIT QUE LES DÉMOS — MESURÉ LE 2026-08-08. Une GRAMMAIRE active en
// erreur n'avait aucune porte, ce qui semble strict ; en réalité elle n'était jamais examinée,
// parce que le test d'entrée est `if (!r.ast)` : un arbre sortant AVEC des erreurs passait sans
// que rien ne les regarde. Deux scènes déclarées « actives » portaient un refus depuis le
// 2026-07-26 et ce garde était vert. C'est le quatrième garde du dépôt trouvé le même jour à
// mesurer « un arbre sort-il ? » en croyant mesurer « est-ce accepté ? ».
// Le registre couvre donc les DEUX familles, avec le même prix d'entrée : nommée, datée, motivée.
const ERREURS_ADMISES = [
  // ⚠️ CES DEUX-LÀ SONT DES TÉMOINS VOLONTAIRES, et leurs sources le disent en toutes lettres :
  // « CETTE SCÈNE NE COMPILE PLUS, VOLONTAIREMENT ». `script(…)` a été supprimé du langage (GO
  // Romain, 2026-07-26) ; elles gardent la forme morte pour qu'on voie ce qu'elle était. Leur
  // refus EST le comportement attendu — c'est leur silence qui serait le défaut. Elles restent
  // marquées « active » dans `grammars.json`, qui sert la parité avec le moteur d'origine et ne
  // se réconcilie pas avec ce garde : deux questions, deux fichiers.
  // ⚠️ UNE SCENE DE LA BIBLIOTHEQUE ATTEND UNE MIGRATION QUI N EST PAS A MOI (2026-08-08).
  // J en avais inscrit QUATRE ; trois compilaient deja quand le garde les a relues, et il l a dit
  // dans l heure : « une derogation sans beneficiaire est un trou, pas une tolerance ». Mon
  // balayage les avait comptees sur un motif texte, sans verifier par COMPILATION que la scene
  // refusait vraiment -- l instrument, encore, mesure avant le sujet.
  // Le crochet ne porte plus que ce qui gouverne la DERIVATION (arbitrage Romain) : il ne se colle
  // plus a un element, et il ne se pose plus dans le flux. Ces quatre-la ecrivent l ancienne forme.
  // La reecriture est un remplacement de crochets par des parentheses -- meme nom, meme valeur,
  // meme place -- et elle ENRICHIT l arbre : le crochet rendait une paire nue, la parenthese rend
  // un sac qui porte sa nature, sa portee et son confinement.
  // ⛔ QUI ATTEND : kanopi, prevenu A LA FRAPPE avec la liste exacte et la reecriture forme par
  // forme. Je n ecris pas dans son depot ; ces entrees sortent des qu il a migre, et le temoin
  // ci-dessous rougira si elles rancissent.
  { demo: 'trySrand', pourquoi: 'randomize NU dans le flux — forme retiree du langage, kanopi prevenu', date: '2026-08-08' },
  // ⛔ MA PROPRE DEMO, ET SA REECRITURE N EXISTE PAS ENCORE (2026-08-09). Ses cinq macros sont
  // TOUTES du cablage — deux branchements, deux poses de valeur sur un port, un declenchement.
  // Leur forme de remplacement est le corps  branchement  de `def`, au BACKLOG avec le patching.
  // ⚠️ J AI D ABORD ESSAYE DE L INSCRIRE ALORS QU ELLE COMPILAIT ENCORE, et ce garde a refuse :
  //  une derogation sans beneficiaire est un trou, pas une tolerance . Il avait raison — elle
  // n etait pas en erreur de COMPILATION mais en non-conformite de FORME, et ce registre-ci ne
  // couvre que la premiere. Elle y entre maintenant que `macro` refuse vraiment.
  // ⚠️ ET C EST LA LE VRAI ENSEIGNEMENT : tant que le parseur acceptait une directive declaree
  // morte, la scene compilait et produisait un champ mort. Une directive  retiree  qu on continue
  // d accepter n est pas retiree — elle est juste invisible.
  // Les quatre démos qui vivaient ici (trois de modulation, une de câblage) sont PARTIES le
  // 2026-08-09 : trois RÉÉCRITES avec le langage du jour, une SUPPRIMÉE faute de sujet.
  // ⚠️ Le motif qui les abritait disait « elles ne se réécrivent pas vers une forme que le
  // langage ne lit pas » — Romain l'a corrigé : « cv n'existe plus, pourquoi tu gèles, il faut
  // réécrire ». Une démo n'est pas une mesure à préserver, c'est un TEXTE : quand sa forme
  // meurt, elle se refait. Geler, c'était traiter un exemple comme une relique.
  { demo: 'alan-dice', pourquoi: 'témoin volontaire de script(…), supprimé du langage', date: '2026-07-26' },
  { demo: 'beatrix-dice', pourquoi: 'témoin volontaire de script(…), supprimé du langage', date: '2026-07-26' },
  // ⚠️ CES DEUX-LÀ NE SONT PAS DES TÉMOINS — ce sont des SCÈNES INCOMPLÈTES, et la distinction
  // compte : elles emploient des terminaux sans déclarer aucune convention de notes. Elles
  // appartiennent à kanopi et sont à réparer chez lui ; elles figurent ici pour être VUES, pas
  // pour être tolérées. Le jour où l'une passe au vert, le témoin ci-dessous exige qu'on l'enlève.
  // Elles étaient déjà rouges avant le chantier du jour — ce garde ne les regardait simplement pas.
  { demo: 'trySrand', pourquoi: 'scène incomplète (kanopi) : terminaux nus sans convention de notes déclarée', date: '2026-08-08' },
  { demo: 'tryCsoundObjects', pourquoi: 'scène incomplète (kanopi) : objets sonores nus sans convention de notes', date: '2026-08-08' },
  // ⛔ PLUS DE SOCLE IMPLICITE — Romain, 2026-09-02 : « si la scène n'invoque ni types ni core, alors
  // ça plante si flag n'est pas défini ». Ces trois scènes déclarent un drapeau ou un symbole sans
  // invoquer `core`, `types`, ni une librairie qui invoque `types`. La réécriture est une ligne en
  // tête : `core`. kanopi prévenu à la frappe avec la liste exacte ; ces entrées sortent dès qu'il a migré.
  { demo: 'koto2', pourquoi: 'déclare des drapeaux sans invoquer core ni types (kanopi) — aucun socle implicite', date: '2026-09-02' },
  // ⛔ controls.json SUPPRIME (Romain, 2026-08-10 : « on supprime controls.json et tous les
  // appels a cette librairie sont supprimes »). `core` amene desormais le meme ensemble
  // (`core.apporte`) qu'apportait le stub `controls` — la migration est mecanique, une ligne
  // qui devient l'autre. Les 45 fixtures de CE depot sont deja migrees ; celles-ci appartiennent
  // a kanopi et ecrivent `controls` SEUL, sans `core` a cote (193 autres scenes kanopi ecrivent
  // deja les deux, redondance cosmetique qui ne casse rien — hors de ce registre).
  // QUI ATTEND : kanopi, prevenu A LA FRAPPE avec la liste exacte et la reecriture (`controls` →
  // `core`, meme position). Je n'ecris pas dans son depot ; ces entrees sortent des qu'il a migre,
  // et le temoin plus bas rougira si elles rancissent.
];
let bad = 0;
const compileErrors = [];
const admises = new Set(ERREURS_ADMISES.map((e) => e.demo));
const admisesServies = new Set();
for (const { label, file, isDemo } of targets) {
  const r = compileToBPxAST(readFileSync(file, 'utf8'));
  // ⚠️ ON REGARDE LES ERREURS, PAS SEULEMENT L'ABSENCE D'ARBRE. `compileToBPxAST` rend les deux :
  // une source refusée peut sortir un arbre quand même, et ce test-ci la laissait alors passer
  // sans l'examiner (mesuré le 2026-08-08 sur deux grammaires actives).
  if (!r.ast || (r.errors && r.errors.length)) {
    if (r.errors && r.errors.length) {
      compileErrors.push(`${label} (${r.errors[0].message.split('.')[0]})`);
      const nomDemo = label.replace(/^demo:/, '');
      if (admises.has(nomDemo)) { admisesServies.add(nomDemo); continue; }
      bad++;
      console.error(`✗ ${label} : ${isDemo ? 'démo' : 'grammaire active'} ne compile plus — ${r.errors[0].message}`);
      if (isDemo) {
        console.error(`    Une démo qui ne compile pas n'est pas un détail : c'est du langage MORT `
          + `qu'un lecteur peut recopier. Corriger la source — ou, si le refus est voulu et `
          + `temporaire, l'inscrire dans ERREURS_ADMISES avec sa date et sa raison.`);
      }
      continue;
    }
    console.error(`✗ ${label} : compileToBPxAST sans AST NI erreur (silence — piège)`);
    bad++;
    continue;
  }
  const v = validateSceneAST(r.ast);
  if (!v.valid) {
    bad++;
    console.error(`✗ ${label} : ${v.issues.length} non-conformité(s) de forme`);
    for (const issue of v.issues) console.error(`    ${issue.path} — ${issue.message}`);
  }
}
const demosCount = targets.filter((t) => t.isDemo).length;
const activesCount = targets.length - demosCount;
// ⚠️ SOCLE — ce garde REFUSE de conclure sur zéro source active. Mesuré le 2026-07-27 (question de
// l'architecte : « ton garde peut-il rendre un verdict vert sans avoir rien examiné ? ») : pointé
// sur un corpus vide, il annonçait « 0 actives + 54 démos ; 61 sans .bps ignorée(s) » et sortait
// VERT. Il DISAIT pourtant son compte — mais dire zéro sans en tirer de conséquence, c'est encore
// l'absence de signal prise pour un bon signal. Annoncer ne suffit pas, il faut refuser.
if (activesCount === 0) {
  console.error(`[ast-conformance] AUCUNE source active examinée (${skipped.length} grammaire(s) sans .bps). `
    + `Le corpus appartient à la bibliothèque Kanopi — vérifier le clone ou KANOPI_LIBRARY. `
    + `Un verdict vert sur zéro source n'est pas un verdict.`);
  process.exit(1);
}
// ⚠️ LE REGISTRE NE RANCIT PAS — une dérogation qui ne sert plus doit PARTIR. Sans ce témoin, une
// entrée oubliée rouvre silencieusement la porte pour tout ce qui viendrait s'y ranger plus tard.
for (const e of ERREURS_ADMISES) {
  if (!admisesServies.has(e.demo)) {
    bad++;
    console.error(`✗ ERREURS_ADMISES : '${e.demo}' est inscrit comme toléré (${e.date}) mais compile `
      + `désormais — RETIRER l'entrée. Une dérogation sans bénéficiaire est un trou, pas une tolérance.`);
  }
}
if (compileErrors.length) {
  console.log(`[ast-conformance] ${compileErrors.length} source(s) en erreur de compilation : ${compileErrors.join(' ; ')}`);
}
console.log(`[ast-conformance] ${targets.length} sources (${targets.length - demosCount} actives + ${demosCount} démos`
  + (skipped.length ? ` ; ${skipped.length} sans .bps ignorée(s) : ${skipped.join(', ')}` : '') + ') — '
  + (bad ? `${bad} NON CONFORME(S)` : 'émission conforme AST_SPEC'));
process.exit(bad ? 1 : 0);
