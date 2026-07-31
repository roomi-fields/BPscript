# SCENES.md — Hiérarchie de scènes : modèle de communication

> Référencé par [LANGUAGE.md](../spec/LANGUAGE.md) §Scenes et le contrat moteur [BPx ENGINE_SPEC.md](../../../BPx/docs/ENGINE_SPEC.md) §6 (FlagStore) / §7 (TriggerBus) / §10 (orchestration).
>
> Précise : cycle de vie des scènes, acteurs/voix, cascade de sortie, scoping des flags, propagation des triggers, sémantique de `@alias`, commandes `sys`, orchestration multi-instance, hot-swap.

---

> ⚠️ **`@scene` SUPPRIMÉE DU LANGAGE (2026-07-29/30).** Romain : « on n'a ni la maturité ni le
> besoin de déclarer des sous-scènes » (`hub/decisions/2026-07-29-les-formes-declaratives-de-bpscript.md`
> §4, « @scene DISPARAÎT »). Le compilateur **REFUSE** désormais toute scène qui déclare `@scene` —
> ce n'est plus une intention mais un état déjà en vigueur, vérifié de bout en bout
> (`hub/decisions/2026-07-30-les-scenes-sortent-de-l-ui-alt-chiffres-vise-les-acteurs.md` : « le banc
> de bout en bout verrouille désormais l'absence »). Le mécanisme de hiérarchie de sous-scènes décrit
> par ce document (§1-§2, §3.3, §4, §5, §8-§10, §12) n'existe plus aujourd'hui ; conservé pour
> l'intention de design historique, il ne décrit plus le dépôt.

---

## 1. Principe — modèle multi-instance

Chaque scène est une **Session BPx autonome** : son propre buffer, son propre arbre, son propre FlagStore, son propre RNG, son propre TriggerBus local. Aucune session ne tient de référence directe à une autre.

La communication passe par ces mécaniques, et pas d'autres :

| Mécanique    | Quoi                                      | Persistance  |
| ------------ | ----------------------------------------- | ------------ |
| **Flags**    | État partagé, lu par les guards           | Persistant   |
| **Triggers** | Événements ponctuels (synchro)            | Instantané   |
| **`@alias`**   | Nom donné à une chose technique ou répétitive | Déclaratif  |
| **`>>` / `\>>`** | Câblage dans le flux — brancher, débrancher | Dynamique    |

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
│                   @expose, @alias directives)              │
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

## 3. Acteurs et voix dans une scène

> Référence normative : [docs/design/ACTOR.md](ACTOR.md). Grammaire : `docs/spec/EBNF.md` (actor_directive) et `docs/spec/AST.md` (ActorDirective).

### 3.1 Une scène = des acteurs ; un acteur = une voix

Une scène déclare un ou plusieurs **acteurs**. Un acteur **est** une voix — le niveau « voix » intermédiaire des versions antérieures a été **supprimé**. Un acteur lie sept propriétés : `alphabet`, `tuning`, `octaves`, `sound`, `transport`, `eval`, `voice` (`hub/decisions/2026-06-16-cles-acteur-six.md` + `voice` ajoutée le 2026-07-16 — cf. `BPscript/docs/spec/EBNF.md:179-184`, `BPscript/src/transpiler/parser.js:40`).

```bpscript
@actor sitar
  alphabet.sargam
  tuning.sargam_22shruti
  transport.audio
```

Chaque acteur est autonome dans la scène. Une règle peut faire dériver plusieurs acteurs en parallèle — c'est la **voix polymétrique** `{A, B}` (structure de grammaire, sans rapport avec le niveau de voix):

```bpscript
S -> { sitar.Sa sitar.Re, tabla.ta tabla.ki }
```

Dans les règles, un terminal se qualifie par son acteur en **dot notation** : `sitar.Sa` (opérateur `.` = pointe une entité).

### 3.2 Cascade de sortie — scène → acteur → terminal

