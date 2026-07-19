# Dossiers retirés — ne pas s'appuyer dessus

## `CONTROLES_RUNTIME_OU_ENGINE.md` — RETIRÉ le 2026-07-19

Verdict de Romain : **bidon**. Le dossier était bâti sur deux erreurs, dont une qui n'est
pas la mienne mais que je n'ai pas non plus détectée :

1. une **prémisse fausse** — une prétendue régression du `_script`, confirmée à Romain
   depuis un commentaire périmé de `lib/controls.json:147` sans que personne vérifie le
   code. Il n'y avait pas de régression : l'AST n'a jamais porté de `_script` ;
2. un **mauvais cadrage** — « reclasser des contrôles runtime en engine », alors que la
   question n'était pas là.

La décision réelle est prise ailleurs : `_script` est un interne BP3, la nature et la valeur
voyagent en annotation propre, puis le nœud est retiré côté BPx.

**Ne pas retravailler ce dossier en l'état.** S'il faut un jour reposer la question des
contrôles, elle se repose depuis la décision, pas depuis ce texte.

## `MARQUEURS_STRUCTURELS.md` — RETIRÉ le 2026-07-19

Clos par la décision `hub/decisions/2026-07-19-marqueurs-structurels-aucun-travail-langage.md`
(RATIFIÉ, autorité Romain) : **les cinq marqueurs `+ : ; = \` ne demandent aucun travail de
langage.** Chacun est déjà exprimé, déjà décidé, ou éteint dans le moteur :

- `=` / `:` — le couple maître/esclave de gabarit, **déjà exprimé** par `$X` / `&X` ;
- `+` — **déjà exprimé** par `[meter:4+4+4+4/4]` ;
- `;` — son seul sens distinct est **du code mort** dans le moteur (`CompileGrammar.c:1354`
  commentée) et relève de la métaprogrammation, hors périmètre ;
- `\` — **subsumé** par la décision du 2026-06-26 sur les trois concepts de temps.

C'est une décision de **clôture** : elle existe pour empêcher une quatrième réouverture d'un
faux gap. Le dossier est donc archivé, pas supprimé — mais il ne faut pas le rouvrir.

**Ce que le dossier avait vu juste, et ce qu'il avait sur-conclu.** La mesure était bonne :
les glyphes sont traités à l'identique dans `StructuralRule()`, et la décision le confirme de
son côté (« joué à l'identique par `+ = :` »). Ce qui était fautif, c'est le saut de cette
mesure étroite à un « ils sont interchangeables » général — retiré la veille de la clôture,
parce qu'un grep qui ne trouve rien ne prouve rien. La leçon vaut au-delà de ce dossier : pour
« que signifie X en BP3 », le code dit ce qu'il FAIT, pas ce que la chose VEUT DIRE.
