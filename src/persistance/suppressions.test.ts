import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { REGLAGES_PAR_DEFAUT } from './reglages.ts';
import {
  type Etat,
  engagements,
  ignorer,
  nePlusIgnorer,
  supprimerEmplacement,
  supprimerPersonnage,
  supprimerProfil,
  supprimerStrat,
} from './suppressions.ts';

const etat = (): Etat => ({
  reglages: { ...REGLAGES_PAR_DEFAUT, stratChoisie: 'ombre' },
  roster: {
    profils: [
      { id: 'p1', nom: 'moi', estMoi: true },
      { id: 'p2', nom: 'Ana', estMoi: false },
    ],
    personnages: [
      { id: 'c1', profilId: 'p1', nom: 'Damdam', classe: 'ecaflip', idEntite: '11379827' },
      { id: 'c2', profilId: 'p2', nom: 'Anaosa', classe: 'osamodas', idEntite: '10662067' },
    ],
    ignores: [],
    preferences: [
      { stratId: 'ombre', personnageId: 'c1', emplacementId: 'e1' },
      { stratId: 'dragon', personnageId: 'c1', emplacementId: 'd2' },
      { stratId: 'ombre', personnageId: 'c2', emplacementId: 'e2' },
    ],
  },
  strats: {
    strats: [
      {
        id: 'ombre',
        nom: 'Ombre Épaisse',
        emplacements: [
          { id: 'e1', classe: 'ecaflip', couleur: 'rouge' },
          { id: 'e2', classe: 'osamodas', couleur: 'vert' },
        ],
        tours: [
          { consignes: { e1: [{ t: 'tacle' }], e2: [{ t: 'gobgob' }] } },
          { consignes: { e1: [{ t: 'burst' }] } },
        ],
      },
      {
        id: 'dragon',
        nom: 'Dragon Cochon',
        emplacements: [{ id: 'd2', classe: 'ecaflip', couleur: 'bleu' }],
        tours: [{ consignes: {} }],
      },
    ],
  },
});

describe('les suppressions', () => {
  it('disent où un Personnage est engagé, par nom de strat et par Couleur', () => {
    deepStrictEqual(
      engagements(etat(), 'c1').map(
        (engagement) => `${engagement.couleur} dans ${engagement.stratNom}`,
      ),
      ['rouge dans Ombre Épaisse', 'bleu dans Dragon Cochon'],
    );
  });

  it('ignorent une Préférence qui vise une Strat ou un Emplacement disparu', () => {
    const avant = etat();
    const orpheline: Etat = {
      ...avant,
      roster: {
        ...avant.roster,
        preferences: [
          ...avant.roster.preferences,
          { stratId: 'partie', personnageId: 'c1', emplacementId: 'e9' },
        ],
      },
    };

    strictEqual(engagements(orpheline, 'c1').length, 2);
  });

  it('un Personnage emporte ses Préférences, et rien de plus', () => {
    const { etat: apres, engagements: perdus } = supprimerPersonnage(etat(), 'c1');

    strictEqual(perdus.length, 2);
    deepStrictEqual(
      apres.roster.personnages.map((personnage) => personnage.id),
      ['c2'],
    );
    deepStrictEqual(
      apres.roster.preferences.map((preference) => preference.personnageId),
      ['c2'],
    );
    // Supprimer n'est pas ignorer : rien n'a été ajouté aux ignorés, donc le
    // Personnage sera reproposé au combat suivant.
    deepStrictEqual(apres.roster.ignores, []);
    deepStrictEqual(apres.strats, etat().strats);
  });

  it('un Profil emporte ses Personnages, et « moi » ne se supprime pas', () => {
    const { etat: apres, personnages } = supprimerProfil(etat(), 'p2');

    deepStrictEqual(
      personnages.map((personnage) => personnage.nom),
      ['Anaosa'],
    );
    deepStrictEqual(
      apres.roster.profils.map((profil) => profil.id),
      ['p1'],
    );
    deepStrictEqual(
      apres.roster.preferences.map((preference) => preference.personnageId),
      ['c1', 'c1'],
    );
    throws(() => supprimerProfil(etat(), 'p1'), /pas supprimable/);
  });

  it('un Emplacement emporte ses Consignes et les Préférences qui le visent', () => {
    const {
      etat: apres,
      consignesPerdues,
      preferencesPerdues,
    } = supprimerEmplacement(etat(), 'ombre', 'e1');

    strictEqual(consignesPerdues, 2);
    strictEqual(preferencesPerdues, 1);
    const ombre = apres.strats.strats.find((strat) => strat.id === 'ombre');
    deepStrictEqual(
      ombre?.emplacements.map((emplacement) => emplacement.id),
      ['e2'],
    );
    deepStrictEqual(
      ombre?.tours.map((tour) => Object.keys(tour.consignes)),
      [['e2'], []],
    );
    // L'autre Strat garde la sienne : la cascade ne déborde pas.
    strictEqual(
      apres.roster.preferences.some((preference) => preference.stratId === 'dragon'),
      true,
    );
  });

  it('une Strat emporte ses Tours, ses Préférences, et passe le choix à la suivante', () => {
    const {
      etat: apres,
      tours,
      emplacements,
      estChoisie,
      choixPasseA,
    } = supprimerStrat(etat(), 'ombre');

    strictEqual(tours, 2);
    strictEqual(emplacements, 2);
    deepStrictEqual(
      apres.strats.strats.map((strat) => strat.id),
      ['dragon'],
    );
    deepStrictEqual(
      apres.roster.preferences.map((preference) => preference.stratId),
      ['dragon'],
    );
    // ADR 0012 : le choix ne tombe pas dans le vide tant qu'une Strat reste,
    // sans quoi la suppression éteindrait l'Overlay sans le nommer.
    strictEqual(estChoisie, true);
    deepStrictEqual(choixPasseA, { id: 'dragon', nom: 'Dragon Cochon' });
    strictEqual(apres.reglages.stratChoisie, 'dragon');
  });

  it('la dernière Strat supprimée laisse le choix vide, et le dit', () => {
    const uneSeule = supprimerStrat(etat(), 'dragon').etat;
    const { etat: apres, estChoisie, choixPasseA } = supprimerStrat(uneSeule, 'ombre');

    strictEqual(estChoisie, true);
    strictEqual(choixPasseA, null);
    strictEqual(apres.reglages.stratChoisie, null);
  });

  it('ne touchent pas la sélection quand ce n’est pas la Strat choisie', () => {
    const { etat: apres, estChoisie, choixPasseA } = supprimerStrat(etat(), 'dragon');

    strictEqual(apres.reglages.stratChoisie, 'ombre');
    strictEqual(estChoisie, false);
    strictEqual(choixPasseA, null);
  });

  it('ignorer se pose sur l’ID d’entité, et se retire', () => {
    const deux = ignorer(ignorer(etat(), '10662067', 'Madamedame'), '10662067', 'Madamedame');

    deepStrictEqual(deux.roster.ignores, [{ idEntite: '10662067', nomVu: 'Madamedame' }]);
    deepStrictEqual(nePlusIgnorer(deux, '10662067').roster.ignores, []);
  });
});
