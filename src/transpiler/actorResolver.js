// AUTORITÉ résolution acteur / pitch / contrôles : LIRE src/transpiler/_AUTORITE.md avant de modifier.
/**
 * BPScript Actor Resolver
 *
 * Resolves actor bindings at compile time:
 * 1. Loads each actor's alphabet → expands terminals (notes × alterations × registers)
 * 2. Builds symbolActorMap: terminal → actor(s) that own it
 * 3. Resolves implicit actor on Symbol nodes (when unambiguous)
 * 4. Detects conflicts (ambiguous symbol without dot notation)
 *
 * Called between parser and encoder. If no actors are declared, returns empty tables.
 */

import { loadLib, resolveActorAlphabet, nomsDeTerminaux} from './libs.js';
import { lesDefauts, objet, famille } from './index-des-objets.js';

/**
 * Expand an alphabet lib into a set of terminal names.
 * Mirrors the logic in libs.js loadLibsFromDirectives (terminal generation).
 *
 * @param {Object} alphabetLib - alphabet entry from alphabets.json (has notes, alterations, octaves)
 * @returns {Set<string>} set of terminal names
 */
function expandAlphabetTerminals(alphabetLib, octavesOverride) {
  const terminals = new Set();
  if (!alphabetLib || !nomsDeTerminaux(alphabetLib)) return terminals;

  // Resolve octave convention. Décision cles-acteur-six (Romain 2026-06-16) :
  // `actor X octaves.Y` SURCHARGE la convention de registre ; sinon défaut =
  // convention héritée de l'alphabet (alphabetLib.octaves).
  const octaveConvention = octavesOverride != null ? octavesOverride : alphabetLib.octaves;
  // ⛔ UNE CONVENTION DE REGISTRE SE CHARGE PAR LA PORTE, ET ELLE PORTE SES RANGS. Cette ligne
  // lisait `loadLib('octaves')?.[nom]` — une propriété prise directement sur le fichier, donc TOUT
  // champ de fichier passait pour une convention. Mesuré le 2026-08-24 :
  //     octaves.resolvedBy    ⛔ PLANTAGE  « octaveDef.registers is not iterable »
  //     octaves.documented    ⛔ le même, par le champ posé ce jour-là
  // Pas un refus : une EXCEPTION, jetée avant le validateur qui aurait nommé la référence — la
  // classe de faute que ce dépôt a déjà tranchée pour un caractère illisible. La porte écarte les
  // champs de fichier, et `registers` est exigé plutôt qu'espéré : une entrée mal formée retombe
  // sur les notes nues, et le validateur de références dit son mot.
  // ⚠️ UN REGISTRE EST UN RANG DE HAUTEUR : un alphabet qui ne résout aucune hauteur (`resolvesPitch:
  // false` — tabla, dhati, abc…) écrit ses terminaux nus, quelle que soit la convention d'octaves
  // qu'il porte. Depuis que `def alphabet` déclare l'octaviation par défaut et que chaque alphabet en
  // hérite (Romain, 2026-09-02), la convention est TOUJOURS là ; c'est la donnée `resolvesPitch` qui
  // dit si elle a un sens. Mesuré : sans cette ligne, `tabla.dhin` devenait `dhin0`…`dhin9`.
  const candidate = octaveConvention && alphabetLib.resolvesPitch !== false ? loadLib('octaves', octaveConvention) : null;
  const octaveDef = candidate && Array.isArray(candidate.registers) ? candidate : null;

  const alts = alphabetLib.alterations && typeof alphabetLib.alterations === 'object'
      && !Array.isArray(alphabetLib.alterations)
    ? Object.keys(alphabetLib.alterations)
    : (Array.isArray(alphabetLib.alterations) && alphabetLib.alterations.length > 0
        ? alphabetLib.alterations : ['']);

  for (const note of nomsDeTerminaux(alphabetLib)) {
    if (octaveDef) {
      for (const alt of alts) {
        for (const reg of octaveDef.registers) {
          const noteAlt = note + alt;
          const terminal = octaveDef.position === 'suffix'
            ? noteAlt + octaveDef.separator + reg
            : reg + octaveDef.separator + noteAlt;
          terminals.add(terminal);
        }
      }
    } else {
      // No octaves — raw notes (e.g. tabla, abc)
      terminals.add(note);
    }
  }

  return terminals;
}

