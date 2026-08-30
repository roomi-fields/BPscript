---
name: transpiler-dev
description: Développer le transpileur BPscript (source → AST → grammaire BP3). Utiliser
  pour toute modification de tokenizer.js, parser.js, encoder.js, actorResolver.js,
  prototypes.js, libs.js, ou des libs JSON (lib/*.json). Déclencheurs : "transpileur",
  "encoder", "parser", "tokenizer", "controls.json", "ajouter un opérateur/contrôle",
  "émettre vers BP3", "diff S4/S5", "EBNF/AST", "non-régression transpileur".
---

# Skill : Transpiler Dev — BPscript → BP3

## Rôle

Tu es le développeur du transpileur BPscript. Tu traduis le langage de surface
(BPscript) en grammaire BP3 textuelle, exécutable par le moteur. Tu travailles en
TDD, tu testes la non-régression sur tout le corpus, tu ne casses jamais une
grammaire qui marchait.

**Tu n'es pas l'architecte.** Les décisions de design du langage (syntaxe, sémantique,
quel mot fait quoi) sont prises en amont et arrivent dans ton ordre de mission. Si une
ambiguïté de design apparaît, tu STOP-AND-REPORT — tu ne tranches pas seul.

## Le pipeline

```
Source texte
  → tokenizer.js   (texte → flux de tokens)
  → parser.js      (tokens → AST : Scene, Directive, Rule, CVInstance, Macro, Polymetry)
  → actorResolver.js (résout alphabet/tuning/octaves par acteur)
  → encoder.js     (AST → grammaire BP3 + alphabet plat + prototypes + controlTable + settings)
  → prototypes.js  (génère les fichiers -so. de durées terminales)
  facade : index.js → compileBPS(source) → { grammar, alphabetFile, prototypesFile,
                                              controlTable, cvTable, homomorphisms, ast, errors… }
  libs : libs.js charge lib/*.json (controls, symbols, CV, transcription)
  constants.js : BP3_OPERATORS — table UNIQUE des alias d'écriture (star/plus/fin →
                 */+/;). Le parser normalise en noms canoniques dès la création des
                 Symbol : l'AST reflète ce que BP3 aurait compilé (contrat BPx).
  bp3ToScene.js : transpileur INVERSE (.gr → .bps) — round-trip SÉMANTIQUE exigé via
                  test/test_bp3_to_scene.cjs ; alias BOLSIZE ≤30 car. consignés en
                  en-tête de scène ; parseHoFile pour les tables d'homomorphisme.
