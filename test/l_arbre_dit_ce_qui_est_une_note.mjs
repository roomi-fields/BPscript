#!/usr/bin/env node
/**
 * GARDE — l'ARBRE dit lui-même quels noms sont des NOTES. Le consommateur LIT, il ne demande plus.
 *
 * ORDRE de l'architecte (2026-07-29), en conséquence d'une règle que Romain a gravée le matin même
 * (`hub/decisions/2026-07-29-notre-mecanique-n-utilise-que-des-alphabets.md`) : « notre mécanique
 * ne doit utiliser QUE des alphabets ; le frontend BP3 traduit les conventions appelées au
 * lancement en alphabets ; les conventions ne doivent être connues QUE du frontend BP3 ».
 *
 * ⚠️ LE DÉFAUT QU'ON RETIRE, ET IL EST CHIFFRÉ. Kanopi interrogeait un prédicat à TROIS conventions
 * BP3 (anglaise, française, indienne). Le corpus déclare DOUZE alphabets — gamelan_pelog, shruti23,
 * bohlen_pierce et shakuhachi n'ont AUCUNE image dans ces trois-là. Tant que c'est le lecteur qui
 * pose la question, il porte une décision sémantique qui n'est pas la sienne, ET qui n'a pas de
 * réponse pour les trois quarts du catalogue. La phrase de Kanopi, reprise par l'architecte.
 *
 * ⚠️ LA FORME N'EST PAS DE MOI, et c'est délibéré : Romain a gravé le 2026-07-29 que ni bpscript ni
 * l'architecte ne prennent de décision de FORMALISME DE LANGAGE. Les DEUX champs existent, ratifiés
 * et datés (`hub/decisions/2026-07-28-le-fait-ce-nom-est-une-note-vient-du-frontal.md`, définis pour
 * bp3-frontend) : listes PLATES de noms nus, au niveau SCÈNE, ABSENT ≠ VIDE.
 *
 * ⚠️⚠️ ET UNE PHRASE DE CET EN-TÊTE A ÉTÉ RETIRÉE PARCE QU'ELLE ÉTAIT FAUSSE. J'avais écrit ici
 * « on généralise CE champ, on n'en invente pas un second — deux champs pour un même fait seraient
 * deux sources de vérité ». C'était le contraire de ce que dit la décision que je citais dans la
 * ligne au-dessus : elle écrit « champ DISTINCT de alphabetTerminals : deux sources, deux sens ;
 * les fondre est INTERDIT ». Ce ne sont PAS deux champs pour un même fait, ce sont deux faits.
 * J'ai repris le NOM sans la DISTINCTION, et ce garde a servi à défendre l'erreur : il exigeait que
 * la première note de CHAQUE alphabet soit une note, tabla et simple compris. Trouvé par
 * bp3-frontend, qui émet les deux depuis le début.
 *
 * LE CRITÈRE DU PARTAGE NE SE DÉDUIT PLUS, IL SE LIT : l'alphabet DÉCLARE `resolvesPitch`
 * (Romain, 2026-07-30 — « aucune des trois propriétés ne se déduit »). Treize entrées sur vingt-deux
 * résolvent une hauteur.
 *
 * ⚠️ IL A LONGTEMPS ÉTÉ DÉDUIT DE `defaultTuning`, et cette déduction a été RETIRÉE parce qu'elle
 * était fausse une fois sur vingt-deux : `shakuhachi` ne porte aucun accordage et résout pourtant
 * une hauteur — `lib/octaves.json` lui déclare des registres nommés (otsu, kan, daikan) et ses
 * altérations *meri* et *kari* valent un demi-ton. Un critère juste vingt et une fois sur
 * vingt-deux reste un critère qui DEVINE. L'oracle natif de bp3-frontend (en BP3, un nom de note
 * n'est jamais nu) reste une CONFIRMATION indépendante, il n'a jamais été le critère.
 *
 * ⚠️⚠️ J'AVAIS ÉCRIT QUE LES DEUX CRITÈRES DÉSIGNAIENT « EXACTEMENT LES MÊMES TROIS ». C'EST FAUX,
 * mesuré sur ma propre donnée : sans accordage → 3 ; sans champ `octaves` → HUIT. Cinq alphabets
 * (arabic, turkish, gamelan_pelog, gamelan_slendro, bohlen_pierce) ont un accordage et ne pointent
 * aucune table de registres — le critère par les registres les déclasserait tous. Bonne réponse,
 * mauvaise raison, et la mauvaise raison mordait sur cinq alphabets. Le §2bis le MESURE désormais
 * plutôt que de me faire confiance.
 *
 * ⚠️ LE TÉMOIN QUE L'ARCHITECTE EXIGE, et c'est lui qui juge la solution : « ça doit marcher pour
 * gamelan_pelog, bohlen_pierce et shruti23 comme pour western. Une solution qui ne marche que pour
 * trois alphabets est fausse — c'est précisément le défaut qu'on retire. » Le §2 balaie donc TOUS
 * les alphabets de la librairie, construits depuis la DONNÉE, jamais depuis une liste écrite ici —
 * ils sont quinze depuis l'entrée de bp3_english et bp3_fr, et le garde l'a su sans qu'on le lui
 * dise. C'est exactement ce qu'on attend d'un témoin bâti sur la donnée.
 */
