import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type CommandeRoster, editerRoster, nomDeProfilLibre } from './edition-roster.ts';
import { REGLAGES_PAR_DEFAUT } from './reglages.ts';
import type { Personnage, Roster } from './roster.ts';
import type { Strat } from './strats.ts';
import type { Etat } from './suppressions.ts';

const OMBRE: Strat = {
  id: 'ombre',
  nom: 'Ombre Épaisse',
  emplacements: [
    { id: 'e1', classe: 'ecaflip', couleur: 'rouge' },
    { id: 'e2', classe: 'eniripsa', couleur: 'jaune' },
  ],
  tours: [{ consignes: {} }],
};

/**
 * Le jeu de la maquette de #22 : « moi » et un partenaire, trois Personnages
 * confirmés par le log, deux qui attendent leur premier combat — dont
 * l'homonyme exact que l'ADR `0011` purge.
 */
const PERSONNAGES: readonly Personnage[] = [
  { id: 'c1', profilId: 'p1', nom: 'Damdam', classe: 'ecaflip', idEntite: '11379827' },
  { id: 'c4', profilId: 'p1', nom: 'Damdamiop', classe: 'iop', idEntite: null },
  { id: 'c5', profilId: 'p2', nom: 'Nozahael', classe: 'eniripsa', idEntite: null },
  { id: 'c7', profilId: 'p2', nom: 'Nozadah', classe: 'ecaflip', idEntite: null },
];

const roster = (): Roster => ({
  profils: [
    { id: 'p1', nom: 'moi', estMoi: true },
    { id: 'p2', nom: 'Nozadah', estMoi: false },
  ],
  personnages: [...PERSONNAGES],
  ignores: [{ idEntite: '10662067', nomVu: 'Madamedame' }],
  preferences: [
    { stratId: 'ombre', personnageId: 'c1', emplacementId: 'e1' },
    { stratId: 'ombre', personnageId: 'c7', emplacementId: 'e1' },
  ],
});

const etat = (): Etat => ({
  reglages: { ...REGLAGES_PAR_DEFAUT, stratChoisie: 'ombre' },
  roster: roster(),
  strats: { strats: [OMBRE] },
});

const appliquer = (depart: Etat, ...commandes: readonly CommandeRoster[]): Etat =>
  commandes.reduce((courant, commande) => editerRoster(courant, commande).etat, depart);

const noms = (apres: Etat): string[] => apres.roster.personnages.map((p) => p.nom);
const trouver = (apres: Etat, id: string): Personnage | undefined =>
  apres.roster.personnages.find((p) => p.id === id);

describe('les Profils de joueur', () => {
  it('naît avec un nom libre, et l’écran reçoit son id pour le renommer', () => {
    const { etat: apres, profilId } = editerRoster(etat(), { sorte: 'creer-profil' });
    ok(profilId !== null);
    strictEqual(apres.roster.profils.length, 3);
    strictEqual(apres.roster.profils[2]?.nom, 'Nouveau profil');
    strictEqual(apres.roster.profils[2]?.estMoi, false);

    // Le second prend le suivant, et ce n'est pas une contrainte d'unicité.
    const { etat: deux } = editerRoster(apres, { sorte: 'creer-profil' });
    strictEqual(deux.roster.profils[3]?.nom, 'Nouveau profil 2');
    strictEqual(nomDeProfilLibre(deux.roster), 'Nouveau profil 3');
  });

  it('se renomme, et un nom vide garde l’ancien', () => {
    const apres = appliquer(etat(), { sorte: 'renommer-profil', profilId: 'p2', nom: '  Kaboum ' });
    strictEqual(apres.roster.profils[1]?.nom, 'Kaboum');

    const vide = editerRoster(apres, { sorte: 'renommer-profil', profilId: 'p2', nom: '   ' });
    strictEqual(vide.etat, apres);
  });

  it('emporte ses Personnages et leurs Préférences en partant', () => {
    const apres = appliquer(etat(), { sorte: 'supprimer-profil', profilId: 'p2' });
    deepStrictEqual(noms(apres), ['Damdam', 'Damdamiop']);
    deepStrictEqual(
      apres.roster.preferences.map((p) => p.personnageId),
      ['c1'],
    );
  });

  it('refuse « moi » sans lever, parce que l’écran ne l’offre pas', () => {
    const depart = etat();
    strictEqual(editerRoster(depart, { sorte: 'supprimer-profil', profilId: 'p1' }).etat, depart);
    strictEqual(editerRoster(depart, { sorte: 'supprimer-profil', profilId: 'ø' }).etat, depart);
  });
});

