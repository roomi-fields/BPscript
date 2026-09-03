# BPScript — Les manipulations et leur corps — Design

## Statut au 2026-09-03 : **une manipulation est un MOT du langage, et son corps se rattache à l'objet qui le porte** (arbitrage de Romain, 2026-09-03).

> ⛔ CE DOCUMENT A CHANGÉ DE FORME, PAS DE SUJET. Il décrivait une librairie de fonctions
> (`type:'digital'`, `objects:{transpose:{params, body}}`) à côté du contrôle qui la nommait. Romain
> a tranché la question qu'elle posait — « pourquoi le code n'est pas exactement au même endroit que
> la déclaration ? ou sinon, on doit faire un principe de fichiers d'en-têtes comme les .h et les
> .c ? » : c'est la seconde forme. La déclaration nomme, le fichier voisin porte le corps.
>
> **LA FORME D'AUJOURD'HUI**, en deux fichiers, pour les quatre manipulations de hauteur :
>
> ```text
> lib/transpo.bpsl            control transpose (args(interval), argType:interval, scope(…),
>                                                rank:30, params(ratio(…), interval(…)), …)
> lib/transpo/transpose.ts    const transpose: DigitalFn = (ctx) => { … }
> ```
>
> Le nom du fichier dit l'objet ; le chargeur greffe le corps sur lui, à la racine de la librairie ou
> dans n'importe quelle place, sans qu'aucune section soit nommée dans le code. Le corps voyage avec
> le mot : la section `librairies` de l'arbre le joint partout où la scène écrit le contrôle.
>
> **UN PROTOTYPE PORTE LE CORPS DE SA FAMILLE.** L'applicateur d'homomorphisme est écrit une fois, sur
> la racine, et chaque table l'emporte avec elle :
>
> ```text
> lib/homomorphism/homomorphism.ts   l'applicateur
> lib/homomorphism.bpsl              homomorphism dhati (sections(…))
> ```
>
> **CE QUI A DISPARU** : la librairie `digital`, la famille `function`, et l'entrée
> `homomorphism.substitute`. Une manipulation n'est pas une entrée à part : c'est le contrôle que la
> scène écrit, et il porte `rank`, `params` et `body`.
>
> Ce qui suit décrit le SDK, le contrat avec Kairos et l'historique de la décision de 2026-06-30 —
> tout cela reste vrai : le corps est du vrai code TS, typé à l'écriture, transpilé au chargement par
> qui le résout, exécuté sur une copie.

---

## 1. Concept — le jumeau DIGITAL de l'objet CV

La cartographie (PAS 1) a révélé une symétrie qu'on exploite ici : une fonction digitale est le
**jumeau digital de l'objet CV**.

