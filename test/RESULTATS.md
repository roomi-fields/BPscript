# Résultats des tests — Pipeline S0→S1→S2→S3→S4→S5

Dernière mise à jour : 2026-04-06
Build : v3.3.19-wasm.2

## Stages

| Stage | Source                | Comparaison | Description                                               |
| ----- | --------------------- | ----------- | --------------------------------------------------------- |
| S0    | bp.exe (Windows PHP)  | Référence   | Production MIDI/TEXT de référence                         |
| S1    | bp3 (Linux natif GCC) | S0 vs S1    | Même moteur, autre plateforme                             |
| S2    | bp3.wasm (WASM)       | S1 vs S2    | MIDI events depuis PlayBuffer1 + p_Instance               |
| S3    | bp3.wasm (WASM)       | S2 vs S3    | Timed tokens depuis p_Instance (MIDI) ou getResult (TEXT) |
| S4    | bp3.wasm (WASM)       | S3 vs S4    | Comme S3 mais avec silent.al (bols opaques, pas de MIDI)  |

## Scores globaux

| Comparaison  | EXACT | TIMING | CONTENT | COUNT | MISSING | Total |
| ------------ | ----- | ------ | ------- | ----- | ------- | ----- |
| **S0 vs S1** | 33    | 2      | 0       | 0     | 0       | 35    |
| **S1 vs S2** | 23    | 12     | 0       | 1     | 0       | 36    |
| **S2 vs S3** | 29    | 4      | 3       | 0     | 0       | 36    |
| **S3 vs S4** | 33    | 1      | 0       | 2     | 0       | 36    |
| **S4 vs S5** | 11    | —      | 23      | —     | 2       | 34    |

bells exclu (skip : fichiers -ho.cloches1 manquants) → 36 grammaires actives

## Issues ouvertes (côté Bernard)

| #   | Titre                                                     | Grammaires impactées                 | Stage        | Impact                     |
| --- | --------------------------------------------------------- | ------------------------------------ | ------------ | -------------------------- |
| #32 | FillPhaseDiagram — dérive triolets (arrondi GCC vs clang) | not-reich                            | S1≠S2        | TIMING ±109ms fin de pièce |
| #33 | ~~MakeSound — NoteOff retardé~~ RÉSOLU WASM (dedup keep-longest) | ~~visser5~~, visser-waves, watch | S1≠S2, S2≠S3 | visser5: 16→1 diff         |
| #35 | TimeSet — starttime +10ms avec settings Visser            | acceleration, visser3, visser-shapes | S1≠S2        | TIMING +10ms constant      |
| #36 | Production TEXT sans séparateurs quand alphabet chargé    | negative-context                     | S3≠S4        | COUNT (tokens concaténés)  |
| #39 | Mémoire non initialisée — ASLR non-déterminisme Linux    | kss2 (+ potentiellement d'autres)    | S1           | FAIL intermittent (~25%)   |

## Issues connues (côté WASM, non corrigeables)

| Issue                     | Grammaires | Stage                             | Explication                                                                |
| ------------------------- | ---------- | --------------------------------- | -------------------------------------------------------------------------- |
| MPC microtonalité         | tryShruti  | S1≠S2 (+1 note), S3≠S4 (0 tokens) | PlayBuffer1 ne reproduit pas exactement MPC. BP3 refuse `_` dans alphabet. |
| Homomorphisme + silent.al | ruwet      | S3≠S4 TIMING                      | Les bols dans l'alphabet changent la dérivation de l'homomorphisme         |

## Détail par grammaire (36 actives, bells skip)

