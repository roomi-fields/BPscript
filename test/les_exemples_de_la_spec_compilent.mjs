#!/usr/bin/env node
/**
 * GARDE — mes DOCUMENTS enseignent-ils encore des formes vivantes ?
 *
 * ⚠️ LA FAUTE QU'ELLE FERME, payée SIX FOIS le 2026-07-27 sous six habits différents :
 * **on répare l'endroit où le défaut s'est MONTRÉ, pas l'espace où il peut vivre.**
 *   · une garde qui teste la forme du ticket, pas la construction — 5 fois ;
 *   · un balayage dont la portée laisse survivre ce qui est dehors ;
 *   · et pour finir : j'ai corrigé LA SECTION d'une spec, pas LE DOCUMENT. Une heure après avoir
 *     réécrit un bloc d'exemples, trois autres exemples de la même directive mentaient encore,
 *     plus bas dans le même fichier.
 *
 * ⚠️ ET LE GARDE LUI-MÊME L'A REPAYÉE, le lendemain — c'est la raison de sa version actuelle. Sa
 * portée était **trois fichiers de `docs/spec/`**, parce que c'est là que le mensonge s'était
 * montré. `docs/design/SCENES.md` enseignait la flèche morte DOUZE fois et `docs/reference/` une,
 * hors portée donc invisibles : ils n'auraient jamais rougi. Le garde balaye désormais **TOUT
 * `docs/`** — l'espace où une forme morte peut vivre, pas l'endroit où elle s'est montrée. La
 * leçon générale est inscrite dans CLAUDE.md : quand on ferme une famille, écrire la portée ET son
 * complément, sinon la campagne suivante retrouve les mêmes survivants.
 *
 * LA MÉCANISATION, plutôt que s'en souvenir : la doc **ne rougit jamais** — un exemple faux ne fait
 * rien du tout, il attend qu'un lecteur le recopie. Ce garde EXTRAIT les exemples de directive et
 * les **COMPILE**. Ce n'est plus une relecture, c'est une mesure : c'est la méthode qui a trouvé
 * tous les mensonges du 2026-07-27, alors que la relecture n'en avait trouvé aucun.
 *
 * CE QU'IL COUVRE — la moitié MESURABLE, et il faut le dire : les DIRECTIVES, qui sont compilables.
 * La prose qui les entoure ne l'est pas, et personne ne peut la mesurer automatiquement. Fermer la
 * moitié mesurable en le disant vaut mieux que laisser croire le document garanti.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const ICI = path.dirname(new URL(import.meta.url).pathname);
const DOCS = path.join(ICI, '..', 'docs');

/**
 * LA PORTÉE, ET SON COMPLÉMENT ÉCRIT — pas un tri de convenance.
 * Balayé : tout `docs/`, récursivement. Écarté, avec sa raison, et une seule :
 *   · `decisions-en-attente/archive/` — un ARCHIVE est un compte rendu daté de ce qui a été
 *     pensé à un moment. Le réécrire falsifierait l'histoire ; une forme morte y est à sa place,
 *     c'est même ce qu'on y cherche. La règle est « ne pas réécrire un compte rendu », pas
 *     « exclure ce qui gêne » — d'où le témoin §4 qui vérifie que l'écart reste étroit.
 */
const ARCHIVES = /(^|\/)(archive|archives)(\/|$)/;
const listerDocs = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) { if (!ARCHIVES.test(p)) listerDocs(p, out); }
    else if (e.endsWith('.md')) out.push(p);
  }
  return out;
};
const TOUS = listerDocs(DOCS);
const relatif = (p) => path.relative(DOCS, p);
// Les exemples COMPILÉS restent ciblés sur les specs : ailleurs, une directive apparaît souvent
// dans une phrase de prose et non comme une ligne à compiler. Le §3 (formes mortes), lui, balaye
// TOUT — c'est lui qui a laissé passer les douze.
const SPECS = ['LANGUAGE.md', 'EBNF.md', 'AST.md'].map((f) => path.join(DOCS, 'spec', f));

// ─── 1. SOCLE — refuser de conclure sur du vide ──────────────────────────────────────────────
const manquants = SPECS.filter((p) => !existsSync(p)).map((p) => path.basename(p));
ok(manquants.length === 0, `1. spec(s) introuvable(s) : ${manquants.join(', ')} — rien à mesurer`);
ok(TOUS.length >= 25,
   `1. le balayage doit voir TOUT docs/ — ${TOUS.length} document(s) trouvé(s). Un compte qui `
   + `s'effondre ne veut pas dire que la doc a maigri : il veut dire que le garde ne la lit plus.`);

// ─── 2. CHAQUE DIRECTIVE ÉCRITE EN EXEMPLE DOIT COMPILER — SAUF LE RATTRAPAGE ATTENDU ─────────
// Les directives dont la FORME a bougé sont celles qui mentent le plus vite. On les prend toutes,
// pas celles du dernier chantier : c'est précisément l'erreur que ce garde existe pour fermer.
//
// ⚠️ CE GARDE A CHANGÉ DE NATURE le 2026-08-04. Jusqu'au 2026-08-03 un exemple refusé était
// TOUJOURS un défaut : la spec décrivait ce que le parser savait déjà lire, donc tout refus était
// une forme morte oubliée dans la doc. Romain a arrêté la référence le 2026-08-03 (BPscript/
// CLAUDE.md) : LANGUAGE.md est désormais délibérément EN AVANCE sur le parser — `def`, `init`, le
// langage de patch, les modules, les blocs de terminaux y sont écrits avant d'être lus. Exiger que
// TOUT compile mesurerait alors le chantier voulu, pas un défaut, et resterait rouge pour toujours
// — le même piège qu'un oracle qui juge « faux » une forme simplement pas encore lue (faux négatif).
//
// Donc ce garde est un CLIQUET, pas un interrupteur : BASELINE_RATTRAPAGE fige, datée et motivée,
// la liste EXACTE des exemples que le parser refuse aujourd'hui pour la même cause connue. La
// mesure doit tomber PILE sur cette liste :
//   · une forme refusée EN PLUS (absente de la référence, ou refusée pour une AUTRE cause que celle
//     enregistrée) → régression non inventoriée, le garde MORD (règle #4 : ne pas perdre ce que le
//     garde attrapait déjà) ;
//   · une forme de la référence qui NE refuse PLUS (rattrapée par le parser, ou disparue de la
//     doc) → la référence n'a pas suivi le rattrapage, le garde MORD aussi — sinon le cliquet ne
//     cliquette pas, il grossit et personne ne le resserre.
// Faire descendre le compte est un geste EXPLICITE : retirer la ligne de BASELINE_RATTRAPAGE à la
// main, daté. L'élargir l'est tout autant : y ajouter une ligne, avec sa cause. Rien ne bouge tout
// seul.
const DIRECTIVES = ['macro', 'alias', 'in', 'var', 'label', 'expose', 'meter', 'duration'];
const RE = new RegExp(`^(@(?:${DIRECTIVES.join('|')})\\s[^\\n]*)$`, 'gm');
// Un refus de RÉSOLUTION (l'entrée n'existe pas dans une librairie, le nom ne désigne rien) n'est
// PAS une faute de forme : un exemple de doc nomme des choses qui ne vivent pas dans la scène
// minimale qu'on lui fabrique. On ne garde que ce qui est refusé pour sa FORME.
const REFUS_DE_RESOLUTION = /ne désigne rien|n'existe pas|introuvable|non déclaré|jamais posé/;

