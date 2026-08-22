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
# coexister sur la même machine : on prend celui dont le `wakfu.log` a bougé le
# plus récemment, c'est l'installation réellement jouée.
#
# Sur `wakfu.log` et non sur le chat log, depuis l'ADR 0008 : c'est le fichier
# qu'on ouvre vraiment, et le chat log n'est pas purgé entre sessions, donc sa
# date de modification est un moins bon témoin de l'installation active.
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
    [[ -f "$c/wakfu.log" ]] || continue
    m=$(stat -c '%Y' "$c/wakfu.log")
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
  # ⚠️ `Information (jeu)` a été RETIRÉ de cette liste le 22 août 2026 : le
  # masquage du numéro de compte ne masque pas le pseudo qui le précède, et ce
  # canal porte les arrivées et départs des joueurs tiers
  # (« <pseudo> (compte#1234) a rejoint notre monde »). Il ne sert à rien au
  # parseur — seul le canal de combat est lu — donc il sort.
  # Le `|| true` n'est pas de la complaisance : un delta sans une seule ligne de
  # combat est un cas normal — capture sans combat, ou chat log déjà tourné — et
  # `grep` y rend 1. Avec `pipefail`, ça tuait toute la capture.
  { grep -E '^\S+ - \[(Information \(combat\)|Fight Log|Información \(combate\)|Registro de Lutas)\] ' || true; } \
    | sed -E 's/\([a-zA-Z0-9-]+#[0-9]{4}\)/(COMPTE)/g'
}

