# Grammaire des logs de combat Wakfu

Établi empiriquement le 20 août 2026, sur Wakfu lancé via Steam sous Fedora 44
(client Java/OpenGL, personnage `Damdamisback`, `breed : 19`, combats contre un
Sac à patates). Toutes les affirmations ci-dessous sont vérifiées sur les logs
réels, sauf mention contraire explicite.

## Emplacement des fichiers

Le dossier de logs vaut toujours :

```
$WAKFU_PREF_FILE_DIRECTORY/logs/
```

`WAKFU_PREF_FILE_DIRECTORY` est exportée par le script de lancement, et **sa
valeur dépend du mode d'installation**. C'est toute la source de la confusion
qui règne sur le sujet :

| Mode | `WAKFU_PREF_FILE_DIRECTORY` | Dossier de logs |
|---|---|---|
| **Steam** | `./preferences`, relatif au dossier d'installation | `<installation>/preferences/logs/` |
| **Launcher Ankama (Zaap)** | absolu, hors de l'installation | `<données zaap>/gamesLogs/wakfu/logs/` |

Les deux emplacements sont vérifiés sur la machine de l'auteur, où les deux
installations coexistent :

- Steam : `/mnt/games/SteamLibrary/steamapps/common/Wakfu/preferences/logs/`
- Launcher : `/home/damdam/.config/zaap/gamesLogs/wakfu/logs/`,
  pour une installation qui est, elle, dans `/home/damdam/.config/Ankama/Wakfu`

Sous launcher, l'environnement du client porte aussi
`WAKFU_CONFIG_FILE_PATH=<données zaap>/gamesLogs/wakfu/config` et
`WAKFU_CACHE_FILE_DIRECTORY=<données zaap>/gamesLogs/wakfu/cache`.

Les outils tiers qui documentent `%AppData%\zaap\gamesLogs\wakfu\logs\`
**ont donc raison** — ils décrivent le mode launcher, le plus courant sous
Windows. Ce sont bien les fichiers de log4j, pas une capture de stdout : la
grammaire de combat y est intégralement présente.

Le reste du mécanisme est commun aux deux modes :

- `log4j.properties`, dans le dossier d'installation, déclare des chemins
  relatifs à cette racine : `logs/wakfu.log`, `logs/wakfu_chat.log`, rotation
  `MaxFileSize=1MB`, `MaxBackupIndex=2`.
- Le client confirme la racine retenue au démarrage, dans `wakfu.log` :
  `(com.ankamagames.wakfu.client.WakfuClient:226) - log path=<racine>`.

Conséquence, vérifiée par le test multi-compte : deux clients lancés depuis la
même installation écrivent dans **les mêmes fichiers**, et y dupliquent chaque
événement.

Fichiers utiles : `wakfu.log` (rotation `.1`, `.2`) et `wakfu_chat.log`.

⚠️ **La rotation annoncée ne s'observe pas.** Malgré `MaxFileSize=1MB`, un
`wakfu.log` mesuré à **1 473 576 octets** (4 lancements de client, 10 combats,
une soirée) n'avait produit **ni `.1` ni `.2`**. Ne pas compter sur un plafond
de taille pour borner ce fichier, ni sur l'existence des fichiers tournés.
Les autres (`wakfu_lua`, `wakfu_theme`, `wakfu_camera`, `wakfu_animation`,
`wakfu_particles_scripts`, `wakfu_fileLoading`) sont vides ou hors sujet.

### Trouver le dossier de logs

**Ne jamais coder le chemin en dur**, et ne pas supposer une seule
installation : les deux modes peuvent coexister sur la même machine, et c'est
le cas chez l'auteur. Il faut donc chercher les deux, et savoir départager.

- **Launcher Ankama** — chercher `gamesLogs/wakfu/logs/` sous les données de
  Zaap (`%AppData%\zaap\` sous Windows, `~/.config/zaap/` sous Linux).
- **Steam** — déterministe. L'`appId` est `215080` (lu dans `zaapi.yml`).
  Parcourir `libraryfolders.vdf` pour trouver la bibliothèque qui déclare cet
  `appId`, puis lire `installdir` dans
  `<bibliothèque>/steamapps/appmanifest_215080.acf`, et concaténer
  `preferences/logs`. Vérifié de bout en bout.
- **Départage** — prendre le `wakfu_chat.log` dont la date de modification est
  la plus récente : c'est l'installation réellement jouée. Et le
  reconsidérer à chaud, parce que le joueur peut changer de mode entre deux
  sessions.
- **Repli** — laisser l'utilisateur désigner le dossier. Le launcher expose
  « ouvrir le dossier de logs » dans Paramètres → Assistance.

Un client en cours d'exécution est la source la plus fiable, mais elle n'est
pas portable : sous Linux, `readlink /proc/<pid>/cwd` donne l'installation et
`/proc/<pid>/environ` donne `WAKFU_PREF_FILE_DIRECTORY` directement. Sous
Windows, lire l'environnement d'un autre processus demande des appels bien plus
intrusifs — et sortirait de la posture « lecture de fichiers seule » que le
projet revendique. À écarter.

## `wakfu.log` — les bornes du combat

Format : ` INFO HH:MM:SS,mmm [AWT-EventQueue-0] (<classe obfusquée>:<ligne>) - <message>`

### Début de combat — un événement par participant

```
 INFO 13:16:32,288 [AWT-EventQueue-0] (fbz:1399) - [_FL_] fightId=1552042365 Sac à patates breed : 2335 [-1706442044709728] isControlledByAI=true obstacleId : -1 join the fight at {Point3 : (0, -14, 0)}
 INFO 13:16:32,297 [AWT-EventQueue-0] (fbz:1399) - [_FL_] fightId=1552042365 Damdamisback breed : 19 [4768528] isControlledByAI=false obstacleId : -1 join the fight at {Point3 : (-2, -12, 0)}
