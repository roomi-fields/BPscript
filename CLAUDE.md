## BPScript — Meta-sequencer for Temporal Structure Composition

> ⚠️ **CONTEXTE BPx UNIQUEMENT (règle dure, Romain 2026-06-16).** L'AST est **agnostique du
> moteur**, destiné à **BPx** — aucune notion BP3 (`_xxx(N)`, `flavor:'bp3'`, catégorie « bp3 »…).
> Toute taxonomie d'AST est agnostique (`target: transport|engine`, `timing: bang|durée`), jamais
> « bp3 vs bpx ». Cf. mémoire `feedback_bpx_only_jamais_bp3`.
>
> **La sortie BP3 n'existe plus.** `compileBPS` et l'encodeur ont été SUPPRIMÉS le 2026-07-19
> (arbitrage Romain : « pour la compatibilité bps/gr, la seule chose que je veux c'est que la
> PRODUCTION soit identique, pas la grammaire »). Conformité au moteur natif mesurée sur les
> **jetons produits** vs baseline native — plus sur un texte de grammaire émis. Voie unique :
> `compileToBPxAST(source)` → `{ ast, errors, warnings }`.

3 reserved words, 24 symbols, 9 flag operators. Compiles to BP3 grammar format and runs via WASM.
Orchestrates SC, TidalCycles, Python, MIDI, DMX, etc. in a single file via backticks.