| Aspect | objet CV (analogique) | fonction digitale |
|---|---|---|
| Ce qu'est le comportement | courbe **déclarative** (donnée : `curve.segments`) | **vrai code TS** |
| Réalisé par | runtime **audio** (calcule le signal) | **Kairos** (exécute le code à la résolution) |
| Cible | un **signal** | la **hauteur canonique** (puis d'autres valeurs) |
| Forme de lib | `{type:'cv', objects:{adsr:{parameters,input,output,curve}}}` | `{type:'digital', objects:{transpose:{params,body}}}` |

Source du jumeau analogique : `lib/mod.json` (`{type:'cv', objects:{adsr,lfo,ramp}}`), `docs/archive/CV.md` (⛔ archivé).
Première fonction visée : `transpose` (décalage de N pas de grille) ; puis `register_shift` (décalage
de N périodes/registres). `transpose`, `keyxpand`, `rotate` sont désormais des **libs digitales
réalisées** (`lib/transpo/*.ts` + `lib/transpo.bpsl`, captées dans `libs-data.js`). Côté Kairos, le
repli hardcode `resolveTransposed` est **SUPPRIMÉ** (`resolver.ts:415-416`) et le chemin chaud applique
la lib via `executerDigital` (`resoudre-hauteur.ts:184-195`, ordre rotate→keyxpand→transpose) ; Hz
prouvé e2e (`rotate-keyxpand-e2e.test.ts`, `transpose-digital-e2e.test.ts`). `transpose` reste DÉCLARÉ
dans `lib/controls.json` comme **surface de contrôle** (l'invocation ; cf. §7).

## 2. La forme de lib (mon côté)

Une librairie de fonctions digitales suit la structure de `lib/mod.json`, `type:'digital'` :

```jsonc
{
  "name": "pitch",          // espace de noms de la lib
  "type": "digital",        // discriminant (cf. cv) — consommé par le chargeur + Kairos
  "objects": {
    "transpose": {
      "params": {           // SIGNATURE typée — même grammaire que CV `parameters`
        "steps": { "type": "int", "default": 0, "description": "Décalage en pas de grille" }
      },
      "body": "…code TS…"   // CORPS : vrai code TS, typé contre le SDK (§3)
    }
  }
}
```

- `params` réutilise la convention de typage des paramètres CV (`{unit|type, range, default, description}`,
  cf. `lib/mod.json` adsr/lfo). C'est la **signature** que la scène renseigne (surface d'invocation §7 : mono `(transpose:2)`, multi `keyxpand:(pivot:B3, factor:-1)`).
- `body` = le code TS de la transformation. Pur, déterministe, synchrone (chemin chaud : un appel par
  note à la résolution). Il cible le **SDK** (§3).

### Format du corps — RÉCONCILIÉ avec le runtime Kairos
Kairos transpile le **TS source au CHARGEMENT** de la lib (cache par lib, clé = provenance+version+hash
source ; KAI-B03 §1). Donc la lib **transporte du TS SOURCE** (texte). Les deux « formats » que j'avais
opposés (F1/F2) ne s'opposent PAS — ils se composent :
- **Authoring** : l'auteur écrit un module `.ts` **typé contre le SDK** (`DigitalFnContext`, fourni par
  Kairos) → typage réel à l'écriture (tout l'intérêt du « vrai code TS manipulable »).
- **Stockage/chargement** : un bundle (miroir de `src/transpiler/libs-bundle.js`) capte le **TS source**
  dans la lib (registre `libs-data.js`) ; Kairos le transpile au load.
→ Typage à l'écriture **ET** mécanisme de bundle existant. (Le détail du build = PAS 4.)

## 3. Le SDK — le contexte Kairos (ALIGNÉ avec KAI-B03)

Le **SDK** = les types du **contexte Kairos** que l'auteur d'une fonction cible. Kairos en est
propriétaire (il possède la résolution). Le contexte est défini dans `kairos/docs/KAI-B03-runtime-
fonctions-digitales.md §2` : `DigitalFnContext { target, models, params }` — `target` = vue
LECTURE/ÉCRITURE des facettes NON-temporelles du terminal (hauteur en COORDONNÉES canoniques
`step`/`register`/`degreeIndex`, vélocité, canal, contrôles) ; `models` = tempérament/accordage/
alphabet/registres en LECTURE SEULE ; `params` = les arguments de l'appel (`transpose:2 → {steps:2}`).

**Signature (contrat partagé — SCELLÉE, Romain GO [207])** : `(ctx: DigitalFnContext) => void` — la
fonction **modifie `ctx.target`** (PAS un retour de `Partial`). Raison du fond (mutation > pure-return) :
l'enveloppe `{target, models, params}` est **extensible en v2** à un nœud/sous-arbre sans changer la
forme ; la mutation de `target` passe à l'échelle de cette v2, là où un `Partial<TerminalView>` ne le
ferait pas. Elle gère aussi proprement l'écriture **multi-facettes** (hauteur + vélocité + canal). Reste
**déterministe/mémoïsable** (snapshot des facettes d'entrée ; aucun I/O/horloge/aléa).

> **INVARIANT COPIE (SCELLÉ, Romain [207]) — à respecter par les deux côtés.** La fonction modifie une
> **COPIE** des facettes que Kairos prépare et lui passe (`ctx.target`), **JAMAIS l'arbre réel par
> référence**. **KAIROS SEUL** applique le résultat de la copie à la sortie canonique (`content.pitch`…).
> Raison : Kairos est l'**autorité d'écriture de l'arbre** ; le code de lib (3 provenances, dont
> **perso/communautaire**) est **NON FIABLE** — la copie **protège l'arbre** (un code fautif n'altère
> jamais l'arbre réel) et **garantit le déterminisme/la mémoïsation** (le snapshot d'entrée est la clé,
> la copie l'isole). « `mutation in-place` » = mutation **de la copie**, pas de l'arbre.

