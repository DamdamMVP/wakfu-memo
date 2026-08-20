# Wakfu Mémo

Un overlay qui dit, tour par tour, ce que chaque personnage doit faire dans un
donjon Wakfu. L'état du combat est déduit en lisant les fichiers de log locaux
du client, en lecture seule.

## Language

### Le roster — qui joue

**Profil de joueur** :
Un propriétaire de personnages. « moi » existe par défaut et n'est pas
supprimable ; les partenaires de farm réguliers ont le leur.
_Avoid_: compte, utilisateur

**Personnage** :
Un personnage jouable enregistré localement, appartenant à un Profil de joueur.
Naît d'une saisie manuelle — nom et classe tapés, sans ID d'entité — ou d'une
Demande d'ajout. Dès qu'un ID d'entité s'y attache, le log fait foi sur son nom
en jeu et sa classe, qui ne sont plus éditables.
_Avoid_: perso, joueur, PJ

**Personnage ignoré** :
Un combattant joué que l'utilisateur a refusé d'enregistrer. Retenu par son ID
d'entité, jamais reproposé, et réversible.
_Avoid_: liste noire, exclu, refusé

**Roster** :
L'ensemble des Personnages enregistrés, tous profils confondus. Global : il ne
dépend pas de la Strat.
_Avoid_: équipe, composition

**Invocation** :
Une unité créée en combat par un Personnage. Hors du Roster, et sans consigne
en V1 — mais elle s'insère dans l'ordre des tours.
_Avoid_: familier, serviteur

**ID d'entité** :
L'identifiant que `[_FL_]` donne à chaque combattant. Constant d'un combat à
l'autre pour un Personnage, ce qui permet de le suivre à travers un renommage.
_Avoid_: id, identifiant

### La strat — quoi faire

**Strat** :
Le plan d'un donjon : une liste ordonnée d'Emplacements et une liste ordonnée
de Tours. Écrite contre des classes, elle ne référence aucun Personnage.
_Avoid_: stratégie, plan, doc

**Emplacement** :
Une place dans une Strat : une classe, plus un libellé de rôle libre et
facultatif qui distingue deux places de même classe (« l'Eca qui tank »).
_Avoid_: slot, rôle, poste

**Tour** :
Un cran de la Strat : un numéro, une description globale facultative, une note
libre facultative, et une consigne facultative par Emplacement.
_Avoid_: round, étape

**Consigne** :
Ce qu'un Emplacement doit faire à un Tour donné. Appartient à l'Emplacement,
jamais au Personnage.
_Avoid_: instruction, description, action

**Rang** :
La position d'un Emplacement dans l'ordre des tours, de 1 à 6. Déclaré par le
joueur — les salles de donjon sont fixes, donc l'ordre est une connaissance de
domaine, pas une déduction. N'ordonne que les Emplacements entre eux : les
monstres n'y figurent pas.
_Avoid_: ordre, initiative, index, position

### La liaison — qui occupe quoi

**Liaison** :
L'association d'un Personnage à un Emplacement pour un combat. Recalculée au
début de chaque combat depuis `[_FL_]`, jamais stockée dans le cas courant.
_Avoid_: assignation, attribution, mapping

**Conflit** :
Le cas où la Liaison ne peut pas se calculer seule : plusieurs Personnages
d'une classe pour plusieurs Emplacements de cette classe. Résolu par une
demande en phase de placement, rattrapable par un échange par clic.
_Avoid_: ambiguïté, erreur

**Demande d'ajout** :
La question posée en phase de placement pour chaque combattant joué que le
Roster ne connaît pas : l'ajouter à un Profil de joueur, le rattacher à un
Personnage sans ID d'entité, ou en faire un Personnage ignoré. Ne pas répondre
ne vaut pas refus.
_Avoid_: modale, popup, invite

**Exception de liaison** :
La résolution mémorisée d'un Conflit, pour ne pas reposer la question. Seules
les exceptions sont persistées.
_Avoid_: composition, préférence

### Les logs — d'où vient l'état

**Frontière de tour** :
La ligne `N seconde(s) reportée(s)` du chat log. Marque la fin du tour d'un
Personnage contrôlé — les monstres n'en émettent aucune.
_Avoid_: tick, fin de tour

**Ligne nommée** :
Une ligne du chat log qui porte le nom d'un combattant, et qui sert donc à
attribuer un tour.
_Avoid_: événement, log de combat

**Transition** :
Une ligne de log qui pose un état — `est KO !`, `est réanimé`,
`est hors-combat !`, `[_FL_]`. S'applique à la première vue et se réapplique
sans effet, donc n'a pas à être dédupliquée.
_Avoid_: événement, changement

**Tick** :
Une ligne de log qu'on compte, et qu'il faut donc dédupliquer. La Frontière de
tour est la seule.
_Avoid_: compteur, battement

### Le suivi — où on en est

**Rotation** :
La suite des Emplacements actifs, par Rang croissant, que le suivi parcourt. Ne
s'arrête jamais sur un Emplacement inactif, ni sur un monstre.
_Avoid_: cycle, tour de table, ordre

**Emplacement inactif** :
Un Emplacement que la Rotation franchit sans l'attendre, pour l'une de deux
causes indistinguables : **absent** (aucun Personnage dans ce combat) ou
**tombé** (sorti sur `est KO !`, par mort ou par abandon). Une réanimation le
rend actif.
_Avoid_: mort, vide, désactivé, grisé
