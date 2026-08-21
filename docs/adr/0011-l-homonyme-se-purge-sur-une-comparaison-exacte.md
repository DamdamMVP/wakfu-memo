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

## Amendement — l'exemple est mort, la règle est renforcée (#22)

Un nom Wakfu n'a **qu'une orthographe possible** : le jeu n'accepte que les
lettres, le tiret et l'apostrophe, interdit les accents, et **force** la
majuscule en tête et après chaque séparateur (voir la section « La forme d'un nom
de personnage » du document de grammaire). L'app **canonise donc à la saisie**, et
le log est canonique par construction.

Ça **tue le cas d'école ci-dessus** : `Nozahéal` n'est plus saisissable, et ne
peut donc plus coexister avec `Nozaheal`. Mais ça **renforce la règle** au lieu de
l'affaiblir — les deux côtés de la comparaison étant canoniques, « même chaîne
exactement » reste un fait, et il n'y a plus rien à arbitrer. Le rapprochement
tolérant qui était refusé ici n'est pas devenu acceptable : il a cessé d'être
nécessaire.

Ce qui reste au **rattachement** de #16, et qui justifie qu'il survive : la vraie
faute de frappe, celle qu'aucune canonisation ne répare — `Nozahael` contre
`Nozaheal`, une lettre à la place d'une autre. Le filet de #17 tient donc, il ne
sert plus qu'à ça.

⚠️ Et un corollaire à la saisie : deux Personnages **sans** ID d'entité ne peuvent
plus porter le même nom canonique, puisque ce nom appartient à un seul personnage
du serveur. Le doublon se voit donc **à la saisie** — le champ le dit et refuse —
au lieu de fabriquer une ambiguïté à résoudre au moment du combat.

## Conséquences

- La purge est une **suppression silencieuse d'une saisie utilisateur**, là où
  #11 voulait des suppressions au geste avec confirmation. C'est une exception
  assumée : ce qui part est un doublon mort, jamais un Personnage vivant.
- Une **Préférence de liaison** qui désignait le Personnage purgé part avec lui.
- La règle n'a rien à voir avec le **Personnage ignoré**, qui est retenu par ID
  d'entité et jamais par son nom.