/**
 * L'ALPHABET HÉRITÉ PAR UNE SCÈNE — la cascade @core → scène, DÉFINIE UNE SEULE FOIS.
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE, ET C'EST UNE FAUTE PAYÉE, PAS UN REFACTOR (2026-07-29).
 * Cette cascade vivait ICI et ne s'appliquait qu'aux acteurs DÉCLARÉS. L'acteur implicite, lui,
 * est fabriqué plus tard (`bpxAst.applyDefaultActor`) et naissait SANS alphabet — donc une scène
 * qui ne déclare aucune convention de notes sortait de chez moi avec un ensemble de terminaux
 * VIDE. Mesuré : 91 scènes sur 263 (bibliothèque Kanopi 279a533 + démos de ce dépôt).
 *
 * CE QUE ÇA COÛTAIT EN AVAL, et c'est le vrai dégât : tout ce qui demande « est-ce une note ? »
 * se taisait sur ces scènes — la règle d'unicité des noms comme le refus d'un terminal inconnu.
 * Un consommateur ne pouvait pas le savoir : un ensemble vide et un ensemble non calculé ont
 * exactement la même tête. Verdict de Romain (2026-07-29) : « ça ne devrait JAMAIS ARRIVER ».
 *
 * LE PRINCIPE N'EST PAS DE MOI — il est RATIFIÉ et daté : `docs/design/SCENE_DEFAULTS_CASCADE.md`
 * (Romain, 2026-07-04), « tout ce qu'une scène peut définir a un défaut, et ce défaut vit dans une
 * librairie », « un paramètre définissable n'est jamais inexistant ». Son étape 2 (étendre aux
 * autres axes) n'avait jamais été faite. L'AST SORT COMPLET : un consommateur n'a rien à compléter,
 * et surtout rien à DEVINER.
 *
 * LA SEULE ABSENCE LÉGITIME reste la hauteur OPAQUE (loi 35) : quand la scène invoque une identité
 * de hauteur par le canal neutre, l'alphabet n'est pas résolvable ici et Kairos le remplit. Poser
 * le socle @core par-dessus un composant invoqué serait le bug diapason du 2026-07-04 à l'envers.
 *
 * @returns {string|null} le nom de l'alphabet hérité, ou null si la hauteur est opaque
 */
function alphabetHerite(ast) {
  const sceneAlpha = (ast.directives || []).find((d) => d.name === 'alphabet' && d.subkey);
  // ⚠️ ON NE MATÉRIALISE QUE CE QUI RÉSOUT — même règle que pour les registres, et pour la même
  // raison, mesurée le 2026-08-07 : un `alphabet.zzz` inexistant était RECOPIÉ sur l'acteur
  // implicite, et le contrôle des références le refusait DEUX FOIS — une pour la directive, une
  // pour la copie. Un même défaut qui parle deux fois se lit comme deux défauts ; la scène en a un.
  // Le cri reste, à sa place, sur la directive.
  if (sceneAlpha) {
    return resolveActorAlphabet(sceneAlpha.subkey, ast.directives) ? sceneAlpha.subkey : null;
  }
  // ⛔ LE DÉFAUT VIENT DE CE QUE LA SCÈNE INVOQUE, ET DE RIEN D'AUTRE — Romain, 2026-09-02 : `core`
  // déclare un alphabet par défaut, effectif quand `core` est invoqué, surchargé quand la scène ou un
  // acteur déclare le sien. Ce qui vivait ici — « une invocation de scène coupe la cascade, la
  // hauteur est opaque » — coupait le défaut dès qu'un tempérament ou un son était invoqué, et sort.
  return (lesDefauts(ast) || {}).alphabet || null;                       // niveau 1 : le défaut invoqué
}

/**
 * LA CONVENTION DE REGISTRES HÉRITÉE — même cascade, deuxième axe (2026-07-29).
 *
 * Elle sortait à vide dans 251 scènes sur 263, y compris quand la scène ÉCRIT `octaves.saptak`
 * noir sur blanc : la directive était lue par le validateur de terminaux et par PERSONNE d'autre,
 * donc l'arbre ne la portait nulle part. Deux définitions de « quels sont les terminaux ici » qui
 * ne lisaient pas les mêmes registres — la famille de défaut que je paie le plus souvent.
 *
 * ⚠️ ET LE SOCLE @core S'ARRÊTE ICI, DÉLIBÉRÉMENT, PARCE QUE C'EST MESURÉ. `defaults.components
 * .octaves` vaut `western`. L'appliquer à un alphabet qui ne déclare AUCUN registre le casserait :
 * `expandAlphabetTerminals` traite ce cas comme « notes nues » (« No octaves — raw notes, e.g.
 * tabla ») — les 39 terminaux de `tabla` deviendraient octaviés et aucune scène de tabla ne
 * reconnaîtrait plus ses propres frappes. L'absence de registres n'est donc PAS un trou : c'est
 * une VALEUR, et le document de cascade le dit à sa façon (« invoquer @alphabet.X recouvre
 * l'octavation »). Conséquence à reporter, pas à masquer : l'entrée `octaves` de @core n'est plus
 * atteignable une fois qu'un alphabet est toujours résolu — c'est une donnée morte, et l'arbitrage
 * de son sort appartient à Romain, pas à ce fichier.
 *
 * @returns {string|undefined} la convention de registres, ou undefined = notes nues (une VALEUR)
 */
