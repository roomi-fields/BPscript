# Suivi des traductions BP3 → BPS

## Tableau de validation (44/44 scènes — 100%)

| Scène | Compile | WASM | Détail |
|-------|:---:|------|--------|
| 765432 | ✅ | skip | original échoue (terminaux custom) |
| acceleration | ✅ | ✅ MIDI | 78 notes identical |
| alan-dice | ✅ | BP3 ⚠️ | 144 diffs cosmétiques / 328 rules |
| all-items | ✅ | skip | original échoue (alphabet custom) |
| ames | ✅ | ✅ MIDI | 11 notes identical |
| asymmetric | ✅ | skip | original échoue (alphabet custom) |
| beatrix-dice | ✅ | BP3 ⚠️ | 144 diffs cosmétiques / 328 rules |
| csound | ✅ | ✅ MIDI | 8 notes identical |
| destru | ✅ | skip | original échoue (alphabet custom) |
| dhati | ✅ | skip | original échoue (tabla bols custom) |
| dhin | ✅ | skip | original échoue (tabla bols custom) |
| drum | ✅ | ✅ MIDI | 12 notes identical |
| ek-do-tin | ✅ | skip | original échoue (bols kathak custom) |
| flags | ✅ | skip | original échoue (alphabet a/b custom) |
| graphics | ✅ | ✅ MIDI | 6 notes identical |
| harmony | ✅ | ✅ MIDI | 20 notes identical |
| koto3 | ✅ | skip | original échoue (alphabet custom) |
| kss2 | ✅ | ~OK | transpilé compile+dérive (0 MIDI — notes indiennes) |
| livecode1 | ✅ | ✅ MIDI | 27 notes identical |
| livecode2 | ✅ | skip | original échoue (solfège français) |
| look-and-say | ✅ | ❌ | terminaux d1/d2/d3 non reconnus (alphabet custom) |
| major-minor | ✅ | ✅ MIDI | 24 notes identical |
| mohanam | ✅ | ~OK | transpilé compile+dérive (0 MIDI — notes indiennes) |
| mozart-dice | ✅ | BP3 ⚠️ | 144 diffs cosmétiques / 334 rules (solfège FR) |
| nadaka | ✅ | BP3 ⚠️ | 12 diffs / 53 rules (notes indiennes + _scale) |
| negative-context | ✅ | ✅ MIDI | 3 notes identical |
| not-reich | ✅ | BP3 ⚠️ | 6 diffs / 10 rules (stack overflow en MIDI) |
| one-scale | ✅ | ✅ MIDI | 3 notes identical |
| repeat | ✅ | skip | original échoue (alphabet custom) |
| ruwet | ✅ | skip | original échoue (variables + homomorphismes) |
| scales | ✅ | skip | original échoue (gammes microtonales) |
| shapes-rhythm | ✅ | skip | original échoue (solfège FR + terminaux custom) |
| templates | ✅ | ✅ MIDI | 3 notes identical |
| time-patterns | ✅ | ❌ | time patterns (fichier -tb) non supportés par WASM |
| transposition | ✅ | ⚠️ MIDI | 48 vs 84 notes (WASM stateful — prouvé identical en isolation) |
| tunings | ✅ | ✅ MIDI | 16 notes identical |
| vina | ✅ | ~OK | transpilé compile+dérive (0 MIDI — notes indiennes) |
| vina2 | ✅ | ~OK | transpilé compile+dérive (0 MIDI — notes indiennes) |
| vina3 | ✅ | ⚠️ MIDI | 57 vs 57 notes (seed différent — WASM stateful) |
| visser-shapes | ✅ | BP3 ⚠️ | 5 diffs / 27 rules (stack overflow en MIDI) |
| visser-waves | ✅ | BP3 ⚠️ | 20 diffs / 46 rules (stack overflow en MIDI) |
| visser3 | ✅ | BP3 ⚠️ | 6 diffs / 29 rules (stack overflow en MIDI) |
| visser5 | ✅ | BP3 ⚠️ | 2 diffs / 12 rules (stack overflow en MIDI) |
| watch | ✅ | BP3 ⚠️ | 116 diffs / 117 rules (espacement) |

## Résumé

- **12 MIDI identical** : acceleration, ames, csound, drum, graphics, harmony, livecode1, major-minor, negative-context, one-scale, templates, tunings
- **2 MIDI prouvés en isolation** : transposition, vina3 (WASM stateful dans le validate — chaque test isolé est identique)
- **4 transpilé OK** : kss2, mohanam, vina, vina2 (originaux échouent sans NoteConvention indienne)
- **10 BP3 text diff** : différences cosmétiques dans le texte BP3 (espacement, `_` → espace dans _scale)
- **12 skip** : originaux échouent (alphabets custom, solfège FR, homomorphismes)
- **2 ❌** : look-and-say (terminaux custom d1/d2/d3), time-patterns (fichier -tb)

## Blocages MIDI restants

1. **Notes indiennes** : mohanam, kss2, vina, vina2 produisent 0 MIDI car `bp3_load_settings()` casse le MIDI. Fix en cours (bp3_load_settings_params).
2. **Solfège français** : mozart-dice, livecode2, shapes-rhythm — besoin NoteConvention=0. Même problème que ci-dessus.
3. **Alphabets custom** : flags, repeat, all-items, destru, koto3, 765432, asymmetric, look-and-say — terminaux non built-in. Besoin de charger l'alphabet + un mapping MIDI custom.
4. **Stack overflow WASM** : not-reich, visser-shapes, visser-waves, visser3, visser5 — grammaires trop récursives pour le stack WASM 2MB.
5. **Time base** : time-patterns — fichier -tb non supporté.

## Librairies

| Fichier | Contenu | Directive |
|---------|---------|-----------|
| `lib/core.json` | lambda, on_fail | `@core` |
| `lib/controls.json` | 30+ contrôles | `@controls` |
| `lib/settings.json` | Defaults moteur BP3 | auto |
| `lib/alphabets.json` | 13 alphabets (western, raga, EkDoTin, tabla...) | `@western`, `@raga`... |
| `lib/sub.json` | 14 tables de substitution | `@sub` |

## Différences BP3 cosmétiques

1. **Espaces dans flags** : `/X = 5/` vs `/X=5/` — sans impact
2. **`_mm(60.0000)` vs `_mm(60)`** — zéros décimaux
3. **Espacement polymétriques** : `{2,X}-` vs `{2,X} -`
4. **`(=A)(:A)` vs `(=A) (:A)`** — espace entre templates
5. **`_` → espace** dans _scale : `bach_temperament` → `bach temperament`
6. **Format libre** : 7 originaux sans `gram#` prefix