La **cascade de sortie** détermine les paramètres de rendu (vélocité, canal, params de transport…). Elle suit **trois niveaux**, l'override le plus fin l'emportant :

| Niveau | Portée | Exemple |
|---|---|---|
| 1. scène | défauts de la scène | (à préciser — backlog A2) |
| 2. acteur | tous les terminaux de la voix | bindings `transport`/`eval` ; qualifiers acteur |
| 3. terminal | une occurrence | `sitar.Sa(vel:80)` |

Cette cascade est **distincte** du mécanisme de scoping des flags (§4) : l'override de sortie détermine comment un son/signal est rendu ; la collision de flags (§4.5) détermine la visibilité de l'état entre scènes. Les deux mécanismes sont indépendants.

> Ouvert (backlog A2) : syntaxe d'override de sortie aux niveaux scène et acteur — non encore spécifiée.

Le `transport` = **canal de NOTRE sortie** (`audio`/`midi`/`osc`, défaut cascade @core `audio`) ; optionnel, et **absent sur un acteur `eval`**. Modèle producteur/canal (Romain 2026-07-14) : un `eval.<X>` (strudel/hydra…) est un producteur embarqué autonome qui **sort en natif** (pas de transport) ; seul le producteur défaut `js` place sa sortie via NOTRE `transport`. Pas de `transport.video`/`visual`.

### 3.3 Migration `.kanopi → .bps` (chantier downstream)

Le format `.kanopi` est le format d'orchestration multi-acteurs cross-runtime cible (plusieurs scènes `.bps`, plusieurs acteurs, runtimes hétérogènes). La migration depuis `.kanopi` vers `.bps` + `@actor` est un **chantier dev downstream** (backlog D2), à engager après que la spec acteurs et la librairie `@devices` soient figées. `@scene` est supprimée du langage (cf. bandeau en tête) ; le mécanisme de composition multi-scène que ce chantier emploiera reste à définir — rien n'est tranché sur son remplacement (`LAN-30`). Le schéma de mapping n'est pas spécifié ici.

---

## 4. Scoping des flags

### 4.1 Règle absolue : un FlagStore par session

Chaque session a son propre FlagStore. Pas de partage de référence entre sessions.

### 4.2 Lecture parent → enfant

Un enfant peut **lire** un flag du parent. La sémantique observable est : `verse.flags.get('mood')` retourne la valeur courante de `mood` dans le parent (ou 0 si absente).

L'implémentation est libre :
- **Parent chain in-memory** : `_parent: FlagStore | null`, lookup remontant la chaîne (rapide, simple v1)
- **Event-based au tic** : l'orchestrateur copie les flags propagés dans le FlagStore enfant à chaque tic (sérialisable, prêt pour Worker/Rust subprocess)

Tant que la sémantique observable est respectée, les deux sont équivalents pour BPScript.

> **Point ouvert** : choix d'implémentation non arrêté. Trade-off entre simplicité v1 (parent chain) et portabilité Worker/Rust (event-based). À trancher avant d'écrire le FlagStore. Voir aussi §11 et `BPx ENGINE_SPEC.md §6` (FlagStore).

### 4.3 Écriture — locale uniquement

Une mutation `[x=N]` dans la grammaire d'une scène modifie **son** FlagStore. Jamais propagée au parent ou aux enfants implicitement.

### 4.4 `@expose` — bottom-up opt-in

```
@expose [intensity]
```

Whitelist explicite : seul un flag exposé par l'enfant est visible en lecture par le parent. Sans `@expose`, les flags enfants sont strictement privés.

### 4.5 Conflits de nom — erreur compile

Si parent et enfant déclarent tous deux un flag de même nom (utilisé localement dans un guard ou un set), c'est une erreur de compilation. Résolution : renommer dans l'un, ou retirer la déclaration côté parent (qui héritera via `@expose` côté enfant).

### 4.6 Isolation siblings