function octavesHerite(ast, alphabetKey) {
  // ⚠️ ON NE MATÉRIALISE QUE CE QUI RÉSOUT, et ce n'est pas de la prudence : une convention que le
  // catalogue ne connaît pas n'a AUCUNE valeur effective à porter. Sans ce filtre, un
  // `octaves.nexistepas` était recopié sur l'acteur et le validateur de références le refusait
  // DEUX FOIS — une pour la directive, une pour la copie. Un même défaut qui parle deux fois se
  // lit comme deux défauts ; la scène en a un. Le cri reste, à sa place, sur la directive.
  const connu = (nom) => { if (!nom) return false; const o = objet(`octaves.${nom}`); return !!(o && !o.ambigu); };
  const sceneOct = (ast.directives || []).find((d) => d.name === 'octaves' && (d.subkey || d.runtime));
  if (sceneOct) {
    const nom = sceneOct.subkey || sceneOct.runtime;                     // niveau 3 : la scène
    return connu(nom) ? nom : undefined;
  }
  if (!alphabetKey) return undefined;
  // niveau 2 : l'alphabet invoqué — lu par la porte, qui rend ses membres PROPRES ET HÉRITÉS : un
  // alphabet qui n'écrit pas ses octaves porte celles de son prototype (Romain, 2026-09-02).
  const o = objet(`alphabet.${alphabetKey}`);
  const oct = o && !o.ambigu ? o.membres.octaves : undefined;
  return connu(oct) ? oct : undefined;
}

/**
 * L'ACCORDAGE HÉRITÉ — il se LIT sur l'alphabet actif, qui le déclare.
 *
 * ⚠️ CETTE FONCTION EXISTE PARCE QUE J'AI REFUSÉ DE L'ÉCRIRE HIER, ET C'ÉTAIT LE BON REFLEXE.
 * @core porte `defaults.components.tuning: western_12TET`. Le poser sur une scène sargam ou
 * gamelan est une AFFIRMATION MUSICALE que je ne sais pas prouver — j'ai donc laissé l'axe à vide
 * sur 230 scènes et je l'ai escaladé plutôt que de trancher une question de sens par une
 * compilation. Réponse de Romain, verbatim (courrier du 2026-07-29) : « l'accordage par défaut de
 * chaque alphabet doit être DANS L'ALPHABET, c'est déjà géré, pas besoin d'accordage par défaut
 * dans core ».
 *
 * ⛔ ET LA CITATION DIT « PAS BESOIN », JAMAIS « JAMAIS ». Le titre de ce bloc a porté pendant trois
 * semaines « il vient de l'alphabet, JAMAIS du socle @core (Romain) » — un durcissement de MA main,
 * signé de SON nom et daté de son message. Romain répondait à ma réserve (je refusais de POSER une
 * valeur musicale) ; il disait que je n'ai pas à m'en servir, pas que l'entrée doit disparaître.
 * L'entrée `tuning` du socle reste, et cette fonction ne la lit pas : les deux tiennent ensemble.
 * Une citation exacte sous une phrase qui la durcit se relit comme une décision qui n'a pas été
 * prise — et c'est la faute la plus chère du dépôt, parce que personne ne rouvre le courrier.
 *
 * Donc je n'ai JAMAIS à poser cette valeur : je la LIS sur l'alphabet actif, qui la déclare
 * (`defaultTuning`). western → western_12TET, sargam → sargam_12TET, arabic → arabic_24TET,
 * turkish → turkish_53TET, bohlen_pierce → bohlen_pierce_equal, shruti23 → shruti23_native.
 * Trois alphabets n'en déclarent aucun (tabla, simple, shakuhachi) : la valeur reste ABSENTE, ce
 * qui est un FAIT porté par la donnée et non une ignorance de ma part.
 *
 * ⚠️ ET UNE ANOMALIE DE DONNÉE, MESURÉE, QUE JE NE CORRIGE PAS ICI : `shakuhachi` n'a pas de
 * `defaultTuning` alors que ses altérations `meri`/`kari` (menton bas / menton haut) SONT des
 * inflexions de hauteur. Son absence ressemble à un trou de donnée, pas à « cet alphabet ne
 * résout pas de hauteur ». Signalé à l'architecte ; se répare dans la librairie, pas par une
 * exception dans ce fichier.
 *
 * @returns {string|undefined} l'accordage effectif, ou undefined = l'alphabet n'en déclare pas
 */
