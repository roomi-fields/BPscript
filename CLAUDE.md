## BPScript — Meta-sequencer for Temporal Structure Composition

> ⚠️ **CONTEXTE BPx UNIQUEMENT (règle dure, Romain 2026-06-16).** L'AST produit par le parser est
> **agnostique du moteur** et destiné à **BPx** — il ne doit contenir AUCUNE notion BP3 (`_xxx(N)`,
> `flavor:'bp3'`, catégorie « bp3 »…). La sortie **BP3** (`compileBPS().grammar`, ancienne fonction
> « BPScript → BP3 ») est **héritée : NE JAMAIS Y TOUCHER** sauf demande **claire et explicite**.
> Toute taxonomie d'AST se conçoit agnostique (ex. `target: transport|engine`, `timing: bang|durée`),
> jamais « bp3 vs bpx ». Cf. mémoire `feedback_bpx_only_jamais_bp3`.

3 reserved words, 24 symbols, 9 flag operators. Compiles to BP3 grammar format and runs via WASM.
Orchestrates SC, TidalCycles, Python, MIDI, DMX, etc. in a single file via backticks.

### Language summary
- **3 words**: `gate`, `trigger`, `cv` (temporal types)
- **24 structural symbols**: `@`, `->`, `<-`, `<>`, `{}`, `,`, `()`, `:`, `=`, `[]`, ``` `` ```, `//`, `-`, `_`, `.`, `...`, `!`, `<!`, `#`, `?`, `$`, `&`, `~`, `|`
- **9 flag operators**: comparison `==`, `!=`, `>`, `<`, `>=`, `<=` + calculation `+`, `-`, `=` (`-`/`=` are distinct operators that reuse glyphs also used as structural symbols)
- **7 reserved qualifier keys**: `mode`, `scan`, `weight`, `on_fail`, `tempo`, `meter`, `scale` (per `docs/spec/LANGUAGE.md`; `scan`/`tempo`/`meter` handled in `encoder.js`). `speed` SUPPRIMÉ (décision 2026-06-26) → durée `:` (`{A B}:2`, `A4:1/2`)
- **Double declaration**: each symbol has temporal type + runtime binding (`gate Sa:sc`)
- Silence: `-` in both BPScript and BP3
- Prolongation: `_` in both BPScript and BP3
- Period notation: `.` = equal-duration fragment separator (same as BP3)
- `!` = simultaneous event (any type: trigger, gate, cv, or flag mutation)
- `[]` = engine instructions (BP3): guards, mode, weight, tempo operators (durée = `:`, hors `[]`)
- `()` = runtime instructions: vel, pan, wave, attack, release, filter, etc. (encoded as `_script(CT)`, consumed by a downstream runtime)
- Backticks: code evaluated by the symbol's runtime (implicit) or tagged (`sc:`, `py:`)

