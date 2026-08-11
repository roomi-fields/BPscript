# BPScript — Index documentaire

## spec/ — Le langage tel qu'il EST

| Document | Contenu | Quand le lire |
|----------|---------|---------------|
| [LANGUAGE.md](spec/LANGUAGE.md) | Spécification complète : vision, 3 mots / 24 symboles / 9 opérateurs de flags, types temporels (gate/trigger/cv), double déclaration, `[]` moteur vs `()` runtime, backticks, flags, templates, captures, homomorphismes, compilation vers BP3 | Comprendre la syntaxe BPScript, vérifier une construction du langage, coder le tokenizer/parser/encoder |
| [EBNF.md](spec/EBNF.md) | Grammaire formelle ISO 14977. Toutes les productions EBNF du langage | Valider la syntaxe, coder le parser, vérifier un edge case grammatical |
| [AST.md](spec/AST.md) | Nœuds AST : Scene, Directive, Rule, CVInstance, Macro, Polymetry, etc. | Coder des transformations AST, comprendre la sortie du parser |

## Chantiers — les plans en cours

| Document | Contenu | Quand le lire |
|----------|---------|---------------|
| [PLAN_CONFORMITE_LIBRAIRIES.md](PLAN_CONFORMITE_LIBRAIRIES.md) | Les cinq règles de Romain sur les librairies, l'écart mesuré pour chacune, et l'ordre dans lequel il se ferme : les librairies portent ce qu'il faut lire, la résolution suit la cascade, le parseur cesse de nommer les mots, les librairies manquantes naissent | Avant de toucher à `lib/`, à la résolution d'un nom nu, ou à un contrôle cité en dur dans le parseur |

## Frontières — qui lit ma surface

| Document | Contenu | Quand le lire |
|----------|---------|---------------|
| [CONSOMMATEURS.md](CONSOMMATEURS.md) | Les dépôts qui lisent la surface du langage et l'arbre, ce que chacun lit, et comment mesurer son corpus. Les trois informations d'un préavis : la forme qui sort, la forme qui entre, les variantes voisines concernées ou non | Avant de rendre une forme invalide, avant de déclarer un mot, avant de changer un artefact dérivé |

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
| [SCENES.md](archive/SCENES.md) | **ARCHIVÉ** — la hiérarchie de scènes est supprimée du langage | mémoire seulement ; ne rien en tirer |
| Moteur BPx (docs migrées) | Les dossiers d'architecture, contrat externe et implémentation du moteur BPx vivent désormais dans le dépôt BPx : `../../BPx/docs/ARCHITECTURE.md`, `ENGINE_SPEC.md`, `IMPLEMENTATION.md` | Comprendre / coder le moteur BPx |
| [INTERFACES_BP3.md](design/INTERFACES_BP3.md) | API WASM BP3 : fonctions d'entrée (load grammar/alphabet/settings/tonality), fonctions de sortie (produce, get_result, get_timed_tokens, get_midi_events), verbose levels | Appeler le moteur WASM, comprendre les formats in/out, ajouter une API |

## reference/ — Guides techniques

| Document | Contenu | Quand le lire |
|----------|---------|---------------|
| [NATIVE_HOWTO.md](reference/NATIVE_HOWTO.md) | Build natif Linux : GCC, options CLI, tests S0/S1 | Compiler bp3 natif, lancer les tests de référence |
| [BP3_FILE_FORMATS.md](reference/BP3_FILE_FORMATS.md) | Formats fichiers BP3 : -gr. (grammaire), -al. (alphabet), -ho. (homomorphisme), -se. (settings), -so. (sound objects), -to. (tonalité), -tb. (tabulature), -cs. (Csound), -gl. (glossaire) | Comprendre un fichier BP3, générer un fichier auxiliaire |
| [HO_FORMAT.md](reference/HO_FORMAT.md) | Format détaillé -ho. : déclarations de terminaux, homomorphismes, timepatterns, basé sur 38 fichiers d'exemple | Coder la génération de fichiers -ho. |

## issues/ — Problèmes ouverts

| Document | Contenu | Status |
|----------|---------|--------|
| [POLYMAKE_STACK.md](issues/POLYMAKE_STACK.md) | Stack overflow sur polymétrie imbriquée 5+ niveaux (not-reich). Workaround : text only, pas de timing | Non résolu — workaround actif |

> RNG non portable MSVC vs glibc (6 grammaires S0≠S1) : **résolu le 2026-04-02** (LCG portable
> implémenté, `bp3_random.c`/`.h`, score S0=S1 passé à 26/30 EXACT). Retiré de la table ci-dessus ;
> le document `issues/RNG_PORTABLE.md` qui portait ce détail a été supprimé le 2026-07-31
> (assainissement doc, chantier clos — `hub/decisions/2026-07-31-refonte-de-la-documentation-sept-formes-un-proprietaire-trois-gardes.md`).

| [GOTO_FAILED_ONFAIL.md](issues/GOTO_FAILED_ONFAIL.md) | Procédures de dérivation `goto`, `failed`, `onfail` : comportement attendu et écarts relevés | Coder ou vérifier une procédure de fin de règle |
| [S8_ADVANCED_MECHANISMS.md](issues/S8_ADVANCED_MECHANISMS.md) | Mécanismes avancés du palier S8 | Reprendre le palier S8 |

## Conception en attente d'arbitrage

| Document | Contenu |
|----------|---------|
| [MARQUEUR_DE_POSITION_SELECTION_DE_REGLE.md](decisions-en-attente/MARQUEUR_DE_POSITION_SELECTION_DE_REGLE.md) | Marqueur de position dans la sélection de règle |
| [OBJETS_SONORES_SEQUENCES.md](decisions-en-attente/OBJETS_SONORES_SEQUENCES.md) | Objets sonores en séquence |
| [PARSEUR_DERIVE.md](design/PARSEUR_DERIVE.md) | Parseur dérivé de la grammaire |
| [PORTEES_DES_CONTROLES.md](design/PORTEES_DES_CONTROLES.md) | Les portées auxquelles un contrôle s'accroche |
| [SCENE_VALUES_OVERRIDE.md](design/SCENE_VALUES_OVERRIDE.md) | Cascade des valeurs de scène |
| [GRAMMAIRES_DE_TEST_BP3.md](design/GRAMMAIRES_DE_TEST_BP3.md) | Les grammaires BP3 qui servent de banc |
| [code-voices-user-doc.md](drafts/code-voices-user-doc.md) | Brouillon d'aide sur les voix de code |

## Le banc

| Document | Contenu |
|----------|---------|
| [CE_QUI_DORT.md](../test/CE_QUI_DORT.md) | Les gardes suspendus, et ce qui les réveille |
| [BASELINE_COVERAGE.md](../test/grammars/BASELINE_COVERAGE.md) | La couverture de référence du corpus de grammaires |
| [UNSUPPORTED.md](../test/grammars/dhadhatite_v2/UNSUPPORTED.md) | Les formes que `dhadhatite_v2` n'atteint pas |

## Vision

[VISION.md](../VISION.md) — ce que le langage vise.

## Archive

[LIRE-MOI.md](archive/LIRE-MOI.md) — documents retirés du corpus vivant. **Aucun ne fait autorité.**
