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
 * ⚠️ Le 2026-08-24 j'ai écrit à Kairos et à Atlas « `section`, que je publie depuis le 2026-08-22 ».
 * C'était faux, et la phrase juste était écrite dans mon propre générateur, à trois lignes de la
 * liste que je lisais. Kairos a mesuré 0 occurrence dans trois de mes états et a répondu avec sa
 * mesure au lieu de me croire. **Un champ de fichier n'est pas un champ publié.**
 *
 * `documented` DIT SI LE CATALOGUE ENTRE DANS L'AIDE PUBLIÉE, en DEUX MOTS, `yes` et `no`. Ce
 * n'est pas un booléen, et c'est une mesure qui le dit : le langage n'a pas de littéral booléen,
 * donc `documented:false` écrit dans une source de librairie rend la CHAÎNE "false", qui est VRAIE.
 * Compare le MOT, jamais la vérité de la valeur, et refuse un troisième mot.
 */
export const CHAMPS_DE_FICHIER = new Set([
  'resolvedBy', 'resolves', 'name', 'description', 'version', 'type', 'section', 'documented',
]);

/** Les entrées d'un objet de librairie, à un niveau donné : ni champ de fichier, ni note privée. */
export function entreesDe(objet) {
  return Object.keys(objet || {}).filter((k) => !CHAMPS_DE_FICHIER.has(k) && !k.startsWith('_'));
}
