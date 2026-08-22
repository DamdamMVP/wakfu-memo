#!/usr/bin/env bash
# Enregistre le presse-papier dans `prise-en-main/`, sous un nom que cet écran
# connaît, puis reconstruit.
#
#   tools/coller-capture.sh combat-en-jeu
#
# À lancer JUSTE APRÈS avoir copié l'image : toute autre copie entre-temps —
# une capture d'écran de l'app, par exemple — écrase le presse-papier.
set -eu
cd "$(dirname "$0")/.."

CONNUES="combat-en-jeu fiche-overlay strat-editeur roster demande-ajout reglages"

if [ $# -ne 1 ]; then
  echo "usage : tools/coller-capture.sh <nom>"
  echo "noms   : $CONNUES"
  exit 1
fi
case " $CONNUES " in
  *" $1 "*) ;;
  *) echo "nom inconnu : $1"; echo "noms : $CONNUES"; exit 1 ;;
esac

cible="prise-en-main/$1.png"

if ! wl-paste --list-types 2>/dev/null | grep -q '^image/png'; then
  echo "✗ Le presse-papier ne contient pas d'image PNG. Rien écrit."
  echo "  Copie la capture, puis relance cette commande sans rien copier entre les deux."
  exit 1
fi

# Dans un fichier temporaire d'abord : une image refusée ne doit pas écraser
# celle qui marchait.
tmp=$(mktemp --suffix=.png)
trap 'rm -f "$tmp"' EXIT
wl-paste --type image/png > "$tmp"

python3 - "$tmp" "$cible" <<'PY'
import struct, sys, os
source, cible = sys.argv[1], sys.argv[2]
d = open(source, 'rb').read()
if d[:8] != b'\x89PNG\r\n\x1a\n':
    print('✗ Ce n’est pas un PNG. Rien écrit.'); sys.exit(1)
w, h = struct.unpack('>II', d[16:24])
ancien = os.path.getsize(cible) if os.path.exists(cible) else None
if ancien is not None and ancien == len(d):
    print(f'⚠ {cible} existe déjà, à l’identique ({w}×{h}) — tu as sans doute recopié la même image.')
print(f'✓ {cible} — {w}×{h}, {len(d)//1024} Ko')
PY

cp "$tmp" "$cible"
echo
npm run build
