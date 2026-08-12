#!/usr/bin/env node
/**
 * GARDE — CE QUE J'ÉCRIS EST DÉJÀ CHEZ EUX.
 *
 * ⚠️ POURQUOI IL EXISTE, ET C'EST UNE RÈGLE QUE J'AI ÉCRITE PUIS RE-VIOLÉE DEUX FOIS EN DEUX JOURS.
 * Une modification d'une surface partagée est en production DÈS QU'ELLE ATTEINT CE QUE LE VOISIN
 * LIT ; le push ne la rend qu'IRRÉVERSIBLE. J'ai fait inscrire cette règle le 2026-07-29 après
 * avoir cassé trois bancs chez Kairos, je l'ai citée à trois agents dans la semaine — et le
 * 2026-07-30 j'ai écrit une ancre de hauteur puis demandé à Kanopi si sa scène risquait de se
 * mettre à sonner. Elle SONNAIT DÉJÀ : leur dépendance est un lien vers mon arbre de travail, et
 * leur portillon vert de l'heure précédente avait tourné avec mon fichier non commité.
 *
 * ⚠️⚠️ ET CE FICHIER A PORTÉ UNE PHRASE FAUSSE PENDANT UNE HEURE, héritée de mon CLAUDE.md :
 * « dans cet atelier les dépôts consomment la SOURCE les uns des autres, pas un paquet publié ».
 * LA FRONTIÈRE EST PAR USAGE, PAS PAR VOISIN — un même voisin relève souvent des deux régimes :
 * il importe ta SOURCE (ou l'ouvre comme du texte) et le moment critique est ta FRAPPE ; il exécute
 * ton PAQUET CONSTRUIT et le moment critique est ta PUBLICATION. Corrigé le 2026-07-30 après que
 * BPx a publié sans prévenir Kairos — sa formulation : il n'avait pas oublié une règle, il avait
 * chez lui une phrase qui lui disait que ce cas n'existait pas.
 * DONC CE GARDE MESURE MON RÉGIME au lieu de l'affirmer (§ RÉGIME plus bas) : une phrase qu'on
 * écrit est une clame, y compris dans l'en-tête du garde censé la faire tenir.
 *
 * CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS — je l'écris pour ne pas me raconter qu'il ferme le cas.
 *  · IL FAIT : mesurer QUI lit ce dépôt en direct, l'AFFICHER à chaque portillon, et ROUGIR si un
 *    consommateur apparaît ou disparaît. « Surface partagée » cesse d'être une abstraction : c'est
 *    une liste chiffrée qu'on relit à chaque passage.
 *  · IL NE FAIT PAS : agir au moment de l'écriture. Le portillon tourne au push, donc APRÈS. Ce
 *    garde réduit l'oubli, il ne le supprime pas — et prétendre l'inverse serait exactement la
 *    « clame » que Kairos a mesurée chez lui le même jour. Le mécanisme qui agirait au bon moment
 *    reste à trouver.
 */
