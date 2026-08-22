# Vérification à la main

Certains lots ne se testent pas en CI : ils exigent **Wakfu lancé**, une vraie
fenêtre, un vrai gestionnaire de fenêtres. Ce fichier tient leur protocole.

## Lot 2 — la coque Electron et l'Overlay au-dessus du jeu

### Avant de commencer

- **Wakfu en fenêtré.** Le plein écran exclusif est hors périmètre : il
  imposerait d'injecter une DLL et de hooker `Present()`, techniquement
  indistinguable d'un cheat.
- **X11.** L'app impose `--ozone-platform=x11` : natif sous Windows, via
  XWayland sous Linux. Sous Wayland natif, `setPosition`,
  `getCursorScreenPoint` et `globalShortcut` disparaîtraient tous les trois —
  et, mesuré sur Electron 43, **aucune fenêtre ne s'affiche du tout**.
- `npm install && npm start`. L'installation **recompile un module natif**
  (voir le README) : sous Fedora, `sudo dnf install libxcb-devel` d'abord.
- ⚠️ Sous Linux, l'app **se relance une fois** au démarrage pour imposer X11 —
  l'argument de ligne de commande est le seul moyen qu'Electron 43 écoute. Le
  second processus n'écrit plus dans le terminal ; `npm start` passe donc
  l'argument directement pour garder le journal sous les yeux.

### Sans lancer le jeu

Le surjeu cherche une fenêtre dont le titre vaut `WAKFU`, **ou finit par
« - WAKFU »** — le client y met le nom du personnage connecté
(« S'Alu-Ca'Va - WAKFU »), et chaque client d'un multi-compte porte le sien.
C'est la rustine de `patches/`, sans laquelle la comparaison serait une égalité
stricte — la même rustine qui rend l'Overlay verrouillé traversable, Electron ne
sachant plus le faire sous X11. Pour répéter le protocole sans le jeu, viser une autre fenêtre :

```sh
WAKFU_MEMO_TITRE_FENETRE='une fenêtre à moi' npm start
```

Tout le reste se déroule à l'identique : la fenêtre visée tient le rôle du jeu.

### Le protocole

La Fenêtre principale est arrivée avec le Lot 5 : les gestes de ce protocole sont
désormais les siens — l'interrupteur et les quatre conditions dans le **Socle
d'état**, en pied de la colonne. Le dossier de logs a son écran depuis le Lot 7
— les **Réglages** ; un seul geste attend encore le sien, dans un **banc d'essai
nommé** : la Demande d'ajout sur l'écran **Roster** (Lot 8). Le terminal, lui,
raconte chaque attachement.

1. **Une seconde instance refuse de démarrer.** L'app déjà ouverte, relancer
   `npm start` : le second processus rend la main aussitôt et la Fenêtre
   principale du premier revient devant. C'est ce verrou qui autorise la
   persistance en JSON sans verrou de fichier (ADR `0004`).
2. **Les quatre conditions.** Au premier lancement, aucune n'est vraie et rien
   ne se dessine. Les rendre vraies une par une :
   - l'**interrupteur** du Socle d'état — persisté, donc vrai encore au prochain
     lancement ;
   - *Désigner le dossier de logs…*, sur l'écran Réglages — pointer le dossier
     qui contient un `wakfu.log` lisible (la découverte automatique est le
     Lot 1). ⚠️ Décochée, cette ligne du Socle **est un lien** qui mène là :
     c'est la seule des quatre à porter une action (ADR `0014`) ;
   - lancer Wakfu, ou la fenêtre qui en tient lieu, **et lui donner le focus** :
     le surjeu s'attache quand elle devient la fenêtre active ;
   - la **pastille de choix** d'une Strat, sur l'écran des Strats — et s'il n'y
     en a aucune, *Créer ma première strat* la choisit d'office.

   À la quatrième, l'Overlay du Tour paraît par-dessus le jeu. En retirer une
   l'éteint — y compris en pleine partie, par exemple en supprimant le
   `wakfu.log` surveillé.
3. **Il suit la fenêtre du jeu.** Déplacer et redimensionner Wakfu : la surface
   reste collée. Réduire le jeu ou passer à une autre fenêtre l'escamote ; y
   revenir le ramène.
4. **Les clics traversent l'Overlay verrouillé.** Verrouillé par défaut :
   cliquer *à travers* la fiche de l'Overlay doit atteindre le jeu.
5. **Le raccourci le déverrouille.** `Ctrl+Alt+L` par défaut (combinaison non
   tranchée) : la **fiche seule** attrape alors les clics — tout le reste du jeu
   reste cliquable, la fenêtre de l'Overlay ayant beau couvrir l'écran entier.
   Le même raccourci reverrouille. `Ctrl+Alt+W` bascule l'Affichage demandé. Un
   raccourci que le système refuse est signalé dans le terminal, et sur sa ligne
   dans l'écran Réglages, où les trois se changent depuis le Lot 7.
6. **L'Overlay de la Demande d'ajout.** *Faire surgir la Demande d'ajout*, dans
   le banc d'essai de l'écran Roster :
   elle se pose au milieu de la fenêtre du jeu, suit ses déplacements, et
   **attrape toujours les clics** — le compteur de sa coque le prouve. Le verrou
   ne la touche jamais, et elle n'a ni barre de titre ni ✕ (ADR `0010`).
