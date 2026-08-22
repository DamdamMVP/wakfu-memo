# wakfu-memo

Utilitaire Wakfu pour le farm de donjon : un overlay qui affiche, tour par
tour, ce que chaque personnage doit faire — en remplacement des documents
partagés que les joueurs tiennent à la main aujourd'hui.

L'état du combat est déduit en lisant les fichiers de log locaux du client
Wakfu, **en lecture seule**. Aucune lecture mémoire, aucune injection, aucun
input synthétique.

## Où est le projet

La spec V1 se construit dans les [issues](../../issues) : la
[carte](../../issues/1) indexe les décisions prises et pointe sur le ticket qui
porte chacune. Le vocabulaire du domaine vit dans [`CONTEXT.md`](CONTEXT.md),
les décisions structurantes dans [`docs/adr/`](docs/adr/), et ce qu'on a appris
des logs réels dans
[`docs/research/wakfu-log-grammar.md`](docs/research/wakfu-log-grammar.md).

## Le code

Electron + TypeScript, sans empaqueteur : `tsc` compile, et les trois surfaces
sont du HTML.

```sh
npm install       # installe, rustine le surjeu, et recompile son module natif
npm start         # compile puis lance l'app
npm run verifier  # lint + typage + tests : ce qu'on lance avant de commiter
npm test          # typage + les modules purs, sans Electron ni Wakfu
npm run format    # met en forme et corrige ce qui se corrige tout seul
npm run build     # compile seulement
```

⚠️ `npm install` **compile du C** — le prix de la rustine décrite plus bas.
Sous Fedora : `sudo dnf install gcc-c++ make python3 libxcb-devel` (`g++` sert à
l'édition de liens, même si les sources sont du C). Sous Windows : les Build
Tools de Visual Studio.

```
src/main/         le processus principal — conditions d'affichage, surjeu,
                  verrou, raccourcis, veille du combat
src/pont/         le preload : ce que les surfaces ont le droit de demander
src/surfaces/     la Fenêtre principale — sa colonne, son Socle d'état, l'écran
                  des Strats, le mur de portraits du Roster, la porte des
                  Réglages — et les deux Overlays
src/logs/         le lecteur de wakfu.log — tokenizer, relecture de session,
                  suivi du fichier qui grandit, découverte du dossier
src/suivi/        le Tour courant, la Rotation, et la fiche du Tour qu'ils
                  dessinent avec une Strat
src/persistance/  les trois fichiers JSON — réglages, roster, strats — les
                  cascades de suppression, et les deux réducteurs qui éditent
                  une Strat et le Roster
src/domaine/      les Classes, la Composition d'une Strat, les deux palettes,
                  les segments de texte riche, la forme canonique d'un nom
src/echantillons/ l'accès aux captures, pour les tests seuls
icons/            les dix-huit portraits de classe, nommés par clé de classe.
                  `npm run build` les recopie dans `dist/icons/`, où les
                  surfaces les demandent
```

**La couture du produit tient en trois appels** : `FluxDuLog` lit les octets
ajoutés à `wakfu.log`, `suivreLaSession` en tire l'état du combat, et
`ficheDuTour` le pose sur une Strat. Ce qui est incrémental est la **lecture**,
jamais le **comptage** : le suivi voit toujours la liste entière des événements
d'un combat, donc « `k` monte → on rejoue le combat » reste gratuit (ADR
`0009`).

`src/logs/`, `src/suivi/` et `src/domaine/` ne connaissent **ni Electron ni
l'Overlay** : l'entrée est le texte de `wakfu.log`, la sortie un état. C'est ce
qui les rend vérifiables contre les captures du dépôt, sans lancer le jeu.
`src/persistance/` non plus : le dossier de données lui est **donné** — ce sera
`app.getPath('userData')` — donc il se teste dans un dossier temporaire.

**L'aspect de l'Overlay se règle sur une fiche, pas sur une page** (ADR `0013`).
L'écran des Réglages porte une **porte**, qui ouvre un **décor factice** — une
zone très claire, une zone très sombre, la fiche dessus, et une **barrette** qui
tient l'opacité et la taille du texte. Elle ouvre toujours, jeu lancé ou non,
strat choisie ou non : sinon ces deux réglages seraient inatteignables au premier
lancement. Sur le jeu, le raccourci du verrou déverrouille l'Overlay, qui porte
la même barrette et les deux gestes de la souris — la fiche se place en la
glissant, sa largeur s'attrape au **bord droit**, dont la poignée se montre dès
qu'il est déverrouillé. Ce qui reste sur la page est exactement ce qui n'a de
place ni sur l'un ni sur l'autre : trois raccourcis globaux, la largeur minimale
d'une fiche **dans la Fenêtre principale** — une autre grandeur que celle de
l'Overlay — et deux dossiers.

