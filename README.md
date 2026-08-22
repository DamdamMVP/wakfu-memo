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
                  verrou, raccourcis, réglages
src/pont/         le preload : ce que les surfaces ont le droit de demander
src/surfaces/     la Fenêtre principale et les deux Overlays
src/logs/         le lecteur de wakfu.log — tokenizer, relecture de session,
                  découverte du dossier
src/suivi/        le Tour courant et la Rotation, déduits des événements
src/domaine/      les Classes et la Composition d'une Strat
src/echantillons/ l'accès aux captures, pour les tests seuls
```

`src/logs/`, `src/suivi/` et `src/domaine/` ne connaissent **ni Electron ni
l'Overlay** : l'entrée est le texte de `wakfu.log`, la sortie un état. C'est ce
qui les rend vérifiables contre les captures du dépôt, sans lancer le jeu.

`tools/` mélange trois choses, et il faut savoir laquelle on tient :

| | qui l'appelle |
|---|---|
| `copie-statique.mjs` | `npm run build` — copie le HTML et le CSS vers `dist/` |
| `rustine-surjeu.mjs` | `postinstall` — sans lui, pas de surjeu |
| `essai-titre.c` | `src/main/surjeu-titre.test.ts`, qui le compile et l'exécute |
| `entetes-bouchons/uv.h` | le compilateur — un bouchon pour libuv, que l'en-tête rustiné inclut mais que la règle testée ne touche jamais |
| `commandes-compilation.mjs` | `postinstall` — écrit `compile_commands.json` pour que l'éditeur sache ouvrir `essai-titre.c` |
| `suivre-en-direct.ts` | toi, à la main — imprime le Tour courant en direct, pour vérifier le lecteur contre un vrai combat |
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
