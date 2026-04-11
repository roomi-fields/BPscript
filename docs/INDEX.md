# BPscript — Index documentaire

## spec/ — Le langage tel qu'il EST

| Document | Contenu | Quand le lire |
|----------|---------|---------------|
| [LANGUAGE.md](spec/LANGUAGE.md) | Spécification complète : vision, 3 mots / 24 symboles / 7 opérateurs, types temporels (gate/trigger/cv), double déclaration, `[]` moteur vs `()` runtime, backticks, flags, templates, captures, homomorphismes, compilation vers BP3 | Comprendre la syntaxe BPscript, vérifier une construction du langage, coder le tokenizer/parser/encoder |
| [EBNF.md](spec/EBNF.md) | Grammaire formelle ISO 14977. Toutes les productions EBNF du langage | Valider la syntaxe, coder le parser, vérifier un edge case grammatical |
| [AST.md](spec/AST.md) | Nœuds AST : Scene, Directive, Rule, CVInstance, Macro, Polymetry, etc. | Coder des transformations AST, comprendre la sortie du parser |

## design/ — COMMENT c'est construit

| Document | Contenu | Quand le lire |
|----------|---------|---------------|
| [ARCHITECTURE.md](design/ARCHITECTURE.md) | Pipeline complet : source → tokenizer → parser → encoder → WASM → dispatcher → transports. Acteurs, control table, CV table, live coding, hot-swap | Vue d'ensemble du système, comprendre le flux de données de bout en bout |
| [PITCH.md](design/PITCH.md) | Résolution pitch 6 couches : Layer 0 Actor (binding) → Layer 1 Alphabet → Layer 2 Octaves → Layer 3 Temperament → Layer 4 Tuning → Layer 5 Resolver. Annexe transposition multi-tempéraments | Comprendre comment un token "C#4" devient une fréquence, coder le resolver, ajouter un alphabet/tuning |
| [SOUNDS.md](design/SOUNDS.md) | Résolution terminaux unifiée : 3 échelles (spec < CT < CV), formats JSON (table, template, paramétrique, par registre, samples), résolution par transport (Web Audio/MIDI/OSC), dégradation gracieuse, implémentation (ActorRegistry, SoundsResolver) | Ajouter un instrument, comprendre le cascading spec/CT/CV, coder un transport |
| [CV.md](design/CV.md) | Objets CV temporels : ADSR, LFO, ramp. Routage par cible, bus audio | Ajouter un type de CV, comprendre le routage modulation |
| [EFFECTS.md](design/EFFECTS.md) | Effets et signal processing. Pas de patching dans BPscript — le runtime définit le graphe, le langage définit les paramètres | Comprendre la frontière BPscript/runtime pour les effets |
| [TEMPORAL_DEFORMATION.md](design/TEMPORAL_DEFORMATION.md) | Constraint solver : structure tree (arbre polymétrique avec proportions), 3 modes de déformation (span fixe, proportions fixes, contrainte relâchée), sources de contrôle (potards, MIDI CC, CV, drag) | Coder le constraint solver, comprendre la déformation temporelle live |
| [HOMOMORPHISMS.md](design/HOMOMORPHISMS.md) | Étiquetage post-dérivation : format `{section}.{depth}%{terminal}`, résolution REPL, stacking. Instructions d'implémentation (agent transpileur + agent WASM) | Coder les homomorphismes, comprendre le labeling, briefer un agent |
| [REPL.md](design/REPL.md) | Architecture backticks : 3 types (orphelin, inline, standalone), REPL adapters (SC, Tidal, Python), sessions, timing | Coder un adapter REPL, comprendre l'exécution des backticks |
| [SCENES.md](design/SCENES.md) | Hiérarchie de scènes : @scene directive, scoping des flags (héritage top-down, @expose, isolation siblings), sys auto-exposé, fan-out CC/OSC, cycles de feedback, dispatcher multi-instances | Coder la gestion multi-scènes, comprendre le scoping, implémenter @scene/@expose/@map |
| [BPX_ENGINE_SPEC.md](design/BPX_ENGINE_SPEC.md) | Spec moteur BP4 : instance isolée, AST direct, DerivationTree structuré, streaming, live coding, multi-instance, 7 modes de dérivation, FlagStore observable, TriggerBus async | Implémenter BP4, comprendre l'architecture cible, planifier la migration BP3→BP4 |
| [INTERFACES_BP3.md](design/INTERFACES_BP3.md) | API WASM BP3 : fonctions d'entrée (load grammar/alphabet/settings/tonality), fonctions de sortie (produce, get_result, get_timed_tokens, get_midi_events), verbose levels | Appeler le moteur WASM, comprendre les formats in/out, ajouter une API |

## plan/ — Ce qu'on VA faire

| Document | Contenu | Quand le lire |
|----------|---------|---------------|
| [MARKET_STUDY.md](plan/MARKET_STUDY.md) | Étude de marché live coding exhaustive : ~20 outils analysés (forces/faiblesses), points de douleur utilisateurs, gaps écosystème, recherche académique 2020-2026, tendances marché, positionnement concurrentiel, recommandations stratégiques | Comprendre le marché, prioriser les features, préparer une publication ou un pitch |
| [UI_WEB.md](plan/UI_WEB.md) | Roadmap UI web : Phase 1 contrôles interactifs (sliders runtime), Phase 2 Web MIDI, Phase 3 timeline Canvas (structure tree + constraint solver + drag), Phase 4 mapping contrôleurs → structure | Planifier le dev UI, savoir ce qui est prioritaire, comprendre les dépendances |
| [EDITOR.md](plan/EDITOR.md) | Design éditeur CodeMirror 6 : syntax highlighting, autocomplétion, inline widgets, Lezer parser | Coder l'éditeur, ajouter de la coloration syntaxique |

## reference/ — Guides techniques

| Document | Contenu | Quand le lire |
|----------|---------|---------------|
| [WASM_HOWTO.md](reference/WASM_HOWTO.md) | Build WASM : Emscripten SDK, build.sh, chargement module, API JS | Builder le moteur, debugger un problème WASM |
| [NATIVE_HOWTO.md](reference/NATIVE_HOWTO.md) | Build natif Linux : GCC, options CLI, tests S0/S1 | Compiler bp3 natif, lancer les tests de référence |
| [BP3_FILE_FORMATS.md](reference/BP3_FILE_FORMATS.md) | Formats fichiers BP3 : -gr. (grammaire), -al. (alphabet), -ho. (homomorphisme), -se. (settings), -so. (sound objects), -to. (tonalité), -tb. (tabulature), -cs. (Csound), -gl. (glossaire) | Comprendre un fichier BP3, générer un fichier auxiliaire |
| [HO_FORMAT.md](reference/HO_FORMAT.md) | Format détaillé -ho. : déclarations de terminaux, homomorphismes, timepatterns, basé sur 38 fichiers d'exemple | Coder la génération de fichiers -ho. |

## issues/ — Problèmes ouverts

| Document | Contenu | Status |
|----------|---------|--------|
| [POLYMAKE_STACK.md](issues/POLYMAKE_STACK.md) | Stack overflow sur polymétrie imbriquée 5+ niveaux (not-reich). Workaround : text only, pas de timing | Non résolu — workaround actif |
| [RNG_PORTABLE.md](issues/RNG_PORTABLE.md) | RNG non portable MSVC vs glibc : 6 grammaires S0≠S1. Spec LCG écrite, implémentation pending | Spec prête, code à faire |