// RÉFÉRENCE — resserrée le 2026-08-05 (dev, palier « `@var` porte son type jusqu'à l'arbre »).
// `Scene.vars` porte désormais la directive ENTIÈRE (`VarDirective`, `AST.md:119-150`) et le
// parser sait lire les six familles de `var_type` (`EBNF.md:47-57`) : flag, les quatre conventions
// (signal/pitch/phase/logic) et un IDENT nu résolu contre le catalogue `lib/mod.json`. Sept des
// neuf formes AUTREFOIS refusées faute de flèche COMPILENT désormais et SORTENT du cliquet :
// `@var section flag: …`, `grain signal`, `hauteur pitch`, `rotation phase`, `porte logic`,
// `ramp1 ramp` (module `ramp` au catalogue), `env1 adsr` (module `adsr` au catalogue).
//
// CE QUI RESTE, ET POUR UNE AUTRE RAISON : `lpf`/`saw`/`vca` sont des devices RÉELS que la
// référence emploie en exemple, mais `lib/mod.json` ne porte que `adsr`/`lfo`/`ramp` — un trou de
// DONNÉE connu et assumé (traité dans un lot séparé), pas une faute de forme. La cause n'est donc
// plus « il manque la flèche » mais « le module est absent du catalogue » — le message du parser
// le dit explicitement (`@var lpf1 lpf : 'lpf' est absent du catalogue de modules…`).
const CAUSE_MODULE_ABSENT_DU_CATALOGUE = /est absent du catalogue de modules/;
const BASELINE_RATTRAPAGE = new Map([
  ['@var lpf1 lpf', CAUSE_MODULE_ABSENT_DU_CATALOGUE],
  ['@var saw1 saw', CAUSE_MODULE_ABSENT_DU_CATALOGUE],
  ['@var lpf2 lpf', CAUSE_MODULE_ABSENT_DU_CATALOGUE],
  ['@var vca1 vca', CAUSE_MODULE_ABSENT_DU_CATALOGUE],
]);

let exemples = 0;
const vusEnEchecConnu = new Set(); // lignes de la référence retrouvées en échec CETTE passe
for (const p of SPECS) {
  if (!existsSync(p)) continue;
  const nom = path.basename(p);
  for (const m of readFileSync(p, 'utf8').matchAll(RE)) {
    const ligne = m[1].replace(/\s*\/\/.*/, '').trim();
    exemples++;
    let r;
    try { r = compileToBPxAST(`@core\n@controls\n@alphabet.western:midi\n${ligne}\n@mode:ord\nS -> C4\n`); }
    catch (e) { r = { errors: [{ message: e.message }] }; }
    const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
    const echoue = msg !== '' && !REFUS_DE_RESOLUTION.test(msg);
    if (!echoue) continue; // compile, ou refus de résolution (hors sujet de forme) : rien à dire
    const causeAttendue = BASELINE_RATTRAPAGE.get(ligne);
    if (causeAttendue && causeAttendue.test(msg)) {
      vusEnEchecConnu.add(ligne); // rattrapage attendu, retrouvé identique : le cliquet le sait déjà
      continue; // pas un échec DE CE GARDE — inventorié dans BASELINE_RATTRAPAGE
    }
    ok(false,
       `2. ${nom} enseigne une forme que le compilateur REFUSE, HORS RÉFÉRENCE : '${ligne.slice(0, 60)}' → `
       + `${msg.slice(0, 110)}. Si c'est un rattrapage attendu du chantier def/init/patch, AJOUTE-la `
       + `à BASELINE_RATTRAPAGE avec sa cause au lieu de la laisser rougir en silence ; sinon c'est `
       + `une forme morte, comme avant ce chantier.`);
  }
}

ok(exemples >= 8,
   `2. il faut des exemples à mesurer — ${exemples} trouvé(s). Si ce compte s'effondre, ce n'est `
   + `pas que la doc est devenue parfaite : c'est que le garde ne la lit plus.`);

