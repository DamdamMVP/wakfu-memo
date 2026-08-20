# L'overlay n'a pas de vocabulaire pour son propre doute

L'overlay en combat affiche le Tour courant et met en avant l'Emplacement sur
lequel la Rotation est arrivée. Il n'affiche **rien d'autre** : ni compteur
marqué douteux, ni annonce du suivant, ni correction manuelle du numéro de
Tour, ni état « aucune Strat sélectionnée ». Quand aucune Strat n'est choisie,
il ne se dessine pas du tout.

Trois tickets avaient pourtant demandé l'inverse, chacun pour une bonne raison.
#14 voulait une **représentation de l'état dégradé**, le numéro de Tour marqué
non fiable quand l'ordre déclaré et les compteurs de frontières par personnage
se contredisent. #14 notait aussi que l'overlay **pouvait annoncer le suivant**,
le `Rang` étant déclaré. #17 avait fixé le cas « aucune Strat » à un numéro de
Tour plus une ligne. On a écarté les trois en maquettant l'overlay (#6).

Le motif est le même à chaque fois. Une fiche de Tour tient six Consignes sur
une surface qu'on lit **d'un coup d'œil, en combat, en regardant ailleurs** :
chaque signe ajouté se paie sur le seul texte utile. Le chevron du suivant
faisait un second point d'accroche à côté de la ligne mise en avant, et l'œil
hésitait entre les deux. Surtout, un compteur qui sait dire « je ne suis
peut-être pas fiable » est un compteur dont on cesse de se servir : en farm
répété le joueur connaît sa strat par cœur, un point d'interrogation ambre ne
lui apprend rien qu'il puisse corriger, il lui apprend seulement à se méfier de
l'outil. Le parti pris est donc que **le suivi automatique est juste**, et que
l'interface n'a pas de mots pour le cas où il ne l'est pas.

## Conséquences

- La **détection d'erreur** de #14 — redondance entre l'ordre déclaré et les
  compteurs de frontières par personnage — **perd son seul consommateur** et
  sort du périmètre V1. Elle reste possible à tout moment, mais plus rien ne
  l'affiche.
- Il n'y a **aucun filet** pour le démarrage à froid en plein combat, devenu un
  cas courant depuis #17 (l'app n'a pas de vie en arrière-plan, donc elle n'a
  pas vu le début du combat). Sans correction manuelle, l'accrochage à chaud du
  parseur doit être juste tout seul : la charge passe entière sur #9.
- L'**affichage est conditionné à une Strat choisie**. L'interrupteur manuel et
  le raccourci global de #17 ne peuvent pas dessiner un overlay vide : soit une
  Strat est sélectionnée et il s'affiche, soit rien ne s'affiche. Rectifie la
  décision 13 de #17.
- Le seul aveu conservé est le **débordement au-delà du dernier Tour de la
  Strat** — « la strat s'arrête au T7, le combat continue sans consigne », les
  lignes restant affichées et vides. Ce n'est pas un doute : c'est un fait, la
  Strat est finie et le combat non, et le joueur doit le savoir plutôt que de
  chercher une Consigne qui n'existe pas.
- Renforce l'ADR `0003` : l'overlay n'affiche **pas le pseudo** du Personnage
  lié, alors que la Liaison le connaît. Un Emplacement reste une icône de
  classe et un liseré de Couleur, en combat comme dans l'éditeur.
