#!/usr/bin/env node
/**
 * GARDE DE L'OUTIL DE MIGRATION — c'est l'endroit où une erreur coûterait le plus cher.
 *
 * Cet outil va tourner sur des dépôts qui ne sont pas le mien, sur des scènes qui servent de
 * MESURE DE CONFORMITÉ au moteur natif. S'il renomme mal, il ne casse rien de visible : il produit
 * une pièce différente, en silence, et la campagne de conformité diverge — on lirait ça comme un
 * bug moteur pendant des jours. Un outil de migration non gardé est le pire endroit pour une
 * approximation.
 *
 * CE QU'IL VÉRIFIE, en matrice : sur des scènes fabriquées dont on SAIT ce qui doit arriver.
 *   · qu'il TROUVE une collision quand elle existe ;
 *   · qu'il n'en INVENTE pas quand un nom ressemble à une note d'une AUTRE convention ;
 *   · qu'il RENOMME tous les usages, jamais un préfixe (`A` ne doit pas toucher `A4`) ;
 *   · qu'il REFUSE quand il ne peut pas prouver la production identique ;
 *   · qu'il laisse tranquille ce qui pose une PROPRIÉTÉ sur un nom existant (`@gate Sa:sc`).
 */
import { chargerMoteur, collisions, renommer, migrerSource, terminauxActifs } from './migration_noms.mjs';
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

if (!await chargerMoteur()) {
  console.error("[outil migration] dist BPx introuvable : `npm run build` côté BPx.");
  console.error("Ce n'est PAS un défaut de l'outil — mais sans moteur il ne peut rien prouver,");
  console.error("et le laisser passer vert ici reviendrait à verdir sans avoir rien examiné.");
  process.exit(1);
}

// ── 1. TROUVER, ET NE PAS INVENTER ───────────────────────────────────────────
// L'espace : la convention active × ce à quoi le nom ressemble.
const DETECTION = [
  ['occidental, tête nommée comme une note',      'core\nalphabet.western\n-----\nG4 -> C4 D4', 1],
  ['sargam, tête nommée comme une note',          'core\nalphabet.sargam\n-----\nsa -> re ga', 1],
  ['occidental, tête d\'allure SARGAM',           'core\nalphabet.western\n-----\npa1 -> C4 D4', 0],
  ['sargam, tête d\'allure OCCIDENTALE',          'core\nalphabet.sargam\n-----\nG4 -> sa re', 0],
  ['occidental, tête sans rapport',               'core\nalphabet.western\n-----\nmotif -> C4 D4', 0],
  ['définition nommée comme une note',           'core\nalphabet.western\ndef C4 D4 E4\n-----\nS -> D4', 1],
];
console.log(`[outil migration] détection : ${DETECTION.length} cas`);
for (const [nom, src, attendu] of DETECTION) {
  const { ast } = compileToBPxAST(src);
  ok(!!ast, `${nom} — la scène d'essai doit compiler`);
  ok(ast ? collisions(ast).size === attendu : false,
    `${nom} — doit trouver ${attendu} collision(s), pas ${ast ? collisions(ast).size : '?'}`);
}

