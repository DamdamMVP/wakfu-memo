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
- La **fiche** du Tour, alimentée par le suivi du Lot 1 : la coque de l'Overlay
  ne porte qu'un repère.

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