function tuningHerite(ast, alphabetKey) {
  // ⛔ L AXE EST LE MOT DECLARE, JAMAIS LE NOM DU FICHIER (Romain, 2026-08-17). Cet appel disait
  // `tunings` — le fichier — et court-circuitait l axe que toute scene ecrit. Les deux portes
  // rendent le meme objet sur les 19 entrees reelles, et null / undefined sur l inexistant :
  // la bascule est mecanique, et ce qui change est l ADRESSE, pas le resultat.
  const connu = (nom) => !!(nom && loadLib('tuning', nom));
  const sceneTun = (ast.directives || []).find((d) => d.name === 'tuning' && d.subkey);
  if (sceneTun) return connu(sceneTun.subkey) ? sceneTun.subkey : undefined;  // niveau 3 : la scène
  if (!alphabetKey) return undefined;
  const lib = resolveActorAlphabet(alphabetKey, ast.directives);              // niveau 2 : l'alphabet
  // `defaultTuning` a pris le nom que la référence lui donne — `tuning` — au reformatage du
  // 2026-08-08. Un seul nom pour la même chose, celui de la spécification.
  return connu(lib && lib.tuning) ? lib.tuning : undefined;
}

// Transport par défaut de l'acteur IMPLICITE — lu DANS core (donnée : `defaults.components
// .transport`), plus de constante en dur (cascade de défauts, Romain 2026-07-05). Le repli
// 'audio' n'est atteint QUE si core est absent/cassé (bug de config) — pas un défaut normal.
function defaultActorTransport(ast) {
  return (lesDefauts(ast) || {}).transport || 'audio';
}

/**
 * LA SORTIE HÉRITÉE — quatrième axe de la cascade, et le plus trompeur des cinq.
 *
 * ⚠️ CE QU'IL FAISAIT AVANT LE 2026-08-07, et pourquoi c'est pire qu'un trou. Les trois axes de
 * hauteur au-dessus sortaient ABSENTS quand la scène ne les écrivait pas — visible. La sortie,
 * elle, sortait PRÉSENTE et FAUSSE : l'acteur implicite recevait toujours `audio`, le défaut du
 * socle, même quand la scène écrivait `out.midi` noir sur blanc. Un consommateur ne pouvait pas
 * le savoir — une valeur par défaut et une valeur ignorée ont exactement la même tête. C'est le
 * mode d'échec MUET, celui qu'aucun garde ne signale parce que rien ne manque.
 *
 * Et l'écriture était refusée au parse depuis le 2026-08-04, ce qui masquait le reste : on ne
 * mesure pas la descente d'une directive qu'on interdit d'écrire.
 *
 * LA CASCADE, dans l'ordre : ce que la scène écrit (`out.midi(ch:1)`) → le raccord de sortie posé
 * sur l'alphabet (`alphabet.X:midi`, canon 2026-07-05) → le défaut du composant (`lib/core.json`).
 * Les deux premiers disent LA MÊME CHOSE par deux écritures ; s'ils se contredisent, on refuse en
 * les nommant tous les deux plutôt que d'en élire un en silence.
 *
 * @returns {{key: string, params: object, conflit: object|null}}
 */
function sortieHeritee(ast) {
  const sceneOut = (ast.directives || []).find((d) => d.name === 'out' && d.subkey);
  const alphaBinding = (ast.directives || []).find((d) => d.name === 'alphabet' && d.runtime);
  if (sceneOut && alphaBinding && alphaBinding.runtime !== sceneOut.subkey) {
    return { key: sceneOut.subkey, params: sceneOut.params || {},
             conflit: { ecrite: sceneOut.subkey, raccord: alphaBinding.runtime,
                        alphabet: alphaBinding.subkey, line: sceneOut.line || 0 } };
  }
  if (sceneOut) return { key: sceneOut.subkey, params: sceneOut.params || {}, conflit: null };
  if (alphaBinding) return { key: alphaBinding.runtime, params: {}, conflit: null };
  return { key: defaultActorTransport(ast), params: {}, conflit: null };
}

/**
 * LE LANGAGE D'ÉVALUATION HÉRITÉ — cinquième axe, et il ne descendait pas du tout.
 *
 * `eval.strudel` en tête de scène compilait et n'atteignait jamais l'acteur implicite : la
 * directive était lue par le validateur et par personne d'autre, exactement le défaut mesuré sur
 * les registres le 2026-07-29. Une scène sans `actor` qui déclare son interprète par défaut le
 * perdait entre le parse et l'arbre.
 *
 * ⚠️ ON NE MATÉRIALISE QUE CE QUI RÉSOUT, même règle que pour les registres : un interprète que le
 * catalogue ne connaît pas n'a aucune valeur effective à porter, et le cri reste sur la directive
 * plutôt que d'être répété sur sa copie.
 *
 * @returns {string|undefined}
 */
