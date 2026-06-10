# Couverture baseline — grammaires BP3

> Mis à jour le 2026-06-10. Quelles grammaires BP3 peuvent entrer dans la baseline de parité BPx.

## Critère

Une grammaire est **baseline-able** si :
1. **bp.exe (moteur natif, source de vérité) en produit une sortie** — l'oracle natif S0 existe.
2. Elle est **exprimable en BPScript** (pour qu'un `scene.bps` alimente BPx).

La **traductibilité (2) n'est presque jamais le frein** : les contrôles (`vel`, `transpose`,
`tempo`…), durées, `__`, tempo `/N`, ties sont tous exprimables en BPScript. La contrainte
réelle est **(1)** : bp.exe produit-il ? Les grammaires actives prouvent (2) — elles ont
déjà un `scene.bps` qui marche.

`scene.bps` présent → testable par BPx **maintenant**. Absent → baseline native acquise,
`scene.bps` **à générer** (transpileur inverse `src/transpiler/bp3ToScene.js`, à étendre, ou
à la main).

---

## IN — baseline native acquise

### Niveau 1 — actives + `scene.bps` → testable par BPx maintenant (32)

765432, acceleration, acceleration_v2, alan-dice, all-items, all-items1, asymmetric,
beatrix-dice, destru, drum, ek-do-tin, flags, graphics, harmony, koto3, kss2, livecode1,
look-and-say, mozart-dice, negative-context, not-reich, one-scale, repeat, ruwet, templates,
time-patterns, tryAllItems0, tryAllItems1, vina, vina2, visser-shapes, visser-waves

### Niveau 1bis — to_be_tested + `scene.bps` → testable par BPx maintenant (14)

checkBT, checkSUB1, dhin1, doeslittle, koto1, koto2, MyMelody, simpletemplates,
transposition1, tryflags2, tryMIDIfile, tryPatternGrammar, tryRotate, tryhomomorphism

> Doublons de casse (même grammaire, deux dossiers) : `ames`/`Ames`, `visser3`/`Visser3`,
> `visser5`/`Visser5` — la version minuscule a le `scene.bps` en Niveau 1.

### Niveau 2 — baseline native, `scene.bps` encore absent (8)

check&, dhati2, dhati3, tryCsoundObjects, tryRagas, tryShruti, trySrand, watch

> `dhati2`/`dhati3` et `tryShruti`/`trySrand` : TROU-LANGAGE — voir champ `trou_langage`
> dans `grammars.json`. Conversion bp3ToScene bloquée sur constructs non encore supportés.
> `tryCsoundObjects`, `check&` : contrôles runtime en position trailing/polymetry (NON GÉRÉ).

---

## OUT — pas de baseline native

### Migratable plus tard — format BP2 ancien (~24)

- **En-tête BP2 `V.2.x`, le parser échoue** : checkSUB, checkSUB.new, tryLIN (exclu 2026-06-10),
  Rajeev, trytemplates2, dhadhatite1, tryGOTO, polyphony1, Nadaka1, tryTicks, checkHomo, checkhomo2, Alarm
- **Caractères non-ASCII BP2** : doeslittle (`¥`), checkrests (`É`), a (`³`=≥), trySerial (`Æ`)
- **Directive `INIT:` BP2** : gramgene1 (exclu 2026-06-10), gramgene2 (exclu 2026-06-10)
- **Sections/opérateurs BP2-only** (`TEMPLATES:`, `_rndseq`/`_ordseq`) : simpletemplates, trySerial
- **Terminaux composés absents des alphabets** : dhadhatite, dhadhatite_v2

### Besoin d'une feature non portée (~9)

- **Fichiers d'orchestration `-or.X`** : checkVolMasterSlave, tryKeyMap, cloches1, tryKeyXpand,
  Djinns, Mozartexpression
- **Directive d'import `-in.X`** : tryflags3, checkVolChan
- **Opérateur Csound `_ins()`** : checkAllCsound

### Hors-jeu réel

- **Non-grammaire (HTML)** : a.html, tryflags3.html
- **Comportement grammaire** (non-terminant / 0 note / crash / boucle infinie) :
  PP (exclu 2026-06-10), checkcontext (exclu 2026-06-10), Nadaka-1er-essai, trytemplates,
  keys (crash bp.exe)

---

## Réserves

- `transposition3` : baseline = **1 token** — artefact CR Mac dans le snapshot (ligne vide lue
  comme token). Exclu de la baseline. Le doublon `transposition` (BP2, non compilable) n'a pas
  de baseline non plus.
- Le seuil de détection MIDI de `s0_snapshot.cjs` a été abaissé 100→50 octets lors du
  re-tri — validé : ne laisse pas passer de baselines marginales.
- Les OUT « format BP2 » ne sont **pas** définitivement perdues : une migration BP2→BP3
  (en-têtes, caractères) les rendrait baseline-ables. C'est un chantier séparé.

## Prochaines étapes

1. Résoudre les TROU-LANGAGE bloquant `tryShruti` (E5 : `_tempo` en RHS),
   `trySrand` (E5 : opérateurs tempo `/N`), `dhati2`/`dhati3` (templates BP2 en LHS).
2. Générer `scene.bps` pour `check&` et `tryCsoundObjects` une fois les contrôles trailing
   supportés (extension E4, ajourné).
3. Fusionner les doublons de casse (ames/Ames, visser3/Visser3, visser5/Visser5).
4. (Optionnel) Migrer les ~24 grammaires BP2 pour agrandir la baseline.