import { readFileSync } from 'node:fs';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

// LES MÉTADONNÉES DU FICHIER, par opposition à ses ENTRÉES. Elles se nomment ICI, une fois : ce
// garde itère sur les clés de premier niveau, et un champ neuf posé sur le fichier serait sinon lu
// comme une entrée d'alphabet. Mesuré le 2026-08-10 — `resolves` (l'axe que la librairie résout,
// nommé avec Kairos) a fait rougir ce garde pour cette seule raison.
const META_FICHIER = new Set(['name', 'description', 'version', 'domain', 'resolvedBy', 'resolves']);

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const compiler = (src) => compileToBPxAST(src);

// ── 1. ABSENT ≠ VIDE — la distinction porte du sens, et c'est la moitié qu'on casse ─────────
// Un champ absent dit « je ne sais pas » ; une liste vide dit « aucun nom de cette scène n'est une
// note ». Les confondre ferait lire mon silence comme un fait, ce qui est le pire des deux.
{
  const r = compiler('@core\n@mine.perso.gamme\nS -> C4');
  ok(r.ast?.noteTerminals === undefined,
    `1. hauteur OPAQUE : le champ doit être ABSENT, pas vide (reçu ${JSON.stringify(r.ast?.noteTerminals)})`);
  ok(r.ast?.alphabetTerminals === undefined, '1. hauteur OPAQUE : alphabetTerminals ABSENT aussi');
}
{
  const r = compiler('@core\n@actor viz  eval.hydra\nS -> voix\nvoix -> viz.`osc(4).out()`');
  ok(r.ast?.noteTerminals === undefined,
    `1. VOIX-CODE pure : ABSENT — un bloc de code n'est pas une note (reçu ${JSON.stringify(r.ast?.noteTerminals)})`);
}
{
  // Un alphabet est en portée et la scène n'écrit aucune note : c'est un FAIT, donc une liste vide.
  const r = compiler('@core\n@alphabet.western\n@var travail\nS -> travail');
  ok(Array.isArray(r.ast?.noteTerminals) && r.ast.noteTerminals.length === 0,
    `1. alphabet en portée mais aucune note écrite : liste VIDE, pas absente (reçu ${JSON.stringify(r.ast?.noteTerminals)})`);
  ok(Array.isArray(r.ast?.alphabetTerminals),
    '1. les DEUX champs suivent la même règle absent/vide — sinon l\'un mentirait pendant que l\'autre dit vrai');
}