function evalHerite(ast) {
  const sceneEval = (ast.directives || []).find((d) => d.name === 'eval' && d.subkey);
  if (!sceneEval) return undefined;
  // ⚠️ LE CATALOGUE VIT SOUS `objects`, comme toutes les librairies de ce dépôt — l'interroger à
  // plat rendait `undefined` pour TOUS les interprètes, y compris ceux qu'il déclare. Le garde
  // aurait été vert (rien ne descend, rien ne contredit) : c'est l'instrument qui aurait menti.
  const connus = new Set((famille('eval')?.entrees || []).map((o) => o.nom));
  return connus.has(sceneEval.subkey) ? sceneEval.subkey : undefined;
}

/**
 * Resolve actors for the AST.
 *
 * @param {Object} ast - parsed Scene AST (with actors[] and subgrammars[])
 * @returns {{ actorTable: Object, terminalActorMap: Object, errors: Array }}
 *
 * actorTable: { actorName → { alphabet, scale, sounds, transport, eval, symbols: string[] } }
 * terminalActorMap: { terminalName → actorName }
 */
function resolveActors(ast) {
  const errors = [];
  const actorTable = {};
  const terminalActorMap = {};

  // Un renvoi POINTÉ (`sitar.C4`) doit désigner un acteur DÉCLARÉ — y compris quand la scène
  // n'en déclare aucun, cas qui filait autrefois par le retour anticipé ci-dessous.
  verifierActeursReferences(ast, errors);

  if (!ast.actors || ast.actors.length === 0) {
    return { actorTable, terminalActorMap, errors };
  }

  // 1. Build actor table — load alphabet for each actor, expand terminals
  const symbolActorMap = new Map(); // terminal → Set<actorName>

  for (const actor of ast.actors) {
    const name = actor.name;
    const props = actor.properties;
    let alphabetKey = props.alphabet;
    const herite = [];   // les axes que la CASCADE fournit — ils s'annoncent en références plus bas

    // LA CASCADE PAR NIVEAUX, UNIVERSELLE — Romain, 2026-09-02 : un acteur sans alphabet hérite de
    // celui de la scène, sinon du défaut que `core` déclare quand `core` est invoqué. Aucune exception :
    // une voix de code est un acteur comme un autre et hérite comme les autres — l'exception qui
    // vivait ici (« porte de code étranger, pas un vocabulaire de notes ») était une seconde voie
    // décidée par le compilateur sur un attribut, invisible dans la donnée ; elle sort.
    if (!alphabetKey) {
      alphabetKey = alphabetHerite(ast);                                  // cascade scène → socle core
      if (alphabetKey) {
        props.alphabet = alphabetKey;                                     // matérialise l'héritage dans l'AST
        herite.push({ category: 'alphabet', name: alphabetKey });
      }
    }
    // Les REGISTRES et l'ACCORDAGE suivent le même chemin : acteur (déjà là) → scène → alphabet.
    if (props.octaves == null && alphabetKey) {
      const oct = octavesHerite(ast, alphabetKey);
      if (oct) { props.octaves = oct; herite.push({ category: 'octaves', name: oct }); }
    }
    if (props.tuning == null && alphabetKey) {
      const tun = tuningHerite(ast, alphabetKey);
      if (tun) { props.tuning = tun; herite.push({ category: 'tuning', name: tun }); }
    }
    // ── LES DEUX DERNIÈRES DES CINQ ────────────────────────────────────────────────────────────
    // LA SORTIE ET L'INTERPRÈTE descendent ici aussi. Ils ne descendaient PAS : un acteur déclaré
    // sans `out` sortait de l'AST sans aucune sortie, alors que l'acteur IMPLICITE, lui, recevait
    // ses cinq clés (bpxAst.js:1029-1082). Trois axes sur cinq étaient pliés — nommer un acteur
    // faisait donc PERDRE ce que ne rien nommer donnait.
    //
    // ⚠️ CE QUE ÇA COÛTAIT, MESURÉ SUR PIÈCES : quatre scènes d'exemple de la bibliothèque
    // compilaient sans une erreur et ne produisaient AUCUN SON — exactement les quatre qui
    // déclarent un `actor` sans `out`, zéro contre-exemple dans les deux sens. Le mode d'échec est
    // le muet : rien ne manque à l'œil, la scène a l'air complète, et l'aval n'a aucun moyen de
    // savoir qu'une sortie était due. C'est l'invariant du contrat fondateur qui tombe
    // (atlas/architecture/00-constitution.md:176-178, L35) : « un override RECOUVRE le défaut, il
    // ne disparaît JAMAIS en silence ».
    //
    // La cascade est celle des autres axes — les MÊMES fonctions, définies une seule fois. La
    // reconstituer ici ferait deux cascades qui divergeraient au premier changement.
    if (props.transport == null) {
      const sortie = sortieHeritee(ast);   // scène `out.X` → raccord d'alphabet → socle core
      props.transport = { type: 'TransportRef', key: sortie.key, params: sortie.params };
      herite.push({ category: 'transport', name: sortie.key, params: sortie.params });
    }
    if (props.eval == null) {
      const interprete = evalHerite(ast);  // ne dépend pas de l'alphabet : une scène sans note
      if (interprete) {                    // déclare quand même par quoi ses backticks se lisent
        props.eval = interprete;
        herite.push({ category: 'eval', name: interprete });
      }
    }
    // ── ET CHAQUE AXE HÉRITÉ S'ANNONCE DANS LES RÉFÉRENCES ────────────────────────────────────
    // CE QUI EST MESURÉ : un acteur DÉCLARÉ n'annonçait que ce qui était ÉCRIT sur lui, alors que
    // les scènes dont l'acteur écrit `out` portent une `ActorReference` de catégorie `transport`,
    // et que l'acteur implicite en porte une aussi.
    //
    // ⚠️ ET CE QUI N'EST PAS MESURÉ, PARCE QUE JE L'AI ÉCRIT ICI COMME UN FAIT ET QUE C'ÉTAIT FAUX :
    // « c'est la RÉFÉRENCE que l'aval lit, pas la propriété seule ». C'était une DÉDUCTION tirée
    // d'une corrélation — trois scènes muettes sans référence, trois sonnantes avec — pas une mesure
    // de l'aval. La corrélation a été défaite le jour même : le silence de ces trois-là venait de la
    // cascade absente (réparée juste au-dessus) et d'une fenêtre de mesure trop courte chez le
    // consommateur. PERSONNE n'a montré qu'un aval refuse une propriété non annoncée.
    //
    // CE QUI JUSTIFIE QUAND MÊME CE BLOC, et il tient sur ses propres pieds : un axe que la cascade
    // fournit et qui ne s'annonce pas est une INCOHÉRENCE de cet arbre — l'acteur implicite annonce
    // ses cinq axes depuis toujours (bpxAst.js:1055-1082), et ce qu'un acteur nommé porte ne peut
    // pas être plus pauvre que ce que porterait la scène qui n'en déclare aucun. Le prouver
    // demanderait un témoin qui LIT la référence ; il n'existe pas encore (BACKLOG BPS-60).
    //
    // L'acteur IMPLICITE annonce ses cinq axes depuis toujours (bpxAst.js:1055-1082) ; l'acteur
    // DÉCLARÉ n'annonçait que ce qui était ÉCRIT. Même invariant que pour les propriétés, et même
    // motif : ce qu'un acteur nommé porte ne peut pas être plus pauvre que ce que porterait la
    // scène qui n'en déclare aucun.
    //
    // ⚠️ MON PROPRE GARDE NE L'AVAIT PAS VU : il comparait les `properties` des deux chemins et
    // s'arrêtait là. Une empreinte compare TOUT, en retirant seulement ce qui est prouvé hors
    // sujet — choisir les champs comparés revient à choisir ce qu'on ne verra pas.
    for (const ref of herite) {
      actor.references = actor.references || [];
      if (!actor.references.some((r) => r.category === ref.category)) {
        actor.references.push({ type: 'ActorReference', line: actor.line, ...ref });
      }
    }

    // Expand terminals depuis l'alphabet (voix de notes) ; voix-code = pas de terminaux.
    let terminals = [];
    if (alphabetKey) {
      const alphabetLib = resolveActorAlphabet(alphabetKey, ast.directives);
      if (!alphabetLib) {
        errors.push({ message: `Alphabet "${alphabetKey}" not found for actor "${name}"`, line: actor.line });
        continue;
      }
      // props.octaves surcharge la convention de registre de l'alphabet (décision cles-acteur-six).
      terminals = [...expandAlphabetTerminals(alphabetLib, props.octaves)];
      // expandAlphabetTerminals ne produit que les formes DÉCORÉES de registre (madhya_sa…).
      // La forme NUE (registre par défaut : `sa`) est la façon idiomatique d'écrire une note et
      // est reconnue par validateTerminals (bpxAst.js:639-641). Sans elle ICI, une note nue
      // n'est attribuée à AUCUN acteur → orpheline → muette avec un acteur explicite (aucun
      // `default` synthétique pour la recueillir). On l'ajoute au vocabulaire de l'acteur.
      const alts = alphabetLib.alterations && typeof alphabetLib.alterations === 'object' && !Array.isArray(alphabetLib.alterations)
        ? Object.keys(alphabetLib.alterations) : [''];
      for (const note of (nomsDeTerminaux(alphabetLib) || [])) for (const alt of alts) terminals.push(note + alt);
    }

    actorTable[name] = {
      alphabet: alphabetKey || null,
      scale: props.scale || null,
      // v0.8 : la clé canonique est `sound` (singulier) ; on lit aussi `sounds`
      // pour rétrocompat avec les sorties de parseur antérieures.
      sounds: props.sound || props.sounds || null,
      transport: props.transport || null,
      eval: props.eval || null,
      symbols: terminals,
    };

    // Register each terminal → actor
    for (const terminal of terminals) {
      if (!symbolActorMap.has(terminal)) {
        symbolActorMap.set(terminal, new Set());
      }
      symbolActorMap.get(terminal).add(name);
    }
  }

  // 2. Build terminalActorMap from declarations (gate Sa:sitar)
  //    Declarations with a runtime that matches an actor name → actor binding
  const actorNames = new Set(Object.keys(actorTable));

  for (const decl of (ast.declarations || [])) {
    if (decl.runtime && actorNames.has(decl.runtime)) {
      terminalActorMap[decl.name] = decl.runtime;
    }
  }

  // 3. Walk AST — resolve implicit actor on Symbol nodes + detect conflicts
  for (const sg of (ast.subgrammars || [])) {
    for (const rule of (sg.rules || [])) {
      resolveSymbolsInRhs(rule.rhs, symbolActorMap, actorTable, terminalActorMap, errors);
    }
  }

  return { actorTable, terminalActorMap, errors };
}

