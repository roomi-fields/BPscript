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
import { createRequire } from 'node:module';
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
  // ⛔ SON LIEN A CHANGÉ DE CIBLE LE 2026-09-04, ET MA FRONTIÈRE AVEC LUI AVEC. Son
  // `node_modules/bpscript` pointait vers MON ARBRE ; il pointe désormais vers `.publie/BPscript`, et
  // son manifeste écrit `file:../../../../bp/.publie/BPscript`. Ce n'est plus ma frappe qui
  // l'atteint, c'est ma PUBLICATION — un fichier que j'enregistre sans pousser n'est plus chez lui.
  // C'est la décision du 2026-08-24 (« un dépôt ne lit que le paquet publié ») arrivée jusqu'à lui.
  // ⚠️ CE GARDE L'A VU AVANT MOI, et c'est précisément ce pour quoi il déclare le régime au lieu de
  // le mesurer seulement : un changement de nature du risque qui ne casse RIEN passe autrement
  // inaperçu — il allège, il ne rougit pas.
  { depot: 'kanopi', mode: 'nomme', lienDirect: false, note: 'packages/ui/node_modules/bpscript pointe vers mon ESPACE PUBLIÉ : il consomme ce que je POUSSE',
    lit: ["l'arbre — deux natures seulement"],
    porte: ['les CINQ catalogues de hauteur, VERBATIM, jusqu\'à kairos — il ne les ouvre jamais'] },
  // ⚠️ SA LECTURE A CHANGÉ DE NATURE LE 2026-08-13, sur arbitrage de Romain, et c'est ce garde qui
  // l'a rendue visible : il déclarait « 8 fichiers de PRODUCTION » et mesurait zéro. La lecture
  // n'était pas perdue, elle avait MIGRÉ — ses quarante bancs lisaient mes librairies et mon
  // traducteur DANS MON ARBRE DE TRAVAIL, ils lisent désormais `git show HEAD:lib/*.json`.
  // ⛔ ET LA CONSÉQUENCE RENVERSE MA FRONTIÈRE AVEC LUI : ce n'est plus ma FRAPPE qui l'atteint,
  // c'est mon COMMIT — un fichier enregistré et non poussé est déjà chez lui. Le préavis se donne
  // donc AVANT de committer, pas avant de pousser. Vérifié sur pièce chez lui, pas sur parole.
  { depot: 'kairos', mode: 'nomme', lienDirect: false, note: 'lit mon DERNIER COMMIT (git show HEAD:) — plus mon arbre de travail',
    lit: ["l'arbre", 'lib/*.json au dernier commit — 8 fichiers, tous des BANCS depuis le 2026-08-13'] },
  { depot: 'BPx', mode: 'arbre', lienDirect: false, note: 'importe par chemin relatif',
    lit: ["l'arbre — le plus gros consommateur de natures de nœud"] },
  // ⚠️ SA SECONDE SURFACE A ÉTÉ AJOUTÉE LE 2026-08-09, APRÈS QU'IL A PAYÉ SON ABSENCE : neuf bancs
  // rouges d'un coup, découverts à son portillon sur un travail sans rapport — il a failli accuser
  // son propre changement. Il lit `lib/alphabets.json` depuis toujours ; mon entrée ne disait que
  // « l'arbre », donc mon préavis de reformatage est allé à kairos et kanopi, pas à lui.
  // ⛔ LA LISTE LE CONNAISSAIT. C'est la LIGNE « ce qu'il prend » qui était fausse — le second axe
  // que j'ai ajouté la veille précisément pour ça, et que j'avais rempli de mémoire au lieu de le
  // mesurer. Une liste juste sur les noms et fausse sur les surfaces envoie le préavis au bon
  // dépôt sur le mauvais sujet, ou pas du tout.
  { depot: 'bp3-frontend', mode: 'paquet', lienDirect: false, note: 'importe par chemin relatif',
    lit: ["l'arbre", 'lib/alphabets.json et lib/test_alphabets.json — miroir des alphabets, et'
        + " l'ORDRE des terminaux y porte le sens : il indexe les degrés de l'accordage"] },
  // ⛔ CORRIGÉ SUR LA MESURE DU PROPRIÉTAIRE, 2026-09-03. Ce motif disait « lit lib/ en direct », et
  // il rendait ZÉRO — runtime-MIDI ne porte NULLE PART la graphie d'un de mes fichiers. Il me l'a
  // écrit avec ses pièces : il n'a aucun lien vers moi (`node_modules/bpscript` : ENOENT), il
  // atteint mon PAQUET PUBLIÉ sous `.paquets/bpscript` et ouvre la PORTE que mon manifeste déclare
  // (`scripts/lib/voisins.mjs`, `porteDuPaquet()` lit `exports['./libs-data']`).
  // ⇒ *Un compte qui rend zéro se mesure lui-même* : c'était mon motif qui était faux, pas son
  //   usage qui avait disparu. Le garde a crié juste ; c'est sa description qui était périmée.
  { depot: 'runtime-MIDI', mode: 'nomme', lienDirect: false,
    note: 'ouvre la porte declaree par mon manifeste, sur le paquet publie',
    lit: ["la porte './libs-data' de mon manifeste, jamais un chemin de fichier"] },
  // ⚠️ UNE SECONDE INSTANCE DU MÊME VOISIN, ET ELLE NE SE DEVINE PAS. Un agent qui compile publie
  // DEUX dépôts — un de développement, un de PRODUCTION — et le second lit mes catalogues comme le
  // premier. Il est apparu sur le disque le 2026-08-12 ; c'est ce garde qui l'a vu, pas moi.
  // Ce qu'il lit, mesuré dans sa source et non supposé : un INSTANTANÉ de `lib/`, empreinté fichier
  // par fichier chez lui (`src/data/_bundle.js`). Une frappe chez moi ne l'atteint donc pas à la
  // seconde comme un lien vif — elle le laisse sur une copie qui DIVERGE en silence jusqu'à ce
  // qu'il la reprenne. C'est le cas le plus traître de la liste : rien ne casse, tout ment.
  { depot: 'runtime-MIDI-prod', mode: 'nomme', lienDirect: false,
    note: "instance de PRODUCTION de runtime-MIDI : lit un INSTANTANÉ de lib/, empreinté chez lui — "
        + 'une frappe chez moi ne le corrige pas, elle le périme',
    lit: ['un instantané de lib/ (catalogues bruts)'] },
  { depot: 'atlas', mode: 'arbre', lienDirect: false, note: "l'oracle du langage et les outils de doc compilent avec MON compilateur — une forme que je refuse casse sa mesure",
    lit: ['le compilateur lui-même'] },
  { depot: 'runtime-ui', mode: 'arbre', lienDirect: false, note: "vues de texte : lit l'arbre et ses annotations",
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

/**
 * ⛔ LE MODE DE LECTURE — POSÉ LE 2026-08-13 APRÈS AVOIR CASSÉ UN VOISIN EN SILENCE.
 *
 * J'ai converti quatre librairies de JSON vers BPScript. Avant de pousser j'ai cherché qui NOMMAIT
 * les quatre fichiers supprimés : personne. C'était vrai, et ça ne prouvait rien — bp3-frontend ne
 * les nommait pas, il les ÉNUMÉRAIT, et quarante-sept gestes natifs sont sortis de son contrôle de
 * conformité d'un coup.
 *
 * CHERCHER QUI CITE UN NOM NE TROUVE JAMAIS QUI BALAYE UN DOSSIER. Une sonde ne couvre pas la
 * forme d'accès qu'elle n'imagine pas, et « aucun consommateur ne nomme ce fichier » est une
 * réponse à une question que je ne m'étais pas posée.
 *
 * D'où ce troisième axe : le mode dit ce qui CASSE le voisin, et donc ce que je dois vérifier
 * avant de livrer.
 *   · `paquet`  — il charge `src/transpiler/libs-data.js`. INSENSIBLE au format de mes sources ;
 *                 sensible à un bundle non régénéré.
 *   · `nomme`   — il cite `lib/<x>.json` en clair. Une SUPPRESSION le casse ; un changement de
 *                 format aussi. C'est le seul mode qu'une recherche de nom trouve.
 *   · `enumere` — il balaye `lib/` et filtre par extension. Une BASCULE DE FORMAT le rend aveugle
 *                 SANS le casser : il continue, sur moins de données. Le plus dangereux des trois.
 *   · `arbre`   — il ne lit que l'AST, jamais mes librairies. Une bascule ne l'atteint pas.
 */
const GREP = existsSync('/usr/bin/grep') ? '/usr/bin/grep' : 'grep';
const MODES = new Set(['paquet', 'nomme', 'enumere', 'arbre']);
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
// ⛔ LES MOTIFS DISENT UN RÉGIME D'ACCÈS, PAS UNE GRAPHIE D'IMPORT — élargi le 2026-08-13.
// Ce garde ne connaissait que l'import PAR CHEMIN (`BPscript/lib`, `from 'bpscript`). Kairos a
// basculé ses quarante bancs sur `execFileSync('git', ['show', 'HEAD:lib/x.json'], {cwd:
// BPSCRIPT})`, où BPSCRIPT vaut `../../BPscript/` : mon chemin n'apparaît PLUS EN CLAIR, et le
// garde est passé de « le plus gros lecteur » à ZÉRO sans qu'une seule lecture disparaisse.
// Il a rougi — c'est ce qui a rendu la bascule visible — mais son message accusait le VOISIN
// (« ne lit plus rien, retire-le ») alors que la faute était à MES MOTIFS.
// ⚠️ ET LES DEUX RÉGIMES N'ONT PAS LA MÊME FRONTIÈRE, c'est tout l'enjeu de les séparer :
//   · PAR CHEMIN ou par LIEN → ma FRAPPE les atteint. Je préviens avant d'enregistrer.
//   · AU COMMIT (`git show HEAD:`) → mon COMMIT les atteint, poussé ou non. Je préviens AVANT DE
//     COMMITTER — un fichier enregistré est déjà chez eux, et `git push` n'y change rien.
// Les confondre ferait donner le bon préavis au mauvais moment.
const MOTIFS = [
  // ⛔ DEUX RÉGIMES, DEUX NOMS — ils étaient groupés sous « par chemin » et ce nom était FAUX pour la
  // moitié d'entre eux. Mesuré chez kanopi le 2026-08-26, ventilé graphie par graphie :
  //
  //     BPscript/lib        0        BPscript/src        0
  //     ../BPscript         1        from 'bpscript     12   ⇐ le SPÉCIFICATEUR, pas un chemin
  //
  // ⇒ Douze de ses fichiers étaient annoncés « par chemin » et **aucun n'atteint mon arbre par un
  // chemin de disque** : tous entrent par le spécificateur de paquet, donc par ce que mes `exports`
  // désignent. C'est la distinction que j'ai moi-même versée le 2026-08-25 — *`files` dit ce qui
  // VOYAGE, `exports` ce qu'on peut ADRESSER* — et mon propre affichage la perdait.
  //
  // ⚠️ ET CE N'EST PAS COSMÉTIQUE : le régime décide de QUELLE PORTE il faut prévenir. Un lecteur par
  // chemin est atteint par tout fichier que j'écris ; un lecteur par la porte n'est atteint que par
  // ce que je DÉCLARE. Les confondre fait donner le bon préavis pour la mauvaise raison — et fait
  // croire à un rayon d'impact qui n'existe pas.
  // ⛔ ET UN CHEMIN NE PORTE PAS TOUJOURS MON NOM. bp3-frontend lit `src/transpiler/libs-data.js`
  //   par une fonction d'autorité dont le DÉPÔT est une variable : mon nom n'apparaît chez lui que
  //   dans des commentaires, et le filtre anti-commentaire les écarte — à juste titre. Résultat
  //   mesuré le 2026-09-03 : ZÉRO, et ce garde concluait « il ne lit plus rien » sur le dépôt qui
  //   m'a justement écrit, la même soirée, qu'il me lit par chemin de disque.
  //   ⇒ *Un motif qui exige mon nom rate qui me lit par un chemin INTERNE.* Mes chemins à moi —
  //     `src/transpiler/`, `lib/` — sont donc cherchés aussi, avec la porte d'autorité qui les sert.
  { nom: 'par chemin', regex: "BPscript/lib\\|BPscript/src\\|BPscript/public\\|\\.\\./BPscript\\|src/transpiler/\\|lireAutorite" },
  { nom: 'par la porte', regex: "from 'bpscript\\|require('bpscript\\|from \"bpscript" },
  // ⛔ UN TROISIÈME RÉGIME, ET IL N'ÉTAIT COUVERT PAR AUCUN MOTIF — rendu par runtime-MIDI le
  // 2026-09-03, avec ses pièces. Il n'importe RIEN et ne porte aucun chemin de mes fichiers : il
  // atteint mon paquet publié sous `.paquets/bpscript` et OUVRE LA PORTE que mon manifeste déclare,
  // en lisant `exports['./libs-data']`. Les deux motifs ci-dessus rendaient donc ZÉRO chez lui, et
  // ce garde concluait « il ne lit plus rien, retire-le » — la conclusion exactement inverse.
  // ⇒ *Ce régime décide d'un préavis différent des deux autres* : il n'est atteint ni par ce que
  //   j'écris, ni par ce que j'importe — mais par ce que je DÉCLARE dans mon manifeste. Retirer une
  //   entrée d'`exports` le casse, et aucun fichier n'a besoin de bouger pour ça.
  // ⚠️ ET LE MOTIF SE RESSERRE SUR CE QUI ME NOMME : ma première écriture cherchait `exports['./`,
  //   qui apparie le manifeste de N'IMPORTE QUI — runtime-OSC est sorti « lecteur » sur sa propre
  //   configuration, alors qu'il m'a écrit n'avoir aucun site. Un motif qui ne me nomme pas compte
  //   des dépôts qui ne me lisent pas. *Suspecter l'instrument avant le sujet.*
  { nom: 'par le manifeste', regex: "\\.paquets/bpscript\\|AUTORITE_PORTE" },
  // ⚠️ SEUL `HEAD:` SIGNE LA LECTURE AU COMMIT. Ma première version rangeait `../BPscript` ici et
  // annonçait 94 lecteurs-au-commit chez BPx : une racine relative est un import PAR CHEMIN, pas
  // une lecture au commit. Un motif trop large ne rend pas le garde plus prudent, il lui fait
  // dire une chose fausse — et ici, donner le préavis au mauvais moment.
  // ⚠️ PAS DE BACKTICK DANS UN MOTIF : il traverse `bash -c` en substitution de commande et casse
  // la ligne. Trouvé en le mettant.
  { nom: 'au commit', regex: 'HEAD:lib/\\|HEAD:src/\\|HEAD:dist/' },
];

function lecteurs(depot) {
  const racine = path.join(ATELIER, depot);
  if (!existsSync(racine)) return null;
  return MOTIFS.reduce((t, m) => t + comptePour(racine, m.regex), 0);
}

/** Le détail par régime — ce qui dit QUAND prévenir, pas seulement QUI. */
function regimes(depot) {
  const racine = path.join(ATELIER, depot);
  if (!existsSync(racine)) return {};
  return Object.fromEntries(MOTIFS.map((m) => [m.nom, comptePour(racine, m.regex)]));
}

function comptePour(racine, motif) {
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
      + `| while read f; do grep -H ${JSON.stringify(motif)} "$f" 2>/dev/null `
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
  const r = regimes(c.depot);
  const detail = Object.entries(r).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ');
  console.log(`   ${c.depot.padEnd(14)} ${String(n).padStart(3)} fichier(s)`
    + `${detail ? `  (${detail})` : ''}${lien ? '  + LIEN DIRECT vers mon arbre de travail' : ''}`);
  ok(n > 0 || lien,
    `${c.depot} est déclaré consommateur mais ne lit plus rien — AVANT DE LE RETIRER, vérifier que `
    + 'ce ne sont pas MES MOTIFS qui sont périmés : un voisin qui change de régime d\'accès (import '
    + 'par chemin → lecture au commit) disparaît de ce compte sans perdre une seule lecture. '
    + 'C\'est arrivé le 2026-08-13 avec kairos, et le message accusait le voisin.');
  // ⚠️ CE QUI CHANGE LE MOMENT DU PRÉAVIS — un lecteur AU COMMIT est atteint par `git commit`,
  // pas par `git push`. Le dire ici, sinon la liste répond « qui » sans répondre « quand ».
  if ((r['au commit'] || 0) > 0) {
    console.log(`   ${' '.repeat(14)} ⚠️ ${c.depot} lit AU COMMIT — mon enregistrement l'atteint, `
      + 'poussé ou non : le préavis se donne AVANT de committer');
  }
  // ⛔ LE LIEN SE COMPARE DANS LES DEUX SENS, et c'est le second qui protège. Ce volet n'exigeait
  // que « déclaré lié ⇒ toujours lié » : un lien qui DISPARAÎT allège mon exposition, donc il ne
  // fait perdre personne. Un lien qui APPARAÎT la fait passer de ma publication à ma FRAPPE, sans
  // qu'aucun de mes gestes ne change — et c'était muet. Posé le 2026-09-04, le jour où kanopi a
  // bougé dans le sens inoffensif ; le sens dangereux ne s'est encore jamais produit, ce qui est
  // exactement la raison de l'écrire maintenant.
  ok(lien === Boolean(c.lienDirect),
    `${c.depot} : le régime de lien DÉCLARÉ (${c.lienDirect ? 'lié à mon arbre' : 'non lié'}) ne `
    + `correspond plus au régime MESURÉ (${lien ? 'lié à mon arbre' : 'non lié'}). `
    + (lien
      ? 'UN LIEN EST APPARU : mes fichiers NON COMMITÉS sont désormais chez lui, mon préavis se '
        + 'donne AVANT la frappe et plus avant la publication. Déclarer `lienDirect: true`, daté.'
      : 'LE LIEN A DISPARU : mes fichiers non commités cessent d\'être chez lui, il ne me lit plus '
        + 'qu\'à ma publication. Déclarer `lienDirect: false`, daté, avec la cible qu\'il vise.'));
}

// ── CHAQUE VOISIN DIT COMMENT IL LIT, ET CE MODE EST OPPOSABLE ───────────────
// ⚠️ SANS CET AXE, LA LISTE RÉPOND « QUI » ET « QUOI » SANS RÉPONDRE « CE QUI LE CASSE ».
{
  // ⛔ CE FILTRE ÉTAIT AVEUGLE À `.bpsl`, ET C'EST LE DÉFAUT QUE CE VOLET EXISTE POUR NOMMER. Il
  // testait `/\.(json|bps)$/` — la fin de chaîne exclut `.bpsl` — donc il ne comptait que les JSON
  // de racine. Le 2026-08-25, `core.json` a été converti, le dernier JSON de racine a disparu, et le
  // socle est tombé à ZÉRO format sur un dossier qui en porte vingt-deux. **Le huitième lecteur
  // trompé par l'extension d'une source de librairie, et cette fois c'est le garde qui l'énonce.**
  const formats = new Set(readdirSync(path.join(MOI, 'lib'))
    .filter((f) => /\.(json|bps|bpsl)$/.test(f)).map((f) => f.split('.').pop()));
  ok(formats.size >= 1,
    `MODE — SOCLE : le dossier lib/ doit porter au moins un format — ${formats.size} vu(s). Un zéro `
    + `ici mesure le FILTRE, jamais le dossier : c'est ainsi qu'il est tombé la première fois.`);

  for (const c of CONSOMMATEURS) {
    ok(MODES.has(c.mode),
      `${c.depot} ne déclare pas COMMENT il lit (${[...MODES].join(', ')}) — sans ce mot je ne `
      + 'sais pas ce qui le casse, et je vérifierai la mauvaise chose avant de livrer');

    // ⛔ LE VOLET QUI MORD, et celui qui manquait ce soir : une bascule de format rend AVEUGLE
    // celui qui énumère, sans le casser. Il continue sur moins de données, et son garde reste
    // vert. Tant que `lib/` porte DEUX formats, aucun consommateur ne peut énumérer sans risque.
    ok(!(c.mode === 'enumere' && formats.size > 1),
      `${c.depot} ÉNUMÈRE lib/ alors que le dossier porte ${formats.size} formats `
      + `(${[...formats].join(', ')}) : une bascule le rend aveugle SANS le casser — il continue `
      + 'sur moins de données et son portillon reste vert. Il doit lire le PAQUET, qui rend les '
      + 'deux graphies sous une seule forme.');
  }

  // ⛔ CE QU UN VOISIN NOMME DOIT EXISTER — et ce volet remplace une PROMESSE par une MESURE.
  // Kanopi m'a demandé « un mot AVANT de toucher à l'une de ces cinq », parce qu'il importe
  // `bpscript/lib/alphabets.json` et quatre autres EN DUR, statiquement. Sa construction tombe à
  // l'instant où l'un de ces fichiers change de format. Tenir cette promesse de mémoire, c'est
  // exactement ce que j'ai raté ce soir avec bp3-frontend.
  // ⚠️ ET SA DEMANDE A CORRIGÉ MA DÉCLARATION : je l'avais classé « lit le paquet ». Il NOMME.
  // Je décrivais son régime sans l'avoir mesuré, dans l'axe même que je venais d'ajouter pour
  // cesser de le faire.
  for (const c of CONSOMMATEURS) {
    if (c.mode !== 'nomme' || !presents.includes(c.depot)) continue;
    let cites = [];
    try {
      const sortie = execFileSync('bash', ['-c',
        // ⚠️ UNE MENTION N'EST PAS UN LIEN — Kairos, 2026-07-30, et je viens de le réapprendre.
        // Ma première version extrayait tout `lib/x.json` du dépôt : elle accusait TROIS voisins
        // de casser sur des fichiers supprimés depuis des semaines, cités dans des commentaires
        // ou des références mortes. Un rouge qui désigne un innocent est pire qu'un vert.
        // On ne garde donc que les LECTURES : un import, un require, une ouverture de fichier.
        // ⚠️ ET LE BALAYAGE PASSE PAR `find`, comme la fonction voisine : un `grep -r` sur la
        // racine d'un voisin rend VIDE en silence — son `node_modules` porte un lien vers MON
        // dépôt. Le zéro que j'ai lu une minute n'était pas une absence, c'était l'instrument.
        // ⚠️ ET UN SECOND ZÉRO VENAIT DU MÊME ENDROIT : j'avais écrit une classe pour dire « le
        // reste de la ligne ». En expression régulière étendue, la séquence d'échappement d'un
        // saut de ligne n'en est pas une dans une classe — elle y désigne le backslash et la
        // lettre N. Le motif refusait donc toute ligne contenant un « n », c'est-à-dire toutes.
        // Grep travaille par ligne : le point suffit, et la classe était du zèle.
        `find ${JSON.stringify(path.join(ATELIER, c.depot))} `
        + "\\( -name '*.ts' -o -name '*.js' -o -name '*.mjs' -o -name '*.svelte' \\) "
        // ⛔ ET ON EXCLUT LES DOSSIERS CACHÉS, parce qu'un voisin y range une COPIE DE MOI.
        // Kairos porte `.traducteur/` — un instantané vendu de mon transpileur, bundle compris.
        // Mes cinq  fichiers qu'il nomme et que je ne porte plus  y étaient TOUS : je lisais mon
        // propre code chez lui et je l'en accusais. Un garde qui trouve sa propre trace chez le
        // voisin mesure son reflet, pas le voisin.
        + "-not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.*/*' 2>/dev/null "
        + `| xargs ${GREP} -hE "(import|require|readFileSync|loadJson).*lib/[a-zA-Z_-]+\\.json" 2>/dev/null `
        + `| ${GREP} -vE "^\\s*(//|\\*)" | ${GREP} -oE "lib/[a-zA-Z_-]+\\.json" | sort -u`,
      ], { encoding: 'utf-8' });
      cites = [...new Set(sortie.split('\n').filter(Boolean).map((l) => l.trim()))];
    } catch { /* rien */ }
    const absents = cites.filter((f) => !existsSync(path.join(MOI, f)));
    ok(absents.length === 0,
      `${c.depot} NOMME ${absents.length} fichier(s) que je ne porte plus (${absents.join(', ')}) : `
      + 'sa construction tombe à l\'instant. Un voisin qui nomme se casse à la SUPPRESSION comme au '
      + 'changement de FORMAT — le prévenir de mémoire ne tient pas, c\'est ce garde qui le tient.');
    if (cites.length) {
      console.log(`   ${' '.repeat(14)} ${c.depot} nomme ${cites.length} fichier(s) : `
        + `${cites.map((f) => f.replace('lib/', '')).join(' ')}`);
    }
  }

  // ⚠️ ET LE PAQUET DOIT DIRE TOUTES MES LIBRAIRIES, quel que soit leur format — sinon la lecture
  // au paquet déplace le silence d'un cran au lieu de le fermer(témoin posé par bp3-frontend).
  const surDisque = readdirSync(path.join(MOI, 'lib'))
    .filter((f) => /\.(json|bps)$/.test(f)).map((f) => f.replace(/\.(json|bps)$/, ''));
  const _p = createRequire(import.meta.url)('../src/transpiler/libs-data.js');
  const paquet = _p.LIBS || _p.default || _p;
  const manquantes = surDisque.filter((n) => !(n in paquet));
  ok(manquantes.length === 0,
    `le PAQUET ne porte pas ${manquantes.length} librairie(s) présente(s) sur disque `
    + `(${manquantes.join(', ')}) : qui lit le paquet lirait une autorité amputée, sans un rouge`);
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
/**
 * ⚠️ UN ARBRE DE TRAVAIL N'EST PAS UN CONSOMMATEUR NEUF, et le confondre transforme ce garde en
 * corvée qui rougit à chaque lot. `BPx-lot61` a été signalé comme dépôt non déclaré le
 * 2026-08-13 : c'est une SECONDE COPIE DE TRAVAIL de BPx, sur la branche d'un lot. Inscrire son
 * nom aurait réparé l'endroit où le défaut s'est montré — et `BPx-lot62` aurait rougi le
 * lendemain.
 *
 * LE CRITÈRE EST MESURÉ, PAS DEVINÉ : `git rev-parse --git-common-dir` rend le dépôt PARTAGÉ. Pour
 * un arbre de travail il pointe dans le répertoire du dépôt principal ; pour un dépôt à part
 * entière il rend son propre `.git`. Un nom qui commence par celui d'un consommateur ne prouverait
 * rien — un vrai dépôt neuf pourrait s'appeler ainsi.
 */
function depotPartageAvec(depot) {
  const racine = path.join(ATELIER, depot);
  try {
    const commun = execFileSync('git', ['-C', racine, 'rev-parse', '--git-common-dir'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (!commun || commun === '.git') return null;      // dépôt à part entière
    const absolu = path.resolve(racine, commun);
    for (const c of CONSOMMATEURS) {
      if (absolu.startsWith(path.join(ATELIER, c.depot) + path.sep)) return c.depot;
    }
    return null;
  } catch { return null; }
}

const declares = new Set(CONSOMMATEURS.map((c) => c.depot));
const arbresDeTravail = [];
const nouveaux = presents
  .filter((d) => d !== path.basename(MOI) && !declares.has(d))
  .filter((d) => lecteurs(d) > 0 || lienVersMoi(d))
  .filter((d) => {
    const parent = depotPartageAvec(d);
    if (parent) { arbresDeTravail.push(`${d} → ${parent}`); return false; }
    return true;
  });
// Le garde DIT ce qu'il a écarté : un arbre de travail passé sous silence se lit comme « rien
// trouvé », et le jour où le critère se trompe personne ne le verra.
if (arbresDeTravail.length) {
  console.log(`[chez eux] arbre(s) de travail rattaché(s) à un consommateur déjà déclaré : `
    + `${arbresDeTravail.join(', ')}`);
}
// TÉMOIN D'INSTRUMENT — le critère doit savoir dire NON, sinon il écarterait tout.
ok(depotPartageAvec(path.basename(MOI)) === null,
   "l'écart des arbres de travail doit rendre `null` sur un dépôt à part entière — sinon il "
   + 'écarterait aussi un vrai consommateur neuf');
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
  // ⛔ LE PRÉFIXE `[régime]` EST UN CANAL, PAS UNE DÉCORATION. Le lanceur du portillon CAPTURE la
  // sortie d'un garde vert et ne la réimprime jamais — mesuré le 2026-08-30 : cette ligne sortait
  // quand le garde était lancé SEUL, et ZÉRO fois dans la sortie du portillon, sur trois passages.
  // ⇒ La décision du 2026-08-19 — un verdict porte le RÉGIME sous lequel il est pris — était
  // branchée chez moi et MUETTE là où le verdict compte. C'est « un garde hors du portillon est
  // invisible » pris par l'autre bout : il est DEDANS, et c'est sa SORTIE qui est jetée.
  // ⚠️ Trouvé par bp3-frontend chez lui, sur 419 verdicts sur 424, et relayé par l'architecte.
  // ⇒ `run_guards` réimprime les lignes portant ce préfixe, et REFUSE d'en voir zéro.
  console.log(`[régime] point d'entrée déclaré : ${pointDEntree || '(aucun)'} → régime `
    + `${versSource ? 'SOURCE (préavis à ma FRAPPE)' : 'PAQUET CONSTRUIT (préavis à ma PUBLICATION)'}`);

  /** Fichiers de l'atelier qui atteignent une graphie donnée de moi. */
  const compteAtelier = (motif) => {
    let n = 0;
    for (const d of presents) {
      if (d === path.basename(MOI)) continue;
      try {
        const s = execFileSync('bash', ['-c',
          `find ${JSON.stringify(path.join(ATELIER, d))} \\( -name '*.ts' -o -name '*.js' -o -name '*.mjs' -o -name '*.json' \\) `
          + "-not -path '*/node_modules/*' -not -path '*/.claude/worktrees/*' -not -path '*/dist/*' 2>/dev/null "
          + `| xargs grep -l ${JSON.stringify(motif)} 2>/dev/null | wc -l`,
        ], { encoding: 'utf-8' });
        n += parseInt(s.trim(), 10) || 0;
      } catch { /* rien */ }
    }
    return n;
  };

  // ⛔ LE RÉGIME NE SE LIT PAS SUR UN SEUL COMPTE, ET C'EST CE QUI A MORDU LE 2026-08-31. Ce volet
  // demandait `versSource || lecteursDeDist > 0` — deux états, alors qu'une BASCULE en produit un
  // troisième : je publie un artefact construit et **aucun voisin n'a encore changé de porte**. Il
  // a rougi en disant « l'un des deux est faux » ; les deux étaient vrais, et c'est l'état normal
  // du jour où l'on bascule.
  //
  // ⇒ **Mon régime est ce que JE publie ; leur exposition est ce qu'ILS lisent.** Deux faits, deux
  // comptes, et la transition est exactement l'intervalle où les deux sont non nuls. Un dépôt qui
  // n'aurait qu'un seul compte se croirait dans un régime pur alors qu'il doit prévenir des deux
  // côtés — c'est le faux négatif que ce garde existe pour refuser.
  const lecteursDeDist = compteAtelier('BPscript/dist\\|bpscript/dist');
  const lecteursDeSource = compteAtelier('BPscript/src\\|bpscript/src\\|BPscript/public\\|bpscript/public');
  console.log(`[régime] lisent un artefact CONSTRUIT : ${lecteursDeDist} · lisent encore ma SOURCE : ${lecteursDeSource}`);

  // ⛔ PERSONNE NE ME LIT DU TOUT = MES MOTIFS SONT MORTS, jamais « je n'ai plus de voisins ».
  ok(lecteursDeDist + lecteursDeSource > 0,
    'RÉGIME — aucun fichier de l\'atelier n\'atteint ni ma source ni mon artefact. Un dépôt aussi '
    + 'consommé que celui-ci ne perd pas tous ses lecteurs d\'un coup : suspecter les MOTIFS avant '
    + 'de conclure à l\'absence — c\'est arrivé le 2026-08-13 avec kairos.');

  if (!versSource && lecteursDeSource > 0) {
    console.log(`[régime] ⚠️ TRANSITION — je publie un artefact construit, ${lecteursDeSource} fichier(s) `
      + 'lisent encore ma source par chemin de disque. Les DEUX préavis sont dus : à ma FRAPPE pour '
      + 'eux, à ma PUBLICATION pour qui entre par la porte.');
  }

  // ⚠️ LE SECOND RÉGIME EST INSCRIT DEPUIS LE 2026-08-31 — préavis à la PUBLICATION, qui ne dépend
  // PAS de ce que je change : le voisin l'attend pour REPOSER SON POINT DE COMPARAISON, et un
  // changement inoffensif est précisément celui qui produit le faux négatif « rien n'a bougé » vs
  // « je n'ai pas regardé ». Ce qui reste à mesurer est la FIN de la transition, pas son début.
  ok(!versSource,
    'RÉGIME — le point d\'entrée est retombé sur ma source. La décision du 2026-08-31 exige qu\'aucune '
    + 'cible publiée ne pointe vers `src/` : ce qui est publié cesse d\'être ce qui s\'édite.');
}

// ── TÉMOIN ANTI-RÉTRÉCISSEMENT ───────────────────────────────────────────────
ok(CONSOMMATEURS.length >= 7, 'TÉMOIN — la liste ne s\'est pas vidée');
// ⛔ CE TÉMOIN EXIGEAIT UN FAIT QUE JE NE DÉCIDE PAS. Il demandait qu'au moins un consommateur me
// lise par LIEN — « c'est le cas où écrire = publier ». Le 2026-09-04, kanopi, le dernier, est passé
// à mon espace publié : le témoin serait devenu rouge sur un mouvement de MON VOISIN, sans qu'aucun
// geste de moi puisse le verdir. Un garde qu'on ne peut pas satisfaire se débranche, et c'est ainsi
// qu'on perd la mesure qu'il portait.
// ⇒ Ce qu'il protégeait vraiment n'est pas l'existence d'un lien, c'est que le RÉGIME de chacun soit
//   suivi. Cela se tient par la comparaison déclaré ⇄ mesuré, faite plus haut, dans les deux sens.
//   Ici on garde le seul fait qui dépende de moi : chaque consommateur DIT son régime de lien.
ok(CONSOMMATEURS.every((c) => typeof c.lienDirect === 'boolean'),
  'TÉMOIN — chaque consommateur déclare son régime de lien : sans déclaration, la comparaison '
  + 'déclaré ⇄ mesuré ne peut rien voir apparaître ni disparaître');

if (echecs.length) {
  console.error(`[surface partagée] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log('[surface partagée] ⚠️ ce garde tourne au PUSH, donc APRÈS l\'écriture — il réduit l\'oubli, il ne le supprime pas.');
console.log(`[surface partagée] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