// ── 2. LES DOUZE ALPHABETS — le témoin exigé, construit depuis la DONNÉE ────────────────────
// La liste des alphabets n'est PAS écrite ici : elle est LUE dans la librairie. Ajouter un
// alphabet le teste automatiquement ; en retirer un ne peut pas passer inaperçu (le socle §4 le
// refuse). C'est ce qui distingue un témoin d'une liste que quelqu'un devra penser à compléter.
// ⚠️ ET LE PARTAGE EN DEUX CHAMPS, corrigé le 2026-07-29 : ce garde AFFIRMAIT l'inverse — il
// exigeait que la première note de CHAQUE alphabet soit dans noteTerminals, tabla et simple
// compris. Il gardait donc le défaut : mon arbre disait que des frappes de tabla étaient des notes,
// et ce témoin l'exigeait.
// ⚠️⚠️ ET LE CRITÈRE A CHANGÉ DE SOURCE LE 2026-07-30 : il lisait `defaultTuning` — une DÉDUCTION.
// Romain a tranché que la propriété se DÉCLARE (`resolvesPitch`), après que ma mesure ait mis la
// déduction en défaut sur `shakuhachi`. Ce garde lit désormais ce que la donnée DIT, comme le code.
const ALPHABETS = Object.entries(LIBS['alphabets'])
  .filter(([, o]) => o && typeof o === 'object' && !Array.isArray(o) && o.terminals
                     && Object.keys(o.terminals).length)
  .map(([nom, o]) => [nom, Object.keys(o.terminals)[0], !!o.resolvesPitch]);
console.log(`[arbre note] ${ALPHABETS.length} alphabets de la librairie, lus dans la donnée`);
for (const [nom, premiereNote, resoutUneHauteur] of ALPHABETS) {
  // On écrit une règle dont la tête n'est PAS une note et dont le corps EST une note de cet
  // alphabet-là. Le fait attendu ne dépend d'aucune convention BP3 : il n'y en a pas ici.
  const r = compiler(`@core\n@alphabet.${nom}\nmotif -> ${premiereNote}\nS -> motif`);
  ok((r.errors || []).length === 0,
    `2. ${nom} : la scène témoin doit compiler — ${(r.errors || []).map((e) => e.message).slice(0, 1)}`);
  // Le champ dépend de ce que l'alphabet DÉCLARE, pas de mon opinion sur l'instrument.
  const attendu = resoutUneHauteur ? 'noteTerminals' : 'alphabetTerminals';
  const autre = resoutUneHauteur ? 'alphabetTerminals' : 'noteTerminals';
  ok((r.ast?.[attendu] || []).includes(premiereNote),
    `2. ${nom} : '${premiereNote}' doit être dans ${attendu} (reçu notes=${JSON.stringify(r.ast?.noteTerminals)} alpha=${JSON.stringify(r.ast?.alphabetTerminals)})`);
  ok(!(r.ast?.[autre] || []).includes(premiereNote),
    `2. ${nom} : '${premiereNote}' ne doit PAS être dans ${autre} — les fondre est interdit (décision 2026-07-28)`);
  ok(!(r.ast?.noteTerminals || []).includes('motif') && !(r.ast?.alphabetTerminals || []).includes('motif'),
    `2. ${nom} : 'motif' n'est ni une note ni un terminal d'alphabet`);
}