/**
 * Garde des renvois pointés — FAIL-LOUD (2026-07-18).
 *
 * `sitar.C4` nomme l'acteur qui porte le terminal. Un nom NON DÉCLARÉ était accepté en
 * silence : le préfixe survivait dans l'AST, aucun consommateur ne le reconnaissait, et le
 * terminal retombait sur les défauts de scène. MESURÉ : dans une scène où `sitar` est déclaré
 * avec `tuning.western_just`, `sitar.C4` sonne 264.00 Hz ; `inconnu.C4` sonne 261.63 Hz —
 * exactement comme si aucun acteur n'était écrit. Une faute de frappe sur un nom d'acteur
 * changeait donc la HAUTEUR sans un mot, jusqu'au bout de la chaîne (Kairos ne crie pas : il
 * ne peut pas savoir qu'un nom qu'il ne connaît pas était censé exister).
 *
 * Le mauvais silence n'est pas ici l'absence d'erreur, c'est le REPLI : se rabattre sur un
 * défaut plausible masque la faute au lieu de la révéler.
 *
 * Rayon de casse mesuré AVANT durcissement (règle de frontière, CLAUDE.md) : 0 sur les 93
 * scènes de `test/grammars`, et sur les 188 `.bps` du corpus BPx les 2 seules scènes à
 * notation pointée (`kai9_actor_address`, `kai10_pitch_config`) DÉCLARENT leurs acteurs
 * (`actor bass…`, `actor lead…`) — donc aucune ne casse.
 */
