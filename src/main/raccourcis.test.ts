import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  combinaisonAcceptable,
  combinaisonDeLaFrappe,
  combinaisonRetenue,
  DEFAUT_VERROU,
  EFFACABLE,
  estNomDeRaccourci,
} from './raccourcis-regles.ts';

const frappe = (
  key: string,
  modificateurs: Partial<{
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
  }> = {},
) => ({
  key,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...modificateurs,
});

describe('les trois raccourcis globaux', () => {
  it('celui du verrou ne s’efface pas : vidé, il retombe sur son défaut', () => {
    strictEqual(EFFACABLE.verrou, false);
    strictEqual(combinaisonRetenue('verrou', null), DEFAUT_VERROU);
    strictEqual(combinaisonRetenue('verrou', ''), DEFAUT_VERROU);
    strictEqual(combinaisonRetenue('verrou', '   '), DEFAUT_VERROU);
  });

  it('les deux autres se laissent vider', () => {
    strictEqual(combinaisonRetenue('overlay', null), null);
    strictEqual(combinaisonRetenue('fenetre', ''), null);
  });

  it('garde la combinaison choisie, verrou compris', () => {
    strictEqual(combinaisonRetenue('verrou', 'Ctrl+Alt+K'), 'Ctrl+Alt+K');
    strictEqual(combinaisonRetenue('overlay', ' Ctrl+Alt+W '), 'Ctrl+Alt+W');
  });

  it('n’accepte que ce qui porte un modificateur ET une autre touche', () => {
    strictEqual(combinaisonAcceptable('Ctrl+Alt+W'), true);
    strictEqual(combinaisonAcceptable('Shift+F5'), true);
    strictEqual(combinaisonAcceptable('W'), false);
    strictEqual(combinaisonAcceptable('F5'), false);
    strictEqual(combinaisonAcceptable('Ctrl+Alt'), false);
    strictEqual(combinaisonAcceptable('Ctrl+'), false);
  });

  /**
   * Une combinaison nue prendrait la touche à TOUTES les applications, jeu
   * compris : `W` en raccourci global, c'est la lettre W perdue en pleine
   * discussion. Elle est refusée à la capture, et refusée à nouveau ici — une
   * surface n'est jamais le dernier mot.
   */
  it('refuse une combinaison nue, quelle qu’en soit la source', () => {
    strictEqual(combinaisonRetenue('overlay', 'W'), null);
    strictEqual(combinaisonRetenue('fenetre', 'F5'), null);
    // Et le verrou, qui ne s'efface pas, retombe sur son défaut plutôt que de
    // rester sans retour possible.
    strictEqual(combinaisonRetenue('verrou', 'K'), DEFAUT_VERROU);
  });
});

describe('la capture d’une combinaison', () => {
  it('écrit les modificateurs dans un ordre fixe', () => {
    strictEqual(combinaisonDeLaFrappe(frappe('w', { altKey: true, ctrlKey: true })), 'Ctrl+Alt+W');
    strictEqual(
      combinaisonDeLaFrappe(frappe('k', { shiftKey: true, ctrlKey: true, metaKey: true })),
      'Ctrl+Shift+Super+K',
    );
  });

  it('garde le nom des touches qui en ont un', () => {
    strictEqual(combinaisonDeLaFrappe(frappe('F5', { ctrlKey: true })), 'Ctrl+F5');
    strictEqual(combinaisonDeLaFrappe(frappe('ArrowUp', { altKey: true })), 'Alt+ArrowUp');
  });

  it('n’a encore rien capturé tant qu’un modificateur est tenu seul', () => {
    strictEqual(combinaisonDeLaFrappe(frappe('Control', { ctrlKey: true })), null);
    strictEqual(combinaisonDeLaFrappe(frappe('Shift', { shiftKey: true })), null);
  });

  it('refuse une touche nue : le jeu la perdrait', () => {
    strictEqual(combinaisonDeLaFrappe(frappe('w')), null);
    strictEqual(combinaisonDeLaFrappe(frappe('F5')), null);
  });
});

describe('le nom d’un raccourci, tel qu’une surface l’envoie', () => {
  it('ne reconnaît que les trois', () => {
    deepStrictEqual(['overlay', 'verrou', 'fenetre', 'autre', 42].map(estNomDeRaccourci), [
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});
