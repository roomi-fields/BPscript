# BPScript — Backlog

Dernière mise à jour : 2026-04-06
Build : v3.3.19-wasm.8
S4 vs S5 : 16/29 EXACT, 13 DIFF, 7 SKIP, 2 MISSING

## Données — cohérence chaîne pitch (alphabet → fréquence)

- **BPS-1** `ouvert` — Tri des `bp3_*` dans temperaments.json (différé, 2026-06-17). `lib/temperaments.json` traîne ~150 entrées legacy `bp3_*` qui MÉLANGENT de vrais tempéraments (`bp3_werckmeister_3`, `bp3_meantone_*`, `bp3_kirnberger_*`…) avec des GAMMES déguisées en tempéraments (`bp3_Cmaj`, `bp3_todi1`, `bp3_asavari1`, `bp3_*_murcchana`…). À TRIER : les vrais tempéraments restent ; les « gammes » partent dans `scales.json`. Même nature de ménage que la consolidation maqams. Reporté (décision Romain) — à faire après la migration jins/maqams.

## Moteur BP3 — Investigation

- **32** `bloqué` — `#32` WriteMIDIbyte drift CC interpolés (NotReich). Root cause trouvée : CC volume interpolés dépassent le timestamp du NoteOn suivant, `OldMIDIfileTime` recule, delta perdu s'accumule. Deux fixes proposés (MIDIfiles.c ou MakeSound.c). **Status :** En attente décision Bernard (Fix A vs Fix B).
- **36** `fait` — `#36` Production TEXT sans séparateurs — RÉSOLU. Non reproductible sur wasm.8. `getResult()` retourne les terminaux séparés avec et sans alphabet.

### Résolus

- **33** `fait` — `#33` NoteOff retardé → dedup keep-longest WASM (wasm.2)
- **35** `fait` — `#35` Offset +10ms → Kpress offset WASM (wasm.3)
- **38** `fait` — `#38` T47 → Bernard implémenté v3.3.19, WASM adapté (wasm.4)
- **39** `fait` — `#39` ASLR p_DefaultChannel → GetRelease.c 3 points (wasm.5)
- **42** `fait` — `#42` Plot(ANYWHERE) écrase sentinelles -1 → FillPhaseDiagram.c (wasm.8)
- **43** `fait` — `#43` CT catchall `_script(CT N)` → ScriptUtils.c + console_strings.json (wasm.8)

## Transpileur S5

- **BPS-2** `ouvert` — COUNT diffs S4 vs S5 (11 grammaires). Cause à investiguer. Le pipeline S5 passe par le dispatcher (resolveTokens) qui applique transpose/rotate/etc. Les seuls contrôles qui causent un diff attendu sont ceux avec traitement audio webaudio (wave, filter, etc.) — non testables au niveau tokens.

Bugs restants. Détail dans `memory/backlog_s5_transpiler.md`.

- **BPS-3** `ouvert` — `_goto` : position dans la grammaire incorrect
- **BPS-4** `ouvert` — `mode` : gram#1 toujours LIN, devrait respecter @mode
- **BPS-5** `ouvert` — Terminaux numériques purs (ex: `1`, `2`) confondus avec des vitesses
- **BPS-6** `ouvert` — Settings non fidèlement portés depuis les -se. de Bernard

## Dispatcher / Runtime

