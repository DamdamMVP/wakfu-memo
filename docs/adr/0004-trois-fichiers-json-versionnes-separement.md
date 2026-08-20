# Trois fichiers JSON versionnés séparément, migrés d'office

L'état persistant tient dans **trois fichiers JSON indentés** posés dans
`app.getPath('userData')` — `%AppData%\wakfu-memo\` sous Windows,
`~/.config/wakfu-memo/` sous Linux : `reglages.json`, `roster.json`,
`strats.json`. Chacun porte son propre `"schema": <n>`, migré indépendamment des
deux autres. L'écriture est atomique (fichier temporaire puis `rename`),
anti-rebondie à 400 ms, et vidée au `before-quit`.

SQLite était le réflexe et on l'a écarté sur les volumes : le roster fait
quelques dizaines de lignes, une strat de dix tours sur six emplacements fait
quelques kilo-octets, il n'y a aucune requête à formuler, et un binaire opaque
interdit de réparer à la main le fichier qu'un utilisateur nous envoie avec son
rapport de bug — le JSON lisible est un outil de support. Un fichier unique
était l'autre candidat : trois fichiers gagnent parce que les trois états
s'écrivent à des rythmes sans rapport (les réglages à chaque glissement
d'opacité, les strats à chaque frappe, le roster une fois par combat au plus),
parce qu'une corruption ne peut pas emporter les trois, et parce que toucher au
format d'une strat ne doit pas faire bouger le numéro de schéma du roster. Un
fichier **par strat** a été écarté : ça ne sert que la copie manuelle d'une
strat, que le partage par code de la V2 fera mieux.

La migration est **automatique et silencieuse**, annoncée après coup par un
bandeau unique et une copie de sauvegarde (`roster.v1.bak`). Proposer le choix
n'a pas de branche « non » cohérente à offrir : un binaire unique ne sait pas
lire l'ancien format, donc refuser laisserait l'utilisateur avec une app
incapable d'ouvrir ses propres données. Le seul choix honnête serait « migrer ou
quitter », ce qui est un choix de façade.

## Conséquences

- **Le verrou d'instance unique est ce qui autorise cette simplicité** : il n'y
  a jamais deux écrivains, donc aucun verrou de fichier, aucune relecture-fusion.
  Retirer le verrou casserait la persistance, pas seulement l'ergonomie.
- Les **réglages sont un sac de clés tolérant** : clé absente = défaut du code,
  clé inconnue conservée à la réécriture. Ajouter un réglage ne demande donc
  aucune migration — seul un renommage en demande, et c'est la raison pour
  laquelle le numéro de schéma reste présent. La conservation des clés inconnues
  couvre gratuitement la rétrogradation : une v1 qui relit un fichier de v2 ne
  détruit pas ce qu'elle ne comprend pas.
- Un fichier d'une version **plus haute** que celle que l'app connaît est
  **refusé, jamais écrasé** — cas réel après une mise à jour ratée ou un fichier
  copié depuis une autre machine.
- Un fichier **illisible** est mis de côté (`roster.corrompu-<date>.json`) et
  l'app repart sur les défauts avec un avertissement visible, plutôt que de
  refuser de démarrer.
- Le JSON étant lisible, quelqu'un l'éditera. Les invariants sont donc
  **imposés à l'écriture** par l'éditeur, seul écrivain — Couleur unique dans la
  Strat, six Emplacements au plus — et **réparés en silence à la lecture**.
- Réserve assumée : la Couleur d'un Emplacement est stockée en **hexadécimal**,
  pas en clé de palette. Retoucher les six teintes pour le contraste demandera
  donc une migration qui remappe les anciennes valeurs vers les nouvelles —
  faisable précisément parce que l'ensemble est fermé à six.
