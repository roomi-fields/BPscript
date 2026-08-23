# Archive — documents retirés du corpus vivant

Ce dossier garde des documents **qui ne décrivent plus le langage ni le produit**. Ils sont
conservés pour mémoire. **Aucun ne fait autorité sur quoi que ce soit.**

La référence du langage est `../spec/LANGUAGE.md`, et elle seule.

- [CV.md](CV.md) — objets CV et modulation, **sortis du langage le 2026-08-08**. Le sujet revient
  avec FaustX, chantier ouvert par la décision du 2026-08-18.
- [modulation.json](modulation.json) — la librairie des cinq cibles de branchement (`cutoff`,
  `amplitude`, `resonance`, `pitch`, `pan`), **archivée le 2026-08-22**. Elle a quitté `lib/`, que
  le bundle balaie : plus personne ne la charge. `pan` reste un contrôle vivant, déclaré par
  `lib/expression.bpsl`.
- [mod.json](mod.json) — le catalogue des modules (`adsr`, `lfo`, `ramp`), **archivé le
  2026-08-23**. Il a quitté `lib/`, que le bundle balaie : plus personne ne le charge. Le lecteur
  qui reconnaissait la déclaration d'une instance (`adsr env1`) est sorti de `parser.js` dans le
  même mouvement — c'est un retrait de forme, pas un nettoyage.
- [modules.md](modules.md) — la section « Les modules » de `LANGUAGE.md`, **archivée le
  2026-08-23** avec le catalogue et avec la graphie `module.X`, que le compilateur n'a jamais
  connue : l'axe `module` n'est servi par aucune librairie.
- [SCENES.md](SCENES.md) — hiérarchie de scènes, **supprimée du langage le 2026-08-01**.
- [58-demos-archivees-supprimees.md](58-demos-archivees-supprimees.md) — les 58 démos de
  `_archive/web/demos/`, **supprimées sans retour le 2026-08-16** : leurs noms, et ce que portaient
  les cinq sans homonyme vivant.