// ── 2bis. LES DEUX CRITÈRES NE SE CONFONDENT PAS, ET C'EST MESURÉ ICI ──────────────────────
// ⚠️ J'AI PUBLIÉ QU'ILS DÉSIGNAIENT « EXACTEMENT LES MÊMES TROIS ALPHABETS ». C'était faux, et je
// l'ai écrit dans un commit, dans une spec et dans deux messages avant que bp3-frontend ne le
// mesure SUR MA PROPRE DONNÉE. Le code, lui, n'a jamais suivi que l'accordage — c'est la RAISON
// publiée qui était fausse, pas le résultat. Une bonne réponse pour une mauvaise raison se
// propage : la raison, elle, sert à décider la fois suivante.
// Ce bloc empêche la rechute autrement que par ma mémoire : il MESURE l'écart. Si quelqu'un
// bascule le code sur le critère des registres, les cinq alphabets ci-dessous le font rougir.
{
  const parAccordage = [], parRegistres = [];
  for (const [nom, o] of Object.entries(LIBS['alphabets'])) {
    if (!o || typeof o !== 'object' || Array.isArray(o) || !o.terminals
        || !Object.keys(o.terminals).length) continue;
    if (!o.tuning) parAccordage.push(nom);
    if (!o.octaves) parRegistres.push(nom);
  }
  const ecart = parRegistres.filter((n) => !parAccordage.includes(n));
  ok(ecart.length > 0,
    '2bis. les deux critères DIVERGENT — si cet écart tombait à zéro, la phrase « exactement les mêmes » '
    + 'redeviendrait vraie et ce témoin devrait être relu, pas supprimé');
  // Chacun de l'écart a un accordage : le critère des registres les déclasserait à tort.
  for (const nom of ecart) {
    const o = LIBS['alphabets'][nom];
    ok(!!o.tuning,
      `2bis. '${nom}' n'a pas de table de registres mais A un accordage — le critère par les registres le déclasserait`);
    const premiere = Object.keys(o.terminals)[0];
    const r = compiler(`@core\n@alphabet.${nom}\nmotif -> ${premiere}\nS -> motif`);
    ok((r.ast?.noteTerminals || []).includes(premiere),
      `2bis. '${premiere}' (${nom}) DOIT rester une note — et depuis le 2026-07-30 c'est le champ DÉCLARÉ qui le dit, `
      + 'ni l\'accordage ni les registres ; ces cinq-là restent le témoin que deux déductions plausibles divergent');
  }
  // ⚠️ LE TÉMOIN QUI SURVEILLAIT L'ÉCART AVEC L'ACCORDAGE A ROUGI LE 2026-07-30, ET C'EST SON RÔLE.
  // Il exigeait qu'au moins un alphabet diverge entre `resolvesPitch` et `defaultTuning` — c'était
  // `shakuhachi`, et c'est cette divergence qui avait fait retirer la déduction. Le même jour,
  // Romain a demandé de combler les ancres manquantes : shakuhachi a reçu la sienne (ré4 = 293,66 Hz)
  // et un accordage, donc l'écart est retombé à ZÉRO et le témoin a mordu.
  // IL EST CONVERTI EN ASSERTION, pas supprimé, et la nuance est tout l'objet de ce bloc :
  // les deux critères coïncident aujourd'hui PAR ACCIDENT — parce qu'on a réparé une donnée — et
  // la déduction reste interdite PAR DÉCISION, pas parce qu'elle divergeait. Sans cette trace,
  // quelqu'un verra deux critères identiques dans trois mois et conclura qu'ils sont équivalents.
  const divergents = Object.entries(LIBS['alphabets'])
    .filter(([, o]) => o && typeof o === 'object' && Array.isArray(o.notes) && o.notes.length)
    .filter(([, o]) => !!o.resolvesPitch !== !!o.tuning);
  ok(divergents.length === 0,
    '2bis. les deux critères coïncident depuis que shakuhachi a son ancre — si un alphabet redivergeait, '
    + `il faudrait le DIRE ici plutôt que de le laisser passer (divergents : ${divergents.map(([n]) => n).join(' ')})`);
  // ⚠️ ET LA COÏNCIDENCE REND LE TEST FACILE À TROMPER : tant que les deux critères désignent le même
  // ensemble, un code qui lirait l'accordage passerait tous les témoins ci-dessus. On construit donc
  // le cas discriminant à la volée — un alphabet qui a un accordage et déclare NE PAS résoudre —
  // et on exige que le code suive la DÉCLARATION. C'est la seule façon de prouver ce qu'il lit.
  {
    // ⚠️ CE TÉMOIN A TROUVÉ AUTRE CHOSE EN ÉCHOUANT, ET C'EST POURQUOI IL RESTE. Je l'avais écrit
    // avec `@test_declaration_prime.faux` — une LIBRAIRIE inexistante — en supposant qu'elle serait
    // refusée. Mesuré : elle passe en SILENCE (0 erreur), alors qu'un ALPHABET inexistant est refusé
    // avec un message clair. Deux portes voisines, une seule fermée. Inscrit BPS-42 ; le témoin
    // emploie désormais la forme dont le refus est prouvé, sinon il ne prouve rien.
    const temoin = compiler('@core\n@alphabet.nexistepas\nmotif -> C4\nS -> motif');
    const nom = 'western';
    const sauvegarde = LIBS['alphabets'][nom].resolvesPitch;
    LIBS['alphabets'][nom] = { ...LIBS['alphabets'][nom], resolvesPitch: false };
    const r = compiler(`@core\n@alphabet.${nom}\nmotif -> C4\nS -> motif`);
    LIBS['alphabets'][nom] = { ...LIBS['alphabets'][nom], resolvesPitch: sauvegarde };
    ok((r.ast?.alphabetTerminals || []).includes('C4') && !(r.ast?.noteTerminals || []).includes('C4'),
      "2bis. LE CODE SUIT LA DÉCLARATION, PAS L'ACCORDAGE : western privé de resolvesPitch se déclasse, "
      + `bien qu'il garde son accordage (reçu notes=${JSON.stringify(r.ast?.noteTerminals)} `
      + `alpha=${JSON.stringify(r.ast?.alphabetTerminals)}) — sans ce cas, un code lisant l'accordage passerait tout`);
    ok((temoin.errors || []).length > 0,
      '2bis. TÉMOIN D\'INSTRUMENT — une librairie inexistante doit être refusée, sinon la mesure ci-dessus ne prouve rien');
  }
}

