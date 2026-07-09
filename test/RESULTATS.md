# Résultats des tests

> **MAJ 2026-06-14 — WASM RETIRÉ du harnais** (décision oracle-natif-trois-voies).
> `test_all.cjs` ne fait plus que l'**oracle natif** (S1 MIDI + S3-native timed-tokens via
> `s3_native.cjs --tokensout`). Les étages WASM S2/S3/S4/S5 et les comparateurs
> s1_s2/s2_s3/s3_s4/s4_s5 sont **supprimés** ; la validation passe aux 2 voies BPx
> (voie A `.gr`→BPx chez le frontal, voie B `.bps`→BPx chez BPx). Le tableau S0→S5
> ci-dessous est conservé comme historique de la campagne de parité WASM (périmé).

# Historique — Pipeline S0→S1→S2→S3→S4→S5 (campagne parité WASM, périmé)

Dernière mise à jour : 2026-06-10
Build : v3.4.5-wasm.1
38 grammaires actives au moment des runs (39 depuis la récupération de transposition3, après la vague).

## Stages

| Stage | Source                | Comparaison | Description                                               |
| ----- | --------------------- | ----------- | --------------------------------------------------------- |
| S0    | bp.exe (Windows PHP)  | Référence   | Production MIDI/TEXT de référence                         |
| S1    | bp3 (Linux natif GCC) | S0 vs S1    | Même moteur, autre plateforme                             |
| S2    | bp3.wasm (WASM)       | S1 vs S2    | MIDI events depuis PlayBuffer1 + p_Instance               |
| S3    | bp3.wasm (WASM)       | S2 vs S3    | Timed tokens depuis p_Instance (MIDI) ou getResult (TEXT) |
| S4    | bp3.wasm (WASM)       | S3 vs S4    | Comme S3 mais avec silent.al (bols opaques, pas de MIDI)  |
| S5    | transpiler + bp3.wasm | S4 vs S5    | Pipeline BPScript complet (.bps → tokens)                 |

## Scores globaux — vague de vérification 2026-06-10 (test_all, 650 s, 38 actives)