describe('la saisie manuelle d’un Personnage', () => {
  it('canonise ce qui est tapé, et naît sans ID d’entité', () => {
    const apres = appliquer(etat(), {
      sorte: 'saisir-personnage',
      profilId: 'p1',
      nom: "s'alu-ca'va",
      classe: 'sram',
    });
    const ne = apres.roster.personnages.at(-1);
    strictEqual(ne?.nom, "S'Alu-Ca'Va");
    strictEqual(ne?.idEntite, null);
    strictEqual(ne?.profilId, 'p1');
  });

  it('refuse le doublon d’un Personnage sans ID, quelle que soit la casse', () => {
    const depart = etat();
    for (const nom of ['Nozadah', 'nozadah', 'NOZADAH', 'Nozadàh']) {
      strictEqual(
        editerRoster(depart, { sorte: 'saisir-personnage', profilId: 'p1', nom, classe: 'iop' })
          .etat,
        depart,
        `« ${nom} » aurait dû être refusé`,
      );
    }
  });

  it('accepte l’homonyme d’un Personnage qui a déjà un ID : ce n’est pas le même cas', () => {
    // « Damdam » est confirmé par le log. Un doublon *sans* ID est une saisie à
    // rattraper ; celui-ci sera purgé par l'ADR 0011 le jour où l'ID s'attache.
    const apres = appliquer(etat(), {
      sorte: 'saisir-personnage',
      profilId: 'p2',
      nom: 'Damdam',
      classe: 'iop',
    });
    strictEqual(apres.roster.personnages.length, 5);
  });

  it('refuse un nom sans aucune lettre, séparateurs compris', () => {
    const depart = etat();
    for (const nom of ['', '  ', "-'-", '42']) {
      strictEqual(
        editerRoster(depart, { sorte: 'saisir-personnage', profilId: 'p1', nom, classe: 'iop' })
          .etat,
        depart,
      );
    }
  });

  it('refuse une classe qui n’en est pas une, et un profil disparu', () => {
    const depart = etat();
    strictEqual(
      editerRoster(depart, {
        sorte: 'saisir-personnage',
        profilId: 'p1',
        nom: 'Zorg',
        classe: 'boufton' as never,
      }).etat,
      depart,
    );
    strictEqual(
      editerRoster(depart, {
        sorte: 'saisir-personnage',
        profilId: 'parti',
        nom: 'Zorg',
        classe: 'iop',
      }).etat,
      depart,
    );
  });

  it('se corrige tant qu’aucun ID ne s’est attaché, et plus jamais après', () => {
    const apres = appliquer(etat(), {
      sorte: 'corriger-personnage',
      personnageId: 'c5',
      nom: 'nozaheal',
      classe: 'eniripsa',
    });
    strictEqual(trouver(apres, 'c5')?.nom, 'Nozaheal');

    // Le log fait foi (ADR 0002) : rien ne corrige un Personnage confirmé.
    const depart = etat();
    strictEqual(
      editerRoster(depart, {
        sorte: 'corriger-personnage',
        personnageId: 'c1',
        nom: 'Autrechose',
        classe: 'iop',
      }).etat,
      depart,
    );
  });

  it('refuse une correction qui fabriquerait un doublon', () => {
    const depart = etat();
    strictEqual(
      editerRoster(depart, {
        sorte: 'corriger-personnage',
        personnageId: 'c5',
        nom: 'nozadah',
        classe: 'eniripsa',
      }).etat,
      depart,
    );
  });

  it('emporte les Préférences du Personnage supprimé, et rien d’autre', () => {
    const apres = appliquer(etat(), { sorte: 'supprimer-personnage', personnageId: 'c7' });
    deepStrictEqual(noms(apres), ['Damdam', 'Damdamiop', 'Nozahael']);
    deepStrictEqual(
      apres.roster.preferences.map((p) => p.personnageId),
      ['c1'],
    );
    // Les Strats ne bougent pas : elles sont écrites contre des Classes.
    deepStrictEqual(apres.strats.strats, [OMBRE]);
  });
});

