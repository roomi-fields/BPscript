# SCENES.md — Hiérarchie de scènes : modèle de communication

> Référencé par [LANGUAGE.md](../spec/LANGUAGE.md) §Scenes et le contrat moteur [BPx ENGINE_SPEC.md](../../../BPx/docs/ENGINE_SPEC.md) §6 (FlagStore) / §7 (TriggerBus) / §10 (orchestration).
>
> Précise : cycle de vie des scènes, scoping des flags, propagation des triggers, sémantique de `@map`, commandes `sys`, orchestration multi-instance, hot-swap.

---

## 1. Principe — modèle multi-instance

Chaque scène est une **Session BPx autonome** : son propre buffer, son propre arbre, son propre FlagStore, son propre RNG, son propre TriggerBus local. Aucune session ne tient de référence directe à une autre.

La communication passe par **trois mécaniques** et trois seulement :

| Mécanique    | Quoi                                      | Persistance  |
| ------------ | ----------------------------------------- | ------------ |
| **Flags**    | État partagé, lu par les guards           | Persistant   |
| **Triggers** | Événements ponctuels (synchro)            | Instantané   |
| **`@map`**   | Pont I/O externe ↔ langage (CC, OSC, sys) | Selon source |

Le `SceneOrchestrator` est **application-level** : il consomme l'API publique de BPx (Session, FlagStore, TriggerBus, commands) pour composer plusieurs sessions. **Il n'est pas dans le moteur BPx** — un utilisateur peut écrire son propre orchestrateur sans toucher BPx.

