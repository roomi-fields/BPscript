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
### ⛔⛔ `docs/spec/LANGUAGE.md` EST LA BIBLE — seule référence, cible intransgressible (Romain, 2026-08-06)

> ⛔⛔⛔ **JE N'ÉCRIS PAS DANS CE FICHIER. INTERDICTION FORMELLE DE ROMAIN (2026-08-09)** — « j'interdis
> formellement quiconque d'écrire dans ce fichier sans mon autorisation explicite, c'est une faute
> GRAVE ». Ni ajouter, ni retirer, ni réécrire, ni corriger une forme, **ni ajouter un socle à un
> exemple qui ne compile pas**. Un arbitrage de Romain sur le langage **n'autorise pas** à toucher le
> fichier : il faut qu'il autorise le geste, nommément, pour ce changement précis.
> **À la place** : mesurer, remonter l'écart avec sa pièce (`fichier:ligne` des deux côtés), attendre
> son mot. Un écart entre le code et la bible reste un **écart signalé**.
>
> ⚠️ **CE QUI A COÛTÉ CETTE RÈGLE EST DE MOI, et le mécanisme est plus vicieux que la faute.**
> J'ai écrit dans ce fichier **sept fois le 2026-08-09**, dont quatre marquées `feat(langage)` — donc
> des ajouts au langage. Et mon commit `34bc924` (15h30) y a **REMIS `@controls`**, retiré six jours
> plus tôt : je corrigeais deux exemples qui ne compilaient pas en leur **ajoutant un socle**, et ce
> socle portait un appel supprimé. Il y est resté sept heures.
> **Le mot n'est entré par aucune décision — il est entré PAR UN EXEMPLE.** Personne ne l'a décidé,
> personne ne l'a validé, et la bible l'a enseigné à tous ceux qui l'ouvraient. Romain était certain
> qu'il n'y était pas la veille ; le journal lui donne raison. **Réparer un exemple est le geste par
> lequel une forme morte revient dans la référence**, parce qu'il ne se présente jamais comme un
> changement de langage.
### ⛔ JE NE SPÉCULE PAS SUR LE LANGAGE — 3 règles dures (Romain, 2026-07-28)

**Son constat, mot pour mot** : « ton rôle c'est d'être le spécialiste du langage BPScript et tu
spécules complètement, tu ne le maîtrises pas du tout. » En une journée : une graphie INVENTÉE
montrée à Romain, des antislashs doublés semés dans quatre documents, une forme documentée qui
fabrique un son fantôme. Les ressources existaient toutes — je ne les ai pas employées.
### Tour de contrôle inter-projets (OBLIGATOIRE) — outil `tour`

Coordination de l'écosystème (BPScript, BPx, bp3-frontend, runtimes, moteur Bernard) : dépôt
PRIVÉ `/home/romi/dev/bp/hub`. Protocole MÉCANISÉ par le CLI `hub/tour` (plus d'édition markdown
à la main). Détail : `hub/README.md` (§Le protocole + §Outil tour).
### ⛔ ON SE PRÉVIENT À L'ÉCRITURE, PAS AU PUSH (règle de Romain, 2026-07-29)

⚠️ **CETTE SECTION PORTAIT UNE INSTRUCTION FAUSSE JUSQU'AU 2026-07-30** — « dans cet atelier, les
dépôts consomment la SOURCE l'un de l'autre, pas un paquet publié ». Elle généralisait UN type de
lien à tous, et elle vivait à l'identique chez cinq agents. **Une doc périmée laisse croire ; une
instruction périmée FAIT FAIRE** : BPx a publié sans prévenir Kairos parce qu'il avait chez lui une
phrase qui lui disait que ce cas n'existait pas.
### Écrire un garde

- **Réparer l'espace où le défaut peut VIVRE**, jamais l'endroit où il s'est montré. Un balayage a une
  portée, et ce qui est hors portée survit — écrire la portée **et son complément**.
