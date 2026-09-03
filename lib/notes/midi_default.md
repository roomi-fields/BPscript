# Notes — librairie `midi_default`

Ce que `lib/midi_default.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## types

LA LIBRAIRIE « midi_default » — écrite dans le langage qu'elle sert.
Convertie depuis le JSON : le bundle en rend la MÊME donnée, champ par champ. Les
consommateurs ne voient aucun changement — c'est l'AUTHORING qui change, pas la donnée.

⚠️ UNE NOTE EST UN COMMENTAIRE, plus une clé `_xxx` dans la donnée : un commentaire ne
   voyage pas jusqu'aux consommateurs, une clé si.
GESTES
LES QUATRE GESTES SONT DES PAIRES, ET LES HUIT MOTS SONT DÉCLARÉS ICI, chacun avec sa valeur.
Écrire les deux côtés plutôt que le seul mot actif rend le fichier lisible sans le déplier
mentalement, et un garde exige qu'exactement UN mot par paire soit vrai. ⛔ `resetcontrols`
VAUT FAUX, ET LA CAUSE COMPTE AUTANT QUE LA VALEUR. `Inits.c:212` le met à VRAI au démarrage,
puis `SaveLoads1.c:584` le remet à FAUX au début de CHAQUE chargement de réglages — et une
scène charge toujours ses réglages. Le cas VRAI n'existe donc que dans une exécution qui n'en
charge aucun, ce qui n'arrive pas en usage. Sans cette phrase, quelqu'un relira `Inits.c:212`
dans six mois et « corrigera » cette ligne en croyant réparer. `resetnotes` vaut FAUX aussi :
aucun site du moteur ne l'arme (`Inits.c:207`, périmètre les 54 fichiers de source/BP3).
C'est la mesure qui a fait tomber la première règle de découpage des paires — celle qui
réservait une paire aux seuls gestes vrais au natif.
Les prototypes de ce catalogue vivent dans `types` — invoquée ci-dessous.

## chan:1

L'environnement surcharge la valeur d'un contrôle par une LIGNE DE TÊTE, comme une scène l'écrit
en tête (arbitrage Romain, 2026-09-03, forme 4) : `volume:90` donne au contrôle `volume`, chez qui
invoque cette librairie, la valeur 90. La place ne se juge pas ici : c'est la valeur d'un objet,
pas un usage. Le plus local gagne ensuite — la scène, l'acteur, l'occurrence.

