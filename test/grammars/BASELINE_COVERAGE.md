# Couverture baseline — grammaires BP3

> Mis à jour le 2026-06-10 (solde de la campagne homomorphismes/tokenizer/bp3ToScene).
> Comptes recalculés depuis le disque (`grammars.json` + présence réelle de `scene.bps` et des
> snapshots `s0_php.json`/`s1_native.json` non vides). 111 entrées dans `grammars.json`
> (110 grammaires + 1 placeholder `_comment`).

## Critère

Une grammaire est **baseline-able** si :
1. **Le moteur natif (bp.exe S0, ou bp3 Linux S1) en produit une sortie** — l'oracle natif existe.
2. Elle est **exprimable en BPScript** (un `scene.bps` alimente BPx).

`scene.bps` présent → testable par BPx **maintenant**. Absent → baseline acquise, `scene.bps`
à générer (transpileur inverse `src/transpiler/bp3ToScene.js` ou à la main).

## Comptes (vérifiés disque, 2026-06-10)

| Catégorie | Compte |
|---|---|
| Niveau 1 — active + oracle natif + `scene.bps` | **38** |
| Active + oracle, `scene.bps` hors dossier (watch) | 1 |
| Niveau 1bis — to_be_tested + oracle natif + `scene.bps` | **14** |
| Niveau 2 — oracle natif acquis, `scene.bps` absent | **7** |
| Scènes sans oracle natif (S5-only, BPx direct) | 7 (+7 annexes) |
| OUT — ni oracle ni scène | 34 |
| skip (bells) / partial (dhadhatite_v2) | 2 |

---

## IN — oracle natif acquis

### Niveau 1 — actives + `scene.bps` → testables par BPx maintenant (38)

765432, acceleration, acceleration_v2, alan-dice, all-items, all-items1, ames, asymmetric,
beatrix-dice, destru, drum, ek-do-tin, flags, graphics, harmony, koto3, kss2, livecode1,
look-and-say, mozart-dice, negative-context, not-reich, one-scale, repeat, ruwet, templates,
time-patterns, **transposition3** (récupérée 2026-06-10), tryAllItems0, tryAllItems1,
**tryCsoundObjects** (scene.bps bp3ToScene FIDÈLE 2026-06-10), **tryShruti** (idem, trou-langage
`_tempo` soldé), vina, vina2, visser-shapes, visser-waves, visser3, visser5

