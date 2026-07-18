# BPScript — Grammaire EBNF

Version 0.8 — dérivée de BPSCRIPT_VISION.md et validée par 44 traductions de
scènes BP3. v0.8 ajoute `sound_section`, `sound_assignment`, renomme
`@templates` → `@template`, et étend `actor_decl` pour la notation `.` sur les
références d'entités (`alphabet.X`, `tuning.X`, `transport.X`, `sound.X`). Cf.
`docs/design/v0.8-decisions-final.md` pour les décisions verrouillées.

Notation : ISO 14977 (`=` définition, `,` concaténation, `|` alternative,
`[ ]` optionnel, `{ }` répétition 0+, `+` répétition 1+, `"..."` littéral,
`(* ... *)` commentaire).

---

## Couche 1 — Structure globale

```ebnf
scene       = { directive | actor_directive | scene_directive | expose_directive
              | map_directive | cc_directive | duration_directive
              | macro_directive | alias_directive | label_directive
              | sound_section
              | declaration | cv_instance | macro
              | backtick_orphan | comment | blank_line }
              , subgrammar+ , [ template_section ] ;

actor_directive  = "@" , "actor" , IDENT , actor_body ;

(* v0.8 : les actor_props bascule de `:` à `.` pour les références d'entités
   (alphabet, tuning, transport, sound). Les affectations à un sujet (note ou
   *) utilisent toujours `:` (sound_assignment). Voir actor_body. *)
scene_directive  = "@" , "scene" , IDENT , STRING ;        (* @scene verse "verse.bps" *)
expose_directive = "@" , "expose" , ( "[" , IDENT , "]" )+ ; (* @expose [intensity] [energy] *)
cc_directive     = "@" , "cc" , [ ":" ] , cc_pair , { "," , cc_pair } ; (* @cc breath:2, expression:11 *)
duration_directive = "@" , "duration" , ":" , ( INT | FLOAT ) , [ "b" | "s" ] ; (* @duration:16b, @duration:4.5s *)
macro_directive  = "@" , "macro" , IDENT , [ "(" , IDENT , { "," , IDENT } , ")" ]
                 , "=" , rhs ;                 (* @macro kick = (vel:120), @macro accent(x) = x(vel:120) *)
alias_directive  = "@" , "alias" , IDENT , "=" , map_endpoint ;  (* @alias breath = cc:2 *)
label_directive  = "@" , "label" , IDENT ;     (* @label groove *)
map_directive    = "@" , "map" , map_endpoint , map_arrow , map_endpoint ;

cc_pair    = IDENT , ":" , INT ;               (* breath:2 — nom:numéro CC *)
map_arrow  = "->" | "<->" | "<-" ;
map_endpoint = "cc" , ":" , INT , [ "(" , kv_pairs , ")" ]      (* cc:74, cc:1(min:0,max:100) *)
             | "osc" , ":" , ( "/" , IDENT )+ , [ "(" , kv_pairs , ")" ] (* osc:/sc/ready *)
             | "<!" , IDENT                                      (* <!trigger *)
             | "[" , IDENT , "]"                                 (* [flag] *)
             | "sys" , "." , IDENT                               (* sys.play — commande transport *)
             | IDENT , "." , IDENT                               (* scene.command ou actor.flag *)
             | IDENT ;                                           (* alias CC nommé *)

kv_pairs = kv_pair , { "," , kv_pair } ;
kv_pair  = IDENT , ":" , ( INT | FLOAT | IDENT ) ;

```

- `directive` — imports et configuration globale (`@...`)
- `declaration` — déclaration de terminal (type + runtime)
- `cv_instance` — instanciation d'objet CV/signal
- `macro` — définition de macro (réécriture textuelle)
- `backtick_orphan` — code externe taggé au top-level
- `subgrammar` — bloc de règles, au moins un requis

### `directive`

```ebnf
directive = "@" , directive_body ;

directive_body = IDENT                              (* @core, @controls *)
               | lib_provenance_ref                 (* @factory.<chemin>.<entrée> / @mine.<chemin>.<entrée> — voir §lib_provenance_ref *)
               | IDENT , "." , IDENT                (* @alphabet.western — subkey access *)
               | IDENT , ":" , IDENT                (* binding simple générique ; @routing SUPPRIMÉ 2026-07-16, rejeté au parse *)
               | IDENT , "." , IDENT , ":" , IDENT  (* @alphabet.western:audio — subkey + sortie de l'acteur
                                                       implicite. LISTE POSITIVE FERMÉE {audio, midi, osc}
                                                       (addendum ratifié Romain 2026-07-16) : tout autre suffixe
                                                       (:sc, :video, :foo…) = rejet fail-loud. L'ancien sucre
                                                       ':sc' (= transport+eval sc) et la forme longue
                                                       '(transport=x, eval=y)' (jamais implémentée) sont ABOLIS. *)
               | IDENT , ":" , value                (* @tempo:120, @meter:3/4 — VALEUR uniquement *)
               (* CUTOVER graphie UNIVERSEL (Romain 2026-07-14, tour [412]) : quand IDENT est un
                  AXE À CATALOGUE (core.json schema.catalogAxes = alphabet | tuning | octaves | scale),
                  la forme `IDENT ":" …` est REJETÉE (fail-loud) — un axe-composant se NOMME avec `.`
                  (`@alphabet.western`, `@scale.bilaval`). Le `:` reste réservé aux VALEURS
                  (@tempo:120, @diapason:432, @meter:3/4). Garde anti-dérive :
                  test/test_catalog_axes_colon_reject.js. *)
               | "+"                                (* @+ — append to previous subgrammar *)
               | IDENT , "(" , alias_list , ")"     (* @alphabet.western(A:La) — résolution conflit *)
               | "actor" , IDENT , actor_body       (* @actor sitar alphabet.sargam ... — v0.8, voir actor_directive *)
               | "sound" , [ "." , IDENT , [ ":" , IDENT ] ] , NEWLINE , sound_entry+
                                                    (* @sound | @sound.libname — v0.8, voir sound_section *)
               | "template" , NEWLINE , template_entry+
                                                    (* @template — v0.8, voir template_section *)
               | "scene" , IDENT , STRING           (* @scene verse "verse.bps" — voir scene_directive *)
               | "expose" , ( "[" , IDENT , "]" )+  (* @expose [intensity] — voir expose_directive *)
               | "cc" , [ ":" ] , cc_pair , { "," , cc_pair }  (* @cc breath:2 — voir cc_directive *)
               | "map" , map_endpoint , map_arrow , map_endpoint  (* @map cc:1 -> [x] — voir map_directive *)
               | "duration" , ":" , ( INT | FLOAT ) , [ "b" | "s" ]  (* @duration:16b — voir duration_directive *)
               | "timepatterns" , ":" , tp_pair , { "," , tp_pair }  (* @timepatterns: t1=1/1, t2=3/2 *)
               | "flag" , IDENT , [ ":" ] , flag_state , { "," , flag_state }  (* @flag scene: calm:1, full:2 *)
               | "library" , "." , IDENT , STRING   (* @library.strudel "dirt-samples" — librairie de runtime liée au moteur *)
               ;

flag_state = IDENT , ":" , INT ;  (* alias d'état → valeur entière du drapeau (A5) *)

(* Invocation de librairie par PROVENANCE (décision hub ef75ec6 ; contrat bpscript-bpx.md §libRefs).
   Une librairie = un FICHIER qui DÉCLARE son domaine dedans ; l'invocation nomme provenance +
   chemin-de-fichier + entrée (DERNIER segment = entrée ; le milieu = chemin). Le domaine n'est PAS
   dans l'adresse (Kairos le lit — L27). `factory`/`mine` sont des préfixes RÉSERVÉS. Émis dans le
   canal NEUTRE `Scene.libRefs` (adresse canonique opaque), PAS un slot legacy.
       @factory.alphabet.sargam        (factory explicite → normalisé au nu `alphabet.sargam`)
       @mine.ragas.mes-svaras.sa       (perso → `mine.ragas.mes-svaras.sa`)
   Le nom nu `@alphabet.sargam` (sans préfixe) reste le SUCRE FACTORY legacy — cf. directive_body,
   il n'entre PAS dans lib_provenance_ref. *)
lib_provenance_ref = ( "factory" | "mine" ) , "." , path_seg , "." , path_seg , { "." , path_seg } ;
                     (* ≥ 2 segments après la provenance : au moins <fichier>.<entrée>.
                        PAS de suffixe de sortie (contrairement au binding CANON `@alphabet.X:<sortie>`,
                        directive_body ci-dessus) : le raccord de SORTIE d'une scène @mine/@factory
                        passe par un ACTEUR EXPLICITE, jamais par la réf de provenance. Décision
                        Romain 2026-07-13 (hub/decisions/2026-07-13-invocation-librairies-factory-mine
                        §Raccord sortie). Voir la note ci-dessous. *)
path_seg = ( IDENT | INT ) , { IDENT | INT } ;
           (* un segment recolle des IDENT/INT collés : tiret (`mes-` + `svaras`) ET entrée
              NUMÉRIQUE (`12` + `TET` → `12TET` ; `22shruti`) — les accordages commencent
              souvent par un chiffre. *)
```

> **Raccord de SORTIE d'une scène `@mine`/`@factory` (canonique, décision Romain 2026-07-13,
> `hub/decisions/2026-07-13-invocation-librairies-factory-mine.md §Raccord sortie).** Une réf de
> provenance nomme une **librairie de hauteur** ; elle ne porte **PAS** de sortie. Le raccord audio
> passe par un **ACTEUR EXPLICITE** — `@actor voice transport.audio` puis `@mine.ragas.sargam`
> (la hauteur vient du libRef, résolue par Kairos ; le transport vient de l'acteur). Aucune nouvelle
> syntaxe : cette voie parse déjà. Le binding de sortie CANON `@alphabet.X:<sortie>` (transport de
> l'acteur implicite, décision 2026-07-16 — règle DISTINCTE qui coexiste) **n'est pas** étendu à la
> provenance (séparation propre « lib de hauteur » vs « sortie » ; aucun
> contact avec le contrat co-signé `libRefs` ni la règle acteur-unique). Une scène `@mine` **nue**
> (sans acteur) retombe sur le transport par défaut `audio` (natif) — **muet dans le player web, et
> c'est VOULU** : l'auteur déclare sa sortie explicitement.

```ebnf

