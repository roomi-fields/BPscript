# WASM Issue — Chargement des fichiers auxiliaires

Date: 2026-03-24
Statut: en cours

## Probleme

Le moteur BP3 natif resout automatiquement les dependances fichiers
referees dans les grammaires (-ho., -mi., -se., -or., -tb., -in., -gl.).
Le ConsoleMain natif parse les headers de la grammaire et charge chaque
fichier depuis le filesystem.

En WASM, le filesystem est vide. Les fichiers doivent etre fournis via
l'API avant la compilation de la grammaire.

## APIs existantes

| Type | API WASM | Statut |
|------|----------|--------|
| -se. (settings) | `bp3_load_settings_params()` | OK (6 params sur 84) |
| -al. (alphabet simple) | `bp3_load_alphabet()` | OK |
| -to. (tonalite) | `bp3_load_tonality()` | OK |
| -cs. (Csound resources) | `bp3_load_csound_resources()` | Hang sur certains |
| -mi. (prototypes MIDI) | `bp3_load_object_prototypes()` | Ajoutee, needs debug |

## API generique ajoutee

`bp3_provision_file(filename, content)` — ecrit un fichier dans le FS
Emscripten a la racine "/". Le moteur peut le trouver via fopen().

Utile pour :
- `-mi.xxx` (references depuis les `-ho.`)
- `-or.xxx` (orchestra)
- `-tb.xxx` (time base)
- `-in.xxx` (interactive MIDI)
- `-gl.xxx` (glossary)

## Probleme en cours : format -ho. (homomorphism)

Les fichiers `-ho.` ont un header :
```
V.2.5
Date: Sun, May 21, 1995 -- 10:18
-mi.dhati
*
dha --> ta
ti --> ti
...
```

`bp3_load_alphabet()` passe ce contenu a `TEH[wAlphabet]`.
`CompileAlphabet()` → `ReadAlphabet()` echoue sur `Date:` car `:` n'est pas
un caractere valide dans un nom de bol.

Le natif v3.3.17 de Bernard gere ce header sans erreur, probablement grace
a des modifications dans CompileGrammar.c qui ne sont pas dans notre copie
(notre csrc/bp3/CompileGrammar.c vient de v3.3.16 upstream).

### Solutions possibles

1. **Obtenir le CompileGrammar.c v3.3.17 de Bernard** — le plus propre
2. **Stripper le header** dans le test script avant de passer a loadAl()
3. **Unifier les sources** : faire pointer le Makefile vers source/BP3/
   au lieu de csrc/bp3/

## Chaine complete pour une grammaire avec -ho.

Exemple : dhati = `-gr.dhati` + `-ho.dhati` + `-mi.dhati`

```javascript
// 1. Provisionner -mi dans le FS (avant tout)
bp3_provision_file('-mi.dhati', miContent);

// 2. Charger l'alphabet (-ho, potentiellement strippe du header)
bp3_load_alphabet(hoContent);

// 3. Charger les settings
bp3_load_settings_params(noteConv, quant, timeRes, nature, seed, maxTime);

// 4. Charger la grammaire
bp3_load_grammar(grContent);

// 5. Produire
bp3_produce();
```

## Impact par type de fichier

| Type | Grammaires | Bloqueur | Solution |
|------|------------|----------|----------|
| -mi. (via -ho.) | ~15 | **Oui** pour S2 | provision_file + header strip |
| -or. (orchestra) | 7 | Non critique | provision_file |
| -tb. (time base) | 3 | Non critique | provision_file |
| -in. (interactive) | 6 | Non (pas de MIDI input en WASM) | N/A |
| -gl. (glossary) | 1 | Non critique | loadAl ou provision |

## Fichiers modifies

- `wasm/bp3_api.c` : `bp3_provision_file()` et `bp3_load_object_prototypes()`
- `wasm/bp3_wasm_stubs.c` : stub `ChangedProtoType()`
- `wasm/Makefile.emscripten` : exports mis a jour

## Point critique : unification des sources

`csrc/bp3/` (branche wasm) et `source/BP3/` (branche graphics-for-BP3)
sont deux copies des memes sources C qui divergent. Chaque update de
Bernard necessite une synchronisation manuelle.

**Recommandation** : modifier le Makefile.emscripten pour pointer vers
`source/BP3/` directement, ou automatiser la sync.