**Une question posée pendant le combat n'est pas une fenêtre** (ADR `0010`).
La **Demande d'ajout** — « ce combattant joue, le Roster ne le connaît pas » — a
sa propre surface au-dessus du jeu, sans barre de titre et sans ✕ : un ✕ voudrait
dire non, et ne pas répondre ne vaut pas refus. Elle porte un « plus tard » qui
**replie**, et une **pastille** dans la barre de Strat de la fiche la ramène. Le
verrou de l'Overlay ne s'y applique jamais. Les inconnus y sont listés **à plat,
tous ensemble** : répondre pour l'un fabrique un Conflit pour l'autre, donc une
file d'attente se recalculerait après chaque réponse. Le menu des réponses est un
**menu du système** et non un élément du DOM — il doit pouvoir déborder d'un
panneau qui fait deux lignes de haut.

**Un échange réussi est invisible, et c'est ce qui dessine l'Échange par clic.**
Deux Emplacements d'une même classe portent la même icône, la Consigne appartient
à l'Emplacement et ne bouge pas, et l'ADR `0003` interdit le pseudo au repos :
après la permutation, l'écran est identique. D'où la règle — **le pseudo n'existe
que pendant le geste**. Le survol nomme toute icône, permutable ou non, allume
les partenaires quand il y en a, et les deux lignes clignotent une seconde après.
Ce que le geste écrit est une **Préférence de liaison**, qui nomme un Personnage :
un combattant que le Roster ne connaît pas n'a donc **rien à permuter** — le trou
du démarrage à chaud, et la raison pour laquelle la Demande d'ajout a fallu une
surface où les faire entrer **pendant** le combat.

**Les écrans qui écrivent n'écrivent rien eux-mêmes.** Une surface n'a pas d'API
Node, donc elle envoie une **intention** — `ajouter-emplacement`,
`poser-couleur`, `deplacer-emplacement`, `saisir-personnage`, `rattacher`,
`preferer` — et
`edition-strats.ts` ou `edition-roster.ts` décide : la Couleur libre, l'échange
d'une Couleur déjà prise, la renumérotation des Rangs, les Consignes qu'un
Emplacement supprimé emporte ; la canonisation d'un nom tapé, le refus d'un
doublon, la purge silencieuse de l'homonyme quand un ID d'entité s'attache. Tous
les invariants de `strats.json` et de `roster.json` ont donc **un seul gardien
chacun**, et ils se testent sans Electron. La surface ne fait que peindre et
demander.

⚠️ **La liste « à identifier » n'est persistée par aucune clef**, et c'est une
décision : elle vaut pour la session, et un inconnu revient au prochain combat
où il joue. Auto-nettoyante, dans l'esprit de l'ADR `0007`, là où une clef de
plus accumulerait pour toujours les questions sur des passants. Conséquence à
connaître : le rattrapage d'une Demande d'ajout ne vaut que si l'app n'a pas été
fermée.

⚠️ Tout y est **synchrone**, et ce n'est pas de la paresse : `before-quit` ne sait
pas attendre une promesse, donc un vidage asynchrone perdrait la dernière
écriture en quittant.

`tools/` mélange trois choses, et il faut savoir laquelle on tient :

| | qui l'appelle |
|---|---|
| `copie-statique.mjs` | `npm run build` — copie le HTML, le CSS et les portraits vers `dist/` |
| `rustine-surjeu.mjs` | `postinstall` — sans lui, pas de surjeu |
| `essai-titre.c` | `src/main/surjeu-titre.test.ts`, qui le compile et l'exécute |
| `entetes-bouchons/uv.h` | le compilateur — un bouchon pour libuv, que l'en-tête rustiné inclut mais que la règle testée ne touche jamais |
| `commandes-compilation.mjs` | `postinstall` — écrit `compile_commands.json` pour que l'éditeur sache ouvrir `essai-titre.c` |
| `suivre-en-direct.ts` | toi, à la main — imprime le Tour courant en direct, pour vérifier le lecteur contre un vrai combat |
| `essai-persistance.ts` | toi, à la main — sème trois fichiers JSON dans un dossier jetable, pour les casser et regarder la lecture les réparer |
| `capture-multi-account.sh` | toi, à la main, pour produire un échantillon de logs |
| `extract-i18n-patterns.sh` | toi, à la main — les motifs du parser se dérivent de l'i18n du client, ils ne s'écrivent pas à la main |

