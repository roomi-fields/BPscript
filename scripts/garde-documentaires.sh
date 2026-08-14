#!/usr/bin/env bash
# GARDES DOCUMENTAIRES DU HUB, APPELÉS DEPUIS LE PORTILLON — bascule tranchée par Romain le 2026-08-14.
#
# CE QUE CE MAILLON RÉPARE. Les deux gardes vivaient dans un BLOC GREFFÉ après `verify`, dans le
# crochet de POUSSÉE seulement. « verify vert » ne valait donc pas « portillon vert », et mes deux
# crochets étaient à des niveaux différents sans que rien ne le dise : le commit ne les lançait pas,
# la poussée les lançait. Mesuré chez kronos, le dépôt témoin : on empile des commits sur un dépôt
# que le garde refuse déjà, et on le découvre au push.
#
# ⛔ UN APPEL, JAMAIS UNE COPIE. La logique reste chez son propriétaire, `hub/tools/`. Zéro ligne
# dupliquée — c'est ce qui distingue ce maillon d'une quinzième rédaction du même garde, et c'est la
# règle qu'on a passé la journée à faire respecter dans l'autre sens : une surface publiée se DÉRIVE,
# jamais ne se recopie.
#
# ⛔ ET IL ÉCHOUE, IL N'AVERTIT PAS. Le bloc greffé imprimait un avertissement quand le dossier
# partagé était introuvable, et la poussée passait au VERT sans que les deux gardes aient tourné.
# « Un garde qui peut se sauter doit ÉCHOUER, jamais avertir — présent dans le portillon n'est pas
# exécuté. » C'est le cas qui passait avant, et c'est celui que l'injection doit faire rougir.
#
# IL N'ÉCRIT RIEN dans l'arbre de travail : rien à exclure du `.gitignore`. Le piège existe — kronos
# a mesuré qu'un instrument qui salit l'arbre aurait cassé la fenêtre de construction de Kanopi EN
# PERMANENCE, en posant l'outil censé l'aider.
set -e
racine="$(git rev-parse --show-toplevel)"
hub="$(cd "$racine/.." && pwd)/hub"
moi="$(basename "$racine")"

if [ ! -f "$hub/tools/garde-navigation.py" ]; then
  echo "✗ gardes documentaires INEXÉCUTABLES — hub introuvable à $hub" >&2
  echo "  Ces gardes ne se sautent pas : sans eux, le portillon n'est pas complet." >&2
  exit 1
fi

python3 "$hub/tools/garde-navigation.py" --depot "$moi"
python3 "$hub/tools/garde-copies.py"      --depot "$moi"