- **BPS-7** `ouvert` — Resolver musical complet. Mapping note → fréquence en dur (Western 12-TET, A=440). Degrés : sargam → fréquences ; Tempérament : pythagoricien, meantone, just intonation ; Référence configurable : `@tuning:442` ; Microtonalité : échelles à N divisions.
- **BPS-8** `ouvert` — Routage CV multi-cibles. CV crée un bus audio global. Besoin de routage par cible : `env1(Phrase1, browser)`.
- **BPS-dhati-T0** `abandonné` — dhati operateurs T0 (coord BPx) : dhati.bps declare +/;/* en @gate X:midi (sonnants) au lieu d operateurs T0 BP3 — investiguer fixture vs besoin reel de mapping operateur->T0. Spec precise a venir de BPx. Escalader a Romain si vrai gap langage  _(abandonné: ferme : dhati-A est un fix LOCAL BPx (compileRhsElement traite +;* comme terminal sonnant au lieu de T0), PAS un manque langage (le transpileur mappe deja +;*). Aucun item BPScript)_
- **BPS-enc-tempo** `ouvert` — Fidelite encodeur : serialiser le [/N] COLLE (suffixe-element) pour qu il RE-PARSE en _tempo (round-trip fidele), PAS en prefixe nu /N {…} (rate). Oracle natif = verite ; distinction ESPACE=rate niveau-regle / COLLE=_tempo suffixe-element. NON bloquant (parse coherent end-to-end via m4_07)
- **BPS-defaut-env** `fait` — Point 1 (archi) : integrer les defauts d ENVIRONNEMENT dans l AST a la creation — transpiler(source, environnement) ; l environnement est porté par Kanopi, fourni en entree de transpilation ; le tempo par defaut (et octave/division…) entre dans l AST quand la scene ne declare rien. Kanopi ne touche JAMAIS l AST. Cf hub/projets/spec-ecriture-structure.md  _(fait: M5 : compileToBPxAST(source, environnement), defaut tempo dans l AST, preuve non-circulaire 13/13, ISO BP3 preservee — ac9a474)_
- **BPS-propagation** `fait` — Propagation DURABLE du param environnement (ac9a474) a l artefact CONSOMME par Kanopi (node_modules/bpscript via file:) : src OK mais le dist/copie consommee l ignore -> Kanopi a du rsync a la main, sur install frais M5 devient INERT SILENCIEUX. A faire : rebuild/republier proprement le file: dep + un TEST qui prouve l injection env->AST A TRAVERS le paquet consomme. Coord Kanopi  _(fait: package.json version+main (aff985d) + test-garde Kanopi (51e8cd7) ; statu quo copies retenu, symlink durable differe post-migration)_
- **BPS-9** `ouvert` — E1 dérive doc-dans-code : index.js:7 décrit 'compileToBPxAST → {ast,backticks,flagStates,libraries}' ; réel = {ast,errors,warnings} (bpxAst.js:180). Le code tranche
- **BPS-10** `fait` — E5 garde structurel non branché au gate (pas de script arch ; Node 20+ requis via nvm, défaut dépôt = 18)  _(fait: garde déplacé à la racine + script arch (8ff36f8))_
- **LIB-RAGA** `ouvert` [P3] — Alphabet 'raga' absent d'alphabets.json → repli western (alias raga→sargam manquant). Lacune lib distincte de SARG-1
- **MOH-ALIGN** `fait` [P3] — Aligner la fixture canonique BPscript/scenes/mohanam.bps sur la notation saptak (la copie biblio Kanopi est passée en saptak ; l'originale reste en numérique sa6/sa7)  _(fait: mohanam.bps aligné saptak (6874eda, S1 42/0))_
- **TAAR-TOK** `fait` [P1] — Tokeniseur vs convention saptak : 'taar sa' (préfixe d'octave séparé par ESPACE) est découpé en 2 terminaux, 'taar' perdu → registre aigu jamais résolu. Proposer le fix canonique (tokenisation consciente du préfixe d'octave VS séparateur collé pour saptak). Décision langage Romain.  _(en-cours: Romain valide '_' : bpscript change octaves.json separator ' '→'_' pour saptak (+ 4 autres préfixe pour cohérence). taar_sa = 1 token → taar 480 Hz. Puis Kanopi met mohanam à jour (taar sa→taar_sa).)_  _(en-cours: FAIT côté langage (189128b) : separator '_' pour saptak+4 préfixes, prouvé taar_sa→480/mandra_sa→120/madhya défaut, S1 42 OK 0 FAIL, bundle frais, LANGUAGE.md MAJ. Reste : Kanopi met mohanam à jour (taar sa→taar_sa) + vérifie taar audible.)_  _(fait: COMPLET : langage (bpscript 189128b, separator '_') + scène (Kanopi 9a99584, mohanam taar sa→taar_sa) + VÉRIFIÉ écran : gamme sargam complète 240/303.8/360/405 + TAAR à 480 Hz (=2×240, octave au-dessus, registre confortable, sans stridence). Oracle 0 échec.)_
- **E-017** `ouvert` — E-017 : scene bells derive 18 tokens != 16 vs natif (status.json s2_vs_s3=DIFF) — realignement scene, signale par bp3-frontend au solde F4-CTX remote
- **BPS-DEMO-TRANSPORTMIDI** `ouvert` [P5] — Démo public/demos/midi-actors.bps emploie la forme périmée 'transport:midi' (canon obsolète, devrait être '.midi') — repéré par Atlas sur le fil-rouge d'onboarding. Non bloquant, cosmétique doc/démo
- **BPS-TUNING-CATALOGUE** `ouvert` [P2] — USER-FACING : démos tuning-just.bps (@tuning:Cmaj) et tuning-raga.bps (@alphabet.raga) référencent des accordages qui vivent dans lib/tuning.json, HORS des 5 catalogues PITCH_LIB servis → jouaient un reniflage western tempéré en silence (l'inverse de leur titre). Kairos échoue désormais bruyamment. Investiguer : que contient scales.Cmaj (vraie intonation juste ?) ; DÉCIDER périmètre catalogue = servir tuning.json OU corriger les démos. L'oracle e2e REF_TUNING_JUST avait figé les mauvais Hz (tempérés) = à refaire une fois le bon accordage servi
