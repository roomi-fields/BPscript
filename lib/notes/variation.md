# Notes — librairie `variation`

Ce que `lib/variation.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## types

LA LIBRAIRIE « variation » — écrite dans le langage qu'elle sert.
Convertie depuis le JSON : le bundle en rend la MÊME donnée, les consommateurs ne
voient aucun changement. C'est l'AUTHORING qui change, pas la donnée.

⚠️ LA DOCUMENTATION EST UN COMMENTAIRE, plus une clé `_xxx_doc` dans la donnée : un
   commentaire ne voyage pas jusqu'aux consommateurs, une clé si.

⛔ LE CORPS SE DÉLIMITE PAR LA PARENTHÈSE. Décision Romain, 2026-08-19 : « je m'oppose
   formellement à toute forme de parsing en fonction de l'indentation ». Un fichier reformaté
   ne change pas de sens. Une LISTE s'y écrit par une parenthèse elle aussi — `scope(symbol,
   group, rule, flow)` — et la parenthèse préserve l'ordre de ce qu'on y écrit.
PARTAGE
POURQUOI LES TROIS MODES D UN MEME PARAMETRE NE VIVENT PAS DANS LE MEME FICHIER. Une
librairie declare UN destinataire par DEFAUT, et une entree peut le SURCHARGER depuis le
2026-08-13. Le partage suit l ARBITRAGE DE ROMAIN, sans exception ni axe a part : tout mode
DISCRET va a son RESOLVEUR -- il se calcule note a note, a la derivation -- et tout mode
CONTINU va a un RUNTIME, car il exige des messages intermediaires PENDANT la note, a une
cadence, donc chez celui qui SONNE. ⚠️ CE CHAMP A PORTE UNE PHRASE FAUSSE jusqu au 2026-08-13
: il ecrivait que le continu de transposition revenait a Kairos. Kairos n est PAS un runtime,
et l arbitrage ne souffre aucune exception. Trouve par runtime-MIDI, qui a refuse de trancher
entre deux textes qui ne pouvaient pas rester cote a cote. ⛔ ET LA LEÇON PORTE AU-DELA DE
CETTE PHRASE : une prose de librairie qui NOMME un destinataire est une SECONDE AUTORITE a
cote du champ resolvedBy. Le champ fait foi ; cette prose dit le PRINCIPE du partage, jamais
l affectation d un mot.
FAMILLE
NEUF PARAMÈTRES, TROIS MODES CHACUN — vélocité, modulation, pitchbend, pression, volume,
articulation, panoramique, carte de touches, transposition. Les vingt-sept mots existent au
moteur natif ; les dix-huit discrets sont ici, les neuf continus dans la librairie de leur
paramètre. Le mot se lit d'un seul tenant, le paramètre puis son mode — la forme du moteur,
arrêtée par Romain le 2026-08-12.
DEFAUT
LE FIXE EST LE DÉFAUT, mesuré sur le code du moteur et non sur son aide, qui se contredit :
un paramètre non déclaré tient sa valeur écrite. Le mot fixe ne se contente donc pas
d'arrêter une variation en cours, il REMET dans cet état — sans lui, un glissement court
jusqu'à la prochaine valeur écrite.
MESURE
CE QUE LE MOTEUR NATIF REND, mesuré sur le binaire v3.5.1-iso.2, six notes de 20 à 120 : en
fixe 20 20 20 20 20 120, en paliers 20 40 60 80 100 120. Sur la VÉLOCITÉ et la TRANSPOSITION,
le mode continu rend des octets IDENTIQUES aux paliers — le mot pose son étiquette et le
moteur porte la mention 'not implemented' (FillPhaseDiagram.c:415, :608). Sur le volume et le
panoramique, continu et paliers diffèrent bel et bien. L'articulation n'est pas tranchée :
aucun témoin construit ne l'a fait bouger, fixe compris.
SCOPE
Les dix-huit mots portent la même portée que les modes déjà déclarés dans les autres
librairies : ils s'écrivent partout où un réglage de jeu s'écrit — sur un symbole, sur un
groupe, sur une règle, et dans le flux.

## velfixed

_comment : Modes discrets — un mot par (paramètre, mode), sans argument. Le mot natif est
porté verbatim par `bp3`.

