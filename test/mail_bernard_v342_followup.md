---
À : Bernard
Objet : v3.4.2 — intégrée chez nous, tests sur bp3-ctests + retours
---

Bonjour Bernard,

J'ai mergé ta v3.4.2 redistribuée dans notre branche WASM, recompilé les 3 targets (Linux/Windows/WASM) et lancé deux campagnes de tests. Tout va bien chez nous, et j'ai quelques retours sur `bp3-ctests` que tu as refait.

## 1. Notre pipeline de non-régression : zéro régression

J'ai relancé nos 36 grammaires de référence. **Strictement aucune régression** par rapport à notre baseline antérieure :

| Comparaison | wasm.9 (avant) | v3.4.2-wasm.2 (après) |
|---|---|---|
| S1 (natif) vs S2 (WASM MIDI) | 26 EXACT | **26 EXACT** |
| S2 vs S3 (PlayBuffer1 vs p_Instance) | 29 EXACT | **29 EXACT** |
| S3 vs S4 (avec/sans silent.al) | 32 EXACT | **32 EXACT** |
| S4 vs S5 (transpileur BPscript) | 14 EXACT | **14 EXACT** |

Donc le merge v3.4.2 + ton `LengthOf` restauré + les 4 `GiveSpace` n'ont rien cassé chez nous. Build officiel : `v3.4.2-wasm.2` (avec en plus quelques additions WASM côté frontend interactif).

## 2. Tests sur `bp3-ctests` refait : 33/56 PASS, 0 crash

J'ai pull ton `bp3-ctests` mis à jour (https://github.com/bolprocessor/bp3-ctests) et lancé un bulk test sur les 56 grammaires en mode CLI :

| | baseline v3.3.19-wasm.9 | v3.4.2-wasm.2 |
|---|---|---|
| PASS | 31 | **33** (+2) |
| FAIL | 24 | 22 |
| TIMEOUT | 1 | 1 |
| **CRASH** | **0** | **0** ✅ |

**Le bug copy_grammar est définitivement mort** : zéro `heap-buffer-overflow` détecté par AddressSanitizer sur `dhadhatite`, `kathak`, `Ruwet`, `Visser3`. Les 2 grammaires gagnées : **`acceleration`** et **`dhadhatite`** (les exemples que tu nous avais montrés).

## 3. Les 22 FAIL restants — classification précise

J'ai inspecté chacun pour distinguer ce qui vient de chez toi (manquant à distribuer) vs ce qui est attendu (feature GUI-only) vs vrais bugs.

### A. Fichiers référencés mais absents dans `bp3-ctests` (à distribuer ?) — **15 grammaires**

**9 grammaires manquent leurs `-to.*` (tonalités définissant les `_scale(...)`)** :

| Grammaire | Fichier(s) `-to.*` manquant(s) | Erreur |
|---|---|---|
| `tryHarmony` | `-to.tryHarmony` | `Instruction "_scale(Cmaj,...)" is illicit as this name is unknown` |
| `tryMajorMinor` | `-to.Mozart`, `-cs.Mozart` | `Instruction "_scale(Cmin,...)" is illicit` |
| `tryOneScale` | `-to.tryOneScale`, `-cs.tryOneScale` | `Instruction "_scale(just intonation,...)" is illicit` |
| `tryRagas` | `-to.raga`, `-cs.raga` | `Instruction "_scale(todi_ka_4,...)" is illicit` |
| `tryScales` | `-to.tryScales`, `-cs.tryScales` | `Instruction "_scale(piano,...)" is illicit` |
| `tryShruti` | `-cs.tryShruti`, `-to.tryShruti` | `Instruction "_scale(grama,...)" is illicit` |
| `tryTunings` | `-to.tryTunings`, `-cs.tryTunings` | `Instruction "_scale(BACH,...)" is illicit` |
| `tryObjects` | `-to.Vina`, `-cs.Vina` | `Error code 15 in gram#1 rule 1` |
| `vina`, `vina2`, `vina3` | `-to.Vina`, `-cs.Vina` | `Error code 15 in gram#1 rule 2` |
| `Mozart` | `-to.Mozart`, `-cs.Mozart`, `-se.Mozart` | (voir B ci-dessous) |
| `Nadaka` | (a son `-al` mais cherche scale "just intonation") | `Instruction "_scale(just intonation,...)" is illicit` |

**5 grammaires manquent leurs `-al.*` ou `-ho.*`** :