// ── 3. CE QUE LE CONSOMMATEUR CHERCHE VRAIMENT ──────────────────────────────────────────────
// Kanopi ne cherche pas une collision (ma règle d'unicité s'en charge) : il veut écarter de sa
// lecture de STRUCTURE les éléments qui sont des notes. Une tête de règle qui porte un nom de note
// doit donc y figurer — c'est exactement le cas qui l'intéresse.
{
  const r = compiler('@core\n@alphabet.western\nG4 -> C4 D4');
  ok((r.ast?.noteTerminals || []).includes('G4'),
    `3. une TÊTE DE RÈGLE nommée comme une note doit être marquée (reçu ${JSON.stringify(r.ast?.noteTerminals)})`);
}
{
  // Descendre jusqu'aux FEUILLES : un nom sous un groupe ou sous une note ancrée compte autant
  // qu'un voisin de surface. Faute payée quatre fois en juillet — compter la surface ne voit pas
  // ce qui vit sous un nœud composite.
  const r = compiler('@core\n@alphabet.western:midi\n@trigger sync1:midi\nS -> {C4 E4} G4<!sync1');
  for (const n of ['C4', 'E4', 'G4']) {
    ok((r.ast?.noteTerminals || []).includes(n),
      `3. '${n}' sous un groupe ou une note ancrée doit être vu (reçu ${JSON.stringify(r.ast?.noteTerminals)})`);
  }
  ok(!(r.ast?.noteTerminals || []).includes('sync1'),
    '3. un point d\'attente n\'est PAS une note — une attente suspend le temps, elle ne sonne pas');
}
{
  // Ce n'est PAS le catalogue : seuls les noms PRÉSENTS dans la scène (décision 2026-07-28).
  const r = compiler('@core\n@alphabet.western\nS -> C4');
  const l = r.ast?.noteTerminals || [];
  ok(l.length === 1 && l[0] === 'C4',
    `3. la liste porte ce que la SCÈNE écrit, pas le catalogue de l'alphabet (reçu ${l.length} entrée(s))`);
}

