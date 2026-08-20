#!/usr/bin/env bash
# Extrait des bundles i18n du client Wakfu les libellés dont dépend le parser.
#
# Le client stocke tous ses textes dans <install>/contents/i18n/i18n_<lang>.jar,
# un simple zip contenant texts_<lang>.properties. Les lignes du chat log sont
# rendues depuis ces clés : les motifs du parser s'en dérivent donc au lieu
# d'être écrits à la main.
#
# Usage : tools/extract-i18n-patterns.sh <dossier-d-installation-wakfu>
set -euo pipefail

install_dir=${1:?usage: $0 <dossier-d-installation-wakfu>}
i18n_dir="$install_dir/contents/i18n"
[[ -d $i18n_dir ]] || { echo "pas de bundles i18n dans $i18n_dir" >&2; exit 1; }

# Les clés dont le parser a besoin. Ajouter ici toute nouvelle ligne nommée.
keys=(
  fight.remaining.time.reported   # frontière de tour — le tick inconditionnel
  fight.spellCast                 # l'acteur du tour
  fight.ko
  fight.die
  chat.pipeName.fightInformation
  chat.pipeName.gameInformation
  chat.pipeName.gameError
  chat.pipeName.vicinity
  chat.pipeName.private
)

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT

for jar in "$i18n_dir"/i18n_*.jar; do
  lang=$(basename "$jar" .jar); lang=${lang#i18n_}
  unzip -o -q "$jar" "texts_${lang}.properties" -d "$workdir"
  echo "### $lang"
  for key in "${keys[@]}"; do
    key=${key%%[[:space:]]*}
    printf '%s=%s\n' "$key" \
      "$(grep -h -m1 "^${key}=" "$workdir/texts_${lang}.properties" | cut -d= -f2-)"
  done
  echo
done