| Stage / Comparaison | Résultat | Avril (v3.3.19) | Delta |
| ------------------- | -------- | ---------------- | ----- |
| S1 (natif)          | 38 OK / 0 FAIL | 36 OK | +2 (corpus élargi) |
| S2 (WASM)           | 37 OK / 1 FAIL (watch, #50) | 36 OK | — |
| S4 (WASM silent)    | 36 OK / 2 FAIL (watch + 765432 transitoire¹) | 36 OK | — |
| S5 (BPScript)       | 37 OK / 1 FAIL (watch) | 33 OK | +4 |
| **S1 vs S2**        | 28 EXACT / 9 TIMING / 0 CONTENT / 1 COUNT | 26/9/0/1 | **+2 EXACT** |
| **S2 vs S3**        | 31 EXACT / 4 TIMING / 3 CONTENT / 0 | 29/4/3/0 | **+2 EXACT** |
| **S3 vs S4**        | **37 EXACT / 0 / 0 / 0 (100 %)** | 33/1/0/2 | **+4 EXACT** |
| **S4 vs S5**        | 15/32 EXACT, 17 DIFF, 6 SKIP motivés² | 11/34 | +4 EXACT |

¹ 765432 S4 passe seul en 14,6 s — l'échec en suite est de la contention (jobs parallèles).
² SKIP S4vsS5 : one-scale, look-and-say, kss2, vina, vina2, visser-waves (motifs documentés dans le log).

Aucune régression vs l'état d'avril — uniquement des gains.

### run_s5_all (38 actives, v3.4.5-wasm.1)

| Run | EXACT | CONTENT | COUNT | ZERO | FAIL | SKIP |
|---|---|---|---|---|---|---|
| Vague de vérification (avant fixes F1-F4) | 14 | 7 | 13 | 1 (765432³) | 1 (watch) | 2 |
| Après fixes F1-F4 (F-CODE, même jour) | 15 | 7 | 13 | 1 | 2 (dont watch ETIMEDOUT) | 0 |

EXACT (vague) : all-items, all-items1, drum, flags, graphics, look-and-say, mozart-dice,
negative-context, not-reich, repeat, templates, tryAllItems0, tryAllItems1, vina.

³ 765432 : le moteur refuse désormais la grammaire (bugs #48 + #49, natif ET WASM
v3.4.4/v3.4.5). Snapshot committé 1497 tokens (v3.4.2-wasm.2) conservé comme dernier état
valide, status.json annoté.

### Suites unitaires (après bloc de production [@…], 2026-06-11)

| Suite | Résultat |
|---|---|
| test_v08_parser | 168 PASS / 0 FAIL |
| test_tokenizer_hyphen | 82 PASS / 0 FAIL |
| test_scan_mode | 15 PASS / 0 FAIL |
| test_taska_taskb | 12 PASS / 0 FAIL |
| test_bolsize_alias | 7 PASS / 0 FAIL |
| test_production_block | 56 PASS / 0 FAIL (nouveau, décision 2026-06-11 durcie : @-formes rejetées) |
| test_tempo_scope | 5 PASS / 0 FAIL (TempoOp.scope absolu/relatif, contrat BPx E-007 trou A) |
| test_shuffle_seed | 11 PASS / 0 FAIL (shuffle=brassage seul ; ![@seed:N]→_srand ; [shuffle:N] retiré) |
| test_bp3_to_scene | 84 OK / 0 FAIL / 3 NON GÉRÉ |
| test_libs_bundle | 18 PASS / 0 FAIL (nouveau 2026-06-14 : bundle libs-data.js à jour vs lib/*.json) |
| smoke (src/transpiler/test.js) | 33 scènes, 0 erreur |

## Régénérations du jour (2026-06-10)

- **tryAllItems1** : s5 régénéré 275 → 134 tokens — byte-identique à s4, mêmes noms que s2
  (134/134), plus de têtes de règle X/Y/T parasites.
- **transposition1** : s5 créé (81 = 75 notes non transposées + 6 marqueurs TR non résolus —
  voir note dispatcher ci-dessous) vs s3/s0 = 75 transposées.
- **tryflags2** : s5 créé (10 tokens, séquence RND ≠ s2).
- **dhati / dhin** : s5 byte-identiques aux snapshots pré-marqueurs (le WASM ignore la table
  d'homomorphisme de l'alphabetFile — résolution prévue côté BPx).
- **visser5** : s4/s5 frais trackés (date seule) ; le s5 de juin (1625 = 1088 notes s3_silent +
  281 silences + 256 CT) est le cohérent, le 1498 d'avril venait du transpileur pré-campagne.
- **765432** : s5 restauré à la version committée (1497) après écrasement 0-token par les
  suites (bugs moteur #48/#49).
- **transposition3** : s0 réécrit (30 tokens, identiques à s1_native 30/30) après le fix
  harnais CR→LF — grammaire ré-activée.
- **6 scènes manuscrites promues** avec s5 : csound (11), major-minor (37), scales (37),
  transposition (151), tunings (18), vina3 (241).
- Snapshots s1-s5 des 38 actives réécrits à l'état courant (commit c9d318f).

## ⚠️ Note dispatcher → Kanopi (changement de sémantique des s5)

`src/dispatcher` a été extrait vers Kanopi (commit 4fb6b46). L'étape de résolution des
contrôles du harnais S5 échoue silencieusement (WARN) : **les s5 récents portent les tokens
bruts** — notes non transposées/résolues, marqueurs `TR`/`_script(CT n)` visibles — pour
toutes les grammaires MIDI à contrôles (transposition1, visser5…). Les s5 d'avril, eux,
étaient résolus. Comparer un s5 récent à un s5 d'avril n'a donc de sens qu'à résolution
égale.

## Issues ouvertes (côté Bernard — voir FEEDBACK_BERNARD.md)

| #   | Titre | Grammaires impactées | Stage | Impact |
| --- | --- | --- | --- | --- |
| #32 | WriteMIDIbyte — drift CC interpolés | not-reich | S1≠S2 | TIMING ±109ms fin de pièce |
| #36 | Production TEXT sans séparateurs (alphabet chargé) | negative-context | S3≠S4 | COUNT |
| #44 | Opérateur `**N` incohérent | (aucune active) | — | basse priorité |
| #47 | Guards enfant aveugles aux flags du parent | m1_05_combo (repro) | dérivation | contournement m1_05bis |
| #48 | Terminal alphabet à tiret final → segfault | 765432 (ancien alphabet) | S5 | crash natif+WASM |
| #49 | Terminal court masque les variables préfixées | 765432 | S5 | production 0 (erreur 15) |
| #50 | watch : ralentissement ×2 (~257 s CPU) | watch | S2/S4/S5 | ETIMEDOUT (contenu byte-identique) |
| #51 | Garde mono-item rc=-4 sur chaînes intermédiaires | m1_04_recursion (repro) | dérivation | production avorte |

## Issues connues (côté WASM, non corrigeables)

| Issue | Grammaires | Stage | Explication |
| --- | --- | --- | --- |
| MPC microtonalité | tryShruti | S1≠S2 (+1 note) | PlayBuffer1 ne reproduit pas exactement MPC |
| Homomorphisme + silent.al | ruwet | S3≠S4 TIMING | bols dans l'alphabet changent la dérivation |
| Table homo ignorée | dhati, dhin | S5 | alphabetFile -ho sans effet — résolution côté BPx (M9+) |

---

## Historique — état 2026-04-06 (36 actives, v3.3.19-wasm.3)

<details>
<summary>Scores et détail par grammaire d'avril (avant campagne) — conservés pour référence</summary>

| Comparaison  | EXACT | TIMING | CONTENT | COUNT | MISSING | Total |
| ------------ | ----- | ------ | ------- | ----- | ------- | ----- |
| **S0 vs S1** | 33    | 2      | 0       | 0     | 0       | 35    |
| **S1 vs S2** | 26    | 9      | 0       | 1     | 0       | 36    |
| **S2 vs S3** | 29    | 4      | 3       | 0     | 0       | 36    |
| **S3 vs S4** | 33    | 1      | 0       | 2     | 0       | 36    |
| **S4 vs S5** | 11    | —      | 23      | —     | 2       | 34    |

bells exclu (skip : fichiers -ho.cloches1 manquants).

Non-régression v3.3.19-wasm.3 vs wasm.2 (2026-04-06) : zéro régression, 3 grammaires #35
passent de TIMING+10ms à EXACT (acceleration, visser3, visser-shapes).
Non-régression wasm.2 vs wasm.20 : zéro régression, visser5 S1≠S2 16 diffs → 1.
Non-régression wasm.20 vs wasm.18 (2026-04-05) : zéro régression réelle (kss2 ASLR #39, résolu depuis).

</details>

## Légende

- **EXACT** : résultats identiques (ou within tolerance ≤3ms delta)
- **TIMING** : mêmes notes, timings différents (avec cause identifiée)
- **CONTENT** : notes ou noms différents
- **COUNT** : nombre de tokens différent
- **ZERO** : s5 vide alors que s4 produit
- **#N** : référence FEEDBACK_BERNARD.md
