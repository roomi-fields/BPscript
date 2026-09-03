# Notes — librairie `test_alphabets`

Ce que `lib/test_alphabets.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## types

LA LIBRAIRIE « test_alphabets » — écrite dans le langage qu'elle sert.
Convertie depuis le JSON : le bundle en rend la MÊME donnée, champ par champ. Les
consommateurs ne voient aucun changement — c'est l'AUTHORING qui change, pas la donnée.

⚠️ UNE NOTE EST UN COMMENTAIRE, plus une clé `_xxx` dans la donnée : un commentaire ne
   voyage pas jusqu'aux consommateurs, une clé si.
Les prototypes de ce catalogue vivent dans `types` — invoquée ci-dessous.

## abc

abc · Reproduction FIDELE du fichier natif `-al.abc`, lue en SOUMETTANT chaque candidat au
moteur plutot qu'en interpretant le format : une fleche `a --> a'` y declare DEUX TERMES, pas
une correspondance. Les marqueurs de section — `*`, `TR`, `sync` — ne sont PAS des termes ;
l'alphabet fabrique `{a,b,c}` les separe, puisque `TR` y passe comme VARIABLE tandis que
`chik` y est refuse.
abc · -al.abc / -ho.abc in bp3-engine/test-data/

## abc1

abc1 · Reproduction FIDELE du fichier natif `-al.abc1`, lue en SOUMETTANT chaque candidat au
moteur plutot qu'en interpretant le format : une fleche `a --> a'` y declare DEUX TERMES, pas
une correspondance. Les marqueurs de section — `*`, `TR`, `sync` — ne sont PAS des termes ;
l'alphabet fabrique `{a,b,c}` les separe, puisque `TR` y passe comme VARIABLE tandis que
`chik` y est refuse. SEULES CINQ LETTRES portent une prime — a, c, d, f, g ; `b`, `e` et `h`
sont declarees NUES. Ce n'est pas une troncature : le fichier natif est ainsi, et completer
par symetrie inventerait trois termes.
abc1 · -al.abc1 / -ho.abc1 in bp3-engine/test-data/

## conway

conway · d1='1', d2='2', d3='3'. Bare numbers are durations in BPscript.
conway · -gr.look-and-say

## kathak_count

kathak_count · Subset of tabla bols used for counting patterns.
kathak_count · -al.EkDoTin in bp3-engine/test-data/

## structural

structural · Used by checkNegativeContext, tryAllItems, and other structural grammar tests
from Bernard.
structural · Various test grammars in bp3-engine/test-data/

## dhati

dhati · Reproduction FIDELE d'un fichier natif, pour que la grammaire `-gr.dhati` tourne
AS-IS. Ce catalogue ne se compose pas : il recopie. Un bol atomique qui manquerait a une
grammaire se declare ICI, jamais dans `alphabets`, dont le contenu suit la musicologie.

## checkhomo

checkhomo · Reproduction FIDELE du fichier natif, lue en SOUMETTANT chaque candidat au moteur
plutot qu'en interpretant le format. LES MARQUEURS DE SECTION NE SONT PAS DES TERMES : le
compilateur d'alphabet enregistre les siens comme terminaux, ce qui se prouve sur un alphabet
FABRIQUE — avec la ligne de marqueur il est accepte, sans elle il ne l'est pas. Les VARIABLES
sont ecartees par le meme controle : repassees sur un alphabet fabrique qui ne les contient
pas, elles passent quand meme. `a`, `a'` et `a"` sont TROIS termes distincts : l'apostrophe
et le guillemet font partie du nom parce que l'alphabet les declare. `H`, `TR` et `OCT` sont
des VARIABLES, ecartees.

## dhin

dhin · Reproduction FIDELE du fichier natif, lue en SOUMETTANT chaque candidat au moteur
plutot qu'en interpretant le format. LES MARQUEURS DE SECTION NE SONT PAS DES TERMES : le
compilateur d'alphabet enregistre les siens comme terminaux, ce qui se prouve sur un alphabet
FABRIQUE — avec la ligne de marqueur il est accepte, sans elle il ne l'est pas. Les VARIABLES
sont ecartees par le meme controle : repassees sur un alphabet fabrique qui ne les contient
pas, elles passent quand meme. `-al.dhin--` et `-ho.dhin--` sont le MEME FICHIER — 247
octets, meme empreinte — retenus par le registre pour deux grammaires. Une seule entree les
sert.

