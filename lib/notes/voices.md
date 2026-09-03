# Notes — librairie `voices`

Ce que `lib/voices.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## types

LA LIBRAIRIE « voices » — écrite dans le langage qu'elle sert.

UN CORPS DE VOIX EST UNE FONCTION JAVASCRIPT SIMPLE, `(t, dur, env) => échantillon`.
`t` est le temps local en secondes (0..dur), `dur` la durée de la note, et `env.pitch` porte
la hauteur gravée en Hz. Une voix PERCUSSIVE ne lit jamais `env.pitch` : elle sonne sans
hauteur. Le corps décrit son son directement — il ne compose aucune couche.

⚠️ LA CONSTANTE DE TEMPS D'UNE DÉCROISSANCE EST ÉCRITE EN SECONDES, dans le corps même.
   Un argument nommé à unité (`decay:350ms`) n'est pas du JavaScript ; l'exponentielle l'est.

⛔ AUCUNE VOIX N'INVENTE DE HAUTEUR. Une voix pitchée sans hauteur gravée est SILENCIEUSE —
   c'est ce que faisait la forme d'avant, et c'est ce que la page des voix du runtime publie.
   Un repli `env.pitch||110` fait sonner à 110 Hz ce qui devait se taire : mesuré chez
   runtime-audio, `wobble` rendait 7.52e-2 sans hauteur là où il devait rendre zéro.

⛔ LE BRUIT EST UNE FONCTION DU TEMPS, JAMAIS UN TIRAGE. `Math.random()` rend deux ondes
   différentes pour la même note : inoffensif à l'oreille, fatal à qui compare deux rendus
   échantillon par échantillon. Le hash ci-dessous est déterministe et se rejoue à l'identique.

⚠️ UNE NOTE EST UN COMMENTAIRE, plus une clé `_xxx` dans la donnée : un commentaire ne
   voyage pas jusqu'aux consommateurs, une clé si.

Chaque voix se déclare par son type en tête, `voice` — le prototype vit dans `types`, invoqué
ci-dessous. La clé `section` dit seulement la place du paquet où elle se range.

