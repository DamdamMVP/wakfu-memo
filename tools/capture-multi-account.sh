#!/usr/bin/env bash
# Instrument de test pour l'issue #3 — « Test multi-compte : deux clients, un
# seul fichier de log ». Marque la position des logs avant le combat, en
# extrait le delta après, l'anonymise, et sort les compteurs qui répondent aux
# trois questions du ticket.
#
# Usage :
#   ./tools/capture-multi-account.sh mark          # AVANT de lancer le combat
#   ./tools/capture-multi-account.sh cut           # APRÈS la fin du combat
#   ./tools/capture-multi-account.sh report        # les compteurs
#
# Le dossier de logs suit l'installation du jeu ; surchargeable :
#   WAKFU_LOGS=/chemin/vers/preferences/logs ./tools/capture-multi-account.sh mark

set -euo pipefail

die() { printf '\033[31merreur :\033[0m %s\n' "$*" >&2; exit 1; }

# Les deux modes d'installation n'écrivent pas au même endroit, et peuvent
# coexister sur la même machine : on prend celui dont le chat log a bougé le
# plus récemment, c'est l'installation réellement jouée.
discover_logs() {
  local -a candidates=()
  # mode launcher Ankama : WAKFU_PREF_FILE_DIRECTORY est absolu
  candidates+=("$HOME/.config/zaap/gamesLogs/wakfu/logs")
  # mode Steam : WAKFU_PREF_FILE_DIRECTORY vaut ./preferences, appId 215080
  local vdf lib
  for vdf in "$HOME"/.steam/steam/steamapps/libraryfolders.vdf              "$HOME"/.local/share/Steam/steamapps/libraryfolders.vdf              "$HOME"/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/libraryfolders.vdf; do
    [[ -f $vdf ]] || continue
    while read -r lib; do
      [[ -f "$lib/steamapps/appmanifest_215080.acf" ]] || continue
      local dir
      dir=$(sed -nE 's/.*"installdir"[[:space:]]+"([^"]+)".*/\1/p'               "$lib/steamapps/appmanifest_215080.acf" | head -1)
      [[ -n $dir ]] && candidates+=("$lib/steamapps/common/$dir/preferences/logs")
    done < <(sed -nE 's/.*"path"[[:space:]]+"([^"]+)".*/\1/p' "$vdf")
  done

  local best="" best_mtime=0 c m
  for c in "${candidates[@]}"; do
    [[ -f "$c/wakfu_chat.log" ]] || continue
    m=$(stat -c '%Y' "$c/wakfu_chat.log")
    (( m > best_mtime )) && { best_mtime=$m; best=$c; }
  done
  [[ -n $best ]] && printf '%s' "$best"
}

LOGS="${WAKFU_LOGS:-$(discover_logs)}"
[[ -n $LOGS ]] || die "aucune installation Wakfu trouvée — fixe WAKFU_LOGS"
OUT="${WAKFU_CAPTURE_OUT:-/tmp/wakfu-memo-capture}"
STATE="$OUT/mark.state"

MAIN="$LOGS/wakfu.log"
CHAT="$LOGS/wakfu_chat.log"

info() { printf '\033[36m%s\033[0m\n' "$*"; }

stat_of() { stat -c '%i %s' "$1"; }

