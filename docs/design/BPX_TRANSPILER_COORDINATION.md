# Coordination transpileur BPScript → BPx

> **Pour l'agent de dev BPScript.** Rédigé par l'agent BPx (2026-06-09) après la campagne de
> fidélité. ⚠️ Écrit mais NON committé par BPx (BPx ne commite jamais ce dépôt) — à relire/committer
> côté BPScript.
>
> **Principe.** BPx est le moteur (AST → arbre + tokens temporels), traduction fidèle bit-à-bit de BP3.
> Le transpileur BPScript est en amont (`.bps` → AST). Sur plusieurs points, **le transpileur jette ou
> déforme des données dont BPx a besoin** pour atteindre la parité avec BP3. **La mécanique BPx
> correspondante est déjà en place et prouvée** (avec données injectées à la main dans les tests) ;
> le seul blocage est l'alimentation côté transpileur. Chaque item ci-dessous = « arrête de jeter,
> passe la donnée fidèlement », PAS un changement d'algorithme.
>
> **Vérité de référence** : le binaire BP3 (`bp3-engine`, wasm `v3.4.5-wasm.1` + natif). Pour chaque
> item, l'oracle est la sortie BP3 ; BPx doit la reproduire une fois la donnée transmise.

---

## Item 1 — Table d'homomorphisme (`-ho`) — PRIORITÉ HAUTE

**Débloque** : dhati (oracle 37 tokens), dhin (oracle 30). Aujourd'hui leurs esclaves rejouent le
maître **non traduit** ; BP3 substitue les frappes (dha→ta, ge→ke, dhin→tin, dhee→tee).

**Détail complet** : voir `HOMOMORPHISMS.md` (tâches 1-5) dans ce même dossier. Résumé actionnable :

> **Précisions de Bernard Bel (source faisant autorité, 2026-06-09)** — corrigent ce qui avait été
> reconstruit :
> - Les homomorphismes sont **NOMMÉS** ; `*` n'était qu'un exemple d'étiquette. Dans `-gr.Ruwet` il y
>   en a **trois** : `m1` (la4→sib4), `m2` (la4→sol4), `mineur` (fa4→re4, la4→fa4). L'invocation se fait
>   **par le NOM**, pas par `*`.
> - Ils sont une **classe de token à part entière, T5** (`T5 x`, `x < Jhomo`) — à côté des terminaux
>   (`T3 x`) et des variables (`T4 x`).
> - Les paires peuvent impliquer des **VARIABLES**, pas seulement des terminaux :
>   `gram#4[42] |miny| --> mineur (= |y|)` (l'homo `mineur` transforme la variable `|y|`).
> - **Phase** : l'homomorphisme s'applique **après l'expansion polymétrique, AVANT le time-setting**
>   (les propriétés du bol substitué — ex. `ta` au lieu de `dha` — résolvent les contraintes
>   temporelles). C'est **structurel**, pas un relabel cosmétique. (Concerne surtout BPx, mais
>   confirme que la donnée doit arriver assez tôt.)

- **Cible (le contrat que BPx lit DÉJÀ)** : peupler `ast.homomorphisms: { name, pairs: [src, dst][],
  line }[]` — où `name` ∈ {`m1`, `m2`, `mineur`, …} et `src`/`dst` sont des terminaux **OU des
  variables**. C'est ce que `buildHomomorphisms` consomme côté BPx (`loadGrammar.ts:5553`) et ce que
  `homomorphism.test.ts` injecte à la main. **NE PAS** réinventer le format BP3 `0.1%terminal`.
- **(a) Parser** (`src/transpiler/parser.js:2238-2276`) :
  - Parser la section de transcription `-ho.<nom>` → les paires source→destination (chaque section =
    un homo nommé).
  - Reconnaître l'invocation **par NOM** sur l'esclave (le nom de l'homo, ex. `mineur`, devient un
    token T5) + le **compte de répétition** (stacking, ex. `**` = appliquer deux fois → ordinal).
    Aujourd'hui seul `&X` nu est parsé, le marqueur d'homo (T5) est perdu.
- **(b) Encoder** (`src/transpiler/encoder.js`) :
  - Sérialiser la/les section(s) en `ast.homomorphisms` (`{name, pairs, line}`).
  - Sur le marqueur esclave (`encoder.js:1233-1236`, qui émet `(:X)` nu), reporter le **nom** +
    l'**ordinal de stacking** (BPx lit `ordinal` sur le payload, `expand.ts:328`).
  - Ajouter `homomorphisms` à la sortie de `encode()` (`encoder.js:532`).
- **(c) Tuyau** : l'AST qui arrive à `loadGrammar` (côté BPx) doit porter `ast.homomorphisms`.
  Vérifier que l'orchestrateur ne l'ampute pas en chemin (`astToSceneSpec.ts:68-81` n'a aujourd'hui
  ni `alphabetFile` ni `transcriptionTable`).
- **Vérification** : dhati/dhin via leur `scene.bps`, comparés aux oracles
  `BPx/test/scenes/bernard/{dhati,dhin}/oracle.expected.json`. Les frappes substituées
  (`ta`/`tin`/`tee`/`ke`) doivent apparaître dans les esclaves.