### Language summary
- **3 words**: `gate`, `trigger`, `cv` (temporal types)
- **24 structural symbols**: `@`, `->`, `<-`, `<>`, `{}`, `,`, `()`, `:`, `=`, `[]`, ``` `` ```, `//`, `-`, `_`, `.`, `...`, `!`, `<!`, `#`, `?`, `$`, `&`, `~`, `|`
- **9 flag operators**: comparison `==`, `!=`, `>`, `<`, `>=`, `<=` + calculation `+`, `-`, `=` (`-`/`=` réutilisent des glyphes aussi structuraux)
- **7 reserved qualifier keys**: `mode`, `scan`, `weight`, `on_fail`, `tempo`, `meter`, `scale` (`docs/spec/LANGUAGE.md` ; `scan`/`tempo`/`meter` portés par l'AST). `speed` SUPPRIMÉ (2026-06-26) → durée `:` (`{A B}:2`, `A4:1/2`)
- **Double declaration**: chaque symbole a type temporel + binding runtime (`gate Sa:sc`)
- Silence `-`, prolongation `_`, période `.` (fragment de durée égale) : identiques en BPScript et BP3
- `!` = événement simultané (trigger, gate, cv, ou mutation de flag)
- `[]` = instructions moteur (BP3) : guards, mode, weight, opérateurs tempo (durée `:` hors `[]`)
- `()` = instructions runtime : vel, pan, wave, attack, release, filter… (annotation OPAQUE portée sur l'événement jusqu'au runtime de sortie)
- Backticks : code évalué par le runtime du symbole (implicite) ou tagué (`sc:`, `py:`)

### Architecture
- `bp3-engine/` — Submodule : moteur BP3 WASM ([roomi-fields/bp3-engine](https://github.com/roomi-fields/bp3-engine))
- `src/transpiler/` — Parser et compiler
  - `tokenizer.js` — Source → tokens · `parser.js` — Tokens → AST (Scene, Directive, Rule, CVInstance, Macro, Polymetry)
  - `bpxAst.js` — Parser → AST canonique (annotations `payload`, validations fail-loud)
  - `index.js` — Façade : `compileToBPxAST(source)` → `{ ast, errors, warnings }` (voie UNIQUE)
  - `actorResolver.js` — Résout les acteurs (bindings alphabet/tuning/octaves) · `libs.js` — Library loader (JSON → controls, symbols, CV objects)
- `src/bpx/` — BPx engine stub (moteur de dérivation nouvelle génération, cf. specs BPX)
- `lib/` — Librairies JSON (controls, alphabets, tunings, filter, routing…)
- `dist/` — Build BP3 WASM (bp3.js, bp3.wasm, bp3.data)
- `docs/` — Documentation (5 dossiers par type)
  - `spec/` — `LANGUAGE.md` (spéc complète) · `EBNF.md` (grammaire formelle) · `AST.md` (nœuds AST)
  - `design/` — `ARCHITECTURE.md` (pipeline source→AST→grammaire BP3 + interface WASM) · `ACTOR.md`
    (acteur=voix : alphabet/tuning/sound/transport/eval, cascade de sortie, voix notes vs code,
    appareils) · `PITCH.md` (résolution pitch 6 couches : actor→alphabet→octaves→temperament→
    tuning→resolver) · `SOUNDS.md` (résolution terminaux unifiée : spec < CT < CV cascading) ·
    `CV.md` (CV/signal : ADSR, LFO, ramp) · `EFFECTS.md` · `HOMOMORPHISMS.md` (étiquetage
    post-dérivation) · `REPL.md` (adapters, backticks) · `SCENES.md` (hiérarchie de scènes,
    scoping flags, @scene/@expose/@map, sys) · (docs moteur BPx migrées dans le dépôt BPx :
    `../BPx/docs/ARCHITECTURE.md`, `../BPx/docs/ENGINE_SPEC.md`, `../BPx/docs/IMPLEMENTATION.md`)
    · `INTERFACES_BP3.md` (interface WASM in/out) · `TEMPORAL_DEFORMATION.md` (constraint solver)
  - `reference/` — `WASM_HOWTO.md` · `NATIVE_HOWTO.md` · `BP3_FILE_FORMATS.md` · `HO_FORMAT.md`
  - `issues/` — `POLYMAKE_STACK.md` (stack overflow polymétrie imbriquée) · `RNG_PORTABLE.md`
    (portabilité RNG MSVC/glibc) · `TEMPO_OPS_WASM.md` (opérateurs tempo `/N` `\N` `_tempo()` :
    écarts WASM vs natif)

### Tour de contrôle inter-projets (OBLIGATOIRE) — outil `tour`
Coordination de l'écosystème (BPScript, BPx, bp3-frontend, runtimes, moteur Bernard) : dépôt
PRIVÉ `/home/romi/dev/bp/hub`. Protocole MÉCANISÉ par le CLI `hub/tour` (plus d'édition markdown
à la main). Détail : `hub/README.md` (§Le protocole + §Outil tour).

0. **Règle de boucle** (Romain 2026-06-16) : (a) **RÉVEIL = COURRIER D'ABORD** — première action de
   tout réveil (session ou ping) = `tour inbox`. (b) **RAPPORT AVANT IDLE** — jamais s'arrêter en
   silence : dernière action = `tour send architecte` avec `FINI: <quoi> + commit` ou
   `BLOQUÉ: <sur quoi>`.
1. **Identité** (une fois/session) : `export BP_AGENT=bpscript`.
2. **Début de session** : `~/dev/bp/hub/tour inbox` + lire `TABLEAU.md` et mes `contrats/`.
3. **Écrire/arbitrer** : `~/dev/bp/hub/tour send <dest> "msg"` (`architecte` = destinataire valide).
   Jamais écrire dans ma propre boîte. Marquer lu : `tour inbox --ack`.
4. **Fin de session** : mettre à jour MOI-MÊME `TABLEAU.md` (ma ligne), `projets/bpscript.md`,
   `BPscript/baseline-status.json` (ma colonne). L'architecte ne corrige plus mes pièces, il recadre.
5. **Décisions transverses** : `decisions/` après arbitrage utilisateur uniquement
   (`tour decide <slug> -m titre --impacts a,b,c`). `constats/` = un finding écrit UNE fois,
   référencé ailleurs.
6. **Le code fait foi** : un statut se vérifie sur pièces, jamais affirmé de mémoire.

### Un fail-loud de langage est une action de FRONTIÈRE (architecte 2026-07-09)
Quand une forme jusque-là acceptée devient une erreur, les consommateurs aval **live-importent**
la source et leur portillon casse en minutes (précédent : chantier durée 2026-07-05, garde des
clés `[]` 9ec2abc — bpx a découvert le fail-loud à son portillon, sans préavis, deux fois le même
jour). AVANT/AVEC le commit, envoyer une note `tour` aux consommateurs (**bpx au minimum**,
**kanopi** si des scènes de la bibliothèque sont touchées) avec : 1. la **liste EXACTE** des formes
invalidées ; 2. le **commit** ; 3. la **migration attendue**, forme par forme. Corollaire : avant
de livrer un fail-loud, passer le corpus des consommateurs (`BPx/test/scenes/`) au compilateur et
compter les casses — ne jamais les laisser les découvrir.

### Changelogs moteur (OBLIGATOIRE)
Après toute modification dans `bp3-engine/csrc/` :
- `csrc/bp3/` (moteur Bernard) → mettre à jour `bp3-engine/CHANGELOG_ENGINE.md`
- `csrc/wasm/` (portage WASM) → mettre à jour `bp3-engine/CHANGELOG_WASM.md`
- Nouveau bug/issue moteur → ajouter dans `/home/romi/dev/bp/hub/courrier/bernard.md`

### Les ARTEFACTS DÉRIVÉS aussi sont une frontière (pas seulement les fail-loud)
Tout changement qui rend périmé un artefact DÉRIVÉ lu par d'autres dépôts est une action de
frontière, même sans syntaxe invalidée. Payé le 2026-07-19 : ajout de `@tempo` à 19 scènes
(ba8867a) sans fail-loud — BPx lit ces scènes EN DIRECT et leurs snapshots `s5_bps` dérivés,
restés périmés → 4 tests BPx passés au rouge, chantier calé sans toucher une règle de langage.
Avant de committer un changement de scène/fixture : **quel artefact dérivé devient faux ?**
(`snapshots/`, alphabets plats, prototypes, baselines) — le régénérer dans le MÊME commit, ou
prévenir dans le même geste. ⚠️ Ne jamais régénérer à l'aveugle pour faire verdir : le pipeline
`s5_bps` était mort depuis l'extraction de Kanopi (dispatcher disparu, l'outil répondait `OK` en
dégradant sa sortie) — régénérer aurait livré des oracles corrompus, muets. Valider sur un LOT,
jamais sur un cas (`bells` reproduisait bit-à-bit, 49/51 scènes divergeaient).

### Ne jamais attribuer une CAUSE sans la prouver à la source
Chercher l'existant ne suffit pas : vérifier qu'on n'a pas fabriqué la cause du manque — un gap
mal attribué se propage jusqu'à un arbitrage sur une raison inventée. Payé deux fois le 2026-07-19 :
`trySerial` classée hors périmètre pour « terminal à deux-points nécessitant un littéral » et
`dhadhatite` présentée comme bloquée sur un « marqueur de profondeur `+`/`++` » — **les deux causes
étaient inventées** : `BP3_help.txt:97-99` documente une feature nommée (*Structural markers*,
glyphes `+ : ; =`) citant `dhadhatite` en exemple, sans littéral ni mécanisme de profondeur. Avant
d'écrire « X est bloqué parce que Y » : Y est-il prouvé à la source, ou est-ce mon interprétation
de ce qui échoue ? Le symptôme s'observe, la cause se démontre. ⚠️ Corollaire même jour : **vérifier
une forme, c'est essayer ses POSITIONS** — `[meter:4+4+4+4/4]` signalé comme gap deux fois alors
qu'elle existe, mal placée (elle va en fin de règle comme `[weight:…]`, pas en tête). L'existant peut
être oublié, ou simplement mal placé.

### Librairies `lib/` — toute édition passe par le bundle (OBLIGATOIRE)
`src/transpiler/libs-data.js` est le bundle que **tous les consommateurs chargent** ; `lib/*.json`
et `lib/digital/*.ts` en sont les sources. Éditer la source sans régénérer crée une divergence
**silencieuse** (le code lit encore l'ancienne valeur).

    npm run bundle:libs     # régénère
    npm run bundle:check    # vérifie la fraîcheur (branché dans `npm run arch`, donc au gate)

Règle : toute édition de `lib/*.json` ou `lib/digital/*.ts` ⇒ régénérer ⇒ committer LES DEUX. Le
portillon mord (vérifié : source éditée sans bundle ⇒ `npm run arch` sort en 1, push bloqué).

⚠️ **Piège distinct que la garde de fraîcheur NE couvre PAS** : lire la *mauvaise* source. Elle
vérifie que source et bundle sont synchrones, pas qu'on lit le bon des deux. `lib/digital.json` ne
porte QUE la déclaration (description, rang, paramètres) — les corps vivent dans
`lib/digital/<nom>.ts` et n'existent que dans le bundle. Un consommateur qui lit le JSON du disque y
voit des entrées sans `body` et conclut à tort que la lib est vide (payé le 2026-07-18 : le pont de
mesure lisait le JSON, Kairos criait « déclarée au vocabulaire mais SANS fonction exécutable »).
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
> 2026-07-19** : plus lancé par rien de vivant, mais restait consultable et se faisait prendre pour
> la procédure courante.

### BPScript Compilation Pipeline
```
Source text → Tokenizer (tokens) → Parser (AST) → AST canonique (bpxAst) → BPx → Kairos → Kronos
```
L'étape « Encoder → grammaire BP3 → moteur WASM » a été SUPPRIMÉE le 2026-07-19 : plus d'émission
de texte BP3. Conformité au moteur natif mesurée sur les **jetons produits**
(`test/voie_b_status.mjs`, comparaison à la baseline native).

### Key conventions
- `[]` = instructions MOTEUR, lues/interprétées par BPx (mode, weight, tempo, meter…) ; durée
  `{A B}:2` (hors `[]`)
- `()` = annotation OPAQUE portée SUR l'événement jusqu'au runtime de sortie (`vel`, `wave`…).
  Dans l'AST : `RuntimeQualifier` en suffixe, `InstantControl` dans le flux. Portée déclarée
  (`payload.scope` : `rule` | `group` | `template`, avec `containment:true`)
- Direction : `->` (défaut L→R), `<-` (R→L), `<>` (bidirectionnel)
- Silence `-`, tied notes `~` en BPScript → `&` en BP3
- Flags : `[X==N]` → `/X=N/` (guard), `[X=N]` → `/X=N/` (mutation)
- Flat alphabet : pas d'OCT, tous les terminaux en objets sonores silencieux (C4, sa6…) pour
  compat BP3
- Block separator : `-----` entre sous-grammaires de modes différents

### Mémoire sceptique
La mémoire est un INDICE, pas un fait. Avant d'agir sur un souvenir : ouvrir le fichier, vérifier
l'état réel. Conflit mémoire/code : le code fait foi. 3 niveaux :
1. **Surface** : auto-memory (`~/.claude/projects/.../memory/`) — chargé automatiquement
2. **Thématique** : RTFM (`rtfm_search` → `rtfm_expand`) — à la demande
3. **Archives** : `git log`, historique sessions — recherche profonde si besoin

### Agents — Équipe de développement
3 agents spécialisés dans `.claude/agents/` :
- **dev** — Développeur TDD. Code, teste, log dans scratchpad.
- **reviewer** — Review read-only. Classifie CRITICAL/IMPORTANT/MINOR.
- **ops** — Build et archive. Activation manuelle, APPROVE requis.

Communication inter-agents via `.claude/scratchpad/` (écrit/lu séquentiellement, aucun contexte
partagé). Délégation active obligatoire : fichier, ligne, action précise — jamais "fixe le bug" ou
"basé sur tes recherches". Sous-agents de recherche/tâches simples : Haiku.

### Sources brutes
`raw/` contient les documents bruts (articles, PDFs, notes, clippings). Ne jamais modifier `raw/`
automatiquement — espace humain. Pour ingérer : `rtfm sync raw/ --corpus raw`

### RTFM — Base de connaissances indexée

Ce projet est indexé avec RTFM (MCP server `.mcp.json`).

- Cherche dans RTFM (`rtfm_search`) AVANT Grep/Glob pour toute recherche exploratoire.
- Utilise `rtfm_expand` pour lire les sections pertinentes avec numéros de ligne.
- Ne lis jamais un fichier entier si RTFM peut cibler la section.
- Après modification de fichiers, RTFM se re-synchronise automatiquement.

### Sessions parallèles — Rôles par nom de session
Si lancé avec un nom de session (`-n`), lire immédiatement les fichiers mémoire correspondants pour
récupérer tout le contexte accumulé. Après lecture, résumer ce qu'on sait pour confirmer le contexte.

- **`moteur-wasm`** — Moteur BP3 WASM, tests e2e, conformité scènes. Focus : bugs moteur, pipeline
  WASM (bp3_api.c, stubs), CONFORMITY.md, aux files (`test_wasm_all.js` retiré le 2026-07-19 : la
  conformité se mesure contre le moteur NATIF, pas WASM — il ne se chargeait plus).
- **`transpileur`** — Tokenizer, parser, encoder, acteurs, prototypes. Focus : tokenizer.js,
  parser.js, encoder.js, actorResolver.js, prototypes.js, libs.js, lib/*.json, test/
- **`architecte`** — Architecte/PM de l'écosystème (orchestration, arbitrages, tour de contrôle).
  Skill : `.claude/skills/architecte-pm/SKILL.md` ; mémoire : profil_architecte_pm.md
- **`dev`** — Développeur transpileur (TDD, exécution des ordres de l'architecte). Skill :
  `.claude/skills/transpiler-dev/SKILL.md` ; mémoire : profil_dev_bpscript.md
- **`architecture`** — Design langage, pitch, acteurs, REPL, effets. Focus : docs/design/*.md,
  docs/spec/*.md, lib/alphabets.json, lib/tunings.json, lib/temperaments.json

## CodeGraph — graphe de code indexé

Ce dépôt est indexé avec CodeGraph (`.codegraph/`). Pour **comprendre ou localiser du code**
(symboles, appelants/appelés, rayon d'impact d'un changement), utilise
`codegraph explore "<question | symbole>"` (ou l'outil MCP `codegraph_explore`) **avant** grep/find ou
la lecture de fichiers. Complémentaire de RTFM : **RTFM** pour le quoi/où documentaire (texte + PDF),
**CodeGraph** pour la structure d'appel du code. (Index local, non versionné ; cloisonné à ce dépôt.)

## ⚠️ Sous-agents de dev — modèle imposé : Sonnet 5 (Romain 2026-07-12)
Quand tu lances un **sous-agent de développement** (outil Agent/Task), choisis **TOUJOURS le
modèle Sonnet 5** (`claude-sonnet-5`) — jamais un modèle plus lourd par défaut pour ce travail.

## ⚠️ CONFRONTER À RÉCEPTION — un message reçu est une CLAIM, pas un fait
**Décision Romain 2026-07-19** (`hub/decisions/2026-07-19-confronter-via-oracle-et-restaurer-tous-les-guards.md`).

Tout message reçu — d'un agent, de l'architecte, d'un propriétaire légitime sur *son* périmètre —
est une **affirmation à mesurer**, jamais une donnée à appliquer ou re-relayer telle quelle. Avant
d'agir dessus ou de la transmettre : confronter à **l'oracle du domaine** (RTFM, CodeGraph, le
skill `bpscript-oracle`, les cartes d'Atlas, les décisions datées, le code).

**Pas un 15e garde-fou** : « vérifier avant d'affirmer » existait déjà le jour où l'erreur a été
commise huit fois en une journée (2026-07-19) par cinq agents, toujours sous la même forme — un
cadrage relayé sans être confronté. Propriété du système sous débit : le relais coûte moins cher
que la vérification, donc il gagne. Seule défense qui a fonctionné : le destinataire **mesure** au
lieu d'appliquer. Payé ce jour-là : un commentaire périmé a failli déclencher une refonte de l'AST ;
une cause inventée routée deux fois à un autre dépôt ; un « artefact oracle » a failli faire annuler
deux correctifs réels ; j'ai moi-même relayé à Kairos une info de Kanopi sur le périmètre d'un tiers
sans la vérifier — c'est Kairos qui l'a attrapée en mesurant. Corollaire : une info vraie chez son
émetteur ne l'est pas forcément sur le périmètre d'un tiers — elle se revérifie à chaque saut.

### NOMMER L'AXE ET LA RÉVISION — défense complémentaire, sans vigilance requise
Toute mesure transmise déclare SUR QUOI elle porte : sur quel **axe** (jetons MIDI ? sortie texte ?
noms et temps ? Hz absolu ?) et sur quelle **révision** (un commit nommable, jamais « l'état
courant »). Mesuré le 2026-07-19 :
- bp3-engine a alerté trois agents d'une régression `_rotate` inexistante, diagnostiquée sur la
  seule sortie texte ; nommer l'axe (jetons MIDI, identiques à l'octet) a rendu son erreur trouvable
  et envoyé vérifier — la rotation était bien appliquée.
- j'ai publié « 27 captures absentes » en lisant l'arbre de travail d'un autre dépôt en cours de
  réécriture, propagé à trois destinataires ; sur la révision publiée, zéro absente — une mesure
  sans révision nommée est **périssable**.

Corollaires, tous payés le même jour :
- Une vérification ne peut pas attraper ce qu'elle ne regarde pas : j'ai vérifié
  `test/grammars/vina/scene.bps` ligne par ligne et annoncé la bascule faite ; Kairos mesurait
  `scenes/vina.bps`, dont j'ignorais l'existence. Avant d'annoncer un changement fait, **demander à
  l'aval quel fichier il lit**.
- Vérifier un piège ne protège pas des autres : bp3-engine avait écarté « variance aléatoire » sans
  tester « mauvais axe ». Une précaution réussie donne la confiance qui fait sauter la suivante.
- Ne jamais garder un artefact de mesure « au cas où » : un fichier de résultats périmé a fait
  frôler trois fois un faux « désaccord entre outils ». Un dérivé non daté ment.
- Deux chiffres qui ne concordent pas : vérifier lequel des deux termes est fiable AVANT de rédiger
  l'écart — quatre fois ce jour-là, la cause était mon propre terme (fichier périmé, souvenir pris
  pour mesure, dépouillement fautif), jamais l'outil mis en cause.