```

Donne, pour chaque combattant : `fightId`, nom, `breed` (classe), un ID
d'entité unique entre crochets, `isControlledByAI` (sépare les persos joués
des monstres) et la position de départ.

C'est le **seul** endroit où l'on obtient le roster complet du combat.

### Fin de combat

```
 INFO 22:54:36,128 [AWT-EventQueue-0] (aWk:91) - [FIGHT] End fight with id 1552032575
```

Corrélé au `fightId` du début. Marqueur explicite et fiable.

⚠️ **`fightId` n'est pas monotone** : sur le log réel, `1616030353` (21:44:00)
précède `1584017389` (21:46:21). C'est un identifiant, pas un compteur — ne
jamais ordonner des combats par `fightId`, seul l'ordre des lignes fait foi.

### Ce que `wakfu.log` ne contient PAS

Aucun événement de tour. Les deux seuls tags structurés du fichier sont
`[_FL_]` (30 occurrences, uniquement les entrées en combat) et `[FIGHT]`
(uniquement « End fight »). **La piste « le canal `[_FL_]` contient
peut-être des événements de tour nommés » est un cul-de-sac.**

## `wakfu_chat.log` — le détail des tours

Format : `HH:MM:SS,mmm - [<Canal>] <message>` — attention, **pas de date**,
seulement une heure, et pas de crochet autour du timestamp.

Canaux observés, avec leur décompte sur l'échantillon : `[Information
(combat)]` (2331), `[Information (jeu)]` (422), `[Proximité]` (58),
`[<pseudo>]`, `[Privé]` (1), `[Messages d'erreur]` (1), `[Game Log]` (1).

Ces libellés sont **localisés** — voir « Les motifs se dérivent de l'i18n »
ci-dessous, qui explique aussi la présence d'un libellé anglais
(`[Game Log]`) dans un log de client français.

### Les motifs se dérivent de l'i18n

Les lignes du chat log sont rendues depuis les bundles i18n du client, qui sont
lisibles dans l'installation : `contents/i18n/i18n_<lang>.jar` est un simple zip
contenant `texts_<lang>.properties`, un fichier de propriétés de ~11 Mo.
Quatre langues seulement : `fr`, `en`, `es`, `pt`.

Les motifs du parser **ne s'écrivent donc pas à la main** : ils se génèrent
depuis ces clés. `tools/extract-i18n-patterns.sh <install>` fait l'extraction.

| Clé | Ce qu'elle donne |
|---|---|
| `fight.remaining.time.reported` | la frontière de tour |
| `fight.spellCast` | l'acteur du tour |
| `fight.ko`, `fight.die` | mise à mort, sortie de combat |
| `chat.pipeName.*` | les libellés de canaux |

Extrait, qui montre pourquoi une regex écrite à la main est fragile :

```
fr: fight.remaining.time.reported=[#1] seconde{[>1]?s:} reportée{[>1]?s:} pour le tour suivant.
en: fight.remaining.time.reported=[#1] second{[=1]?:s} carried over{[=1]?:} to the next turn.
fr: fight.spellCast=[#1] lance le sort [#2]
es: fight.spellCast=[#1] lanza el hechizo [#2].
fr: fight.ko=[#1] est KO !
es: fight.ko=¡[#1] está K.O.!
```

Trois pièges visibles ici :

- La pluralisation utilise un gabarit maison, `{[cond]?si-vrai:si-faux}`, et la
  condition elle-même change de langue en langue (`[>1]` en fr et pt, `[=1]`
  inversé en en et es).
- Le point final est présent dans certaines langues et absent dans d'autres.
- En espagnol, `¡` **précède** `[#1]` : supposer que le nom du personnage ouvre
  la ligne est faux.

Certaines clés portent aussi du balisage (`infoPop.xpGain` contient `<b>`,
`<text color="…">`) que le client retire avant d'écrire dans le chat log : la
génération des motifs doit dépouiller les balises et résoudre le gabarit de
pluralisation.

### Ne pas détecter la langue : chercher les quatre à la fois

La langue est un **argument de lancement** (`WAKFU_LANGUAGE`, premier argument
de `zaap-start.sh`, alimenté par `zaap.LANGUAGE`). Elle n'est persistée nulle
part dans `preferences/` — aucune clé de langue ni de locale dans
`userPreferences.properties` ni dans `clientConfig/`. Elle n'existe que dans
l'environnement du processus client (`WAKFU_LANGUAGE=fr` s'y lit bien, via
`/proc/<pid>/environ` sous Linux), ce qui n'est ni portable ni compatible avec
la posture « lecture de fichiers seule » du projet. Il n'existe donc pas de
moyen acceptable de la connaître.

