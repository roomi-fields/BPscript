// AUTORITÉ résolution acteur / pitch / contrôles : LIRE src/transpiler/_AUTORITE.md avant de modifier.
/**
 * BPScript Parser
 * Source: BPSCRIPT_EBNF.md (Couches 1-4) + BPSCRIPT_AST.md
 *
 * Converts token array into AST (Scene node).
 * Recursive descent parser.
 */

import { T } from './tokenizer.js';
import { loadLib, directiveDeclareeParLaLibrairie, porteesDeclarees, loadLibsFromDirectives, describeVocabulary, universeControlNames, universeIntervalControls, universeComponentControls, universeRuleScopeControls, universeRuleAllowedControls, universeSacs, universeAddressKeys } from './libs.js';
import { BP3_OPERATORS } from './constants.js';

class ParseError extends Error {
  constructor(msg, token) {
    super(`${msg} at line ${token.line}:${token.col}`);
    this.token = token;
  }
}

/**
 * Schéma des CLÉS D'ADRESSE (KAI-9 / GAP#2, décision 2026-06-26).
 * Une clé d'override qui désigne OÙ va l'événement, ou D'OÙ vient celui qu'un point d'attente
 * écoute (canal/device/port/note) — par opposition à un contrôle d'expression (vel/pan/wave…).
 * Sépare `payload.address` de `payload.params` (cf. splitAddress). `ch` et `channel` sont
 * synonymes (forme courte/longue). Aligné sur les params de `out.<type>(…)` côté acteur.
 */
/**
 * Clés d'ADRESSE — lues dans la DONNÉE, en UNION sur tout le registre.
 * ⚠️ Elles étaient codées en dur ICI en plus d'y être déclarées : deux exemplaires identiques,
 * donc un double qui n'attendait qu'une divergence. Retiré le 2026-08-06, dans le même geste que
 * les axes de catalogue, qui avaient déjà payé ce défaut le jour même.
 *
 * ⚠️ ET LA MÉMOÏSATION LOCALE EST PARTIE AVEC LE DOMICILE (2026-08-15). Elle ne se réinitialisait
 * JAMAIS : un registre rechargé — ce que fait tout banc qui fabrique une librairie — laissait le
 * parseur sur les clés de la toute première lecture. Tant qu'elles vivaient dans un fichier unique
 * et immuable, personne ne le voyait. `universeAddressKeys` mémoïse au bon endroit : là où le
 * registre sait qu'il a bougé.
 */
function addressKeys() {
  const keys = universeAddressKeys();
  if (!keys || keys.size === 0) {
    throw new Error("aucune clé d'adresse déclarée dans les librairies — le parseur ne peut plus "
      + "distinguer une adresse d'un contrôle (elles vivent dans `midi`, section schema.addressKeys)");
  }
  return keys;
}

/**
 * CONVENTION — les quatre lectures d'un flux de nombres qu'un `var` typé peut nommer
 * (EBNF.md:55 : `CONVENTION = "signal" | "pitch" | "phase" | "logic"`). Partagée par `@var` et
 * `def` (`def_directive`, EBNF.md:66), qui portent les mêmes quatre mots.
 */


/**
 * Clés d'ENTITÉ (composants) admises sur la ligne d'acteur (décision cles-acteur-six,
 * Romain 2026-06-16). Toutes se NOMMENT avec `.` (`.` APPELLE le composant) — jamais `:`
 * (le `:` AFFECTE une valeur). Le CUTOVER graphie (Romain 2026-07-14) rejette la forme `:`
 * pour chacune. `sounds` = alias v0.7 de `sound` (rejeté avec renvoi vers `sound.`).
 * `voice` = 7e clé (LANG-SONS-2, GO Romain [438] 2026-07-16, spec hub/projets/2026-06-24-lang-sons-spec/README.md
 * §3) : la voix de l'acteur, entrée de lib/voices. NB : la spec §7 (2026-06-24, « illustratif —
 * syntaxe à raffiner » §8) écrivait `voice:wobble` — graphie ANTÉRIEURE au cutover ; le canon
 * postérieur s'applique : `voice.wobble`.
 * `out` = la DIRECTION de sortie (décision Romain 2026-08-04, remplace `transport` — le mot
 * `transport` est SORTI du langage, cf. `channelCatalog`/tombstone plus bas). Le champ interne
 * (`properties.transport`, `TransportRef`, `references[transport]`) NE CHANGE PAS de nom : seul
 * le mot que l'auteur ÉCRIT change.
 */
/**
 * CLÉS D'UN ACTEUR — lues dans la DONNÉE (`lib/core.json` schema.actorKeys + deprecatedActorKeys).
 *
 * Déclarées en librairie le 2026-08-06 (Romain : « est-ce que les clés d'acteur devraient être
 * spécifiées en librairies comme tout le reste ? »). C'était la dernière liste structurelle du
 * langage à vivre en dur dans le parseur.
 *
 * ⚠️ DEUX LISTES, ET LA SECONDE EST LÀ POUR INTERDIRE. `actorKeys` sont les clés VALIDES ;
 * `deprecatedActorKeys` porte celles qui doivent REFUSER (`sounds`, graphie v0.7). L'ensemble
 * ci-dessous est leur UNION, parce que le refus du deux-points doit couvrir les deux — une clé
 * périmée écrite `sounds:X` doit être nommée, pas ignorée.
 * Mesuré le 2026-08-06 : sortir `sounds` des deux listes rendait `sounds:tabla_perc`
 * SILENCIEUSEMENT ACCEPTÉ. Un nom peut figurer dans une liste pour fermer, jamais pour ouvrir.
 */
let _actorKeys = null;
function actorKeysData() {
  if (_actorKeys) return _actorKeys;
  const sch = (loadLib('core') || {}).schema || {};
  const valides = sch.actorKeys, perimees = sch.deprecatedActorKeys || [];
  if (!Array.isArray(valides) || valides.length === 0) {
    throw new Error("lib/core.json schema.actorKeys est vide ou absent — le parseur n'a plus de clés d'acteur");
  }
  _actorKeys = { valides: new Set(valides), perimees: new Set(perimees),
                 toutes: new Set([...valides, ...perimees]) };
  return _actorKeys;
}

/** Les quatre conventions d'une variable — lues dans la donnée, pas listées ici. */
let _varConventions = null;
function varConventions() {
  if (_varConventions) return _varConventions;
  const c = ((loadLib('core') || {}).schema || {}).varConventions;
  if (!Array.isArray(c) || c.length === 0) {
    throw new Error("lib/core.json schema.varConventions est vide ou absent");
  }
  _varConventions = new Set(c);
  return _varConventions;
}

/**
 * LES MOTS QUI OUVRENT UNE DÉCLARATION PAR LE TYPE, et que rien d'autre ne dérive — `flag`,
 * `symbol`. Les CONVENTIONS et les MODULES en ouvrent une aussi, et se lisent là où ils sont déjà
 * déclarés : `varConventions` pour les unes, le catalogue `mod` pour les autres. Recopier ces deux
 * listes ici rouvrirait l'écart entre ce que le parseur accepte et ce que la donnée déclare.
 */
let _typesDeclaratifs = null;
function typesDeclaratifs() {
  if (_typesDeclaratifs) return _typesDeclaratifs;
  const c = ((loadLib('core') || {}).schema || {}).declarationTypes;
  if (!Array.isArray(c) || c.length === 0) {
    throw new Error("lib/core.json schema.declarationTypes est vide ou absent");
  }
  _typesDeclaratifs = new Set(c);
  return _typesDeclaratifs;
}

/** Les modules du catalogue — une instance se déclare en écrivant son module en tête. */
function modulesDuCatalogue() {
  return new Set(Object.keys(loadLib('mod')?.objects || {}));
}

/**
 * Axes à CATALOGUE au niveau SCÈNE (directive `axe.<nom>`) : leur opérande est un NOM D'ENTRÉE
 * de catalogue (une lib par axe) — donc un COMPOSANT, nommé avec `.`. DOIT rester le miroir de
 * `lib/core.json` schema.catalogAxes (garde anti-dérive : test/test_catalog_axes_colon_reject.js
 * itère describeVocabulary().components et prouve que CHACUN rejette le `:`). Le CUTOVER universel
 * (Romain 2026-07-14, tour [412]) rejette `axe:<X>` pour chacun — plus jamais d'axe-composant qui
 * tolère l'ancienne forme.
 */
/**
 * Axes dont les valeurs sont des ENTRÉES DE CATALOGUE — lus dans la DONNÉE, jamais listés ici.
 *
 * ⚠️ CETTE LISTE ÉTAIT CODÉE EN DUR, EN DOUBLE DE `lib/core.json` schema.catalogAxes. Le schéma
 * structurel est une donnée depuis le 2026-07-05 (Romain) précisément pour qu'un axe déclaré une
 * fois vaille partout. Le double a fait exactement ce qu'un double fait : le 2026-08-06, `eval`
 * a été ajouté à la donnée et n'a rien changé — le parseur lisait toujours ses cinq noms.
 * ⚠️ Et le défaut était MUET : la déclaration semblait posée, la garde ne mordait pas, et j'ai
 * conclu « configuration sans effet » sur une mesure qui ne mesurait pas ce que je croyais.
 */
let _catalogAxisKeys = null;
function catalogAxisKeys() {
  if (_catalogAxisKeys) return _catalogAxisKeys;
  const core = loadLib('core') || {};
  const axes = core?.schema?.catalogAxes;
  if (!Array.isArray(axes) || axes.length === 0) {
    throw new Error("lib/core.json schema.catalogAxes est vide ou absent — le parseur n'a plus d'axes de catalogue");
  }
  _catalogAxisKeys = new Set(axes);
  return _catalogAxisKeys;
}

/**
 * Noms de canal de sortie PÉRIMÉS → rejetés fail-loud au parse (décision 2026-07-16, Romain :
 * on supprime, pas de rétrocompat ni normalisation). Source unique = `lib/core.json`
 * schema.deprecatedTransports (le schéma structurel est une DONNÉE, pas un hardcode — _schema_doc,
 * Romain 2026-07-05). Mémoïsé. `browser`/`webaudio` = ancien modèle profils d'environnement
 * (routing.json, supprimé) ; le canal canonique {audio, midi, osc} s'écrit directement.
 */
let _deprecatedTransports = null;
function deprecatedTransports() {
  if (_deprecatedTransports) return _deprecatedTransports;
  const core = loadLib('core') || {};
  _deprecatedTransports = new Set((core.schema && core.schema.deprecatedTransports) || []);
  return _deprecatedTransports;
}

/**
 * UN SEUL CATALOGUE des canaux, chacun portant les DIRECTIONS qu'il autorise (décision Romain
 * 2026-08-04, hub/decisions/2026-08-04-la-direction-s-ecrit-in-et-out-remplacent-transport.md).
 * Remplace les deux listes distinctes `transportChannels`/`inputTransportChannels` qui coexistaient
 * sous le même mot `transport` selon l'endroit où on l'écrivait. Source unique = `lib/core.json`
 * schema.channels (donnée, pas un hardcode). Mémoïsé.
 */
let _channelCatalog = null;
function channelCatalog() {
  if (_channelCatalog) return _channelCatalog;
  const core = loadLib('core') || {};
  _channelCatalog = (core.schema && core.schema.channels) || {};
  return _channelCatalog;
}

/**
 * LISTE POSITIVE FERMÉE des canaux de SORTIE (`out.<canal>` sur un @actor, ou le raccord
 * `alphabet.X:<sortie>` de l'acteur implicite). Addendum ratifié Romain 2026-07-16 (« on
 * n'autorise que ceux qu'on connaît ») : suffixe ∉ schema.channels{out:true} → rejet fail-loud.
 * `dmx` y est entré le 2026-08-04 (catalogue unique `lib/core.json`, légitime même sans runtime
 * dmx encore écrit). `text` y est PRÉSENT (il porte `out:true`, routé comme les autres sorties) —
 * son refus à l'écriture est une question SÉPARÉE, portée par `writableChannels` (DIRECTION ≠
 * ÉCRITURE, voir plus bas). Dérivée du catalogue unifié, jamais recopiée en dur ici.
 */
let _outChannels = null;
function outChannels() {
  if (_outChannels) return _outChannels;
  const cat = channelCatalog();
  _outChannels = new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].out));
  return _outChannels;
}

/**
 * LISTE POSITIVE FERMÉE des canaux d'ENTRÉE (`var <rôle> in.<canal>`) — DISTINCTE de celle des
 * sorties, et c'est délibéré. La décision Romain du 2026-07-26 nomme TROIS périphériques
 * d'entrée — MIDI, OSC, CLAVIER. Le clavier entre donc ici et NULLE PART ailleurs :
 * `alphabet.X:keyboard` reste refusé, une sortie clavier n'a pas de sens. Préservée à
 * l'identique de l'ancienne `inputTransportChannels`, dérivée du catalogue unifié.
 */
/**
 * ⛔ LA LISTE FERMÉE DE SORTIE VALAIT SUR TROIS CASES SUR QUATRE. Un canal de sortie inconnu était
 * refusé chez un `actor`, une entrée inconnue était refusée en tête de scène — mais la SORTIE de
 * scène, `out.<canal>`, ne passait par aucune des deux. `out.zorglub` compilait, et `out.keyboard`
 * aussi, alors que la forme d'acteur le refuse en nommant sa direction.
 *
 * ⚠️ CE QUI L'A RÉVÉLÉ N'EST PAS CE QU'ON M'A SIGNALÉ. BPx a remonté « une scène invoque une entrée
 * de librairie absente et rien ne le dit », avec trois références. Rejouées chez moi, les trois
 * EXISTENT — son instrument lisait `LIBS.<axe>` à la racine, alors qu'une section sert un axe par
 * son champ `resolves` (`sounds` sert `sound`) et que les homomorphismes vivent sous `tables`.
 * Les six axes de catalogue refusaient déjà une entrée inventée, nommément. En fabriquant le cas
 * pour le vérifier, c'est CETTE case-ci qui s'est ouverte.
 *
 * PÉRIMÈTRE MESURÉ AVANT DE CÂBLER LE REFUS : 829 scènes `.bps` de toute la tour, 55 invocations
 * `in.`/`out.`, ZÉRO sur un canal inconnu. Le refus ne casse aucune scène vivante.
 *
 * Le message reprend mot pour mot celui de la forme d'acteur : deux graphies d'une même règle
 * doivent refuser de la même façon, sinon l'auteur apprend deux langages.
 */
function refuserCanalDeSortieInconnu(name, subkey, tok) {
  if (name !== 'out' || !subkey) return;
  if (!outChannels().has(subkey)) {
    throw new ParseError(
      `'${subkey}' n'est pas une sortie — les canaux de sortie sont `
      + `${[...outChannels()].join(', ')}. La liste est FERMÉE.`, tok);
  }
  if (!writableChannels().has(subkey)) {
    throw new ParseError(
      `'out.${subkey}' est refusé — ce canal est une DESTINATION de l'architecture, routée comme `
      + `les autres sorties, mais son ÉCRITURE dans une scène attend encore son appareil dédié.`, tok);
  }
}

/**
 * ⛔ LE MODE DE DÉRIVATION EST UNE LISTE FERMÉE, DÉCLARÉE DANS LA DONNÉE. `lib/language.json`,
 * `directiveValues.mode.values`, porte les sept modes que le langage connaît — et rien ne les
 * opposait à l'auteur. Mesuré le 2026-08-19 :
 *
 *     mode:zorglub   COMPILAIT, et la valeur inventée atterrissait dans `subgrammars[].mode`
 *     mode           COMPILAIT, et la ligne était AVALÉE : `mode` restait null, rien ne se passait
 *
 * Le second est le pire des deux : l'auteur croit poser un mode de dérivation, et rien n'arrive.
 * C'est la même famille que les canaux — une liste fermée qui existe et qu'on n'oppose pas.
 *
 * ⚠️ ELLE NE PEUT RIEN AVALER, et c'est pour ça qu'elle est écrite ainsi : elle ne mord que sur le
 * mot `mode`, un mot VIVANT. Les pierres tombales de `routing`, `label` et `transcription` portent
 * un autre sujet et gardent leur refus nommé. C'est la borne qui manquait à ma première écriture du
 * refus de canal, le même jour, et qui avait rendu muets trois retraits.
 */
function refuserModeInvalide(name, runtime, value, tok) {
  if (name !== 'mode') return;
  // ⛔ LA LISTE VIENT DE LA DONNÉE, PAR LA MÊME PORTE QUE LE CATALOGUE DES CANAUX. Le parseur ne
  // connaît pas `LIBS` : il lit une librairie par `loadLib`, et c'est voulu — une librairie non
  // invoquée n'a pas à peser sur la lecture.
  const lang = loadLib('language') || {};
  const declares = ((lang.directiveValues && lang.directiveValues.mode
    && lang.directiveValues.mode.values) || []).map((v) => v.name);
  if (!declares.length) return;                     // la donnée ne dit rien : on n'invente pas
  const ecrit = runtime ?? (value == null ? null : String(value));
  if (ecrit == null) {
    throw new ParseError(
      `'mode' attend le mode de dérivation qu'il pose — 'mode:<mode>'. Écrit seul, il ne gouverne `
      + `RIEN : la sous-grammaire garde le mode qu'elle avait, et la ligne disparaît sans un signe. `
      + `Les modes sont ${declares.join(', ')}.`, tok);
  }
  // ⛔ ET LA VALEUR EST REFUSÉE DEPUIS LE 2026-08-19, EN DERNIER DES TROIS ÉTAPES. Elle ne pouvait
  // pas l'être avant, et deux mesures successives l'ont arrêtée :
  //
  //   1. LA DONNÉE MENTAIT. Elle portait `random` là où le natif écrit `rnd` — le seul MOT ENTIER
  //      d'une liste dont les sept noms sont des ABRÉVIATIONS (`-BP3.h:879`), donc le seul nom que
  //      la donnée s'était donné. Sur les 110 grammaires natives : RND 98 · LIN 91 · ORD 74 ·
  //      SUB1 28 · SUB 11, et RANDOM ZÉRO.
  //   2. LA TOUR L'ÉCRIVAIT, ET BPx L'ABSORBAIT. 419 sites dans quatre dépôts écrivaient
  //      `mode:random`, et ils ne compilaient pas par droit : `loadGrammar.ts:4111` normalisait
  //      l'alias. Le retrait avait DEUX domiciles — ma porte et son normaliseur.
  //
  // Refuser avant l'un ou l'autre aurait cassé le FIDÈLE pendant que l'infidèle passait. Les sites
  // ont migré, l'alias est sorti, le refus part en dernier — c'est tout le sens de cet ordre.
  if (!declares.includes(ecrit)) {
    throw new ParseError(
      `'mode:${ecrit}' : '${ecrit}' n'est pas un mode de dérivation — les modes sont `
      + `${declares.join(', ')}. La liste est FERMÉE.`, tok);
  }
}

let _inChannels = null;
function inChannels() {
  if (_inChannels) return _inChannels;
  const cat = channelCatalog();
  _inChannels = new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].in));
  return _inChannels;
}

/**
 * DIRECTION ≠ ÉCRITURE (correction Romain 2026-08-04). `outChannels`/`inChannels` disent OÙ VA
 * le signal ; `writableChannels` dit si un AUTEUR peut TAPER ce canal dans une scène AUJOURD'HUI.
 * `text` est le premier cas des deux : il EST routé en sortie (`out:true`, comme les autres
 * destinations de l'architecture) mais son point d'écriture — son appareil dédié — n'existe pas
 * encore. Avant ce champ, le refus de 'out.text' répondait « text n'est pas une sortie » — FAUX,
 * text EST une sortie, seule son écriture attend son appareil. `writable` est déclaré EXPLICITEMENT
 * sur les SIX canaux de `lib/core.json` (jamais déduit d'une absence, cf. `_writable_doc`) : la
 * forme se reproduira, un canal peut exister dans l'architecture avant d'avoir sa graphie.
 */
let _writableChannels = null;
function writableChannels() {
  if (_writableChannels) return _writableChannels;
  const cat = channelCatalog();
  _writableChannels = new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].writable));
  return _writableChannels;
}

/**
 * Index des VOIX (lib/voices.json, LANG-SONS-2 [438], spec hub/projets/2026-06-24-lang-sons-spec/README.md §3-§5).
 * Une clé `nom for:<device>` = spécialisation par-device (cascade fin > général, résolue en
 * AVAL) ; ici on indexe par nom de base : { nom → { base?: def, forDevices: { device → def } } }.
 * Validation de FORME à l'indexation : une réalisation `audio` DOIT être un backtick TYPÉ
 * (`js:…`/`faust:…` — spec §3 : compilé par le runtime comme la CV expr). Donnée non conforme
 * = signalée quand la voix est référencée (fail-loud, jamais de son muet inventé).
 */
let _voicesIndex = null;
function voicesIndex() {
  if (_voicesIndex) return _voicesIndex;
  _voicesIndex = new Map();
  const lib = loadLib('voices');
  for (const [key, def] of Object.entries((lib && lib.objects) || {})) {
    const m = key.match(/^(\S+)\s+for:(\S+)$/);
    const name = m ? m[1] : key;
    const entry = _voicesIndex.get(name) || { base: null, forDevices: {} };
    if (m) entry.forDevices[m[2]] = def; else entry.base = def;
    _voicesIndex.set(name, entry);
  }
  return _voicesIndex;
}

/** Backtick TYPÉ : `js: …`, `faust: …` — le type nomme l'interpréteur (spec §3). */
function isTypedBacktick(v) {
  return typeof v === 'string' && /^`\s*[A-Za-z_][\w-]*\s*:/.test(v);
}

/**
 * Valide une référence de voix (`voice.<nom>` d'acteur, ou binding alphabet→voix) :
 * la voix existe (base ou spécialisation for:) et chaque réalisation `audio` portée
 * par ses définitions est un backtick typé. Jette ParseError sinon (fail-loud).
 */
function assertVoiceRef(name, where, token) {
  const entry = voicesIndex().get(name);
  if (!entry) {
    throw new ParseError(
      `${where} : voix '${name}' inconnue — aucune entrée '${name}' (ni '${name} for:<device>') `
      + `dans lib/voices.json (LANG-SONS §3).`, token,
    );
  }
  const defs = [...(entry.base ? [entry.base] : []), ...Object.values(entry.forDevices)];
  for (const def of defs) {
    if (def.audio !== undefined && !isTypedBacktick(def.audio)) {
      throw new ParseError(
        `${where} : voix '${name}' — réalisation 'audio' invalide dans lib/voices.json : un `
        + `backtick TYPÉ est requis (\`js: …\`, \`faust: …\`) ; reçu ${JSON.stringify(def.audio)}.`, token,
      );
    }
  }
}

/**
 * Valide que toute voix nommée par un alphabet existe. Carte PARTIELLE admise : un terminal sans
 * voix se résout en aval, ce n'est pas une faute.
 *
 * ⚠️ RÉÉCRIT LE 2026-08-08, ET IL ÉTAIT MORT EN SILENCE. Cette validation lisait `alpha.voices`,
 * la table qui associait APRÈS COUP un terminal à une voix — supprimée au reformatage du même jour
 * (« un terminal est une chose entière » : la voix est désormais une CLÉ du terminal). Le champ
 * n'existant plus, la condition était toujours fausse et **plus aucune voix n'était vérifiée**.
 * Rien ne le disait : c'est la famille « une propriété absente rend `undefined`, la branche meurt
 * sans erreur et le code a l'air de marcher ».
 *
 * ⚠️ UN DES DEUX CONTRÔLES A DISPARU, ET C'EST UNE BONNE NOUVELLE À NOMMER. Il vérifiait que le
 * terminal mappé était bien une note de l'alphabet — une faute que seul le format par AXES rendait
 * possible, puisqu'une table parallèle pouvait nommer n'importe quoi. Dans une collection de
 * terminaux, le terminal EST dans la table : la classe de faute n'existe plus. Le reformatage ne
 * déplace pas ce contrôle, il le rend **sans objet**.
 *
 * Mémoïsé par alphabet (une lib invalide casse au premier usage — donnée curée, fail-loud).
 */
const _alphabetVoicesChecked = new Set();
function assertAlphabetVoices(alphabetName, token) {
  if (_alphabetVoicesChecked.has(alphabetName)) return;
  const alpha = loadLib('alphabet', alphabetName);
  if (alpha) {
    for (const [terminal, def] of Object.entries(alpha.terminals || {})) {
      if (def && def.voice) {
        assertVoiceRef(def.voice, `alphabet '${alphabetName}', terminal '${terminal}'`, token);
      }
    }
    // La voix de la COLLECTION — le repli des terminaux qui n'en nomment aucune
    // (`LANGUAGE.md:880`). Elle est nulle partout aujourd'hui ; le jour où elle ne l'est plus,
    // elle doit exister comme les autres.
    if (alpha.voice) {
      assertVoiceRef(alpha.voice, `alphabet '${alphabetName}', voix de la collection`, token);
    }
  }
  _alphabetVoicesChecked.add(alphabetName);
}

/**
 * Normalise le nom d'un Symbol : si le nom est une clé de BP3_OPERATORS
 * (star→'*', plus→'+', fin→';'), retourne l'opérateur canonique BP3.
 * Cela garantit que l'AST reflète ce que BP3 aurait compilé (R1).
 * La déclaration `gate star:midi` reste valide — seul le NOM porté par
 * les Symbol nodes de règle est normalisé ici.
 */
function normalizeName(name) {
  return name in BP3_OPERATORS ? BP3_OPERATORS[name] : name;
}

function parse(tokens, opts = {}) {
  let pos = 0;
  // Les lignes de la source, pour ce qui se transporte VERBATIM — le catalogue de gabarits.
  const lignesSource = typeof opts.source === 'string' ? opts.source.split(/\r\n?|\n/) : null;
  // ⚠️ CET OBJET DOIT PORTER TOUS LES CHAMPS QUE LE PARSEUR LIT, MÊME VIDES. Il vaut pendant la
  // phase où les DIRECTIVES sont encore en cours de lecture — les librairies ne sont chargées
  // qu'une fois la tête de scène connue. Il lui manquait la moitié des champs, et l'absence ne se
  // voyait pas : les chemins qui les lisent n'étaient jamais atteints si tôt. Le jour où l'un l'a
  // été (2026-08-08, en rendant la reconnaissance d'un sac purement syntaxique), le parseur a
  // planté sur `Cannot read properties of undefined` — pas un refus, un plantage.
  // Un objet par défaut incomplet est une bombe à retardement : il attend qu'un chemin change.
  // La liste vient de la MESURE (`grep libCtx\.` sur ce fichier), pas du souvenir.
  let libCtx = {
    controlNames: new Set(), noArgControls: new Set(), bagOnlyControls: new Set(),
    dispatcherOnlyControls: new Set(), engineControls: new Set(), intervalControls: new Set(),
    qualifierKeys: new Set(), sceneNames: new Set(),
    controlMap: {}, controls: {}, symbols: {}, transcriptions: {}, actors: {},
    controlsQualified: {}, controlQualifiedResolvedBy: {}, ambiguousControls: new Set(),
  };
  /** Les noms qu'une scène a déclarés par `def` — les SEULS qui puissent être appelés.
   *  Vide tant que la directive n'est pas implémentée ; cf. `estUneDefinitionDeclaree`. */
  const definitionsDeclarees = new Set();

  // Noms que LA SCÈNE déclare elle-même. Rempli à la lecture des directives, donc connu avant la
  // première règle (l'en-tête précède toujours les règles). Sert à trancher un homonyme entre un
  // mot du vocabulaire et une déclaration locale — cf. `estDeclareLocalement`.
  const nomsDeclaresLocalement = new Set();

  /**
   * LES ACTEURS, CONNUS AU FIL DE LA LECTURE — et pas seulement à la fin.
   *
   * ⚠️ CE QUI NE MARCHAIT PAS, mesuré le 2026-08-13. `libCtx.actors` n'est rempli qu'APRÈS que
   * toutes les directives sont lues (`libCtx = loadLibsFromDirectives(...)` remplace l'objet
   * entier). Or un CORPS DE `def` est lu PENDANT cette phase : au moment où le parser rencontre
   * `def halo(x) x!perc.tin`, il ne sait pas encore que `perc` est un acteur, donc il lit
   * `perc.tin` comme un terminal nommé `perc` et la scène sort « terminal 'perc' non déclaré ».
   * La MÊME ligne écrite dans une règle passe, parce qu'une règle est lue après.
   *
   * Le point décide donc sur CETTE table, remplie à la lecture de chaque `actor`. L'ordre reste
   * celui du langage : un acteur se déclare avant d'être employé.
   */
  const acteursDeclares = new Set();

  // VARIABLES DE TRAVAIL déclarées par `var`. Sous-ensemble du précédent, tenu à part parce
  // qu'elles font plus que gagner sur un homonyme : elles portent leur PROPRE NATURE dans l'arbre.
  const nomsVariables = new Set();
  // Avertissements non fatals (ex. dépréciation des @-formes de production).
  // Canal séparé des erreurs : remonté via opts.onWarning (compileBPS →
  // result.warnings), jamais dans l'AST (contrat BPx : AST inchangé).
  function warn(message, line) {
    if (opts.onWarning) opts.onWarning({ message, line });
  }

  function current() { return tokens[pos] || { type: T.EOF, value: null, line: 0, col: 0 }; }
  function peek(offset = 0) { return tokens[pos + offset] || { type: T.EOF }; }
  function advance() { return tokens[pos++]; }
  function expect(type) {
    const tok = current();
    if (tok.type !== type) throw new ParseError(`Expected ${type}, got ${tok.type} (${tok.value})`, tok);
    return advance();
  }
  /**
   * LE NOM D'UNE ENTRÉE DE LIBRAIRIE — il peut COMMENCER PAR UN CHIFFRE.
   *
   * `temperaments.12TET`, `temperaments.22shruti` : les accordages et tempéraments portent des
   * noms d'usage qui commencent par leur nombre de degrés. Le tokenizer les rend en DEUX jetons
   * collés — `INT(12)` puis `IDENT(TET)` — et ce lecteur les recolle tant qu'ils se touchent.
   *
   * ⛔ CE N'EST PAS UN IDENT, ET C'EST VOULU. `IDENT` sert aussi aux acteurs, aux variables, aux
   * définitions et aux terminaux ; l'élargir ferait entrer les chiffres dans toutes ces places d'un
   * coup. La référence porte donc une production DISTINCTE (`entry_name`), et elle ne vaut qu'ici.
   *
   * ⚠️ ET CETTE LECTURE EXISTAIT DÉJÀ, EN UN SEUL EXEMPLAIRE MAL PLACÉ : le canal de provenance
   * (`factory.`/`mine.`) la portait, avec `12TET` et `22shruti` nommés dans son commentaire. Elle
   * manquait à l'invocation DIRECTE — d'où une garde de Kairos passant par la provenance pour
   * atteindre un tempérament, faute d'autre voie. Deux endroits lisaient un nom d'entrée, un seul
   * savait le lire ; il n'y en a plus qu'un.
   */
  function lireNomDEntree(tok) {
    if (!at(T.IDENT) && !at(T.INT)) {
      throw new ParseError(`Expected ${T.IDENT}, got ${current().type} (${current().value})`, tok || current());
    }
    let nom = String(advance().value);
    // ⚠️ LE TIRET FAIT PARTIE D'UN NOM D'ENTREE, et il est ici le SEUL endroit où il le
    // fait : le tokenizer le détache partout ailleurs, parce qu'il y est un silence.
    // `temperaments.bp3_Bohlen-Pierce` — neuf entrées du bundle en portent un.
    while ((at(T.IDENT) || at(T.INT) || at(T.REST)) && !current().spaceBefore) nom += String(advance().value);
    return nom;
  }

  function at(type) { return current().type === type; }
  /**
   * LA LIGNE COURANTE PORTE-T-ELLE UNE FLECHE ?
   *
   * ⛔ L AROBASE SORTIE, PLUS RIEN NE DISTINGUE UNE DIRECTIVE D UNE REGLE AU PREMIER JETON.
   * En tete de sous-grammaire, `mode:lin` et `S -> C4` commencent tous deux par un IDENT. Le
   * discriminant est la FLECHE : une regle en porte une, une declaration jamais. On regarde donc
   * jusqu au prochain saut de ligne, sans consommer.
   */
  function ligneSansFleche() {
    for (let j = pos; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type === T.NEWLINE || t.type === T.EOF) return true;
      if (t.type === T.ARROW_R || t.type === T.ARROW_L || t.type === T.ARROW_BI) return false;
    }
    return true;
  }
  function atAny(...types) { return types.includes(current().type); }
  function skipNewlines() { while (at(T.NEWLINE) || at(T.COMMENT)) advance(); }
  function atEnd() { return at(T.EOF); }

  // ============================================================
  // Homomorphisms helper
  // ============================================================

  /**
   * Build scene.homomorphisms (HomomorphismDeclAST[]) from loaded transcription tables.
   *
   * Contract (BPx ast.ts:150-157):
   *   { type:'Homomorphism', name:string, pairs:[string,string][], line?:number }
   *
   * Formats:
   *   - 'sections': one decl per section, name = section key ('*', 'm1', 'TR'…)
   *   - 'mappings': one decl, name = the subkey used to invoke it (@homomorphism.<subkey>)
   *
   * Identity pairs (a→a) are KEPT (Bernard fidelity).
   * Chain pairs (a→b→c) are already expanded to [a,b],[b,c] in the JSON.
   *
   * @param {Object} transcriptions  - libCtx.transcriptions: { subkey → lib }
   * @param {Array}  directives      - scene.directives (to recover line numbers)
   */
  // Déplie une déclaration `chains` en PAIRES PLATES last-write-wins (mécanisme natif réel).
  // `{C3:[B3,F4,C6], B3:[C3,B4,F6]}` → séquences [C3,B3,F4,C6],[B3,C3,B4,F6] → paires
  // consécutives fusionnées, dernière écriture gagne (C3→B3 puis C3→B4 = B4). Cf. buildHomomorphisms.
  function unfoldChains(chains) {
    const flat = {};
    for (const [key, imgs] of Object.entries(chains)) {
      const seq = [key, ...imgs];
      for (let i = 0; i < seq.length - 1; i++) flat[seq[i]] = seq[i + 1];
    }
    return Object.entries(flat);
  }

  function buildHomomorphisms(transcriptions, directives) {
    const result = [];
    if (!transcriptions || Object.keys(transcriptions).length === 0) return result;

    // Build a map from subkey → directive line number
    const lineMap = {};
    for (const dir of (directives || [])) {
      if (dir.name === 'homomorphism' && dir.subkey) {
        lineMap[dir.subkey] = dir.line;
      }
    }

    for (const [subkey, table] of Object.entries(transcriptions)) {
      const line = lineMap[subkey];

      if (table.sections) {
        // Multi-section format: one decl per named section
        for (const [secName, body] of Object.entries(table.sections)) {
          if (body && body.chains) {
            // `chains` = SUCRE de saisie pour déclarer des paires en CHAÎNE (`note --> a --> b`).
            // Le mécanisme réel (infirmation depth-indexed, oracle natif 2026-07-17 ; BPx
            // loadGrammar.ts:6368-6396 ; concession bpscript après contre-preuve kairos [493]) :
            // déplier chaque chaîne en PAIRES CONSÉCUTIVES, TOUTES fusionnées, DERNIÈRE ÉCRITURE
            // GAGNE, puis appliquées par Image() (une par portée empilée). On émet donc des
            // PAIRS PLATES last-write-wins — PORTER≠RÉSOUDRE : le consommateur (Kairos) ne déplie
            // rien, il query image(name,sym) 2-arg. `chains se compile en pairs, point`.
            result.push({ type: 'Homomorphism', name: secName, pairs: unfoldChains(body.chains), line });
          } else {
            const pairs = Object.entries(body); // already [from, to]
            result.push({ type: 'Homomorphism', name: secName, pairs, line });
          }
        }
      } else if (table.mappings) {
        // Single-section format: name = the invocation key (subkey)
        const pairs = Object.entries(table.mappings);
        result.push({ type: 'Homomorphism', name: subkey, pairs, line });
      }
    }

    return result;
  }

  // ============================================================
  // Couche 1 — Scene
  // ============================================================

  /** De quel côté du délimiteur on lit — le déclaratif d'abord, la production ensuite. */
  let enDeclaratif = false;

  function parseScene() {
    const scene = {
      type: 'Scene',
      directives: [],
      // ⛔ LES DÉFINITIONS ONT LEUR PROPRE CHAMP, `defs: DefDirective[]` (AST.md:29), et elles
      // vivaient dans `directives`. La branche qui les range le disait elle-même : elle les avait
      // d'abord laissées tomber, six gardes étaient tombés en disant « accepter n'est pas
      // transmettre », et elles ont été poussées dans le SEAU LE PLUS PROCHE au lieu de leur
      // domicile contracté. Six gardes verts ne disent pas qu'un nœud est au bon endroit.
      // ⚠️ CE QUI L'A RÉVÉLÉ : le validateur de BPx, qui exige que `directives` ne porte QUE des
      // `Directive`. `dhati.bps` y émettait 39 `DefDirective` — la scène de tabla, celle-là même
      // dont Romain vient d'arbitrer la réécriture en `def`. Toute la migration à venir passait
      // par ce champ.
      defs: [],
      // `init: InitEntry[] | null` (AST.md:30) — NULL quand la scène n'en a pas, et non `undefined`
      // ni un tableau vide : « elle n'en a pas » et « elle en a un vide » doivent rester
      // distinguables par l'aval.
      init: null,
      actors: [],
      scenes: [],
      exposes: [],
      // VARIABLES DE TRAVAIL déclarées par `var` — noms de symboles qui ne sont l'écriture
      // d'aucune note (décision Romain 2026-07-27, voie 3).
      vars: [],
      // ENTRÉES déclarées par `var <rôle> in.<canal>` (ex-`in`, décision Romain 2026-08-04) —
      // un rôle, son canal, sa table éventuelle (décision Romain 2026-07-27, symétrie entrée/sortie).
      inputs: [],
      // `maps` SUPPRIMÉ le 2026-07-27 au soir, avec le mot : `map` est abandonné, le câblage passe
      // par les chevrons. Un champ ÉMIS ET TOUJOURS VIDE n'est pas neutre — un consommateur qui le
      // lit conclut « cette scène ne câble rien » au lieu de « ce canal n'existe plus ». On
      // supprime la donnée avec le mot, dans le même mouvement, sans voie parallèle.
      // `aliases` SUPPRIMÉ le 2026-08-15, par la même règle et pour la même raison : `alias` sort
      // du langage, donc son champ sort avec lui. Mesuré avant : aucun consommateur sur les 24
      // dépôts, et aucune scène du périmètre ne l'écrivait.
      // `labels` SUPPRIMÉ avec 'label' (2026-07-28) : un champ émis et toujours vide fait
      // conclure « cette scène n'étiquette rien » au lieu de « ce canal n'existe plus ».
      declarations: [],
      backticks: [],
      subgrammars: [],
      // v0.8 — sons (prototypes anonymes + nommés) et affectations sujet→son
      soundPrototypes: null,
      soundAssignments: null,
      // Contrat BPx (ast.ts:150-157) : table d'homomorphismes attachée par le parser
      // après chargement des libs. Vide si aucune directive @homomorphism.
      homomorphisms: [],
    };

    skipNewlines();

    // ⛔ LE DÉLIMITEUR DIT DANS QUEL MONDE ON EST — décision Romain, 2026-08-19. Dans le
    // DÉCLARATIF, seule la virgule sépare ; l'espace n'y sépare rien, il est de la mise en forme,
    // comme l'indentation. Dans le FLUX rien ne change : l'espace y sépare les termes.
    // Le même lecteur de sac sert les deux côtés, donc il doit savoir de quel côté il lit.
    enDeclaratif = true;
    // Parse header: directives, declarations, macros, backticks
    let initialMode = null;
    let initialModifiers = null;
    let premiereLigne = true;
    while (!atEnd() && !at(T.SEPARATOR)) {
      skipNewlines();
      if (atEnd()) break;

      // ⛔ AVANT LE DELIMITEUR, TOUTE LIGNE DECLARE. Le signe qui distinguait une directive a
      // disparu ; c est la POSITION qui le fait. Un backtick orphelin et un bloc de production
      // gardent leur lecture propre, testes avant.
      // ⛔ UNE REGLE AVANT LE DELIMITEUR : c est le DELIMITEUR qui manque, et le refus doit le
      // dire. Sans ce message, la premiere regle se lit comme une declaration et sort un
      // « Expected IDENT, got ARROW_R » qui n apprend rien — le pire refus possible pendant une
      // migration, parce qu il accuse la ligne au lieu de nommer ce qui manque.
      // ⛔ UNE SCENE DE PRODUCTION SEULE NE PORTE AUCUN DELIMITEUR — decision du 2026-08-16 :
      // « production seule : aucun `-----`, une fleche des la premiere ligne significative ».
      // Le delimiteur SEPARE deux parties ; sans partie declarative il n a rien a separer.
      // Ma premiere ecriture l exigeait des qu une regle apparaissait, donc elle refusait une
      // scene entierement legitime — et le refus disait « il manque le delimiteur » a une scene
      // qui n en veut pas.
      if (premiereLigne && !ligneSansFleche()) break;
      if (!at(T.BACKTICK) && !atProductionBlock() && !ligneSansFleche()) {
        throw new ParseError(
          `une regle est ecrite AVANT le delimiteur : il manque la ligne '-----' entre la partie `
          + `declarative et la production. Depuis que l arobase est sortie, c est la POSITION qui `
          + `qualifie une ligne — avant le '-----' elle declare, apres elle produit.`, current());
      }
      if (!at(T.BACKTICK) && !atProductionBlock()) {
        const dir = parseDirective();
        if (dir.type === 'SceneDirective') {
          scene.scenes.push(dir);
        } else if (dir.type === 'ExposeDirective') {
          scene.exposes.push(dir);
        } else if (dir.type === 'InDirective') {
          scene.inputs = [...(scene.inputs || []), dir];
        } else if (dir.type === 'VarDirective') {
          // Les lignes s'ACCUMULENT — plusieurs `var` ne se remplacent pas, elles s'ajoutent.
          // `scene.vars` porte la DIRECTIVE ENTIÈRE (AST.md:28, `vars: VarDirective[]`), pas ses
          // noms nus réduits en chaînes — sinon le type (`varType`) n'a nulle part où survivre
          // jusqu'à l'arbre (décision Romain, référence EBNF.md:47-57, 2026-08-05).
          scene.vars = [...(scene.vars || []), dir];
          // Une variable de travail est un nom que LA SCÈNE possède : elle gagne donc, comme une
          // macro, sur un mot homonyme du vocabulaire (cascade, le plus local l'emporte).
          for (const n of dir.names) { nomsDeclaresLocalement.add(n); nomsVariables.add(n); }
        } else if (dir.type === 'DefDirective') {
          // ⛔ ET LA DEFINITION DEVIENT APPELABLE — l ensemble qui porte la bascule appel/reglage
          // etait DECLARE ET JAMAIS ALIMENTE : son commentaire disait  vide tant que la directive
          // n est pas implementee . Elle l est depuis ce matin, et personne n avait rebranche.
          // ⚠️ SANS ÇA, `accent(E4)` etait lu comme un SAC DE REGLAGES et refuse —  attribut
          // (E4:…) inconnu . La declaration passait, l appel non : une transformation qu on ne
          // peut pas appeler ne transforme rien, exactement comme une definition qu on ne peut
          // pas reinvoquer ne sert a rien (meme defaut, trouve deux fois dans la journee).
          definitionsDeclarees.add(dir.name);
          // ⛔ UNE DEFINITION EST UN NOM QUE LA SCENE POSSEDE : elle gagne sur un mot homonyme du
          // vocabulaire, comme une variable de travail ou un alias — le plus local l emporte.
          // ⚠️ MESURE DU 2026-08-09 : `def mapcont drum.on` puis `S -> a mapcont b` rendait
          // Symbol, CONTROLE, Symbol — le nom declare par la scene se faisait avaler par le
          // controle homonyme. C est exactement ce que ce recensement existe pour empecher, et il
          // ne connaissait pas la septieme sorte de declaration, entree le matin meme.
          // ⚠️ ET ON LA RANGE QUAND MEME — cette branche INTERCEPTE la directive, qui tombait
          // jusqu ici dans la branche par defaut. Ma premiere version se contentait d ajouter le
          // nom : la definition disparaissait de l arbre, et six gardes sont tombes dans la minute
          // en disant la meme chose —  aucun noeud de definition dans l arbre, accepter n est pas
          // transmettre . Une branche qui capture doit ranger ce qu elle capture.
          nomsDeclaresLocalement.add(dir.name);
          scene.defs.push(dir);
        } else if (dir.type === 'Declaration') {
          // @gate, @trigger, @cv — prefixed declarations
          scene.declarations.push(dir);
        } else if (dir.type === 'InitDirective') {
          // `init` vit à la RACINE de la scène, comme `vars` et `actors` — AST.md:30. Un consommateur
          // cherche l'état de départ là, pas au fond de la liste des directives.
          scene.init = [...(scene.init || []), ...dir.entrees];
        } else if (dir.type === 'ActorDirective') {
          scene.actors.push(dir);
          if (dir.name) acteursDeclares.add(dir.name);
          // v0.8: soundAssignments collectées dans le bloc @actor sont remontées
          // top-level avec scope { kind:"actor", name:<actorName> }.
          if (dir.soundAssignments && dir.soundAssignments.length > 0) {
            scene.soundAssignments = scene.soundAssignments || [];
            for (const sa of dir.soundAssignments) scene.soundAssignments.push(sa);
          }
          // Frontière AST (Palier 3) : `soundAssignments` est un porteur TRANSITOIRE
          // (hoisté top-level ci-dessus) ; on le retire TOUJOURS de l'ActorDirective.
          // Canonique = `assignments?` OPTIONNEL, jamais `soundAssignments:null`.
          // décision PM : pas de duplication.
          delete dir.soundAssignments;
        } else if (dir.type === 'SoundSection') {
          // v0.8 — @sound { ... } / @sound bell { ... } / @sound.libname[:variant]
          scene.soundPrototypes = scene.soundPrototypes || [];
          for (const p of dir.prototypes) scene.soundPrototypes.push(p);
          // mémoriser la directive (utile pour lib externe ou variante)
          if (dir.lib) {
            scene.directives.push({
              type: 'Directive', name: 'sound', subkey: dir.lib,
              binding: dir.libVariant || null, runtime: null, value: null,
              aliases: null, modifiers: null, line: dir.line,
            });
          }
        } else if (dir.type === 'AlphabetSoundAssignments') {
          // v0.8 — affectations sujet→son collectées dans un @alphabet.X.
          // Le wrapper contient la Directive d'origine (à pousser comme d'hab)
          // et les affectations (à pousser top-level dans soundAssignments).
          scene.directives.push(dir.directive);
          scene.soundAssignments = scene.soundAssignments || [];
          for (const sa of dir.assignments) scene.soundAssignments.push(sa);
        } else if (dir.type === 'LibRef') {
          // Canal NEUTRE des invocations par provenance (@factory.*/@mine.*).
          // Adresse canonique opaque ; ordre source préservé ; dédup en fin de parseScene ;
          // champ OMIS si vide (jamais `[]`) — contrat bpscript-bpx.md §libRefs.
          (scene.libRefs || (scene.libRefs = [])).push(dir.address);
        } else if (dir.type === 'Declaration') {
          scene.declarations.push(dir);   // `gate Sa:midi` — propriété sur un nom existant
        } else if (dir.name === 'mode' && dir.runtime) {
          // @mode:X is a block directive, not a lib directive
          initialMode = dir.runtime;
          initialModifiers = dir.modifiers || null;
        } else {
          scene.directives.push(dir);
        }
      } else if (atProductionBlock()) {
        // Le bloc `[@…]` en tête de scène est REFUSÉ depuis le 2026-08-10 : il est lu ici pour
        // que le refus NOMME la clé et donne sa réécriture (`parseProductionBlock`), au lieu de
        // tomber sur un « crochet inattendu » qui n'apprendrait rien.
        for (const d of parseProductionBlock()) scene.directives.push(d);
      } else {
        scene.backticks.push(parseBacktickOrphan());
      }
      premiereLigne = false;
      skipNewlines();
    }

    // LE MÉTRONOME PORTE UN SEUL NOM, `tempo`, DE LA SURFACE JUSQU'À L'ARBRE — et aucune
    // normalisation ne vit plus ici : la donnée le déclare une fois, sous ce nom, dans la section
    // `subgrammar` d'`engine` (`lib/engine.bpsl`). Il s'écrit en tête de scène ET en modificateur
    // de sous-grammaire, parce que le natif a les deux places.
    //
    // ⚠️ CE QUI RESTE `mm` NOMME LE MOTEUR, PAS LE LANGAGE : `_mm(N)`, le contrôle natif, que la
    // donnée porte en `bp3:_mm` et que 25 grammaires du corpus natif écrivent. Le frontal BP3 le
    // lit et le traduit ; le renommer serait renommer du vocabulaire BP3 au nom de BPScript.

    // Load libraries based on the head directives — determines known controls
    libCtx = loadLibsFromDirectives(scene.directives);

    // Build scene.homomorphisms (contrat BPx ast.ts:150-157) from loaded
    // transcription tables. Called after loadLibsFromDirectives so that
    // libCtx.transcriptions is fully populated.
    scene.homomorphisms = buildHomomorphisms(libCtx.transcriptions, scene.directives);

    // Process actor directives — add to libCtx for dot notation lookup
    libCtx.actors = {};
    for (const actor of scene.actors) {
      libCtx.actors[actor.name] = actor.properties;
    }

    // Process scene directives — scene names become known terminals
    libCtx.sceneNames = new Set();
    for (const sc of scene.scenes) {
      libCtx.sceneNames.add(sc.name);
      libCtx.symbols[sc.name] = { type: 'scene' };
    }

    // Parse subgrammars
    enDeclaratif = false;
    scene.subgrammars = parseSubgrammars(initialMode, initialModifiers);

    // Parse optional template section (SINGULIER, NU — seule graphie acceptée).
    // ⚠️ La graphie plurielle `templates` (v0.7) est REFUSÉE depuis le 2026-07-19. bpx a migré
    // ses scènes vers `template` et retiré ses alias ; plus aucun consommateur ne l'écrit.
    // Un alias qui survit à ses derniers usagers est du poison différé, pas de la prudence.
    skipNewlines();
    scene.template = null;
    // ⚠️ PAS d'alias `scene.templates` : le champ canonique est `template` (SINGULIER),
    // normatif dans `AST.md:40`. L'alias pluriel a été SUPPRIMÉ le 2026-07-19 (arbitrage
    // Romain : le rétrocompat s'enlève, un seul nom). Scan aval fait par bpx AVANT le
    // retrait : aucun consommateur ne lisait `scene.templates` — ni Kanopi, ni Kairos, ni
    // les runtimes, ni bp3-frontend ; seul BPx avait un repli `ast.template ?? ast.templates`,
    // qu'il retire dans le même mouvement.
    if (at(T.IDENT) && current().value === 'template') {
      const entries = parseTemplateSection();
      // ── LE CATALOGUE PORTE SON DESTINATAIRE ────────────────────────────────────────────────
      // FORME VALIDÉE PAR ROMAIN le 2026-08-10 (second geste après le transport verbatim) : le
      // catalogue cesse d'être un tableau nu et devient un objet qui SE DÉCLARE. Les entrées ne
      // changent pas — la ligne verbatim reste ce qu'elle était ; seul le PORTEUR change de nature.
      //
      // ⚠️ POURQUOI CE CHAMP EST OBLIGATOIRE, ET C'EST LE SEUL DÉFAUT SILENCIEUX DE CE CHANTIER :
      // DEUX GRAPHIES vivent, chacune dans son chemin — une scène BPScript écrit son catalogue en
      // graphie BPScript, un fichier de gabarits natif se charge en graphie native. Et le GLYPHE
      // QUI DÉCIDE est le point d'interrogation : joker en BPScript, ELLIPSE en natif. Une ligne
      // dont le destinataire est perdu se lit donc SANS LEVER AUCUNE ERREUR et rend un AUTRE ARBRE.
      //
      // Le champ n'a pas de défaut, et c'est délibéré : un défaut serait exactement la devinette
      // qu'on ferme. Une scène BPScript écrit toujours 'bpscript' — elle n'a jamais l'autre
      // destinataire ; 'bp3' est celui d'un catalogue natif chargé tel quel.
      scene.template = { destinataire: 'bpscript', entrees: entries };
    }

    // ── Post-pass : DÉPLIAGE DES COMMODITÉS D'ÉCRITURE ────────────────────────
    // AVANT la pose des sceaux, et c'est la seule place juste : ce qui sort du dépliage est alors
    // décoré par LE MÊME code que l'écriture directe, au lieu d'une copie de cette décoration
    // écrite à la main plus loin — deux décorations pour une notion divergent, et la seconde ne
    // rougirait pas le jour où la première change.
    deplierLesCommodites(scene);

    // ── Post-pass : annotation payload (AST_SPEC v1 §2) ───────────────────────
    // Parcourt récursivement tous les éléments RHS et attache un `payload` à
    // chaque nœud annatable. Le payload est ADDITIF (l'encodeur BP3 ignore les
    // champs inconnus) et AGNOSTIQUE (zéro notion BP3 : pas de _script, flavor…).
    //
    // Règle de résolution d'acteur :
    //   1. Acteur explicite sur le nœud (dot-notation `sitar.Sa`).
    //   2. Acteur unique de la règle (quand la LHS est un symbole unique d'acteur).
    //   3. Omis (le dispatcher résout via la déclaration actors[]).
    //
    // Règle flux :
    //   - `InstantControl` → flux:true (toujours)
    //   - `Control` standalone de nature transport-control → flux:true
    //   - Override d'occurrence collé sur un Symbol (suffixQualifiers) → pas de flux
    annotateScene(scene);

    // libRefs (canal neutre provenance) : dédup en préservant l'ordre source (contrat §libRefs).
    // Le champ reste OMIS si aucune invocation par provenance (jamais `[]`).
    if (scene.libRefs) {
      const seen = new Set();
      scene.libRefs = scene.libRefs.filter((a) => (seen.has(a) ? false : (seen.add(a), true)));
    }

    return scene;
  }

  // ============================================================
  // Post-pass dépliage des commodités d'écriture (`def`)
  // ============================================================

  /**
   * DÉPLIE TOUTE COMMODITÉ D'ÉCRITURE AVANT L'ARBRE — une forme sert à écrire, elle ne voyage pas.
   *
   * L'arbre ne porte que le vocabulaire CANONIQUE : tout ce qui est en aval — la table des
   * destinataires, les gardes, les cinq voisins — s'y indexe sans un seul cas particulier. Une
   * définition qui traversait laissait à CHAQUE consommateur le soin de la redéplier, et aucun ne
   * le faisait : le nom sortait en symbole opaque étiqueté SONNANT, donc lu en aval comme une note.
   *
   * ⚠️ TOUTES LES DÉFINITIONS NE SONT PAS DU SUCRE, et les confondre effacerait des choses réelles.
   * Se déplient les trois sortes qui n'ajoutent QUE de l'écriture :
   *   `prereglage`      `def kick (vel:120)`        un sac de réglages nommé ;
   *   `structure`       `def cadence sa re ga pa`   une suite de termes nommée ;
   *   `transformation`  `def accent(x) x(vel:120)`  une suite de termes nommée, à trous.
   * Ne se déplient pas : un TERMINAL déclaré (`def ka voice.sec`) — il CRÉE un nom et doit
   * survivre —, une définition de CODE, un CÂBLAGE, une INVOCATION DE MODULE.
   *
   * LA MACRO SE CONFORME À LA RÉÉCRITURE (arbitrage Romain, 2026-08-13) : le corps entre dans la
   * règle ÉLÉMENT PAR ÉLÉMENT, il ne forme pas de groupe, et le nom occupe la durée de ce qu'il
   * contient. `def motif C4 D4` puis `motif E4` donne donc `C4 D4 E4`.
   *
   * LA CIBLE EST CELLE QU'ÉCRIRAIT LA MAIN : `accent(C4)` devient EXACTEMENT ce que produit
   * `C4(vel:120)` au même endroit. D'où le moment choisi — avant la pose des sceaux, jamais après : ce qui sort
   * d'ici est décoré par le MÊME code que l'écriture directe, au lieu d'une copie de cette
   * décoration écrite à la main plus loin. Deux décorations pour une notion divergent, et la
   * seconde ne rougirait pas le jour où la première change.
   *
   */
  function deplierLesCommodites(scene) {
    // ⛔ UNE INVOCATION DE MODULE N'EST PAS UNE STRUCTURE, et sans ce tri elle se dépliait.
    // `var ramp1 ramp` puis `def monte ramp1(from:0, to:255)` (LANGUAGE.md, « `!` accepte tout ce
    // qui se pose dans le flux ») : le parser type `monte` en STRUCTURE parce que le corps commence
    // par un terme nu. Or `ramp1` est une INSTANCE DE MODULE déclarée, `from` et `to` sont ses
    // ports, et l'invocation est une CHOSE — elle ne se déplie pas. Le défaut était muet tant que
    // rien ne se dépliait ; il devient une erreur de compilation dès que le corps devient du vrai
    // contenu d'arbre.
    const modules = new Set();
    for (const v of scene.vars || []) {
      if (v?.varType?.kind === 'module') for (const n of v.names || []) modules.add(n);
    }
    const inviteUnModule = (corps) => (corps || []).some(
      (el) => el && (el.type === 'Symbol' || el.type === 'SymbolCall') && modules.has(el.name));

    const formes = new Map();
    for (const d of scene.defs || []) {
      if (!d || d.type !== 'DefDirective') continue;
      if (d.kind === 'prereglage') { formes.set(d.name, d); continue; }
      if (d.kind === 'structure' || d.kind === 'transformation') {
        if (!inviteUnModule(d.body)) formes.set(d.name, d);
      }
    }
    if (!formes.size) return;

    // ⛔ LE DÉPLIAGE NE TOUCHE QUE LE MEMBRE DROIT, et le membre gauche est le contre-exemple qui
    // l'exige : `def motif C4 D4` puis `motif -> C4` est un CONFLIT DE NOMS, refusé ailleurs. En
    // balayant l'arbre entier je remplaçais la TÊTE de la règle par le corps de la définition — la
    // règle perdait son nom et le conflit ne se déclarait plus. Une forme s'emploie là où un terme
    // s'emploie ; une tête de règle n'est pas un emploi, c'est une déclaration.
    //
    // ⚠️ LE DÉPLIAGE SE REJOUE JUSQU'AU POINT FIXE, parce qu'une forme peut en contenir une autre.
    // La borne n'est pas une prudence : sans elle, `def a b` + `def b a` boucle sans fin, et un
    // compilateur qui ne rend jamais la main est pire qu'un refus.
    const membresDroits = [];
    for (const sg of scene.subgrammars || []) {
      for (const rule of sg.rules || []) if (rule && rule.rhs) membresDroits.push(rule.rhs);
    }
    for (let tour = 32; ; tour--) {
      if (!remplacerDans(membresDroits, formes, tour)) break;
    }
  }

  /**
   * Remplace, DANS les tableaux qui portent les éléments, chaque usage d'une forme par son corps.
   * C'est le conteneur qui doit voir l'élément changer de nature — et parfois de NOMBRE, une
   * structure valant plusieurs termes.
   *
   * LE CORPS ENTRE DANS LA RÈGLE ÉLÉMENT PAR ÉLÉMENT, il ne forme PAS de groupe (arbitrage Romain,
   * 2026-08-13, « une macro se conforme à la réécriture ») : `def motif C4 D4` puis `motif E4`
   * donne `C4 D4 E4`, et `motif` occupe la durée de ce qu'il contient.
   */
  function remplacerDans(n, formes, reste) {
    if (!n || typeof n !== 'object') return false;
    if (Array.isArray(n)) {
      let bouge = false;
      for (let i = 0; i < n.length; i++) {
        const el = n[i];
        const sortie = (el && typeof el === 'object' && el.name) ? corpsPour(el, formes) : null;
        if (sortie) {
          if (!reste) {
            throw new ParseError(
              `'${el.name}' se déplie sans fin — une définition finit par se réinvoquer elle-même. `
              + `Une forme qui se contient ne se déplie pas.`, jetonDe(el));
          }
          n.splice(i, 1, ...sortie);
          i += sortie.length - 1;
          bouge = true;
        } else if (remplacerDans(el, formes, reste)) bouge = true;
      }
      return bouge;
    }
    let bouge = false;
    for (const v of Object.values(n)) if (remplacerDans(v, formes, reste)) bouge = true;
    return bouge;
  }

  const jetonDe = (el) => ({ line: el?.line ?? 0, col: el?.col ?? 0 });
  const copieProfonde = (n) => JSON.parse(JSON.stringify(n));

  /**
   * Ce qu'un usage devient — une liste d'éléments, qui prend sa place dans la séquence.
   * LA SORTE SE LIT SUR LA FORME DE L'USAGE, et l'écart se refuse au lieu de se deviner : une
   * transformation s'appelle avec ses arguments, un préréglage et une structure se posent nus.
   */
  function corpsPour(el, formes) {
    const def = formes.get(el.name);
    if (!def) return null;

    if (el.type === 'SymbolCall') {
      if (def.kind !== 'transformation') {
        throw new ParseError(
          `'${el.name}' est ${def.kind === 'prereglage' ? 'un préréglage' : 'une structure'} : il se `
          + `pose NU, sans arguments. Écrire '${el.name}'. Une liste de paramètres se déclare avec `
          + `le nom ('def ${el.name}(x) …'), et alors seulement l'appel en porte.`, jetonDe(el));
      }
      return corpsSubstitue(def, el);
    }
    if (el.type !== 'Symbol') return null;
    if (def.kind === 'transformation') {
      throw new ParseError(
        `'${el.name}' est une transformation sur ${def.params.join(', ')} : elle s'appelle avec ses `
        + `arguments. Écrire '${el.name}(${def.params.map(() => '…').join(', ')})'. Posé nu, le nom `
        + `sortirait de l'arbre en terminal et sonnerait.`, jetonDe(el));
    }
    if (def.kind === 'prereglage') {
      // Le nœud EXACT que produit `!(vel:120)` écrit à la même place — pas une forme voisine :
      // fabriquer un intermédiaire ferait de la définition une TROISIÈME écriture, alors qu'elle
      // n'en est qu'un raccourci.
      return [{
        type: 'InstantControl',
        qualifier: copieProfonde(def.settings),
        conjoint: false,
        line: el.line,
      }];
    }
    return copieProfonde(def.body);
  }

  /** Le corps d'une transformation, ses paramètres remplacés par les arguments de l'appel. */
  function corpsSubstitue(def, appel) {
    const args = appel.args || [];
    const nommes = args.filter((a) => a && a.key != null);
    if (nommes.length) {
      throw new ParseError(
        `'${def.name}(…)' : un argument de transformation se donne par POSITION, jamais par nom — `
        + `reçu '${nommes[0].key}:'. Écrire '${def.name}(${def.params.map(() => '…').join(', ')})', `
        + `les paramètres dans l'ordre de la définition (${def.params.join(', ')}).`, jetonDe(appel));
    }
    if (args.length !== def.params.length) {
      throw new ParseError(
        `'${def.name}' se définit sur ${def.params.length} paramètre(s) (${def.params.join(', ')}) `
        + `et s'appelle ici avec ${args.length} argument(s). Une transformation appelée de travers `
        + `laisserait un paramètre non substitué dans l'arbre, sous la forme d'un terminal qui `
        + `sonnerait.`, jetonDe(appel));
    }
    const valeurs = new Map();
    def.params.forEach((p, i) => {
      const v = args[i]?.value;
      // Le site d'appel ne lit qu'un TERME NU : c'est ce que le langage accepte aujourd'hui, et ce
      // qu'un argument d'une autre forme produirait ne se devine pas — il se refuse.
      if (!v || v.type !== 'Literal' || (typeof v.value !== 'string' && typeof v.value !== 'number')) {
        throw new ParseError(
          `'${def.name}(…)' : l'argument '${p}' n'est pas un terme. Un argument de transformation `
          + `est un NOM (un terminal, une tête de règle), écrit nu.`, jetonDe(appel));
      }
      valeurs.set(p, String(v.value));
    });
    // La substitution porte sur le NOM du symbole, et sur lui seul : tout ce qui est accroché au
    // paramètre dans le corps — sac collé, liaison, groupe qui l'entoure — appartient à la
    // DÉFINITION et reste en place. C'est ce qui fait que `x(vel:120)` rend `C4(vel:120)`.
    const substituer = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(substituer); return; }
      if (n.type === 'Symbol' && valeurs.has(n.name)) {
        // ⚠️ UN ARGUMENT QUALIFIÉ SE SÉPARE EN ACTEUR ET TERMINAL, il ne devient pas un nom à
        // rallonge. `halo(melodie.C4)` doit poser `Symbol{actor:'melodie', name:'C4'}` — ce que
        // produit `melodie.C4` écrit en direct. Sans cette séparation, l'arbre portait un terminal
        // littéralement nommé « melodie.C4 », refusé comme absent des alphabets : le dépliage
        // rendait alors un arbre DIFFÉRENT de l'écriture directe, ce que le garde interdit.
        const brut = valeurs.get(n.name);
        const point = brut.indexOf('.');
        if (point > 0) { n.actor = brut.slice(0, point); n.name = brut.slice(point + 1); }
        else n.name = brut;
      }
      for (const v of Object.values(n)) substituer(v);
    };
    const corps = copieProfonde(def.body);
    substituer(corps);
    return corps;
  }

  // ============================================================
  // Post-pass annotation payload (AST_SPEC v1 §2)
  // ============================================================

  /**
   * Annote récursivement toute la scène (entrée : après parseSubgrammars).
   * Modifie les nœuds en place (payload additif).
   */
  function annotateScene(scene) {
    // États de drapeau nommés (`var section flag: calm:1, full:2` — ex-`flag`, tombée le
    // 2026-08-05) résolus DANS L'AST : une garde `[scene==calm]` ou une mutation `[scene=calm]`
    // portant un alias DÉCLARÉ voit sa `value` résolue en ENTIER (calm → 1). Un IDENT NON déclaré
    // reste tel quel (référence à un autre drapeau, fidèle BP3). Indispensable à la voie AST
    // directe (BPx lit l'AST, pas la table) ; le texte BP3 reste identique (l'encodeur reçoit
    // alors un entier, no-op). Bug remonté par bpx (G2), directive « source unique = AST ».
    const flagStates = {};
    for (const v of scene.vars || []) {
      if (v?.varType?.kind === 'flag') {
        const mm = flagStates[v.names[0]] || {};
        for (const s of v.varType.states) mm[s.name] = s.value;
        flagStates[v.names[0]] = mm;
      }
    }
    // ⛔ ET UN NOM QUI NE DÉSIGNE RIEN EST REFUSÉ — L'INCOMPLÉTUDE SE REFUSE À L'USAGE.
    //
    // ⚠️ CE CRI N'EXISTAIT NI AU TEST NI À LA MUTATION, y compris sur un drapeau COMPLET : mesuré,
    // `flag s(x:1)` suivi de `[s==a]` passait en silence alors que `a` n'est déclaré nulle part.
    // Le seul refus de cette famille portait sur la DÉCLARATION nue (`flag s`), qui empêchait le
    // drapeau VIDE et n'a jamais empêché l'ÉTAT INCONNU. Ce sont deux choses, et une seule était
    // gardée — celle qui va cesser de l'être, par décision du prototypal pur.
    //
    // ⛔ ET LE NOM D'UN AUTRE DRAPEAU RESTE ADMIS. Le commentaire ci-dessus le nommait — « référence
    // à un autre drapeau, fidèle BP3 » — et le refuser aurait fermé une forme que je ne sais pas
    // juger. Mesure des deux corpus : 11 usages, TOUS vers un état déclaré, ZÉRO vers un autre
    // drapeau, ZÉRO vers un inconnu. Le cri ne rattrape donc rien : il empêche ce que personne n'a
    // encore écrit, et c'est le bon moment pour le poser.
    // ⛔ ET LE CRI NE VAUT QUE SUR UN DRAPEAU QUI DÉCLARE DES ÉTATS. Un drapeau non déclaré est
    // LÉGITIME et fidèle à BP3 : `X -> lambda [Num_a=20, Num_b=0]` crée ses drapeaux à l'usage,
    // sans aucune ligne de déclaration, et `[Num_a>Num_b]` les compare. Ma première écriture criait
    // dessus et cassait une grammaire ACTIVE du corpus — trouvée par le portillon, pas par ma
    // mesure : je n'avais compté que les scènes qui PORTENT une déclaration de drapeau, donc
    // j'avais exclu de mon périmètre exactement les scènes que mon cri allait atteindre.
    // Là où des états SONT déclarés, l'auteur a dit ce que le drapeau accepte, et un nom hors de
    // cette liste ne désigne rien.
    const criFlags = [];
    const resolveFlag = (flag, value, ou) => {
      if (typeof value !== 'string') return value;
      const etats = flagStates[flag];
      if (etats && Object.prototype.hasOwnProperty.call(etats, value)) return etats[value];
      if (Object.prototype.hasOwnProperty.call(flagStates, value)) return value;   // un autre drapeau
      if (!etats) return value;                       // régime BP3 : le drapeau n'est pas déclaré
      criFlags.push(
        `${ou} '[${flag}${ou === 'mutation' ? '=' : '=='}${value}]' : '${value}' n'est ni un état `
        + `déclaré par '${flag}', ni le nom d'un autre drapeau. Les états d'un drapeau se déclarent `
        + `avec lui — '${flag}(${value}:<entier>)' — et un nom qui ne désigne rien ne se compare à `
        + `rien.${etats ? ` '${flag}' déclare ${JSON.stringify(Object.keys(etats))}.` : ` '${flag}' `
        + `ne déclare aucun état : il ne peut servir que de modèle, jamais s'employer.`}`);
      return value;
    };

    for (const sg of scene.subgrammars) {
      for (const rule of sg.rules) {
        // Gardes + mutations : résoudre les états de drapeau nommés DÉCLARÉS en entier.
        const guards = Array.isArray(rule.guard) ? rule.guard : (rule.guard ? [rule.guard] : []);
        for (const g of guards) {
          if (g && g.flag != null && 'value' in g) g.value = resolveFlag(g.flag, g.value, 'garde');
        }
        for (const f of rule.flags || []) {
          if (f && f.flag != null && 'value' in f) f.value = resolveFlag(f.flag, f.value, 'mutation');
        }

        // Résolution de l'acteur de règle : quand tous les symboles LHS appartiennent
        // au même acteur (cas fréquent), on peut pré-remplir l'acteur.
        // En Phase 1 on passe null : l'acteur est résolu au niveau token (dot-notation).
        annotateRhsElements(rule.rhs, null);

        // Qualifier de NIVEAU RÈGLE `S -> … (vel:80)` : CONTENANCE (concept neuf BPScript,
        // décision Romain 2026-06-20). Un `(...)` nu est STRUCTUREL et CONFINÉ : il gouverne
        // toute sa portée (y compris les notes écrites avant lui) et s'arrête au bord — il ne
        // DÉBORDE pas. C'est l'inverse du flux `!(...)` (iso-BP3, forward, déborde). On le tague
        // `containment` (PAS `flux`) : BPx route contenance→structurel, flux→séquentiel.
        if (rule.settings && typeof rule.settings === 'object') {
          const { address, controls } = splitAddress(extractOccurrenceParams([rule.settings]));
          rule.settings.payload = {
            nature: 'transport-control',
            containment: true,
            scope: 'rule',
            ...(controls ? { params: controls } : {}),
            ...(address ? { address } : {}),
          };
        }
      }
    }
    // ⛔ LES CRIS SORTENT ICI, APRÈS LE BALAYAGE ENTIER — jamais au premier trouvé : un auteur qui
    // a écrit trois états inconnus doit voir les trois, pas les découvrir un par un en trois
    // compilations. Le premier porte le refus, les autres le suivent dans le même message.
    if (criFlags.length) {
      throw new ParseError(
        criFlags.length === 1 ? criFlags[0]
          : `${criFlags.length} usages de drapeau ne désignent rien :\n  · ${criFlags.join('\n  · ')}`,
        { line: 0, col: 0 });
    }
  }

  /**
   * Annote une liste plate d'éléments RHS (ou une voix polymétrique).
   * @param {Array} elements  - liste de nœuds RHS
   * @param {string|null} ruleActor - acteur déduit du contexte (null en Phase 1)
   */
  function annotateRhsElements(elements, ruleActor) {
    // Validation de l'ancrage conjoint PAR VOIX : un `!(...)` collé n'est CONJOINT que s'il
    // existe un terminal sonnant AVANT lui dans cette même séquence ; sinon il retombe en
    // événement séparé (non conjoint). On parcourt en suivant le dernier sonnant rencontré.
    let prevSounding = false;
    for (const el of elements) {
      if (el && el.type === 'InstantControl' && el.conjoint && !prevSounding) {
        el.conjoint = false;
      }
      annotateRhsNode(el, ruleActor);
      if (el && (el.type === 'Symbol' || el.type === 'SymbolCall' || el.type === 'OutTimeObject' ||
                 el.type === 'TieStart' || el.type === 'TieContinue' || el.type === 'TieEnd' ||
                 el.type === 'SimultaneousGroup' || el.type === 'Polymetric')) {
        prevSounding = true;
      }
    }
  }

  /**
   * Annote un nœud RHS individuel avec `payload`.
   * Rec dans Polymetric.voices.
   *
   * Nœuds qui reçoivent un payload.nature :
   *   Symbol, SymbolCall, OutTimeObject, TieStart, TieContinue, TieEnd → 'sounding'
   *   Rest, UndeterminedRest                                            → 'rest'
   *   Prolongation                                                      → 'prolongation'
   *   Control  → 'engine-control' (bp3NativeControls) ou 'transport-control'
   *   InstantControl                                                     → 'instant'
   *   Wait                                                          → 'wait'
   *
   * Nœuds sans payload.nature (structurels) :
   *   Period, NumericDuration, NilString, RawBrace, Polymetric,
   *   Wildcard, Variable, Homomorphism, gabarits…
   *   (on récurse dans Polymetric)
   */
  function annotateRhsNode(el, ruleActor) {
    if (!el || typeof el !== 'object') return;

    const type = el.type;

    // ── Nœuds sonnants ────────────────────────────────────────────────
    if (type === 'Symbol' || type === 'SymbolCall' ||
        type === 'OutTimeObject' ||
        type === 'TieStart' || type === 'TieContinue' || type === 'TieEnd') {

      // Acteur : dot-notation (el.actor) ou ruleActor
      const actor = el.actor || ruleActor || undefined;

      // Overrides d'occurrence collés sur la note. Deux origines, MÊME notion
      // (charge d'occurrence sur la note), repliées dans le MÊME payload.params
      // pour que l'aval (BPx) lise payload.params PARTOUT, uniforme :
      //   - suffixQualifiers : `dha(vel:80)` quand `vel` est un contrôle connu
      //     (la note reste Symbol + qualifieur collé) ;
      //   - args de SymbolCall : `dha(vel:80)` sans lib de contrôles chargée,
      //     OU dans un accord `C4!E4(vel:90)` (le secondaire est toujours un
      //     SymbolCall) — décision frontière R4 (architecte 2026-06-23).
      let params = extractOccurrenceParams(el.suffixQualifiers);
      // ⛔ LE SAC COLLÉ À UN ÉLÉMENT PORTE SON SCEAU, comme celui d'un groupe et celui d'une règle.
      //
      // ⚠️ MESURÉ PAR BPx le 2026-08-08, et c'est le seul point qui les bloquait : sur les CINQ
      // accrochages d'un sac, trois portaient un `payload` (règle, groupe, fermante) et DEUX n'en
      // avaient aucun — le sac collé à une note, et le sac posé dans le flux. Or ce sont
      // précisément les deux endroits où `vel` est le plus écrit du corpus (97 et 322 fois), et
      // deux des six valeurs du vocabulaire de portée. Sans sceau, la portée reste DÉCLARABLE dans
      // la librairie mais INVÉRIFIABLE là où elle sert le plus : on peut écrire qu'un réglage vaut
      // sur un élément, et rien dans l'arbre ne dit qu'un sac donné est sur un élément.
      // `containment: true` : un sac collé ne déborde pas de ce qu'il habille — même régime que le
      // groupe et la règle, jamais du flux.
      for (const sq of (el.suffixQualifiers || [])) {
        if (!sq || sq.type !== 'SettingBag') continue;
        const { address: adrSq, controls: ctrlSq } = splitAddress(extractOccurrenceParams([sq]));
        sq.payload = {
          nature: 'transport-control',
          containment: true,
          scope: 'symbol',
          ...(ctrlSq ? { params: ctrlSq } : {}),
          ...(adrSq ? { address: adrSq } : {}),
        };
      }
      const argParams = extractSymbolCallParams(el);
      if (argParams !== null) params = { ...(params || {}), ...argParams };

      // GAP#2 : la charge se range en DEUX tiroirs — `address` (canal/device/port, lu par
      // Kairos pour matérialiser event.output) et `params` (contrôles vel/pan/wave…).
      const { address, controls } = splitAddress(params);
      // ⚠️ UNE VARIABLE DE TRAVAIL N'EST PAS UNE NOTE, et sa nature doit le dire — sinon `var`
      // serait une porte nommée qui ne change RIEN : la scène compilerait et l'aval continuerait
      // d'inventer une hauteur pour un symbole qui n'en a pas. C'est le défaut mesuré par Kairos
      // sur `Nadaka-1er-essai` : le symbole `A8` sortait SONNANT, et sa résolution lui donnait
      // 7040 Hz. Accepter n'est pas transmettre.
      //
      // Même mécanisme que la nature `wait`, posée deux jours plus tôt pour la même raison mot pour
      // mot : un jeton qui n'est pas une note et que l'aval ne doit pas traiter comme telle. On
      // n'invente pas un mécanisme, on applique celui qui vient d'être éprouvé.
      // Le NOM se lit à deux endroits selon la forme : `el.name` pour un symbole, `el.symbol` pour
      // une note LIÉE (`a~` produit un `TieStart` qui range son nom là). Mesuré le 2026-07-27 :
      // sans le second, `a~` sortait SONNANT alors que `a` seul sortait variable — la même faute
      // que l'attente ancrée deux jours plus tôt, une forme dérivée qui perd ce que la forme nue
      // porte. On lit donc les deux, pas celle du cas qu'on vient d'écrire.
      const nomPorte = typeof el.symbol === 'string' ? el.symbol : el.name;
      const estVariable = nomsVariables.has(nomPorte);
      // ⚠️ LA NATURE DIT SI LE SYMBOLE SONNE, et l'aval la suit sans la rejuger (contrat
      // d'opacité : les consommateurs portent, ils ne fabriquent pas). Deux valeurs seulement —
      // un nom déclaré comme variable de travail, tout le reste sonnant.
      //
      // ⚠️ ET UNE NATURE QUI CONTREDIT UN AUTRE DE MES SIGNAUX COÛTE UN TEMPS ENTIER DE MUSIQUE :
      // publier un nom HORS de `noteTerminals` — donc dire qu'il ne sonne pas — tout en posant
      // `sounding` dessus a fait émettre un terminal de 500 ms là où rien ne devait durer.
      // Les deux signaux se lisent ensemble ; l'aval n'a pas à départager mes contradictions.
      el.payload = {
        nature: estVariable ? 'var' : 'sounding',
        ...(actor !== undefined ? { actor } : {}),
        ...(controls !== null ? { params: controls } : {}),
        ...(address !== null ? { address } : {}),
        ...((controls !== null || address !== null) ? { occurrence: true } : {}),
        // flux absent (override d'occurrence, pas de propagation)
      };
      return;
    }

    // ── POINT D'ATTENTE — `<!nom` ──────────────────────────────────────
    // Nature `wait`, posée au contrat le 2026-07-26 (BPx AST_SPEC.md:461-486, c96deb3), en
    // conséquence de la décision Romain « le point d'attente doit vivre dans l'arbre ». C'était le
    // SEUL élément de membre droit sans nature — et un élément qui vit dans l'arbre sans en porter
    // une n'y vit qu'à moitié : un consommateur qui trie les feuilles par nature le perdait en
    // silence, alors qu'il est là POUR être observable.
    //
    // Le nom dit le RÔLE, pas la graphie : `<!nom` est la surface, `Wait` le type de nœud,
    // `wait` ce que le jeton EST pour le temps — cohérent avec les six autres valeurs.
    //
    // ⚠️ NE PAS CONFONDRE AVEC UN SILENCE : un silence OCCUPE du temps, une attente le SUSPEND.
    // Durée nulle, ne fait pas avancer la grille — même ressort qu'`instant`. Les deux se
    // ressemblent en prose et se comportent à l'opposé.
    if (type === 'Wait') {
      el.payload = { nature: 'wait' };
      return;
    }

    // ── Note PORTANT UN POINT D'ATTENTE — `C4<!sync1` ──────────────────
    // Le symbole reste une NOTE : le point d'attente est ancré SUR lui, il ne le remplace pas.
    // Mesuré le 2026-07-26 : l'annotateur ne descendait pas dans `el.symbol`, donc `C4<!sync1`
    // perdait sa nature `sounding` — la même note écrite sans point d'attente la portait. Un
    // consommateur qui trie les feuilles par nature perdait donc la note en silence.
    //
    // ⚠️ ET LE POINT D'ATTENTE ANCRÉ EN PORTE UNE AUSSI. Mesuré par BPx le 2026-07-27 : cette
    // branche descendait dans `el.symbol` puis RETOURNAIT — les attentes ancrées n'étaient jamais
    // annotées. Ce n'est pas un cas de bord : le parser ancre l'attente sur le symbole qui précède
    // MÊME séparée par une espace (`C4 <!sync1`), donc toute attente précédée d'une note tombait
    // dans le trou. L'aval découpe le flux sur la NATURE, plus sur un nom : sans elle, l'attente
    // arrive en position et en durée mais rien ne s'arme dessus.
    if (type === 'SymbolWithWait' && el.symbol) {
      annotateRhsNode(el.symbol, ruleActor);
      for (const t of (el.triggers || [])) annotateRhsNode(t, ruleActor);
      return;
    }

    // ── Silence ────────────────────────────────────────────────────────
    // ⚠️ UN NOMBRE NU EST UN SILENCE, ET IL PORTE DONC `rest` COMME LES AUTRES.
    // Décision Romain 2026-07-30 (`hub/decisions/2026-07-30-un-nombre-nu-est-un-silence-de-
    // duree-n.md`) : « Un nombre nu dans les règles de production, c'est un silence de durée n »,
    // et `-` ne diffère pas de `1`. La décision est explicite sur la conséquence : « Aucune
    // huitième nature à inventer — un nombre nu porte `rest` ; la nature existe déjà. »
    //
    // Mesuré le 2026-08-06 : `S -> C4 2 D4` rendait un `NumericTerminal` SANS AUCUNE nature.
    // ⚠️ Et absent n'est pas neutre — `AST.md` le dit en tête : un champ omis annonce que le
    // producteur IGNORE la question. L'aval devait donc deviner, pour une famille qui pèse 531
    // terminaux numériques et 1876 durées dans la seule scène `watch`.
    //
    // ⚠️ CE QUI M'AVAIT ÉGARÉ, et Romain l'a corrigé : j'ai lu « terminal NEUTRE » (ratification
    // du 2026-07-17) comme « qui sonne ». « Neutre » porte sur la SORTE DU NOM — un nombre ne
    // nomme aucune règle — et ne dit rien du son. J'ai bâti sur ce contresens un raisonnement
    // entier, jusqu'à ouvrir un préavis de frontière à BPx pour rien.
    if (type === 'Rest' || type === 'UndeterminedRest'
        || type === 'NumericTerminal' || type === 'NumericDuration') {
      el.payload = { nature: 'rest' };
      return;
    }

    // ── Prolongation ───────────────────────────────────────────────────
    if (type === 'Prolongation') {
      el.payload = { nature: 'prolongation' };
      return;
    }

    // ── Contrôles ──────────────────────────────────────────────────────
    if (type === 'Control') {
      const isEngine = libCtx.bp3NativeControls && libCtx.bp3NativeControls.has(el.name);
      const nature = isEngine ? 'engine-control' : 'transport-control';
      el.payload = {
        nature,
        // flux:true pour un transport-control standalone (propagation de flux)
        ...(nature === 'transport-control' ? { flux: true } : {}),
      };
      return;
    }

    // ── Contrôle instantané !(…) ou ![@seed] ──────────────────────────
    if (type === 'InstantControl') {
      // Le sac du flux porte son sceau, lui aussi — voir la note sur le sac collé plus haut :
      // c'est l'un des deux qui n'en avaient pas, et le plus écrit du corpus (322 occurrences).
      // ⚠️ `containment: false` ET PAS `true` : c'est toute la différence de ce sac. Il ne borne
      // rien — il pose un état qui court vers l'avant, au-delà de la fin de sa règle, jusqu'au
      // prochain. Lui donner la contenance des autres en ferait un réglage local et lui retirerait
      // sa raison d'être.
      if (el.qualifier && el.qualifier.type === 'SettingBag') {
        const { address: adrF, controls: ctrlF } = splitAddress(extractOccurrenceParams([el.qualifier]));
        el.qualifier.payload = {
          nature: 'transport-control',
          containment: false,
          scope: 'flow',
          ...(ctrlF ? { params: ctrlF } : {}),
          ...(adrF ? { address: adrF } : {}),
        };
      }
      el.payload = {
        nature: 'instant',
        flux: true,  // se propage aux tokens suivants du même acteur
        // conjoint (collé `C4!(...)`) = ancré au terminal précédent, voyage avec lui (régime
        // structurel) ; non conjoint (espacé `C4 !(...)`) = événement séparé (régime séquentiel).
        // Présent seulement pour les `!(...)` runtime (qui portent ce flag) ; absent sinon.
        ...(el.conjoint !== undefined ? { conjoint: el.conjoint } : {}),
      };
      return;
    }

    // ── Polymetric — récursion dans les voix ──────────────────────────
    if (type === 'Polymetric') {
      // Pas de payload sur le nœud Polymetric lui-même (structurel).
      // Mais un qualificateur de GROUPE `{…}(vel:80)` est de la CONTENANCE (même concept
      // neuf que le `(...)` de règle, décision Romain 2026-06-20) : structurel, confiné au
      // groupe, ne déborde pas. On le tague `containment` (PAS `flux`) pour que BPx le route
      // au régime structurel. (Les Polymetric imbriqués sont atteints par la récursion.)
      if (el.settings && typeof el.settings === 'object') {
        const { address, controls } = splitAddress(extractOccurrenceParams([el.settings]));
        el.settings.payload = {
          nature: 'transport-control',
          containment: true,
          scope: 'group',
          ...(controls ? { params: controls } : {}),
          ...(address ? { address } : {}),
        };
      }
      for (const voice of (el.voices || [])) {
        annotateRhsElements(voice, ruleActor);
      }
      return;
    }

    // ── SimultaneousGroup — récursion ──────────────────────────────────
    if (type === 'SimultaneousGroup') {
      if (el.primary) annotateRhsNode(el.primary, ruleActor);
      for (const s of (el.secondaries || [])) annotateRhsNode(s, ruleActor);
      return;
    }

    // ── Invocation de GABARIT `$A(…)` / `&A(…)` — portée EXPLICITE ────────
    // La portée était déjà celle-ci (déduite de la position, `AST.md:923-924`) : un suffixe
    // sur une invocation de gabarit gouverne l'EXPANSION du gabarit et ne déborde pas —
    // même régime de contenance que le groupe et la règle, jamais du flux.
    // Ce qui manquait, c'est de le DIRE. Le cas groupe portait `scope:'group'` en clair
    // pendant que celui-ci n'avait aucun payload : le consommateur devait déduire une portée
    // là où son voisin la lui donnait. bpx a lu cette asymétrie comme une invitation à
    // traiter le cas en flux, et sa descente template/bloc s'est trompée — ma surface a
    // une part dans son bug. On émet donc explicitement ce qui était déjà vrai.
    // ADDITIF : qui déduisait de la position reste juste ; qui veut lire le peut.
    if (type === 'TemplateMaster' || type === 'TemplateSlave') {
      for (const sq of (el.suffixQualifiers || [])) {
        if (!sq || sq.type !== 'SettingBag') continue;
        const { address, controls } = splitAddress(extractOccurrenceParams([sq]));
        sq.payload = {
          nature: 'transport-control',
          containment: true,
          scope: 'template',
          ...(controls ? { params: controls } : {}),
          ...(address ? { address } : {}),
        };
      }
      return;
    }

    // ── Accolade FERMANTE d'un bloc réparti — même scellement que le bloc d'un seul tenant ──
    //
    // Le sac collé à une fermante règle LE BLOC (décision Romain, 2026-08-08). Router le sac ne
    // suffisait pas : il arrivait NU, sans le sceau que porte `Polymetric.settings`.
    //
    // ⚠️ POURQUOI CE MANQUE BLOQUAIT L'AVAL, et c'est le bon raisonnement de BPx. L'extracteur
    // commun lit `payload.params` — c'est PAR LUI que passe le bloc écrit d'un seul tenant. Sans
    // sceau, le bloc réparti aurait dû emprunter un autre chemin : deux implémentations pour une
    // même notion, qui dérivent l'une de l'autre à la première évolution. Ils ont refusé de lire
    // les paires en dur chez eux, et ils ont raison — le sceau porte la NATURE et la PORTÉE, donc
    // la classification des contrôles, qui vit dans mes librairies. La recoder là-bas serait
    // exactement le code en dur que le chantier des contrôles cherche à sortir.
    //
    // `scope: 'group'` et non `'rule'` : c'est bien le BLOC que ce sac gouverne — un bloc dont
    // l'ouvrante vit dans une autre règle reste un bloc.
    if (type === 'RawBrace' && el.settings && typeof el.settings === 'object') {
      const { address, controls } = splitAddress(extractOccurrenceParams([el.settings]));
      el.settings.payload = {
        nature: 'transport-control',
        containment: true,
        scope: 'group',
        ...(controls ? { params: controls } : {}),
        ...(address ? { address } : {}),
      };
      return;
    }

    // Tous les autres types (Period, NumericDuration, NilString, RawBrace sans sac,
    // Wildcard, Variable, Homomorphism, Wait…) : pas de payload.
  }

  /**
   * Extrait les overrides d'occurrence depuis `suffixQualifiers` d'un nœud.
   * Retourne un objet {key:val, …} ou null si aucun override.
   * Seules les SettingBag (paires key:val) sont extraites.
   */
  function extractOccurrenceParams(suffixQualifiers) {
    if (!suffixQualifiers || suffixQualifiers.length === 0) return null;
    const params = {};
    let hasParams = false;
    for (const sq of suffixQualifiers) {
      if (sq.type !== 'SettingBag') continue;
      for (const pair of (sq.pairs || [])) {
        // value:true = bare key sans valeur (ex. velcont) — on inclut quand même
        params[pair.key] = pair.value;
        hasParams = true;
      }
    }
    return hasParams ? params : null;
  }

  /**
   * Replie les arguments NOMMÉS d'un nœud SymbolCall sonnant en {key:val, …}
   * (charge d'occurrence). Retourne null si le nœud n'est pas un SymbolCall,
   * n'a pas d'argument nommé, ou n'a que des arguments positionnels.
   * Les args originaux (el.args) sont CONSERVÉS (voie BP3 héritée).
   */
  function extractSymbolCallParams(el) {
    if (!el || el.type !== 'SymbolCall' || !Array.isArray(el.args)) return null;
    const params = {};
    let hasParams = false;
    for (const arg of el.args) {
      if (!arg || !arg.key) continue; // ignore les args positionnels
      const v = arg.value;
      // Literal → valeur brute (nombre/chaîne) ; sinon on garde le nœud (ex. BacktickInline).
      params[arg.key] = (v && v.type === 'Literal') ? v.value : v;
      hasParams = true;
    }
    return hasParams ? params : null;
  }

  /**
   * Sépare les DÉTAILS D'ADRESSE des CONTRÔLES dans une charge d'override (KAI-9 / GAP#2,
   * décision 2026-06-26). Les clés d'adresse (canal/device/port) vont dans un TIROIR DÉDIÉ
   * `payload.address`, distinct des contrôles (vel/pan/wave…) qui restent dans `payload.params`.
   * La syntaxe utilisateur (`(ch:5)`) ne change PAS — c'est interne à l'AST. Kairos lit le tiroir
   * adresse pour matérialiser `event.output`, sans le confondre avec un contrôle.
   * @param {object|null} params  charge brute {clé:val, …}
   * @returns {{ address: object|null, controls: object|null }}
   */
  function splitAddress(params) {
    if (!params) return { address: null, controls: null };
    const address = {};
    const controls = {};
    let hasA = false;
    let hasC = false;
    for (const [k, v] of Object.entries(params)) {
      if (addressKeys().has(k)) { address[k] = v; hasA = true; }
      else { controls[k] = v; hasC = true; }
    }
    return { address: hasA ? address : null, controls: hasC ? controls : null };
  }

  // ============================================================
  // Directives
  // ============================================================

  /**
   * Valeur de directive après ':' — logique PARTAGÉE entre la forme de tête (`seed:7`) et le
   * bloc lu dans le flux (`![seed:7]`) pour garantir des nœuds Directive identiques par
   * construction (contrat BPx).
   *   INT → value Number (négatif via '-') ; ratio N/M → value String ;
   *   FLOAT → value String brute (sortie BP3 exacte) ; IDENT → champ runtime.
   */
  /**
   * ⛔ UNE VALEUR PEUT COMMENCER PAR UN TIRET BAS — décision Romain, 2026-08-19 : « les fonctions
   * BP3 commencent par un tiret bas, c'est leur convention », et ce n'est donc pas au parseur de la
   * refuser. Renommer une procédure native pour contourner le refus mentirait sur ce que le moteur
   * porte.
   *
   * ⚠️ LE TIRET BAS EST UN SIGNE DU FLUX — la PROLONGATION — et le tokenizer le détache partout.
   * Il ne se recolle donc PAS au tokenizer, où il changerait le sens d'un `_` écrit dans une
   * production : il se recolle là où une VALEUR est attendue, et là seulement. Mesure du corpus
   * avant d'écrire : 71 tirets bas collés à un nom, tous dans des valeurs de librairie, ZÉRO dans
   * les scènes.
   *
   * Rend le nom recollé, ou null si ce qui est là n'en est pas un — sans consommer un jeton.
   */
  function lireNomATiretBas() {
    if (!at(T.PROLONG)) return null;
    const suite = peek(1);
    if (!suite || suite.type !== T.IDENT || suite.spaceBefore) return null;
    advance();
    return '_' + advance().value;
  }

  function parseDirectiveColonValue(dirName) {
    let value = null, runtime = null;
    // Directive interval-typée (ex. @transpose global) : lire un littéral d'INTERVALLE et le porter
    // BRUT (chaîne), comme la forme inline. Univers du registre car libCtx n'est pas encore chargé.
    if (dirName && universeIntervalControls().has(dirName)) {
      return { value: readIntervalLiteral(dirName), runtime: null };
    }
    // Handle negative values: @transpose:-24
    let negative = false;
    if (at(T.REST)) { // - token
      negative = true;
      advance();
    }
    if (at(T.INT)) {
      const num = advance().value;
      // MÈTRE ADDITIF — `meter:3+4+2/4`, la graphie de BP3 reprise telle quelle (décision Romain
      // 2026-07-26, `hub/decisions/2026-07-26-trois-manques-du-temps-…`) : des sections de 3, 4 et
      // 2 battements. Motif : « c'est plus clair à comprendre ».
      //
      // ⚠️ LE `+` VIT ICI DANS UN SECOND RÔLE — séparateur de sections, alors qu'il est opérateur
      // de drapeau ailleurs. C'est un ÉCART ASSUMÉ à « un signe, un rôle », pas un oubli : deux
      // options étaient posées, Atlas recommandait `meter:3 4 2/4` (application littérale de la
      // règle), et Romain a tranché pour la fidélité à BP3 au nom de la lisibilité. À NE PAS
      // « corriger » plus tard au nom de la règle générale — l'exception est datée et motivée.
      //
      // La forme additive était déjà lue dans le sac moteur (`[meter:4+4/6]`) ; seule la directive
      // `meter` la refusait, alors qu'elle est le point d'entrée naturel.
      if (at(T.PLUS) && peek(1).type === T.INT) {
        let sections = `${negative ? '-' : ''}${num}`;
        while (at(T.PLUS) && peek(1).type === T.INT) {
          sections += advance().value;  // +
          sections += advance().value;  // INT
        }
        if (at(T.SLASH) && peek(1).type === T.INT) {
          sections += advance().value;  // /
          sections += advance().value;  // INT
        }
        return { value: sections, runtime: null };
      }
      // Check for ratio: 3/4, 7/8
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance(); // /
        const denom = advance().value;
        value = `${negative ? '-' : ''}${num}/${denom}`;
      } else {
        value = Number(`${negative ? '-' : ''}${num}`);
      }
    } else if (at(T.FLOAT)) {
      const raw = advance().value;
      value = raw;  // Preserve raw float string for exact BP3 output (e.g. 60.0000)
    } else if (at(T.IDENT) || (at(T.PROLONG) && peek(1)?.type === T.IDENT && !peek(1).spaceBefore)) {
      // Could be runtime or string value. Un nom à tiret bas se lit comme le même nom sans lui —
      // même branche, même champ : le tiret bas cesse d'être refusé, il ne devient pas une forme.
      const v = lireNomATiretBas() ?? advance().value;
      // Check for ratio like 7/8
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance(); // /
        const denom = advance().value;
        value = `${v}/${denom}`;
      } else {
        runtime = v;
      }
    }

    // ⛔ CE QUI RESTE COLLÉ À LA VALEUR N'EST PAS UNE VALEUR — et le taire coûtait le diagnostic.
    //
    // `duration:16b`, `tempo:120b`, `items:20s` : la valeur numérique se lit, l'unité collée
    // reste sur la pile, et la boucle principale la rencontre plus loin comme un symbole égaré. Le
    // message était donc « Expected arrow (-> <- <>) », À LA LIGNE SUIVANTE — un auteur y lit un
    // problème de règle alors qu'il a écrit une unité qui n'existe pas, une ligne plus haut.
    //
    // ⚠️ LE DÉFAUT N'EST PAS PROPRE À UNE DIRECTIVE, et c'est pourquoi le refus vit ICI plutôt
    // qu'auprès d'un nom : mesuré le 2026-08-10, il frappait AUSSI `tempo:120b` — une directive
    // parfaitement vivante — et `zorglub:16b`, un nom inconnu qui méritait d'être nommé comme tel.
    // Le réparer sur `duration` seul aurait réparé l'endroit où il s'est montré, pas l'espace où il
    // vit.
    //
    // CE QUI N'EST PAS TOUCHÉ : aucune forme acceptée ne change. Les graphies collées LÉGITIMES
    // sont lues plus haut et sortent avant d'arriver ici — le ratio (`3/4`), le mètre additif
    // (`3+4+2/4`), le littéral d'intervalle, la valeur négative. Ce refus ne voit donc que ce
    // qu'aucune d'elles n'a su lire.
    // ⚠️ LE MESSAGE NE CITE PAS DE GRAPHIE, ET C'EST DÉLIBÉRÉ. Ce lecteur sert DEUX écritures —
    // la directive de tête `seed:42` et la forme de flux `![seed:42]`. Un message qui citerait
    // `'seed:42x'` à qui a écrit `![seed:42x]` l'enverrait chercher une ligne qu'il n'a pas
    // écrite : mesuré ici même, la première version le faisait.
    if (!atEnd() && !current().spaceBefore
        && (at(T.IDENT) || at(T.INT) || at(T.FLOAT))) {
      const reste = current().value;
      const ecrit = value != null ? String(value) : (runtime != null ? String(runtime) : '');
      throw new ParseError(
        `la valeur de '${dirName}' se lit '${ecrit}', et '${reste}' lui reste collé sans s'y lire. `
        + `Une valeur de directive est NUE : un nombre, un rapport ('3/4'), ou un nom. Retirer `
        + `'${reste}' si c'est une unité — aucune directive n'en porte — ou l'espacer si ce qui `
        + `suit est autre chose.`,
        current(),
      );
    }
    return { value, runtime };
  }

  /**
   * Bloc de directives de production — REFUSÉ en tête de scène depuis le 2026-08-10, où il ne
   * subsiste que pour porter son propre refus et la réécriture `clé:valeur`. Il reste LU dans le
   * FLUX, où `![seed:N]` traduit `_srand(N)` du natif.
   * Le `@` est répété sur chaque clé ; chaque clé produit le MÊME nœud
   * Directive que la @-forme historique. Détection sur LBRACKET suivi de AT
   * (un `@` entre crochets était une erreur de syntaxe avant la décision).
   */
  function atProductionBlock() {
    return at(T.LBRACKET) && peek(1).type === T.AT;
  }

  function parseProductionBlock(dansLeFlux = false) {
    expect(T.LBRACKET);
    const dirs = [];
    while (true) {
      const atTok = expect(T.AT);
      const name = expect(T.IDENT).value;
      let value = null, runtime = null;
      if (at(T.COLON)) {
        advance();
        ({ value, runtime } = parseDirectiveColonValue(name));
      }
      // Le bloc est réservé aux directives de production (décision 2026-06-11).
      // Une autre clé y est parsée (EBNF : IDENT) mais poussée comme Directive
      // SIMPLE — les noms à traitement spécial (@mode, @scene, @duration…)
      // y perdraient leur effet en silence : on avertit.
      // ⚠️ LE BLOC `[@…]` EST SORTI DU LANGAGE EN TÊTE DE SCÈNE (Romain, 2026-08-10) : « ça
      // s'applique à toutes les directives de production ». Les quatre s'écrivent `clé:valeur`,
      // préfixe optionnel — `seed:42` et `engine.seed:42` sont la même chose, par la règle
      // d'unicité.
      //
      // LA PIÈCE QUI LE FONDE : `docs/spec/LANGUAGE.md:790-810`, « trois places, trois rôles ». Le
      // crochet a QUATRE emplois — test de drapeau, affectation, procédure de dérivation, rang de
      // catalogue — et une instruction sur COMMENT produire n'en est aucun. La décision de juin qui
      // avait mis ces clés dans le bloc est ANTÉRIEURE à cette refonte.
      //
      // LE REFUS EST FRANC ET PORTE SA RÉÉCRITURE, y compris pour un bloc groupé — deux écritures
      // dont une seule est juste est exactement la voie parallèle que la refonte supprime.
      //
      // ⚠️ ET IL NE COUVRE PAS LE FLUX. `![seed:N]` traduit `_srand(N)` du natif : deux scènes de
      // la bibliothèque l'écrivent (mesuré), et BPx la LIT. Romain a parlé de la TÊTE DE SCÈNE ;
      // fermer le flux casserait le portage du natif dans trois dépôts. L'écart est remonté et non
      // tranché — tant qu'il ne l'est pas, cette forme-là vit.
      if (!dansLeFlux) {
        const ecrit = value !== null && value !== undefined ? `:${value}` : (runtime ? `:${runtime}` : '');
        throw new ParseError(
          `'[${name}${ecrit}]' : une directive de production s'écrit en tête de scène, avant le `
          + `délimiteur — '${name}${ecrit}'. Un bloc qui groupait plusieurs clés se réécrit en `
          + `autant de lignes. Le crochet porte ce qui appartient à la DÉRIVATION : un drapeau, `
          + `une procédure, un rang.`, atTok);
      }
      // DANS LE FLUX, seule la re-semence a un sens : c'est la seule de ces clés à avoir un
      // contrôle de flux natif (`_srand`).
      if (name !== 'seed') {
        throw new ParseError(
          `'![${name}…]' : seul 'seed' a un sens dans le flux (re-semence _srand) ; `
          + `'${name}' se pose en tête de scène, '${name}'.`, atTok);
      }
      dirs.push({ type: 'Directive', name, subkey: null, runtime, value,
                  aliases: null, modifiers: null, line: atTok.line });
      if (at(T.COMMA)) { advance(); continue; }
      break;
    }
    expect(T.RBRACKET);
    return dirs;
  }

  /**
   * ⛔ LE TYPE VIENT EN TÊTE, LE NOM ENSUITE — décision Romain du 2026-08-16
   * (`hub/decisions/2026-08-16-le-langage-perd-var-et-l-arobase-trois-mots-un-delimiteur.md:20-28`),
   * précisée le même jour pour l'entrée (`…-quatre-types-un-enum-et-le-prototypal-pur.md:123` :
   * « une entrée s'écrit `in.midi sync1`, symétrique de `out.midi(ch:1)` »).
   *
   *     flag    section(intro:1, drop:2)
   *     signal  grain:0.5
   *     symbol  x
   *     in.midi sync1
   *     ramp    r1                        une instance d'un module du catalogue
   *
   * ⚠️ L'ARBRE NE BOUGE PAS. Ces cinq lignes émettent EXACTEMENT les nœuds que `var` émettait —
   * `InDirective` pour l'entrée, `VarDirective` pour les quatre autres, mêmes champs, même place.
   * C'est ce qui rend la bascule indépendante de la forme d'arbre : aucun consommateur ne change.
   *
   * ⚠️ LE POINT QUALIFIE LE TYPE, il ne nomme pas une librairie : `in.midi` est un type d'entrée,
   * comme `out.midi` est une clé d'acteur. La lecture passe donc AVANT celle d'une directive
   * ordinaire, qui prendrait `in` pour un nom de librairie et `midi` pour une entrée de catalogue.
   *
   * Rend `null` quand la ligne n'ouvre pas une déclaration par le type — la lecture ordinaire
   * reprend alors la main sans avoir consommé un seul jeton.
   */
  /**
   * ⛔ UN TERMINAL SE DÉCLARE PAR `<nom>:<canal>`, DIRECTEMENT — arbitrage Romain du 2026-08-18,
   * ses mots : « la déclaration de terminal s'écrit a:midi directement, sans gate ».
   *
   * ⚠️ CE QUI NE MARCHAIT PAS, mesuré avant la frappe. La ligne PASSAIT l'analyse — elle produisait
   * une directive ORDINAIRE `{name:'a', runtime:'midi'}` rangée parmi les réglages de tête — mais
   * le contrôle des terminaux ne lit pas ce canal-là. Une règle qui employait `a` sortait donc
   * « terminal 'a' non déclaré », et le refus était IDENTIQUE avec et sans la ligne : le pire état
   * possible, où l'auteur croit avoir déclaré et où rien ne le détrompe.
   *
   * LE CÔTÉ QUI CONSOMME EXISTAIT DÉJÀ : `nomsDeclares` (bpxAst.js) alimente l'ensemble des noms
   * déclarés depuis `ast.declarations`. C'est le côté qui PRODUIT qui était parti avec les mots
   * `gate`, `trigger` et `cv` — `parseDeclaration` n'avait plus aucun appelant et vient de sortir.
   *
   * ⚠️ LE DISCRIMINANT EST LE CANAL, PAS LE NOM. Une tête de scène est pleine de `<mot>:<valeur>` —
   * `tempo:120`, `seed:42`, `mode:ord`. Ce qui distingue une déclaration de terminal est que sa
   * valeur est un CANAL DE SORTIE déclaré (`lib/core.json` schema.channels), et que son sujet n'est
   * déclaré par AUCUNE librairie. Sans cette borne, une faute de frappe sur un réglage
   * (`tempoo:120`) deviendrait un terminal au lieu d'être refusée.
   */
  function lireDeclarationDeTerminal() {
    if (!at(T.IDENT) || peek(1).type !== T.COLON || peek(2).type !== T.IDENT) return null;
    const finDeLigne = peek(3).type === T.NEWLINE || peek(3).type === T.EOF
      || peek(3).type === T.COMMENT;
    if (!finDeLigne) return null;
    const tok = current();
    const nom = tok.value;
    const canal = peek(2).value;
    // ⛔ ICI ON NE JETTE PAS, ET C'EST UNE LEÇON PAYÉE DEUX FOIS. Ma première écriture refusait le
    // canal inconnu depuis ce lecteur — et elle est passée DEVANT les pierres tombales : `routing:studio`,
    // `label:x` et `transcription:x` ont perdu leur refus nommé pour « le canal 'studio' n'existe pas ».
    // Trois retraits rendus muets par une borne trop gourmande, exactement la faute du 2026-08-18 où
    // « n'est pas un type » avalait les refus de `cv` et `macro`.
    //
    // CE LECTEUR REND DONC `null` COMME AVANT, la lecture ordinaire garde ses refus nommés, et la
    // précision sur le canal se pose LÀ OÙ LE MESSAGE FAUX EST ÉMIS — au refus du terminal, dans
    // `bpxAst.js`. Réparer un message à son point d'émission ne peut rien avaler.
    if (!outChannels().has(canal) || !writableChannels().has(canal)) return null;
    // Un mot que le vocabulaire déclare garde sa lecture de réglage — `eval:X`, `sound:X`… La
    // question se pose dans les deux sens, donc les deux lecteurs sont interrogés.
    if (porteesDeclarees(nom) !== null || directiveDeclareeParLaLibrairie('core', nom)) return null;
    advance(); advance(); advance();               // nom : canal
    // ⛔ `temporalType` SURVIT AU MOT `gate`, ET C'EST UNE FRONTIÈRE, PAS UNE GRAPHIE. Le champ est
    // DÉCLARÉ REQUIS par le contrat de BPx (`types/ast.ts` : `temporalType: 'gate' | 'trigger'`) et
    // il y est LU : `loadGrammar.ts:1613` ne collecte un nom parmi les TERMINAUX D'ALPHABET que si
    // `decl.temporalType === 'gate'`.
    //
    // ⚠️ CE QUE SON ABSENCE A COÛTÉ, mesuré : ma première écriture l'omettait, et l'arbre dérivé de
    // `koto3` a maigri de 26 % — SANS UNE ERREUR. Ses terminaux déclarés cessaient d'être des
    // terminaux d'alphabet chez BPx, ce qui se voit sur l'objet hors-temps (`Y -> !f`) et nulle part
    // ailleurs : douze scènes sur treize rendaient un arbre identique. Une perte SILENCIEUSE de
    // production, exactement le mode d'échec qu'un refus n'attrape jamais.
    //
    // ⚠️ ET LE MOT `trigger` N'A PLUS DE GRAPHIE : `<nom>:<canal>` ne distingue pas les deux types
    // temporels. On émet donc `gate`, le seul que BPx collecte, et l'écart est SIGNALÉ — inventer
    // une graphie pour le second serait définir du langage.
    return { type: 'Declaration', temporalType: 'gate', name: nom, runtime: canal, line: tok.line };
  }

  function lireDeclarationParLeType() {
    if (!at(T.IDENT)) return null;
    const tok = current();
    const mot = tok.value;

    // ── L'ENTRÉE — `in.<canal> <rôle> [mapping.<table>]` ────────────────────────────────────
    // Les trois contraintes de la décision du 2026-07-27 ne bougent pas : aucun nom de port,
    // aucun alphabet, aucune table par défaut. Elles changent seulement de côté de la ligne.
    if (mot === 'in' && peek(1).type === T.PERIOD && !peek(1).spaceBefore
        && peek(2).type === T.IDENT) {
      advance(); advance();                        // in .
      const canal = expect(T.IDENT).value;
      if (at(T.LPAREN)) {
        throw new ParseError(`'in.${canal}(…)' est refusé — une entrée ne porte AUCUN nom de `
          + `port. Un nom de port vient du système et change de machine en machine ; la scène `
          + `nomme un RÔLE, l'utilisateur associe l'appareil, et l'association vit hors de la `
          + `scène.`, tok);
      }
      // LISTE FERMÉE PROPRE AUX ENTRÉES (`lib/core.json` schema.channels).
      if (!inChannels().has(canal)) {
        throw new ParseError(`'${canal}' n'est pas une entrée — les canaux d'entrée sont `
          + `${[...inChannels()].join(', ')}. La liste est FERMÉE.`, tok);
      }
      if (!at(T.IDENT)) {
        throw new ParseError(`'in.${canal}' doit nommer le RÔLE que tient l'entrée — `
          + `'in.${canal} <rôle>'. Le type vient en tête, le nom ensuite.`, current());
      }
      const roleName = advance().value;
      let table = null;
      while (at(T.IDENT)) {
        const cle = advance().value;
        if (!at(T.PERIOD)) {
          throw new ParseError(`in.${canal} ${roleName} : '${cle}' doit APPELER un composant avec `
            + `un point ('mapping.<table>') — le point APPELLE, les deux points AFFECTENT.`, tok);
        }
        advance();
        const valeur = expect(T.IDENT).value;
        if (cle === 'mapping') {
          table = valeur;
        } else if (cle === 'alphabet') {
          throw new ParseError(`in.${canal} ${roleName} : une entrée ne porte AUCUN alphabet. Il `
            + `n'y a rien à résoudre en entrée — l'événement est DISCRET, pas un signal à `
            + `interpréter. C'est la TABLE (mapping.<nom>) qui déclare le vocabulaire où les `
            + `étiquettes puisent, et elle le fait en librairie, pas dans la scène.`, tok);
        } else {
          throw new ParseError(`in.${canal} ${roleName} : propriété '${cle}' inconnue — une `
            + `entrée déclare son canal et, facultativement, sa table ('mapping.<table>'). `
            + `Rien d'autre.`, tok);
        }
      }
      // Aucune table par défaut : `mapping` reste null quand rien n'est déclaré.
      return { type: 'InDirective', name: roleName, transport: canal, mapping: table, line: tok.line };
    }

    // ── LES QUATRE AUTRES TYPES ────────────────────────────────────────────────────────────
    // ⛔ UNE EXCEPTION CODÉE EN DUR VIVAIT ICI, et elle a survécu à l'écriteau qu'elle servait.
    // Un mot retiré sortait de ce chemin par son nom, pour tomber dans un refus à lui. L'écriteau
    // parti, l'exception restait — et elle envoyait ce mot dans un refus MOINS BON que le refus
    // ordinaire, qui énumère les types acceptés. Un détour nommé se retire avec sa destination.
    const modules = modulesDuCatalogue();
    if (!typesDeclaratifs().has(mot) && !varConventions().has(mot) && !modules.has(mot)) {
      // ⚠️ UN TYPE INCONNU SUIVI D'UN NOM SE REFUSE EN NOMMANT LES TYPES, sans quoi
      // `lpf lpf1` tombe dans « n'est déclaré par aucune librairie chargée » et envoie l'auteur
      // chercher une librairie au lieu de lui dire que le mot n'est pas un type. La condition est
      // ÉTROITE : le mot n'est déclaré NULLE PART — ni comme directive de tête (`actor`, `def`,
      // `init`…), ni par une portée de librairie — et un nom nu le suit. Tout le reste poursuit
      // sa lecture ordinaire, sans un jeton consommé.
      // ⛔ ET LA CONDITION EST « LA LIGNE ENTIÈRE », pas « le jeton suivant ». Ma première écriture
      // se contentait d'un IDENT après le mot : elle a AVALÉ les refus de `cv env1 mod.adsr(…)` et
      // de `macro lead toto` — deux mots sortis dont la cause était inscrite au registre du corpus,
      // et qui ont changé de message sans changer de couleur. Six scènes touchées, vues par le
      // garde du corpus et pas autrement. Une déclaration par le type, c'est UN type et UN nom, un
      // point final : tout ce qui déborde appartient à une autre lecture.
      const finDeLigne = peek(2).type === T.NEWLINE || peek(2).type === T.EOF
        || peek(2).type === T.COMMENT;
      if (peek(1).type === T.IDENT && finDeLigne && !directiveDeclareeParLaLibrairie('core', mot)
          && porteesDeclarees(mot) === null) {
        throw new ParseError(`'${mot} ${peek(1).value}' : '${mot}' n'est pas un type. Un type en `
          + `tête vient des conventions (${[...varConventions()].join(', ')}), du catalogue de `
          + `modules (${[...modules].join(', ')}), ou des types de base `
          + `(${[...typesDeclaratifs()].join(', ')}, in.<canal>).`, tok);
      }
      return null;
    }
    // ⚠️ UN TYPE SANS NOM N'EST PAS UNE DÉCLARATION, et ne doit pas en devenir une par accident :
    // `signal:0.5` affecte une valeur à un mot, ce n'est pas `signal grain:0.5`. On ne prend la
    // ligne que si un NOM suit, et on refuse en le nommant si le type est seul sur sa ligne.
    if (peek(1).type !== T.IDENT) {
      if (peek(1).type === T.NEWLINE || peek(1).type === T.EOF) {
        throw new ParseError(`'${mot}' doit nommer ce qu'il déclare — le type vient en tête, le `
          + `nom ensuite ('${mot} <nom>').`, tok);
      }
      return null;
    }
    advance();                                     // le type
    const premier = expect(T.IDENT).value;

    // ── LE DRAPEAU — `flag <nom>(<état>:<entier>, …)` ──────────────────────────────────────
    // La parenthèse porte ce qui appartient à ce qui la précède : les états appartiennent au
    // drapeau. C'est le même geste que `actor basse(out.midi(ch:1))`, aucun signe nouveau.
    if (mot === 'flag') {
      // ⛔ LA PARENTHÈSE ABSENTE VAUT PARENTHÈSE VIDE — prototypal pur, décision Romain du
      // 2026-08-20. Un drapeau sans état est un MODÈLE, pas une faute de frappe : il ne peut que
      // servir de parent, et « l'incomplétude se refuse à l'USAGE, jamais à la déclaration ».
      //
      // ⚠️ LE REFUS QUI VIVAIT ICI NE GARDAIT PAS CE QU'ON CROYAIT. Mesuré avant de le retirer :
      // il empêchait le drapeau VIDE et n'a JAMAIS empêché l'ÉTAT INCONNU — `flag s(x:1)` suivi
      // de `[s==a]` passait en silence. Le cri qui manquait est posé À L'USAGE, dans
      // `annotateScene`, et il l'a été AVANT ce retrait : sans cet ordre, la famille entière
      // serait restée sans aucune garde entre les deux gestes.
      if (!at(T.LPAREN)) {
        return { type: 'VarDirective', names: [premier],
                 varType: { kind: 'flag', states: [] }, line: tok.line };
      }
      advance();
      const states = [];
      while (!at(T.RPAREN) && !atEnd()) {
        const stName = expect(T.IDENT).value;
        if (!at(T.COLON)) {
          throw new ParseError(`flag ${premier} : l'état '${stName}' doit porter sa valeur `
            + `entière après ':' — '${stName}:<entier>'.`, current());
        }
        advance();
        states.push({ name: stName, value: Number(expect(T.INT).value) });
        if (at(T.COMMA)) advance();
      }
      expect(T.RPAREN);
      if (!states.length) {
        throw new ParseError(`flag ${premier} : au moins un état est requis — `
          + `'flag ${premier}(<nom>:<entier>, …)'.`, tok);
      }
      return { type: 'VarDirective', names: [premier], varType: { kind: 'flag', states },
               line: tok.line };
    }

    // ── LE CORPS ENTRE PARENTHÈSES — LA MÊME PARENTHÈSE QU'AILLEURS ────────────────────────
    // Décision Romain, 2026-08-16 : les quatre types et le mécanisme d'énumération s'écrivent avec
    // la parenthèse, « la forme du langage, celle qui porte ce qui appartient à ce qui la précède » :
    //     enum valuetype(value, range, param, hz)
    //     control sync(args:message, scope:flow)
    //
    // ⛔ C'ÉTAIT LA POSITION QUI BLOQUAIT, PAS LE MOT. La récursivité par la parenthèse était lue
    // DANS un sac depuis le 2026-08-19 et refusée EN TÊTE DE LIGNE — `enum valuetype(value, range)`
    // sortait « Expected COLON, got COMMA », un refus qui accuse la virgule alors que la faute est
    // qu'aucun lecteur de corps n'était branché ici.
    //
    // ⚠️ LE CORPS EST LU PAR LE LECTEUR DE SAC, celui du `def` et des qualificatifs de flux — jamais
    // par un lecteur à lui. Deux lecteurs d'une même parenthèse divergent au premier ajout, et la
    // demande de Romain l'exclut : un seul interprète pour tout ce que le langage écrit.
    //
    // ⚠️ UN NOM NU Y ARRIVE DONC AVEC LA VALEUR DES CLÉS SANS ARGUMENT, et l'ORDRE d'écriture est
    // préservé — c'est ce qui fait qu'une seule forme sert la suite et l'ensemble.
    if (typesDeclaratifs().has(mot) && at(T.LPAREN)) {
      const sac = parseRuntimeQualifier();
      return { type: 'VarDirective', names: [premier], varType: { kind: 'type', type: mot },
               settings: sac, line: tok.line };
    }

    // ── LA VALEUR DE DÉPART, COLLÉE À SON SIGNE ────────────────────────────────────────────
    // « espace sépare deux termes ; leur collage les réunit en un seul ». Détachée, la valeur se
    // lirait comme un second terme et disparaîtrait sans un signe.
    const lireDepart = (nom) => {
      if (!at(T.COLON)) return null;
      advance();
      const t = current();
      if (t.spaceBefore) {
        throw new ParseError(`${mot} ${nom}: une valeur de départ se COLLE à son signe — `
          + `'${nom}:<valeur>', jamais '${nom}: <valeur>'. L'espace sépare deux termes, le `
          + `collage les réunit.`, t);
      }
      if (at(T.INT) || at(T.FLOAT)) { advance(); return Number(t.value); }
      if (at(T.IDENT)) { advance(); return t.value; }
      const aTiretBas = lireNomATiretBas();
      if (aTiretBas !== null) return aTiretBas;
      throw new ParseError(`${mot} ${nom} : une valeur de départ se pose après ':' — un nombre ou `
        + `un nom. Reçu '${t.value ?? t.type}'.`, t);
    };
    const departs = [];
    const d0 = lireDepart(premier);
    if (d0 !== null) departs.push({ name: premier, value: d0 });

    // ── LA CONVENTION et LE MODULE — un seul nom ───────────────────────────────────────────
    if (varConventions().has(mot) || modules.has(mot)) {
      const varType = varConventions().has(mot)
        ? { kind: 'convention', convention: mot }
        : { kind: 'module', module: mot };
      const d = { type: 'VarDirective', names: [premier], varType, line: tok.line };
      return departs.length ? { ...d, initial: departs } : d;
    }

    // ── `symbol` — un nom, ou plusieurs séparés par des virgules ───────────────────────────
    // ⚠️ CHAQUE NOM PORTE SA PROPRE VALEUR : `symbol a:1, b:2`. Une valeur unique partagée par la
    // liste serait une invention — la ligne énumère des symboles distincts.
    const noms = [premier];
    while (at(T.COMMA) && advance()) {
      const n = expect(T.IDENT).value;
      noms.push(n);
      const dn = lireDepart(n);
      if (dn !== null) departs.push({ name: n, value: dn });
    }
    // ⛔ ET LE TYPE VOYAGE, MÊME SANS PARENTHÈSE — prototypal pur, décision Romain du 2026-08-20 :
    // « un nom nu vaut un objet vide, la parenthèse absente vaut parenthèse vide, ET LE TYPE
    // VOYAGE ».
    //
    // ⚠️ SIX TYPES LE PERDAIENT EN SILENCE : control, addresskey, native, destination, object et
    // symbol sortaient avec `varType: null` dès qu'aucune parenthèse ne suivait — `control x`
    // compilait, atterrissait dans l'arbre avec son nom, et un consommateur y lisait une variable
    // SANS NATURE là où l'auteur en avait nommé une. La forme avec corps, elle, le portait : deux
    // graphies du même mot, une seule qui dit ce qu'elle déclare.
    // Les conventions ne l'ont jamais perdu, nues ou avec valeur de départ — c'est ce qui rendait
    // l'écart invisible : la moitié des mots de tête marchait.
    const type = typesDeclaratifs().has(mot) ? { kind: 'type', type: mot } : null;
    const nu = { type: 'VarDirective', names: noms, varType: type, line: tok.line };
    return departs.length ? { ...nu, initial: departs } : nu;
  }

  function parseDirective() {
    // ── LE TYPE EN TÊTE PASSE AVANT TOUT — sa lecture ne consomme rien quand la ligne n'en est
    // pas une, et elle DOIT précéder la lecture ordinaire : `in.midi sync1` se lirait sinon comme
    // une invocation de catalogue, et `flag section(…)` comme une directive inconnue.
    {
      const parLeType = lireDeclarationParLeType();
      if (parLeType) return parLeType;
      const unTerminal = lireDeclarationDeTerminal();
      if (unTerminal) return unTerminal;
    }
    // ── L AROBASE EST SORTIE DU LANGAGE ──────────────────────────────────────────────────────
    // `hub/decisions/2026-08-17-factory-et-mine-sortent-du-langage.md`, section « Amendement du
    // 2026-08-17 — l arobase sort de partout ». ⛔ LE NOM DU FICHIER, PAS LA DATE SEULE : j avais
    // cite « 2026-08-18 », Atlas a liste `hub/decisions/` a cette date, n a rien trouve, et a
    // conclu que la decision n existait pas — il a refuse de migrer ses 211 arobases et son
    // portillon est reste rouge. Une date se recopie de travers, un nom de fichier traverse.
    // « on enleve tous les arobases et c est tout ». La forme est la ligne PRIVEE de son
    // arobase, rien d autre : `core`, `alphabet.western`, `tempo:360`, `mode:lin`.
    //
    // ⛔ CE QUI QUALIFIE UNE LIGNE EST DESORMAIS SA POSITION : avant le delimiteur elle DECLARE,
    // apres elle PRODUIT. C est ce qui rend le delimiteur obligatoire, et c est pourquoi son
    // insertion (etape A) devait passer d abord — sans lui, une production entiere se lirait
    // comme une suite de declarations.
    //
    // ⛔ PAS DE VOIE PARALLELE : la forme a arobase est REFUSEE, pas toleree. Un parseur qui
    // accepterait les deux ne refermerait jamais la migration.
    const tok = current();
    if (at(T.AT)) {
      const apres = peek(1);
      throw new ParseError(
        `l'arobase est SORTIE du langage (decision Romain, `
        + `hub/decisions/2026-08-17-factory-et-mine-sortent-du-langage.md) — ecrire `
        + `'${apres && apres.value ? apres.value : '<directive>'}' sans elle. Ce qui qualifie une `
        + `ligne est sa POSITION : avant le '-----' elle declare, apres elle produit.`, tok);
    }
    // @+ is a special case — PLUS token instead of IDENT
    let name, subkey = null, directiveParams = null;
    if (at(T.PLUS)) {
      advance();
      name = '+';
    } else if (atAny(T.GATE, T.TRIGGER, T.CV)) {
      // @gate, @trigger, @cv — keywords used as directive names
      name = advance().value;
    } else {
      // ⚠️ LE NOM D'UNE LIBRAIRIE PEUT PORTER UN TIRET, au meme titre qu'un nom d'entree —
      // `ragas-tunings.sargam_12TET`. Le tokenizer detache le tiret partout depuis qu'il est un
      // SILENCE dans le flux ; ici il fait partie du nom, et `lireNomDEntree` le recolle. Le defaut
      // etait MASQUE par le prefixe de provenance, qui lisait le chemin par sa propre voie.
      name = lireNomDEntree(tok);
    }
    // Invocation par PROVENANCE (chantier libs-provenance, décision hub ef75ec6 ;
    // contrat contrats/bpscript-bpx.md §libRefs) : `factory.<chemin-fichier>.<entrée>`. Le
    // domaine est déclaré DANS le fichier — on ne le connaît PAS ici (L27 : on PORTE opaque,
    // Kairos résout). Découpage POSITIONNEL : dernier segment = entrée ; le milieu = chemin.
    // → canal NEUTRE `ast.libRefs` (adresse canonique opaque), PAS un slot legacy.
    //
    // ⛔ `mine` EST SORTI LE 2026-08-19, sur décision de Romain : « il n'existe pas encore, on
    // verra plus tard. SI, mine SORT ! Maintenant ! » Il ne laisse AUCUNE trace ici — ni branche,
    // ni message dédié, ni renvoi : un mot retiré se refuse comme un mot inventé. Le seul reste
    // est un garde qui vérifie qu'il ne marche plus.
    // ⛔ `factory` EST SORTI LE 2026-08-20, comme `mine` l'avait été la veille. Il ne laisse AUCUNE
    // branche ici : un mot retiré se refuse comme un mot inventé, et il tombe donc sur la
    // résolution ordinaire, qui ne connaît aucune librairie de ce nom.
    //
    // ⚠️ CE N'ÉTAIT PAS UN SUCRE : L'INVOCATION PRÉFIXÉE CONTOURNAIT LA RÉSOLUTION. Mesuré avant le
    // retrait — `tuning.nexistepas` est REFUSÉ (« introuvable dans le catalogue »), et
    // `factory.tunings.nexistepas` était ACCEPTÉ et voyageait jusqu'à l'aval dans `libRefs`. Le
    // préfixe ouvrait une seconde porte qui ne vérifiait rien : une entrée inexistante y passait en
    // silence là où la forme nue crie.
    //
    // Coût mesuré avant la frappe : ZÉRO invocation réelle dans les 69 scènes suivies et les 329 de
    // Kanopi. Les 28 scènes qui portent `libRefs` l'obtiennent par l'invocation DIRECTE
    // (`test_alphabets.abc`, `settings.test1`), jamais par ce préfixe — le canal reste, sa seconde
    // porte part.
    // @alphabet.western — dot accessor for subkey within a lib
    if (at(T.PERIOD)) {
      advance();
      subkey = lireNomDEntree(tok);
    }

    // LE PRÉFIXE PAR LA LIBRAIRIE SE RABAT ICI, AU PLUS TÔT — `core.tempo:120` DEVIENT
    // `tempo:120` (Romain, 2026-08-09 : « à étendre à toutes les librairies.directives »).
    // Le préfixe est une façon d'ÉCRIRE, pas une forme à porter : il ne survit pas dans l'arbre,
    // donc aucun consommateur n'a de nouvelle nature à lire. Contrepartie exacte de la résolution
    // par unicité (2026-08-02) — le nom nu vaut quand il est unique, le préfixe nomme
    // explicitement qui le déclare.
    //
    // ⚠️ « AU PLUS TÔT » EST TOUTE LA RÈGLE, et elle a été payée deux fois dans l'heure. Chaque
    // refus posé sur une directive se garde par `!subkey` : un rabattement placé plus bas laisse
    // la forme préfixée passer PAR-DESSUS le refus. Mesuré en produit croisé (librairies ×
    // directives déclarées), rabattement tardif : `core.seed:120` passait là où `seed:120` est
    // refusé depuis le 2026-06-11, et `core.scene:120` ROUVRAIT `scene`, supprimée du langage.
    // DIX-HUIT paires se comportaient autrement que leur nom nu — dix-huit refus contournables en
    // préfixant. Le cas du jour (`tempo`) n'en montrait aucun : seul le produit croisé les a vus.
    //
    // Ce qui se rabat est lu dans la DONNÉE (`directiveDeclareeParLaLibrairie` : `reservedDirectives`,
    // `values`, `controls`), jamais une liste de paires en dur — une directive ajoutée à une
    // librairie devient préfixable le jour même. Une invocation de COMPOSANT n'est pas touchée :
    // `alphabet.western` ne résout rien par ce chemin (`western` vit dans `alphabets`, pas parmi
    // les directives déclarées), donc elle poursuit intacte. Un préfixe qui ne résout rien n'est
    // pas avalé non plus : il tombe dans le refus nommé de `bpxAst`, qui dit quelle entrée manque
    // et dans quelle librairie.
    if (subkey && directiveDeclareeParLaLibrairie(name, subkey)) {
      name = subkey;
      subkey = null;
    }

    // ─── UNE CLÉ D'ACTEUR PORTE SES PARAMÈTRES, EN DÉFAUT DE SCÈNE AUSSI ──────────────────────
    // `out.midi(ch:1)` (`LANGUAGE.md` §« Les cinq clés d'un acteur ») : la même écriture que sous
    // un `actor`, à l'étage de la scène. Les paramètres sont lus ICI parce que la clé les porte
    // partout où elle s'écrit — ils ne dépendent pas de l'endroit. La liste des clés vient de
    // `lib/core.json` (`schema.actorKeys`), jamais d'une liste en dur.
    if (subkey && at(T.LPAREN) && !current().spaceBefore && actorKeysData().valides.has(name)) {
      advance();                                   // (
      directiveParams = {};
      while (!at(T.RPAREN) && !atEnd()) {
        const pk = expect(T.IDENT).value;
        expect(T.COLON);
        directiveParams[pk] = at(T.INT) || at(T.FLOAT) ? Number(advance().value) : advance().value;
        if (at(T.COMMA)) advance();
      }
      expect(T.RPAREN);
    }

    // ─── PIERRE TOMBALE — `scene` est SUPPRIMÉE de la graphie (Romain, 2026-07-29) ──────────
    // Ses mots : « on n'a ni la maturité ni le besoin de déclarer des sous-scènes », puis, une fois
    // la pièce sur la table : « je propose de LAISSER scenes dans BPx, ça peut servir plus tard,
    // mais on le retire du RESTE ».
    //
    // ⚠️ CE QUE ÇA RETIRE N'EST PAS RIEN, ET LA PIÈCE A ÉTÉ MESURÉE AVANT LA DÉCISION. J'avais
    // annoncé que cette suppression « ne touche personne », sur la foi d'un zéro mesuré chez UN
    // consommateur. Mesuré chez BPx avant d'écrire : leur orchestrateur multi-scène EXPORTE une
    // surface publique, LIT `ast.scenes` à trois endroits, et dix cas d'intégration en dépendent.
    // Ils ne CASSENT pas — le champ est optionnel chez eux — mais ils perdent l'ENTRÉE de ce
    // chemin et le SUJET de ces dix cas. Leur orchestrateur reste, comme capacité conservée en
    // attente d'usage. Ce n'est PAS de la rétrocompatibilité : rien ne l'appelle plus côté langage.
    //
    // LA LEÇON, ET ELLE VAUT AU-DELÀ D'ICI : UN ZÉRO CHEZ UN CONSOMMATEUR N'EST PAS UN ZÉRO
    // PARTOUT. Et sa réciproque, apprise le même jour et plus vicieuse : chercher les OCCURRENCES
    // dans les données ne trouve pas les LECTEURS — BPx n'avait aucune scène employant `scene`, et
    // c'est pourtant chez eux que la suppression mord, parce que c'est leur CODE qui lit le champ.
    // ⛔ `mm` N'A PLUS DE PIERRE TOMBALE ICI, et c'est une décision : le mot est sorti du langage
    // le 2026-08-18, et la règle de `hub/decisions/2026-08-15-un-type-se-declare-en-librairie…`
    // veut qu'un mot sorti soit refusé comme un mot inventé. Le témoin qui le prouve compare son
    // refus à celui de `zorglub` et exige qu'ils soient identiques.

    // TOMBSTONE : la feature @routing (profils d'environnement studio/live/browser + routingTable
    // Z1 #105) est SUPPRIMÉE (décision 2026-07-16, Romain : modèle d'environnements abandonné —
    // ce n'était pas le moteur BP3 mais une feature de notre transpileur). Rejet nommé plutôt
    // qu'un silence : le canal de sortie se déclare par `out.<audio|midi|osc>` sur l'acteur.
    // ⛔ PAS DE PIERRE TOMBALE POUR `alias`, `speed` NI `template` — et c'est une decision, pas
    // un oubli : `hub/decisions/2026-08-15-un-type-se-declare-en-librairie-object-def-var-init.md`
    // dit « Elles sortent SANS PIERRE TOMBALE — un mot inconnu est refuse comme un mot invente. »
    //
    // ⚠️ JE LES AVAIS POSEES, PUIS RETIREES LE MEME JOUR. Le refus qu'elles remplaçaient a un
    // vrai cout — un auteur qui ecrit `alias` lit qu'il lui manque une librairie et part en
    // chercher une — mais la regle prime, et `alias_est_sorti_du_langage.mjs` la MESURE : il
    // compare ce refus a celui d'un mot invente et exige qu'ils soient IDENTIQUES.
    //
    // La question reste ouverte chez Romain : la regle est ecrite pour cinq mots que la reference
    // n'a JAMAIS decrits, alors que ces trois-la etaient dans la bible et largement ecrits. Les
    // sept pierres tombales existantes (`mm`, `scene`, `transport`, `library`, `in`, `macro`,
    // `flag`) sont dans le meme cas et leur sort se tranche avec.

    let runtime = null, value = null, aliases = null;

    // ⛔ LE LECTEUR DE `scene` EST RETIRE LE 2026-08-19, et la decision a treize semaines : Romain,
    // le 2026-07-29, « je propose de LAISSER scenes dans BPx, ça peut servir plus tard, mais on le
    // retire du RESTE ». Le RESTE, c'est ici. La pierre tombale etait ecrite, le lecteur ne l'avait
    // jamais suivie : `scene verse "verse.bps"` compilait encore et posait son noeud.
    //
    // ⚠️ LE CHAMP `ast.scenes` RESTE, vide — c'est la moitie que Romain garde pour BPx, qui le LIT
    // a trois endroits. Retirer le champ AVEC le lecteur ferait plus que la decision ne dit.
    // MESURE AVANT LA COUPE : ZERO fichier de la tour ecrit cette directive — tous les `.bps` et
    // `.gr` des vingt-quatre depots, liens symboliques non suivis. Aucune scene ne tombe avec.

    // ⛔ PIERRE TOMBALE — `library` est SUPPRIMÉE du langage (décision Romain 2026-08-06).
    //
    // POURQUOI ELLE PART. C'était la seule des quinze librairies dont ce qui suit le point n'était
    // pas l'ENTRÉE du catalogue mais le MOTEUR, l'entrée venant après entre guillemets : trois
    // pièces là où toutes les autres en ont deux. Mesuré avant de trancher : sa forme nue
    // `library.strudel` — celle que la bible imprimait — ne compilait même pas.
    //
    // CE QUI LA REMPLACE : la banque est un paramètre INTRINSÈQUE du moteur, déclaré sur l'entrée
    // `strudel` de `lib/eval.json` (Romain : « bank est intrinsèque à strudel, c'est pas
    // générique »). Elle se pose donc sur l'ACTEUR, à côté du moteur qui la charge — et l'écriture
    // existait déjà, c'est celle de `out.midi(ch:3)`. Gain de passage : deux voix Strudel peuvent
    // désormais porter deux banques différentes dans une même scène, ce que la directive de scène
    // rendait impossible.
    //
    // ⛔ ET LE REFUS NOMMÉ A ÉTÉ RETIRÉ le 2026-08-15 : la décision de ce jour veut qu'un mot sorti
    // tombe dans le refus d'un mot INVENTÉ. `library` refuse donc comme un axe que personne n'a
    // écrit, et `test_library.js` compare les deux messages mot pour mot.

    // ─── PIERRE TOMBALE — `transport`/`out` ne sont PAS des directives de scène (Romain,
    // 2026-08-04) ─────────────────────────────────────────────────────────────────────────────
    // Signalé par Atlas, mesuré avant correction : le tombstone `transport` posé DANS un bloc
    // `actor` (plus bas, `actorKeysData()`) ne couvrait pas l'écriture en TÊTE de scène —
    // `transport.midi` et `out.midi` compilaient tous les deux SANS ERREUR et SANS AUCUN EFFET
    // (l'acteur implicite garde `{type:'TransportRef', key:'audio'}` quoi qu'on écrive : la
    // directive produisait un nœud que rien ne consomme). Le trou est PRÉEXISTANT — `transport`
    // compilait déjà avant le lot de renommage du 2026-08-04, ce n'est pas une régression de ce
    // lot, c'est ce que ce lot aurait dû fermer.
    //
    // Les deux mots restent dans `schema.reservedDirectives` (`lib/core.json`) — ce refus
    // s'AJOUTE, il ne les en retire pas : c'est ce qui empêche une librairie de déclarer une
    // valeur portant ce nom (cf. `_destinations.transport`/`_destinations.out` du même fichier).
    // ─── PIERRE TOMBALE — `transcription` est REMPLACÉE par `homomorphism` (Romain, 2026-08-07)
    // « oui on renomme ». La bible n'a JAMAIS écrit que `homomorphism.<table>` (§« Les tables
    // d'homomorphisme se déclarent par @homomorphism.<table> ») ; le mot `transcription` n'y
    // apparaît nulle part. Le code implémentait l'ancien nom et REFUSAIT celui de la référence.
    //
    // ⚠️ ET LE RETRAIT SIMPLE AURAIT ÉTÉ MUET, c'est pourquoi ce refus existe : une fois le
    // chargeur basculé, `homomorphism.dhati` compilait toujours — en chargeant ZÉRO table. La
    // scène croyait transformer sa production et ne transformait rien, exactement le défaut payé
    // sur `homomorphism.dhinOO` (« la scène croyait charger un homomorphisme et n'en chargeait
    // AUCUN, depuis des mois »). Un mot retiré sans pierre tombale ne disparaît pas : il devient
    // inerte, et l'inerte ne se voit pas.
    // ⚠️ `out` A ÉTÉ REFUSÉ ICI DU 2026-08-04 AU 2026-08-07, ET LE REFUS ÉTAIT DE MOI.
    // Il invoquait la décision `2026-08-04-la-direction-s-ecrit-in-et-out-remplacent-transport`,
    // qui ne dit PAS ça : elle sort le mot `transport` du langage et pose `in.`/`out.` à sa place.
    // Tous ses exemples écrivent `out.` sous un acteur, aucun n'interdit le défaut de scène. La
    // bible, elle, l'ÉCRIT (`LANGUAGE.md` §« Les cinq clés d'un acteur ») :
    //     @alphabet.sargam          // la scene entiere joue le sargam et sort par le MIDI
    //     @out.midi(ch:1)
    //     @actor sitar              // cet acteur affine ce dont il herite
    // Le défaut mesuré était réel — l'ancien commentaire ci-dessus le dit : `out.midi` compilait
    // SANS AUCUN EFFET. J'ai fermé la moitié facile (interdire) au lieu de la vraie (brancher).
    // Les quatre autres clés d'acteur descendaient déjà en défaut de scène ; `out` était la seule
    // exception, et elle ne venait d'aucun arbitrage.

    // ─── PIERRE TOMBALE — `in` n'existe plus (Romain, 2026-08-04) ────────────────────────────
    // `hub/decisions/2026-08-04-la-direction-s-ecrit-in-et-out-remplacent-transport.md`. La bible
    // (`docs/spec/LANGUAGE.md` §« @var — déclarer une variable ») écrivait déjà `@var <rôle>
    // in.<canal>` : ce n'était pas une nouvelle forme, c'est le code qui divergeait. La déclaration
    // d'entrée vit désormais dans `var`, avec les autres variables — voir plus bas.
    

    // @var A8   /   @var a, b, c — VARIABLES DE TRAVAIL
    // @var touches in.keyboard    — DÉCLARATION D'UNE ENTRÉE
    //
    // Décision Romain 2026-07-27, voie 3 : « on déclare les symboles non-alphabet terminaux en
    // plus, avec une directive @. Ce sont des VARIABLES DE TRAVAIL. »
    //
    // CE QUE ÇA DÉBLOQUE : une scène peut déclarer SA CONVENTION de notes ET porter un symbole qui
    // n'est l'écriture d'aucune note. Mesuré sur `Nadaka-1er-essai` : sa grammaire d'origine écrit
    // `A8`, qui n'a AUCUNE règle et n'est une note dans aucun alphabet — le moteur natif l'émet
    // littéralement comme jeton. Annoter la convention indienne de cette scène la faisait REFUSER
    // par mon propre compilateur. La déclaration lève la contradiction sans affaiblir le refus :
    // une COQUILLE reste attrapée (elle n'est déclarée nulle part), un symbole VOULU passe.
    //
    // LA GRAPHIE ne crée aucune syntaxe : pas de deux-points parce qu'on ÉNUMÈRE sans affecter
    // (règle de Romain du 2026-07-26, comme `expose`/`label`) ; la virgule sépare des éléments de
    // même rang, exactement comme dans un sac ; plusieurs lignes s'ACCUMULENT, comme plusieurs
    // invocations de librairie.
    //
    // ⚠️ PÉRIMÈTRE (2026-08-04) : `docs/spec/LANGUAGE.md` documente un `var` typé bien plus large
    // (flag, signal, pitch, phase, logic, module — table « `var` — déclarer une variable »). CE
    // CHANTIER (transport → in/out) n'ajoute QUE la forme d'entrée `<rôle> in.<canal>`, ex-`in` —
    // les autres types restent hors périmètre, non implémentés ici.
    // ⛔ `var` EST SORTI DU LANGAGE — décision Romain du 2026-08-16, appliquée le 2026-08-18.
    // Le TYPE vient en tête, le nom ensuite : ce que `var` portait se répartit sur des types, et
    // chacun est un mot que la donnée déclare. Le lecteur vit dans `lireDeclarationParLeType`.
    //
    // ⚠️ CE REFUS EST NOMMÉ, ET C'EST DÉLIBÉRÉ. La règle générale veut qu'un mot sorti tombe dans
    // le refus d'un mot inventé ; celle des frontières veut qu'une forme invalidée soit « refusée
    // avec sa réécriture ». `var` est écrit chez un consommateur et quatre fois dans la bible :
    // un refus muet lui ferait chercher une librairie manquante au lieu de lui donner la ligne à
    // écrire. Il n'accepte rien — il refuse en enseignant.
    // @macro kick = (vel:120) or @macro accent(x) = x(vel:120)
    

    // PIERRE TOMBALE — `label` part AVEC le suffixe qu'elle servait (Romain 2026-07-28). Elle
    // DÉCLARAIT un nom que le suffixe APPLIQUAIT : ce sont bien deux choses distinctes, mesurées
    // comme telles, mais rien ne les liait et aucune scène n'écrivait ni l'une ni l'autre. Retirer
    // le suffixe en laissant la directive aurait laissé un mot qui ne peut plus rien nommer —
    // c'est-à-dire une voie en attente de se rouvrir.
    // ⏸️ LES TOMBALES DE `trigger` ET `alias` SONT RETIRÉES — je les avais posées trop tôt.
    //
    // Décision Romain, 2026-08-08 : cinq directives sortent du langage — `gate`, `trigger`,
    // `cv`, `macro`, `alias`. La référence ne connaît que QUATRE mots (`actor`, `var`,
    // `def`, `init`) et les cinq y ont zéro occurrence.
    //
    // ⚠️ J'AI FRAPPÉ SUR CES DEUX-LÀ EN CROYANT QU'ELLES NE COÛTAIENT RIEN, parce que zéro scène
    // de la bibliothèque ne les écrit. La mesure était juste et la conclusion fausse : QUINZE de
    // mes propres gardes les emploient, et DIX sont passés au rouge. J'avais mesuré l'espace du
    // voisin et pas le mien — la faute exacte que je remonte aux autres, commise deux fois dans
    // la même journée.
    //
    // ⚠️ ET LA VRAIE RAISON DU RETRAIT EST PLUS FORTE QUE LE COMPTE : LA CIBLE N'EXISTE PAS.
    // Le message de refus renvoie vers `def`, qui n'est pas implémenté — mesuré, ses NEUF formes
    // sont refusées. Un refus qui nomme une réécriture impossible envoie l'auteur dans un mur ;
    // c'est la règle que kanopi m'a demandée le matin même et que j'ai acceptée. Je viens de la
    // violer sur mes propres tests, une heure après l'avoir écrite à trois agents.
    // L'ordre tient : `def` d'abord, les cinq tombales ensuite.

    // ⛔ UNE DIRECTIVE RETIREE QU ON CONTINUE D ACCEPTER N EST PAS RETIREE, ELLE EST INVISIBLE.
    // Mesure du 2026-08-09 : huit scenes portaient une directive « supprimee » que le parseur
    // lisait toujours et dont l emetteur produisait toujours la section, sans que rien ne le dise.
    // Le retrait ne vaut que le jour ou la lecture s arrete, pas le jour ou la decision tombe.
    //
    // ⛔ ET IL NE RESTE AUCUN REFUS NOMME DERRIERE UN MOT RETIRE. Un refus qui donne la reecriture
    // publie la forme qu il nomme : le message est le troisieme domicile d un mot sorti, apres le
    // parser et les librairies, et rien ne compile un message. Un mot retire se refuse donc
    // EXACTEMENT comme un mot invente — c est la regle du 2026-08-18, et elle se mesure en
    // comparant le refus du mot sorti a celui d un mot qui n a jamais existe.

  /**
   * ⛔ LE SIGNE `=` EST SUPPRIME DE TOUT LE LANGAGE (decision Romain, 2026-07-27) — et ce refus
   * doit valoir pour TOUTE directive qui nomme, pas pour celle ou le defaut s est montre.
   *
   * ⚠️ IL EST NE POUR `alias`, sorti du langage le 2026-08-15 ; il vaut desormais pour `var` et
   * `def`, les deux directives qui nomment. Mesure du 2026-08-09, en reecrivant le garde qui le
   * surveille : `alias breath = cc:2` nommait le signe, `def riff = C4` et `var riff = C4`
   * refusaient pour une tout autre raison — l un  ne declare rien , l autre  ligne non reconnue .
   * L auteur qui gardait le signe par habitude apprenait donc la disparition sur UNE directive et
   * la cherchait en vain sur les deux autres.
   * C est le motif de la journee : une garde ecrite pour la forme du ticket, jamais pour l espace.
   */
  /**
   * LES AUTRES NOMS QUE LA MEME DIRECTIVE DECLARE PLUS LOIN, lus dans les jetons restants.
   *
   * ⚠️ POURQUOI : un refus s ARRETE au premier cas — c est la nature d une erreur de parse. Kanopi
   * l a mesure le 2026-08-09 : `superp-cutoff` declare DEUX modulateurs, le refus n en nommait
   * qu UN, et il n a donc pas retrouve la precision de garde qu il avait avant la suppression.
   * Il ne demandait rien —  c est votre arbitrage  — mais le gain est pour l AUTEUR avant ses
   * gardes : devant une scene a quatre modulateurs, savoir qu il y en a quatre change le geste.
   * Sans ça, il corrige, relance, decouvre le deuxieme, et recommence quatre fois.
   *
   * Les jetons sont TOUS la : s arreter au premier est un choix de l erreur, pas une fatalite de
   * la lecture. On ne change pas la nature du refus — on lui donne ce qu il a deja sous la main.
   */
  function autresNomsDeLaDirective(directive) {
    const noms = [];
    for (let j = pos; j < tokens.length - 1; j++) {
      if (tokens[j].type !== T.AT) continue;
      if (tokens[j + 1] && tokens[j + 1].value === directive
          && tokens[j + 2] && tokens[j + 2].type === T.IDENT) {
        noms.push(tokens[j + 2].value);
      }
    }
    return noms;
  }

  function refuserLeSigneEgal(directive, nom) {
    if (!at(T.EQUALS)) return;
    throw new ParseError(
      `${directive} ${nom} : le signe '=' est SUPPRIME de tout le langage (decision Romain `
      + `2026-07-27) — ecrire '${directive} ${nom} <valeur>' sans rien entre les deux.`,
      current());
  }

    // ─── PIERRE TOMBALE — `flag` (directive de tête de scène) n'existe plus (référence
    // 2026-08-05) ─────────────────────────────────────────────────────────────────────────────
    // La référence ne connaît que QUATRE mots déclaratifs — `actor`, `var`, `def`, `init`
    // (EBNF.md:29-33, `docs/spec/LANGUAGE.md` §« Quatre mots »). Un drapeau n'en est pas un
    // cinquième : c'est une VARIABLE, comme les autres, qui se déclare par `var` (EBNF.md:47-57,
    // `var_type = "flag" , ":" , flag_state, ...`). La forme unique est désormais
    // `var <nom> flag: <état>:<entier>, ...`.
    

    // @actor name <body>
    //
    // v0.8 (forme canonique) : références d'entités via `.`
    //   @actor sitar
    //     alphabet.sargam
    //     tuning.sargam_22shruti
    //     out.midi(ch:3, vel:100)
    //     eval.python
    //     sound.bell_short            // équivaut à *:sound.bell_short
    //     *:sound.bell_short          // affectation défaut
    //     Sa:sound.drum_kick          // affectation note
    //
    // v0.7 (rétrocompat transitoire, accepté en silence) : références via `:`
    //   @actor sitar alphabet:sargam tuning:sargam_22shruti out:midi(ch:3)
    //
    // Les deux formes peuvent être mêlées sur la même ligne et le parseur
    // bascule par token (le `*` ou un IDENT:sound.X = affectation, sinon
    // entity_ref).
    //
    // ⚠️ `out` remplace `transport` (Romain, 2026-08-04) — le mot `transport` est SORTI du
    // langage, la direction s'écrit. Le CHAMP interne reste `properties.transport`/`TransportRef`
    // (`references[transport]`) : seul le mot que l'auteur ÉCRIT change, pas le nœud d'arbre.
    // ═══ `def` — DÉCLARER UNE DÉFINITION (Romain, 2026-08-08) ═══════════════════════════════
    //
    // `LANGUAGE.md` §« `def` — déclarer une définition » : « `def` associe un nom à un corps,
    // pour le réinvoquer d'un mot. Le nom vient d'abord, ce qu'il vaut ensuite. »
    // C'est l'un des QUATRE mots du cœur déclaratif, avec `actor`, `var` et `init` — et le
    // seul qui n'existait pas : mesuré le 2026-08-08, ses NEUF formes étaient refusées, le
    // parseur ne reconnaissait même pas la directive (« Expected arrow »).
    //
    // ⚠️ C'EST LUI QUI DÉBLOQUE TOUT LE RESTE. Cinq directives sortent du langage (`gate`,
    // `trigger`, `cv`, `macro`, `alias`) et leur réécriture passe par ici : à elle seule,
    // `gate` pèse 119 lignes sur 14 scènes. Tant que `def` n'existe pas, poser leur pierre
    // tombale nommerait une réécriture impossible — la règle que kanopi a demandée et que j'ai
    // acceptée. L'ordre est donc : cette directive d'abord, les tombales ensuite.
    //
    // CE PALIER OUVRE LA DÉCLARATION DE TERMINAL — la forme que la spécification décrit sous
    // « Déclarer un terminal » : un nom, puis un BLOC DE CLÉS, « sous le nom, une clé par ligne,
    // ou sur la même ligne quand il tient ». C'est elle qui remplace `gate`, le plus gros lot.
    // Les autres corps (branchement, structure, code typé, préréglage, transformation) suivront ;
    // ils sont REFUSÉS NOMMÉMENT plus bas plutôt que lus de travers — un corps qu'on ne sait pas
    // lire doit crier, jamais tomber dans une branche voisine.
    if (name === 'def') {
      if (!at(T.IDENT)) {
        throw new ParseError(
          "'def' doit nommer ce qu'il définit : 'def <nom> <corps>'. Le nom vient d'abord, ce "
          + "qu'il vaut ensuite — comme 'actor'.", tok);
      }
      const defName = expect(T.IDENT).value;
      refuserLeSigneEgal('def', defName);
      const cles = {};
      let lu = 0;

      // Une clé : `cle.valeur` (référence d'entité) ou `cle:valeur` (affectation).
      // C'est la règle d'or du langage : le point APPELLE un composant, le deux-points AFFECTE.
      const lireUneCle = (dansUnBloc = false) => {
        const kTok = current();
        const cle = expect(T.IDENT).value;
        if (at(T.PERIOD) && !current().spaceBefore) {
          advance();
          if (!at(T.IDENT)) throw new ParseError(`'def ${defName}' : nom attendu après '${cle}.'`, current());
          let val = String(advance().value);
          while ((at(T.IDENT) || at(T.INT)) && !current().spaceBefore) val += String(advance().value);
          cles[cle] = { kind: 'ref', value: val };
          lu++;
          return;
        }
        if (at(T.COLON) && !current().spaceBefore) {
          advance();
          if (atEnd() || at(T.NEWLINE)) throw new ParseError(`'def ${defName}' : valeur attendue après '${cle}:'`, current());
          // ── UNE VALEUR VA JUSQU'AU BOUT DE LA LIGNE, ET L'ESPACE EN SÉPARE LES PARTIES ────────
          // C'est la règle du langage — « l'espace ne sépare que les PARTIES d'une valeur » — et ce
          // lecteur ne la tenait PAS. Il s'arrêtait au premier IDENT espacé et laissait le reste
          // pendre : `scope:symbol group` sortait « Expected arrow », un refus qui accuse la ligne
          // SUIVANTE. Pire, un NOMBRE espacé ne l'arrêtait pas : `range:0 127` était CONCATÉNÉ en
          // « 0127 » — une corruption SILENCIEUSE, la plus chère des deux.
          //
          // Les parties sont donc gardées comme telles : une seule reste une chaîne (rien ne change
          // pour `bp3:_vel`), plusieurs deviennent une LISTE — la forme que les librairies portent
          // déjà pour `range` et `scope`. Un nombre reste un nombre.
          // ⚠️ SUR UNE MÊME LIGNE, L'ESPACE SÉPARE DEUX CHOSES — et les confondre casse une forme
          // vivante de la bible. `def sirene hz:440 voice.sec` porte DEUX CLÉS ; `range:0 127`
          // porte UNE clé à deux parties. Le discriminant est le CANON, pas une heuristique : un
          // mot espacé suivi de `:` ou de `.` ouvre une NOUVELLE CLÉ — le deux-points affecte, le
          // point appelle un composant — tandis qu'un mot espacé suivi de rien de tel est la partie
          // suivante de la valeur en cours.
          // ⛔ LES PARTIES MULTIPLES SONT CELLES DU BLOC, ET LA LIGNE EST LA FRONTIÈRE.
          // Sur une MÊME ligne, `hz:440 voice` et `scope:symbol group` ont EXACTEMENT la même forme :
          // rien ne les distingue sans connaître la clé. Or un mot nu après une clé est une faute
          // DATÉE — témoin déplacé le 2026-08-08 après mesure aux deux endroits — et une valeur à
          // plusieurs parties est ce dont une librairie a besoin. Les deux ne peuvent pas coexister
          // sur une ligne ; ils coexistent très bien de part et d'autre d'un saut de ligne.
          // Une clé écrite SUR SA PROPRE LIGNE porte donc des parties ; une clé écrite à la suite
          // d'une autre n'en porte pas, et le mot nu qui la suit reste refusé.
          const ouvreUneCle = () => at(T.IDENT) && current().spaceBefore
            && (!dansUnBloc || peek(1).type === T.COLON || peek(1).type === T.PERIOD);
          const parties = [];
          let courante = '';
          while (!atEnd() && !at(T.NEWLINE) && !at(T.COMMENT) && !ouvreUneCle()) {
            if (courante !== '' && current().spaceBefore) { parties.push(courante); courante = ''; }
            courante += String(advance().value);
          }
          if (courante !== '') parties.push(courante);
          // LES PARTIES RESTENT DES CHAÎNES, comme avant : typer les nombres ici changerait l'arbre
          // de TOUTES les clés existantes — `register:5` passerait de '5' à 5 — et c'est une autre
          // question que celle des parties. Une seule chose bouge à la fois.
          cles[cle] = { kind: 'value', value: parties.length === 1 ? parties[0] : parties };
          lu++;
          return;
        }
        throw new ParseError(
          `'def ${defName}' : '${cle}' n'est ni un appel de composant ni une affectation. `
          + `Une clé de terminal s'écrit '${cle}.<nom>' pour appeler un composant, ou `
          + `'${cle}:<valeur>' pour affecter une valeur — le point appelle, le deux-points affecte.`,
          kTok);
      };

      // ── QUEL CORPS ? Le discriminant est la PONCTUATION COLLÉE, pas le nom ──────────────
      // Une CLÉ porte toujours `.` ou `:` collé — c'est la règle d'or du langage : le point
      // appelle un composant, le deux-points affecte une valeur. Une STRUCTURE est faite de
      // termes NUS : `def cadence sa re ga pa` (`LANGUAGE.md:311`).
      // ⚠️ Le départage se fait sur ce que le texte PORTE, jamais sur ce que le nom ÉVOQUE : un
      // terminal peut s'appeler `voice` et une clé porter le nom d'un terminal. Chercher un
      // vocabulaire ici referait la faute du 2026-07-26 — laisser la donnée décider de la forme.
      // ── DEUX CORPS QUE LA PARENTHESE DEPARTAGE, ET C EST LE COLLAGE QUI TRANCHE ──────────
      // `LANGUAGE.md`, tableau des signes : « `(x)` COLLE au nom = liste de parametres de la
      // definition » ; « `(vel:60)` SEPARE du nom = corps de la definition ».
      // C est la meme regle que partout ailleurs dans le langage — l espace delimite les termes —
      // et elle suffit a distinguer une TRANSFORMATION PARAMETREE d un PREREGLAGE, sans qu on ait
      // a deviner d apres le contenu de la parenthese.
      // ── LE CODE TYPE : `def fondu phase `js: …`` ────────────────────────────────────────
      // `LANGUAGE.md:307` : « Ses types sont ceux des signaux : signal, pitch, phase, logic. »
      // Le type se lit dans la DONNEE (`core.json`, schema.varConventions) — la meme liste que
      // `var` consulte deja pour ses conventions. Aucun nom de type n est ecrit ici.
      // ⚠️ CE CORPS ETAIT REFUSE PAR LE PALIER STRUCTURE, et volontairement : `phase` est un terme
      // nu, il tombait dans la branche structure et devenait un TERMINAL — un arbre plausible et
      // faux. Le refus posait la question ; c est ici qu elle se resout, sur la meme FORME (un
      // backtick suit) et pas sur le nom du premier terme.
      // ⚠️ ET LE CODE SANS TYPE — `def noir `py: d.blackout()`` (LANGUAGE.md:642).
      // La reference ecrit les DEUX : avec une convention quand le code rend un SIGNAL dont il
      // faut dire la nature, sans convention quand il nomme simplement un FRAGMENT a rejouer.
      // Un fragment n a pas de type parce qu il ne rend rien — il agit.
      // Le departage est la FORME, une fois de plus : ce qui precede le backtick, ou rien.
      if (at(T.BACKTICK)) {
        const bt = current();
        const brut = expect(T.BACKTICK).value;
        const { tag, code } = splitBacktickTag(brut);
        return { type: 'DefDirective', name: defName, kind: 'code',
                 convention: null, tag, code, line: tok.line };
      }
      if (at(T.IDENT) && varConventions().has(current().value)
          && peek(1) && peek(1).type === T.BACKTICK) {
        const convention = advance().value;
        const bt = current();
        const brut = expect(T.BACKTICK).value;
        const { tag, code } = splitBacktickTag(brut);
        return { type: 'DefDirective', name: defName, kind: 'code',
                 convention, tag, code, line: tok.line };
      }
      if (at(T.LPAREN) && !current().spaceBefore) {
        // TRANSFORMATION PARAMETREE : `def accent(x) x(vel:120)`
        advance();
        const params = [];
        while (!at(T.RPAREN) && !atEnd()) {
          // La forme longue s'écrit sur plusieurs lignes — c'est une DÉCLARATION. Le flux d'une
          // règle garde sa lecture : une règle finit à la ligne, et l'y autoriser changerait ce
          // que la partie production sait borner.
          while (at(T.NEWLINE) || at(T.COMMENT)) advance();
          if (at(T.RPAREN) || atEnd()) break;
          if (at(T.IDENT)) params.push(advance().value);
          else if (at(T.COMMA)) advance();
          else {
            throw new ParseError(
              `'def ${defName}(…)' : la liste de parametres ne porte que des NOMS, separes par des `
              + `virgules — recu '${current().value}'.`, current());
          }
        }
        expect(T.RPAREN);
        if (params.length === 0) {
          throw new ParseError(
            `'def ${defName}()' : une liste de parametres VIDE ne parametre rien. Ecrire `
            + `'def ${defName} <corps>' sans parenthese collee, ou nommer au moins un parametre.`, tok);
        }
        const corps = parseRhsElements();
        if (corps.length === 0) {
          throw new ParseError(
            `'def ${defName}(${params.join(', ')})' : transformation sans corps. Ce que la `
            + `definition FAIT de ses parametres s ecrit apres eux.`, tok);
        }
        return { type: 'DefDirective', name: defName, kind: 'transformation',
                 params, body: corps, line: tok.line };
      }
      if (at(T.LPAREN)) {
        // PREREGLAGE : `def kick (vel:120)` — la parenthese est SEPAREE, c est un corps.
        const sac = parseRuntimeQualifier();
        return { type: 'DefDirective', name: defName, kind: 'prereglage',
                 settings: sac, line: tok.line };
      }

      const cleEnTete = () => {
        if (!at(T.IDENT)) return false;
        const apres = peek(1);
        return !!apres && (apres.type === T.PERIOD || apres.type === T.COLON) && !apres.spaceBefore;
      };

      if (at(T.IDENT) && !cleEnTete()) {
        // ── UNE STRUCTURE — un nom vaut une suite de termes, qu'on réinvoque d'un mot ────────
        // `LANGUAGE.md:304` : « `def` associe un nom a un corps, pour le reinvoquer d'un mot »,
        // et §« Ce qui se definit est ce qui se reinvoque ».
        // ⚠️ LE CORPS EST LU PAR LE LECTEUR DE MEMBRE DROIT, celui des règles, et ce n'est pas
        // une commodité : une structure EST un membre droit. Lui écrire un lecteur à part ferait
        // diverger deux grammaires pour une seule notion — et c'est déjà arrivé ici, la forme
        // pointée passant d'un côté et pas de l'autre. Le silence, la prolongation, les groupes
        // et les qualificatifs marchent donc sans une ligne de plus, parce que ce sont les mêmes.
        const corps = parseRhsElements();
        if (corps.length === 0) {
          throw new ParseError(
            `'def ${defName}' : structure vide. Un nom qui ne vaut rien ne se réinvoque pas.`, tok);
        }
        // ⛔ UN CORPS DE CODE N'EST PAS UNE STRUCTURE — et sans ce refus il en devenait une.
        // `def fondu phase \`js: …\`` (LANGUAGE.md:312) commence lui aussi par un terme nu ; il
        // tombait donc ici, et l'arbre produit était PLAUSIBLE ET FAUX : `phase` — un TYPE de
        // signal — devenait un terminal, le code un élément voisin.
        // ⚠️ C'est exactement ce que le volet D du garde interdit : « un corps qu'on ne sait pas
        // lire ne doit jamais tomber dans une branche voisine ». Je l'ai créé en ouvrant la
        // structure, et mesuré dans la foulée — d'où ce refus, jusqu'au palier du code typé.
        // Le discriminant est la FORME (un backtick est présent), jamais le nom du premier terme :
        // décider sur un vocabulaire de types ferait dépendre la forme d'une liste de mots.
        const backtick = corps.find((e) => e && typeof e.type === 'string' && e.type.includes('Backtick'));
        if (backtick) {
          throw new ParseError(
            `'def ${defName}' porte du CODE, pas une structure — ce palier lit « un nom vaut une `
            + `suite de termes » ('def cadence sa re ga pa'). Le corps de code typé `
            + `('def ${defName} <type> \`langage: …\`', types 'signal', 'pitch', 'phase', 'logic') `
            + `n'est PAS encore lu ; il refuse ici plutôt que d'être lu de travers — sans quoi le `
            + `type deviendrait un terminal et le code un élément voisin.`, tok);
        }
        return { type: 'DefDirective', name: defName, kind: 'structure', body: corps, line: tok.line };
      }

      // Les clés qui tiennent sur la MÊME ligne que le nom.
      while (at(T.IDENT)) lireUneCle();

      // Puis le BLOC : les lignes suivantes, une clé par ligne, tant qu'elles sont INDENTÉES.
      // ⚠️ L'indentation est ce qui BORNE le bloc — sans elle, la ligne suivante serait avalée,
      // et une règle écrite juste après deviendrait une clé du terminal, en silence.
      while (at(T.NEWLINE) || at(T.COMMENT)) {
        let j = pos;
        while (tokens[j] && (tokens[j].type === T.NEWLINE || tokens[j].type === T.COMMENT)) j++;
        const suivant = tokens[j];
        // L'INDENTATION SE LIT SUR LA COLONNE — le tokenizer ne marque pas les blocs, il donne
        // `col`. Ma première écriture cherchait un champ `indente` qui n'existe pas : la
        // condition était donc TOUJOURS fausse et le bloc n'était jamais lu, sans erreur.
        // Une propriété inventée ne plante pas, elle rend `undefined` — et la branche meurt en
        // silence. Mesuré et corrigé sur-le-champ ; c'est pour ça que le garde teste le bloc.
        if (!suivant || suivant.type !== T.IDENT || !(suivant.col > 1)) break;
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        lireUneCle(true);   // dans le BLOC : une clé par ligne, donc des parties multiples
      }

      if (lu === 0) {
        throw new ParseError(
          `'def ${defName}' ne déclare rien. Ce palier lit DEUX corps : la DÉCLARATION DE `
          + `TERMINAL — un nom puis ses clés, sur la même ligne ('def ${defName}  voice.sec') ou `
          + `dans un bloc indenté, une clé par ligne — et la STRUCTURE, un nom qui vaut une suite `
          + `de termes ('def ${defName} sa re ga pa'). Les autres corps que la spécification `
          + `décrit — un branchement, du code typé, un préréglage, une transformation paramétrée `
          + `ou structurelle — ne sont PAS encore lus ; ils le seront, et d'ici là ils refusent `
          + `ici plutôt que d'être lus de travers.`, tok);
      }
      return { type: 'DefDirective', name: defName, kind: 'terminal', keys: cles, line: tok.line };
    }

    // ── `init` — L'ÉTAT DE DÉPART DE LA SCÈNE ────────────────────────────────────────────────
    // LANGUAGE.md, « @init -- l'etat de depart » : « `init` porte ce qui existe au démarrage de la
    // scène et n'appartient à aucune déclaration : le branchement initial, le code lancé une fois,
    // les valeurs de départ. Ce qui appartient à une chose s'initialise DANS sa déclaration — un
    // flag écrit son état de départ là où il naît. `init` recueille ce qui ne se rattache à rien. »
    //
    // ⚠️ CE QUI PASSAIT AVANT, ET C'EST LE PIRE DES SILENCES : `init` seul COMPILAIT et ne portait
    // RIEN — il tombait dans la lecture des directives génériques, qui avale un nom et s'arrête.
    // Une scène pouvait donc écrire son état de départ et le voir disparaître sans une erreur. Un
    // corps, lui, était refusé (« Expected arrow ») : la moitié muette, la moitié bruyante.
    //
    // ⛔ `init` PORTE DEUX ENTRÉES, ET DEUX SEULEMENT : un backtick TAGUÉ et un sac de valeurs.
    // Ce qu'il recueillait de plus est sorti du langage le 2026-08-18 ; la boucle s'arrête sur
    // tout le reste, et la ligne tombe alors dans le refus ordinaire d'une forme inconnue.
    if (name === 'init') {
      // LA FORME DE L'ARBRE EST CELLE QUE LA SPEC ÉCRIT : `init: InitEntry[] | null`, un tableau
      // PLAT (AST.md:30, :201-204). Pas de `{codes, valeurs}` de mon invention — une seconde forme
      // obligerait chaque consommateur à connaître la mienne en plus de celle qui est publiée.
      const entrees = [];
      while (!atEnd()) {
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        if (atEnd()) break;
        // LE CODE LANCÉ UNE FOIS — un backtick TAGUÉ. Le tag est obligatoire ici : `init` est un
        // site ORPHELIN, aucun acteur ne l'entoure, donc aucun langage ne peut s'hériter.
        if (at(T.BACKTICK)) {
          const tok2 = current();
          const t = splitBacktickTag(advance().value);
          // `BacktickOrphan` est le type que la spec nomme (AST.md:657) — pas un type à moi.
          entrees.push({ type: 'BacktickOrphan', tag: t.tag, code: t.code, line: tok2.line });
          continue;
        }
        // LES VALEURS DE DÉPART — la même graphie qu'ailleurs, `!(clé:valeur)` ou `(clé:valeur)`.
        if (at(T.BANG) || at(T.LPAREN)) {
          if (at(T.BANG)) advance();
          // ⚠️ ÉCART SIGNALÉ, ET LA BIBLE TRANCHE. `LANGUAGE.md` écrit que `init` porte « les
          // valeurs de départ » ; `AST.md` ne définit qu'une variante d'entrée, le backtick
          // orphelin. AST.md est un DÉRIVÉ de LANGUAGE.md : c'est donc le TYPE qui est en retard,
          // pas la prose. Le sac est porté tel quel, et l'écart est remonté à Romain.
          entrees.push(parseRuntimeQualifier());
          continue;
        }
        break;   // ni code, ni valeur : le bloc est fini
      }
      return { type: 'InitDirective', entrees, line: tok.line };
    }

    if (name === 'actor') {
      const actorName = expect(T.IDENT).value;
      const properties = {};
      const soundAssignments = [];
      // Adressage de sortie : UNE seule forme d'adresse partout (KAI-9, décision
      // 2026-06-26 / GAP#1). Le type de runtime est `out.<midi|osc|...>` et les
      // DÉTAILS d'adresse (canal/device/port) sont ses PARAMS, iso-MIDI :
      //   out.midi(ch:3)              out.osc(device:reaper, ch:7)
      // (Remplace l'ancien champ séparé `ActorDirective.binding` OSC-L1, supprimé : les
      //  détails OSC vivaient dans un tiroir parallèle au lieu de out.params.)

      // Helper: parser les params d'une sortie `(ch:3, vel:100)` / `(device:reaper, ch:7)`
      const parseRefParams = () => {
        expect(T.LPAREN);
        const params = {};
        while (!at(T.RPAREN) && !atEnd()) {
          // La forme longue s'écrit sur plusieurs lignes, parenthèse ouvrante et fermante
          // (décision Romain, 2026-08-15) — ici comme dans tout autre sac. Réparer le seul
          // endroit où le refus s'est montré laisserait la même faute vivre à côté.
          while (at(T.NEWLINE) || at(T.COMMENT)) advance();
          if (at(T.RPAREN) || atEnd()) break;
          const paramKey = expect(T.IDENT).value;
          expect(T.COLON);
          // ⚠️ LE TIRET PASSE DANS UNE VALEUR — partout ailleurs dans le langage, et il ne passait
          // pas ICI. `(sound:bell-short)` compile, `mon-motif -> C4` compile ; seul le paramètre
          // d'une clé d'acteur refusait `eval.strudel(bank:dirt-samples)`, alors que
          // `dirt-samples` est le NOM RÉEL de la banque Strudel. Romain, 2026-08-07 : « pourquoi
          // il y aurait des endroits où le tiret est accepté et pas d'autres ? pour moi il est
          // accepté. » Même famille que le sac lu différemment selon sa position, corrigée le
          // même jour : une valeur se lit JUSQU'À sa virgule ou sa parenthèse fermante, pas
          // jeton par jeton.
          let paramVal;
          if (at(T.INT) || at(T.FLOAT)) {
            paramVal = Number(advance().value);
          } else {
            let brut = '';
            while (!atEnd() && !at(T.COMMA) && !at(T.RPAREN) && !at(T.NEWLINE)) {
              brut += advance().value;
            }
            if (brut === '') throw new ParseError(`valeur attendue après '${paramKey}:'`, current());
            paramVal = brut;
          }
          params[paramKey] = paramVal;
          if (at(T.COMMA)) advance();
        }
        expect(T.RPAREN);
        return params;
      };

      // Helper : enregistre une référence d'entité dans `properties`
      // (alphabet, tuning, out, sound, eval). `out` (ex-`transport`) alimente TOUJOURS le champ
      // interne `properties.transport`/`TransportRef` — seul le mot ÉCRIT par l'auteur a changé.
      const setEntityRef = (key, value, params /* | null */) => {
        if (key === 'out') {
          properties.transport = { type: 'TransportRef', key: value, params: params || {} };
        } else if (key === 'sound') {
          // sound.X dans @actor X = sucre pour *:sound.X (cf. EBNF v0.8 ligne 104).
          // On enregistre la référence sur properties.sound (pour l'actorResolver)
          // ET on émet une SoundAssignment scope=actor subject=*.
          properties.sound = value;
          soundAssignments.push({
            type: 'SoundAssignment',
            scope: 'actor', actor: actorName,
            subject: '*',
            target: { kind: 'named-ref', name: value },
            line: tok.line,
          });
        } else {
          // alphabet, tuning, eval — référence simple
          properties[key] = value;
          // Valeurs d'entité (SCENE_VALUES, hub [293]) : les params collés à une
          // référence d'entité NON-`out` (ex. `tuning.western_just(diapason:432)`)
          // sont CAPTÉS ici (avant : jetés en silence) et pliés à l'émission BPx
          // (bpxAst.applySceneValues). Additif — l'encodeur BP3 les ignore. La
          // sortie garde son canal propre (params = ADRESSE, concept distinct).
          if (params) (properties.entityParams || (properties.entityParams = {}))[key] = params;
        }
      };

      // Boucle de body : actor_prop | sound_assignment | NEWLINE
      while (!atEnd()) {
        // Sauter les NEWLINEs / commentaires : autorisés en v0.8 multi-ligne
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();

        // Affectation `*:sound.X` (défaut acteur)
        if (at(T.STAR) && peek(1).type === T.COLON) {
          advance(); // *
          advance(); // :
          const target = parseSoundAssignmentTarget();
          soundAssignments.push({
            type: 'SoundAssignment',
            scope: 'actor', actor: actorName,
            subject: '*',
            target,
            line: tok.line,
          });
          continue;
        }

        // LAN-8 (canon graphie bindings d'acteur — décision hub 2026-06-26 + invocation
        // 2026-07-13) : l'alphabet SUR LA LIGNE D'ACTEUR s'écrit `alphabet.<nom>` — le `.`
        // APPELLE le composant. C'est le SUCRE FACTORY legacy (fichier `alphabet`, entrée
        // <nom>) : canal legacy, `properties.alphabet` résolu au compile (note attribution
        // inchangée). Les provenances `factory.`/`mine.` NE se posent PAS sur la ligne
        // d'acteur : une hauteur perso est un libRef de SCÈNE + un acteur transport-seul
        // (décision 2026-07-13 §Raccord sortie). On les laisse donc au parseur de directives
        // (on ROMPT ici) → `mine.…` devient une directive de scène, exactement le modèle §71.
        if (at(T.AT) && peek(1).type === T.IDENT && peek(1).value === 'alphabet'
            && peek(2).type === T.PERIOD && !peek(2).spaceBefore) {
          advance(); // @
          advance(); // alphabet
          advance(); // .
          properties.alphabet = expect(T.IDENT).value;
          continue;
        }

        // ⛔ UNE LIGNE NON INDENTEE FERME LE BLOC D ACTEUR — c est l arobase qui le faisait.
        // Avant, `@chromashift:-24` apres un acteur commençait par un jeton AT, donc la garde
        // `!at(T.IDENT)` sortait de la boucle. Sans elle, `chromashift` est un IDENT comme une
        // cle d acteur : le bloc l avale, puis casse sur sa valeur negative — « Expected IDENT,
        // got REST ». Le bloc se borne donc comme celui de `def` : par l INDENTATION.
        if (at(T.IDENT) && current().col === 1 && current().line > tok.line) break;
        if (!at(T.IDENT)) break;

        const key = current().value;
        const next = peek(1).type;

        // ─── PIERRE TOMBALE — `transport` n'existe plus sur un acteur (Romain, 2026-08-04) ───
        // Le mot est SORTI du langage : `transport` n'est plus dans `schema.actorKeys`, donc
        // sans ce garde il tomberait en silence hors de la boucle (traité comme début de règle)
        // au lieu de crier. `out` porte désormais la direction de sortie.
        if (key === 'transport' && (next === T.PERIOD || next === T.COLON) && !peek(1).spaceBefore) {
          throw new ParseError(
            `acteur '${actorName}' : cette clé n'existe pas. La direction de sortie s'écrit `
            + `'out.<canal>' — par exemple 'out.audio' ou 'out.midi(ch:3)'.`,
            current(),
          );
        }

        // Les CINQ clés d'entité — `alphabet.X`, `tuning.X`, `octaves.X`, `out.X[(…)]`, `eval.X`.
        if (next === T.PERIOD && !peek(1).spaceBefore) {
          // ⛔ LISTE BLANCHE — EST REFUSÉ TOUT CE QUI N'EST PAS ACCEPTÉ (Romain, 2026-08-06).
          // Une liste noire de clés périmées ne ferme que ce qu'on a pensé à y mettre ; la
          // prochaine faute de frappe passe. Ici, une clé qui n'est pas dans `schema.actorKeys`
          // REFUSE, quelle qu'elle soit — et le message nomme les cinq qui existent.
          //
          // ⚠️ UNE SEULE CHOSE DOIT ÉCHAPPER À CE REFUS : le début d'une RÈGLE. Un membre gauche
          // peut porter un terminal qualifié par son acteur (`sitar1.sa -> …`), qui a la même
          // forme qu'une clé. On les distingue par la FLÈCHE, sur la même ligne : une règle en a
          // une, une clé d'acteur jamais. Mesuré avant d'écrire : aucune scène de l'écosystème
          // n'écrit aujourd'hui une tête de règle pointée — le cas est donc théorique, mais le
          // langage l'autorise et un refus qui l'attraperait serait un faux positif silencieux.
          if (!actorKeysData().valides.has(key)) {
            let k = 0, estRegle = false;
            while (peek(k) && peek(k).type !== T.NEWLINE && peek(k).type !== T.EOF) {
              const t = peek(k).type;
              if (t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI) { estRegle = true; break; }
              k++;
            }
            if (estRegle) break;   // c'est une règle, pas une clé : l'acteur est fini
            const perimee = actorKeysData().perimees.has(key);
            const ou = key === 'voice'
              ? ` — une voix s'attache au TERMINAL, pas à l'acteur`
              : key === 'sound' || key === 'sounds'
                ? ` — un prototype d'objet sonore vit en librairie, il ne se pose pas sur l'acteur`
                : '';
            throw new ParseError(
              `'${key}.…' n'est pas une clé d'acteur${perimee ? ' (retirée le 2026-08-06)' : ''}${ou}. `
              + `Les clés d'un acteur sont : ${[...actorKeysData().valides].join(', ')}`,
              current());
          }
          advance();           // consume key IDENT
          advance();           // consume PERIOD
          const value = expect(T.IDENT).value;
          let params = null;
          if (at(T.LPAREN) && !current().spaceBefore) params = parseRefParams();
          setEntityRef(key, value, params);
          continue;
        }

        if (next === T.COLON && !peek(1).spaceBefore) {
          // Affectation : `Sa:sound.X` ou `Sa:{ ... }`. Détection : le 3e token
          // est IDENT "sound" PERIOD IDENT (affectation), ou LBRACE (inline).
          // Ici `:` AFFECTE une valeur à un SUJET (une note) — forme légitime, conservée.
          const t3 = peek(2);
          const t4 = peek(3);
          const isSubjectSoundAssign =
              (t3.type === T.IDENT && t3.value === 'sound' &&
               t4.type === T.PERIOD)
            || (t3.type === T.LBRACE);

          if (isSubjectSoundAssign) {
            // C'est `Sa:sound.X` ou `Sa:{...}` → SoundAssignment
            const subject = advance().value; // Sa
            advance(); // :
            const target = parseSoundAssignmentTarget();
            soundAssignments.push({
              type: 'SoundAssignment',
              scope: 'actor', actor: actorName,
              subject,
              target,
              line: tok.line,
            });
            continue;
          }

          // CUTOVER graphie (Romain GO 2026-07-14, tour [411] ; décision hub 2026-06-26) :
          // une référence d'ENTITÉ (composant : alphabet, tuning, octaves, out, sound,
          // eval) se NOMME avec `.` — `.` APPELLE le composant. Le `:` n'affecte QUE des
          // valeurs (SCENE_VALUES, `sujet:sound.X`). L'ancienne forme v0.7 `alphabet:X` /
          // `out:X(...)` est REJETÉE (fail-loud) — plus AUCUNE rétrocompat, migration
          // totale (non-négociable Romain). Une sortie prend des params (canal/device) →
          // c'est un composant, pas une valeur : `out.midi(ch:3)`.
          if (actorKeysData().toutes.has(key)) {
            const canon = key === 'sounds' ? 'sound' : key;
            throw new ParseError(
              `'${key}:…' refusé — ':' n'affecte pas de valeur à un composant. `
              + `Écris '${canon}.<nom>'`
              + (key === 'out' ? ' avec ses params entre () — ex. out.midi(ch:3)' : '')
              + ` (règle : '.' APPELLE le composant, ':' AFFECTE une valeur).`,
              current(),
            );
          }

          // forme non-entité `sujet:valeur` (fallback historique, non-composant)
          advance();   // key
          advance();   // :
          if (at(T.IDENT)) {
            const value = advance().value;
            let params = null;
            if (at(T.LPAREN) && !current().spaceBefore) params = parseRefParams();
            // Renommage : v0.7 `sounds:` → propriété canonique `sound`
            const canonicalKey = key === 'sounds' ? 'sound' : key;
            setEntityRef(canonicalKey, value, params);
            continue;
          }
          if (at(T.INT)) { properties[key] = Number(advance().value); continue; }
          if (at(T.FLOAT)) { properties[key] = Number(advance().value); continue; }
          break;
        }

        // Sortie : token inconnu (probable début de règle)
        break;
      }

      // ENFORCEMENT modèle producteur/canal (décision Romain 2026-07-14 ; chantier hub [419]).
      // Source : hub/decisions/2026-07-14-modele-producteur-canal-eval-transport.md §Le modèle ;
      // docs/spec/EBNF.md:185-188 ; docs/spec/AST.md:230-236. Le formalisme ENFORCE le canon
      // (filet mécanique anti-régression) — sans ça le corpus dérive en silence (~45 scènes eval
      // portaient une sortie morte). Deux fail-loud au niveau du frontal (les deux voies compilent
      // via parse()) :
      //   a. un producteur `eval.<X>` sort en NATIF → il ne porte PAS de sortie routée.
      //   b. `out.video` / `out.visual` n'existent plus (axe visuel SUPPRIMÉ, pas renommé).
      //
      // ⚠️ RECLASSÉ (étape 3, mise en conformité des librairies) : j'avais d'abord retiré (b) comme
      // hardcode redondant avec la LISTE POSITIVE FERMÉE `outChannels()` plus bas — video/visual
      // n'y figurent déjà pas, donc le refus générique suffit à REFUSER la forme. Mais
      // `test/test_eval_transport_reject.js:47,52` exige le mot 'SUPPRIMÉ' dans le message, que le
      // refus générique ('n'est pas une sortie… liste FERMÉE') ne porte pas — un test VIVANT, pas
      // une intuition. C'est le MÊME contrat que les autres tombstones du fichier (`mm`, `scene`,
      // `routing`, `library`, plus bas) : chacun REFUSE un mot qu'un mécanisme générique refuserait
      // de toute façon (plus vaguement), mais porte SA propre raison datée, nommément testée. video/
      // visual est de cette famille — case B, pas un contrôle à faire lire par une librairie.
      if (properties.eval && properties.transport) {
        throw new ParseError(
          `acteur '${actorName}' : un producteur 'eval.${properties.eval}' sort en natif — `
          + `pas de 'out' (il produit et sort par ses propres moyens ; on ne route pas sa `
          + `sortie native). Retire le 'out' de cet acteur.`,
          tok,
        );
      }
      if (properties.transport && (properties.transport.key === 'video' || properties.transport.key === 'visual')) {
        throw new ParseError(
          `acteur '${actorName}' : 'out.${properties.transport.key}' n'existe pas — le canal `
          + `visuel a été SUPPRIMÉ (les visuels embarqués sortent en natif sur leur canvas). `
          + `Canal de sortie = audio/midi/osc uniquement.`,
          tok,
        );
      }
      // Noms de canal PÉRIMÉS (browser/webaudio — modèle profils d'environnement supprimé
      // 2026-07-16) : REJET fail-loud, PAS de normalisation (Romain : on supprime).
      if (properties.transport && deprecatedTransports().has(properties.transport.key)) {
        throw new ParseError(
          `acteur '${actorName}' : 'out.${properties.transport.key}' est un canal PÉRIMÉ `
          + `(modèle profils d'environnement abandonné 2026-07-16). Écris 'out.audio' `
          + `(canal canonique : audio/midi/osc).`,
          tok,
        );
      }
      // LISTE POSITIVE FERMÉE de sortie (décision Romain 2026-08-04, catalogue unifié
      // `lib/core.json` schema.channels) : un canal qui ne porte pas la direction `out` est
      // REFUSÉ, et le refus NOMME la direction — ex. 'out.keyboard' répond « keyboard n'est
      // pas une sortie » (keyboard ne porte que l'entrée). Ferme le trou hérité de l'ancien
      // `transport.<X>` explicite, qui acceptait tout IDENT libre côté @actor (device @devices,
      // résolu aval) : la fusion des deux catalogues applique désormais la MÊME liste fermée
      // aux deux formes (@actor explicite ET raccord `alphabet.X:<sortie>` implicite).
      if (properties.transport && !outChannels().has(properties.transport.key)) {
        throw new ParseError(
          `acteur '${actorName}' : '${properties.transport.key}' n'est pas une sortie — les `
          + `canaux de sortie sont ${[...outChannels()].join(', ')}. La liste est FERMÉE.`,
          tok,
        );
      }
      // DIRECTION ≠ ÉCRITURE (décision Romain 2026-08-04). Un canal peut porter la sortie
      // (vérifié ci-dessus) et rester REFUSÉ à l'écriture : c'est le cas de 'text', routé comme
      // les autres sorties mais sans point d'écriture en scène. Le refus NOMME la vraie raison —
      // jamais « n'est pas une sortie », qui serait FAUX ici (`writableChannels`, lib/core.json
      // `schema.channels.<canal>.writable`).
      if (properties.transport && outChannels().has(properties.transport.key)
          && !writableChannels().has(properties.transport.key)) {
        throw new ParseError(
          `acteur '${actorName}' : 'out.${properties.transport.key}' est refusé — ce canal est `
          + `une DESTINATION de l'architecture, routée comme les autres sorties, mais son `
          + `ÉCRITURE dans une scène attend encore son appareil dédié.`,
          tok,
        );
      }
      // LANG-SONS-2 ([438], spec §2-§3) : `voice.<nom>` doit référencer une voix de lib/voices
      // (formes valides : audio = backtick typé) ; le binding alphabet→voix de l'alphabet lié
      // est validé au même point. La hauteur est STRUCTURELLE (alphabet+tuning) : une voix
      // sans tuning est LÉGITIME (percussion) — aucun couplage voice↔tuning n'est vérifié ici.
      if (properties.voice) assertVoiceRef(properties.voice, `acteur '${actorName}'`, tok);
      if (properties.alphabet) assertAlphabetVoices(properties.alphabet, tok);

      // Forme CANONIQUE v0.8 (conformité AST_SPEC §2.1, décision architecte 2026-06-17) :
      // `references: ActorReference[]` = ce que le dispatcher lit (UNE seule forme, comme .gr).
      // `properties` reste pour le pipeline interne BPScript (actorResolver/encodeur) ; BPx/.gr
      // consomment `references`. Mapping lossless (category/name/params).
      const references = [];
      const addRef = (category, name, params) => {
        if (name == null) return;
        const r = { type: 'ActorReference', category, name, line: tok.line };
        if (params && Object.keys(params).length > 0) r.params = params;
        references.push(r);
      };
      addRef('alphabet', properties.alphabet);
      addRef('tuning', properties.tuning);
      addRef('octaves', properties.octaves);
      addRef('sound', properties.sound);
      addRef('voice', properties.voice);
      if (properties.transport) addRef('transport', properties.transport.key, properties.transport.params);
      addRef('eval', properties.eval);

      return {
        type: 'ActorDirective',
        name: actorName,
        properties,
        references,
        soundAssignments: soundAssignments.length > 0 ? soundAssignments : null,
        line: tok.line,
      };
    }

    // `sound:<X>` — REFUS, comme pour tout axe à catalogue. Ce cas doit être traité ICI, AVANT la
    // section déclarative : `sound` est à la fois un axe-composant et un mot de SECTION, et le
    // chemin de la section happait le `:` sans passer par la garde universelle plus bas. Résultat
    // mesuré : `sound:tabla_perc` sortait un « ligne non reconnue » générique là où `alphabet:X`
    // nomme la faute et donne la réécriture. Un refus qui ne nomme pas la cause vaut à peine mieux
    // qu'un silence — c'est la leçon de la journée, appliquée à ma propre addition.
    if (name === 'sound' && !subkey && at(T.COLON) && peek(1).type === T.IDENT
        && (describeVocabulary().components.sound || []).includes(peek(1).value)) {
      throw new ParseError(
        `'sound:<X>' refusé — ':' n'affecte pas de valeur à un composant. Écris 'sound.<nom>' `
        + `(règle : ':' affecte, '.' appelle).`,
        tok);
    }

    // @sound [.libname[:variant]] [{ ... }|name { ... }]+ — bloc déclaratif (v0.8)
    if (name === 'sound') {
      // À ce point, `subkey` a déjà absorbé `.libname` si présent.
      // Variante éventuelle après : `sound.libname:variant`.
      let libVariant = null;
      if (subkey && at(T.COLON)) {
        advance();
        libVariant = expect(T.IDENT).value;
      }
      return parseSoundSection(tok.line, subkey, libVariant);
    }

    // ⚠️ `duration:16b`/`duration:8s` (forme dédiée, unité b/s) VIVAIT ICI, EN DUR
    // (`name === 'duration'`) — RETIRÉE (étape 3, règle 5). `duration` N'EST PLUS UNE DIRECTIVE
    // DE SCÈNE depuis le 2026-08-04 (Romain, hub/decisions/2026-08-04-la-duree-de-scene-est-
    // supprimee.md) et n'est déclarée par AUCUNE librairie du registre : construire ce nœud pour
    // un mot qu'aucune donnée ne reconnaît ne servait plus qu'à parser une forme que la validation
    // en aval REFUSE de toute façon (`bpxAst.validateReferences` : « valeur 'duration:…' inconnue
    // — non déclarée par une librairie chargée »). Mesuré avant retrait : `duration:16` reste
    // refusé, avec la même conclusion, sans cette branche — cf.
    // test/une_forme_supprimee_ne_revient_pas_par_une_librairie.mjs.
    //
    // @timepatterns: t1=1/1, t2=3/2, t3=4/3, t4=1/2
    if (name === 'timepatterns' && at(T.COLON)) {
      advance();
      const patterns = [];
      while (at(T.IDENT)) {
        const patName = advance().value;
        expect(T.EQUALS);
        const num = expect(T.INT).value;
        expect(T.SLASH);
        const denom = expect(T.INT).value;
        patterns.push({ name: patName, ratio: `${num}/${denom}` });
        if (at(T.COMMA)) advance();
      }
      return { type: 'Directive', name, subkey, runtime: null, value: null, aliases: null,
               modifiers: null, timePatterns: patterns, line: tok.line };
    }

    // CUTOVER graphie UNIVERSEL (Romain 2026-07-14, tour [412]) : un axe-COMPOSANT (opérande =
    // nom d'entrée de catalogue : alphabet/tuning/octaves/scale) se NOMME avec `.` — `axe.<nom>`.
    // Le `:` n'affecte QUE des valeurs (@tempo:120, @diapason:N…). On REJETTE `axe:<X>` pour TOUT
    // axe à catalogue, sans trou. Le garde `!subkey` préserve `alphabet.western:midi` (subkey =
    // composant résolu, puis `:` affecte une valeur). Pour tuning, `diapason:<N>` porte la freq.
    if (catalogAxisKeys().has(name) && !subkey && at(T.COLON)) {
      const hint = name === 'tuning'
        ? " ; fréquence de référence → 'diapason:<N>'"
        : '';
      throw new ParseError(
        `'${name}:<X>' refusé — ':' n'affecte pas de valeur à un composant. Écris '${name}.<nom>' `
        + `(règle : ':' affecte, '.' appelle)${hint}.`,
        current(),
      );
    }

    if (at(T.COLON)) {
      advance();
      ({ value, runtime } = parseDirectiveColonValue(name));
    }

    // 'alphabet.X:<sortie>' = sortie de l'acteur implicite (canon, décision 2026-07-05 ;
    // applyDefaultActor lit directive.runtime). LISTE POSITIVE FERMÉE (addendum ratifié Romain
    // 2026-07-16, « on n'autorise que les 3 qu'on connaît ») : suffixe ∉ {audio, midi, osc} →
    // REJET fail-loud. Couvre les périmés browser/webaudio (hint dédié), l'ancien sucre ':sc'
    // (= transport+eval sc, ABOLI par l'addendum), :video, :foo…
    if (name === 'alphabet' && subkey && runtime && !outChannels().has(runtime)) {
      const hint = deprecatedTransports().has(runtime)
        ? ` '${runtime}' est un canal PÉRIMÉ (modèle profils d'environnement abandonné 2026-07-16) — écris 'alphabet.${subkey}:audio'.`
        : runtime === 'sc'
          ? ` L'ancien sucre ':sc' (= transport+eval sc) est ABOLI — un eval se déclare sur un actor ('eval.<X>') ; le raccord de l'acteur implicite ne nomme qu'un canal.`
          : '';
      throw new ParseError(
        `'alphabet.${subkey}:${runtime}' refusé — le raccord de sortie de l'acteur implicite `
        + `n'accepte que {audio, midi, osc} (liste positive fermée, décision 2026-07-16).${hint}`,
        current(),
      );
    }
    // DIRECTION ≠ ÉCRITURE, même règle qu'au raccord explicite `actor … out.<canal>` ci-dessus :
    // un canal peut être une sortie du catalogue (vérifié juste au-dessus) et rester refusé à
    // l'écriture ('text', routé mais sans point d'écriture en scène). Le refus NOMME la vraie
    // raison, jamais « n'est pas une sortie ».
    if (name === 'alphabet' && subkey && runtime && outChannels().has(runtime)
        && !writableChannels().has(runtime)) {
      throw new ParseError(
        `'alphabet.${subkey}:${runtime}' refusé — ce canal est une DESTINATION de l'architecture, `
        + `routée comme les autres sorties, mais son ÉCRITURE dans une scène attend encore son `
        + `appareil dédié.`,
        current(),
      );
    }
    // LANG-SONS-2 ([438]) : liaison d'alphabet à la scène (acteur implicite) → même validation
    // du binding alphabet→voix qu'à la ligne d'acteur (spec §7, champ `voices` de l'alphabet).
    if (name === 'alphabet' && subkey) assertAlphabetVoices(subkey, current());

    // Mode modifiers: mode:rnd(destru, smooth, tempo:60)
    //
    // ⛔ UN MODIFICATEUR VIENT D'UNE LIBRAIRIE, ET SA PORTÉE DOIT DIRE `subgrammar`.
    //
    // ⚠️ CE BLOC N'A RIEN VALIDÉ JUSQU'AU 2026-08-10 : `mode:ord(zorglub)` passait et entrait
    // dans l'arbre en `{name:"zorglub"}`. C'est la règle 1 de Romain qui était en défaut ici —
    // « tous les mots acceptés par le parseur viennent des librairies invoquées dans la scène » —
    // et le trou s'est découvert par un TÉMOIN D'INSTRUMENT : j'avais lu « `mode:ord(destru)`
    // passe » comme une preuve que la portée `subgrammar` fonctionnait, alors que la graphie
    // acceptait n'importe quel mot. La preuve était creuse, pas le sujet.
    //
    // LA PORTÉE FAIT FOI, PAS LA SECTION : un mot est admis ici s'il déclare `subgrammar` dans
    // SA librairie, où qu'il soit rangé. `tempo` est le contre-exemple qui compte — il déclare
    // `["scene","flow"]` et n'a donc rien à faire sur un mode, alors que le portage BP3 l'y
    // écrivait avant sa correction du même jour.
    let modifiers = null;
    if (name === 'mode' && at(T.LPAREN)) {
      advance();
      modifiers = [];
      while (!at(T.RPAREN) && !atEnd()) {
        const tokModName = current();
        const modName = expect(T.IDENT).value;
        const portees = porteesDeclarees(modName);
        if (!portees) {
          throw new ParseError(
            `'mode:${runtime || '…'}(${modName})' : '${modName}' n'est déclaré par aucune `
            + `librairie chargée. Un modificateur de sous-grammaire est un mot de librairie comme `
            + `un autre — invoquer celle qui le porte, ou retirer le mot.`, tokModName);
        }
        if (!portees.includes('subgrammar')) {
          throw new ParseError(
            `'${modName}' ne se pose pas sur une sous-grammaire — sa portée déclarée est `
            + `${JSON.stringify(portees)}. ${portees.includes('scene')
              // ⛔ LA RÉÉCRITURE DONNE LA FORME VIVANTE, et elle a survécu à DEUX retraits sous
              // cette seule ligne : l'arobase, sortie du langage le 2026-08-17, et le nom `tempo`
              // écrit EN DUR pour lui coller ':<N>' — devenu inatteignable le 2026-08-18, quand le
              // métronome a gagné la portée `subgrammar`. Un refus qui enseigne une forme morte
              // coûte plus que pas de refus du tout.
              ? `Il s'écrit en tête de scène : '${modName}'.`
              : `Il vaut ${portees.map((p) => `'${p}'`).join(', ')}.`}`, tokModName);
        }
        let modValue = true;
        if (at(T.COLON)) {
          advance();
          if (at(T.INT)) modValue = Number(advance().value);
          else if (at(T.FLOAT)) modValue = Number(advance().value);
          else if (at(T.IDENT)) modValue = advance().value;
        }
        modifiers.push({ name: modName, value: modValue });
        if (at(T.COMMA)) advance();
      }
      expect(T.RPAREN);
    } else if (at(T.LPAREN)) {
      // Alias resolution: @western(A:La)
      advance();
      aliases = [];
      while (!at(T.RPAREN) && !atEnd()) {
        const from = expect(T.IDENT).value;
        expect(T.COLON);
        const to = expect(T.IDENT).value;
        aliases.push({ type: 'Alias', from, to });
        if (at(T.COMMA)) advance();
      }
      expect(T.RPAREN);
    }

    // v0.8 — corps de `alphabet.X` : peut contenir des `*:sound.X` et
    // `Sa:sound.X` (sound_assignment) et le binding `notes: Sa Re ga ...`.
    // EBNF Couche 1 § alphabet_section (étendu v0.8).
    // Sortie : tableau d'AlphabetSoundAssignments si présents.
    if (name === 'alphabet' && subkey) {
      const assignments = [];
      while (!atEnd()) {
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();

        // *:sound.X
        if (at(T.STAR) && peek(1).type === T.COLON) {
          const line = current().line;
          advance(); advance(); // * :
          const target = parseSoundAssignmentTarget();
          assignments.push({
            type: 'SoundAssignment',
            scope: 'alphabet', alphabet: subkey,
            subject: '*',
            target,
            line,
          });
          continue;
        }

        // IDENT:sound.X (affectation par note) — distinguer d'un terminal LHS de règle.
        // Heuristique : `IDENT:` n'est PAS une affectation sound si le 3e
        // token n'est pas `sound` ou `{`. (Une règle commence par `IDENT IDENT* ARROW`,
        // or aucun IDENT ne peut être suivi de COLON dans une LHS de règle.)
        if (at(T.IDENT) && peek(1).type === T.COLON) {
          const t3 = peek(2);
          const t4 = peek(3);
          const isSoundAssign =
              (t3.type === T.IDENT && t3.value === 'sound' && t4.type === T.PERIOD)
            || (t3.type === T.LBRACE);
          if (isSoundAssign) {
            const line = current().line;
            const subject = advance().value;
            advance(); // :
            const target = parseSoundAssignmentTarget();
            assignments.push({
              type: 'SoundAssignment',
              scope: 'alphabet', alphabet: subkey,
              subject,
              target,
              line,
            });
            continue;
          }
          // notes: Sa Re ga ma Pa dha ni — déclaration de notes (v0.8 EBNF).
          // Pas porté en ce milestone (les notes sont calculées via lib JSON) :
          // on consomme silencieusement la ligne pour ne pas casser le flow.
          if (current().value === 'notes') {
            advance(); advance(); // notes :
            while (at(T.IDENT)) advance();
            continue;
          }
        }

        break;
      }
      refuserCanalDeSortieInconnu(name, subkey, tok);
      refuserModeInvalide(name, runtime, value, tok);
      const dirNode = { type: 'Directive', name, subkey, runtime, value, aliases, modifiers,
                        ...(directiveParams ? { params: directiveParams } : {}), line: tok.line };
      if (assignments.length > 0) {
        // On retourne un nœud composite : le caller détecte AlphabetSoundAssignments
        // et l'ajoute à scene.soundAssignments tout en gardant la Directive.
        return {
          type: 'AlphabetSoundAssignments',
          directive: dirNode,
          assignments,
          line: tok.line,
        };
      }
      return dirNode;
    }

    // ⚠️ LE REJET DES @-FORMES EST TOMBÉ LE 2026-08-10 : c'est désormais la forme JUSTE. Romain :
    // « ça s'applique à toutes les directives de production ». Les quatre — seed, items (alias
    // maxitems), allitems (alias all_items), improvize — s'écrivent `clé:valeur` en tête de
    // scène, préfixe optionnel. Le refus a changé de côté : il vit sur le BLOC, dans
    // `parseProductionBlock`.

    refuserCanalDeSortieInconnu(name, subkey, tok);
    refuserModeInvalide(name, runtime, value, tok);
    return { type: 'Directive', name, subkey, runtime, value, aliases, modifiers,
             ...(directiveParams ? { params: directiveParams } : {}), line: tok.line };
  }

  // ⛔ `parseDeclaration`, `isCVModulatorBody` ET `parseCVModulator` SONT SORTIES LE 2026-08-18.
  // La première lisait `gate|trigger|cv <nom> : <runtime>` et les deux autres n'étaient appelées
  // que par elle. Les trois mots sont sortis du langage ; la déclaration de terminal s'écrit
  // désormais `<nom>:<canal>` — `lireDeclarationDeTerminal`, plus haut, qui émet le MÊME nœud
  // `Declaration`. Le code mort s'élague dans le mouvement qui le rend mort, et un lecteur sans
  // appelant en fait partie : gardé « au cas où », il fige une graphie que plus rien ne produit.
  // Le modulateur CV relève du patching, et sa forme se rouvrira avec lui, pas avant.


  /**
   * LA VALEUR POSÉE SUR LE MEMBRE D'UN COMPOSANT — `lpf.cutoff: 8000`, `saw.freq: pitch`,
   * `env.decay: 350ms`. Nombre (avec son unité collée), référence nue, ou backtick typé.
   *
   * PORTER ≠ RÉSOUDRE : la classe de la valeur — réglage, déclenchement, hauteur — se décide à
   * la résolution, en aval, sur le catalogue de ports. Ici on lit la forme et on la porte telle
   * quelle. Le refus reste NU : il ne peut pas proposer de réécriture sans en publier une, et
   * ce qui s'écrivait à cette place avec un chevron est sorti du langage le 2026-08-18.
   */
  function lireValeurDeMembre() {
    if (at(T.BACKTICK)) {
      const raw = advance().value;
      const t = tryBacktickTag(raw);
      return t ? { kind: 'backtick', tag: t.tag, code: t.code } : { kind: 'backtick', tag: null, code: raw };
    }
    if (at(T.INT)) {
      const n = Number(advance().value);
      if (at(T.IDENT) && !current().spaceBefore) return { kind: 'number', value: n, unit: advance().value };
      return { kind: 'number', value: n };
    }
    if (at(T.IDENT)) return { kind: 'ref', name: advance().value };
    throw new ParseError('valeur attendue après « : »', current());
  }

  // ============================================================
  // Macros
  // ============================================================

  function isLookaheadMacro() {
    // name ( params ) = ...
    let j = pos;
    if (tokens[j]?.type !== T.IDENT) return false;
    j++;
    if (tokens[j]?.type !== T.LPAREN) return false;
    // Skip until )
    let depth = 1;
    j++;
    while (j < tokens.length && depth > 0) {
      if (tokens[j].type === T.LPAREN) depth++;
      if (tokens[j].type === T.RPAREN) depth--;
      j++;
    }
    return tokens[j]?.type === T.EQUALS;
  }

  /**
   * Collecte tous les identifiants MENTIONNÉS dans un corps de macro : noms de
   * symboles/acteurs/tags, valeurs littérales chaîne (param passé en valeur d'arg,
   * ex. `C4(vel:x)`), et mots d'un backtick (substitution textuelle dans le code).
   * Volontairement LARGE : on veut « le param apparaît-il quelque part ? » — la
   * leniency évite de rejeter une macro valide (un faux positif casserait le langage).
   */
  function macroBodyMentions(body) {
    const names = new Set();
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { for (const el of n) walk(el); return; }
      for (const key of ['name', 'symbol', 'actor', 'tag']) {
        if (typeof n[key] === 'string') names.add(n[key]);
      }
      if (n.type === 'Literal' && typeof n.value === 'string') names.add(n.value);
      if (typeof n.code === 'string') {
        for (const w of n.code.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []) names.add(w);
      }
      for (const k in n) { if (n[k] && typeof n[k] === 'object') walk(n[k]); }
    };
    walk(body);
    return names;
  }

  /**
   * FAIL-LOUD (Romain confirmé, hub [296]) : une macro dont un paramètre déclaré
   * n'apparaît JAMAIS dans le corps est MALFORMÉE — jamais un `continue` silencieux
   * qui la transforme en note muette. Une macro est une SUBSTITUTION TEXTUELLE
   * (EBNF §macro, l.59/273 ; « les params doivent apparaître dans le rhs », cf.
   * `macro accent(x)=x(vel:120)`). Le cas vécu `wobble(Bass, browser) = \`courbe\``
   * (forme CV/signal `name(cible, transport)=courbe`) n'est PAS une macro valide :
   * sa syntaxe est en attente d'arbitrage Romain (A/B) — d'ici là, elle CRIE.
   */
  function checkMacroParamsUsed(macroName, params, body, tok) {
    if (!params || params.length === 0) return;
    const used = macroBodyMentions(body);
    const unused = params.filter((p) => !used.has(p));
    if (unused.length > 0) {
      throw new ParseError(
        `Macro '${macroName}' : paramètre(s) déclaré(s) mais absent(s) du corps : `
        + `${unused.join(', ')}. Une macro est une substitution textuelle `
        + `(EBNF §macro l.59/273) — chaque paramètre DOIT apparaître dans le corps `
        + `(ex. accent(x) = x(vel:120)). Une déclaration name(cible, transport) = courbe `
        + `(forme CV/signal) n'est pas une macro valide : syntaxe en attente d'arbitrage.`,
        tok);
    }
  }

  function parseMacro() {
    const tok = current();
    const name = expect(T.IDENT).value;
    expect(T.LPAREN);
    const params = [];
    while (!at(T.RPAREN) && !atEnd()) {
      params.push(expect(T.IDENT).value);
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    expect(T.EQUALS);
    const body = parseRhsElements();
    checkMacroParamsUsed(name, params, body, tok);
    return { type: 'Macro', name, params, body, line: tok.line };
  }

  // ============================================================
  // Backtick orphan
  // ============================================================

  /**
   * Sépare le TAG de langage (clé d'interprète) du CODE d'un backtick, SI présent.
   * Le tag = un identifiant AVANT le premier `:` (`js:`, `sc:`, `python:`…). Retourne
   * `null` si aucun tag valide (le `:` est alors dans le code, ou il n'y en a pas).
   */
  function tryBacktickTag(raw) {
    const colonIdx = raw.indexOf(':');
    const tag = colonIdx > 0 ? raw.slice(0, colonIdx).trim() : '';
    if (!/^[A-Za-z][\w+-]*$/.test(tag)) return null;
    return { tag, code: raw.slice(colonIdx + 1).trim() };
  }

  /**
   * Sépare le tag du code sur les sites SANS ACTEUR — backtick de tête de scène, définition de
   * code, courbe `cv NAME : …`. Le tag y est FACULTATIF, et rend `null` quand il est absent.
   *
   * ⛔ CE LECTEUR EXIGEAIT LE TAG, ET C'ÉTAIT UN SECOND MOTEUR DE REFUS. Le langage vient
   * désormais de la place la plus proche qui le nomme — l'acteur, la scène, puis le socle, où
   * `core` porte `js`. Un langage DÉCLARÉ est connu : la règle « jamais deviné » est satisfaite,
   * pas contournée. Le refus est SUPPRIMÉ, pas désactivé.
   *
   * ⚠️ ET LA RÉSOLUTION VIT EN AVAL, EN UN SEUL LIEU (`annotateBackticks`). Ce lecteur voit la
   * scène ligne par ligne : une ligne `eval.<moteur>` écrite APRÈS un backtick lui serait
   * invisible, et « le plus proche l'emporte » deviendrait « le plus haut dans le fichier
   * l'emporte » — que personne n'a décidé. L'aval voit la scène entière.
   */
  function splitBacktickTag(raw) {
    return tryBacktickTag(raw) || { tag: null, code: raw.trim() };
  }

  function parseBacktickOrphan() {
    const tok = current();
    const raw = expect(T.BACKTICK).value;
    const { tag, code } = splitBacktickTag(raw);
    return { type: 'BacktickOrphan', tag, code, line: tok.line };
  }

  // ============================================================
  // v0.8 — Sons : prototypes et affectations
  // ============================================================

  /**
   * Parse une liste de paires `key:value, key:value, key` (booléen nu).
   * Suppose que `{` est déjà consommé ; consomme jusqu'à `}` inclus.
   * Référence EBNF : Couche 1 § sound_section, `prop_pairs`.
   */
  function parsePropPairs() {
    const props = {};
    while (!at(T.RBRACE) && !atEnd()) {
      if (at(T.NEWLINE) || at(T.COMMENT)) { advance(); continue; }
      if (at(T.COMMA)) { advance(); continue; }
      const key = expect(T.IDENT).value;
      // Booléen nu : `{ breakTempo, contBeg }` ≡ `breakTempo:true, contBeg:true`
      if (!at(T.COLON)) {
        props[key] = true;
        continue;
      }
      advance(); // :
      // Valeur : INT, FLOAT, STRING, IDENT, ou INT/INT (ratio)
      let val;
      if (at(T.REST)) {
        // valeur négative : `transpose:-12`
        advance();
        if (at(T.INT)) val = -Number(advance().value);
        else if (at(T.FLOAT)) val = -Number(advance().value);
        else throw new ParseError('Expected number after - in prop value', current());
      } else if (at(T.INT)) {
        const num = advance().value;
        if (at(T.SLASH) && peek(1).type === T.INT) {
          advance();
          val = `${num}/${advance().value}`;
        } else {
          val = Number(num);
        }
      } else if (at(T.FLOAT)) {
        val = Number(advance().value);
      } else if (at(T.STRING)) {
        val = advance().value;
      } else if (at(T.IDENT)) {
        const id = advance().value;
        // Promotion canonique : booléens littéraux en string → booléen JS.
        if (id === 'true') val = true;
        else if (id === 'false') val = false;
        else val = id;
      } else {
        throw new ParseError('Expected value (INT/FLOAT/STRING/IDENT) in prop pair', current());
      }
      props[key] = val;
    }
    return props;
  }

  /**
   * Parse une cible d'affectation son : `sound.NAME` ou `{ props }`.
   * Référence EBNF v0.8 § sound_assignment, sound_target.
   */
  function parseSoundAssignmentTarget() {
    // Bloc inline anonyme : `Sa:{ dur:300 }`
    if (at(T.LBRACE)) {
      advance();
      const props = parsePropPairs();
      expect(T.RBRACE);
      return { kind: 'inline-props', props };
    }
    // Référence nommée : `Sa:sound.bell_short` (v0.8 canonique).
    // Rétrocompat v0.7 : on accepte aussi `Sa:NAME` nu (sucre = sound.NAME).
    const first = expect(T.IDENT).value;
    if (first === 'sound' && at(T.PERIOD)) {
      advance();
      const name = expect(T.IDENT).value;
      return { kind: 'named-ref', name };
    }
    // Cas rétrocompat : `Sa:bell_short` (forme v0.7 sans namespace explicite).
    return { kind: 'named-ref', name: first };
  }

  /**
   * Parse la section `sound` (ou `sound.libname[:variant]`).
   *
   * Forme EBNF v0.8 :
   *   sound_section = "@" "sound" [ "." IDENT [ ":" IDENT ] ] NEWLINE sound_entry+
   *   sound_entry   = anonymous_prototype | named_prototype
   *   anonymous_prototype = "{" prop_pairs "}"
   *   named_prototype     = IDENT "{" prop_pairs "}"
   *
   * À l'entrée : tous les tokens jusqu'au `sound` + subkey éventuel + variant
   * éventuel ont été consommés. On parse maintenant le bloc d'entrées qui suit.
   */
  function parseSoundSection(line, lib, libVariant) {
    const prototypes = [];

    // Si lib spécifiée : `sound.libname` charge une lib externe ; aucun
    // bloc inline obligatoire. On accepte des entrées si elles existent
    // (ex : surcharge locale après chargement).
    // Sinon : bloc inline obligatoire (sons anonymes/nommés).

    // Sauter le NEWLINE après `sound` ou `sound.lib`.
    while (at(T.NEWLINE) || at(T.COMMENT)) advance();

    // Boucle d'entrées : tant qu'on voit `{` (anonyme) ou `IDENT {` (nommé).
    while (!atEnd()) {
      // Entrée anonyme : `{ ... }`
      if (at(T.LBRACE)) {
        advance();
        const config = parsePropPairs();
        expect(T.RBRACE);
        prototypes.push({ type: 'SoundPrototype', name: null, config, line });
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        continue;
      }
      // Entrée nommée : `IDENT { ... }`
      if (at(T.IDENT) && peek(1).type === T.LBRACE) {
        const protoName = advance().value;
        advance(); // {
        const config = parsePropPairs();
        expect(T.RBRACE);
        prototypes.push({ type: 'SoundPrototype', name: protoName, config, line });
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        continue;
      }
      // Fin de bloc — token suivant n'appartient pas à @sound.
      break;
    }

    return {
      type: 'SoundSection',
      lib: lib || null,
      libVariant: libVariant || null,
      prototypes,
      line,
    };
  }

  /**
   * Parse une affectation `subject:sound_target` ou `*:sound_target`
   * dans un corps d'alphabet ou d'acteur. Retourne le nœud
   * SoundAssignmentAST sans champ `scope` (rempli par l'appelant).
   *
   * Le cas particulier `Sa:sound.X` est distingué d'un terminal `Sa` suivi
   * d'une déclaration de type — l'appelant doit faire le lookahead.
   */
  function parseSoundAssignmentLocal(line) {
    let subject;
    if (at(T.STAR)) { advance(); subject = '*'; }
    else subject = expect(T.IDENT).value;
    expect(T.COLON);
    const target = parseSoundAssignmentTarget();
    return { type: 'SoundAssignment', subject, target, line };
  }

  // ============================================================
  // Couche 2 — Subgrammars
  // ============================================================

  function parseSubgrammars(initialMode, initialModifiers) {
    const subs = [];
    let index = 1;
    let safety = 0;
    let currentMode = initialMode || null;
    let currentModifiers = initialModifiers || null;

    while (!atEnd()) {
      if (++safety > 200) throw new ParseError('Subgrammar parse loop safety limit', current());
      skipNewlines();
      if (atEnd()) break;

      // Bloc de production hors en-tête : erreur franche (la place niveau
      // règle/sous-grammaire n'est pas dans la décision 2026-06-11), plutôt
      // qu'une troncature silencieuse de la scène.
      if (atProductionBlock()) {
        throw new ParseError(`Bloc de production [@…] : autorisé en en-tête de scène uniquement`, current());
      }
      // ![@…] : réserve de composition future (re-semer PENDANT le jeu,
      // hub/principes-syntaxe.md §3) — non implémentée. Erreur franche plutôt
      // que l'absorption silencieuse de la scène.
      if (at(T.BANG) && peek(1).type === T.LBRACKET && peek(2).type === T.AT) {
        throw new ParseError(`Forme '![@…]' réservée (directive de production dans le flux) — non implémentée`, current());
      }

      // Parse @mode:X(modifiers) directive at the start of a sub-grammar block
      // Stop if template — that's a separate section after all subgrammars
      // `currentMode` ne porte QUE le @mode du bloc courant : il est remis à zéro à la fin
      // de chaque sous-grammaire (voir plus bas). On le lit ici parce que le @mode de la
      // PREMIÈRE sous-grammaire est consommé en amont, hors de la boucle @ ci-dessous.
      let blockMode = currentMode;
      let blockModifiers = currentModifiers;
      // ⛔ UNE TETE DE SOUS-GRAMMAIRE SE RECONNAIT A L ABSENCE DE FLECHE, plus a l arobase.
      // `mode:lin` pose le mode de la passe ; `S -> C4` la produit. Depuis que l arobase est
      // sortie, les deux commencent par un IDENT et seule la fleche les departage.
      while (!atEnd() && !at(T.SEPARATOR) && !at(T.NEWLINE) && ligneSansFleche()) {
        // La section template est en SINGULIER, sans alias (cf. parseScene).
        if (at(T.IDENT) && current().value === 'template') break;
        // Refus NOMMÉ de l'ex-graphie plurielle : c'est ICI qu'on la voit passer. Sans ce
        // branchement, elle tomberait dans le rejet générique des directives inconnues et
        // rendrait « ligne non reconnue » — un message qui ressemble à une coquille et n'aide
        // personne à migrer.
        if (at(T.IDENT) && current().value === 'templates') {
          throw new ParseError(`'templates' (pluriel, v0.7) n'existe plus — écrire 'template' (singulier)`, current());
        }
        const dirTok = current();
        // Le NOM se lit sur le jeton, pas sur le nœud produit : certaines directives (`var`…)
        // rendent un nœud sans champ `name`, et le message annonçait alors « @undefined » — un
        // refus qui ne nomme pas la faute vaut à peine mieux qu'un silence.
        const dirNom = current() && current().value ? String(current().value) : '?';
        const dir = parseDirective();
        if (dir.name === 'mode' && dir.runtime) {
          blockMode = dir.runtime;  // mode:rnd → runtime='rnd'
          currentMode = blockMode;  // portée du bloc courant seulement (pas d'héritage)
          blockModifiers = dir.modifiers || null;
          currentModifiers = blockModifiers;
        } else if (dir.name !== 'mode') {
          // ⚠️ ELLES ÉTAIENT PARSÉES PUIS JETÉES — SANS UN MOT (Romain, 2026-07-29).
          //
          // Ce `while` lisait toute directive posée entre deux blocs de règles et ne gardait que
          // `mode`. Les autres étaient construites, puis abandonnées ici même : l'auteur écrivait
          // `var v` ou `alphabet.sargam`, la scène compilait sans une erreur, et RIEN n'avait été
          // déclaré. C'est le mode d'échec de la flèche du moteur historique, en pire — là au moins
          // ça ne compilait pas.
          //
          // MESURÉ, ET C'EST L'ESPACE QUI COMPTE, PAS LA FORME DU TICKET : le signalement portait
          // sur `var`. Le balayage des directives réservées en trouve VINGT-QUATRE dans le même
          // cas — alphabet, tuning, octaves, transport, eval, actor, controls, var, in, alias, mm,
          // tempo, duration, meter, quantization, qclock, transpose, diapason, transcription,
          // settings, filter, modulation, ins, test_alphabets. Garder la seule forme signalée aurait
          // laissé vivre les vingt-trois autres.
          //
          // ⚠️ ET `mode` RESTE LÉGITIME ICI, ce n'est pas une exception de complaisance : il porte
          // le mode de la sous-grammaire QUI SUIT, et 67 scènes du corpus sur 263 en vivent. Un
          // refus en bloc les aurait toutes cassées — la même faute que le témoin qui aurait refusé
          // 120 scènes sur 333 le 2026-07-28. Le corpus a été mesuré AVANT d'écrire ce refus : une
          // seule scène y perd quelque chose (`bells.bps`, trois directives aujourd'hui muettes).
          // ⛔ ET CE REFUS NE VAUT PAS POUR UN CONTRÔLE DE PORTÉE. Atlas a mesuré le 2026-08-19 que
          // `destru` recevait ici « remonter cette ligne avant la première règle de la scène » —
          // c'est-à-dire EN TÊTE DE SCÈNE, où un AUTRE refus le renvoie en tête de sous-grammaire.
          // Les deux messages s'envoyaient l'un vers l'autre, et un lecteur qui les suit tourne en
          // rond. La cause : ce refus traite toute ligne comme une DÉCLARATION mal placée, alors
          // qu'un contrôle de portée n'est pas une déclaration — sa donnée dit où il vit, et
          // `scene` n'en fait pas partie.
          //
          // ⚠️ LA BORNE VIENT DE LA DONNÉE, pas d'une liste : un mot dont les portées déclarées
          // EXCLUENT `scene` ne peut pas être « remonté avant la première règle ». On lui rend sa
          // propre cause, avec la forme qui l'écrit.
          // ⚠️ ET LA BORNE A UNE SECONDE MOITIÉ, PAYÉE DANS LA MINUTE : `scale` a des portées qui
          // excluent `scene` — c'est un contrôle de flux — ET c'est un AXE DE CATALOGUE, donc
          // `scale.raga_bhairav` se déclare bien en tête. Ma première écriture lui donnait le
          // message du réglage et lui retirait le sien. Un mot peut être les deux ; ce qui décide
          // est qu'il soit DÉCLARABLE, et la donnée le dit par `catalogAxes`.
          const axes = new Set((loadLib('core')?.schema?.catalogAxes) || []);
          const porteesDuMot = porteesDeclarees(dirNom);
          if (porteesDuMot && !porteesDuMot.includes('scene') && !axes.has(dirNom)) {
            const PLACE = { subgrammar: 'en tête de sous-grammaire, dans la parenthèse du mode '
                            + '(`mode:<mode>(<réglage>)`)', rule: 'sur une règle', group: 'sur un groupe',
                            symbol: 'sur un élément', flow: 'dans le flux' };
            const ou = porteesDuMot.map((x) => PLACE[x] ?? x);
            throw new ParseError(
              `'${dirNom}' n'est pas une déclaration : c'est un réglage, et il ne s'écrit pas seul `
              + `sur une ligne. Il vaut ${ou.length === 1 ? ou[0] : ou.slice(0, -1).join(', ') + ' ou ' + ou[ou.length - 1]}.`,
              dirTok,
            );
          }
          throw new ParseError(
            `'${dirNom}' est écrit APRÈS des règles, et à cette place il ne déclare RIEN : `
            + `il était accepté puis jeté en silence. Les déclarations précèdent les règles — `
            + `remonter cette ligne avant la première règle de la scène. `
            + `(Seul 'mode' se place ici : il gouverne la sous-grammaire qui suit.)`,
            dirTok,
          );
        }
        skipNewlines();
      }

      const rules = [];
      let ruleSafety = 0;
      while (!atEnd() && !at(T.SEPARATOR)) {
        if (++ruleSafety > 200) throw new ParseError('Rule parse loop safety limit', current());
        skipNewlines();
        if (atEnd() || at(T.SEPARATOR)) break;
        // ⛔ LA SECTION `template` BORNE LE BLOC DE RÈGLES, et c'est l'arobase qui le faisait :
        // `@template` ne pouvait pas être une tête de règle, `template` nu le peut. Sans cette
        // sortie, la section est happée comme une règle et la scène tombe sur « Expected arrow ».
        if (at(T.IDENT) && current().value === 'template') break;
        // ⛔ UNE DÉCLARATION POSÉE ENTRE DEUX RÈGLES REND LA MAIN À LA BOUCLE DE DIRECTIVES, qui
        // seule porte le refus NOMMÉ (« … est écrit APRÈS des règles »). C'est l'arobase qui
        // faisait cette sortie : `@alphabet` n'ouvrait pas une règle, `alphabet.western` l'ouvre,
        // et les vingt-quatre directives tombaient toutes sur « Expected arrow, got PERIOD ».
        // La flèche est le seul départage restant, comme en tête de sous-grammaire.
        if (rules.length && ligneSansFleche()) break;
        if (isRuleStart()) {
          rules.push(parseRule());
        } else {
          // Seuls EOF, `-----` et `@…` terminent légitimement un bloc de règles. Tout
          // autre jeton ici serait une TRONCATURE SILENCIEUSE de la scène (la boucle
          // sortait, `rules` restait vide, la grammaire disparaissait sans une erreur).
          // Erreur franche — même parti que le bloc de production `[@…]` ci-dessus.
          if (!atEnd() && !at(T.SEPARATOR) && !at(T.AT)) {
            throw new ParseError(`ligne non reconnue au niveau des règles : attendu une règle, 'directive', '-----' ou la fin de la scène`, current());
          }
          break;
        }
        skipNewlines();
      }

      if (rules.length > 0) {
        subs.push({ type: 'Subgrammar', index: index++, rules, mode: blockMode, modifiers: blockModifiers });
      } else if (at(T.SEPARATOR)) {
        // BLOC VIDE, MAIS LA SCÈNE CONTINUE APRÈS LE `-----`.
        //
        // Ici se trouvait un `break` qui arrêtait TOUT le parcours des sous-grammaires. Une
        // scène commençant par un séparateur (directives, `-----`, puis les règles) perdait
        // donc l'INTÉGRALITÉ de ses règles, sans une erreur ni un avertissement : l'AST
        // sortait avec zéro sous-grammaire et l'encodeur rendait un en-tête nu.
        // Mesuré sur Mozartexpression : 373 lignes en entrée, 0 erreur, 47 octets en sortie.
        //
        // Un bloc vide ne porte rien — le sauter ne perd rien. Ce qui était inacceptable,
        // c'est qu'il emporte tout ce qui le suit. On avance donc d'un séparateur et on
        // continue ; le `break` ne subsiste que pour la vraie fin de scène, ci-dessous.
        advance();
        skipNewlines();
        // ⛔ LE MODE SURVIT À UN BLOC VIDE, et c'est la moitié qui manquait au non-héritage :
        // un bloc sans règle ne CONSOMME rien, donc le `mode` qu'il porte gouverne la
        // sous-grammaire suivante — c'est sa définition. Le remettre à zéro ici rendait
        // `mode:sub` posé après une règle silencieusement inopérant : il compilait, et n'agissait
        // pas. Le non-héritage reste tenu par le reset d'un bloc qui a RÉELLEMENT porté des
        // règles, plus bas.
        continue;
      } else {
        break; // Plus de règles ET plus de séparateur → fin légitime de la scène.
      }

      // Le mode NE S'HÉRITE PAS d'une sous-grammaire à l'autre : BP3 repart du défaut
      // (RNDtype) à CHAQUE sous-grammaire et ne l'écrase que si un mot-clé de mode est
      // présent — CompileGrammar.c:1427 (défaut) puis :1488 (override conditionnel),
      // zéro héritage inter-bloc. Laisser `currentMode` persister faisait fuiter le mode
      // d'un bloc mode:ord vers les blocs SUIVANTS sans mode, qui doivent rester au
      // défaut. Mesuré sur asymmetric1 : sous-gram 6 en ORD au lieu de RND décalait les
      // tirages aléatoires. Réfute « ORD explicite ≡ héritage implicite » (bpx [613]).
      currentMode = null;

      if (at(T.SEPARATOR)) {
        advance();
        skipNewlines();
      }
    }

    return subs;
  }

  // ============================================================
  // Templates section
  // ============================================================

  function parseTemplateSection() {
    const kw = expect(T.IDENT);    // template — SINGULIER, sans alias, et NU : l'arobase est sortie du langage
    // Le refus NOMMÉ de l'ex-graphie plurielle ne vit PAS ici : `templates` n'atteint jamais
    // cette fonction (l'appelant ne l'invoque que sur `template`). Il est posé dans la boucle
    // de sous-grammaires, seul point où la forme est réellement vue. Écrit ici, il aurait été
    // du code mort qui rassure — le contraire d'un fail-loud.
    if (kw.value !== 'template') {
      throw new ParseError(`Expected 'template'`, kw);
    }
    skipNewlines();

    const entries = [];
    while (!atEnd()) {
      skipNewlines();
      if (atEnd()) break;
      if (!at(T.LBRACKET)) break;

      // ── UNE ENTRÉE DE CATALOGUE SE TRANSPORTE VERBATIM ─────────────────────────────────────
      // FORME RATIFIÉE PAR ROMAIN (2026-08-10), gravée dans BPx `docs/AST_SPEC.md` §1.9 :
      // `TemplateEntry { line: string }` — la LIGNE ENTIÈRE, crochet d'index COMPRIS, non
      // normalisée, sans son terminateur de fin de ligne.
      //
      // ⚠️ DEUX OBJETS PORTAIENT UN SEUL MOT, ET C'EST CE QUI A PRODUIT LE DÉFAUT. Le gabarit
      // d'une RÈGLE (`$`, `&`) est du LANGAGE : il reste parsé, il ne bouge pas. L'entrée du
      // CATALOGUE est une forme BP3 que le moteur lit lui-même (`ReadTemplate`) — la découper ici
      // revenait à décider à sa place.
      //
      // ⚠️ CE QUE LE DÉCOUPAGE COÛTAIT, MESURÉ : deux entrées écrites rendaient UNE entrée, corps
      // VIDE, et un champ d'échelle à `/1` que personne n'avait écrit — zéro erreur à chaque fois.
      // BPx comptait 83 astérisques perdus ; c'était TOUT le corps. Ma propre scène d'exemple, qui
      // enseigne cette forme, sortait avec un catalogue vide et trois gardes verts.
      //
      // ⚠️ ET L'INDEX SORT AUSSI : le moteur l'extrait lui-même de la ligne. Le garder à côté
      // créerait deux sources pour la même information, et rien ne dirait laquelle croire si elles
      // divergeaient.
      //
      // LES ESPACES RESTENT : le moteur les ignore lui-même. Les retirer ici serait la même perte
      // silencieuse par une autre porte.
      const ouvre = current();
      const brute = lignesSource ? lignesSource[ouvre.line - 1] : null;
      // On avance jusqu'à la fin de la ligne : la ligne est lue par le consommateur, pas ici.
      while (!atEnd() && current().line === ouvre.line) advance();
      // ⚠️ SANS LA SOURCE, ON REFUSE — on ne perd pas l'entrée en silence. C'est le mode d'échec
      // exact que ce transport répare : un catalogue qui disparaît sans un mot. Un appelant qui
      // parse sans passer la source doit l'apprendre ici, pas le découvrir en aval.
      if (brute == null) {
        throw new ParseError(
          `le catalogue de gabarits se transporte VERBATIM : le parseur a besoin de la SOURCE pour `
          + `rendre la ligne telle qu'elle est écrite. L'appelant doit passer 'source' à parse().`,
          ouvre);
      }
      entries.push({ type: 'TemplateEntry', line: brute });
      skipNewlines();
    }
    return entries;
  }

  function parseTemplateBody() {
    const elements = [];
    while (!atAny(T.NEWLINE, T.EOF, T.RPAREN)) {
      // Wildcard: ? or ????
      if (at(T.QUESTION)) {
        let count = 0;
        while (at(T.QUESTION)) { advance(); count++; }
        // `?N` (numéroté) n'a de sens que dans une RÈGLE : le numéro unifie avec la
        // flèche qui rejoue le choix (`$X`/`&X` gabarit). Une ligne de catalogue n'a
        // pas de flèche — décision 2026-08-04 (« Le `?` est un wildcard ; `$X`/`&X`
        // restent des gabarits », `hub/decisions/2026-08-04-le-signe-interrogation-
        // est-un-wildcard-le-gabarit-garde-capturer.md ») : « les mêmes `?` que dans
        // une règle, un par terminal effacé, et toujours ANONYMES : une ligne de
        // catalogue n'a pas de flèche, donc rien à rejouer et pas de numéro. »
        //
        // Avant ce refus, `?N` ici n'était atteint par AUCUNE branche : le `?` était
        // compté comme wildcard nu, puis l'INT restant ne correspondait à aucun cas
        // du `if/else if` ci-dessous → le `else break` final sortait de la boucle EN
        // SILENCE, tronquant tout le reste de la ligne de catalogue sans une erreur.
        // Mesuré : `[1] /1 ?1 ? .` ne gardait qu'un seul `TemplateWildcard`, ' ? .'
        // disparaissait de l'AST sans warning ni erreur.
        if (at(T.INT)) {
          throw new ParseError(
            `'?${current().value}' : un wildcard numéroté n'a de sens que dans une règle `
            + `(le numéro unifie avec la flèche, qui rejoue le choix). Une ligne de catalogue `
            + `@template n'a pas de flèche — ses wildcards sont toujours anonymes ('?'), jamais numérotés.`,
            current(),
          );
        }
        elements.push({ type: 'TemplateWildcard', count });
      }
      // Period
      else if (at(T.PERIOD)) {
        advance();
        elements.push({ type: 'TemplatePeriod' });
      }
      // Bracket: ($N body)
      else if (at(T.LPAREN)) {
        advance();
        expect(T.DOLLAR);
        const idx = Number(expect(T.INT).value);
        const body = parseTemplateBody();  // recursive — stops at RPAREN
        expect(T.RPAREN);
        elements.push({ type: 'TemplateBracket', index: idx, body });
      }
      else {
        break;
      }
    }
    return elements;
  }

  function isRuleStart() {
    // A rule starts with: [guard] | IDENT | # | ( | ? | | | { | } | , | - | $
    const t = current().type;
    return t === T.IDENT || t === T.HASH ||
           t === T.LPAREN || t === T.QUESTION || t === T.PIPE ||
           t === T.LAMBDA || t === T.LBRACE || t === T.RBRACE || t === T.COMMA ||
           t === T.REST || t === T.DOLLAR || t === T.RPAREN ||
           (t === T.LBRACKET && isGuardBracket());
  }

  // Lookahead to distinguish guard [count-1] from engine qualifier [speed:2]
  // Guard: [IDENT op value] where op is -/+/==/!=/>/</>=/<=
  // Qualifier: [key:value, ...] — has a colon
  function isGuardBracket() {
    let i = 1;
    // Look for colon before ] — if found, it's a qualifier not a guard
    while (pos + i < tokens.length) {
      const t = tokens[pos + i].type;
      if (t === T.RBRACKET || t === T.NEWLINE || t === T.EOF) break;
      if (t === T.COLON) return false; // qualifier
      i++;
    }
    return true; // no colon found → guard
  }

  // ============================================================
  // Couche 3 — Rules
  // ============================================================

  function parseRule() {
    const tok = current();
    let guard = null;
    const contexts = [];

    // Guards: [flag-1] — multiple allowed, AND'd
    const guards = [];
    while (at(T.LBRACKET) && isGuardBracket()) {
      guards.push(parseGuard());
    }
    guard = guards.length > 0 ? guards : null;

    // Contexts before LHS: (A B) or #(A B) or #A
    while (at(T.HASH) || (at(T.LPAREN) && isContextLookahead())) {
      contexts.push(parseContext());
    }

    // LHS
    const lhs = parseLhsElements();

    // Arrow
    let arrow;
    if (at(T.ARROW_R)) { arrow = '->'; advance(); }
    else if (at(T.ARROW_L)) { arrow = '<-'; advance(); }
    else if (at(T.ARROW_BI)) { arrow = '<>'; advance(); }
    else throw new ParseError(`Expected arrow (-> <- <>), got ${current().type}`, current());

    // RHS
    const rhs = parseRhsElements();

    // Durée NIVEAU-RÈGLE : `S -> A B C :2` (espacé, en fin de RHS) → tout le RHS dans le cadre
    // {2, …}. C'est la portée `règle` de la durée (règle universelle de portée, cf. AST_SPEC).
    // Le désucrage passe par le MÊME qualifier `speed` que les portées terminal/groupe (contrat AST).
    // Si un élément RHS SUIT le `:N`, la durée est ISOLÉE au milieu du flux (portée inline —
    // INTERDITE pour la durée, qui exige un hôte) → erreur claire (fail-loud), pas d'avalement.
    if (at(T.COLON) && estNombreDeDuree(peek(1)) && rhs.length > 0) {
      const tokColon = current();
      advance(); // consume COLON
      const dur = parseColonFrame(tokColon);
      const inner = rhs.splice(0, rhs.length);
      rhs.push(cadreDuree(dur, inner));
      if (atRhsElementStart()) {
        throw new ParseError(`durée isolée dans le flux : ':N' se colle à un terminal (A4:1/2), un groupe ({A B}:2) ou toute la règle (en fin de RHS) — jamais au milieu du flux`, current());
      }
    }

    // Suffixe de règle — DEUX sacs disjoints, `()` (réglage/contrôle runtime) et `[]` (garde/
    // affectation de drapeau, qualifieur moteur non réservé), qui peuvent s'écrire dans N'IMPORTE
    // QUEL ORDRE, y compris en alternance (`S -> C4 [B=3] (weight:3)` comme `S -> C4 (weight:3)
    // [B=3]`) : la position de l'un ne ferme pas l'autre — un signe n'annonce pas la fin de la
    // règle, seule l'ABSENCE des deux le fait.
    //
    // AVANT ce correctif, `()` n'était regardé qu'UNE FOIS, avant la boucle `[]` (EBNF couche 3 :
    // `rule = ... rhs , [ runtime_qualifier ] , { flag_bracket | qualifier }`, un ordre figé qui
    // ne correspond à aucune règle du langage — les deux sacs sont orthogonaux). Un `()` après un
    // `[]` cassait avec « Expected arrow », un message qui pointe vers la règle SUIVANTE au lieu
    // de nommer le vrai problème : mesuré sur `S -> C4 [B=3] (weight:3)`.
    //
    // Plusieurs groupes `()` sont fusionnés dans UN SEUL `settings` (mêmes paires, ordre
    // d'écriture préservé) : le reste du compilateur (extraction de `scan`, etc.) lit un unique
    // nœud SettingBag par règle. `qualifiers` (crochet) reste un sac SÉPARÉ et disjoint : il ne
    // porte QUE ce que `checkQualifierKey` laisse encore passer en `[]` — garde/mutation de
    // drapeau, rang de gabarit, procédures de niveau règle (goto/failed/repeat/rndtime) et
    // opérateur de tempo — aucune de ces natures n'est un `Setting` au sens `AST.md:642-659`
    // (cf. rapport de session : `qualifiers` n'a PAS été plié dans `SettingBag`, ambiguïté
    // remontée plutôt que tranchée).
    // Loose check : accepte les clés opaques même sans `controls` chargé (EBNF couche 3).
    let settings = null;
    const qualifiers = [];
    const flags = [];
    while (true) {
      if (isRuntimeQualifierLoose()) {
        const rq = parseRuntimeQualifier();
        if (settings) settings.pairs.push(...rq.pairs);
        else settings = rq;
        continue;
      }
      if (at(T.LBRACKET)) {
        if (isFlagBracket()) {
          flags.push(...parseFlagBracket());
        } else {
          qualifiers.push(parseQualifier());
        }
        continue;
      }
      break;
    }

    // B2 : extraire rule.mode depuis le réglage (scan:left|right|rnd) — écrit en PARENTHÈSES
    // depuis la décision Romain 2026-08-02 (LANGUAGE.md:773-800), plus en crochets.
    // (BPx ast.ts:431-449 lit ast.mode : le champ DÉRIVÉ ne change pas, seule sa source le fait.)
    // LES VALEURS VALIDES VIENNENT DE LA DONNÉE (`engine.scan.values`, lib/engine.bpsl) — le
    // parseur nommait `left`/`right`/`rnd` lui-même (un doublon EXACT de cet enum) ; il lit
    // désormais celui que la librairie déclare, comme tout contrôle à `values` (étape 3, règle 5).
    const scanValues = (universeSacs().specs.scan && universeSacs().specs.scan.values) || [];
    let ruleMode = null;
    for (const pair of (settings ? settings.pairs : [])) {
      if (pair.key === 'scan') {
        if (scanValues.includes(pair.value)) {
          ruleMode = pair.value;
        } else {
          throw new ParseError(
            `(scan:${pair.value}) : valeur inconnue (attendu : ${scanValues.join(', ')})`,
            { line: tok.line, col: 0 }
          );
        }
      }
    }

    // Garde-fou lint : avertissement si le nombre d'ancres LHS ≠ RHS.
    // Le corpus connu est symétrique ; une asymétrie peut indiquer une erreur.
    // (pas une erreur bloquante — Bernard pourrait avoir des cas asymétriques)
    const countAnchorsLhs = lhs.filter(e => e.type === 'TemplateAnchor').length;
    const countAnchorsRhs = (function countRhsAnchors(elements) {
      let n = 0;
      for (const e of elements) {
        if (e.type === 'TemplateAnchor') n++;
        else if (e.elements) n += countRhsAnchors(e.elements);
      }
      return n;
    })(rhs);
    const warnings = [];
    if (countAnchorsLhs !== countAnchorsRhs && (countAnchorsLhs > 0 || countAnchorsRhs > 0)) {
      warnings.push({
        type: 'warning',
        message: `ancres de gabarit asymétriques : LHS a ${countAnchorsLhs}, RHS a ${countAnchorsRhs}`,
        line: tok.line,
      });
    }

    return { type: 'Rule', guard, contexts, lhs, arrow, rhs, flags, qualifiers, settings, mode: ruleMode, line: tok.line, warnings };
  }

  // ============================================================
  // RHS Flags [X=N, Y, Z+1]
  // ============================================================

  /**
   * UN MOT NU ENTRE CROCHETS EST UN DRAPEAU, SAUF S'IL EST UNE PROCÉDURE DE DÉRIVATION.
   *
   * ⛔ REMPLACE UNE LISTE EN DUR de sept noms — `retro shuffle order stop destru striated smooth`
   * (retirée le 2026-08-08, Romain : « rien de codé en dur, les portées sont déclarées en
   * librairies et c'est ça la référence »). Elle disait quels mots ne devaient PAS être pris pour
   * des drapeaux, et elle faisait DOUBLON EN SENS INVERSE avec le champ que la donnée porte déjà :
   * l'un disait « ce mot ne s'écrit pas nu », l'autre « ces mots s'écrivent nus ». Deux mécanismes
   * concurrents pour une même question, sans rien qui garantisse qu'ils s'accordent.
   *
   * ⚠️ LE CRITÈRE SE MESURE, IL NE SE CHOISIT PAS. Confrontée à la donnée, la liste mélangeait
   * trois natures que l'arbitrage du jour sépare : `stop` est une PROCÉDURE (portée règle seule) ;
   * `retro`, `shuffle` et `order` manipulent ce qui est produit (portée groupe/flux) et passent
   * entre parenthèses ; `destru`, `striated` et `smooth` n'ont AUCUNE portée déclarée — ce sont des
   * attributs de mode, qui empruntent un tout autre chemin (`mode:x(…)`) et n'avaient rien à faire
   * dans une liste de clés de crochet.
   * Il ne reste donc qu'une famille légitime ici, et la donnée la nomme sans qu'on l'écrive.
   */
  const estProcedureNue = (mot) => universeRuleScopeControls().has(mot);

  function isFlagBracket() {
    // Lookahead: [ followed by IDENT then = + - , ] (NOT IDENT:value which is a qualifier)
    if (!at(T.LBRACKET)) return false;
    const t1 = peek(1);
    const t2 = peek(2);
    if (t1.type !== T.IDENT) return false;
    // If IDENT followed by : → qualifier, not flag
    if (t2.type === T.COLON) return false;
    // If the key is a known engine bare key → qualifier, not flag
    if (estProcedureNue(t1.value)) return false;
    // If IDENT followed by = + - ] , → flag
    if (t2.type === T.EQUALS || t2.type === T.PLUS || t2.type === T.REST ||
        t2.type === T.RBRACKET || t2.type === T.COMMA) return true;
    // Trailing-dash absorbed by tokenizer: [times-1] → IDENT("times-") INT(1)
    // Detect IDENT ending with "-" followed by INT → flag mutation
    if (t1.value.endsWith('-') && t2.type === T.INT) return true;
    if (t1.value.endsWith('+') && t2.type === T.INT) return true;
    return false;
  }

  function parseFlagBracket() {
    expect(T.LBRACKET);
    const flags = [];
    while (!at(T.RBRACKET) && !atEnd()) {
      let rawFlag = expect(T.IDENT).value;
      let operator = null, value = null;
      // Trailing-dash absorbed by tokenizer: [times-1] → IDENT("times-") INT(1)
      // Detect IDENT ending with "-" or "+" and split off the operator
      if (rawFlag.endsWith('-') && at(T.INT)) {
        operator = '-';
        rawFlag = rawFlag.slice(0, -1);
        value = Number(advance().value);
      } else if (rawFlag.endsWith('+') && at(T.INT)) {
        operator = '+';
        rawFlag = rawFlag.slice(0, -1);
        value = Number(advance().value);
      } else if (at(T.EQUALS)) {
        operator = '='; advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError('Expected flag value', current());
      } else if (at(T.PLUS)) {
        operator = '+'; advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError('Expected flag value', current());
      } else if (at(T.REST)) {
        operator = '-'; advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError('Expected flag value', current());
      }
      // else: bare flag [Atrans] → operator=null, value=null
      flags.push({ type: 'FlagExpr', flag: rawFlag, operator, value });
      if (at(T.COMMA)) advance();
    }
    expect(T.RBRACKET);
    return flags;
  }

  // ============================================================
  // Guard
  // ============================================================

  function parseGuard() {
    // Guard syntax: [flag-1], [phase==1], [Ideas]
    advance(); // consume [

    let flag = expect(T.IDENT).value;

    let result;

    // Trailing-dash absorbed by tokenizer: [times-1] → IDENT("times-") INT(1)
    if (flag.endsWith('-') && at(T.INT)) {
      const val = Number(advance().value);
      flag = flag.slice(0, -1);
      result = { type: 'Guard', flag, operator: '-', value: val, mutates: true };
    } else if (flag.endsWith('+') && at(T.INT)) {
      const val = Number(advance().value);
      flag = flag.slice(0, -1);
      result = { type: 'Guard', flag, operator: '+', value: val, mutates: true };
    // Test+mutation: count-1, count+1
    } else if (at(T.REST)) { // - (REST token doubles as minus)
      advance();
      const val = Number(expect(T.INT).value);
      result = { type: 'Guard', flag, operator: '-', value: val, mutates: true };
    } else if (at(T.PLUS)) {
      advance();
      const val = Number(expect(T.INT).value);
      result = { type: 'Guard', flag, operator: '+', value: val, mutates: true };
    } else {
      // Test pure: phase==1, count>3
      let op;
      if (at(T.EQ)) { op = '=='; advance(); }
      else if (at(T.NEQ)) { op = '!='; advance(); }
      else if (at(T.GT)) { op = '>'; advance(); }
      else if (at(T.LT)) { op = '<'; advance(); }
      else if (at(T.GTE)) { op = '>='; advance(); }
      else if (at(T.LTE)) { op = '<='; advance(); }
      else if (at(T.EQUALS)) {
        // `[scene=1]` en PRÉFIXE : `=` est l'opérateur de MUTATION, il n'a pas cours dans une
        // garde (docs/spec/LANGUAGE.md:301 — comparaison avant le LHS, calcul dans la RHS).
        // Le parseur criait déjà, mais par un « Expected RBRACKET » illisible (constat atlas
        // 2026-07-10, qui l'a pris pour une troncature silencieuse). On nomme la faute.
        throw new ParseError(
          `garde '[${flag}=…]' : '=' est une MUTATION, elle s'écrit en fin de règle ` +
          `('S -> C4 [${flag}=…]'). Pour TESTER la valeur d'un drapeau avant le LHS, comparer ` +
          `avec '==' ('[${flag}==…] S -> C4')`,
          current());
      }
      else {
        // Bare flag test: [Ideas] → non-zero test
        result = { type: 'Guard', flag, operator: null, value: null, mutates: false };
        expect(T.RBRACKET);
        return result;
      }

      let value;
      if (at(T.INT)) value = Number(advance().value);
      else if (at(T.IDENT)) value = advance().value;
      else throw new ParseError(`Expected value after operator`, current());

      result = { type: 'Guard', flag, operator: op, value, mutates: false };
    }

    expect(T.RBRACKET);
    return result;
  }

  // ============================================================
  // Context
  // ============================================================

  function isContextLookahead() {
    // ( at start of rule, before LHS — check if followed by symbols then ) then more symbols then ->
    // Heuristic: if we see ( symbols ) symbol -> then it's a context
    let j = pos + 1;
    let depth = 1;
    while (j < tokens.length && depth > 0) {
      if (tokens[j].type === T.LPAREN) depth++;
      if (tokens[j].type === T.RPAREN) depth--;
      j++;
    }
    // After ), look for arrow eventually
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI) return true;
      if (t === T.NEWLINE || t === T.EOF) return false;
      j++;
    }
    return false;
  }

  function parseContext() {
    let positive = true;

    if (at(T.HASH)) {
      advance();
      positive = false;

      // #? (boundary — no symbol at this position)
      if (at(T.QUESTION)) {
        advance();
        return { type: 'Context', positive: false, symbols: ['?'] };
      }

      // #symbol (single) or #(group) — group can contain {, }, , and wildcards ?N
      if (at(T.LPAREN)) {
        advance();
        const symbols = [];
        while (!at(T.RPAREN) && !atEnd()) {
          if (at(T.IDENT)) symbols.push(advance().value);
          else if (at(T.QUESTION)) {
            advance();
            // ?N wildcard in context
            if (at(T.INT)) symbols.push('?' + advance().value);
            else symbols.push('?');
          }
          else if (at(T.LBRACE)) { symbols.push(advance().value); }
          else if (at(T.RBRACE)) { symbols.push(advance().value); }
          else if (at(T.COMMA)) { symbols.push(advance().value); }
          else break;
        }
        expect(T.RPAREN);
        return { type: 'Context', positive: false, symbols };
      } else if (atAny(T.LBRACE, T.RBRACE, T.COMMA)) {
        // #{ or #} or #, — single structural char as negative context
        return { type: 'Context', positive: false, symbols: [advance().value] };
      } else if (at(T.REST)) {
        // #- — negative context for silence (le '-' est le silence en BPscript)
        advance();
        return { type: 'Context', positive: false, symbols: ['-'] };
      } else if (at(T.PROLONG)) {
        // #_ — negative context for prolongation
        advance();
        return { type: 'Context', positive: false, symbols: ['_'] };
      } else {
        const sym = expect(T.IDENT).value;
        return { type: 'Context', positive: false, symbols: [sym] };
      }
    }

    // Positive context: (A B) — can contain {, }, , and wildcards ?N
    expect(T.LPAREN);
    const symbols = [];
    while (!at(T.RPAREN) && !atEnd()) {
      if (at(T.IDENT)) symbols.push(advance().value);
      else if (at(T.QUESTION)) {
        advance();
        if (at(T.INT)) symbols.push('?' + advance().value);
        else symbols.push('?');
      }
      else if (atAny(T.LBRACE, T.RBRACE, T.COMMA)) symbols.push(advance().value);
      else break;
    }
    expect(T.RPAREN);
    return { type: 'Context', positive: true, symbols };
  }

  // ============================================================
  // LHS elements
  // ============================================================

  /** Vrai si, apres le `(...)` courant, la fleche suit immediatement — donc le contexte FERME
   *  le membre gauche. Sert a distinguer la queue (legitime) du milieu (refuse). */
  function finDeMembreGauche() {
    let j = pos, prof = 0;
    do {
      if (tokens[j].type === T.LPAREN) prof++;
      else if (tokens[j].type === T.RPAREN) prof--;
      j++;
    } while (prof > 0 && j < tokens.length);
    const t = tokens[j] && tokens[j].type;
    return t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI;
  }

  function parseLhsElements() {
    const elements = [];
    while (!atAny(T.ARROW_R, T.ARROW_L, T.ARROW_BI, T.EOF, T.NEWLINE, T.SEPARATOR)) {
      if (at(T.IDENT) || at(T.LAMBDA)) {
        elements.push({ type: 'Symbol', name: normalizeName(advance().value), line: current().line });
      } else if (at(T.PIPE)) {
        elements.push(parseVariable());
      } else if (at(T.QUESTION)) {
        elements.push(parseWildcard());
      } else if (at(T.HASH)) {
        elements.push(parseContext());
      } else if (at(T.LPAREN) && current().spaceBefore && isContextLookahead()) {
        // ⛔ UN CONTEXTE NE SE POSE QU AUX EXTREMITES DU MEMBRE GAUCHE — decision Romain,
        // 2026-08-09 :  tu ne dois pas l accepter, d autant qu on l a sorti du langage .
        //
        // ⚠️ MESURE DE BPx SUR LE MOTEUR D ORIGINE, qui est l argument : le contexte OUVRE le
        // membre gauche, derriere le seul prefixe de poids, ou le FERME. Aucune grammaire native
        // ne le pose APRES un element — assiette : bp3-engine/test-data et le corpus BP3 de
        // kanopi. Leur falsifiable : une seule grammaire native qui le ferait suffit a rouvrir.
        // Chez moi, cette place produisait un `Context` AU MILIEU du membre gauche — un arbre que
        // rien en aval ne sait lire, et que rien ne signalait.
        // ⚠️ ET LA MESURE QUI M A FAIT CROIRE AU PIRE ETAIT FAUSSE : je regardais le champ
        // `contexts` et j y voyais ZERO pour les trois formes non-tete, donc  le contexte est
        // perdu en silence . Il ne l est pas — le contexte DROIT vit dans le membre gauche, par
        // construction. Chercher au mauvais endroit et conclure a l absence, une fois de plus.
        if (elements.length > 0 && !finDeMembreGauche()) {
          throw new ParseError(
            `un CONTEXTE ne se pose qu aux EXTREMITES du membre gauche — en tete ('(A) x B -> …') `
            + `ou en queue ('x B (A) -> …'). Ici il suit '${elements.length}' element(s) et en `
            + `precede d autres : le moteur ne connait pas cette place, et l arbre produit ne `
            + `serait lisible par personne.`,
            current());
        }
        // Right positive context: `Sym (B) -> X`. `(` must have a space before
        // (sinon c'est un runtime qualifier suffixe sur le LHS précédent : `C(vel:80)`).
        // isContextLookahead() vérifie que le `(...)` est suivi de `->`/`<-`/`<>` (pas une
        // déclaration ou un appel). Cf. spec EBNF.md `context` (Couche 3 § contexte droit).
        elements.push(parseContext());
      } else if (at(T.PROLONG)) {
        // _ (prolongation) as terminal on LHS — e.g. Oc3 _ -> _ Oc3
        advance();
        elements.push({ type: 'Prolongation' });
      } else if (at(T.REST)) {
        // - (silence) as terminal on LHS
        advance();
        elements.push({ type: 'Rest' });
      } else if (at(T.DOLLAR)) {
        // $ nu (ancre de gabarit maître) — le $ doit être isolé (espace après).
        // Un $ collé à un IDENT/LBRACE sans espace est interdit en LHS.
        const dollarTok = current();
        const nextTok = peek(1);
        if (!nextTok.spaceBefore && (nextTok.type === T.IDENT || nextTok.type === T.LBRACE)) {
          throw new ParseError(
            `"$" collé à un identifiant interdit en LHS — utiliser "$ " (dollar isolé avec espace)`,
            dollarTok
          );
        }
        advance();  // consomme le $
        elements.push({ type: 'TemplateAnchor', kind: 'master' });
      } else if (atAny(T.LBRACE, T.RBRACE, T.COMMA, T.RPAREN)) {
        // Raw structural chars on LHS (meta-grammars: koto3, dhin)
        elements.push({ type: 'RawBrace', value: advance().value });
      } else {
        break;
      }
    }
    return elements;
  }

  // ============================================================
  // RHS elements
  // ============================================================

  function parseRhsElements() {
    const elements = [];
    let safety = 0;
    while (!atAny(T.NEWLINE, T.EOF, T.SEPARATOR, T.COMMENT, T.GATE, T.TRIGGER, T.CV)) {
      // [] or () with SPACE before → not attached to previous element → end of RHS
      // (rule-level qualifiers/flags handled by parseRule after this returns)
      // EXCEPTION (décision ratifiée 2026-07-18) : un flag qui PRÉFIXE un contrôle reste
      // dans le RHS, émis AVANT le nœud contrôle — cf. isFlagPrefixOfControl.
      if (at(T.LBRACKET) && current().spaceBefore && isFlagPrefixOfControl()) {
        const line = current().line;
        elements.push({ type: 'FlagSet', flags: parseFlagBracket(), line });
        continue;
      }
      if (at(T.LBRACKET) && current().spaceBefore) break;
      // UN SAC SÉPARÉ PAR UNE ESPACE N'EST UN SUFFIXE DE RÈGLE QUE S'IL EST EN FIN DE RÈGLE.
      //
      // ⚠️ TRANCHÉ PAR ROMAIN le 2026-08-07 : « les règles et l'antécédent sont clairs ». Sans ce
      // départage, `S -> C4 (rndtime:100) D4 E4` — la ligne exacte de la bible — cassait la boucle
      // au sac et laissait `D4 E4` orphelins (« flèche attendue »). AU MILIEU d'une règle, le même
      // sac est un réglage POSÉ DANS LE FLUX : il vaut à partir de là, comme dans le moteur natif,
      // mesuré — `_tempo(1/2) _rndtime(50) _scale(…)` dans `-da.checkNoteOff`.
      //
      // ⚠️ ET `isEndOfRhs()` EXISTAIT DÉJÀ, ÉCRITE POUR CE CAS EXACT ET APPELÉE NULLE PART. Un
      // correctif entièrement rédigé, jamais branché : il ne rougissait pas, il ne servait pas, et
      // rien ne pouvait le signaler. Une fonction morte est plus discrète qu'un défaut — elle a
      // l'air d'une couverture.
      if (at(T.LPAREN) && current().spaceBefore && isRuntimeQualifierLoose() && isEndOfRhs()) break;
      // Le même sac, AU MILIEU : un réglage posé dans le flux. Il ne voyage avec aucun terme et ne
      // se réplique pas — d'où `conjoint: false`, comme un instantané détaché par une espace.
      if (at(T.LPAREN) && current().spaceBefore && isRuntimeQualifierLoose()) {
        elements.push({ type: 'InstantControl', qualifier: parseRuntimeQualifier(), conjoint: false });
        continue;
      }
      if (++safety > 500) throw new ParseError('RHS parse loop safety limit', current());
      // Unbalanced } or , at top level — embedding pattern
      if (atAny(T.RBRACE, T.COMMA) && isNewRuleAhead()) break;
      if (at(T.RBRACE)) {
        advance();
        const rawBrace = { type: 'RawBrace', value: '}' };
        // ⛔ LA BRANCHE HÉRITÉE `}[speed:N]` EST SUPPRIMÉE — Romain, 2026-08-08, décision
        // `2026-08-08-duree-bloc-reparti-sur-la-fermante.md` : « je ne veux pas de legacy, c'est
        // poubelle ». La durée d'un bloc réparti s'écrit `}:N`, sur la fermante, et rien d'autre.
        //
        // ⚠️ ELLE ÉTAIT COMMENTÉE « le temps de la migration » — et il n'y a JAMAIS eu de migration
        // à faire : zéro occurrence dans tout l'atelier, mesuré par BPx puis par moi. Une voie
        // parallèle ouverte pour un passage qui n'a jamais eu lieu, et qui aurait pu vivre des
        // années : c'est la forme la plus tenace du legacy, celle qui n'a jamais servi à personne
        // et que personne ne pense à retirer parce qu'elle ne dérange rien.
        // BPx a sorti `qualifiers` de son contrat d'entrée dans le même mouvement et LÈVE si un
        // producteur l'envoie encore — ce qui n'est plus lu doit crier, jamais disparaître.
        // ⛔ LE SAC COLLÉ À LA FERMANTE RÈGLE LE BLOC ENTIER — décision de Romain, portée par BPx
        // le 2026-08-08 avec sa mesure.
        //
        // `LANGUAGE.md` pose que COLLÉ règle le groupe et ESPACÉ règle la règle ; la branche
        // équilibrée l'applique depuis le 2026-08-07. La branche DÉSÉQUILIBRÉE — un bloc dont
        // l'ouvrante et la fermante vivent dans deux règles différentes — ne lisait que le crochet
        // et la durée. La parenthèse tombait donc dans le sac de fin de règle, et le même bloc
        // sonnait autrement selon qu'il était écrit d'un tenant ou réparti :
        //     S -> {C4 D4 E4 F4}(vel:50) G4     → QUATRE notes à 50
        //     A -> { C4 D4 ⏎ B -> E4 F4 }(vel:50) → DEUX seulement
        // Mesuré par BPx dans mon propre arbre : le sac arrivait en `Rule.settings` avec
        // `scope: 'rule'`, et la fermante arrivait NUE. L'information « ce sac était collé au } »
        // était perdue au parse — donc irrécupérable en aval, quoi que fasse le lecteur.
        if (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
          rawBrace.settings = parseRuntimeQualifier();
        }
        // Durée collée sur l'accolade fermante d'un embedding inter-règles : }:N (décision 2026-06-26).
        // Même sémantique que `}[speed:N]` — poussée comme qualifier `speed` (contrat AST).
        //
        // ⚠️ CE COMMENTAIRE ANNONÇAIT UNE SECONDE PASSE, NOMMÉE, QUI N'A JAMAIS EXISTÉ — le dépôt
        // entier ne portait qu'une occurrence de ce nom : le commentaire lui-même. BPx l'a lu, a
        // cru le travail fait ailleurs, et la durée était perdue en silence DES DEUX CÔTÉS.
        // (Le nom n'est pas répété ici, et c'est délibéré : un garde vérifie qu'aucun nom de
        // fonction cité dans ce fichier n'y est absent — `test/la_fermante_porte_son_sac.mjs`.)
        // Et elle ne PEUT pas exister au parse : on ne sait pas quelle règle apportera l'ouvrante,
        // et le tirage peut la fournir ou non — BPx l'a vérifié sur le moteur d'origine, une
        // grammaire à deux règles alternatives rend un item apparié ET un item non apparié.
        // ⚠️ Un commentaire qui promet un travail inexistant est pire qu'un trou déclaré : il
        // éteint la question chez celui qui le lit. Même famille que la fonction morte et la
        // branche jamais branchée trouvées la veille — sauf qu'ici il n'y avait même pas de code.
        if (at(T.COLON) && !current().spaceBefore && estNombreDeDuree(peek(1))) {
          const tokColon = current();
          advance(); // consume COLON
          // La durée d'une accolade DÉSÉQUILIBRÉE ne peut pas s'envelopper ici : le `{` correspondant
          // est dans une autre règle, et c'est une seconde passe qui les réunit. On la porte donc sur
          // un champ NOMMÉ, au lieu de la glisser dans `qualifiers` — qui n'accepte que des nœuds
          // `Qualifier`. Depuis que le désucrage ne produit plus de qualificatif `speed`, l'y pousser
          // y aurait mis un nœud du mauvais type : défaut introduit puis corrigé le 2026-07-26.
          rawBrace.duree = parseColonFrame(tokColon);
        }
        elements.push(rawBrace);
        continue;
      }
      if (at(T.COMMA)) {
        elements.push({ type: 'RawBrace', value: ',' });
        advance();
        continue;
      }
      // Raw tokens: + ) for time signatures and meta-grammars
      if (at(T.PLUS) || at(T.RPAREN)) {
        elements.push({ type: 'RawBrace', value: advance().value });
        continue;
      }
      // Bare `*` in the RHS flow = BP3 homomorphism / wildcard marker
      // (LANGUAGE.md:1500 `S -> $X * &X` → `S --> (=X) * (:X)`). This is the
      // marker form, distinct from the `[*N]` scale qualifier (inside brackets,
      // handled by isTempoOpQualifier) and from `*:sound.X` (assignment subject,
      // parsed in the directive path, not here). BP3 tokenises a bare `*` as
      // (T0, 21) via FindCode (Encode.c:1335). Emitted as a raw `*` token.
      if (at(T.STAR)) {
        advance();
        elements.push({ type: 'RawBrace', value: '*' });
        continue;
      }

      const el = parseRhsElement();
      if (!el) break;

      // SACS COLLÉS — `A(X)` seul. Un sac collé s'écrit entre PARENTHÈSES.
      //
      // ⛔ LE CROCHET COLLÉ N'EXISTE PLUS — arbitrage de Romain, 2026-08-08. Le tableau de
      // `LANGUAGE.md` §« Le crochet » donne ses quatre places, et aucune n'est un suffixe
      // d'élément : le crochet gouverne la DÉRIVATION, qui ne se règle pas note à note.
      //
      // ⚠️ CE QUE LA MESURE A MONTRÉ, et qui rend ce refus petit : la place était déjà presque
      // vide. Sur les huit formes que le parseur peut produire, six refusaient déjà — collé à un
      // symbole, à un silence, à une prolongation, à un groupe pour une procédure, et les deux
      // formes de tempo. Il ne restait QUE le groupe et le point d'attente, et une seule scène de
      // tout l'atelier l'écrivait (`{C3 B3 E3 F3 G3}[shuffle]`).
      // Aucun DRAPEAU collé n'existe non plus — mesuré sur les trois porteurs : ce refus ne prend
      // donc la place de personne.
      //
      // ⚠️ ET LA RÉÉCRITURE ENRICHIT L'ARBRE au lieu de l'appauvrir, mesuré en comparant les deux
      // productions : le crochet rendait une paire clé/valeur nue, la parenthèse rend un sac qui
      // porte sa NATURE, sa PORTÉE et son CONFINEMENT. Ce n'est pas un changement de graphie à
      // production égale — c'est un gain d'information pour l'aval, et il faut le dire à qui lit.
      let sacsLus = 0;
      while ((at(T.LBRACKET) && !current().spaceBefore) ||
             (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier())) {
        if (at(T.LBRACKET)) refuserCrochetColle();
        el.suffixQualifiers = el.suffixQualifiers || [];
        refuserSecondSac(++sacsLus, el);
        el.suffixQualifiers.push(parseRuntimeQualifier());
      }

      refuserSuffixeArobase();
      // Un `!` derrière l'élément ET SON SAC ouvre l'accord (cf. envelopperEnAccord).
      elements.push(envelopperEnAccord(el, current()));
    }
    return elements;
  }

  function isNewRuleAhead() {
    // Check if } or , at start of a NEW LINE is a new rule (} -> })
    // Only true if preceded by a NEWLINE (not inline like F2 B3})
    if (pos > 0 && tokens[pos - 1].type !== T.NEWLINE) return false;
    // Look for arrow after the } or ,
    let j = pos + 1;
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI) return true;
      if (t === T.NEWLINE || t === T.EOF || t === T.SEPARATOR) return false;
      j++;
    }
    return false;
  }

  // Flag en PRÉFIXE d'un CONTRÔLE dans le RHS : `[B=3, A=3] goto(3,0)`.
  // Décision LANGAGE ratifiée Romain 2026-07-18 (flag-prefixe-sur-controle-rhs, option b) :
  // poser le flag APRÈS un goto n'a pas de sens — goto est un SAUT, le flag doit être posé
  // AVANT. Exception ENCADRÉE : le flag-préfixe n'est autorisé QUE devant un contrôle ;
  // la règle générale « [] = suffixe » reste vraie pour les notes et terminaux.
  // Byte-id BP3 : émet /B=3/ /A=3/ _goto(3,0), l'ordre du natif.
  function isFlagPrefixOfControl() {
    if (!at(T.LBRACKET) || !isFlagBracket()) return false;
    // Avancer jusqu'au ] appariré, puis regarder si un contrôle suit.
    let j = pos, depth = 0;
    for (; j < tokens.length; j++) {
      if (tokens[j].type === T.LBRACKET) depth++;
      else if (tokens[j].type === T.RBRACKET) { depth--; if (depth === 0) { j++; break; } }
    }
    if (j >= tokens.length) return false;
    const t = tokens[j];
    // ⚠️ J'AI EU TORT ICI LE 2026-07-26, et le retrait de cette branche est la correction.
    // J'avais fait reconnaître `[B=3, A=3] ![goto: 3 0]` en jugeant que `[goto: 3 0]` « perdait »
    // l'ordre, parce que le nœud quittait la séquence pour devenir un qualificatif de règle.
    // J'ai jugé sur la FORME DE L'ARBRE au lieu de l'EFFET : `goto` est une procédure de niveau
    // RÈGLE, et c'est justement en qualificatif de règle que le moteur la lit
    // (BPx `mergeQualifierProcedures`, loadGrammar.ts:3996). La forme que je croyais fidèle était
    // celle qui n'arrivait nulle part, et laissait un jeton inerte dans la production.
    // Écriture correcte : `[B=3, A=3] [goto: 3 0]`, les deux au niveau de la règle.
    if (t.type !== T.IDENT || !isControlName(t.value)) return false;
    // Contrôle nu `striated`. (La forme d'appel `goto(3,0)` a été supprimée du langage le
    // 2026-07-26 — voir hub/decisions/2026-07-26-ecriture-des-controles-….)
    return isNoArgControl(t.value);
  }

  function isTempoOpQualifier() {
    // Lookahead: [/N] or [*N] — pure tempo op on element (not mixed [/5, mode:random])
    if (!at(T.LBRACKET)) return false;
    const next = peek(1).type;
    if (!(next === T.SLASH || next === T.STAR)) return false;
    // Check it's pure (followed by number then ] or /number then ])
    let j = pos + 2; // after [ and operator
    while (j < tokens.length && (tokens[j].type === T.INT || tokens[j].type === T.FLOAT || tokens[j].type === T.SLASH)) j++;
    return j < tokens.length && tokens[j].type === T.RBRACKET; // ] immediately after number = pure
  }



  function isEndOfRhs() {
    // Check if after the () there's nothing more in this RHS
    // (next non-whitespace is NEWLINE, [, EOF, SEPARATOR, or RBRACE)
    // Scan past the () to see what follows
    let j = pos;
    if (tokens[j]?.type !== T.LPAREN) return false;
    // ⚠️ PLUSIEURS SACS PEUVENT SE SUIVRE EN SUFFIXE, et il faut les franchir TOUS. Mesuré sur
    // `cv-adsr.bps` : `Bass -> C2 … (*:cutoff:env1, wave:sawtooth) (weight:50)` — s'arrêter au
    // premier faisait voir une parenthèse derrière lui, donc « ce n'est pas la fin », donc le
    // premier sac devenait un contrôle de flux. Sept scènes changeaient d'arbre pour cette seule
    // raison, après les 91 du défaut précédent : la même correction, mesurée deux fois, a livré
    // deux défauts distincts. Une seule mesure n'aurait montré que le premier.
    while (tokens[j]?.type === T.LPAREN) {
      let depth = 1;
      j++;
      while (j < tokens.length && depth > 0) {
        if (tokens[j].type === T.LPAREN) depth++;
        else if (tokens[j].type === T.RPAREN) depth--;
        j++;
      }
    }
    // ⚠️ CETTE FONCTION AVALAIT LA FIN DE LIGNE QU'ELLE DEVAIT DÉTECTER — corrigé le 2026-08-07.
    // Elle sautait les retours à la ligne AVANT de regarder ce qui suit, donc après
    // `Up1 -> C4 E4 G4 C5 (vel:55)` elle voyait le nom de la règle SUIVANTE et répondait « non,
    // ce n'est pas la fin ». Elle ne pouvait rendre vrai qu'en toute fin de fichier.
    //
    // C'EST POURQUOI ELLE N'AVAIT JAMAIS ÉTÉ BRANCHÉE : elle ne marchait pas. Une fonction morte
    // est plus discrète qu'un défaut — elle a l'air d'une couverture, et personne ne la mesure.
    // Mesuré au moment de la brancher : 91 scènes du corpus changeaient d'arbre, un suffixe de
    // règle devenant un contrôle de flux. `(vel:55)` cessait d'envelopper la règle pour ne valoir
    // qu'à partir de là — une modification MUSICALE en silence, sur des scènes qui compilaient.
    // Seule la comparaison des arbres l'a montrée ; aucun garde n'aurait parlé.
    const nextType = tokens[j]?.type;
    return !nextType || nextType === T.EOF || nextType === T.NEWLINE ||
           nextType === T.SEPARATOR || nextType === T.LBRACKET || nextType === T.COMMENT;
  }

  function isRuntimeQualifier() {
    // (IDENT:...) or (IDENT,...) or (IDENT) where IDENT is a known control name.
    // v0.8 : on accepte aussi `(IDENT.IDENT)` (référence pointée, e.g.
    // `(sound.bell_short)`) — décision PM 4, valeur runtime qualifier pointée.
    if (!at(T.LPAREN)) return false;
    const nextTok = peek(1);
    // LE SUJET DE PORTÉE, COLLÉ — `C4(*:vel:80)`, `{A B}(C2:cutoff:env)`. `LANGUAGE.md` (tableau
    // des portées) déclare les trois portées d'un sac dans les MÊMES termes, quelle que soit sa
    // position ; seul le collé les ignorait. Ces deux formes ne peuvent PAS être happées par le
    // routage appel-de-symbole-vs-sac : l'étoile n'ouvre jamais un argument, et un argument ne
    // porte jamais DEUX deux-points au même niveau.
    if (nextTok.type === T.STAR && peek(2).type === T.COLON) return true;
    if (nextTok.type === T.IDENT && peek(2).type === T.COLON && peek(3).type === T.IDENT
        && (peek(4).type === T.COLON
            || (peek(4).type === T.PERIOD && peek(6).type === T.COLON))) return true;
    if (nextTok.type !== T.IDENT) return false;
    // `(lpf1.cutoff:400)` — le COMPOSANT d'une INSTANCE de module. `lpf1` n'est pas un contrôle,
    // c'est une variable que la scène a déclarée (`var lpf1 lpf`) : le registre des contrôles ne
    // peut pas la connaître. `AST.md` déclare ce cas de longue date (`Setting.component` — « le
    // composant nommé par le point : (cc.98:45), (lpf1.cutoff:400) ») ; seule la reconnaissance
    // manquait, et sept exemples de la bible tombaient dessus.
    if (nomsVariables.has(nextTok.value) && peek(2).type === T.PERIOD
        && peek(3).type === T.IDENT && peek(4).type === T.COLON) return true;
    // ⛔ LE VOCABULAIRE NE DÉCIDE PAS DE LA FORME (2026-08-08).
    //
    // Cette ligne exigeait que la clé soit un contrôle CONNU : `if (!libCtx.controlNames.has(…))
    // return false;`. Un sac dont la clé venait d'une autre librairie n'était donc pas reconnu
    // COMME SAC — `C4(cutoff:sweep)` (librairie des modulations) partait en appel de fonction, et
    // avec un élément derrière il faisait échouer la règle sur « Expected arrow », un message qui
    // ne parle de rien.
    //
    // Deux questions étaient confondues en une : « est-ce que ceci EST un sac ? » — affaire de
    // forme, tranchée par le balayage syntaxique — et « est-ce que cette clé EXISTE ? » — affaire
    // de vocabulaire, tranchée plus tard, et qui doit REFUSER en nommant la clé, pas faire dévier
    // la lecture. Une clé inconnue reste refusée : c'est le contrôle des références qui le dit,
    // avec le bon message.
    //
    // ⚠️ C'est le TROISIÈME reconnaisseur de sac à retomber sur la même faute, et le commentaire
    // ci-dessous la raconte déjà — écrit la veille, en corrigeant les deux premiers. Le savoir
    // n'a pas suffi : celui-ci ne différait pas par les formes qu'il énumérait, mais par le
    // CRITÈRE qu'il employait, et c'est pour ça que la relecture ne l'a pas vu.
    return sacBienForme();
  }

  // ⚠️ `isReservedSettingParen()` A VÉCU ICI DU 2026-07 AU 2026-08-07, ET SA DISPARITION EST LA
  // LEÇON. Il ouvrait le marqueur de flux `!(…)` aux seuls réglages RÉSERVÉS quand `controls`
  // n'est pas chargé — un correctif posé sur le cas signalé par bpx (`!(mode:random)`, 117 sites)
  // et sur lui seul. Il a donc laissé `!(vel:70)` refusé pendant que la même écriture passait en
  // suffixe de règle et collée à un groupe. Une exception ouverte à la taille du ticket est une
  // exception qui reste : le balayage syntaxique la remplace pour TOUTE forme de sac, et le
  // troisième reconnaisseur sort avec elle. On ne garde pas une porte étroite à côté d'une porte
  // large.

  // ⚠️ UN RECONNAISSEUR EST UNE APPROXIMATION DU LECTEUR — ET C'EST LÀ QUE LE TROU VIT.
  //
  // `parseRuntimeQualifier()` sait lire CINQ formes d'élément : la clé nue (`velcont`), la clé
  // valuée (`vel:80`), le contrôleur numéroté (`cc.98:45`), le port d'une instance
  // (`lpf1.cutoff:400`) et le préfixe de SUJET (`*:…`, `C2:…`). TROIS reconnaisseurs décidaient de
  // l'appeler — et chacun n'en connaissait qu'un sous-ensemble DIFFÉRENT. D'où des formes acceptées
  // à un endroit et refusées à un autre, quand `LANGUAGE.md` écrit l'inverse : le sac se comporte à
  // l'identique dans toutes ses positions, « rien de ce qui est écrit ici ne cache une exception
  // plus loin ».
  //
  // MESURÉ le 2026-08-07, produit croisé 11 formes × 4 positions : 13 cellules rouges, TOUTES de
  // cette seule cause. Le port d'instance passait collé et échouait en suffixe ; le sujet passait
  // en suffixe et échouait dans le flux. Corriger cellule par cellule aurait redéplacé le trou —
  // c'est exactement ce que le commentaire du contrôleur numéroté avait prévu, quatre lignes plus
  // haut, sans que ça suffise.
  //
  // CE BALAYAGE ÉNUMÈRE LA GRAMMAIRE DE L'ÉLÉMENT, UNE FOIS :
  //     élément  ::= sujet? clé ('.' composant)? (':' valeur)?
  //     sujet    ::= ('*' | IDENT) ':'      (quand ce qui suit est lui-même une clé valuée)
  //     composant::= NOMBRE | IDENT
  // Ajouter une forme au lecteur se reflète ici, donc dans TOUTES les positions du même coup —
  // au lieu de trois listes à penser au bon moment.
  function sacBienForme() {
    if (!at(T.LPAREN)) return false;
    let j = pos + 1;
    if (!tokens[j] || tokens[j].type === T.RPAREN) return false;   // `()` n'est pas un sac
    while (j < tokens.length) {
      // le SUJET — `*:` toujours, `IDENT:` seulement si ce qui suit est une clé elle-même valuée
      // (deux ':' au même niveau). Le composant pointé compte dans la clé : `C4:env1.attack:400`.
      if (tokens[j].type === T.STAR && tokens[j + 1] && tokens[j + 1].type === T.COLON) {
        j += 2;
      } else if (tokens[j].type === T.IDENT && tokens[j + 1] && tokens[j + 1].type === T.COLON
                 && tokens[j + 2] && tokens[j + 2].type === T.IDENT) {
        const apres = (tokens[j + 3] && tokens[j + 3].type === T.PERIOD
                       && tokens[j + 4] && (tokens[j + 4].type === T.IDENT || tokens[j + 4].type === T.INT))
                    ? tokens[j + 5] : tokens[j + 3];
        if (apres && apres.type === T.COLON) j += 2;
      }
      // la CLÉ
      if (!tokens[j] || tokens[j].type !== T.IDENT) return false;
      j++;
      // le COMPOSANT que le point APPELLE — un numéro (`cc.98`) ou un port nommé (`lpf1.cutoff`)
      if (tokens[j] && tokens[j].type === T.PERIOD && tokens[j + 1]
          && (tokens[j + 1].type === T.INT || tokens[j + 1].type === T.IDENT)) j += 2;
      // la VALEUR que le deux-points AFFECTE — lue jusqu'à la virgule ou la fermante de son niveau
      if (tokens[j] && tokens[j].type === T.COLON) {
        j++;
        let prof = 0;
        while (j < tokens.length) {
          const t = tokens[j].type;
          if (t === T.NEWLINE || t === T.EOF) return false;   // un sac ne franchit pas la ligne
          if (t === T.LPAREN) prof++;
          else if (t === T.RPAREN) { if (prof === 0) break; prof--; }
          else if (t === T.COMMA && prof === 0) break;
          j++;
        }
      }
      if (!tokens[j]) return false;
      if (tokens[j].type === T.RPAREN) return true;
      if (tokens[j].type !== T.COMMA) return false;
      j++;
    }
    return false;
  }

  // Le sac en SUFFIXE DE RÈGLE et le marqueur autonome : reconnaissance purement SYNTAXIQUE, sans
  // dépendance au registre des contrôles (il n'est peuplé que par `controls`). La distinction
  // stricte/souple ne sert plus qu'à UNE chose : router `C4(x)` entre appel de symbole et sac
  // COLLÉ. Partout où le sac est séparé par une espace ou introduit par `!`, aucune ambiguïté ne
  // subsiste, donc la forme seule décide.
  function isRuntimeQualifierLoose() {
    return sacBienForme();
  }

  // Lit un littéral d'INTERVALLE MUSICAL pour un contrôle interval-typé (transpose…).
  // Trois formes, identiques aux ratios de tempérament (lib/temperaments.json) :
  //   fraction 3/2 · cents 700c · décimal 1.5 (un entier nu = ratio brut, 2 = octave).
  // La valeur est portée BRUTE (chaîne) ; la résolution (Kairos, normalizeRatio) la normalise.
  // Malformé → crie en NOMMANT la faute (pas de repli silencieux, L26).
  function readIntervalLiteral(ctrlName) {
    const startTok = current();
    const bad = (why) => {
      throw new ParseError(
        `Intervalle malforme pour '${ctrlName}'${why ? ' : ' + why : ''} — attendu une fraction (3/2), des cents (700c) ou un decimal (1.5)`,
        startTok
      );
    };
    let neg = '';
    if (at(T.REST)) { advance(); neg = '-'; }   // intervalle descendant : -200c, -1.5
    // Guillemets : la valeur canonique d'un intervalle est NUE (transpose:1200c, pas
    // transpose:"1200c") — cf. décision architecte 2026-07-11 (forme (A) nue en source).
    // Nommer les guillemets plutôt que laisser croire que la forme en cents serait refusée.
    if (at(T.STRING)) {
      throw new ParseError(
        `Intervalle entre guillemets non supporte pour '${ctrlName}' : ecris la forme NUE '${current().value}' (sans guillemets) — un intervalle se note fraction (3/2), cents (700c) ou decimal (1.5)`,
        startTok
      );
    }
    if (!at(T.INT) && !at(T.FLOAT)) bad(`'${current().value ?? current().type}' n'est pas un nombre`);
    const a = advance().value;
    // Fraction : INT '/' INT
    if (at(T.SLASH)) {
      if (neg) bad('une fraction ne se note pas negative (utilise des cents : -700c)');
      advance();
      if (!at(T.INT)) bad('denominateur de fraction manquant');
      const b = advance().value;
      return `${a}/${b}`;
    }
    // Cents : nombre suivi de l'unite 'c'
    if (at(T.IDENT) && current().value === 'c') {
      advance();
      return `${neg}${a}c`;
    }
    // Decimal / entier (ratio brut) : aucune unite ne doit suivre.
    if (at(T.IDENT)) bad(`unite inconnue '${current().value}' (les cents s'ecrivent 700c)`);
    return `${neg}${a}`;
  }

  function parseRuntimeQualifier() {
    // (vel:80, wave:sawtooth, velcont) → runtime qualifier AST.
    // v0.8 : accepte aussi `(sound.NAME)` — référence pointée comme valeur ;
    // équivalent sémantique à `(sound:NAME)` mais notation plus lisible.
    expect(T.LPAREN);
    const pairs = [];
    /**
     * ⛔ LA FIN D'UN TERME — ET, AVANT LE DÉLIMITEUR, SEULE LA VIRGULE LE SÉPARE DU SUIVANT.
     *
     * Décision Romain, 2026-08-19. Elle était tenue sur la VALEUR (`scope:symbol group` refusé)
     * et PAS sur le MEMBRE : `scope(symbol group)` passait en silence et rendait deux membres —
     * la forme interdite survivait sous la parenthèse même qui la remplace. Le membre a été
     * ouvert le même jour, après le refus, donc le complément de la portée manquait.
     *
     * ⚠️ ELLE VIT ICI, ET PAS AU SOMMET DE LA BOUCLE : huit branches terminent un terme, et la
     * règle porte sur le SÉPARATEUR, pas sur la reprise. Écrite au sommet, elle aurait dû
     * relire en arrière ce qui vient d'être consommé ; écrite au point de sortie, elle voit
     * simplement ce qui suit.
     *
     * Dans le FLUX rien ne change : l'espace y sépare les termes, et `enDeclaratif` le dit.
     */
    const finirTerme = () => {
      if (at(T.COMMA)) { advance(); return; }
      if (!enDeclaratif) return;
      let k = 0;
      while (peek(k).type === T.NEWLINE || peek(k).type === T.COMMENT) k++;
      if (peek(k).type === T.RPAREN || peek(k).type === T.EOF) return;
      // ── ⛔ CE QUI SUIT EST-IL SEPARE PAR UNE ESPACE, OU COLLE ? LE REFUS DOIT LE DIRE JUSTE ────
      // Ma premiere ecriture accusait TOUJOURS une espace. `ratios(256/243)` n'en porte aucune, et
      // le refus lui repondait « deux termes sont separes par une espace » en proposant « 256, / » —
      // une reecriture absurde, et une cause fausse. SEPT signes colles tombaient dedans :
      // / + ! = * < [. Un message de refus FAIT AUTORITE : l'auteur cherche l'espace qu'on lui
      // nomme, et il n'y en a pas. Une raison fausse sous une conclusion juste coute plus cher
      // qu'un refus muet, parce qu'elle envoie chercher ailleurs.
      // Le collage ne dit RIEN de ce que le signe vaudra : il dit ce que ce lecteur sait lire.
      if (peek(k).spaceBefore === false && peek(k).type !== T.NEWLINE) {
        throw new ParseError(
          `le signe '${peek(k).value ?? peek(k).type}' n'est pas lisible dans un membre : un membre `
          + `est un nom, un nombre ou un texte entre guillemets. Les membres deja lus sont `
          + `'${pairs.map((p) => p.key).join(', ')}'.`,
          peek(k));
      }
      throw new ParseError(
        `deux termes sont separes par une espace : avant le delimiteur, seule la virgule separe — `
        + `l'espace n'y separe rien, il est de la mise en forme. Ecris `
        + `'${pairs.map((p) => p.key).join(', ')}, ${peek(k).value ?? ''}'.`,
        peek(k));
    };
    while (!at(T.RPAREN) && !atEnd()) {
      // ── LA FORME LONGUE S'ÉCRIT SUR PLUSIEURS LIGNES, PARENTHÈSE OUVRANTE ET FERMANTE ───────
      // Décision Romain du 2026-08-15, et c'est la parenthèse — jamais l'indentation — qui borne
      // un corps : un mot déclaré sans argument vaut sa présence (`letring`), donc un dernier mot
      // seul doit rester distinguable de la fin du bloc. La fermante le dit, un retour à la ligne
      // non. Le saut vit AU SOMMET de la boucle pour couvrir tous ses points de reprise : posé
      // après une seule virgule, il aurait laissé les autres formes refuser un retour à la ligne.
      while (at(T.NEWLINE) || at(T.COMMENT)) advance();
      if (at(T.RPAREN) || atEnd()) break;
      // Préfixe de SUJET (cible) devant le contrôle (décision Romain 2026-06-21,
      // cohérent avec l'existant `*:sound.X`) :
      //   `*:cutoff:Env`   → sujet '*' = chaque terminal de la portée  (par note)
      //   `C2:cutoff:Env`  → sujet 'C2' = les terminaux C2 de la règle
      //   `cutoff:Env`     → sujet omis = défaut : la portée elle-même (la règle/le groupe)
      // Détection : `* :`  OU  `IDENT : IDENT :` (deux ':' → le 1er IDENT est le sujet).
      let subject = null;
      if (at(T.STAR) && peek(1).type === T.COLON) {
        subject = '*'; advance(); advance(); // * :
      } else if (at(T.IDENT) && peek(1).type === T.COLON && peek(2).type === T.IDENT
                 // `C2:cutoff:env` — sujet, clé, valeur. Le composant pointé compte dans la CLÉ :
                 // `C2:env1.attack:400` désigne le port d'une instance pour les seuls C2, et ne
                 // se distinguait pas d'un `IDENT:IDENT` ordinaire tant qu'on n'exigeait que le
                 // deux-points immédiat.
                 && (peek(3).type === T.COLON
                     || (peek(3).type === T.PERIOD && peek(5).type === T.COLON))) {
        subject = current().value; advance(); advance(); // <sujet> :
      }
      const keyTok = current();
      // ── UN MEMBRE ACCEPTE CE QU'UNE VALEUR ACCEPTE AILLEURS ──────────────────────────────────
      // Décision Romain, 2026-08-19, posée comme un RETRAIT DE RESTRICTION et non comme trois
      // ajouts : le membre était le seul endroit du langage qui n'acceptait qu'un nom. Il accepte
      // désormais un nom, un nombre, ou un texte entre guillemets — `range(0, 127)`,
      // `registers("0", "1")`, et le vide `""`.
      //
      // ⚠️ LE NOMBRE PORTE SON SIGNE. `range(-1200, 1200)` vit dans la donnée d'aujourd'hui ; le
      // moins est un jeton à part, et l'oublier aurait rendu la borne basse illisible — ou pire,
      // lisible comme deux membres.
      //
      // ⛔ ET LE MEMBRE TEXTE SE MARQUE, parce que sa NATURE ne se relit pas dans son texte :
      // `"0"` et `0` s'écrivent pareil une fois la clé posée. Sans cette marque, un registre nommé
      // « 0 » ressortirait en nombre, et la donnée publiée changerait de type sans un mot.
      //
      // ⛔ ET UN MEMBRE EST UN MOT, PAS UN JETON. `ratios(100c, 200c)` ne rougissait pas : il
      // rendait QUATRE membres — `100`, `c`, `200`, `c`. Le tokenizer coupe entre le nombre et la
      // lettre qui le suit, et ce lecteur prenait UN SEUL jeton là où la VALEUR, elle, recolle ce
      // qui se touche : deux lecteurs du même sac, deux découpes, et une liste de cents doublait
      // de longueur sans un signe. Les cents sont 271 valeurs de la donnée d'aujourd'hui.
      // Le collage s'arrête à l'espace, à la virgule et à la parenthèse — ce qui sépare.
      if (!at(T.IDENT) && (at(T.INT) || at(T.FLOAT) || at(T.STRING)
                           || (at(T.REST) && (peek(1).type === T.INT || peek(1).type === T.FLOAT)
                               && !peek(1).spaceBefore))) {
        const signe = at(T.REST) ? advance().value : '';
        const t = advance();
        let mot = signe + t.value;
        // Un TEXTE porte son délimiteur : il est complet, rien ne s'y recolle.
        if (t.type !== T.STRING) {
          while ((at(T.IDENT) || at(T.INT) || at(T.FLOAT) || at(T.REST)) && !current().spaceBefore) {
            mot += String(advance().value);
          }
        }
        pairs.push({ key: mot, value: true,
                     ...(t.type === T.STRING ? { texte: true } : {}),
                     ...(subject !== null ? { subject } : {}),
                     line: keyTok.line, col: keyTok.col });
        finirTerme();
        continue;
      }
      let key = expect(T.IDENT).value;
      // ── `<librairie>.<contrôle>` — LE PRÉFIXE SE CONSOMME ICI, AVANT TOUTE LECTURE ───────────
      // RÈGLE DE ROMAIN (2026-08-13), déjà écrite dans `EBNF.md:153` : « Le préfixe est optionnel :
      // un nom nu passe s'il vit dans une seule librairie invoquée. Porté par deux, la compilation
      // s'arrête et nomme les deux candidats. »
      //
      // ⚠️ J'AVAIS ÉCRIT UNE BRANCHE À PART QUI RELISAIT LA VALEUR ELLE-MÊME, et c'était une
      // SECONDE GRAMMAIRE : elle ne connaissait que les valeurs simples, donc
      // `transpo.transpose:3/2` butait sur la barre de fraction (l'intervalle a son propre lecteur)
      // et `variation.velstep` — une clé SANS valeur — n'était pas reconnue du tout. La forme
      // préfixée doit accepter TOUT ce que la forme nue accepte ; le seul moyen de le garantir est
      // qu'elle passe par les MÊMES lecteurs. On consomme donc le préfixe, on garde le nom du
      // contrôle comme clé, et tout ce qui suit se lit comme d'habitude.
      //
      // Le discriminant est le NOM À GAUCHE — une librairie chargée, jamais une instance déclarée
      // par la scène : `lpf1.cutoff:400` reste un accès au port d'une instance.
      let libDuReglage = null;
      if (at(T.PERIOD) && peek(1).type === T.IDENT && !nomsVariables.has(key)
          && Object.prototype.hasOwnProperty.call(
               libCtx.controlsQualified || {}, `${key}.${peek(1).value}`)) {
        libDuReglage = key;
        advance();                       // .
        key = advance().value;           // le contrôle
      }
      refuserTempx(key, keyTok, '(');
      const pos = { line: keyTok.line, col: keyTok.col };
      const sub = { ...(subject !== null ? { subject } : {}), ...(libDuReglage ? { lib: libDuReglage } : {}) };
      // ── UNE CLÉ OUVRE UNE PARENTHÈSE — LA VALEUR EST UN OBJET ────────────────────────────────
      //
      // Décision Romain, 2026-08-19 : la récursivité des librairies s'exprime par les parenthèses
      // et le point ; l'indentation ne porte rien. Et le DEUX-POINTS DISPARAÎT DEVANT UNE
      // PARENTHÈSE — un signe, un rôle : le deux-points AFFECTE une valeur simple, la parenthèse
      // PORTE ce qui appartient à ce qui la précède.
      //
      //     range(min:16, max:8000)
      //     terminals(dha(voice:bayan_open), ta(voice:dayan_tap))
      //
      // ⛔ LA PARENTHÈSE GLOBALE PORTAIT DÉJÀ UN CORPS, ET C'EST TOUT CE QUI MANQUAIT. `def fort
      // (vel:100, dur:2)` rendait déjà ses deux couples structurés ; ce que le lecteur ne savait
      // pas faire, c'est qu'une CLÉ en ouvre une à son tour. Le geste est donc une RÉCURSION sur
      // le lecteur existant, pas une seconde grammaire — et c'est ce qui garantit qu'un niveau
      // profond accepte exactement ce qu'un niveau plat accepte.
      //
      // ⛔ ET CE QUI RENDAIT LE SUJET URGENT N'ÉTAIT PAS L'ABSENCE, C'ÉTAIT LE SILENCE VOISIN :
      // écrite avec le deux-points dans un corps indenté, `range:(16, 8000)` COMPILAIT et rendait
      // deux morceaux de texte — `["(16,", "8000)"]` — parce que ce qui suit un deux-points y est
      // découpé aux espaces. Une graphie acceptée qui ne porte rien perd la donnée sans un mot.
      // La forme sans deux-points sort de ce chemin par construction : elle est lue ici, ou
      // refusée. Jamais avalée.
      //
      // Le collage est exigé : `range (16, 8000)` séparé par une espace n'appartient pas à `range`.
      if (at(T.LPAREN) && !current().spaceBefore) {
        pairs.push({ key, value: parseRuntimeQualifier(), ...sub, ...pos });
        finirTerme();
        continue;
      }
      // CONTRÔLEUR NUMÉROTÉ — `cc.98:45` (graphie tranchée par Romain le 2026-07-26).
      // La règle d'or du langage appliquée à un cas qui n'avait pas été traité : le point APPELLE
      // le composant (le contrôleur numéro 98), les deux points AFFECTENT la valeur. Le langage
      // savait déjà nommer les contrôleurs qui ont un ALIAS (`mod` = CC1, `volume` = CC7) ; il ne
      // savait pas en désigner un QUELCONQUE, et c'est ce trou que la forme positionnelle
      // `cc(98,45)` bouchait de travers — en fabriquant du flux sans le point d'exclamation.
      // Déclaratif : `component:"number"` dans la lib, aucun nom de contrôle en dur ici.
      if (at(T.PERIOD) && universeComponentControls().has(key)) {
        advance(); // .
        if (!at(T.INT)) {
          throw new ParseError(
            `'${key}.…' désigne un composant NUMÉROTÉ : il attend un numéro, pas '${current().value}' `
            + `(exemple : '(${key}.98:45)'). Les contrôleurs qui ont un nom s'écrivent par leur nom`,
            current());
        }
        const component = Number(advance().value);
        if (!at(T.COLON)) {
          throw new ParseError(
            `'${key}.${component}' désigne un composant sans lui affecter de valeur — il manque `
            + `':valeur' (exemple : '(${key}.${component}:45)')`,
            current());
        }
        advance(); // :
        // Même règle que partout : la valeur commence immédiatement après le deux-points.
        if (current().spaceBefore) {
          throw new ParseError(
            `'${key}.${component}: ' — pas d'espace après le deux-points : la valeur commence `
            + `immédiatement ('${key}.${component}:${current().value}')`,
            current());
        }
        let valeur;
        if (at(T.REST)) { advance(); valeur = -Number(expect(T.INT).value); }
        else if (at(T.INT) || at(T.FLOAT)) valeur = Number(advance().value);
        else valeur = expect(T.IDENT).value;
        // `component` est un champ ADDITIF sur la paire : le contrat déclare les paires portées
        // OPAQUEMENT par BPx (AST_SPEC §« il ne les interprète jamais »), un champ de plus les
        // traverse donc sans rien casser. C'est le runtime de sortie qui sait qu'un CC a un numéro.
        pairs.push({ key, component, value: valeur, ...sub, ...pos });
        finirTerme();
        continue;
      }
      // `lpf1.cutoff:400` — le PORT d'une instance de module. Le point nomme le composant, le
      // deux-points lui affecte une valeur : la règle d'or du langage, appliquée à une instance.
      // Même forme d'arbre que le contrôleur numéroté `cc.98:45` — `component` porte ce que le
      // point appelle, jamais ce qui le précède.
      if (at(T.PERIOD) && nomsVariables.has(key) && peek(1).type === T.IDENT
          && peek(2).type === T.COLON) {
        advance();                                   // .
        const composant = advance().value;           // le port
        advance();                                   // :
        if (current().spaceBefore) {
          throw new ParseError(
            `'${key}.${composant}: ' — pas d'espace après le deux-points : la valeur commence `
            + `immédiatement ('${key}.${composant}:${current().value}')`, current());
        }
        let valeur;
        if (at(T.REST)) { advance(); valeur = -Number(expect(T.INT).value); }
        else if (at(T.INT) || at(T.FLOAT)) valeur = Number(advance().value);
        else valeur = expect(T.IDENT).value;
        pairs.push({ key, component: composant, value: valeur, ...sub, ...pos });
        finirTerme();
        continue;
      }
      // ⚠️ LE POINT SUIVI D'UNE VALEUR NOMME UN COMPOSANT, ET UN COMPOSANT A UN PROPRIÉTAIRE.
      // `lpf1.cutoff:400` n'a de sens que si `lpf1` est une instance que la scène a déclarée
      // par son type en tête (`lfo osc1`) ou un contrôle à composants (`cc.98:45`). Sans l'une des
      // deux, la lecture tombait dans la référence pointée d'en dessous — qui n'attend PAS de
      // valeur — puis butait au tour suivant sur « Expected IDENT, got COLON » : un message qui
      // désigne le deux-points alors que le défaut est le NOM, trois jetons plus tôt. Le langage
      // refuse la forme ; c'est le message qui ne disait pas laquelle.
      if (at(T.PERIOD) && peek(1).type === T.IDENT && peek(2).type === T.COLON) {
        throw new ParseError(
          `'${key}.${peek(1).value}:…' affecte une valeur au composant '${peek(1).value}' de `
          + `'${key}' — mais '${key}' n'est ni un contrôle à composants, ni une instance déclarée `
          + `dans cette scène. Déclarer l'instance d'abord : '<module> ${key}'`,
          keyTok);
      }
      // v0.8 — référence pointée : `sound.bell_short` (sans COLON)
      if (at(T.PERIOD)) {
        advance(); // .
        const name = expect(T.IDENT).value;
        pairs.push({ key, value: name, ...sub, ...pos });
        finirTerme();
        continue;
      }
      // ⚠️ LE REFUS « CE CONTRÔLE EST MOTEUR, IL S'ÉCRIT ENTRE CROCHETS » A ÉTÉ RETIRÉ LE
      // 2026-08-07, ET IL CONTREDISAIT UNE DÉCISION DATÉE DE CINQ JOURS.
      //
      // `hub/decisions/2026-08-02-le-crochet-est-reserve-aux-gardes-les-reglages-passent-en-
      // parentheses.md` : « **Tout réglage s'écrit entre parenthèses, moteur compris.** » Et :
      // « Le signe n'adresse rien : le domaine de la clé le fait. » Le code faisait exactement
      // l'inverse — il se servait du SIGNE pour adresser, et refusait la parenthèse à tout ce que
      // `lib/controls.json` range dans sa section `engine`.
      //
      // Une exemption partielle avait été posée (`qualifierKeys` : mode, scan, weight, on_fail,
      // meter), donc la décision était connue et appliquée À SIX CLÉS au lieu de la famille. Le
      // reste — `rndtime` en tête — restait refusé, et la bible l'écrit en parenthèses
      // (`S -> C4 (rndtime:100) D4 E4`). Une exemption ouverte à la taille des cas du jour est une
      // exemption qui laisse tout le reste dehors : même faute que `isReservedSettingParen()`,
      // retirée le même jour, à quelques heures près.
      //
      // ⚠️ ET LA FORME EST CELLE DU MOTEUR NATIF, mesuré : `-da.checkNoteOff` écrit
      // `_rndtime(50) {1/16, C4 - E4 F4}` et `_tempo(1/2) _rndtime(50) _scale(…)` — un contrôle
      // POSÉ DANS LE FLUX, là où il prend effet. La bible ne s'écarte donc pas de BP3 ; c'est le
      // refus qui s'écartait des deux.
      //
      // CE QUI RESTE REFUSÉ, et c'est une autre famille : les PROCÉDURES de niveau règle
      // (`goto`, `failed`, `repeat`, `stop`) posées dans le flux — elles ne s'appliquent pas à une
      // POSITION, elles valent pour la règle entière (`universeRuleScopeControls`, plus haut).
      if (at(T.COLON)) {
        advance();
        // JAMAIS D'ESPACE APRÈS LE DEUX-POINTS (arbitrage Romain 2026-07-26). La valeur commence
        // immédiatement ; l'espace ne sert QU'À séparer les parties d'une valeur. Deux espacements
        // pour la même règle, et un lecteur ne peut plus déduire ce que l'espace signifie — c'est
        // le signe à deux métiers qu'on a passé la journée à supprimer.
        // ⚠️ L'espace ENTRE les parties reste légitime : `(keymap:C3 C3 C5 C5)` est juste.
        if (!at(T.RPAREN) && !atEnd() && current().spaceBefore) {
          throw new ParseError(
            `'${key}: ' — pas d'espace après le deux-points : la valeur commence immédiatement `
            + `('${key}:${current().value}…'). L'espace ne sépare que les PARTIES d'une valeur`,
            current());
        }
        // RÉGLAGE RÉSERVÉ — même lecteur de valeur que le résidu `[]` (readQualifierValue),
        // pour que `(weight:50-12)` et `(meter:4+4/6)` gardent le même format qu'avant leur
        // migration en parenthèses (décrément et signature temporelle compris).
        //
        // ⚠️ SAUF pour un réglage dont la valeur porte PLUSIEURS PARTIES séparées par une espace
        // (`goto:2 1`, `failed:3 2` — `args` en déclare deux dans lib/controls.json) : lecteur
        // MONO-valeur, `readQualifierValue` ne lit qu'un seul jeton et laisse pendre le reste
        // (`Expected IDENT, got INT`). Ces clés tombent donc dans le lecteur générique
        // multi-parties plus bas (celui qui sert déjà `keyxpand`), piloté par la DONNÉE
        // (`args.length`), jamais par un nom en dur — et lu à l'échelle de l'UNIVERS
        // (`universeSacs().specs`) pour rester disponible sans `controls`, comme tout réglage
        // réservé.
        const specReglage = universeSacs().specs && universeSacs().specs[key];
        const reglageMultiPartie = specReglage && Array.isArray(specReglage.args) && specReglage.args.length > 1;
        if (libCtx.qualifierKeys.has(key) && !reglageMultiPartie) {
          const { value, decrement } = readQualifierValue();
          if (value === undefined) {
            // EXEMPLE DE VALEUR LU DANS LA DONNÉE (`specReglage.values[0]`), jamais un nom en dur
            // (étape 3, règle 5) — le ternaire `key === 'mode'` était mort : `mode` n'est plus une
            // `qualifierKey` depuis le 2026-08-08 (décision Romain, `lib/core.json`
            // schema.qualifierKeys), donc cette branche ne pouvait plus l'atteindre.
            const exemple = (specReglage && Array.isArray(specReglage.values) && specReglage.values[0]) || '…';
            throw new ParseError(
              `'(${key}:)' n'affecte aucune valeur — le deux-points en attend une (par exemple `
              + `'(${key}:${exemple})')`,
              keyTok);
          }
          // DEUX ÉLÉMENTS SÉPARÉS PAR UNE ESPACE, SANS VIRGULE — même garde que le résidu `[]`
          // (gardeElement, parseQualifier) : sans elle, `(mode:random weight:50)` avalait le
          // second élément en silence au lieu de réclamer sa virgule.
          if (at(T.IDENT) && peek(1).type === T.COLON) {
            throw new ParseError(
              `'(${key}:… ${current().value}:…)' : deux ÉLÉMENTS du sac séparés par une ESPACE — `
              + `il leur manque une VIRGULE ('(${key}:…, ${current().value}:…)'). L'espace ne `
              + `sépare que les PARTIES d'une même valeur`,
              current());
          }
          pairs.push({ key, value, decrement, ...sub, ...pos });
          finirTerme();
          continue;
        }
        // Contrôle interval-typé (transpose…) : lire un littéral d'intervalle, porté brut.
        // Univers du registre (pas seulement le libCtx de la scène) : un mot USABLE est valide
        // qu'on ait chargé controls ou non — cohérent avec la directive globale et le garde des `[]`.
        if ((libCtx.intervalControls && libCtx.intervalControls.has(key)) || universeIntervalControls().has(key)) {
          pairs.push({ key, value: readIntervalLiteral(key), ...sub, ...pos });
          finirTerme();
          continue;
        }
        // VALEUR D'UNE PAIRE — la VIRGULE la ferme, et rien d'autre (décision Romain
        // 2026-07-26, « un rôle par signe »). L'espace sépare les PARTIES d'une valeur,
        // la virgule sépare les ÉLÉMENTS du sac : `(keymap: C3 C3 C5 C5, vel:80)` = deux
        // éléments, dont le premier a quatre parties.
        //
        // CE QUE CETTE SIMPLICITÉ REMPLACE. Ce lecteur portait sept conditions d'arrêt et une
        // boucle de continuation, toutes nées d'un seul défaut : la virgule faisait DEUX métiers
        // (séparer les paires ET joindre les parties d'une valeur, `keyxpand:C4,2`). Il fallait
        // donc deviner, à chaque virgule, lequel des deux — et la devinette s'appuyait sur le
        // registre des contrôles, ce qui couplait le parseur au vocabulaire. Ne laisser à la
        // virgule qu'un seul métier supprime la question au lieu de la contourner.
        // Effet de bord réparé au passage : une valeur qui COMMENÇAIT par un nombre ne
        // collectait pas sa suite (`switchon: 64 1` échouait là où `scale: todi_ka_4 0` passait).
        // Combien de PARTIES ce contrôle attend-il ? La donnée le dit (`args` dans la lib) — c'est
        // la seule façon de trancher, et aucune expression régulière ne le peut : `(keyxpand:B3 -1)`
        // est JUSTE (deux parties d'UNE valeur) tandis que `(vel:50 pan:7)` est FAUX (deux ÉLÉMENTS
        // d'un sac, qui se séparent par une virgule). Les caractères sont les mêmes ; seul le
        // registre distingue. Constat bpx [806].
        const specCle = (libCtx.controls && libCtx.controls[key]) || null;
        const monoPartie = specCle && Array.isArray(specCle.args) && specCle.args.length === 1;
        const parts = [];
        let deuxPointsEnTrop = null;
        let elementAvale = null;
        // ⛔ UN TEXTE ENTRE GUILLEMETS RESTE UN TEXTE, et le VIDE est une valeur. Décision Romain,
        // 2026-08-19 : « le vide s'écrit comme un texte vide — le délimiteur, sans rien dedans ».
        // Deux défauts se ferment ici, tous deux MUETS :
        //   `x:"0"`  rendait le NOMBRE 0 — les guillemets s'effaçaient avec le type qu'ils portent,
        //            et `registers("0", "1")` aurait publié des nombres là où la donnée porte des
        //            noms de registre ;
        //   `x:""`   était refusé comme « n'affecte aucune valeur » — le lecteur ne distinguait pas
        //            ce qui n'est PAS ÉCRIT de ce qui est écrit VIDE. Le nul et l'absence sont deux
        //            choses, et un lecteur qui les confond en perd une.
        let jetons = 0;
        let texteSeul = null;
        let backtickSeul = null;
        while (!at(T.RPAREN) && !at(T.COMMA) && !atEnd()) {
          // Un contrôle qui n'attend QU'UNE partie ne peut pas en avaler une seconde : ce qui suit
          // est un autre ÉLÉMENT du sac, et il lui manque sa virgule.
          if (monoPartie && parts.length > 0 && at(T.IDENT) && libCtx.controlNames.has(current().value)) {
            elementAvale = current(); break;
          }
          // Un SECOND deux-points dans la valeur : `(cc:98:45)`. Le deux-points AFFECTE, il ne
          // sépare pas — une paire en porte donc exactement UN. C'est la graphie qu'on obtient en
          // cherchant à désigner un composant sans connaître le point : elle doit tomber, sinon
          // elle fabrique la valeur muette « 98:45 » que personne en aval ne sait relire.
          if (at(T.COLON) && !deuxPointsEnTrop) deuxPointsEnTrop = current();
          if (parts.length > 0 && current().spaceBefore) {
            // ⛔ UNE VALEUR N'A QU'UNE PARTIE DANS LE DÉCLARATIF. Plusieurs parties sont plusieurs
            // valeurs, et plusieurs valeurs s'écrivent par une parenthèse et des noms. Le refus
            // porte sa RÉÉCRITURE : un mot hors de sa place se refuse avec la forme qui le remplace.
            if (enDeclaratif) {
              throw new ParseError(
                `'${key}:${parts.join('')} ${current().value}…' : dans la partie DÉCLARATIVE, seule `
                + `la virgule sépare — l'espace n'y sépare rien. Une valeur n'a qu'UNE partie ; `
                + `plusieurs parties sont plusieurs valeurs, et elles s'écrivent par une parenthèse `
                + `et des noms : '${key}(${parts.join('')}, ${current().value}…)'. Dans le FLUX, `
                + `après le délimiteur, l'espace sépare les termes comme avant.`,
                current());
            }
            parts.push(' ');
          }
          texteSeul = (jetons === 0 && at(T.STRING)) ? current().value : null;
          backtickSeul = (jetons === 0 && at(T.BACKTICK)) ? current().value : null;
          jetons++;
          parts.push(advance().value);
        }
        const brut = parts.join('');
        if (elementAvale) {
          throw new ParseError(
            `'(${key}:${brut} ${elementAvale.value}…)' : '${key}' n'attend qu'UNE valeur, donc `
            + `'${elementAvale.value}' est un autre ÉLÉMENT du sac — il lui manque sa VIRGULE `
            + `('${key}:${brut}, ${elementAvale.value}…'). L'espace ne sépare que les PARTIES d'une `
            + `même valeur`,
            elementAvale);
        }
        if (deuxPointsEnTrop) {
          throw new ParseError(
            `'(${key}:${brut})' : le deux-points AFFECTE une valeur, il n'en sépare pas les parties `
            + `— une paire n'en porte qu'un. Pour désigner un composant numéroté, le point l'appelle `
            + `('(${key}.${brut.split(':')[0]}:${brut.split(':').slice(1).join(':')})') ; pour plusieurs `
            + `parties, l'espace les sépare`,
            deuxPointsEnTrop);
        }
        if (jetons === 0) {
          throw new ParseError(
            `'(${key}:)' n'affecte aucune valeur — le deux-points en attend une (par exemple `
            + `'(${key}:80)'), et un contrôle sans argument s'écrit nu, sans deux-points. Un texte `
            + `VIDE s'écrit '${key}:""' : le délimiteur, sans rien dedans`,
            keyTok);
        }
        // Une valeur d'UNE SEULE partie numérique reste un NOMBRE (`vel:80` → 80, `pan:-1` → -1) :
        // les consommateurs la lisent ainsi. Plusieurs parties = chaîne portée brute, découpée
        // par l'aval qui seul connaît l'opération. Un TEXTE délimité échappe à la coercition :
        // ce que les guillemets portent est du texte, y compris quand il ressemble à un nombre.
        // ⛔ L'ÉTIQUETTE D'UN BACKTICK SE LIT LÀ OÙ IL EST ÉCRIT, y compris dans une valeur.
        // Elle ne l'était PAS ici : `x:`sc: a+1`` rendait le texte « sc: a+1 », étiquette comprise,
        // et le backtick n'était donc lu comme du code à AUCUN degré dans une valeur déclarative.
        // Le générateur de librairies retirait le préfixe `txt:` lui-même, à un étage plus bas :
        // c'est le même travail, fait au mauvais endroit et par un seul des lecteurs.
        // Mesure avant la bascule : 361 valeurs en backtick dans les neuf sources de librairie,
        // TOUTES étiquetées `txt`, et ZÉRO valeur déclarative en backtick dans les 69 scènes.
        let val;
        if (jetons === 1 && backtickSeul !== null) {
          const t = tryBacktickTag(backtickSeul);
          // `txt:` DÉLIMITE UNE PHRASE — sa valeur est son texte. Toute autre étiquette nomme un
          // LANGAGE : la valeur porte alors le code et son interprète, comme partout ailleurs.
          val = !t ? backtickSeul
            : (t.tag === 'txt' ? t.code
              : { type: 'BacktickInline', code: t.code, tag: t.tag });
        } else {
          val = texteSeul !== null && jetons === 1 ? texteSeul
            : (/^-?\d+(\.\d+)?$/.test(brut) ? Number(brut) : brut);
        }
        // ⛔ ET LA NATURE D'UNE VALEUR SE MARQUE, COMME CELLE D'UN MEMBRE. `"4"` et `4` s'écrivent
        // pareil une fois la clé posée, et un lecteur d'aval qui les retype confond le NOM d'un
        // registre avec son RANG. Mesuré sur `octaves.western`, qui porte `default:"4"` : la
        // donnée publiée en rendait `4`, indistinguable du rang qu'on venait de retirer — et pour
        // `bp3` le nombre 4 désigne le registre nommé « 3 ». Le décalage d'un cran, silencieux,
        // dans le geste même qui existe pour le supprimer.
        // La marque, jamais le type JS seul : les librairies en corps indenté rendent TOUT en
        // chaîne, donc « c'est une chaîne » n'y dit rien de la graphie écrite.
        const valeurEstUnTexte = texteSeul !== null && jetons === 1;
        // ⛔ UNE VALEUR DONNÉE À UN CONTRÔLE QUI N'EN PREND PAS EST REFUSÉE. Signalé à BPx pendant
        // leur migration : `!(order:0)` compilait et portait `0` jusqu'à l'arbre, alors que la
        // donnée déclare `order` sans aucun argument. Une valeur sans destinataire voyage jusqu'à
        // l'aval, où rien ne l'attend et où rien ne dit qu'elle ne sert à rien — plus discret
        // qu'un refus, et plus coûteux, parce que le consommateur peut la lire.
        // ⚠️ LA RÈGLE ÉTAIT DÉJÀ ÉNONCÉE SIX LIGNES PLUS HAUT, dans le message du sac vide —
        // « un contrôle sans argument s'écrit nu, sans deux-points » — et n'était appliquée nulle
        // part. Une règle écrite dans un message d'erreur voisin n'est pas une garde.
        // ⚠️ ET J'AI MIS QUATRE TENTATIVES À TROUVER CE SITE : j'ai posé cinq refus sur des
        // `pairs.push` qui ne sont jamais atteints pour cette forme, sans jamais vérifier lequel
        // s'exécute. Cinq lignes mortes ajoutées en croyant corriger. Ce qui a marché du premier
        // coup : instrumenter CHAQUE site avec son numéro de ligne et lire lequel parle. Deviner
        // où passe le code coûte plus cher que le tracer, et laisse des traces derrière soi.
        if (isNoArgControl(key)) {
          throw new ParseError(
            `'(${key}:${brut})' : '${key}' ne prend AUCUN argument — sa déclaration n'en nomme pas. `
            + `Écrire '${key}' seul. Une valeur posée ici voyagerait jusqu'au runtime sans `
            + `destinataire, sans que rien ne signale qu'elle ne sert à rien.`,
            keyTok);
        }
        pairs.push({ key, value: val, ...(valeurEstUnTexte ? { texte: true } : {}), ...sub, ...pos });
      } else {
        // Bare key (no-arg control like velcont, pitchcont)
        pairs.push({ key, value: true, ...sub, ...pos });
      }
      finirTerme();
    }
    expect(T.RPAREN);
    return { type: 'SettingBag', pairs };
  }

  function isPerElementQualifier() {
    // [IDENT:...] or [IDENT] where IDENT is a known control name = per-element qualifier
    // Used for engine qualifier [speed:2]A or A[weight:50] or {[retro] A}
    if (!at(T.LBRACKET)) return false;
    const nextTok = peek(1);
    if (nextTok.type !== T.IDENT) return false;
    return libCtx.controlNames.has(nextTok.value);
  }

  // PIERRE TOMBALE — le suffixe arobase (`C4kick`, `{A B}groove`) est SUPPRIMÉ du langage
  // (Romain, 2026-07-28 : « on supprime, tu n'as pas pu me prouver que ça avait une utilité
  // quelconque »). Son motif, mot pour mot : ASSOCIER DANS LA PRODUCTION se fait déjà avec le
  // point d'exclamation ; DÉCLARER UNE ÉTIQUETTE se fait dans la partie déclarative. Deux voies
  // existantes couvraient les deux besoins — cette forme n'en avait aucun à elle.
  // État mesuré au retrait : aucune décision datée ne la fondait, sa seule caractérisation écrite
  // la disait ignorée, son usage documenté visait la directive de correspondance désormais morte,
  // et ZÉRO scène l'écrivait sur tout l'écosystème.
  //
  // ⚠️ EN FONCTION, appelée par TOUS les endroits qui lisent un élément — pas seulement le flux de
  // premier niveau. Écrite d'abord à un seul endroit, elle laissait le suffixe se faire refuser
  // DANS UNE VOIX POLYMÉTRIQUE par un message générique (« accolade fermante attendue ») : la
  // forme disparaissait bien, mais celui qui l'écrivait n'apprenait rien. Trouvé par la matrice
  // du garde, pas par relecture.
  function refuserSuffixeArobase() {
    if (!at(T.AT) || current().spaceBefore) return;
    const nom = peek(1).type === T.IDENT ? peek(1).value : 'nom';
    throw new ParseError(
      `le suffixe '${nom}' collé à un élément est SUPPRIMÉ du langage (décision Romain `
      + `2026-07-28). Deux écritures le remplacent, selon ce qu'on voulait faire. Pour ASSOCIER `
      + `un geste à un élément DANS LA PRODUCTION : le point d'exclamation, `
      + `'C4!${nom}' — le geste se déclenche à l'instant du terminal sans occuper de pas. Pour `
      + `DÉCLARER UNE ÉTIQUETTE : la partie déclarative, par 'def'.`, current());
  }

  function parseRhsElement() {
    const tok = current();

    // Lambda (check for ! after)
    if (at(T.LAMBDA)) {
      advance();
      if (at(T.BANG)) {
        return parseSimultaneousGroup('lambda', tok);
      }
      return { type: 'NilString' };
    }

    // Silence -
    if (at(T.REST)) {
      advance();
      return { type: 'Rest' };
    }

    // Prolongation _ — et REFUS de la graphie native `_nom(args)`.
    //
    // ⛔ LA GRAPHIE `_nom(...)` EST REFUSÉE — décision Romain du 2026-08-12. Ce n'était pas une
    // tolérance, c'était un CONTOURNEMENT : elle vivait ici, dans le parseur, et la bible ne l'a
    // jamais mentionnée. Aucune forme du langage n'existe sans sa validation, et celle-ci n'en
    // avait aucune : elle routait TOUT identifiant collé à un `_` vers un contrôle, sans le
    // confronter au catalogue. `_xyzzy(1)` compilait exactement comme `_transpose(2)`, avec la
    // même étiquette — une scène pouvait porter un contrôle inexistant, passer sans un mot et ne
    // rien produire.
    //
    // ⛔ ET C'EST CE MÊME GESTE QUI FERME LES DEUX PORTES. La forme du langage `!(clé:valeur)`
    // validait DÉJÀ ses noms — `!(xyzzy:1)` était refusé bien avant cette décision. La seule voie
    // par où un contrôle non déclaré entrait était celle-ci. En la fermant, « un contrôle non
    // déclaré par une librairie ne compile pas » devient vrai sans exception.
    //
    // LE REFUS NOMME LA FORME ATTENDUE, il n'est pas muet : qui écrivait `_vel(120)` lit quoi
    // écrire à la place. C'est la condition posée par Romain, et c'est ce qui sépare une
    // migration d'un mur.
    if (at(T.PROLONG)) {
      // La graphie ne se reconnaît QUE si l'IDENT est collé au `_` (pas d'espace) — disambiguation
      // collé/espacé, cohérente avec |[…]. Un `_` suivi d'un ESPACE puis d'un contrôle en forme
      // nue (`_ value(…)`, `_ _ vel(…)`) est une PROLONGATION AUTONOME + un contrôle séparé :
      // sans ce garde, le refus happerait le `_` de prolongation et accuserait la mauvaise ligne.
      if (peek(1).type === T.IDENT && peek(2).type === T.LPAREN && !peek(1).spaceBefore) {
        const nom = peek(1).value;
        // LA FORME ATTENDUE SE LIT DANS LE CATALOGUE, ELLE NE SE DÉDUIT PAS DU NOM NATIF.
        //
        // Traduire `_nom(…)` en `!(nom:…)` marche pour la plupart des contrôles et MENT pour ceux
        // que BPScript a renommés : le `_transpose` du natif est `chromashift` ici — la clé
        // `transpose`, elle, existe AUSSI et désigne un AUTRE geste (transposition réelle, ancre
        // préservée). Un message qui dirait « écrire !(transpose:…) » ferait changer le geste en
        // silence, ce qui est précisément le piège que le champ `bp3` des librairies existe pour
        // fermer. On cherche donc la clé qui DÉCLARE ce nom natif, et on ne retombe sur le nom nu
        // que si aucune ne le revendique.
        // ⚠️ ON LIT LA DÉCLARATION, JAMAIS `controlMap` : celui-ci retombe sur `_<clé>` quand une
        // clé ne déclare rien, si bien que DEUX clés y « revendiquent » `_transpose` — `chromashift`
        // qui le déclare, et `transpose` qui hérite du défaut calculé sur son propre nom. Chercher
        // là rendrait la première venue, c'est-à-dire justement celle qu'il ne faut pas nommer.
        const cle = Object.keys(libCtx.controls || {}).find((k) => libCtx.controls[k].bp3 === `_${nom}`) || nom;
        const renomme = cle !== nom;
        throw new ParseError(
          `la graphie « _${nom}(…) » est celle du moteur natif BP3, elle n'appartient pas à BPScript — `
          + `écrire « !(${cle}:…) » à la place`
          + (renomme ? ` (le « _${nom} » natif se dit « ${cle} » en BPScript, et la clé « ${nom} » désigne un AUTRE geste)` : ''),
          peek(1),
        );
      }
      advance();
      return { type: 'Prolongation' };
    }

    // Undetermined rest ...
    if (at(T.UNDETERMINED)) {
      advance();
      return { type: 'UndeterminedRest' };
    }

    // Objet sonore composé |[ … ] (ratifié Romain 2026-07-18) : Symbol dont le nom est la suite
    // concaténée (le tokenizer a déjà strippé les blancs, ex. do5_do5do5). Forme canonique alignée
    // sur ce que le frontal émet pour do5_do5do5 : Symbol{name, payload:{nature:'sounding'}} — le
    // payload est posé par annotateRhsNode (type 'Symbol'). Nom littéral : pas de normalizeName.
    if (at(T.COMPOUND)) {
      const t = advance();
      // ⚠️ LE NOM FORMÉ EST UN TERMINAL, et il était REFUSÉ comme s'il n'en était pas un.
      // `LANGUAGE.md` §« L'objet sonore composé » : « Le nom ainsi formé se pose dans le flux comme
      // un terminal ORDINAIRE, et son contenu est opaque à la dérivation : il fait partie du nom. »
      // Le parseur FORMAIT bien le nom, puis le contrôle du vocabulaire le rejetait — « terminal
      // 'C4E4G4' non déclaré » — parce qu'aucun alphabet ne porte évidemment le concaténé.
      // Les PARTIES voyagent avec lui : opaque à la DÉRIVATION ne veut pas dire opaque au contrôle
      // du vocabulaire, et sans elles une faute de frappe à l'intérieur serait muette.
      return { type: 'Symbol', name: t.value, compose: t.parties || [], line: t.line };
    }

    // Period .
    if (at(T.PERIOD)) {
      advance();
      return { type: 'Period' };
    }

    // Labeled polymetric: label:{...}
    if (at(T.IDENT) && peek(1).type === T.COLON && peek(2).type === T.LBRACE) {
      const label = advance().value;  // consume IDENT
      advance();                       // consume COLON
      if (hasMatchingBrace()) {
        return parsePolymetric(label);
      }
      // Unbalanced { after label: — emit label as symbol, colon was consumed
      return { type: 'Symbol', name: normalizeName(label), line: tok.line };
    }

    // Polymetric { ... } or unbalanced brace (embedding pattern)
    if (at(T.LBRACE)) {
      if (hasMatchingBrace()) {
        return parsePolymetric(null);
      }
      // Unbalanced { — emit as raw token for BP3 embedding patterns
      advance();
      return { type: 'RawBrace', value: '{' };
    }


    // Variable |x|
    if (at(T.PIPE)) {
      return parseVariable();
    }

    // Wildcard ?  ?1
    if (at(T.QUESTION)) {
      return parseWildcard();
    }

    // Template master $X
    if (at(T.DOLLAR)) {
      return parseTemplateMaster();
    }

    // Template slave &X
    if (at(T.AMPERSAND)) {
      return parseTemplateSlave();
    }

    // Tilde ~ (tie)
    if (at(T.TILDE)) {
      advance();
      if (at(T.IDENT)) {
        const name = advance().value;
        if (at(T.TILDE)) {
          advance();
          return { type: 'TieContinue', symbol: name };
        }
        return { type: 'TieEnd', symbol: name };
      }
      throw new ParseError('Expected symbol after ~', tok);
    }

    // Standalone ! → out-time object, instant control, or simultaneous
    if (at(T.BANG)) {
      // RÈGLE D'ESPACE sur `!(...)` (décision Romain 2026-06-20) : `C4!(...)` COLLÉ (pas d'espace
      // avant `!`) = flux CONJOINT ancré au terminal précédent (voyage avec lui, répliqué si lui).
      // `C4 !(...)` ESPACÉ = flux ÉVÉNEMENT SÉPARÉ (non conjoint, posé seul). On capte l'espace
      // ici ; la validation « il existe bien un terminal précédent » est faite à l'annotation.
      // ⚠️ « COLLÉ » VEUT DIRE COLLÉ À UN TERME, PAS « SANS ESPACE À GAUCHE ». Un `!` qui ouvre
      // une voix, un groupe ou un membre droit n'a AUCUN terme derrière lui : il ne peut pas être
      // conjoint, quoi que dise l'espace. `{! (/2) C4, D4}` pose la vitesse en TÊTE de voix,
      // exactement comme `{ ! (/2) C4, D4}` — l'accolade n'est pas un terminal.
      //
      // Mesuré le 2026-08-06 par Kanopi, reproduit ici : la seconde écriture passait, la première
      // était REFUSÉE, et mon message accusait l'espace — que l'auteur avait pourtant mis. Coût
      // réel : 178 espaces posés après des accolades pour réparer quatre scènes, en cherchant du
      // côté que mon message désignait. Un refus JUSTE dont la CAUSE est fausse envoie son lecteur
      // corriger ce qui n'a rien à voir ; c'est la même famille que « ça compile ≠ ça veut dire ce
      // que la phrase dit », côté diagnostic.
      // ⚠️ Et ce n'était pas qu'un défaut de message : le refus LUI-MÊME était faux.
      // Noms pris dans le tokenizer, pas de mémoire : j'en avais inventé trois sur quatre au
      // premier jet (`T.ARROW`, `T.ARROW_LEFT`, `T.ARROW_BOTH` n'existent pas), ce qui met
      // `undefined` dans l'ensemble et le fait correspondre à tort.
      const OUVRANTS = new Set([T.LBRACE, T.LPAREN, T.LBRACKET, T.COMMA,
                                T.ARROW_R, T.ARROW_L, T.ARROW_BI, T.NEWLINE]);
      for (const t of OUVRANTS) if (t === undefined) throw new Error('OUVRANTS porte un type de jeton inexistant');
      const precedent = peek(-1);
      const collated = !current().spaceBefore && precedent !== undefined
                    && !OUVRANTS.has(precedent.type);
      advance();
      // ! (/N) · ! (*N/M) → CHANGEMENT DE VITESSE posé dans le flux.
      // La bible en donne l'écriture et la place : LANGUAGE.md:1249 (« ! (/N) · ! (*N/M) —
      // changement de vitesse posé dans le flux ») et :2267 (« /N accélère, et *N/M écrit la
      // MÊME chose en fraction inverse : *a/b vaut /(b/a) »). Un seul opérateur, deux graphies.
      //
      // ⚠️ IL SE POSE SEUL, JAMAIS COLLÉ À UN TERME. La vitesse court « à partir d'ici » et
      // jusqu'à la fin du champ (LANGUAGE.md:2254) : elle ne voyage pas avec un terminal et ne
      // se réplique pas avec lui. C'est ce que dit le tableau des portées d'`AST.md` — ❌ en
      // `!accolé`, ✅ en `!inline` seulement. `C4!(/2)` est donc refusé, et nommé.
      // ⚠️ L'ÉTOILE SERT DEUX FOIS DANS UN SAC, et le discriminant est ce qui la SUIT : un NOMBRE
      // en fait une vitesse (`! (*3/2)`), un DEUX-POINTS en fait le sujet « chaque terminal de la
      // portée » (`!(*:vel:80)`, tableau des portées de `LANGUAGE.md`). Sans ce départage, la
      // vitesse happait le sujet et le refusait au nom d'une forme qu'il n'avait jamais prétendu
      // être — c'est la seule position du langage où les deux se rencontrent.
      if (at(T.LPAREN) && (peek(1).type === T.SLASH
                           || (peek(1).type === T.STAR && peek(2).type !== T.COLON))) {
        if (collated) {
          throw new ParseError(
            `'!(…)' collé à un terme porte un flux CONJOINT, qui voyage avec ce terme et se `
            + `réplique avec lui — une vitesse ne fait ni l'un ni l'autre : elle court à partir `
            + `d'où elle est posée jusqu'à la fin du champ. Elle se détache par une espace : `
            + `'… ! (${peek(1).type === T.STAR ? '*N/M' : '/N'})'`,
            current());
        }
        return { type: 'InstantControl', qualifier: parseVitesseParenthese(), conjoint: false };
      }
      // !(...) → sac posé dans le FLUX. Reconnaissance SYNTAXIQUE, comme le suffixe de règle.
      //
      // ⚠️ CE CHEMIN N'AVAIT PAS SUIVI LA CORRECTION DU MATIN, ET MON PROPRE COMMENTAIRE LA
      // PRESCRIVAIT (`isRuntimeQualifierLoose` : « partout où le sac est séparé par une espace ou
      // introduit par `!`, aucune ambiguïté ne subsiste, donc la forme seule décide »). Il testait
      // encore le registre des CONTRÔLES, peuplé par le seul `controls` — donc sans cette
      // directive, `S -> C4 !(vel:70) D4` était refusé pendant que `S -> C4 D4 (vel:70)` et
      // `S -> {C4 D4}(vel:70)` passaient. La même écriture, lue à deux endroits, refusée au
      // troisième : la définition exacte de l'exception cachée que la bible dit ne pas avoir.
      // Deux blocs de `LANGUAGE.md` tombaient dessus, et le message accusait le point
      // d'exclamation alors que le défaut était le registre.
      //
      // Après `!`, la parenthèse ne peut être QUE cela : la vitesse et le câblage sont lus
      // au-dessus, il ne reste aucune autre construction à confondre.
      if (sacBienForme()) {
        return { type: 'InstantControl', qualifier: parseRuntimeQualifier(), conjoint: collated };
      }
      // ![seed:N] → directive de production DANS LE FLUX. Restreint à `seed` :
      // seul `_srand` existe comme contrôle de flux BP3 (décision 2026-06-14). Émet _srand(N).
      // ── LA RE-SEMENCE DANS LE FLUX : `![seed:N]`, SANS AROBASE ────────────────────────────
      // DÉCISION ROMAIN (2026-08-10), mot pour mot : « 3 je suis d'accord : ![seed:N] dans le
      // flux ». Le motif, qu'il a validé : le crochet porte ce qui gouverne la DÉRIVATION, et une
      // re-semence en flux est une PROCÉDURE de dérivation — famille de `goto`, `repeat`,
      // `failed`, `stop`. L'arobase est réservée au global et à la tête de scène.
      //
      // ⚠️ DEUX NATURES, DEUX GRAPHIES, et c'est le fond : `seed:42` en tête de scène est un
      // RÉGLAGE DE PRODUCTION ; `![seed:N]` en flux est une PROCÉDURE. Elles cessaient d'être le
      // même bloc à un signe près, et c'est ce que cette écriture sépare.
      //
      // ⚠️ L'OBJET DE L'ARBRE NE CHANGE PAS — question posée par BPx avant que je frappe, et sa
      // réponse décidait de l'ordre des gestes. `![seed:42]` produit le MÊME `InstantControl` /
      // `ProductionInline` que `![seed:42]` produisait : son chargeur (loadGrammar.ts:8284) lit
      // cet objet, pas le texte, donc il n'a rien à frapper. Ce qui a été tranché est la GRAPHIE ;
      // changer la nature de l'objet serait un second changement, que personne n'a demandé.
      // ⚠️ LE MOT EST LU DANS LA LIBRAIRIE, PAS ÉCRIT ICI — mais la PORTÉE ne suffit pas à ouvrir
      // le crochet, et c'est ce qui interdit de généraliser. `retro`, `shuffle`, `rotate` et
      // `order` déclarent eux aussi `flow` et s'écrivent `!(retro)`, entre PARENTHÈSES. La portée
      // dit OÙ un mot vaut, jamais SOUS QUEL SIGNE il s'écrit ; les confondre rendrait `![retro]`
      // écrivable, ce que personne n'a décidé.
      // Ce que la donnée gouverne donc ici : `![X]` exige que `X` déclare la portée `flow`. Le
      // jour où un second mot reçoit le crochet, il s'ajoute par sa donnée et par la liste
      // ci-dessous, jamais par la donnée seule.
      if (at(T.LBRACKET) && peek(1).type === T.IDENT) {
        const nom = peek(1).value;
        const CROCHET_EN_FLUX = new Set(['seed']);   // graphie ratifiée : `![seed:N]` (Romain)
        if (CROCHET_EN_FLUX.has(nom) && !directiveDeclareeParLaLibrairie('engine', nom)) {
          throw new ParseError(
            `'![${nom}:…]' : '${nom}' n'est plus déclaré par la librairie 'engine'. La re-semence en `
            + `flux traduit le '_srand(N)' natif, et le mot qui la porte vient d'une librairie `
            + `comme tous les autres.`, current());
        }
        if (CROCHET_EN_FLUX.has(nom)) {
          const ouvre = current();
          advance();                                   // '['
          advance();                                   // 'seed'
          let value = null, runtime = null;
          if (at(T.COLON)) { advance(); ({ value, runtime } = parseDirectiveColonValue('seed')); }
          expect(T.RBRACKET);
          const dirs = [{ type: 'Directive', name: 'seed', subkey: null, runtime, value,
                          aliases: null, modifiers: null, line: ouvre.line }];
          return { type: 'InstantControl', qualifier: { type: 'ProductionInline', directives: dirs } };
        }
      }
      // L'ANCIENNE GRAPHIE PORTE SON PROPRE REFUS, avec la réécriture. Sans elle, `![seed:7]`
      // tomberait sur le refus générique du crochet dans le flux, qui parle d'autre chose.
      if (at(T.LBRACKET) && peek(1).type === T.AT) {
        const ouvre = current();
        const nom = peek(2).type === T.IDENT ? peek(2).value : '…';
        if (nom === 'seed') {
          throw new ParseError(
            `'![seed:N]' : la re-semence dans le flux s'écrit SANS arobase — '![seed:N]'. `
            + `Le crochet porte ce qui gouverne la dérivation, et une re-semence en est une `
            + `procédure ; l'arobase reste à la tête de scène, où 'seed:N' règle la production.`,
            ouvre);
        }
        throw new ParseError(
          `'![${nom}…]' : seule la re-semence a un sens dans le flux, et elle s'écrit `
          + `'![seed:N]' ; '${nom}' se pose en tête de scène, '${nom}'.`, ouvre);
      }
      // ⛔ LE CROCHET NE SE POSE PAS DANS LE FLUX — arbitrage de Romain, 2026-08-08 :
      // « `![Ideas]` dans le flux n'a aucun sens et doit être interdit ».
      //
      // Le crochet gouverne la DÉRIVATION, et la dérivation ne se gouverne pas à un instant : ses
      // quatre places sont la garde, l'affectation, la procédure et le rang — toutes attachées à
      // une RÈGLE ou à une ligne de gabarit, aucune à une position dans une séquence.
      //
      // ⚠️ CE QUI PASSAIT, ET POURQUOI C'EST GRAVE : `![Ideas]` produisait un CONTRÔLE nommé
      // « Ideas » alors que le même mot, écrit avant la règle, est un DRAPEAU. Le même nom
      // changeait de nature selon l'endroit, sans un mot — la confiscation de nom qu'on venait de
      // fermer pour `randomize`, revenue par une autre porte. `![shuffle]`, `![retro]` et
      // `![order]` passaient de même ; leur forme vivante est la parenthèse, `!(shuffle)`.
      //
      // ⚠️ `![seed:N]` EST TRAITÉ AU-DESSUS et reste : c'est une directive de PRODUCTION, pas un
      // contrôle — re-semer le tirage à cet instant a un sens, et la branche qui la lit refuse
      // déjà tout autre nom qu'elle.
      if (at(T.LBRACKET)) {
        // ⚠️ LIRE D'ABORD, REFUSER ENSUITE — troisième fois aujourd'hui, et cette fois j'avais
        // fait pire que doubler un message : en retirant le bloc devenu inatteignable, j'ai
        // EMPORTÉ AVEC LUI un refus nommé qu'il portait — celui qui explique qu'une procédure de
        // niveau règle vaut pour la règle entière et ne se pose pas à une position. Le garde des
        // procédures l'a dit dans l'heure.
        // ⛔ La leçon n'est pas « relire avant de supprimer » : c'est que du code mort et du code
        // vivant cohabitaient dans le même bloc, et qu'une suppression au périmètre du bloc ne
        // pouvait pas les distinguer. Le refus nommé est donc REMONTÉ ici, avant le refus
        // générique, où il ne dépend plus de la vie d'un bloc voisin.
        const q = parseQualifier('relative');
        const procedure = (q.pairs || []).find((p) => p && universeRuleScopeControls().has(p.key));
        if (procedure) {
          throw new ParseError(
            `'![${procedure.key}: …]' : '${procedure.key}' est une procédure de niveau RÈGLE, elle `
            + `ne se pose pas dans le flux — elle vaut pour la règle entière. Écrire `
            + `'[${procedure.key}:${procedure.value === true ? '…' : procedure.value}]' en `
            + `suffixe de règle. Dans le flux, elle n'atteint jamais la règle et laisse un jeton `
            + `de contrôle inerte dans la production`,
            current());
        }
        throw new ParseError(
          `un crochet ne se pose PAS dans le flux (décision Romain 2026-08-08) : le crochet `
          + `gouverne la DÉRIVATION — une garde, une affectation de drapeau, une procédure, un rang `
          + `de gabarit — et rien de cela ne vaut à un instant. Un contrôle posé dans le flux `
          + `s'écrit entre PARENTHÈSES : '!(shuffle)', '!(retro)', '!(vel:80)'. `
          + `(Seule '![seed:N]' reste, parce qu'elle re-sème la production et non la dérivation.)`,
          current());
      }

      // !symbol → out-time object
      if (at(T.IDENT)) {
        const name = advance().value;
        return { type: 'OutTimeObject', name };
      }
      throw new ParseError('Expected symbol, (...) or [...] after !', current());
    }

    // Trigger in <!
    if (at(T.TRIGGER_IN)) {
      return parseWait();
    }

    // Hash (context in RHS)
    if (at(T.HASH)) {
      return parseContext();
    }

    // Backtick de FLUX : taggé → BacktickStandalone ; NON taggé → hérite du langage
    // de l'acteur eval en tête de règle (résolu en annotateBackticks ; CRIE si orphelin).
    // Ajustement [299] : héritage rétabli, borné à l'eval d'acteur déclaré.
    if (at(T.BACKTICK)) {
      const raw = advance().value;
      const t = tryBacktickTag(raw);
      if (t) return { type: 'BacktickStandalone', tag: t.tag, code: t.code, line: tok.line };
      return { type: 'BacktickInline', code: raw, tag: null, line: tok.line };
    }

    // Chiffre nu en flux RHS.
    if (at(T.INT) && !isSymbolCallAhead()) {
      const num = Number(advance().value);
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = Number(advance().value);
        return { type: 'NumericDuration', numerator: num, denominator: denom };
      }
      // TERMINAL NEUTRE (ratifié Romain 2026-07-17, GO architecte [468]) : un entier nu
      // SONNE (fidèle BP3 — Encode.c:87 isdigit→FindNumber produit un token, ce n'est PAS
      // une durée). Kind sonnant DISTINCT 'numeric-terminal', pas NumericDuration, pas de
      // drapeau. Le 2-limbes base 2^31 vit SEUL dans l'encodeur plat aval (bpx flatLength) ;
      // l'AST reste propre. Le chemin BP3 hérité émet le même chiffre (encoder.js cas
      // NumericTerminal → byte-id préservé).
      return { type: 'NumericTerminal', kind: 'numeric-terminal', value: num, line: tok.line };
    }

    // Identifier — could be Symbol, SymbolCall, Control, or TieStart
    if (at(T.IDENT)) {
      let name = advance().value;
      let actor = null;

      // Actor dot notation: sitar.Sa → { type: 'Symbol', name: 'Sa', actor: 'sitar' }
      // Only if first IDENT is a known actor and followed by .IDENT (no space before .).
      // On NE retourne PAS ici : on capte l'acteur puis on RETOMBE dans le même traitement
      // que le terminal nu (suffixe (...), appel-symbole, ~, !, <!), afin que
      // `acteur.terminal(...)` se comporte EXACTEMENT comme `terminal(...)`. Avant ce fix,
      // le retour anticipé laissait tout `(...)` collé non consommé → rejet « Expected RBRACE
      // got LPAREN » dès qu'un préfixe d'acteur côtoyait un override inconnu, ex. (ch:N) (LAN-9).
      // Appel-composant par le POINT (design_dot_notation ; décision [489], loi de graphie).
      // Point GLUÉ (pas d'espace avant) suivi d'un IDENT = accès à un membre d'un composant.
      // Composant CONNU (acteur) → chemin existant. Composant INCONNU mais point glué DES DEUX
      // CÔTÉS (`drum.on`) → porté OPAQUE (même nœud {Symbol,name,actor}, `opaqueComponent:true`) :
      // le parser N'INTERPRÈTE PAS (PORTER≠RÉSOUDRE) — module(son)/acteur(hauteur)/homo décidé à
      // la RÉSOLUTION aval. byte-id sûr : aucune grammaire n'utilise un point glué-des-deux-côtés.
      // ── L'ACTEUR QUALIFIE UN BLOC DE CODE, PAR LE POINT, À DROITE ────────────────
      // `drums.\`note("c3")\`` — décidé par Romain le 2026-07-28, et c'est la forme qui manquait.
      //
      // ⚠️ POURQUOI ELLE EXISTE, et ce n'est pas un confort d'écriture. L'ancienne forme faisait
      // porter le nom de l'acteur À LA TÊTE DE RÈGLE — un amalgame, refusé depuis. Or cet amalgame
      // faisait DEUX choses : il donnait son langage au code, ET son identité à la voix. Le tag
      // (`\`strudel: …\``) ne remplace que la première : mesuré, un bloc tagué ne porte AUCUN acteur,
      // donc tout ce qui est clé par acteur en aval cesse de le trouver — Kanopi a mesuré un voyant
      // de santé resté AU VERT sur une voix qui erreure en continu.
      // Cette forme rend les deux : le point qualifie le bloc comme il qualifie une note
      // (`sitar.Sa`), l'acteur garde son nom, et la règle n'est qu'une règle.
      if (at(T.PERIOD) && !current().spaceBefore && peek(1).type === T.BACKTICK
          && ((libCtx.actors && libCtx.actors[name]) || acteursDeclares.has(name))) {
        advance();                                  // le point
        const raw = advance().value;                // le bloc
        const t = tryBacktickTag(raw);
        // Un tag EXPLICITE reste prioritaire — il surcharge l'héritage, comme partout ailleurs.
        return t
          ? { type: 'BacktickStandalone', tag: t.tag, code: t.code, actor: name, line: tok.line }
          : { type: 'BacktickInline', code: raw, tag: null, actor: name, line: tok.line };
      }

      const gluedMember = at(T.PERIOD) && !current().spaceBefore && peek(1).type === T.IDENT;
      const knownActor = gluedMember && ((libCtx.actors && libCtx.actors[name]) || acteursDeclares.has(name));
      const opaqueComponent = gluedMember && !knownActor && !peek(1).spaceBefore;
      let componentOpaque = false;
      if (knownActor || opaqueComponent) {
        advance(); // consume PERIOD
        actor = name; // composant (acteur connu, ou opaque : résolu aval sur la liste d'acteurs/modules)
        name = advance().value; // membre
        componentOpaque = opaqueComponent;
      }

      // Valeur affectée à un membre de composant OPAQUE (loi de graphie : `:` = valeur ; §4/§9
      // activés [502]). `lpf.cutoff: 8000` (cv-set), `saw.freq: pitch` (ref), `env.decay: 350ms`.
      // Distinct de la durée de note (`A4:1/2`) : ne vaut que pour un appel-composant OPAQUE. Porté
      // OPAQUE (kind number|ref|backtick) ; la classe trig/cv-set/gate = résolution aval (Kairos,
      // content.action, catalogue de ports). PORTER≠RÉSOUDRE : je ne classe pas, je porte la valeur.
      if (componentOpaque && at(T.COLON) && !current().spaceBefore) {
        advance(); // consume COLON
        const value = lireValeurDeMembre();
        return { type: 'Symbol', name: normalizeName(name), line: tok.line, actor, value };
      }

      // Durée collée sur terminal : A4:1/2 → {1/2, A4} (décision 2026-06-26 trois-concepts-temps-duree).
      // `:` COLLÉ (pas d'espace) suivi d'un nombre = durée de note ; désucré en cadre polymétrique.
      // Se distingue de `label:{…}` (capté plus haut, peek(2)=LBRACE) et de `A4 1/2` ESPACÉ
      // (ancien sens : A4 puis un silence, NumericDuration). L'espace tranche (EBNF.md:943).
      if (at(T.COLON) && !current().spaceBefore && estNombreDeDuree(peek(1))) {
        advance(); // consume COLON
        const dur = parseColonFrame(tok);
        const sym = { type: 'Symbol', name: normalizeName(name), line: tok.line, ...(actor ? { actor } : {}) };
        return cadreDuree(dur, [sym]);
      }

      // Tie start: C4~
      if (at(T.TILDE)) {
        advance();
        return { type: 'TieStart', symbol: name, ...(actor ? { actor } : {}) };
      }

      // Control: vel(120), goto(2,1) — check BEFORE symbol call.
      // Jamais pour un terminal préfixé d'acteur (acteur.terminal n'est pas un contrôle).
      // FORME D'APPEL `nom(param)` SUPPRIMÉE DU LANGAGE (décision Romain 2026-07-26,
      // hub/decisions/2026-07-26-ecriture-des-controles-…). « fonction() n'existe pas et n'a
      // jamais existé en BPScript ». Elle avait déjà été pesée et écartée le 2026-07-02
      // (DIGITAL_FUNCTIONS.md §7). Un contrôle s'écrit `(nom:valeur)` au runtime, `[nom:valeur]`
      // au moteur, `!` devant pour le poser dans le flux.
      //
      // On ne se contente pas de retirer la branche : sans message, l'appel retomberait en
      // `SymbolCall` et sonnerait comme une note — le mode d'échec le plus coûteux, mesuré le
      // 2026-07-26. On le NOMME donc, avec sa réécriture, et le sac dépend de la nature du
      // contrôle : la donnée le dit, on ne le devine pas.
      if (!actor && at(T.LPAREN) && isControlName(name)) {
        throw new ParseError(refusFormeAppel(name), tok);
      }

      // Control without args: striated, smooth, destru, stop
      //
      // ⚠️ LA DÉCLARATION DE LA SCÈNE PASSE AVANT LE MOT DU VOCABULAIRE. Mesuré par Kairos le
      // 2026-07-27 : `patchbay-demo.bps` déclare `macro mute` et écrit sept mots dans sa règle ;
      // il en arrivait SIX. Le mot y devenait un contrôle sans un mot d'erreur, parce que j'ai
      // déclaré `mute`/`unmute`/`panic` sans argument le 2026-07-26 — un mot jusque-là libre est
      // devenu un mot du vocabulaire, et toute scène qui le portait déjà a été tronquée en
      // silence. C'est le pire mode d'échec : côté consommateur, rien ne distingue une scène qui a
      // changé d'une scène qui a été amputée.
      //
      // La règle est celle de la cascade, déjà posée pour tout le langage (décision
      // 2026-06-26) : LE PLUS LOCAL GAGNE. La scène qui déclare un nom le possède. Le contrôle
      // reste joignable dans son sac — `(mute)`, `!(mute)` — position syntaxique distincte, aucun
      // conflit. Et l'ombrage se DIT : il est légitime, il n'est pas anodin.
      //
      // ⚠️ ET UN MOT QUI N'A PAS DE FORME NUE REFUSE, il ne disparaît pas. « Sans argument » ne
      // veut pas dire « s'écrit nu au fil de la séquence » : les contrôles continus hérités de BP3
      // s'écrivent nus, `mute`/`unmute`/`panic` non — leur seule graphie est le sac. La donnée le
      // déclare (`bagOnly`), le code ne nomme aucun contrôle.
      if (!actor && !at(T.LPAREN) && isControlName(name)
          && libCtx.bagOnlyControls && libCtx.bagOnlyControls.has(name)
          && !nomsDeclaresLocalement.has(name)) {
        // ⛔ LE MESSAGE LIT LA PORTÉE DÉCLARÉE — il ne prescrit plus une place au hasard.
        //
        // ⚠️ MESURÉ PAR KANOPI le 2026-08-09 : ce refus envoyait DANS UN MUR. Il disait « écrire
        // `!(randomize)` », et `!(randomize)` répondait « ne vaut QUE en tête de sous-grammaire ».
        // Deux fermetures DIFFÉRENTES — la forme nue et les places — que mon propre commit du
        // matin disait lire séparément : mon garde les lisait, mon MESSAGE non. Il proposait
        // exactement la place que l'autre fermait.
        // C'est le défaut que j'avais nommé la veille — nommer une réécriture sans vérifier
        // qu'elle existe — reproduit à l'intérieur d'un seul refus.
        const portees = libCtx.controls?.[name]?.scope;
        const listePortees = Array.isArray(portees) ? portees : (portees ? [portees] : []);
        const OU = { scene: 'en tête de scène', subgrammar: 'en tête de sous-grammaire',
                     rule: 'en suffixe de règle', group: 'sur un groupe',
                     symbol: 'sur un élément', flow: 'dans le flux' };
        const places = listePortees.map((p) => OU[p] || p);
        const commentEcrire = listePortees.includes('flow')
          ? `écrire '!(${name})' pour le poser au fil de la séquence`
          : (places.length
            ? `sa déclaration ne lui donne que ${places.length > 1 ? 'ces places' : 'cette place'} : ${places.join(', ')}`
            : `sa déclaration ne lui donne aucune place dans une règle`);
        throw new ParseError(
          `'${name}' n'a pas de forme nue dans le flux — ${commentEcrire}. Un mot du vocabulaire `
          + `rencontré là où il ne peut pas l'être refuse ; il ne disparaît pas.`, tok);
      }

      if (!actor && !at(T.LPAREN) && isControlName(name) && isNoArgControl(name)) {
        if (nomsDeclaresLocalement.has(name)) {
          warn(`'${name}' est déclaré par la scène ET porté par le vocabulaire comme contrôle sans `
             + `argument — la déclaration de la scène l'emporte, le mot reste un symbole ici. Pour `
             + `le contrôle, écrire '(${name})' ou '!(${name})'.`, tok.line);
        } else {
          return { type: 'Control', name, args: [] };
        }
      }

      // ⛔ CE QUI DISTINGUE UN APPEL D'UN RÉGLAGE, C'EST LE NOM DEVANT LA PARENTHÈSE —
      // JAMAIS LA CLÉ QU'ELLE CONTIENT.
      //
      // `LANGUAGE.md` §« Les parenthèses — quatre rôles » le pose, et sa règle de désambiguïsation
      // est POSITIONNELLE puis NOMINALE : « `symbole(` collé, dans une règle = sac de réglages, ou
      // appel d'une définition ». Un appel, c'est `accent(C4)` où `accent` a été DÉCLARÉ par `def`
      // (`LANGUAGE.md:1293`) : le nom est un geste, ce qui suit est ce sur quoi il s'applique.
      // Un réglage, c'est `C4(vel:120)` : le nom est un élément qui sonne, la parenthèse en décrit
      // une propriété. L'un FABRIQUE une note, l'autre la DÉCRIT.
      //
      // ⚠️ CE CODE TRANCHAIT SUR LA CLÉ — « est-ce que `vel` est un contrôle connu ? » — une question
      // qui n'a aucun rapport. Deux conséquences mesurées le 2026-08-08 :
      //   · `C4(cutoff:sweep)` devenait un APPEL alors que `C4` est une note : le seul tort de
      //     `cutoff` était de vivre dans la librairie des modulations et non dans celle des
      //     contrôles. Cinq scènes du corpus dans ce cas.
      //   · la même écriture changeait de nature selon les librairies invoquées — la famille du
      //     défaut réparé le matin même, par l'autre bout.
      //
      // ⚠️ ET IL N'Y A AUJOURD'HUI AUCUNE DÉFINITION POSSIBLE : `def` n'est pas implémenté (mesuré,
      // il est refusé « Expected arrow »), donc l'ensemble des noms appelables est VIDE et tout
      // `nom(` collé dans une règle est un sac de réglages. Le jour où `def` existera, cette
      // fonction consultera ses noms — le critère est déjà le bon, seule sa source reste à peupler.
      if (at(T.LPAREN) && !current().spaceBefore && !isContextLookahead()
          && !estUneDefinitionDeclaree(name)) {
        // ⚠️ ET SI CE N'EST PAS NON PLUS UN SAC, ON LE DIT — sinon la parenthèse reste orpheline et
        // la règle échoue plus loin sur « Expected arrow », un message qui ne parle de rien.
        // Mesuré : les trois scènes témoins de `script(…)` sont passées de leur refus NOMMÉ à ce
        // message aveugle. Elles refusaient toujours — donc aucun compte ne bougeait — mais elles
        // avaient changé de cause. C'est le garde du registre qui l'a vu, pas le portillon.
        //
        // ⚠️ DEUX REFUS DISTINCTS, ET LES CONFONDRE ÉCRIT UNE CONTRE-VÉRITÉ. La décision du
        // 2026-07-26 supprime la forme d'appel D'UN CONTRÔLE (`keymap(C3,C3,C5,C5)`) — « fonction()
        // n'existe pas ». Elle ne dit RIEN de `accent(C4)`, l'appel d'une définition déclarée, que
        // `LANGUAGE.md` écrit noir sur blanc (§« quatre rôles », rôle 4). Employer le message de la
        // décision pour tout nom ferait dire au compilateur que l'appel n'existe pas, alors que la
        // référence l'écrit — exactement l'inverse de la hiérarchie.
        if (!sacBienForme()) {
          if (isControlName(name)) throw new ParseError(refusFormeAppel(name), tok);
          throw new ParseError(
            `'${name}(${texteDuSac()})' n'est lisible ni comme un SAC DE RÉGLAGES — son contenu `
            + `n'est pas fait de paires 'clé:valeur' — ni comme un APPEL : appeler exige une `
            + `définition déclarée, et aucune ne porte le nom '${name}'. Pour régler '${name}', `
            + `écrire '${name}(clé:valeur)' ; pour l'appeler, le déclarer d'abord avec `
            + `'def ${name}(x) …'`, tok);
        }
        return { type: 'Symbol', name: normalizeName(name), line: tok.line, ...(actor ? { actor } : {}) };
      }

      // Appel d'une définition déclarée : `accent(C4)`.
      if (at(T.LPAREN) && !current().spaceBefore && !isContextLookahead()) {
        const node = parseSymbolCall(name, tok);
        if (actor) poserActeur(node, actor);
        return node;
      }

      // Simultaneous: Sa!dha!phase=2
      // But NOT !() or ![] — those are standalone InstantControls for the next iteration
      if (at(T.BANG) && peek(1).type !== T.LPAREN && peek(1).type !== T.LBRACKET) {
        const node = parseSimultaneousGroup(name, tok);
        if (actor) poserActeur(node, actor);
        return node;
      }

      // Trigger in on symbol: Sa<!sync1
      if (at(T.TRIGGER_IN)) {
        const triggerIns = [];
        while (at(T.TRIGGER_IN)) {
          triggerIns.push(parseWait());
        }
        return {
          type: 'SymbolWithWait',
          symbol: { type: 'Symbol', name: normalizeName(name), line: tok.line, ...(actor ? { actor } : {}) },
          triggers: triggerIns,
        };
      }

      // Plain symbol (might be a control like vel, tempo, goto)
      // Check if it's a control: name(args) without being a symbol call context
      // FORME D'APPEL `nom(param)` SUPPRIMÉE DU LANGAGE (décision Romain 2026-07-26,
      // hub/decisions/2026-07-26-ecriture-des-controles-…). « fonction() n'existe pas et n'a
      // jamais existé en BPScript ». Elle avait déjà été pesée et écartée le 2026-07-02
      // (DIGITAL_FUNCTIONS.md §7). Un contrôle s'écrit `(nom:valeur)` au runtime, `[nom:valeur]`
      // au moteur, `!` devant pour le poser dans le flux.
      //
      // On ne se contente pas de retirer la branche : sans message, l'appel retomberait en
      // `SymbolCall` et sonnerait comme une note — le mode d'échec le plus coûteux, mesuré le
      // 2026-07-26. On le NOMME donc, avec sa réécriture, et le sac dépend de la nature du
      // contrôle : la donnée le dit, on ne le devine pas.
      if (!actor && at(T.LPAREN) && isControlName(name)) {
        throw new ParseError(refusFormeAppel(name), tok);
      }

      return { type: 'Symbol', name: normalizeName(name), line: tok.line, ...(actor ? { actor } : {}) };
    }

    return null; // No valid RHS element found
  }

  function isSymbolCallAhead() {
    // INT followed by non-slash = not a duration
    return false;
  }

  function isNoArgControl(name) {
    return libCtx.noArgControls.has(name);
  }


  /** Message de refus de la forme d'appel — il RÉÉCRIT au lieu de constater. Le sac vient de la
   *  DONNÉE (`libCtx.engineControls`), jamais d'une liste de noms en dur ici. */
  function refusFormeAppel(name) {
    const moteur = libCtx.bp3NativeControls && libCtx.bp3NativeControls.has(name)
                && !(libCtx.dispatcherOnlyControls && libCtx.dispatcherOnlyControls.has(name));
    const cible = moteur ? `![${name}:…]` : `!(${name}:…)`;
    return `la forme d'appel '${name}(${texteDuSac()})' n'existe pas en BPScript (supprimée le 2026-07-26) — `
      + `écrire '${cible}' pour le poser dans le flux, ou '${moteur ? `[${name}:…]` : `(${name}:…)`}' `
      + `en contenance. Les deux points AFFECTENT la valeur, l'espace en sépare les parties `
      + `('[goto:3 0]'), la virgule sépare les éléments du sac ('(vel:80, pan:64)')`;
  }

  function isControlName(name) {
    return libCtx.controlNames.has(name);
  }

  /**
   * UN ÉLÉMENT NE PORTE QU'UN SEUL SAC — décision de Romain, 2026-08-08 : « un seul sac, on
   * interdit deux sacs, on fusionne ».
   *
   * ⚠️ LA MESURE QUI L'A DÉCIDÉE : les deux écritures portent exactement la même information dans
   * deux emballages. `C2(wave:sawtooth)(vel:80)` rend deux sacs d'une paire, `C2(wave:sawtooth,
   * vel:80)` un sac de deux paires. La virgule sépare déjà les éléments d'un sac ; en coller un
   * second n'ajoute AUCUNE notion — seulement une seconde façon d'écrire la même chose, et un
   * tableau là où un objet suffit.
   *
   * ⚠️ CE REFUS VISE DEUX SACS DE RÉGLAGES, JAMAIS « DEUX PARENTHÈSES QUI SE SUIVENT » — et la
   * distinction n'est pas théorique. Kanopi l'a signalée avant que je frappe : `simpletemplates.bps`
   * écrit `($0 ???)($1 )`, deux parenthèses voisines qui sont une construction de GABARIT et non
   * des sacs. Un refus posé sur la graphie aurait cassé cette scène. Il est donc posé là où le
   * lecteur a DÉJÀ reconnu un sac (`isRuntimeQualifier`), et nulle part ailleurs.
   */
  /**
   * ⛔ LE CROCHET COLLÉ À UN ÉLÉMENT N'EXISTE PLUS — arbitrage de Romain, 2026-08-08.
   *
   * Le tableau de `LANGUAGE.md` §« Le crochet » donne ses quatre places, et aucune n'est un
   * suffixe d'élément : le crochet gouverne la DÉRIVATION, qui ne se règle pas note à note.
   *
   * ⚠️ CETTE FONCTION EXISTE PARCE QUE LE REFUS AVAIT DEUX SITES JUMEAUX — la lecture d'un
   * élément de règle et celle d'un élément de groupe polymétrique. Posé sur le premier seul,
   * il laissait passer `C4<!s1[shuffle]` : la faute du jour, « réparer l'endroit où le défaut
   * s'est montré au lieu de l'espace où il peut vivre », commise dans le fichier dont le
   * commentaire voisin dit exactement le contraire. Un seul appelant de plus ailleurs, et le
   * refus le suit sans qu'on y pense.
   *
   * ⚠️ ELLE LIT AVANT DE REFUSER, et cet ordre est une correction : `parseQualifier` porte des
   * refus NOMMÉS que celui-ci ne sait pas donner (`[shuffle:N]` retiré → la graine s'écrit
   * `seed:N` en tête, `![seed:N]` dans le flux). Jeter avant de lire les écrasait — un message précis remplacé par un message
   * vague est une régression, attrapée deux fois aujourd'hui par un garde du TEXTE du refus.
   */
  function refuserCrochetColle() {
    parseQualifier();
    throw new ParseError(
      `un crochet COLLÉ à un élément n'existe plus (décision Romain 2026-08-08) : le crochet `
      + `gouverne la DÉRIVATION — un test de drapeau, une affectation, une procédure `
      + `('[goto:…]', '[repeat:…]', '[failed:…]', '[stop]'), un rang de gabarit — et aucune de `
      + `ces places n'est un suffixe d'élément. Un sac collé s'écrit entre PARENTHÈSES : `
      + `'…(shuffle)', '…(retro)', '…(vel:80)'.`,
      current());
  }

  function refuserSecondSac(rang, el) {
    if (rang < 2) return;
    const nom = el && (el.name || el.symbol) ? `'${el.name || el.symbol}'` : 'cet élément';
    throw new ParseError(
      `${nom} porte DEUX sacs de réglages collés — un élément n'en porte qu'un. Réunir les paires `
      + `dans le même sac : la virgule les sépare, '(clé:valeur, clé:valeur)'. Les deux écritures `
      + `disaient déjà la même chose ; celle-ci n'en est plus une (décision Romain 2026-08-08).`,
      current());
  }

  /**
   * Ce nom a-t-il été DÉCLARÉ comme une définition (`def`) ? Seul un tel nom peut être APPELÉ.
   *
   * L'ensemble est vide tant que `def` n'est pas implémenté — et c'est la vérité du langage
   * aujourd'hui, pas un raccourci : sans déclaration, aucun nom n'est appelable. Le jour où la
   * directive existera, ses noms se déclarent ICI et rien d'autre ne bouge.
   */
  function estUneDefinitionDeclaree(name) {
    return definitionsDeclarees.has(name);
  }

  /**
   * Le texte ÉCRIT entre la parenthèse courante et sa fermante — pour qu'un refus cite ce que
   * l'auteur a tapé, pas une abréviation.
   *
   * ⚠️ « `script(…)` » ne dit pas à l'auteur OÙ regarder ; « `script(MIDI program 5)` » le pose
   * sous ses yeux. Le refus venait autrefois d'un étage qui avait les arguments déjà lus ; il vient
   * maintenant du parseur, avant lecture — reconstituer le texte est le prix pour ne pas dégrader
   * le message en déplaçant le refus.
   */
  function texteDuSac() {
    if (!at(T.LPAREN)) return '';
    let j = pos + 1, profondeur = 1;
    const morceaux = [];
    while (j < tokens.length && profondeur > 0) {
      const t = tokens[j];
      if (t.type === T.LPAREN) profondeur++;
      else if (t.type === T.RPAREN) { profondeur--; if (!profondeur) break; }
      else if (t.type === T.NEWLINE || t.type === T.EOF) break;
      morceaux.push((t.spaceBefore && morceaux.length ? ' ' : '') + (t.value ?? ''));
      j++;
    }
    return morceaux.join('');
  }

  // Vrai si le jeton courant peut DÉMARRER un élément RHS (cf. parseRhsElement). Sert à distinguer
  // une durée en FIN de règle (`A B C :2`, portée règle, valide) d'une durée ISOLÉE au milieu du
  // flux (`A :2 B`, portée inline — INTERDITE pour la durée). Les terminateurs de règle (NEWLINE,
  // [], (), flèches) ne démarrent pas d'élément.
  function atRhsElementStart() {
    const t = current().type;
    return t === T.IDENT || t === T.LBRACE || t === T.REST || t === T.PROLONG
        || t === T.UNDETERMINED || t === T.PERIOD || t === T.PIPE || t === T.QUESTION
        || t === T.DOLLAR || t === T.AMPERSAND || t === T.TILDE || t === T.BANG
        || t === T.TRIGGER_IN || t === T.HASH || t === T.BACKTICK || t === T.LAMBDA || t === T.INT;
  }

  // ============================================================
  // Compound RHS elements
  // ============================================================

  function parseSymbolCall(name, tok) {
    expect(T.LPAREN);
    const args = [];
    while (!at(T.RPAREN) && !atEnd()) {
      let key = null;
      // Check for named arg: key:value
      if (at(T.IDENT) && peek(1).type === T.COLON) {
        key = advance().value;
        advance(); // :
      }
      let value;
      // Argument d'un contrôle interval-typé (transpose) : soit `transpose(3/2)` (callee interval-typé,
      // arg positionnel), soit `Sym(transpose:3/2)` (clé interval-typée). Lu comme INTERVALLE, porté brut.
      const intervalHere = (key && universeIntervalControls().has(key))
                        || (!key && universeIntervalControls().has(name));
      if (intervalHere) {
        value = { type: 'Literal', value: readIntervalLiteral(key || name) };
      } else if (at(T.BACKTICK)) {
        // Valeur calculée : taggée si tag présent, sinon héritage (résolu en aval).
        const raw = advance().value;
        const t = tryBacktickTag(raw);
        value = t ? { type: 'BacktickInline', code: t.code, tag: t.tag }
                  : { type: 'BacktickInline', code: raw, tag: null };
      } else if (at(T.INT)) {
        // RAPPORT `N/D` (ex. tempx:11/5) : même lecture que `TempoOp`/`readIntervalLiteral`
        // ailleurs dans ce fichier (le glyphe SLASH y porte déjà ce sens, jamais une division
        // calculée). Sans ce embranchement, le RESTE de la fraction (`/5`) retombait comme un
        // second argument sans clé et sans forme reconnue — « Expected argument value » sur une
        // valeur qui compile pourtant dans TOUTE autre position de sac (runtime qualifier connu,
        // qualifier moteur). Un entier seul (pas suivi de '/') garde son ancienne lecture NUMBER.
        const n = advance().value;
        if (at(T.SLASH) && peek(1).type === T.INT) {
          advance();
          value = { type: 'Literal', value: `${n}/${advance().value}` };
        } else {
          value = { type: 'Literal', value: Number(n) };
        }
      } else if (at(T.FLOAT)) {
        value = { type: 'Literal', value: Number(advance().value) };
      } else if (at(T.IDENT)) {
        // ── UN NOM QUALIFIÉ PAR SON ACTEUR EST UN NOM ────────────────────────────────────────
        // `halo(melodie.C4)` : le point DÉSIGNE un terminal vu à travers un acteur, c'est la
        // règle d'or du langage. Sans ce recollage, l'argument s'arrêtait à `melodie` et la
        // parenthèse butait sur le point — « Expected argument value » sur une forme que le
        // langage écrit partout ailleurs.
        //
        // ⚠️ MESURÉ LE 2026-08-13 en réécrivant l'exemple `halo` de la bible avec des acteurs :
        // c'est le SEUL endroit du langage où un terminal ne pouvait pas porter son acteur. Une
        // scène à deux alphabets ne peut nommer ses terminaux QUE par leur acteur ; le site
        // d'argument était donc fermé à toute scène qui en déclare plus d'un.
        let nom = advance().value;
        while (at(T.PERIOD) && peek(1).type === T.IDENT && !current().spaceBefore) {
          advance();
          nom += `.${advance().value}`;
        }
        value = { type: 'Literal', value: nom };
      } else {
        // Nommer l'APPELÉ : sans lui, un appel dont un argument n'est pas une valeur ne dit ni
        // qui il est ni pourquoi il échoue. Cas mesuré (2026-07-26) : `script(MIDI controller #98
        // = 0 channel 1)` sortait un « Expected argument value » orphelin, alors que la vraie
        // cause est que `script` n'est pas un contrôle et que sa prose n'est pas une liste
        // d'arguments.
        throw new ParseError(`Expected argument value in '${name}(…)'`, current());
      }
      args.push({ type: 'Arg', key, value });
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);

    // Check for tie start after call
    if (at(T.TILDE)) {
      advance();
      return { type: 'TieStart', symbol: name, args };
    }

    // `!` après un appel : ACCORD (`B3!C7`) ou CONTRÔLE DE FLUX (`Sym(…) !(vel:80)`) ?
    // C'est ce qui SUIT le `!` qui tranche, pas le `!` lui-même — il est surchargé
    // (LANGUAGE.md, table de syntaxe). Devant `(` ou `[`, c'est un contrôle posé dans le flux ;
    // le lire comme un accord fait échouer la ligne sur « symbole attendu après ! ».
    // Payé le 2026-07-26 : la migration du corpus pose des `!(…)` partout, et une scène tombait
    // sur cette lecture — donc pour une raison FAUSSE, masquant celle qu'on voulait lui voir.
    if (at(T.BANG) && peek(1).type !== T.LPAREN && peek(1).type !== T.LBRACKET) {
      return parseSimultaneousGroup(name, tok, args);
    }

    return { type: 'SymbolCall', name, args, line: tok.line };
  }

  function parseControl(name, tok) {
    expect(T.LPAREN);
    const args = [];
    // Contrôle interval-typé (transpose) : l'unique argument est un INTERVALLE, lu proprement
    // (fraction/cents/décimal) et porté brut — sans la jointure de tokens qui insérerait un espace
    // parasite ("1100 c" au lieu de "1100c"), ce que la résolution (normalizeRatio) rejetterait.
    if (universeIntervalControls().has(name)) {
      args.push(readIntervalLiteral(name));
      expect(T.RPAREN);
      return { type: 'Control', name, args };
    }
    while (!at(T.RPAREN) && !atEnd()) {
      // Build composite arg: K1=3, Cmaj, 120, etc.
      let arg = '';
      while (!at(T.RPAREN) && !at(T.COMMA) && !atEnd()) {
        const t = current();
        if (t.type === T.INT || t.type === T.FLOAT || t.type === T.IDENT) {
          // PROSE INTERDITE dans un argument de contrôle (chantier `_script`, GO Romain
          // 2026-07-26). Ce lecteur recollait autrefois les mots successifs avec des espaces —
          // « MIDI send Continue », « wait for do#2 channel 1 » — ce qui n'existait QUE pour
          // porter la phrase libre de `script(…)`. `script` supprimé, la prose n'a plus de
          // destinataire : deux valeurs qui se suivent sans séparateur sont une faute, et on la
          // NOMME plutôt que de la recoller en silence. Mesuré sur les deux corpus consommateurs
          // (Kanopi + BPx) : 0 argument de contrôle contient un espace hors `repeat(K1 = 3)`,
          // dont l'espace vient de la branche `=` ci-dessous.
          // Seul le cas que le collage servait est refusé : une valeur DÉJÀ COMPLÈTE (elle finit
          // par un alphanumérique) suivie d'une autre. Un signe en attente de son nombre
          // (`pitchbend(+200)`, `chromashift(-12)`) ou un `=` en attente de sa valeur
          // (`repeat(K1 = 3)`) ne finit pas par un alphanumérique et reste légitime.
          if (arg.length > 0 && /[a-zA-Z0-9]$/.test(arg)) {
            throw new ParseError(
              `argument de contrôle mal formé dans '${name}(…)' : '${arg} ${t.value}' — deux valeurs `
              + `se suivent sans séparateur. Un contrôle prend des arguments séparés par ',' ; il ne `
              + `prend pas de phrase (la fonction générique 'script(…)' a été supprimée du langage)`,
              t);
          }
          arg += advance().value;
        } else if (t.type === T.EQUALS) {
          // Add spaces around = for readability: "controller #98 = 0"
          if (arg.length > 0) arg += ' ';
          arg += advance().value + ' ';
        } else if (t.type === T.SLASH) {
          arg += advance().value;
        } else if (t.type === T.REST) {
          // negative number in control args
          arg += advance().value;
        } else if (t.type === T.PLUS) {
          // positive sign in control args: pitchbend(+200) — symmetric with REST (-)
          arg += advance().value;
        } else {
          // Unexpected token in args — break inner loop to avoid infinite loop.
          // If no arg was accumulated, throw to signal the unexpected token explicitly.
          if (arg.length === 0) {
            throw new ParseError(`Unexpected token ${t.type} (${t.value}) in control args`, t);
          }
          break;
        }
      }
      if (arg) args.push(arg);
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    return { type: 'Control', name, args };
  }

  /**
   * UN `!` QUI SUIT UN ÉLÉMENT DÉJÀ LU EN OUVRE L'ACCORD — y compris quand cet élément porte un
   * réglage collé.
   *
   * ⚠️ CE QUE CETTE FONCTION RÉPARE, ET C'ÉTAIT MUET (mesuré le 2026-08-08). `C4(vel:80)!E4(vel:90)`
   * ne produisait plus UN accord mais DEUX éléments frères — la seconde note cessait d'attaquer avec
   * la première. Aucun refus, aucun message : la scène sonnait autrement, voilà tout.
   *
   * LA CAUSE, ET ELLE DIT POURQUOI PERSONNE NE L'AVAIT VUE. L'accord n'était construit que sur la
   * voie de l'APPEL (`parseSymbolCall`, qui lit le `!` juste après ses arguments). Or un élément
   * suivi d'un sac ne passe par cette voie **que si la clé n'est pas un contrôle connu** : dès
   * qu'une scène invoquait la librairie des contrôles — 186 des 274 du corpus — `vel` devenait un
   * réglage, l'élément revenait par la voie du suffixe, et plus rien ne lisait le `!`.
   * Le seul test qui couvrait la forme (`test_chord_charge_r4.js`) l'écrivait SANS cette invocation :
   * il gardait donc exactement le cas qui n'arrive presque jamais, et restait vert.
   *
   * Le rendre intrinsèque (`libs.js`) supprime la voie de l'appel pour tous les contrôles — sans ce
   * correctif, le défaut serait devenu universel au lieu d'être fréquent.
   */
  function envelopperEnAccord(el, tok) {
    if (!at(T.BANG) || peek(1).type === T.LPAREN || peek(1).type === T.LBRACKET) return el;
    return { type: 'SimultaneousGroup', primary: el, secondaries: lireSecondaires(tok) };
  }

  /**
   * POSER L'ACTEUR SUR LE TERME, JAMAIS SUR LE GROUPE.
   *
   * DÉCISION ROMAIN (2026-08-10), mot pour mot : « c'est correct, ça doit passer, l'acteur doit
   * être posé sur chaque terminal pas le groupe ».
   *
   * ⚠️ CE QUE ÇA RÉPARE, ET LE MODE D'ÉCHEC EST TROMPEUR. `chant.A2!chant.A4` était REFUSÉ
   * (« Ambiguous symbol "A2" ») alors que `chant.A2` seul passait : l'acteur atterrissait sur le
   * nœud de la frappe commune, et la résolution ne lit l'acteur que sur les Symbol et SymbolCall
   * (actorResolver.js:439-442). Le préfixe était donc écrit, présent dans l'arbre, et INVISIBLE —
   * et le refus accusait l'auteur d'une ambiguïté qu'il avait précisément levée.
   *
   * ⚠️ ET LE PRÉFIXE NE SE DISTRIBUE PAS aux co-attaques : le point COLLÉ qualifie le terme auquel
   * il est collé (LANGUAGE.md, table de l'espace), et chaque terminal porte donc le sien. Un
   * secondaire écrit nu reste nu — s'il est ambigu, le refus est alors mérité.
   *
   * La descente est récursive : un primaire peut lui-même être une frappe commune.
   */
  function poserActeur(node, actor) {
    if (node && node.type === 'SimultaneousGroup' && node.primary) {
      poserActeur(node.primary, actor);
      return;
    }
    if (node) node.actor = actor;
  }

  function parseSimultaneousGroup(primaryName, tok, primaryArgs = null) {
    let primary;
    if (primaryName === 'lambda') {
      primary = { type: 'NilString' };
    } else if (primaryArgs) {
      primary = { type: 'SymbolCall', name: primaryName, args: primaryArgs, line: tok.line };
    } else {
      primary = { type: 'Symbol', name: normalizeName(primaryName), line: tok.line };
    }
    return { type: 'SimultaneousGroup', primary, secondaries: lireSecondaires(tok) };
  }

  /** Les co-attaques d'un accord : `!X`, `!X(…)`, répétés. Partagé par les deux entrées. */
  function lireSecondaires(tok) {
    const secondaries = [];

    while (at(T.BANG)) {
      advance(); // !

      // ! is exclusively temporal — only symbols/symbol calls
      if (at(T.IDENT)) {
        let name = advance().value;
        // ⛔ UNE CO-ATTAQUE PEUT ÊTRE QUALIFIÉE PAR SON ACTEUR — `melodie.C4!perc.dha`.
        // Ouvert le 2026-08-09, sur décision de Romain : « deux alphabets dans une scène, c'est
        // deux acteurs nommés ; un alphabet par acteur ». Une scène à deux alphabets s'écrit donc
        // forcément avec des acteurs, et ses co-attaques traversent les deux — c'est même le cas
        // que la référence illustre (`S -> C4!dha`, une note et une frappe à la même attaque).
        // ⚠️ CE SITE LISAIT UN NOM NU ET NE CAPTAIT JAMAIS D'ACTEUR : la qualification marchait
        // PARTOUT AILLEURS — en tête de règle, dans un groupe, en élément séparé — et tombait
        // seulement après le point d'exclamation, avec un message qui accusait le terminal
        // (« terminal 'perc' non déclaré ») au lieu de dire que la place n'accepte pas la forme.
        // Un refus qui nomme le mauvais coupable envoie chercher le défaut là où il n'est pas.
        let acteurSec = null;
        if (at(T.PERIOD) && !current().spaceBefore && peek(1) && peek(1).type === T.IDENT
            && ((libCtx.actors && libCtx.actors[name]) || acteursDeclares.has(name))) {
          advance();
          acteurSec = name;
          name = advance().value;
        }
        // ⚠️ UNE CO-ATTAQUE SE LIT COMME N'IMPORTE QUEL ÉLÉMENT — son sac est un RÉGLAGE, pas un
        // appel. Mesuré le 2026-08-08 : `C4(vel:80)!E4(vel:90)!G4` rendait un accord IMBRIQUÉ
        // (E4 devenu appel, absorbant G4 dans un sous-accord) là où `C4!E4!G4` rend trois
        // co-attaques à PLAT. Les deux écritures disent la même chose musicale ; seule celle qui
        // porte des réglages changeait de forme. Ce site-ci était le dernier à emprunter encore la
        // voie de l'appel pour une clé de réglage.
        if (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
          const sec = { type: 'Symbol', name: normalizeName(name), line: tok.line, suffixQualifiers: [], ...(acteurSec ? { actor: acteurSec } : {}) };
          while (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
            sec.suffixQualifiers.push(parseRuntimeQualifier());
          }
          secondaries.push(sec);
        } else if (at(T.LPAREN)) {
          secondaries.push(parseSymbolCall(name, tok));
        } else {
          secondaries.push({ type: 'Symbol', name: normalizeName(name), line: tok.line, ...(acteurSec ? { actor: acteurSec } : {}) });
        }
        continue;
      }

      throw new ParseError('Expected symbol after !', current());
    }

    return secondaries;
  }

  function hasMatchingBrace() {
    // Lookahead: is there a } that matches this { within the SAME rule?
    // A new rule starts after NEWLINE(s) when we see: IDENT ARROW
    let depth = 0;
    let j = pos;
    let afterNewline = false;
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.LBRACE) depth++;
      if (t === T.RBRACE) { depth--; if (depth === 0) return true; }
      if (t === T.EOF || t === T.SEPARATOR) return false;
      // After a newline, check if next non-newline token starts a new rule
      if (t === T.NEWLINE) { afterNewline = true; j++; continue; }
      if (afterNewline) {
        // New rule starts with: IDENT/LAMBDA at line start (outside braces)
        if (t === T.LAMBDA) return false;
        if (t === T.IDENT) {
          // Look ahead for arrow
          let k = j + 1;
          while (k < tokens.length && tokens[k].type === T.IDENT) k++;
          if (k < tokens.length && (tokens[k].type === T.ARROW_R || tokens[k].type === T.ARROW_L || tokens[k].type === T.ARROW_BI)) {
            return false; // New rule detected
          }
        }
      }
      afterNewline = false;
      j++;
    }
    return false;
  }

  function parsePolymetric(label) {
    let dureeCollee = null;   // `{A B}:N` — désucré en `{N, {A B}}` à la sortie
    expect(T.LBRACE);
    const voices = [];
    let currentVoice = [];

    while (!at(T.RBRACE) && !atEnd()) {
      if (at(T.COMMA)) {
        voices.push(currentVoice);
        currentVoice = [];
        advance();
        continue;
      }
      if (at(T.NEWLINE)) { advance(); continue; }
      // [] with space before inside polymetric → break (not attached to element)
      if (at(T.LBRACKET) && current().spaceBefore) break;

      const el = parseRhsElement();
      if (!el) break;
      refuserSuffixeArobase();   // même refus nommé partout où un élément se lit

      // SUFFIX qualifiers: A[X] or A(X) — no space before [ or (
      // Même refus du second sac que dans une règle : l'espace où le défaut vit, pas le site où
      // il se montre.
      let sacsLusIci = 0;
      while ((at(T.LBRACKET) && !current().spaceBefore) ||
             (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier())) {
        if (at(T.LBRACKET)) refuserCrochetColle();
        el.suffixQualifiers = el.suffixQualifiers || [];
        refuserSecondSac(++sacsLusIci, el);
        el.suffixQualifiers.push(parseRuntimeQualifier());
      }
      // Même geste DANS un groupe polymétrique : `{C4(vel:80)!E4(vel:90) D4}`. Le brancher au seul
      // site de la règle aurait réparé l'endroit où le défaut s'est montré, pas l'espace où il vit.
      currentVoice.push(envelopperEnAccord(el, current()));

      // EBNF §4.2: "A (vel:80)" with space = suffix of A if end of voice
      // Attach spaced () as suffix of last element when at end of voice (, or })
      if (at(T.LPAREN) && current().spaceBefore && isRuntimeQualifier() && currentVoice.length > 0) {
        const lastEl = currentVoice[currentVoice.length - 1];
        lastEl.suffixQualifiers = lastEl.suffixQualifiers || [];
        lastEl.suffixQualifiers.push(parseRuntimeQualifier());
      }
    }
    if (currentVoice.length > 0) voices.push(currentVoice);
    expect(T.RBRACE);

    // Qualifiers after } — engine [] and runtime ()
    const qualifiers = [];
    while (at(T.LBRACKET) && isPolymetricQualifier()) {
      qualifiers.push(parseQualifier());
    }

    // Durée collée sur groupe : {A B}:2 → cadre {2, A B} (décision 2026-06-26 trois-concepts).
    // `:` COLLÉ au `}` suivi d'un nombre = durée du groupe ; poussée comme qualifier `speed`
    // dans `qualifiers` (contrat AST_SPEC:1024,1037) — pas un champ ad hoc.
    if (at(T.COLON) && !current().spaceBefore && estNombreDeDuree(peek(1))) {
      const tokColon = current();
      advance(); // consume COLON
      dureeCollee = parseColonFrame(tokColon);
    }

    // Sac de réglages COLLÉ au groupe : `{A B}(vel:100)`.
    //
    // ⚠️ L'ESPACE DÉCIDE DE LA PORTÉE, et ce site ne le consultait pas — il happait TOUT `(…)`
    // suivant un bloc, collé ou non. `EBNF.md` §4.12 : collé à l'accolade fermante = portée
    // GROUPE, séparé par une espace en fin de membre droit = portée RÈGLE.
    //
    // ⚠️ ET LA CONSÉQUENCE ÉTAIT UNE DÉRIVATION SANS FIN, mesurée par BPx sur `tryRotate.bps:11` :
    //     N -> N !(rotate:K1) {N 1/2} (weight:5-1)
    // Le poids atterrissait DANS LE BLOC. Leur chargeur le cherche sur la RÈGLE, ne le trouve pas,
    // et retombe sur le défaut du moteur d'origine — poids 127, décrément ZÉRO. Avec un décrément
    // nul le poids ne décroît jamais ; or cette règle est RÉCURSIVE et ce décrément est
    // précisément ce qui la BORNE. Dérivation tuée à 45 s chez eux, 150 s chez Kairos, quand le
    // moteur natif termine en 25 ms sur la même grammaire. Un réglage mal aiguillé ne se voit pas
    // dans l'arbre : il se voit au bout de la chaîne, en temps de calcul infini.
    let settings = null;
    if (isRuntimeQualifier() && !current().spaceBefore) {
      settings = parseRuntimeQualifier();
    }

    const groupe = { type: 'Polymetric', voices, qualifiers, settings, label: label || null };
    // `{A B}:2` → `{2, {A B}}` : le groupe reste UN élément dans le cadre, il ne s'y disperse pas.
    return dureeCollee ? cadreDuree(dureeCollee, [groupe]) : groupe;
  }

  // Durée collée : consomme un nombre (INT) ou un ratio (INT/INT) APRÈS un COLON déjà consommé,
  // et renvoie la PREMIÈRE VOIX du cadre polymétrique — exactement ce qu'aurait produit l'écriture
  // développée. Le désucrage est celui que la décision écrit noir sur blanc
  // (`hub/decisions/2026-06-26-trois-concepts-temps-duree.md`) : `{A B}:1/2` → `{1/2, {A B}}`.
  //
  // ⚠️ CE QUE ÇA CORRIGE, mesuré par bpx sur l'AST brut, et c'était DEUX fautes dans une ligne :
  //  1. j'émettais un qualificatif de clé `speed` — le mot que cette même décision SUPPRIME, et
  //     qu'elle supprime parce qu'il était MAL NOMMÉ (il ne désigne pas une vitesse mais un
  //     étirement). Un mot retiré de la surface qui survit à l'intérieur de l'arbre, c'est la
  //     survivance exacte qui a laissé vivre la forme d'appel quatre mois.
  //  2. je gardais le contenu en voix PARALLÈLES au lieu de l'IMBRIQUER : `{2, C4, D4}` est deux
  //     voix dans un cadre 2 ; `{2, {C4, D4}}` est UNE voix qui contient le groupe. Ce n'est pas
  //     la même musique, même si le son coïncidait sur le cas mesuré.
  // La forme rendue est celle que produit déjà l'écriture développée : `NumericTerminal` pour un
  // entier, `NumericDuration` pour un ratio — vérifié en comparant les deux arbres.
  /**
   * Un nombre de DURÉE — entier ou décimal. La fraction se lit après l'entier (`1/2`).
   * ⚠️ Les quatre portes du `:` collé testaient `T.INT` seul : le décimal n'entrait nulle part,
   * et `parseColonFrame` ne le voyait jamais. Corriger le lecteur sans corriger les portes ne
   * changeait RIEN — mesuré le 2026-08-06, la durée décimale restait refusée à l'identique.
   */
  const estNombreDeDuree = (t) => t && (t.type === T.INT || t.type === T.FLOAT);

  function parseColonFrame(tok) {
    // ⚠️ LA DURÉE DÉCIMALE — `A:0.5`, cinq exemples de LANGUAGE.md (l. 764, 1005, 1013, 1895,
    // 2259, tous glosés « occupe un demi-battement »). Elle était REFUSÉE, et pas seulement en
    // forme collée : `{0.5, A}` développé l'était aussi.
    //
    // POURQUOI ELLE NE POUVAIT PAS PASSER PAR LE CHEMIN DE L'ENTIER. Un nombre nu dans le flux
    // est un TERMINAL SONNANT (ratification Romain 2026-07-17, fidèle à Encode.c:87) — pas une
    // durée. Émettre `NumericTerminal{value:0.5}` inventerait une note décimale, qui n'existe
    // dans aucun moteur.
    //
    // CE QU'ELLE EST VRAIMENT : la même chose que la fraction, écrite autrement. `0.5` et `1/2`
    // disent un demi-battement ; ils produisent donc le MÊME arbre, `NumericDuration{1,2}`. La
    // conversion est EXACTE — un décimal fini est un rationnel — et réduite, pour que `0.50` et
    // `1/2` ne se distinguent pas dans l'arbre.
    // ⚠️ Aucun champ nouveau, aucune frontière : le désucrage reste celui que la décision datée
    // prescrit (`hub/decisions/2026-06-26-trois-concepts-temps-duree.md` : « `A4:1/2` → `{1/2,
    // A4}`, sucre pur BPScript, zéro changement moteur »).
    if (at(T.FLOAT)) {
      const brut = String(advance().value);
      const decimales = (brut.split('.')[1] || '').length;
      let n = Math.round(Number(brut) * 10 ** decimales), d = 10 ** decimales;
      const pgcd = (a, b) => (b === 0 ? a : pgcd(b, a % b));
      const g = pgcd(n, d) || 1;
      n /= g; d /= g;
      if (d === 1) {
        return { type: 'NumericTerminal', kind: 'numeric-terminal', value: n, line: (tok || current()).line };
      }
      return { type: 'NumericDuration', numerator: n, denominator: d };
    }
    const num = expect(T.INT).value;
    if (at(T.SLASH) && peek(1).type === T.INT) {
      advance(); // consume SLASH
      const den = expect(T.INT).value;
      // ⚠️ ON NE JUXTAPOSE JAMAIS — L'ESPACE EST OBLIGATOIRE (Romain, 2026-08-07).
      // Signalé par BPx sur une transcription réelle (watch.bps:16) : une durée fractionnaire
      // COLLÉE à un chiffre nu donne `2/31/2`, et l'information N'EST PAS DANS LE TEXTE. Le
      // lecteur de caractères prend les chiffres tant qu'il y en a, donc il voit
      // `INT(2) SLASH INT(31) SLASH INT(2)` : les mêmes caractères portent au moins trois
      // découpes, et rien ne dit laquelle. Ce n'est pas une règle d'assemblage qui manque.
      //
      // ⚠️ CE REFUS REMPLACE UN MESSAGE QUI N'AIDAIT PERSONNE. Sans lui, la ligne sortait
      // « ligne non reconnue au niveau des règles » — un constat qui ne nomme ni le lieu, ni la
      // cause, ni le geste. Un site rouge dont le message ne dit pas quoi faire coûte plus cher
      // que le défaut lui-même : BPx a dû réduire le cas à quatre sondes pour le nommer.
      if (at(T.SLASH) && !current().spaceBefore) {
        throw new ParseError(
          `'${num}/${den}/…' : deux nombres se touchent, et rien ne dit où le premier finit — `
          + `'${num}/${den}' suivi d'un chiffre collé se relit '${num}' puis '${String(den).slice(0, 1)}…', `
          + `ou autrement. On ne juxtapose jamais : séparer par une ESPACE`,
          current());
      }
      return { type: 'NumericDuration', numerator: Number(num), denominator: Number(den) };
    }
    return { type: 'NumericTerminal', kind: 'numeric-terminal', value: Number(num), line: (tok || current()).line };
  }

  /** Enveloppe un contenu dans le cadre `{durée, contenu}` — la forme canonique du désucrage. */
  function cadreDuree(premiereVoix, contenu) {
    return {
      type: 'Polymetric',
      voices: [[premiereVoix], contenu],
      qualifiers: [], settings: null, label: null,
    };
  }

  // Les DEUX qualificatifs polymétriques historiques sont supprimés du langage : `[speed:N]` le
  // 2026-06-26 et `[scale:N]` le 2026-07-26, tous deux SUBSUMÉS par la durée collée `{A B}:N`.
  // La fonction ne reconnaît donc plus rien — on la garde le temps que ses appelants soient
  // retirés, mais elle ne doit plus jamais rendre vrai : un mot supprimé qui survit à l'intérieur
  // est la survivance qui a laissé vivre la forme d'appel quatre mois.
  function isPolymetricQualifier() {
    return false;
  }

  // LE NOM ENTRE BARRES SORT DU LANGAGE (Romain, 2026-08-09, verbatim : « à sortir de l'EBNF et
  // des scènes BPS mais reste en BP3 »). La graphie demeure une graphie d'ENTRÉE BP3 — le frontal
  // continue de la lire et d'en rendre un nom ordinaire — mais une scène BPScript ne l'écrit plus.
  //
  // ⚠️ LE GLYPHE EST PARTAGÉ, ET C'EST TOUT LE DANGER DE CE RETRAIT. `|[ … ]` est l'objet sonore
  // COMPOSÉ, ratifié par Romain le 2026-07-18, et c'est la SEULE barre vivante de tout le corpus
  // de l'atelier (mesuré : `dhati.bps`, aucune autre scène). Un retrait qui viserait « la barre »
  // au lieu de « le nom entre barres » emporterait une graphie ratifiée sans que rien ne le dise.
  // Le départage est ici : `|` suivi d'un IDENT puis d'un `|` est le nom retiré ; `|[` est l'objet
  // composé, lu ailleurs et intact.
  //
  // Le refus NOMME la réécriture plutôt que de disparaître : un mot retiré qu'on cesse simplement
  // de comprendre laisse l'auteur devant une erreur de syntaxe muette.
  function parseVariable() {
    const tok = current();
    expect(T.PIPE);
    const name = expect(T.IDENT).value;
    expect(T.PIPE);
    throw new ParseError(
      `'|${name}|' : le nom entre barres est sorti du langage — écrire '${name}' nu. `
      + `La graphie reste lisible en entrée BP3, elle ne s'écrit plus dans une scène BPScript. `
      + `⚠️ Vérifier qu'aucun terminal de l'alphabet en portée ne s'appelle déjà '${name}' : `
      + `la barre distinguait le non-terminal, le nom nu ne le distingue plus.`,
      tok,
    );
  }

  function parseWildcard() {
    expect(T.QUESTION);
    // Frontière AST (Palier 3) : bare `?` = index ABSENT (wildcard anonyme (T0,1),
    // indépendant) ; `?n` = index:n (wildcard numéroté / métavariable (T6,n), unification).
    // DISTINCTS au moteur — le `?` nu ne porte JAMAIS d'`index`. Cf. AST_SPEC §1.2.1.
    if (at(T.INT)) return { type: 'Wildcard', index: Number(advance().value) };
    return { type: 'Wildcard' };
  }

  // LECTURE DES ARGUMENTS D'UN GABARIT — UNE SEULE, pour le maître (`$nom(…)`) ET pour l'esclave
  // (`&nom(…)`).
  //
  // ⚠️ ELLE EXISTE PARCE QUE LA MÊME BOUCLE VIVAIT À DEUX ENDROITS, ET QUE J'EN AI RÉPARÉ UN SEUL.
  // Le 2026-08-06 au matin, la boucle du MAÎTRE piétinait sur un jeton qu'aucune branche ne
  // consommait : elle empilait sans fin et emportait la machine (6,6 Go). Corrigée là où le défaut
  // s'était MONTRÉ — et l'ESCLAVE, copie exacte, est resté intact jusqu'à ce que `&mel(tempx:1)` le
  // réveille l'après-midi même. « On répare l'endroit où le défaut s'est montré, pas l'espace où il
  // peut vivre », payé deux fois dans la journée sur le même code.
  // La parade n'est pas d'y penser : c'est qu'il n'y ait plus qu'un seul corps à réparer.
  function lireArgumentsDeGabarit(sigil, nom) {
    const args = [];
    advance(); // (
    while (!at(T.RPAREN) && !atEnd()) {
      const avant = pos;
      let key = null;
      if (at(T.IDENT) && peek(1).type === T.COLON) {
        key = advance().value;
        advance();
      }
      let value;
      if (at(T.INT)) value = { type: 'Literal', value: Number(advance().value) };
      else if (at(T.IDENT)) value = { type: 'Literal', value: advance().value };
      args.push({ type: 'Arg', key, value });
      if (at(T.COMMA)) advance();
      // ⛔ CETTE BOUCLE NE DOIT JAMAIS PIÉTINER — un tour qui ne consomme aucun jeton tourne sans
      // fin. Un refus nommé vaut toujours mieux qu'une machine à genoux.
      if (pos === avant) {
        throw new ParseError(
          `'${sigil}${nom}(…${current().value}…)' : '${current().value}' n'a pas sa place dans les `
          + `arguments d'un gabarit — ils s'écrivent 'nom:valeur', séparés par des virgules. `
          + `Pour poser un RÉGLAGE sur la règle, une ESPACE le détache du gabarit `
          + `('${sigil}${nom} (${key || 'clé'}:…)') ; pour une VITESSE, qui n'est pas une paire, `
          + `le point d'exclamation la pose dans le flux ('${sigil}${nom} ! (*2/3)')`,
          current());
      }
    }
    expect(T.RPAREN);
    return args;
  }

  function parseTemplateMaster() {
    expect(T.DOLLAR);

    // Template group: ${...} → (= ...)
    if (at(T.LBRACE)) {
      advance();
      const elements = [];
      while (!at(T.RBRACE) && !atEnd()) {
        if (at(T.NEWLINE)) { advance(); continue; }
        const el = parseRhsElement();
        if (el) elements.push(el);
        else break;
        refuserSuffixeArobase();   // même refus nommé partout où un élément se lit
      }
      expect(T.RBRACE);
      return { type: 'TemplateMasterGroup', elements };
    }

    // $ nu (ancre de gabarit maître) — le token suivant a un espace (spaceBefore=true)
    // ou n'est pas un IDENT/LBRACE. Retourner TemplateAnchor au lieu d'erreur.
    if (!at(T.IDENT) || current().spaceBefore) {
      return { type: 'TemplateAnchor', kind: 'master' };
    }

    const name = expect(T.IDENT).value;
    let args = null;
    // ARGUMENTS DE GABARIT vs SAC DE RÉGLAGES — c'est l'ESPACE qui tranche, comme partout
    // ailleurs dans le langage (AST.md, tableau des portées : un suffixe COLLÉ porte sur
    // l'élément, un suffixe ESPACÉ porte sur la règle). `$Tihai(transpose:-200c)` donne ses
    // arguments au gabarit ; `$A16 (meter:4/4)` pose un réglage de règle.
    //
    // ⚠️ SANS LA CONDITION D'ESPACE, un réglage de règle écrit après une ancre de gabarit
    // tombait dans la lecture d'arguments ci-dessous. `isRuntimeQualifier()` ne le rattrapait
    // pas : il exige que le nom soit un contrôle CONNU, et il ne l'est que si la scène a
    // chargé `controls` — ce que ces scènes ne font pas. Mesuré : une seule écriture de
    // l'écosystème donne des arguments à un gabarit, et elle est COLLÉE.
    if (at(T.LPAREN) && !current().spaceBefore && !isRuntimeQualifier()) {
      args = lireArgumentsDeGabarit('$', name);
    }
    return { type: 'TemplateMaster', name, args };
  }

  function parseTemplateSlave() {
    expect(T.AMPERSAND);

    // Template group: &{...} → (: ...)
    if (at(T.LBRACE)) {
      advance();
      const elements = [];
      while (!at(T.RBRACE) && !atEnd()) {
        if (at(T.NEWLINE)) { advance(); continue; }
        const el = parseRhsElement();
        if (el) elements.push(el);
        else break;
        refuserSuffixeArobase();   // même refus nommé partout où un élément se lit
      }
      expect(T.RBRACE);
      return { type: 'TemplateSlaveGroup', elements };
    }

    const name = expect(T.IDENT).value;
    let args = null;
    // Même loi que le maître : c'est l'ESPACE qui sépare les arguments de gabarit du sac de
    // réglages, et c'est la MÊME lecture (`lireArgumentsDeGabarit`) — plus deux corps à tenir
    // synchronisés.
    if (at(T.LPAREN) && !current().spaceBefore && !isRuntimeQualifier()) {
      args = lireArgumentsDeGabarit('&', name);
    }
    return { type: 'TemplateSlave', name, args };
  }

  function parseWait() {
    expect(T.TRIGGER_IN);
    // ⛔ RIEN NE S'INTERCALE ENTRE LE SIGNE ET SA RACINE — arbitrage de Romain, 2026-08-15 :
    // « attention à l'espace, on a un langage dans lequel les espaces ont du sens, et a priori il
    // n'en faut pas dans ce cas-là ».
    //
    // CE QUI PASSAIT : `<! in.midi(…)` et `<!in.midi(…)` compilaient TOUS LES DEUX, et rendaient le
    // même arbre. Deux graphies pour une chose, dans un langage où l'espace SÉPARE deux termes —
    // c'est ce qu'on ferme partout ailleurs. Le point d'attente et le nom qu'il attend forment
    // UN SEUL TERME (`LANGUAGE.md`, tableau des signes accolés).
    //
    // Mesuré avant le refus : ZÉRO scène du périmètre — 885 fichiers, seize dépôts — n'écrit la
    // forme espacée. Le refus n'invalide aucune écriture vivante.
    if (at(T.IDENT) && current().spaceBefore) {
      throw new ParseError(
        `'<! ${current().value}' : rien ne s'intercale entre le point d'attente et ce qu'il `
        + `attend — ils forment un seul terme. Écrire '<!${current().value}'.`,
        current());
    }
    const name = expect(T.IDENT).value;
    // ADRESSE DE LA SOURCE, collée au point de réception — symétrique de l'adresse de destination
    // collée au terminal (`sitar1.Sa`). Décision Romain 2026-07-27 : une entrée se route PAR LE NOM,
    // AU POINT OÙ ELLE AGIT, comme une sortie ; pas de directive, pas de flèche.
    //
    // ⚠️ COLLÉ = UNE ADRESSE, ESPACE = UN DÉCOUPAGE (règle validée par Romain le 2026-07-27).
    //
    //   `<!brut.60`     → une adresse : le point d'attente écoute le numéro 60 de l'entrée `brut`
    //   `<!brut . 60`   → le point d'attente `brut`, puis un DÉCOUPAGE, puis le terminal 60
    //
    // CE N'EST PAS UNE RÈGLE NOUVELLE, et il faut le lire ainsi plutôt que comme un choix : le
    // langage COLLE déjà le marqueur de registre au nom de note, jamais une espace, parce que
    // l'espace est le délimiteur de termes (LANGUAGE.md:107-111) ; et la doc écrit déjà le
    // découpage AVEC des espaces autour (`A B . C D`, LANGUAGE.md:273). Les deux graphies étaient
    // donc déjà distinguées dans l'usage — on rend explicite ce qui l'était de fait.
    //
    // POURQUOI IL A FALLU UNE RÈGLE : un point suivi d'un NOMBRE est une lecture valide des DEUX
    // façons, l'adresse et le découpage suivi d'un terminal numérique. Mesuré avant de trancher, et
    // c'est ce chiffre qui dit que la règle n'a rien brisé : ZÉRO point d'attente dans tout
    // l'écosystème, ZÉRO séquence découpage-puis-nombre en flux hors d'un bloc Csound. Aucune scène
    // ne casse, quelle que soit la sortie.
    let address = null;
    const colle = at(T.PERIOD) && !current().spaceBefore;
    if (colle && (peek(1).type === T.IDENT || peek(1).type === T.INT) && !peek(1).spaceBefore) {
      advance();
      const jeton = advance();
      // Le TYPE dit ce que l'adresse EST, et l'aval n'a rien à deviner : un NOMBRE est le numéro
      // brut de l'appareil, tel quel (décision 2026-07-27, point 3) ; un IDENTIFIANT est une
      // étiquette, celle que la table a produite. Même convention que les extrémités `cc:N`, dont
      // le numéro sort en nombre.
      address = jeton.type === T.INT ? Number(jeton.value) : jeton.value;
      // ⚠️ ET L'ADRESSE S'ARRÊTE À UN DÉLIMITEUR. Signalé par BPx le 2026-07-27 : `<!pedale.1e999`
      // donnait l'adresse 1 PLUS un terminal `e999` injecté dans la pièce — l'auteur écrit une
      // adresse, il obtient une note qu'il n'a pas écrite. Ça ne se voyait que si le nom parasite
      // tombait hors alphabet ; dans le cas contraire, la note serait passée sans un mot.
      if ((at(T.IDENT) || at(T.INT)) && !current().spaceBefore) {
        throw new ParseError(
          `'<!${name}.${jeton.value}${current().value}' : l'adresse est SUIVIE DE '${current().value}' `
          + `sans séparateur. Une adresse est UN seul jeton — un identifiant ('<!${name}.suivant') ou `
          + `un entier ('<!${name}.60'). Séparer par une espace ce qui doit être un terme distinct.`,
          current());
      }
    } else if (colle && (peek(1).type === T.IDENT || peek(1).type === T.INT)) {
      // ⚠️ LE CAS MIXTE — point collé au nom, mais valeur détachée. Il n'est ni l'un ni l'autre, et
      // je REFUSE de choisir à la place de l'auteur : le lire en silence comme un découpage
      // trahirait une intention d'adresse manifeste, le lire comme une adresse contredirait la
      // règle. Signalé à l'architecte avant l'arbitrage, non tranché depuis — donc on ne devine pas.
      throw new ParseError(
        `'<!${name}.' suivi d'une espace : forme ambiguë. COLLÉ des deux côtés c'est une ADRESSE `
        + `('<!${name}.${peek(1).value}'), ESPACÉ des deux côtés c'est un DÉCOUPAGE suivi d'un `
        + `terminal ('<!${name} . ${peek(1).value}'). Écrire l'une des deux.`, current());
    } else if (colle) {
      // ⚠️ LE TROU QUE BPx A MESURÉ le 2026-07-27, et c'était le pire mode d'échec possible : point
      // COLLÉ au nom, mais suivi de quelque chose qui n'est ni un identifiant ni un entier — un
      // signe moins, un nombre décimal, une chaîne. AUCUNE des deux branches ci-dessus ne tirait,
      // le point restait dans le flux, et la ligne se relisait en éléments FANTÔMES : `<!pedale.-1`
      // devenait un point d'attente SANS ADRESSE, puis un découpage, puis un silence, puis un
      // terminal numérique. Trois éléments que personne n'a écrits.
      //
      // POURQUOI CE N'EST PAS COSMÉTIQUE, et c'est BPx qui l'a vu de son côté : une attente SANS
      // adresse se lève sur N'IMPORTE QUEL événement de son rôle — c'est la forme voulue, celle du
      // sustain. Une adresse qui s'évapore transforme donc une barrière PRÉCISE en barrière
      // PROMISCUE : la pièce repart au premier événement venu, l'exact contraire de ce qui est
      // écrit. Et l'aval ne peut RIEN rattraper : il ne distingue pas une attente écrite sans
      // adresse d'une adresse évaporée. L'information est détruite ici, donc le refus est ici.
      throw new ParseError(
        `'<!${name}.' suivi de '${peek(1).value ?? peek(1).type}' : ce n'est pas une adresse. Une `
        + `adresse est un identifiant ('<!${name}.suivant') ou un entier ('<!${name}.60'), collé au `
        + `point des deux côtés. Sans adresse, écrire '<!${name}' seul — l'attente se lève alors sur `
        + `n'importe quel événement de ce rôle, et c'est une forme différente, pas un raccourci.`,
        current());
    }
    // Le point d'attente est le TROISIÈME site où un crochet collé se lisait — après la règle et
    // le groupe polymétrique. Il a survécu à deux passes parce qu'il n'appelle pas la boucle de
    // suffixes commune : sa lecture lui est propre. C'est la démonstration de ce que le
    // commentaire de `refuserCrochetColle` annonce — un refus posé sur les sites qu'on connaît
    // laisse vivre celui qu'on ne cherchait pas.
    const qualifiers = [];
    if (at(T.LBRACKET)) refuserCrochetColle();
    // ⚠️ LE SAC D'ANNOTATIONS APPARTIENT AU POINT D'ATTENTE, dans TOUTES ses écritures.
    //
    // Mesuré le 2026-07-27 : écrit SEUL (`<!p(chan:1)`) le sac atterrissait sur le point d'attente ;
    // écrit ANCRÉ à une note (`C4 <!p(chan:1)`, la forme la plus courante) il atterrissait sur
    // l'ASSEMBLAGE `SymbolWithWait`. La même écriture, deux propriétaires — un consommateur
    // qui lit le sac du point n'en trouvait aucun, alors que la donnée était là, sous un autre nœud.
    //
    // ⚠️ CE N'ÉTAIT PAS UNE PERTE, C'ÉTAIT UN DÉPLACEMENT — et c'est pire à sa façon : rien ne
    // manque, donc rien ne peut le signaler ; il faut regarder au bon endroit pour voir que ce n'est
    // pas le bon endroit. (Je l'avais d'abord rapporté comme une perte, à tort.)
    //
    // Le sac est donc consommé ICI, par le point lui-même, avant que l'attachement de suffixe au
    // niveau de l'élément ne s'en saisisse. La note garde le sien : `C4(vel:80)<!p` — le sac écrit
    // AVANT le point d'attente appartient toujours à la note, mesuré.
    const suffixQualifiers = [];
    while (at(T.LPAREN) && isRuntimeQualifier()) suffixQualifiers.push(parseRuntimeQualifier());
    return {
      type: 'Wait', name, ...(address !== null ? { address } : {}), qualifiers,
      ...(suffixQualifiers.length ? { suffixQualifiers } : {}),
    };
  }

  // Garde de clé `[clé:valeur]` — UNIFORME quelle que soit la position (suffixe de règle,
  // flux `![…]`, préfixe, polymétrie) : parseQualifier est le passage obligé de toutes.
  // Loi : « Toute clé non reservee dans [] est une erreur de compilation »
  // (docs/spec/LANGUAGE.md:486). L'univers vient de la DONNÉE, jamais d'une liste en dur :
  // contrôles de TOUTES les libs du REGISTRE + core.schema.qualifierKeys.
  // L'univers est celui du registre, PAS des seules libs chargées par la scène : `[rotate:2]`
  // reste une clé connue dans une scène sans `controls` (cas des scènes de BPx). Exiger
  // `controls` pour employer un contrôle serait une décision de SURFACE, non tranchée — le
  // garde ne rejette donc QUE l'inconnu, sans reclasser ni restreindre aucune clé existante.
  // ⛔ PIERRE TOMBALE PARTAGÉE — `tempx` est SUPPRIMÉ du langage (décision Romain 2026-08-06,
  // hub/decisions/2026-08-06-tempx-est-supprime-doublon-exact-de-l-operateur-de-vitesse.md) :
  // « si tempx fait la même chose que `*` on le supprime et c'est tout ». La mesure qui l'établit
  // est du 3 août : `![tempo:2]` et `![/2]` rendent 500/500/500, le même flux.
  //
  // ⚠️ POURQUOI UNE PIERRE TOMBALE ET PAS UN SIMPLE RETRAIT DE LA LIBRAIRIE. Retirer l'entrée
  // suffit à ce que le mot cesse d'être un contrôle CONNU — mais une clé inconnue entre
  // parenthèses est portée OPAQUEMENT jusqu'au runtime : `(tempx:2)` serait alors accepté et
  // n'atteindrait plus personne. Le retrait seul aurait transformé un doublon bruyant en réglage
  // MUET, le pire des deux. Le mot doit REFUSER, et nommer sa relève.
  function refuserTempx(key, tok, signeOuvrant) {
    if (key !== 'tempx' && key !== 'tempo') return;
    throw new ParseError(
      `'${signeOuvrant === '[' ? '[' : '('}${key}:…${signeOuvrant === '[' ? ']' : ')'}' : `
      + `'${key}' ne s'écrit pas dans une règle — le multiplicateur de vitesse EST l'opérateur, `
      + `et il se pose dans le flux : '! (/N)' ralentit, '! (*N/M)' écrit la même chose en `
      + `fraction inverse (décision Romain 2026-08-06). Le métronome de la scène, lui, s'écrit `
      + `en tête : 'tempo:120'`,
      tok);
  }

  function checkQualifierKey(key, tok) {
    refuserTempx(key, tok, '[');
    // `[speed:N]` SUPPRIMÉ (décision 2026-06-26-trois-concepts-temps-duree) : `speed` est
    // subsumé par la DURÉE, qui s'écrit avec ':' collé — `{A B}:2`, `A4:1/2`, `}:N`.
    if (key === 'speed') {
      throw new ParseError(`'[speed:N]' a été supprimé (décision 2026-06-26) — la durée s'écrit avec ':' : '{A B}:2' (groupe), 'A4:1/2' (note) ou '}:N' (embedding)`, tok);
    }
    // `[shuffle:N]` RETIRÉ (décision 2026-06-14-shuffle-seed-orthogonaux) : brasser et
    // re-semer sont deux atomes BP3 distincts. `[shuffle]` (nu) reste = _rndseq.
    if (key === 'shuffle') {
      throw new ParseError(`'[shuffle:N]' retiré — la graine s'écrit 'seed:N' (en tête de scène) ou '![seed:N]' (dans le flux) ; '[shuffle]' brasse seul`, tok);
    }
    // UN SIGNE, UNE NATURE (décision Romain 2026-08-02, LANGUAGE.md:773-800). Le crochet ne
    // garde que trois emplois : un test de drapeau (garde), une affectation de drapeau (fin de
    // règle), un rang de forme (`template`). Un RÉGLAGE — même réservé au langage — décrit une
    // propriété PRODUITE, et le domaine de sa clé suffit à le router : il s'écrit désormais entre
    // PARENTHÈSES, dans TOUS les cas, sans exception pour les mots réservés `mode`/`scan`/
    // `weight`/`on_fail`/`tempx`/`meter`. L'ancien raisonnement « tempx est un contrôle MOTEUR
    // donc crochets » disparaît avec cette décision : ce n'est plus la déclaration `engine` de
    // `controls.json` qui tranche pour un réglage réservé, c'est sa nature de réglage.
    if (libCtx.qualifierKeys.has(key)) {
      throw new ParseError(
        `'[${key}:…]' : '${key}' est un réglage, il s'écrit entre PARENTHÈSES — '(${key}:…)' `
        + `(décision Romain 2026-08-02, LANGUAGE.md:773-800). Le crochet ne porte plus que ce qui `
        + `gouverne la dérivation elle-même : un test de drapeau ('[flag]', '[flag==1]'), une `
        + `affectation ('[flag=1]'), ou le rang d'une forme de gabarit ('[3]')`,
        tok);
    }
    // ⛔ LA LIBRAIRIE DIT QUI REÇOIT — ELLE NE DIT PAS QUEL SIGNE (rectifié 2026-08-08, Romain).
    // Ce refus reste juste pour ce qu'il garde — un contrôle de RUNTIME n'a rien à faire dans un
    // crochet — mais sa raison n'est plus « crochets = moteur » : c'est que le crochet ne porte que
    // ce qui gouverne la DÉRIVATION. La déduction inverse (« moteur donc crochets ») est morte, et
    // elle a coûté une soirée de raisonnement faux : `shuffle`, `retro`, `order` sont exécutés par
    // le moteur ET s'écrivent entre parenthèses.
    // Un contrôle ne vit pas dans deux librairies : `lib/controls.json` le déclare par sa STRUCTURE
    // (section `engine` contre section `runtime.*`), et cette structure fait autorité pour le
    // DESTINATAIRE (décision 2026-06-14, « controls.json EST
    // L'AUTORITÉ ; transpose, rotate, keyxpand, vel… sont des contrôles RUNTIME, appliqués par le
    // DISPATCHER, JAMAIS par le moteur », qui se qualifie elle-même de règle établie).
    // Mesuré au corpus : 76 emplois étaient du mauvais côté, et la MAJORITÉ se trompait pour deux
    // d'entre eux — l'arbitre est la déclaration, jamais le nombre.
    if (universeSacs().runtime.has(key)) {
      // NOMMER LA BONNE RÉÉCRITURE. `[scale:2]` — valeur unique et numérique — n'est pas la gamme
      // microtonale mal rangée : c'est le contrôle moteur SUPPRIMÉ le 2026-07-26, subsumé par la
      // DURÉE COLLÉE. Renvoyer vers `(scale:2)` enverrait l'utilisateur écrire une gamme dont le
      // nom serait « 2 ». Deux choses portaient le même mot ; le message doit les distinguer.
      // À ce point le deux-points est déjà consommé : la valeur est le jeton COURANT.
      const valeurNumerique = (at(T.INT) || at(T.FLOAT))
        && (peek(1).type === T.RBRACKET || peek(1).type === T.COMMA || peek(1).type === T.SLASH);
      if (key === 'scale' && valeurNumerique) {
        throw new ParseError(
          `'[scale:N]' a été SUPPRIMÉ (décision Romain 2026-07-26) — la mise à l'échelle temporelle `
          + `d'un groupe s'écrit avec la DURÉE COLLÉE : '{A B}:N'. (À ne pas confondre avec la gamme `
          + `microtonale, qui est un contrôle de runtime : '(scale:nom clé)'.)`,
          tok);
      }
      throw new ParseError(
        `'[${key}:…]' : '${key}' est un contrôle de RUNTIME, il s'écrit entre PARENTHÈSES — `
        + `'(${key}:…)', ou '!(${key}:…)' pour le poser dans le flux. Les crochets s'adressent au `
        + `MOTEUR`,
        tok);
    }
    // ⛔ LE CROCHET NE PORTE QUE CE QUI GOUVERNE LA DÉRIVATION — arbitrage de Romain, 2026-08-08.
    // Le tableau de `LANGUAGE.md` §« Le crochet » compte désormais QUATRE places : un test de
    // drapeau, une affectation de drapeau, une PROCÉDURE de dérivation, un rang de gabarit.
    // Un contrôle qui n'est aucune des quatre décrit ce que la dérivation PRODUIT — il s'écrit
    // entre parenthèses, comme tout réglage.
    //
    // LE CRITÈRE VIENT DE LA DONNÉE, ET IL SÉPARE EXACTEMENT LES QUATRE : une procédure de
    // dérivation est déclarée de portée `rule` SEULE, avec un nom moteur. Mesuré le jour de
    // l'arbitrage : `failed goto repeat stop` — précisément la liste que Romain a portée au
    // tableau, sans qu'aucun nom soit écrit ici.
    // ⚠️ `rndtime` s'en distingue par sa propre déclaration : cinq portées, dont `symbol` et
    // `group`. Il décrit une propriété de ce qui est produit, pas un chemin de dérivation.
    //
    // ⚠️ CE GARDE NE VOIT PAS LES DRAPEAUX, et c'est voulu : il n'est atteint qu'après un
    // deux-points. `[vel]` nu reste un DRAPEAU nommé « vel », exactement comme `[monDrapeau]` —
    // mesuré. Un drapeau porte le nom qu'on veut ; le confondre avec un contrôle homonyme
    // confisquerait des noms d'état à leurs scènes.
    if (universeControlNames().has(key)) {
      if (universeRuleScopeControls().has(key)) return;
      // Un contrôle HORS de sa portée est déjà refusé en aval, avec un message qui donne sa
      // vraie place. Ne pas doubler ce refus par un message plus vague — mesuré : sans cette
      // ligne, `[mode:…]` perdait sa réécriture `mode:…` en tête de sous-grammaire.
      if (!universeRuleAllowedControls().has(key)) return;
      throw new ParseError(
        `'[${key}:…]' : le crochet ne porte que ce qui gouverne la DÉRIVATION — un test de drapeau `
        + `('[flag]', '[flag==1]'), une affectation ('[flag=1]'), une procédure de dérivation `
        + `('[goto:…]', '[repeat:…]', '[failed:…]', '[stop]') ou le rang d'une forme de gabarit `
        + `('[3]'). '${key}' décrit ce que la dérivation PRODUIT : il s'écrit entre PARENTHÈSES `
        + `(décision Romain 2026-08-08, LANGUAGE.md §« Le crochet »).`,
        tok);
    }
    // Ne JAMAIS suggérer « utiliser (clé:…) » : les deux formes ne sont pas des synonymes
    // (constat bpx 2026-07-10). `![rotate:N]` réordonne la séquence (contrôle moteur sériel) ;
    // `(rotate:N)` transpose (paramètre de runtime, opaque). Suivre la suggestion ferait perdre
    // le réordre EN SILENCE. On nomme les deux familles, on n'en recommande aucune.
    throw new ParseError(
      `clé '[${key}:…]' inconnue — ni contrôle de librairie, ni garde, ni affectation, ni rang de ` +
      `gabarit ; vérifier l'orthographe, ou la librairie qui la déclare. '[${key}:…]' et ` +
      `'![${key}:…]' (contrôle moteur) ne sont PAS interchangeables avec '(${key}:…)' (paramètre ` +
      `de runtime)`,
      tok);
  }

  // tempoScope : 'absolute' (défaut — A[/N] suffixe d'élément, [/N] niveau-règle)
  // ou 'relative' (forme ![/N] dans le flux). Porté sur le nœud TempoOp pour que
  // les consommateurs (BPx) lisent la décision au lieu de deviner par position.
  // Réf : hub/decisions/2026-06-10-tempo-absolu-vs-relatif.md.
  // `(/N)` · `(*N/M)` — la VALEUR d'un changement de vitesse, lue après le `!` qui la pose dans
  // le flux. Le nœud produit est IDENTIQUE à celui que la forme en crochets rendait avant son
  // retrait : seule la GRAPHIE change, l'arbre ne bouge pas — donc aucun consommateur aval n'a
  // à s'adapter, et le lot reste une affaire de surface.
  function parseVitesseParenthese() {
    expect(T.LPAREN);
    const operator = at(T.STAR) ? (advance(), '*') : (expect(T.SLASH), '/');
    let value;
    if (at(T.INT)) {
      value = Number(advance().value);
      if (at(T.SLASH) && peek(1).type === T.INT) {
        const denom = (advance(), Number(advance().value));
        value = `${value}/${denom}`;
      }
    } else if (at(T.FLOAT)) {
      value = Number(advance().value);
    } else {
      throw new ParseError(
        `'! (${operator}…)' attend un nombre ou une fraction — '! (/2)', '! (*3/2)', '! (/1.5)'`,
        current());
    }
    expect(T.RPAREN);
    // `scope: 'relative'` — une vitesse posée dans le flux se compose avec celle en cours ; c'est
    // ce que portait déjà la forme de flux avant ce changement de graphie (décision 2026-06-10).
    return { type: 'Qualifier', pairs: [], tempoOp: { type: 'TempoOp', operator, value, scope: 'relative' } };
  }

  function parseQualifier(tempoScope = 'absolute') {
    expect(T.LBRACKET);

    // ⛔ PIERRE TOMBALE — L'OPÉRATEUR DE VITESSE NE S'ÉCRIT PLUS ENTRE CROCHETS.
    // Décision Romain 2026-08-06 (hub/decisions/2026-08-06-tempx-est-supprime-doublon-exact-de-
    // l-operateur-de-vitesse.md) : « la graphie est la parenthèse : (/2), (*2) — jamais le
    // crochet ». La bible ne connaît qu'une écriture, et elle est dans le FLUX
    // (LANGUAGE.md:1249 « ! (/N) · ! (*N/M) — changement de vitesse posé dans le flux »).
    //
    // ⚠️ LE REFUS NOMME LA POSITION AUTANT QUE LE SIGNE. La vitesse ne vit QUE dans le flux :
    // ni en suffixe de règle, ni collée à un élément (`AST.md`, tableau des portées — ❌ partout
    // sauf `!inline`). Mesuré au corpus le jour du retrait : 18 écritures au crochet, dont 15
    // déjà dans le flux — celles-là changent de signe et rien d'autre. Les 3 autres (2 en
    // suffixe de règle, 1 collée à un élément) n'ont PAS d'équivalent : elles doivent devenir
    // un élément de flux, ce que le message dit.
    if (atAny(T.SLASH, T.STAR)) {
      const signe = at(T.STAR) ? '*' : '/';
      throw new ParseError(
        `'[${signe}N]' : l'opérateur de vitesse s'écrit entre PARENTHÈSES et se pose dans le `
        + `FLUX — '! (${signe}N)' (décision Romain 2026-08-06). Il ne vit nulle part ailleurs : `
        + `ni en suffixe de règle, ni collé à un élément. '/N' accélère, '*N/M' écrit la même `
        + `chose en fraction inverse`,
        current());
    }

    const pairs = [];
    while (!at(T.RBRACKET) && !atEnd()) {
      const keyTok = current();
      const key = expect(T.IDENT).value;
      // Bare key without value: [destru], [striated], [volumecont]
      if (!at(T.COLON)) {
        pairs.push({ type: 'QualPair', key, value: true, decrement: null });
        if (at(T.COMMA)) advance();
        continue;
      }
      const apresDeuxPoints = current();
      expect(T.COLON);
      checkQualifierKey(key, keyTok);
      // Même règle dans le sac moteur — le format est le MÊME des deux côtés.
      if (!at(T.RBRACKET) && !atEnd() && current().spaceBefore) {
        throw new ParseError(
          `'${key}: ' — pas d'espace après le deux-points : la valeur commence immédiatement `
          + `('${key}:${current().value}…'). L'espace ne sépare que les PARTIES d'une valeur`,
          current());
      }
      void apresDeuxPoints;

      // --- Valeur d'une paire MOTEUR (modèle CSS) ---
      // L'espace sépare les PARTIES d'une valeur (`[goto: 3 0]`), la VIRGULE sépare les ÉLÉMENTS
      // du sac (`[mode:random, weight:50]`) — un rôle par signe, décision Romain 2026-07-26, et
      // la même règle que dans le sac runtime.
      //
      // AVANT, la virgule faisait les deux ici aussi : `[goto:3,1]` rendait la valeur « 3,1 »,
      // c'est-à-dire une LISTE POSITIONNELLE, supprimée par la même décision. On la refuse au
      // lieu de l'absorber en silence — 8 occurrences dans le corpus, migrées en `[goto: 3 1]`.
      if (libCtx.controlNames.has(key)) {
        let rawValue = '';
        while (!at(T.RBRACKET) && !atEnd()) {
          if (at(T.COMMA)) {
            // La virgule ferme la valeur. Si ce qui suit n'ouvre pas un nouvel ÉLÉMENT (une clé,
            // nue ou suivie de ':'), c'est le reste d'une liste positionnelle : on le NOMME.
            const suite = peek(1);
            const ouvreUnElement = suite.type === T.IDENT
              && (peek(2).type === T.COLON || peek(2).type === T.RBRACKET || peek(2).type === T.COMMA);
            if (!ouvreUnElement) {
              throw new ParseError(
                `'[${key}: ${rawValue.trim()},…]' : la virgule sépare les ÉLÉMENTS du sac, pas les `
                + `parties d'une valeur (liste positionnelle supprimée le 2026-07-26) — écrire `
                + `'[${key}:${rawValue.trim()} …]', les parties séparées par une ESPACE`,
                current());
            }
            break;
          }
          const t = current();
          // Mêmes deux règles que dans le sac runtime — le format est le MÊME dans les deux sacs :
          // le deux-points AFFECTE (une paire n'en porte qu'un), et il attend une valeur.
          if (t.type === T.COLON) {
            throw new ParseError(
              `'[${key}: ${rawValue.trim()}:…]' : le deux-points AFFECTE une valeur, il n'en sépare `
              + `pas les parties — une paire n'en porte qu'un. Les parties d'une valeur se séparent `
              + `par une ESPACE ('[${key}:3 0]')`,
              t);
          }
          if (rawValue.length > 0 && t.type !== T.RPAREN && t.type !== T.COMMA) {
            const lastChar = rawValue[rawValue.length - 1];
            if (lastChar !== '(' && t.type !== T.LPAREN && lastChar !== ',') {
              // No space after - (negative number: -7)
              // No space around / (ratio: 11/5)
              // No space around = (K-param: K1=2)
              const isSlash = t.type === T.SLASH || lastChar === '/';
              const isEquals = t.type === T.EQUALS || lastChar === '=';
              if (lastChar !== '-' && !isSlash && !isEquals) rawValue += ' ';
            }
          }
          rawValue += advance().value;
        }
        rawValue = rawValue.trim();
        if (rawValue === '') {
          throw new ParseError(
            `'[${key}:]' n'affecte aucune valeur — le deux-points en attend une (par exemple `
            + `'[${key}:3 0]'), et un contrôle sans argument s'écrit nu, sans deux-points`,
            keyTok);
        }
        pairs.push({ type: 'QualPair', key, value: rawValue, decrement: null });
        if (at(T.COMMA)) advance();
        continue;
      }

      // --- Standard qualifier value parsing ---
      // Ce chemin ne sert plus les clés réservées (`mode`, `weight`… REFUSÉES plus haut par
      // checkQualifierKey) : il reste pour un contrôle du REGISTRE non chargé par cette scène
      // (`universeControlNames()` sans `libCtx.controlNames`), cf. commentaire de checkQualifierKey.
      const gardeElement = () => {
        if (at(T.IDENT) && peek(1).type === T.COLON) {
          throw new ParseError(
            `'[${key}:… ${current().value}:…]' : deux ÉLÉMENTS du sac séparés par une ESPACE — `
            + `il leur manque une VIRGULE ('[${key}:…, ${current().value}:…]'). L'espace ne sépare `
            + `que les PARTIES d'une même valeur`,
            current());
        }
      };
      const { value, decrement } = readQualifierValue();
      gardeElement();
      pairs.push({ type: 'QualPair', key, value, decrement });
      if (at(T.COMMA)) advance();
    }
    expect(T.RBRACKET);
    return { type: 'Qualifier', pairs, tempoOp: null };
  }

  // Lecture de la VALEUR d'un réglage (entier, fraction, décimal, décrément `50-12`, signature
  // temporelle `4+4/6`, K-param `K1=3`, fallback `fallback(B)`). PARTAGÉE entre `parseQualifier`
  // (le résidu `[]` d'un contrôle du registre non chargé) et `parseRuntimeQualifier` (les
  // réglages réservés `mode`/`scan`/`weight`/`on_fail`/`tempx`/`meter`, désormais en `()`,
  // décision Romain 2026-08-02) — même format des deux côtés du sac, un seul lecteur.
  function readQualifierValue() {
    let value, decrement = null;
    if (at(T.INT)) {
      const num = advance().value;
      // Check for time signature: meter:4+4/6, meter:4+4+4+4/6
      if (at(T.PLUS) && peek(1).type === T.INT) {
        let sig = num;
        while (at(T.PLUS) && peek(1).type === T.INT) {
          sig += advance().value; // +
          sig += advance().value; // INT
        }
        if (at(T.SLASH) && peek(1).type === T.INT) {
          sig += advance().value; // /
          sig += advance().value; // INT
        }
        value = sig;
      // Check for ratio: speed:1/2
      } else if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = advance().value;
        value = `${num}/${denom}`;
      } else {
        value = Number(num);
        // Check for decremental weight: 50-12
        if (at(T.REST) && peek(1).type === T.INT) {
          advance();
          decrement = Number(advance().value);
        }
      }
    } else if (at(T.FLOAT)) {
      value = Number(advance().value);
    } else if (at(T.REST)) {
      // Negative number: transpose:-12
      const sign = advance().value;
      value = sign + (at(T.INT) ? advance().value : '');
    } else if (at(T.IDENT)) {
      value = advance().value;
      // Check for K-param assignment: weight:K1=3
      if (at(T.EQUALS) && peek(1).type === T.INT) {
        advance(); // =
        value = `${value}=${advance().value}`;
      }
      // Check for on_fail:fallback(B)
      else if (at(T.LPAREN)) {
        advance();
        const arg = at(T.IDENT) ? advance().value : expect(T.INT).value;
        expect(T.RPAREN);
        value = `${value}(${arg})`;
      }
    }
    return { value, decrement };
  }

  // ============================================================
  // Entry point
  // ============================================================

  return parseScene();
}

export { parse, ParseError };
