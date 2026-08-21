# La Fenêtre principale est le seul endroit qui explique

L'ADR `0006` retire à l'**Overlay** tout vocabulaire pour son propre doute : il
affiche le Tour et la Mise en avant, et rien qui avoue un état dégradé. Il ne dit
pas non plus pourquoi il ne se dessine pas — quand aucune Strat n'est choisie, il
ne se dessine simplement pas.

Cette décision laissait un trou, et #18 l'avait comblé par un pari plutôt que par
un dispositif : « au premier lancement l'utilisateur est dans la fenêtre
principale en train de créer sa première strat, **il voit pourquoi rien
n'apparaît** ». Rien, dans la Fenêtre principale, ne le lui montrait.

La **Fenêtre principale porte donc un socle d'état permanent**, en pied de sa
colonne de navigation : l'interrupteur d'**Affichage demandé**, puis les **trois
conditions** de CONTEXT.md écrites une par ligne et cochées ou non —
*l'Affichage est demandé* · *une fenêtre de Wakfu existe* · *une Strat est
choisie* — puis une ligne qui conclut, « l'overlay est dessiné, sur *Ombre
Épaisse* » ou « l'overlay n'est pas dessiné ». Décidé en maquettant la coque de
la Fenêtre principale (#21), en comparant trois coques : c'est la **place
permanente** de la colonne latérale qui rend le socle possible, là où une barre
d'onglets n'a la place que d'une pastille et de six mots.

Le partage est net, et il tient au support : l'**Overlay** est une surface qu'on
lit d'un coup d'œil, en combat, en regardant ailleurs — chaque signe ajouté s'y
paie sur la Consigne. La **Fenêtre principale** est une fenêtre qu'on ouvre
exprès, où l'on est déjà en train de configurer, et où une phrase ne coûte rien.
`0006` n'était pas « l'app ne s'explique jamais », c'était « **pas là** ».

## Conséquences

- L'ADR `0006` est **précisé, pas contredit** : l'Overlay reste muet. Ce qui
  entre, c'est que son silence a désormais une contrepartie ailleurs, et que
  cette contrepartie est **nommée et permanente**, pas un pari sur le contexte.
- Le pari de #18 (« il voit pourquoi rien n'apparaît ») devient un **dispositif**.
  Le cas qu'il visait — Affichage demandé, aucune Strat, rien à l'écran — se lit
  maintenant en trois lignes cochées et une non cochée.
- Le socle **ne dit rien du doute du suivi**. Il énonce trois conditions
  vérifiables — un interrupteur, une fenêtre, un choix — pas une confiance. La
  détection d'erreur de #14, sortie du périmètre par `0006`, **ne trouve pas ici
  un nouveau consommateur** : ce serait rouvrir `0006` par la porte de derrière.
- Toute question à laquelle l'app tient et que l'Overlay ne peut pas porter a un
  lieu : la Fenêtre principale. C'est déjà ce que l'ADR `0010` disait d'une
  **Demande d'ajout** restée sans réponse, qui se rattrape sur l'écran Roster.
- L'écran des Strats hérite de la même charge. Comme l'ADR `0006` empêche
  l'Overlay de se dessiner sans Strat choisie, l'état « **aucune Strat** » est le
  seul endroit qui puisse donner envie d'en créer une : il porte donc une
  invitation, et la phrase qui dit que sans Strat choisie l'overlay ne se dessine
  pas. Deux corollaires du même principe : **créer la première Strat la choisit
  d'office** — sinon l'utilisateur vient de tout saisir et rien n'apparaît encore
  — et **supprimer la Strat choisie annonce où passe le choix**, ou qu'il n'y en
  aura plus, l'Overlay s'éteignant alors sans un mot.