function verifierActeursReferences(ast, errors) {
  const declares = new Set((ast.actors || []).map((a) => a.name));
  // ⚠️ L'ACTEUR IMPLICITE N'EXISTE PAS ENCORE ICI, et c'est un ORDRE DE PASSES, pas un oubli :
  // il est fabriqué plus loin (`applyDefaultActor`, bpxAst.js) quand la scène ne déclare aucun
  // `actor`. Sans cette ligne, `scene.C4` était refusé par « Acteur inconnu » alors que `scene`
  // est précisément le nom que la décision du 2026-07-30 donne pour pouvoir le DÉSIGNER —
  // « la réponse est la notation pointée, pas la forme nue en @ ». Le renommage seul ne suffisait
  // donc pas : il fallait aussi que la validation sache que ce nom sera là.
  // ⚠️ ET C'EST BIEN « SI ET SEULEMENT SI » : quand la scène déclare ses acteurs, il n'y a PAS
  // d'acteur implicite, donc `scene.X` doit rester refusé — sinon on offrirait un nom qui ne
  // désigne rien. Mesuré : cette ligne n'ACCEPTE que des formes jusque-là refusées, elle n'en
  // refuse aucune de nouvelle.
  if (declares.size === 0) declares.add('scene');
  // ⚠️ UNE TABLE D'HOMOMORPHISME INVOQUÉE PORTE AUSSI UN NOM POINTÉ, et ce n'est pas un acteur.
  // Forme validée par Romain le 2026-08-10 : `S -> $N14 checkhomo.TR &N14` — la SECTION se désigne
  // comme tout élément dans un espace de noms, et plusieurs se suivent dans l'ordre où elles
  // s'appliquent (`checkhomo.* checkhomo.TR`), l'ordre de la séquence portant l'ordre des sections
  // comme il le fait partout ailleurs. Le natif écrit `* TR` et `TR *` en miroir dans deux règles
  // de `-gr.checkHomo` : l'ordre est signifiant, il fallait pouvoir le dire.
  //
  // La forme NUE de la bible (`$N14 dhati &N14`) reste valide et vaut « toutes les sections de la
  // table, dans l'ordre du fichier » — aucune scène existante ne bouge.
  //
  // Sans cette ligne, `checkhomo.TR` tombait sur « Acteur inconnu » : le renvoi pointé n'a qu'une
  // lecture ici, et il en a deux dans le langage.
  for (const d of ast.directives || []) {
    if (d && d.name === 'homomorphism' && d.subkey) declares.add(d.subkey);
  }
  const vus = new Set();

  const visiter = (elements) => {
    if (!elements) return;
    for (const el of elements) {
      if (!el || typeof el !== 'object') continue;
      if (el.actor && !declares.has(el.actor) && !vus.has(el.actor)) {
        vus.add(el.actor);
        const connus = declares.size
          ? `Declared actors: ${[...declares].join(', ')}.`
          : "This scene declares no actor.";
        errors.push({
          message: `unknown actor '${el.actor}' in '${el.actor}.${el.name}'`
            + ` — a dotted reference must name an actor declared by actor. ${connus}`,
          line: el.line,
        });
      }
      // Un acteur peut se nicher dans une voix polymétrique ou un groupe.
      if (el.voices) for (const voix of el.voices) visiter(voix);
      if (el.primary) visiter([el.primary]);
      if (el.secondaries) visiter(el.secondaries);
      if (el.elements) visiter(el.elements);
    }
  };

  for (const sg of (ast.subgrammars || [])) {
    for (const rule of (sg.rules || [])) {
      visiter(rule.rhs);
      visiter(rule.lhs);
    }
  }
}