> `watch` est active avec oracle (s0 = 2105 notes) mais sa scène vit dans `scenes/watch.bps`
> (fallback S5). Ralentissement moteur sévère en cours (FEEDBACK_BERNARD #50) → timeout dans
> les suites, contenu byte-identique quand le run va au bout. Total actives = 39.

### Niveau 1bis — to_be_tested + oracle natif + `scene.bps` (14)

MyMelody, checkBT, checkSUB1, dhin1, doeslittle, koto1, koto2, simpletemplates, transposition1,
tryMIDIfile, tryPatternGrammar, **tryRagas** (scene.bps bp3ToScene FIDÈLE 2026-06-10), tryRotate,
tryhomomorphism

> `dhin1` : scène présente mais S5 WASM crashe (terminaux 51-106 caractères > BOLSIZE 30 du
> moteur) — troncature/aliasing à faire côté transpileur.

### Niveau 2 — oracle natif acquis, `scene.bps` encore absent (7)

| Grammaire | Oracle | Blocage scene.bps |
|---|---|---|
| blurb | s1 = 20 tokens | à générer (récupérée au re-tri 2026-04) |
| check& | s0 = 4 notes | `_&` (prolongation liée) NON GÉRÉ — `~` exige un symbole porteur |
| checkVolChan | s1 = 292 tokens | à générer (récupérée au re-tri 2026-04) |
| dhadhatite1 | s1 = 6 tokens | à générer (récupérée au re-tri 2026-04) |
| dhati2 | s0 = 80 notes | templates BP2 nus en LHS (trou-langage, ajourné 2026-06-10) |
| dhati3 | s0 = 80 notes | idem dhati2 |
| trySrand | s0 = 500 notes | opérateurs tempo `/N` en RHS (E5, ajourné 2026-06-10) |

---

## Scènes sans oracle natif — testables S5/BPx directement

### Promues 2026-06-10 — scènes manuscrites validées S5 (6)

`scenes/*.bps` copiées en `test/grammars/<g>/scene.bps` + `status.json` + `snapshots/s5_bps.json`
(WASM v3.4.5-wasm.1). L'original BP3 reste exclu de la baseline (le natif ne produit pas).

| Grammaire | S5 tokens | Exclusion native (origine) |
|---|---|---|
| csound | 11 | ResetWeights=0 → boucle infinie native |
| major-minor | 37 | exige -cs.Mozart, ne compile pas sans |
| scales | 37 | grammaire BP2, ne compile pas |
| transposition | 151 | grammaire BP2, ne compile pas |
| tunings | 18 | BP2 + vieux settings, exige -cs. |
| vina3 | 241 | -cs.Vina pend le moteur natif |

> `shapes-rhythm` : NON promue. Blocage historique = collages underscore (`si3_____`) non
> découpés ; le fix tokenizer F2 (2026-06-10, underscores traînants → prolongations) lève ce
> blocage — re-tenter la promotion au prochain passage.

### Annexes — autres `scene.bps` hors baseline (7)

- `tryflags2` (to_be_tested) : scène + s5 (10 tokens, RND ≠ s2), pas d'oracle natif (BP2 legacy).
- `dhati`, `dhin` (excluded S0/S1) : scènes des travaux homomorphismes ; oracles tenus côté BPx
  (`BPx/test/scenes/bernard/`). Le WASM BP3 ignore la table d'homomorphisme de l'alphabetFile.
- `livecode2`, `mohanam`, `nadaka`, `tryConsoleMaxTime`, `tryObjects` (excluded) : scènes
  présentes, originaux natifs non productifs (raisons datées dans `grammars.json`).
  `tryObjects` : S5 WASM crashe (memory OOB).
- `dhadhatite_v2` (partial) : transposition BPscript partielle de -gr.dhadhatite.

---

## OUT — ni oracle natif ni scène (raisons datées dans `grammars.json`)

### Migratable plus tard — format BP2 ancien (~20)

- **En-tête BP2 `V.2.x`, le parser échoue** : Alarm, Nadaka1, Rajeev, checkHomo, checkSUB,
  checkSUB.new, checkhomo2, polyphony1, tryGOTO, tryTicks, trytemplates2 [constats 2026-04-04]
- **Caractères non-ASCII BP2** : checkrests (`É`), a (`³`=≥), trySerial (`Æ`)
- **Directive `INIT:` BP2** : gramgene1, gramgene2 (exclus 2026-06-10)
- **Sections/opérateurs BP2-only** : trySerial (`_rndseq`/`_ordseq`)
- **Terminaux composés absents des alphabets** : dhadhatite

### Besoin d'une feature non portée (~8)

- **Fichiers d'orchestration `-or.X`** : Djinns, Mozartexpression, checkVolMasterSlave, cloches1
  (skip bells associé : -ho.cloches1 manquant), tryKeyMap, tryKeyXpand
- **Directive d'import `-in.X`** : tryflags3
- **Opérateur Csound `_ins()`** : checkAllCsound

### Hors-jeu réel

- **Non-grammaires (HTML)** : a.html, tryflags3.html
- **Comportement grammaire** (non-terminant / 0 note / crash) : PP (exclu 2026-06-10),
  checkcontext (exclu 2026-06-10), tryLIN (exclu 2026-06-10), Nadaka-1er-essai, trytemplates,
  keys (crash bp.exe), shapes-rhythm (S1 natif boucle — mais voir promotion possible ci-dessus)

---

## Réserves — SOLDÉES 2026-06-10

- ~~`transposition3` : baseline = 1 token (artefact CR Mac)~~ **SOLDÉE** : `s0_snapshot.cjs`
  normalise CR→LF ; bp.exe produit 30 tokens, identiques à s1_native (30/30). Re-activée,
  snapshot s0 réécrit ce jour.
- ~~Seuil de détection MIDI 100→50 octets~~ **VALIDÉE** : ne laisse pas passer de baselines
  marginales (vérifié au re-tri).
- ~~Doublons de casse ames/Ames, visser3/Visser3, visser5/Visser5~~ **SOLDÉE** : fusionnés
  (commit b98009d), casse canonique = minuscule, le dossier minuscule porte le `scene.bps`.

## Prochaines étapes

1. Re-tenter la promotion de `shapes-rhythm` (fix tokenizer F2 livré 2026-06-10).
2. Générer `scene.bps` pour blurb, checkVolChan, dhadhatite1 (oracles natifs acquis).
3. Trous-langage restants : check& (`_&`), dhati2/dhati3 (templates LHS), trySrand (`/N`).
4. dhin1 : tronquer/aliaser les terminaux > 30 caractères (BOLSIZE moteur).
5. (Optionnel) Migrer les ~20 grammaires BP2 pour agrandir la baseline.
