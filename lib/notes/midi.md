# Notes — librairie `midi`

Ce que `lib/midi.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## types

LA LIBRAIRIE « midi » — écrite dans le langage qu'elle sert.
Convertie depuis le JSON : le bundle en rend la MÊME donnée, les consommateurs ne
voient aucun changement. C'est l'AUTHORING qui change, pas la donnée.

⚠️ LA DOCUMENTATION EST UN COMMENTAIRE, plus une clé `_xxx_doc` dans la donnée : un
   commentaire ne voyage pas jusqu'aux consommateurs, une clé si.
SCISSION
Née le 2026-08-10 de la scission de controls.json (Romain : « controls.json doit être divisé
», une librairie = un destinataire, LIBRAIRIES.md:213). Porte le groupe 'midi' ORIGINEL,
verbatim.
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

## ch

═══ LES CLES D ADRESSE ═══
OU VA L EVENEMENT, ou D OU VIENT celui qu un point d attente ecoute. Elles vivaient dans
lib/core.json schema.addressKeys ; Romain les a envoyees ici le 2026-08-15 -- « dans midi ».
Le socle n a plus a nommer une adresse : le destinataire se lit sur le resolvedBy de ce
fichier, comme pour tout le reste, au lieu d une legende tenue a part dans le schema.

LE PARSEUR LES RANGE DANS UN TIROIR DEDIE, `payload.address`, distinct des controles : `E4(ch:5)`
surcharge le canal d une occurrence, il ne joue pas plus fort. Ce tri se lit sur cette liste et
sur rien d autre.

LA PORTEE EST SUR CHAQUE CLE, plus dans une liste unique du schema. L ancienne forme
(`channelParamsScope`) donnait la MEME portee aux cinq et n avait nulle part ou en dire une
autre ; le jour ou une cle en demande une differente, elle l ecrit ici. Les quatre places
retenues sont celles d un sac dans une regle : symbol, group, rule, flow. La declaration d
ADRESSE D ACTEUR (`out.midi(ch:1)`) n est pas une de ces places -- elle est ailleurs dans la
scene, et ce champ ne la gouverne pas.

⚠️ `port` ET `device` NE SONT PAS PROPRES AU MIDI, et le fait est signale : une sortie OSC
s adresse aussi par un port. Ils suivent la decision telle qu elle est rendue ; leur domicile
definitif appartient a Romain le jour ou un second canal declarera les siens.

## chan

_comment : MIDI-specific controls — only meaningful for MIDI transport

## ins

ins · LA CONVENTION EST CELLE DU NATIF : ON NUMEROTE DEPUIS 1. Arbitrage de Romain, 2026-08-15,
et mesure refaite sur les SOURCES du moteur avant d ecrire :
    Inits.c:128        ProgNrFrom = 1   (« This has changed with version 2.7.3 »)
    SaveLoads1.c:588   ProgNrFrom = 1
    ScriptUtils.c:1006 e.data2 = <valeur ecrite> - ProgNrFrom      -> l octet du fil vaut x-1
    DisplayArg.c:1853  affiche  <octet> + ProgNrFrom               -> le retour est symetrique
Aucune ligne vivante du moteur ne donne une autre valeur a ProgNrFrom. L auteur ecrit donc
1..128, et le fil porte 0..127.

⚠️ CE QUI ETAIT ECRIT ICI VENAIT DE L AIDE DU MOTEUR, ET L AIDE N EST PAS LE JUGE. La declaration
valait 0..127 depuis le 2026-08-08 sur la foi de BP3_help.txt, « _ins(x), Range of x is 0..127 ».
C est la meme lecon que celle deja payee sur _mapfixed/_mapstep/_mapcont, absents de l aide et
bien presents dans la source : la TABLE et le CODE font foi, la documentation non.

⚠️ ET LA PIECE CITEE DANS LA CONSIGNE POINTE DU CODE MORT — signale, pas suivi. MIDIfiles.c:1147
garde bien `w > 0 && w <= 128` et emet `w - 1`, mais son tableau `CurrentMIDIprogram` n est
AFFECTE nulle part dans les sources vivantes : il est mis a zero dans Inits.c:131 et lu la, point.
La conclusion tient par les quatre pieces ci-dessus, pas par celle-la.

## pressure

pressure · LE MOT DU LANGAGE POUR LA PRESSION DE CANAL, et le geste natif `_press` le sert.
L'alias `press` est SORTI le 2026-09-02 (décision 3606 de l'architecte) : deux mots pour un
geste, et le natif était porté par l'alias. Une scène qui écrit `press:` est refusée.

## volume

VOLUME · LA REALISATION MIDI DE L INTERFACE GENERIQUE. `expression.volume` est le mot que
l auteur ecrit ; celui-ci est ce que le runtime MIDI en fait. Doctrine de Romain, 2026-08-15 :
« MIDI a toutes ses primitives, et expression est un sur-ensemble d appel generique qui va
appeler les primitives d expression du runtime sous-jacent quel qu il soit. »
  !(volume:90)        l interface -- le runtime actif la realise
  !(midi.volume:90)   cette declaration-ci, visee directement
PORTEE ETENDUE A LA SCENE le 2026-08-15 (Romain, « ok pour les extensions de portee ») :
DeftVolume est un defaut de scene au moteur natif, il s ecrit donc aussi en tete.

## mute

_bagOnly_doc : bagOnly:true = ce controle n'a PAS de forme NUE dans le flux, il ne s'ecrit
que dans son sac. A ne pas confondre avec 'sans argument' : les controles continus herites de
BP3 (volumecont, pitchcont, mapcont...) sont sans argument ET s'ecrivent nus au fil de la
sequence, 10 scenes du corpus le font. mute/unmute/panic, declares le 2026-07-26, n'ont
jamais eu que la forme du sac -- leurs descriptions ci-dessous l'ecrivent depuis le premier
jour. Faute de le DIRE a la donnee, tout mot sans argument devenait un mot du flux : une
scene qui portait deja ce nom (patchbay-demo, macro mute) etait tronquee EN SILENCE, mesure
par Kairos le 2026-07-27. Marquage POSITIF, porte par la donnee ; le code ne nomme aucun
controle.

## volumerate

VOLUMERATE · LA CADENCE DU CONTINU DE VOLUME. Elle se declare parametre par parametre, et vaut
CINQUANTE valeurs par seconde sans ecriture -- comme le moteur natif. Decision de Romain du
2026-08-13 : le continu voyage en SUITE DE VALEURS produite en amont a cadence fixe, et le
runtime la convertit vers la sienne -- il decime ou il lisse, il ne decide d aucune courbe.
PLAGE 0..1000, BORNES INCLUSES — mesuree par bp3-engine le 2026-08-14 sur le binaire natif
v3.5.1-iso.2 (CompileProcs.c:1149-1173, la MEME condition pour les cinq). C est un REFUS, pas un
ecretage : 1001 arrete la compilation en nommant sa cause. L unite est bien des emissions par
seconde — l ecart mesure vaut 1000/cadence millisecondes sur toute la plage, et les cinq sorties
se comportent identiquement. Le defaut de 50 est confirme par un temoin : avec ou sans le mot,
152 messages et 20 ms d ecart, exactement.
⚠️ LA VALEUR 0 EST ACCEPTEE PAR LE NATIF ET SUPPRIME LE FLUX CONTINU : un mode continu ecrit avec
   une cadence de 0 compile et ne module rien. Le fait est mesure, la declaration appartient a
   Romain — je porte le natif, je ne retranche pas de mon propre chef.

## modrate

MODRATE · LA CADENCE DU CONTINU DE MODULATION. Elle se declare parametre par parametre, et vaut
CINQUANTE valeurs par seconde sans ecriture -- comme le moteur natif. Decision de Romain du
2026-08-13 : le continu voyage en SUITE DE VALEURS produite en amont a cadence fixe, et le
runtime la convertit vers la sienne -- il decime ou il lisse, il ne decide d aucune courbe.
PLAGE 0..1000, BORNES INCLUSES — mesuree par bp3-engine le 2026-08-14 sur le binaire natif
v3.5.1-iso.2 (CompileProcs.c:1149-1173, la MEME condition pour les cinq). C est un REFUS, pas un
ecretage : 1001 arrete la compilation en nommant sa cause. L unite est bien des emissions par
seconde — l ecart mesure vaut 1000/cadence millisecondes sur toute la plage, et les cinq sorties
se comportent identiquement. Le defaut de 50 est confirme par un temoin : avec ou sans le mot,
152 messages et 20 ms d ecart, exactement.
⚠️ LA VALEUR 0 EST ACCEPTEE PAR LE NATIF ET SUPPRIME LE FLUX CONTINU : un mode continu ecrit avec
   une cadence de 0 compile et ne module rien. Le fait est mesure, la declaration appartient a
   Romain — je porte le natif, je ne retranche pas de mon propre chef.

## pitchrate

PITCHRATE · LA CADENCE DU CONTINU DE HAUTEUR. Elle se declare parametre par parametre, et vaut
CINQUANTE valeurs par seconde sans ecriture -- comme le moteur natif. Decision de Romain du
2026-08-13 : le continu voyage en SUITE DE VALEURS produite en amont a cadence fixe, et le
runtime la convertit vers la sienne -- il decime ou il lisse, il ne decide d aucune courbe.
PLAGE 0..1000, BORNES INCLUSES — mesuree par bp3-engine le 2026-08-14 sur le binaire natif
v3.5.1-iso.2 (CompileProcs.c:1149-1173, la MEME condition pour les cinq). C est un REFUS, pas un
ecretage : 1001 arrete la compilation en nommant sa cause. L unite est bien des emissions par
seconde — l ecart mesure vaut 1000/cadence millisecondes sur toute la plage, et les cinq sorties
se comportent identiquement. Le defaut de 50 est confirme par un temoin : avec ou sans le mot,
152 messages et 20 ms d ecart, exactement.
⚠️ LA VALEUR 0 EST ACCEPTEE PAR LE NATIF ET SUPPRIME LE FLUX CONTINU : un mode continu ecrit avec
   une cadence de 0 compile et ne module rien. Le fait est mesure, la declaration appartient a
   Romain — je porte le natif, je ne retranche pas de mon propre chef.

## pressrate

PRESSRATE · LA CADENCE DU CONTINU DE PRESSION. Elle se declare parametre par parametre, et vaut
CINQUANTE valeurs par seconde sans ecriture -- comme le moteur natif. Decision de Romain du
2026-08-13 : le continu voyage en SUITE DE VALEURS produite en amont a cadence fixe, et le
runtime la convertit vers la sienne -- il decime ou il lisse, il ne decide d aucune courbe.
PLAGE 0..1000, BORNES INCLUSES — mesuree par bp3-engine le 2026-08-14 sur le binaire natif
v3.5.1-iso.2 (CompileProcs.c:1149-1173, la MEME condition pour les cinq). C est un REFUS, pas un
ecretage : 1001 arrete la compilation en nommant sa cause. L unite est bien des emissions par
seconde — l ecart mesure vaut 1000/cadence millisecondes sur toute la plage, et les cinq sorties
se comportent identiquement. Le defaut de 50 est confirme par un temoin : avec ou sans le mot,
152 messages et 20 ms d ecart, exactement.
⚠️ LA VALEUR 0 EST ACCEPTEE PAR LE NATIF ET SUPPRIME LE FLUX CONTINU : un mode continu ecrit avec
   une cadence de 0 compile et ne module rien. Le fait est mesure, la declaration appartient a
   Romain — je porte le natif, je ne retranche pas de mon propre chef.

## rate

═══ LES ONZE PRIMITIVES QUI MANQUAIENT ═══
Diagnostic de runtime-MIDI, arbitre par Romain le 2026-08-15. Elles decrivent ce que le moteur
natif sait faire et que le langage ne savait pas nommer.

LES PLAGES SONT MESUREES PAR runtime-MIDI sur les sources C, binaire empreinte 372dd047, et le
MOTEUR LES NOMME AVANT D ABANDONNER : « Volume controller is 0..127 » (CompileProcs.c:1176),
« rate range is 0..1000 samples/sec » (:1151-1171). Ce n est PAS un ecretage — la compilation
S ARRETE. Chaque borne y est ecrite deux fois, forme litterale et forme a parametre, concordantes.
⚠️ RESERVE, reportee telle quelle : `rate` est borne 0..1000 PAR LE MOT, pas par le reglage --
SamplingRate est lu sans aucun controle (SaveLoads1.c:697). Meme grandeur, la borne vient du mot.
`fadeout` ne porte pas de plage : sa seule condition mesuree est qu une valeur <= 0 eteint le
fondu, ce qui est une semantique et non une borne.

LA GRAPHIE NATIVE EST MESUREE, PAS DEDUITE. Table des mots du moteur (StringLists.h, 83 entrees) :
`_volumecontrol` et `_pancontrol` Y SONT, les neuf autres n en font pas partie -- ce sont des
PREFERENCES du moteur, pas des gestes du flux. Les neuf sont donc inscrits nommement parmi les
controles sans geste natif, et les deux le declarent.

⚠️ LEURS PLAGES ET LEURS VALEURS PAR DEFAUT NE SONT PAS ECRITES ICI, ET C EST DELIBERE. Les
constantes natives ont ete mesurees par runtime-MIDI et ne me sont pas parvenues ; les deduire
serait les inventer. Les defauts vivent de toute facon dans `midi-default` (Romain : « les
defauts sont dans la librairie midi-default »). Une declaration sans plage decrit le mot sans
mentir sur ses bornes ; une plage supposee refuserait des valeurs justes ou en accepterait de
fausses, sans que rien ne le dise.
RATE · LA CADENCE COMMUNE DES CINQ FLUX CONTINUS. Elle meut volumerate, modrate, pitchrate et
pressrate d un seul mot, la ou chacun se regle aussi separement.

## volumecontrol

VOLUMECONTROL · QUEL CONTROLEUR PORTE LE VOLUME. Le numero est une DONNEE de la scene, plus une
valeur ecrite en dur dans un runtime.

## pancontrol

PANCONTROL · QUEL CONTROLEUR PORTE LE PANORAMIQUE. Meme construction que volumecontrol.

## fadeout

FADEOUT · L EXTINCTION DE FIN.

## resetnotes

═══ LES QUATRE GESTES DE FIN ET DE RELANCE ═══
QUATRE PAIRES, HUIT MOTS, DEUX NOMS POSITIFS PAR PAIRE — jamais un nom et sa negation. Les deux
mots d une paire partagent un groupe d unicite, donc les ecrire tous les deux est refuse en les
nommant, au lieu de laisser le dernier gagner en silence. Meme construction que striated/smooth.

LE CRITERE DE ROMAIN, ET IL A CORRIGE UNE PREMISSE FAUSSE. On avait d abord donne une paire aux
seuls gestes « vrais au natif », et resetcontrols devait rester seul. runtime-MIDI a refute sur
pieces : resetnotes est FAUX au natif lui aussi. Le vrai critere est ailleurs — des que le defaut
est CONFIGURABLE en direct par l interface, une scene doit pouvoir dire le CONTRAIRE de ce qui
est configure. Omettre le mot HERITE du reglage ; ca ne le nie pas. Donc quatre paires.

LA PORTEE EST : TETE DE SCENE, ACTEUR, ET FLUX. Romain : « oui configurables aussi par acteurs,
mais il faut que ces controles soient aussi activables dans la scene en !(...) ». La cascade
ordinaire fait le reste — la scene pose, l acteur surcharge, le flux surcharge encore :
    midi.resetnotes          toute la piece coupe a l arret
    actor nappe
      midi.letring            sauf la nappe
    S -> C4 !(letring) D4     et au fil du flux

`bagOnly:true` — LEUR SEULE GRAPHIE DANS LE FLUX EST LE SAC. Sans lui, un mot sans argument
devient un mot du flux et une scene qui portait deja ce nom est tronquee EN SILENCE. Meme
marquage que mute/unmute/panic. Mesure : il ne gouverne QUE la forme nue dans une regle, la tete
de scene passe par un autre chemin — les deux cohabitent, verifie au compilateur.

LES DEFAUTS VIVENT DANS `midi_default`, avec leur cause quand elle n est pas evidente.

⛔ LES DEUX MOTS D UNE PAIRE VISENT LA MEME IMAGE NATIVE AVEC LA VALEUR INVERSE, et c est ce que
`bp3value` porte. `letring` n est pas  une autre cible  : c est `ResetNotes` a 0. Un champ qui ne
dirait que le NOM ne suffirait pas a ces huit-la — la cible ET la valeur font le geste.
Un mot A ARGUMENT n en porte pas : sa valeur native EST son argument (`fadeout:5` → EndFadeOut 5).

