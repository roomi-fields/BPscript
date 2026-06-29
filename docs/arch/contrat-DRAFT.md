# Contrat d'architecture — transpileur BPScript (`src/transpiler/`)

## Statut

- **Brouillon (CADRE).** À confronter à l'archi globale puis à ratifier par Romain. Non encore branché au gate.
- **Drivers :**
  - **Carte du réel** : `/home/romi/dev/bp/BPscript/docs/arch/carte-reel.md` (21 fichiers, 5 blocs, zéro orphelin, zéro cycle).
  - **Loi cross-repo** : la voie propre ne traverse jamais la sortie BP3 héritée — gardée par `bpx-clean-no-bp3` (`.dependency-cruiser.cjs` à la racine, branchée sur `npm run arch`).
  - **Frontière de contrat** : `/home/romi/dev/bp/hub/contrats/bpscript-bpx.md` (atteste la conformité à `BPx/docs/AST_SPEC.md` v1) ; mapping surface→AST dans `BPscript/docs/spec/AST.md`.
  - **Autorité sémantique** : `/home/romi/dev/bp/BPscript/src/transpiler/_AUTORITE.md` (acteur / pitch / contrôles) + décisions hub (6 clés d'acteur, 3 formes de contrôle).
  - **Règle de garde** : tout ce qui touche la **sémantique du langage** se valide avec Romain — le présent cadre fige la **forme** et les **frontières**, jamais le sens du langage.

**Marquage employé dans ce contrat :** ✅ ratifié (acté Romain / décision hub) · ⚙️ dérivé (lu du code / de la cartographie, non encore ratifié) · 🔶 proposé (cible à confronter) · ❓ Romain (décision bloquante en attente).

---

## 1. Fonctionnel — raison d'être ⚙️

**Texte BPScript (`.bps`) → `SceneAST` agnostique pour BPx.** C'est l'unique mission de la voie propre.

- **Entrée** : source `.bps` + un `environnement` optionnel (défauts portés par Kanopi : tempo, octave, division…).
- **Sortie** : `{ ast, errors, warnings }` — un arbre **complet** et **autoportant** (l'AST se suffit ; le moteur dérive depuis une structure complète), **sans aucune notion BP3** (`_xxx(N)`, `flavor:'bp3'` interdits dans l'AST).
- **Point d'entrée** : `compileToBPxAST(source, environnement)` dans `index.js` → `bpxAst.js`.

Étapes de la voie propre (toutes dans `bpxAst.js`) :

| Étape | Rôle | Fichier |
|---|---|---|
| Tokenisation | texte → flux de jetons | `tokenizer.js` |
| Analyse | jetons → AST (charge opaque par token : nature/acteur/params/flux) | `parser.js` (autorité) |
| Annotation des voix de code | étiquette + `payload.interp/nature` sur les nœuds backtick ; `auto`→`eval` de l'acteur | `bpxAst.js` |
| Défauts d'environnement | inscrit EN DUR dans l'AST les réglages absents (aujourd'hui : tempo `@mm`) | `bpxAst.js` |
| Acteur implicite | matérialise l'acteur `default` dans l'AST si aucun `@actor` (LAN-5/KAI-9) | `bpxAst.js` |
| Validation sémantique | valeurs de contrôle + noms de modulation contre les libs (erreurs non fatales) | `controlValidation.js`, `modulationValidation.js`, `libs.js` |

**Résolution (RESOLUTION)** — sert l'AST, jamais l'ancien format dans la voie propre :
- `actorResolver.js` : résolution d'acteur (les 6 clés : alphabet, tuning, octaves, sound, transport, eval ; obligatoires alphabet+transport).
- `libs.js` (+ `libs-data.js` **généré**) : chargeur de librairies JSON (contrôles / symboles / CV).

**Hors mission (à isoler, pas à étendre) :**
- **SORTIE_BP3** (`encoder.js`, `prototypes.js`, `orderTokens.js`) : voie héritée `compileBPS`, vouée au retrait — **ne pas toucher** sauf demande explicite.
- **INVERSE_BP3** (`bp3ToScene.js`) : sens inverse BP3→BPScript, hors flux de compilation principal.
- **OUTILLAGE** (7 scripts CLI/tests/bundle) : points d'entrée, pas des modules de bibliothèque.

---

## 2. Contextuel — place dans le flux, voisins, lois cross-repo ⚙️

**Place dans le flux global :** premier maillon de la chaîne de production.

```
.bps (texte)  →  [transpileur BPScript]  →  SceneAST  →  BPx (dérivation)  →  Kronos (transport)  →  runtimes
                  compileToBPxAST                        (porte la charge opaque sans l'interpréter)
```

- Le transpileur est un **frontal pur** : il PRODUIT l'arbre, il ne résout/compose/rend rien en aval (principe « Kanopi/le frontal ne résout rien »).
- **BPx** porte la charge opaque par token (`TokenPayload` : transport/nature/params/flux) **sans l'interpréter** ; le dispatcher route dessus ; **Kairos** matérialise les sorties d'événement (ex. voix de code → `event.output = {runtime:'code', device:interp}`).

**Voisins amont/aval :**
- **Amont** : Kanopi (hôte) — fournit le source et l'`environnement` (défauts). Kanopi **ne touche jamais l'AST** ; changer un défaut = re-transpiler.
- **Aval** : BPx (consommateur normatif de l'AST), puis Kronos, puis les runtimes.
- **Référence partagée** : `BPx/docs/AST_SPEC.md` v1 — source canonique de la forme de l'AST, partagée par les deux frontaux (BPScript et BP3-frontend).

**Lois cross-repo (non négociables) ✅ :**
1. **La voie propre ne traverse JAMAIS la sortie BP3 héritée.** `bpxAst.js` n'importe pas `encoder`/`prototypes`/`orderTokens`. Garde `bpx-clean-no-bp3`.
2. **AST agnostique du moteur.** Aucune notion BP3 ne fuit dans l'AST. Le transpileur **atteste** la conformité à AST_SPEC v1 ; il ne redéfinit pas la forme de l'AST.
3. **Sémantique du langage = décision Romain.** Toute évolution de forme d'AST → amender `hub/contrats/bpscript-bpx.md` ; toute ambiguïté de sens → escalader, ne pas trancher seul.
4. **Deux voies côte à côte dans la façade, jamais croisées.** `compileToBPxAST` (active, frontière BPx) et `compileBPS` (héritée, à retirer) coexistent dans `index.js` mais ne partagent pas le chemin de sortie.
5. **Précédence collision homo↔terminal : LE TERMINAL GAGNE** (figé `bpscript-bpx.md:31`). À la recherche, `SEARCHTERMINAL` passe avant `SEARCHHOMO` : un nom qui est à la fois terminal et homomorphisme est résolu comme **terminal** (fidèle BP3). Invariant de forme, non négociable.
6. **La NATURE voyage scellée dans le FLUX DÉRIVÉ, pas seulement dans l'AST statique** (exigence figée `AST_SPEC §3.1`). Tout token non purement sonnant (`transport-control`, `instant`, et `engine-control` quand restitué) ressort en sortie `'complete'` comme nœud `control` de durée nulle **portant son `TokenPayload` intact** (`nature` au minimum) ; BPx n'absorbe jamais un marqueur sans le restituer. C'est ce qui permet au dispatcher — qui ne voit que le flux dérivé en ordre — de distinguer `transport-control`/`instant` (à émettre) d'`engine-control` (déjà appliqué, à ignorer).

---

## 3. Interface — frontières du transpileur BPScript

Le transpileur a **trois frontières** :

| # | Frontière | Sens | Direction | Pivot/étalon | Statut |
|---|---|---|---|---|---|
| ENTRÉE | Kanopi (hôte) → transpileur | amont | `compileToBPxAST(source, environnement?)` | conf éditable Kanopi (défauts) | ⚙️ |
| SORTIE (**reine**) | transpileur → BPx | aval | `SceneAST` émis | `hub/contrats/bpscript-bpx.md` + `BPx/docs/AST_SPEC.md v1.2` ; `BPx/src/types/ast.ts` | ⚙️/❓amendements |
| VOIES SECONDAIRES | inverse (`bp3ToScene`) + ordre texte (`orderTokens`) | hors flux principal | round-trip BP3↔BPS, tokenisation `-o` | en-têtes modules + tests d'oracle | ⚙️/❓statut |

### 3.1 — Inventaire des directions, en TABLEAU par frontière

#### 3.1.A — Frontière ENTRÉE (Kanopi → transpileur) ⚙️

| Nom (objet/champ) | Propriétaire | Sens | Type / forme exacte | Invariant |
|---|---|---|---|---|
| `source` | Kanopi ▶ bpxAst.js | entrant | `string` (texte `.bps`) | seule vérité du contenu ; texte brut non pré-mâché |
| `environnement?` | Kanopi ▶ bpxAst.js | entrant | `{ tempo?, octave?, division?, … }` (défauts) | optionnel ; Kanopi NE TOUCHE JAMAIS l'AST → changer un défaut = re-transpiler |
| défaut `tempo` | environnement → `applyEnvironmentDefaults` | entrant→injecté | nombre | injecté EN DUR en `@mm` SEULEMENT si aucun `@mm`/`@tempo` déclaré |
| défaut transport acteur | `DEFAULT_ACTOR_TRANSPORT='audio'` (constante TODO) | entrant (en dur, hôte) | `'audio'` | LAN-5 : à lire depuis la conf éditable Kanopi (❓ Romain) |

#### 3.1.B — Frontière SORTIE : `SceneAST` émis vers BPx (frontière reine, côté producteur) ⚙️

> **Sens** : SORTIE du transpileur = ENTRÉE de BPx. C'est la **frontière reine**. Vue ici **côté
> producteur** (ce que BPScript émet) ; alignée champ-pour-champ sur la même frontière vue côté
> consommateur dans `BPx/docs/arch/contrat-DRAFT.md §3.1.A / §3.2.A` (frontière A).
> **Étalon figé** : `hub/contrats/bpscript-bpx.md` (attestation de conformité) + `BPx/docs/AST_SPEC.md v1.2` (schéma canonique).
> **Point d'émission réel** : `compileToBPxAST(source, environnement?)` — `src/transpiler/bpxAst.js:179`.
> **Forme de vérité compilable** : `BPx/src/types/ast.ts` (le transpileur émet du JS pur, BPx type le pivot).

| Nom (objet/champ) | Propriétaire | Sens | Type / forme exacte | Invariant |
|---|---|---|---|---|
| `compileToBPxAST(source, env?)` | bpxAst.js → BPx | BPScript ▶ BPx | `{ ast: SceneAST\|null, errors: [], warnings: [] }` | point d'émission UNIQUE de la voie propre ; n'appelle JAMAIS encoder.js (loi BPx-only) |
| `ast` (= `SceneAST`) | parser+bpxAst | sortant | `{type:'Scene', directives[], subgrammars[], …}` conforme `AST_SPEC v1.2` | un SEUL objet traverse ; agnostique moteur ; source unique (zéro table parallèle) |
| `errors` | controlValidation + modulationValidation + ParseError | sortant | `Array<{message, line?, col?}>` | NON fatal : l'AST reste produit même avec erreurs (affichées en rouge à l'éval) |
| `warnings` | parser (`onWarning`) | sortant | `Array<{type:'warning', message, line?}>` | formes dépréciées (ex. `@seed:N` historique) ; canal séparé d'`errors` |
| `scene.type` | parser | sortant | littéral `'Scene'` | discriminant fixe |
| `scene.directives` | parser | sortant | `DirectiveAST[]` (requis) | `@tempo`/`@mm`/`@duration`/`@flag`/`@library`… |
| `scene.subgrammars` | parser | sortant | `SubgrammarAST[]` (requis, ≥1) | cœur dérivé ; BPx rejette `length===0` |
| `scene.actors?` | parser + applyDefaultActor | sortant | `ActorDirective[]` (`references: ActorReference[]` v0.8) | cascade statique scène→acteur pliée ; défaut canal = `ActorReference.params` ; acteur `default` synthétique injecté si aucun `@actor` |
| `scene.soundPrototypes?` | parser | sortant | `SoundPrototypeAST[]` | déclare un son |
| `scene.soundAssignments?` | parser | sortant | `SoundAssignmentAST[]` | sujet→son, cascade |
| `scene.template? / templates?` | parser | sortant | `TemplateEntryAST[]\|null` (alias : MÊME tableau, pas de copie) | v0.8 singulier, v0.7 pluriel en repli |
| `scene.declarations?` | parser | sortant | `DeclarationAST[]` | `@gate/@trigger/@cv` ; BPx ne lit que `temporalType`+`name` |
| `scene.cvInstances?` | parser | sortant | `CVInstanceAST[]` | BPx ne lit que `name` ; reste **opaque** (R2) |
| `scene.homomorphisms?` | parser/encoder | sortant | `HomomorphismDeclAST[]` `[{type:'Homomorphism',name,pairs:[[src,dst]…],line}]` | chaînes **dépliées** en paires 1-pas, identité **conservée** ; noms canon. `*`/`+`/`;` |
| `scene.backticks?` | parser (`parseBacktickOrphan`) | sortant | `BacktickOrphanAST[]` (section de scène) | voix de code STANDALONE de tête ; HORS union RHS ; opaque |
| `scene[extension]` | parser | sortant | `unknown` (scenes/exposes/maps/aliases/labels/macros/flagStates) | sections non portées : conservées **opaques** |
| `payload` (par nœud RHS sonnant/contrôle) | parser `annotateScene` / bpxAst `annotateBackticks` | sortant | forme conventionnelle `TokenPayload` (voir §3.2.B) | **opaque** : BPx porte EN ORDRE, n'interprète que `nature` (son ressort) |
| `TempoOp.scope` | parser | sortant | `'absolute'\|'relative'` | `![/N]`→relatif ; `A[/N]`/`[/N]` règle→absolu ; BPx LIT (ne devine plus) |
| graine au point `![@seed:N]` | parser | sortant | `InstantControl{qualifier:ProductionInline[Directive{name:'seed',value:N}]}` | toute clé ≠ `seed` **rejetée au parse** → `_srand(N)` en aval |
| `@mm` d'environnement | bpxAst `applyEnvironmentDefaults` | sortant | `Directive{name:'mm', value:tempo, fromEnvironment:true, line:0}` | injecté EN DUR SEULEMENT si aucun `@mm`/`@tempo` déclaré (l'AST se suffit) |
| forme `_(…)` héritée | — | exclusion | **jamais émise** | normalisée en `(…)` (`transport-control`) avant l'AST |
| `TriggerIn`/`SymbolWithTriggerIn` | parser | sortant (hors union) | `TriggerInAST`/`SymbolWithTriggerInAST` | réécrits en sentinelles côté BPx AVANT dérivation ; jamais vus par la dérivation |

#### 3.1.C — Frontière VOIES SECONDAIRES : INVERSE_BP3 (`bp3ToScene`) + SORTIE_BP3 ordre (`orderTokens`) ⚙️

Deux modules périphériques de `src/transpiler/`, hors de la chaîne de compilation principale
(`compileBPS` / `compileToBPxAST`) :

- `bp3ToScene.js` (1955 L) — **île sens-inverse** : reconstruit du `.bps` depuis une grammaire BP3
  (`-gr.`). Atteinte UNIQUEMENT par tests (`test/test_bp3_to_scene.cjs`, `test/test_bolsize_alias.js`).
  Aucun importeur interne. Exporte `bp3ToScene`, `parseHoFile`.
- `orderTokens.js` (92 L) — **module pendant** : tokenisation « ordre » de la production canonique
  BP3 (`-o`). Exporte `tokenizeOrder` (+ export par défaut). Aucun importeur de production ; consommé
  par le test d'oracle `test/order_parity.mjs` (parité texte natif↔WASM) ; second consommateur
  déclaré dans l'en-tête = runtime texte Kanopi, HORS dépôt.

| Direction (nom) | Propriétaire | Sens | Forme / type exact | Invariant |
|---|---|---|---|---|
| `bp3ToScene(grammarText)` sans opts | bp3ToScene.js | BP3 `-gr.` ▶ BPScript | `string` = source `.bps` OU `"NON GÉRÉ: <desc> (<ctx>)"` | round-trip : `compileBPS(bp3ToScene(gr)).grammar` ≡ `gr` (modulo commentaires, refs -se/-al/-ho, espaces) |
| `bp3ToScene(grammarText,{hoText,hoKey})` | bp3ToScene.js | BP3 +`-ho.` ▶ BPScript | `{ bps:string, transcriptionEntry:object }` | `bps` préfixé `@transcription.<safeHoKey>\n` ; `-`→`O` dans hoKey |
| `parseHoFile(hoText)` | bp3ToScene.js | BP3 `-ho.` ▶ table | `{ sections:{ [label]:{ [src]:tgt } } }` | chaînes `a-->b-->c` dépliées en paires (a→b)(b→c) ; sections vides supprimées ; label défaut `*` |
| `BP3_CONTROL_MAP` (interne dérivé) | buildControlMap(lib/controls.json) | autorité contrôles | `Map<bp3tok,{bps,kind:'runtime'\|'engine',noArg:bool}>` | runtime prioritaire en collision ; clé `script` exclue ; controls.json = autorité |
| stop-and-report | bp3ToScene.js | échec round-trip | retour `string` `"NON GÉRÉ: …"` (par grammaire) | toute construction non fidèle bloque la grammaire ENTIÈRE, jamais d'émission partielle silencieuse |
| `tokenizeOrder(canonical)` | orderTokens.js | prod. BP3 `-o` ▶ séquence | `string[]` jetons sonnants ordonnés | délimiteurs `{ } & / ,` = séparateurs (découpent, NON émis) ; contrôle `_x(args)` gardé entier ; même séquence vue par les 2 consommateurs |
| default export | orderTokens.js | = `tokenizeOrder` | `function` | alias |

### 3.2 — Signatures EXACTES, chaque champ déplié

#### 3.2.A — Frontière ENTRÉE

```ts
compileToBPxAST(
  source: string,                 // texte .bps brut
  environnement?: {               // défauts portés par Kanopi (hôte) — tous optionnels
    tempo?: number;               // → @mm injecté EN DUR si aucun @mm/@tempo
    octave?: number;              // défaut d'octave (réservé)
    division?: number;            // défaut de division (réservé)
    [k: string]: unknown;
  }
) → { ast, errors, warnings }     // cf. §3.2.B enveloppe
// Invariant : l'environnement n'altère JAMAIS l'AST a posteriori ; il N'EST lu QU'À la transpilation.
//             Kanopi ne mute pas l'arbre → changer un défaut impose une re-transpilation.
```

#### 3.2.B — Frontière SORTIE (frontière reine) — chaque champ déplié

##### Enveloppe d'émission (réelle, `bpxAst.js:179-203`)
```js
compileToBPxAST(source, environnement?) → {
  ast:      SceneAST | null,                 // null si ParseError fatale
  errors:   Array<{message:string, line?:number, col?:number}>,   // validateControls + validateModulation + ParseError
  warnings: Array<{type:'warning', message:string, line?:number}> // onWarning du parser
}
// Pipeline : parse(tokenize(src)) → annotateBackticks → applyEnvironmentDefaults → applyDefaultActor.
```

##### Racine — `SceneAST`
```ts
interface SceneAST {
  type: 'Scene';
  directives: DirectiveAST[];                 // requis
  subgrammars: SubgrammarAST[];               // requis, ≥1
  actors?: ActorDirective[];
  soundPrototypes?: SoundPrototypeAST[];
  soundAssignments?: SoundAssignmentAST[];
  template?: TemplateEntryAST[] | null;       // v0.8
  templates?: TemplateEntryAST[] | null;      // v0.7 alias — MÊME référence
  declarations?: DeclarationAST[];
  cvInstances?: CVInstanceAST[];
  homomorphisms?: HomomorphismDeclAST[];
  backticks?: BacktickOrphanAST[];            // voix de code de tête (section), HORS union RHS
  [extension: string]: unknown;               // scenes/exposes/maps/aliases/labels/macros/flagStates, opaques
}
```

##### Sous-grammaire / règle
```ts
type DerivationMode = 'ord'|'rnd'|'random'|'sub'|'sub1'|'lin'|'tem'|'poslong'|'anal';
interface SubgrammarAST { type:'Subgrammar'; index:number; mode: DerivationMode|null; rules: RuleAST[]; [k]:unknown; }
type ArrowAST    = '->' | '<-' | '<>';
type RuleModeAST = 'rnd' | 'left' | 'right';
interface RuleAST {
  type:'Rule';
  guard: GuardAST | GuardAST[] | null;
  lhs:   LhsElementAST[];
  arrow: ArrowAST;
  rhs:   RhsElementAST[];
  flags: FlagExprAST[];
  qualifiers: EngineQualifierAST[];           // [clé:valeur] niveau règle (dont TempoOp)
  runtimeQualifier: RuntimeQualifierAST | null;  // face LIAISON dépliée plus bas ; reçoit .payload {containment, scope:'rule'} si `(…)` de règle
  line: number;
  mode?: RuleModeAST | null;                  // préfixe RND/LEFT/RIGHT ; null=défaut sous-gram
}
```

##### Gardes / flags / qualificateurs / tempo
```ts
type GuardOperator = '=='|'!='|'>'|'<'|'>='|'<='|'+'|'-';
interface GuardAST  { type:'Guard'; flag:string; operator: GuardOperator|null; value: number|string|null; mutates: boolean; }
type FlagOperator = '='|'+'|'-';
interface FlagExprAST { type:'FlagExpr'; flag:string; operator: FlagOperator|null; value: number|string|null; }
interface EngineQualifierAST { type:'EngineQualifier'; pairs: QualPairAST[]; tempoOp?: TempoOpAST|null; }
interface QualPairAST { type:'QualPair'; key:string; value: string|number|boolean; decrement?: number|null; }
interface TempoOpAST  { type:'TempoOp'; operator:'/'|'*'; value: number|string; scope?:'absolute'|'relative'; }
interface SuffixQualifierAST { type:'Qualifier'; pairs: QualPairAST[]; tempoOp?: TempoOpAST|null; } // suffixe APRÈS un RHS ; BPx ne lit que tempoOp
```
> Note : les états de drapeau nommés (`@flag scene: calm:1`) sont **résolus en entier DANS l'AST** par `annotateScene` (une garde `[scene==calm]` voit `value` → `1`) ; un ident non déclaré reste tel quel (fidèle BP3).

##### Union LHS — `LhsElementAST` (8 membres)
`SymbolAST`(`Sa`, `negated`) · `WildcardAST`(`?`) · `VariableAST`(`?N`, 1..32) · `ContextAST`(`(X Y)`/`#(X Y)`) · `TemplateAnchorAST`(`$` nu) · `RawBraceAST`(`) ( { } , + *`) · `RestAST`(`-` terminal gauche) · `ProlongationAST`(`_` terminal gauche).

##### Union RHS — `RhsElementAST` (27 membres, tous émis par le parser — vérifié)
`Symbol` · `SymbolCall` · `Rest` · `UndeterminedRest`(`_rest`) · `Prolongation` · `Period`(`.`) · `NumericDuration`(`N`/`N/M`) · `NilString`(`lambda`) · `RawBrace` · `OutTimeObject`(`!name`) · `Polymetric`(`{…,…}`, récursif) · `Wildcard` · `Variable` · `Homomorphism`(`|x|`) · `TemplateAnchor` · `TemplateMaster`(`$X`) · `TemplateMasterGroup`(`${…}`) · `TemplateSlave`(`&X`) · `TemplateSlaveGroup`(`&{…}`) · `Control`(`_goto`/`_repeat`/…) · `InstantControl`(`!(…)`/`![…]`) · `TieStart`(`Sa~`) · `TieContinue`(`~Sa~`) · `TieEnd`(`~Sa`) · `BacktickInline` · `BacktickStandalone` · `SimultaneousGroup`(`C4!E4`).

##### Atomes RHS/LHS — champs complets
```ts
interface SymbolAST       { type:'Symbol'; name:string; actor?:string|null; payload?:unknown; line?:number; negated?:boolean; suffixQualifiers?: SuffixQualifierAST[]|null; }
interface SymbolCallAST   { type:'SymbolCall'; name:string; actor?:string|null; args: unknown[]; payload?:unknown; line?:number; suffixQualifiers?: SuffixQualifierAST[]|null; }
interface RestAST            { type:'Rest';            payload?:unknown; suffixQualifiers?: SuffixQualifierAST[]|null; }
interface UndeterminedRestAST{ type:'UndeterminedRest'; payload?:unknown; suffixQualifiers?: SuffixQualifierAST[]|null; }
interface ProlongationAST    { type:'Prolongation';   payload?:unknown; suffixQualifiers?: SuffixQualifierAST[]|null; }
interface PeriodAST          { type:'Period'; line?:number; }
interface NumericDurationAST { type:'NumericDuration'; numerator:number; denominator:number; line?:number; }
interface NilStringAST       { type:'NilString'; line?:number; }   // ε
interface RawBraceAST        { type:'RawBrace'; value:string; qualifiers?: unknown[]; line?:number; }
interface OutTimeObjectAST   { type:'OutTimeObject'; name:string; payload?:unknown; line?:number; }
interface WildcardAST        { type:'Wildcard'; negated?:boolean; line?:number; }
interface VariableAST        { type:'Variable'; index:number; negated?:boolean; line?:number; }  // 1..32
interface ContextAST         { type:'Context'; negated:boolean; elements: LhsElementAST[]; line?:number; }
interface HomomorphismAST    { type:'Homomorphism'; name:string; line?:number; }   // marqueur inline RHS
interface TieStartAST    { type:'TieStart';    symbol:string; payload?:unknown; line?:number; }
interface TieContinueAST { type:'TieContinue'; symbol:string; payload?:unknown; line?:number; }
interface TieEndAST      { type:'TieEnd';      symbol:string; payload?:unknown; line?:number; }
// Gabarits (figés AST_SPEC.md:139-143, bpscript-bpx.md:19) — vérifiés au parser :
interface TemplateAnchorAST      { type:'TemplateAnchor'; kind:'master'; }                          // `$` nu (LHS+RHS) — parser.js:2030,2806
interface TemplateArgAST         { type:'Arg'; key:string|null; value:{type:'Literal'; value:number|string}; }
interface TemplateMasterAST      { type:'TemplateMaster'; name:string; args: TemplateArgAST[]|null; }  // `$X` / `$X(k:v)` — parser.js:2829
interface TemplateSlaveAST       { type:'TemplateSlave';  name:string; args: TemplateArgAST[]|null; }  // `&X` / `&X(k:v)` — parser.js:2869
interface TemplateMasterGroupAST { type:'TemplateMasterGroup'; elements: RhsElementAST[]; }            // `${…}` — parser.js:2800
interface TemplateSlaveGroupAST  { type:'TemplateSlaveGroup';  elements: RhsElementAST[]; }            // `&{…}` — parser.js:2846
```

##### Polymétrie (récursive) + accord
```ts
interface PolymetricAST { type:'Polymetric'; voices: RhsElementAST[][]; qualifiers: EngineQualifierAST[];
  runtimeQualifier: RuntimeQualifierAST|null;  // face LIAISON dépliée plus bas ; reçoit .payload {containment, scope:'group'} si `{…}(…)`
  label: string|null; line?:number; suffixQualifiers?: SuffixQualifierAST[]|null; }
interface SimultaneousGroupAST { type:'SimultaneousGroup'; primary: RhsElementAST; secondaries: RhsElementAST[]; line?:number; }
//   `!` infixe accolé = accord ; `!` suivi de `(…)` = flux (désambiguïsation au parse).
```

##### Voix de code (backticks — annotés par `bpxAst.annotateBackticks`)
```ts
interface BacktickInlineAST     { type:'BacktickInline'; code:string; tag?:string|null; _btName?:string; payload?:TokenPayload; line?:number; }
interface BacktickStandaloneAST { type:'BacktickStandalone'; tag:string; code:string; _btName?:string; payload?:TokenPayload; line?:number; }
interface BacktickOrphanAST     { type:'BacktickOrphan'; tag:string; code:string; line?:number; }  // section scene.backticks, HORS union RHS
//   _btName = `BT${tag||'auto'}${counter}` (compteur PROPRE, ordre du document).
//   payload = { nature:'code', interp }  — interp = tag explicite ('sc'/'py') sinon résolu via eval de l'acteur (sinon 'auto').
```

##### Contrôles + graine
```ts
interface ControlAST { type:'Control'; name:string; args: string[]; payload?:TokenPayload; line?:number; }
//   name garde l'underscore (`_goto`/`_repeat`). args = fragments bruts string.
//   payload.nature = 'engine-control' si name ∈ bp3NativeControls, sinon 'transport-control' (+ flux:true).
interface ProductionInlineDirectiveAST { name:string; value:number; }
interface ProductionInlineQualifierAST { type:'ProductionInline'; directives: ProductionInlineDirectiveAST[]; }
interface InstantControlAST { type:'InstantControl'; qualifier: unknown; conjoint?:boolean; payload?:TokenPayload; line?:number; }
//   qualifier = Qualifier(![…] engine) | RuntimeQualifier(!(…) runtime) | ProductionInline(![@seed:N]).
//   payload.nature = 'instant', flux:true, conjoint? (collé C4!(…) ancré / espacé séparé).
```

##### Qualificateur runtime `(…)` — face LIAISON dépliée (NON opaque)
Le `runtimeQualifier` (sur `RuleAST`, `PolymetricAST`, `InstantControlAST`) n'est **pas** un
sac opaque : sa face liaison est **figée** (`AST_SPEC.md §1.5`) et **réellement émise** par le
parser (`parser.js:2206-2216`). Chaque rattachement de signal à un paramètre est une **paire** :
```ts
interface RuntimeQualifierAST { type:'RuntimeQualifier'; pairs: CVLinkPairAST[]; payload?: TokenPayload; }
interface CVLinkPairAST {
  key:    string;            // paramètre lié, ex. 'cutoff'           (parser.js:2214)
  value:  string|unknown;    // le signal — peut NOMMER une voix sœur dérivable (résolue en aval)
  subject?: string;          // HORLOGE/destinataire : absent | '*' (par note) | '<terminal>' nommé
  line?: number; col?: number;
}
//   Détection sujet (parser.js:2206) : `*:cutoff:Env` → subject '*' ; `C2:cutoff:Env` → subject 'C2' ;
//   `cutoff:Env` → subject omis (défaut = la portée : règle/groupe). Réf pointée v0.8 `sound.X` acceptée.
//   payload posé sur le qualifier de RÈGLE/GROUPE : {nature:'transport-control', containment:true, scope:'rule'|'group', params?, address?}.
//   BPx PORTE ces paires opaquement et les RÉPLIQUE à la position réalisée de chaque occurrence ; il ne les interprète jamais.
```

##### Sections de tête — directives / acteurs / sons / CV / homo
```ts
interface DirectiveAST { type:'Directive'; name:string; subkey:string|null; value:number|string|null;
  line:number; fromEnvironment?:boolean; [extension]:unknown; }   // fromEnvironment:true = défaut env injecté
//   Précédence des directives de PRODUCTION (figée bpscript-bpx.md:37-39) : console/session > scène > défauts.
//   Surface `[@seed:1, @items:20]` (l'ancienne `@seed:N` est dépréciée douce) — MÊME forme AST (nœuds Directive), rien à changer côté consommateurs.
interface ActorDirective { type:'ActorDirective'; name:string;
  properties?: { alphabet?:string|null; scale?:string|null; sounds?:string|null;
                 transport?:{key:string; params:Record<string,unknown>}|null; eval?:string|null; }; // v0.7
  references?: ActorReference[];                  // v0.8
  assignments?: SoundAssignmentAST[]; soundAssignments?: SoundAssignmentAST[]|null;
  synthetic?: boolean;                            // true = acteur 'default' implicite (aucun @actor déclaré)
  line: number; }
interface ActorReference { type:'ActorReference'; category:'alphabet'|'tuning'|'transport'|'sound'|string;
  name:string; variant?:string|null; params?:Record<string,unknown>|null; line?:number; }
//   Défaut canal/destination d'un acteur = ActorReference.params de la réf category:'transport'.
interface SoundPrototypeAST  { type:'SoundPrototype'; symbol?:string|null; name?:string|null; config:Record<string,unknown>; line?:number; }
interface SoundAssignmentAST { type:'SoundAssignment'; scope:'scene'|'alphabet'|'actor'|'inline';
  alphabet?:string|null; actor?:string|null; subject:string;
  target: {kind:'named-ref';name:string} | {kind:'inline-props';props:Record<string,unknown>}; line?:number; }
interface DeclarationAST { type:'Declaration'; temporalType:'gate'|'trigger'|'cv'; name:string; runtime:string; line?:number; }
interface CVInstanceAST  { type:'CVInstance'; name:string; target?:string; transport?:string;  // target/transport LEGACY, jamais émis par la forme descriptive
  lib?:string|null; objectType?:string; args?:unknown[]; namedArgs?:Record<string,unknown>; code?:string; line?:number; }
interface HomomorphismDeclAST { type:'Homomorphism'; name:string; pairs: Array<[string,string]>; line?:number; }
```

##### Charge opaque par token — forme RÉELLEMENT émise (`TokenPayload`)
```ts
interface TokenPayload {
  nature: 'sounding'|'rest'|'prolongation'|'instant'|'transport-control'|'engine-control'|'code';
  actor?: string;                            // dot-notation (sitar.Sa) ou acteur de règle ; sinon OMIS (dispatcher résout)
  params?: Record<string, unknown>;          // overrides d'occurrence (contrôles vel/pan/wave…), DIFFÉRENT du défaut acteur
  address?: Record<string, unknown>;         // GAP#2 — tiroir DESTINATION {ch|channel|device|port} (ADDRESS_KEYS), lu par Kairos
  occurrence?: true;                         // marque présence d'un override d'occurrence (params ou address)
  flux?: boolean;                            // true sur InstantControl + transport-control standalone (filant, par acteur)
  conjoint?: boolean;                        // !(…) collé (ancré note précédente) vs espacé (événement séparé)
  containment?: boolean;                     // `(…)` de règle / `{…}(…)` de groupe : structurel, confiné (PAS flux)
  scope?: 'rule'|'group';                    // portée de la contenance
  interp?: string;                           // backticks : interpréteur ('sc'/'py'/eval acteur/'auto')
  [extension: string]: unknown;
}
```
Émission par nœud (`parser.annotateRhsNode`) :
- `Symbol`/`SymbolCall`/`OutTimeObject`/`Tie*` → `{nature:'sounding', actor?, params?, address?, occurrence?}` (flux ABSENT).
- `Rest`/`UndeterminedRest` → `{nature:'rest'}`. `Prolongation` → `{nature:'prolongation'}`.
- `Control` → `{nature:'engine-control'}` (si natif BP3) **ou** `{nature:'transport-control', flux:true}`.
- `InstantControl` → `{nature:'instant', flux:true, conjoint?}`.
- `rule.runtimeQualifier` (`(…)` de règle) → `{nature:'transport-control', containment:true, scope:'rule', params?, address?}`.
- `Polymetric.runtimeQualifier` (`{…}(…)`) → `{nature:'transport-control', containment:true, scope:'group', params?, address?}`.
- backticks (bpxAst) → `{nature:'code', interp}`.

BPx ne lit `nature` que pour SON ressort (durée nulle d'un `instant`, classement temporel) ; `params`/`address`/`transport` jamais inspectés (R2). Le sonore-vs-muet (audio) n'est pas de son ressort.

**Frontière INTERPRÈTE vs PORTE** (figée `AST_SPEC §3`, 8 aspects) — ce que BPx fait de chaque aspect :

| Aspect | BPx INTERPRÈTE | BPx PORTE (opaque, en ordre) |
|---|---|---|
| Classification temporelle (occupe/silence/prolongation) | oui — rôle `leaf`/`rest`/`prolongation`, durées/spans | — |
| Sonore vs muet (audio) | **non** (ni alphabet ni son) | délégué au dispatcher (prédicat par symbole) |
| Timing / polymétrie / liaisons | oui — phase, durées, `tieState` | — |
| Contrôle-moteur (`engine-control`) | oui — modes/flags/outils de dérivation | — |
| Instant `!(…)` | oui pour le `!` → durée nulle | le contenu `(…)` reste opaque |
| Destination de transport | non | oui — `payload.transport`/`address` |
| Paramètres de sortie (`params`) | non | oui — `payload.params` |
| Nature pour l'aval | lue seulement pour son ressort | oui — `payload.nature` transmise telle quelle |

#### 3.2.C — Frontière VOIES SECONDAIRES, chaque champ déplié

##### bp3ToScene.js

`bp3ToScene(grammarText, opts?)`
- `grammarText: string` — contenu complet d'un fichier `-gr.xxx` BP3.
- `opts?: { hoText?: string, hoKey?: string }` — `hoText` = contenu fichier `-ho.` compagnon ;
  `hoKey` = nom de l'homomorphisme (ex. `'tryhomomorphism'`).
- Retour SANS opts → `string` (rétrocompatibilité) : soit la source `.bps`, soit
  `"NON GÉRÉ: <description> (<contexte>)"`.
- Retour AVEC `opts.hoText && opts.hoKey` → `{ bps: string, transcriptionEntry: object }` ;
  `bps = "@transcription." + hoKey.replace(/-/g,'O') + "\n" + <bps généré>`.

`parseHoFile(hoText: string)` → `{ sections: Object<string, Object<string,string>> }`
- `sections[label]` : objet `{ [source]: cible }`. Champs dépliés :
  - label de section : `'*'` par défaut ; ligne nue (sans `-->`) ⇒ nouveau label.
  - paire : `a --> b` ⇒ `sections[label]['a'] = 'b'`.
  - chaîne : `a --> b --> c` ⇒ deux paires `(a→b)`, `(b→c)`.
  - ignorés : `V.x`, `Date:`, refs `-mi./-kb./-or./-se./-al./-ho.`, `//`, séparateurs `-{5,}`,
    `sync …`, lignes vides ; sections finales vides supprimées.

`transcriptionEntry` (= sortie de `parseHoFile`) : `{ sections: { [label:string]: { [src:string]: tgt:string } } }`.

Constantes/maps internes de la frontière (formes exactes) :
- `BP3_TO_BPS_MODE`: `{RND:'random',ORD:'ord',LIN:'lin',SUB:'sub',SUB1:'sub1',TEM:'tem',POSLONG:'poslong'}`.
- `BP3_TO_BPS_ARROW`: `{'-->':'->','<--':'<-','<->':'<>'}`.
- `BP3_CONTROL_MAP`: `Map` token BP3 `_xxx` → `{ bps:string, kind:'runtime'|'engine', noArg:boolean }`.
  Construite depuis `lib/controls.json` : runtime = `'_'+clé` (noArg = `!def.args.length`) ;
  engine = `def.bp3` explicite, ajouté seulement si non déjà présent (runtime prioritaire) ;
  exclus : `script`, `_comment`.
- `emitCallForm(bp3Name,args)` → `def.bps` (noArg, args vide) | `def.bps+"()"` | `def.bps+"("+args.trim()+")"`.
- `convertRuntimeControlToBPS(tok)` → `'(name:val)'` | `'(name:1)'` (no-arg) | `'(name:0)'` (args vide) | `null`.

Sortie BPS — formes de chaque construction gérée (étalon en-tête, vérifiées au code) :
- Modes : `@mode:<bpsMode>` ou `@mode:<bpsMode>(<modifiers>)` (modifiers issus du preamble).
- Poids `<N>`/`<N-D>`/`<inf>`/`<KN=N>` → suffixe `[weight:N]` / `[weight:N-D]` / `[weight:inf]` / `[weight:K..]`.
- Scan `LEFT`/`RIGHT` → suffixe `[scan:left]` / `[scan:right]`.
- Gardes LHS `/flag=N/` (test) → `[flag==N]` ; `/flag+N/ /flag-N/` (mutation) → `[flag+N] [flag-N]` ;
  garde nue `/flag/` → `[flag]` ; opérateurs `≥≤≠><` → `>= <= != > <`.
- Flags RHS `/flag=N/` (mutation) → `[flag=N]` ; `/flag+N/ /flag-N/` → `[flag+N] [flag-N]`.
- Flèches `--> <-- <->` → `-> <- <>`.
- Séparateurs `-----` (≥4 tirets) → `-----` inter-sous-grammaires.
- Preamble `_mm(N) _striated _smooth _destru _randomize` → modificateurs `mm:N striated smooth destru randomize` ;
  `INIT:` ligne ignorée.
- Templates `(=X)`/`(:X)` → `$X`/`&X` (forme courte) ou `${…}`/`&{…}` ; ancre nue `(= X Y` non fermée → `$ X Y` (maître) ; `(: …` esclave RÉSERVÉE non implémentée → NON GÉRÉ en LHS.
- Variables `|x|`, wildcards `? ?1`, contextes `(A B)` et `#X`, lambda `nil`, silence `-`, prolongation `_` → verbatim.
- Polymétrie `{N,A B}` : champs convertis indépendamment — liés `X&`→`X~`, `&X`→`~X` ; prolongations collées `X__`→`X _ _`, `____`→`_ _ _ _` ; alias tirets `dhin--`→`dhinOO` ; contrôles en mode appel.
- Opérateurs nus `+ ; *` → `plus fin star`.
- Préfixe de mètre `N+N/M` → suffixe `[meter:N+N/M]`.
- BOLSIZE : terminal >30 chars → alias `<24 premiers>X<NNN>` (déterministe, sans collision) + commentaire d'en-tête `// BOLSIZE aliases …`.

Contrôles BP3 de `lib/controls.json` — deux régimes (décidés par `decideRhsControlMode`) :
- `legacy` (E2/E3/E3bis) : contrôles runtime convertibles UNIQUEMENT en tête du RHS (sans trailing,
  sans `{…}`) → suffixe de règle `(ctrl:val[, ctrl2:val2])`.
- `call` (E4) : un contrôle en position trailing/milieu/`{…}` OU un contrôle engine → forme appel
  positionnelle `ctrl(args)` à la position exacte ; décision au niveau GRAMMAIRE (dès qu'une règle
  est en appel, TOUTES le sont) ⇒ la scène émet `@controls` en tête.
- `_srand(N) _rndseq` (tête de groupe `{…}` à une voix) → `![@seed:N]` posé avant le groupe +
  qualifier `[shuffle]` (décision 2026-06-14) ; `_rndseq` seul → `[shuffle]`.
- Opérateur tempo absolu `/N` (ou `/N/M`) dans RHS → qualifier `[/N]` collé à l'élément suivant (E5).

NON GÉRÉ (retour `"NON GÉRÉ: …"`, par grammaire) — déclencheurs exacts :
- pas de flèche ; flèche imbriquée dans template non fermé.
- LHS : ancre esclave `(:` nue ; `/N` ou `\N` ; caractère BP2 `¥ § © ® ™ ° ³`.
- garde : caractère BP2 ; valeur arithmétique `K1=K1+K2`.
- RHS : argument de contrôle non parsable en forme appel ; contrôle engine absent de controls.json
  (`ENGINE_CTRL_RHS_RE` : `_vel _chan _script _rotate _retro _shuffle _rndseq _goto …`) ;
  `\N` (non tokenisé par BPScript) ; durée multiplicative `N/N/N` (≥3 segments, après strip du mètre) ;
  prolongation liée `_&` ; caractère BP2 ; chaîne entre guillemets doubles `"` ; guillemet typographique
  `' ' " " « » ‹ ›`.
- mode BP3 inconnu ; `validateCallFormControls` échoue quand le mode appel est imposé par une autre règle.

##### orderTokens.js

`tokenizeOrder(canonical: string)` → `string[]`
- `canonical: string` — contenu brut de la sortie native `-o` (généralement une ligne).
- Retour : liste ORDONNÉE de jetons sonnants. Balayage gauche→droite, 3 classes :
  1. **séparateur** — un de `SEPARATORS = {' ', '\t', '\n', '\r', '{', '}', '&', '/', ','}` → ignoré (découpe, non émis).
  2. **contrôle** — `_` + identifiant `[A-Za-z][A-Za-z0-9]*` + groupe `( … )` à parenthèses équilibrées
     optionnel → UN jeton entier (ex. `_pitchrange(200)`, `_transpose(-2)`, `_pitchcont`) ; les `/` et `,`
     internes sont protégés (groupe consommé AVANT le découpage).
  3. **jeton sonnant** — suite maximale de caractères hors séparateur, coupée aussi à un `_`+lettre
     démarrant un contrôle (ex. `a`, `A2`, `do`, `-`, `.`, `_`, `4+4+4+4`, `(=`, `(:`, `)`).
- `export default tokenizeOrder`.

### 3.3 — Accord des deux bords

#### 3.3.B — Frontière SORTIE : code BPScript ↔ étalon `AST_SPEC v1.2` ↔ consommateur réel BPx

**Conforme / aligné ✅ :**
- Union RHS (27) et LHS (8), atomes, ties, polymétrie, accord, gabarits, sections de tête, homomorphismes (dépliés, identité conservée), `TempoOp.scope`, graine `![@seed:N]` restreinte à `seed`, exclusion de `_(…)`, hors-union `TriggerIn`/`SymbolWithTriggerIn` : **émis tels que figés** par l'étalon et consommés par `loadGrammar` (frontière A §3.2.A). Vérifié : tous les `type:` de l'union sont effectivement émis par `parser.js`.
- `containment` + régime structurel/séquentiel : aligné sur `AST_SPEC §4.1` (décision 2026-06-20) ; le `flux:true` jadis posé sur un `(…)` nu est bien **corrigé** en `containment`.

**Écarts signalés (à porter à l'attention de l'architecte) 🔶/❓ :**
1. **`payload.transport` (étalon) vs `payload.address` + `occurrence` (code) — ÉCART DE FORME.** `AST_SPEC §2` documente `transport?: string` (override de destination, chaîne plate). Le transpileur **n'émet PAS** `transport` : il range l'override d'occurrence en **deux tiroirs** — `address: {ch|channel|device|port}` (objet, GAP#2, lu par **Kairos** pour matérialiser `event.output`) + `params` (contrôles) — et pose `occurrence:true`. Le consommateur réel BPx s'aligne déjà dessus (producer-side `BPscript/docs/arch/contrat-DRAFT.md:44` liste `payload{nature, actor?, params?, address?, interp?, occurrence?}`). **L'étalon `AST_SPEC §2` reste à amender** (le `transport?: string` y est encore décrit comme « syntaxe non définie, backlog A2 »).
2. **`payload.nature:'code'` (backticks) HORS énumération de l'étalon.** L'enum `TokenPayload.nature` d'`AST_SPEC §2` = `sounding|transport-control|engine-control|instant|prolongation|rest` ; et `§4` classe la voix de code en `sounding`. Le code émet réellement `nature:'code'` (KAI-9, `bpxAst.js:52`, point de bascule aligné BPx+Kairos). **Écart enum à entériner** dans l'étalon (additif).
3. **`payload.scope:'rule'|'group'`** sur la contenance : champ producteur additif non listé explicitement dans l'enum de `§4.1` (qui décrit la contenance par profondeur). Additif compatible.
4. **Défauts d'environnement injectés DANS l'AST** (`applyEnvironmentDefaults` → `@mm` avec `fromEnvironment:true` ; `applyDefaultActor` → acteur `default` `synthetic:true`, transport `audio`) : faits de SORTIE réels (LAN-5/KAI-9) **absents de l'étalon `AST_SPEC`**. À documenter (le `DEFAULT_ACTOR_TRANSPORT='audio'` est une constante TODO à déplacer en conf Kanopi).
5. **En-tête `index.js:7` périmé** : décrit encore `compileToBPxAST → {ast, backticks, flagStates, libraries}`. La sortie réelle est `{ast, errors, warnings}` (`bpxAst.js:180`). Commentaire à corriger (déjà flaggé dans le brouillon producteur). **Vérifié au code** : `index.js:7` dit bien `{ ast, backticks, flagStates, libraries, … }`, `bpxAst.js:180` renvoie `{ ast, errors, warnings }`.
6. **`scene.backticks` (`BacktickOrphanAST`)** : section de scène émise (voix de code standalone de tête), **hors union RHS** de `§1.3` ; voyage opaque via `[extension]`. À mentionner dans l'étalon.

#### 3.3.C — Frontière VOIES SECONDAIRES : code ↔ étalon (en-tête) ↔ consommateur réel

| Point | Étalon (en-tête) | Code réel | Consommateur réel | Verdict |
|---|---|---|---|---|
| `tokenizeOrder` signature/sémantique | en-tête orderTokens (POURQUOI/QUOI/COMMENT) | conforme ligne par ligne | `order_parity.mjs` (canonique `-o` natif vs snapshots WASM) | ACCORD |
| Séparateurs `{ } & / ,` | listés en-tête | `SEPARATORS` identique | runtime texte Kanopi (hors dépôt) à coordonner ICI | ACCORD code↔étalon ; consommateur 2 non vérifiable dans le dépôt |
| `bp3ToScene` modes/poids/scan/gardes/flèches/séparateurs | en-tête « Constructs gérés » | conforme | tests `test_bp3_to_scene.cjs`, `test_bolsize_alias.js` | ACCORD |
| Opérateurs tempo `/N \N` | en-tête : `/N \N` listés NON GÉRÉS | code E5 : `/N`→`X[/N]` (GÉRÉ), seul `\N` bloque | tests | **ÉCART** : en-tête périmé (dit `/N` non géré alors qu'il l'est) |
| `_srand` | en-tête : `_srand` listé NON GÉRÉ | code : `_srand(N)`→`![@seed:N]`+`[shuffle]` (GÉRÉ) | tests | **ÉCART** : en-tête périmé |
| Sections `TEMPLATES:` / `TIMEPATTERNS:` | en-tête : NON GÉRÉ | collectées en segments mais NON émises (bloc no-op) | tests | ACCORD (différé, jamais émis) |
| Place dans le flux | — | `bp3ToScene` = île ; aucun importeur interne | UNIQUEMENT tests | conforme `contrat-DRAFT` (INVERSE = outil) + anomalie #2 carte-reel |
| `orderTokens` importeurs | en-tête : 2 consommateurs | 0 importeur de production | seul `order_parity.mjs` (1 des 2) ; runtime Kanopi hors dépôt | conforme anomalie #1 « module pendant » ; statut garder/exporter/retirer = ❓ à arbitrer (contrat-DRAFT) |

Écarts à corriger (documentaires, non bloquants) : en-tête bp3ToScene lignes 36-37 et 35 — retirer
`/N` et `_srand` de la liste « NON GÉRÉS » (le code les gère désormais : E5 et `extractGroupSeqPrefix`).

#### 3.3.A — Frontière ENTRÉE : accord

- **Conforme ⚙️** : l'environnement est lu UNE FOIS à la transpilation et n'altère jamais l'AST a posteriori (Kanopi ne mute pas l'arbre). Aligné sur la loi cross-repo « Kanopi ne touche jamais l'AST ».
- **Écart ❓** : le transport par défaut d'un acteur synthétique est une constante en dur côté hôte (`DEFAULT_ACTOR_TRANSPORT='audio'`, marquée TODO), pas encore lue depuis la conf éditable Kanopi (LAN-5). Décision Romain.

---

## 4. Topologie voulue 🔶

**Cible :** la voie propre est un **DAG strict frontal→résolution**, étanche au legacy BP3, sans table parallèle.

```
FRONTAL_AST ───────────────► RESOLUTION
 tokenizer→parser→bpxAst       actorResolver, libs(+libs-data), controlValidation, modulationValidation
 index (façade), constants

   (héritage, isolé — voie compileBPS uniquement)
SORTIE_BP3 : encoder, prototypes, orderTokens
INVERSE_BP3 : bp3ToScene
OUTILLAGE : scripts CLI/tests/bundle (points d'entrée)
```

Règles de forme voulues :
- **Une source unique = l'arbre.** Zéro table latérale dans la voie propre (les vues redondantes backticks/flagStates/libraries de l'encodeur BP3 sont supprimées de cette voie ; tout vit dans les nœuds/directives).
- **`bpxAst.js` n'importe que FRONTAL + RESOLUTION** (`tokenizer`, `parser`, `libs`, `controlValidation`, `modulationValidation`) — jamais SORTIE_BP3.
- **OUTILLAGE n'est jamais importé par le cœur** (frontal + résolution + encoder). Garde `core-no-tooling`.
- **Zéro cycle.** Garde `no-circular`.

