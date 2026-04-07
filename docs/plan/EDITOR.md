# Design — BPscript Editor (CodeMirror 6)

Version 1.0 — 7 avril 2026

## Objectif

Remplacer le `<textarea>` actuel par un vrai editeur de code base sur CodeMirror 6, avec :
- Coloration syntaxique BPscript
- Autocompletion contextuelle
- Widgets interactifs inline (sliders, dropdowns) sur les controles `()`
- Diagnostics temps reel (erreurs du parser soulignees)
- Binding bidirectionnel : modifier un widget modifie le code, modifier le code met a jour le widget

## Pourquoi CodeMirror 6

- **Lezer parser** : on a l'EBNF de BPscript, on ecrit un vrai parser (pas du regex)
- **Modulaire** : ~150 KB gzippe vs ~3 MB pour Monaco
- **Widgets inline** : API native `Decoration.widget()` / `Decoration.replace()`
- **ESM natif** : chargeable depuis CDN sans bundler (`esm.sh`)
- **MIT** : pas de contrainte licence

## Architecture

```
┌─────────────────────────────────────────────────┐
│  CodeMirror EditorView                          │
│  ┌───────────────────────────────────────────┐  │
│  │  Lezer parser (bpscript.grammar)          │  │
│  │  → syntax tree → coloration               │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  CompletionSource (bpsComplete)           │  │
│  │  → suggestions contextuelles              │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  ViewPlugin (controlWidgets)              │  │
│  │  → scanne les () → inline sliders         │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Linter (bpsLinter)                       │  │
│  │  → compileBPS() → diagnostics             │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         │                          ▲
         │ doc change               │ widget interaction
         ▼                          │
   compileBPS(source)          view.dispatch({changes})
         │
         ▼
   grammar + alphabet + controlTable → WASM → dispatcher
```

## Composants

### 1. Lezer grammar (`bpscript.grammar`)

Grammaire formelle pour le parser Lezer, derivee de `BPSCRIPT_EBNF.md`.

```lezer
@top Scene { (Directive | Rule | Comment | BlankLine)* }

Directive { "@" DirectiveName ("." DirectiveKey)? (":" Runtime)? }
Rule { Lhs Arrow Rhs }
Lhs { Symbol }
Arrow { "->" | "<-" | "<>" }
Rhs { RhsElement+ }

RhsElement {
  Symbol |
  Silence |
  Prolongation |
  Tie |
  Simultaneous |
  PolymetricGroup |
  ControlGroup |
  EngineInstruction |
  BacktickCode |
  FlagGuard |
  FlagMutation
}

Symbol { identifier OctaveSuffix? }
Silence { "-" }
Prolongation { "_" }
Tie { "~" }
Simultaneous { "!" }

ControlGroup { "(" ControlEntry ("," ControlEntry)* ")" }
ControlEntry { ControlName ":" ControlValue }

EngineInstruction { "[" EngineEntry ("," EngineEntry)* "]" }
EngineEntry { EngineName ":" EngineValue }

PolymetricGroup { "{" Rhs ("," Rhs)* "}" }

BacktickCode { "`" BacktickContent "`" }

FlagGuard { "[" FlagName FlagOp FlagValue "]" }
FlagMutation { "[" FlagName "=" FlagValue "]" }

@tokens {
  identifier { $[A-Za-z] $[A-Za-z0-9_#]* }
  OctaveSuffix { $[0-9]+ }
  DirectiveName { $[a-z] $[a-z0-9_]* }
  DirectiveKey { $[a-zA-Z0-9_]+ }
  Runtime { $[a-z]+ }
  ControlName { $[a-z] $[a-zA-Z0-9_]* }
  ControlValue { $[a-zA-Z0-9._\-]+ }
  EngineName { "mode" | "weight" | "speed" | "scale" | "on_fail" }
  FlagName { $[A-Za-z] $[A-Za-z0-9_]* }
  FlagOp { "==" | "!=" | ">=" | "<=" | ">" | "<" }
  FlagValue { $[0-9]+ }
  Comment { "//" ![\n]* }
  BacktickContent { ![\`]+ }
  space { $[ \t]+ }
  newline { "\n" }
  BlankLine { "\n" }
}

@skip { space }
```

**Compilation :** `lezer-generator bpscript.grammar -o bpscript-parser.js` (build time, fichier servi statiquement).