Pire : le chat log **n'est pas purgé entre deux sessions**, et la langue peut
changer d'une session à l'autre. C'est exactement ce qu'on observe sur
l'échantillon — la toute première ligne du fichier est en anglais,

```
13:07:18,044 - [Game Log] It looks like I just reincarnated...
```

alors que les 422 lignes suivantes du même canal sont en français. La clé
concernée (`quest.rii.00.00`) est pourtant bien traduite en français : ce n'est
donc pas un repli sur l'anglais, mais bien un **premier lancement en anglais**
(défaut Steam, quelques minutes après l'installation) suivi d'un passage en
français.

Conséquence de conception : détecter la langue puis n'appliquer que la table
correspondante manquerait silencieusement les lignes des sessions antérieures.
Il n'y a que quatre langues — appliquer **l'union des quatre jeux de motifs**,
sans détection de langue. Les libellés ne se recouvrent pas d'une langue à
l'autre, donc l'union ne crée pas d'ambiguïté.

### Frontière de tour — non nommée, mais inconditionnelle

```
0 seconde reportée pour le tour suivant.
54 secondes reportées pour le tour suivant.
```

**Point critique, contraire à ce que supposaient les outils existants :** le
message est émis **même quand il ne reste aucun temps à reporter**. Sur
l'échantillon, `0 seconde reportée` apparaît **42 fois** sur ~92 frontières.
C'est donc un **tick de tour fiable**, pas un signal conditionnel.

Accorder le singulier et le pluriel : `seconde reportée` / `secondes reportées`.

**Mais ce n'est pas un tick de tour *global*.** Confirmé en multi-compte contre
un vrai monstre (Mama Wapin) : elle joue son tour, lance un sort, pousse une
cible — et **aucune ligne `reportée` n'apparaît**, ni pendant, ni à la fin de
son tour. Seuls les personnages contrôlés en émettent.

Les tours de monstres sont donc des **trous silencieux** : compter les
`reportée` ne suffit pas à savoir où on en est dans le round. Leur position
s'apprend avec l'ordre, au premier round.

### Lignes nommées

| Forme | Ce qu'elle donne |
|---|---|
| `<nom> lance le sort <sort>` (suffixe ` (Critiques)` possible) | l'acteur du tour |
| `<nom>: <valeur> <effet> (<source>)` | passifs de début et de fin de tour |
| `<nom>: <État> (+<N> Niv.) (<source>)` | application d'état |
| `<maître>: Invoque un(e) <invocation>` | apparition d'une invocation, nom parfois absent |
| `<nom>: <N> PV (<Élément>)` | dégâts et soins, y compris sur les monstres |
| `<nom> est KO !` | mise à mort d'un **personnage** |
| `<nom> est hors-combat !` | sortie de combat d'un **monstre** |
| `<nom>: Pose le Glyphe <nom>` | pose de glyphe |
| `<nom> : +<N> points d'XP.  Prochain niveau dans : <N>.` | fin de combat, côté chat |

Les monstres sont nommés eux aussi (`Sac à patates: 12 34 PV (Feu)`), donc le
log n'est pas filtré sur le seul joueur local.

Deux formes distinctes pour la mort, à ne pas confondre : les personnages
sortent sur `est KO !`, les monstres sur `est hors-combat !` (`Moogrron est
hors-combat !`, `Moomouche est hors-combat !` sur `1568041141`).

**Piège de canal.** `wakfu_chat.log` porte aussi des lignes qui **nomment les
personnages sans être des événements de combat** :

```
[Messages d'erreur] En attente de : PJ2, PJ1
```

Elle apparaît en pleine action, hors du canal `Information (combat)`. C'est la
justification concrète de la liste blanche de canaux : un parseur qui filtre en
liste noire la laisse passer et croit voir deux acteurs.

### Les invocations sont muettes

Vérifié sur un combat à deux invocations (#15, échantillon
`invoc-2026-08-20-*.log`) : un Gobgob et un Mulmouth Enragé ont joué **deux
tours entiers** entre deux frontières, sans en produire aucune. Une invocation
est donc un trou silencieux, exactement comme un monstre.

Elle émet en revanche sa propre ligne `[_FL_]` **au moment de l'invocation** —
donc une unité qui rejoint en cours de combat est détectable en temps réel :

```
20:36:16,379 [_FL_] … PJ1             breed : 6    obstacleId : -1 isControlledByAI=false
20:36:43,799 [_FL_] … Gobgob          breed : 1620 obstacleId : 1  isControlledByAI=true
20:36:50,107 [_FL_] … Mulmouth Enragé breed : 2367 obstacleId : 2  isControlledByAI=true
```

Deux surprises. D'abord **`isControlledByAI=true`**, alors que le joueur joue
ses invocations à la main : le client les traite comme non contrôlées, ce qui
explique leur silence. Le filtre `isControlledByAI=false` suffit donc à isoler
les personnages joués. Ensuite **`obstacleId` vaut `-1` pour toute unité du
début de combat, et un entier positif pour une invocation** — second
discriminant, indépendant du premier.

Leur ID d'entité est négatif et de la forme de celui d'un monstre, donc
vraisemblablement éphémère.

Attention : le lien vers le maître n'est **pas** fiable côté chat log. La
seconde invocation a été loggée `PJ2: Invoque une créature du Gobgob`, sans
jamais nommer « Mulmouth Enragé ». Seul `[_FL_]` donne le nom réel.

### Le motif d'un tour

```
13:28:11,144 - [Information (combat)] Damdamisback: 0 BQ (Génération naturelle)      <- fin de tour
13:28:11,145 - [Information (combat)] 0 seconde reportée pour le tour suivant.       <- frontière
13:28:13,187 - [Information (combat)] Damdamisback: 20 % Dommages infligés (Pétillance)  <- début du tour suivant
13:28:13,187 - [Information (combat)] Damdamisback: 20 % Coup critique
13:28:13,188 - [Information (combat)] Damdamisback: 1 PM (Agilité vitale)
```

Sur un échantillon solo, les deux côtés de la frontière portent le même nom :
impossible de trancher à qui appartient quoi. **Le multi-compte l'a tranché —
le passif qui suit la frontière nomme le personnage dont le tour vient de se
terminer, pas celui qui commence.** Les sorts servent d'ancre : ils précèdent
la frontière qui clôt leur propre tour.

```
18:46:33,484 - PJ1 lance le sort Capucine       <- PJ1 agit
18:46:34,429 - 0 seconde reportée               <- fin du tour de PJ1
18:46:34,590 - PJ1: 0 PW (Guerrier joueur)      <- son passif de fin de tour
18:46:38,120 - PJ2 lance le sort Déplumage      <- tour de PJ2
```

#### La première frontière du combat est un tour, pas la fin du placement

Tranché par le combat `1568041141`, avec un sort d'ancrage lancé dès le premier
tour de chaque personnage. **Aucune ligne `reportée` n'apparaît avant le premier
sort** :

```
20:17:49,770 - [_FL_] ... PJ2 join the fight      <- entrée en combat
20:17:51,000 - PJ1: Pioche (+10 Niv.)             <- rafale de début de combat
20:17:55,990 - PJ1 lance le sort Capucine         <- PJ1 agit : son tour a commencé
20:17:58,596 - 58 secondes reportées              <- PREMIÈRE frontière, après le sort
```

On ne peut pas lancer de sort pendant le placement : la première frontière suit
l'action, donc elle clôt un vrai tour. **La fin de la phase de placement n'émet
aucune ligne** — l'ouverture du combat se repère sur `[_FL_]`, pas sur une
frontière.

Confirmé par le comptage sur le même combat : **4 frontières pour PJ1 et 4 pour
PJ2**, soit exactement le nombre de tours terminés. Aucune frontière en trop.
Le 5e tour de PJ1 n'en a pas — le combat s'est terminé dedans, donc **le dernier
tour d'un combat n'a pas de frontière de fermeture**.

#### Le report de secondes est par personnage

Les huit frontières du combat forment **deux séries entrelacées**, chacune
croissant d'environ +30 s par tour (l'allocation d'un tour), moins le temps
réellement dépensé :

| | tour 1 | tour 2 | tour 3 | tour 4 |
|---|---|---|---|---|
| PJ1 | 58 | 89 | 120 | 142 |
| PJ2 | 61 | 94 | 114 | 148 |

Lu comme un compteur global, l'enchaînement (58, 61, 89, 94, 120, 114, 142, 148)
donne des sauts incohérents. Lu comme deux banques personnelles, tout s'aligne.

Ça donne un **second canal d'attribution**, indépendant des passifs — dont la
réserve ci-dessus dit qu'ils ne sont pas garantis. Il est faible : non injectif
(tout le monde lit `0` en brûlant son timer), et remis à plat dès qu'un
personnage dépense du temps. Mais un **retour en arrière de la valeur** signale
de façon nette que la frontière appartient à un autre personnage.

#### Les tours de monstres n'ont pas besoin d'être observés

L'ordre d'initiative relevé sur `1568041141` entrelace monstres et personnages —
`PJ1, Moomouche, PJ2, Moomouche, Moogrron, Moogrron` — donc jusqu'à **trois tours
de monstres consécutifs** entre deux frontières. Et deux monstres homonymes
adjacents dans l'ordre sont **indiscernables** dans `wakfu_chat.log`, qui ne
porte pas les ids d'entité.

Ça n'a pas d'importance : l'overlay ne pilote que les personnages contrôlés, et
**chacun d'eux ferme son tour par une frontière**. Le suivi n'a donc jamais à
compter les tours de monstres. Les trous silencieux sont inoffensifs, et le
**numéro de tour d'un personnage vaut le nombre de ses propres frontières + 1**.

Conséquence forte : **la frontière reste attribuable même quand le personnage
ne fait rien**. Sur l'échantillon duo, 10 tours sur 12 se sont joués sans
aucune action et sont restés nommés par ce seul passif. Réserve : ces passifs
dépendent du build et de l'équipement, on ne peut pas garantir que tout
personnage en émette.

## Multi-compte : un seul fichier, tout en double

Vérifié par le test multi-compte (#3), deux clients lancés depuis la même
installation, un combat à 5 combattants.

Les deux clients écrivent dans **les mêmes fichiers** et y dupliquent
**chaque** événement — les frontières de tour comme les lignes nommées. Le
combat observé produit 10 lignes `[_FL_]` pour 5 combattants, et 8 lignes
`reportée` pour 4 frontières.

> ⚠️ **Aucune fenêtre temporelle fixe ne déduplique correctement.** Les
> premiers échantillons donnaient un écart de **4 à 106 ms** entre les deux
> copies, d'où la conclusion — désormais **fausse** — que la fenêtre de 500 ms
> de WakSOS avait de la marge. Le combat `1568041141` la casse : sur 56 paires
> strictes, 53 tiennent sous 500 ms mais **3 sont à 1436-1477 ms**. Le retard
> d'un client s'accumule sur une rafale d'animations puis se résorbe — mesuré
> à ~1,45 s pendant six lignes consécutives, puis 49 ms sur le sort suivant du
> même tour. Comme le tour réel le plus court mesuré est à **1169 ms**, l'écart
> entre copies **recouvre désormais la durée d'un vrai tour** : la proximité
> temporelle ne suffit plus à distinguer un doublon d'une répétition réelle.
>
> La forme du fichier suggère la sortie : c'est l'**entrelacement de deux
> copies d'une même séquence**. Le problème est un alignement de séquences, pas
> un fenêtrage. Reste à trancher — voir le ticket dédié.

**La déduplication ne peut pas se faire sur le texte de la ligne**, pour deux
raisons distinctes :

- Les deux copies d'une même frontière **ne portent pas la même valeur** :
  chaque client rapporte son propre compteur de temps. Observé : `55 secondes`
  puis `54 secondes` 18 ms plus tard ; `81` puis `80` à 16 ms ; `65` puis `63`
  à 63 ms.
- À l'inverse, une même ligne nommée peut légitimement se répéter dans un
  combat (`PJ2 lance le sort Capucine` apparaît 4 fois = 2 occurrences réelles
  × 2 clients).

Seule la proximité temporelle permet de trancher.

### Le nom n'est pas un identifiant

Le combat observé comptait **deux monstres portant le même nom**,
`Epouvantrotot`, distingués uniquement par leur ID d'entité
(`-1724034229493566` et `-1724034229493567`).

`wakfu.log` porte cet ID dans les lignes `[_FL_]`, donc le roster est sans
ambiguïté. Mais **`wakfu_chat.log` ne porte que le nom** : deux monstres
homonymes y sont indistinguables. Limite dure, à assumer.

Elle est heureusement bénigne pour le produit : on n'a besoin de suivre
précisément que les personnages joués, dont les noms sont uniques dans une
équipe. Les tours des monstres ne servent qu'à savoir que ce n'est pas encore
le tour du joueur.

### L'ID d'entité d'un personnage joué est stable

Mesuré sur le `wakfu.log` réel : **10 combats, 4 personnages joués, 4
lancements de client**, aucune dérive.

| Personnage | `breed` | ID d'entité | Combats |
|---|---|---|---|
| Damdam | 6 | `11379827` | 7 |
| Damdamosa | 2 | `10756279` | 7 |
| Damdamnesique | 3 | `10910227` | 2 |
| Madamedame | 7 | `10662067` | 2 |

Les lignes `log path=` bornent les lancements du client (lignes 31, 453, 3727,
4248) : Damdam et Damdamosa jouent dans le 2ᵉ **et** dans le 4ᵉ, avec les mêmes
ID — la stabilité traverse donc les redémarrages du client, et pas seulement
une session. Les quatre ID sont distincts et tiennent dans une bande étroite
(10 662 067 → 11 379 827), très probablement l'ID de personnage côté serveur —
à l'opposé des ID de monstres, négatifs et énormes. **Non testé** : la
persistance après réinstallation du client.

### La table des `breed` vient du jeu, et n'est pas l'ordre des classes

`i18n_fr.jar` porte la correspondance sous les clés `breed.<id>`, ce qui rend
inutile toute supposition :

| `breed` | Classe | | `breed` | Classe |
|---|---|---|---|---|
| 1 | Féca | | 11 | Sacrieur |
| 2 | Osamodas | | 12 | Pandawa |
| 3 | Enutrof | | 13 | Roublard |
| 4 | Sram | | 14 | Zobal |
| 5 | Xélor | | 15 | **Ouginak** |
| 6 | Ecaflip | | 16 | **Steamer** |
| 7 | Eniripsa | | 17 | *Désincarné* |
| 8 | Iop | | 18 | **Eliotrope** |
| 9 | Crâ | | 19 | **Huppermage** |
| 10 | Sadida | | | |

Deux pièges. D'abord `breed.17 = Désincarné`, qui n'est pas une classe jouable :
les 18 classes sont donc `1..16`, `18` et `19` — la numérotation a **un trou**,
et il n'existe pas de `breed` 20. Ensuite l'ordre **n'est pas** celui de l'écran
de sélection de classe, où Ouginak arrive en dernier : dans le jeu Ouginak est
15 et Huppermage 19. En dériver l'un de l'autre par arithmétique donne quatre
portraits faux ; la table est explicite ou elle est fausse.

La table se recopie à la main, elle ne se génère pas : dix-huit lignes, et la
génération obligerait à interpréter la syntaxe de genre du jeu
(`breed.11=Sacrieu{[1*]?se:r}`) pour rien. C'est l'inverse du choix fait pour
les motifs de combat, qui sont des centaines sur quatre langues.

Les valeurs observées corroborent la table : les personnages joués sont à
`2`, `3`, `6`, `7` et `19` — `Damdamosa` est bien un Osamodas, `Damdam` un
Ecaflip — là où les monstres et les invocations sont à quatre chiffres
(`1381`, `1620`, `2335`, `4755`…). Un `breed` supérieur à 19 sur une ligne
`isControlledByAI=false` n'a jamais été observé.

Enfin, **la classe ne change pas quand un personnage tombe** : aucun
`breed : 17` n'apparaît dans les captures, y compris celle qui contient une
résurrection.

## Algorithme de suivi du tour

**Les monstres n'émettent aucune ligne `reportée`.** Confirmé formellement — la
fenêtre suivante contient deux tours de monstres complets, entre deux
frontières, sans produire de frontière :

```
19:11:29,487 - 59 secondes reportées pour le tour suivant.     <- fin du tour de PJ1
19:11:30,337 - Epouvantrotot lance le sort Frappe Souterraine  <- tour d'un monstre
19:11:31,985 - Epouvantrotard lance le sort Frappe Souterraine <- tour d'un autre
19:11:33,176 - Epouvantrotard lance le sort Toupipierre
19:11:41,060 - PJ2 lance le sort Trèfle                        <- tour d'un PJ
19:11:45,565 - PJ2 lance le sort Feulement (Critiques)
19:11:47,463 - 81 secondes reportées pour le tour suivant.     <- fin du tour de PJ2
```

**Conséquence : compter les frontières ne compte pas les tours.** Une frontière
marque la fin du tour d'un **personnage joué**, rien de plus. Le suivi ne peut
donc pas être un simple compteur — c'est ce que supposait la version
précédente de ce document, et c'est faux.

L'algorithme retenu :

1. `[_FL_]` au début du combat → roster complet, avec l'ID d'entité et
   `isControlledByAI=false` pour isoler l'équipe du joueur.
2. Dédupliquer le flux sur une fenêtre de 500 ms (voir plus haut) : sans ça,
   tout est compté deux fois en multi-compte.
3. Segmenter sur les **lignes nommées**, pas sur les frontières. Chaque
   changement de nom dans la suite des lignes nommées est un changement de tour.
4. Les frontières `reportée` restent un signal fiable et inconditionnel de
   **fin de tour d'un personnage joué** — utile pour confirmer la segmentation
   et pour détecter le tour d'un PJ qui n'a rien fait de loggable.
5. L'ordre des tours est **figé au démarrage du combat** (règle de jeu Wakfu,
   source : wiki). À la fin du round 1 l'ordre est donc connu, et le suivi
   devient prédictif à partir du round 2.
6. Pour du farm de donjon à équipe constante, mettre l'ordre en cache par
   (donjon, équipe) rend le suivi prédictif dès le round 1 des runs suivantes.

### Points de rupture connus

- Un combattant qui ne fait **rien de loggable** pendant son tour (déplacement
  seul, tour passé) est invisible. Pour un personnage joué, la frontière
  `reportée` le rattrape. Pour un **monstre**, rien ne le rattrape : son tour
  ne laisse aucune trace. L'ordre appris peut donc comporter des trous côté
  monstres. Sur l'échantillon, 3 monstres étaient au roster et seuls 2 ont agi.
- Deux monstres homonymes sont indistinguables dans le chat log (voir plus
  haut).
- Les invocations et les résurrections sont insérées dans l'ordre des tours
  juste après l'unité courante (règle de jeu) : elles décalent la rotation.
- L'initiative n'apparaît nulle part dans les logs : impossible de déduire
  l'ordre sans observer un round complet.

## Conformité

Lecture d'un fichier de log local, en lecture seule. Aucune lecture mémoire,
aucune injection, aucun hook, aucun input synthétique, aucun trafic réseau
intercepté. Les articles 5.2.1 (reverse engineering), 5.2.5 (automatisation)
et 5.2.6 (interception de protocole) des CGU Wakfu ne sont pas concernés.
C'est la position que revendique explicitement Wakfu-Companion.