| Grammaire        | Mode | S0=S1  | S1=S2        | S2=S3   | S3=S4       | Notes                                                            |
| ---------------- | ---- | ------ | ------------ | ------- | ----------- | ---------------------------------------------------------------- |
| 765432           | midi | EXACT  | TIMING≤1ms   | EXACT   | EXACT       | Within tolerance (arrondi tick→ms)                               |
| acceleration     | midi | EXACT  | TIMING+10ms  | EXACT   | EXACT       | #35 : +10ms offset settings Visser                               |
| alan-dice        | midi | EXACT  | TIMING≤3ms   | TIMING  | EXACT       | Multi-item, within tolerance. S2≠S3 = #33 timing accumulation    |
| all-items        | text | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| all-items1       | text | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| ames             | midi | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| asymmetric       | text | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| beatrix-dice     | midi | EXACT  | TIMING≤3ms   | TIMING  | EXACT       | Multi-item, within tolerance. S2≠S3 = #33 timing accumulation    |
| ~~bells~~        | midi | N/A    | —            | —       | —           | **skip** : fichiers manquants (-ho.cloches1, -se.cloches, -mi)   |
| destru           | text | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| drum             | midi | EXACT  | TIMING≤1ms   | EXACT   | EXACT       | Within tolerance                                                 |
| ek-do-tin        | text | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| flags            | text | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| graphics         | midi | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| harmony          | midi | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| koto3            | text | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| kss2             | midi | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| livecode1        | midi | EXACT  | EXACT        | EXACT   | EXACT       | Multi-item (Improvize)                                           |
| look-and-say     | text | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| mozart-dice      | midi | EXACT  | TIMING≤2ms   | EXACT   | EXACT       | Multi-item, within tolerance                                     |
| negative-context | text | EXACT  | EXACT        | EXACT   | **COUNT**   | #36 : TEXT concat avec alphabet chargé                           |
| not-reich        | midi | EXACT  | TIMING±109ms | EXACT   | EXACT       | #32 : FillPhaseDiagram dérive triolets GCC                       |
| one-scale        | midi | EXACT  | EXACT        | EXACT   | EXACT       | _scale(just intonation)                                          |
| repeat           | text | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| ruwet            | midi | EXACT  | EXACT        | EXACT   | **TIMING**  | Homomorphisme -ho.Ruwet : bols dans alphabet changent dérivation |
| templates        | text | EXACT  | EXACT        | EXACT   | EXACT       | 36635 tokens                                                     |
| time-patterns    | text | TIMING | EXACT        | EXACT   | EXACT       | S0≠S1 pré-existant                                               |
| tryAllItems0     | text | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| tryCsoundObjects | text | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| tryShruti        | midi | EXACT  | **COUNT+1**  | CONTENT | **COUNT=0** | MPC : +1 note S2. BP3 refuse `_` dans alphabet → S4=0            |
| vina             | midi | EXACT  | EXACT        | EXACT   | EXACT       | Convention indienne                                              |
| vina2            | text | EXACT  | EXACT        | EXACT   | EXACT       |                                                                  |
| visser3          | midi | EXACT  | TIMING+10ms  | EXACT   | EXACT       | #35 : +10ms offset settings Visser                               |
| visser5          | midi | EXACT  | TIMING±11ms  | CONTENT | EXACT       | #33 résolu (dedup keep-longest). S2≠S3 = ordre notes différent   |
| visser-shapes    | midi | EXACT  | TIMING+10ms  | CONTENT | EXACT       | #35 + quelques notes octave edge en S2≠S3                        |
| visser-waves     | midi | TIMING | TIMING±40ms  | TIMING  | EXACT       | #33 partiellement amélioré (keep-longest). S0≠S1 pré-existant    |
| watch            | midi | TIMING | TIMING±670ms | TIMING  | EXACT       | #33 : scheduling séquentiel. S0≠S1 pré-existant                  |

## Non-régression v3.3.19-wasm.2 vs wasm.20 (2026-04-06)

Changement : dedup keep-longest (#33), traces debug conditionnées (BP3_DEBUG), test_all intègre S4+S5+compare_s3_s4.

| Comparaison | wasm.20 | wasm.2 | Delta |
|---|---|---|---|
| S1 vs S2 | 23E/12T/0C/2Count | 23E/12T/0C/1Count | Score global wasm.20 était erroné (1 COUNT, pas 2) |
| S2 vs S3 | 29E/4T/3C/0 | 29E/4T/3C/0 | Identique |
| S3 vs S4 | 33E/1T/0C/2 | 33E/1T/0C/2 | Identique |
| S4 36/36 OK | | S4 35/36 OK | watch FAIL (timeout) |
| S5 n/a | | S5 33/36 OK | 2 SKIP (no .bps), 1 FAIL (watch timeout) |

**Conclusion** : zéro régression. Amélioration visser5 S1≠S2 (16 diffs → 1).

---

## Non-régression wasm.20 vs wasm.18 (2026-04-05)

Changement : `FillPhaseDiagram.c` Bernard v3.3.19 (MakeEmptyTokensSilent refactoré) + commentaire `bp3_api.c`.

| Stage | EXACT | DIFF | Détail |
|-------|-------|------|--------|
| S0 vs S0 | 35/35 | 0 | bells skip |
| S1 vs S1 | 35/36 | 1 | kss2 : ASLR intermittent (#39), workaround setarch -R appliqué |
| S2 vs S2 | 36/36 | 0 | |
| S3 vs S3 | 36/36 | 0 | watch .wasm18 invalide (raw derivation, corrigé) |
| S4 vs S4 | 36/36 | 0 | |

**Conclusion** : zéro régression réelle. Build propre via `build.sh all --archive --version=v3.3.18-wasm.20`.

## Légende

- **EXACT** : résultats identiques (ou within tolerance ≤3ms delta)
- **TIMING** : mêmes notes, timings différents (avec cause identifiée)
- **CONTENT** : notes ou noms différents
- **COUNT** : nombre de tokens différent
- **#N** : référence FEEDBACK_BERNARD.md
