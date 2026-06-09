# Couverture baseline — grammaires BP3

> Généré le 2026-06-09. Quelles grammaires BP3 peuvent entrer dans la baseline de parité BPx.

## Critère

Une grammaire est **baseline-able** si :
1. **bp.exe (moteur natif, source de vérité) en produit une sortie** — l'oracle natif S0 existe.
2. Elle est **exprimable en BPScript** (pour qu'un `scene.bps` alimente BPx).

La **traductibilité (2) n'est presque jamais le frein** : les contrôles (`vel`, `transpose`,
`tempo`…), durées, `__`, tempo `/N`, ties sont tous exprimables en BPScript. La contrainte
réelle est **(1)** : bp.exe produit-il ? Les 38 grammaires actives prouvent (2) — elles ont
déjà un `scene.bps` qui marche.

`scene.bps` présent → testable par BPx **maintenant**. Absent → baseline native acquise,
`scene.bps` **à générer** (transpileur inverse `src/transpiler/bp3ToScene.js`, à étendre, ou
à la main).

---

## IN — baseline native acquise (≈55 distinctes)

### Niveau 1 — baseline + `scene.bps` → testable par BPx maintenant (40)

765432, Ames, MyMelody, Visser3, Visser5, acceleration, acceleration_v2, alan-dice,
all-items, all-items1, asymmetric, beatrix-dice, destru, drum, ek-do-tin, flags, graphics,
harmony, koto3, kss2, livecode1, look-and-say, mozart-dice, negative-context, not-reich,
one-scale, repeat, ruwet, templates, time-patterns, transposition3, tryAllItems0,
tryAllItems1, tryMIDIfile, tryPatternGrammar, tryRotate, vina, vina2, visser-shapes,
visser-waves

### Niveau 2 — baseline native, `scene.bps` à générer (~15 distinctes)

check&, checkBT, checkSUB1, dhati2, dhati3, **dhin1** (112 tokens), koto1, koto2,
transposition1, tryCsoundObjects, tryRagas, tryShruti, trySrand, tryhomomorphism, watch

> Doublons de casse à fusionner (même grammaire, deux dossiers) : `Ames`/`ames`,
> `Visser3`/`visser3`, `Visser5`/`visser5` — la version capitalisée (Niveau 1) a le `scene.bps`.

---

## OUT — pas de baseline native (40)

### Migratable plus tard — format BP2 ancien (pourrait rejoindre la liste après migration) (~24)

- **En-tête BP2 `V.2.x`, le parser échoue** : checkSUB, checkSUB.new, tryLIN, Rajeev,
  trytemplates2, dhadhatite1, tryGOTO, polyphony1, Nadaka1, tryTicks, tryflags2, checkHomo,
  checkhomo2, Alarm
- **Caractères non-ASCII BP2** : doeslittle (`¥`), checkrests (`É`), a (`³`=≥), trySerial (`Æ`)
- **Directive `INIT:` BP2** : gramgene1, gramgene2
- **Sections/opérateurs BP2-only** (`TEMPLATES:`, `_rndseq`/`_ordseq`) : simpletemplates, trySerial
- **Terminaux composés absents des alphabets** : dhadhatite, dhadhatite_v2

### Besoin d'une feature non portée (~9)

- **Fichiers d'orchestration `-or.X`** : checkVolMasterSlave, tryKeyMap, cloches1, tryKeyXpand,
  Djinns, Mozartexpression
- **Directive d'import `-in.X`** : tryflags3, checkVolChan
- **Opérateur Csound `_ins()`** : checkAllCsound

### Hors-jeu réel

- **Non-grammaire (HTML)** : a.html, tryflags3.html
- **Comportement grammaire** (non-terminant / 0 note / crash) : PP, checkcontext,
  Nadaka-1er-essai, trytemplates, keys (crash bp.exe)

---

## Réserves (à vérifier)

- `transposition3` : baseline = **1 token** — dégénérée, à confirmer (vrai résultat ou artefact ?).
- Le seuil de détection MIDI de `s0_snapshot.cjs` a été abaissé 100→50 octets pendant le
  re-tri — à valider qu'il ne laisse pas passer de baselines marginales.
- Les OUT « format BP2 » ne sont **pas** définitivement perdues : une migration BP2→BP3
  (en-têtes, caractères) les rendrait baseline-ables. C'est un chantier séparé.

## Prochaines étapes

1. Générer les `scene.bps` du Niveau 2 (étendre `bp3ToScene.js` aux constructs manquants :
   contrôles `()`/`[]`, durées `N/N`, tempo `/N`, `__` — déjà identifiés et priorisés).
2. Fusionner les doublons de casse.
3. (Optionnel) Migrer les ~24 grammaires BP2 pour agrandir la baseline.