// ─── 2ter. LES EXEMPLES DE RÈGLE — la portée qui manquait ────────────────────────────────────
// ⚠️ CE VOLET EST UNE RÉPARATION DE PORTÉE, ET ELLE A ÉTÉ MESURÉE, PAS DEVINÉE (2026-08-06).
// Jusqu'ici ce garde n'extrayait que les lignes de DIRECTIVE (`@macro`, `@var`…). Les exemples de
// RÈGLE — la matière même du langage — n'ont JAMAIS été mesurés. Conséquence directe : les trois
// exemples de la section « La vitesse » de la bible sont refusés par le parser depuis qu'elle a
// été réécrite, et rien ne l'a jamais dit. Le garde était vert et ne prouvait pas ce qu'on croyait
// qu'il prouvait : « la portée d'un garde se choisit sur l'ESPACE, jamais sur le fichier où ça
// s'est vu ».
//
// LE RÉGIME EST CELUI DE LA BIBLE (CLAUDE.md, Romain 2026-08-06) : `LANGUAGE.md` est
// délibérément EN AVANCE sur le parser. Une règle qu'elle écrit et que le parser refuse dit que le
// COMPILATEUR EST EN RETARD — une dette de rattrapage, pas une faute. Ce volet la CHIFFRE et
// l'empêche de grandir en silence ; il ne la traite pas.
const RE_REGLE = /^[A-Za-z_][\w']*\s*(?:->|<>|<-)\s/;
// Retard mesuré le 2026-08-06 : 16 règles sur 123, en QUATRE familles. Chaque ligne sort de cette
// liste le jour où le parser la rattrape — à la main, datée, comme le cliquet du dessus.
const RETARD_REGLES = new Map([
  // (a) la DURÉE COLLÉE décimale — RATTRAPÉE le 2026-08-06, les cinq lignes sont SORTIES d'ici.
  //     Romain : « ces exemples doivent fonctionner, ils sont légitimes ». `0.5` produit
  //     désormais le MÊME arbre que `1/2` — même durée, deux écritures. C'est le cliquet qui a
  //     exigé ce resserrement en rougissant, pas ma mémoire.
  // (b) LE SAC COLLÉ à un groupe ou à un terminal, avec le COMPOSANT d'une instance.
  //     ⚠️ CAUSE RÉVISÉE le 2026-08-06 : la FORME est désormais reconnue — `(env1.attack:400)`
  //     compile et rend `{key:'env1', component:'attack', value:400}`, exactement ce que
  //     `AST.md` §Setting déclare. Ce qui reste tient à DEUX choses étrangères à la forme :
  //     l'instance `lpf1` n'est pas déclarée dans l'enveloppe que ce garde fabrique autour d'une
  //     ligne isolée, et le module `lpf` est absent de `lib/mod.json` (trou de donnée connu, déjà
  //     inventorié au cliquet du dessus). Le compte ne bouge donc pas, mais il ne dit plus la
  //     même chose : sans cette note, un lecteur croirait la forme toujours refusée.
  //     ⚠️ CAUSE RÉVISÉE UNE SECONDE FOIS le 2026-08-07 (chantier « le sac se lit pareil partout »).
  //     Le sac COLLÉ À UN GROUPE lit désormais le port d'une instance — ces trois lignes ne butent
  //     plus sur la FORME. Ce qui reste est la donnée : `lpf1`/`lpf2` ne sont déclarées nulle part
  //     dans le bloc de la bible que ce garde sait reprendre, parce que le `@var lpf1 lpf` qui les
  //     précède ne compile pas seul (module `lpf` absent de `lib/mod.json`, trou déjà inventorié au
  //     cliquet du dessus). Le refus est maintenant NOMMÉ — il dit l'instance manquante au lieu de
  //     désigner un deux-points. Le compte ne bouge pas, la cause si : sans cette note, un lecteur
  //     croirait la forme toujours refusée.
  ['S -> {A B C}(lpf1.cutoff:4000)', /n'est ni un contrôle à composants, ni une instance déclarée/],
  ['S -> C4(lpf1.cutoff:400)', /Expected argument value/],
  ['S -> { C4 D4 }(lpf2.cutoff:800)', /n'est ni un contrôle à composants, ni une instance déclarée/],
  ['S -> { C4(lpf1.cutoff:400) D4 }(lpf2.cutoff:800)', /Expected argument value/],
  ['S -> { C4 D4 }(sombre) E4 coupe F4', /Expected arrow/],
  ['S -> {C4 D4}(sombre) E4(lpf1.cutoff:400)', /Expected arrow/],
  ['S -> {A B}(lpf1.cutoff:4000)', /n'est ni un contrôle à composants, ni une instance déclarée/],
  // (c) la VITESSE : RATTRAPÉE le 2026-08-06 — `! (/N)` compile, les trois lignes sont sorties
  //     de ce retard le jour même. C'est le cliquet qui l'a EXIGÉ, pas moi qui y ai pensé.
  // (d') L'EXEMPLE DES PARAMÈTRES D'INVOCATION — et il est plus abîmé qu'il n'en a l'air.
  //     Son sujet est « chaque invocation porte ses paramètres » (LANGUAGE.md:1719, et :1732 :
  //     « ils gouvernent l'expansion du gabarit »). `AST.md:573` leur donne un champ à eux,
  //     `TemplateMaster.args`.
  //     ⚠️ MESURÉ LE 2026-08-06 : cet exemple n'a JAMAIS produit de paramètre. Un nom déclaré au
  //     vocabulaire des contrôles est routé vers le SAC DE RÉGLAGES, pas vers `args` — c'était
  //     le cas de `tempx` avant son retrait, et c'est le cas de tout remplaçant pris dans ce
  //     vocabulaire. La ligne illustrait donc autre chose que ce qu'elle annonce, en silence.
  //     ⚠️ ET CE N'EST PAS QU'UN DÉFAUT DE DOC : sur tout l'écosystème, UNE SEULE scène écrit une
  //     invocation avec parenthèse (`ek-do-tin`), et son arbre ne porte AUCUN paramètre non plus.
  //     `TemplateMaster.args` est déclaré par la spec et produit par RIEN.
  //     La réparation demande de savoir quel vocabulaire prennent ces paramètres — la bible est
  //     MUETTE là-dessus. Question pour Romain ; je ne comble pas un silence par une mesure.
  ['S <> $mel(tempx:1) &mel(tempx:2/3)', /arguments d'un gabarit/],
  // (d) une clé que le parser tient encore pour un contrôle de crochet
  ['S -> C4 (rndtime:100) D4 E4', /s'écrit entre CROCHETS/],
]);

let regles = 0;
const retardRetrouve = new Set();
for (const p of SPECS) {
  if (!existsSync(p)) continue;
  const nom = path.basename(p);
  // ⚠️ UNE RÈGLE SE LIT AVEC LE CONTEXTE DE SON BLOC, pas nue. Mesuré le 2026-08-06 : sept
  // exemples tombaient sur « attribut inconnu » parce que le `@var lpf1 lpf` qui les précède DANS
  // LE MÊME BLOC était jeté par ce garde. La forme était juste ; l'instrument la mesurait sans
  // son contexte, alors qu'un lecteur de la doc voit les deux lignes ensemble.
  // On ne prend QUE les déclarations du bloc COURANT : rien de fabriqué, rien d'emprunté à un
  // autre exemple. Un contexte inventé masquerait de vrais refus.
  let dans = false, contexte = [];
  for (const brut of readFileSync(p, 'utf8').split('\n')) {
    if (/^```/.test(brut)) { dans = !dans; contexte = []; continue; }
    if (!dans) continue;
    const ligne = brut.replace(/\s*\/\/.*$/, '').trim();
    // ⚠️ UN CONTEXTE NE DOIT QUE SERVIR, JAMAIS EMPOISONNER. Première version : toute ligne
    // déclarative du bloc était reprise — et un `@def` (forme que le parser ne lit pas encore)
    // faisait alors ÉCHOUER quatre règles qui passaient auparavant. Une déclaration qui ne
    // compile pas seule n'est pas un contexte utilisable : on ne garde que celles qui tiennent
    // debout d'elles-mêmes.
    if (/^@(var|actor|def|alphabet|tuning|octaves)\b/.test(ligne)) {
      let seule = false;
      try { seule = (compileToBPxAST(`@core\n@controls\n${ligne}\nS -> C4\n`).errors || []).length === 0; }
      catch { seule = false; }
      if (seule) contexte.push(ligne);
      continue;
    }
    if (!RE_REGLE.test(ligne)) continue;
    regles++;
    let r;
    try { r = compileToBPxAST(`@core\n@controls\n${contexte.join('\n')}\n${ligne}\n`); }
    catch (e) { r = { errors: [{ message: e.message }] }; }
    const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
    if (msg === '' || REFUS_DE_RESOLUTION.test(msg)) continue;
    const cause = RETARD_REGLES.get(ligne);
    if (cause && cause.test(msg)) { retardRetrouve.add(ligne); continue; }
    ok(false,
       `2ter. ${nom} écrit une règle que le compilateur REFUSE, HORS RETARD INVENTORIÉ : `
       + `'${ligne.slice(0, 60)}' → ${msg.replace(/\s+/g, ' ').slice(0, 110)}. La bible fait foi : `
       + `soit le parser la rattrape, soit la ligne entre dans RETARD_REGLES avec sa cause.`);
  }
}
// SOCLE — un extracteur cassé rendrait zéro règle et passerait au vert en ne mesurant rien.
// C'est exactement ce qui est arrivé au brouillon de ce volet : une bascule de bloc fautive
// rendait 8 règles au lieu de 123, et « 0 refus » avait l'air d'une bonne nouvelle.
ok(regles >= 100,
   `2ter. SOCLE : ${regles} règle(s) extraite(s) des specs — l'extracteur ne lit plus les blocs.`);
// CLIQUET — le retard ne descend jamais tout seul.
for (const [ligne] of RETARD_REGLES) {
  ok(retardRetrouve.has(ligne),
     `2ter-cliquet. '${ligne.slice(0, 50)}' est inscrite au retard mais NE REFUSE PLUS avec sa `
     + `cause (rattrapée, refusée autrement, ou disparue de la bible) — RETIRE-la : un retard qui `
     + `ne se resserre jamais n'est qu'un compteur.`);
}

// ─── 2quater. LE BLOC ENTIER, ET C'EST LA BIBLE QUI DIT LESQUELS ─────────────────────────────
// ⚠️ CE VOLET RÉPARE LA PORTÉE DES DEUX D'AU-DESSUS, ET LE CHIFFRE LE DIT (mesuré le 2026-08-07).
// §2 mesure les lignes de DIRECTIVE, §2ter les lignes de RÈGLE — 146 lignes en tout. Mesuré : les
// mêmes blocs en contiennent 156 que NI l'un NI l'autre ne regarde, parce qu'elles n'ont ni la
// forme `@mot ` d'une des huit directives listées, ni la forme `Nom ->` d'une règle simple. En
// sont dehors : `@def`, `@actor`, `@alphabet`, `@init`, `@module`, et toute règle dont la TÊTE est
// un MOTIF (contexte `(C4) D4 ->`, joker `?1 D4 ->`, ancre `#C4 D4 ->`, garde `[stage==1] S ->`).
// Répondre « il ne reste rien » sur ces deux volets aurait été un compte juste sur une moitié.
//
// ⚠️ ET SURTOUT : LIGNE PAR LIGNE EST LA MAUVAISE UNITÉ. Une ligne de la bible se lit dans son
// bloc — un `@var` deux lignes plus haut, un `@alphabet` en tête. Les deux volets d'au-dessus
// reconstituent ce contexte à la main, et ce bricolage EST une source de faux refus (mesuré : sept
// exemples tombaient sur « attribut inconnu » faute du `@var` qui les précédait). Le bloc entier
// n'a pas ce problème : c'est l'unité que l'auteur a écrite et que le lecteur recopie.
//
// LA PORTÉE, SANS DEVINER : la bible ÉTIQUETTE elle-même ses blocs. On prend les 68 blocs
// qu'elle déclare `bpscript` — pas ceux qu'on croit reconnaître. C'est la même règle que pour la
// vérification des messages : « le vérificateur ne devine jamais ce qui est du BPScript dans de la
// prose ». Les blocs `ebnf`, `json`, `text` et les blocs sans étiquette restent DEHORS, et c'est
// écrit ici plutôt que sous-entendu.
//
// LE RÉGIME EST CELUI DE LA BIBLE : elle est délibérément EN AVANCE. Un bloc refusé dit que le
// compilateur est en retard — ce volet le CHIFFRE et l'empêche de grandir en silence, il ne le
// traite pas. La clé d'une entrée est la PREMIÈRE LIGNE du bloc suivie de son rang parmi les blocs
// qui commencent pareil : un numéro de ligne rougirait à chaque édition de la bible, alors que
// c'est le CONTENU qui doit décider.
const RETARD_BLOCS = new Map([
  ['// 1. Sac de reglages -- sur un symbole, une regle ou un groupe #0', /'lpf1\.cutoff:…' affecte une valeur au compos/],
  ["// 3. Liste de parametres d'une declaration -- collee au nom #0", /Expected arrow \(-> <- <>\), got LPAREN at lin/],
  ["// Portee symbole -- colle a l'element #1", /'lpf1\.cutoff:…' affecte une valeur au compos/],
  ['// « quand D4 suit C4 » : D4 devient G4 #0', /la règle 'D4' porte le nom d'un TERMINAL de /],
  ['// « quand E4 suit C4 D4 » : E4 devient F4 G4, et le contexte reste ou il est #0', /la règle 'E4' porte le nom d'un TERMINAL de /],
  ['// « quelque chose, puis D4 » devient G4 #0', /la règle 'D4' porte le nom d'un TERMINAL de /],
  ['// « quelque chose, puis D4 » devient « D4, puis cette chose » -- la place est PRISE, donc elle bouge #0', /la règle 'D4' porte le nom d'un TERMINAL de /],
  ['@actor drums  eval.strudel(bank:gm) #0', /chevauchement d'acteurs : un binding de sort/],
  ["@alphabet.sargam:audio           // les terminaux de sargam sortent par l'audio #0", /terminal 'dhin' non déclaré — absent des alp/],
  ['@alphabet.western #1', /Expected arrow \(-> <- <>\), got LPAREN at lin/],
  ['@alphabet.western:audio #0', /Expected arrow \(-> <- <>\), got LPAREN at lin/],
  ['@core #10', /la règle 'D4' porte le nom d'un TERMINAL de /],
  ['@core #2', /Expected symbol, \(\.\.\.\) or \[\.\.\.\] after ! at l/],
  ['@core #4', /Expected symbol, \(\.\.\.\) or \[\.\.\.\] after ! at l/],
  ['@core #5', /Expected arrow \(-> <- <>\), got BACKTICK at l/],
  ['@def halo(x) x!tin!ge #0', /Expected arrow \(-> <- <>\), got LPAREN at lin/],
  ['@def sombre lpf1 >> vca1 #0', /Expected arrow \(-> <- <>\), got WIRE at line /],
  ['@homomorphism.dhati #0', /'@homomorphism\.dhati' : l'entrée 'dhati' n'e/],
  ['@var lpf1 lpf #0', /@var lpf1 lpf : 'lpf' est absent du catalogu/],
  ['@var lpf1 lpf #1', /@var lpf1 lpf : 'lpf' est absent du catalogu/],
  ['Motif -> C4 D4 E4 #0', /appel 'accent\(E4\)' : 'accent' n'existe pas —/],
  ['S -> $mel &mel      // deux productions possibles : les deux moities sont toujours identiques #0', /terminal 'mel' non déclaré — absent des alph/],
  ["S -> C4 (rndtime:100) D4 E4  // les attaques se decalent jusqu'a cent millisecondes #0", /'\(rndtime:…\)' : 'rndtime' est un contrôle MO/],
  ['S -> |[C4 E4 G4] D4          // les trois notes occupent une position, D4 la suivante #0', /terminal 'C4E4G4' non déclaré — absent des a/],
  ['S <> $mel &mel                            // $mel capture, &mel rejoue #0', /'&mel\(…\/…\)' : '\/' n'a pas sa place dans les /],
]);

let blocs = 0;
const retardBlocsRetrouve = new Set();
for (const p of SPECS) {
  if (!existsSync(p)) continue;
  const nom = path.basename(p);
  const lignes = readFileSync(p, 'utf8').split('\n');
  const rangs = new Map();
  let dans = false, bloc = [];
  for (const brut of lignes) {
    if (/^```bpscript\s*$/.test(brut)) { dans = true; bloc = []; continue; }
    if (dans && /^```\s*$/.test(brut)) {
      dans = false; blocs++;
      const src = bloc.join('\n');
      const tete = (bloc.find((x) => x.trim()) || '').trim();
      const rang = rangs.get(tete) || 0; rangs.set(tete, rang + 1);
      const cle = `${tete} #${rang}`;
      // L'ENVELOPPE, dite ici : un bloc qui pose déjà son socle (`@core`, `@alphabet`) est pris
      // tel quel ; sinon on lui donne le minimum dérivable. Un bloc sans flèche reçoit un point de
      // départ pour rester mesurable. Rien de plus — un contexte inventé masquerait de vrais refus.
      const aSocle = /^@core/m.test(src) || /^@alphabet/m.test(src);
      const aRegle = /(->|<-|<>)/.test(src);
      const texte = (aSocle ? '' : '@core\n@controls\n@alphabet.western:midi\n') + src
                  + (aRegle ? '\n' : '\n@mode:ord\nS -> C4\n');
      let msg;
      try { msg = (compileToBPxAST(texte).errors || []).map((e) => e.message || e).join(' | '); }
      catch (e) { msg = e.message; }
      if (!msg) continue;
      const cause = RETARD_BLOCS.get(cle);
      if (cause && cause.test(msg)) { retardBlocsRetrouve.add(cle); continue; }
      ok(false,
         `2quater. ${nom} : un bloc que la bible déclare BPScript est REFUSÉ, HORS RETARD `
         + `INVENTORIÉ — « ${cle.slice(0, 60)} » → ${msg.replace(/\s+/g, ' ').slice(0, 110)}. `
         + `La bible fait foi : soit le parser rattrape le bloc, soit il entre dans RETARD_BLOCS `
         + `avec sa cause. Un bloc muet est un mensonge que personne ne verra.`);
      continue;
    }
    if (dans) bloc.push(brut);
  }
}
// SOCLE — un extracteur cassé rendrait zéro bloc et passerait au vert en ne mesurant rien.
ok(blocs >= 60,
   `2quater. SOCLE : ${blocs} bloc(s) déclarés BPScript extraits des specs — sous ce seuil, `
   + `l'extracteur ne lit plus les blocs et « aucun refus » ne veut plus rien dire.`);
// CLIQUET — le retard ne descend jamais tout seul, et il ne remonte pas en silence.
for (const [cle] of RETARD_BLOCS) {
  ok(retardBlocsRetrouve.has(cle),
     `2quater-cliquet. le bloc « ${cle.slice(0, 60)} » est inscrit au retard mais NE REFUSE PLUS `
     + `avec sa cause (rattrapé par le parser, refusé autrement, ou réécrit dans la bible) — `
     + `RETIRE-le, daté. Un retard qui ne se resserre jamais n'est qu'un compteur.`);
}

// ─── 2bis. LA RÉFÉRENCE NE PEUT QUE DESCENDRE, ET À LA MAIN ──────────────────────────────────
// Le cliquet ne descend jamais tout seul : si le parser rattrape une forme (ou si la ligne
// disparaît de la doc), BASELINE_RATTRAPAGE doit être resserrée dans le MÊME commit — sinon ce
// garde reste vert par accident et n'empêche plus rien de remonter discrètement derrière lui.
for (const [ligne] of BASELINE_RATTRAPAGE) {
  ok(vusEnEchecConnu.has(ligne),
     `2bis. '${ligne}' est dans BASELINE_RATTRAPAGE mais NE REFUSE PLUS avec la cause enregistrée `
     + `(rattrapée par le parser, refusée pour une autre cause, ou disparue de LANGUAGE.md) — `
     + `RETIRE-la de la référence : un cliquet qui ne se resserre jamais n'est qu'un compteur.`);
}

// ─── 3. AUCUNE FORME VOUÉE AU RETRAIT NE GARDE UN APPELANT VIVANT ────────────────────────────
// Exigence du lot [1040] : « un garde qui ÉCHOUE si une forme vouée au retrait garde un appelant
// vivant ». Un appelant, ce n'est pas seulement du code — un DOCUMENT qui enseigne la forme en est
// un, et le pire : il ne casse rien, il attend qu'un lecteur recopie.
//
// ⚠️ Et le balayage est un PRODUIT CROISÉ, FORMES × DOCUMENTS. Ajouter une pierre tombale la
// cherche automatiquement dans tous les documents ; ajouter un document le soumet automatiquement
// à toutes les pierres. Rien à penser au bon moment — c'est exactement ce qui a manqué le
// 2026-07-27, où la liste des formes était complète mais la liste des fichiers ne l'était pas.
//
// ⚠️ ET UNE FORME EST ABSOLUE : la flèche employée comme câblage ne se cite PAS, même pour
// expliquer sa disparition. Règle de l'architecte sur dictée de Romain, 2026-07-27 : « une graphie
// fautive citée en exemple finit recopiée », et « la flèche est une grammaire de RÈGLE, ça ne l'a
// JAMAIS été et ça ne le sera JAMAIS » — donc l'ancienne ligne n'est pas un état de référence
// qu'on citerait au passé, c'est une faute d'écriture. Nommer la fonction en français, jamais par
// sa graphie. Les autres formes gardent leur exemption : nommer `@alias` ou `=` dans une phrase,
// c'est nommer la directive, pas exhiber une ligne recopiable.
//
// ⚠️ CETTE LISTE A CHANGÉ DE SENS le 2026-07-27 au soir, et il faut le dire : `@alias` en est SORTI
// (il est revenu au langage) et `@map` y est ENTRÉ (il est abandonné). Ce n'est pas une hésitation
// de ma part — c'est un arbitrage de Romain sur un argument absent de tous les inventaires : une
// directive ne se débranche pas, la coupure de câblage si. La liste est le REGISTRE de l'état courant, pas une
// mémoire des mouvements ; ce qui est mort y figure, ce qui vit n'y figure pas.
const MORTES = [
  [/@macro\s+[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?\s*=/, "la macro avec le signe '=' (supprimé le 2026-07-27)", 'exemptable'],
  [/@alias\s+[A-Za-z_][A-Za-z0-9_]*\s*=/, "l'alias avec le signe '=' (supprimé de TOUT le langage le 2026-07-27)", 'exemptable'],
  [/@map\s+[A-Za-z_<[]/, "'@map' — ABANDONNÉ le 2026-07-27 au soir : le câblage passe par '>>' et "
   + "'\\>>', qui savent aussi débrancher pendant que ça joue ; pour désigner, '@alias'", 'exemptable'],
  [/\\\\>>/, "l'antislash DOUBLE — le signe de coupure n'en porte qu'UN. Deux se glissent "
   + "quand on recopie une chaine de code dans de la prose, et le lecteur recopie ce qu'il "
   + "voit : ca ne compile pas", 'absolue'],
  [/(?<![\\`])!>>/, "'!>>' — l'ancienne coupure de câblage, remplacée par '\\>>' le 2026-07-28 : le "
   + "point d'exclamation ne dit QUE l'instantané, il ne dit plus la coupure", 'exemptable'],
  [/[A-Za-z0-9_)}]@[A-Za-z_][A-Za-z0-9_]*/, "le SUFFIXE arobase collé à un élément (C4@kick) — "
   + "SUPPRIMÉ le 2026-07-28 : associer dans la production se fait avec le point d'exclamation, "
   + "déclarer une étiquette se fait dans la partie déclarative", 'exemptable'],
  [/@label\s+[A-Za-z_]/, "'@label' — SUPPRIMÉE le 2026-07-28 avec le suffixe qu'elle déclarait", 'exemptable'],
  [/@(?:map|alias)\s+[^\n|]*(->|<->|<-)/,
   "la flèche employée comme CÂBLAGE — elle ne se cite jamais, même au passé pour expliquer sa "
   + "disparition : nommer la fonction en français ('un contrôleur règle le tempo pendant que ça "
   + "joue'), jamais par sa graphie", 'absolue'],
];
// Les lignes qui PARLENT de la disparition sont légitimes pour les formes 'exemptable' — elles
// nomment la directive pour l'expliquer. Elles ne le sont PAS pour la forme 'absolue'.
const PARLE_DE_SA_MORT = /DISPARU|DISPARA|SUPPRIM|disparait|disparaît|disparu|absorbé|absorbe|morte|retiré|ancien|remplac|2026-07-27|2026-07-28/;
let croisements = 0;
for (const p of TOUS) {
  const nom = relatif(p);
  const toutes = readFileSync(p, 'utf8').split('\n');
  const sansExplication = toutes.filter((l) => !PARLE_DE_SA_MORT.test(l));
  for (const [motif, quoi, rigueur] of MORTES) {
    croisements++;
    const fautives = (rigueur === 'absolue' ? toutes : sansExplication).filter((l) => motif.test(l));
    ok(fautives.length === 0,
       `3. ${nom} ${rigueur === 'absolue' ? 'CITE' : 'enseigne'} encore ${quoi} — ${fautives.length} `
       + `ligne(s), dont : '${(fautives[0] || '').trim().slice(0, 70)}'`);
  }
}
ok(croisements === TOUS.length * MORTES.length && croisements >= 100,
   `3. le produit croisé doit être PLEIN — ${croisements} croisement(s) pour ${TOUS.length} `
   + `document(s) × ${MORTES.length} forme(s) morte(s)`);

// ─── 4. TÉMOIN — l'écart de portée reste étroit, et il se justifie ───────────────────────────
// Une exclusion est une porte : elle doit rester de la taille de sa raison. Le jour où la moitié
// de `docs/` passerait par une exclusion, le garde serait vert et ne garderait plus rien.
{
  const totalMd = (function compter(dir, n = 0) {
    for (const e of readdirSync(dir)) {
      const q = path.join(dir, e);
      if (statSync(q).isDirectory()) n = compter(q, n);
      else if (e.endsWith('.md')) n++;
    }
    return n;
  })(DOCS);
  const ecartes = totalMd - TOUS.length;
  ok(ecartes <= 3,
     `4. trop de documents écartés du balayage — ${ecartes} sur ${totalMd}. La seule raison admise `
     + `est « c'est un compte rendu archivé, le réécrire falsifierait l'histoire ». Si l'écart `
     + `grandit, c'est qu'on écarte pour ne pas corriger.`);
}

// ─── 5. L'AIDE COMPILE AUSSI — mêmes fichiers, MÊME MÉCANIQUE de cliquet ─────────────────────
// Étendu le 2026-08-05 (dev). Jusqu'ici le garde ne lisait que `docs/spec/` : `editor/reference.json`
// et `public/help/reference.json` (panneau d'Aide, tooltips, autocomplétion) n'étaient balayés par
// RIEN. Mesuré : `editor/reference.json` enseignait `gate Sa:sitar` — refusé par NOTRE PROPRE
// parser depuis le 2026-07-29 (« 'gate' sans arobase n'existe plus ») — sans qu'aucun garde ne le
// signale. Trois semaines de silence pour la même raison que toujours : un garde a une PORTÉE, et
// l'aide était DEHORS.
//
// ⚠️ PORTÉE, ET SON COMPLÉMENT ÉCRIT : seul le champ `"example"` est compilé (partout dans le
// JSON, à toute profondeur) — c'est le champ que le fichier lui-même réserve à une illustration
// COMPLÈTE ("_description" : dérivé de l'EBNF, utilisé pour hover/autocomplétion). Le champ
// `"syntax"` (top-level ou dans `forms[]`) reste HORS PORTÉE : c'est une NOTATION abrégée, souvent
// un GABARIT avec des mots génériques en position de valeur (`"gate name:actor"`, `"@ name[.subkey]
// [:binding]"`) — le compiler littéralement ne mesurerait pas le langage, ça fabriquerait une
// forme qu'aucun auteur n'a écrite. Distinguer les deux est la même règle que §2 (DIRECTIVES vs
// prose) appliquée à une autre forme de document. Un futur garde qui voudrait aussi mesurer
// `forms[].syntax` devra le faire EXPLICITEMENT : ce n'est pas un oubli, c'est une exclusion nommée.
//
// L'ENVELOPPE — dite ici, pas cachée dans le code. Un exemple d'aide est un FRAGMENT bien plus
// souvent qu'une spec : `{C4 D4 E4, G4 ...}` n'est même pas rattaché à un symbole. Règle UNIQUE,
// appliquée à tous, aucune exception par exemple :
//   1. si le texte ne déclare déjà ni directive/déclaration (`@…`, `gate …`, `trigger …`, `cv …`) ni
//      flèche de règle (`->`, `<-`, `<>`), il est traité comme une RHS nue et rattaché à un symbole
//      minimal : `S -> <texte>` ;
//   2. sinon il est pris tel quel ; s'il ne contient aucune flèche (directives seules), on lui donne
//      un point de départ dérivable (`@mode:ord\nS -> C4`) pour qu'il reste mesurable ;
//   3. dans tous les cas, un préambule minimal (`@core/@controls/@alphabet.western:midi/@mode:ord`)
//      est ajouté SAUF si le texte porte déjà `@core` ou `@alphabet`.
// LIMITE CONNUE, mesurée et non maquillée : deux exemples de `concepts` mélangent PROSE et code sur
// une même ligne (une flèche anglaise « -> plays C4… », ou plusieurs illustrations indépendantes
// bout à bout) — l'enveloppe les prend pour une seule règle et le refus qui en sort teste
// l'ASSEMBLAGE mécanique, pas le langage. Étiqueté ci-dessous, pas confondu avec une vraie forme
// morte.
const AIDE_FICHIERS = ['editor/reference.json', 'public/help/reference.json'].map((f) => path.join(ICI, '..', f));

const collecterExamples = (o, chemin, out) => {
  if (o === null || typeof o !== 'object') return out;
  if (Array.isArray(o)) { o.forEach((e, i) => collecterExamples(e, `${chemin}[${i}]`, out)); return out; }
  for (const [k, v] of Object.entries(o)) {
    if (k === 'example' && typeof v === 'string') out.push({ chemin: `${chemin}.${k}`, valeur: v });
    else collecterExamples(v, `${chemin}.${k}`, out);
  }
  return out;
};

const envelopperAide = (texte) => {
  const aPreambule = /@core|@alphabet/.test(texte);
  const aDeclaration = /^\s*(@|gate\s|trigger\s|cv\s)/m.test(texte);
  const aRegle = /(->|<-|<>)/.test(texte);
  let scene = aPreambule ? '' : '@core\n@controls\n@alphabet.western:midi\n@mode:ord\n';
  if (aDeclaration || aRegle) {
    scene += `${texte}\n`;
    if (!aRegle) scene += '@mode:ord\nS -> C4\n';
  } else {
    scene += `S -> ${texte}\n`;
  }
  return scene;
};

// Causes NOMMÉES — chaque entrée de BASELINE_RATTRAPAGE_AIDE en porte une, jamais un motif vague.
const CAUSE_SPEED_SUPPRIME = /a été supprimé \(décision 2026-06-26\)/; // [speed:N] retiré, pas migré
const CAUSE_WEIGHT_PARENTHESES = /'weight' est un réglage, il s'écrit entre PARENTHÈSES/; // même famille que le geste 1 de ce lot
const CAUSE_AROBASE_OBLIGATOIRE = /sans arobase n'existe plus/; // le cas SIGNALÉ : gate/trigger/cv nus
const CAUSE_DOLLAR_MACRO_MORTE = /collé à un identifiant interdit en LHS/; // `$lfo(...) = ...` : ancienne forme de CV/macro, `$` n'est plus qu'un gabarit de template
const CAUSE_NOM_COLLISION_TERMINAL = /porte le nom d'un TERMINAL de l'alphabet actif/; // règles nommées A/B : même défaut que test/transpiler_fixtures/scan_mode.bps (geste 1)
const CAUSE_MUTATION_MID_RHS_BUG = /Expected arrow \(-> <- <>\), got NEWLINE/; // ⚠️ PAS un défaut de doc : `S -> C4 [count+1] S` seul échoue déjà (mesuré hors enveloppe) — bug parser à signaler, pas à corriger ici
const CAUSE_ENVELOPPE_PROSE_LBRACKET = /Expected arrow \(-> <- <>\), got LBRACKET/; // limite d'enveloppe : prose+code sur une ligne
const CAUSE_ENVELOPPE_PROSE_LPAREN = /Expected arrow \(-> <- <>\), got LPAREN/; // limite d'enveloppe : plusieurs illustrations indépendantes bout à bout
const BASELINE_RATTRAPAGE_AIDE = new Map([
  ['.symbols.[speed:N].example', CAUSE_SPEED_SUPPRIME],
  ['.symbols.[].example', CAUSE_WEIGHT_PARENTHESES],
  ['.keywords.lambda.example', CAUSE_WEIGHT_PARENTHESES],
  ['.keywords.gate.example', CAUSE_AROBASE_OBLIGATOIRE],
  ['.keywords.trigger.example', CAUSE_AROBASE_OBLIGATOIRE],
  ['.keywords.cv.example', CAUSE_AROBASE_OBLIGATOIRE],
  ['.symbols.`.example', CAUSE_DOLLAR_MACRO_MORTE],
  ['.symbols.?.example', CAUSE_NOM_COLLISION_TERMINAL],
  ['.symbols.-----.example', CAUSE_NOM_COLLISION_TERMINAL],
  ['.concepts.rewriting.example', CAUSE_NOM_COLLISION_TERMINAL],
  ['.concepts.sub_grammars.example', CAUSE_NOM_COLLISION_TERMINAL],
  ['.concepts.flags.example', CAUSE_MUTATION_MID_RHS_BUG],
  ['.controls_engine.tempo_ops.ops.[/N].example', CAUSE_ENVELOPPE_PROSE_LBRACKET],
  ['.concepts.control_scoping.example', CAUSE_ENVELOPPE_PROSE_LPAREN],
]);

let exemplesAide = 0;
const vusEnEchecConnuAide = new Map(); // chemin -> nb de fichiers où le rattrapage attendu est retrouvé
for (const f of AIDE_FICHIERS) {
  const nomFichier = path.relative(path.join(ICI, '..'), f);
  const json = JSON.parse(readFileSync(f, 'utf8'));
  const examples = collecterExamples(json, '', []);
  for (const { chemin, valeur } of examples) {
    exemplesAide++;
    let r;
    try { r = compileToBPxAST(envelopperAide(valeur)); }
    catch (e) { r = { errors: [{ message: e.message }] }; }
    const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
    const echoue = msg !== '' && !REFUS_DE_RESOLUTION.test(msg);
    if (!echoue) continue;
    const causeAttendue = BASELINE_RATTRAPAGE_AIDE.get(chemin);
    if (causeAttendue && causeAttendue.test(msg)) {
      vusEnEchecConnuAide.set(chemin, (vusEnEchecConnuAide.get(chemin) || 0) + 1);
      continue;
    }
    ok(false,
       `5. ${nomFichier}${chemin} enseigne une forme que le compilateur REFUSE, HORS RÉFÉRENCE : `
       + `'${valeur.slice(0, 60).replace(/\n/g, '⏎')}' → ${msg.slice(0, 110)}. Si c'est un rattrapage `
       + `attendu, AJOUTE-le à BASELINE_RATTRAPAGE_AIDE avec sa cause ; sinon c'est une forme morte.`);
  }
}
ok(exemplesAide >= 60,
   `5. il faut des exemples d'aide à mesurer (2 fichiers × ~33) — ${exemplesAide} trouvé(s). Un `
   + `effondrement ne veut pas dire que l'aide est devenue parfaite : le garde ne la lit plus.`);
// Le cliquet ne descend qu'à la main, même règle qu'en §2bis : chaque entrée doit se retrouver EN
// ÉCHEC dans les DEUX fichiers balayés, pas un seul — sinon soit le parser a rattrapé la forme dans
// l'un des deux, soit l'aide a divergé sous le garde sans qu'il resserre sa référence.
for (const [chemin] of BASELINE_RATTRAPAGE_AIDE) {
  ok(vusEnEchecConnuAide.get(chemin) === AIDE_FICHIERS.length,
     `5bis. '${chemin}' est dans BASELINE_RATTRAPAGE_AIDE mais ne refuse plus avec la cause `
     + `enregistrée dans les ${AIDE_FICHIERS.length} fichiers (retrouvé dans `
     + `${vusEnEchecConnuAide.get(chemin) || 0}) — RETIRE-le : un cliquet qui ne se resserre jamais `
     + `n'est qu'un compteur.`);
}

if (echecs.length) {
  console.error(`❌ documents du langage : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ les documents enseignent des formes vivantes — ${passe} vérification(s) passée(s) : `
            + `${blocs} BLOC(S) que la bible déclare BPScript compilés ENTIERS, dont `
            + `${retardBlocsRetrouve.size} au retard inventorié (${blocs - retardBlocsRetrouve.size} `
            + `passent), `
            + `${regles} RÈGLE(S) des specs compilées dont ${retardRetrouve.size} en retard `
            + `inventorié (le parser rattrape la bible), `
            + `${exemples} exemple(s) compilé(s) dans ${SPECS.length} spec(s), ${vusEnEchecConnu.size}/`
            + `${BASELINE_RATTRAPAGE.size} rattrapage(s) connu(s) retrouvés PILE (chantier def/init/`
            + `patch du 2026-08-03), et ${croisements} croisement(s) ${TOUS.length} document(s) × `
            + `${MORTES.length} forme(s) morte(s) — ET ${exemplesAide} exemple(s) d'aide compilés dans `
            + `${AIDE_FICHIERS.length} fichier(s), ${vusEnEchecConnuAide.size}/${BASELINE_RATTRAPAGE_AIDE.size} `
            + `rattrapage(s) connus retrouvés PILE`);
}
