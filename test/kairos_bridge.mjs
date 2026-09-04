/**
 * PONT KAIROS — résout une session BPx en jetons PORTEURS DE HAUTEUR.
 *
 * POURQUOI CE MODULE EXISTE (recadrage Romain, note [651]) : la mesure se fait EN SORTIE DE
 * KAIROS, jamais en sortie BPx. `session.emit('timed-tokens')` est PRÉ-RÉSOLUTION — il rend
 * le nom écrit, sans hauteur. Comparer là revenait à imputer au langage des écarts qui ne
 * sont que « la chaîne n'est pas branchée » : mon classement des DIFF en quatre causes
 * (transposition, degré, octave, durée) était en réalité UNE seule cause — Kairos absent.
 *
 * OÙ IL VIT, ET POURQUOI PAS AILLEURS : à CÔTÉ de `compare_modal.cjs`, jamais dedans. Le
 * comparateur est le juge unique des deux voies et doit rester ignorant de BPx et de Kairos —
 * il compare des jetons, il ne sait pas les fabriquer. Ce module fabrique ; l'autre juge.
 *
 * UNION DES CATALOGUES À L'EXÉCUTION (approuvé archi [641], co-signé bp3-frontend [643]) :
 * mes catalogues AGNOSTIQUES sont la base, chaque voie passe en paramètre ce qui lui est PROPRE
 * et il est fusionné ici. C'est ce qui permet à la Voie A d'apporter ses alphabets `bp3_*` sans
 * que j'installe du vocabulaire BP3 dans une librairie qui se veut agnostique du moteur.
 *
 * ⚠️ `bp3_indian` EST DÉSORMAIS DANS LA BASE, et ce n'est PAS une entorse — c'est une décision
 * DATÉE qui prime le principe ci-dessus (feedback « décision datée > commentaire de code »). La
 * saga diapason [347-352] (commit `4f9ab75`, « Arbitrage Romain via architecte [847] ») a fait
 * entrer `bp3_indian` au catalogue PROD `lib/alphabets.json` comme alphabet de test BP3 normal :
 * `vina`/`vina2` (voie B) DÉCLARENT `@alphabet.bp3_indian` et ont été CERTIFIÉES vert-prod dessus
 * ([845]). L'ancienne consigne « ne jamais déplacer bp3_indian dans lib/alphabets.json » est donc
 * PÉRIMÉE depuis [352]. Conséquence pour la Voie A : `bp3_indian` étant maintenant PARTAGÉ (base),
 * elle ne doit PLUS le passer en apport — sinon `unirCatalogues` voit la même clé des deux côtés
 * et JETTE (à raison : le garde interdit la double-fourniture). `bp3_english`/`bp3_fr`, eux, ne
 * sont PAS dans la base et RESTENT à la charge de la Voie A (apport).
 *
 * FORME D'APPEL — calquée sur le golden de Kairos (`kairos/src/projection/c4key-octave-e2e.test.ts`),
 * pour que A et B appellent d'une seule voix : `session.derive().tree`, puis
 * `session.buildProjectionContext('chronological')` (le hook que BPx expose EXPRÈS), puis
 * `projeter(tree, ctx).query(...)`. Trois pièges que j'ai payés : l'arbre est le RETOUR de
 * `derive()` (pas `_lastTree`), le contexte prend l'ORDRE en argument, et la Timeline se lit
 * par `.query(début, fin)` — sans quoi elle paraît vide.
 *
 * ⚠️ `digitalLib` SE PREND DANS LE BUNDLE (`libs-data.js`, `LIBS['digital']`), JAMAIS en
 * lisant `lib/digital.json` sur le disque. Les deux ne portent pas la même chose et c'est
 * VOULU : la vérité d'un corps de manipulation est son fichier `lib/digital/<nom>.ts` (typé
 * contre le SDK Kairos) ; l'étape de bundle en capte la SOURCE et l'injecte dans le bundle.
 * `digital.json` ne porte que la déclaration (description, rang, paramètres) — sans corps.
 *
 * J'ai payé cette distinction : en lisant le JSON du disque, mon pont ne voyait aucun corps,
 * Kairos criait « déclarée au vocabulaire mais SANS fonction exécutable », et j'en ai conclu
 * à tort que la lib était un catalogue de noms vides. Elle ne l'était pas — je lisais le
 * mauvais artefact. Ne jamais passer `{objects:{}}` non plus : un vocabulaire vide ferait
 * passer `transpose` pour un contrôle runtime ordinaire, transmis verbatim donc
 * SILENCIEUSEMENT ignoré. Le bundle, et rien d'autre.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { importerArtefact } from './artefact_voisin.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/**
 * Les catalogues de hauteur, côté bpscript — la BASE agnostique de l'union.
 *
 * `test_alphabets` est le SIXIÈME, ajouté le 2026-07-20 : il manquait, et son absence était
 * INVISIBLE. Une scène qui le déclare (`@test_alphabets.abc`) compilait sans une erreur, puis
 * ne produisait aucune hauteur — le fichier n'arrivait simplement jamais jusqu'à Kairos. Le
 * symptôme sortait tout en bas de la chaîne, très loin de sa cause, qui était ici.
 */
