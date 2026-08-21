# L'Overlay ne se dessine pas sans logs à lire

L'ADR `0006` retire à l'Overlay tout vocabulaire pour son propre doute, et
l'ADR `0012` donne à ce silence sa contrepartie : le **Socle d'état** de la
Fenêtre principale, et ses **trois conditions vérifiables** — un interrupteur,
une fenêtre, un choix.

Il restait un trou, ouvert en maquettant les Réglages (#23) : le **dossier de
logs peut être introuvable**. #4 a gelé qu'il se dérive du client — Steam ou
launcher Ankama — et cette dérivation échoue sur une installation portable, un
chemin inattendu, un dossier déplacé. Or les trois conditions peuvent être
**toutes vraies sans qu'une seule ligne de log soit lue**. L'Overlay se dessine
alors, montre la fiche du Tour 1, et n'avance jamais : `0006` lui interdit tout
mot pour l'avouer, et #18 a gelé que l'absence de Mise en avant est
**indistinguable de « pas de combat »**. Muet **et** faux, ce qui est le pire
mode de panne du produit.

D'où la décision : **« les logs de Wakfu sont trouvés » est une quatrième
condition d'affichage.** Sans elle, l'Overlay ne se dessine **pas du tout** —
exactement le geste que `0006` avait déjà fait pour la Strat, « soit une Strat
est sélectionnée et il s'affiche, soit rien ne s'affiche ».

## Le fait, et ce qu'il n'est pas

La condition vaut **un `wakfu.log` lisible est trouvé** — le fichier, pas le
dossier, puisque #4 arbitre déjà entre deux installations sur le `wakfu.log` le
plus récemment modifié. Un `stat` suffit à la trancher, et elle avale sans ligne
supplémentaire ses deux voisins : dossier trouvé mais vide (Wakfu jamais lancé)
et dossier trouvé mais illisible (droits).

Elle ne dit **rien de la fraîcheur**. Un `wakfu.log` intouché depuis six heures
est un joueur qui n'a pas joué depuis six heures, pas une panne. Toute règle du
type « si rien depuis N minutes » réintroduirait un seuil à défendre et
rouvrirait `0006` par la porte de derrière — #9 avait déjà écarté les délais
d'expiration pour ce motif, et `0012` interdit au Socle d'énoncer une confiance
plutôt qu'un fait.

La condition est **vivante**, comme les trois autres, mais sur le **fichier
retenu** : perdre le `wakfu.log` qu'on surveille éteint l'Overlay, y compris en
pleine partie — ce que #18 fait déjà quand la fenêtre de Wakfu se ferme. La
dérivation complète de #4, elle, ne rejoue qu'au lancement et à la demande.

## Ce que le Socle d'état devient

Quatre lignes, permanentes, dans cet ordre :

> *l'Affichage est demandé* · **les logs de Wakfu sont trouvés** · *une fenêtre
> de Wakfu existe* · *une Strat est choisie*

La liste **est** les conditions : elle ne change pas de forme selon les
circonstances, sinon elle cesse d'être un objet qu'on apprend. La nouvelle ligne
prend la **deuxième** place — la première reste le miroir de l'interrupteur qui
la surplombe, et les deux faits qui parlent du jeu se lisent alors côte à côte,
**installé** puis **lancé** : une installation jamais lancée les décoche toutes
les deux, et adjacentes elles racontent une histoire au lieu de deux pannes
éparpillées. La phrase qui conclut ne change pas ; elle est le ET de quatre
conditions au lieu de trois.

**Décochée, cette ligne porte un lien vers les Réglages** — la seule des quatre
à porter une action. L'asymétrie est assumée : à qui il manque une Strat sait où
aller, personne ne devine qu'un dossier se désigne dans les Réglages. Ce n'est
pas la duplication que #23 a condamnée, puisque le sélecteur reste à un seul
endroit : on ajoute un chemin vers lui, pas un second contrôle. Une explication
en cul-de-sac n'explique pas.

## Considéré et écarté

**Dessiner quand même la fiche du Tour 1.** C'est l'argument le plus sérieux
contre cette décision : le produit remplace un document partagé, et une fiche
statique *est* ce document. Mais #18 a refusé le **feuilletage** hors combat —
« deux flèches, c'est le fil » — donc la fiche figée ne montre que le Tour 1
sur N, sans moyen d'atteindre les autres. Ce n'est pas le document, c'est le
document coincé à la page 1, et il prétend suivre un combat.

**Ne le dire que sur l'écran des Réglages.** C'est refaire le pari sur le
contexte que `0012` venait justement de remplacer par un dispositif : celui dont
le dossier est introuvable n'a aucune raison d'ouvrir les Réglages.

## Conséquences

- **`0006` et `0012` sont précisés, pas contredits.** L'Overlay reste muet ; ce
  qui entre, c'est qu'il se **tait complètement** dans un cas de plus, et que le
  Socle en porte la contrepartie. Le Socle continue de n'énoncer que des faits
  vérifiables : celui-ci est binaire, pas une confiance.
- **#18 n'est pas touché.** Il décrit l'état hors combat d'une machine **qui
  lit** ; sans logs à lire il n'y a pas d'état hors combat, il n'y a pas
  d'Overlay.
- **Le secours de #23 est persisté et réversible.** Un dossier désigné à la main
  s'écrit dans `reglages.json` (ADR `0004`) et gagne sur la dérivation de #4 ;
  l'écran des Réglages dit lequel des deux a produit le dossier retenu —
  **détecté** ou **désigné** — et offre le retour à la détection automatique.
  Sans ce retour, qui désigne le mauvais dossier n'a plus de sortie.
- **Quand un dossier est désigné, l'arbitrage de #4 ne s'exécute plus.** La
  règle des deux installations qui coexistent tient toujours, mais un choix
  explicite la remplace — cohérent avec #23, qui l'avait déjà retirée de l'écran
  au motif que personne ne joue sur deux Wakfu.
- **`CONTEXT.md` compte jusqu'à quatre**, aux entrées *Affichage demandé* et
  *Socle d'état*. **Aucun terme neuf** : `wakfu.log` est déjà nommé à l'entrée
  *Frontière de tour* et gelé par l'ADR `0008`, et « dossier de logs » n'est ni
  contesté ni surchargé — il ne gagne pas d'entrée.
- **L'onboarding ne gagne rien.** Un premier lancement sans logs trouvés est
  pile le moment de la prise en main, mais le Socle est permanent et couvre le
  cas ; la rédaction du contenu de l'onboarding reste hors périmètre (#17).
