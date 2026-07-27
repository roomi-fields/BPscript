## BPScript — Meta-sequencer for Temporal Structure Composition

> ⚠️ **CONTEXTE BPx UNIQUEMENT (règle dure, Romain 2026-06-16).** L'AST est **agnostique du
> moteur**, destiné à **BPx** — aucune notion BP3 (`_xxx(N)`, `flavor:'bp3'`, catégorie « bp3 »…).
> Toute taxonomie d'AST est agnostique (`target: transport|engine`, `timing: bang|durée`), jamais
> « bp3 vs bpx ». Cf. mémoire `feedback_bpx_only_jamais_bp3`.
>
> **La sortie BP3 n'existe plus.** `compileBPS` et l'encodeur ont été SUPPRIMÉS le 2026-07-19
> (arbitrage Romain : « pour la compatibilité bps/gr, la seule chose que je veux c'est que la
> PRODUCTION soit identique, pas la grammaire »). Conformité au moteur natif mesurée sur les
> **jetons produits** vs baseline native — plus sur un texte de grammaire émis. Voie unique :
> `compileToBPxAST(source)` → `{ ast, errors, warnings }`.

3 reserved words, 24 symbols, 9 flag operators. Compiles to BP3 grammar format and runs via WASM.
Orchestrates SC, TidalCycles, Python, MIDI, DMX, etc. in a single file via backticks.