Deux scènes sœurs ne se voient pas directement. Pour qu'`intensity` de `verse` soit visible par `chorus` : `verse @expose [intensity]` → parent reçoit → `chorus` lit via parent.

### 4.7 CV ≠ flags

Les Control Variables (objets temporels continus, cf. [CV.md](CV.md)) sont des **tables propres à chaque scène**, **non héritées**. Une CV `lfo1` dans `verse` n'est pas visible dans `chorus` ni dans le parent. Pas d'analogue `@expose` pour les CV.

### 4.8 Tableau de visibilité

| Source           | Cible    | Mécanisme                     | Direction |
| ---------------- | -------- | ----------------------------- | --------- |
| Parent           | Enfant   | Routing automatique des flags | Lecture   |
| Enfant           | Parent   | `@expose` explicite           | Lecture   |
| Enfant A         | Enfant B | Via parent (expose + relais)  | Indirecte |
| Externe (CC/OSC) | Scène    | `@alias <nom> cc:N` (cf. §6)    | Lecture   |

---

## 5. Triggers cross-scene

### 5.1 Scope local strict par défaut

`!sync` émis dans `verse` est visible **uniquement** dans `verse`. `<!sync` n'écoute **que** les `!sync` émis localement. Pas de broadcast implicite.

### 5.2 Préfixes pour cross-scene

