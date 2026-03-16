# BPscript — Vision produit

## La thèse

En 1999, deux étudiants berlinois ont compris que le computer n'était pas
un magnétophone — c'était un instrument. Ils ont créé Ableton et libéré
la musique du temps linéaire.

Aujourd'hui, le live coding émerge avec la même énergie que la scène techno
berlinoise des années 90. Les outils existent (SuperCollider, TidalCycles,
Sonic Pi) mais chacun est isolé dans son langage, son paradigme, ses limites.
Aucun ne sait orchestrer les autres. Aucun ne manipule des structures
temporelles formelles. Aucun ne fait ce que BP3 fait depuis 30 ans dans
le monde académique : dériver des structures complexes à partir de grammaires.

BPscript transforme BP3 — un moteur de polymétries complexes, d'abord utilisé pour
formaliser la rythmique des percussions du nord de l'Inde, mais dont le formalisme
est général — en **séquenceur d'un genre totalement nouveau** : un méta-ordonnanceur
polyglotte qui orchestre SC, Tidal, Python, MIDI, DMX et tout ce qui se
séquence dans le temps, depuis un seul fichier, en live.

## Le sampler complexe

Ableton a inventé le sampler multilinéaire : on découpe le temps en clips,
on les lance, on les combine. C'est puissant mais la structure reste plate —
des boîtes qu'on empile.

BPscript invente le **sampler de structures complexes** :

| Paradigme | Ce qu'on sample | Limitation |
|-----------|----------------|-----------|
| Bande magnétique | du son, linéairement | on presse Play, on attend la fin |
| Ableton | des clips, multilinéairement | on lance, on combine, mais la structure est plate |
| **BPscript** | **des grammaires, de la complexité** | **la structure se dérive, se conditionne, se ramifie** |

Un raga n'est pas une mélodie — c'est un ensemble de règles de dérivation
qui génère des mélodies. Un pattern de tabla n'est pas une boucle — c'est
une grammaire qui produit des variations infinies. Une scène multimédia
n'est pas un timeline — c'est un réseau de comportements orchestrés.

BPscript ne sample pas du son. Il sample de la **structure**.

## Le live coding comme la Session View

Ableton a dit : "la musique n'a pas besoin d'être linéaire."

BPscript dit : "la musique n'a pas besoin d'être programmée à l'avance —
elle se dérive en temps réel selon des règles que tu modifies en live."

Le live coding est au BPscript ce que la Session View est à Ableton :
le moment où le musicien reprend le contrôle sur la machine. Sauf qu'ici,
on ne lance pas des clips — on modifie des grammaires, on bascule des flags,
on ajuste des poids, on réécrit des règles. La structure évolue pendant
qu'elle joue.

Ableton a rendu le computer légitime sur scène quand tout le monde pensait
que c'était de la folie. BPscript rend les grammaires formelles légitimes
en live coding quand tout le monde pense que c'est académique.

## Le méta-ordonnanceur polyglotte

Un seul fichier `.bp`. Trois langages. Un seul ordonnanceur. Live-codable.