- **Un garde s'écrit pour la CONSTRUCTION**, jamais pour la forme signalée. Il énumère toutes les
  formes que le parser produit, dans **toutes** ses sections : l'énumération est une propriété du
  garde, pas de sa section la plus récente. Une matrice, pas une liste.
- **Injecter la faute dans l'ACCUSÉ, puis dans le JUGE** — le rendre constant, aveugle, muet — et
  exiger que le garde rougisse. Un garde qui ne teste que des cas qui réussissent garde l'accusé.
- **Une empreinte compare TOUT**, en ne retirant que ce qui est prouvé non-sujet. Choisir les champs
  comparés, c'est choisir ce qu'on ne verra pas.
- **Suspecter l'INSTRUMENT avant le sujet** quand un chiffre surprend, et le vérifier **avant**
  d'envoyer la mesure. Un marcheur trop court, une mauvaise clé, un code de sortie lu après un tube
  rendent tous un résultat plausible et faux.
- **Hors portillon veut dire invisible** : un garde qui ne tourne pas au gate ne préviendra jamais.

### Franchir une frontière

- **Rendre une forme invalide casse les consommateurs en minutes** : passer leur corpus au
  compilateur **avant** de livrer, puis les prévenir avec la liste exacte des formes invalidées, le
  commit, et la migration attendue forme par forme.
- **Déclarer un mot CONFISQUE un nom**, et la casse est **muette** : toute scène qui portait ce nom
  est tronquée sans un signe. Même condition de livraison qu'une forme invalidée. Le plus local
  gagne, l'ombrage s'annonce, et un mot rencontré hors de sa place est **refusé avec sa réécriture**.
- **Un artefact DÉRIVÉ lu par un autre dépôt est une frontière**, même sans syntaxe touchée. Avant de
  committer un changement de scène ou de fixture : quel artefact devient faux ? Le régénérer dans le
  même commit, et **valider sur un lot** — un cas qui reproduit ne prouve rien.
- **Écrire chez un autre : signer, prévenir, ne rien déclarer.** L'écriture est livrée quand son
  propriétaire l'a committée, et pas avant.
### Changelogs moteur (OBLIGATOIRE)
Après toute modification dans `bp3-engine/csrc/` :
- `csrc/bp3/` (moteur Bernard) → mettre à jour `bp3-engine/CHANGELOG_ENGINE.md`
- `csrc/wasm/` (portage WASM) → mettre à jour `bp3-engine/CHANGELOG_WASM.md`
- Nouveau bug/issue moteur → ajouter dans `/home/romi/dev/bp/hub/courrier/bernard.md`

### Librairies `lib/` — toute édition passe par le bundle (OBLIGATOIRE)

