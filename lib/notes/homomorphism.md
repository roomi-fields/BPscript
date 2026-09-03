# Notes — librairie `homomorphism`

Ce que `lib/homomorphism.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## homomorphism

LA LIBRAIRIE « homomorphism » — écrite dans le langage qu'elle sert.
Convertie depuis le JSON : le bundle en rend la MÊME donnée, champ par champ. Les
consommateurs ne voient aucun changement — c'est l'AUTHORING qui change, pas la donnée.

⚠️ UNE NOTE EST UN COMMENTAIRE, plus une clé `_xxx` dans la donnée : un commentaire ne
   voyage pas jusqu'aux consommateurs, une clé si.

## tabla_stroke

⛔ `substitute` N'EST PLUS UN OBJET À PART — arbitrage de Romain, 2026-09-03 : une manipulation est
un MOT, et son corps se rattache à l'objet qui le porte. L'applicateur est le corps du PROTOTYPE
`homomorphism` (fichier `lib/homomorphism/homomorphism.ts`), dont chaque table hérite : la section
de l'arbre joint donc l'applicateur avec la table, ce que kairos demandait (3676).