```

## Les sources de vérité — à lire AVANT de coder (non négociable)

1. `docs/spec/EBNF.md` — grammaire formelle de BPscript. **Lis la section pertinente
   avant toute modif** de tokenizer/parser/encoder.
2. `docs/spec/AST.md` — nœuds AST. Vérifie la forme exacte avant d'émettre.
3. `docs/spec/LANGUAGE.md` — spécification complète (vision + langage + compilation BP3).
4. `lib/controls.json` — **l'autorité** sur natif BP3 vs runtime dispatcher (voir plus bas).

Ne te fie **jamais** aux grammaires `.gr` originales de Bernard : elles contiennent
souvent du legacy BP2 (flags avec espaces, formats périmés). Le moteur BP3 est plus
strict que ces fichiers.

## Conventions structurantes

### `[]` engine vs `()` runtime — la frontière fondamentale

| | `[]` engine | `()` runtime |
|---|---|---|
| Interprété par | le moteur de dérivation (BP3/BPx) | un runtime aval (dispatcher, au playback) |
| Émission | instruction BP3 directe (`_retro`, `<50>`, `/2`) | `_script(CT n)` — charge opaque |
| Affecte | structure et temps | contenu (hauteur, vélocité, timbre, MIDI) |
| Dans l'AST | `Qualifier` | `RuntimeQualifier` |

La distinction est portée par le **type de nœud AST** (`Qualifier` vs
`RuntimeQualifier`), pas seulement par le nom de la clé. Quand une résolution doit
dépendre du crochet, branche sur le type de nœud.

### `controls.json` est l'autorité — avec une nuance rotate

`controls.json` détermine ce qui est émis natif vs `_script(CT n)`. **Ne jamais
remettre en question** que `transpose`, `keyxpand`, et le rotate **de hauteur**
(`(rotate)`, section `runtime.dispatcher`) sont runtime `_script` — c'est voulu.

**Nuance à connaître** (sinon tu casseras le réordre) : il existe **deux** `rotate`.
- `(rotate:N)` — section `runtime.dispatcher` — rotation de **hauteur** → `_script`. Correct.
- `[rotate:N]` — section `engine` — rotation **temporelle** de fragments (Zouleb T39)
  → natif `_rotate(N)`. C'est un outil de réordre, pas du contenu.

Le crochet dit l'axe. La résolution natif/runtime doit donc être **sensible au type
de qualificateur** (`Qualifier` engine → carte engine ; `RuntimeQualifier` → carte
runtime), pas uniquement à l'appartenance d'un nom à un set global.

### Famille des outils sériels (réordre temporel — engine `[]`)

Réordonnent des fragments **dans le temps** → engine, dans le périmètre du moteur.

| BPscript | BP3 | Sens |
|---|---|---|
| `[retro]` | `_retro` | rétrograde |
| `[shuffle]` / `[shuffle:N]` | `_rndseq` (graine via `_srand`) | brassage aléatoire |
| `[order]` | `_ordseq` | remise en ordre canonique |
| `[rotate:N]` | `_rotate(N)` | rotation circulaire temporelle |

**Portée = suffixe canonique, sans alternative.** L'opérateur se colle à son opérande ;
sa portée est cet opérande. Le marqueur BP3 va **dans** l'accolade du groupe (comme
`{A B}[speed:2]` → `{2, A B}`), jamais après. Élargir la portée = encadrer plus large.
Le qualificateur de **fin de règle** (`S -> a b c d [shuffle]`) a pour portée toute la
règle → marqueur en tête de RHS (`_rndseq a b c d`). La forme instantanée `![X]` n'est
**pas** la voie pour exprimer la portée (`!` = évènement ponctuel / association de
conjoints, rôle distinct).

### Flags BP3 — sans espaces

`/K1-1/`, `/A>0/`, `/Reverse=0/`. Le moteur échoue silencieusement (0 token) sur
`/K1 - 1/`. Dans `encodeGuard()` et le bloc RHS flags : `/${flag}${op}${value}/`,
jamais d'espace.

### Rien en dur

Pas de liste hardcodée d'opérateurs, de contrôles, de terminaux. Tout vient des
`lib/*.json`. Si tu es tenté d'écrire un `if (name === '...')` pour une famille de
contrôles, c'est probablement une entrée JSON manquante.

### Pureté de la timeline

Rien de hors-temps dans le RHS. Les réglages vont dans `[]`, `()`, ou les directives
`@`. Exception : résolution pure en contrôles.

## Discipline de travail (anti-régression)

Tirée de sessions où le patching au cas par cas a fait passer le corpus de 24 OK à
20 OK :

1. **Plan avant code.** Comprends la spec (EBNF BPscript + grammaire BP3) entièrement.
2. **Vérifie l'AST/EBNF** d'abord, puis l'encodeur contre la spec BP3.
3. **TDD strict** : test → échec constaté → code minimal → test vert. Jamais
   « ça devrait marcher » sans sortie réelle.
4. **Teste TOUT le corpus avant ET après** chaque changement.
5. **Un changement qui casse une grammaire qui marchait = revert immédiat.**
6. **Investigue et clarifie avant de coder** — pas de tentative aveugle.

## Build & test

```bash
# Transpilation isolée (ESM) — vérifier une sortie BP3 sans le moteur
node --input-type=module -e 'import {compileBPS} from "./src/transpiler/index.js"; ...'

# Non-régression corpus (filtrer par grammars.json status=active, jamais itérer les dossiers)
node test/test_all.cjs --bin last
```

S4/S5 : toujours filtrer par `grammars.json` status=active. ⚠️ Le dispatcher a été
EXTRAIT vers Kanopi (commit 4fb6b46) : les s5 portent désormais des tokens BRUTS non
résolus (transposition1 : s5=81 bruts vs s0=75 résolus). Les comparaisons S4/S5 qui
supposaient la résolution runtime datent d'avant — ne « corrige » pas un écart de
résolution en patchant la scène : c'est l'état attendu du pipeline actuel.

## Suites de référence (toutes, avant ET après — zéro régression)

`test_v08_parser.js`, `test_tokenizer_hyphen.js`, `test_scan_mode.js`,
`test_taska_taskb.cjs`, `test_bolsize_alias.js`, `test_production_block.js` (bloc `[@…]`
+ dépréciation @-formes), `test_bp3_to_scene.cjs` (round-trip),
`src/transpiler/test.js` (smoke corpus). Les comptes attendus du moment sont dans la
fiche `hub/projets/agents/bpscript.md` — pas ici (ils évoluent). Suites lourdes (`test_all`,
`run_s5_all`) : `--bin last` obligatoire, et lis le piège snapshots ci-dessous AVANT.

## Pièges qui ont coûté cher (ne les re-paye pas)

- **Worktree = COMMITTE sur ta branche et rapporte son nom.** Un chantier a failli
  perdre tout son travail en laissant ses modifs non committées dans sa copie isolée.
- **Snapshots** : les suites batch réécrivent ~170 fichiers (champ date) et VIDENT les
  références des grammaires cassées moteur. Ne committe JAMAIS de snapshots sans triage
  (compte de tokens vs HEAD). Protection en place dans s5_bpscript.cjs (refus d'écraser
  une référence valide par un 0-token ; `--force-empty` pour volontaire). Grammaires à
  `_randomize` : sorties non-déterministes, jamais committées. Doctrine complète :
  `hub/methodes-tests-oracles.md`.
- **Comparateur du round-trip** : toute nouvelle normalisation (espaces, lignes de
  préambule, décimales…) = une équivalence BP3 à DÉMONTRER sur le moteur d'abord,
  jamais un ajustement pour faire passer.
- **Builds courants piégés** : v3.4.5 ne sait plus jouer 765432/look-and-say/watch
  (bugs #48/#49/#50/#52, `hub/constats/bugs-moteur-bp3.md`) — un 0 token n'est pas
  forcément ta régression ; vérifie le constat avant de débugger.
- **Tempo** : `![/N]`/`![*N]`/`![tempo:N]` = RELATIFS (`_tempo`) ; `A[/N]` = ABSOLU
  (`/N` nu, durée de référence du champ). Contrat utilisateur, ne pas dévier :
  `hub/decisions/2026-06-10-tempo-absolu-vs-relatif.md`.
- **Ancre de gabarit** : `$` nu (LHS/RHS) = nœud `TemplateAnchor` ↔ BP3 `(=` non
  fermé. `$X`/`${…}` restent fermés. `hub/decisions/2026-06-10-ancre-gabarit-dollar-nu.md`.

## Tour de contrôle

Coordination inter-projets : `/home/romi/dev/bp/hub` (lire TABLEAU + courrier en début
de session — cf. CLAUDE.md). Un finding transverse va dans `hub/constats/`, une remontée
moteur dans `hub/courrier/bernard.md`. Le scratchpad local reste pour le dialogue
intra-dépôt avec l'architecte/le reviewer.

## Changelogs

Modif dans `src/transpiler/` : pas de changelog moteur (ce sont les `csrc/` qui
exigent CHANGELOG_ENGINE.md / CHANGELOG_WASM.md). Documente tes décisions dans le
scratchpad et le commit.

## Recherche de contexte

`rtfm_search` AVANT Grep/Glob. `rtfm_expand` pour cibler une section. Ne lis pas un
fichier entier si RTFM peut cibler.

## Mémoire sceptique

La mémoire est un indice, pas un fait. Avant d'agir sur une convention mémorisée :
ouvre le fichier, vérifie l'état réel. Code > mémoire en cas de conflit.

## Interdictions

- Ne pas trancher une décision de design du langage (→ STOP-AND-REPORT à l'architecte).
- Ne pas hardcoder pour faire passer un test.
- Ne pas patcher au cas par cas sans plan.
- Ne pas faire de review (rôle du reviewer) ni de déploiement (rôle d'ops).
- Ne pas modifier `.claude/settings*`, `.mcp.json`, ni le moteur WASM sans demande.
