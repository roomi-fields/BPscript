# Transposition dans BPscript — Étude musicologique

## Résumé

La transposition chromatique (`transpose:N` en demi-tons) ne fonctionne correctement que dans les tempéraments égaux. Dans tous les autres systèmes (just intonation, shruti, maqam, gamelan), elle déforme les intervalles. Il faut 3 opérations distinctes, pas une seule.

## Le problème mathématique

En 12-TET, chaque demi-ton = 2^(1/12). Décaler de N steps préserve tous les intervalles car la grille est uniforme. Dans tout autre tempérament, les steps sont inégaux → le décalage change les intervalles.

**Exemple** : gamme de Do majeur en intonation juste (C=1, D=9/8, E=5/4, F=4/3, G=3/2, A=5/3, B=15/8). "Transposer" en Ré majeur en décalant chaque ratio de 9/8 → la tierce majeure Ré-Fa# devient 81:64 (408¢, pythagoricien) au lieu de 5:4 (386¢, juste). Le comma syntonique (81/80 ≈ 21.5¢) apparaît.

## 4 opérations distinctes

| Opération | Préserve | Fonctionne dans | Usage |
|-----------|----------|-----------------|-------|
| **Tonic shift** — changer la fréquence de référence | Tous les intervalles (ratios invariants) | Tout | Changer Sa en raga, qarar en maqam, tonique en western |
| **Degree shift** — décaler de N degrés dans la gamme | Le contour mélodique | Tout (intervalles changent) | "Joue cette phrase en partant du 5ème degré" |
| **Grid shift** — décaler de N steps dans le tempérament | Les intervalles exacts | Tempéraments égaux uniquement | Transposition chromatique classique |
| **Freq ratio** — multiplier toutes les fréquences par R | Tous les intervalles | Synthèse/CV uniquement | Pitch shift continu, notes quittent la grille |

## Ce que font les traditions

### Inde (22 shruti)
Changer Sa = tonic shift. Le raga est défini par des ratios depuis Sa → tout se re-dérive. Pas de "transposition" au sens western. Chaque raga est une entité unique définie par ses intervalles relatifs à Sa, ses phrases caractéristiques (pakad) et son esthétique (rasa). Changer Sa change la hauteur absolue, pas le raga.

Les shrutis ne forment pas une grille uniforme → grid shift impossible. Sur l'harmonium (12-TET), la subtilité des shrutis est perdue — c'est un problème connu et critiqué par les puristes.

### Arabe (maqam)
Changer le qarar (fondamentale). Les "quarts de ton" ne sont pas exactement 50¢ — ils varient par tradition régionale (Égypte ≈ 150¢, Syrie ≈ 170¢, Turquie = comma holdrien). Le système turc à 53 commas (53-TET) permet une transposition exacte et approche très bien l'intonation juste.

La modulation entre maqamat est l'art de recombiner des ajnas (tétracordes) sur différentes toniques — pas une transposition mais un changement de cadre modal.

### Gamelan
Pas de transposition au sens occidental. Chaque set de gamelan a son propre accordage unique. L'"octave" est étirée (1210-1230¢). On change de pathet (cadre modal), pas de tonalité. La structure (contour mélodique, rythme) transfère entre gamelans, pas le son exact.

### Baroque (pré-tempérament égal)
Transposition limitée aux "bonnes tonalités" du tempérament. En meantone ¼ comma : 0-3 dièses/bémols OK, au-delà la quinte du loup apparaît. Les tempéraments bien-tempérés (Werckmeister, Kirnberger) rendent toutes les tonalités jouables mais chacune a une couleur distincte — c'est le propos du Clavier bien tempéré de Bach.

### Bohlen-Pierce
Transposition exacte car c'est un tempérament égal (13 notes par tritave 3:1). Mais transposer entre BP et un système à octave est impossible — les cadres d'intervalles sont incompatibles.

## Recommandation pour BPscript

### Court terme (non prioritaire)
Le `(transpose:N)` actuel n'est pas implémenté côté audio. Laisser en backlog.

### Moyen terme — 3 opérations
1. **`(tonic:freq)` ou `(tonic:ratio)`** — changer la référence du resolver. Universel. Correspond au changement de Sa/qarar/tonique.
2. **`(degree:N)`** — transposition diatonique. Universel mais change les intervalles.
3. **`(transpose:N)`** — grid shift en steps du tempérament. Émettre un warning si le tempérament n'est pas égal.

### L'insight clé
Le **tonic shift + table de ratios invariante** est l'opération universelle. C'est ce que font toutes les traditions : définir les intervalles par rapport à une référence mobile. Le "problème" de la transposition dans les tempéraments non-égaux est un problème d'**instruments à hauteur fixe**, pas de théorie musicale. Les voix, les cordes et la synthèse électronique peuvent tous transposer par tonic shift sans perte.

## Sources
- Barbour, J.M. "Tuning and Temperament: A Historical Survey" (1951)
- Touma, H.H. "The Music of the Arabs" (1996)
- Jairazbhoy, N.A. "The Rāgs of North Indian Music" (1971)
- Milne, Sethares, Plamondon. "Tuning Continua and Keyboard Layouts" (2007) — Dynamic Tonality
- Erlich, Paul. "A Middle Path" (2006) — regular temperament theory
