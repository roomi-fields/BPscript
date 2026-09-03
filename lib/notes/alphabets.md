# Notes — librairie `alphabets`

Ce que `lib/alphabets.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## types

LA LIBRAIRIE « alphabets » — écrite dans le langage qu'elle sert.
Convertie depuis le JSON : le bundle en rend la MÊME donnée, champ par champ. Les
consommateurs ne voient aucun changement — c'est l'AUTHORING qui change, pas la donnée.

⚠️ UNE NOTE EST UN COMMENTAIRE, plus une clé `_xxx` dans la donnée : un commentaire ne
   voyage pas jusqu'aux consommateurs, une clé si.
Les prototypes de ce catalogue vivent dans `types` — invoquée ci-dessous.

## bp3_indian

bp3_indian · ⚠️ CE N'EST PAS 'sargam'. BP3 RENOMME le clavier occidental, il ne le TRANSPOSE
pas : les trois conventions natives (ENGLISH/FRENCH/INDIAN) nomment les MÊMES touches.
L'ancre porte donc sur la classe 9 — 'dha' = 'A' = 'la' — à 440 Hz, ce qui place sa4 à
261.626 Hz, soit le do4 natif. Ancrer sur 'sa'=240 (l'ancre TRADITIONNELLE, portée par
l'alphabet 'sargam' ci-dessus) donnerait un rapport de 0.917 avec le natif : musicalement
légitime, mais infidèle au moteur — et c'est précisément l'écart que vina/vina2 contournaient
à la main. Les deux alphabets coexistent parce qu'ils répondent à deux questions différentes
: 'sargam' joue le sargam, 'bp3_indian' reproduit BP3.
bp3_indian · Tables VERBATIM du moteur : bp3-engine/csrc/bp3/-BP3main.h:140-141 (Indiannote)
et :147 (AltIndiannote). Les 12 classes s'expriment ici en 7 naturelles + suffixes 'k'
(komal, −1) et '#' (tivra, +1) — vérifié classe par classe sur les DEUX tables. Les deux
quirks de bord (ni# → classe 0 registre +1 ; sak → classe 11 registre −1) relèvent du repli
générique de degré, déjà porté par le résolveur de Kairos (src/pitch/bp3-alphabets.test.ts).

## bp3_english

bp3_english · ⚠️ CE N'EST PAS 'western'. Même jeu de naturelles, mais les REGISTRES sont ceux
du natif : l'octave −1 s'écrit '00' et non '-1' (table 'bp3', lue plus-long-d'abord).
baseRegister 5 = le registre '4' de cette table → A4 = 440 Hz. Les alternantes du natif
(B#/Db/Eb/Fb/E#/Gb/Ab/Bb/Cb) s'expriment par la carte d'altérations ; les deux quirks de bord
(B# → classe 0 registre +1, Cb → classe 11 registre −1) relèvent du repli générique de degré.
bp3_english · bp3-engine/csrc/bp3 -BP3main.h:136-147 (tables de noms) + Inits.c:445-530
(SetNoteNames, registres et quirks d'octave)

## bp3_fr

bp3_fr · ⚠️ CE N'EST PAS 'solfege'. Même jeu de naturelles, mais le natif NOMME ses registres
un cran plus bas : la3 = A4 = 440 Hz (là où 'solfege' pose la4). D'où une table de registres
PROPRE ('bp3_fr'), qui ajoute '000' sous '00' — le français est la seule convention native à
descendre si bas. Traduire une grammaire française vers 'solfege' la déplacerait d'une octave
entière.
bp3_fr · bp3-engine/csrc/bp3 -BP3main.h:136-147 (tables de noms) + Inits.c:445-530
(SetNoteNames, registres et quirks d'octave)

## turkish

turkish · Turkish makam uses many more note names than 7. This is a representative subset.
Full system has named pitches for each of the 53 commas in common use.

## shakuhachi

shakuhachi · meri = lowered (chin down), kari = raised (chin up). Additional fingerings exist
but vary by school.
shakuhachi · Wikipedia, article Shakuhachi (« A 1.8 shakuhachi produces D4, D above Middle C,
293.66 Hz, as its fundamental » ; « Five tone holes enable musicians to play the notes
D-F-G-A-C-D » ; registres « otsu », « kan », « dai-kan ») et shakuhachi.com / Chikushin, qui
NOMMENT chaque doigte : ro (d′), tsu (f′), re (g′), chi (a′), ri (c″), et precisent que la
plage ro-ri se nomme OTSU quelle que soit la longueur de l instrument. DEUX sources
independantes concordent sur les cinq hauteurs — la premiere donne la fondamentale et l
ensemble des notes, la seconde l appariement nom par nom, qui est ce qui evite une
TRANSPOSITION silencieuse.

## bohlen_pierce

bohlen_pierce · BP uses its own letter naming. No standard alteration system.

## tabla

tabla · Alphabet de percussion : aucune hauteur a resoudre, donc aucun tuning. Le champ
`voice` lie un terminal a une voix du catalogue du mot `voice`. CONTENU : les vingt bols de
l'alphabet natif le plus complet du corpus, plus `ki` et `ka`, declares par `-al.dhin--` et
`-al.kathak`. Tous sont INDIVISIBLES : aucun ne se decoupe sur les autres, mesure bol par bol
en le retirant de la liste. UN BOL COMPOSE NE SE DECLARE PAS — il se segmente. `dhagena` est
`dha ge na`, `tirakita` est `ti ra ki ta` ; les declarer ferait deux sources pour un meme
son. SEPT BOLS SONNENT au moteur natif — dha, na, tee, ta, ge, kt par les prototypes de
`dhati`, et `tin` par ceux d'`EkDoTin` — les sept portent une voix. LES TREIZE AUTRES SONT
MUETS, et c'est un ETAT : le fichier de sons de tabla n'existe pas dans le corpus natif. Un
bol muet reste atomique. `ghe` et `tun` SORTENT : aucun des soixante-et-un alphabets du
corpus ne les declare, et le moteur les refuse a la compilation. Ni atomiques ni composes —
inexistants.

## simple

simple · Alphabet ABSTRAIT : aucune hauteur, aucun accordage. Il existe pour que les scenes
de test structurelles (derivation, polymetrie, homomorphismes) restent abstraites tout en
satisfaisant le garde des terminaux. Ne jamais lui ajouter de diapason/baseNote : un symbole
de 'simple' ne sonne pas, il structure.

## shruti23

shruti23 · Ancre = tonique sa_4 = 261.625 Hz (native -to.tryShruti). Registre en suffixe
séparé par '_' (sa_4, r1_4) — convention 'saptak_us'.

## tryCsoundObjects

tryCsoundObjects · bp3-ctests/-al.tryCsoundObjects (noms, verbatim) · -so.tryCsoundObjects
(prototypes, non portes)