| Grammaire | Fichier manquant | Erreur |
|---|---|---|
| `12345678` | `-al.EkDoTin`, `-se.EkDoTin` | `Error code 15 in gram#1 rule 2` |
| `tryAllItems0` | `-al.abc`, `-se.tryAllItems0` | `Error code 15 in gram#2 rule 1` |
| `tryDerivationModes` | `-al.abc`, `-se.tryDerivationModes` | `Error code 15 in gram#1 rule 2` |
| `tryFlags` | `-ho.abc` | `Error code 15 in gram#1 rule 2` |
| `bells` | `-al.cloches1`, `-se.cloches` | `Error code 15 in gram#4 rule 1` |

**Question** : peux-tu pousser ces fichiers manquants dans `bp3-ctests` ? Ou bien sont-ils intentionnellement absents (test "what happens if file missing") ?

### B. Feature non disponible en CLI — **1 grammaire**

| Grammaire | Erreur | Cause |
|---|---|---|
| `Mozart` | `=> Live coding is only possible in real-time MIDI` | Fonction GUI-only, pas accessible via `bp3 produce ... --midiout` |

Pas un bug. Juste à savoir que cette grammaire ne passera jamais en bulk-test.

### C. Vrais bugs grammaire / syntaxe — **3 grammaires**

| Grammaire | Aux files OK | Erreur exacte |
|---|---|---|
| `Nadaka` | aucun ref manquant | `Instruction "_scale(just intonation,...)" is illicit as this name is unknown` — l'argument contient un espace, peut-être problème de parsing de l'argument |
| `koto3` | `-se.koto3`, `-tb.koto3` présents | `Error code 15 in gram#1 rule 2` — vrai bug à creuser |
| `tryrepeat` | aucun ref manquant | `Error code 15 in gram#1 rule 2` — vrai bug à creuser |

Ces 3 méritent une investigation côté ton moteur.

### D. Timeout boucle infinie — **1 grammaire**

| Grammaire | Symptôme |
|---|---|
| `Watch_What_Happens` | Boucle infinie : *"Using quantization = 0 ms with compression rate = 1"* répété, ne termine pas après 30 s |

Probablement une polymetric mal terminée ou une récursion sans condition de sortie. À investiguer côté moteur.

## 4. Côté BPscript : transpositions des nouvelles grammaires

J'ai commencé à intégrer tes grammaires dans notre pipeline BPscript :

- **`acceleration`** → BPscript : ✅ **transposition complète et fonctionnelle**. 78 notes natives, 88 tokens BPscript (78 notes + 10 tokens contrôle pour `_vel`/`_transpose`).

- **`dhadhatite`** → BPscript : ⚠️ **transposition partielle** (4 sous-grammaires sur 5 traduites). Les 6 features que notre transpileur ne supporte pas encore — toutes liées au système templates/contextes que tu viens d'introduire :
    1. Annotation de signature temporelle dans le LHS (`4+4+4+4/4 S64`)
    2. Brackets templates inline `(= ...)` / `(: ...)` dans le corps des règles
    3. Préfixes de profondeur de contexte `+` et `++` sur les tokens
    4. Marqueur LHS de contexte négatif `#+`
    5. Direction `<--` + contrainte d'ordre "must be last" dans une sous-grammaire ORD
    6. Multiples règles LIN avec même LHS partageant un état

C'est un beau backlog côté nous — ça veut dire qu'on doit faire évoluer BPscript pour parler le langage des templates BP3 que tu as enrichi en v3.4.x. Si tu as une explication formelle des règles de matching templates / contextes, ça nous aiderait à porter ces concepts.

## 5. Conclusion

- ✅ Notre fix `copy_grammar` chez toi tient à 100 % — zéro crash sur 56 grammaires
- ✅ Pas de régression sur notre pipeline
- ✅ +2 grammaires qui marchent maintenant (`acceleration`, `dhadhatite`)
- ✅ `acceleration` transposée en BPscript (notre langage)
- 🟡 15 fichiers à pousser dans `bp3-ctests` pour qu'on monte à 48/56 PASS
- 🟡 6 features templates/contextes à ajouter à notre transpileur BPscript
- 🔴 4 vrais bugs à investiguer côté ton moteur (`Nadaka`, `koto3`, `tryrepeat`, `Watch_What_Happens`)

Bravo pour cette release. Le système d'analyse + LEARN WEIGHTS est très chouette — j'ai noté le rapport de l'analyse `dhadhatite` (4/6 templates acceptés). Si tu veux qu'on échange sur la "mesure des asymétries" que tu mentionnais, dis-moi.

À bientôt,
Romain