describe('répondre à une Demande d’ajout', () => {
  it('ajoute le combattant à un Profil, avec le nom et la classe du log', () => {
    const { etat: apres, repondu } = editerRoster(etat(), {
      sorte: 'ajouter-personnage',
      profilId: 'p2',
      idEntite: '5513',
      nom: 'Nozacra',
      classe: 'cra',
    });
    strictEqual(repondu, '5513');
    const ne = apres.roster.personnages.at(-1);
    strictEqual(ne?.idEntite, '5513');
    strictEqual(ne?.classe, 'cra');
  });

  it('purge silencieusement l’homonyme exact sans ID, et ses Préférences', () => {
    // Le « Nozadah » du log identifie l'un des deux : celui saisi à la main n'a
    // plus rien à quoi s'attacher, son pseudo étant pris ailleurs (ADR 0011).
    const apres = appliquer(etat(), {
      sorte: 'ajouter-personnage',
      profilId: 'p2',
      idEntite: '5513',
      nom: 'Nozadah',
      classe: 'ecaflip',
    });
    deepStrictEqual(noms(apres), ['Damdam', 'Damdamiop', 'Nozahael', 'Nozadah']);
    strictEqual(trouver(apres, 'c7'), undefined);
    deepStrictEqual(
      apres.roster.preferences.map((p) => p.personnageId),
      ['c1'],
    );
  });

  it('ne purge que l’exact : la vraie faute de frappe survit au rattachement', () => {
    const apres = appliquer(etat(), {
      sorte: 'ajouter-personnage',
      profilId: 'p2',
      idEntite: '5514',
      nom: 'Nozaheal',
      classe: 'eniripsa',
    });
    // `Nozahael` est toujours là : deux lettres inversées ne sont pas un
    // homonyme, et c'est le rattachement qui les réunit.
    ok(noms(apres).includes('Nozahael'));
  });

  it('rattache l’ID au Personnage qui attendait, et le log écrase ce qui était tapé', () => {
    const { etat: apres, repondu } = editerRoster(etat(), {
      sorte: 'rattacher',
      personnageId: 'c5',
      idEntite: '5514',
      nom: 'Nozaheal',
      classe: 'sram',
    });
    strictEqual(repondu, '5514');
    const rattache = trouver(apres, 'c5');
    strictEqual(rattache?.idEntite, '5514');
    strictEqual(rattache?.nom, 'Nozaheal');
    // Une classe saisie fausse est écrasée, jamais conservée (ADR 0002).
    strictEqual(rattache?.classe, 'sram');
  });

  it('purge l’homonyme au rattachement aussi', () => {
    const apres = appliquer(etat(), {
      sorte: 'rattacher',
      personnageId: 'c5',
      idEntite: '5513',
      nom: 'Nozadah',
      classe: 'ecaflip',
    });
    strictEqual(trouver(apres, 'c7'), undefined);
    strictEqual(trouver(apres, 'c5')?.nom, 'Nozadah');
  });

  it('refuse de rattacher à un Personnage déjà confirmé', () => {
    const depart = etat();
    strictEqual(
      editerRoster(depart, {
        sorte: 'rattacher',
        personnageId: 'c1',
        idEntite: '5513',
        nom: 'Nozadah',
        classe: 'ecaflip',
      }).etat,
      depart,
    );
  });

  it('refuse un ID d’entité déjà porté : répondre deux fois ne dédouble pas', () => {
    const depart = etat();
    strictEqual(
      editerRoster(depart, {
        sorte: 'ajouter-personnage',
        profilId: 'p1',
        idEntite: '11379827',
        nom: 'Damdam',
        classe: 'ecaflip',
      }).etat,
      depart,
    );
  });

  it('ignore un combattant par son ID, et le geste se défait', () => {
    const apres = appliquer(etat(), {
      sorte: 'ignorer',
      idEntite: '5515',
      nomVu: 'Pandacoucou',
    });
    deepStrictEqual(
      apres.roster.ignores.map((i) => i.idEntite),
      ['10662067', '5515'],
    );

    const revenu = appliquer(apres, { sorte: 'ne-plus-ignorer', idEntite: '5515' });
    deepStrictEqual(
      revenu.roster.ignores.map((i) => i.idEntite),
      ['10662067'],
    );
  });

  it('rend l’état identique par référence sur une commande inconnue', () => {
    const depart = etat();
    strictEqual(editerRoster(depart, { sorte: 'inconnue' }).etat, depart);
  });
});