| Syntaxe        | Cible                                     |
| -------------- | ----------------------------------------- |
| `!sync`        | scène locale uniquement                   |
| `!parent.sync` | scène parente directe                     |
| `!verse.sync`  | scène nommée (résolue par l'orchestrateur)|
| `!*.sync`      | broadcast aux enfants directs             |
| `!**.sync`     | broadcast récursif aux descendants        |

Idem pour la souscription (`<!parent.sync`, `<!*.ready`, etc.).

### 5.3 Émission préfixée

Un trigger émis avec un préfixe **n'apparaît pas localement** — il sort directement vers la cible. Pour émettre à la fois local et cross-scene, deux instructions séparées.

### 5.4 Triggers sans guards

Un trigger est un **signal pur**. Il n'a pas de guards — il est conditionné uniquement par les règles qui le produisent. La logique conditionnelle vit dans la grammaire qui décide d'émettre, pas sur le trigger lui-même.

### 5.5 Pas de protection anti-cycle

Si l'utilisateur écrit une grammaire produisant des triggers cycliques (parent émet → enfant réagit → parent re-réagit), c'est sa responsabilité (BP3 ne protège pas non plus). Détection automatique = v2 si demande pratique.

### 5.6 Émission externe

Depuis JS : `instance.emitTrigger(name, payload?)`. Permet à l'UI, à un message MIDI, à un event WebSocket de déclencher des triggers comme s'ils étaient émis dans la grammaire.

### 5.7 Sémantique batch vs streaming

| Mode                  | `<!trigger`                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| **Batch** (`derive`)  | Enregistré comme événement dans le DerivationTree. La dérivation continue. Le dispatcher gère l'attente au playback. |
| **Streaming**         | La dérivation se suspend. `triggerBus.wait(name)` retourne une Promise résolue à l'émission.         |

---

## 6. `@alias` — DÉSIGNER : un nom, puis ce qu'il désigne

> ⚠️ **La directive de correspondance est ABANDONNÉE depuis le 2026-07-27 au soir**
> (`hub/decisions/2026-07-27-map-abandonne-alias-revient-le-cablage-passe-par-les-chevrons.md`).
> Ce qui BRANCHE passe par les chevrons `>>` / `\>>` (§6.3) ; ce qui DÉSIGNE reste ici, sous
> `@alias`. Deux corollaires qui tiennent depuis le matin même : le signe `=` a disparu de tout le
> langage, `@macro` comprise, et la flèche `->` est redevenue **exclusivement une règle de
> production**. Forme vivante et unique : **`@alias <nom> <valeur>`** — le nom d'abord, comme
> toutes les autres directives.

### 6.1 Ce qu'un alias peut DÉSIGNER

| Valeur                | Ce qu'elle désigne                        |
| --------------------- | ----------------------------------------- |
| `cc:N`                | un contrôleur continu MIDI entrant        |
| `osc:/path`           | une adresse OSC entrante                  |
| `<!trigger`           | un point d'attente déclaré                |
| `[flag]`              | un drapeau local                          |
| `IDENT`               | un trigger ou une entrée déclarée         |
| `IDENT.IDENT`         | une entrée et son adresse, un label posé  |

**Le sens SORTANT n'existe plus** (abandonné le 2026-07-27, retiré chez BPx en `4d2fbbe`) : une
désignation NOMME, elle n'émet pas. Ce qui décrivait une émission — une correspondance vers un contrôleur
externe, l'aller-retour bidirectionnel et sa rupture d'écho — a été retiré avec, sans réécriture.
Les graphies ne sont pas citées : elles employaient la flèche comme opérateur de câblage, ce
qu'elle n'a jamais été.

### 6.2 Désigner plusieurs éléments ensemble

```
S -> groove:{C4 D4, E4} F4
@alias ratio groove.vel
```

L'**étiquette d'un groupe polymétrique** — le nom, deux-points, le groupe — désigne tout ce qu'il
contient. Portée par défaut : la scène où `@alias` est déclaré. Préfixe pour la portée croisée
(`verse.groove.vel`, `*.groove.vel`).

> ⚠️ **Le suffixe arobase, qui posait une étiquette sur un élément isolé, est SUPPRIMÉ**
> (Romain, 2026-07-28). Il n'avait aucun besoin à lui : associer un geste dans la production se
> fait avec le point d'exclamation, nommer se fait dans la partie déclarative. La directive
> `@label` part avec lui. L'étiquette de groupe ci-dessus, elle, est une autre graphie et reste.

### 6.3 Le CÂBLAGE n'est pas une désignation — il passe par `>>` et `\>>`

**`@alias` DÉSIGNE ; il ne branche pas.** Alimenter le tempo, un drapeau ou le départ d'une partie
est un **câblage**, et le câblage a son propre geste : `>>` pour brancher, `\>>` pour couper.

**L'argument qui a tranché — une directive ne se débranche pas.** `\>>` coupe un câble **pendant
que ça joue**, et le branchement se reconfigure au fil de la pièce ; aucune déclaration ne sait
faire ça, et il n'existe pas de « dé-déclaration ». Entre deux écritures pour brancher A sur B dont
l'une est strictement moins puissante, c'est la moins puissante qui part.

**Un câblage de contrôle s'écrit DANS LE FLUX** (Romain, 2026-07-27 au soir), comme le câblage de
son : sans le flux, `\>>` n'a nulle part où s'écrire, et le dynamisme qui a fait choisir le câblage
disparaît. Conséquence directe : un contrôleur peut prendre la main sur le tempo **à un moment
précis** de la pièce et être coupé plus loin — ce n'est pas un réglage global de début à fin.

**Le numéro de contrôleur RESTE écrivable**, en dur ou par un alias déclaré. Ce qui est banni d'une
pièce, c'est un **nom de port** : il vient du système, il change de machine, de pilote, parfois de
prise. Un numéro de contrôleur est l'inverse — une valeur de la norme MIDI, stable partout. Même
règle que pour les adresses d'entrée : l'adresse nue est autorisée, aucune table par défaut, et une
table de bibliothèque donne des étiquettes lisibles quand elle existe.

**Le multiple sur une ligne se marque par la virgule**, forme déjà en usage (`@flag scene: calm:1, full:2`).

### 6.4 Brancher ou couper PENDANT QUE ÇA JOUE — la forme, et ce qui n'arrive pas encore

C'est le geste que la décision voulait rendre possible : **un potard prend la main sur quelque
chose pendant que la pièce joue, et le lâche plus loin.** Il s'écrit en deux temps : on NOMME le
câblage dans une macro, puis on pose ce nom dans le flux.

```bpscript
@macro prise    pot >> tempo.bpm      // on nomme le branchement
@macro lache    \>> tempo.bpm         // on nomme la coupure

S -> A4 prise  B4 C4 D4  lache  E4
```

Le nom se pose **nu** dans la séquence. Il **occupe un pas**, comme un terminal — c'est ce que
fait `public/demos/patchbay-demo.bps`, et c'est la seule écriture qui aille aujourd'hui jusqu'au
bout de la chaîne.

> ⚠️ **LA GRAPHIE N'EST PAS LA MÊME DES DEUX CÔTÉS.**
> Dans le **corps d'une macro**, le câblage ne porte AUCUN signe d'instantané (`pot >> tempo.bpm`)
> — un corps de macro n'est pas dans le temps, il n'a rien à marquer comme instantané.
> Dans le **flux**, on écrit le nom, pas le câblage.
> Recopier le corps avec un signe d'instantané ne compile pas. Mesuré par BPx le 2026-07-28, en
> écrivant leur propre test à partir de cette page.

> ⛔ **NE PAS ÉCRIRE `C4 !prise`** — la forme paraît naturelle et elle **compile sans une erreur
> nulle part**, ce qui la rend d'autant plus coûteuse. Le point d'exclamation entre deux noms est
> l'**accord** : `prise` y devient un co-attaqué **sonnant**, et un résolveur aval essaiera de lui
> donner une hauteur. On obtient un **son fantôme**, silencieusement — la même famille de défaut
> que la fréquence aberrante mesurée sur `nadaka`. Trouvé par BPx le 2026-07-28, sur une version
> de cette page qui conseillait cette écriture.

#### Poser le geste SANS occuper de pas — la forme attachée

Le nom écrit **nu** occupe un pas, comme un terminal. Pour le poser à un instant précis **sans
allonger la pièce**, on l'**attache** au terminal avec le point d'exclamation :

```bpscript
S -> A4!prise  B4 C4 D4  E4!lache
```

Le geste se déclenche à l'instant du terminal auquel il est attaché ; c'est le terminal qui porte
la durée. **Collé ou séparé d'une espace, c'est la même forme** — la règle d'espace ne joue que
sur `!(…)`, jamais sur un nom.

**Ce qui le fonde, mesuré de bout en bout le 2026-07-28**, et non pas affirmé :

| Mesure | Résultat |
|---|---|
| durée de la pièce, forme attachée | **2 temps** — deux feuilles partagent la même étendue |
| durée de la même pièce, nom écrit nu | **3 temps** — le nom prend un pas |
| ce que le nom reçoit à la sortie | hauteur **nulle**, et son **action** à la place |
| macro nommée `G4`, donc résoluble par l'alphabet | hauteur **nulle** quand même — **la macro l'emporte sur l'alphabet** |

La dernière ligne est celle qui compte : sans elle, « pas de hauteur » aurait pu vouloir dire
seulement « ce mot n'est pas une note ». C'est une **exclusion** qui protège, pas le hasard du
vocabulaire. Mesure de Kairos, sur dérivation réelle.

> ⚠️ **Une réserve, et elle est honnête** : sans catalogue de ports câblé, la même écriture rend
> une hauteur. Ce n'est pas un défaut de la forme mais un hôte incomplet — et dans ce mode
> l'action est perdue de toute façon, donc le manque se voit.

#### Pourquoi ça passe par un nom — et pourquoi ça n'est pas un contournement

**Un câblage n'a pas de nom.** Il désigne des modules et des ports, jamais un symbole du flux. Or
la table des symboles du moteur interne tout **sous un nom** — c'est ainsi qu'un point d'attente,
lui, s'interne : sous le nom écrit par l'auteur. Fabriquer une identité à un câblage anonyme serait
une décision de conception sur une structure qui porte aussi le tirage pseudo-aléatoire, donc la
reproductibilité des pièces. **Passer par une macro n'est pas un détour de circonstance : c'est la
façon dont un geste entre dans le moteur.** La macro fournit le nom, et c'est le nom qui voyage.

**L'écriture DIRECTE d'un câblage dans le flux n'existe donc pas** (arbitrage Romain, 2026-07-28,
sur mesure de BPx : « ok pour le détour par macro »). Ce n'est pas un oubli à combler : c'est la
conséquence de ce qui précède. Quiconque voudra la rajouter devra d'abord répondre à *quelle
identité porte un câblage sans nom*, et cette réponse touche le tirage aléatoire.

