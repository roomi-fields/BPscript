# Notes — librairie `time`

Ce que `lib/time.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## types

LA LIBRAIRIE « time » — écrite dans le langage qu'elle sert.
Convertie depuis le JSON : le bundle en rend la MÊME donnée, champ par champ. Les
consommateurs ne voient aucun changement — c'est l'AUTHORING qui change, pas la donnée.

⚠️ UNE NOTE EST UN COMMENTAIRE, plus une clé `_xxx` dans la donnée : un commentaire ne
   voyage pas jusqu'aux consommateurs, une clé si.
TEMPO
LE MÉTRONOME PORTE UN SEUL NOM ET UN SEUL DOMICILE. Il s'écrit aux DEUX places que le moteur
natif lui donne — la tête de scène ('tempo:120') et le modificateur de sous-grammaire
('mode:ord(tempo:90)') —, d'où la section 'subgrammar' et la double portée. Le champ 'bp3'
porte le nom NATIF, '_mm' : c'est lui qui traduit, et le frontal BP3 le lit. Le groupe
d'unicité 'metronome' compte les deux graphies ensemble ; sans lui, 'tempo:120' suivi de
'mode:ord(tempo:90)' réglerait deux fois la même chose en silence, ce que le moteur natif
refuse par return(7).
SYNCDELAY
LE MOT EST AGNOSTIQUE AU TRANSPORT, et c'est ce qui décide de son domicile. Décision Romain
du 2026-08-21
(`trois-reglages-natifs-trouvent-leur-domicile-et-kronos-ne-connait-pas-le-transport`) : le
décalage vaut pour MIDI comme pour OSC, donc le mot ne nomme aucun transport et ne porte pas
de 'transportGroup'. Il vit ici parce que SEUL KRONOS lève un point d'attente, et 'time' est
la seule librairie qu'il résout. Sa fonction est mesurée dans le moteur d'origine —
ConsoleMain.c:1727, dans StopWaiting() : à la reprise après un point d'attente, l'horloge est
rattrapée pour restaurer le calage des événements suivants. Défaut natif 380 ms
(ConsoleMain.c:116). AUCUNE PLAGE N'EST DÉCLARÉE : elle n'a pas été mesurée, et une plage
supposée refuserait des valeurs justes ou en accepterait de fausses sans que rien ne le dise.

