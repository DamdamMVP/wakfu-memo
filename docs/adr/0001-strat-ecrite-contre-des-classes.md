# Une strat est écrite contre des classes, pas contre des personnages

Une Strat déclare jusqu'à 6 **Emplacements** — une classe plus un libellé de
rôle libre — et ses Consignes appartiennent à l'Emplacement. Les Personnages du
Roster y sont liés à chaque combat, jamais stockés dedans.

Le réflexe naturel est l'inverse : on écrit une strat pour son équipe, donc on
attache la consigne au personnage. C'est plus direct, et ça évite la couche de
liaison entière. On l'a écarté pour deux raisons. D'abord une strat class-keyed
est **lisible par quelqu'un d'autre** — « l'Osa invoque au tour 2 » se comprend
sans connaître mes pseudos — ce qui est la condition du partage de strat par
code, souhaité et reporté après la V1. Ensuite la liaison ne coûte presque
rien : `[_FL_]` donne à chaque début de combat le nom, la classe et l'ID
d'entité de chaque combattant, donc l'appariement se calcule tout seul, et les
seuls cas qui demandent un humain sont les Conflits — un ID inconnu, ou deux
Emplacements de même classe.

## Conséquences

- Le Roster et les Strats sont **découplés** : ajouter un personnage ne touche
  aucune strat, et une strat survit à un changement d'équipe.
- La couche de Liaison doit exister, avec sa demande en phase de placement et
  son échange par clic. C'est le prix payé, et il est visible par
  l'utilisateur.
- Une Strat dont la composition en classes ne correspond pas au combat n'est
  pas une erreur : les Emplacements absents s'affichent grisés.
