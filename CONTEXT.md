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

**Classe** :
L'une des dix-huit classes de Wakfu. Le jeu la donne en `breed` numérique, que
l'app traduit en clé stable (`ecaflip`) à la frontière du log ; c'est la clé qui
s'écrit sur disque, jamais le `breed`. Une Strat est écrite contre des Classes.
_Avoid_: breed, race, métier

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
Une place dans une Strat : une classe, plus une Couleur. Aucun libellé : l'éditeur
n'affiche que l'icône de classe, et c'est la Couleur qui distingue deux places de
même classe.
_Avoid_: slot, rôle, poste, libellé

**Couleur** :
La teinte d'un Emplacement, choisie parmi six — `rouge`, `jaune`, `vert`,
`bleu`, `rose`, `gris`. Obligatoire, et unique dans une Strat : elle sert
d'identité visuelle **et orale**, celle qu'on prononce pour désigner un
Emplacement, en liseré de 3 px collé au bord gauche de l'icône de classe. À ne
pas confondre avec la coloration libre du texte d'une Consigne, qui dispose de
dix couleurs.
_Avoid_: teinte, code couleur

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
domaine, pas une déduction. C'est la place de l'Emplacement dans la
composition, pas une valeur à part : réordonner la composition change les
Rangs. N'ordonne que les Emplacements entre eux : les monstres n'y figurent
pas.
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
La question posée pour chaque combattant joué que le Roster ne connaît pas :
l'ajouter à un Profil de joueur, le rattacher à un Personnage sans ID d'entité,
ou en faire un Personnage ignoré. Groupée pour tout un combat, elle surgit en
phase de placement sur son propre Overlay et reste tant qu'on n'y a pas
répondu. Ne pas répondre ne vaut pas refus.
_Avoid_: modale, popup, invite

**Échange par clic** :
Le geste qui permute les Personnages liés à deux Emplacements de même classe,
en cliquant leur icône dans la fiche du Tour. Seule réparation d'une Liaison
pendant un combat, et la seule qui existe sur un combat rattrapé à froid.
_Avoid_: permutation, swap, correction

**Préférence de liaison** :
La résolution mémorisée d'un Conflit, pour ne pas reposer la question : dans
telle Strat, tel Personnage occupe tel Emplacement. Ne retient jamais la
composition du combat, donc elle répond encore quand l'équipe change.
_Avoid_: exception, composition, assignation

### Les surfaces — où ça s'affiche

**Fenêtre principale** :
La fenêtre native de l'application : le Roster, les Strats, les Réglages,
l'onboarding, et l'interrupteur d'Affichage demandé, atteints depuis une colonne
latérale. La fermer ferme tout, les Overlays compris. C'est le seul endroit où
l'app s'explique — elle y porte le Socle d'état.
_Avoid_: application, app, fenêtre de l'app

**Socle d'état** :
Le pied de la colonne latérale de la Fenêtre principale : l'interrupteur
d'Affichage demandé, les trois conditions d'affichage de l'Overlay cochées ou
non, et la phrase qui conclut. Contrepartie nommée du silence que l'ADR `0006`
impose à l'Overlay.
_Avoid_: statut, indicateur, barre d'état

**Overlay** :
Une surface dessinée par-dessus le jeu, sans barre de titre ni bouton de
fermeture. Il y en a deux : celui qui porte le Tour courant, et celui qui porte
la Demande d'ajout.
_Avoid_: fenêtre, HUD, popup, incrustation

### Les logs — d'où vient l'état

**Frontière de tour** :
La ligne `N seconde(s) reportée(s)` de `wakfu.log`. Marque la fin du tour d'un
Personnage contrôlé — les monstres et les Invocations n'en émettent aucune.
C'est le seul signal qui fait avancer la Rotation.
_Avoid_: tick, fin de tour

**Ligne nommée** :
Une ligne de log qui porte le nom d'un combattant. Elle n'attribue aucun tour :
le nom qu'elle porte peut être celui du tour qui vient de finir, et sa copie
tardive arrive parfois après la Frontière de tour suivante.
_Avoid_: événement, log de combat

**Transition** :
Une ligne de log qui pose un état — `est KO !`, `est réanimé`,
`est hors-combat !`, `[_FL_]`. S'applique à la première vue et se réapplique
sans effet, donc n'a pas à être dédupliquée.
_Avoid_: événement, changement

**Tick** :
Une ligne de log qu'on compte, et qu'il faut donc dédupliquer. La Frontière de
tour est la seule : on retient la première vue et on ignore les `k−1` suivantes,
`k` étant le nombre de clients Wakfu engagés dans le combat.
_Avoid_: compteur, battement

### Le suivi — où on en est

**Rotation** :
La suite des Emplacements actifs, par Rang croissant, que le suivi parcourt, et
la position courante dans cette suite. Ne s'arrête jamais sur un Emplacement
inactif, ni sur un monstre. Chaque Frontière de tour l'avance d'un cran ; quand
elle revient au plus petit Rang actif, le Tour courant change.
_Avoid_: cycle, tour de table, ordre, curseur

**Tour courant** :
Le Tour de la Strat en vigueur, celui dont l'overlay affiche la fiche. Vaut 1 à
l'ouverture du combat et avance d'un cran chaque fois que la Rotation boucle.
Rien ne le corrige à la main, et rien n'avoue qu'il pourrait être faux.
_Avoid_: round, numéro de tour, compteur

**Mise en avant** :
Le fond teinté de la ligne de l'Emplacement sur lequel la Rotation est arrivée.
Ne promet pas l'instant : après une Frontière de tour la Rotation avance tout de
suite, même si des monstres jouent avant. Une seule ligne à la fois — le
suivant n'est pas annoncé. Son apparition est le seul signe qu'un combat est
vivant : hors combat la fiche du premier Tour est là, et aucune ligne n'est
teintée.
_Avoid_: surbrillance, highlight, actif, joue

**Affichage demandé** :
L'intention de montrer l'overlay, posée par l'interrupteur ou le raccourci
global. Persistée : elle survit au redémarrage de l'app et ne se redemande
jamais entre deux combats. L'overlay n'est dessiné que si trois conditions sont
vraies ensemble — l'Affichage est demandé, une fenêtre de Wakfu existe, une
Strat est choisie.
_Avoid_: armé, activé, visible, allumé

**Emplacement inactif** :
Un Emplacement que la Rotation franchit sans l'attendre, pour l'une de deux
causes indistinguables : **absent** (aucun Personnage dans ce combat) ou
**tombé** (sorti sur `est KO !`, par mort ou par abandon). Une réanimation le
rend actif.
_Avoid_: mort, vide, désactivé, grisé