**Coloration :**
```javascript
import { styleTags, tags as t } from "@lezer/highlight"

const bpscriptHighlight = styleTags({
  Directive: t.keyword,
  DirectiveName: t.keyword,
  DirectiveKey: t.typeName,
  Runtime: t.string,
  Arrow: t.operator,
  Symbol: t.variableName,
  Silence: t.null,
  Prolongation: t.null,
  Tie: t.operator,
  ControlName: t.propertyName,
  ControlValue: t.number,
  EngineName: t.atom,
  EngineValue: t.number,
  FlagName: t.labelName,
  FlagOp: t.compareOperator,
  Comment: t.comment,
  BacktickCode: t.special(t.string),
  PolymetricGroup: t.bracket,
})
```

### 2. Autocompletion (`bpsComplete`)

Plusieurs `CompletionSource` composees dans `override[]` :

#### 2a. Directives

Apres `@` → propose les noms de directives connus.

```javascript
function directiveComplete(context) {
  const before = context.matchBefore(/@[\w.]*/);
  if (!before) return null;
  const text = before.text;

  if (text.includes('.')) {
    // Sous-cle : @alphabet.??? → western, sargam, solfege...
    const [, directive] = text.split('.');
    const options = getSubkeys(text.split('.')[0].slice(1)); // from libs
    return { from: before.from + text.indexOf('.') + 1, options };
  }

  return {
    from: before.from,
    options: [
      { label: "@core", detail: "load core library" },
      { label: "@controls", detail: "load control definitions" },
      { label: "@alphabet", detail: "load note alphabet" },
      { label: "@mode", detail: "derivation mode" },
      { label: "@mm", detail: "metronome BPM" },
      { label: "@tonality", detail: "load tonality file" },
      { label: "@timepatterns", detail: "time pattern definitions" },
      { label: "@octaves", detail: "octave convention" },
      { label: "@transcription", detail: "homomorphism table" },
    ]
  };
}
```

#### 2b. Controles runtime

Apres `(` → propose les noms de controles depuis `controls.json`.

```javascript
function controlComplete(context) {
  const before = context.matchBefore(/\(\s*[\w]*/);
  if (!before) return null;

  const controls = window._loadedLibs?.controls?.runtime;
  if (!controls) return null;

  const options = Object.entries(controls)
    .filter(([k]) => k !== '_comment')
    .map(([name, def]) => ({
      label: name,
      detail: def.range ? `${def.range[0]}–${def.range[1]}` : '',
      info: def.description,
      type: "property",
    }));

  const wordStart = before.text.lastIndexOf('(') + 1;
  return { from: before.from + wordStart, options };
}
```

#### 2c. Instructions engine

Apres `[` → propose `mode`, `weight`, `speed`, `scale`, `on_fail`.

#### 2d. Symboles declares

Apres `->` ou dans un RHS → propose les symboles deja declares comme LHS dans la scene.

```javascript
function symbolComplete(context) {
  const before = context.matchBefore(/\b[A-Z]\w*/);
  if (!before) return null;

  // Parse le document pour trouver tous les LHS
  const doc = context.state.doc.toString();
  const lhsNames = new Set();
  for (const line of doc.split('\n')) {
    const m = line.match(/^(\w+)\s*->/);
    if (m) lhsNames.add(m[1]);
  }

  return {
    from: before.from,
    options: [...lhsNames].map(name => ({ label: name, type: "variable" }))
  };
}
```

#### 2e. Notes de l'alphabet

Propose les notes disponibles selon l'alphabet charge (`@alphabet.western` → C4, D4, E4...).

### 3. Widgets inline (`controlWidgets`)

Un `ViewPlugin` scanne le document visible, detecte les `(name:value)` et place un widget interactif apres chaque valeur.

#### Architecture

```javascript
const controlWidgets = ViewPlugin.fromClass(class {
  decorations;

  constructor(view) {
    this.decorations = this.build(view);
  }

  update(update) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.build(update.view);
    }
  }

  build(view) {
    const widgets = [];
    const controls = window._loadedLibs?.controls?.runtime;
    if (!controls) return Decoration.set([]);

    // Scan visible ranges for (name:value) patterns
    for (const { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      const re = /\((\w+):([^)]+)\)/g;
      let m;
      while ((m = re.exec(text))) {
        const name = m[1];
        const value = m[2];
        const def = controls[name];
        if (!def) continue;

        const valueFrom = from + m.index + name.length + 2; // after "("  + name + ":"
        const valueTo = valueFrom + value.length;

        widgets.push(
          Decoration.widget({
            widget: new ControlWidget(name, value, def, valueFrom, valueTo),
            side: 1  // after the closing paren
          }).range(from + m.index + m[0].length)
        );
      }
    }
    return Decoration.set(widgets, true);
  }
}, { decorations: v => v.decorations });
```