describe('la Préférence de liaison, écrite par l’Échange par clic', () => {
  const preferences = (apres: Etat): string[] =>
    apres.roster.preferences.map(
      (preference) => `${preference.personnageId}@${preference.emplacementId}`,
    );

  it('pose un Personnage sur un Emplacement, et chasse celui qui y était', () => {
    // Le jeu de départ met `c1` ET `c7` sur `e1` : un fichier édité à la main,
    // ou deux versions du même geste. Le premier écrit dessus règle les deux.
    const apres = appliquer(etat(), {
      sorte: 'preferer',
      stratId: 'ombre',
      emplacementId: 'e1',
      personnageId: 'c1',
    });
    deepStrictEqual(preferences(apres), ['c1@e1']);
  });

  it('un Personnage ne tient qu’un Emplacement par Strat', () => {
    const apres = appliquer(
      etat(),
      { sorte: 'preferer', stratId: 'ombre', emplacementId: 'e1', personnageId: 'c1' },
      { sorte: 'preferer', stratId: 'ombre', emplacementId: 'e2', personnageId: 'c1' },
    );
    deepStrictEqual(preferences(apres), ['c1@e2']);
  });

  it('un échange écrit les deux places, et permute vraiment', () => {
    // Le geste tel que le processus principal l'envoie : deux commandes, l'une
    // derrière l'autre, sur l'état que la première a rendu.
    const apres = appliquer(
      etat(),
      { sorte: 'preferer', stratId: 'ombre', emplacementId: 'e1', personnageId: 'c7' },
      { sorte: 'preferer', stratId: 'ombre', emplacementId: 'e2', personnageId: 'c1' },
    );
    deepStrictEqual(preferences(apres), ['c7@e1', 'c1@e2']);
  });

  it('ne réécrit pas ce qui est déjà écrit', () => {
    const depart = appliquer(etat(), {
      sorte: 'preferer',
      stratId: 'ombre',
      emplacementId: 'e1',
      personnageId: 'c1',
    });
    const apres = appliquer(depart, {
      sorte: 'preferer',
      stratId: 'ombre',
      emplacementId: 'e1',
      personnageId: 'c1',
    });
    // Identique par référence : c'est ce qui dit à la persistance de ne rien
    // écrire du tout (ADR `0004`).
    strictEqual(apres.roster, depart.roster);
  });

  it('refuse une Strat, un Emplacement ou un Personnage qui n’existe pas', () => {
    const depart = etat();
    for (const commande of [
      { sorte: 'preferer', stratId: 'partie', emplacementId: 'e1', personnageId: 'c1' },
      { sorte: 'preferer', stratId: 'ombre', emplacementId: 'e9', personnageId: 'c1' },
      { sorte: 'preferer', stratId: 'ombre', emplacementId: 'e1', personnageId: 'c9' },
    ] as const) {
      strictEqual(appliquer(depart, commande).roster, depart.roster);
    }
  });

  it('une Préférence part avec le Personnage qu’elle nomme', () => {
    const apres = appliquer(
      etat(),
      { sorte: 'preferer', stratId: 'ombre', emplacementId: 'e2', personnageId: 'c7' },
      { sorte: 'supprimer-personnage', personnageId: 'c7' },
    );
    deepStrictEqual(preferences(apres), ['c1@e1']);
  });
});