// ── 2. LE RENOMMAGE NE MORD PAS SUR LES VOISINS ──────────────────────────────
// C'est L'erreur qui transforme une note en autre chose, et elle ne se voit pas à la relecture.
const VOISINS = [
  ['A ne touche pas A4',        'S -> A A4 A',       'A', 'A_r', 'S -> A_r A4 A_r'],
  ['A ne touche pas Ab',        'S -> A Ab',         'A', 'A_r', 'S -> A_r Ab'],
  ['A ne touche pas _A',        'S -> A _A',         'A', 'A_r', 'S -> A_r _A'],
  ['A en début de ligne',       'A -> A A',          'A', 'A_r', 'A_r -> A_r A_r'],
  ['sa ne touche pas sa4',      'S -> sa sa4',       'sa', 'sa_r', 'S -> sa_r sa4'],
  ['un nom ne touche pas son préfixé', 'S -> re rega', 're', 're_r', 'S -> re_r rega'],
  // ⚠️ LES ALTÉRATIONS — l'angle mort qui a cassé 3 scènes chez BPx. L'ancrage interdisait
  // lettres, chiffres et souligné ; il ne connaissait pas le DIÈSE, donc `A` mordait `A#5`.
  // Ma matrice testait A4, Ab et _A : les voisins auxquels j'avais pensé. C'est exactement la
  // faute « énumérer les formes qu'on a en tête » — et la parade est que l'ancrage LIT désormais
  // les signes d'altération dans les bibliothèques au lieu de les énumérer à la main.
  ['A ne touche pas A#5',       'S -> A A#5',        'A', 'A_r', 'S -> A_r A#5'],
  ['F ne touche pas F#2',       'S -> F F#2',        'F', 'F_r', 'S -> F_r F#2'],
  ['E ne touche pas E#3',       'S -> E E#3',        'E', 'E_r', 'S -> E_r E#3'],
  ['A ne touche pas A##',       'S -> A A##',        'A', 'A_r', 'S -> A_r A##'],
];
console.log(`[outil migration] renommage : ${VOISINS.length} cas`);
for (const [nom, avant, de, vers, attendu] of VOISINS) {
  ok(renommer(avant, de, vers) === attendu,
    `${nom} — attendu « ${attendu} », obtenu « ${renommer(avant, de, vers)} »`);
}

// ── 2bis. LE CODE ENTRE BACKTICKS EST INTOUCHABLE ────────────────────────────
// ⚠️ TROUVÉ EN CHERCHANT UN CAS DE REFUS, à la demande de BPx. L'outil réécrivait le code :
// `A -> C4 \`js: A + 1\`` devenait `A_r -> C4 \`js: A_r + 1\``, et il déclarait « production
// identique » — CE QUI EST VRAI, et c'est bien le problème. Le code est porté opaque jusqu'au
// runtime : le réécrire ne change aucun jeton produit, donc le comparateur ne peut RIEN en voir.
// La garantie de l'outil porte sur ce que la dérivation produit, jamais sur ce qu'un runtime
// exécutera plus tard. Là où il ne peut pas prouver, il ne touche pas.
const BACKTICKS = [
  ['le code n\'est pas réécrit',        'A -> C4 `js: A + 1`',        'A', 'A_r', 'A_r -> C4 `js: A + 1`'],
  ['plusieurs backticks sur la ligne',  'A -> `a: A` A `b: A`',       'A', 'A_r', 'A_r -> `a: A` A_r `b: A`'],
  ['hors backtick on renomme toujours', 'A -> A `x` A',               'A', 'A_r', 'A_r -> A_r `x` A_r'],
  // ⚠️ LES COMMENTAIRES, mesuré par Kanopi. Le cas grave n'est pas la prose abîmée : c'est qu'une
  // CITATION de la grammaire native se mette à suivre nos renommages. Une citation qui change
  // avec nous n'est plus une citation, elle devient un faux témoin — et c'est justement sur ces
  // conversions que la comparaison au natif doit rester lisible.
  ['un commentaire n\'est pas touché',   '// D est la tête\n-----\nD -> C4',  'D', 'D_r', '// D est la tête\n-----\nD_r -> C4'],
  ['une citation du natif est intacte',  '// natif : D --> C4\n-----\nD -> C4', 'D', 'D_r', '// natif : D --> C4\n-----\nD_r -> C4'],
  ['un commentaire en fin de ligne',     'D -> C4   // D ici\n',        'D', 'D_r', 'D_r -> C4   // D ici\n'],
];
console.log(`[outil migration] backticks : ${BACKTICKS.length} cas`);
for (const [nom, avant, de, vers, attendu] of BACKTICKS) {
  ok(renommer(avant, de, vers) === attendu,
    `${nom} — attendu « ${attendu} », obtenu « ${renommer(avant, de, vers)} »`);
}

