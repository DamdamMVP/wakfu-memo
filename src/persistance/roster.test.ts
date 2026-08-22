import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FORME_ROSTER } from './roster.ts';

const brut = {
  schema: 1,
  profils: [{ id: 'p1', nom: 'moi', estMoi: true }],
  personnages: [
    { id: 'c1', profilId: 'p1', nom: 'Damdam', classe: 'ecaflip', idEntite: '11379827' },
  ],
  ignores: [{ idEntite: '10662067', nomVu: 'Madamedame' }],
  preferences: [{ stratId: 's1', personnageId: 'c1', emplacementId: 'e1' }],
};

describe('roster.json', () => {
  it('fait un aller-retour fidèle sur la forme gelée', () => {
    deepStrictEqual(FORME_ROSTER.ecrire(FORME_ROSTER.lire(brut), brut), {
      profils: [{ id: 'p1', nom: 'moi', estMoi: true }],
      personnages: [
        { id: 'c1', profilId: 'p1', nom: 'Damdam', classe: 'ecaflip', idEntite: '11379827' },
      ],
      ignores: [{ idEntite: '10662067', nomVu: 'Madamedame' }],
      preferences: [{ stratId: 's1', personnageId: 'c1', emplacementId: 'e1' }],
    });
  });

  it('garde une Préférence dont la Strat est inconnue de ce fichier', () => {
    // `strats.json` peut être refusé ou mis de côté au même démarrage : purger
    // ici perdrait des Préférences pour une raison qui n'en est pas une.
    const roster = FORME_ROSTER.lire(brut);
    strictEqual(roster.preferences.length, 1);
    strictEqual(roster.preferences[0]?.stratId, 's1');
  });

  it('laisse tomber un Personnage sans Profil vivant, et ses Préférences avec', () => {
    const roster = FORME_ROSTER.lire({
      ...brut,
      personnages: [
        ...brut.personnages,
        { id: 'c2', profilId: 'parti', nom: 'Fantôme', classe: 'iop', idEntite: null },
      ],
      preferences: [
        ...brut.preferences,
        { stratId: 's1', personnageId: 'c2', emplacementId: 'e2' },
      ],
    });

    deepStrictEqual(
      roster.personnages.map((personnage) => personnage.id),
      ['c1'],
    );
    deepStrictEqual(
      roster.preferences.map((preference) => preference.personnageId),
      ['c1'],
    );
  });

  it('laisse tomber un Personnage dont la classe est inconnue', () => {
    const roster = FORME_ROSTER.lire({
      ...brut,
      personnages: [{ id: 'c9', profilId: 'p1', nom: 'Damdam', classe: 'desincarne' }],
    });

    deepStrictEqual(roster.personnages, []);
  });

  it('garantit un « moi » et un seul', () => {
    const sansMoi = FORME_ROSTER.lire({ schema: 1, profils: [{ id: 'p2', nom: 'Ana' }] });
    strictEqual(sansMoi.profils.filter((profil) => profil.estMoi).length, 1);
    strictEqual(sansMoi.profils[0]?.nom, 'moi');

    const deuxMoi = FORME_ROSTER.lire({
      schema: 1,
      profils: [
        { id: 'p1', nom: 'moi', estMoi: true },
        { id: 'p2', nom: 'Ana', estMoi: true },
      ],
    });
    deepStrictEqual(
      deuxMoi.profils.map((profil) => profil.estMoi),
      [true, false],
    );
  });

  it('ne laisse pas deux Personnages porter le même ID d’entité', () => {
    const roster = FORME_ROSTER.lire({
      ...brut,
      personnages: [
        { id: 'c1', profilId: 'p1', nom: 'Damdam', classe: 'ecaflip', idEntite: '11379827' },
        { id: 'c2', profilId: 'p1', nom: 'Damdambis', classe: 'iop', idEntite: '11379827' },
      ],
    });

    deepStrictEqual(
      roster.personnages.map((personnage) => personnage.idEntite),
      ['11379827', null],
    );
  });

  it('garde l’ID d’entité en chaîne, même retapé en nombre', () => {
    const roster = FORME_ROSTER.lire({
      ...brut,
      personnages: [{ id: 'c1', profilId: 'p1', nom: 'D', classe: 'cra', idEntite: 11379827 }],
    });

    strictEqual(roster.personnages[0]?.idEntite, '11379827');
  });

  it('un défaut sans fichier, c’est « moi » et rien d’autre', () => {
    const roster = FORME_ROSTER.defauts();
    strictEqual(roster.profils.length, 1);
    strictEqual(roster.profils[0]?.estMoi, true);
    deepStrictEqual(roster.personnages, []);
  });
});