```ts
// l'auteur écrit, typé contre le SDK de Kairos (DigitalFnContext) :
export default (ctx: DigitalFnContext): void => {
  ctx.target.pitch!.step += Number(ctx.params.steps);   // transpose = décalage de grille
};
```

Pureté/déterminisme exigés (rejouable, embarquable, pas d'I/O ni d'aléatoire non-graine).
**Général, pas hauteur-only** : `target` porte aussi vélocité/canal/contrôles → `accent`, routage, etc.
(la hauteur est le premier cas, pas le seul).

## 4. Frontière BPScript ↔ Kairos (résumé)

| Côté | Responsabilité |
|---|---|
| **BPScript (moi)** | forme de lib `{nom, type:'digital', objects:{nom:{params, body}}}` ; chargement par le **mécanisme existant** (bundle → `registry` → `loadLib` via `@directive` ; 3-provenances via `registerLib`, `libs.js:32-45`) ; convention de signature des params (jumelle CV) ; authoring/typage contre le SDK |
| **Kairos** | runtime : transpilation TS→JS au load (esbuild-wasm/sucrase), bac-à-sable, exécution déterministe ; **API/contexte** (les types concrets du SDK) ; application de la fonction à la hauteur (remplace le `resolveTransposed` codé en dur, `resoudre-hauteur.ts:88`) |

## 5. Chargement — réutilise l'existant (zéro infra neuve)

- Le mot vit dans le catalogue qui le déclare (`lib/transpo.bpsl`) et son corps dans le fichier voisin qui porte son nom (`lib/transpo/transpose.ts`), pré-bundlé dans
  `src/transpiler/libs-data.js` (généré par `src/transpiler/libs-bundle.js`), auto-enregistré au load
  (`libs.js:21,58`).
