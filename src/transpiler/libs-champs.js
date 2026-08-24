/**
 * LES CHAMPS DE FICHIER D'UNE LIBRAIRIE — déclarés UNE FOIS, pour tous mes lecteurs.
 *
 * Un catalogue mêle, à la même profondeur, ce qui parle DU FICHIER et ce qui EST une entrée :
 * `alphabets` porte `resolves` à côté de `western`. Tout lecteur qui énumère les entrées doit donc
 * écarter les champs de fichier, et chacun le faisait avec SA liste.
 *
 * ⛔ CE QUI A COÛTÉ CE FICHIER, LE 2026-08-24. En posant `documented` — décision Romain,
 * `un-catalogue-declare-s-il-est-documente` — j'ai trouvé CINQ listes tenues à la main pour ce
 * seul fait : deux chez moi (le générateur du bundle, le convertisseur), deux dans mes gardes, une
 * chez Atlas. Elles avaient déjà DIVERGÉ :
 *
 *     le générateur du bundle      7 champs, dont `section`
 *     le convertisseur             6 champs, sans `section`
 *     deux de mes gardes           6 champs, dont `domain` — ZÉRO occurrence dans la donnée
 *     le générateur de fiches      un mélange de champs de fichier et de noms de section
 *
 * Le nouveau champ est devenu une ENTRÉE FANTÔME dans les deux gardes, qui ont exigé d'elle ce
 * qu'ils exigent d'un alphabet. Ils ont rougi — et c'est la chance : les deux copies qui ne
 * vérifient rien n'auraient rien dit. Un recensement tenu à la main périme sans rougir.
 *
 * ⚠️ UNE ENTRÉE PORTE UN OBJET, UN CHAMP DE FICHIER PORTE UN MOT — et cette différence NE SUFFIT
 * PAS. Elle sauve le lecteur qui exige un objet (le générateur de fiches d'Atlas ne voit pas le
 * champ) et perd celui qui énumère les noms. Écarter par le NOM reste nécessaire.
 */

/**
 * Les noms qu'un catalogue emploie pour parler DE LUI-MÊME. Tout le reste, à ce niveau, est une
 * entrée du vocabulaire qu'il apporte.
 *
 * ⛔ CETTE PORTE EST PUBLIÉE — déclarée dans le champ d'exports le 2026-08-24, à la demande d'Atlas
 * et de Kairos, qui en tenaient chacun une copie. Ce qui suit vaut donc comme contrat.
 *
 * ⛔ DEUX NATURES DANS UNE SEULE LISTE, ET J'AI DIT LE CONTRAIRE À DEUX VOISINS. `section` ROUTE à
 * la CONSTRUCTION — il dit au générateur du bundle où ranger les entrées du fichier — et il ne
 * voyage JAMAIS jusqu'aux consommateurs : **zéro occurrence dans le paquet publié**, mesuré à
 * toutes les profondeurs. Tous les autres champs se publient.
 *
 * ⚠️ ET UNE PLACE DIT OÙ UNE CHOSE VIT, JAMAIS CE QU'UN AUTEUR PEUT ÉCRIRE. Atlas a branché ses
 * fiches sur `PLACES` et publié 79 fausses entrées : `engine.print` vit dans une place et il est
 * REFUSÉ à l'invocation. Les deux questions se ressemblent et n'ont pas la même réponse — ce
 * registre sert à ÉCARTER les enveloppes, pas à y descendre chercher du vocabulaire.
 *
 * ⚠️ Le 2026-08-24 j'ai écrit à Kairos et à Atlas « `section`, que je publie depuis le 2026-08-22 ».
 * C'était faux, et la phrase juste était écrite dans mon propre générateur, à trois lignes de la
 * liste que je lisais. Kairos a mesuré 0 occurrence dans trois de mes états et a répondu avec sa
 * mesure au lieu de me croire. **Un champ de fichier n'est pas un champ publié.**
 *
 * `documented` DIT SI LE CATALOGUE ENTRE DANS L'AIDE PUBLIÉE, en DEUX MOTS, `yes` et `no`.
 * **Compare le MOT, jamais la vérité de la valeur** — `Boolean("no")` est VRAI — et refuse un
 * troisième mot.
 *
 * ⛔ ET LA RAISON QUE CETTE PORTE PORTAIT ÉTAIT FAUSSE, sur une surface publiée. Elle disait « le
 * langage n'a pas de littéral booléen, donc `documented:false` rend la CHAÎNE "false" ». Mesuré au
 * PARSEUR — vrai — et conclu sur le PAQUET, où c'est faux : le générateur rend `'true'` et `'false'`
 * à leur nature, et ce paquet porte 74 booléens réels. **Mesuré à un étage, conclu sur le suivant**,
 * puis routé à quatre destinataires comme un argument. runtime-midi l'a réfuté avec ce paquet même.
 */
export const CHAMPS_DE_FICHIER = new Set([
  'resolvedBy', 'resolves', 'name', 'description', 'version', 'type', 'section', 'documented',
]);

/**
 * Les entrées d'un objet de librairie, à un niveau donné : ni champ de fichier, ni note privée.
 *
 * ⚠️ CE QUE CETTE FONCTION NE FAIT PAS : distinguer une ENTRÉE d'une PLACE. Les deux vivent à la
 * même profondeur, et **la forme ne les sépare pas** — une place vide (`core.symbols`) ressemble à
 * une entrée vide, et une entrée dont tous les membres sont des objets ressemble à une place.
 *
 * ⇒ **Les places se lisent dans `PLACES`, publié par `libs-data.js`** : pour une source écrite dans
 * le langage, le générateur les CONNAÎT — il vient de les créer ; pour un catalogue encore en JSON,
 * il les déduit par la forme, et `PLACES._deduites` nomme lesquels. **Un lecteur qui descend dans
 * les places lit ce champ ; il ne le devine pas.**
 */
export function entreesDe(objet) {
  return Object.keys(objet || {}).filter((k) => !CHAMPS_DE_FICHIER.has(k) && !k.startsWith('_'));
}