# La même liste blanche, mais sur `wakfu.log` — le seul fichier que l'app lit
# depuis l'ADR 0008, et donc le seul dont on veuille un échantillon versionnable.
#
# Elle est indispensable : `wakfu.log` porte TOUS les canaux, le logger de chat
# étant additif. Sans filtre, un échantillon emporte le commerce et les arrivées
# de joueurs — mesuré le 22 août 2026 : 49 lignes `[Commerce]` et 76 lignes
# `[Information (jeu)]`, dont des pseudos de tiers et leur numéro de compte.
#
# Le filtre porte sur le TAG, pas sur le canal, parce qu'un tag de chat peut
# être un pseudo arbitraire — un message privé s'écrit `[<pseudo>]`. Une liste
# noire de libellés ne peut donc pas être complète, par construction.
#
# Ce qui est gardé : les tags techniques (`[_FL_]`, `[FIGHT]`, `[NATION]`…, qui
# ne sont pas des canaux de chat), les lignes sans tag du tout, et le SEUL canal
# de chat que l'app lise — l'information de combat, dans les quatre langues du
# client. `Information (jeu)` en est exclu : il ne sert à rien au parseur et
# porte les allées et venues des tiers.
scrub_main() {
  awk '
    BEGIN {
      split("_FL_ FIGHT FIGHT_REFACTOR Fight NATION CHAT CRAFT LUA Animation LD DEATH WALKON", t, " ")
      for (i in t) garde[t[i]] = 1
      garde["Information (combat)"] = 1   # fr
      garde["Fight Log"] = 1              # en
      garde["Información (combate)"] = 1  # es
      garde["Registro de Lutas"] = 1      # pt
    }
    {
      sep = index($0, " - ")
      if (sep == 0) { print; next }             # trace Java multi-ligne, couture de blocs
      msg = substr($0, sep + 3)
      if (substr(msg, 1, 1) != "[") { print; next }   # message technique non tagué
      fin = index(msg, "]")
      if (fin == 0) { print; next }
      if (substr(msg, 2, fin - 2) in garde) print
    }
  '
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
  # Les ID d'entité sont stables par compte, donc ils s'anonymisent — mais
  # **un jeton distinct par entité**, jamais un `[ENTITE]` unique pour tout le
  # monde. Écraser la distinction détruit ce que l'ID est : l'identité d'un
  # combattant (ADR 0002). Un échantillon où tout le monde porte `[ENTITE]`
  # réduit le roster à un seul combattant si on déduplique sur l'ID comme la
  # grammaire le prescrit, et rend deux monstres homonymes indiscernables — ce
  # qui fait lire `k` de travers. Les échantillons `duel` et `revive` portent
  # bien `[ENTITE279]`, `[ENTITE827]` : la distinction s'était perdue en route.
  local n=0 id
  while read -r id; do
    n=$((n + 1))
    sed_args+=(-e "s/\[$id\]/[ENTITE$n]/g")
  done < <(grep -ohE '\[-?[0-9]{6,}\]' "$raw_main" | tr -d '[]' | awk '!seen[$0]++')

  # Le chemin du home et l'IP locale. `wakfu.log` en est plein — 116 chemins et
  # 7 adresses sur la capture du 22 août 2026 — et ils portent le nom de compte
  # de la machine. `revive2` les avait masqués À LA MAIN, ce qui est exactement
  # ce qui rendait une capture non commitable telle quelle.
  sed_args+=(-e 's|/home/[^/[:space:]]\{1,\}|/home/USER|g')
  sed_args+=(-e 's|/Users/[^/[:space:]]\{1,\}|/Users/USER|g')
  sed_args+=(-e 's|\([Cc]:\\\\Users\\\\\)[^\\]\{1,\}|\1USER|g')
  sed_args+=(-e 's/\b\(10\|192\.168\|172\.\(1[6-9]\|2[0-9]\|3[01]\)\)\.[0-9]\{1,3\}\(\.[0-9]\{1,3\}\)\{1,2\}/IP-LOCALE/g')

  # `sed_args` porte toujours au moins les chemins et l'IP, donc pas de branche
  # de repli : même une capture sans aucun personnage joué passe par ici.
  sed "${sed_args[@]}" "$raw_main" | scrub_main > "$out_main"
  sed "${sed_args[@]}" "$raw_chat" | scrub_chat > "$out_chat"
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

# Le rapport lit `anon-wakfu.log`, plus le chat log : depuis l'ADR 0008 c'est le
# seul fichier que l'app ouvre, donc le seul dont les compteurs veuillent dire
# quelque chose.
#
# Et il ne cherche plus les doublons par une fenêtre de 500 ms. L'ADR 0009 l'a
# écartée sur mesures : deux copies d'une frontière peuvent être à 1477 ms, soit
# plus que le tour réel le plus court mesuré (1169 ms). La proximité temporelle
# ne distingue donc plus un doublon d'une répétition réelle. On compte.
cmd_report() {
  local main="$OUT/anon-wakfu.log"
  [[ -f "$main" ]] || die "pas de capture : lance « cut »"

  echo "================ le roster ================"
  echo "Combats vus (fightId -> nb de lignes [_FL_]) :"
  grep -o '\[_FL_\] fightId=[0-9]*' "$main" | sort | uniq -c | sed 's/^/  /'
  echo
  echo "Roster — isControlledByAI sépare les Personnages joués des monstres,"
  echo "et un obstacleId positif signe une Invocation :"
  grep -o '\[_FL_\].*join the fight' "$main" \
    | sed -E 's/.*fightId=([0-9]+) (.*) breed : ([0-9]+) \[([^]]*)\] isControlledByAI=(\w+) obstacleId : (-?[0-9]+).*/  fight \1 | \2 | breed \3 | \4 | IA=\5 | obstacle=\6/' \
    | sort -u
  echo

  # `k` et le comptage se font PAR COMBAT — l'ADR 0009 dit « le nombre de clients
  # engagés dans le combat ». Un `k` global sur une capture à plusieurs combats
  # n'a pas de sens, et le plus grand contaminerait les autres.
  #
  # `k` vaut le MAXIMUM du nombre de copies de la ligne `[_FL_]` d'une même
  # entité, et surtout pas le nombre d'entités jouées : elles n'arrivent pas
  # ensemble — 1,7 s d'écart mesuré — et conclure `k=1` sur la première rafale
  # donne un overlay DEUX FOIS TROP RAPIDE, le pire mode de panne du produit.
  #
  # Les frontières ne portent pas de fightId : elles appartiennent au combat
  # ouvert à cet endroit du flux, exactement comme dans le lecteur.
  awk '
    function fid(ligne) { match(ligne, /fightId=[0-9]+/); return substr(ligne, RSTART + 8, RLENGTH - 8) }
    function idFin(ligne) { match(ligne, /with id [0-9]+/); return substr(ligne, RSTART + 8, RLENGTH - 8) }
    # la clé de copie : la ligne sans son niveau ni son horodatage
    function cle(ligne) { return substr(ligne, index(ligne, " [")) }

    NR == FNR {                                    # passe 1 : k par combat
      if (/\[_FL_\] fightId=/) {
        f = fid($0)
        c = ++copies[f "|" cle($0)]
        if (c > k[f]) k[f] = c
        if (!(f in vus)) { vus[f] = 1; ordre[++nb] = f }
      }
      next
    }
    /\[_FL_\] fightId=/ { ouvert = fid($0); next }
    /\[FIGHT\] End fight with id / { if (ouvert == idFin($0)) ouvert = ""; next }
    /pour le tour suivant/ {
      if (ouvert == "") { orphelines++; next }
      brutes[ouvert]++
      if (aIgnorer[ouvert] > 0) { aIgnorer[ouvert]--; next }
      tours[ouvert]++
      aIgnorer[ouvert] = k[ouvert] - 1
    }
    END {
      print "================ les frontières de tour, par combat ================"
      for (i = 1; i <= nb; i++) {
        f = ordre[i]
        printf "  combat %s : %d lignes brutes, k=%d  ->  %d fins de tour\n",
               f, brutes[f], k[f], tours[f]
      }
      if (orphelines > 0)
        printf "  %d frontière(s) hors de tout combat ouvert, perdue(s)\n", orphelines
      print ""
      print "  La règle est relative à la dernière frontière ACCEPTÉE, jamais un"
      print "  découpage en paquets absolus de k : une frontière orpheline — une"
      print "  seule copie, ça existe — décalerait sinon tout le reste du combat."
      print ""
      print "  ⚠️ Un k supérieur au nombre de clients réellement lancés signe un"
      print "  client qui a REJOINT le combat : sa rafale [_FL_] est une copie de"
      print "  plus. Cas hors périmètre, voir « Points de rupture connus »."
    }
  ' "$main" "$main"
  echo
  echo "Transitions (elles posent un état, aucune déduplication) :"
  grep -oE '(est KO !|est réanimé|est ressuscité !|est hors-combat !)' "$main" \
    | sort | uniq -c | sed 's/^/  /'
}

case "${1:-}" in
  mark) cmd_mark ;;
  cut) cmd_cut ;;
  report) cmd_report ;;
  *) die "usage : $0 {mark|cut|report}" ;;
esac