(* Convention de nommage (B5) : un nom de ressource est un IDENT, OU une chaîne "..." quand il
   porte des caractères spéciaux (tiret) ou désigne une ressource externe. Ex. `@library.strudel
   "dirt-samples"` (banque externe). La résolution du nom est faite en aval (Kanopi/workspace). *)

tp_pair = IDENT , "=" , INT , "/" , INT ;  (* t1=1/1 — nom = numérateur/dénominateur *)

actor_body  = { actor_prop | sound_assignment } ;

actor_prop  = actor_alphabet_binding                (* CANON : @alphabet.<nom> *)
            | actor_entity_ref                      (* CANON : tuning.X, octaves.X, transport.X(...), sound.X *)
            | actor_eval_binding ;                  (* v0.8 : eval.X (référence à un eval runtime) *)

(* CANON DE GRAPHIE — décision hub 2026-06-26 (« . APPELLE un composant / : AFFECTE une valeur »)
   étendue aux bindings d'acteur (ratifiée Romain 2026-07-13, CUTOVER 2026-07-14 tour [411]) :
   TOUT composant se nomme avec `.`. Un transport prend des params (canal/device) → c'est un
   COMPOSANT, pas une valeur.
     - alphabet  = @alphabet.<nom>       — sucre FACTORY legacy (fichier `alphabet`, entrée <nom>)
                                           → properties.alphabet, canal legacy résolu au compile.
                                           Les provenances @factory./@mine. NE se posent PAS sur la
                                           ligne d'acteur : une hauteur perso est un libRef de SCÈNE
                                           + un acteur transport-seul (§lib_provenance_ref, décision
                                           2026-07-13 §Raccord sortie).
     - transport = transport.<canal>(…)  — le `.` appelle le composant ; params entre () = adresse.
   CUTOVER (Romain 2026-07-14, ZÉRO rétrocompat) : les formes d'ENTITÉ en `:` (`alphabet:X`,
   `transport:X`, `tuning:X`, `octaves:X`, `sound:X`, `eval:X`) sont REJETÉES (fail-loud, message
   pointant le canon `.`). Le `:` n'affecte QUE des valeurs (SCENE_VALUES, `sujet:sound.X`). *)

actor_alphabet_binding  = "@" , "alphabet" , "." , IDENT ;   (* forme nue `alphabet.<nom>` équivalente *)

actor_entity_ref = ACTOR_ENTITY_KEY , "." , IDENT , [ "(" , kv_pairs , ")" ] ;  (* transport.midi(ch:3) *)