**Écarts connus de la cible (à confronter, pas à trancher seul) ❓ :**

| Écart | Constat | Direction voulue |
|---|---|---|
| `orderTokens.js` pendant | aucun importeur dans le dépôt ; deux consommateurs hors dépôt visés (oracle texte, runtime texte Kanopi) | confirmer la consommation hors périmètre, sinon retirer (code mort) |
| `bp3ToScene.js` île (1954 L) | sens inverse, atteint seulement par tests | garder hors flux principal ; statut à acter (vivant utilitaire vs. à archiver) |
| `constants.js` partagé | table d'opérateurs BP3 importée par `parser` (FRONTAL) ET `encoder` (SORTIE_BP3) → flèche `SORTIE_BP3→FRONTAL` | arbitrer le placement (infra partagée neutre vs. legacy BP3) — la part BP3 ne doit pas remonter dans le frontal propre |
| Défauts EN DUR côté hôte | `DEFAULT_ACTOR_TRANSPORT = 'audio'` constante marquée TODO | LAN-5 : lire depuis la conf éditable Kanopi (décision Romain) |

---

## Invariants vérifiables MACHINE (règles du garde) ⚙️

Lois **structurelles** seulement (le sémantique reste la relecture de Romain). Config `.dependency-cruiser.cjs` à la racine, branchée sur `npm run arch` (BPS-10 fermé).

