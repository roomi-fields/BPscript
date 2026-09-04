#!/usr/bin/env bash
# LES GARDES PARTAGÉS DU HUB, APPELÉS DEPUIS MON PORTILLON — bascule tranchée par Romain le 2026-08-14.
#
# CE QUE CE MAILLON RÉPARE. Les gardes vivaient dans un BLOC GREFFÉ après `verify`, dans le crochet de
# POUSSÉE seulement. « verify vert » ne valait donc pas « portillon vert », et mes deux crochets
# étaient à des niveaux différents sans que rien ne le dise : le commit ne les lançait pas, la poussée
# les lançait.
#
# ⛔ UN APPEL, JAMAIS UNE COPIE. La logique reste chez son propriétaire, `hub/tools/`.
#
# ⛔⛔ ET LA LISTE EST UNE COPIE AUTANT QUE LE FICHIER — corrigé le 2026-09-04, à l'initiative de
# l'architecte, et c'est MOI qui en ai payé le prix. Ce maillon appelait bien les outils du hub, mais
# il portait leur LISTE en dur : `garde-navigation.py garde-copies.py`, une des QUINZE copies de la
# même liste dans la tour. `garde-publie-a-jour.sh` était écrit, poussé et fonctionnel depuis la
# veille, et aucun portillon ne l'appelait — dont le mien. Résultat mesuré : ma poussée de 10:43 est
# passée au vert avec un état publié qui retardait de dix heures, j'ai annoncé « publié », et trois
# agents ont dû me réfuter sur pièces.
# ⇒ *Ajouter un garde chez quinze voisins n'atteignait personne, et rien ne le disait.* La liste vit
#   désormais dans `hub/tools/gardes-du-portillon.sh`, et nulle part ailleurs. Toute évolution arrive
#   ici sans que j'aie un geste à faire.
#
# ⛔ ET IL ÉCHOUE, IL N'AVERTIT PAS. Le bloc greffé imprimait un avertissement quand le dossier
# partagé était introuvable, et la poussée passait au VERT sans qu'aucun garde ait tourné. « Un garde
# qui peut se sauter doit ÉCHOUER, jamais avertir — présent dans le portillon n'est pas exécuté. »
# Le point d'entrée porte la même exigence, et il NOMME l'outil manquant : dossier absent et outil
# absent sont deux pannes différentes.
#
# IL N'ÉCRIT RIEN dans l'arbre de travail : rien à exclure du `.gitignore`. Le piège existe — kronos a
# mesuré qu'un instrument qui salit l'arbre aurait cassé la fenêtre de construction de Kanopi EN
# PERMANENCE, en posant l'outil censé l'aider.
set -e
racine="$(git rev-parse --show-toplevel)"
hub="$(cd "$racine/.." && pwd)/hub"
moi="$(basename "$racine")"

# ⛔ LE POINT D'ENTRÉE SE SONDE, LUI AUSSI : il porte la liste, donc son absence ne se distingue pas
# d'une liste vide — et une liste vide passerait au vert sans rien vérifier.
if [ ! -f "$hub/tools/gardes-du-portillon.sh" ]; then
  echo "✗ gardes du portillon INEXÉCUTABLES — introuvable : $hub/tools/gardes-du-portillon.sh" >&2
  echo "  Ces gardes ne se sautent pas : sans eux, le portillon n'est pas complet." >&2
  exit 1
fi

bash "$hub/tools/gardes-du-portillon.sh" "$moi"