ACTOR_ENTITY_KEY = "alphabet" | "tuning" | "octaves" | "transport" | "sound" | "eval" | "voice" ;
(* SEPT clés d'entité : les six de la décision cles-acteur-six (arbitrage Romain 2026-06-16)
   + `voice` (LANG-SONS-2, GO Romain [438] 2026-07-16, spec hub/projets/lang-sons-spec.md §3 :
   voix = son de base + contrôles, entrée de lib/voices ; la HAUTEUR est STRUCTURELLE —
   alphabet+tuning, spec §2 — jamais un flag de voix : `voice.X` sans tuning = percussion,
   valide). CHACUNE se nomme avec `.` (composant). La forme `:` est REJETÉE (cutover 2026-07-14).
   Adressage de sortie (KAI-9, Romain 2026-06-26) : le canal `transport` est un IDENT LIBRE (clé
   d'appareil) et les DÉTAILS d'adresse (device/channel/port) sont ses PARAMS, iso quel que soit le
   canal — transport.midi(ch:3), transport.osc(device:reaper, ch:7). Plus de champ séparé
   `ActorDirective.binding` (ancien OSC-L1, supprimé). L'hôte reconstruit son routage depuis
   references[transport].{name, params}.
   alphabet — vocabulaire de symboles (requis) — CANON @alphabet.<nom>
   tuning   — tempérament / accordage (renomme v0.7 `scale`)
   octaves  — convention de registre / notation (référence lib/octaves.json ; optionnelle,
              défaut = **hérité de l'alphabet** de l'acteur ; `@actor X octaves.Y` SURCHARGE la
              notation de registre pour cet acteur. Étape de résolution distincte, rattachée au
              vocabulaire de symboles (alphabet), PAS au tuning.)
   transport — CANAL de NOTRE sortie — CANON transport.<canal>(…). Modèle producteur/canal (décision
              Romain 2026-07-14, hub/decisions/2026-07-14-modele-producteur-canal-eval-transport.md) :
              transport ne concerne QUE nos runtimes — `audio`/`midi`/`osc`. NON requis :
                • acteur SANS `eval` (producteur défaut `js`, ou voix symbolique alphabet→sound) :
                  transport OPTIONNEL, défaut cascade @core = `audio` ;
                • acteur AVEC `eval` : transport INTERDIT (fail-loud) — un programme embarqué autonome
                  (strudel/hydra/p5/csound/mercury) sort en NATIF ; on ne route pas sa sortie.
              PAS de `transport.video`/`transport.visual` (axe visuel SUPPRIMÉ : les visuels sortent
              natif). Le nom d'appareil est un IDENT **LIBRE** (clé de `@devices`), PAS une liste fermée ;
              le canal CANONIQUE écrit directement = {`audio`, `midi`, `osc`}. Noms PÉRIMÉS `browser`
              et `webaudio` = REJETÉS fail-loud au parse (décision 2026-07-16, Romain : on supprime,
              PAS de normalisation ni rétrocompat ; `schema.deprecatedTransports` de core.json). Le
              modèle profils d'environnement (`routing.json` — studio/live/browser) est SUPPRIMÉ
              (fichier + feature @routing/routingTable). La grammaire valide la SYNTAXE
              `transport.<nom>(params)` ; l'existence de l'appareil et la compatibilité de type sont
              résolues en aval (Kanopi, cf. DEVICES_SPEC.md — audio/midi/osc). Params entre () :
              transport.midi(ch:10).
   sound    — son par défaut de l'acteur (référence dans @sound).
              Une référence sound.X ici équivaut sémantiquement à
              `*:sound.X` mais s'écrit comme une entity_ref pour homogénéité.
*)

actor_eval_binding = "eval" , "." , IDENT ;          (* eval.strudel, eval.hydra, eval.csound ... *)
(* eval — PRODUCTEUR embarqué AUTONOME de l'acteur (clé libre : strudel/hydra/p5/csound/mercury…).
   Modèle producteur/canal (Romain 2026-07-14) : un acteur `eval` PRODUIT ET SORT EN NATIF (son propre
   audio / canvas) ⇒ il ne porte PAS de `transport` (fail-loud si présent). L'ABSENCE d'`eval` vaut
   producteur défaut IMPLICITE `js` (notre code, produit dans notre environnement) — SEUL cas de voix
   de code où `transport` s'applique. `js` ne s'écrit pas `eval.js` (défaut implicite) ; la catégorie
   qui distinguera formellement « produit-chez-nous » (js) de « produit-natif » (strudel/hydra) est
   prospective (backlog « LP », décision 2026-07-14 §Prospectif).
   Un backtick de flux dans une règle dont la tête est cet acteur HÉRITE de `eval` (langage connu sans
   tag) ; un tag explicite l'override (cf. §4.13, décision CV-curve 2026-07-04 + [299]). Hors voix-code
   d'acteur, le tag est obligatoire. Même espace de noms de clés que les tags. *)


(* param_pairs/param_pair (IDENT = IDENT, ex-forme '(transport=sc, eval=python)') : ABOLIS
   (addendum 2026-07-16, jamais implémentés). Les params d'entité utilisent kv_pairs (`:`). *)

alias_list = alias , { "," , alias } ;
alias      = IDENT , ":" , IDENT ;
```

### `sound_section` (v0.8) — déclarations de sons

```ebnf
sound_section = "@" , "sound" , [ sound_section_lib ] , NEWLINE , sound_entry+ ;

(* Forme `@sound.LIBNAME` : charge lib/sounds/LIBNAME.json (cf. § Format des
   libs externes ci-dessous). Apporte au scope ses defaults, ses sons nommés
   et ses affectations by_terminal. La section anonyme `@sound` (sans suffixe)
   ouvre un bloc de déclarations locales. *)
sound_section_lib = "." , IDENT , [ ":" , IDENT ] ;
                                                  (* @sound.tabla_classical
                                                     @sound.tabla_classical:simplified *)

sound_entry = anonymous_prototype | named_prototype ;

anonymous_prototype = "{" , prop_pairs , "}" ;     (* { dur:500, alphaMin:80 } *)
named_prototype     = IDENT , "{" , prop_pairs , "}" ;
                                                  (* bell_short { sample:"bell.wav", dur:400 } *)

prop_pairs = prop_pair , { "," , prop_pair } ;

prop_pair  = IDENT , ":" , prop_value             (* dur:400, sample:"bell.wav" *)
           | IDENT ;                              (* booléen nu : `breakTempo` ≡ `breakTempo:true` *)

prop_value = INT | FLOAT | STRING | IDENT
           | INT , "/" , INT ;                    (* ratios pour pivot, période, etc. *)
```

Le territoire `@sound` est **uniquement déclaratif** : les affectations
sujet→son se font depuis les territoires d'origine (`@alphabet.X`, `@actor X`,
ou inline dans une règle), via `sound_assignment`. Cf.
`docs/design/v0.8-decisions-final.md` §1-2.

**Booléens nus** : `{ breakTempo, contBeg }` est sucre syntaxique pour
`{ breakTempo:true, contBeg:true }`. Promotion au parse, pas d'impact AST.

**Format des libs externes** : un fichier `lib/sounds/X.json` peut contenir
trois sections (toutes optionnelles) :

```json
{
  "defaults":   { "dur": 500, "alphaMin": 80 },
  "named":      { "bell_short": { "sample": "bell.wav", "dur": 400 },
                  "drum_kick":  { "sample": "kick.wav", "breakTempo": true } },
  "by_terminal":{ "Sa": "drum_kick",
                  "Re": { "sample": "re.wav" } }
}
```

- `defaults` → un prototype anonyme injecté dans le scope (niveau 2 de la cascade).
- `named` → un `SoundPrototypeAST` par entrée (référence par nom).
- `by_terminal` → des `SoundAssignmentAST` injectées dans le scope alphabet
  associé (`scope.kind = "alphabet"`). Chaque valeur peut être une référence
  nommée (string) ou un bloc inline (object).

### `sound_assignment` (v0.8) — affectation sujet → son

```ebnf
sound_assignment = subject , ":" , sound_target ;

subject       = IDENT                              (* nom d'un terminal : Sa, do4, bell *)
              | "*" ;                              (* défaut wildcard pour le scope courant *)

sound_target  = "sound" , "." , IDENT              (* sound.bell_short — référence nommée *)
              | "{" , prop_pairs , "}" ;           (* { dur:300, sample:"x.wav" } — bloc inline *)
```

Les `sound_assignment` apparaissent dans les territoires :

- `alphabet_section` (bloc du `@alphabet.X`) → scope `alphabet:X`
- `actor_body` (bloc du `@actor X`) → scope `actor:X`

L'inline sur une occurrence (niveau 7 de la cascade) ne passe **pas** par
`sound_assignment` : on utilise un `runtime_qualifier` sur l'élément du RHS,
`Sa(sound.bell_short)`. Voir Couche 4 § Symboles.

### `alphabet_section` (v0.8) — extension

```ebnf
alphabet_section = "@" , "alphabet" , "." , IDENT , [ ":" , IDENT ]
                 , [ "(" , alias_list , ")" ]
                 , [ NEWLINE , alphabet_body ] ;

(* `:` après la notation pointée = variante : @alphabet.tabla:transport.
   `(...)` = résolution de conflit (cf. Directive). *)

alphabet_body = { alphabet_decl | sound_assignment | comment | blank_line } ;

alphabet_decl = "notes" , ":" , IDENT , { IDENT } ;   (* notes: Sa Re Ga ... *)
              (* + autres décl propres à l'alphabet, cf. lib/alphabet.json *)
```

### `declaration`

```ebnf
declaration = [ "@" ] , TYPE , IDENT , ":" , ACTOR_OR_RUNTIME ;

TYPE              = "gate" | "trigger" | "cv" ;
ACTOR_OR_RUNTIME  = IDENT ;               (* acteur name (preferred) ou legacy runtime name *)
```

Format préféré : `@gate Sa:midi`. Format legacy (sans `@`) : `gate Sa:sc` — toujours supporté.
Avec `@actor`, les symboles sont qualifiés par dot notation dans les règles :
`sitar.Sa` → le terminal `Sa` résolu via l'acteur `sitar`.

### `cv_instance` — déclaration de modulateur

```ebnf
cv_instance = "cv" , IDENT , ":" , cv_body ;          (* cv env1 : mod.adsr(...) *)
cv_body = IDENT , "." , IDENT , "(" , arg_list , ")"   (* lib.type(params) *)
        | backtick_inline ;                             (* `js: code` *)
```

Déclaration **purement descriptive** (design Romain 2026-06-20) : `cv env1 : mod.adsr(...)` décrit
ce qu'EST le modulateur — mot-type `cv`, `:` = « est un », `()` = paramètres. **Aucune cible, aucune
route, aucun `=`** sur la déclaration. Le **branchement** se fait au point de paramètre
(`(cutoff: env1)`, cf. `runtime_qualifier`), où la valeur peut être un littéral OU un **symbole
dérivable** de la grammaire.

Désambiguïsation avec la double-déclaration temporelle `cv ramp:sc` (type temporel + runtime) : le
corps après `cv NAME :` est un modulateur ssi c'est `IDENT.IDENT(…)` ou un backtick ; sinon c'est un
binding de type temporel. Les anciennes formes (`env1(cible,transport)=…`, `env1:Bass.cutoff=…`)
sont **supprimées**.

### `macro`

```ebnf
macro = IDENT , "(" , param_list , ")" , "=" , rhs ;

param_list = IDENT , { "," , IDENT } ;
```

### `backtick_orphan`

```ebnf
backtick_orphan = "`" , IDENT , ":" , CODE , "`" ;
```

Le tag (`sc:`, `py:`, `tidal:`) est obligatoire pour les backticks non attachés
à un symbole.

### `comment`

```ebnf
comment = "//" , TEXT ;
```

---

## Couche 2 — Sous-grammaires

```ebnf
subgrammar = rule+ , [ separator ] ;

separator  = "-----" , { "-" } ;           (* 5+ tirets, sépare les sous-grammaires *)
```

### Directive de mode

```ebnf
mode_directive = "@" , "mode" , ":" , MODE_VALUE , [ "(" , mode_modifier , { "," , mode_modifier } , ")" ] ;

MODE_VALUE     = "random" | "ord" | "sub" | "sub1" | "lin" | "tem" | "poslong" ;

mode_modifier  = SUBGRAMMAR_KEY                       (* flag : destru, striated, smooth *)
               | SUBGRAMMAR_KEY , ":" , value ;        (* avec valeur : mm:60 *)

SUBGRAMMAR_KEY = (* clés de la section "subgrammar" de controls.json :
                   destru, striated, smooth, mm *) ;
```

Les règles d'une même sous-grammaire partagent le mode déclaré via `@mode:...`.
Le mode est défini par une directive `@mode:X` (ex: `@mode:random`, `@mode:ord`) qui s'applique
à la sous-grammaire qui suit, jusqu'au prochain séparateur `-----`.
Le séparateur `-----` marque la frontière entre sous-grammaires.

Les **modificateurs de mode** entre `()` sont des directives de sous-grammaire émises
en preamble BP3 (entre la ligne mode et les règles). Ils sont déclarés dans la section
`subgrammar` de `controls.json`.

Exemples :
- `@mode:lin(destru)` → `LIN` + `_destru` en preamble
- `@mode:random(striated, tempo:60)` → `RND` + `_striated _mm(60)` en preamble
- `@mode:ord(smooth)` → `ORD` + `_smooth` en preamble

Les mêmes directives peuvent aussi apparaître en global avec `@` (`@striated`, `@tempo:60`),
auquel cas elles s'appliquent au preamble de la première sous-grammaire.

**Mode SUB/SUB1** : en mode substitution, les symboles en LHS sont aussi des terminaux.
Les règles SUB remplacent des patterns dans la séquence ; ce qui reste après toutes les
itérations doit être dans l'alphabet pour être joué. Le transpileur inclut donc les symboles
LHS des sous-grammaires SUB/SUB1 dans l'alphabet (contrairement aux modes ORD/RND où
les symboles LHS sont des non-terminaux).

### Section template (optionnelle, v0.8 — singulier, ex-`@templates`)

```ebnf
template_section = "@" , "template" , NEWLINE , template_entry+ ;

(* v0.8 : @templates → @template (singulier, alignement avec @actor, @sound,
   @alphabet). Pas de suffixe de mode : la section est toujours en régime
   catalogue (consommée par [mode:tem] pour l'analyse inverse). *)

template_entry   = "[" , INT , "]" , scale_factor , template_body ;

scale_factor     = "/" , INT                        (* /1, /2 — ratio d'échelle *)
                 | "*" , INT , "/" , INT ;           (* *1/2 — forme explicite *)

template_body    = template_element+ ;

template_element = "?"                              (* wildcard : un terminal *)
                 | "?" , { "?" }                    (* wildcards compacts : ???? = ? ? ? ? *)
                 | "."                              (* period — séparateur de fragments *)
                 | "(" , "$" , INT , template_body , ")"   (* bracket master : ($0 ???) *)
                 | "(" , "$" , INT , ")"            (* bracket master vide : ($1 ) *)
                 ;
```

Les templates décrivent la **structure temporelle** des items produits par les règles
template (`<>`). Chaque `?` représente un slot terminal (sound object).

La section `@template` est **optionnelle** :
- Si absente, BP3 génère les templates automatiquement pendant la production.
- Si présente, BP3 utilise les templates spécifiées pour le matching en mode
  analyse.
- En mode `@mode:tem`, les templates servent de contraintes structurelles.

**Régime catalogue (v0.8)** : la section est toujours en mode catalogue —
post-dérivation, consommée par `[mode:tem]`. Pas de variante avec suffixe.

Exemples :
```bpscript
@alphabet.western

S -> C4 D4

@template
[1] /1 ???????                    // 7 terminaux en séquence
[2] /1 ?????????                  // 9 terminaux
[3] /1 ($0 ???)($1 )              // structure récursive : master(3 slots) + slave(vide)
```

La section vient **après** les règles : seule, elle ne compile pas.

Traduction BP3 :
```
TEMPLATES:
[1] *1/1 _______
[2] *1/1 _________
[3] *1/1 (@0 ___)(@1 )
```

| BPScript | BP3 | Notes |
|----------|-----|-------|
| `?` | `_` | wildcard terminal (un slot) |
| `????` | `____` | wildcards compacts (4 slots) |
| `.` | `.` | period (identique) |
| `($0 ???)` | `(@0 ___)` | bracket master ($ = master en BPScript) |
| `($1 )` | `(@1 )` | bracket slave vide |
| `/1` | `*1/1` | facteur d'échelle |

---

## Couche 3 — Règles

```ebnf
rule = [ guard ] , { context } , lhs , ARROW , rhs
       , [ runtime_qualifier ] , { qualifier } ;

ARROW = "->" | "<-" | "<>" ;
```

Le `runtime_qualifier` suffixe optionnel sur la règle (ex: `S -> C4 D4 E4 (vel:80)`)
s'applique à toute la portée de la règle.

### `guard`

```ebnf
guard = "[" , guard_expr , "]" , { "[" , guard_expr , "]" } ;     (* multi-guard = AND *)

guard_expr = IDENT , COMPARE_OP , flag_value      (* test pur *)
           | IDENT , MUTATE_OP , INT               (* test + mutation atomique *)
           | IDENT                                  (* bare flag : non-zéro test *)
           ;

COMPARE_OP = "==" | "!=" | ">" | "<" | ">=" | "<=" ;
MUTATE_OP  = "+" | "-" ;

flag_value = INT | IDENT ;                          (* littéral, état nommé (@flag, A5), ou autre flag *)
```

La forme `[flag-N]` décrémente ET teste > 0 atomiquement (sémantique BP3).
La forme `[flag>N]` teste sans muter.
La forme `[Ideas]` (bare flag) teste que le flag est non-zéro → `/Ideas/` en BP3.

### `context`

```ebnf
context = positive_context | negative_context ;

positive_context = "(" , context_sym+ , ")" ;        (* contexte positif *)
negative_context = "#" , "(" , context_sym+ , ")"    (* négatif sur groupe *)
                 | "#" , context_sym                  (* négatif sur un seul symbole *)
                 | "#" , "?" ;                       (* boundary — pas de symbole ici *)

context_sym      = symbol | wildcard | rest | prolongation | "{" | "}" | "," ;
(* rest = "-", prolongation = "_" — valides comme contextes négatifs : #- (silence), #_ (prolongation) *)
```

Les contextes peuvent apparaître avant le LHS (contexte gauche), après le RHS
(contexte droit), ou dans le RHS (préservés pour les futures applications).

### `lhs`

```ebnf
lhs = lhs_element+ ;

lhs_element = symbol
            | variable
            | wildcard
            | context
            | template_anchor                       (* $ nu = ancre de gabarit maître en LHS *)
            | "{" | "}" | "," ;                    (* méta-grammaires : braces comme terminaux *)
```

### `rhs`

```ebnf
rhs = rhs_element* ;                               (* peut être vide via lambda *)
```

### `qualifier`

Le `qualifier` en fin de règle est un `engine_qualifier` (moteur BP3 uniquement).
Les paramètres runtime utilisent `()` — voir section 4.0.

```ebnf
qualifier = engine_qualifier ;
```

Définition complète de `engine_qualifier` et `runtime_qualifier` en section 4.0.

Syntaxe double acceptée : `[weight:3, scan:left]` ou `[weight:3] [scan:left]`.

**Opérateurs temporels** : `[/2]`, `[*3]` — deux opérateurs BPScript distincts.
Portée : sur un symbole (`A[/2]`), un groupe (`{A B}[/2]`), ou un polymetric (`{v1, v2}[/2]`).
`[/N]` → opérateur NU `/N A` (absolu, persistant, fixtempo). `[*N]` → bracket `_tempo` (relatif).
Note : `[\N]` n'est pas tokenisé par le tokenizer BPScript (anomalies natif+WASM documentées dans TEMPO_OPS_WASM.md).

**Durée / cadre polymétrique** : la durée s'écrit avec `:` COLLÉ. `{v1, v2}:2` → `{2, v1, v2}`
(cadre du conteneur), `A4:1/2` → `{1/2, A4}` (durée de note : `A4:1` = noire, `A4:2` = blanche).
C'est une propriété du conteneur `{}` (1er champ du cadre), distincte des opérateurs temporels.
Remplace l'ancien qualificatif `[speed:N]`, **supprimé** (décision 2026-06-26-trois-concepts-temps-duree ;
`speed`, mot de DJ, est banni — la durée est un concept de premier rang attaché à la note/au groupe).

**K-params** : `[weight:K1=3]` initialise le K-param K1 à 3. `[weight:K1]` référence
la valeur courante. Utilisé en mode LIN pour les distributions probabilistes (ex: jeu de dés
de Mozart, avec K1-K11 simulant 2 dés en cloche 1,2,3,4,5,6,5,4,3,2,1).

**Poids infini** : `[weight:inf]` — priorité absolue. La règle est toujours choisie
quand elle matche. Compilé en `<inf>` pour BP3. Utilisé en mode LIN pour forcer
une substitution.

**Clés nues (flags)** : `[destru]` sans `:value` = flag booléen (`true`).
Compilé en preamble de la sous-grammaire (`_destru` entre la ligne mode et les règles).
Clés nues reconnues : `destru`, `striated`, `smooth`.

---

## Couche 4 — Éléments RHS

```ebnf
rhs_element = element_core , [ suffix_qualifier ] , [ "@" , IDENT ] ;
(* Le @ suffixe attache un label à l'élément : C4@kick, {A B}@groove. Sans espace avant @. *)
(* Pas de qualificateur préfixe sur un élément : utiliser ![X] / !(X) pour positionner
   une instruction avant un élément ou dans le flux. *)

suffix_qualifier = engine_qualifier | runtime_qualifier ;
(* [] ou () collé à gauche de l'élément : A[weight:50], A(vel:80) — déterminé par absence d'espace avant [ ou ( *)

element_core = symbol
             | compound_sound_object
             | symbol_call
             | rest | prolongation | undetermined_rest
             | period
             | numeric_duration
             | polymetric
             | simultaneous
             | out_time_object
             | trigger_in
             | variable
             | wildcard
             | template_master | template_slave | template_anchor
             | tie_start | tie_continue | tie_end
             | nil_string
             | backtick_standalone
             | context
             | raw_brace
             | flag_bracket ;

compound_sound_object = "|[" , sound_atom , { sound_atom } , "]" ;
sound_atom            = symbol | prolongation | polymetric ;
(* Objet sonore COMPOSÉ (ratifié Romain 2026-07-18) : une suite de notes/prolongations (et poly
   imbriquée) occupant UNE unité d'ordonnancement. Ouverture "|[" , fermeture "]" (ASYMÉTRIQUE).
   Le contenu est concaténé SANS blancs en un nom de terminal unique : |[ do5 _ do5 do5 ] → le
   sound object "do5_do5do5". `_` prolonge la note précédente À L'INTÉRIEUR de l'objet. AST : un
   seul Symbol{name:"do5_do5do5", payload:{nature:"sounding"}} — forme canonique identique à celle
   que le frontal BP3 émet pour un terminal concaténé. Cf. docs/issues/LANG_COMPOUND_SOUND_OBJECT.md. *)
```

### 4.0 Qualificateurs — `[]` engine vs `()` runtime

Deux syntaxes selon la destination :

| Syntaxe | Destination | Exemples |
|---------|-------------|----------|
| `[]` | Moteur BP3 | `[mode:random]`, `[weight:50]`, `A[/2]`, `[scale:just C4]` |
| `()` | Runtime/dispatcher | `(vel:80)`, `(wave:sawtooth)`, `(filter:300, filterQ:5)` |

#### `[]` — Qualificateurs moteur (engine)

```ebnf
engine_qualifier = "[" , engine_pair , { "," , engine_pair } , "]"
                 | "[" , tempo_op , "]" ;

tempo_op = ( "/" | "*" ) , ( INT | FLOAT | INT , "/" , INT ) ;
           (* Deux sémantiques distinctes selon l'opérateur :
              "/" → ABSOLU + persistant : A[/2] → « /2 A » (opérateur nu BP3, fixtempo).
                    Durée de référence du champ imposée. Persiste jusqu'au prochain op tempo ou fin de champ.
                    Portée : terminal (A[/2]), groupe ({A B}[/2]), règle (inline /2).
              "*" → RELATIF : A[*2] → _tempo(1/2) A _tempo(1/1) (bracket entrer/sortir, relatif à l'hérité).
                    L'exit _tempo(1/1) restaure la vitesse héritée au bord du bracket.
              "!" → ![/N] dans le flux = _tempo(N/1) relatif (InstantControl, sans fixtempo, portée séquentielle).
              "\" → non tokenisé par BPScript (bugs natif/WASM documentés dans TEMPO_OPS_WASM.md). *)

engine_pair = ENGINE_KEY , ":" , raw_value
            | ENGINE_KEY ;                              (* flag nu : [destru] *)

ENGINE_KEY  = "mode" | "scan" | "weight" | "on_fail"   (* `speed` SUPPRIMÉ → durée `:` *)
            | "tempo" | "meter" | "scale"
            | "retro" | "shuffle" | "order" | "rotate"
            | "keyxpand" | "repeat" | "failed" | "stop" | "goto"
            | "striated" | "smooth"
            | "staccato" | "legato" | "rndtime" ;

raw_value   = (* tout texte jusqu'au prochain "," ou "]" *) ;
```

```
[mode:random]          → RND en mode de sous-grammaire
[weight:50]            → <50>
A[/2]                  → /2 A
[scale: just_intonation C4] → _scale(just intonation,C4)
[retro]                → _retro (clé nue = sans parenthèses)
[rotate:2]             → _rotate(2) (clé avec valeur = avec parenthèses)
[shuffle]              → _rndseq (brasse seul ; marqueur seq_prefix en tête de RHS ou de groupe)
[shuffle:N]            → RETIRÉ (erreur) — la graine s'écrit [@seed:N] / ![@seed:N]  (décision 2026-06-14)
![@seed:N]             → _srand(N)  (re-semence DANS LE FLUX ; restreint à seed)
                         brassage déterministe local : ![@seed:N] {…}[shuffle]  → _srand(N) {_rndseq …}
[order]                → _ordseq (restaure l'ordre canonique)
```

**Contrôles engine sans argument** : quand une clé engine est utilisée nue (`[retro]`,
`[shuffle]`, `[order]`, `[destru]`), la valeur interne est `true`. L'encodeur émet le nom
BP3 **sans parenthèses** (`_retro`, `_rndseq`, `_ordseq`, `_destru`). Quand une valeur est
fournie (`[rotate:2]`), l'encodeur émet avec parenthèses (`_rotate(2)`).

**Contrôles seq_prefix** (`scope:"seq_prefix"` dans controls.json) : `retro`, `shuffle`,
`order`, `rotate`. Ces clés sont injectées **en tête** du groupe ou de la RHS :
- Sur un groupe : `{a b c}[shuffle]` → `{_rndseq a b c}` (préfixe inside les accolades)
- En fin de règle : `a b c [shuffle]` → `_rndseq a b c` (préfixe en tête de RHS)

**`[rotate:2]` (STRUCTURE) vs `(scaleshift:2)` (HAUTEUR)** : `[rotate:2]` (engine) → `_rotate(2)`
en BP3 (décalage cyclique temporel d'une séquence) ; `(scaleshift:2)` (runtime) → `_script(CT n)`
via dispatcher (transposition SCALAIRE : décalage de N degrés dans l'alphabet). Deux opérations
distinctes. La transposition de hauteur s'appelait autrefois `rotate` ; renommée `scaleshift`
(décision 2026-07-11) pour lever l'homonymie avec le `![rotate]` de structure.

#### `()` — Qualificateurs runtime

```ebnf
runtime_qualifier = "(" , runtime_pair , { "," , runtime_pair } , ")" ;

runtime_pair = [ subject , ":" ] , RUNTIME_KEY , ":" , value ;   (* sujet optionnel *)
subject = "*" | IDENT ;   (* "*" = chaque terminal ; IDENT = un terminal (ex. C2)
                             ; PARKÉ : portée cross-règle/scène. Défaut (omis) = la règle/le groupe.
                             Cohérent avec l'affectation `*:sound.X`. Décision Romain 2026-06-21. *)

RUNTIME_KEY  = (* nom présent dans lib/controls.json section "runtime" :
                  vel, chan, pan, wave, attack, release, detune,
                  filter, filterQ, transpose, ins, staccato, legato,
                  mod, pitchbend, volume, etc. *) ;
```

Compilé en `_script(CT n)` pour BP3 — le dispatcher interprète au playback.

```
(vel:80)               → _script(CT 0) avec {vel: 80}
(wave:sawtooth, vel:100, filterQ:8) → _script(CT 0) avec {wave:"sawtooth", vel:100, filterQ:8}
```

#### Position — règles d'espacement

`[]` et `()` sont **toujours suffixes** sur un élément du RHS : ils se collent à
gauche, à l'élément qui précède. Il n'y a **pas** de forme préfixe `[X]A` sur un
élément (le parser la rejette). Pour placer une instruction *avant* un élément ou
entre deux éléments, utiliser la forme instantanée `![X]` / `!(X)` (voir plus bas).

| Syntaxe | Espacement | Interprétation |
|---------|------------|----------------|
| `A[X]` | collé à gauche | suffixe de A ✅ |
| `A[X] B` | collé à gauche, espace à droite | suffixe de A ✅ |
| `[X]A` | collé à droite | **non supporté** — utiliser `![X] A` |
| `A [X]B` | espace à gauche, collé à droite | **non supporté** — utiliser `A ![X] B` |
| `A [X] B` | espace des deux côtés | **erreur** — utiliser `A ![X] B` |
| `A[X]B` | collé des deux côtés | **erreur** — ambigu |

> Note design : la distinction préfixe/suffixe (façon `++i` / `i++`) avait été
> envisagée, mais elle n'a de sens que pour les mutations de flag, et ce besoin
> est déjà couvert plus explicitement par `![X]` (positionnement dans le flux).
> BP3 n'a de toute façon pas de modèle où l'ordre préfixe/suffixe d'un élément
> serait observable. `[]` reste donc suffixe seul.

Mêmes règles pour `()` :

| Syntaxe | Interprétation |
|---------|----------------|
| `A(vel:80)` | suffixe de A ✅ |
| `(vel:80) A` | **erreur** — utiliser `!(vel:80) A` |
| `A (vel:80)` | suffixe de A si fin de règle/voix, sinon **erreur** |

Pour positionner un contrôle **librement dans le flux** (entre deux éléments),
utiliser `!()` ou `![]` :
- `A !(vel:80) B` → `A _script(CT 0) B` — contrôle instantané positionné entre A et B
- `{![retro] A B}` → `{_retro A B}` — contrôle engine en tête de voix
- `{!(chan:1) C8 - - -, !(chan:2) - C7}` → `{_script(CT 0) C8 - - -, _script(CT 1) - C7}`

Deux portées pour les suffixes de règle :

- **Règle** : `S -> C4 D4 E4 (vel:80)` — `()` en fin de RHS, s'applique à toute la règle.
  Compilé en : `_script(CT 0) C4 D4 E4`

- **Groupe** : `{A B}(vel:100)` — `()` collé au `}`, s'applique au groupe.
  Compilé en : `_script(CT 0) {A B}`

**Portées d'attachement — BASE universelle + déclaration par élément.** Il existe une **base** de
portées où un suffixe/opérateur peut s'attacher, l'**espace et le `!` étant significatifs** pour
désambiguïser (cf. §Espace, ligne ~943). **Cette base n'est PAS une loi uniforme** : chaque élément
de langage **déclare dans sa définition quelles portées lui sont valides, et vers quel nœud AST il
se traduit** (cf. `AST.md` §Portées × nœud AST par élément — le contrat que lisent BP3 et BPx).

Les **cinq portées** de la base :

| Portée | Reconnaissance | Exemple |
|--------|----------------|---------|
| terminal | suffixe COLLÉ au symbole | `A(vel:80)` · `A[weight:50]` · `A4:1/2` |
| groupe | suffixe COLLÉ au `}` | `{A B}(vel:100)` · `{A B}:2` |
| règle | suffixe ESPACÉ en fin de RHS | `S -> A B (vel:80)` · `S -> A B [weight:40]` · `S -> A B :2` |
| `!` accolé | `!` COLLÉ à un terminal (flux conjoint) | `C4!(vel:80)` |
| `!` inline | `!` ESPACÉ (événement séparé dans le flux) | `A !(vel:80) B` · `A ![/2] B` |

Aucun élément n'a **toutes** les portées. Exemples (matrice complète dans `AST.md`) :
- **durée `:N`** — portées {terminal, groupe, règle} ; **`!` interdit** (une durée exige un hôte) ;
  nœud AST : `Polymetric.qualifiers` (qualifier `speed`), jamais un champ ad hoc.
- **tempo `/N \N *N`** — portées {terminal, règle, `!` inline} ; nœud `TempoOp`.
- **runtime `(…)`** — les cinq portées ; nœud `RuntimeQualifier` / `InstantControl`.
- **moteur `[weight]` `[mode]`** — portée {règle} ; nœud `Rule.flags` / `Rule.mode`.

La durée `:N` a **remplacé** le qualificatif `[speed:N]` (supprimé, cf. §Durée ci-dessus).

**Contrôles instantanés dans le RHS** : quand un non-terminal se résout en purs
contrôles (aucun élément temporel), utiliser `!()` pour les positionner dans le flux :

```bpscript
@controls

Pull0 -> !(pitchbend:0)                                          // → _script(CT n)
StartPull -> !(pitchcont) !(pitchrange:500) !(pitchbend:0)        // → _script(CT 0) _script(CT 1) _script(CT 2)
```

Ce pattern existe dans les grammaires à couches (vina, vina2, vina3) où les
non-terminaux intermédiaires occupent du temps dans la couche supérieure et se
résolvent en instructions moteur dans la couche inférieure.

### 4.1 Symboles

```ebnf
symbol      = [ IDENT , "." ] , IDENT ;              (* terminal/non-terminal, optionnel acteur.terminal *)
symbol_call = [ IDENT , "." ] , IDENT , "(" , arg_list , ")" ;  (* idem, avec paramètres *)

arg_list    = arg , { "," , arg } ;
arg         = [ IDENT , ":" ] , arg_value ;           (* positionnel ou nommé *)
arg_value   = value | backtick_inline ;
```

Conforme au modèle (`.` pointe une entité) : un terminal qualifié par son acteur s'écrit
`acteur.terminal` (`sitar.Sa` → `{ name:"Sa", actor:"sitar" }`). La forme legacy `terminal:acteur`
n'est plus blessée par la spec (`:` lie un sujet, il ne pointe pas une entité).

### 4.2 Silences et temps

```ebnf
rest              = "-" ;                            (* silence déterminé *)
prolongation      = "_" ;                            (* étend l'événement précédent *)
undetermined_rest = "..." ;                          (* durée calculée par le moteur — compilé en _rest *)
period            = "." ;                            (* séparateur de fragments égaux *)
numeric_duration  = INT | INT , "/" , INT ;           (* silence de durée rationnelle *)
```

`numeric_duration` : un nombre nu dans le flux = silence de durée rationnelle.
**À confirmer avec Bernard** : différence exacte entre `-` et `1`.

`undetermined_rest` : `...` en BPScript est compilé en `_rest` pour BP3 (commande built-in,
token `T0, 17` dans `Encode.c`). Utilisé dans les voix polymétriques — le moteur calcule
la durée donnant l'expression la plus simple. **Attention** : trois points littéraux `...`
en BP3 seraient interprétés comme trois periods (`.` = `T0, 7`), pas comme un repos
indéterminé. Le caractère historique `…` (U+2026) a été abandonné en 2022 (compat UTF-8).

### 4.3 Polymétrie

```ebnf
polymetric = [ label , ":" ] , "{" , voice , { "," , voice } , "}"
             , [ engine_qualifier ] , [ runtime_qualifier ] ;

label      = IDENT ;    (* étiquette UI, metadata pure — ignorée par l'encoder *)

voice      = rhs_element+ ;
```

Les contrôles à l'intérieur d'une voix se positionnent avec `!()` et `![]` :
`{!(chan:1, vel:120) C8 - - -, !(chan:1, vel:100) - C7 C7 C7}`.
La position dans le source = la position dans la sortie BP3.

Le cadre polymétrique BP3 (`{2, voix1, voix2}`) s'exprime via la durée `:` collée :
`{voix1, voix2}:2`.

### 4.4 Instantanéité (`!`)

```ebnf
instant = "!" , instant_target ;

instant_target = symbol                              (* trigger : !dha → <<dha>> *)
               | symbol_call                         (* trigger avec params : !dha(vel:120) *)
               | runtime_qualifier                   (* contrôle runtime : !(transpose:200c) → _script(CT n) *)
               | engine_qualifier                    (* contrôle engine : ![retro] → _retro *)
               ;
```

`!` marque un événement **instantané** (zéro durée) dans le flux temporel.

Trois usages :

- **Attaché** à un primaire (`Sa!dha`) : le primaire définit la durée, le secondaire
  se déclenche au même instant. Compilé en `Sa <<dha>>`.
- **Standalone symbole** (`!f`) : out-time object — déclenché hors-temps, sans durée.
  Compilé en `<<f>>`.
- **Standalone contrôle** (`!(transpose:200c)`, `![retro]`) : instruction instantanée
  positionnée dans le flux. La position dans la séquence détermine le moment d'application.
  Compilé en `_script(CT n)` ou `_retro` etc.

Chaînable : `Sa!dha!spotlight`.

Exemples avec contrôles :
```
{!(transpose:200c) D}        → {_script(CT 0) D}       // préfixe dans la voix
{D !(transpose:200c)}        → {D _script(CT 0)}       // suffixe dans la voix
{![retro] A B}             → {_retro A B}           // engine prefix
Sa !(vel:80) Re            → Sa _script(CT 0) Re     // entre deux symboles
```

Ceci remplace le mécanisme de "portée voix" : au lieu de transformer silencieusement
un suffixe en préfixe, l'utilisateur positionne explicitement le contrôle dans le flux
avec `!`. La position BPScript = la position BP3.

### 4.5 Out-time object (`!` standalone)

```ebnf
out_time_object = "!" , IDENT ;                      (* !f → <<f>> en BP3 *)
```

Objet hors-temps : déclenché sans occuper de durée dans la séquence.
Utilisé quand un non-terminal se résout en pur déclenchement.

Note : `!symbol` et `!(control)` / `![control]` sont tous des formes de `!` standalone.
La distinction est que `!symbol` produit un out-time object `<<symbol>>` tandis que
`!(key:value)` et `![key]` produisent des tokens de contrôle (`_script(CT n)`, `_retro`, etc.).

### 4.6 Trigger entrant (`<!`)

```ebnf
trigger_in = "<!" , IDENT , [ qualifier ] ;
```

Point de synchronisation — attend un signal externe.
Chaînable : `<!sync1<!sync2`. Qualifiable : `<!sync1[timeout:5000]` (* not yet implemented *).
`<!` can also be attached to a symbol: `Sa<!sync1` produces a combined SymbolWithTriggerIn node.

### 4.7 Variables

```ebnf
variable = "|" , IDENT , "|" ;
```

Note : `|x|` est une variable BP3 (métavariable de réécriture), pas un homomorphisme.
Les homomorphismes sont déclarés via `@transcription.<subkey>` et portés dans `Scene.homomorphisms`.

### 4.8 Wildcards (captures)

```ebnf
wildcard = "?" , [ INT ] ;
```

`?` = anonyme, `?1` = capture nommée.

### 4.9 Templates

```ebnf
template_master = "$" , IDENT , [ "(" , arg_list , ")" ]
               | "$" , "{" , rhs_element+ , "}" ;          (* groupe : ${$X S &X} *)

template_slave  = "&" , IDENT , [ "(" , arg_list , ")" ]
               | "&" , "{" , rhs_element+ , "}" ;          (* groupe : &{$X S &X} *)

template_anchor = "$" ;                                    (* $ isolé (espace après) = ancre maître *)
(* Graphie BPScript : "$ " (dollar + espace). Compilé en token BP3 "(=" sans fermeture.
   Valide en LHS (contexte symétrique) et en RHS. L'ancre esclave "(:" est réservée, non implémentée. *)
```

Sur un symbole : `$X` = master, `&X` = slave. Compilé en `(=X)` / `(:X)`.
Sur un groupe : `${...}` / `&{...}`. Compilé en `(= ...)` / `(: ...)`.
Les templates groupes peuvent contenir d'autres templates (imbrication).

**Marqueurs homomorphisme** : les identifiants entre `$X` et `&X` sont des marqueurs
inline préservés verbatim dans le RHS BP3. `star` est le marqueur spécial pour `*` BP3.

```bpscript
S -> $X tabla_stroke &X          // marqueur tabla_stroke entre master et slave
S -> $X star &X                  // marqueur * BP3 (opérateur homo)
```

Compilé en : `S --> (= X) tabla_stroke (: X)` et `S --> (= X) * (: X)`.

**`**` (double star)** : `S -> $X star star &X` → `S --> (= X) * * (: X)` (stacking : 2 applications).
Le marqueur est toujours AVANT le master ou slave sur lequel il s'applique.

**Provenance des noms** : les sections homomorphisme sont déclarées dans `lib/transcription.json`
et chargées via `@transcription.<subkey>`. La section `*` correspond au marqueur `star`.
Le tableau `Scene.homomorphisms` (contrat BPx) porte les paires source→cible.
Plusieurs marqueurs peuvent être chaînés : `star TR` → deux applications successives.

### 4.10 Liaisons (~)

```ebnf
tie_start    = symbol , "~" ;                        (* C4~ = début de liaison *)
tie_continue = "~" , symbol , "~" ;                  (* ~C4~ = continuation *)
tie_end      = "~" , symbol ;                        (* ~C4 = fin de liaison *)
```

Compilé en `&` pour BP3. Le moteur gère le matching à travers la polymétrie.

### 4.11 Chaîne vide

```ebnf
nil_string = "lambda" ;                    (* internal — users typically write an empty RHS: S -> *)
```

Efface le non-terminal (production ε).

### 4.12 Flags dans le RHS (`[]`)

```ebnf
flag_bracket = "[" , flag_expr , { "," , flag_expr } , "]" ;

flag_expr = IDENT , MUTATE_ASSIGN , flag_rvalue     (* mutation : [phase=2] *)
          | IDENT ;                                  (* flag set/ref : [Atrans], [K1] *)

MUTATE_ASSIGN = "=" | "+" | "-" ;
flag_rvalue   = INT | IDENT ;                        (* littéral ou autre flag *)
```

Les flags RHS utilisent `[]` — la même syntaxe que les qualifiers et opérateurs
temporels. C'est cohérent : `[]` = instructions moteur BP3, `!` = temporel.

Exemples :
- `Sa!dha [phase=2]` → trigger dha + mutation flag (deux concepts séparés)
- `Head [Atrans, A-1, K2, K3]` → 4 flags d'un coup
- `lambda [Num_a=20, Num_b=0]` → efface le non-terminal + init flags

Symétrie LHS/RHS :
- `[phase==1] S -> ...` → test flag (guard)
- `S -> ... [phase=2]` → set flag (RHS)

#### Exception : flag en PRÉFIXE d'un contrôle

```ebnf
rhs_flag_prefix = flag_bracket , control ;          (* [B=3, A=3] goto(3,0) *)
```

Règle générale : `[]` se place en **suffixe** (après notes et terminaux). **Exception
encadrée** : devant un **contrôle** (`goto`, `repeat`, …), le flag se place en **préfixe**.

Raison : poser un flag *après* un `goto` n'a pas de sens — `goto` est un **saut**, donc le
flag doit être posé **avant** de sauter. L'AST place le nœud `FlagSet` **avant** le nœud
`Control` ; l'ordre est ainsi porté par l'arbre, et l'émission BP3 respecte l'ordre du natif
(`/B=3/ /A=3/ _goto(3,0)`).

L'exception est **limitée aux contrôles** : la règle « `[]` = suffixe » reste vraie partout
ailleurs. Les deux formes restent acceptées devant un contrôle, mais seule la forme préfixe
est fidèle au natif.

> Décision Romain 2026-07-18 (`flag-prefixe-sur-controle-rhs`, option b).

### 4.13 Backticks

```ebnf
backtick_inline     = "`" , IDENT , ":" , CODE , "`" ; (* dans un paramètre — valeur calculée, taggée *)
backtick_standalone = "`" , IDENT , ":" , CODE , "`" ; (* dans le flux — terminal de plein droit, taggé *)
```

**LANGAGE TOUJOURS CONNU — tag OU eval d'acteur, jamais deviné** (décision hub
`2026-07-04-cv-curve-syntaxe-backtick-type.md` + ajustement [299], Romain). Le langage d'un backtick
est fixé par sa **clé d'interprète** (`js`, `ts`, `python`, `sc`, `strudel`, `hydra`…), obtenue de
deux façons :
- **TAG explicite** en tête (`` `js: …` ``) — requis, et **override** un eval hérité.
- **HÉRITAGE** de l'`eval` d'un acteur : un backtick de FLUX (`backtick_standalone`/`backtick_inline`)
  dans une règle dont la TÊTE est un `@actor … eval.X` **hérite de X** (tag facultatif dans ce cas).

Un backtick **ORPHELIN** — top-level (`backtick_orphan`), courbe CV (`cv_body`), ou de flux SANS
eval d'acteur en tête — **EXIGE un tag** : sans lui, langage inconnu → **erreur claire** (au parse
pour les orphelins/cv ; à l'annotation pour un flux non résolu). JAMAIS de langage deviné. Le tag
type le **langage** ; le mot-clé `cv` type le **rôle** (modulation) — orthogonaux.

Le backtick autonome est un **terminal de plein droit** du RHS (cf. `element_core` et
`BacktickStandalone` dans AST.md) : il occupe une position dans le flux au même titre qu'une note.
Le **tag** désigne l'**interpréteur** (`eval`) du code (`sc:`, `py:`, `tidal:`, `strudel:`, `js:`…).
La SORTIE dépend du producteur (modèle producteur/canal, Romain 2026-07-14) : un backtick sur un
acteur `eval.<X>` (strudel/hydra/p5/csound/mercury) **sort en NATIF** (pas de transport) ; un backtick
du producteur défaut `js` est **placé par le dispatcher vers NOTRE `transport`**. Backtick attaché à
un symbole ou dans un paramètre → interpréteur implicite (celui du symbole / de son acteur). Le rattachement d'un
backtick à un acteur précis (voix-code) est décrit dans `docs/design/ACTOR.md`.
État d'implémentation : seul `js:` est interprété aujourd'hui ; `sc`/`py`/`tidal`/`strudel` sont
des cibles d'architecture (interpréteurs encapsulés).

### 4.14 Raw braces (méta-grammaires)

```ebnf
raw_brace = "{" | "}" | "," ;                        (* braces non balancées *)
```

Utilisé quand `{`, `}`, `,` apparaissent comme terminaux bruts dans le RHS
(embedding patterns, méta-grammaires). Le parser les émet comme `RawBrace`
quand ils ne forment pas un polymetric balancé dans la même règle.

**Cross-rule braces** : les accolades peuvent être déséquilibrées à travers plusieurs
règles avec propagation de la durée `}:N` de la `}` fermante vers la `{` ouvrante correspondante.

---

## Couche 5 — Lexèmes

### Espacement (significatif)

L'espace est **significatif** pour déterminer l'attachement des qualificateurs `[]` et `()`.
Le tokenizer annote chaque token avec un flag `spaceBefore` (booléen) indiquant si un ou
plusieurs espaces/tabulations précèdent le token.

Règles d'attachement :
- Token `[` ou `(` **sans espace avant** → collé à l'élément précédent (suffixe)
- Un élément collé après `]` (forme `[X]A`) n'est **pas** un préfixe : non supporté
  sur un élément du RHS (utiliser `![X] A`)
- `[` et `]` avec espace des deux côtés → qualifier flottant (erreur, utiliser `![]`)
- `[` et `]` sans espace des deux côtés → ambigu (erreur)

Le tokenizer n'élimine pas les espaces — il les consomme mais enregistre leur présence.

```ebnf
IDENT       = letter , { letter | digit | ( "_" , ( letter | digit ) ) | "#" | "'" | '"' }
            | letter , { letter | digit | ( "_" , ( letter | digit ) ) | "#" | "'" | '"' } ,
              "-" , { letter | digit | ( "_" , ( letter | digit ) ) | "#" | "'" | '"' | "-" } ;
              (* Standard form: identifier built from letters/digits. An underscore "_" is only
                 absorbed when immediately followed by a letter or digit (internal underscore:
                 sa_4, Up_Down, just_intonation). A trailing "_" (no alphanumeric follows) stops
                 the ident scan — the tokenizer then emits one PROLONG token per trailing "_".
                 e.g. si3_____ = IDENT(si3) + PROLONG×5. BP3 rejects "_" in terminal names
                 (OkBolChar2 / Encode.c:415).
                 A trailing "-" is NOT part of the identifier name: BP3 rejects "-" in bol names
                 (CompileGrammar.c:1196). The tokenizer always emits the trailing "-" as REST.
                 e.g. do4- = IDENT(do4) + REST(-). do4- and do4 -  are therefore identical.
                 Second form (with "-" followed by more chars) applies to non-terminal identifiers
                 (LHS symbols like Tr-11, my-var), resolved by pre-scan. *)
INT         = digit+ ;
FLOAT       = [ "-" ] , digit+ , "." , digit+ ;
STRING      = '"' , { (* tout caractère sauf " *) } , '"' ;   (* littéral chaîne, pour @scene *)
value       = [ "-" ] , INT | FLOAT | IDENT | INT , "/" , INT ;
CODE        = (* tout caractère sauf ` non échappé *) ;
TEXT        = (* tout caractère jusqu'à fin de ligne *) ;
letter      = "a"-"z" | "A"-"Z" ;
digit       = "0"-"9" ;
blank_line  = (* ligne vide ou whitespace seul *) ;
```

**Contraintes lexicales** :
- `-` (tiret) **traînant** (immédiatement après un identifiant, sans espace) : `do4-` = IDENT(`do4`)
  + REST(`-`) — deux tokens distincts. BP3 interdit `-` dans les noms de bol
  (CompileGrammar.c:1196). `do4-` et `do4 -` sont donc équivalents.
  `dhin--` = terminal `dhin` + silence + silence.
  **Exception dans `[]`** : à l'intérieur d'un bracket, `[times-1]` est une mutation de flag
  (décrémenter `times` de 1), pas un identifiant `times-` suivi de `1`. Le parser détecte
  le pattern IDENT-avec-trailing-dash + INT et le décompose en flag + opérateur + valeur.
  Ceci s'applique aux guards (`[times-1]` en LHS) et aux flags RHS (`[times-1]` en RHS).
- `-` (tiret) en position **interne** (entre deux parties alphanumériques) est autorisé
  dans les non-terminaux (LHS) via pré-scan (ex: `Tr-11`, `my-var`).
- `_` **interne** est absorbé dans le nom si immédiatement suivi d'un alphanum (`sa_4`, `Up_Down`).
  `_` **traînant** (sans alphanum suivant) génère un token PROLONG distinct par underscore :
  `si3_____` = IDENT(`si3`) + PROLONG×5, `pa3_` = IDENT(`pa3`) + PROLONG×1.
  BP3 interdit `_` dans les noms de bol (OkBolChar2 / Encode.c:415).
- `#` est autorisé dans les identifiants pour les altérations musicales (C#4, F#2).
  Known limitation: `#` in terminal names currently causes issues with BP3's internal MIDI mapping when using flat alphabet.
- Les underscores dans les noms sont autorisés (ex: `just_intonation`).
  Le compilateur traduit `_` → espace dans les arguments de `_scale()` pour BP3.
  Known limitation: `_` in terminal names is rejected by BP3's alphabet parser. This is a blocker for the planned `Sa_v`/`Sa_^` octave convention.

**Quoted symbols** : BP3 supporte `'texte'` pour utiliser des caractères spéciaux
ou des nombres comme terminaux (`'1'`, `'2'`). BPScript **n'a pas** de quoted symbols —
les terminaux sont toujours des identifiants. Les grammaires BP3 qui utilisent des nombres
comme terminaux doivent être renommées dans la traduction (ex: `'1'` → `d1`).
Les nombres nus dans le flux BPScript sont des durées numériques, pas des terminaux.

---

## Couche 6 — Clés réservées

### Clés réservées de `[]`

```
mode     → MODE du bloc (random, ord, sub1, lin, tem, poslong)
scan     → sens du parcours par règle (left, right, rnd) — défaut : rnd
:N       → durée / cadre polymétrique ({v1, v2}:2 → {2, v1, v2} ; A4:1/2 → {1/2, A4})
/N       → diviser durée (A[/2] → durée ÷ 2, compilé en /2 A)
*N       → multiplier durée (A[*2] → durée × 2, compilé en \2 A)
weight   → poids de la règle
on_fail  → gestion d'échec (skip, retry(N), fallback(X)) (* not yet implemented *)
tempo    → tempo local
meter    → signature rythmique
timeout  → limite de temps sur <! (* not yet implemented *)
```

### Modificateurs de mode (sous-grammaire)

Déclarés dans `controls.json` section `subgrammar`. Émis en preamble BP3.

```
destru   → déstructure les terminaux composés selon l'alphabet (_destru)
striated → temps strié / pulsé (_striated)
smooth   → temps lisse / non pulsé (_smooth)
mm:N     → marquage métronomique en BPM (_mm(N))
```

Utilisables comme modificateurs de `@mode` : `@mode:lin(destru)`, `@mode:random(striated, tempo:60)`.
Ou en global : `@striated`, `@tempo:60` (appliqué au preamble de la première sous-grammaire).

### Clés réservées de `@`

```
actor NAME props...            → déclare un acteur (binding alphabet.X + tuning.X + sound.X + transport.X(...) — v0.8)
core                           → librairie noyau (lambda, on_fail)
controls                       → contrôles performance (vel, tempo, transpose, etc.)
alphabet.KEY:BINDING           → alphabet KEY depuis lib/alphabet.json, lié à BINDING
alphabet.KEY(transport=X, eval=Y) → transport ≠ eval (forme explicite)
tuning.KEY:ALPHABET            → tuning KEY depuis lib/tunings.json, lié à ALPHABET
sound                          → bloc déclaratif de prototypes son (anonyme + nommés, v0.8)
sound.LIBNAME                  → charge lib/sounds/LIBNAME.json (defaults + named + by_terminal, v0.8)
sub.KEY                        → table de substitution depuis lib/sub.json
routing.KEY                    → SUPPRIMÉ (feature @routing/routingTable retirée 2026-07-16 ; @routing rejeté au parse)
hooks                          → macros d'interaction (* not yet implemented *)
template                       → section template singulier (? = wildcard, ($N) = bracket marker) — v0.8 (ex-`templates`)
mode:VALUE(modifiers)          → mode de sous-grammaire avec modificateurs optionnels
tempo                          → tempo global
meter                          → métrique globale
baseHz                         → diapason (défaut 440) (* not yet implemented — current implementation uses @tuning:442 *)
transpose                      → transposition globale
chan                            → canal MIDI global
vel                            → vélocité globale
ins                            → programme MIDI global
improvize                      → mode improvisation continue (Improvize=1)   (* RETIRÉ en @-forme (erreur) → [@improvize], décision 2026-06-11 durcie *)
allitems                       → produire tous les items (AllItems=1)        (* RETIRÉ en @-forme (erreur) → [@allitems] *)
maxitems:N                     → nombre max d'items produits (0 = illimité)  (* RETIRÉ en @-forme (erreur) → [@maxitems:N] *)
quantize:N / quantization:N    → quantization en ms (défaut 10)
qclock:N                       → Qclock (dénominateur période métronome)
seed:N                         → graine RNG (0 = aléatoire)                 (* RETIRÉ en @-forme (erreur) → [@seed:N] *)
tuning:SCALE                   → temperament from tuning.json (e.g. @tuning:Cmaj)
tuning:N                       → reference pitch in Hz (e.g. @tuning:442)
filter                         → CV/signal objects library
min_tempo                      → contrainte tempo minimum (* not yet implemented *)
max_tempo                      → contrainte tempo maximum (* not yet implemented *)
```

### Mots réservés (3)

```
gate     → type temporel : occupe du temps, valeur constante
trigger  → type temporel : instant, zéro durée
cv       → type temporel : occupe du temps, valeur continue
```

### Symbole réservé (1)

```
lambda   → chaîne vide (efface le non-terminal)
```

---

## Traduction BPScript → BP3

| BPScript | BP3 | Notes |
|----------|-----|-------|
| `->` | `-->` | direction |
| `<-` | `<--` | direction |
| `<>` | `<->` | direction |
| `$X` | `(=X)` | template master (symbole) |
| `&X` | `(:X)` | template slave (symbole) |
| `${A S B}` | `(=A S B)` | template master (groupe) |
| `&{A S B}` | `(:A S B)` | template slave (groupe) |
| `$X tabla_stroke &X` | `(=X) tabla_stroke (:X)` | transcription entre master et slave |
| `~` | `&` | liaison |
| `#X` | `#X` | contexte négatif (identique) |
| `#?` | `#?` | boundary — pas de symbole (identique) |
| `!f` (standalone) | `<<f>>` | out-time object |
| `-` | `-` | silence (identique) |
| `_` | `_` | prolongation (identique) |
| `.` | `.` | period (identique) |
| `...` | `_rest` | repos indéterminé |
| `[X==N]` | `/X=N/` en LHS | guard condition flag |
| `[X-N]` | `/X-N/` en LHS | guard test + mutation |
| `[X=N]` | `/X=N/` en RHS | mutation flag |
| `[X]` | `/X/` en RHS | flag set/ref (nu) |
| `C4(vel:120)` | `C4 _script(CT 0)` | runtime suffixe (symbole) |
| `S -> C4 D4 E4 (vel:80)` | `_script(CT 0) C4 D4 E4` | runtime suffixe (règle) |
| `{!(vel:80) A B, !(vel:60) C D}` | `{_script(CT 0) A B, _script(CT 1) C D}` | contrôle instantané dans voix |
| `{A B !(vel:80), C D !(vel:60)}` | `{A B _script(CT 0), C D _script(CT 1)}` | contrôle instantané fin de voix |
| `!(transpose:200c)` | `_script(CT n)` | contrôle runtime instantané |
| `![retro]` | `_retro` | contrôle engine instantané |
| `{A B}(vel:100)` | `_script(CT 0_s) {A B} _script(CT 0_e)` | runtime suffixe (groupe) |
| `@mode:random` | `RND` en mode_line | mode du bloc |
| `[scan:left]` | `LEFT` dans la règle | mode dérivation |
| `[weight:50-12]` | `<50-12>` | poids décroissant |
| `[weight:K1=1]` | `<K1=1>` | K-param avec initialisation |
| `[weight:K1]` | `<K1>` | K-param (réf. valeur courante) |
| `[weight:inf]` | `<inf>` | poids infini (priorité absolue) |
| `[destru]` | `_destru` en preamble | flag de sous-grammaire |
| `A[/2]` | `_tempo(2/1) A _tempo(1/2)` | 2x plus rapide (bracket) |
| `A[*2]` | `_tempo(1/2) A _tempo(2/1)` | 2x plus lent (bracket) |
| `A[/3/2]` | `_tempo(3/2) A _tempo(2/3)` | 1.5x plus rapide (fraction) |
| `{A B}[/2]` | `_tempo(2/1) {A B} _tempo(1/2)` | groupe 2x plus rapide |
| `![/2]` | `_tempo(2/1)` | tempo séquentiel (pas de bracket) |
| `{v1, v2}:2` | `{2, v1, v2}` | durée / cadre polymétrique (≠ tempo) |
| `-----` | `-----` | séparateur (identique) |
| `lambda` | `lambda` | chaîne vide (identique) |
| `<!sync1` | `<<W1>>` | sync tag |
| `[scale: just_intonation C4]A` | `_scale(just intonation,C4) A` | valeur brute (espaces→virgules, `_`→espace) |
| `[keyxpand: B3 -1]C3` | `_keyxpand(B3,-1) C3` | valeur brute multi-args |
| `A(script: MIDI send Continue)` | `A _script(MIDI send Continue)` | espaces préservés (script) |
| `H(value: slide 0)` | `H _value(slide,0)` | valeur brute 2 args |
| `X ->` (RHS vide) | `X -->` | production epsilon (sans lambda) |
| `A(transpose:-3)` | `A _script(CT 0)` | runtime valeur négative |
| `[Ideas]` (guard) | `/Ideas/` | bare flag guard (test non-zéro) |
| `[meter:4+4/6]` | `4+4/6` avant RHS | time signature inline |
| `@template` | `TEMPLATES:` | section template (optionnelle, v0.8 — singulier) |
| `?` (dans template) | `_` | wildcard terminal (un slot) |
| `????` (dans template) | `____` | wildcards compacts (4 slots) |
| `($0 ???)` (dans template) | `(@0 ___)` | bracket master ($ → @) |
| `/1` (dans template) | `*1/1` | facteur d'échelle |

**Contraintes lexicales** :
- `-` (tiret) **traînant** : `do4-` = IDENT(`do4`) + REST(`-`) — deux tokens distincts.
  `do4 -` équivalent. `dhin--` = terminal `dhin` + silence + silence.
  BP3 interdit `-` dans les noms de bol (CompileGrammar.c:1196).
  **Exception dans `[]`** : `[times-1]` = mutation flag, pas identifiant `times-` + `1`.
- `-` (tiret) **interne** : autorisé dans les non-terminaux (LHS) via pré-scan (ex: `Tr-11`).
- `_` **interne** absorbé si suivi d'alphanum (`sa_4`, `Up_Down`, `just_intonation`).
  `_` **traînant** (sans alphanum suivant) → PROLONG séparé par underscore :
  `si3_____` = IDENT(`si3`) + PROLONG×5.  BP3 interdit `_` dans les noms de bol
  (OkBolChar2 / Encode.c:415).
- `#` est autorisé dans les identifiants pour les altérations musicales (C#4, F#2).
  Known limitation: `#` in terminal names currently causes issues with BP3's internal MIDI mapping when using flat alphabet.


## Bloc de directives de production `[@…]` (décidé et implémenté 2026-06-11)

Les directives de production (instructions au moteur sur COMMENT produire : seed,
maxitems, allitems, improvize) s'écrivent au niveau scène entre crochets, le `@`
répété sur chaque clé :

```ebnf
production_block = "[", production_key, { ",", production_key }, "]" ;
production_key   = "@", IDENT, [ ":", (INT | FLOAT | IDENT) ] ;
```

Exemples : `[@seed:1]`, `[@seed:1, @items:20]`, `[@improvize]`.
Lecture composée (table de la loi, hub/principes-syntaxe.md) : `[]` = adressé au moteur,
`@` = hors-temps/niveau monde. Le `@` intérieur discrimine d'un coup d'œil un bloc de
production d'une garde de règle (`[K1==1] …`). Les @-formes historiques (`@seed:N`…)
sont REJETÉES : erreur de compilation pointant la nouvelle écriture (arbitrage
utilisateur 2026-06-11, durci le même jour — pas de dépréciation douce). AST :
INCHANGÉ — le bloc produit les mêmes nœuds `Directive` que la @-forme d'origine.
Précédence d'exécution : console/session > scène > défauts moteur.

**Forme dans le flux `![@…]`** (décision 2026-06-14-shuffle-seed-orthogonaux) : un bloc de
production préfixé de `!` est un ÉVÉNEMENT DE FLUX (InstantControl). Restreint à `seed` —
seule clé ayant un contrôle de flux en BP3 : `![@seed:N]` → `_srand(N)` (re-semence au point
d'apparition). `![@maxitems:N]` / `![@allitems]` / `![@improvize]` = ERREUR (réglages de
boucle, aucun jeton de flux BP3). Lié à : `[shuffle]` brasse seul (`_rndseq`) ; `[shuffle:N]`
RETIRÉ (la graine s'écrit `seed`). Brassage déterministe local : `![@seed:N] {…}[shuffle]`.
