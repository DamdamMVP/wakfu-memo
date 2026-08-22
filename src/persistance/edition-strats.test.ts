import { deepStrictEqual, notStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { rangDe } from '../domaine/composition.ts';
import { type CommandeEdition, editer, nomDeCopie } from './edition-strats.ts';
import { REGLAGES_PAR_DEFAUT } from './reglages.ts';
import { rosterParDefaut } from './roster.ts';
import type { Strat } from './strats.ts';
import type { Etat } from './suppressions.ts';

const OMBRE: Strat = {
  id: 'ombre',
  nom: 'Ombre Épaisse',
  emplacements: [
    { id: 'e1', classe: 'iop', couleur: 'rouge' },
    { id: 'e2', classe: 'eniripsa', couleur: 'jaune' },
    { id: 'e3', classe: 'cra', couleur: 'vert' },
  ],
  tours: [
    { global: [{ t: 'Placement' }], consignes: { e1: [{ t: 'entre en dernier' }] } },
    { note: 'TP SUR HUPPER', consignes: { e2: [{ t: 'soin de zone' }] } },
  ],
};

const etat = (strats: readonly Strat[] = [OMBRE], choisie: string | null = 'ombre'): Etat => ({
  reglages: { ...REGLAGES_PAR_DEFAUT, stratChoisie: choisie },
  roster: rosterParDefaut(),
  strats: { strats },
});

const appliquer = (depart: Etat, ...commandes: readonly CommandeEdition[]): Etat =>
  commandes.reduce((courant, commande) => editer(courant, commande).etat, depart);

const laStrat = (etatCourant: Etat, id = 'ombre'): Strat => {
  const trouvee = etatCourant.strats.strats.find((strat) => strat.id === id);
  ok(trouvee !== undefined, `la Strat ${id} a disparu`);
  return trouvee;
};

describe('l’édition d’une Strat', () => {
  it('crée une Strat vide, et la première créée est choisie d’office', () => {
    const vide = etat([], null);
    const { etat: apres, stratId } = editer(vide, { sorte: 'creer' });

    ok(stratId !== null);
    deepStrictEqual(
      apres.strats.strats.map((strat) => strat.nom),
      ['Nouvelle strat'],
    );
    strictEqual(apres.reglages.stratChoisie, stratId);

    // La deuxième ne vole pas le choix.
    const { etat: deux, stratId: second } = editer(apres, { sorte: 'creer' });
    strictEqual(deux.reglages.stratChoisie, stratId);
    notStrictEqual(second, stratId);
  });

  it('choisit la Strat créée quand l’id retenu ne désigne plus rien', () => {
    const { etat: apres, stratId } = editer(etat([], 'partie-en-fumee'), { sorte: 'creer' });

    strictEqual(apres.reglages.stratChoisie, stratId);
  });

  it('renomme, et un nom vide retombe sur « Sans nom »', () => {
    strictEqual(
      laStrat(appliquer(etat(), { sorte: 'renommer', stratId: 'ombre', nom: '  Nozadah  ' })).nom,
      'Nozadah',
    );
    strictEqual(
      laStrat(appliquer(etat(), { sorte: 'renommer', stratId: 'ombre', nom: '   ' })).nom,
      'Sans nom',
    );
  });

  it('duplique juste après l’original, avec des Emplacements neufs et les Consignes suivies', () => {
    const { etat: apres, stratId } = editer(etat(), { sorte: 'dupliquer', stratId: 'ombre' });
    ok(stratId !== null);
    const copie = laStrat(apres, stratId);

    deepStrictEqual(
      apres.strats.strats.map((strat) => strat.id),
      ['ombre', stratId],
    );
    strictEqual(copie.nom, 'Ombre Épaisse (copie)');
    // Des ids neufs, et les Consignes remappées dessus : une clef qui viserait
    // l'original serait orpheline à la relecture.
    strictEqual(
      copie.emplacements.some((emplacement) => emplacement.id === 'e1'),
      false,
    );
    const premier = copie.emplacements[0]?.id ?? '';
    deepStrictEqual(copie.tours[0]?.consignes, { [premier]: [{ t: 'entre en dernier' }] });
    deepStrictEqual(copie.tours[1]?.note, 'TP SUR HUPPER');
    // Dupliquer ne choisit pas la copie.
    strictEqual(apres.reglages.stratChoisie, 'ombre');
  });

  it('propose « (copie) » puis « (copie 2) », sans jamais imposer l’unicité', () => {
    strictEqual(nomDeCopie([], 'Nozadah'), 'Nozadah (copie)');
    strictEqual(nomDeCopie([{ ...OMBRE, nom: 'Nozadah (copie)' }], 'Nozadah'), 'Nozadah (copie 2)');
  });

  it('ajoute un Emplacement sur la première Couleur libre, et s’arrête à six', () => {
    let courant = etat();
    for (let ajout = 0; ajout < 5; ajout += 1) {
      courant = appliquer(courant, {
        sorte: 'ajouter-emplacement',
        stratId: 'ombre',
        classe: 'feca',
      });
    }
    const strat = laStrat(courant);

    strictEqual(strat.emplacements.length, 6);
    deepStrictEqual(
      strat.emplacements.map((emplacement) => emplacement.couleur),
      ['rouge', 'jaune', 'vert', 'bleu', 'rose', 'gris'],
    );
  });

  it('échange la Couleur déjà portée, plutôt que d’accepter un doublon', () => {
    const strat = laStrat(
      appliquer(etat(), {
        sorte: 'poser-couleur',
        stratId: 'ombre',
        emplacementId: 'e1',
        couleur: 'vert',
      }),
    );

    deepStrictEqual(
      strat.emplacements.map((emplacement) => [emplacement.id, emplacement.couleur]),
      [
        ['e1', 'vert'],
        ['e2', 'jaune'],
        ['e3', 'rouge'],
      ],
    );
  });

  it('déplacer un Emplacement change son Rang, et les Consignes suivent', () => {
    const strat = laStrat(
      appliquer(etat(), {
        sorte: 'deplacer-emplacement',
        stratId: 'ombre',
        emplacementId: 'e1',
        vers: 2,
      }),
    );

    deepStrictEqual(
      strat.emplacements.map((emplacement) => emplacement.id),
      ['e2', 'e3', 'e1'],
    );
    const iop = strat.emplacements[2];
    ok(iop !== undefined);
    strictEqual(rangDe(strat.emplacements, iop), 3);
    // La Consigne n'a pas bougé : elle est indexée par id, pas par position.
    deepStrictEqual(strat.tours[0]?.consignes, { e1: [{ t: 'entre en dernier' }] });
  });

  it('insère au déposer, il n’échange pas deux places', () => {
    const strat = laStrat(
      appliquer(etat(), {
        sorte: 'deplacer-emplacement',
        stratId: 'ombre',
        emplacementId: 'e3',
        vers: 0,
      }),
    );

    deepStrictEqual(
      strat.emplacements.map((emplacement) => emplacement.id),
      ['e3', 'e1', 'e2'],
    );
  });

  it('supprimer un Emplacement emporte ses Consignes dans tous les Tours', () => {
    const strat = laStrat(
      appliquer(etat(), {
        sorte: 'supprimer-emplacement',
        stratId: 'ombre',
        emplacementId: 'e1',
      }),
    );

    deepStrictEqual(
      strat.emplacements.map((emplacement) => emplacement.id),
      ['e2', 'e3'],
    );
    deepStrictEqual(
      strat.tours.map((tour) => Object.keys(tour.consignes)),
      [[], ['e2']],
    );
  });

  it('ajoute et retire un Tour par la fin comme par le milieu', () => {
    const trois = appliquer(etat(), { sorte: 'ajouter-tour', stratId: 'ombre' });
    strictEqual(laStrat(trois).tours.length, 3);
    deepStrictEqual(laStrat(trois).tours[2], { consignes: {} });

    const sansLePremier = appliquer(trois, { sorte: 'supprimer-tour', stratId: 'ombre', tour: 0 });
    deepStrictEqual(
      laStrat(sansLePremier).tours.map((tour) => tour.note ?? null),
      ['TP SUR HUPPER', null],
    );
  });

  it('déplacer un Tour le renumérote, et ses Consignes le suivent', () => {
    // Le cas qui motive le geste : on supprime le Tour 2 par erreur, on en
    // rajoute un — il arrive en dernier — et on le ramène à sa place.
    const ampute = appliquer(etat(), { sorte: 'supprimer-tour', stratId: 'ombre', tour: 1 });
    strictEqual(laStrat(ampute).tours.length, 1);

    const rajoute = appliquer(
      ampute,
      { sorte: 'ajouter-tour', stratId: 'ombre' },
      {
        sorte: 'poser-consigne',
        stratId: 'ombre',
        tour: 1,
        emplacementId: 'e2',
        segments: [{ t: 'soin de zone' }],
      },
      { sorte: 'ajouter-tour', stratId: 'ombre' },
      { sorte: 'deplacer-tour', stratId: 'ombre', tour: 1, vers: 2 },
    );

    deepStrictEqual(
      laStrat(rajoute).tours.map((tour) => Object.keys(tour.consignes)),
      [['e1'], [], ['e2']],
    );
  });

  it('déposer un Tour insère, il n’échange pas deux places', () => {
    const trois = appliquer(etat(), { sorte: 'ajouter-tour', stratId: 'ombre' });
    const bouge = appliquer(trois, { sorte: 'deplacer-tour', stratId: 'ombre', tour: 2, vers: 0 });

    deepStrictEqual(
      laStrat(bouge).tours.map((tour) => Object.keys(tour.consignes).join(',')),
      ['', 'e1', 'e2'],
    );
  });

  it('écrit les trois textes libres, et dit le vide par une clef absente', () => {
    const ecrit = appliquer(
      etat(),
      {
        sorte: 'poser-consigne',
        stratId: 'ombre',
        tour: 0,
        emplacementId: 'e2',
        segments: [{ t: 'soin ' }, { t: 'de zone', c: '#e8c33c' }],
      },
      { sorte: 'poser-global', stratId: 'ombre', tour: 1, segments: [{ t: 'Le boss aggro' }] },
      { sorte: 'poser-note', stratId: 'ombre', tour: 0, note: '  (TP)  ' },
    );

    deepStrictEqual(laStrat(ecrit).tours[0], {
      global: [{ t: 'Placement' }],
      note: '(TP)',
      consignes: {
        e1: [{ t: 'entre en dernier' }],
        e2: [{ t: 'soin ' }, { t: 'de zone', c: '#e8c33c' }],
      },
    });

    const vide = appliquer(
      ecrit,
      { sorte: 'poser-consigne', stratId: 'ombre', tour: 0, emplacementId: 'e1', segments: [] },
      { sorte: 'poser-global', stratId: 'ombre', tour: 0, segments: [] },
      { sorte: 'poser-note', stratId: 'ombre', tour: 0, note: '' },
    );

    deepStrictEqual(laStrat(vide).tours[0], {
      consignes: { e2: [{ t: 'soin ' }, { t: 'de zone', c: '#e8c33c' }] },
    });
  });

  it('répare ce qu’une surface enverrait de travers, sans jamais l’écrire', () => {
    const sale = appliquer(
      etat(),
      // Une teinte hors palette : le texte reste, la couleur tombe.
      {
        sorte: 'poser-consigne',
        stratId: 'ombre',
        tour: 0,
        emplacementId: 'e1',
        segments: [{ t: 'burst', c: '#123456' }, { t: '' }, 'pas un segment'],
      },
    );

    deepStrictEqual(laStrat(sale).tours[0]?.consignes['e1'], [{ t: 'burst' }]);
  });

  it('rend l’état inchangé, et identique, quand la commande vise ce qui n’existe plus', () => {
    const depart = etat();
    const commandes: CommandeEdition[] = [
      { sorte: 'renommer', stratId: 'fantome', nom: 'x' },
      { sorte: 'dupliquer', stratId: 'fantome' },
      { sorte: 'ajouter-emplacement', stratId: 'fantome', classe: 'iop' },
      { sorte: 'poser-classe', stratId: 'ombre', emplacementId: 'fantome', classe: 'iop' },
      { sorte: 'poser-couleur', stratId: 'ombre', emplacementId: 'fantome', couleur: 'rose' },
      { sorte: 'deplacer-emplacement', stratId: 'ombre', emplacementId: 'fantome', vers: 0 },
      { sorte: 'supprimer-tour', stratId: 'ombre', tour: 9 },
      { sorte: 'deplacer-tour', stratId: 'ombre', tour: 9, vers: 0 },
      { sorte: 'deplacer-tour', stratId: 'ombre', tour: 0, vers: 0 },
      {
        sorte: 'poser-consigne',
        stratId: 'ombre',
        tour: 0,
        emplacementId: 'fantome',
        segments: [],
      },
      { sorte: 'poser-note', stratId: 'ombre', tour: 9, note: 'x' },
      { sorte: 'inconnue' },
    ];

    for (const commande of commandes) {
      // Identique par référence : c'est ce qui dit à `Persistance.appliquer`
      // qu'il n'y a rien à écrire.
      strictEqual(editer(depart, commande).etat, depart, commande.sorte);
    }
  });

  it('change la Classe sans changer l’id, donc sans perdre la Consigne', () => {
    const strat = laStrat(
      appliquer(etat(), {
        sorte: 'poser-classe',
        stratId: 'ombre',
        emplacementId: 'e1',
        classe: 'huppermage',
      }),
    );

    deepStrictEqual(strat.emplacements[0], { id: 'e1', classe: 'huppermage', couleur: 'rouge' });
    deepStrictEqual(strat.tours[0]?.consignes['e1'], [{ t: 'entre en dernier' }]);
  });
});
