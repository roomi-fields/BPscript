# Notes — librairie `sounds`

Ce que `lib/sounds.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## types

LA LIBRAIRIE « sounds » — écrite dans le langage qu'elle sert.
Le bundle en rend la MÊME donnée, champ par champ. Les consommateurs ne voient aucun
changement — c'est l'AUTHORING qui change, pas la donnée.

⚠️ UNE NOTE EST UN COMMENTAIRE, plus une clé `_xxx` dans la donnée : un commentaire ne
   voyage pas jusqu'aux consommateurs, une clé si.

⛔ LE CORPS SE DÉLIMITE PAR LA PARENTHÈSE. Décision Romain, 2026-08-19 : « je m'oppose
   formellement à toute forme de parsing en fonction de l'indentation ». Un fichier reformaté
   ne change pas de sens.
Les prototypes de ce catalogue vivent dans `types` — invoquée ci-dessous.

