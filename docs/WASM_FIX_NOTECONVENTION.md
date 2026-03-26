# WASM Fix — NoteConvention et detection de notation

Date: 2026-03-24

## Contexte

Plusieurs problemes rapportes autour de NoteConvention dans le portage WASM :
- "NoteConvention=1 crashe le WASM"
- "livecode2 (notation francaise) produit 0 tokens"
- "toute grammaire avec NoteConvention=1 crashe"

## Investigation

### Ce qui a ete teste

| Cas | NoteConv | Notation | Resultat |
|-----|----------|----------|----------|
| `do4 re4 mi4` | 1 (FR) | francaise | OK, 3 tokens + timings |
| `{_legato(20) do4 re4 mi4, ...}` | 1 (FR) | francaise | OK |
| livecode2 (grammaire Bernard) | 1 (FR) | francaise | **OK, 30 tokens** |
| `C4 D4 E4` | 0 (EN) | anglaise | OK |
| tryGraphics, drum, ek-do-tin... | 0 (EN) | anglaise | OK |
| `C4 D4 E4` simple | 1 (FR) | anglaise (mismatch) | OK (bols custom) |
| `{_legato C4 D4, _staccato F#5, - G4}` | 1 (FR) | anglaise (mismatch) | **crash TimeSet** |

### Conclusion

**Le crash ne se produit PAS en usage coherent** (convention = notation).

Le crash se produit uniquement quand NoteConvention=1 (francais) est utilise
avec des noms de notes anglais (C4, D4...) dans une expression polymetrique
complexe avec `_legato`/`_staccato`. C'est un cas de mismatch qui n'arrive
pas en production.

## Origine des problemes rapportes

### 1. "livecode2 produit 0 tokens"

Le script `s2_wasm_orig.cjs` forcait `NoteConvention=0` pour toutes les grammaires
(ligne 34). Avec NoteConvention=0, les noms francais (`do4`, `re4`, `la2`) ne sont
pas reconnus comme des notes → 0 tokens ou tokens sans timings.

**Fix** : passer `NoteConvention=1` pour les grammaires francaises. Le moteur
reconnait alors correctement les noms.

### 2. "NoteConvention=1 crashe"

Probablement observe en testant une grammaire anglaise (comme tryGraphics) avec
NoteConvention=1 — c'est un mismatch convention/notation. Le crash vient de
`FillPhaseDiagram.c:622` (code Bernard, 2026-03-20) qui convertit les variables
non resolues en silent sound-objects, ce qui corrompt le phase diagram.

Le natif ne crashe pas car il n'appelle pas TimeSet en mode console (`produce -D`).
Le WASM appelle toujours TimeSet pour extraire les timed tokens.

**Fix defensif** : guard T4 dans `PlayBuffer1` (bp3_wasm_stubs.c). Si le buffer
expanse contient des tokens T4 (variables non resolues), TimeSet est skippe.
Le texte reste correct, les timed tokens sont vides.

### 3. Confusion avec le bug RNG (look-and-say)

Certains symptomes (0 tokens, resultats differents du natif) etaient causes par
le RNG incompatible (musl vs glibc) et le seeding decale. Corrige separement
(voir WASM_FIX_RNG.md).

## Detection automatique de la convention

Le moteur BP3 detecte la convention de notation PENDANT la compilation de la
grammaire. Meme avec `NoteConvention=0`, si la grammaire contient `do4 re4`,
le compilateur peut les reconnaitre.

Cependant, le plus fiable est de passer la bonne convention AVANT la compilation :

```javascript
// Grammaire francaise
bp3_load_settings_params(1, 10, 10, 1, 1, 60);  // NoteConvention=1
bp3_load_grammar(grammaireFR);

// Grammaire anglaise
bp3_load_settings_params(0, 10, 10, 1, 1, 60);  // NoteConvention=0
bp3_load_grammar(grammaireEN);
```

Le settings file de la grammaire (`-se.xxx`) contient normalement la bonne
convention. Dans le pipeline de test, il faut la lire et la passer.

## Fichiers modifies

- `wasm/bp3_wasm_stubs.c` : guard T4 dans PlayBuffer1 (defensif)
- `Compute.c` : non modifie
- `FillPhaseDiagram.c` : non modifie (bug Bernard, contourne cote WASM)

## Comment tester

```bash
# Grammaire francaise — doit produire des tokens
node -e "
  process.chdir('dist');
  require('./bp3.js')().then(M => {
    var init=M.cwrap('bp3_init','number',[]);
    var SP=M.cwrap('bp3_load_settings_params','number',['number','number','number','number','number','number']);
    var gr=M.cwrap('bp3_load_grammar','number',['string']);
    var prod=M.cwrap('bp3_produce','number',[]);
    var res=M.cwrap('bp3_get_result','string',[]);
    init(); SP(1,10,10,1,1,60);
    gr('RND\ngram#1[1] S --> do4 re4 mi4');
    prod(); console.log(res());
  });
"
# Attendu: "do4 re4 mi4"
```