- Chargée par `@directive` via `loadLib(name, subkey)` (`libs.js:86-102`).
- **3 provenances** (fournie lecture-seule / perso / communautaire) : l'hôte injecte/surcharge via
  `registerLib`/`registerAll` (`libs.js:32-45`, commentaire `libs.js:14-15`). Conforme à la décision
  `hub/decisions/2026-06-29-tout-par-librairies.md` (l'hôte FOURNIT, Kairos RÉSOUT).

## 6. Alignement avec Kairos (KAI-B03) — SCELLÉ (Romain GO [207]) vs PAS 4

**Scellé (frontière emboîtée, validée Romain [207])** :
- **Signature** = `(ctx: DigitalFnContext) => void`, la fonction modifie `ctx.target` (§3). Convergée
  avec Kairos (meilleure pour la v2 arbre/sous-arbre + multi-facettes).
- **Invariant COPIE** : la fonction modifie une COPIE préparée par Kairos, jamais l'arbre réel ; Kairos
  SEUL applique le résultat (autorité d'écriture + code de lib non fiable). Détail §3.
- **SDK** = `DigitalFnContext` de Kairos (KAI-B03 §2) ; ma forme de lib le cible.
- **Vrai code TS, pas compo de primitives** : les `models` (lecture seule) + helpers du sandbox sont
  DISPONIBLES au code TS libre ; la fonction n'est PAS restreinte à composer des primitives. Ma
  proposition antérieure « compo de primitives » est **superséquée** par la décision Romain.
- **Nom** : le nom déclaré (clé `objects` de la lib) = la référence de scène = porté **verbatim/opaque**
  par BPx = **clé de résolution** dans la lib FOURNIE (KAI-B03 §3). Confirmé.
- **Format du corps** : authoring `.ts` typé + bundle source-texte (§2) — composé, plus un either/or.

**PAS 4 (implémentation, après relecture courte archi)** :
- Transpileur navigateur tranché : **sucrase** (strip de types au load), repli esbuild-wasm — côté Kairos.
- Jeu minimal de **helpers** offerts dans le sandbox (navigation de grille, conversions de registre) —
  côté Kairos.
- **Migration de `transpose` — FAITE** : `transpose`/`keyxpand`/`rotate` sont des libs digitales (corps
  TS = autorité du comportement), câblées côté Kairos (repli hardcode supprimé) ; Hz prouvé e2e.
  `transpose` reste dans `lib/controls.json` comme **surface de contrôle**. La surface d'invocation
  multi-arguments est **ratifiée** (§7).

## 7. Surface d'invocation — ⚠️ MÉCANISME **SUPERSEDED** le 2026-07-26 (motif conservé)

> **Le MÉCANISME décrit ici — la « valeur-groupe » `keyxpand:(pivot:B3, factor:-1)` — n'est plus le
> canon.** Il est remplacé par `hub/decisions/2026-07-26-ecriture-des-controles-virgule-espace-deux-points-point.md`
> (RATIFIÉE, Romain) : l'**espace** sépare les parties d'une valeur, la **virgule** sépare les
> éléments du sac. Écriture actuelle : `(keyxpand: B3 -1)`.
>
> **Le MOTIF de §7 est conservé, et il était juste** : la virgule faisait DEUX métiers, et il fallait
> l'en sortir. Ce qui change est la solution. La valeur-groupe donnait à `(` un second sens — le
> groupement — en plus de « s'adresser au runtime », flagrant dans `[goto:(3, 0)]` où une parenthèse
> se serait ouverte à l'intérieur d'un sac moteur. Ne laisser à la virgule qu'**un seul métier**
> supprime le problème au lieu d'ajouter une profondeur pour le contourner.
>
> **La note de portée ci-dessous portait déjà la piste** : « l'engine `[]` sépare déjà les deux
> niveaux autrement (espace = arguments, virgule = instructions) — non concerné (à reconfirmer) ».
> Le sac moteur était donc conforme depuis le début, et c'est SA règle qui a été généralisée au sac
> runtime, plutôt qu'une règle neuve inventée pour lui. Le « à reconfirmer » a été tranché.
>
> **Ce qui reste vrai de §7, et pourquoi on le garde écrit** : le rejet de la forme d'appel
> `keyxpand(...)`. Elle avait DÉJÀ été pesée et écartée ici le 2026-07-02 — « préserve la logique du
> langage ». Elle est revenue par la fiche d'un contrôle qui la documentait, et a été supprimée du
> parseur le 2026-07-26. Le texte d'origine est conservé ci-dessous pour cette traçabilité.

### Texte d'origine (2026-07-02), conservé pour traçabilité


Décision langage. Résout la **surcharge de la virgule** dans le sac `()` : elle séparait à la fois les
réglages du sac ET les arguments d'un même réglage, le parseur devant deviner (lookahead `IDENT:` +
connaissance du registre des réglages — couplage forme↔sens ; `parser.js` `parseRuntimeQualifier`).

**Règle** : la **valeur** d'un réglage peut être un **groupe `()`** de sous-affectations nommées.
- Mono (inchangé) : `(transpose:2)`, `vel:80`.
- Multi : `keyxpand:(pivot:B3, factor:-1)` — chaque paramètre en `nom:valeur`, **ordre libre**.
- Le rôle de chaque virgule est tranché par la **profondeur de parenthèses**, non par le vocabulaire.
  Sans ambiguïté : `(vel:80, keyxpand:(pivot:B3, factor:-1), cutoff:toto)`.

**Pourquoi A** (vs forme appel `keyxpand(...)`) : extension minimale (une seule idée neuve : la valeur
peut être un groupe), `:` = affectation partout, aucune asymétrie mono/multi, découple le parseur du
registre. Romain : « un poil plus lourd mais préserve la logique du langage ».

**Portée** : sac `()` runtime uniquement. L'engine `[]` sépare déjà les deux niveaux autrement
(espace = arguments, virgule = instructions) — non concerné (à reconfirmer au spec parseur).

**Dans le groupe** (défaut proposé, arbitrage Romain final) : nommé d'abord (ordre libre) ; positionnel
`keyxpand:(B3, -1)` admis en raccourci → mappé sur l'ordre déclaré (`controls.json` : keyxpand
`[pivot, factor]`, rotate `[degrees]`, transpose `[steps]`).

**Statut** : ratifié, **parseur pas encore adapté**. Aujourd'hui ne parse que le positionnel dans le sac
(`(keyxpand:B3,-1)`) ou l'engine (`![keyxpand: B3 -1]`) ; la forme nommée-groupe échoue sur le `:`
(`parser.js:2642`, `parseControl`). Changement chiffré : groupe-valeur opt-in dans `parseControl` +
nœud Control portant les clés + remap encodeur nommé→ordre déclaré (noms d'args déjà dans
`controls.json`). Cadencement = architecte (backlog **LANG-DIGITAL-INVOCATION**).
