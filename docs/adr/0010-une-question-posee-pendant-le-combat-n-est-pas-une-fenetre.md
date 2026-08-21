# Une question posée pendant le combat n'est pas une fenêtre

La Demande d'ajout se pose sur son **propre Overlay**, par-dessus le jeu, et
non dans la Fenêtre principale ni dans la fiche du Tour. Cet Overlay n'a ni
barre de titre système, ni bouton de fermeture : il porte un « plus tard » qui
le replie, et il **reste tant qu'on n'y a pas répondu** — la fin du combat ne
l'efface pas.

Trois formes ont été maquettées côte à côte en résolvant #16, et les deux
autres sont écartées. **Tout dans la fiche** — un bandeau de pseudos ajouté à la
fiche du Tour — rouvre l'ADR `0006` par la fenêtre : la fiche se lit d'un coup
d'œil en regardant ailleurs, et tout signe ajouté se paie sur les six
Consignes. **Tout dans la Fenêtre principale** demandait un alt-tab hors du jeu
pour répondre à une question de deux secondes, en phase de placement, c'est-à-
dire au seul moment où le joueur ne peut pas quitter son écran.

Le motif qui tranche est plus dur que l'encombrement. Une fenêtre a un **✕**, et
un ✕ veut dire non. Or #17 a gelé que **ne pas répondre à une Demande d'ajout ne
vaut pas refus** — la question doit pouvoir être ignorée sans que rien ne soit
décidé, et revenir au combat suivant. Une surface qui offre un ✕ offre donc un
refus qu'on n'a pas voulu donner, et le seul refus explicite qui existe est le
Personnage ignoré, qui se choisit dans la question, pas en la fermant.

## Conséquences

- **Il y a trois surfaces, dont une seule est une fenêtre.** La Fenêtre
  principale — Roster, Strats, Réglages, onboarding — plus deux Overlays : le
  Tour courant, et la Demande d'ajout. Le ✕ n'existe que sur la première, et il
  quitte tout, Overlays compris.
- **La pastille de la fiche** (« *n* à identifier ») ne sert qu'à **ramener
  l'Overlay replié**. Elle ne compte jamais un Conflit, que rien ne demande.
- **La Fenêtre principale garde la même liste**, sur son écran Roster : c'est là
  qu'une Demande sans réponse se rattrape après le combat, ce que #18 exigeait
  sans savoir encore qu'une seconde surface existerait.
- L'ADR `0006` **n'est pas contredit** : il interdit à l'overlay du Tour d'avoir
  du vocabulaire pour son propre doute. Une Demande d'ajout n'est pas un doute
  de l'application sur elle-même, c'est une question dont l'utilisateur seul a
  la réponse — et elle vit sur une autre surface.