7. **Fermer la Fenêtre principale ferme tout.** Le ✕ quitte l'application, les
   deux Overlays compris. Pas de zone de notification.

### Ce qui n'est pas encore vérifiable

- La **question** de la Demande d'ajout (Lot 8) : ce lot ne pose que la coque.
- La **fiche** du Tour est arrivée avec le Lot 4, la **Fenêtre principale** avec
  le Lot 5 : les deux ont leur section, plus bas.

## Lot 1 — le lecteur de logs

Tout ce qui se vérifie sans le jeu l'est en CI : `npm test` rejoue les six
captures de `docs/research/samples/`. Ne restent à la main que la **découverte**
sur une vraie machine, et le **suivi d'un vrai combat** — que les captures ne
peuvent pas couvrir, étant toutes en `k=2` sur une seule session observée.

### Sans lancer le jeu

La détection remplace le dossier désigné dès qu'aucun n'est désigné (ADR
`0014`). Sur une machine où Steam et launcher coexistent, elle doit trouver les
deux et retenir le `wakfu.log` le plus récemment modifié :

```sh
npm run build
node -e "const d=require('./dist/logs/dossier-de-logs.js');
  console.log(d.candidats(d.systemeDeFichiersReel(), d.environnementReel()));"
```

Puis, dans l'app : désigner un dossier, vérifier que la condition « les logs de
Wakfu sont trouvés » se coche, **l'effacer**, et vérifier qu'elle reste cochée —
la détection a repris la main. C'est la sortie que les Réglages promettent.

⚠️ Sous **Windows**, la racine de Zaap (`%AppData%\zaap`) est *attendue* et
jamais mesurée : c'est la seule inconnue de la découverte, et elle a son ticket.

### Le protocole, Wakfu lancé

La sonde imprime le Tour courant à chaque changement. Ce n'est pas le produit —
l'Overlay ne consomme pas encore le suivi :

```sh
node --experimental-strip-types tools/suivre-en-direct.ts --ordre Premier,Second
```

1. **Deux clients depuis la même installation.** C'est ce qui les fait écrire
   dans un seul `wakfu.log`, et tout l'objet de `k`.
2. **Un combat de trois rounds au moins**, un sort par personnage à chaque tour
   dès le premier — l'ancre qui permet d'apparier tours réels et frontières.
   Compter les tours joués par chacun : c'est la vérité terrain, et le log ne la
   donne pas indépendamment.
3. **Le rejeu quand `k` monte.** Pendant le combat, la sonde affichera
   probablement `k=1` et suivra le seul client visible — c'est **juste**, le flux
   d'un client est complet à lui seul. Le bloc du second arrive minutes après, `k`
   passe à 2, et le combat se rejoue pour retomber sur le même nombre de tours.
   Un Tour courant qui **bondit** au lieu de retomber juste est le bug à guetter.
4. ~~Le client relancé en plein combat.~~ **Fait le 22 août 2026, et le cas est
   écarté** : les fenêtres du jeu ne sont pas censées se fermer en plein combat.
   Ce qu'on y a appris — un combat rejoint réémet sa rafale `[_FL_]`, et le suivi
   repart avec `k` retombé de 2 à 1 — est consigné dans « Points de rupture
   connus » de la grammaire. Ne pas refaire ce test pour valider un lot.
5. **Un vrai pseudo.** Un personnage à apostrophe ou tiret, mis KO si possible.
   Les six captures sont anonymisées en `PJ1`…`PJ4`, courts et sans ponctuation.

## Lot 3 — la persistance

Presque tout se teste en CI. Ce qui n'y tient pas, c'est la promesse de l'ADR
`0004` : le JSON lisible est un **outil de support**, donc il faut l'ouvrir, le
casser à la main, et regarder l'app s'en remettre.