### Architecture
- `bp3-engine/` — Submodule: BP3 WASM engine ([roomi-fields/bp3-engine](https://github.com/roomi-fields/bp3-engine))
- `src/transpiler/` — Parser and compiler
  - `tokenizer.js` — Source text → token stream
  - `parser.js` — Tokens → AST (Scene, Directive, Rule, CVInstance, Macro, Polymetry)
  - `encoder.js` — AST → BP3 grammar text + flat alphabet + prototypes + settings
  - `prototypes.js` — Generates BP3 -so. prototype files for terminal durations
  - `index.js` — Facade: `compileBPS(source)` → `{ grammar, alphabetFile, prototypesFile, controlTable, cvTable, errors }`
  - `actorResolver.js` — Resolves actors (alphabet/tuning/octaves bindings) between parser and encoder
  - `libs.js` — Library loader (JSON → controls, symbols, CV objects)
- `src/bpx/` — BPx engine stub (next-generation derivation engine, see BPX specs)
- `lib/` — JSON libraries (controls, alphabets, tunings, filter, routing, etc.)
- `dist/` — BP3 WASM build (bp3.js, bp3.wasm, bp3.data)
- `docs/` — Documentation (5 dossiers par type)
  - `spec/` — Spécifications normatives du langage
    - `LANGUAGE.md` — Spécification complète (vision + langage + compilation BP3)
    - `EBNF.md` — Grammaire formelle (EBNF)
    - `AST.md` — Nœuds AST
  - `design/` — Architecture et design technique
    - `ARCHITECTURE.md` — Pipeline de compilation (source → AST → grammaire BP3) + interface WASM
    - `ACTOR.md` — Acteur = voix (alphabet/tuning/sound/transport/eval), cascade de sortie, voix notes vs code, appareils
    - `PITCH.md` — Résolution pitch 6 couches (actor → alphabet → octaves → temperament → tuning → resolver)
    - `SOUNDS.md` — Résolution terminaux unifiée (spec < CT < CV cascading)
    - `CV.md` — CV/signal objects (ADSR, LFO, ramp)
    - `EFFECTS.md` — Effets et signal processing
    - `HOMOMORPHISMS.md` — Étiquetage post-dérivation
    - `REPL.md` — REPL adapters et backticks
    - `SCENES.md` — Hiérarchie de scènes, scoping flags, @scene/@expose/@map, sys
    - (Les docs du moteur BPx ont migré dans le dépôt BPx : `../BPx/docs/ARCHITECTURE.md` (principes/décisions), `../BPx/docs/ENGINE_SPEC.md` (contrat externe), `../BPx/docs/IMPLEMENTATION.md` (interne))
    - `INTERFACES_BP3.md` — Interface WASM BP3 (in/out)
    - `TEMPORAL_DEFORMATION.md` — Constraint solver, déformation temps réel
  - `reference/` — Guides techniques
    - `WASM_HOWTO.md` — Build et usage WASM
    - `NATIVE_HOWTO.md` — Build et usage natif
    - `BP3_FILE_FORMATS.md` — Formats fichiers BP3
    - `HO_FORMAT.md` — Format homomorphismes
  - `issues/` — Problèmes ouverts
    - `POLYMAKE_STACK.md` — Stack overflow polymétrie imbriquée
    - `RNG_PORTABLE.md` — Portabilité RNG MSVC/glibc
    - `TEMPO_OPS_WASM.md` — Opérateurs tempo `/N` `\N` `_tempo()` : écarts WASM vs natif

### Tour de contrôle inter-projets (OBLIGATOIRE) — outil `tour`
Coordination de l'écosystème (BPScript, BPx, bp3-frontend, runtimes, moteur Bernard) :
dépôt PRIVÉ `/home/romi/dev/bp/hub`. Le protocole est MÉCANISÉ par le CLI `hub/tour`
(plus d'édition markdown des boîtes à la main). Détail : `hub/README.md` (§Le protocole + §Outil tour).

0. **Règle de boucle (validée Romain 2026-06-16)** : (a) **RÉVEIL = COURRIER D'ABORD** — première
   action de TOUT réveil (session ou ping) = `tour inbox`. (b) **RAPPORT AVANT IDLE** — ne jamais
   s'arrêter en silence : dernière action = `tour send architecte` avec `FINI: <quoi> + commit` ou
   `BLOQUÉ: <sur quoi>`. (Pas de stop-hook : l'architecte pilote les réveils, l'utilisateur monitore
   en central via la tour.)
1. **Identité (une fois par session)** : `export BP_AGENT=bpscript`.
2. **Début de session** : `~/dev/bp/hub/tour inbox` (mes non-lus) + lire `TABLEAU.md` et mes `contrats/`.
3. **Écrire / demander un arbitrage** : `~/dev/bp/hub/tour send <dest> "msg"` (`architecte` = destinataire
   valide). JAMAIS écrire dans ma propre boîte. Marquer lu quand traité : `tour inbox --ack`.
4. **Fin de session** : mettre à jour MOI-MÊME ma ligne de `TABLEAU.md`, ma fiche `projets/bpscript.md`,
   et ma colonne `BPscript/baseline-status.json`. L'architecte ne corrige plus mes pièces — il recadre.
5. **Décisions transverses** : `decisions/` après arbitrage utilisateur uniquement
   (`tour decide <slug> -m titre --impacts a,b,c`). `constats/` = un finding écrit UNE fois, référencé ailleurs.
6. **Le code fait foi** : un statut se vérifie sur pièces, jamais affirmé de mémoire.

### Un fail-loud de langage est une action de FRONTIÈRE (OBLIGATOIRE, architecte 2026-07-09)

Quand une forme jusque-là acceptée devient une erreur (chantier durée 2026-07-05, garde des clés
`[]` 9ec2abc), ce n'est **pas** un commit interne : les consommateurs aval **live-importent** cette
source, et leur portillon casse en minutes. AVANT ou AVEC le commit, envoyer une note `tour` aux
consommateurs — **bpx au minimum**, **kanopi** si des scènes de la bibliothèque sont touchées — avec :

1. la **liste EXACTE** des formes invalidées (pas « j'ai durci les clés ») ;
2. le **commit** ;
3. la **migration attendue**, forme par forme.

Constat qui fonde la règle : deux fois le 2026-07-09, bpx a découvert mes fail-loud à son portillon,
sans préavis. C'est le patron « caler le chantier d'un autre », interdit. Corollaire : **avant** de
livrer un fail-loud, passer le corpus des consommateurs (`BPx/test/scenes/`) au compilateur et
compter les casses — ne jamais les laisser les découvrir.

### Changelogs moteur (OBLIGATOIRE)
Après toute modification dans `bp3-engine/csrc/`:
- `csrc/bp3/` (moteur Bernard) → mettre à jour `bp3-engine/CHANGELOG_ENGINE.md`
- `csrc/wasm/` (portage WASM) → mettre à jour `bp3-engine/CHANGELOG_WASM.md`
- Nouveau bug/issue moteur → ajouter dans la tour de contrôle : `/home/romi/dev/bp/hub/courrier/bernard.md`

### Un fail-loud n'est pas le seul chantier qu'on cale — les ARTEFACTS DÉRIVÉS aussi

La règle « un fail-loud de langage est une action de FRONTIÈRE » ne couvrait que les *formes
invalidées*. Elle est trop étroite : **tout changement qui rend périmé un artefact DÉRIVÉ que
d'autres dépôts lisent est une action de frontière**, même s'il n'invalide aucune syntaxe.

Cas payé le 2026-07-19 : j'ai ajouté `@tempo` à 19 scènes (ba8867a). Aucune forme invalidée,
aucun fail-loud — mais BPx lit ces scènes EN DIRECT *et* leurs snapshots `s5_bps` dérivés. Les
scènes ont changé, les snapshots non : 4 de ses tests sont passés au rouge, et il a dû prouver
que son moteur était intact avant de me le remonter. J'avais calé son chantier sans toucher à
une seule règle de langage.

Avant de committer un changement de scène/fixture, se demander : **quel artefact dérivé
devient faux ?** (`snapshots/`, alphabets plats, prototypes, baselines). Le régénérer dans le
MÊME commit, ou prévenir les consommateurs dans le même geste.

⚠️ **Et ne jamais régénérer à l'aveugle pour faire verdir** : le pipeline `s5_bps` était mort
depuis l'extraction de Kanopi (le dispatcher a disparu, l'outil répondait `OK` en dégradant sa
sortie). Régénérer aurait livré des oracles corrompus — pire que des oracles périmés, parce
qu'ils ne crient pas. Valider la régénération sur un LOT, jamais sur un cas : `bells` reproduisait
bit-à-bit, et 49 scènes sur 51 divergeaient.

### Ne jamais attribuer une CAUSE sans la prouver à la source

Chercher l'existant ne suffit pas : il faut aussi vérifier qu'on **n'a pas fabriqué la cause** du
manque. Un gap mal attribué se propage — il se documente, se transmet, et finit devant un
arbitrage qui porte sur une raison inventée.

Cas payé le 2026-07-19, deux fois le même jour :
- `trySerial` classée hors périmètre pour « terminal à deux-points nécessitant un littéral » ;
- `dhadhatite` présentée comme bloquée sur un « marqueur de profondeur `+`/`++` ».

**Les deux causes étaient inventées.** `BP3_help.txt:97-99` documente une feature nommée —
*Structural markers*, quatre glyphes `+ : ; =` — et cite `dhadhatite` en exemple. Ni littéral, ni
mécanisme de profondeur : une feature du moteur que je n'avais pas lue. Sans la consigne
« prouve l'existant avant de poser », Romain aurait tranché deux fois sur des motifs fabriqués.

Avant d'écrire « X est bloqué parce que Y » : **Y est-il prouvé à la source, ou est-ce mon
interprétation de ce que je vois échouer ?** Le symptôme est observé, la cause se démontre.

⚠️ Corollaire appris le même jour : **vérifier une forme, c'est essayer ses POSITIONS.**
`[meter:4+4+4+4/4]` était signalé comme gap d'implémentation — deux fois — alors que la forme
existe : je l'écrivais en tête de partie droite, elle se place en fin de règle comme
`[weight:…]`. L'existant peut être oublié, mais aussi simplement **mal placé**.

### Librairies `lib/` — toute édition passe par le bundle (OBLIGATOIRE)

`src/transpiler/libs-data.js` est le bundle que **tous les consommateurs chargent** ; `lib/*.json`
et `lib/digital/*.ts` en sont les sources. Une édition de source non suivie d'une régénération crée
une divergence **silencieuse** : le code lit encore l'ancienne valeur.

    npm run bundle:libs     # régénère
    npm run bundle:check    # vérifie la fraîcheur (déjà branché dans `npm run arch`, donc au gate)

Règle : **toute édition de `lib/*.json` ou `lib/digital/*.ts` ⇒ régénérer ⇒ committer LES DEUX.**
Le portillon mord (vérifié : source éditée sans bundle ⇒ `npm run arch` sort en 1, push bloqué).

⚠️ **Piège distinct, que la garde de fraîcheur NE couvre PAS** : lire la *mauvaise* source. Elle
vérifie que source et bundle sont **synchrones**, pas qu'on lit le bon des deux. `lib/digital.json`
ne porte **que** la déclaration (description, rang, paramètres) — les corps vivent dans
`lib/digital/<nom>.ts` et n'existent que dans le bundle. Un consommateur qui lit le JSON du disque
y voit des entrées sans `body` et conclut à tort que la lib est vide (payé le 2026-07-18 : le pont
de mesure lisait le JSON, Kairos criait « déclarée au vocabulaire mais SANS fonction exécutable »).
**Charger `LIBS['digital']` depuis le bundle, jamais le JSON.**

### Build & Test
```bash
# OBLIGATOIRE : utiliser build.sh, JAMAIS make directement ni cp manuellement
cd bp3-engine
source /home/romi/dev/bp/emsdk/emsdk_env.sh        # PC2 natif (était /mnt/d/... sous WSL)
./build.sh all                                    # compile 3 targets (linux, windows, wasm)
./build.sh all --archive --version=v3.4.4-wasm.1  # compile + archive
cd ..

# Non-régression — LE portillon (branché sur pre-push : un push est refusé s'il mord)
npm run arch        # garde structurelle + fraîcheur du bundle de librairies
npm run typecheck   # types des librairies digital/homomorphism
npm run verify      # conformité AST_SPEC du corpus + émission des opérateurs de tempo

# Suites complémentaires, à la main quand on touche leur surface
node test/scan_corpus.mjs        # aller-retour BP3 → BPScript → BP3
node test/voie_b_status.mjs      # comparaison à la baseline native, EN SORTIE DE CHAÎNE
# Détail : test/README.md
```

> L'ancien pipeline `S0-S5` (`test_all.cjs`, `runner.cjs`, les étapes `sN`) a été **supprimé le
> 2026-07-19**. Il n'était lancé par rien de vivant, mais restait consultable et se faisait prendre
> pour la procédure courante.

### BPScript Compilation Pipeline
```
Source text → Tokenizer (tokens) → Parser (AST) → Encoder (BP3 grammar + flat alphabet + prototypes) → WASM engine
```

### Key conventions
- `[]` = engine (BP3): `[mode:random]`→RND, `[weight:50]`→`<50>`, `A[/2]`→`/2 A`; durée `{A B}:2`→`{2, A B}` (hors `[]`)
- `()` = runtime: `(vel:80)`→`_script(CT0)`, `(wave:sawtooth)`→`_script(CT1)`
- Direction: `->` (default L→R), `<-` (RIGHT→LEFT), `<>` (bidirectional)
- BP3 rule format: `gram#blockNum[ruleNum] MODE LHS --> RHS`
- Silence: `-` in both BPScript and BP3
- Tied notes: `~` in BPScript → `&` in BP3
- Flags: `[X==N]` → `/X=N/` (guard), `[X=N]` → `/X=N/` (mutation)
- Flat alphabet: no OCT, all terminals as silent sound objects (C4, sa6, etc.) for BP3 compat.
- Block separator: `-----` between subgrammars with different modes

### Mémoire sceptique

La mémoire est un INDICE, pas un fait.
- Avant d'agir sur un souvenir : ouvre le fichier, vérifie l'état réel.
- Si conflit entre mémoire et code : le code fait foi.
- 3 niveaux :
  1. **Surface** : auto-memory (~/.claude/projects/.../memory/) — chargé automatiquement
  2. **Thématique** : RTFM (`rtfm_search` → `rtfm_expand`) — chargé à la demande
  3. **Archives** : `git log`, historique sessions — recherche profonde si besoin

### Agents — Équipe de développement

3 agents spécialisés dans `.claude/agents/` :
- **dev** — Développeur TDD. Code, teste, log dans scratchpad.
- **reviewer** — Review read-only. Classifie CRITICAL/IMPORTANT/MINOR.
- **ops** — Build et archive. Activation manuelle, APPROVE requis.

Communication inter-agents via `.claude/scratchpad/`. Chaque agent écrit ses résultats, le suivant les lit. Aucun contexte partagé directement.

Délégation active obligatoire : donne fichier, ligne, action précise. JAMAIS "fixe le bug" ou "basé sur tes recherches".

Pour les sous-agents de recherche ou tâches simples : utilise Haiku.

### Sources brutes

`raw/` contient les documents bruts (articles, PDFs, notes, clippings).
Ne jamais modifier `raw/` automatiquement. C'est l'espace humain.
Pour ingérer : `rtfm sync raw/ --corpus raw`

### RTFM — Base de connaissances indexée

Ce projet est indexé avec RTFM (MCP server `.mcp.json`).

- Cherche dans RTFM (`rtfm_search`) AVANT Grep/Glob pour toute recherche exploratoire.
- Utilise `rtfm_expand` pour lire les sections pertinentes avec numéros de ligne.
- Ne lis jamais un fichier entier si RTFM peut cibler la section.
- Après modification de fichiers, RTFM se re-synchronise automatiquement.

### Sessions parallèles — Rôles par nom de session

Si tu es lancé avec un nom de session (`-n`), lis immédiatement les fichiers mémoire correspondants pour récupérer tout le contexte accumulé.

**Session `moteur-wasm`** — Moteur BP3 WASM, tests e2e, conformité scènes
- Focus : bugs moteur, pipeline WASM (bp3_api.c, stubs), test_wasm_all.js, CONFORMITY.md, aux files

**Session `transpileur`** — Tokenizer, parser, encoder, acteurs, prototypes
- Focus : tokenizer.js, parser.js, encoder.js, actorResolver.js, prototypes.js, libs.js, lib/*.json, test/

**Session `architecte`** — Architecte/PM de l'écosystème (orchestration, arbitrages, tour de contrôle)
- Skill faisant foi : `.claude/skills/architecte-pm/SKILL.md` ; mémoire : profil_architecte_pm.md

**Session `dev`** — Développeur transpileur (TDD, exécution des ordres de travail de l'architecte)
- Skill faisant foi : `.claude/skills/transpiler-dev/SKILL.md` ; mémoire : profil_dev_bpscript.md

**Session `architecture`** — Design langage, pitch, acteurs, REPL, effets
- Focus : docs/design/*.md, docs/spec/*.md, lib/alphabets.json, lib/tunings.json, lib/temperaments.json, concepts acteurs/REPL/effets

Après lecture des fichiers mémoire, fais un résumé de ce que tu sais pour confirmer que tu as le contexte.

## CodeGraph — graphe de code indexé

Ce dépôt est indexé avec CodeGraph (`.codegraph/`). Pour **comprendre ou localiser du code**
(symboles, appelants/appelés, rayon d'impact d'un changement), utilise
`codegraph explore "<question | symbole>"` (ou l'outil MCP `codegraph_explore`) **avant** grep/find ou
la lecture de fichiers. Complémentaire de RTFM : **RTFM** pour le quoi/où documentaire (texte + PDF),
**CodeGraph** pour la structure d'appel du code. (Index local, non versionné ; cloisonné à ce dépôt.)

## ⚠️ Sous-agents de dev — modèle imposé : Sonnet 5 (Romain 2026-07-12)

Quand tu lances un **sous-agent de développement** (outil Agent/Task), choisis
**TOUJOURS le modèle Sonnet 5** (`claude-sonnet-5`). Vaut pour chaque sous-agent
de dev que tu délègues — jamais un modèle plus lourd par défaut pour ce travail.

## ⚠️ CONFRONTER À RÉCEPTION — un message reçu est une CLAIM, pas un fait

**Décision Romain 2026-07-19** (`hub/decisions/2026-07-19-confronter-via-oracle-et-restaurer-tous-les-guards.md`).

Tout message reçu — d'un agent, de l'architecte, d'un propriétaire légitime sur *son* périmètre —
est une **affirmation à mesurer**, jamais une donnée à appliquer ou à re-relayer telle quelle.
Avant d'agir dessus ou de la transmettre : la confronter à **l'oracle du domaine** (RTFM,
CodeGraph, le skill `bpscript-oracle`, les cartes d'Atlas, les décisions datées, le code).

**Pourquoi ce n'est pas un quinzième garde-fou.** La règle « vérifier avant d'affirmer » existait
déjà le jour où l'erreur a été commise — huit fois, en une seule journée (2026-07-19), par cinq
agents différents, toujours sous la même forme : *un cadrage relayé sans être confronté*. Ce n'est
donc pas un travers individuel qu'on corrige par la volonté, c'est une **propriété du système sous
débit** : le relais coûte moins cher que la vérification, donc il gagne. La seule défense qui a
fonctionné, à chaque fois, est que le **destinataire mesure au lieu d'appliquer**.

Cas concrets payés ce jour-là : un commentaire périmé a fait croire à une régression majeure et
failli déclencher une refonte de l'AST ; une cause inventée a été routée deux fois à un autre
dépôt ; un « artefact oracle » a failli faire annuler deux correctifs bien réels ; et j'ai
moi-même relayé à Kairos une information de Kanopi sur le périmètre d'un tiers sans la vérifier —
c'est Kairos qui l'a attrapée, en mesurant.

Corollaire : **une information vraie chez son émetteur ne l'est pas forcément sur le périmètre
d'un tiers.** Elle se re-vérifie à chaque saut.