```
┌──────────────────────────────────────────────────────────┐
│        SceneOrchestrator  (application-level)            │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────┐  │
│  │  Session root  │  │  Session verse │  │  Session   │  │
│  │  (BPx core)    │  │  (BPx core)    │  │  chorus    │  │
│  │  flags│trigger │  │  flags│trigger │  │  flags│tr. │  │
│  └───────┬────────┘  └────────┬───────┘  └──────┬─────┘  │
│          │                    │                 │        │
│          └──────── routing table ────────────────┘       │
│                  (built from @scene,                     │
│                   @expose, @map directives)              │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Cycle de vie

### 2.1 Chargement — eager

Tous les fichiers `.bps` référencés par `@scene` sont parsés et leurs Sessions instanciées **au démarrage**. Validation complète avant playback ; pas de hiccup au premier `@scene` rencontré.

### 2.2 Identité — singleton par fichier

`@scene verse "verse.bps"` crée **une** Session unique. Si plusieurs parents y font référence, ils référencent la même Session (singleton). Multi-instance d'une même scène = v2 si besoin.

### 2.3 Dérivation — tic global, ordre topologique

Toutes les sessions coexistent comme instances autonomes. À chaque tic du dispatcher :

1. Le dispatcher fait avancer **toutes** les sessions
2. Dans l'ordre topologique : **parents avant enfants** (pour que les flags propagés soient visibles aux enfants au moment de leur dérivation)
3. Synchrone-ordonné, **pas d'attente d'achèvement** entre sessions

Le terminal `verse` dans la grammaire du parent est une **référence/déclaration de dépendance**, pas une descente d'appel. Le parent ne « lance » pas la dérivation de l'enfant — l'enfant tourne déjà, indépendamment.

> **Point ouvert** : que se passe-t-il exactement quand le parent consomme un token de type scène (le token `verse` apparaît dans sa séquence dérivée) ? Sémantique runtime à arrêter avant code.

### 2.4 État

L'état d'une session **persiste entre activations**. Si la scène n'est pas active dans le cycle courant (ex : parent dérive un sous-arbre qui ne la référence pas), son FlagStore et son RNG conservent leur état pour la prochaine activation.

`sys.reset` réinitialise FlagStore + RNG à leur état initial.

### 2.5 Destruction

Session détruite quand :
- Son fichier source est retiré du parent (commande live coding)
- Le parent lui-même est détruit
- `sys.destroy` explicite

À la destruction : ses subscriptions au routing sont retirées.

---

## 3. Scoping des flags

### 3.1 Règle absolue : un FlagStore par session

Chaque session a son propre FlagStore. Pas de partage de référence entre sessions.

### 3.2 Lecture parent → enfant

Un enfant peut **lire** un flag du parent. La sémantique observable est : `verse.flags.get('mood')` retourne la valeur courante de `mood` dans le parent (ou 0 si absente).

L'implémentation est libre :
- **Parent chain in-memory** : `_parent: FlagStore | null`, lookup remontant la chaîne (rapide, simple v1)
- **Event-based au tic** : l'orchestrateur copie les flags propagés dans le FlagStore enfant à chaque tic (sérialisable, prêt pour Worker/Rust subprocess)

Tant que la sémantique observable est respectée, les deux sont équivalents pour BPscript.

> **Point ouvert** : choix d'implémentation non arrêté. Trade-off entre simplicité v1 (parent chain) et portabilité Worker/Rust (event-based). À trancher avant d'écrire le FlagStore. Voir aussi §10 et `BPx ENGINE_SPEC.md §6` (FlagStore).

### 3.3 Écriture — locale uniquement

Une mutation `[x=N]` dans la grammaire d'une scène modifie **son** FlagStore. Jamais propagée au parent ou aux enfants implicitement.

### 3.4 `@expose` — bottom-up opt-in

```
@expose [intensity]
```

Whitelist explicite : seul un flag exposé par l'enfant est visible en lecture par le parent. Sans `@expose`, les flags enfants sont strictement privés.

### 3.5 Conflits de nom — erreur compile

Si parent et enfant déclarent tous deux un flag de même nom (utilisé localement dans un guard ou un set), c'est une erreur de compilation. Résolution : renommer dans l'un, ou retirer la déclaration côté parent (qui héritera via `@expose` côté enfant).

### 3.6 Isolation siblings

Deux scènes sœurs ne se voient pas directement. Pour qu'`intensity` de `verse` soit visible par `chorus` : `verse @expose [intensity]` → parent reçoit → `chorus` lit via parent.

### 3.7 CV ≠ flags

Les Control Variables (objets temporels continus, cf. [CV.md](CV.md)) sont des **tables propres à chaque scène**, **non héritées**. Une CV `lfo1` dans `verse` n'est pas visible dans `chorus` ni dans le parent. Pas d'analogue `@expose` pour les CV.

### 3.8 Tableau de visibilité

| Source           | Cible    | Mécanisme                     | Direction |
| ---------------- | -------- | ----------------------------- | --------- |
| Parent           | Enfant   | Routing automatique des flags | Lecture   |
| Enfant           | Parent   | `@expose` explicite           | Lecture   |
| Enfant A         | Enfant B | Via parent (expose + relais)  | Indirecte |
| Externe (CC/OSC) | Scène    | `@map cc:N -> [flag]`         | Lecture   |
| Scène            | Externe  | `@map [flag] -> cc:N`         | Émission  |

---

## 4. Triggers cross-scene

### 4.1 Scope local strict par défaut

`!sync` émis dans `verse` est visible **uniquement** dans `verse`. `<!sync` n'écoute **que** les `!sync` émis localement. Pas de broadcast implicite.

### 4.2 Préfixes pour cross-scene

| Syntaxe        | Cible                                     |
| -------------- | ----------------------------------------- |
| `!sync`        | scène locale uniquement                   |
| `!parent.sync` | scène parente directe                     |
| `!verse.sync`  | scène nommée (résolue par l'orchestrateur)|
| `!*.sync`      | broadcast aux enfants directs             |
| `!**.sync`     | broadcast récursif aux descendants        |

Idem pour la souscription (`<!parent.sync`, `<!*.ready`, etc.).

### 4.3 Émission préfixée

Un trigger émis avec un préfixe **n'apparaît pas localement** — il sort directement vers la cible. Pour émettre à la fois local et cross-scene, deux instructions séparées.

### 4.4 Triggers sans guards

Un trigger est un **signal pur**. Il n'a pas de guards — il est conditionné uniquement par les règles qui le produisent. La logique conditionnelle vit dans la grammaire qui décide d'émettre, pas sur le trigger lui-même.

### 4.5 Pas de protection anti-cycle

Si l'utilisateur écrit une grammaire produisant des triggers cycliques (parent émet → enfant réagit → parent re-réagit), c'est sa responsabilité (BP3 ne protège pas non plus). Détection automatique = v2 si demande pratique.

### 4.6 Émission externe

Depuis JS : `instance.emitTrigger(name, payload?)`. Permet à l'UI, à un message MIDI, à un event WebSocket de déclencher des triggers comme s'ils étaient émis dans la grammaire.

### 4.7 Sémantique batch vs streaming

| Mode                  | `<!trigger`                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| **Batch** (`derive`)  | Enregistré comme événement dans le DerivationTree. La dérivation continue. Le dispatcher gère l'attente au playback. |
| **Streaming**         | La dérivation se suspend. `triggerBus.wait(name)` retourne une Promise résolue à l'émission.         |

---

## 5. `@map` — routage I/O

### 5.1 Endpoints

| Endpoint               | Source                  | Cible                         |
| ---------------------- | ----------------------- | ----------------------------- |
| `cc:N`                 | Input MIDI CC           | Output MIDI CC                |
| `osc:/path`            | Input OSC               | Output OSC                    |
| `[flag]`               | —                       | Flag local R/W                |
| `<!trigger`            | —                       | Trigger entrant local         |
| `!trigger`             | Trigger sortant         | —                             |
| `sys.cmd`              | (selon cmd, cf. §6)     | (selon cmd)                   |
| `verse.X`              | (selon X)               | (selon X)                     |
| `IDENT` (alias)        | Source aliasée          | Cible aliasée                 |
| `IDENT.IDENT` (label)  | —                       | Tous éléments labellisés      |

### 5.2 Multicast par labels

```
S -> C4@kick D4 E4@kick F4
@map cc:1 -> kick.vel
```

Tous les éléments `@kick` reçoivent simultanément. Scope par défaut : la scène où `@map` est déclaré. Préfixe pour cross-scene (`verse.kick.vel`, `*.kick.vel`).

### 5.3 Bidirectionnel `<->`

```
@map cc:1 <-> [intensity]
```

- cc:1 reçoit une valeur externe → `[intensity]` mis à jour
- `[intensity]` modifié dans la dérivation → cc:1 émis vers l'externe

**Rupture d'écho automatique** au runtime (chaque update porte une origine implicite, le retour est court-circuité). Pas de loop infini.

### 5.4 Direction `sys.X`

Pour `sys.tempo`, `sys.beat`, `sys.bar` : la direction est fixée par le sens de l'arrow `@map`.

```
@map cc:7 -> sys.tempo         // CC pilote le tempo (commande)
@map sys.beat -> osc:/vis/beat // chaque beat émis vers OSC (état)
```

Pour `sys.play`, `sys.stop`, etc. : commande uniquement (cf. §6).

---

## 6. Commandes système (`sys`)

### 6.1 Liste

| Commande                 | Direction          | Effet                                       |
| ------------------------ | ------------------ | ------------------------------------------- |
| `sys.play`               | cible              | Démarre/reprend la dérivation et le streaming |
| `sys.stop`               | cible              | Arrête, libère le buffer, reset cursor      |
| `sys.pause`              | cible              | Suspend (préserve buffer + cursor)          |
| `sys.resume`             | cible              | Sortie de pause                             |
| `sys.loop`               | cible              | Mode loop : redémarre à la fin              |
| `sys.restart`            | cible              | Stop + play depuis le début                 |
| `sys.reset`              | cible              | Réinitialise FlagStore + RNG (seed initial) |
| `sys.mute` / `unmute`    | cible              | Coupe/rétablit l'émission de tokens         |
| `sys.solo` / `unsolo`    | cible              | Coupe les sœurs                             |
| `sys.hotswap`            | cible              | Recharge la grammaire depuis le fichier     |
| `sys.destroy`            | cible              | Détruit la session                          |
| `sys.tempo`              | source ou cible    | Tempo BPM (lu ou piloté selon `@map`)       |
| `sys.beat`               | source             | Émis à chaque beat (depuis la clock)        |
| `sys.bar`                | source             | Émis à chaque mesure (depuis la clock)      |

### 6.2 Adressage

| Syntaxe         | Cible                  |
| --------------- | ---------------------- |
| `sys.X`         | scène locale           |
| `parent.X`      | scène parente          |
| `verse.X`       | scène nommée           |
| `*.X`           | tous les enfants directs |
| `**.X`          | tous les descendants   |

Note : `sys` est implicite quand on adresse par nom de scène — `verse.play` ≡ `verse.sys.play`.

### 6.3 Auto-exposure

`sys.*` est implicitement disponible cross-scene. Pas besoin d'`@expose` pour que le parent puisse appeler `verse.play`.

### 6.4 Permissions

Toute scène peut émettre une commande sys vers n'importe quelle autre scène atteignable. Pas de système de permissions en v1.

---

## 7. Orchestrateur multi-scène (application-level)

### 7.1 Architecture

```
SceneOrchestrator {
  sessions: Map<string, Session>          // 'root', 'verse', 'chorus', ...
  routingTable: RoutingTable              // built from @scene + @expose + @map
  globalTriggerBus: TriggerBus            // route triggers cross-session

  load(rootAst: SceneAST): void
  tick(): void                            // advance all sessions in topo order
  dispatch(cmd: Command): void
  destroy(): void
}
```

Construit **sur** l'API BPx (`Session`, `FlagStore`, `TriggerBus`, commands), **pas dedans**. BPx ignore l'existence de l'orchestrateur. Cette séparation garantit qu'un user peut écrire son propre orchestrateur custom sans toucher au moteur.

### 7.2 Tic

À chaque tic du dispatcher :

1. **Drain external inputs** (CC/OSC) → events injectés dans le routing
2. **Drain events en attente** → routés selon la table
3. **Tic des sessions** dans l'ordre topologique (parents avant enfants)
4. **Drain events sortants** (CC/OSC out) → transports

Synchrone v1. Worker option v2 (l'API est conçue compatible : pas de référence partagée externe, commands sérialisables).

### 7.3 Routing table

Construite **au load** depuis l'AST de chaque scène :
- `@scene verse "..."` → enregistre la session
- `@expose [x]` → règle : `verse.flag-changed:x` → `parent.flag-changed:x`
- `@map cc:1 -> [intensity]` → règle : `external.cc:1` → `currentScene.flag-changed:intensity`
- `@map cc:60 -> verse.play` → règle : `external.cc:60` → `verse.sys.play`

Reconstruite au hot-swap. Statique pendant un cycle.

### 7.4 Snapshot

L'orchestrateur peut produire un snapshot global :
- État de chaque session (via `Session.snapshot()`)
- Routing table
- Events en transit

Sérialisable JSON. Utile pour replay, debug, persistence.

---

## 8. Hot-swap dans la hiérarchie

### 8.1 Hot-swap d'une scène feuille

`sys.hotswap` sur `verse` :
1. Session `verse` détruite (FlagStore, RNG, derivation cursor perdus)
2. Re-parsing du fichier
3. Nouvelle Session `verse` créée
4. Routing table reconstruite pour `verse` (les `@expose` peuvent avoir changé)
5. Subscriptions inter-scène re-souscrites

Le parent voit un trou de quelques ms. Pas d'impact sur ses flags ni sur les autres enfants.

Préservation optionnelle : `sys.hotswap(preserveFlags: true)` snapshot avant destruction, restaure après recréation (modulo flags qui n'existent plus).

### 8.2 Hot-swap du parent

Recharger la racine = détruire toute la hiérarchie + recréer. Plus coûteux mais plus simple. Pas de hot-swap partiel d'arbre en v1.

---

## 9. Exemple complet

```
// root.bps
@scene verse "verse.bps"
@scene chorus "chorus.bps"

