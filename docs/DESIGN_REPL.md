# REPL Adapters — Architecture des backticks

## Vue d'ensemble

Les backticks permettent d'exécuter du code dans des runtimes externes
(SuperCollider, Python, Tidal, JS) depuis le flux temporel BPscript.

Le dispatcher produit deux sorties distinctes :
- **Transports** → données horodatées (freq, vel, durée) — précis, sans état
- **REPL adapters** → code à évaluer — best effort, état persistant

---

## Trois types de backticks

| Type | Syntaxe | Quand | Runtime |
|------|---------|-------|---------|
| **Orphelin** | `` `sc: SynthDef(...)` `` | avant la dérivation (init) | tag obligatoire |
| **Standalone** | `` `sc: i = i + 1` `` | au temps T dans le flux | tag obligatoire |
| **Inline** | `` Sa(vel:`rrand(40,127)`) `` | évalué pour obtenir une valeur | implicite (runtime du symbole → eval de l'acteur) |

---

## Interface REPL adapter

```js
{
  connect()                // ouvrir la session
  eval(code, time)         // envoyer du code au temps T (fire-and-forget)
  getValue(expr)           // évaluer et retourner une valeur (bloquant, avec timeout)
  close()                  // fermer la session
}
```

Chaque adapter implémente cette interface. ~100 lignes par langage.

---

## Décisions d'architecture (21 mars 2026)

> Ces décisions sont des choix initiaux, révisables si ça coince.

### 1. Protocole de communication

Trois modes selon le contexte :

| Mode | Usage | Mécanisme |
|------|-------|-----------|
| **stdin/stdout** | local (défaut) | subprocess pipe — universel, marche pour sclang, Python, ghci |
| **TCP** | distant / live | socket TCP — pour les sessions sur une autre machine |
| **WebSocket** | browser | WS vers un serveur — pour le cas navigateur → runtime distant |

Le mode est configuré dans `routing.json` (section `evals`).

### 2. Timing

Les backticks ne sont **pas** sample-accurate. C'est du "best effort" :
le dispatcher envoie légèrement en avance mais sans garantie de précision.

Le timing précis est le travail des **transports** (OSC bundles horodatés).
Les backticks sont pour la **logique** (compteurs, mutations, setup), pas
pour les notes.

### 3. getValue() — timeout et fallback

`getValue()` est bloquant avec un **timeout court (100ms)**.

Si le REPL ne répond pas à temps :
- Utiliser la dernière valeur connue (si disponible)
- Sinon, utiliser une valeur par défaut (0 ou chaîne vide)
- Logger un warning

**Optimisation future** : lookahead — le dispatcher pré-évalue les `getValue()`
quelques beats en avance pendant le playback courant.

### 4. Erreurs

**Skip + warning.** On n'arrête jamais la scène pour une erreur REPL.
Le flux temporel continue. L'erreur est loggée dans la console.

Pas de lien avec `on_fail` (qui est pour les échecs de dérivation BP3).

### 5. Sessions partagées

Une session par **clé d'eval**, pas par acteur.

```
@actor sitar1  ... eval:sclang
@actor sitar2  ... eval:sclang
@actor tabla   ... eval:python
```

→ **1** session sclang (partagée par sitar1 et sitar2), **1** session Python.

Les variables sont dans le même scope — c'est voulu. Cohérent avec le
principe : un runtime = une session = un scope.

Les runtimes sont lourds à lancer (sclang ~2s, Python ~0.5s). On ne
multiplie pas les instances.

### 6. Lifecycle

| Événement | Action |
|-----------|--------|
| Premier backtick avec ce tag | Démarrer la session (connect) |
| Backticks orphelins (init) | Exécuter avant le playback |
| Hot-reload (recompile) | **Garder** la session (SynthDefs, variables survivent) |
| Fermeture de la scène | Fermer la session (close) |

L'asymétrie est assumée : l'état structurel (flags BP3) repart de zéro
au hot-reload, l'état runtime (sessions REPL) persiste.

### 7. Sérialisation des retours

Le REPL renvoie du **texte** (stdout). Le dispatcher :
1. `parseFloat(response)` — si c'est un nombre
2. Sinon, garder la string brute et la passer telle quelle

Pas de sérialisation complexe (JSON, etc.) — les backticks-paramètres
retournent des valeurs simples (nombres, chaînes).

### 8. Browser

Le navigateur n'est **pas** limité à JS. Trois stratégies :

| Stratégie | Runtime | Mécanisme |
|-----------|---------|-----------|
| **Natif** | `js:` | `new Function()` — zéro dépendance |
| **WASM** | `sc:`, `py:` | supercollider.wasm, Pyodide — tout dans le navigateur |
| **WebSocket** | `sc:`, `py:`, `tidal:` | WS vers un serveur distant (sclang, Python, ghci) |

La stratégie est configurée dans `routing.json` :

```json
{
  "browser": {
    "evals": {
      "js":     { "type": "function" },
      "sc":     { "type": "websocket", "url": "ws://localhost:57120" },
      "python": { "type": "pyodide" }
    }
  }
}
```

Si un tag référence un eval non configuré → erreur explicite
("runtime 'tidal' not available in this environment").

---

## Flux d'exécution

```
Scène chargée
  │
  ├─ 1. Parser identifie les tags utilisés (sc, py, js...)
  │
  ├─ 2. Dispatcher démarre les sessions nécessaires (connect)
  │     │  sclang via stdin/stdout
  │     │  Python via stdin/stdout
  │     └  js via Function() (browser)
  │
  ├─ 3. Backticks orphelins → eval dans les sessions (setup)
  │     │  `sc: SynthDef(\grain, {...}).add`
  │     └  `py: import dmx; d = dmx.open()`
  │
  ├─ 4. BP3 dérive → séquence horodatée
  │
  └─ 5. Playback (boucle dispatcher)
        │
        │  Token "bolSa" + _script(CT0) {vel: `rrand(40,127)`}
        │    → getValue("rrand(40,127)") via session sclang
        │    → timeout 100ms
        │    → response "87"
        │    → parseFloat → 87
        │    → transport.send({ freq:240, vel:87, ... })
        │
        │  Token "backtick_sc_i=i+1" at T=1000ms
        │    → eval("i = i + 1", 1000) via session sclang
        │    → fire-and-forget
```

---

## Adapters à implémenter

| Adapter | Protocole | Priorité |
|---------|-----------|----------|
| `js` (browser) | `new Function()` | immédiat (existe déjà partiellement) |
| `sclang` | stdin/stdout ou TCP | haute |
| `python` | stdin/stdout | haute |
| `tidal` (ghci) | stdin/stdout ou TCP | moyenne |
| `pyodide` (browser) | WASM in-browser | basse |
| `sc.wasm` (browser) | WASM in-browser | basse |
