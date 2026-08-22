#!/usr/bin/env bash
# Enregistre le presse-papier dans la capture attendue par la maquette.
#
#   ./coller.sh            → passe en revue les 7, une par une
#   ./coller.sh roster     → n'enregistre que celle-là
#
# Copie la capture (Maj+Impr.écran, ou clic droit « copier l'image »), puis Entrée.
set -u
cd "$(dirname "$0")"

declare -A VUES=(
  [combat]="combat-en-jeu.png|le rendu en jeu — l'overlay posé sur Wakfu"
  [fiche]="fiche-overlay.png|la fiche seule, en gros"
  [editeur]="strat-editeur.png|l'écran Strats, une strat ouverte"
  [liste]="strat-liste.png|l'écran Strats, la liste"
  [roster]="roster.png|l'écran Roster, trois profils"
  [demande]="demande-ajout.png|la demande d'ajout, en placement"
  [reglages]="reglages.png|l'écran Réglages"
)
ORDRE=(combat fiche editeur liste roster demande reglages)

coller() {
  local cle=$1 fichier=${VUES[$1]%%|*} quoi=${VUES[$1]#*|}
  if [ -s "$fichier" ]; then
    printf '  ✓ %-20s déjà là (%s octets) — Entrée pour garder, "r" pour refaire : ' \
      "$fichier" "$(stat -c%s "$fichier")"
    read -r rep < /dev/tty
    [ "$rep" != "r" ] && return 0
  fi
  printf '\n  %s\n  → copie « %s », puis Entrée (ou "s" pour sauter) : ' "$fichier" "$quoi"
  read -r rep < /dev/tty
  [ "$rep" = "s" ] && { echo "     sauté."; return 0; }
  if ! wl-paste --list-types 2>/dev/null | grep -q '^image/png'; then
    echo "     ✗ le presse-papier ne contient pas de PNG. Rien écrit."
    return 1
  fi
  wl-paste --type image/png > "$fichier" || return 1
  # Contrôle : un PNG commence par cette signature, et on lit ses dimensions.
  python3 - "$fichier" <<'PY'
import struct, sys
d = open(sys.argv[1], 'rb').read()
if d[:8] != b'\x89PNG\r\n\x1a\n':
    print('     ✗ ce n’est pas un PNG.'); sys.exit(1)
w, h = struct.unpack('>II', d[16:24])
print(f'     ✓ {w}×{h}, {len(d)} octets')
PY
}

if [ $# -gt 0 ]; then
  [ -v "VUES[$1]" ] || { echo "clé inconnue : $1 — au choix : ${ORDRE[*]}"; exit 1; }
  coller "$1"
else
  echo "Les 7 captures de la maquette. Copie, Entrée, on passe à la suivante."
  for cle in "${ORDRE[@]}"; do coller "$cle"; done
  echo
  echo "État :"
  for cle in "${ORDRE[@]}"; do
    f=${VUES[$cle]%%|*}
    [ -s "$f" ] && echo "  ✓ $f" || echo "  ✗ $f  (manquante)"
  done
fi

# Les captures doivent etre EMBARQUEES dans index.html : un navigateur en bac a
# sable (Flatpak) ne voit pas le dossier voisin.
echo
echo "Intégration dans index.html…"
( cd .. && node integrer-les-captures.mjs )