| Invariant | Énoncé machine | Statut |
|---|---|---|
| `no-circular` | aucune dépendance circulaire dans `src/transpiler/**/*.js` | respecté (0 cycle) |
| `bpx-clean-no-bp3` | `bpxAst.js` ne dépend pas de `encoder.js` / `prototypes.js` / `orderTokens.js` | respecté |
| `core-no-tooling` | le cœur (`tokenizer`, `parser`, `bpxAst`, `index`, `constants`, `actorResolver`, `libs`, `encoder`) n'importe aucun script CLI/test (`compare`, `show-diffs`, `test`, `validate`, `validate-all`, `validate-wasm`, `libs-bundle`) | respecté |

**Preuve que le garde mord** (déjà établie) : vert sur le code actuel (`✔ 0 violations, 25 modules`) ; injection d'un import `bpxAst→encoder` → `error bpx-clean-no-bp3`, exit=1 ; retrait → re-vert. Donc il capture toute rechute à la frontière BPx-only.

**Candidats d'invariants à ajouter (proposés, à ratifier) 🔶 :**
- **Zéro orphelin** : tout fichier de code rangé dans exactement un bloc (règle `no-orphans` dependency-cruiser), pour figer la preuve « 21/21 rangés ».
- **`no-ast-bp3-leak`** : interdire les motifs BP3 (`_xxx(N)`, `flavor:'bp3'`…) dans les sorties de `bpxAst.js` — invariant **sémantique**, donc à porter par un détecteur dédié + relecture Romain, pas par dependency-cruiser.