export const FICHIERS_HAUTEUR = ['alphabets', 'tunings', 'temperaments', 'scales', 'octaves', 'test_alphabets'];

function catalaguesDeBase() {
  // ⚠️ LA DONNEE SE PREND DANS LE BUNDLE, jamais a un chemin de fichier. Ce lecteur construisait
  // `lib/<axe>.json` : le jour ou un catalogue est passe en `.bpsl`, il a casse net. Le bundle est
  // la surface publiee — il rend la meme donnee quel que soit le format de la source.
  return Object.fromEntries(FICHIERS_HAUTEUR.map((n) => {
    require('../src/transpiler/index.js');
const LIBS = require('../src/transpiler/libs.js').leRegistre();
    const lib = LIBS[n];
    if (!lib) throw new Error(`kairos_bridge : l'axe '${n}' est absent du bundle des librairies.`);
    return [n, lib];
  }));
}

/**
 * Union catalogue de base ⊎ catalogue de la voie appelante. Fusion PAR AXE et par clé ;
 * l'appelant peut AJOUTER des entrées, jamais écraser silencieusement une entrée de base
 * portant le même nom — une collision est une erreur, pas une préférence (deux définitions
 * différentes du même nom rendraient A et B incomparables sans que rien ne le signale).
 */
export function unirCatalogues(base, apport = {}) {
  const out = {};
  for (const axe of FICHIERS_HAUTEUR) {
    const a = base[axe] || {};
    const b = apport[axe] || {};
    const collisions = Object.keys(b).filter(
      (k) => !k.startsWith('_') && k !== 'domain' && k !== 'resolvedBy'
          && Object.prototype.hasOwnProperty.call(a, k),
    );
    if (collisions.length) {
      throw new Error(
        `[pont-kairos] collision de catalogue sur '${axe}' : ${collisions.join(', ')}. `
        + `L'apport d'une voie AJOUTE des entrées, il n'en redéfinit aucune — sinon les deux `
        + `voies résoudraient le même nom différemment sans que la comparaison le voie. `
        + `Si une clé est DÉJÀ dans la base partagée(ex. bp3_indian depuis [352], commit 4f9ab75), `
        + `la voie doit CESSER de la passer en apport : la base la fournit à tous.`,
      );
    }
    out[axe] = { ...a, ...b };
  }
  return out;
}

/**
 * Résout une session BPx DÉJÀ construite en jetons porteurs de hauteur.
 *
 * @param session      session BPx (non dérivée : on appelle `derive()` ici pour tenir l'arbre).
 * @param opts.apport  catalogues propres à la voie appelante (fusionnés à la base).
 * @param opts.ordre   'chronological' (défaut) | 'voice-major'.
 * @returns {{tokens: Array<{token,start,end,hz}>, duration: number}}
 *          `start`/`end` en MILLISECONDES — l'unité de la forme canonique de parité
 *          (`kairos/docs/PROJECTION.md` §2) et celle des captures natives. Kairos rend des
 *          secondes ; la conversion vit ici, pas chez le comparateur.
 */