import { readdirSync, existsSync, lstatSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const MOI = path.resolve(ICI, '..');
const ATELIER = path.resolve(MOI, '..');

/**
 * LES CONSOMMATEURS CONNUS, MESURÉS LE 2026-07-30. Le nombre de fichiers est un ORDRE DE GRANDEUR
 * qui bouge tous les jours : on garde l'EXISTENCE du lien, pas le compte exact — un garde qui
 * rougirait à chaque fichier ajouté chez un voisin serait débranché en une semaine.
 */
const CONSOMMATEURS = [
  { depot: 'kanopi', lienDirect: true, note: 'packages/ui/node_modules/bpscript est un LIEN vers mon arbre : il consomme mes fichiers NON COMMITÉS',
    lit: ["l'arbre — deux natures seulement"],
    porte: ['les CINQ catalogues de hauteur, VERBATIM, jusqu\'à kairos — il ne les ouvre jamais'] },
  { depot: 'kairos', lienDirect: false, note: 'importe par chemin relatif — le plus gros lecteur',
    lit: ["l'arbre", 'lib/alphabets.json — 8 fichiers de production, dont la résolution de hauteur'] },
  { depot: 'BPx', lienDirect: false, note: 'importe par chemin relatif',
    lit: ["l'arbre — le plus gros consommateur de natures de nœud"] },
  // ⚠️ SA SECONDE SURFACE A ÉTÉ AJOUTÉE LE 2026-08-09, APRÈS QU'IL A PAYÉ SON ABSENCE : neuf bancs
  // rouges d'un coup, découverts à son portillon sur un travail sans rapport — il a failli accuser
  // son propre changement. Il lit `lib/alphabets.json` depuis toujours ; mon entrée ne disait que
  // « l'arbre », donc mon préavis de reformatage est allé à kairos et kanopi, pas à lui.
  // ⛔ LA LISTE LE CONNAISSAIT. C'est la LIGNE « ce qu'il prend » qui était fausse — le second axe
  // que j'ai ajouté la veille précisément pour ça, et que j'avais rempli de mémoire au lieu de le
  // mesurer. Une liste juste sur les noms et fausse sur les surfaces envoie le préavis au bon
  // dépôt sur le mauvais sujet, ou pas du tout.
  { depot: 'bp3-frontend', lienDirect: false, note: 'importe par chemin relatif',
    lit: ["l'arbre", 'lib/alphabets.json et lib/test_alphabets.json — miroir des alphabets, et'
        + " l'ORDRE des terminaux y porte le sens : il indexe les degrés de l'accordage"] },
  { depot: 'runtime-MIDI', lienDirect: false, note: 'lit lib/ en direct via AUTORITE_LIB',
    lit: ['lib/ en direct'] },
  // ⚠️ UNE SECONDE INSTANCE DU MÊME VOISIN, ET ELLE NE SE DEVINE PAS. Un agent qui compile publie
  // DEUX dépôts — un de développement, un de PRODUCTION — et le second lit mes catalogues comme le
  // premier. Il est apparu sur le disque le 2026-08-12 ; c'est ce garde qui l'a vu, pas moi.
  // Ce qu'il lit, mesuré dans sa source et non supposé : un INSTANTANÉ de `lib/`, empreinté fichier
  // par fichier chez lui (`src/data/_bundle.js`). Une frappe chez moi ne l'atteint donc pas à la
  // seconde comme un lien vif — elle le laisse sur une copie qui DIVERGE en silence jusqu'à ce
  // qu'il la reprenne. C'est le cas le plus traître de la liste : rien ne casse, tout ment.
  { depot: 'runtime-MIDI-prod', lienDirect: false,
    note: "instance de PRODUCTION de runtime-MIDI : lit un INSTANTANÉ de lib/, empreinté chez lui — "
        + 'une frappe chez moi ne le corrige pas, elle le périme',
    lit: ['un instantané de lib/ (catalogues bruts)'] },
  { depot: 'atlas', lienDirect: false, note: "l'oracle du langage et les outils de doc compilent avec MON compilateur — une forme que je refuse casse sa mesure",
    lit: ['le compilateur lui-même'] },
  { depot: 'runtime-ui', lienDirect: false, note: "vues de texte : lit l'arbre et ses annotations",
    lit: ["l'arbre et ses annotations"] },
];

/**
 * ⛔ CE QU'UN VOISIN PORTE COMPTE AUTANT QUE CE QU'IL LIT — kanopi, 2026-08-08, et il l'a payé.
 *
 * J'ai reformaté les alphabets et prévenu KAIROS, qui les lit. Kanopi ne les lit pas : son passe-plat
 * prend mes cinq catalogues VERBATIM et les tend à Kairos sans jamais en ouvrir le contenu. Je l'ai
 * donc écarté de mes destinataires — et **26 de ses bancs sont passés au rouge**, avec un refus qui
 * venait de Kairos, sur une donnée que kanopi n'a jamais lue.
 *
 * ⚠️ LE TROU N'ÉTAIT PAS DANS LA LISTE — ce garde le connaissait, et le classait même comme le plus
 * exposé. Il était dans la QUESTION que je pose ensuite. J'avais demandé à chacun « que LISEZ-vous ? » ;
 * kanopi avait répondu « deux natures », et j'en avais conclu — logiquement, et faux — que le reste ne
 * l'atteignait pas. Sa phrase, que j'adopte :
 *
 *   « Un dépôt peut être cassé par une donnée qu'il ne LIT jamais mais qu'il TRANSPORTE. »
 *
 * D'où le second axe. `lit` sert à prévoir ce qui CASSE chez lui ; `porte` sert à prévoir ce qui casse
 * PLUS LOIN À TRAVERS lui — et le porteur doit être prévenu aussi, parce que c'est SON portillon qui
 * rougit, sans qu'il puisse ni absorber ni traduire : écrire l'adaptateur serait poser chez lui un pont
 * entre deux voisins.
 */
const AXES = ['lit', 'porte'];
// ⚠️ `runtime-audio` A ÉTÉ RETIRÉ LE 2026-07-30, ET SON RETRAIT EST UNE MESURE, PAS UN OUBLI :
// ses trois occurrences sont des COMMENTAIRES, dont un qui dit son intention en toutes lettres —
// « miroir, pour ne pas coupler les dépôts ». Il ne lit pas ma source, il en garde une COPIE.
// Ce n'est donc pas un consommateur au sens de ce garde, et l'y laisser rendait le compte faux.
// MAIS LA COPIE, ELLE, EXISTE : c'est la famille « un juge qui rejoue une copie ne voit pas la
// dérive qu'il garde », et leur commentaire cite un commit de mon dépôt — une clame sur l'amont.
// Signalé chez eux ; je n'écris pas dans leur dépôt.
//
// ⚠️ CES TROIS-LÀ ONT ÉTÉ TROUVÉS PAR CE GARDE À SON PREMIER PASSAGE, le 2026-07-30. Je croyais
// avoir CINQ consommateurs, il y en a HUIT, dont SEPT réels — et l'un des trois est `atlas`, dont l'oracle du
// langage COMPILE avec mon compilateur : une forme que je refuse casse sa mesure, et c'est
// l'outil que tout l'écosystème interroge pour savoir ce qui est valide. Je ne l'aurais pas
// prévenu. C'est la meilleure preuve que la liste ne devait pas rester dans ma tête.

let passe = 0;
const echecs = [];
const ok = (c, q) => { if (c) passe++; else echecs.push(q); };

/** Fichiers d'un dépôt qui référencent ce dépôt-ci. */
function lecteurs(depot) {
  const racine = path.join(ATELIER, depot);
  if (!existsSync(racine)) return null;
  try {
    // ⚠️ ON NE COMPTE QUE LES LIGNES DE CODE, PAS LES MENTIONS EN COMMENTAIRE. Sans le filtre,
    // ce garde annonçait un PLAFOND présenté comme un compte : Kairos a mesuré chez lui que sur
    // 51 fichiers trouvés par un motif naïf, UNE SEULE était du code — les cinquante autres
    // citaient ses chemins dans des commentaires, ce qui est la bonne pratique adoptée le 29.
    // « Une mention n'est pas un lien » (Kairos, 2026-07-30). Mon premier chiffre a été relayé à
    // Romain avant que je le dégonfle.
    const trouves = execFileSync('bash', ['-c',
      `find ${JSON.stringify(racine)} \\( -name '*.ts' -o -name '*.js' -o -name '*.mjs' \\) `
      + "-not -path '*/node_modules/*' -not -path '*/.claude/worktrees/*' -not -path '*/dist/*' 2>/dev/null "
      + "| while read f; do grep -H \"BPscript/lib\\|BPscript/src\\|from 'bpscript\\|require('bpscript\" \"$f\" 2>/dev/null "
      + "| grep -qv \"^[^:]*: *\\(//\\|\\*\\)\" && echo \"$f\"; done | wc -l",
    ], { encoding: 'utf-8' });
    return parseInt(trouves.trim(), 10) || 0;
  } catch { return 0; }
}

/** Le dépôt pointe-t-il vers mon arbre par un lien symbolique ? */
function lienVersMoi(depot) {
  const racine = path.join(ATELIER, depot);
  if (!existsSync(racine)) return false;
  try {
    const sortie = execFileSync('bash', ['-c',
      `find ${JSON.stringify(racine)} -maxdepth 8 -type l -not -path '*/.git/*' `
      + "-not -path '*/.claude/worktrees/*' 2>/dev/null | head -400",
    ], { encoding: 'utf-8' });
    for (const l of sortie.split('\n').filter(Boolean)) {
      try { if (realpathSync(l) === MOI) return true; } catch { /* lien mort */ }
    }
  } catch { /* rien */ }
  return false;
}

const presents = readdirSync(ATELIER, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(path.join(ATELIER, e.name, '.git')))
  .map((e) => e.name);

// ── SOCLE : un garde qui n'examine rien ne prouve rien ────────────────────────
ok(presents.length > 1, `SOCLE — l'atelier doit contenir plusieurs dépôts (vu : ${presents.length})`);
ok(existsSync(MOI), 'SOCLE — ce dépôt existe');

// ── CHAQUE CONSOMMATEUR DÉCLARÉ EN EST TOUJOURS UN ────────────────────────────
console.log('[surface partagée] ce que j\'écris part chez :');
for (const c of CONSOMMATEURS) {
  if (!presents.includes(c.depot)) {
    console.log(`   ${c.depot.padEnd(14)} ABSENT de cette machine — non mesurable ici`);
    continue;
  }
  const n = lecteurs(c.depot);
  const lien = lienVersMoi(c.depot);
  console.log(`   ${c.depot.padEnd(14)} ${String(n).padStart(3)} fichier(s)${lien ? '  + LIEN DIRECT vers mon arbre de travail' : ''}`);
  ok(n > 0 || lien,
    `${c.depot} est déclaré consommateur mais ne lit plus rien — si c'est vrai, le RETIRER de la liste `
    + '(une entrée sans réalité rend le garde décoratif)');
  if (c.lienDirect) {
    ok(lien,
      `${c.depot} portait un LIEN vers mon arbre et ne l'a plus — c'est un changement de la nature du `
      + 'risque, pas un détail : sans lien, mes fichiers non commités cessent d\'être chez lui');
  }
}

// ── CHAQUE VOISIN DIT CE QU'IL PREND, ET PAR QUEL AXE ────────────────────────
// ⚠️ Sans ce volet, la liste répond « qui me consomme » et pas « qui prévenir quand JE touche à
// CECI ». C'est la différence entre connaître ses voisins et savoir à qui écrire — et c'est
// exactement cette différence qui a coûté 26 bancs à kanopi.
{
  console.log('   ── ce que chacun prend ──');
  for (const c of CONSOMMATEURS) {
    const pris = AXES.flatMap((axe) => (c[axe] || []).map((q) => `${axe === 'porte' ? 'PORTE' : 'lit'} ${q}`));
    ok(pris.length > 0,
       `${c.depot} est déclaré consommateur sans dire CE QU'IL PREND. Une liste de noms répond `
     + `« qui me consomme » ; elle ne répond pas « qui prévenir quand je touche à ceci » — et c'est `
     + `la seconde question qui envoie le préavis au bon endroit.`);
    for (const p of pris) console.log(`   ${c.depot.padEnd(14)} ${p}`);
  }
  const porteurs = CONSOMMATEURS.filter((c) => (c.porte || []).length > 0);
  ok(porteurs.length >= 1,
     `TÉMOIN — plus aucun PORTEUR déclaré. L'axe « transporte » a été trouvé en le payant : s'il se `
   + `vide, le préavis retombe sur les seuls lecteurs et le trou de kanopi se rouvre.`);
}

// ── L'AUTRE SENS : un consommateur NOUVEAU doit se déclarer ───────────────────
const declares = new Set(CONSOMMATEURS.map((c) => c.depot));
const nouveaux = presents
  .filter((d) => d !== path.basename(MOI) && !declares.has(d))
  .filter((d) => lecteurs(d) > 0 || lienVersMoi(d));
ok(nouveaux.length === 0,
  `DÉPÔT(S) qui lisent ce dépôt sans être déclarés ici : ${nouveaux.join(' ')} — les inscrire, `
  + 'sinon la prochaine surface partagée sera modifiée sans que personne sache qui elle atteint');

// ── RÉGIME : SOURCE OU PAQUET CONSTRUIT ? MESURÉ, JAMAIS AFFIRMÉ ─────────────
// La frontière est PAR USAGE, pas par voisin. Ce bloc décide de quel côté je suis en lisant la
// donnée, parce que la phrase qui l'affirmait était fausse et vivait dans l'en-tête de ce fichier.
{
  const pkg = JSON.parse(
    execFileSync('cat', [path.join(MOI, 'package.json')], { encoding: 'utf-8' }),
  );
  const pointDEntree = pkg.main || (pkg.exports && JSON.stringify(pkg.exports)) || '';
  const versSource = /^(\.\/)?src\//.test(String(pointDEntree));
  console.log(`[surface partagée] point d'entrée déclaré : ${pointDEntree || '(aucun)'} → régime `
    + `${versSource ? 'SOURCE (préavis à ma FRAPPE)' : 'PAQUET CONSTRUIT (préavis à ma PUBLICATION)'}`);

  // Combien lisent un artefact CONSTRUIT de moi ? Aujourd'hui : personne — `dist/` est le build
  // WASM du 19/07, vestige de l'émission BP3 supprimée le même jour.
  let lecteursDeDist = 0;
  for (const d of presents) {
    if (d === path.basename(MOI)) continue;
    try {
      const n = execFileSync('bash', ['-c',
        `find ${JSON.stringify(path.join(ATELIER, d))} \\( -name '*.ts' -o -name '*.js' -o -name '*.mjs' -o -name '*.json' \\) `
        + "-not -path '*/node_modules/*' -not -path '*/.claude/worktrees/*' -not -path '*/dist/*' 2>/dev/null "
        + '| xargs grep -l "BPscript/dist\\|bpscript/dist" 2>/dev/null | wc -l',
      ], { encoding: 'utf-8' });
      lecteursDeDist += parseInt(n.trim(), 10) || 0;
    } catch { /* rien */ }
  }
  console.log(`[surface partagée] fichiers de l'atelier qui lisent un artefact CONSTRUIT de moi : ${lecteursDeDist}`);

  ok(versSource || lecteursDeDist > 0,
    'RÉGIME — mon point d\'entrée ne pointe plus vers ma source ET personne ne lit d\'artefact '
    + 'construit : l\'un des deux est faux, et ce garde ne sait plus quand prévenir');
  // ⚠️ LE CLIQUET. Le jour où quelqu'un exécute un artefact construit de moi, un SECOND régime
  // s'ajoute — préavis à la PUBLICATION, qui ne dépend PAS de ce que je change : le voisin l'attend
  // pour REPOSER SON POINT DE COMPARAISON, et un changement inoffensif est précisément celui qui
  // produit le faux négatif « rien n'a bougé » vs « je n'ai pas regardé ». Ce témoin le dira au
  // lieu de me laisser continuer à ne prévenir qu'à la frappe.
  ok(lecteursDeDist === 0,
    `${lecteursDeDist} fichier(s) lisent désormais un artefact CONSTRUIT de moi — le régime a CHANGÉ : `
    + 'il faut AUSSI prévenir à la PUBLICATION, même quand rien ne bouge. Inscrire le second régime ici.');
}

// ── TÉMOIN ANTI-RÉTRÉCISSEMENT ───────────────────────────────────────────────
ok(CONSOMMATEURS.length >= 7, 'TÉMOIN — la liste ne s\'est pas vidée');
ok(CONSOMMATEURS.some((c) => c.lienDirect),
  'TÉMOIN — au moins un consommateur par LIEN doit être suivi : c\'est le cas où écrire = publier');

if (echecs.length) {
  console.error(`[surface partagée] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log('[surface partagée] ⚠️ ce garde tourne au PUSH, donc APRÈS l\'écriture — il réduit l\'oubli, il ne le supprime pas.');
console.log(`[surface partagée] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
