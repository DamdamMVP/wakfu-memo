# Relire le log au lancement n'est pas lire l'historique

Au démarrage, l'app **relit `wakfu.log` depuis le dernier `log path=`** — la
borne du lancement de client en cours — et y rejoue les transitions. Si elle y
trouve un `fightId` porteur d'une rafale `[_FL_]` et d'**aucun**
`[FIGHT] End fight`, un combat est en cours : elle le **rejoue depuis son
début** — roster, Liaison, Emplacements inactifs, Tour courant — et l'overlay
reprend le combat en marche comme si elle l'avait vu commencer.

⚠️ La borne n'est pas un détail d'optimisation, c'est ce qui rend la règle
correcte. « Le dernier `[_FL_]` sans `End fight` » prise seule produit un **faux
positif**, démontré sur les logs réels : le combat `1552042367` a sa rafale
`[_FL_]`, 145 lignes de combat et 18 minutes de tours, puis **ni `End fight` ni
`NetInFight Removed`**, parce que le client a été fermé combat en cours — il
resterait déclaré « en cours » pendant les **4 h 39** suivantes. Un combat ouvert
avant le dernier démarrage du client n'est jamais en cours. En renfort, un
**marqueur d'arrêt** postérieur au dernier `[_FL_]` ouvert le ferme aussi :
`Sending DisconnectionMessage to Servers. Reason : {UI Closed}`,
`Stopping cGz...`.

Ça ressemble à ce que #17 a refusé. La décision y était nette, et elle tient :
l'onboarding ne parse **pas** l'historique des logs pour constituer le Roster,
alors que `wakfu.log` accumule quatre lancements et dix combats et le permettrait
sans peine. Un lecteur qui tombe sur les deux décisions côte à côte va croire à
un revirement.

Ce n'en est pas un, et la distinction est la raison d'être de cet ADR : **on
reconstruit un état vivant, on n'exhume pas un passé.** Le combat en cours n'est
pas de l'histoire, c'est ce qui se passe à l'écran de l'utilisateur pendant qu'il
lance l'app. Le passé, lui, reste hors de portée : rien n'est appris des combats
terminés, aucun Personnage n'est déduit d'un roster d'hier, et le rattrapage
n'écrit rien sur disque qu'un combat observé en direct n'aurait écrit.

Le besoin vient d'ailleurs de #17 lui-même. En décidant que la V1 n'a **aucune
vie en arrière-plan** — application normale, la fermer ferme tout, pas de zone de
notification — il a rendu le **démarrage en plein combat courant** au lieu de
marginal. Et l'ADR `0006` a retiré le seul filet imaginable : sans correction
manuelle du numéro de Tour et sans vocabulaire pour le doute, un accrochage à
chaud approximatif n'a nulle part où avouer son approximation. Il restait donc
deux options honnêtes : perdre le combat en cours, ou le reconstruire
exactement. La seconde s'est révélée bon marché — le `fightId` est porté par
`[_FL_]` **et** par `End fight`, donc un combat a une identité et pas seulement
des bornes ; et `wakfu.log` mesure 1,47 Mo pour quatre lancements, dont le
dernier `log path=` ne laisse qu'une fraction à relire. Ni lecture par blocs à
l'envers, ni plafond arbitraire.

## Conséquences

- **Le rattrapage a le droit d'échouer, jamais d'approximer.** Si aucun combat
  ouvert ne se reconstruit — rafale `[_FL_]` absente, roster incomplet — l'overlay
  reste dans son état hors combat, indistinguable de « pas de combat ». Pas de
  position devinée, pas d'aveu : les deux sont interdits par l'ADR `0006`.
- Un combat rattrapé arrive **après la phase de placement**. La Liaison y est
  donc **provisoire** — un Conflit tranché par le **Rang le plus bas** — et
  l'**échange par clic** devient le seul correctif disponible, ce qui le promeut
  de confort à mécanisme nécessaire.
- La limite est de **portée, pas de moyen** : l'app sait désormais relire un log
  ancien, et plus rien ne l'en empêche techniquement. Ce qui interdit d'en
  déduire un Roster est une décision de produit (#17), à rouvrir explicitement si
  elle change — pas une impossibilité à laquelle s'abriter.
- ⚠️ **La corrélation entre `wakfu.log` et `wakfu_chat.log` n'existe pas**, et le
  report que cet ADR faisait sur #9 est **éteint plutôt que résolu** : les
  Frontières de tour sont dans `wakfu.log` aussi, le logger de chat étant additif
  (85 = 85 sur les frontières, 1115 = 1115 sur le canal combat). L'app ne lit
  qu'un fichier — ADR `0008` — donc il n'y a ni horodatage croisé, ni **passage de
  minuit**, ni question du chat log non purgé entre sessions. Les trois cas
  tordus que cet ADR annonçait ont disparu avec le second fichier.
- Un combat **relancé** avec le client (client fermé puis rouvert pendant le même
  combat) n'est **pas** couvert, et ce choix est maintenant délibéré : le cas
  suppose une fenêtre de jeu fermée en plein combat.
  ⚠️ **Les deux affirmations que ce point portait sont fausses**, mesurées le
  22 août 2026 (combat `1552052503`, deux clients — voir « Points de rupture
  connus » de la grammaire). Un combat rejoint **réémet** bien une rafale
  `[_FL_]`, donc le trou n'est plus un inconnu. Et le comportement observé n'est
  **pas** « l'overlay reste hors combat » : le nouveau `log path=` du client
  relancé déplace la borne de session après l'ouverture du combat, et le suivi
  repart avec `k` retombé de 2 à 1 — il **approxime** au lieu d'échouer, ce que
  le premier point de ces conséquences interdit. Le cas est écarté du périmètre,
  pas résolu.