export async function resoudreViaKairos(session, opts = {}) {
  const { projeter } = await importerArtefact('kairos');
  const pitchLib = unirCatalogues(catalaguesDeBase(), opts.apport);
  // Le BUNDLE, pas le JSON du disque : lui seul porte les corps (cf. en-tête).
  require('../src/transpiler/index.js');
const LIBS = require('../src/transpiler/libs.js').leRegistre();
  const digitalLib = LIBS.digital;
  // ⚠️ UNE SCÈNE QUI INVOQUE UN FICHIER DE LIBRAIRIE LE FAIT CHERCHER DANS LE CATALOGUE, PAS DANS
  // UNE CLÉ DE CONTEXTE À PART. Kairos porte deux mécanismes distincts qui lisent la MÊME librairie
  // par deux chemins, et n'en câbler qu'un fait TOMBER la scène :
  //   · `homomorphismeLib` (contexte) alimente le SUBSTITUTEUR d'étiquettes ;
  //   · `pitchLib['<fichier>']` alimente la RÉSOLUTION DE PROVENANCE, qui honore les déclarations
  //     que l'arbre porte dans `metadata.sceneLibs` (`homomorphism.dhati`, `settings.notreich`…).
  // Je ne câblais que le premier, et la provenance REFUSAIT BRUYAMMENT tout fichier invoqué.
  //
  // ⚠️ ET LA PORTÉE SE PREND SUR CE QUE LA LIBRAIRIE DÉCLARE, PAS SUR LE NOM QUI A ÉCHOUÉ. Ma
  // première réparation ne posait que `homomorphism`, parce que c'est le nom que le refus m'avait
  // montré ; la campagne suivante a fait tomber `settings.notreich` et `sound.tabla_perc` par le
  // MÊME mécanisme. Le trou n'est pas un fichier, c'est l'ADRESSAGE — d'où un critère et non une
  // liste : est un fichier de la fabrique de Kairos celui qui DÉCLARE l'axe qu'il alimente
  // (`resolves`). Offrir les autres est pire que ne rien offrir : `settings` est résolue par BPx,
  // et la présenter change le refus « fichier introuvable » en « champ resolves ABSENT ». Kairos ne
  // parse que ce qui est réellement invoqué, donc les fichiers non sollicités ne coûtent rien.
  // Les six AXES gardent leur contenu de catalogue : ils sont posés à part, et ce sont eux qui font foi.
  const axes = new Set(FICHIERS_HAUTEUR);
  for (const [nom, fichier] of Object.entries(LIBS)) {
    if (!axes.has(nom) && fichier && typeof fichier === 'object' && fichier.resolves) pitchLib[nom] = fichier;
  }
  // REGISTRE D'HOMOMORPHISME — jumeau structurel de `digitalLib`, et il manquait.
  //
  // Kairos SUBSTITUE l'étiquette à la résolution (modèle carry-only : BPScript porte la
  // table, BPx la porte aussi sans réécrire l'arbre, Kairos résout). Sa fabrique de
  // substituteur rend `undefined` si la LIB *ou* les tables manquent, et retombe alors sur
  // l'identité — donc des terminaux BRUTS, sans la moindre erreur. Tables présentes mais
  // lib absente : c'était exactement notre symptôme sur `tryhomomorphism`.
  //
  // ⚠️ Passer cette lib n'est sûr QUE parce que BPx est carry-only sur ce chemin. La preuve
  // est dans la mesure elle-même : l'arbre dérivé rend le jeton BRUT `a`, pas `do4` déjà
  // substitué. Si la substitution avait lieu en amont, l'ajouter ici la DOUBLERAIT.
  const homomorphismeLib = LIBS.homomorphism;

  const tree = session.derive().tree;
  // ⚠️ LE TYPE DÉCLARÉ SE PREND ICI, ET NULLE PART AILLEURS EN AVAL. La règle de comparaison
  // (décision Romain du 2026-08-12) dit que ce qui compte comme terminal se prend sur le TYPE
  // DÉCLARÉ, jamais sur la durée. BPx le déclare — `terminal`, `rest`, `control` — et c'est le seul
  // étage de la chaîne à le faire : Kairos garde le jeton et perd le type, Kronos retire ensuite les
  // silences. Sans ce relevé, mon point de mesure n'a AUCUN critère et je filtrerais sur la graphie
  // du jeton, ce qui n'est ni la durée ni le type.
  const jetonsBPx = (() => {
    const tt = session.emit('timed-tokens');
    return Array.isArray(tt) ? tt : (tt && tt.tokens) || [];
  })();
  const contexte = {
    ...session.buildProjectionContext(opts.ordre || 'chronological'),
    pitchLib,
    digitalLib,
    homomorphismeLib,
  };
  const timeline = projeter(tree, contexte);

  // Le TEMPS devient réel ici, et nulle part ailleurs : Kronos possède l'unique pont
  // t_scène ↔ t_audio (forme d'appel donnée par kronos, note [301], `resolveSchedule`).
  // Déterministe : horloge virtuelle, aucun temps réel, deux appels rendent le même flux.
  // `derivedTempo` est le tempo FROID de la dérivation, pas un tempo de session.
  const { resolveSchedule } = await importerArtefact('kronos');
  // Forme de retour `{ events, totalDurationSec }` (kronos [302], 5ceaeec — la note [301]
  // rendait un tableau nu). La durée totale vient de Kronos : c'est LUI qui résout le temps,
  // la `duration` de la Timeline Kairos est encore en secondes de SCÈNE.
  // LA TRONCATURE D'AVANT-ORIGINE SE RECUEILLE EN DONNÉE, PAS SUR LA CONSOLE.
  //
  // La tête de lecture de Kronos part de l'origine : tout ce qui la précède n'est jamais
  // ordonnancé et manque à l'axe SONNANT, dont les bornes viennent de lui. Kronos rend ce fait
  // bruyant depuis 4601ccd (préavis [1517]) — un avertissement sur la console est exactement ce
  // qu'on finit par prendre pour du bruit. On le capte donc par son canal, et on le REPASSE au
  // puits par défaut : capter n'est pas faire taire, et les autres diagnostics ne sont pas à moi.
  const troncatures = [];
  const planifie = resolveSchedule(timeline, {
    derivedTempo: tree.metadata?.tempo,
    onDiagnostic: (d) => {
      if (d && d.code === 'content-before-origin') troncatures.push(d);
      console.warn(`[kronos] ${d?.message ?? JSON.stringify(d)}`);
    },
  });
  const avantOrigine = troncatures.length
    ? `${troncatures.reduce((n, d) => n + d.count, 0)} événement(s) précèdent l'origine et ne sont PAS `
      + `ordonnancés (le plus précoce à ${troncatures[0].firstOnset} s de scène) — l'axe sonnant, dont `
      + 'les bornes viennent de Kronos, est incomplet'
    : undefined;

  // TYPE DÉCLARÉ, REPORTÉ RANG À RANG — et le rang n'est légitime que PROUVÉ.
  //
  // La Timeline de Kairos et les jetons timés de BPx décrivent la même dérivation dans le même
  // ordre : mesuré sur le corpus, 64 grammaires sur 70 s'apparient rang à rang avec le MÊME jeton.
  // Les six autres se répartissent en deux familles, et elles ne se traitent pas pareil :
  //   · quatre voient le JETON changer sans que le rang bouge — c'est le travail de Kairos, qui
  //     substitue l'étiquette (`a` → `do4`) ou renomme après transposition. L'appariement tient.
  //   · deux ont un ÉVÉNEMENT DE MOINS chez Kairos que chez BPx (`transposition3` 52 contre 53,
  //     `visser-shapes` 2129 contre 2130). Là, le rang MENT à partir du décrochage, et poser le
  //     type sur la feuille suivante serait un instrument qui se trompe en silence sur toute la
  //     queue de la scène.
  // On refuse donc le report quand les comptes ne coïncident pas, plutôt que de le deviner :
  // `type` reste alors ABSENT et `typeIndisponible` dit pourquoi. Une absence déclarée se lit ;
  // un type faux ne se voit pas. Le désaccord de comptes lui-même appartient à BPx et à Kairos.
  // ⚠️ MA FENÊTRE DE LECTURE COMMENÇAIT À ZÉRO, ET C'ÉTAIT ELLE QUI FABRIQUAIT LE DÉSACCORD.
  //
  // Kairos publie des scènes ENTIÈREMENT TRANSLATÉES d'un décalage d'origine : leur premier
  // instant est NÉGATIF. En lisant à partir de 0 je coupais ces événements, puis j'imputais le
  // manque à un désaccord de comptes entre BPx et Kairos — que j'ai remonté comme tel. C'était
  // ma fenêtre. Correspondance exacte, mesurée le 2026-08-12 sur l'avertissement de troncature
  // que Kronos a rendu visible (4601ccd) : `transposition` 150 contre 143 et SEPT événements
  // avant l'origine ; `transposition3` 53 contre 52 et UN ; `visser-shapes` 2130 contre 2129 et
  // UN. Trois scènes, trois comptes, trois fois le même écart.
  //
  // ⛔ ET LA RAISON QUE J'AVAIS ÉCRITE ICI ÉTAIT FAUSSE — je la retire, la fenêtre reste.
  // J'avais justifié cette ouverture par « la référence fait foi et elle porte des instants avant
  // zéro ». Le natif n'en porte AUCUN : mesuré par bp3-engine sur le binaire, son premier NoteOn
  // et son premier événement sont à 0,0 ms. Le -10 vient de l'axe des JETONS, qui est notre propre
  // ajout et retranche la quantification aux DEUX bornes (TokensOut.c:86). Nos trois mesures
  // concordantes n'étaient pas trois observations : c'était le même code lu trois fois.
  //
  // CE QUI RESTE VRAI, et qui suffit à ouvrir la fenêtre : c'est KAIROS qui publie des scènes
  // translatées, dont le premier instant est négatif. Lire à partir de zéro coupait ces
  // événements et me faisait imputer le manque à un désaccord entre mes voisins. La fenêtre ne
  // fabrique rien — elle cesse de couper. `MIN_SAFE_INTEGER` plutôt qu'un zéro décalé à la main :
  // une borne choisie sur le décalage observé se périmerait au premier décalage plus grand.
  const evenementsKairos = timeline.query(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  const rangsAlignes = jetonsBPx.length === evenementsKairos.length;
  const typeParContenu = new Map();
  if (rangsAlignes) {
    for (let i = 0; i < evenementsKairos.length; i += 1) {
      const c = evenementsKairos[i].content;
      if (c) typeParContenu.set(c, jetonsBPx[i].type);
    }
  }
  const typeIndisponible = rangsAlignes ? undefined
    : `BPx rend ${jetonsBPx.length} jetons, Kairos ${evenementsKairos.length} événements — le report du `
      + 'type déclaré rang à rang mentirait à partir du décrochage';

  const tokens = [];
  for (const e of planifie.events) {
    const c = e.content;
    // ⚠️ CE FILTRE PORTAIT SUR LA HAUTEUR, ET C'ÉTAIT UN DÉFAUT DE MESURE.
    // Il écartait toute feuille sans `pitch` — donc TOUTE LA PERCUSSION. Les grammaires de
    // bols (dhati2, la famille tabla) dérivent parfaitement : mesuré sur dhati2, Kronos rend
    // 12 événements, tous porteurs d'un jeton (`dha`, `ti`, `trkt`…), et TOUS sans hauteur.
    // Le pont les jetait tous et je lisais « 0 jeton », que j'ai failli imputer à la dérivation.
    // Un bol n'a pas de hauteur et n'a pas à en avoir : la référence native de ces grammaires
    // est de modalité TEXTE et ne compare que des NOMS.
    // Ce qui fait qu'une feuille est mesurable, c'est donc qu'elle porte un JETON — pas une
    // hauteur. La hauteur reste facultative et n'est jamais inventée : `hz` n'est renseigné
    // que lorsque Kairos l'a réellement résolu.
    if (!c || c.token === undefined) continue;
    tokens.push({
      // Le terminal ÉCRIT dans la scène — le contrat de ce champ NE CHANGE PAS. Plusieurs lecteurs
      // INDEXENT par lui pour retrouver une feuille (`bp3_indian_ancre.mjs:37` construit sa carte
      // nom→Hz sur `sa4`/`sa00`) : le remplacer leur retire leur clé (mesuré : 8 OK → 8 FAIL, NaN).
      token: c.token,
      // ⚠️ NOM COMPARABLE = LE RÉSOLU, À CÔTÉ du nu, jamais À LA PLACE (arbitrage archi [907],
      // mécanisme 1 — « côté MESURE uniquement »). La règle gravée dit : la mesure se fait EN SORTIE
      // de Kairos, donc sur le RÉSOLU ; les captures natives portent des noms résolus (do2 après un
      // chromashift:-12, E3 après un +12), pas le littéral de la scène. Kairos grave ce nom dans
      // `content.pitch` (noteName + altération + registre) et JAMAIS dans `content.token`, dont le
      // contrat d'événement ne change pas(refus archi). Comparer le nu imputait un DIFF d'octave à
      // une hauteur JUSTE (mesuré : acceleration E2 nu → E reg 3 résolu = natif E3). Seule la MESURE
      // (`voie_b_status.mjs`) lit ce champ ; les gardes gardent le nu.
      nomResolu: nomComparable(c),
      start: Math.round(e.onset * 1000),
      end: Math.round((e.onset + e.duration) * 1000),
      hz: c.pitch ? c.pitch.hz : undefined,
      // ⚠️ UNE HAUTEUR REFUSEE N'EST PAS UNE ABSENCE DE HAUTEUR — et mon pont confondait les deux.
      // Kairos grave `content.pitchError` quand une manipulation echoue (fail lourd LOCAL : la feuille
      // n'emet PAS de hauteur fausse, la projection continue). Je ne lisais que `content.pitch` : une
      // feuille REFUSEE ressortait donc `hz: undefined`, exactement comme un bol qui n'a pas de hauteur.
      // Mesure : mes 28 feuilles « nues » de tryKeyXpand ETAIENT 28 refus explicites, chacun nomme avec
      // sa manipulation et sa raison. J'ai conclu « le fail-loud ne se declenche pas » alors qu'il
      // criait et que c'est moi qui n'ecoutais pas. Le champ est ADDITIF : les lecteurs existants
      // (mesure ISO, gardes) ne changent pas, ils gagnent seulement de quoi distinguer les deux cas.
      // Forme MESUREE de `content.pitchError` : `{manipulation, message}` DIRECTEMENT — pas d'enveloppe
      // `{erreur:{…}}`, contrairement à ce que le type `PitchErreur` de la couture laisse croire. Ma
      // première réparation lisait `.erreur` et rendait `undefined` sur les 28 refus : un instrument
      // réparé de travers ment aussi bien qu'un instrument cassé.
      erreurHauteur: c.pitchError,
      // ⚠️ LE TYPE DÉCLARÉ, À CÔTÉ du reste — même discipline que `nomResolu` à côté du nu. C'est
      // le CRITÈRE de la règle 3 : `terminal` sonne, `rest` occupe du temps sans sonner, `control`
      // n'est un terminal sur aucun axe. Absent quand le report n'a pas pu être prouvé sûr.
      type: typeParContenu.get(c),
    });
  }

  // ⚠️ LE FLUX COMPLET, À CÔTÉ DU FLUX PLANIFIÉ — parce que l'axe TEXTE a besoin de ce que le
  // planifié n'a plus. Kronos ordonnance ce qui s'exécute et RETIRE les silences (mesuré : Alarm 33
  // événements Kairos pour 31 planifiés, ek-do-tin 89 pour 78). Or l'axe TEXTE se définit comme « ce
  // que le natif imprime, silences compris » : sept captures textuelles natives en portent, jusqu'à
  // 652 sur 3860. Les chercher dans le planifié serait les chercher là où ils n'existent plus.
  // `tokens` garde donc son contrat — le flux ORDONNANCÉ, ce que les lecteurs existants indexent —
  // et le flux complet vient à côté, jamais à la place. Les instants viennent du planifié par
  // IDENTITÉ de contenu (mesuré : 100 % des événements planifiés se retrouvent ainsi, sur toutes les
  // scènes éprouvées) ; ce qui n'est pas ordonnancé n'en a pas, et on n'en invente pas.
  const instantsParContenu = new Map();
  for (const e of planifie.events) if (e.content) instantsParContenu.set(e.content, e);
  const tousLesJetons = [];
  for (const ev of evenementsKairos) {
    const c = ev.content;
    if (!c || c.token === undefined) continue;
    const planifiee = instantsParContenu.get(c);
    tousLesJetons.push({
      token: c.token,
      nomResolu: nomComparable(c),
      type: typeParContenu.get(c),
      start: planifiee ? Math.round(planifiee.onset * 1000) : undefined,
      end: planifiee ? Math.round((planifiee.onset + planifiee.duration) * 1000) : undefined,
      hz: c.pitch ? c.pitch.hz : undefined,
      erreurHauteur: c.pitchError,
    });
  }

  return { tokens, tousLesJetons, typeIndisponible, avantOrigine, duration: planifie.totalDurationSec };
}

/**
 * Nom COMPARABLE d'une feuille : le nom RÉSOLU par Kairos quand la hauteur existe, le terminal NU
 * sinon (percussion/silence). Le résolu se compose de la facette `content.pitch` — `noteName` +
 * `alteration` (orthographe enharmonique, `null` = aucune) + `register` (octave) — dans la notation
 * de l'alphabet de la grammaire. Repli sur le nu si la facette est incomplète (jamais un nom inventé).
 */
function nomComparable(c) {
  const p = c.pitch;
  // `registerName` = l'ÉTIQUETTE DE REGISTRE TELLE QUE LA SCÈNE L'ÉCRIT (Kairos 6053fbb), une
  // CHAÎNE — et c'est elle qu'il faut, jamais `register`. Deux raisons mesurées :
  //  1. `register` est l'INDEX CANONIQUE, qui peut légitimement différer de l'étiquette : `vina`
  //     écrit `sa3`, sort hz 130.81 (le do3 natif, juste) mais index 4. Composer sur l'index
  //     fabriquait `sa4` et faisait passer une scène JUSTE pour divergente (les faux-ISO
  //     démasqués que j'avais remontés : vina, vina2, et kss2 trouvée par Kairos).
  //  2. Cinq conventions de registre sur neuf nomment leurs registres avec des MOTS (`madhya`
  //     en saptak, une flèche en arrows) : un numéro d'octave ne pouvait pas les rendre.
  // ABSENCE ≠ VALEUR PAR DÉFAUT (rappel Kairos) : une facette sans étiquette n'est jamais comblée.
  // Sans étiquette on retombe donc sur le terminal ÉCRIT, jamais sur l'index — qui donnerait un
  // nom plausible et faux.
  if (!p || p.noteName === undefined || p.noteName === null
      || p.registerName === undefined || p.registerName === null) {
    return c.token;
  }
  return `${p.noteName}${p.alteration ?? ''}${p.registerName}`;
}