// ── 3. LE VERDICT DE BOUT EN BOUT ────────────────────────────────────────────
// Une scène où le renommage est sûr doit passer AVEC preuve de production identique ; une scène
// sans collision ne doit rien changer ; une déclaration qui pose une propriété sur un nom existant
// ne doit RIEN déclencher.
const SCENE_A_MIGRER = 'core\nalphabet.western\n-----\nS -> A B\nA -> C4 D4\nB -> E4 A4';
{
  const r = migrerSource(SCENE_A_MIGRER);
  ok(r.ok === true, '3. une scène migrable doit être acceptée');
  ok(!r.aucunChangement, '3. et elle doit avoir des renommages');
  ok((r.renommages || []).some((x) => x.de === 'A' && x.vers === 'A_r'), '3. la tête A doit être renommée');
  ok((r.renommages || []).some((x) => x.de === 'B'), '3. la tête B aussi');
  // La preuve qui compte : le nom renommé n'a pas mordu sur la NOTE A4.
  ok(/A4/.test(r.source || '') && !/A_r4/.test(r.source || ''),
    '3. la note A4 doit être INTACTE après renommage — c\'est le piège du lot');
  ok(collisions(compileToBPxAST(r.source).ast).size === 0, '3. zéro collision restante');
}
{
  const r = migrerSource('core\nalphabet.western\n-----\nS -> motif\nmotif -> C4 D4');
  ok(r.ok && r.aucunChangement, '3. une scène sans collision ne doit rien changer');
}
{
  // `gate Sa:sc` pose une PROPRIÉTÉ sur un nom existant — ratifié Romain 2026-07-28. Ce témoin
  // garde la distinction : elle ne crée pas de nom rival, donc l'outil ne doit rien y toucher.
  const r = migrerSource('core\nalphabet.western\nC4:midi\n-----\nS -> C4 D4');
  ok(r.ok && r.aucunChangement,
    '3. une déclaration qui pose une PROPRIÉTÉ sur un nom existant ne doit RIEN déclencher');
}
{
  // Une scène illisible est HORS SUJET, pas refusée : un outil qui sort en erreur pour une raison
  // qui n'est pas la sienne apprend à son propriétaire à ignorer son code de sortie.
  const r = migrerSource('ceci n est pas une scène \\ du tout');
  ok(r.ok && r.horsSujet, '3. une scène qui ne compile pas est HORS SUJET, pas refusée');
}

