import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { COULEURS } from './composition.ts';
import { couleurDeHexa, HEXA_DE_COULEUR, TEINTES_TEXTE } from './palettes.ts';
import { normaliserSegments, texteBrut } from './texte-riche.ts';

describe('les palettes', () => {
  it('sont deux, fermées, et sans teinte commune par accident', () => {
    const couleurs = Object.values(HEXA_DE_COULEUR);
    strictEqual(couleurs.length, 6);
    strictEqual(TEINTES_TEXTE.length, 10);
    strictEqual(new Set([...couleurs, ...TEINTES_TEXTE]).size, 16);
  });

  it('donnent un hexa à chacune des six Couleurs, et rien de plus', () => {
    deepStrictEqual(Object.keys(HEXA_DE_COULEUR), [...COULEURS]);
  });

  it('retrouvent la Couleur derrière un hexa stocké', () => {
    strictEqual(couleurDeHexa('#ff5252'), 'rouge');
    strictEqual(couleurDeHexa('#A3A8B0'), 'gris');
    strictEqual(couleurDeHexa('#c0ffee'), null);
    strictEqual(couleurDeHexa(42), null);
  });
});

describe('le texte riche', () => {
  it('est une liste plate : un segment, un texte, au plus une couleur', () => {
    deepStrictEqual(
      normaliserSegments([
        { t: 'oeil de taupe + ' },
        { t: 'tir critique', c: '#e8c33c' },
        { t: 'gras ?', c: '#e8c33c', gras: true },
      ]),
      [
        { t: 'oeil de taupe + ' },
        { t: 'tir critique', c: '#e8c33c' },
        // L'attribut de trop tombe : jamais de gras, d'italique ni de souligné.
        { t: 'gras ?', c: '#e8c33c' },
      ],
    );
  });

  it('jette ce qui n’est pas un segment, et le texte vide', () => {
    deepStrictEqual(normaliserSegments([{ t: '' }, 'texte nu', null, 3, { c: '#ef5350' }]), []);
    deepStrictEqual(normaliserSegments('pas une liste'), []);
  });

  it('rend le texte sans ses couleurs', () => {
    strictEqual(texteBrut(normaliserSegments([{ t: 'a' }, { t: 'b', c: '#ef5350' }])), 'ab');
  });
});