#### Widgets par type de controle

```javascript
class ControlWidget extends WidgetType {
  constructor(name, value, def, valueFrom, valueTo) {
    super();
    this.name = name;
    this.value = value;
    this.def = def;
    this.valueFrom = valueFrom;
    this.valueTo = valueTo;
  }

  toDOM(view) {
    if (this.def.values) {
      return this.buildDropdown(view);
    }
    if (this.def.range) {
      return this.buildSlider(view);
    }
    return this.buildNumberInput(view);
  }

  buildSlider(view) {
    const [min, max] = this.def.range;
    const wrap = document.createElement("span");
    wrap.className = "cm-ctrl-widget";
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.value = this.value;
    input.addEventListener("input", () => {
      // Bidirectional: slider modifies the source code
      view.dispatch({
        changes: { from: this.valueFrom, to: this.valueTo, insert: input.value }
      });
    });
    wrap.appendChild(input);
    return wrap;
  }

  buildDropdown(view) {
    const select = document.createElement("select");
    select.className = "cm-ctrl-widget";
    for (const v of this.def.values) {
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = v;
      if (v === this.value) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => {
      view.dispatch({
        changes: { from: this.valueFrom, to: this.valueTo, insert: select.value }
      });
    });
    return select;
  }

  buildNumberInput(view) {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "cm-ctrl-widget";
    input.value = this.value;
    input.addEventListener("input", () => {
      view.dispatch({
        changes: { from: this.valueFrom, to: this.valueTo, insert: input.value }
      });
    });
    return input;
  }

  eq(other) {
    return this.name === other.name && this.value === other.value;
  }
}
```

**Comportement :**
- Le slider apparait juste apres le `)` de chaque `(vel:80)`
- Bouger le slider modifie le `80` dans le code source
- Le changement de code declenche une recompilation (en mode Live, hot-swap automatique)
- Pas de slider pour les controles sans range (script, switchon, etc.)

### 4. Diagnostics (`bpsLinter`)

Le linter appelle le transpileur existant et mappe les erreurs sur les positions du document.

```javascript
import { linter } from "@codemirror/lint"

const bpsLinter = linter((view) => {
  const source = view.state.doc.toString();
  if (!window._compileBPScript) return [];

  const compiled = window._compileBPScript(source);
  return compiled.errors.map(err => {
    // Map line number to document position
    const line = view.state.doc.line(Math.min(err.line, view.state.doc.lines));
    return {
      from: line.from,
      to: line.to,
      severity: "error",
      message: err.message,
    };
  });
}, { delay: 500 }); // debounce 500ms
```

### 5. Cascade des controles (4 niveaux)

L'editeur visualise la cascade de specificite :