cmd_mark() {
  [[ -f "$MAIN" ]] || die "introuvable : $MAIN (fixe WAKFU_LOGS)"
  [[ -f "$CHAT" ]] || die "introuvable : $CHAT (fixe WAKFU_LOGS)"
  mkdir -p "$OUT"
  {
    echo "LOGS=$LOGS"
    echo "MAIN=\"$(stat_of "$MAIN")\""
    echo "CHAT=\"$(stat_of "$CHAT")\""
  } > "$STATE"
  info "Marque posée :"
  sed 's/^/  /' "$STATE"
  cat <<'EOF'

Maintenant, dans cet ordre :
  1. lance le PREMIER client, connecte le personnage A
  2. lance le SECOND client depuis la MÊME installation, connecte B
  3. groupe-les, engage un combat où A et B jouent tous les deux
  4. joue au moins DEUX rounds complets (idéalement trois)
  5. lance un sort avec A et un sort avec B à chaque round — c'est ce qui
     permet d'attribuer les frontières de tour
  6. laisse le combat se terminer normalement (pas de fuite, pas d'alt-F4)
  7. reviens ici et lance :  ./tools/capture-multi-account.sh cut
EOF
}

# Extrait les octets ajoutés depuis la marque. Si le fichier a été tronqué ou
# recréé (log4j roule à ~1 Mo, et deux clients qui partagent le fichier peuvent
# rouler l'un sur l'autre), on le dit et on prend le fichier entier.
extract_delta() {
  local file="$1" marked_inode="$2" marked_size="$3" dest="$4"
  local now_inode now_size
  read -r now_inode now_size < <(stat_of "$file")
  if [[ "$now_inode" != "$marked_inode" ]]; then
    printf '\033[33mattention :\033[0m %s a été recréé (inode %s -> %s) : rotation pendant le test.\n' \
      "$(basename "$file")" "$marked_inode" "$now_inode" >&2
    printf '  -> fait un exemplaire de %s.1 aussi, le début du combat y est.\n' "$(basename "$file")" >&2
    cp "$file" "$dest"
  elif (( now_size < marked_size )); then
    printf '\033[33mattention :\033[0m %s a rétréci (%s -> %s octets) : troncature en cours de test.\n' \
      "$(basename "$file")" "$marked_size" "$now_size" >&2
    printf '  -> FAIT MAJEUR pour le ticket : deux clients se marchent dessus sur le même fichier.\n' >&2
    cp "$file" "$dest"
  else
    tail -c "+$((marked_size + 1))" "$file" > "$dest"
  fi
}

# Les noms des personnages joués deviennent PJ1, PJ2... Les noms de monstres
# sont du contenu de jeu, on les garde.
#
# Les canaux sont filtrés en LISTE BLANCHE, pas en liste noire : un canal
# inconnu doit être exclu par défaut. La liste noire précédente laissait passer
# « [Recrutement (FR)] » et « [Communauté (FR)] » — les libellés réels portent
# un suffixe de langue — et versait donc des pseudos et des messages de tiers
# dans l'échantillon. Les libellés viennent de chat.pipeName.{fightInformation,
# gameInformation} dans les quatre langues du client.
# Liste blanche des canaux, dans les quatre langues, puis masquage des
# identifiants de compte Ankama (« pseudo#1234 ») qui apparaissent dans les
# annonces d'arrivée et de départ.
scrub_chat() {
  grep -E '^\S+ - \[(Information \(combat\)|Information \(jeu\)|Fight Log|Game Log|Información \(combate\)|Información \(juego\)|Registro de Lutas|Registro de Jogo)\] ' \
    | sed -E 's/\([a-zA-Z0-9-]+#[0-9]{4}\)/(COMPTE)/g'
}

anonymise() {
  local raw_main="$1" raw_chat="$2" out_main="$3" out_chat="$4" map="$5"
  grep -o '\[_FL_\].*isControlledByAI=false' "$raw_main" 2>/dev/null \
    | sed -E 's/.*\[_FL_\] fightId=[0-9]+ (.*) breed : [0-9]+ .*/\1/' \
    | awk '!seen[$0]++ { printf "%s\tPJ%d\n", $0, ++n }' > "$map" || true

  # Substituer du nom le plus LONG au plus court : un pseudo est souvent le
  # préfixe d'un autre (« Damdam » dans « Damdamosa »), et l'ordre naïf produit
  # des bouillies du genre « PJ1osa ».
  local sed_args=()
  while IFS=$'\t' read -r real alias; do
    [[ -n "$real" ]] && sed_args+=(-e "s/$(printf '%s' "$real" | sed 's/[][\.*^$/]/\\&/g')/$alias/g")
  done < <(awk -F'\t' '{ print length($1)"\t"$0 }' "$map" | sort -rn | cut -f2-)
  # les ids d'entité entre crochets sont stables par compte : on les brouille aussi
  sed_args+=(-e 's/\[-\?[0-9]\{6,\}\]/[ENTITE]/g')

  if ((${#sed_args[@]})); then
    sed "${sed_args[@]}" "$raw_main" > "$out_main"
    sed "${sed_args[@]}" "$raw_chat" | scrub_chat > "$out_chat"
  else
    cp "$raw_main" "$out_main"
    scrub_chat < "$raw_chat" > "$out_chat"
  fi
}

cmd_cut() {
  [[ -f "$STATE" ]] || die "pas de marque : lance d'abord « mark »"
  # shellcheck disable=SC1090
  source "$STATE"
  local main_inode main_size chat_inode chat_size
  read -r main_inode main_size <<< "$MAIN"
  read -r chat_inode chat_size <<< "$CHAT"

  extract_delta "$LOGS/wakfu.log"      "$main_inode" "$main_size" "$OUT/raw-wakfu.log"
  extract_delta "$LOGS/wakfu_chat.log" "$chat_inode" "$chat_size" "$OUT/raw-wakfu_chat.log"
  anonymise "$OUT/raw-wakfu.log" "$OUT/raw-wakfu_chat.log" \
            "$OUT/anon-wakfu.log" "$OUT/anon-wakfu_chat.log" "$OUT/names.tsv"

  info "Capture dans $OUT :"
  wc -l "$OUT"/raw-*.log "$OUT"/anon-*.log | sed 's/^/  /'
  echo
  info "Correspondance des noms (reste en local, NE PAS joindre au ticket) :"
  sed 's/^/  /' "$OUT/names.tsv"
  echo
  info "Ensuite :  ./tools/capture-multi-account.sh report"
}

cmd_report() {
  local main="$OUT/anon-wakfu.log" chat="$OUT/anon-wakfu_chat.log"
  [[ -f "$chat" ]] || die "pas de capture : lance « cut »"

  echo "================ Q2 — un seul fichier, ou deux ? ================"
  echo "Combats vus dans le delta (fightId -> nb de lignes [_FL_]) :"
  grep -o '\[_FL_\] fightId=[0-9]*' "$main" | sort | uniq -c | sed 's/^/  /'
  echo
  echo "Lignes [_FL_] STRICTEMENT identiques (>1 = les deux clients logguent le même événement) :"
  grep '\[_FL_\]' "$main" | sed -E 's/^ INFO [0-9:,]+ //' | sort | uniq -c | sort -rn | head -20 | sed 's/^/  /'
  echo
  echo "Roster (isControlledByAI) :"
  grep -o '\[_FL_\].*join the fight' "$main" \
    | sed -E 's/.*fightId=([0-9]+) (.*) breed : ([0-9]+) .*isControlledByAI=(\w+).*/  fight \1 | \2 | breed \3 | IA=\4/' \
    | sort -u
  echo
  echo "================ Q1/Q3 — les frontières de tour ================"
  echo "Total lignes « reportée » : $(grep -c 'pour le tour suivant' "$chat" || true)"
  echo
  echo "Chronologie : chaque frontière, l'écart depuis la précédente, et qui a"
  echo "agi entre les deux. Écart < 500 ms = doublon de client, pas un vrai tour."
  awk -F' - ' '
    /pour le tour suivant/ {
      t = $1
      split(t, a, /[:,]/)
      ms = ((a[1]*60 + a[2])*60 + a[3])*1000 + a[4]
      d = (prev == 0) ? 0 : ms - prev
      if (d < 0) d += 86400000   # wakfu_chat.log ne porte pas de date : passage de minuit
      flag = (prev != 0 && d < 500) ? "  <-- DOUBLON ?" : ""
      printf "  %s  (+%6d ms)  %-45s%s\n", t, d, substr($2, index($2, "]") + 2), flag
      if (acteurs != "") printf "        acteurs depuis la frontière precedente : %s\n", acteurs
      acteurs = ""
      prev = ms
      next
    }
    / lance le sort / {
      n = $2
      sub(/^\[[^]]*\] /, "", n)
      sub(/ lance le sort .*/, "", n)
      if (index(acteurs, n) == 0) acteurs = acteurs (acteurs == "" ? "" : ", ") n
    }
  ' "$chat"
  echo
  echo "Lignes de chat de combat dupliquées à l'identique (indice de dédup nécessaire) :"
  awk -F' - ' '/\[Information \(combat\)\]/ {print $2}' "$chat" | sort | uniq -c | sort -rn | head -10 | sed 's/^/  /'
}

case "${1:-}" in
  mark) cmd_mark ;;
  cut) cmd_cut ;;
  report) cmd_report ;;
  *) die "usage : $0 {mark|cut|report}" ;;
esac