**Le code est écrit en français, les commentaires en anglais.** Les identifiants
reprennent le vocabulaire de [`CONTEXT.md`](CONTEXT.md) — un `Surjeu`, une
`Strat`, un `Emplacement` — parce qu'un terme du domaine traduit est un terme
perdu. Les commentaires, eux, n'appartiennent pas au domaine.

**Cinq `tsconfig` parce qu'il y a trois exécutions différentes** dans le même
dépôt, et qu'un seul fichier les laisserait se mélanger sans que rien ne
proteste :

| | quoi | pourquoi à part |
|---|---|---|
| `tsconfig.main.json` | `src/main/`, `src/pont/`, et le lecteur de logs | CommonJS, API Node, **pas de DOM** |
| `tsconfig.renderer.json` | `src/surfaces/` | ESM, **DOM**, pas d'API Node |
| `tsconfig.test.json` | les `*.test.ts` et la sonde de `tools/` | Node les exécute en ESM par détection de syntaxe ; `noEmit` |
| `tsconfig.base.json` | — | les options strictes communes aux trois |
| `tsconfig.json` | — | la solution : `tsc -b` bâtit les deux vrais projets dans l'ordre |

Sans ce découpage, une surface pourrait appeler `fs` et le processus principal
`document` : ça compilerait, et ça casserait à l'exécution.

⚠️ **Un seul chemin de code, X11** : natif sous Windows, via XWayland sous
Linux, sans quoi `setPosition`, `getCursorScreenPoint` et `globalShortcut`
disparaissent. En Electron 43, `app.commandLine.appendSwitch` **n'y suffit
pas** — seul `--ozone-platform=x11` en ligne de commande est lu, donc l'app se
relance une fois sous Linux pour se le donner.

⚠️ **Une rustine sur `electron-overlay-window`** (`patches/`), sur trois
points, tous mesurés :

- **le titre** — la bibliothèque cherchait la fenêtre du jeu à l'égalité stricte,
  or le client y écrit le nom du personnage (« S'Alu-Ca'Va - WAKFU ») ; elle
  accepte désormais le suffixe ;
- **`setInputRegion`** — `setIgnoreMouseEvents` ne fait plus rien sous Linux/X11
  depuis Electron 43 (electron#52456), donc la région d'entrée se pose à la main
  via xcb-shape ;
- **`setOverrideRedirect`** — Mutter refuse de déplacer une fenêtre ordinaire :
  `setPosition` sur l'Overlay de la Demande d'ajout est sans effet, quel que soit
  le délai. La sortir des mains du gestionnaire de fenêtres est ce que la
  bibliothèque fait déjà pour son propre overlay, et la seule chose qui marche.

`tools/rustine-surjeu.mjs` la repose et recompile à chaque installation ;
l'empaquetage de la V1 devra livrer ce binaire par plateforme.

⚠️ **`tools/essai-titre.c` a besoin de deux `-I` que seul le dépôt connaît** —
les sources rustinées sous `node_modules`, et le bouchon libuv. Sans eux, un
serveur de langage C ouvre le fichier sur quinze erreurs. `npm install` engendre
`compile_commands.json` pour les lui donner ; `npm run commandes` le refait à la
demande. Le fichier porte des chemins absolus, donc il n'est pas suivi.

Ce qui exige Wakfu lancé se vérifie à la main :
[`docs/verification-manuelle.md`](docs/verification-manuelle.md).

## Captures de logs

`docs/research/samples/` contient des extraits de vraies sessions de jeu, sur
lesquels les décisions de suivi de combat sont vérifiées. Deux d'entre eux sont
de vrais `wakfu.log` utilisables de bout en bout — `revive2-2026-08-21` et
`alternance-2026-08-22` ; les cinq autres sont des captures en **deux fichiers**
d'avant l'ADR `0008`, qui ne servent qu'à tester les règles séparément.

Ils sont produits par `tools/capture-multi-account.sh` (`mark`, puis `cut` après
le combat, puis `report`), qui remplace les noms de personnages joués par `PJ1`,
`PJ2`…, donne à chaque **ID d'entité** un jeton distinct et stable, masque les
chemins et l'IP locale, et filtre les canaux en **liste blanche** — `wakfu.log`
porte tous les canaux, le logger de chat étant additif, donc sans ce filtre un
échantillon emporte le commerce et les allées et venues des autres joueurs.

Une capture brute ne doit jamais être commitée telle quelle.
