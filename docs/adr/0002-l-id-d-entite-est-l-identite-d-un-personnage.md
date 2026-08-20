# L'ID d'entité est l'identité d'un Personnage

Un Personnage du Roster est identifié par l'**ID d'entité** que `[_FL_]` donne
à chaque combattant, et non par son nom : le nom en jeu et la classe sont des
attributs dérivés du log, et un renommage ne casse rien. Le nom ne sert que de
repli, pour rattacher un Personnage saisi à la main qui n'a pas encore d'ID.
C'est aussi sur l'ID qu'un **Personnage ignoré** est retenu, pour ne jamais
reproposer un combattant refusé.

Le réflexe inverse — indexer sur le nom — est tentant parce que `wakfu_chat.log`
ne porte que des noms, donc tout le suivi de tour se fait par nom de toute
façon. On l'a écarté sur mesures : le nom **n'est pas un identifiant** (deux
monstres homonymes dans un même combat, séparables seulement par l'ID), il est
saisi à la main donc fautif (accent, majuscule, coquille), et il change à un
renommage. L'ID, lui, s'est révélé **stable sur 10 combats, 4 personnages et 4
redémarrages du client**, dans une bande de valeurs qui ressemble à un ID de
personnage côté serveur.

## Conséquences

- La liaison Personnage → Emplacement se calcule **par ID**, jamais par nom, et
  n'est donc jamais ambiguë : le seul Conflit qui reste est l'attribution de
  rôle entre deux Personnages de même classe.
- Un Personnage saisi à la main vit **sans ID** jusqu'au premier combat où son
  nom correspond, moment où l'ID s'y colle silencieusement. Un nom mal tapé ne
  se rattache jamais et se rattrape dans la Demande d'ajout, qui propose de
  rattacher le combattant inconnu à un Personnage sans ID.
- Réserve assumée : la persistance de l'ID après **réinstallation du client**
  n'est pas prouvée. La casse est bénigne — un ID inconnu retombe sur la
  Demande d'ajout, et l'utilisateur rattache.
