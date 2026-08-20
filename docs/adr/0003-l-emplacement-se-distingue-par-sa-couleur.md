# L'Emplacement se distingue par sa Couleur, pas par un libellé de rôle

Un **Emplacement** porte une classe et une **Couleur** — obligatoire, prise parmi
six, et unique dans la Strat. Il ne porte **aucun texte** : ni libellé de rôle, ni
nom de classe. L'éditeur comme l'overlay n'affichent que l'icône de classe, avec
la Couleur en liseré collé à son bord gauche.

La décision de #8 disait l'inverse : une classe **plus un libellé de rôle libre et
facultatif**, « l'Eca qui tank », dont le rôle était de départager deux
Emplacements de même classe. On l'a écarté en maquettant l'éditeur (#5), sur deux
constats. D'abord un champ de texte de plus par emplacement, à remplir pour rien
dans la grande majorité des cas — or le ticket #5 existe précisément pour que la
saisie batte le document Word, et chaque champ facultatif est un champ qu'on
regarde en se demandant s'il faut le remplir. Ensuite le libellé ne se lit pas là
où il compte : dans une fiche de tour, il double l'icône de classe et allonge
chaque ligne de 160 px, au détriment de la Consigne, qui est le seul texte utile.
La Couleur fait le même travail de distinction en 3 px de large, et se voit d'un
coup d'œil sur un overlay.

## Conséquences

- La Couleur n'est pas décorative : elle est **obligatoire et unique**, donc elle
  fait office d'identité de l'Emplacement à l'écran. Choisir une couleur déjà
  prise l'**échange** avec l'Emplacement qui la portait, plutôt que d'accepter un
  doublon.
- Six Emplacements au maximum, donc six couleurs suffisent. Elles doivent se
  distinguer nettement sur fond sombre. Réserve assumée : rouge et vert
  coexistent dans la palette, ce qui gêne une partie des joueurs daltoniens —
  l'icône de classe porte l'identité principale, la Couleur n'est qu'un renfort.
- Un **Conflit** d'attribution (deux Personnages d'une classe pour deux
  Emplacements de cette classe) ne peut plus se poser en nommant un rôle. Il se
  pose sur le **Rang** et la **Couleur** : « lequel est le n° 2, le rouge ? ».
  C'est plus sec qu'« lequel est le tank ? », et c'est le prix payé.
- Le partage de strat par code (V2) transmet une composition **muette** : classes,
  rangs et couleurs, sans l'indice de rôle qu'un libellé donnait à celui qui
  reçoit. Les Consignes restent, elles, entièrement lisibles.