Le bac à sable travaille dans un dossier jetable, jamais le vrai :

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/essai-persistance.ts
```

Premier passage, il sème une Strat et un Personnage. Ensuite, ouvrir
`/tmp/wakfu-memo-essai/`, casser, relancer, lire le verdict :

| ce qu'on casse | ce qu'on doit voir |
|---|---|
| deux Emplacements sur la même `couleur` | le second prend la première teinte libre |
| un septième Emplacement | coupé à six |
| une clé de `consignes` qui ne vise aucun `id` | jetée |
| une `c` de segment inventée | le texte reste, la couleur tombe |
| `"schema": 9` | `refuse`, et le fichier n'est **pas** réécrit |
| le JSON tronqué en plein mot | mis de côté en `*.corrompu-<date>.json`, les deux autres intacts |
| une clé inconnue dans `reglages.json` | conservée telle quelle à la réécriture |

⚠️ La réparation se fait **en mémoire** : le fichier cassé garde son doublon
jusqu'à la prochaine écriture. C'est voulu — on ne réécrit pas le disque pour une
lecture.

### Dans l'app, une fois

Le vidage au `before-quit` est le seul point que le bac à sable ne montre pas :

1. `npm start`, basculer l'Affichage demandé, désigner un dossier de logs.
2. Quitter par le ✕ de la Fenêtre principale.
3. `cat ~/.config/wakfu-memo/reglages.json` : les deux valeurs y sont.
4. Relancer : la Fenêtre principale les rouvre telles quelles.

Puis, une fois, avec `roster.json` rendu illisible avant le lancement : le
bandeau de la Fenêtre principale doit **le dire**, et nommer le fichier mis de
côté.

## Lot 4 — l'Overlay du Tour : la fiche, la Mise en avant, et le silence

Tout ce qui se déduit d'un log se vérifie en CI : `npm test` rejoue un combat
d'échantillon événement par événement et regarde la Mise en avant descendre les
lignes. Restent à la main **ce qui se regarde** — la lisibilité sur les pixels du
jeu — et les **trois gestes sur l'objet**, qu'aucun test ne peut juger.

### La Strat qu'il faut saisir

L'Overlay ne se dessine pas sans Strat choisie (ADR `0006`). Le Lot 4 se
vérifiait sur une Strat semée par le banc d'essai ; depuis le Lot 5 elle se
**saisit** dans l'écran des Strats, et il en faut une de **six Emplacements et
sept Tours**.

Les deux nombres comptent. Six Emplacements, parce qu'une strat jouée à deux doit
en griser quatre. **Sept Tours contre un combat qui en fait douze**, parce que
c'est le seul moyen de fabriquer le **débordement** — la phrase du Tour dépassé.

### Le protocole, sans combat

1. **Hors combat, la fiche est celle du Tour 1.** La quatrième condition
   remplie, la fiche paraît : barre de Strat, `T1`, six lignes, la note en
   ambre. **Aucune ligne teintée, rien de grisé.** C'est l'état qu'on a sous les
   yeux le plus longtemps.
2. **Les six Couleurs contre les portraits**, et la **Mise en avant**. Les deux
   se peignent depuis la même Couleur, et elles étaient toutes deux **incolores**
   jusqu'au Lot 5 : le modèle transporte le **mot** (`rouge`), le CSS attend une
   teinte, et personne ne traduisait. À regarder sur le vrai décor, les six.
   Le liseré est collé au portrait, sans filet sombre — voir le protocole du
   Lot 5.
3. **Les trois gestes sur l'objet** (ADR `0013`) — et ils exigent l'Overlay
   **déverrouillé**, `Ctrl+Alt+L` par défaut :
   - **déplacer** la fiche en l'attrapant par sa barre de Strat ou son en-tête,
     jamais par une ligne (les lignes sont au geste d'Échange par clic du Lot 8) ;
   - **la largeur** au bord droit, minimum 340 px, **double-clic** pour revenir
     à la largeur automatique ;
   - les deux survivent au redémarrage : ils sont dans `reglages.json`.
4. **Le cadenas et le menu des Strats.** Déverrouillé, le cadenas s'ouvre et le
   nom de la Strat se clique. Verrouiller **replie le menu** s'il était ouvert,
   et le cadenas est traversé lui aussi — le raccourci global est le seul retour.
5. **L'opacité et la taille du texte** se prennent dans la **barrette**, qui ne
   paraît que déverrouillé (Lot 7) : la porte des Réglages y mène, et le
   protocole de ce lot-là les regarde en face.
6. **Une Strat presque vide se dessine sans un mot.** Dans `strats.json`, vider
   les `tours` d'une Strat : `T1` et des lignes vides. Vider ses `emplacements` :
   l'en-tête seul. Aucun message, aucune explication — c'est l'objet du lot.

### Le protocole, Wakfu lancé

Deux clients depuis la **même installation**, comme pour le Lot 1 : c'est ce qui
les fait écrire dans un seul `wakfu.log`.

1. **L'entrée en combat n'est qu'un signe.** Au `[_FL_]`, la fiche ne change
   pas : **une ligne s'allume**. C'est le seul indice qu'un combat est vivant, et
   il n'y a pas un mot de plus.
2. **La Mise en avant descend d'une ligne par tour joué**, et le `T` change au
   bouclage. Elle **ne promet pas l'instant** : après la fin du tour d'un
   personnage elle passe au suivant tout de suite, même si des monstres jouent
   avant. Ne pas prendre ça pour un bug.
3. **Un Emplacement que personne ne tient est grisé** dès le début — une strat à
   six jouée à deux en grise quatre. Un KO en grise un de plus, une réanimation
   le dégrise. Rien ne distingue les deux causes.
4. **Au-delà du T7**, la phrase paraît et les lignes restent affichées, vides.
5. **`End fight` ramène la fiche au Tour 1**, sans teinte. Et sans `End fight` —
   client tué, kick — le **pull suivant** remet tout à zéro : il n'y a aucun
   délai d'expiration à attendre.
6. **Zéro geste entre deux runs.** Enchaîner deux combats sans rien toucher.

⚠️ **Le multi-compte est ce qui se vérifie mal tout seul.** Un `k` mal lu donne
un overlay **deux fois trop rapide**, muet et faux (ADR `0006`) : la seule vérité
terrain est de compter les tours joués à la main, comme le Lot 1 le demande.


## Lot 5 — la Fenêtre principale : la coque, le Socle d'état, l'écran des Strats

Ce lot est presque tout entier à la main, et pour une raison de structure : les
règles du modèle sont en CI — `npm test` fait passer au réducteur d'édition ses
seize commandes, l'échange d'une Couleur prise, l'insertion au glisser-déposer,
les Consignes qu'un Emplacement emporte — mais **rien de ce qui se voit ni de ce
qui se tape** ne se rejoue sans une fenêtre.

⚠️ Ce lot **supprime le banc d'essai** de la coque du Lot 2. Deux de ses gestes
survivent, nommés, sur l'écran qui les recevra : le dossier de logs sur
**Réglages** — que le Lot 7 a depuis remplacé par le vrai écran —, la Demande
d'ajout sur **Roster** (Lot 8). Le bouton
*Semer une Strat d'essai*, lui, disparaît : l'écran des Strats le remplace, et
c'est tout l'objet du lot.

### Le premier lancement

À faire sur un dossier de données vide — sinon on ne le revoit jamais :

```sh
mv ~/.config/wakfu-memo ~/.config/wakfu-memo.garde && npm start
```

1. **L'écran des Strats dit « aucune strat »**, avec l'invitation et la phrase
   qui dit que sans Strat choisie l'overlay ne se dessine pas. C'est le seul
   écran qui puisse donner envie d'en créer une (ADR `0012`).
2. **Le Socle d'état montre pourquoi rien n'apparaît** : quatre lignes, dans
   l'ordre, et « une Strat est choisie » décochée. C'est ce que l'ADR `0012` a
   transformé d'un pari en dispositif.
3. **Créer la première strat la choisit d'office**, et son nom part en édition.
   La ligne du Socle se coche sans qu'on ait rien fait d'autre.
4. **La deuxième ne vole pas le choix.**

### La liste

1. **Choisir n'oblige pas à ouvrir** : la pastille de gauche déplace le choix, et
   l'Overlay change de Strat sans qu'on entre nulle part.
2. **Renommer se fait sur place**, dans le menu `⋯`. Entrée valide, Échap annule,
   perdre le focus valide. Un nom vide retombe sur « Sans nom ». ⚠️ Un clic dans
   la saisie ne doit **pas** ouvrir la Strat : le champ vit dans le conteneur qui
   ouvre.
3. **Dupliquer propose « X (copie) »**, puis « X (copie 2) », et met le nom en
   édition tout de suite — on duplique pour ajuster. Les noms ne sont **pas**
   uniques : garder le même deux fois reste légal.
4. **Supprimer annonce le compte de ce qui part** — « 7 tours et 6 emplacements ».
   Trois cas à voir, et le troisième est celui qui compte :
   - une Strat quelconque : le compte seul ;
   - la **Strat choisie**, avec d'autres derrière : la confirmation dit **où
     passe le choix** ;
   - la **dernière** : elle dit que plus aucune strat ne sera choisie, et que
     l'overlay **ne se dessinera plus**. Sans cette phrase, la suppression est la
     seule action de l'app qui éteint l'Overlay sans le nommer.
5. **La composition se lit en une rangée** sur chaque ligne : c'est ce qui
   distingue deux strats plus vite qu'un nom.

### La composition, dans la descente

1. **Un clic sur un portrait ouvre son panneau** : la grille des 18 classes, les
   six Couleurs, la suppression. Le panneau **déborde** la colonne de 64 px, et
   c'est voulu — elle n'a la place ni du bouton de Couleur ni du ✕.
2. **Changer la classe garde la Consigne** : l'id de l'Emplacement ne bouge pas.
3. **Choisir une Couleur déjà prise l'échange**, jamais de doublon. Les prises
   portent un point.
4. **Le ＋ disparaît à six.** Le maximum ne s'écrit nulle part, il se voit.
5. **Glisser un Emplacement change son Rang, et les Consignes suivent.** Déposer
   **insère**, il n'échange pas deux places : l'Emplacement n° 1 déposé en n° 4
   donne `2, 3, 4, 1, 5, 6`, et sa Consigne est toujours la sienne.
6. **Supprimer un Emplacement emporte ses Consignes** dans tous les Tours, et il
   le dit avant : « Supprimer l'emplacement **Iop rouge** ? 7 consignes partent
   avec lui, dans tous les tours. » Un Emplacement n'ayant ni libellé ni pseudo,
   sa classe et sa Couleur sont son seul nom — celui qu'on prononce.
   ⚠️ **Un Emplacement qui ne porte aucune Consigne part sans question** : une
   suppression annonce le compte de ce qui part, et quand ce compte est nul il
   n'y a rien à annoncer.
7. **Les six Couleurs contre les portraits.** Le liseré de 3 px est **collé** au
   portrait, sans filet sombre : les deux essais de filet ont échoué à l'écran,
   l'un invisible et l'autre lu comme un espace. Le cas à regarder est donc le
   pire de la mesure d'origine — un liseré **clair sur un portrait pâle** :
   `jaune` sur un Huppermage, dont ce bord est à 207 de luminance. Si la Couleur
   s'y noie, c'est là que le filet redeviendra dû.

### Les fiches de Tour

1. **La grille remplit toujours la largeur.** Attraper le bord de la fenêtre :
   **1 colonne à 912 px**, **2 à 1180**, et les fiches s'étirent pour ne laisser
   aucun trou. « Une colonne » n'est pas un mode, c'est le cas où le minimum
   dépasse la moitié de la place.
2. **Le minimum se règle dans les Réglages** (Lot 7), au seul curseur de
   l'écran : *Largeur minimale d'une fiche*. Le bouger et revenir ici doit
   changer le nombre de colonnes, et rien d'autre.
3. ⚠️ **Personne n'attrape le bord droit d'une fiche ici** : dans la Fenêtre
   principale la largeur est **calculée**, et le geste de #5 ne survit que dans
   l'Overlay, où une seule fiche est visible.
4. **`＋ Tour N` ajoute à la fin**, le `×` de l'en-tête retire ce Tour-là. Une
   Strat sans aucun Tour se dit sans dramatiser : l'Overlay dessinerait quand
   même la fiche `T1` et ses lignes vides.
5. **Un Tour se déplace en glissant sa pastille numérotée**, et le geste existe
   pour rattraper le précédent : supprimer le `T2` par erreur, en rajouter un —
   il arrive en dernier — et le **ramener en deuxième position**. Les numéros se
   renumérotent, les Consignes suivent leur Tour. ⚠️ La poignée est la pastille,
   **pas la fiche entière** : rendre la fiche déplaçable empêcherait de
   sélectionner du texte dans ses Consignes, et cette sélection est ce qui sert
   à colorer. Déposer **insère**, comme pour un Emplacement.
6. **Une Strat sans Emplacement** montre l'en-tête et la phrase qui renvoie à la
   colonne. Aucune ligne de consigne à remplir : il n'y a personne.
7. **Une Consigne trop longue passe à la ligne**, elle ne sort pas de la fiche.
   Le cas à taper est un mot sans espace — `ssssssssssssssssssss…` — qui n'offre
   aucun point de coupure.
8. **Le défilement ne remonte pas en haut** quand on colore un mot ou qu'on
   ouvre un panneau.

### La coloration du texte, et ce qu'elle écrit sur le disque

C'est le point le plus facile à casser sans le voir, parce que les prototypes de
#5 et #21 stockaient du **HTML** et que le modèle gelé par #11 stocke des runs.

1. **La palette est permanente**, dans la colonne, dix teintes plus la case qui
   retire. **Aucun raccourci clavier.**
2. **Sélectionner un mot, cliquer une teinte** : le mot **se voit** coloré, et la
   sélection ne disparaît pas — c'est le `mousedown` qui la sauve. ⚠️ « Se voit »
   est le test, pas « est dans le DOM » : sous la CSP de cette surface, un
   attribut `style` posé par `execCommand` est **refusé à l'affichage** alors
   qu'il reste dans le document. C'est pourquoi la couleur s'applique aux
   segments et non à la sélection.
3. **Elle ne touche pas la note** : son italique ambre est sa signature, et elle
   est du texte brut.
4. **Regarder le fichier**, et c'est le vrai test :

   ```sh
   grep -o '"consignes":.\{0,200\}' ~/.config/wakfu-memo/strats.json
   ```

   On doit y lire des runs — `[{"t":"oeil de taupe + "},{"t":"tir critique","c":"#e8c33c"}]` —
   et **jamais une balise**. Une teinte hors palette n'y entre pas.
5. **Entrée est refusée** dans les trois textes libres : le modèle n'a pas de
   retour à la ligne, et l'Overlay ne saurait pas le dessiner.
6. **Un collage depuis un traitement de texte arrive en texte brut**, sauts de
   ligne devenus des espaces. Sinon la mise en forme s'afficherait puis
   disparaîtrait à la relecture du fichier, et on croirait l'avoir perdue.

### Ce que l'Overlay doit faire pendant qu'on écrit

L'Overlay dessiné (les quatre conditions vraies) et la Strat éditée étant la
Strat choisie :

1. **Renommer** la Strat change le nom dans sa barre de Strat.
2. **Taper une Consigne** la fait paraître dans la fiche, sur la ligne de la
   bonne Couleur.
3. **Ajouter ou déplacer un Emplacement** réordonne les lignes de la fiche — et
   c'est le point à ne pas rater : la **Rotation** parcourt cette composition,
   donc elle doit repartir sur la nouvelle sans qu'on relance rien.
4. **Supprimer la Strat choisie** fait passer l'Overlay sur celle qui reçoit le
   choix, ou l'éteint.

### Le reste de la coque

1. **Le marqueur de l'écran courant est une barre droite de 3 px**, à bouts
   carrés : le fond arrondi passe derrière elle.
2. **Le témoin ambre.** ⚠️ Depuis le Lot 6 ce n'est plus une pastille mais un
   **compte** : voir la section du Lot 6.
3. **Réglages et Prise en main sont volontairement vides** — Lots 7 et 9. La
   colonne doit seulement montrer qu'on y va. Le Roster, lui, est le Lot 6.
4. **Le bandeau de la persistance** est toujours au-dessus de tout : rendre
   `strats.json` illisible avant le lancement, il doit le dire et nommer le
   fichier mis de côté.

### Ce que ce lot ne mesure pas

**Rien n'est chronométré**, et c'est la réserve héritée de #5, #16 et #21. Le
pari central du produit — « la saisie bat le document Word » — n'a jamais été
mesuré en secondes : le chrono avait été retiré du prototype, et les mesures
existantes portent sur des pixels et des degrés. C'est ici, sur l'app finie, que
ça se tranche : **saisir une strat de donjon entière, en une fois, en se
chronométrant.** Si c'est plus pénible que le doc partagé, personne n'abandonnera
son doc.


## Lot 6 — l'écran Roster : le mur de portraits

Même partage qu'au Lot 5, et pour la même raison : les règles sont en CI —
`npm test` fait passer au réducteur du Roster la canonisation, le refus du
doublon, la purge de l'homonyme, les deux cascades — mais **la forme et les
gestes** ne se rejouent pas sans une fenêtre. Or c'est la forme qui a été
choisie, sur des mesures, et c'est elle qu'on regarde ici.

⚠️ **Le banc d'essai survit, et il change de sens.** Il ne fait plus surgir la
coque d'un Overlay : il **sème trois combattants à identifier**, ceux de la
maquette — `Nozadah` l'ecaflip, `Nozaheal` l'eniripsa, `Pandacoucou` le pandawa.
Rien d'autre ne peut remplir cette liste tant que le combat ne la produit pas
(Lot 8).

### Le premier lancement

Sur un dossier de données vide :

```sh
mv ~/.config/wakfu-memo ~/.config/wakfu-memo.garde && npm start
```

1. **Le Roster dit « Le Roster est vide, et c'est normal »**, explique qu'il se
   remplit tout seul au premier combat, et range la saisie à la main **en
   dessous, en gris**, comme un recours.
2. **Aucun « ＋ Nouveau profil »** en tête d'écran : un bouton pour créer un
   contenant vide là où rien n'existe encore était l'élément le plus voyant de
   la maquette.
3. **Aucun avertissement sur le nom.** Celui de #17 — « tape exactement le nom en
   jeu » — est **sorti du produit** : le champ canonise, donc il n'a plus
   d'objet. S'il réapparaît quelque part, c'est une régression.

### Le mur

1. **Une bande par Profil**, des vignettes de 64 px, le portrait devant le
   pseudo. À sept Personnages tout tient sans défiler — c'est ce qui a fait
   gagner cette forme.
2. **L'asymétrie de parole** (ADR `0002`) : un Personnage confirmé par le log est
   **muet** ; celui qui attend son premier combat a le **cadre en pointillé** et
   le **pseudo en italique**. ⚠️ Ni rouge, ni icône d'alerte : si ça ressemble à
   une erreur, c'est raté. La phrase « jamais vu en combat » est en
   **infobulle**, et dans le menu de la vignette — écrite sous le pseudo elle
   ajoutait deux lignes à la vignette et cassait l'alignement du mur, pour un
   état que le pointillé dit déjà.
3. **Aucun liseré de Couleur nulle part** : un Personnage n'en a pas (ADR
   `0003`). Une teinte sur un portrait ici serait un bogue.
4. **Le prix de la forme, à regarder en face** : `Damdamnesique` casse son
   étiquette sur deux lignes. C'est la mesure de #22 — une sur neuf à 74 px — et
   c'est assumé, pas à corriger en douce.
5. **Tout geste passe par un menu**, y compris le plus banal : cliquer une
   vignette ouvre le menu, il n'y a pas de bouton dessus. Sept gestes contre cinq
   pour la liste, et le menu **recouvre** la bande d'à côté.
6. **Renommer un profil** se fait dans l'en-tête de sa bande — Entrée valide,
   Échap annule, perdre le focus valide. **« moi » n'a pas de bouton Supprimer**,
   et c'est la seule chose qui le dit : pas de badge. Le badge « moi » n'apparaît
   qu'**après** un renommage.

### Répondre à une Demande d'ajout

Semer les trois combattants avec le banc :

1. **La bande « à identifier » est en tête du mur**, ambre, chaque vignette
   marquée d'un `?`. Ambre et non rouge : ce n'est pas une erreur.
2. **Le compte est dans la colonne latérale**, sur l'entrée Roster. Personne ne
   va sur le Roster « au cas où » — sans ce compte une question sans réponse
   n'aurait aucun témoin.
3. **Un seul menu ancré** porte les trois réponses : les profils, un profil neuf,
   *Rattacher*, *Ignorer*.
4. **Le rattachement ne passe devant qu'à classe égale.** Ouvrir *Rattacher* pour
   `Nozadah` : `Nozadah` l'ecaflip est en tête ; `Damdamiop` et `Nozahael`
   viennent après, précédés de l'avertissement.
5. **La classe différente prévient, et « non » annule** (ADR `0002`) : choisir
   `Damdamiop` doit dire que le log le donne ecaflip et qu'accepter écrasera la
   classe saisie.
6. ⚠️ **La purge silencieuse de l'ADR `0011`.** Ajouter le `Nozadah` du log au
   profil *Nozadah* : le `Nozadah` saisi à la main **disparaît sans un mot**, et
   la bande en garde trois. C'est la seule suppression de l'app qui ne demande
   rien — vérifier qu'elle vise **exactement** l'homonyme, et que `Nozahael`
   survit à `Nozaheal`.
7. **Ignorer** `Pandacoucou` le fait tomber dans les *Personnages ignorés*, en
   pied de mur, d'où *Proposer à nouveau* le fait revenir. ⚠️ Ces lignes n'ont
   **pas de portrait** : le modèle ne retient d'un ignoré que son ID d'entité et
   le nom vu.

### La saisie à la main

Le `＋ à la main` en fin de bande :

1. **Le champ canonise pendant la frappe.** Taper `s'alu-ca'va` doit afficher
   `S'Alu-Ca'Va` **lettre après lettre**, sans que le caret saute. Taper
   `nozadàh` doit donner `Nozadah` — l'accent tombe.
2. **Le doublon se dit ici, et éteint le bouton** : `nozadah` alors qu'un
   `Nozadah` sans ID existe doit nommer son profil et refuser l'ajout.
3. **Corriger** n'est offert que sur un Personnage **sans** ID. Sur un confirmé,
   le menu dit que le log fait foi et n'offre rien à corriger.

### Les deux formes de la confirmation

1. **Sur un Personnage confirmé** (`Damdam`) : la phrase d'engagement — « Damdam
   est **le rouge** dans *Ombre Épaisse* » —, le compte des Préférences qui
   partent, l'avertissement qu'il reviendra, et **trois** boutons dont
   *Supprimer et ignorer*.
2. **Sur un Personnage sans ID** : **deux** boutons. ⚠️ Et **rien ne l'explique** —
   la phrase qui le disait mettait « ID d'entité » devant le joueur. Si un mot
   apparaît là, c'est une régression.
3. **Sur un Profil** : ses Personnages sont nommés un par un, les Préférences
   comptées, et la phrase dit pourquoi — « un profil, c'est le pote qui farme
   avec toi ».

### Ce que ce lot ne mesure pas

**Rien n'est chronométré** — même réserve qu'aux Lots 4 et 5. Les mesures de #22
portent sur des pixels et des comptes de gestes, jamais sur des secondes. Et un
fait à guetter en usage réel : le mur coûte **sept gestes** là où la liste en
coûtait cinq. Si répondre à trois inconnus après chaque run devient pénible,
c'est ce chiffre-là qui aura eu raison de la forme.


## Lot 7 — l'écran des Réglages : la porte, la barrette, et les trois raccourcis

Même partage qu'aux Lots 5 et 6. Ce qui est une **règle** est en CI — `npm test`
vérifie qu'une combinaison nue est refusée, que celle du verrou ne s'efface pas,
et dans quel ordre une capture écrit ses modificateurs. Mais l'objet de ce lot
est précisément **ce qui ne se juge pas sur une règle** : l'opacité contre les
pixels du jeu, et le geste au bord droit d'une fiche, que personne ne devine.

⚠️ **Ce lot supprime le banc d'essai des Réglages.** Ses quatre boutons sont
devenus l'écran ; ce que le banc listait pour diagnostic — la fenêtre visée,
l'attachement, le chemin du `wakfu.log` — **disparaît sans remplacement**. Ces
faits-là se lisent au terminal, et le Socle d'état dit la seule chose qui
intéresse le joueur : la condition est cochée, ou elle ne l'est pas.

### Avant de commencer

Wakfu en fenêtré, ou `WAKFU_MEMO_TITRE_FENETRE` pour viser une autre fenêtre,
comme au Lot 2. Les deux moitiés de ce protocole se vérifient **dans les deux
sens** : la porte sans le jeu, l'Overlay déverrouillé avec.

### L'écran, avant d'y toucher

1. **Quatre blocs, et aucun défilement** à la taille par défaut de la fenêtre :
   la porte, trois raccourcis, une largeur, deux dossiers. Si l'écran défile,
   c'est raté — la forme retenue tient sur une page, c'est ce qui l'a fait
   gagner.
2. ⚠️ **Aucun curseur d'aspect sur la page** : ni opacité, ni taille du texte, ni
   largeur de la fiche de l'Overlay, ni position. Ils vivent tous derrière la
   porte ou sur l'objet (ADR `0013`) ; s'il en réapparaît un ici, c'est une
   régression.
3. **Rien de ce qui a été sorti** : pas de choix de police, pas de section
   « Reprises », pas de « rejouer la prise en main » (l'entrée de la colonne le
   fait déjà), **aucune trace des Personnages ignorés** — ils se gèrent dans le
   Roster, et pas même en renvoi —, aucun arbitrage entre deux dossiers de logs.
4. **La deuxième ligne du Socle mène ici et l'écran répond.** Décocher la
   condition des logs (renommer le `wakfu.log` surveillé), cliquer la ligne : on
   arrive sur cet écran, et la ligne *Dossier de logs* dit qu'aucun `wakfu.log`
   lisible n'a été trouvé. Une explication en cul-de-sac n'explique pas.

### La porte, et le décor factice

1. ⚠️ **Un seul geste, dans toutes les conditions.** *Régler maintenant* ouvre le
   décor factice, **toujours** : Wakfu fermé, Affichage éteint, aucune Strat
   choisie. Une porte qui refuserait d'ouvrir laisserait l'opacité et la taille
   du texte irréglables au premier lancement, c'est-à-dire au moment exact où on
   vient les régler.
2. **Elle nomme aussi l'autre chemin**, avec la vraie combinaison du verrou : sur
   le jeu, l'Overlay déverrouillé porte la même barrette et les deux gestes.
3. **Le décor est nommé comme tel**, en tête du plateau. Un décor qui se ferait
   passer pour le jeu serait l'aperçu tiède que la forme retenue a écarté.
4. **Une zone très claire et une zone très sombre**, et ce n'est pas de la
   décoration : sur un fond uni, l'opacité ne se jugerait pas du tout.
5. **La fiche est celle de la Strat choisie**, son Tour 1, sans Mise en avant.
   ⚠️ **Sans Strat choisie**, c'est une **fiche d'exemple**, dite telle quelle
   dans sa barre. C'est un spécimen assumé, et il ne doit **jamais** paraître
   quand une vraie fiche existe.
6. **Les mêmes gestes qu'au-dessus du jeu** — glisser par la barre de Strat ou
   l'en-tête, jamais par une ligne ; bord droit pour la largeur, minimum 340 px,
   double-clic pour la largeur automatique ; les deux curseurs de la barrette —,
   et **trois sorties** : le cadenas, « Terminé », Échap.
7. ⚠️ **La position part sur le disque telle qu'elle est prise ici**, et le
   plateau n'a pas la taille de la fenêtre du jeu : une fiche posée en bas à
   droite du décor retombera plus haut à gauche sur le jeu. L'Overlay reborne ce
   qu'il dessine, donc elle n'est jamais perdue — mais elle n'est pas placée pour
   autant, et c'est le prix assumé de régler sans le jeu.

### Sur le jeu : l'Overlay déverrouillé

1. **Le raccourci du verrou est le seul chemin.** La porte ne déverrouille pas :
   `Ctrl+Alt+L` (par défaut) le fait, et la **barrette** paraît collée au pied de
   la fenêtre du jeu.
2. ⚠️ **La poignée de largeur se voit dès qu'il est déverrouillé** : un filet
   clair au bord droit de la fiche, bleu au survol. Verrouillé, **rien** — la
   fiche est une affiche que les clics traversent. C'est la réponse au seul
   reproche que la forme retenue s'était fait à elle-même : une poignée invisible
   est un geste qui n'existe pas.
3. **Les deux gestes**, et la largeur se prend **là**, sans passer par les
   Réglages : glisser la fiche par sa barre de Strat ou son en-tête, attraper son
   bord droit, double-cliquer pour revenir à la largeur automatique. La barrette
   lit les chiffres pendant le glisser.
4. **Les deux curseurs de la barrette** changent la fiche **pendant** qu'on
   glisse, sur le décor du jeu. C'est là, et là seulement, que l'opacité se juge
   contre les pixels qu'elle laisse passer.
5. **Deux sorties, le même état** : le **cadenas** de la fiche et le
   **« Terminé »** de la barrette reverrouillent tous les deux, la barrette
   disparaît, la poignée s'efface, et les clics repartent au jeu.
6. ⚠️ **Reverrouillé, le raccourci est le seul retour.** Le vérifier pour de bon :
   le cadenas est traversé comme le reste. Sans lui, un Overlay verrouillé le
   resterait pour toujours.
7. **Tout survit au redémarrage** : opacité, taille du texte, largeur, position
   sont dans `reglages.json`. Le **déverrouillage, non** — au lancement les clics
   vont au jeu, et c'est le bon défaut.

### Les trois raccourcis

1. **Cliquer une touche ouvre la capture** — *appuyez sur une combinaison…* — et
   la frappe suivante la prend. Vérifier que le raccourci **marche vraiment**,
   jeu au premier plan.
2. ⚠️ **Une combinaison nue est refusée** : taper `W` seul ne doit rien capturer,
   la capture continue d'attendre. Un raccourci global prend la touche à toutes
   les applications — `W` capturé, c'est la lettre W perdue en pleine discussion
   dans le jeu.
3. **Échap annule, un clic ailleurs aussi.**
4. ⚠️ **Aucun bouton « retirer », sur aucune des trois lignes** : un raccourci se
   **change**, il ne se vide pas. Celui du verrou ne le pourrait pas — il est le
   seul retour d'un Overlay verrouillé —, et les deux autres n'y gagnaient qu'une
   case vide de plus à comprendre. S'il en réapparaît un, c'est une régression.
5. **Un refus du système se lit sur sa ligne.** Pour le provoquer : donner à deux
   raccourcis la même combinaison, ou en prendre une que l'environnement de
   bureau tient déjà (`Ctrl+Alt+T` sous GNOME).

### La largeur, et les deux dossiers

1. **Le seul curseur de la page** est la largeur **minimale d'une fiche dans la
   Fenêtre principale** — pas celle de l'Overlay. La bouger, puis aller sur
   l'écran des Strats : le nombre de colonnes change, et la fiche de l'Overlay
   ne bouge pas d'un pixel.
2. **Dossier de logs** : *Désigner un dossier…* le fige et suspend la découverte,
   *retrouver tout seul* la lui rend (ADR `0014`). Le chemin affiché est celui
   qui est retenu, jamais les deux installations.
3. **Dossier de données** : *Ouvrir le dossier* ouvre l'explorateur sur les trois
   fichiers JSON (ADR `0004`).

### Ce que ce lot ne mesure pas

**Rien n'est chronométré** — même réserve qu'aux Lots 4, 5 et 6.

⚠️ Et une réserve qui lui est propre, **atténuée mais pas levée** : la poignée de
largeur se montre maintenant dès que l'Overlay est déverrouillé, et la porte
nomme le geste. Reste qu'il faut avoir déverrouillé pour la voir, et que rien
ici ne mesure si un joueur y arrive seul. Le seul juge est quelqu'un qui n'a pas
lu ces lignes.