@map cc:1 -> [tension]              // CC1 contrôle un flag racine
@map cc:60 -> verse.play            // CC60 démarre verse
@map [tension] -> cc:20             // retour visuel sur cc:20

[phase==1] S -> verse
[phase==2] S -> chorus
[phase==3] S -> { verse, chorus }
```

```
// verse.bps
@expose [intensity]
@map cc:2 -> [intensity]
[tension > 5] S -> Sa Re Ga !ready
[tension <= 5] S -> Sa Re
<!parent.go S -> Pa Dha
```

```
// chorus.bps
@expose [intensity]
<!verse.ready S -> Ma Pa Dha       // enchaîne sur le ready de verse
S -> Sa Re Ga Ma
```

### Flux d'événements pour un tic

```
1. user tourne CC1 → externe envoie cc:1=7
2. orchestrator route : cc:1 → root.flag-changed:tension=7
3. tic root : [tension]=7 dans son FlagStore
4. tic verse : guard [tension>5] lit `tension` (du parent) → 7 → match
5. verse dérive « Sa Re Ga !ready »
6. !ready local à verse
7. (chorus a souscrit <!verse.ready) → orchestrator relaie : verse.trigger:ready → chorus.trigger:verse.ready
8. tic chorus : reprend la dérivation suspendue → « Ma Pa Dha »
9. (au cours de la dérivation) verse mute [intensity]=3
10. verse @expose [intensity] → routing → root reçoit
```

---

## 10. Implications pour BPx

- `BPx ENGINE_SPEC.md §6` (FlagStore) : implémentation libre (parent chain in-memory ou event-based) tant que la sémantique observable §3.2 est respectée.
- `BPx ENGINE_SPEC.md §7` (TriggerBus) : bus local par session ; cross-session via `SceneOrchestrator` (hors BPx).
- `BPx ENGINE_SPEC.md §10` (SceneOrchestrator) : à compléter — détaillé dans ce doc, application-level.
- `BPx ARCHITECTURE.md` : multi-instance hors moteur, orchestrateur consomme l'API publique.

---

## 11. Hors-scope v1

- Multi-instance d'une même scène (`@scene verse "verse.bps" instance:2`)
- Permissions sur les commandes sys
- Détection automatique de cycles de triggers
- Hot-swap partiel d'arbre (recharger un sous-arbre sans recréer la racine)
- Workers par session
- Persistence d'état entre runs (snapshot/restore disque)
- Sémantique exacte du « consume terminal scène » (cf. §2.3, point ouvert)

À documenter en v2 si demande pratique.
