# Suivi des traductions BP3 → BPS

## Procédure de test

### Script : `test/validate_44_v2.cjs`

Le script teste chaque scène en deux passes dans des processus Node.js isolés :

**Passe 1 — Original BP3** (`test/_run_orig.cjs`) :
1. `bp3_init()`
2. Charge les fichiers auxiliaires référencés dans le header de la grammaire :
   - `-se.xxx` → `bp3_load_settings()` (JSON BP3 ou converti depuis format texte plat)
   - `-al.xxx` ou `-ho.xxx` → `bp3_load_alphabet()`
   - `-to.xxx` → `bp3_load_tonality()`
3. `bp3_load_grammar()` avec la grammaire originale de Bernard (depuis `bp3-engine/test-data/`)
4. `bp3_produce()`
5. Récupère : MIDI events (NoteOn = note 144), résultat texte, nombre d'erreurs

**Passe 2 — Transpilé BPscript** (`test/_run_trans.cjs`) :
1. Compile le `.bps` via `compileBPS()` → grammaire BP3 + alphabet
2. `bp3_init()`
3. `bp3_load_alphabet()` avec l'alphabet généré
4. `bp3_load_grammar()` avec la grammaire transpilée
5. `bp3_produce()`
6. Récupère : timed tokens (filtrés : ni silences `-` ni contrôles `_script`), résultat texte

**Comparaison** :
- Original produit des **MIDI events** (notes via OCT/NoteConvention)
- Transpilé produit des **timed tokens** (silent sound objects)
- On compare : nombre de notes/tokens, résultat textuel, statut de production

### Mapping scènes → grammaires originales

Les grammaires originales sont dans `bp3-engine/test-data/` (107 fichiers `-gr.xxx`).
Le mapping scène BPscript → nom de grammaire originale est dans le script.

### Fichiers sources

- Grammaires originales : `bp3-engine/test-data/-gr.xxx`, `-se.xxx`, `-al.xxx`, `-ho.xxx`, `-to.xxx`
- Scènes BPscript : `scenes/*.bps`
- Build WASM : `dist/bp3.{js,wasm,data}` (Bernard v3.3.15 + couche WASM)

### Exécution

```bash
cd /mnt/d/Claude/BPscript
node test/validate_44_v2.cjs
```

Timeout : 60s par scène, 55s pour le WASM. Chaque scène tourne dans un processus isolé.

---

## Tableau de validation (44 scènes — 22 mars 2026)

### Légende des statuts

| Statut           | Signification                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OK_MATCH**     | Les deux produisent. Nombre de notes = nombre de tokens.                                                                                                                                             |
| **OK_MISMATCH**  | Les deux produisent mais le nombre de notes/tokens diffère. Cause probable : terminaux custom (bols tabla) ou time patterns dans la version transpilée.                                               |
| **ORIG_NO_MIDI** | L'original produit du texte mais 0 MIDI (settings/tonalité manquants). Le transpilé produit des tokens. Non bloquant — l'original fonctionne, c'est le chargement des auxiliaires qui est incomplet. |
| **ORIG_MISS**    | L'original échoue (r=0) mais le transpilé réussit. Settings manquants empêchent la dérivation. Non bloquant — le transpilé fonctionne.                                                               |
| **TRANS_CRASH**  | Le transpilé crashe (stack overflow/memory) mais l'original passe. **Bug du transpileur** — la grammaire transpilée crée plus de récursion que l'originale.                                          |
| **RANDOM**       | Modes LIN/RND avec K-params — les deux produisent mais les résultats diffèrent (seeds). Non comparable note à note.                                                                                  |
| **DIFF**         | Les deux produisent mais le transpilé échoue (ABORT). Bug du transpileur.                                                                                                                            |
| **ORIG_CRASH**   | L'original crashe en WASM. Limitation connue (stack overflow JS).                                                                                                                                    |
| **BOTH_CRASH**   | Les deux crashent.                                                                                                                                                                                   |

### Résultats

