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

La coque de la Fenêtre principale est un **banc d'essai** — le Lot 5 la
remplace. Elle porte les gestes dont ce protocole a besoin, et le terminal
raconte chaque attachement.

1. **Une seconde instance refuse de démarrer.** L'app déjà ouverte, relancer
   `npm start` : le second processus rend la main aussitôt et la Fenêtre
   principale du premier revient devant. C'est ce verrou qui autorise la
   persistance en JSON sans verrou de fichier (ADR `0004`).
2. **Les quatre conditions.** Au premier lancement, aucune n'est vraie et rien
   ne se dessine. Les rendre vraies une par une :
   - *Demander l'affichage* — persisté, donc vrai encore au prochain lancement ;
   - *Désigner le dossier de logs…* — pointer le dossier qui contient un
     `wakfu.log` lisible (la découverte automatique est le Lot 1) ;
   - lancer Wakfu, ou la fenêtre qui en tient lieu, **et lui donner le focus** :
     le surjeu s'attache quand elle devient la fenêtre active ;
   - *Choisir cette Strat* — n'importe quel nom suffit ici (le Lot 5 apporte les
     vraies Strats).

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
   raccourci que le système refuse est signalé dans le banc d'essai et dans le
   terminal.
6. **L'Overlay de la Demande d'ajout.** *Faire surgir la Demande d'ajout* :
   elle se pose au milieu de la fenêtre du jeu, suit ses déplacements, et
   **attrape toujours les clics** — le compteur de sa coque le prouve. Le verrou
   ne la touche jamais, et elle n'a ni barre de titre ni ✕ (ADR `0010`).
7. **Fermer la Fenêtre principale ferme tout.** Le ✕ quitte l'application, les
   deux Overlays compris. Pas de zone de notification.

### Ce qui n'est pas encore vérifiable

- La vraie **Fenêtre principale** et son **Socle d'état** (Lot 5), la
  **question** de la Demande d'ajout (Lot 8) : ce lot ne pose que les coques.
- La **fiche** du Tour est arrivée avec le Lot 4, plus bas.

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

### La Strat d'essai

L'Overlay ne se dessine pas sans Strat choisie (ADR `0006`) et l'éditeur est le
Lot 5. Le banc d'essai de la Fenêtre principale porte donc *Semer une Strat
d'essai* : six Emplacements, sept Tours, le contenu fictif des maquettes #5 et
#6. Semer la choisit d'office, comme le fera la création de la première Strat.

Elle sert deux fois : sept Tours écrits contre un combat qui en fait douze,
c'est **le débordement** qu'on ne peut pas fabriquer autrement.

### Le protocole, sans combat

1. **Hors combat, la fiche est celle du Tour 1.** La quatrième condition
   remplie, la fiche paraît : barre de Strat, `T1`, six lignes, la note en
   ambre. **Aucune ligne teintée, rien de grisé.** C'est l'état qu'on a sous les
   yeux le plus longtemps.
2. **Les six Couleurs contre les portraits.** Le liseré de 3 px et son filet
   sombre doivent séparer la Couleur du portrait pour les six, le `jaune`
   compris. C'est la mesure de #21 rendue à l'échelle réelle, sur le vrai décor.
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

