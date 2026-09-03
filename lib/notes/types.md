# Notes — librairie `types`

Ce que `lib/types.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## types

LES PROTOTYPES DES CATALOGUES.

⛔ CE FICHIER DÉCLARE SON MOT — `resolves:types`. Décision Romain, 2026-08-21 : « je comprends
qu'il faut mettre des `resolves` dans toutes les librairies, parce que MÊME `types` peut être
invoqué en déclaratif ». `lib/scales.bpsl` l'écrit d'ailleurs en tête depuis sa conversion.

⚠️ ET L'EN-TÊTE DISAIT L'INVERSE — « ce fichier ne déclare AUCUN mot d'invocation : rien de ce
qu'il porte n'est adressable par un axe ». MESURÉ LE 2026-08-21, LES DEUX MOITIÉS ÉTAIENT
FAUSSES : `core` + `types` compile, et `types.gamut` aussi. La phrase décrivait une intention,
pas ce que le compilateur fait — et elle se lisait comme une mesure parce qu'elle citait un
consommateur. Une affirmation fausse sur mon code se retire de mon code.

LA LIGNE DE PARTAGE DES GAMMES est la FAÇON DE DIRE LES HAUTEURS : par intervalles exacts, par
degrés dans un tempérament, ou par assemblage. Trois manières de définir une échelle.
`directional` dérive de `degree` : une échelle dont la montée diffère de la descente EST une
échelle à degrés, avec une propriété en plus.

⛔ UN PROTOTYPE NE DÉCLARE PAS CE QUE SES DESCENDANTS PORTERONT — Romain, 2026-08-25 : « comme il
n'y a pas de classes, on ne fait pas de prédéfinition d'objet vide : l'objet est défini quand on
l'utilise ». Il EXISTE, et ce qu'un exemplaire porte, il le porte. La nature d'un champ se lit
dans l'écriture de l'exemplaire : une parenthèse de membres nus est une suite, un deux-points est
une valeur. Un nom nu vaut un objet vide, et le type voyage.

⚠️ LA LIGNE RESTE, POUR UNE RAISON MUSICALE : `interval`, `degree` et `composite` sont trois
FAÇONS DE DIRE une gamme, pas des gammes. Les retirer obligerait à élire une gamme arbitraire
comme ancêtre de toutes les autres. Ce qui reste est le seul rôle prototypal réel — donner un
parent nommé à `interval maqam_sikah (…)`.

## sound

Un son : ce qu'on entend quand on l'émet. Déclaré AVANT l'alphabet, dont les terminaux en sont —
un prototype se déclare avant d'être nommé comme type. Ses exemplaires s'invoquent en tête
(`sound.tabla_perc`), donc il déclare la portée scène : c'est un axe de catalogue.

## alphabet

Un alphabet se déclare en tête de scène. Il porte l'octaviation par défaut : un alphabet qui
n'écrit pas la sienne hérite de celle-ci, et celui qui l'écrit la surcharge. Ses terminaux sont
des SONS — `sound terminals()` : le type en tête, le nom ensuite, une collection obligatoire dont
chaque alphabet donne les éléments (arbitrage Romain, 2026-09-03).

## temperament

Les prototypes des catalogues qui declarent leurs entrees par leur type. Un AXE DE CATALOGUE est
celui qui declare la portee `scene` : ses exemplaires s'invoquent en tete, `tuning.just`,
`voice.wobble`. Un temperament ne s'invoque pas directement — il passe par un accordage —, donc
il ne la declare pas ; c'est la portee qui le dit, jamais une liste (Romain, 2026-09-03).

## control

Les types de déclaration du socle : ce qu'une librairie ou une scène écrit en tête d'une ligne
pour dire ce qu'elle déclare. Ils sont en portée quand ce fichier l'est.

## destination

Les DESTINATIONS — les canaux de l'architecture, chacun avec les directions qu'il autorise : `in`
(une entrée lue par la scène), `out` (une sortie), `writable` (son écriture dans une scène a son
appareil), et les paramètres de son raccord. La liste est FERMÉE : c'est la donnée qui la porte.

## actor

L'acteur : ce qu'un acteur peut porter, chaque membre déclaré par son type (le type en tête) et
sans valeur — obligatoire au sens de la règle, refusé à l'USAGE seulement : un acteur qui n'écrit
que `out.midi` est complet tant qu'aucun terminal ne lui demande un alphabet, et la cascade le
fournit alors (la scène, puis `core`). Les clés d'un acteur sont les noms de ces membres.

## signal

Les conventions de lecture d'une variable. `signal` est un flux de nombres sans convention — le
cas ordinaire ; les trois autres en dérivent : un signal lu comme une hauteur, comme une position
dans un cycle, comme un état haut ou bas.

