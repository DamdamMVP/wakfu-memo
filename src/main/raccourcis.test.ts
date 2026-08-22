import { strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { combinaisonRetenue, DEFAUT_VERROU, EFFACABLE } from './raccourcis-regles.ts';

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
});