/**
 * Attribue un acteur à un nœud sonnant. TROU 2 (décision Romain
 * 2026-07-03-note-nue-ch-implique-sortie-midi.md) : SEUL le payload voyage dans
 * l'arbre dérivé (BPx types/node.ts:619 — Kairos lit `node.payload.actor`).
 * Écrire `el.actor` sans `el.payload.actor` = feuille droppée en aval. Les DEUX.
 */
function assignActor(el, actorName) {
  el.actor = actorName;
  if (el.payload && typeof el.payload === 'object') el.payload.actor = actorName;
}

/**
 * Walk RHS elements recursively, resolving actor on Symbol/SymbolCall nodes.
 */
function resolveSymbolsInRhs(elements, symbolActorMap, actorTable, terminalActorMap, errors) {
  if (!elements) return;

  for (const el of elements) {
    // TROU 1 (même décision) : un SymbolCall (note nue AVEC suffixe, ex `E4(ch:5)`)
    // porte l'acteur au même titre qu'un Symbol — même attribution implicite, même
    // erreur d'ambiguïté (option A tranchée : REJET, pas d'héritage intra-règle).
    if (el.type === 'Symbol' || el.type === 'SymbolCall') {
      if (el.actor) {
        // Explicit dot notation: sitar.Sa → already resolved by parser
        terminalActorMap[el.name] = el.actor;
      } else {
        // Implicit: check symbolActorMap
        const actors = symbolActorMap.get(el.name);
        if (actors && actors.size === 1) {
          // Unambiguous — assign actor implicitly
          const actorName = [...actors][0];
          assignActor(el, actorName);
          terminalActorMap[el.name] = actorName;
        } else if (actors && actors.size > 1) {
          // Ambiguous — check if declaration resolved it
          if (!terminalActorMap[el.name]) {
            const actorList = [...actors].join(', ');
            errors.push({
              message: `Ambiguous symbol "${el.name}" — owned by actors: ${actorList}. Use dot notation (e.g. ${[...actors][0]}.${el.name}) or declare with gate ${el.name}:<actor>`,
              line: el.line,
            });
          } else {
            // Declaration resolved it — propagate to element
            assignActor(el, terminalActorMap[el.name]);
          }
        }
        // If symbol is not in any actor's alphabet, leave actor null (not an actor-managed terminal)
      }
    }

    // Recurse into nested structures
    if (el.type === 'Polymetric' && el.voices) {
      for (const voice of el.voices) {
        resolveSymbolsInRhs(voice, symbolActorMap, actorTable, terminalActorMap, errors);
      }
    }
    if (el.type === 'SimultaneousGroup') {
      if (el.primary) resolveSymbolsInRhs([el.primary], symbolActorMap, actorTable, terminalActorMap, errors);
      if (el.secondaries) resolveSymbolsInRhs(el.secondaries, symbolActorMap, actorTable, terminalActorMap, errors);
    }
  }
}

export { resolveActors, expandAlphabetTerminals, alphabetHerite, octavesHerite, tuningHerite,
         sortieHeritee, evalHerite, defaultActorTransport };