#### État daté, sans différé caché (2026-07-28)

| Écriture | Où ça s'arrête |
|---|---|
| `A4!prise` **attaché** | **marche de bout en bout** — n'occupe aucun pas ; c'est LA forme |
| `prise` **nu** dans le flux | marche aussi, mais **occupe un pas** — autre pièce, pas un raccourci |
| `S -> C4 !osc >> filtre D4` (câblage écrit dans le flux) | lu par le langage, **refusé au chargement** ; le refus donne la réécriture |

Les trois lignes disent où ça s'arrête à quel étage : personne n'a à le deviner, et rien n'est
promis qui n'arrive pas.

> Le suffixe arobase figurait ici comme la forme du point d'application, entre 17h et 18h le
> 2026-07-28. Il a été **supprimé** le soir même, et la mesure a montré que la forme attachée
> faisait le geste sans lui. Les deux arbitrages se sont croisés à une heure d'intervalle sur la
> même question ; c'est la mesure qui les a réconciliés, pas le raisonnement.

**Pourquoi l'ancienne écriture ne revient pas.** Elle ne se cite pas, même en exemple — une graphie
fautive citée finit recopiée. La flèche `->` est une règle de **production**, exclusivement ; elle
n'a jamais été une directive et ne le sera jamais (Romain, 2026-07-27).

