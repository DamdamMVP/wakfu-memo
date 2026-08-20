# wakfu-memo

Utilitaire Wakfu pour le farm de donjon : un overlay qui affiche, tour par
tour, ce que chaque personnage doit faire — en remplacement des documents
partagés que les joueurs tiennent à la main aujourd'hui.

L'état du combat est déduit en lisant les fichiers de log locaux du client
Wakfu, **en lecture seule**. Aucune lecture mémoire, aucune injection, aucun
input synthétique.

## Où est le projet

La spec V1 se construit dans les [issues](../../issues) : la
[carte](../../issues/1) indexe les décisions prises et pointe sur le ticket qui
porte chacune. Le vocabulaire du domaine vit dans [`CONTEXT.md`](CONTEXT.md),
les décisions structurantes dans [`docs/adr/`](docs/adr/), et ce qu'on a appris
des logs réels dans
[`docs/research/wakfu-log-grammar.md`](docs/research/wakfu-log-grammar.md).

## Captures de logs

`docs/research/samples/` contient des extraits de vraies sessions de jeu, sur
lesquels les décisions de suivi de combat sont vérifiées. Ils sont produits par
`tools/capture-multi-account.sh`, qui remplace les noms de personnages joués
par `PJ1`, `PJ2`…, tronque les ID d'entité, et **ne garde que les canaux
`Information`** — le chat log n'est pas purgé entre sessions et charrie sinon
les messages publics d'autres joueurs.

Une capture brute ne doit jamais être commitée telle quelle.
