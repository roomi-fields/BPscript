# REPL Adapters — Architecture des backticks

> Voir aussi : [DESIGN_LANGUAGE.md](../spec/LANGUAGE.md) pour la syntaxe des backticks dans le langage,
> [DESIGN_ARCHITECTURE.md](ARCHITECTURE.md) pour le pipeline transports vs REPL adapters.

## Vue d'ensemble

Les backticks permettent d'exécuter du code dans des interpréteurs externes
(`sc`, `py`, `tidal`, `strudel`, `js`) depuis le flux temporel BPScript.
Un backtick autonome est un **terminal de plein droit** : il occupe une position
dans le flux au même titre qu'une note (cf. EBNF §4.13, `BacktickStandalone`).

Le dispatcher produit deux sorties distinctes :
- **Transports** → données horodatées (freq, vel, durée) — précis, sans état
- **REPL adapters** → code à évaluer — best effort, état persistant

---

## Trois types de backticks

| Type | Syntaxe | Quand | Interpréteur |
|------|---------|-------|--------------|
| **Orphelin** | `` `sc: SynthDef(...)` `` | avant la dérivation (init) | tag obligatoire |
| **Standalone** | `` `sc: i = i + 1` `` | au temps T dans le flux — **terminal de plein droit** | tag obligatoire |
| **Inline** | `` Sa(vel:`rrand(40,127)`) `` | capture d'une valeur calculée (dans un paramètre) | implicite (`eval.` de l'acteur courant) |

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

### 3. Deux mécanismes de capture distincts

#### (i) getValue() — capture d'une valeur calculée

Utilisé pour les **backticks inline** (dans un paramètre) : le dispatcher évalue
l'expression dans l'interpréteur et récupère une valeur scalaire (nombre ou chaîne)
qui alimente le contrôle en cours (ex. `vel:`, `freq:`…).

`getValue()` est bloquant avec un **timeout court (100ms)**.

Si le REPL ne répond pas à temps :
- Utiliser la dernière valeur connue (si disponible)
- Sinon, utiliser une valeur par défaut (0 ou chaîne vide)
- Logger un warning

**Optimisation future** : lookahead — le dispatcher pré-évalue les `getValue()`
quelques beats en avance pendant le playback courant.

#### (ii) Capture-pour-retransport — ÉCARTÉ (décision Romain 2026-07-14)

Anciennement envisagé : capter la **sortie** d'un interpréteur (Strudel, Tidal…) pour la router vers
notre `transport`. **Abandonné** par le modèle producteur/canal : un `eval.<X>` est un producteur
embarqué autonome qui **sort en natif** (audio/canvas propres) — on ne reroute pas ses sorties déjà
synthétisées (usine à gaz). Seul le producteur défaut `js` produit dans notre environnement et utilise
notre `transport`. `getValue()` (capture d'une **valeur** calculée) reste, lui, valide. Cf.
`docs/design/ACTOR.md` §1-2 et `hub/decisions/2026-07-14-modele-producteur-canal-eval-transport.md`.

### 4. Erreurs

**Skip + warning.** On n'arrête jamais la scène pour une erreur REPL.
Le flux temporel continue. L'erreur est loggée dans la console.

Pas de lien avec `on_fail` (qui est pour les échecs de dérivation BP3).

### 5. Sessions partagées

Une session par **interpréteur** (`eval.`), pas par acteur.

```
@actor sitar1  ... eval.sc
@actor sitar2  ... eval.sc
@actor tabla   ... eval.python
```

→ **1** session `sc` (partagée par sitar1 et sitar2), **1** session `python`.

Les variables sont dans le même scope — c'est voulu. Cohérent avec le
principe : un runtime = une session = un scope.

Les runtimes sont lourds à lancer (sclang ~2s, Python ~0.5s). On ne
multiplie pas les instances.

### 6. Lifecycle

| Événement | Action |
|-----------|--------|
| Premier backtick avec cet interpréteur (`eval.`) | Démarrer la session (connect) |
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

| Stratégie | Interpréteur | Mécanisme |
|-----------|--------------|-----------|
| **Natif** | `js` | `new Function()` — zéro dépendance |
| **WASM** | `sc`, `py` | supercollider.wasm, Pyodide — tout dans le navigateur |
| **WebSocket** | `sc`, `py`, `tidal` | WS vers un serveur distant (sclang, Python, ghci) |

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

Si un tag référence un interpréteur non configuré → erreur explicite
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
        │  Token "bolSa" + _script(CT 0) {vel: `rrand(40,127)`}
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
