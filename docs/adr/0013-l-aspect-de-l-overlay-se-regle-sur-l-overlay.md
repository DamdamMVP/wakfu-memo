# L'aspect de l'Overlay se règle sur l'Overlay

Quatre réglages décident de l'aspect de l'Overlay : son **opacité**, sa **taille
de texte**, la **largeur** de sa fiche et sa **position**. Deux d'entre eux
étaient déjà des gestes à la souris sur l'objet lui-même — #5 a gelé que la
largeur s'attrape au **bord droit** de la fiche, et une fenêtre se place en la
déplaçant. Les mettre aussi en curseurs sur l'écran des Réglages donnait deux
chemins pour une même valeur, dont un moins bon.

Les deux autres ont un défaut symétrique : l'**opacité ne se juge que contre les
pixels qu'elle laisse passer**, et la taille du texte contre la distance à
laquelle on lit en combat. Un curseur dans une fenêtre, devant un aperçu dessiné
par l'app, ne dit ni l'un ni l'autre.

D'où la décision : **l'écran des Réglages ne porte aucun contrôle de l'aspect de
l'Overlay.** Il porte une **porte** — un bouton qui déverrouille l'Overlay
par-dessus le jeu, avec une barrette qui tient l'opacité et la taille du texte
pendant le réglage. La position et la largeur restent les deux gestes de #5. On
règle en regardant le résultat, sur le vrai décor.

Décidé en maquettant la surface des Réglages (#23), en comparant trois formes :
une page unique avec un aperçu collant, trois sous-écrans dépliés dans la
colonne latérale, et cette porte. Les deux premières partageaient le défaut
qu'elles étaient censées corriger — elles dupliquaient les curseurs, et leur
aperçu était un spécimen sur un décor factice.

**Wakfu fermé, la porte le dit** et propose le même aller-retour sur un décor
factice, nommé comme tel. C'est l'ADR `0012` appliqué : la Fenêtre principale
est l'endroit qui explique, y compris pour dire qu'elle ne peut pas montrer.

## Amendement — la porte ouvre toujours, et la poignée se montre (#32)

En écrivant l'écran, la décision s'est cassée sur un cas qu'aucune des trois
maquettes ne jouait : **le premier lancement**. Wakfu n'est pas lancé, aucune
Strat n'existe, et c'est précisément le moment où on ouvre les Réglages. La porte
telle qu'elle est décrite ci-dessus ne s'ouvrait alors sur rien — donc l'opacité
et la taille du texte étaient **irréglables**, et un écran de réglages qui refuse
de régler tant que le jeu n'est pas lancé n'est pas un écran de réglages.

**La porte n'a donc plus qu'un visage : elle ouvre le décor factice, toujours.**
Elle ne déverrouille plus l'Overlay. Ce qui reste vrai, et qu'elle **dit** avec
la vraie combinaison du verrou : l'Overlay déverrouillé porte la **même
barrette**, les deux mêmes curseurs, et c'est là — et seulement là — que
l'opacité se juge contre les pixels qu'elle laisse passer. Le jeu reste le
meilleur juge ; il a cessé d'être le seul accès.

Ça tue deux phrases ci-dessus : « un bouton qui déverrouille l'Overlay par-dessus
le jeu », et « Wakfu fermé, la porte le dit et propose le même aller-retour ». Le
décor factice n'est plus le repli du cas dégradé, il est le chemin ordinaire.

⚠️ **Corollaire, et c'est le prix** : sans Strat choisie, le décor montre une
**fiche d'exemple**. C'est un spécimen, exactement ce que #23 avait écarté en
comparant les trois formes. Il est assumé pour la même raison que le reste de
l'amendement — sans lui il n'y a rien à régler —, il est nommé comme tel dans sa
barre, et il ne paraît **jamais** quand une vraie fiche existe.

**Ce que l'amendement ne touche pas**, et qui était le cœur de la décision :

- **la page ne porte toujours aucun curseur d'aspect.** Les quatre valeurs se
  prennent sur une fiche, jamais sur un formulaire ;
- **zéro duplication.** La largeur et la position restent **deux gestes**, sur
  l'objet, et n'ont de curseur nulle part ;
- **le modèle ne bouge pas** : les quatre valeurs vivent dans `reglages.json`, et
  les deux chemins y écrivent les mêmes clefs.

**Et la réserve de découvrabilité est à moitié levée.** La poignée de largeur
**se montre** dès que l'Overlay est déverrouillé — un filet au bord droit de la
fiche —, là où elle n'apparaissait qu'au survol, c'est-à-dire pas du tout.
Verrouillé, rien : la région d'entrée est vide, le pointeur n'atteint jamais la
surface, et la fiche est une affiche. La porte reste le seul **texte** qui nomme
le geste ; elle n'est plus le seul endroit qui le **signale**.

## Conséquences

- **Ce qui reste sur l'écran des Réglages est exactement ce qui n'a pas de place
  sur l'objet** : trois raccourcis globaux, la largeur **minimale** d'une fiche
  dans la grille de la Fenêtre principale (#21 — une autre grandeur que la
  largeur de la fiche de l'Overlay), le dossier de logs et le dossier de
  données. Quatre blocs, aucun défilement.
- **Régler et déverrouiller sont le même état.** Il n'y a donc pas de « mode
  réglage » à nommer en plus de l'**Overlay verrouillé** : la porte
  déverrouille, le cadenas de la fiche reverrouille et sort. ⚠️ L'amendement
  ci-dessus retire à la porte ce rôle-là — c'est le **raccourci du verrou** qui
  déverrouille, et le cadenas qui sort — mais l'état, lui, reste unique : la
  barrette paraît avec le déverrouillage et disparaît avec lui.
- **Le modèle ne change pas.** Les quatre valeurs restent persistées dans
  `reglages.json` (ADR `0004`) : ce que cette décision déplace est *où on les
  modifie*, pas *où elles vivent*.
- **La police sort de la V1.** Elle figurait dans l'inventaire sans avoir été
  confirmée par #6, et trois choix de police ne règlent rien que la taille du
  texte ne règle déjà. La fiche garde la police du système.
- **L'ADR `0006` n'est pas touché.** L'Overlay ne gagne aucun mot : il gagne un
  cadenas, qui est un contrôle, pas un aveu. Pendant le réglage, ce qui parle
  est la barrette — une surface d'outil, temporaire, qui disparaît en sortant.
- **Un réglage qui se prend sur l'objet n'est pas découvrable depuis l'objet.**
  Personne ne devine qu'on attrape le bord droit d'une fiche : c'est la porte,
  et elle seule, qui l'apprend. Elle a donc une charge que les autres blocs de
  l'écran n'ont pas — nommer les gestes. ⚠️ L'amendement la lui retire à moitié :
  déverrouillé, l'objet **montre** sa poignée. Il faut encore avoir déverrouillé
  pour la voir, donc la charge de la porte n'est pas nulle, elle est partagée.
