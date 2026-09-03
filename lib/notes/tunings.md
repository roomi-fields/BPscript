# Notes — librairie `tunings`

Ce que `lib/tunings.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## types

LA LIBRAIRIE « tunings » — écrite dans le langage qu'elle sert.
Convertie depuis le JSON : le bundle en rend la MÊME donnée, champ par champ. Les
consommateurs ne voient aucun changement — c'est l'AUTHORING qui change, pas la donnée.

⚠️ UNE NOTE EST UN COMMENTAIRE, plus une clé `_xxx` dans la donnée : un commentaire ne
   voyage pas jusqu'aux consommateurs, une clé si.
Les prototypes de ce catalogue vivent dans `types` — invoquée ci-dessous.

## sargam_12TET

sargam_12TET · diapason (Hz) for sa is tradition-dependent. 240 Hz is a common default.

## bp3_indian_12TET

bp3_indian_12TET · Mêmes degrés que sargam_12TET — c'est l'ANCRE qui distingue les deux, pas
la grille : ici dha4 = 440 Hz (le clavier occidental renommé), et non sa = 240 Hz. Cf. le
_note de l'alphabet bp3_indian.

## bp3_fr_12TET

bp3_fr_12TET · Mêmes degrés que bp3_english — c'est l'ANCRE qui distingue (la3 = 440 Hz), pas
la grille. BP3 RENOMME le clavier, il ne le transpose pas.

## sargam_22shruti

sargam_22shruti · En 22-shruti, komal/tivra = offset d'altération de l'alphabet sargam (komal
−1, tivra +1) indexé sur la grille 22-shruti (voie formule). NB (à vérifier séparément, hors
de ce dedup) : un décalage komal réel vaut ~2 shruti — si l'offset −1 (1 pas) diverge de
l'intention musicologique, c'est une question de résolution PRÉ-EXISTANTE (le résolveur
utilisait déjà l'offset, pas l'ancien ratio 16/15 supprimé), à traiter avec kairos.

## arabic_24TET

arabic_24TET · husayni (6e degré, ancien 'la') ancré à 440 Hz — référence A440 inchangée,
alphabet en noms de perde.

## turkish_53TET

turkish_53TET · degrees[] maps the 16 named notes to their comma positions. Turkish system is
complex with many more named pitches.

## gamelan_pelog

gamelan_pelog · Gamelan tunings are ensemble-specific. These are representative Central
Javanese values.

## western_just_c

western_just_c · Ré-ancre exceptionnellement sur la tonique C4=261.63 (le tuning porte sa
tonique, comme _scale la déclare — builder.ts:229 lit tuning.diapason/baseNote). Généralité
(backlog JUST-ANCRE-DEPUIS-TONIQUE) : dériver l'ancre de la tonique émise (règle :10 =
Aj4→A).

## shakuhachi_12TET

shakuhachi_12TET · Les cinq doigtes du registre otsu sonnent RE FA SOL LA DO, soit 0, 3, 5, 7
et 10 demi-tons au-dessus de la fondamentale (sources dans lib/alphabets.json, champ
_source_ancre). Le temperament EGAL est le choix coherent avec cette entree : ses alterations
meri et kari sont deja exprimees en demi-tons. Un shakuhachi d atelier n est pas exactement
tempere — cette table decrit le systeme de notes, pas la facture d un instrument donne.

