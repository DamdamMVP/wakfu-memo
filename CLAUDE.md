# wakfu-memo

Utilitaire Wakfu pour le farm de donjon : un overlay qui affiche, tour par tour,
ce que chaque personnage doit faire — en remplacement des documents partagés
que les joueurs tiennent à la main aujourd'hui.

L'état du combat est déduit en lisant les fichiers de log locaux du client
Wakfu, en lecture seule. Aucune lecture mémoire, aucune injection, aucun input
synthétique. Voir `docs/research/wakfu-log-grammar.md`.

## Agent skills

### Issue tracker

Issues et specs vivent dans les GitHub Issues du repo (`DamdamMVP/wakfu-memo`),
via la CLI `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Les cinq rôles canoniques, sans renommage. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context : `CONTEXT.md` + `docs/adr/` à la racine. See `docs/agents/domain.md`.