| Niveau | Source | Visualisation dans l'editeur |
|--------|--------|------------------------------|
| **1. Global** | `controls.json` defaults | Valeur grisee dans le tooltip du widget (fallback) |
| **2. Transport** | `@alphabet.xxx:browser/midi` | Badge colore sur la directive `@alphabet` |
| **3. Inline** | `(vel:80)` dans le code | **Slider interactif** apres le `)` |
| **4. Library** | sounds/*.json, alphabet.json | Icone info sur les symboles qui heritent |

Le widget inline (niveau 3) est le seul directement editable.
Les niveaux 1-2 sont editables via le panneau Controls (existant).
Le niveau 4 est informatif (tooltip au survol d'un terminal).

### 6. Integration dans l'UI existante

#### Chargement (sans bundler)

```html
<script type="module">
  import { EditorView, basicSetup } from "https://esm.sh/@codemirror/basic-setup"
  import { EditorState } from "https://esm.sh/@codemirror/state"
  import { autocompletion } from "https://esm.sh/@codemirror/autocomplete"
  import { linter } from "https://esm.sh/@codemirror/lint"

  // Custom BPscript extensions
  import { bpscriptLanguage } from "./editor/bpscript-lang.js"
  import { controlWidgets } from "./editor/control-widgets.js"
  import { bpsLinter } from "./editor/bps-linter.js"
  import { bpsComplete } from "./editor/bps-complete.js"

  const editor = new EditorView({
    state: EditorState.create({
      doc: document.getElementById('bpscript').value,
      extensions: [
        basicSetup,
        bpscriptLanguage,
        autocompletion({ override: [bpsComplete] }),
        controlWidgets,
        bpsLinter,
        bpscriptTheme,  // dark theme matching existing UI
      ]
    }),
    parent: document.getElementById('panel-bpscript')
  });
</script>
```

#### Remplacement du textarea

Le `<textarea id="bpscript">` est remplace par un `<div>` conteneur.
L'API pour lire/ecrire le contenu change :

```javascript
// Avant (textarea)
document.getElementById('bpscript').value
document.getElementById('bpscript').value = newSource

// Apres (CodeMirror)
editor.state.doc.toString()
editor.dispatch({
  changes: { from: 0, to: editor.state.doc.length, insert: newSource }
})
```

Un adaptateur `getEditorSource()` / `setEditorSource(text)` isole ce changement.

#### Theme sombre

```javascript
const bpscriptTheme = EditorView.theme({
  "&": { backgroundColor: "#0d1b2a", color: "#e0e0e0" },
  ".cm-content": { fontFamily: "'Consolas', 'Courier New', monospace", fontSize: "13px" },
  ".cm-gutters": { backgroundColor: "#0d1b2a", borderRight: "1px solid #0f3460" },
  ".cm-activeLineGutter": { backgroundColor: "#16213e" },
  ".cm-activeLine": { backgroundColor: "#16213e44" },
  ".cm-cursor": { borderColor: "#e94560" },
  ".cm-selectionBackground": { backgroundColor: "#0f346066" },
  // Syntax colors
  ".cm-keyword": { color: "#e94560" },       // directives @
  ".cm-operator": { color: "#ff6b8a" },       // arrows ->, flags
  ".cm-variableName": { color: "#e0e0e0" },   // symbols
  ".cm-propertyName": { color: "#4a90d9" },    // control names
  ".cm-number": { color: "#00ff88" },          // values
  ".cm-comment": { color: "#555", fontStyle: "italic" },
  ".cm-string": { color: "#e9a845" },          // backtick code
  // Inline widgets
  ".cm-ctrl-widget": {
    display: "inline-block", verticalAlign: "middle", marginLeft: "4px",
  },
  ".cm-ctrl-widget input[type=range]": {
    width: "60px", height: "4px", accentColor: "#e94560",
  },
  ".cm-ctrl-widget select": {
    background: "#16213e", color: "#e0e0e0", border: "1px solid #0f3460",
    borderRadius: "3px", fontSize: "11px", padding: "1px 4px",
  },
})
```

## Fichiers

```
web/
  editor/
    bpscript.grammar      Lezer grammar source (build time)
    bpscript-parser.js     Lezer parser compiled (generated)
    bpscript-lang.js       LanguageSupport + highlight
    bps-complete.js        Autocompletion sources
    control-widgets.js     ViewPlugin + ControlWidget
    bps-linter.js          Diagnostics from transpiler
    bps-theme.js           Dark theme
  index.html               Updated: div instead of textarea
```

## Phases d'implementation

### Phase A — Editeur de base (remplace textarea)

- CodeMirror 6 charge depuis CDN (esm.sh)
- Theme sombre coherent avec l'UI
- Pas encore de coloration BPscript, juste l'editeur
- Adaptateur `getEditorSource()` / `setEditorSource()`
- Tous les appels existants migres

### Phase B — Coloration syntaxique

- Grammaire Lezer ecrite et compilee
- Coloration par type de token (directive, rule, symbol, control, comment)
- Fold regions sur les sous-grammaires

### Phase C — Autocompletion

- Directives `@` avec sous-cles
- Controles `()` depuis controls.json
- Instructions `[]` depuis controls.json
- Symboles declares (LHS)
- Notes de l'alphabet charge

### Phase D — Widgets inline

- Sliders sur les `(vel:80)`, `(pan:64)`, etc.
- Dropdowns sur `(wave:triangle)`
- Number inputs sur `(transpose:5)`, `(rotate:2)`
- Binding bidirectionnel code ↔ widget

### Phase E — Diagnostics

- Erreurs du transpileur soulignees en rouge
- Warnings en jaune
- Hover → message d'erreur

## Dependances et risques

| Risque | Mitigation |
|--------|------------|
| CDN indisponible | Fallback : servir les modules localement dans `web/vendor/` |
| Lezer grammar complexe | Commencer par un subset (directives + rules + controls), iterer |
| Performance des widgets | ViewPlugin ne scanne que le viewport visible |
| Positions decalees apres edit | `Decoration.set()` rebuild complet sur docChanged |

## References

- [CodeMirror 6](https://codemirror.net/docs/)
- [Lezer](https://lezer.codemirror.net/)
- [BPSCRIPT_EBNF.md](BPSCRIPT_EBNF.md) — grammaire formelle BPscript
- [PLAN_UI_WEB.md](PLAN_UI_WEB.md) — plan UI global (Phase 1 Controls)
