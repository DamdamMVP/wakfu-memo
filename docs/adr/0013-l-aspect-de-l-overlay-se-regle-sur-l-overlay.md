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

## Conséquences

- **Ce qui reste sur l'écran des Réglages est exactement ce qui n'a pas de place
  sur l'objet** : trois raccourcis globaux, la largeur **minimale** d'une fiche
  dans la grille de la Fenêtre principale (#21 — une autre grandeur que la
  largeur de la fiche de l'Overlay), le dossier de logs et le dossier de
  données. Quatre blocs, aucun défilement.
- **Régler et déverrouiller sont le même état.** Il n'y a donc pas de « mode
  réglage » à nommer en plus de l'**Overlay verrouillé** : la porte
  déverrouille, le cadenas de la fiche reverrouille et sort.
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
  l'écran n'ont pas — nommer les gestes.
