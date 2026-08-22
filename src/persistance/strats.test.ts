import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { rangDe } from '../domaine/composition.ts';
import { HEXA_DE_COULEUR } from '../domaine/palettes.ts';
import type { Brut } from './fichier-versionne.ts';
import { compositionDe, FORME_STRATS, MAX_EMPLACEMENTS } from './strats.ts';

const strat = (emplacements: unknown[], tours: unknown[] = []) => ({
  schema: 1,
  strats: [{ id: 's1', nom: 'Ombre Épaisse', emplacements, tours }],
});

describe('strats.json', () => {
  it('fait un aller-retour fidèle sur la forme gelée', () => {
    const brut = strat(
      [{ id: 'e1', classe: 'ecaflip', couleur: HEXA_DE_COULEUR.rouge }],
      [
        {
          global: [{ t: 'Phase de burst', c: '#ef5350' }],
          note: 'TP SUR HUPPER',
          consignes: { e1: [{ t: 'oeil de taupe + ' }, { t: 'tir critique', c: '#e8c33c' }] },
        },
      ],
    );

    deepStrictEqual(FORME_STRATS.ecrire(FORME_STRATS.lire(brut), brut), {
      strats: [
        {
          id: 's1',
          nom: 'Ombre Épaisse',
          emplacements: [{ id: 'e1', classe: 'ecaflip', couleur: HEXA_DE_COULEUR.rouge }],
          tours: [
            {
              global: [{ t: 'Phase de burst', c: '#ef5350' }],
              note: 'TP SUR HUPPER',
              consignes: { e1: [{ t: 'oeil de taupe + ' }, { t: 'tir critique', c: '#e8c33c' }] },
            },
          ],
        },
      ],
    });
  });

  it('parle la Couleur en clair en mémoire, et en hexadécimal sur le disque', () => {
    const brut = strat([{ id: 'e1', classe: 'iop', couleur: HEXA_DE_COULEUR.gris }]);
    const { strats } = FORME_STRATS.lire(brut);

    strictEqual(strats[0]?.emplacements[0]?.couleur, 'gris');
    const ecrit = (FORME_STRATS.ecrire({ strats }, brut)['strats'] as Brut[])[0] as Brut;
    deepStrictEqual((ecrit['emplacements'] as Brut[])[0], {
      id: 'e1',
      classe: 'iop',
      couleur: '#a3a8b0',
    });
  });

  it('rend une Couleur en doublon ou hors palette unique dans la Strat', () => {
    const { strats } = FORME_STRATS.lire(
      strat([
        { id: 'e1', classe: 'ecaflip', couleur: HEXA_DE_COULEUR.rouge },
        { id: 'e2', classe: 'ecaflip', couleur: HEXA_DE_COULEUR.rouge },
        { id: 'e3', classe: 'iop', couleur: '#c0ffee' },
      ]),
    );
    const couleurs = strats[0]?.emplacements.map((emplacement) => emplacement.couleur) ?? [];

    strictEqual(couleurs[0], 'rouge');
    strictEqual(new Set(couleurs).size, 3);
  });

  it('coupe au-delà de six Emplacements', () => {
    const sept = Array.from({ length: 7 }, (_, index) => ({
      id: `e${index}`,
      classe: 'iop',
      couleur: HEXA_DE_COULEUR.rouge,
    }));

    strictEqual(FORME_STRATS.lire(strat(sept)).strats[0]?.emplacements.length, MAX_EMPLACEMENTS);
  });

  it('jette une Consigne qui vise un Emplacement disparu', () => {
    const { strats } = FORME_STRATS.lire(
      strat(
        [{ id: 'e1', classe: 'iop', couleur: HEXA_DE_COULEUR.bleu }],
        [{ consignes: { e1: [{ t: 'tacle' }], e404: [{ t: 'orpheline' }] } }],
      ),
    );

    deepStrictEqual(Object.keys(strats[0]?.tours[0]?.consignes ?? {}), ['e1']);
  });

  it('dit une Consigne vide par une clé absente, jamais par un tableau vide', () => {
    const brut = strat(
      [{ id: 'e1', classe: 'iop', couleur: HEXA_DE_COULEUR.bleu }],
      [{ global: [], note: '   ', consignes: { e1: [] } }],
    );
    const { strats } = FORME_STRATS.lire(brut);
    const tour = strats[0]?.tours[0];

    strictEqual(tour?.global, undefined);
    strictEqual(tour?.note, undefined);
    deepStrictEqual(tour?.consignes, {});
    deepStrictEqual((FORME_STRATS.ecrire({ strats }, brut)['strats'] as Brut[])[0], {
      id: 's1',
      nom: 'Ombre Épaisse',
      emplacements: [{ id: 'e1', classe: 'iop', couleur: HEXA_DE_COULEUR.bleu }],
      tours: [{ consignes: {} }],
    });
  });

  it('retire une teinte de texte hors palette sans perdre le texte', () => {
    const { strats } = FORME_STRATS.lire(
      strat(
        [{ id: 'e1', classe: 'iop', couleur: HEXA_DE_COULEUR.bleu }],
        [{ consignes: { e1: [{ t: 'tacle', c: '#c0ffee' }, { t: '' }, 'pas un segment'] } }],
      ),
    );

    deepStrictEqual(strats[0]?.tours[0]?.consignes['e1'], [{ t: 'tacle' }]);
  });

  it('ne stocke ni le Rang ni le numéro de Tour : ce sont des positions', () => {
    const brut = strat(
      [
        { id: 'e1', classe: 'iop', couleur: HEXA_DE_COULEUR.rouge, rang: 2 },
        { id: 'e2', classe: 'cra', couleur: HEXA_DE_COULEUR.vert, rang: 1 },
      ],
      [{ numero: 1, consignes: {} }],
    );
    const texte = JSON.stringify(FORME_STRATS.ecrire(FORME_STRATS.lire(brut), brut));

    ok(!texte.includes('rang'));
    ok(!texte.includes('numero'));
  });

  it('donne au suivi la Composition qu’il attend, Rangs compris', () => {
    const { strats } = FORME_STRATS.lire(
      strat([
        { id: 'e1', classe: 'ecaflip', couleur: HEXA_DE_COULEUR.rouge },
        { id: 'e2', classe: 'cra', couleur: HEXA_DE_COULEUR.vert },
      ]),
    );
    const strat1 = strats[0];
    if (strat1 === undefined) throw new Error('strat absente');
    const composition = compositionDe(strat1);

    // Le Rang est la place dans la Composition, et rien d'autre.
    strictEqual(rangDe(composition, composition[1] as never), 2);
    deepStrictEqual(
      composition.map((emplacement) => emplacement.couleur),
      ['rouge', 'vert'],
    );
  });
});
