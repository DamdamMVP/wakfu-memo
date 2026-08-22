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
d'état**, en pied de la colonne. Deux gestes attendent encore leur écran, et ils
vivent dans un **banc d'essai nommé** : le dossier de logs sur l'écran
**Réglages** (Lot 7), la Demande d'ajout sur l'écran **Roster** (Lot 8). Le
terminal, lui, raconte chaque attachement.

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
   raccourci que le système refuse est signalé dans le terminal, et dans le banc
   d'essai de l'écran Réglages.
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
5. **L'opacité et la taille du texte** n'ont pas encore de commande : elles
   viennent avec la **porte** des Réglages (Lot 7). Pour les regarder tout de
   même, quitter l'app, changer `opacite` et `tailleTexte` dans
   `~/.config/wakfu-memo/reglages.json`, relancer.
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
**Réglages** (Lot 7), la Demande d'ajout sur **Roster** (Lot 8). Le bouton
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
2. ⚠️ **Le minimum n'a pas encore de commande** : il vit dans les Réglages
   (Lot 7). Pour le regarder tout de même, quitter l'app, changer
   `ficheMiniFenetre` dans `~/.config/wakfu-memo/reglages.json`, relancer.
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
2. **Le témoin ambre.** *Faire surgir la Demande d'ajout*, dans le banc de
   l'écran Roster : une pastille ambre paraît sur l'entrée **Roster** de la
   colonne, et c'est là que la question se rattrapera (ADR `0010`). Y répondre
   l'éteint.
3. **Roster, Réglages et Prise en main sont volontairement vides** — Lots 6, 7
   et 9. La colonne doit seulement montrer qu'on y va.
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