---

## 7. Commandes système (`sys`)

### 7.1 Liste

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
| `sys.tempo`              | source ou cible    | Tempo BPM (lu ou piloté selon `@alias`)       |
| `sys.beat`               | source             | Émis à chaque beat (depuis la clock)        |
| `sys.bar`                | source             | Émis à chaque mesure (depuis la clock)      |

### 7.2 Adressage

| Syntaxe         | Cible                  |
| --------------- | ---------------------- |
| `sys.X`         | scène locale           |
| `parent.X`      | scène parente          |
| `verse.X`       | scène nommée           |
| `*.X`           | tous les enfants directs |
| `**.X`          | tous les descendants   |

Note : `sys` est implicite quand on adresse par nom de scène — `verse.play` ≡ `verse.sys.play`.

### 7.3 Auto-exposure

`sys.*` est implicitement disponible cross-scene. Pas besoin d'`@expose` pour que le parent puisse appeler `verse.play`.

### 7.4 Permissions

Toute scène peut émettre une commande sys vers n'importe quelle autre scène atteignable. Pas de système de permissions en v1.

---

## 8. Orchestrateur multi-scène (application-level)

### 8.1 Architecture

```
SceneOrchestrator {
  sessions: Map<string, Session>          // 'root', 'verse', 'chorus', ...
  routingTable: RoutingTable              // built from @scene + @expose + @alias
  globalTriggerBus: TriggerBus            // route triggers cross-session

  load(rootAst: SceneAST): void
  tick(): void                            // advance all sessions in topo order
  dispatch(cmd: Command): void
  destroy(): void
}
```

Construit **sur** l'API BPx (`Session`, `FlagStore`, `TriggerBus`, commands), **pas dedans**. BPx ignore l'existence de l'orchestrateur. Cette séparation garantit qu'un user peut écrire son propre orchestrateur custom sans toucher au moteur.

### 8.2 Tic

À chaque tic du dispatcher :

1. **Drain external inputs** (CC/OSC) → events injectés dans le routing
2. **Drain events en attente** → routés selon la table
3. **Tic des sessions** dans l'ordre topologique (parents avant enfants)
4. **Drain events sortants** (CC/OSC out) → transports