// ── 3ante. « RÉFÉRENCE INDISPONIBLE » N'EST PAS « MIGRATION DANGEREUSE » ─────
// ⚠️ RÈGLE DE KANOPI (2026-07-28), transmise par l'architecte le 2026-07-29 : UN COMPARATEUR NE
// PEUT PAS JUGER UNE MIGRATION EN PRENANT POUR RÉFÉRENCE L'ÉTAT QUE CETTE MIGRATION RÉPARE. Ils
// l'ont mesurée en me voyant refuser 52 de leurs scènes à tort — l'état d'avant ne produisait
// plus rien, non parce que le renommage était risqué, mais parce que la règle d'unicité l'avait
// rendu invalide la veille.
//
// LES DEUX SENS COMPTENT ÉGALEMENT, et c'est tout l'objet de ce bloc : si je me contentais du
// premier témoin, un outil qui déclarerait « référence indisponible » sur TOUT passerait au vert
// en n'accusant plus jamais rien — exactement l'excuse universelle que la règle ne demande pas.
// Le second témoin est donc le plus important : une production qui CHANGE reste un vrai refus.
// ⚠️⚠️ CE QUE CE BLOC NE PROUVE PAS, ET IL FAUT LE LIRE AVANT SON VERT.
// Le versant « la classification DOIT se déclencher » n'a AUCUN témoin : je n'ai su construire
// aucune scène où l'avant ne produit pas et où le migré produit. Mesuré sur les 202 scènes de la
// bibliothèque : ce verdict se déclenche ZÉRO fois aujourd'hui. Il implémente une règle transmise
// pour l'avenir, pas un défaut reproductible ce matin — et un vert ici ne dit rien de sa justesse.
// Ce qui EST prouvé ci-dessous, c'est l'autre moitié, celle qui compte le plus : il n'excuse pas
// tout. Écrire ce qu'un garde NE couvre PAS vaut mieux qu'un vert qui laisse croire qu'il couvre.
{
  // ⚠️ LE SENS QUI DÉMASQUE L'EXCUSE UNIVERSELLE. Une scène que le moteur ne sait dériver NI
  // avant NI après (ici `randomize {…}(shuffle)`, la ligne exacte qui bloque `trySrand` dans la
  // bibliothèque) a une cause PROPRE : elle doit rester un vrai refus, jamais « sans référence ».
  // Ce témoin a été RÉÉCRIT : le premier ne passait même pas par la branche testée, donc il
  // restait vert quand je remplaçais la condition par `true`. Un témoin qui n'atteint pas le code
  // qu'il juge est un témoin absent — et il a exactement la même couleur qu'un témoin qui tient.
  // ⛔ VOLET SUSPENDU le 2026-08-08 — il a perdu son SUJET, pas sa valeur.
  //
  // Sa scène d'exemple écrivait `randomize` NU dans le flux, forme retirée du langage le même jour
  // (Romain : « un mot sans rien c'est un terminal, un non-terminal, un nom de règle, mais jamais
  // une instruction »). Depuis, elle est refusée au PARSEUR : le témoin n'atteint plus le moteur,
  // donc il ne juge plus l'excuse universelle qu'il est là pour démasquer. Migrée vers la forme
  // valide, elle devient DÉRIVABLE — et un cas dérivable ne teste pas « indérivable des deux côtés ».
  //
  // ⚠️ CE VOLET NE SE BRICOLE PAS. Il lui faut une scène que le moteur ne sait dériver ni avant ni
  // après, et cela se MESURE contre le moteur — cela ne s'invente pas. Lui coudre un exemple
  // plausible le rendrait vert sans qu'il garde quoi que ce soit : exactement ce que son propre
  // commentaire, six lignes plus haut, raconte avoir déjà payé une fois.
  //
  // RALLUMAGE : dès qu'une scène indérivable des deux côtés est identifiée PAR MESURE. Le corpus en
  // portait une — `trySrand` — aujourd'hui refusée au parseur pour son crochet collé ; elle
  // redeviendra un candidat quand kanopi l'aura migrée.
  const VOLET_3ANTE_ACTIF = false;
  if (VOLET_3ANTE_ACTIF) {
    const r = migrerSource('core\nalphabet.western\nmode:rnd\n-----\n'
      + 'S -> A\n-----\nA -> {C4 B4 E4}(shuffle)');
    ok(r.ok === false, '3ante. la scène indérivable des deux côtés reste REFUSÉE');
    ok(r.referenceIndisponible !== true,
      `3ante. SE TAIT — et elle n'est PAS excusée en « sans référence » (reçu : ${r.motif})`);
    ok(/avant ET après/.test(r.motif || ''),
      '3ante. le motif doit dire que les DEUX côtés sont muets — c\'est ce qui la distingue');
  }
}

