# Notes — librairie `transpo`

Ce que `lib/transpo.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## types

LA LIBRAIRIE « transpo » — écrite dans le langage qu'elle sert.
Convertie depuis le JSON : le bundle en rend la MÊME donnée, les consommateurs ne
voient aucun changement. C'est l'AUTHORING qui change, pas la donnée.

⚠️ LA DOCUMENTATION EST UN COMMENTAIRE, plus une clé `_xxx_doc` dans la donnée : un
   commentaire ne voyage pas jusqu'aux consommateurs, une clé si.

⛔ LE CORPS SE DÉLIMITE PAR LA PARENTHÈSE. Décision Romain, 2026-08-19 : « je m'oppose
   formellement à toute forme de parsing en fonction de l'indentation ». Une LISTE s'y écrit
   par une parenthèse elle aussi — `scope(symbol, group, rule, flow)` — et la parenthèse
   préserve l'ordre de ce qu'on y écrit.
SCISSION
Née le 2026-08-10 de la scission de controls.json (groupe 'dispatcher'). LIBRAIRIES.md:170
nomme pour ce contenu : transpose · chromashift · scaleshift · keyxpand · diapason. ÉCART
SIGNALÉ (pas résolu ici, cf. rapport) : `diapason` vit dans core.json
(defaults.values.diapason + reservedDirectives, directive diapason:N de tête de scène) et
n'a jamais été un contrôle de sac — le déplacer casserait sa graphie sans que la référence
tranche la nouvelle. `scale` (microtonal, dispatcher d'origine) reste ICI : Atlas ne
l'énumère pas dans transpo, mais aucune autre ligne ne le réclame et son destinataire mesuré
(Kairos, résolution de gamme) est identique aux quatre autres.
SCOPE
OU CE CONTROLE A LE DROIT D ETRE ECRIT — une LISTE, jamais une valeur seule. Vocabulaire
FERME de six mots, arrete par Romain le 2026-08-08 : scene, subgrammar, rule, group, symbol,
flow. L accrochage dans l arbre DIT deja la portee ; cette declaration ne sert donc pas a
localiser un reglage mais a REFUSER celui qui est mal place — sans elle on lit n importe quoi
n importe ou sans pouvoir le dire (c est ce qui a rendu un poids muet pendant quatre jours).
symbol couvre TOUT element du flux, pas seulement une note : un silence, une prolongation, un
joker et les deux membres d un gabarit portent aussi un sac (mesure : 10 porteurs dans l
arbre). flow = le sac pose avec ! ; ce n est pas une portee au sens de LANGUAGE.md (c est un
etat courant, par voix) mais la validation doit pouvoir dire qu un poids n a rien a y faire.
L ABSENCE DE CE CHAMP EST UNE FAUTE, gardee : 57 des 65 controles n en portaient aucun, et
une absence qui voudrait dire partout rendrait toute validation impossible. ⚠️ IL N Y A QU UN
SEUL AXE. Un axe portee d EFFET distinct de la portee d ECRITURE etait prevu ; il reposait
entierement sur mode — ecrit sur une regle, gouvernant le bloc. Mesure du 2026-08-08 : cette
forme n existe ni au moteur d origine, ni dans une seule des 274 scenes, et l arbre ne l
appliquait nulle part. Romain l a supprimee. L axe tombe avec elle.

## transpose

_comment : Resolved by the dispatcher before reaching any transport — musical transformations

## scaleshift

⛔ SANS UNITE, ET C EST TRANCHE. Le champ d'unite reste VIDE, et c'est un ETAT : un degre d'alphabet est un RANG, pas une grandeur (decision de Romain, 2026-08-22 — « le degre et la touche n'entrent pas au vocabulaire des unites »). C'est le nom de l'argument qui porte l'information.

## chromashift

⛔ SANS UNITE, ET C EST TRANCHE. Le champ d'unite reste VIDE, et c'est un ETAT : un degre d'alphabet est un RANG, pas une grandeur (decision de Romain, 2026-08-22 — « le degre et la touche n'entrent pas au vocabulaire des unites »). C'est le nom de l'argument qui porte l'information.

## keyxpand

keyxpand · Le pivot et le facteur sont les deux PARTIES d'une seule valeur, separees par une
ESPACE — decision Romain 2026-07-26 : la virgule separe les ELEMENTS d'un sac, l'espace separe
les PARTIES d'une valeur. C'est ce qu'un auteur ecrit deja, et ce que la documentation des
fonctions digitales prescrit (DIGITAL_FUNCTIONS.md:147).

