# `wakfu.log` est le seul fichier lu

L'app ne lit qu'un fichier : **`wakfu.log`**. Elle n'ouvre jamais
`wakfu_chat.log`, qui en est un **sous-ensemble strict**.

Le réflexe inverse est fort — c'est le fichier de chat qui porte le détail des
tours, et tous les outils tiers le lisent. Mais `log4j.properties` déclare
`log4j.rootLogger=INFO, stdout, mainLog, Sentry` et `log4j.logger.chat=INFO,
chat` **sans `log4j.additivity.chat=false`** : seuls `LUA`, `animation`,
`camera`, `fileLoadingLogger` et `theme` portent ce drapeau. Le logger de chat
est donc **additif**, et tout ce qu'il écrit part aussi dans `mainLog`. Vérifié
canal par canal sur les logs réels : 1115 lignes `[Information (combat)]` dans
les deux fichiers, 85 frontières de tour, 212 `lance le sort`, 8 `est KO !`,
346 `[Communauté (FR)]`.

Ce qui tranche n'est pas l'économie d'un lecteur, c'est l'**absence de date**.
Ni l'un ni l'autre fichier n'en porte : `INFO HH:MM:SS,mmm` d'un côté,
`HH:MM:SS,mmm` de l'autre. Lire les deux aurait demandé de fusionner deux flux
sans date commune — donc d'inventer les dates et de gérer le passage de minuit —
alors que le roster (`[_FL_]`) et la fin de combat (`[FIGHT] End fight`) ne sont
que dans `wakfu.log` et le détail des tours dans les deux. Un seul fichier, et
l'**ordre des octets fait foi** : les heures ne servent plus jamais à ordonner
quoi que ce soit.

## Conséquences

- Le départage entre les deux installations décidé en #4 (« prendre le fichier
  le plus récemment modifié », les modes Steam et launcher pouvant coexister) se
  lit désormais sur **`wakfu.log`**, plus sur `wakfu_chat.log`.
- Le parseur applique une **liste blanche de canaux** sur les lignes de chat
  qu'il trouve dans `wakfu.log`, exactement comme il l'aurait fait sur le fichier
  de chat. Le fichier étant bien plus bavard, la liste blanche cesse d'être une
  précaution et devient structurelle.
- Prix assumé : `wakfu.log` est 7× plus gros (17 229 lignes contre ~2 500) et il
  **tourne** — `wakfu.log.1` et `.log.2` existent, à ~1,05 Mo. `wakfu_chat.log`,
  5× plus petit, aurait gardé bien plus d'historique. Sans conséquence, puisque
  #17 a décidé de ne **pas** lire l'historique : seule compte la session de
  client en cours, bornée par le dernier `log path=`.
- ⚠️ **Fait démenti le 22 août 2026** : il était écrit ici que « la rotation joue
  côté Steam et pas côté launcher ». C'est faux. Voir l'amendement ci-dessous.
- **Corrige l'ADR `0007`**, qui posait la corrélation horodatée entre les deux
  fichiers comme un travail restant, avec le passage de minuit et le chat log non
  purgé comme cas tordus. Ces trois problèmes n'existent pas : il n'y a qu'un
  fichier.


## Amendement du 22 août 2026 — `wakfu.log` n'est pas *le* fichier, c'est *un nom*

**Un seul fichier est lu à la fois. Ce n'est plus forcément celui qui s'appelle
`wakfu.log`.**

Le principe ne bouge pas : on lit **un** fichier, l'ordre des octets fait foi, et
on ne fusionne jamais deux flux — c'est tout ce que cet ADR défendait. Ce qui
tombe, c'est l'idée que le nom `wakfu.log` désigne le fichier vivant.

### Ce qui a été mesuré

Sur la machine de l'auteur, en multi-compte, dans
`~/.config/zaap/gamesLogs/wakfu/logs/` :

| fichier | dernière écriture | démarrages de client | combats |
|---|---|---|---|
| `wakfu.log` | 21:59:28 | 0 | 1 |
| `wakfu.log.1` | **21:59:29** | 0 | 3 |
| `wakfu.log.2` | 21:36:44 | 5 | 12 |

Trois faits, et chacun contredit une phrase de l'ADR :

1. **La rotation joue côté launcher.** Le fait « brut non expliqué » ci-dessus
   est démenti : c'est précisément l'installation launcher qui a produit ces
   trois fichiers.
2. **Deux fichiers sont vivants en même temps**, à une seconde d'écart, chacun
   tenu par un client. Le nom `wakfu.log` ne veut donc pas dire « le fichier
   courant », il veut dire « le premier pris ».
3. **Chaque fichier vivant porte le combat en entier.** Vérifié en faisant lire
   le même combat depuis les deux : `k`, nombre de frontières, Tour courant et
   Liaison **identiques**. Il n'y a donc rien à fusionner — le principe de l'ADR
   tient sans une ligne de plus.

### Le bogue que ça produisait

Un combat commencé à `21:36:34`, un `wakfu.log` créé à `21:36:45` : la rafale
`[_FL_]` du combat était partie dans le fichier voisin. L'app suivait le bon
dossier, le bon nom, et **ne voyait aucun combat** — fiche au Tour 1, aucune Mise
en avant, pour toute la durée du donjon. Muette, comme l'ADR `0006` l'exige, donc
sans le moindre indice de ce qui n'allait pas.

### La règle retenue

Dans le dossier retenu, parmi `wakfu.log` et ses tournés :

1. **Seuls les fichiers qu'on écrit encore sont candidats.**
2. **Parmi eux, celui qui porte un combat ouvert gagne.**
3. **Sinon, le plus frais** — c'est là que le prochain combat s'écrira.

Et la question n'est **reposée que hors combat**. Changer de fichier relit le
nouveau depuis son premier octet, donc aucun tour n'est jamais compté deux fois ;
mais un fichier créé en plein combat ne porte pas ce combat, et y basculer
retirerait la Mise en avant au milieu d'un pull.

⚠️ **Pourquoi le point 1 n'est pas une précaution mais une nécessité** : un
fichier tourné coupé en plein combat déclare ce combat ouvert **pour toujours** —
sa fin de combat est partie dans le fichier qui a pris la suite. Mesuré :
`wakfu.log.2`, muet depuis douze minutes, désignait encore le combat `1552058722`
comme en cours. Sans la fraîcheur, la règle du point 2 aurait élu ce fantôme.

### Le prix

- **Un seuil arbitraire**, le seul du module : un fichier est « vivant » s'il a
  moins de deux minutes de retard sur le plus frais. Mesuré à l'instant du
  bogue : les deux vivants étaient à la **même seconde**, le mort à douze
  minutes. Un client qui tourne écrit infiniment plus souvent que ça.
- **Une lecture périodique hors combat**, toutes les cinq secondes. Elle
  n'atteint que les fichiers vivants, les gros tournés étant écartés sur leur
  date, sans être ouverts.
- **Le départage entre installations** se lit désormais sur le fichier de log le
  plus frais du dossier, et non plus sur le seul `wakfu.log` : une installation
  dont le fichier courant est `wakfu.log.1` n'est plus invisible.