// ── 3bis. LES ALPHABETS SANS HAUTEUR — le défaut exact qui a été livré ──────────────────────
// ⚠️ CETTE SECTION A ÉTÉ RETOURNÉE LE 2026-07-30, ET C'EST UN DURCISSEMENT. Elle exigeait que
// `shakuhachi` NE SOIT PAS une note, sur le critère déduit « pas d'accordage donc pas de hauteur ».
// Romain a retiré ce critère (décision du 2026-07-30) précisément parce que ma mesure l'a mis en
// défaut sur lui : `lib/octaves.json` lui déclare des registres nommés (otsu, kan, daikan) et ses
// altérations *meri* et *kari* valent un demi-ton. Il RÉSOUT une hauteur ; ce qui lui manque est
// une ancre, pas une nature. Le garde qui exigeait l'inverse gardait donc le défaut.
// Le critère n'est plus déduit : l'alphabet DÉCLARE `resolvesPitch`.
for (const [alpha, terminal] of [['tabla', 'dha'], ['simple', 'a'], ['dhadhatite', 'dha']]) {
  const r = compiler(`@core\n@alphabet.${alpha}\nmotif -> ${terminal}\nS -> motif`);
  ok(!(r.ast?.noteTerminals || []).includes(terminal),
    `3bis. ${alpha} ne résout aucune hauteur : '${terminal}' ne doit PAS être annoncé comme note`);
  ok((r.ast?.alphabetTerminals || []).includes(terminal),
    `3bis. ${alpha} : '${terminal}' est un TERMINAL D'ALPHABET, et il doit être dit`);
}
// ⚠️ L'AUTRE SENS, ET C'EST LA MOITIÉ QU'ON CASSE : un alphabet qui déclare résoudre une hauteur
// SANS porter d'accordage doit quand même sortir en NOTE. Sans ce témoin, un retour au critère
// déduit repasserait au vert sans que rien ne le dise.
{
  const r = compiler('@core\n@alphabet.shakuhachi\nmotif -> ro\nS -> motif');
  ok((r.ast?.noteTerminals || []).includes('ro'),
    "3bis. shakuhachi DÉCLARE résoudre une hauteur : 'ro' est une NOTE, même sans accordage");
  ok(!(r.ast?.alphabetTerminals || []).includes('ro'),
    "3bis. shakuhachi : 'ro' ne doit PAS être aussi un terminal d'alphabet — les fondre est interdit");
}
// ⚠️ ET LE CRITÈRE LUI-MÊME EST MESURÉ, PAS RELU : la donnée doit PORTER le champ, sinon le code
// retomberait en silence sur une déduction. Ce témoin échoue le jour où `resolvesPitch` disparaît.
// ⚠️ LES DEUX CATALOGUES, PAS SEULEMENT CELUI OÙ LE DÉFAUT S'EST MONTRÉ. `test_alphabets.json`
// porte cinq entrées de plus ; les omettre laisserait la moitié de l'espace sans garde — la faute
// « on répare l'endroit où le défaut s'est MONTRÉ, pas l'espace où il peut vivre ».
for (const fichier of ['../lib/alphabets.json', '../lib/test_alphabets.json']) {
  const j = JSON.parse(readFileSync(new URL(fichier, import.meta.url), 'utf-8'));
  // ⚠️ 'resolvedBy' EXCLU AU MÊME TITRE QUE 'domain' depuis le 2026-08-10 (mise en conformité des
  // librairies, remplace 'domain') — sinon la chaîne 'Kairos' est lue comme une entrée d'alphabet
  // sans resolvesPitch, et le garde crie sur un champ de MÉTADONNÉE, pas sur une vraie entrée.
  const entrees = Object.keys(j).filter((k) => !META_FICHIER.has(k) && !k.startsWith('_'));
  ok(entrees.length > 0, `3bis. ${fichier} doit contenir des entrées (socle : un catalogue vide ne prouve rien)`);
  const sansChamp = entrees.filter((n) => typeof j[n].resolvesPitch !== 'boolean');
  ok(sansChamp.length === 0,
    `3bis. ${fichier} : TOUTE entrée déclare resolvesPitch — sans lui le code devine (manquant : ${sansChamp.join(' ')})`);
}
{
  const j = JSON.parse(readFileSync(new URL('../lib/alphabets.json', import.meta.url), 'utf-8'));
  // ⚠️ 'resolvedBy' EXCLU AU MÊME TITRE QUE 'domain' depuis le 2026-08-10 (mise en conformité des
  // librairies, remplace 'domain') — sinon la chaîne 'Kairos' est lue comme une entrée d'alphabet
  // sans resolvesPitch, et le garde crie sur un champ de MÉTADONNÉE, pas sur une vraie entrée.
  const entrees = Object.keys(j).filter((k) => !META_FICHIER.has(k) && !k.startsWith('_'));
  // ⚠️ MÊME CONVERSION QU'EN 2bis, et pour la même raison : ce témoin exigeait la divergence, elle a
  // été comblée le 2026-07-30 par l'ancre de shakuhachi. Ce qu'on garde ici est l'INVARIANT qui
  // survit à la coïncidence : tout alphabet qui déclare résoudre une hauteur doit porter une ANCRE
  // COMPLÈTE — un nom de référence, son registre, et sa fréquence. C'est cet invariant qui manquait
  // à shakuhachi, et c'est lui qui empêchera le prochain alphabet d'entrer sans position.
  const resolvent = entrees.filter((n) => j[n].resolvesPitch);
  const sansAncre = resolvent.filter((n) => j[n].diapason == null || j[n].baseNote == null || j[n].baseRegister == null);
  ok(sansAncre.length === 0,
    "3bis. tout alphabet qui DÉCLARE résoudre une hauteur porte une ANCRE COMPLÈTE (nom de référence, "
    + `registre, fréquence) — sinon il annonce une hauteur sans dire où elle commence : ${sansAncre.join(' ')}`);
  ok(resolvent.every((n) => !!j[n].tuning),
    '3bis. et il porte un ACCORDAGE — l\'ancre dit où ça commence, l\'accordage dit comment on avance');
  // ⚠️ ET LA TABLE DE REGISTRES DOIT ÊTRE BRANCHÉE, PAS SEULEMENT NOMMÉE DANS UN COMMENTAIRE.
  // Défaut mesuré par Kairos le 2026-07-30 : `shakuhachi` portait dans sa PROSE « le registre se
  // nomme otsu, index 0 de lib/octaves.json » et ne portait AUCUN champ `octaves`. Résultat par son
  // chemin de production : `ro` rendait 293,66 et `otsu_ro`, `kan_ro`, `daikan_ro` rendaient NULL.
  // PERTE SILENCIEUSE — le jeton à registre ne sonnait pas faux, il ne sonnait pas.
  // LA FORME DE LA FAUTE : la prose dit l'intention, la donnée dit l'état, et personne ne mesure
  // une phrase. En cherchant l'ESPACE plutôt que l'occurrence, `turkish` avait le même défaut.
  const registres = JSON.parse(readFileSync(new URL('../lib/octaves.json', import.meta.url), 'utf-8'));
  const tables = Object.keys(registres).filter((k) => !META_FICHIER.has(k) && !k.startsWith('_'));
  const nonBranches = resolvent.filter((n) => tables.includes(n) && !j[n].octaves);
  ok(nonBranches.length === 0,
    "3bis. une table de registres HOMONYME existe et n'est pas branchée — le nommer dans un "
    + `commentaire ne la branche pas : ${nonBranches.join(' ')}`);
  ok(tables.length > 0 && resolvent.some((n) => !!j[n].octaves),
    '3bis. TÉMOIN — des tables existent ET au moins un alphabet en pointe une (sinon ce bloc ne mesure rien)');
}
{
  // Deux vocabulaires dans la même scène : chacun dans son champ, aucun mélange.
  const r = compiler('@core\n@actor perc\n  alphabet.tabla\n  out.audio\n'
    + '@actor n\n  alphabet.western\n  out.audio\nmotif -> dha C4\nS -> motif');
  ok((r.ast?.noteTerminals || []).join() === 'C4' && (r.ast?.alphabetTerminals || []).join() === 'dha',
    `3bis. deux vocabulaires : chacun dans son champ (reçu notes=${JSON.stringify(r.ast?.noteTerminals)} alpha=${JSON.stringify(r.ast?.alphabetTerminals)})`);
}

// ── 4. SOCLE ET ANTI-RÉTRÉCISSEMENT ─────────────────────────────────────────────────────────
// Sans lui, une librairie vidée ou un filtre trop strict rendraient ce fichier vert en n'ayant
// rien examiné — la famille close le 2026-07-27, et le témoin exigé porte justement sur le NOMBRE
// d'alphabets couverts.
ok(ALPHABETS.length >= 12,
  `4. le témoin de l'architecte porte sur les DOUZE alphabets — ${ALPHABETS.length} lu(s) dans la donnée`);
for (const attendu of ['gamelan_pelog', 'bohlen_pierce', 'shruti23']) {
  ok(ALPHABETS.some(([n]) => n === attendu),
    `4. '${attendu}' est NOMMÉMENT exigé par l'architecte et doit être dans le balayage`);
}

if (echecs.length) {
  console.error(`[arbre note] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[arbre note] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