```
@supercollider
@tidal
@python
@raga:supercollider
@lights:python

`sc: SynthDef(\grain, { |freq, dens| GrainSin.ar(dens, freq) }).add`
`tidal: let pat = s "bd sd hh sd"`
`py: import dmx; d = dmx.open()`

when phase==1 S -> { intro, rythme }
when phase==2 S -> { melodie, rythme, lumieres }

melodie -> Sa _ Re `sc: Synth(\grain, [freq:880])` _ _ Ga Pa
rythme -> `tidal: d1 $ pat # speed 1` _ _ _ `tidal: d1 $ silence`
lumieres -> -!spotlight _ _ _ -!fadeout
```

BP3 sait **quand**. SC, Tidal, Python savent **quoi**.
Les backticks connectent les deux.

La synchronisation est parfaite parce que c'est BP3 qui tient l'horloge —
pas de drift entre les langages. Le compositeur écrit de la structure,
les runtimes font le son, la lumière, la vidéo.

C'est l'argument massif :
- SC seul fait du son complexe mais ordonnance mal les macro-structures
- Tidal seul fait des patterns mais pas de grammaires formelles
- Python seul fait de la logique mais ne sait pas le temps musical
- BP3 seul est un puissant ordonnanceur mais délègue la production
- **BPscript + backticks = les quatre ensemble**

## Stratégie : intégration, pas remplacement

### La leçon Rewire

Ableton n'a jamais dit "jetez Pro Tools." Ils ont intégré Rewire.
"Notre software s'ouvre dans le vôtre." Les studios ont adopté Ableton
avant les clubs — parce qu'il ne menaçait pas leur workflow existant.

BPscript fait pareil :
- **S'intégrer complètement à Ableton et Max** — pas concurrencer
- BPscript comme **device Max for Live** = le cheval de Troie parfait
- Le compositeur reste dans Ableton, ouvre BPscript, et ses clips
  deviennent des grammaires vivantes
- Les SynthDefs SC, les patterns Tidal, les scripts Python restent
  intacts — BPscript les orchestre sans les remplacer

### Les backticks = le Max for Live de BPscript

Ableton est né de Max. Puis ils ont mis Max DANS Ableton — "Inception".
Les utilisateurs construisent leurs propres instruments sans écrire de C++.

BPscript fait le même geste : les backticks ouvrent une fenêtre vers
chaque langage à l'intérieur du séquenceur. L'utilisateur ne programme
pas BPscript — il écrit du vrai SC, du vrai Python, orchestré par BP3.

## Les leçons d'Ableton — aucune oubliée

### 1. Né de la frustration
Ableton est né parce que Robert et Gerhard refusaient de jouer avec des DATs.
BPscript naît parce que BP3 est puissant mais isolé, que SC ne sait pas
ordonnancer des macro-structures, et que personne n'orchestre le tout.

### 2. Dog-fooding
Chaque feature de la Session View a été testée en concert Monolake.
Si ça plantait = poubelle. Si ça marchait = on garde.

→ **Composer avec BPscript avant de le vendre.** Créer des pièces réelles.
Les jouer en live. Identifier ce qui manque par la pratique, pas par la théorie.

### 3. Le troisième cerveau
Robert et Gerhard avaient la vision musicale. Bernd Roggendorf avait
l'expérience ingénierie pour transformer le prototype en produit.
"Il y a des gens plus bêtes que nous qui dirigent des entreprises."

→ Le projet a besoin d'un architecte logiciel qui voit au-delà de la musique.

### 4. Timing et contexte
Ableton est né en 1999, l'année où Apple sort l'iBook G3 —
juste assez puissant pour l'audio live. Le contexte rend possible.

→ Le live coding émerge maintenant. WebAssembly est mature. Les navigateurs
font du MIDI et de l'audio. Le timing est bon.

### 5. Commencer petit, viser grand
Premier stand à la NAMM : minuscule, caché derrière Sony et Yamaha.
Des images Photoshop pour combler les fonctionnalités manquantes.
Mais Hans Zimmer s'arrête, teste, valide.

→ Commencer par la niche : académique, percussions, live-coders SC/Tidal.
Trouver le Hans Zimmer du live coding — celui dont la validation fait basculer.

### 6. La niche, puis l'élargissement
DJs techno berlinois → remixeurs → producers → bedroom producers → tout le monde.

→ Polymétries complexes / académique → live-coders → artistes multimédia
→ tout ce qui s'orchestre dans le temps.

### 7. Les contraintes comme force créative
Pas de fenêtres flottantes. Interface rigide, grise, berlinoise.
"Pour être créatif, on ne peut pas tout avoir — il faut choisir."

→ 4 mots réservés. 24 symboles. Pas de `for`, pas de `while`.
La contrainte maximale libère la créativité structurelle.
La complexité algorithmique reste dans les backticks.

### 8. Les bugs deviennent des features
Le warping glitché a créé le dubstep et Skrillex.

→ Les "limitations" de BP3 (paliers discrets, pas de CV continu) pourraient
engendrer des esthétiques nouvelles — des structures temporelles "impossibles"
que personne n'a encore imaginées.

### 9. Ouverture aux plugins
Ableton v4 : MIDI + VST = le tournant. Tout le monde peut contribuer.

→ BPscript : les librairies JSON + les backticks multi-langage = tout le monde
peut créer son vocabulaire et ses comportements. L'écosystème se construit
par la communauté.

### 10. Du digital au physique
Push : parce que cliquer sur des cases c'est ennuyeux. Le retour du geste.

→ Les flags (`when phase==1/2/3`) se mappent sur des boutons.
Les poids (`[weight:3]`) sur des faders. Les règles sur un contrôleur.
Mais c'est pour plus tard — d'abord que le moteur marche.

### 11. Le moment Daft Punk
2007, Bercy, 18 000 personnes. Ableton pilote tout. Le computer est légitimé.

→ BPscript a besoin de son moment : **une performance live où un seul fichier
`.bp` orchestre SC + Tidal + lumières + vidéo** en temps réel.
C'est la démo qui fait tout basculer.

### 12. Protéger la mission
Steward Ownership : actions invendables, dividendes impossibles.
"Le seul but de l'entreprise reste la musique."

→ BPscript naît dans le monde académique/open source. La filiation avec
Bernard Bel et BP3 est un atout. La mission est la structure temporelle
et la création, pas la monétisation. Protéger cette mission dès le début.

## Ce qu'Ableton n'a PAS fait — et que BPscript fait

**Séquenceur polyglotte** — Ableton intègre Max for Live mais c'est un seul
environnement. On ne peut pas écrire du SC, du Tidal et du Python dans le même
projet. BPscript le peut. C'est la vraie rupture.

**Grammaires formelles** — La Session View est non-linéaire mais c'est du
clip-launching. Pas de dérivation, pas de polymétries irrationnelles, pas de
composition conditionnelle par flags. BPscript hérite de 30 ans de recherche
de Bernard Bel. Aucun concurrent n'a cet avantage théorique.

**Composition distribuée** — Un laptop = un Ableton. BPscript peut orchestrer
un réseau de machines synchronisées par `!`/`<!`.

**Agnostique de la cible** — Ableton fait du son. BPscript orchestre du son,
de la lumière, de la vidéo, de l'eurorack, des robots, des installations —
tout ce qui a besoin d'être orchestré dans le temps.

## En une phrase

Ableton a transformé le computer en instrument.
BPscript transforme le computer en **chef d'orchestre polyglotte** —
le premier séquenceur de structures complexes, dans la continuité directe
de la vision berlinoise, mais une étape plus loin.

*Le meilleur instrument est celui qui s'efface pour ne mettre en avant
qu'une chose : l'émotion.* — Et la meilleure structure est celle qui
s'efface pour ne laisser que la musique.
