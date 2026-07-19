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