// ── 3bis. LE COMPARATEUR SAIT-IL VOIR UNE DIFFÉRENCE ? ───────────────────────
// ⚠️ CE BLOC EXISTE PARCE QU'UNE INJECTION N'A RIEN FAIT ROUGIR. J'avais débranché la comparaison
// de production — le cœur de sécurité de l'outil, ce qui l'empêche d'écrire quand la musique
// change — et les 29 assertions restaient vertes. Toutes les scènes d'essai renommaient
// correctement, donc aucune ne pouvait révéler que le juge était absent.
// Un garde qui ne teste que des cas qui réussissent ne garde pas le juge, il garde l'accusé.
// On vérifie donc ici la seule chose dont dépend le refus d'écrire : le comparateur DISCRIMINE.
// S'il rendait une constante, il déclarerait « production identique » sur n'importe quel
// renommage, y compris celui qui change la pièce.
{
  const { production } = await import('./migration_noms.mjs');
  const a1 = production('core\nalphabet.western\n-----\nS -> C4 D4');
  const a2 = production('core\nalphabet.western\n-----\nS -> C4 D4 E4');
  const a3 = production('core\nalphabet.western\n-----\nS -> C4 D4');
  ok(!a1.erreur && !a2.erreur, '3bis. les deux productions témoins doivent se dériver');
  ok(a1.jetons !== a2.jetons, '3bis. le comparateur doit VOIR deux pièces différentes');
  ok(a1.jetons === a3.jetons, '3bis. et rendre identiques deux pièces identiques');
  ok((a1.jetons || '').length > 0, '3bis. et il doit produire quelque chose, pas du vide');
}
{
  // Et la propriété de bout en bout : une source dont la production DIFFÉRERAIT doit être refusée.
  // On la fabrique en renommant à moitié — le cas exact du piège annoncé par l'architecte.
  const { production } = await import('./migration_noms.mjs');
  const complet = 'core\nalphabet.western\n-----\nS -> A B\nA -> C4 D4\nB -> E4 A4';
  const moitie  = 'core\nalphabet.western\n-----\nS -> A_r B\nA -> C4 D4\nB -> E4 A4';  // la tête n'est plus atteinte
  const p1 = production(complet), p2 = production(moitie);
  ok(p1.jetons !== p2.jetons || !!p2.erreur,
    '3bis. un renommage À MOITIÉ doit se voir — production différente ou scène refusée');
}

