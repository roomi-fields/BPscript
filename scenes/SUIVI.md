# Suivi des traductions BP3 → BPS

## Tableau de validation (44/44 scènes — 100%)

| Scène            | Traduite  | Compile  | BP3              | MIDI   |
| ---------------- | :------:  | :-----:  | --------------   | :---:  |
| 765432           |    ✅     |    ✅    | ⚠️ format libre |   —   |
| acceleration     |    ✅     |    ✅    | ✅ exact        |   ✅  |
| alan-dice        |    ✅     |    ✅    | ⚠️ 144 cosm.    |   —   |
| all-items        |    ✅     |    ✅    | ⚠️ 1 cosm.      |   —   |
| ames             |    ✅     |    ✅    | ⚠️ 2 cosm.      |   ✅  |
| asymmetric       |    ✅     |    ✅    | ⚠️ 11 cosm.     |   —   |
| beatrix-dice     |    ✅     |    ✅    | ⚠️ 144 cosm.    |   —   |
| csound           |    ✅     |    ✅    | ✅ exact        |   ✅  |
| destru           |    ✅     |    ✅    | ⚠️ 1 cosm.      |   —   |
| dhati            |    ✅     |    ✅    | ⚠️ 140 cosm.    |   —   |
| dhin             |    ✅     |    ✅    | ⚠️ 72 cosm.     |   —   |
| drum             |    ✅     |    ✅    | ⚠️ format libre |   ✅  |
| ek-do-tin        |    ✅     |    ✅    | ⚠️ 2 cosm.      |   —   |
| flags            |    ✅     |    ✅    | ⚠️ 4 cosm.      |   —   |
| graphics         |    ✅     |    ✅    | ⚠️ 1 cosm.      |   ✅  |
| harmony          |    ✅     |    ✅    | ⚠️ 2 cosm.      |   ✅  |
| koto3            |    ✅     |    ✅    | ✅ exact        |   —   |
| kss2             |    ✅     |    ✅    | ⚠️ 1 cosm.      |   —   |
| livecode1        |    ✅     |    ✅    | ⚠️ format libre |   ✅  |
| livecode2        |    ✅     |    ✅    | ⚠️ format libre |   —   |
| look-and-say     |    ✅     |    ✅    | ⚠️ 9 cosm.      |   —   |
| major-minor      |    ✅     |    ✅    | ⚠️ format libre |   —   |
| mohanam          |    ✅     |    ✅    | ⚠️ 4 cosm.      |   —   |
| mozart-dice      |    ✅     |    ✅    | ⚠️ 144 cosm.    |   —   |
| nadaka           |    ✅     |    ✅    | ⚠️ 12 cosm.     |   —   |
| negative-context |    ✅     |    ✅    | ⚠️ 1 cosm.      |   ✅  |
| not-reich        |    ✅     |    ✅    | ⚠️ 6 cosm.      |   —   |
| one-scale        |    ✅     |    ✅    | ⚠️ 5 cosm.      |   ✅  |
| repeat           |    ✅     |    ✅    | ⚠️ 7 cosm.      |   —   |
| ruwet            |    ✅     |    ✅    | ⚠️ 34 cosm.     |   —   |
| scales           |    ✅     |    ✅    | ⚠️ 8 cosm.      |   —   |
| shapes-rhythm    |    ✅     |    ✅    | ⚠️ 136 cosm.    |   —   |
| templates        |    ✅     |    ✅    | ⚠️ 1 cosm.      |   ✅  |
| time-patterns    |    ✅     |    ✅    | ⚠️ 2 cosm.      |   —   |
| transposition    |    ✅     |    ✅    | ⚠️ 1 cosm.      |   ✅  |
| tunings          |    ✅     |    ✅    | ⚠️ format libre |   —   |
| vina             |    ✅     |    ✅    | ⚠️ 10 cosm.     |   —   |
| vina2            |    ✅     |    ✅    | ⚠️ 10 cosm.     |   —   |
| vina3            |    ✅     |    ✅    | ⚠️ 24 cosm.     |   —   |
| visser-shapes    |    ✅     |    ✅    | ⚠️ 5 cosm.      |   —   |
| visser-waves     |    ✅     |    ✅    | ⚠️ 20 cosm.     |   —   |
| visser3          |    ✅     |    ✅    | ⚠️ 6 cosm.      |   —   |
| visser5          |    ✅     |    ✅    | ⚠️ 2 cosm.      |   —   |
| watch            |    ✅     |    ✅    | ⚠️ format libre |   —   |

**Légende :**
- **BP3** : comparaison textuelle avec la grammaire originale de Bernard
  - ✅ exact = règles identiques byte-for-byte
  - ⚠️ N cosm. = N différences cosmétiques (espaces dans flags, virgules polymétriques, `_mm(60)` vs `_mm(60.0000)`)
  - ⚠️ format libre = l'original n'a pas de préfixes `gram#` (format BP3 sans numérotation)
- **MIDI** : comparaison MIDI via WASM (byte-for-byte identical, seed 42)

## Librairies

| Fichier              | Contenu                                            | Directive                          |
| -------------------- | -------------------------------------------------- | ---------------------------------- |
| `lib/core.json`      | lambda, on_fail                                    | `@core`                            |
| `lib/controls.json`  | 30+ contrôles (vel, tempo, transpose, scale...)    | `@controls`                        |
| `lib/settings.json`  | Defaults moteur BP3 (quantization, time res...)    | auto                               |
| `lib/alphabets.json` | 13 alphabets (western, raga, EkDoTin, tabla...)    | `@western`, `@raga`, `@EkDoTin`... |
| `lib/sub.json`       | 14 tables de substitution (dhati, Ruwet, tabla...) | `@sub`                             |

## Différences cosmétiques systématiques

Ces différences apparaissent dans toutes les scènes et n'affectent PAS la sémantique BP3 (prouvé par 11 MIDI identical) :

1. **Espaces dans flags** : `/X = 5/` (original) vs `/X=5/` (nous)
2. **`_mm(60.0000)` vs `_mm(60)`** : perte de zéros décimaux
3. **Espaces après virgules polymétriques** : certains originaux ont `, ` d'autres `,`
4. **`gram#N [M]`** : certains originaux ont un espace avant `[`, nous non
5. **`(=A)(:A)` vs `(=A) (:A)`** : espace entre templates
6. **Format libre** (765432, drum, livecode1, livecode2, major-minor, tunings, watch) : l'original n'a pas de préfixes `gram#N[M]` — les règles commencent directement par `S -->`. Notre transpiler ajoute toujours les préfixes. Le nombre de règles est correct mais le compare ne peut pas matcher ligne à ligne.

## Corrections trouvées par la validation

1. Preamble invalide : `_vel()`, `_chan()` ne sont PAS des preamble BP3 valides → inline RHS
2. Opérateurs temporels : `{A}[speed:2]` ≠ `/2 A` → syntaxe `[/2]` `[\2]` `[*3]` `[**3]`
3. Enharmoniques : B2 ≠ Bb2 dans acceleration
4. `--` = `- -` et `C4_` = `C4 _` : prouvé identique dans BP3

## Questions pour Bernard

- **`-` vs `1`** : quelle est la différence entre `-` (silence) et `1` (nombre nu) dans le flux BP3 ?
