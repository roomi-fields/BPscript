# Autorité — zone « résolution d'acteur / pitch / contrôles » (transpileur BPScript)

> Préparé par atlas (carte des autorités), déposé par bpscript. À LIRE avant de toucher
> `parser.js`, `actorResolver.js`, `libs.js` sur la résolution acteur / pitch / contrôles.

```
AUTORITÉ — avant de toucher la résolution d'acteur / pitch / contrôles, lire :
  • Modèle d'acteur (6 clés ; obligatoires alphabet+transport) ... docs/design/ACTOR.md
  • Couches de pitch (alphabet → octaves → tempérament → tuning) .. docs/design/PITCH.md
  • Clés d'acteur — arbitrage (6 clés, octaves) .................. hub/decisions/2026-06-16-cles-acteur-six.md
  • Contrôles — sémantique des 3 formes (bang/parens/underscore) . hub : décision contrôles 2026-06-16
  • Ce qui traverse l'AST vers le moteur ......................... hub/contrats/bpscript-bpx.md
  • Formes de syntaxe acceptées .................................. docs/spec/EBNF.md §acteur

PIÈGES (vérifiés sur pièces) :
  - octaves = NOTATION du registre (rattachée à l'ALPHABET) ≠ largeur de gamme
    (= intervalle de répétition `period_ratio`, couche tempérament, peut être non-2:1).
  - Défaut d'octaves = ALPHABET (décision cles-acteur-six). PITCH.md:67 ALIGNÉ le 2026-06-16
    (l'ancienne mention « tuning/western » était périmée — déjà corrigée).
  - 7 clés d'entité : alphabet, tuning, octaves, sound, transport, eval + voice
    (LANG-SONS-2, GO Romain [438] 2026-07-16 — hub/projets/lang-sons-spec.md ; les six
    premières = décision cles-acteur-six 2026-06-16).
  - CONTEXTE BPx UNIQUEMENT : l'AST est AGNOSTIQUE du moteur. Aucune notion BP3 dans l'AST
    (`_xxx(N)`, `flavor:'bp3'`…). La sortie grammaire BP3 = fonction héritée, ne pas y toucher
    sauf demande explicite. Cf. mémoire feedback_bpx_only_jamais_bp3.

EN AVAL (casse si l'AST change) : contrat AST → BPx, actorResolver, frontal BP3.
  Toute modif de forme d'AST → amender hub/contrats/bpscript-bpx.md.
```
