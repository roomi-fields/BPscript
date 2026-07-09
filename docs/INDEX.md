# BPScript — Index documentaire

## spec/ — Le langage tel qu'il EST

| Document | Contenu | Quand le lire |
|----------|---------|---------------|
| [LANGUAGE.md](spec/LANGUAGE.md) | Spécification complète : vision, 3 mots / 24 symboles / 9 opérateurs de flags, types temporels (gate/trigger/cv), double déclaration, `[]` moteur vs `()` runtime, backticks, flags, templates, captures, homomorphismes, compilation vers BP3 | Comprendre la syntaxe BPScript, vérifier une construction du langage, coder le tokenizer/parser/encoder |
| [EBNF.md](spec/EBNF.md) | Grammaire formelle ISO 14977. Toutes les productions EBNF du langage | Valider la syntaxe, coder le parser, vérifier un edge case grammatical |
| [AST.md](spec/AST.md) | Nœuds AST : Scene, Directive, Rule, CVInstance, Macro, Polymetry, etc. | Coder des transformations AST, comprendre la sortie du parser |

## design/ — COMMENT c'est construit

| Document | Contenu | Quand le lire |
|----------|---------|---------------|
| [ARCHITECTURE.md](design/ARCHITECTURE.md) | Pipeline de compilation : source → tokenizer → parser → encoder → grammaire BP3 + alphabet + prototypes → moteur WASM → timed tokens. Acteurs, control table, CV table | Vue d'ensemble du système, comprendre le flux de données de bout en bout |
| [PITCH.md](design/PITCH.md) | Résolution pitch 6 couches : Layer 0 Actor (binding) → Layer 1 Alphabet → Layer 2 Octaves → Layer 3 Temperament → Layer 4 Tuning → Layer 5 Resolver. Annexe transposition multi-tempéraments | Comprendre comment un token "C#4" devient une fréquence, coder le resolver, ajouter un alphabet/tuning |
| [SOUNDS.md](design/SOUNDS.md) | Résolution terminaux unifiée : 3 échelles (spec < CT < CV), formats JSON (table, template, paramétrique, par registre, samples), résolution par transport (Web Audio/MIDI/OSC), dégradation gracieuse, implémentation (ActorRegistry, SoundsResolver) | Ajouter un instrument, comprendre le cascading spec/CT/CV, coder un transport |
| [CV.md](design/CV.md) | Objets CV temporels : ADSR, LFO, ramp. Routage par cible, bus audio | Ajouter un type de CV, comprendre le routage modulation |
| [EFFECTS.md](design/EFFECTS.md) | Effets et signal processing. Pas de patching dans BPScript — le runtime définit le graphe, le langage définit les paramètres | Comprendre la frontière BPScript/runtime pour les effets |
| [TEMPORAL_DEFORMATION.md](design/TEMPORAL_DEFORMATION.md) | Constraint solver : structure tree (arbre polymétrique avec proportions), 3 modes de déformation (span fixe, proportions fixes, contrainte relâchée), sources de contrôle (potards, MIDI CC, CV, drag) | Coder le constraint solver, comprendre la déformation temporelle live |
| [HOMOMORPHISMS.md](design/HOMOMORPHISMS.md) | Étiquetage post-dérivation : format `{section}.{depth}%{terminal}`, résolution REPL, stacking. Instructions d'implémentation (agent transpileur + agent WASM) | Coder les homomorphismes, comprendre le labeling, briefer un agent |
| [REPL.md](design/REPL.md) | Architecture backticks : 3 types (orphelin, inline, standalone), REPL adapters (SC, Tidal, Python), sessions, timing | Coder un adapter REPL, comprendre l'exécution des backticks |
| [SCENES.md](design/SCENES.md) | Hiérarchie de scènes : @scene directive, scoping des flags (héritage top-down, @expose, isolation siblings), sys auto-exposé, fan-out CC/OSC, cycles de feedback | Comprendre le modèle multi-scènes, le scoping des flags, la sémantique @scene/@expose/@map |
| Moteur BPx (docs migrées) | Les dossiers d'architecture, contrat externe et implémentation du moteur BPx vivent désormais dans le dépôt BPx : `../../BPx/docs/ARCHITECTURE.md`, `ENGINE_SPEC.md`, `IMPLEMENTATION.md` | Comprendre / coder le moteur BPx |
| [INTERFACES_BP3.md](design/INTERFACES_BP3.md) | API WASM BP3 : fonctions d'entrée (load grammar/alphabet/settings/tonality), fonctions de sortie (produce, get_result, get_timed_tokens, get_midi_events), verbose levels | Appeler le moteur WASM, comprendre les formats in/out, ajouter une API |

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
| [TEMPO_OPS_WASM.md](issues/TEMPO_OPS_WASM.md) | Opérateurs tempo `/N`, `\N`, `_tempo()` : écarts comportementaux WASM vs natif (tests MIDI comparés) | Investigation en cours |
