# Notes — librairie `core`

Ce que `lib/core.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## expression

LA LIBRAIRIE « core » — écrite dans le langage qu'elle sert.
Convertie depuis le JSON : le bundle en rend la MÊME donnée, champ par champ. Les
consommateurs ne voient aucun changement — c'est l'AUTHORING qui change, pas la donnée.

⚠️ UNE NOTE EST UN COMMENTAIRE, plus une clé `_xxx` dans la donnée : un commentaire ne
   voyage pas jusqu'aux consommateurs, une clé si.
Le SCHEMA de core a ete DISSOUS le 2026-09-03 (arbitrage Romain, point 2 des cinq arbitrages) :
les mots de la grammaire vivent dans le schema de SYNTAXE (`schema-syntaxe/language.json`), les
clés d'acteur sont les membres types du prototype `actor`, les canaux les entrees du prototype
`destination`, les cles de crochet une portee `bracket` sur chaque controle, les axes de
catalogue se derivent (un prototype de `types` qui a des entrees dans une famille). Rien n'est en
portee sans invocation, sauf la syntaxe.

Ce que ce catalogue APPORTE — chaque nom invoque une librairie, et sa chaîne se
résout transitivement. Décision Romain, 2026-08-20.

