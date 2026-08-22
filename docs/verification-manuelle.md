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
   cliquer *à travers* le repère de l'Overlay doit atteindre le jeu.
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

- La **fiche** du Tour (Lot 4), la vraie **Fenêtre principale** et son **Socle
  d'état** (Lot 5), la **question** de la Demande d'ajout (Lot 8) : ce lot ne
  pose que les coques.
- La **découverte** du dossier de logs (Lot 1) : ici, seul un dossier désigné à
  la main alimente la condition.
