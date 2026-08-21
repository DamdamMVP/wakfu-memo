# L'homonyme se purge sur une comparaison exacte

Quand un ID d'entité s'attache à un Personnage, tout autre Personnage **sans ID
d'entité** portant **exactement** le même nom est supprimé du Roster : son
pseudo est pris ailleurs, il ne s'attachera plus jamais à rien. La comparaison
est faite **caractère pour caractère**, accents compris.

C'est délibérément le contraire de ce qu'un lecteur pressé corrigerait. Un
rapprochement tolérant — insensible aux accents, à la casse, ou par distance
d'édition — paraît plus serviable et **détruit le seul filet que le produit
possède contre la coquille de saisie**. Le cas est celui de #16 : le log annonce
`Nozaheal`, le Roster contient un `Nozahéal` tapé à la main. Ces deux-là *sont*
la même personne, et c'est précisément pourquoi il ne faut pas les rapprocher
tout seul — la Demande d'ajout propose le **rattachement** en tête de liste, au
seul moment où le nom tapé et le nom réel sont côte à côte sous les yeux du
joueur. Un rapprochement automatique ferait disparaître `Nozahéal` en silence
et le rattachement n'aurait plus rien à rattraper.

La règle n'est donc pas « même personne » mais « **même chaîne exactement** ».
Deux chaînes identiques ne sont pas un jugement, elles sont un fait ; toute
tolérance est un jugement, et ce jugement appartient au joueur.

## Conséquences

- La purge est une **suppression silencieuse d'une saisie utilisateur**, là où
  #11 voulait des suppressions au geste avec confirmation. C'est une exception
  assumée : ce qui part est un doublon mort, jamais un Personnage vivant.
- Une **Préférence de liaison** qui désignait le Personnage purgé part avec lui.
- La règle n'a rien à voir avec le **Personnage ignoré**, qui est retenu par ID
  d'entité et jamais par son nom.