### Language summary
- **3 words**: `gate`, `trigger`, `cv` (temporal types)
- **24 structural symbols**: `@`, `->`, `<-`, `<>`, `{}`, `,`, `()`, `:`, `=`, `[]`, ``` `` ```, `//`, `-`, `_`, `.`, `...`, `!`, `<!`, `#`, `?`, `$`, `&`, `~`, `|`
- **9 flag operators**: comparison `==`, `!=`, `>`, `<`, `>=`, `<=` + calculation `+`, `-`, `=` (`-`/`=` réutilisent des glyphes aussi structuraux)
- **7 reserved qualifier keys**: `mode`, `scan`, `weight`, `on_fail`, `tempo`, `meter`, `scale` (`docs/spec/LANGUAGE.md` ; `scan`/`tempo`/`meter` portés par l'AST). `speed` SUPPRIMÉ (2026-06-26) → durée `:` (`{A B}:2`, `A4:1/2`)
- **Double declaration**: chaque symbole a type temporel + binding runtime (`gate Sa:sc`)
- Silence `-`, prolongation `_`, période `.` (fragment de durée égale) : identiques en BPScript et BP3
- `!` = événement simultané (trigger, gate, cv, ou mutation de flag)
- `[]` = instructions moteur (BP3) : guards, mode, weight, opérateurs tempo (durée `:` hors `[]`)
- `()` = instructions runtime : vel, pan, wave, attack, release, filter… (annotation OPAQUE portée sur l'événement jusqu'au runtime de sortie)
- Backticks : code évalué par le runtime du symbole (implicite) ou tagué (`sc:`, `py:`)

### Architecture
- `bp3-engine/` — Submodule : moteur BP3 WASM ([roomi-fields/bp3-engine](https://github.com/roomi-fields/bp3-engine))
- `src/transpiler/` — Parser et compiler
  - `tokenizer.js` — Source → tokens · `parser.js` — Tokens → AST (Scene, Directive, Rule, CVInstance, Macro, Polymetry)
  - `bpxAst.js` — Parser → AST canonique (annotations `payload`, validations fail-loud)
  - `index.js` — Façade : `compileToBPxAST(source)` → `{ ast, errors, warnings }` (voie UNIQUE)
  - `actorResolver.js` — Résout les acteurs (bindings alphabet/tuning/octaves) · `libs.js` — Library loader (JSON → controls, symbols, CV objects)
- `src/bpx/` — BPx engine stub (moteur de dérivation nouvelle génération, cf. specs BPX)
- `lib/` — Librairies JSON (controls, alphabets, tunings, filter, routing…)
- `dist/` — Build BP3 WASM (bp3.js, bp3.wasm, bp3.data)
- `docs/` — Documentation (5 dossiers par type)
  - `spec/` — `LANGUAGE.md` (spéc complète) · `EBNF.md` (grammaire formelle) · `AST.md` (nœuds AST)
  - `design/` — `ARCHITECTURE.md` (pipeline source→AST→grammaire BP3 + interface WASM) · `ACTOR.md`
    (acteur=voix : alphabet/tuning/sound/transport/eval, cascade de sortie, voix notes vs code,
    appareils) · `PITCH.md` (résolution pitch 6 couches : actor→alphabet→octaves→temperament→
    tuning→resolver) · `SOUNDS.md` (résolution terminaux unifiée : spec < CT < CV cascading) ·
    `CV.md` (CV/signal : ADSR, LFO, ramp) · `EFFECTS.md` · `HOMOMORPHISMS.md` (étiquetage
    post-dérivation) · `REPL.md` (adapters, backticks) · `SCENES.md` (hiérarchie de scènes,
    scoping flags, @scene/@expose/@map, sys) · (docs moteur BPx migrées dans le dépôt BPx :
    `../BPx/docs/ARCHITECTURE.md`, `../BPx/docs/ENGINE_SPEC.md`, `../BPx/docs/IMPLEMENTATION.md`)
    · `INTERFACES_BP3.md` (interface WASM in/out) · `TEMPORAL_DEFORMATION.md` (constraint solver)
  - `reference/` — `WASM_HOWTO.md` · `NATIVE_HOWTO.md` · `BP3_FILE_FORMATS.md` · `HO_FORMAT.md`
  - `issues/` — `POLYMAKE_STACK.md` (stack overflow polymétrie imbriquée) · `RNG_PORTABLE.md`
    (portabilité RNG MSVC/glibc) · `TEMPO_OPS_WASM.md` (opérateurs tempo `/N` `\N` `_tempo()` :
    écarts WASM vs natif)

### Tour de contrôle inter-projets (OBLIGATOIRE) — outil `tour`
Coordination de l'écosystème (BPScript, BPx, bp3-frontend, runtimes, moteur Bernard) : dépôt
PRIVÉ `/home/romi/dev/bp/hub`. Protocole MÉCANISÉ par le CLI `hub/tour` (plus d'édition markdown
à la main). Détail : `hub/README.md` (§Le protocole + §Outil tour).

0. **Règle de boucle** (Romain 2026-06-16) : (a) **RÉVEIL = COURRIER D'ABORD** — première action de
   tout réveil (session ou ping) = `tour inbox`. (b) **RAPPORT AVANT IDLE** — jamais s'arrêter en
   silence : dernière action = `tour send architecte` avec `FINI: <quoi> + commit` ou
   `BLOQUÉ: <sur quoi>`.
1. **Identité** (une fois/session) : `export BP_AGENT=bpscript`.
2. **Début de session** : `~/dev/bp/hub/tour inbox` + lire `TABLEAU.md` et mes `contrats/`.
3. **Écrire/arbitrer** : `~/dev/bp/hub/tour send <dest> "msg"` (`architecte` = destinataire valide).
   Jamais écrire dans ma propre boîte. Marquer lu : `tour inbox --ack`.
4. **Fin de session** : mettre à jour MOI-MÊME `TABLEAU.md` (ma ligne) et `projets/bpscript.md`.
   L'architecte ne corrige plus mes pièces, il recadre. Une ligne de tableau **nomme aussi
   l'EN-ATTENTE** et dit de qui il dépend — une ligne qui ne dit que ce qui est fait laisse croire
   que le reste avance.
   *(`baseline-status.json` RETIRÉ le 2026-07-27 : consigne périmée, le fichier n'a jamais existé
   ici. Trois runtimes en ont un parce qu'ils portent une parité mesurable contre un oracle ; le
   FRONTAL, lui, a pour baseline son corpus et ses gardes, déjà au portillon. Ne pas fabriquer un
   fichier vide pour satisfaire une consigne à la lettre.)*
4bis. **VÉRIFIER LES COMPTES QUI REVIENNENT SUR MON PROPRE TRAVAIL** (2026-07-27). L'architecte
   compte et remonte toute la journée ; **il est celui qui compte**, donc s'il compte à son
   avantage — ou au mien — personne ne le verra jamais. Sa propre demande : « continue à me
   corriger là-dessus, c'est le seul contrôle qui existe ». Payé le jour même : un bilan annonçait
   « 6 erreurs d'instrument attrapées AVANT envoi » ; **4 attrapées, 2 PARTIES** — et les deux
   parties sont celles qui l'ont fait agir, rattrapées par BPx et Kanopi, pas par moi.
   ⚠️ **Un bilan qui flatte devient le dossier.** Relire les chiffres qu'on me renvoie sur moi.
   ⚠️ **Et CONFIRMER un compte JUSTE, pas seulement corriger un compte faux** — sinon je ne parle
   de ses comptes que quand ils sont faux, et **mon silence finit par se lire comme un accord**.
   Un contrôle qui ne parle que pour contredire n'est pas un contrôle, c'est une alarme.
5. **Décisions transverses** : `decisions/` après arbitrage utilisateur uniquement
   (`tour decide <slug> -m titre --impacts a,b,c`). `constats/` = un finding écrit UNE fois,
   référencé ailleurs.

### Un fail-loud de langage est une action de FRONTIÈRE (architecte 2026-07-09)
Quand une forme jusque-là acceptée devient une erreur, les consommateurs aval **live-importent**
la source et leur portillon casse en minutes (précédent : chantier durée 2026-07-05, garde des
clés `[]` 9ec2abc — bpx a découvert le fail-loud à son portillon, sans préavis, deux fois le même
jour). AVANT/AVEC le commit, envoyer une note `tour` aux consommateurs (**bpx au minimum**,
**kanopi** si des scènes de la bibliothèque sont touchées) avec : 1. la **liste EXACTE** des formes
invalidées ; 2. le **commit** ; 3. la **migration attendue**, forme par forme. Corollaire : avant
de livrer un fail-loud, passer le corpus des consommateurs (`BPx/test/scenes/`) au compilateur et
compter les casses — ne jamais les laisser les découvrir.

### DÉCLARER UN MOT est une action de frontière — et la casse est MUETTE (payé 2× le 2026-07-26/27)
Un fail-loud invalide une forme et **crie** ; un mot nouveau ne casse aucune syntaxe, il **CONFISQUE
un nom** — et toute scène qui portait déjà ce nom est **tronquée en silence**. Côté consommateur,
rien ne distingue une scène qui a changé d'une scène qui a été amputée : c'est le pire mode d'échec,
pire que le fail-loud. Donc **même condition de livraison** que ci-dessus : mesurer les corpus
consommateurs AVANT de déclarer, pas après. Deux occurrences en 24 h, par deux chemins différents :
1. `mute`/`unmute`/`panic` déclarés sans argument → toute occurrence nue du mot devenait un
   contrôle ; `patchbay-demo` écrivait 7 mots, il en arrivait 6 (mesuré par Kairos). Piège de fond :
   **« sans argument » ≠ « s'écrit nu au fil de la séquence »** — les contrôles continus hérités de
   BP3 s'écrivent nus (10 scènes du corpus), les mots nouveaux non. La donnée doit le DIRE
   (`sacSeul`). Deux règles en sortent : **le plus local gagne** (une scène qui déclare un nom le
   possède, et l'ombrage s'ANNONCE), et **un mot rencontré là où il ne peut pas l'être REFUSE**, en
   donnant la réécriture — il ne disparaît jamais.
2. Une clé de **documentation** posée dans une section de contrôles est entrée AU VOCABULAIRE comme
   un contrôle (58 chargés, 57 après correction — le 58e était une ligne de prose). **Un fichier de
   données n'agrandit pas le langage en le commentant.** Frontière donnée→langage : **liste BLANCHE
   (exiger la FORME d'une déclaration), jamais liste noire** de noms de clés à exclure — sinon la
   prochaine clé de commodité rentre pareil. Critère MESURÉ sur l'existant, jamais choisi.

### ⚠️ LA FAUTE DE LA JOURNÉE (6× le 2026-07-27, six habits, une seule cause)
**On répare l'endroit où le défaut s'est MONTRÉ, pas l'espace où il peut vivre.** Les six habits :
une garde écrite pour la forme du ticket (×5) · un balayage dont la portée laisse survivre ce qui
est dehors · **une SECTION corrigée au lieu du DOCUMENT** — une heure après avoir réécrit un bloc
d'exemples, trois autres exemples de la même directive mentaient encore plus bas dans le fichier,
et un quatrième dans une autre spec.

**MÉCANISER, pas se souvenir** — chaque fois qu'un défaut se montre, se demander *quel est l'espace
où il peut vivre*, puis faire parcourir cet espace par une machine :
- l'espace des FORMES → produit croisé (`test/point_attente_dans_arbre.mjs` §6) ;
- l'espace des SCÈNES → balayage du corpus, socle qui refuse zéro ;
- l'espace de la DOC → `test/les_exemples_de_la_spec_compilent.mjs` : extrait les exemples de
  directive des trois specs et les **COMPILE**. Il a trouvé un mensonge dès son premier passage,
  que ma correction manuelle une heure plus tôt avait laissé.

**Et la méthode qui a tout trouvé aujourd'hui, chez tous les agents : COMPILER / MESURER, jamais
RELIRE.** La relecture n'a rien trouvé de la journée.

### Une garde se construit en MATRICE, pas en liste (5× la même faute, mécanisé le 2026-07-27)
La règle « énumérer TOUTES les formes que le parser peut produire » a été **inscrite le 2026-07-26 et
repayée le lendemain**. Diagnostic, mesuré : j'avais bien énuméré les sept formes… **pour la
propriété du jour**. Les sections plus anciennes du même fichier testaient toujours UNE forme.
**L'énumération était une propriété de la SECTION, pas du garde** — un garde grandit incident par
incident, et seule la section la plus récente porte l'énumération complète.

⚠️ **Une règle qu'on a écrite et qu'on connaît ne suffit pas** si elle demande d'y penser au bon
moment. La parade n'est pas plus de discipline, c'est le **PRODUIT CROISÉ** : le garde construit
`FORMES × PROPRIÉTÉS` lui-même. Ajouter une propriété la teste automatiquement sur toutes les
formes ; ajouter une forme teste automatiquement toutes les propriétés. Plus rien à penser.
Modèle : `test/point_attente_dans_arbre.mjs` §6 (7 formes × 5 propriétés = 35 cellules, plus un
témoin anti-rétrécissement qui échoue si la matrice se vide).

⚠️ **Et chercher par le MOTIF, pas par l'occurrence** : « quoi d'autre se perd entre une forme nue
et sa forme dérivée ? ». Le balayage a montré que le sac n'était pas PERDU mais **DÉPLACÉ** (porté
par l'assemblage au lieu du point) — pire à sa façon : rien ne manque, donc rien ne peut le
signaler ; il faut regarder au bon endroit pour voir que ce n'est pas le bon endroit.

### Fermer une famille : écrire CE QUE LE BALAYAGE N'A PAS COUVERT (payé le 2026-07-27)
**Un balayage a une PORTÉE, et ce qui est hors portée SURVIT** — y compris à une campagne qui croit
avoir tout fermé. Le 2026-07-27, la famille « verdir sans avoir rien examiné » a été fermée dans
sept gardes ; une huitième y a échappé (`order_parity.mjs`, mode campagne : liste **construite** en
filtrant sur l'existence des fichiers → arborescence absente = `0 OK / 0 DIFF sur 0`, sortie de
succès). Elle a survécu pour une seule raison : **ce mode n'était pas dans le balayage**.
⚠️ « Hors portillon » ne veut pas dire inoffensif, ça veut dire **INVISIBLE** : un garde hors gate ne
rougira jamais pour prévenir. Donc : quand tu fermes une famille, **écris la portée ET son
complément** — sinon la campagne suivante repart de la même portée et retrouve les mêmes survivants.

### L'INSTRUMENT ment plus souvent que le sujet (6× le 2026-07-27)
Quand un chiffre surprend, **suspecter l'instrument AVANT le sujet** — et le vérifier *avant*
d'envoyer la mesure, pas après. Les six formes payées en un jour :
1. **Trop court** : un marcheur d'arbre qui ne descend pas dans `voices`/`triggers`/`symbol` a
   rapporté « aucune adresse » et « nature absente » là où elles étaient présentes (3 fois).
2. **La mauvaise clé** : chercher un CHAMP (`s1_args`) comme si c'était un nom de FICHIER → zéro
   trouvé, conclusion « la garde lit un niveau inexistant » — 18 entrées le portaient.
3. **Le mauvais code de sortie** : lire `$?` **après un tube** rend le statut du tube, pas du
   programme. Un succès annoncé là où le programme échouait. *(Même famille que « le code de sortie
   d'un outil est une CLAME, pas un oracle » — ici ce n'est même pas l'outil qui ment, c'est la
   façon de l'interroger.)*
4. **La mauvaise question** : lire une RESTITUTION en croyant lire une PRODUCTION.
Ces erreurs se **refont**, ce ne sont pas des étourderies — et elles sont d'autant plus dangereuses
qu'elles produisent les mesures qu'on envoie aux autres, qui agissent dessus.

**Cette règle est MÉCANISÉE, ne compte pas sur ta mémoire** : `test/un_mot_nouveau_ne_confisque_pas_un_nom.mjs`
confronte à chaque portillon le vocabulaire aux noms que les 149 scènes/démos DÉCLARENT. Une
confiscation nouvelle rougit avant le push ; une confiscation assumée s'inscrit dans son registre,
datée et motivée. Une règle qui exige qu'on y pense au bon moment n'est pas une règle, c'est une
intention (architecte 2026-07-27) — donc quand une règle demande de la vigilance, **chercher ce qui
la rend mécanique** : un garde, une forme obligatoire, un champ que la machine relit.

### Écrire dans le dépôt d'un AUTRE : signer, prévenir, ne rien déclarer (payé le 2026-07-27)
**Une écriture chez un autre n'est LIVRÉE que quand son propriétaire l'a committée** (règle
architecte 2026-07-27). Tant qu'elle ne l'est pas, elle n'existe pas — ni dans un report, ni dans un
décompte, ni dans une preuve. Celui qui écrit **prévient et ne déclare rien** ; celui qui possède
committe dans la foulée ou dit pourquoi il ne peut pas.

**Corollaire de mon côté : SIGNER.** Payé sur `tryTicks` — annotation écrite, rapportée comme
livrée, **annulée une heure plus tard** par un `git checkout` explicite chez Kanopi parce que
personne ne la revendiquait. Elle portait sa date et sa raison, pas son auteur. Le même jour, un
diff sans auteur est apparu dans MON arbre et a coûté deux messages pour établir qu'il ne portait
aucun sens : **une écriture étrangère anonyme est indistinguable d'un bruit d'outil**, dans les deux
sens. La règle du propriétaire déplace la preuve ; la signature lui donne de quoi chercher l'auteur
au lieu de deviner. Les deux ensemble ferment le trou.

⚠️ **Et ne jamais avancer une CAUSE non mesurée dans un report qui, par ailleurs, mesure tout.**
J'ai transmis « probablement emporté par une opération git » ; c'était une annulation délibérée. Le
mot « probablement » ne rachète rien — dans un report où le reste est mesuré, une supposition se lit
comme une mesure.

### Changelogs moteur (OBLIGATOIRE)
Après toute modification dans `bp3-engine/csrc/` :
- `csrc/bp3/` (moteur Bernard) → mettre à jour `bp3-engine/CHANGELOG_ENGINE.md`
- `csrc/wasm/` (portage WASM) → mettre à jour `bp3-engine/CHANGELOG_WASM.md`
- Nouveau bug/issue moteur → ajouter dans `/home/romi/dev/bp/hub/courrier/bernard.md`

### Les ARTEFACTS DÉRIVÉS aussi sont une frontière (pas seulement les fail-loud)
Tout changement qui rend périmé un artefact DÉRIVÉ lu par d'autres dépôts est une action de
frontière, même sans syntaxe invalidée. Payé le 2026-07-19 : ajout de `@tempo` à 19 scènes
(ba8867a) sans fail-loud — BPx lit ces scènes EN DIRECT et leurs snapshots `s5_bps` dérivés,
restés périmés → 4 tests BPx passés au rouge, chantier calé sans toucher une règle de langage.
Avant de committer un changement de scène/fixture : **quel artefact dérivé devient faux ?**
(`snapshots/`, alphabets plats, prototypes, baselines) — le régénérer dans le MÊME commit, ou
prévenir dans le même geste. ⚠️ Ne jamais régénérer à l'aveugle pour faire verdir : le pipeline
`s5_bps` était mort depuis l'extraction de Kanopi (dispatcher disparu, l'outil répondait `OK` en
dégradant sa sortie) — régénérer aurait livré des oracles corrompus, muets. Valider sur un LOT,
jamais sur un cas (`bells` reproduisait bit-à-bit, 49/51 scènes divergeaient).

### Une garde s'écrit pour la CONSTRUCTION, jamais pour la forme signalée (payé 4× le 2026-07-26/27)
Une garde écrite en réaction à un cas ne garde que ce cas, reste **verte**, et donne l'illusion que la
famille est couverte. Quatre fois en deux jours : le filtre d'adresses n'acceptait que les alphabets ;
la garde des sacs ne voyait que la première paire valuée ; celle de `@map` ne voyait que la forme
pointée (un nom nu passait entier) ; celle du point d'attente n'inspectait que le premier niveau du
membre droit — l'attente **ancrée** vit sous un assemblage, elle était donc invisible (BPx l'a mesurée,
`e1be673`). Deux règles, non négociables :
1. **Énumérer TOUTES les formes que le parser peut produire** pour la construction (pour une attente :
   seule, collée, séparée par une espace, multiple, qualifiée, après un silence, dans un groupe
   polymétrique), pas la graphie du ticket.
2. **Descendre jusqu'aux feuilles.** Compter les voisins de surface ne voit pas ce qui vit sous un
   nœud composite. Corollaire déjà payé ailleurs : chercher au mauvais endroit et conclure à l'absence.

Et **prouver que la garde mord** par injection (retirer le correctif → elle rougit → remettre → verte),
sinon on ne sait pas si elle garde ou si elle décore.

### Librairies `lib/` — toute édition passe par le bundle (OBLIGATOIRE)
`src/transpiler/libs-data.js` est le bundle que **tous les consommateurs chargent** ; `lib/*.json`
et `lib/digital/*.ts` en sont les sources. Éditer la source sans régénérer crée une divergence
**silencieuse** (le code lit encore l'ancienne valeur).

    npm run bundle:libs     # régénère
    npm run bundle:check    # vérifie la fraîcheur (branché dans `npm run arch`, donc au gate)

Règle : toute édition de `lib/*.json` ou `lib/digital/*.ts` ⇒ régénérer ⇒ committer LES DEUX. Le
portillon mord (vérifié : source éditée sans bundle ⇒ `npm run arch` sort en 1, push bloqué).

⚠️ **Piège distinct que la garde de fraîcheur NE couvre PAS** : lire la *mauvaise* source. Elle
vérifie que source et bundle sont synchrones, pas qu'on lit le bon des deux. `lib/digital.json` ne
porte QUE la déclaration (description, rang, paramètres) — les corps vivent dans
`lib/digital/<nom>.ts` et n'existent que dans le bundle. Un consommateur qui lit le JSON du disque y
voit des entrées sans `body` et conclut à tort que la lib est vide (payé le 2026-07-18 : le pont de
mesure lisait le JSON, Kairos criait « déclarée au vocabulaire mais SANS fonction exécutable »).
**Charger `LIBS['digital']` depuis le bundle, jamais le JSON.**

### Build & Test
```bash
# OBLIGATOIRE : utiliser build.sh, JAMAIS make directement ni cp manuellement
cd bp3-engine
source /home/romi/dev/bp/emsdk/emsdk_env.sh        # PC2 natif (était /mnt/d/... sous WSL)
./build.sh all                                    # compile 3 targets (linux, windows, wasm)
./build.sh all --archive --version=v3.4.4-wasm.1  # compile + archive
cd ..

# Non-régression — LE portillon (branché sur pre-push : un push est refusé s'il mord)
npm run arch        # garde structurelle + fraîcheur du bundle de librairies
npm run typecheck   # types des librairies digital/homomorphism
npm run verify      # conformité AST_SPEC du corpus + émission des opérateurs de tempo

# Suites complémentaires, à la main quand on touche leur surface
node test/scan_corpus.mjs        # aller-retour BP3 → BPScript → BP3
node test/voie_b_status.mjs      # comparaison à la baseline native, EN SORTIE DE CHAÎNE
# Détail : test/README.md
```

> L'ancien pipeline `S0-S5` (`test_all.cjs`, `runner.cjs`, les étapes `sN`) a été **supprimé le
> 2026-07-19** : plus lancé par rien de vivant, mais restait consultable et se faisait prendre pour
> la procédure courante.

### BPScript Compilation Pipeline
```
Source text → Tokenizer (tokens) → Parser (AST) → AST canonique (bpxAst) → BPx → Kairos → Kronos
```
L'étape « Encoder → grammaire BP3 → moteur WASM » a été SUPPRIMÉE le 2026-07-19 : plus d'émission
de texte BP3. Conformité au moteur natif mesurée sur les **jetons produits**
(`test/voie_b_status.mjs`, comparaison à la baseline native).

### Key conventions
- `[]` = instructions MOTEUR, lues/interprétées par BPx (mode, weight, tempo, meter…) ; durée
  `{A B}:2` (hors `[]`)
- `()` = annotation OPAQUE portée SUR l'événement jusqu'au runtime de sortie (`vel`, `wave`…).
  Dans l'AST : `RuntimeQualifier` en suffixe, `InstantControl` dans le flux. Portée déclarée
  (`payload.scope` : `rule` | `group` | `template`, avec `containment:true`)
- Direction : `->` (défaut L→R), `<-` (R→L), `<>` (bidirectionnel)
- Silence `-`, tied notes `~` en BPScript → `&` en BP3
- Flags : `[X==N]` → `/X=N/` (guard), `[X=N]` → `/X=N/` (mutation)
- Flat alphabet : pas d'OCT, tous les terminaux en objets sonores silencieux (C4, sa6…) pour
  compat BP3
- Block separator : `-----` entre sous-grammaires de modes différents

### Agents — Équipe de développement
3 agents spécialisés dans `.claude/agents/` :
- **dev** — Développeur TDD. Code, teste, log dans scratchpad.
- **reviewer** — Review read-only. Classifie CRITICAL/IMPORTANT/MINOR.
- **ops** — Build et archive. Activation manuelle, APPROVE requis.

Communication inter-agents via `.claude/scratchpad/` (écrit/lu séquentiellement, aucun contexte
partagé). Délégation active obligatoire : fichier, ligne, action précise — jamais "fixe le bug" ou
"basé sur tes recherches". Sous-agents de recherche/tâches simples : Haiku.

### Sources brutes
`raw/` contient les documents bruts (articles, PDFs, notes, clippings). Ne jamais modifier `raw/`
automatiquement — espace humain. Pour ingérer : `rtfm sync raw/ --corpus raw`

### RTFM — Base de connaissances indexée

Ce projet est indexé avec RTFM (MCP server `.mcp.json`).

- Cherche dans RTFM (`rtfm_search`) AVANT Grep/Glob pour toute recherche exploratoire.
- Utilise `rtfm_expand` pour lire les sections pertinentes avec numéros de ligne.
- Ne lis jamais un fichier entier si RTFM peut cibler la section.
- Après modification de fichiers, RTFM se re-synchronise automatiquement.

### Sessions parallèles — Rôles par nom de session
Si lancé avec un nom de session (`-n`), lire immédiatement les fichiers mémoire correspondants pour
récupérer tout le contexte accumulé. Après lecture, résumer ce qu'on sait pour confirmer le contexte.

- **`moteur-wasm`** — Moteur BP3 WASM, tests e2e, conformité scènes. Focus : bugs moteur, pipeline
  WASM (bp3_api.c, stubs), CONFORMITY.md, aux files (`test_wasm_all.js` retiré le 2026-07-19 : la
  conformité se mesure contre le moteur NATIF, pas WASM — il ne se chargeait plus).
- **`transpileur`** — Tokenizer, parser, encoder, acteurs, prototypes. Focus : tokenizer.js,
  parser.js, encoder.js, actorResolver.js, prototypes.js, libs.js, lib/*.json, test/
- **`architecte`** — Architecte/PM de l'écosystème (orchestration, arbitrages, tour de contrôle).
  Skill : `.claude/skills/architecte-pm/SKILL.md` ; mémoire : profil_architecte_pm.md
- **`dev`** — Développeur transpileur (TDD, exécution des ordres de l'architecte). Skill :
  `.claude/skills/transpiler-dev/SKILL.md` ; mémoire : profil_dev_bpscript.md
- **`architecture`** — Design langage, pitch, acteurs, REPL, effets. Focus : docs/design/*.md,
  docs/spec/*.md, lib/alphabets.json, lib/tunings.json, lib/temperaments.json

## CodeGraph — graphe de code indexé

Ce dépôt est indexé avec CodeGraph (`.codegraph/`). Pour **comprendre ou localiser du code**
(symboles, appelants/appelés, rayon d'impact d'un changement), utilise
`codegraph explore "<question | symbole>"` (ou l'outil MCP `codegraph_explore`) **avant** grep/find ou
la lecture de fichiers. Complémentaire de RTFM : **RTFM** pour le quoi/où documentaire (texte + PDF),
**CodeGraph** pour la structure d'appel du code. (Index local, non versionné ; cloisonné à ce dépôt.)

## ⚠️ Sous-agents de dev — modèle imposé : Sonnet 5 (Romain 2026-07-12)
Quand tu lances un **sous-agent de développement** (outil Agent/Task), choisis **TOUJOURS le
modèle Sonnet 5** (`claude-sonnet-5`) — jamais un modèle plus lourd par défaut pour ce travail.

