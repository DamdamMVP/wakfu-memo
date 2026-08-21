# Les frontières de tour se dédupliquent par comptage, pas par fenêtre temporelle

En multi-compte, plusieurs clients Wakfu écrivent dans le même `wakfu.log` et y
dupliquent chaque ligne. La **Frontière de tour** est la seule ligne qu'on
*compte*, donc la seule à dédupliquer. La règle est : **la première frontière
vue est une fin de tour — on avance — puis on ignore les `k−1` suivantes**, où
`k` est le nombre de clients engagés dans le combat.

`k` **ne se lit pas** en comptant les entités `isControlledByAI=false`, parce
que les entités n'arrivent pas ensemble : sur le combat `1552030105`, PJ2
apparaît à 18:38:34,415 et PJ1 seulement à 18:38:36,163. Conclure `k=1` à la
première ligne donnerait un overlay **deux fois trop rapide** — le pire mode de
panne du produit. `k` vaut donc le **maximum, sur toutes les entités du combat,
du nombre de copies de sa ligne `[_FL_]`** : réévalué à chaque ligne pendant
l'ouverture, figé à la première frontière. Ici `Sac à patates` apparaît deux
fois, donc `k=2`, connu 75 secondes avant la première frontière.

La fenêtre temporelle est l'alternative évidente, et les mesures la
recommandaient : deux copies d'une frontière sont séparées de 1 à 173 ms, deux
vraies frontières d'au moins 884 ms, sans aucun recouvrement. Elle a été
écartée parce que le comptage, **formulé ainsi**, n'a pas le défaut qu'on lui
prêtait. Une frontière **orpheline** existe bel et bien dans les logs — la
première de `duo` n'a qu'une seule copie, d'où 31 lignes pour 16 tours, un
nombre impair — et elle casse un découpage en paquets absolus de `k`, qui se
décale alors sur tout le reste du combat. Mais une règle relative à la dernière
frontière **acceptée** l'absorbe : simulée sur les cinq échantillons, elle donne
16, 6, 8, 3 et 2 avances pour exactement autant de tours joués. Le seul effet de
l'orpheline est qu'à partir d'elle c'est la seconde copie qui est retenue, soit
**40 ms de retard**. Le comptage évite en prime d'introduire un seuil en
millisecondes à régler et à défendre.

## Conséquences

- **Limite connue** : avec `k=2`, le nombre d'avances vaut `ceil(N/2)`. **Une**
  frontière orpheline par combat est absorbée exactement, **deux** font perdre un
  tour. Une seule observée sur 7 combats.
- La **phase de placement n'est pas un état** de la machine à états, juste un
  prédicat dérivé — *combat ouvert, aucune frontière ni ligne nommée vue*. `k`
  est acquis bien avant qu'il se ferme, puisqu'aucune frontière n'est émise avant
  la première action.
- La dédup par comptage ne s'applique **qu'aux frontières**. Tout le reste est
  une **Transition** — `est KO !`, `est réanimé`, `est ressuscité !`, `[_FL_]`,
  `[FIGHT] End fight` — qui pose un état, est idempotente, et s'applique à la
  première vue sans aucune déduplication. C'est ce qui rend sans objet les skews
  bien plus larges mesurés ailleurs : 1253 ms sur `est KO !`, 1750 ms entre deux
  copies d'un `[_FL_]`.
- Un `k` faux ne se détecte pas tout seul, et depuis l'ADR `0006` **rien ne
  l'affiche** : l'overlay n'a pas de vocabulaire pour son propre doute, donc le
  détecteur `lance le sort` (fiable mais couvrant 48 % des tours) sort du
  périmètre V1. La règle de lecture de `k` ci-dessus n'est donc pas une
  précaution parmi d'autres — c'est la **seule** défense du produit contre un
  overlay deux fois trop rapide.