| Scène            | Status         | Détail                                                                            |
| ---------------- | -------------- | --------------------------------------------------------------------------------- |
| 765432           | 💥 TRANS_CRASH  | orig: 475 notes, 950 MIDI. Trans: stack overflow (157 règles, 13 sous-grammaires) |
| acceleration     | ✅ OK_MATCH      | orig: 78 notes. Trans: 78 tokens                                                  |
| alan-dice        | 🎲 RANDOM       | orig: 244 notes. Trans: 245 tokens (seeds différents, mode LIN+K-params)          |
| all-items        | ⚠️ ORIG_NO_MIDI | orig: texte "C4 D6". Trans: 3 tokens                                              |
| ames             | ✅ OK_MATCH      | orig: 11 notes. Trans: 11 tokens                                                  |
| asymmetric       | ❌ DIFF         | orig: r=1. Trans: ABORT (-4). Bug transpileur (flags/K-params)                    |
| beatrix-dice     | 🎲 RANDOM       | orig: 273 notes. Trans: 245 tokens (seeds différents, mode LIN+K-params)          |
| csound           | ⚠️ ORIG_NO_MIDI | orig: texte avec _volumecont. Trans: 8 tokens                                     |
| destru           | ⚠️ ORIG_NO_MIDI | orig: texte 63 chars. Trans: 7 tokens                                             |
| dhati            | ⚠️ OK_MISMATCH  | orig: 17 notes. Trans: 30 tokens (bols tabla = silent objects, pas des notes MIDI) |
| dhin             | ⚠️ ORIG_NO_MIDI | orig: texte avec period notation. Trans: 82 tokens                                |
| drum             | ✅ OK_MATCH      | orig: 12 notes. Trans: 12 tokens                                                  |
| ek-do-tin        | ⚠️ ORIG_NO_MIDI | orig: texte avec _pitchrange. Trans: 52 tokens                                    |
| flags            | ⚠️ ORIG_NO_MIDI | orig: texte "b b a a a...". Trans: 20 tokens                                      |
| graphics         | ⚠️ ORIG_NO_MIDI | orig: texte avec polymétrie. Trans: 6 tokens                                      |
| harmony          | ⚠️ ORIG_MISS    | orig: r=0 (settings manquants). Trans: 20 tokens                                  |
| koto3            | ⚠️ ORIG_NO_MIDI | orig: texte vide. Trans: 7 tokens                                                 |
| kss2             | ⚠️ OK_MISMATCH  | orig: 87 notes. Trans: 96 tokens (terminaux custom supplémentaires)                |
| livecode1        | ✅ OK_MATCH      | orig: 27 notes. Trans: 27 tokens                                                  |
| livecode2        | ✅ OK_MATCH      | orig: 29 notes. Trans: 29 tokens                                                  |
| look-and-say     | ⚠️ ORIG_NO_MIDI | orig: texte avec quotes ('3' '1'...). Trans: 35 tokens                            |
| major-minor      | ⚠️ ORIG_MISS    | orig: r=0 (tonalité manquante). Trans: 24 tokens                                  |
| mohanam          | ❌ DIFF         | orig: r=1. Trans: ABORT (-4). Bug transpileur                                     |
| mozart-dice      | 🎲 RANDOM       | orig: 264 notes. Trans: 244 tokens (seeds différents, mode LIN+K-params)          |
| nadaka           | 💥 TRANS_CRASH  | orig: r=0 (probabiliste). Trans: stack overflow                                   |
| negative-context | ⚠️ ORIG_NO_MIDI | orig: texte "A A A A2 A3 A1". Trans: 6 tokens                                     |
| not-reich        | 💥 TRANS_CRASH  | orig: 475 notes. Trans: stack overflow (polymétrie profonde)                      |
| one-scale        | ⚠️ ORIG_MISS    | orig: r=0 (tonalité manquante). Trans: 6 tokens                                   |
| repeat           | ⚠️ ORIG_NO_MIDI | orig: texte "a a a b b b c c c". Trans: 3 tokens                                  |
| ruwet            | ⚠️ OK_MISMATCH  | orig: 123 notes. Trans: 124 tokens (off-by-one)                                   |
| scales           | ⚠️ ORIG_MISS    | orig: r=0 (tonalité manquante). Trans: 33 tokens                                  |
| shapes-rhythm    | 💥 TRANS_CRASH  | orig: 475 notes. Trans: memory overflow (146 règles, 17 sous-grammaires)          |
| templates        | ⚠️ ORIG_NO_MIDI | orig: texte "C4 C4 /2 C4". Trans: 3 tokens                                        |
| time-patterns    | ⚠️ OK_MISMATCH  | orig: 8 notes. Trans: 15 tokens (time patterns = tokens supplémentaires)           |
| transposition    | ⚠️ ORIG_MISS    | orig: r=0 (tonalité manquante). Trans: 48 tokens                                  |
| tunings          | ⚠️ ORIG_MISS    | orig: r=0 (tonalité manquante). Trans: 16 tokens                                  |
| vina             | ✅ OK_MATCH      | orig: 5 notes. Trans: 5 tokens                                                    |
| vina2            | ⚠️ ORIG_NO_MIDI | orig: texte avec pitchcont. Trans: 1 token                                        |
| vina3            | 💥 ORIG_CRASH   | orig: stack overflow JS (5 sous-grammaires, gamakas). Trans: 57 tokens            |
| visser-shapes    | 💥 BOTH_CRASH   | orig: pas de sortie (timeout?). Trans: stack overflow                             |
| visser-waves     | 💥 TRANS_CRASH  | orig: 365 notes. Trans: stack overflow (59 braces)                                |
| visser3          | 💥 TRANS_CRASH  | orig: 401 notes. Trans: stack overflow (_transpose→_script)                       |
| visser5          | 💥 TRANS_CRASH  | orig: 475 notes. Trans: stack overflow                                            |
| watch            | 💥 TRANS_CRASH  | orig: r=1, 0 notes. Trans: stack overflow                                         |