`src/transpiler/libs-data.js` est le bundle que **tous les consommateurs chargent** ; `lib/*.json`
et `lib/digital/*.ts` en sont les sources. Éditer la source sans régénérer crée une divergence
**silencieuse** (le code lit encore l'ancienne valeur).
### Build & Test
```bash
# OBLIGATOIRE : utiliser build.sh, JAMAIS make directement ni cp manuellement

## ⛔ Chercher — l'ordre, sans exception

1. **RTFM** (`rtfm_search` puis `rtfm_expand`) pour toute recherche de doc.
2. **codegraph** (`codegraph explore "<question|symbole>"`) avant tout grep, find ou lecture de code.
3. **La carte d'autorités d'Atlas** (`atlas/carte-autorites/`) pour « où vit l'autorité sur X ? ».
4. Le **fichier de référence** qu'elle désigne.
5. **Demander à Atlas** quand l'information reste introuvable.
## ⛔⛔ Trancher un comportement : « comment ça fonctionne en BP3 natif ? »

Toute question de **comportement, de fonction ou de primitive** se tranche d'abord sur le **moteur
natif BP3**. On couvre **a minima ce que fait le natif**, sauf dérogation explicite de Romain.

## ⛔⛔⛔ Le langage ne se définit pas sans Romain

`BPscript/docs/spec/LANGUAGE.md` est la bible du langage.
## ⛔ Carte d'autorités — toute modification se signale

Toute modification d'un document de la carte d'autorités est **systématiquement signalée et reportée
à Romain**. Leur **mise en conformité est un objectif permanent**.

## ⛔ Migrer casse, et on répare

Remplacer X par Y = **supprimer X dans le même mouvement**. On migre, **on regarde où ça casse, on
répare**. Aucune solution intermédiaire, aucune voie parallèle, aucune migration « sans casse ».

## ⛔ Coder

- **Le code mort s'élague** dans le mouvement qui le rend mort. Une branche sans appelant vivant sort.
- **La librairie d'abord** : ce qui peut se déclarer ou se retrouver en librairie y vit. Une valeur
  écrite en dur dans le code est invisible — personne ne peut la lire ni la surcharger.
- **Les commentaires sont utiles et proportionnés** : ils disent ce que le code ne montre pas.
## ⛔ Écrire un document

- **Descriptif et factuel** : le document décrit **ce qui est**, dans son état d'aujourd'hui.
- **Affirmatif** : on décrit l'objet. La forme négative — « ce n'est pas », « au lieu de », « sans » —
  se réécrit en énoncé positif.
- **Sans justification narrative** : ni « untel a dit », ni « parce que », ni date, ni renvoi à une
  décision, ni contraste avec une forme antérieure. Le pourquoi vit dans sa décision datée.
## ⛔ `LANGUAGE.md` est ma référence unique sur le langage

`BPscript/docs/spec/LANGUAGE.md` **est ce que le code doit dire** : un écart est un **défaut**,
jamais une préséance à arbitrer. `AST.md` et `EBNF.md` en sont des **dérivés**, jamais des autorités.
### Key conventions
- `[]` = ce qui gouverne la **DÉRIVATION** : test de drapeau, affectation de drapeau, procédure
  (`goto` `repeat` `failed` `stop`), rang de gabarit ; durée `{A B}:2` (hors `[]`)
- Le **signe** dit ce que la chose EST ; le **destinataire** est dit par la librairie où le contrôle
  est listé, seule source de vérité. Chantier en cours : migration du sac `[]` vers `()`.
- `()` = annotation OPAQUE portée SUR l'événement jusqu'au runtime de sortie (`vel`, `wave`…).
  Dans l'AST : `RuntimeQualifier` en suffixe, `InstantControl` dans le flux. Portée déclarée
  (`payload.scope` : `rule` | `group` | `template`, avec `containment:true`)
- Direction : `->` (défaut L→R), `<-` (R→L), `<>` (bidirectionnel)
- Silence `-`, tied notes `~` en BPScript → `&` en BP3
- Flags : `[X==N]` → `/X=N/` (guard), `[X=N]` → `/X=N/` (mutation)
- Flat alphabet : pas d'OCT, tous les terminaux en objets sonores silencieux (C4, sa6…) pour
  compat BP3
- Block separator : `-----` entre sous-grammaires de modes différents

### RTFM — Base de connaissances indexée

Ce projet est indexé avec RTFM (MCP server `.mcp.json`).
## CodeGraph — graphe de code indexé

Ce dépôt est indexé avec CodeGraph (`.codegraph/`). Pour **comprendre ou localiser du code**
(symboles, appelants/appelés, rayon d'impact d'un changement), utilise
`codegraph explore "<question | symbole>"` (ou l'outil MCP `codegraph_explore`) **avant** grep/find ou
la lecture de fichiers. Complémentaire de RTFM : **RTFM** pour le quoi/où documentaire (texte + PDF),
**CodeGraph** pour la structure d'appel du code. (Index local, non versionné ; cloisonné à ce dépôt.)
## ⚠️ Sous-agents de dev — modèle imposé : Sonnet 5 (Romain 2026-07-12)
Quand tu lances un **sous-agent de développement** (outil Agent/Task), choisis **TOUJOURS le
modèle Sonnet 5** (`claude-sonnet-5`) — jamais un modèle plus lourd par défaut pour ce travail.