Synchrone v1. Worker option v2 (l'API est conçue compatible : pas de référence partagée externe, commands sérialisables).

### 8.3 Routing table

Construite **au load** depuis l'AST de chaque scène :
- `@scene verse "..."` → enregistre la session
- `@expose [x]` → règle : `verse.flag-changed:x` → `parent.flag-changed:x`
- `@alias tension cc:1` → le contrôleur continu 1 est désormais désignable sous le nom `tension` dans la scène courante

*(Les deux autres lignes d'exemple — un drapeau et une commande de scène comme cibles — ont été
retirées : ces cibles n'ont plus d'écriture et la question est ouverte, cf. §6.3.)*

Reconstruite au hot-swap. Statique pendant un cycle.

### 8.4 Snapshot

L'orchestrateur peut produire un snapshot global :
- État de chaque session (via `Session.snapshot()`)
- Routing table
- Events en transit

Sérialisable JSON. Utile pour replay, debug, persistence.

---

## 9. Hot-swap dans la hiérarchie

### 9.1 Hot-swap d'une scène feuille

`sys.hotswap` sur `verse` :
1. Session `verse` détruite (FlagStore, RNG, derivation cursor perdus)
2. Re-parsing du fichier
3. Nouvelle Session `verse` créée
4. Routing table reconstruite pour `verse` (les `@expose` peuvent avoir changé)
5. Subscriptions inter-scène re-souscrites

Le parent voit un trou de quelques ms. Pas d'impact sur ses flags ni sur les autres enfants.

Préservation optionnelle : `sys.hotswap(preserveFlags: true)` snapshot avant destruction, restaure après recréation (modulo flags qui n'existent plus).

### 9.2 Hot-swap du parent

Recharger la racine = détruire toute la hiérarchie + recréer. Plus coûteux mais plus simple. Pas de hot-swap partiel d'arbre en v1.

---

## 10. Exemple complet

```
// root.bps
@scene verse "verse.bps"
@scene chorus "chorus.bps"

@alias tension cc:1                   // le controleur continu 1 se nomme desormais 'tension'

[phase==1] S -> verse
[phase==2] S -> chorus
[phase==3] S -> { verse, chorus }
```

```
// verse.bps
@expose [intensity]
@alias intensite cc:2
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

## 11. Implications pour BPx

- `BPx ENGINE_SPEC.md §6` (FlagStore) : implémentation libre (parent chain in-memory ou event-based) tant que la sémantique observable §4.2 est respectée.
- `BPx ENGINE_SPEC.md §7` (TriggerBus) : bus local par session ; cross-session via `SceneOrchestrator` (hors BPx).
- `BPx ENGINE_SPEC.md §10` (SceneOrchestrator) : à compléter — détaillé dans ce doc, application-level.
- `BPx ARCHITECTURE.md` : multi-instance hors moteur, orchestrateur consomme l'API publique.

---

## 12. Hors-scope v1

- Multi-instance d'une même scène — **fonctionnalité v2 ouverte, jamais tranchée** (cf. §1). C'est l'ÉCRITURE qui a disparu, pas le besoin : elle se notait `@scene verse "verse.bps" instance:2`, et `@scene` est supprimée du langage (2026-07-29). La décision du 2026-07-30 le dit explicitement : *« rien sur le retour éventuel de la composition multi-scène »* — donc rien n'est décidé sur son remplacement, cf. bandeau en tête et LAN-30.
- Permissions sur les commandes sys
- Détection automatique de cycles de triggers
- Hot-swap partiel d'arbre (recharger un sous-arbre sans recréer la racine)
- Workers par session
- Persistence d'état entre runs (snapshot/restore disque)
- Sémantique exacte du « consume terminal scène » (cf. §2.3, point ouvert)
- Migration `.kanopi → .bps` (cf. §3.3, backlog D2)

À documenter en v2 si demande pratique.
