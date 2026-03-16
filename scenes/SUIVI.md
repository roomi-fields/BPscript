# Suivi des traductions BP3 → BPS

## Leçons des traductions

### Validé par les scènes

- **Period notation `.`** : `A -> E2 .` fonctionne tel quel (acceleration)
- **Polymétrie `{,}`** : 3 voix de durées différentes (drum)
- **Contrôles `@+`** : vel(), staccato(), transpose(), ins() inline et global (drum, acceleration)
- **Captures `?`** : `R1 ?1 ?2 R2 -> ?1 ?2 ?1 ?2` (mohanam)
- **Poids décroissants** : `[weight:50-12]` (mohanam)
- **Sous-grammaires** : séparateur `-----` avec modes différents (mohanam : RND + SUB1)
- **`lambda`** dans `@core` pour effacer un non-terminal (flags, mohanam)

### Affiné par les scènes

- **`when` supporte test+mutation** : `when Ideas-1` = décrémente ET teste > 0,
  sémantique BP3 préservée (mohanam). Deux formes : test pur (`when X>N`)
  et test+mutation (`when X-N`).
- **Non-terminaux implicites** : pas de déclaration, détectés par le compilateur.
  Seuls les terminaux (sortie) nécessitent le double contrat type+runtime.
- **`goto()` gardé comme contrôle `@+`** : nécessaire pour les boucles de récursion
  explicites (mohanam gram#3[3]). Bas niveau mais indispensable.

### Blocage : dhin (tabla) — questions de design ouvertes

La scène `dhin` révèle des features BP3 non couvertes par BPscript :

1. **`*(: X)`** — homomorphisme `*` devant un template slave. Le `*` transforme le contenu du slave via une table de substitution définie dans l'alphabet (`-ho.`). Pas d'équivalent en BPscript. Faut-il un symbole ?
2. **`F'24`** — identifiant avec apostrophe. Le tokenizer BPS ne le gère pas. Faut-il l'ajouter aux caractères autorisés dans IDENT ?
3. **`4+4/6`** — time signature inline (dans le flux, pas en directive). Notre `@meter` est global. Faut-il un mécanisme inline ?
4. **`dhin--`** — RÉSOLU : `-` ne peut PAS faire partie d'un nom de terminal en BP3 (`GetBol()` le rejette, `CompileGrammar.c:1200-1203`). `dhin--` = `dhin` + silence + silence. Pas de problème pour BPscript.
5. **`)` comme symbole** — ligne 60 : `) B12 <-> ) A4 B8`. La parenthèse fermante est utilisée comme contexte. Très spécifique à BP3.
6. **Section TEMPLATES:** — ignorée par le compilateur BP3. BPscript n'a pas besoin de la générer mais doit savoir que les templates `$`/`&` dans les règles suffisent.

**Décision** : reporter dhin jusqu'à ce que ces questions soient tranchées. Passer aux scènes plus accessibles.

### Corrections pour B10 (EBNF de BP3)

Erreurs identifiées dans B10 par confrontation avec le code source :

1. **`_` n'est PAS `undetermined_rest`** — c'est une prolongation (T3/0, kobj=0). `...` est le seul repos indéterminé. Source : `FillPhaseDiagram.c`, `BP2-info.txt` ligne 50.

2. **`+` n'est PAS un opérateur de concaténation** dans le RHS. Il n'existe QUE dans le contexte des flags (`/flag+1/`). Le lister comme `rhs_element` type `concatenation` est faux. Source : `Encode.c:440-513`, uniquement dans le parsing des flags.

3. **`context_marker` étendu n'existe pas** — `(|x|)`, `#({)`, `#(})` ne sont pas dans le code source. Aucune occurrence. À retirer de la production `context_marker`.

4. **`_` dans les TEMPLATES** — même sémantique que partout (prolongation T3/0). La section TEMPLATES est ignorée par le compilateur (`CompileGrammar.c:437-443`), c'est de la documentation. Pas de double sémantique.

### Mises à jour EBNF/AST suite aux 12 scènes

- **EBNF** : contraintes lexicales ajoutées (`-` jamais dans IDENT, `#` autorisé, `_` → espace dans scale args). Table de traduction enrichie (6 nouvelles entrées).
- **AST** : `BPSCRIPT_AST.md` corrompu pendant un patch — à regénérer. Changements prévus : Polymetric qualifiers limités à speed/scale, contrainte de priorité Control vs SymbolCall, NilString dans SimultaneousGroup, `@+` comme nom de directive.

5. **`-` dans les noms de terminaux** — `OkBolChar2` (ligne 1316) liste `-` comme caractère accepté dans les noms, mais `GetBol` (lignes 1200-1203) le rejette explicitement avec `goto ERR`. Le commentaire `/* Discarded in GetBol() */` confirme. Conséquence : `-` ne fait JAMAIS partie d'un nom. `dhin--` = `dhin` + silence + silence. `--` = toujours deux silences.

5. **`quoted_symbol` (`'text'`)** — confirmé dans le code (`Encode.c:940-974`). Permet des terminaux avec caractères spéciaux. Actif et utilisé.

### Validation MIDI via moteur BP3 (bp.exe --seed 42)

| Scène | Statut | Détail |
|-------|--------|--------|
| drum | ✅ IDENTICAL | 12 objets |
| acceleration | ✅ IDENTICAL | 78 objets (corrigé: B2≠Bb2, A#2≠Bb2, D#2≠Eb2) |
| templates | ✅ IDENTICAL | 3 objets (corrigé: [/2] et [*1/2] au lieu de {A}[speed:2]) |
| negative-context | ✅ IDENTICAL | 3 objets |
| livecode1 | ✅ IDENTICAL | 28 objets |
| not-reich | ✅ IDENTICAL | 871 objets (corrigé: ajout volumecont) |
| flags | SKIP | terminaux `a`,`b` non reconnus sans `-al` (alphabet custom) |
| harmony | SKIP | besoin `-cs` (définitions de gammes microtonales) |
| mohanam | SKIP | besoin `-ho` + `-cs` (homomorphismes + gammes) |
| repeat | SKIP | terminaux non reconnus sans `-al` |
| transposition | SKIP | pas de MIDI produit (à investiguer) |
| scales | SKIP | besoin `-cs` (gammes) |
| mozart-dice | SKIP | besoin `-cs` + `-to` (gammes + time objects, solfège FR) |
| all-items | SKIP | terminaux `a`,`b` non reconnus sans `-al` |
| one-scale | SKIP | besoin `-cs` (gammes just intonation) |
| visser-shapes | SKIP | besoin `-md` (config MIDI device) |
| time-patterns | FAIL | time patterns (`-tb`) non supportés |

**bp.exe : 6/17 IDENTICAL, 0 DIFFERENT, 10 SKIP, 1 FAIL**

Les SKIP bp.exe sont des limitations de l'infra de test (fichiers auxiliaires BP3 sur disque).

**WASM** : pipeline BPS → compile → WASM → MIDI prouvé fonctionnel (drum: 24 events, mohanam: 82 events).
Problème en cours : le WASM est stateful — les init() successifs dans le validate ne réinitialisent
pas complètement l'état, causant des faux 0-MIDI. À résoudre (réinstancier le module par test).
Aussi : `bp3_load_settings()` casse le MIDI (bug WASM, settings JSON pas correctement parsés).

### Corrections trouvées par la validation MIDI

1. **Preamble invalide** : `_vel()`, `_chan()`, `_transpose()`, `_ins()` ne sont PAS des preamble BP3 valides. Déplacés en inline RHS (début de première règle).
2. **Opérateurs temporels** : `{A}[speed:2]` → `{2, A}` (polymetric ratio) ≠ `/2 A` (speed operator). Nouvelle syntaxe `[/2]`, `[\2]`, `[*3]`, `[**3]` ajoutée.
3. **Enharmoniques** : B2≠Bb2 dans acceleration — les noms exacts comptent pour BP3.
4. **`_volumecont` manquant** dans not-reich — ajouté à controls.json.
5. **`--` = `- -`** et **`C4_` = `C4 _`** : confirmé identiques dans BP3.
6. **`(=A)(:A)` = `(=A) (:A)`** : espacement cosmétique, identique dans BP3.

### Analyse des blocages de validation

Les 10 SKIP se répartissent en 4 catégories :

**1. Alphabets custom** (flags, repeat, all-items) — terminaux `a`,`b` non reconnus.
BP3 a besoin d'un fichier `-al` ou `-ho` déclarant les terminaux.
Nos librairies `@western`/`@raga` ne couvrent que les notes musicales, pas les alphabets arbitraires.

**2. Gammes microtonales** (harmony, scales, one-scale, mozart-dice) — `_scale(just intonation,...)`, `_scale(Cmaj,0)`.
BP3 stocke les tables de tuning dans les fichiers `-cs` (Csound objects). Format binaire complexe.
Dans notre archi, le tuning est un concern du runtime layer.

**3. Fichiers spécialisés** (visser-shapes: `-md`, mozart-dice: `-to`, time-patterns: `-tb`).
Config MIDI device, time objects, time base — tous des concerns runtime/engine.

**4. Homomorphismes** (mohanam) — tables de substitution pour templates.
Pas encore d'équivalent BPscript. Question de design ouverte.

### Pistes pour améliorer la couverture de test

1. **Tests unitaires BP3** : créer des mini-grammaires qui testent chaque feature avec des notes western (C4, D4...) — pas besoin de `-al`/-cs`. Permet de tester flags, templates, captures, etc. sans dépendances.
2. **WASM engine** : compiler bp3-engine en WASM et l'appeler depuis Node.js — bypasse les limitations de bp.exe (fichiers locaux).
3. **Génération `-al` minimal** : l'encoder pourrait générer un fichier alphabet minimal depuis les déclarations `gate`/`trigger`/`cv` du .bps.

### Questions à poser à Bernard

- **`-` vs `1`** : quelle est la différence entre `-` (silence) et `1` (nombre nu) dans une séquence BP3 ? `A - B` et `A 1 B` produisent-ils le même résultat temporel ? Si oui, `1` et `3/2` sont des silences avec durée fractionnaire. Si non, c'est un mécanisme distinct (gap vs objet silence). Découvert dans la scène `templates` (règle 4 : `S <-> A A 1 3/2 A`).

### negative-context ✅
- **Source** : `bp3-engine/library/examples/negative-context/grammar.gr`
- **Features testées** : contextes négatifs `#X` (sans parenthèses, un seul symbole), contextes négatifs multiples (`#A1 #A2 #A3`), direction `<-` (LEFT), `[weight:0]`, contextes préservés dans le RHS
- **Difficulté** : intermédiaire
- **Commentaire** : a révélé que `#` fonctionne sur un seul symbole sans parenthèses (`#X` en plus de `#(X Y)`). A aussi montré que les contextes négatifs peuvent apparaître dans le RHS et sont préservés pour guider les futures applications de règles. Notre doc ne couvrait que `#(group)` — il faut ajouter `#symbol`.
- **Lacunes identifiées** :
  - `#X` (sans parenthèses) non documenté dans BPSCRIPT_VISION.md — seulement `#(group)`.
  - **LEFT ≠ `<-`** : LEFT est le mode de dérivation par règle (scan), `<-` est la direction de la flèche. Deux concepts distincts. A mené à la création de `[scan:left/right/rnd]` comme nouvelle clé réservée de `[]`.

### harmony ✅
- **Source** : `bp3-engine/library/examples/harmony/grammar.gr`
- **Features testées** : `_scale()` (gammes nommées), accords en polymétrie `{durée, note1, note2, note3}`, prolongation `_`, `--` (deux silences)
- **Difficulté** : intermédiaire
- **Commentaire** : a révélé que `_scale()` manquait dans controls.json — ajouté. Les accords sont exprimés comme polymétrie où le premier élément est la durée et les suivants sont des notes simultanées. C'est le mécanisme d'accord de BP3 : pas un type spécial, juste de la polymétrie dégénérée. Le `--` est bien deux silences collés (tokenizer les sépare).
- **Lacunes identifiées** :
  - `{2, C3, E3, G3, C4}` — le `2` est un **ratio de tempo** (pas une durée ni un silence). Cf. B10 EBNF : `polymetric = "{" , [ ratio , "," ] , voice , { "," , voice } , "}"`. Le ratio optionnel précède les voix. `{2, C3, E3, G3, C4}` = 4 voix simultanées avec ratio tempo 2. Corrigé.

### Positionnement par rapport aux retours de Bernard (14 mars 2026)

- **Notes liées `~`** : on adopte sa syntaxe (`C4~`, `~C4~`, `~C4`). C'est de la réécriture pour nous, la complexité (matching à travers la polymétrie) reste dans le moteur BP3.
- **Sound objects / time-setting** : l'algorithme reste dans le moteur BP3. BPscript ne gère pas les pivots, dilatations, contraintes topologiques. Les runtimes reçoivent des dates et durées **déjà calculées** par BP3. On ne délègue pas le time-setting aux runtimes.
- **Origine de BP3** : corrigé — "d'abord utilisé pour la rythmique des percussions du nord de l'Inde, formalisme général". Pas de référence aux ragas dans BP3.

### mozart-dice ✅
- **Source** : `bp3-engine/library/western/mozart-dice/grammar.gr`
- **Features testées** : K-params (`[weight:K1=1]`, `[weight:K1]`), mode LIN, solfège français (do/re/mi/fa/sol/la/si), identifiants avec apostrophe (`A'8`, `T'5`), polymétrie imbriquée 3 niveaux, accords multi-voix, ratios de tempo (`[speed:1/2/3]`), `_scale()` contextuelle
- **Difficulté** : complexe (334 règles, 18 sous-grammaires, 158 terminaux)
- **Commentaire** : Jeu de dés musical de Mozart — K1-K11 simulent 2 dés avec distribution en cloche (1,2,3,4,5,6,5,4,3,2,1). Grammaire la plus volumineuse traduite. A nécessité l'ajout du support K-params dans le parser (qualifier `IDENT=INT`). Les T-rules contiennent des polymétriques profondément imbriquées ({3 niveaux}) avec ratios de tempo.
- **Lacunes identifiées** :
  - Pas de librairie `lib/solfege.json` pour les notes françaises — les terminaux ne sont pas déclarés.
  - Les annotations BP3 (`[Just intonation]`, `[Select rules...]`) n'ont pas d'équivalent BPscript — converties en commentaires.

### all-items ✅
- **Source** : `bp3-engine/library/examples/all-items/grammar.gr`
- **Features testées** : templates `$X`/`&X` (master/slave), `_destru` (directive de réécriture destructive)
- **Difficulté** : triviale (4 règles, 2 sous-grammaires)
- **Commentaire** : l'exemple "produce all items" de BP3. Teste la combinaison templates + réécriture.
- **Lacunes identifiées** :
  - **Preamble par sous-grammaire** : `_destru` est dans le preamble de sub 2 en BP3, mais notre encoder ne supporte que les preambles globaux (sub 1). `@destru` se retrouve en sub 1 au lieu de sub 2.

### one-scale ✅
- **Source** : `bp3-engine/library/examples/one-scale/grammar.gr`
- **Features testées** : `_scale(just intonation,X)` avec underscore→espace, `_scale(0,0)` (reset), `<0>` (poids nul), notation just-intonation (`Cj4`, `Aj4`, `Gj4`)
- **Difficulté** : triviale (5 règles, 1 sous-grammaire)
- **Commentaire** : teste les différents modes de gammes (just intonation, equal temperament). Les poids `<0>` rendent toutes les règles sauf la dernière non-sélectionnables aléatoirement.
- **Lacunes identifiées** : aucune

### visser-shapes ✅
- **Source** : `bp3-engine/library/experimental/visser-shapes/grammar.gr`
- **Features testées** : `rotate()`, `keyxpand()`, `velcont` (sans args), `tempo(0.7)` (float), `tempo(2/3)` (ratio), contrôles sans parenthèses (`velcont`), polymétrie dense avec contrôles inline
- **Difficulté** : intermédiaire-complexe (21 règles, 3 sous-grammaires, trilles de 40 notes)
- **Commentaire** : pièce pour piano de Harm Visser (1998). Rotations de pitch, expansions de clavier, contours de vélocité. A nécessité l'ajout de `rotate`, `keyxpand`, `velcont`, `retro` au parser et à l'encoder. A aussi nécessité `isNoArgControl()` pour les contrôles sans parenthèses.

### visser-waves ⚠️ bloqué
- **Source** : `bp3-engine/library/experimental/visser-waves/grammar.gr`
- **Blocage** : polymétriques non-balancées. `M1 --> {5, C3 F#3` ouvre un `{` sans le fermer ; `M4 --> F2 B3}` ferme. Les accolades se balancent après dérivation, pas dans chaque règle. Notre parser exige des `{}` équilibrées par règle. Feature BP3 fondamentale (embedding par dérivation) sans équivalent BPscript actuel.

### Questions ouvertes identifiées

- **Explicitation des non-terminaux** : dans les grammaires complexes (mohanam a ~30
  non-terminaux), leur rôle n'est pas évident. Faut-il une convention de nommage,
  une section dédiée, ou un outil de documentation automatique ?
- **`[weight:0]` et `goto()`** : les règles de poids 0 ne sont jamais sélectionnées
  aléatoirement — elles n'existent que pour `goto()`. C'est un pattern récurrent
  en BP3 qu'il faudrait peut-être abstraire.

## Scènes traduites

### drum ✅
- **Source** : `bp3-engine/library/examples/drum/grammar.gr`
- **Features testées** : polymétrie `{,}`, contrôles `@+` (vel, staccato, chan), silences `-`
- **Difficulté** : triviale (1 règle)
- **Commentaire** : a permis de clarifier que vel et chan sont globaux via `@`. Premier test de la structure lib/ + scenes/.

### flags ✅
- **Source** : `bp3-engine/library/examples/flags/grammar.gr`
- **Features testées** : flags (assignation, décrément, comparaison), sous-grammaires `-----`, `lambda`
- **Difficulté** : intermédiaire
- **Commentaire** : a permis de valider `when flag-N` (test+mutation atomique, sémantique BP3). Distinction terminaux (a, b déclarés gate:midi) vs non-terminaux (S, X implicites).

### acceleration ✅
- **Source** : `bp3-engine/library/experimental/acceleration/grammar.gr`
- **Features testées** : period notation `.`, dérivation récursive, `[mode:ord]`, contrôles `@+` inline (vel croissant), `@transpose`, `@meter`
- **Difficulté** : intermédiaire
- **Commentaire** : exemple de Bernard Bel sur la period notation. Accelerando structurel via récursion — chaque règle ajoute une note, le `.` maintient les proportions. A confirmé que western.json supporte les notes avec dièses/bémols.

### templates ✅
- **Source** : `bp3-engine/library/examples/templates/grammar.gr`
- **Features testées** : templates `$`/`&`, `<>` bidirectionnel, `@mm`, `@striated`, period notation dans templates, `[scale:]`, `[speed:]`, `tempo()` inline
- **Difficulté** : intermédiaire
- **Commentaire** : 6 règles bidirectionnelles testant les templates avec différents opérateurs temporels. A validé la syntaxe `$A`/`&A` et `<>`. Règle 4 (`1 3/2` en BP3) difficile à traduire — ratio comme silence + scale, à valider avec Bernard. A nécessité l'ajout de `@mm` et `@striated` dans les contrôles globaux.
- **Lacunes identifiées** :
  - `@mm` et `@striated` comme directives globales — à vérifier que le compilateur les traduit en `_mm(60)` `_striated` en tête de grammaire.
  - **Nombres nus dans le flux** : en BP3, `1` ou `3/2` dans le flux = silence de durée rationnelle. Contredit notre doc qui dit "les nombres sont opaques". Les nombres dans les **paramètres** (`vel:120`) sont opaques, mais dans le **flux** ils sont des silences. À clarifier dans BPSCRIPT_VISION.md.

### mohanam ✅
- **Source** : `bp3-engine/library/tabla/mohanam/grammar.gr`
- **Features testées** : flags avancés (test+mutation, compteurs multiples), captures `?1..?5`, poids décroissants `[weight:50-12]`, `[weight:0]`, `goto()`, `lambda`, sous-grammaires (9 avec RND + SUB1), non-terminaux complexes (~30)
- **Difficulté** : complexe (boss final)
- **Commentaire** : composition réelle de Kumar S. Subramanian (1995). A forcé la clarification de `when` (deux formes), la distinction terminaux/non-terminaux, et le maintien de `goto()` dans `@+`. Raga pentatonique mohanam (sa re ga pa dha). A nécessité la création de `lib/raga.json`.

## Scènes à faire

### Priorité haute (testent des features non encore couvertes)

| Source | Features à tester | Statut |
|--------|------------------|--------|
| `examples/templates/grammar.gr` | Templates `$`/`&`, `<>` bidirectionnel, `_mm()`, `_striated` | ✅ fait |
| `examples/negative-context/grammar.gr` | Contextes négatifs `#`, direction LEFT, `<0>` poids | ✅ fait |
| `tabla/dhin/grammar.gr` | Templates complexes avec `(=X)`/`(:X)`, poids, mode LIN | ⚠️ bloqué — voir notes |
| `examples/harmony/grammar.gr` | Harmonie/accords, gammes _scale(), polymétrie-accords | ✅ fait |

### Priorité moyenne (variantes de features déjà couvertes)

| Source | Features | Statut |
|--------|----------|--------|
| `examples/repeat/grammar.gr` | Répétitions _repeat, K-params, RHS vide | ✅ fait |
| `examples/scales/grammar.gr` | Scales, accords, _legato, prolongations, transpose négatif | ✅ fait (bug mineur: weight pas toujours propagé quand [] mixés avec polymétrie) |
| `examples/time-patterns/grammar.gr` | Time patterns (smooth time), ratio polymétrie | ✅ fait (TIMEPATTERNS: section pas encore générée) |
| `examples/transposition/grammar.gr` | Transposition, polymétrie imbriquée, repeat | ✅ fait |
| `western/mozart-dice/grammar.gr` | Jeu de dés musical, K-params, LIN, solfège français, 158 terminaux | ✅ fait |
| `experimental/livecode1/grammar.gr` | Live coding dense, polymétrie 4 niveaux, ratios 1/2 | ✅ fait |

### Priorité basse (exemples spécialisés)

| Source | Features | Statut |
|--------|----------|--------|
| `examples/all-items/grammar.gr` | Templates `$X`/`&X`, `_destru` | ✅ fait |
| `examples/one-scale/grammar.gr` | `_scale()`, just intonation, `<0>` weight | ✅ fait |
| `experimental/not-reich/grammar.gr` | Phasing (Steve Reich) | à faire |
| `experimental/visser-shapes/grammar.gr` | Rotations, keyxpand, velcont, trilles | ✅ fait |
| `experimental/visser-waves/grammar.gr` | Polymétriques non-balancées (embedding) | ⚠️ bloqué |
| `tabla/vina*/grammar.gr` | Compositions pour vina | à faire |

## Librairies créées

| Fichier | Contenu | Utilisée par |
|---------|---------|-------------|
| `lib/core.json` | lambda, on_fail | flags, mohanam |
| `lib/controls.json` | vel, tempo, transpose, goto, etc. (14 contrôles) | drum, acceleration, mohanam |
| `lib/western.json` | C0-B9 chromatique + generator | drum, acceleration |
| `lib/raga.json` | sa-ni + octaves + generator | mohanam |

## Librairies à créer

| Nom | Contenu | Nécessaire pour |
|-----|---------|----------------|
| `lib/hooks.json` | wait(), wait_all(), speed_ctrl()... | scènes avec interaction |
| `lib/patterns.json` | fast(), slow(), rev(), euclid()... | scènes avec transformations |