- ⚠️ **Résidu indépendant** : l'écart de COMPTE (dhin 94 vs 104, dhati 40 vs 37) vient AUSSI d'ailleurs
  (réplication d'esclave / ordre LCG aval), PAS de la substitution. La table corrige le **contraste de
  frappes** ; le compte sera à re-diagnostiquer ensuite (côté BPx, séparément).

---

## Item 2 — Découpage `do4-` (note collée au silence) — PRIORITÉ MOYENNE

**Débloque** : 765432 (oracle 1497 tokens, BPx 824). **Les histogrammes de notes sont DÉJÀ
identiques** (538 do7, 90 do4, …) ; seuls manquent les **659 silences de prolongation `-`**.

- **Problème** (`src/transpiler/tokenizer.js:255-288`) : le tokenizer **colle le `-` final au nom de
  la note** (`do4-` → un seul Symbol). C'est une lecture erronée de la « convention BP3 ».
- **BP3 fait l'inverse** : le matcher glouton de frappes (`SEARCHTERMINAL2`, `Encode.c:888-915`)
  **pèle** le `-` final → deux tokens : la note `do4` (T3) + le silence `-` (T3).
- **Fix** : le tokenizer doit produire **deux tokens** pour `do4-` (note `do4` + silence `-`), pas un
  Symbol `do4-`.
- **Vérification** : 765432 émet les 659 `-` manquants → compte aligné avec l'oracle.

---

## Item 3 — ~56 grammaires non transpilées — PRIORITÉ MOYENNE (volume)

**Débloque** : la **couverture-native** (le garde-fou `BPx/test/parity/native_coverage.test.ts`).
Ces grammaires de `BPscript/test/grammars/<nom>/` **n'ont pas de `scene.bps`** → pas de sortie
transpileur → BPx ne peut même pas les charger/tester. Elles sont comptées comme « angle mort »
(NO_ORACLE) dans le scoreboard.

- **Liste** (≈56, à confirmer côté BPScript) : Alarm, NotReich, PP, asymmetric1, blurb, check&,
  checkBT, checkHomo, checkSUB, checkVolChan, checkcontext, checkhomo2, checkrests, cloches1, csound,
  dhadhatite, dhati2, dhati3, dhin--, gramgene1, gramgene2, koto1, koto2, major-minor, polyphony1,
  scales, shapes-rhythm, transposition, transposition1, trial.mohanam, tryConsoleMaxTime,
  tryCsoundObjects, tryFlags, tryGOTO, tryKeyMap, tryKeyXpand, tryLIN, tryObjects, trySerial,
  tryShruti, trySrand, tryTimePatterns, tryTranspose, tryflags2, tryflags3, tryhomomorphism, tryrepeat,
  trytemplates, trytemplates2, tunings, vina3, visser3, visser5, watch.
- **Action** : transpiler chacune (générer son `scene.bps` + snapshot) — OU l'exclure explicitement
  avec une raison datée (si elle dépend d'une feature hors-scope MIDI/contenu). **Pas de drop
  silencieux** : chaque grammaire doit être soit testable, soit explicitement hors-jeu.
- **Vérification** : le garde-fou native_coverage voit `NO_ORACLE` décroître (chaque grammaire
  devient couverte ou KNOWN_GAP honnête).

---

## Item 4 — Préfixe de placement de règle `[scan:left|right|rnd]` — PRIORITÉ BASSE

**Débloque** : le placement explicite niveau-règle (gauche/droite/aléa), aujourd'hui testé côté BPx
uniquement via des `.gr` manuscrits (`BPx/test/scenes/imode-placement/`).

- **Problème** : le préfixe `[scan:left|right|rnd]` atterrit dans `qualifiers` et n'est **jamais mappé
  vers `RuleAST.mode`** → BPx reçoit toujours le mode par défaut.
- **BPx a déjà la mécanique** : la dispatch d'insertion (correctif A3) traite `RuleAST.mode`
  (LEFT→leftmost-sans-tirage, RIGHT→rightmost, RND→tire) fidèlement à `Compute.c:1828-1948`.
- **Fix** : mapper `[scan:left]`→mode LEFT, `[scan:right]`→RIGHT, `[scan:rnd]`→RND sur `RuleAST.mode`.
- **Vérification** : une grammaire avec une règle `[scan:left]` multi-occurrences place au leftmost
  sans décaler la suite aléatoire (parité LCG).

---

## Item 5 — Surface diverse droppée — PRIORITÉ BASSE (à confirmer)

- **`[rndtime:N]`** : vérifier que la gigue temporelle de surface est bien transmise (BPx a le handler
  T41 / `randomTime`).
- **`@timepatterns`** : une anomalie d'alphabet a été signalée sur l'oracle des motifs temporels — à
  vérifier côté transpileur (l'oracle anomal `tryAllItems1` avait des têtes de règle X/Y/T déclarées
  comme terminaux — déjà corrigé côté BPScript en juin, à confirmer committé).

---

## Récapitulatif (pour priorisation)

| Item | Débloque | Effort BPScript | BPx prêt ? |
|---|---|---|---|
| 1. Homomorphisme `-ho` | dhati, dhin (contraste de frappes) | moyen (parser+encoder+tuyau) | ✅ mécanique portée+prouvée |
| 2. Découpage `do4-` | 765432 (659 silences) | faible (tokenizer) | ✅ (BPx attend 2 tokens) |
| 3. ~56 grammaires non transpilées | couverture-native (angle mort) | moyen (volume) | ✅ (BPx les chargera) |
| 4. `[scan:...]` placement | placement explicite de règle | faible (mapping mode) | ✅ (dispatch A3 portée) |
| 5. `[rndtime:N]` / `@timepatterns` | surface, à confirmer | faible | ✅ |

**Note de fidélité** : aucun de ces items n'est un port d'algorithme BP3 (donc hors de la discipline
« lire le C, traduire le C » de BPx) — c'est de la **coordination de pipeline** : faire que l'AST
livré à BPx reflète fidèlement ce que l'utilisateur a écrit, tel que BP3 l'aurait compilé. Une fois
la donnée transmise, BPx produit la sortie attendue sans changement moteur (mécaniques déjà en place).
