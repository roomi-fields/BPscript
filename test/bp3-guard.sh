#!/usr/bin/env bash
# bp3-guard.sh — Enveloppe anti-OOM pour tout lancement du moteur natif bp3 (chantier [231], 2026-07-02).
#
# Le moteur bp3 peut gonfler à ~7 Go sur certaines grammaires (mesuré : « watch » ~7,04 GiB ;
# toutes les autres < 300 Mo). Lancé à 6 en parallèle par le harnais de test, il réclamait
# jusqu'à ~42 Go sur 15 Go de RAM → saturation mémoire (OOM). Le noyau tuait alors des
# processus système (pipewire/desktop) → reboot. Trois garde-fous, du plus important au moins :
#   1. victime OOM  : choom -n 1000  → si la RAM sature, le noyau tue bp3, JAMAIS le système.
#   2. concurrence  : verrou flock à N créneaux → jamais plus de N bp3 simultanés (défaut 2).
#   3. plafond mém. : ulimit -v      → un bp3 emballé (dérivation infinie) meurt seul, test relançable.
#
# Usage : bp3-guard.sh <chemin-bp3> [args...]   (cwd et redirections stdio hérités de l'appelant)
# Réglable par variables d'env : BP3_GUARD_CAP_KB (plafond ko), BP3_GUARD_SLOTS (nb créneaux).
set -u

GUARD_DIR="${TMPDIR:-/tmp}/bp3-guard-slots"
CAP_KB="${BP3_GUARD_CAP_KB:-9437184}"   # 9 GiB — au-dessus du besoin réel mesuré (watch ~7,04 GiB)
SLOTS="${BP3_GUARD_SLOTS:-2}"           # jamais plus de 2 bp3 en parallèle
mkdir -p "$GUARD_DIR" 2>/dev/null || true

# Acquisition d'un créneau parmi $SLOTS : flock non bloquant, rotation entre créneaux + petit
# backoff. Le descripteur 9 reste ouvert à travers l'exec → le verrou est tenu par bp3 lui-même
# et libéré à sa sortie (pas de nettoyage explicite nécessaire).
n=0
while : ; do
  exec 9>"$GUARD_DIR/slot$n"
  if flock -n 9 ; then break ; fi
  exec 9>&-
  n=$(( (n + 1) % SLOTS ))
  [ "$n" -eq 0 ] && sleep 0.05
done

# Plafond d'adressage virtuel (RLIMIT_AS). Toléré-absent : on ne bloque pas le run s'il est refusé.
ulimit -v "$CAP_KB" 2>/dev/null || true

# choom (priorité de mise à mort OOM) si disponible, sinon exec direct (verrou + plafond restent actifs).
if command -v choom >/dev/null 2>&1 ; then
  exec choom -n 1000 -- "$@"   # -- : sinon choom parse les args bp3 à tiret (-D, -gr, --midiout…)
else
  exec "$@"
fi