---

## 5. Écarts code ↔ contrat

Consolidation des écarts surfacés en §3.3 et §4. Aucun n'est tranché ici : la **forme** est figée par ce cadre, le **sens** et les **arbitrages** reviennent à Romain / à l'architecte.

| # | Écart | Côté code (réel) | Côté contrat/étalon | Direction | Marquage |
|---|---|---|---|---|---|
| E1 | override de destination | `address:{ch\|channel\|device\|port}` + `params` + `occurrence:true` (`bpxAst`/`parser`) | `AST_SPEC §2` décrit `transport?:string` (« syntaxe non définie, backlog A2 ») | amender l'étalon ; BPx déjà aligné | ❓ Romain (amender AST_SPEC) |
| E2 | enum `nature` | émet `nature:'code'` pour backticks (`bpxAst.js:52`) | enum étalon sans `'code'` ; `§4` classe en `sounding` | entériner additif `'code'` | ❓ Romain (additif) |
| E3 | `payload.scope` | `scope:'rule'\|'group'` sur la contenance | non listé explicitement dans l'enum `§4.1` | additif compatible à documenter | 🔶 proposé |
| E4 | défauts injectés DANS l'AST | `@mm fromEnvironment:true` ; acteur `default synthetic:true`, transport `'audio'` | absents de `AST_SPEC` | documenter ; déplacer `DEFAULT_ACTOR_TRANSPORT` en conf Kanopi | ❓ Romain (LAN-5) |
| E5 | en-tête `index.js:7` périmé | sortie réelle `{ast, errors, warnings}` (`bpxAst.js:180`) | commentaire dit `{ast, backticks, flagStates, libraries}` | corriger le commentaire | ⚙️ correction documentaire |
| E6 | `scene.backticks` | section `BacktickOrphanAST` émise (voix de code de tête) | hors union RHS `§1.3` ; non mentionnée | mentionner dans l'étalon (voyage opaque `[extension]`) | 🔶 proposé |
| E7 | en-tête `bp3ToScene` `/N` | code E5 gère `/N`→`X[/N]` | en-tête liste `/N` en NON GÉRÉ | retirer `/N` de la liste (lignes 36-37) | ⚙️ correction documentaire |
| E8 | en-tête `bp3ToScene` `_srand` | code gère `_srand(N)`→`![@seed:N]`+`[shuffle]` | en-tête liste `_srand` en NON GÉRÉ | retirer `_srand` de la liste (ligne 35) | ⚙️ correction documentaire |
| E9 | `orderTokens.js` pendant | 0 importeur de production ; 1 des 2 consommateurs déclarés présent (`order_parity.mjs`) | en-tête annonce 2 consommateurs | confirmer le consommateur hors dépôt (runtime texte Kanopi), sinon retirer (code mort) | ❓ Romain (garder/exporter/retirer) |
| E10 | `bp3ToScene.js` île | atteint seulement par tests, aucun importeur interne | `contrat-DRAFT` : INVERSE = outil | acter le statut : vivant utilitaire vs. archiver | ❓ Romain |
| E11 | `constants.js` partagé | table d'opérateurs BP3 importée par `parser` (FRONTAL) ET `encoder` (SORTIE_BP3) | crée une flèche `SORTIE_BP3→FRONTAL` | arbitrer le placement (infra neutre vs. legacy) ; la part BP3 ne doit pas remonter dans le frontal | ❓ Romain |