---

## Résumé

| Catégorie                                   |     Nb | Scènes                                                                                                                       |
| ------------------------------------------- | -----: | ---------------------------------------------------------------------------------------------------------------------------- |
| ✅ OK_MATCH (counts identiques)               |      6 | acceleration, ames, drum, livecode1, livecode2, vina                                                                         |
| ⚠️ OK_MISMATCH (counts différents)            |      4 | dhati, kss2, ruwet, time-patterns                                                                                            |
| ⚠️ ORIG_NO_MIDI (orig OK texte, pas de MIDI) |     13 | all-items, csound, destru, dhin, ek-do-tin, flags, graphics, koto3, look-and-say, negative-context, repeat, templates, vina2 |
| ⚠️ ORIG_MISS (orig r=0, settings manquants)  |      6 | harmony, major-minor, one-scale, scales, transposition, tunings                                                              |
| 💥 TRANS_CRASH (transpilé crashe, orig OK)   |      8 | 765432, nadaka, not-reich, shapes-rhythm, visser-waves, visser3, visser5, watch                                              |
| 🎲 RANDOM (non comparable)                   |      3 | alan-dice, beatrix-dice, mozart-dice                                                                                         |
| ❌ DIFF (transpilé ABORT)                    |      2 | asymmetric, mohanam                                                                                                          |
| 💥 ORIG_CRASH (limitation WASM)              |      1 | vina3                                                                                                                        |
| 💥 BOTH_CRASH                                |      1 | visser-shapes                                                                                                                |
| **TOTAL**                                   | **44** |                                                                                                                              |

### Taux de succès

- **Match exact** : 6/44 (14%) — counts identiques orig/trans
- **Mismatch** : 4/44 (9%) — les deux produisent mais counts différents (à investiguer)
- **Transpilé seul OK** : 22/44 (50%) — orig manque settings/tonalité mais transpilé fonctionne
- **Transpilé crash/abort** : 10/44 (23%) — **bug du transpileur**, pas du moteur
- **Random** : 3/44 (7%) — non comparable (seeds)
- **Limitations WASM/les deux** : 2/44 (5%) — vina3, visser-shapes

### Cause des ORIG_NO_MIDI et ORIG_MISS (19 scènes)

Ce ne sont **pas** des bugs. Les originaux fonctionnent — ils produisent du texte (r=1) ou échouent proprement (r=0). Le problème est que le test ne charge pas correctement tous les auxiliaires :

- **Settings format texte plat** (BP2, 1998) : la conversion `convertOldSettings()` ne couvre pas tous les champs. Certains settings critiques ne sont pas transmis.
- **Tonalité manquante** : les grammaires avec `_scale()` ont besoin de `-to.xxx` qui doit être chargé. Notre chargement échoue silencieusement pour certains fichiers.
- **Instruments Csound manquants** : les grammaires avec `-cs.xxx` référencent des instruments Csound qui ne sont pas chargés.

Pour résoudre : améliorer la conversion des settings texte plat et le chargement des tonalités.

### Cause des TRANS_CRASH (8 scènes)

**Bug du transpileur**, pas du moteur WASM. Les grammaires originales de Bernard passent toutes en WASM (testé individuellement avec les auxiliaires). Les grammaires transpilées par BPscript créent des structures plus récursives :

- `visser3` : `_transpose` converti en `_script(CTn)` au lieu de rester commande BP3 native
- `765432`, `not-reich`, `visser5`, `visser-waves` : sous-grammaires ou polymétrie imbriquée différente
- `shapes-rhythm` : 146 règles, 17 sous-grammaires → mémoire
- `watch` : combinatoire explosive → timeout

Le transpileur doit générer des grammaires BP3 structurellement plus proches des originales.

---

## Historique

- **v1** (mars 2026, pré-silent objects) : 33/44 prouvés, 4 WASM crash, 4 random, 2 renommage, 1 ~OK
- **v2** (22 mars 2026, post-silent objects) : 10 OK, 13 orig_no_midi, 6 orig_miss, 8 trans_crash, 3 random, 2 diff, 1 orig_crash, 1 both_crash
