# Ce qui dort — inventaire nommé du gel modulation / patching

**Romain, 2026-08-09** : « on gèle tout ce qui est modulation/patching ». Geler un sujet gèle **ce
qui le sert** : on ne supprime pas, on suspend avec motif daté, et on attend.

⚠️ **Pourquoi un inventaire NOMMÉ et pas un compte.** Forme posée par kairos ce matin et reprise par
kanopi : **un compte global tolère une compensation** — un garde qui se rallume pendant qu'un autre
s'éteint laisse le total inchangé. L'inventaire dit LEQUEL.

**Rallumage** : au dégel du chantier Dedale/FaustX. Ordre fixé par Romain, sans exception —
1. conformité à `LANGUAGE.md` hors patching · 2. un point ISO-100 · 3. et seulement ensuite FaustX.

## Gardes entièrement suspendus

| fichier | ce qu'il gardait | date |
| --- | --- | --- |
| `test_cv_patch.js` | la déclaration d'un modulateur, ses formes et son arbre | 2026-08-09 |
| `test_modulation_validation.js` | les noms d'entrées de modulation au branchement | 2026-08-09 |
| `une_macro_ne_porte_pas_le_nom_d_une_note.mjs` | une macro ne peut pas s'appeler comme un terminal | 2026-08-09 |
| `test_wiring.js` | les opérateurs de câblage, dans un corps et dans le flux | 2026-08-09 |
| `le_cablage_initial_vit_a_la_racine.mjs` | le câblage initial vit à la racine, pas dans une sous-grammaire | 2026-08-09 |

⚠️ **Les cinq avaient été SUPPRIMÉS le matin même**, au motif que « leur sujet n'existe plus ». Le
sujet ne disparaît pas, il DORT. Un garde supprimé emporte ce qu'il gardait ; un garde suspendu le
dit.

## Volets suspendus à l'intérieur d'un garde vivant

| fichier | volet | ce qu'il gardait |
| --- | --- | --- |
| `l_outil_de_migration_ne_change_pas_la_musique.mjs` | `VOLET_3ANTE_ACTIF` | une scène indérivable des deux côtés reste un vrai refus |
| `nom_declare_par_la_scene_gagne.mjs` | `VOLET_4_ACTIF` | la démo à sept mots, mesurée **telle qu'elle vit** et non en réduction |
| `l_arobase_est_obligatoire.mjs` | `VOLET_2BIS_ACTIF` | un refus ne doit pas mener à un refus muet — signalé par kairos via BPx |
| `deux_signaux_ne_se_contredisent_pas.mjs` | (retiré, moitié conservée) | la nature du câblage ; la moitié qui reste garde la durée d'une définition |
| `un_caractere_illisible_ne_fait_pas_planter.mjs` | (retiré) | l'antislash comme coupure, collé aux chevrons |
| `la_portee_est_la_scene_entiere.mjs` | (retiré) | la localité d'un paramètre de transformation |

## Code qui dort, et qui ne dort pas silencieusement

Rien à cette date.

Le validateur des branchements de modulation figurait ici : il était branché, appelé à chaque
compilation, et rendait toujours vide. Le champ d'arbre dont il tirait ses sources a disparu quand
le sujet `cv` est sorti du langage — il est **élagué** le 2026-08-22, et la validation qu'il portait
est inscrite au backlog central sous **LAN-48**, à refaire quand FaustX ouvrira.

**Ce qu'il a appris, et qui vaut pour tout témoin** : la première injection écrite pour l'éprouver
visait une VALEUR inexistante, quand ce validateur ne jugeait qu'une CLÉ. Elle ne l'atteignait pas,
et son calme se lisait comme une preuve. Un témoin qui n'entre pas par la porte qu'il teste rend un
faux calme.