// ── 3ter. LE JUGE VOIT-IL UN RENOMMAGE DE NOTE ? ─────────────────────────────
// ⚠️ CE BLOC EXISTE PARCE QUE MON JUGE ÉTAIT AVEUGLE À SA PROPRE CIBLE. L'empreinte portait le
// NUMÉRO d'internement du symbole. Or un renommage COHÉRENT préserve l'ordre d'internement, donc
// les numéros : l'empreinte sortait identique alors que les NOMS avaient changé. Le juge voyait
// très bien un renommage INCOMPLET — un symbole nouveau décale les numéros — et pas du tout un
// renommage COMPLET mais fautif, qui est justement ce que l'outil doit empêcher.
// Mesuré par BPx : 19 scènes déclarées saines, 3 avaient changé de musique.
// Le témoin ci-dessous est le SEUL qui aurait attrapé ça.
{
  const { production } = await import('./migration_noms.mjs');
  const avant = 'core\nalphabet.western\n-----\nS -> A#5 C4';
  const apres = 'core\nalphabet.western\n-----\nS -> B5 C4';     // une NOTE en remplace une autre
  const p1 = production(avant), p2 = production(apres);
  ok(!p1.erreur && !p2.erreur, '3ter. les deux témoins doivent se dériver');
  ok(p1.jetons !== p2.jetons,
    '3ter. remplacer une NOTE par une autre doit se VOIR — c\'est la cible même de l\'outil');
  // Et la propriété qui manquait : l'empreinte porte des NOMS, pas des rangs.
  ok((p1.jetons || '').length > 50, '3ter. l\'empreinte doit être l\'arbre entier, pas un résumé');
  // ⚠️ LE TÉMOIN QUI MANQUAIT DEUX FOIS : une SUBSTITUTION DE HAUTEUR doit se voir. Mon empreinte
  // a été un rang (aveugle au renommage cohérent), puis un nom (aveugle aux feuilles qui portent
  // leur note ailleurs — Kanopi a pu remplacer E2 par C7 sans que le verdict bouge). C'est le même
  // défaut deux fois : une empreinte bâtie sur des champs CHOISIS ne vaut que le choix.
  const h1 = production('core\nalphabet.western\n-----\nS -> E2 C4');
  const h2 = production('core\nalphabet.western\n-----\nS -> C7 C4');
  ok(h1.jetons !== h2.jetons, '3ter. remplacer E2 par C7 doit se VOIR — le juge ne choisit plus ses champs');
  const h3 = production('core\nalphabet.western\n-----\nS -> E2 C4');
  ok(h1.jetons === h3.jetons, '3ter. et deux dérivations identiques restent identiques (pas de bruit)');
}
{
  // De bout en bout : une scène dont la tête heurte une note, ET qui contient une altération.
  // C'est la forme exacte des scènes cassées chez BPx.
  const r = migrerSource('core\nalphabet.western\n-----\nS -> A B\nA -> C4 A#5\nB -> E4 F#2');
  ok(r.ok === true, '3ter. la scène doit être migrable');
  ok(/A#5/.test(r.source || '') && /F#2/.test(r.source || ''),
    '3ter. les notes altérées doivent être INTACTES — A#5 et F#2 tels quels');
  ok(!/A_r#5|F_r#2/.test(r.source || ''), '3ter. et surtout pas altérées en A_r#5 / F_r#2');
}

// ── 3quater. L'AMALGAME ACTEUR / TÊTE DE RÈGLE ───────────────────────────────
// Romain, 2026-07-28 : une règle dont la tête porte le nom d'un acteur « amalgame un nom d'acteur
// et un nom de règle, c'est une erreur grave ». La migration a DEUX gestes, et le second est
// obligatoire : renommer la tête seule fait perdre son langage au code et la scène est REFUSÉE.
console.log('\n=== §3quater. l\'amalgame acteur / tête de règle ===');
{
  // La scène d'essai déclare l'acteur SANS moteur d'évaluation : depuis que l'acteur peut
  // qualifier un bloc par le point, un acteur À moteur rend la source invalide autrement (le bloc
  // n'a plus de langage) et l'outil refuserait pour cette raison-là, pas pour l'amalgame.
  const AMALGAME = 'core\nalphabet.western\nactor drums\n  alphabet.western\n  out.audio\n-----\nS -> drums\ndrums -> C4 D4';
  const r = migrerSource(AMALGAME);
  ok(r.ok === true, '3quater. une scène à l\'amalgame doit être migrable');
  ok(!/^drums\s*->/m.test(r.source || ''), '3quater. la tête ne porte plus le nom de l\'acteur');
  ok(/actor\s+drums/.test(r.source || ''), '3quater. mais l\'ACTEUR garde son nom — c\'est la règle qui cède');
  ok(!/^drums\s*->/m.test(r.source || ''), '3quater. et plus aucune règle ne porte le nom de l\'acteur');
  const apres = compileToBPxAST(r.source || '');
  ok(!!apres.ast && apres.errors.length === 0, '3quater. la scène migrée compile sans erreur');
  // Le second geste est-il vraiment indispensable ? On le prouve en ne faisant que le premier.
  // Sur une voix de CODE, renommer la tête seule casse : le bloc perd son langage. C'est pourquoi
  // l'outil pose aussi le tag — et c'est aussi ce qui a motivé la forme `acteur.<bloc>`.
  //
  // ⛔ ET CE VOLET MESURAIT UN REFUS, QUI N'EXISTE PLUS. Depuis que le socle nomme un langage
  // (`core` porte `js`), un bloc qui perd son acteur ne crie plus : il TOMBE SUR LE SOCLE et part
  // en `js` là où l'auteur écrivait du `strudel`. La casse est la même ; ce qui a disparu, c'est
  // le bruit qu'elle faisait. On mesure donc la SUBSTITUTION, qui est ce qui se passe réellement —
  // et c'est un témoin plus fort qu'un refus, parce qu'il nomme la valeur fausse au lieu de
  // constater qu'on s'est arrêté.
  const codeTeteSeule = 'core\nactor d  eval.strudel\n-----\nS -> d_r\nd_r -> `note("c3")`';
  const casse = compileToBPxAST(codeTeteSeule);
  const langages = [];
  const relever = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(relever); return; }
    if (/^Backtick/.test(o.type || '')) langages.push(o.payload?.interp ?? o.tag ?? null);
    Object.values(o).forEach(relever);
  };
  relever(casse.ast?.subgrammars);
  ok(langages.length === 1 && langages[0] !== 'strudel',
    `3quater. sur une voix de code, renommer la TÊTE SEULE casse — le bloc perd 'strudel'. Reçu `
    + `${JSON.stringify(langages)}`);
  ok(langages[0] === 'js',
    `3quater. et il tombe SILENCIEUSEMENT sur le socle 'js' — reçu ${JSON.stringify(langages[0])}. `
    + `C'est le prix du langage par défaut, et c'est pourquoi l'outil DOIT poser le tag : sans lui, `
    + `rien ne signale plus que le bloc a changé d'interprète.`);
  // ⚠️ CE TÉMOIN A ÉTÉ RETOURNÉ, ET LA DISTINCTION MÉRITE D'ÊTRE GARDÉE. Kanopi avait raison :
  // un acteur SANS moteur d'évaluation n'est PAS une voix de code, et ne compte pas dans le
  // dénombrement des voix à migrer — c'est le cas qu'il a testé avant de donner son chiffre.
  // MAIS la règle d'unicité, elle, refuse qu'une tête porte le nom d'UN acteur, quel qu'il soit.
  // L'outil doit donc migrer tout ce que la règle refuse, sinon il migre MOINS qu'elle ne refuse
  // et la différence tombe sur l'auteur, sans outil pour l'aider.
  // Ici : on renomme, et on ne pose AUCUN tag — il n'y a pas de code à qualifier.
  const sansEval = 'core\nalphabet.western\nactor v\n  alphabet.western\n  out.audio\n-----\nS -> v\nv -> C4 D4';
  const r2 = migrerSource(sansEval);
  ok(r2.ok && !r2.aucunChangement, '3quater. un acteur SANS moteur est migré aussi (la règle le refuse)');
  ok(!/`/.test(r2.source || ''), '3quater. et AUCUN tag n\'y est posé — il n\'y a pas de code');
  ok(/actor v/.test(r2.source || ''), '3quater. l\'acteur y garde également son nom');
}
{
  // ⚠️ LE POINT QUE L'ARCHITECTE A DEMANDÉ DE SOIGNER, dans les DEUX SENS. L'identifiant généré du
  // bloc de code change à la migration (il encode COMMENT le langage a été connu) et Romain l'a
  // écarté. Il est neutralisé PAR SA FORME — jamais par sa clé, qui est la même que celle portant
  // les notes. L'écarter par la clé rouvrirait le trou que Kanopi a trouvé le 2026-07-28.
  const { production } = await import('./migration_noms.mjs');
  // Les deux écritures VIVANTES du même bloc : l'acteur qui qualifie, et le tag. Elles ne
  // diffèrent que par l'identifiant généré — c'est lui qu'on neutralise.
  const avant = production('core\nactor d  eval.strudel\n-----\nS -> voix\nvoix -> d.`note("c3")`');
  const apres = production('core\nactor d  eval.strudel\n-----\nS -> voix\nvoix -> `strudel: note("c3")`');
  ok(!avant.erreur && !apres.erreur, '3quater. les deux témoins doivent se dériver');
  ok(avant.jetons === apres.jetons,
    '3quater. l\'identifiant généré est NEUTRALISÉ — la migration ne change pas la production');
  const h1 = production('core\nalphabet.western\n-----\nS -> E2 C4');
  const h2 = production('core\nalphabet.western\n-----\nS -> C7 C4');
  ok(h1.jetons !== h2.jetons,
    '3quater. ET une HAUTEUR qui change reste VUE — la neutralisation n\'a pas aveuglé la clé');
}

// ── 4. TÉMOIN ANTI-RÉTRÉCISSEMENT ────────────────────────────────────────────
ok(DETECTION.length >= 6 && VOISINS.length >= 10 && BACKTICKS.length >= 6,
    '4. les matrices ne se sont pas vidées');
{
  // Et que l'outil sait encore VOIR : sans ce témoin, une régression qui viderait la détection
  // rendrait « aucune collision partout » et tout ce fichier passerait au vert.
  const { ast } = compileToBPxAST('core\nalphabet.western\n-----\nG4 -> C4');
  ok(terminauxActifs(ast).size > 100, '4. l\'alphabet occidental doit rendre ses terminaux (témoin d\'instrument)');
}

if (echecs.length) {
  console.error(`[outil migration] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[outil migration] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