---

## Questions Romain ❓

1. **Override de destination (E1)** — entériner que le transpileur émet `address:{…}` + `params` + `occurrence:true` (et JAMAIS `transport:string`), et faire **amender `AST_SPEC §2`** en conséquence (le `transport?:string` y reste décrit comme backlog A2). BPx est déjà aligné côté consommateur.
2. **Voix de code `nature:'code'` (E2)** — entériner l'ajout additif de `'code'` à l'enum `TokenPayload.nature` de l'étalon (point de bascule KAI-9 déjà aligné BPx+Kairos).
3. **Défauts injectés dans l'AST + transport en dur (E4)** — valider que les défauts d'environnement (`@mm fromEnvironment`) et l'acteur `default` synthétique appartiennent à la **forme de sortie** (donc à documenter dans l'étalon) ; et trancher LAN-5 : déplacer `DEFAULT_ACTOR_TRANSPORT='audio'` (constante TODO) vers la **conf éditable Kanopi**.
4. **`orderTokens.js` (E9)** — confirmer/infirmer le second consommateur hors dépôt (runtime texte Kanopi). S'il est confirmé : garder + exporter. Sinon : retirer (code mort).
5. **`bp3ToScene.js` (E10)** — acter le statut de l'île sens-inverse : **vivant utilitaire** (gardé hors flux, couvert par tests) ou **à archiver**.
6. **`constants.js` partagé (E11)** — arbitrer le placement de la table d'opérateurs partagée entre `parser` (frontal propre) et `encoder` (legacy BP3) : infra neutre extraite, ou rester côté legacy ? La part BP3 ne doit pas remonter dans le frontal propre.
7. **Sections opaques (E6)** — confirmer que `scene.backticks` (voix de code standalone de tête) et les autres sections `[extension]` (scenes/exposes/maps/aliases/labels/macros/flagStates) restent **opaques** et hors union RHS, à mentionner pour mémoire dans l'étalon.

> Note de garde : tout ce qui touche la **sémantique du langage** (sens d'une forme, ajout d'enum signifiant, comportement de dérivation) se valide avec Romain ; le présent cadre fige la **forme** et les **frontières**, jamais le sens.

