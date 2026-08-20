# La Préférence de liaison est indexée sur le Personnage, pas sur la composition

Quand un Conflit d'attribution se résout — deux Éca du Roster pour deux
Emplacements Éca de la Strat — ce qu'on mémorise est un triplet
`(Strat, Personnage) → Emplacement` : « dans *Ombre Épaisse*, Damdam est le
rouge ». Ces triplets vivent en **liste plate dans `roster.json`**.

Le réflexe inverse était d'indexer sur la **composition du combat** — le
multi-ensemble des Personnages présents — puisque c'est bien la composition qui
fait naître l'ambiguïté. On l'a écarté parce que ça reposerait la question à
chaque composition inédite : farmer le même donjon avec un partenaire différent
redemanderait tout, alors que « Damdam est le rouge » répond encore. C'est
exactement la friction que le produit remplace. Ça contredirait aussi #7 et #8,
qui ont tous deux posé que **rien de la composition d'un combat n'est
enregistré**.

Le miroir `(Strat, Emplacement) → Personnage` dit presque la même chose, mais
supporte moins bien l'édition d'une strat : supprimer l'emplacement rouge y
perdrait la carte entière au lieu d'une seule préférence.

Le rangement dans `roster.json` plutôt que `strats.json` suit le sens : c'est de
l'information sur *qui joue quoi*, pas sur le plan du donjon, et elle meurt plus
souvent avec un Personnage qu'avec une Strat. Surtout, ça garde `strats.json`
comme un artefact pur et partageable — le partage par code de la V2 enverra une
strat sans y coller les préférences personnelles de qui l'a écrite.

## Conséquences

- La liste est **plate** parce qu'elle se lit dans les deux sens : par Strat au
  début d'un combat, par Personnage au moment d'une suppression.
- Deux Personnages peuvent viser le même Emplacement — « Damdam est le rouge »
  et un second Éca marqué rouge aussi. C'est une contradiction détectée au
  calcul de la Liaison, qui repose la question et écrase.
- Supprimer un Personnage doit **dire où il était engagé** : « Damdam est le
  rouge dans *Ombre Épaisse* et le bleu dans *Dragon Cochon* ». Nom de strat plus
  Couleur, la seule identité qu'un Emplacement porte depuis l'ADR 0003.
- Le mot **exception** est abandonné : il suggérait une résolution attachée à un
  cas de figure. Indexée ainsi, la chose est une **préférence** durable.
