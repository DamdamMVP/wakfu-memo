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
- Fait brut non expliqué, à garder en tête : la rotation joue côté Steam et pas
  côté launcher, à `log4j.properties` identique. Ne pas s'appuyer sur
  l'existence des fichiers tournés, ni sur leur absence.
- **Corrige l'ADR `0007`**, qui posait la corrélation horodatée entre les deux
  fichiers comme un travail restant, avec le passage de minuit et le chat log non
  purgé comme cas tordus. Ces trois problèmes n'existent pas : il n'y a qu'un
  fichier.
