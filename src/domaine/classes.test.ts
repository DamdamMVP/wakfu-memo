import { doesNotReject, strictEqual } from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { CLASSES, classeDuBreed, estClasse } from './classes.ts';

describe('les Classes', () => {
  it('sont dix-huit, toutes distinctes', () => {
    strictEqual(CLASSES.length, 18);
    strictEqual(new Set(CLASSES).size, 18);
  });

  it('traduisent les `breed` observés dans les captures', () => {
    strictEqual(classeDuBreed(2), 'osamodas');
    strictEqual(classeDuBreed(3), 'enutrof');
    strictEqual(classeDuBreed(6), 'ecaflip');
    strictEqual(classeDuBreed(7), 'eniripsa');
    strictEqual(classeDuBreed(19), 'huppermage');
  });

  it('ont un trou : 17 n’est pas jouable et 20 n’existe pas', () => {
    strictEqual(classeDuBreed(17), null, 'le Désincarné n’est pas une classe jouable');
    strictEqual(classeDuBreed(20), null, 'il n’existe pas de `breed` 20');
    strictEqual(classeDuBreed(15), 'ouginak');
    strictEqual(classeDuBreed(18), 'eliotrope');
  });

  it('ignorent un `breed` de monstre ou d’Invocation, sans se plaindre', () => {
    for (const breed of [1381, 1620, 2335, 4755]) strictEqual(classeDuBreed(breed), null);
  });

  it('ne reconnaissent pas une clé inventée', () => {
    strictEqual(estClasse('desincarne'), false);
    strictEqual(estClasse('ecaflip'), true);
  });

  it('ont chacune son portrait, nommé par clé', async () => {
    // Une erreur d'index était invisible, une erreur de nom se voit : ce test la
    // fait voir. Quatorze des dix-huit l'étaient avant le renommage.
    const icones = join(import.meta.dirname, '..', '..', 'icons');
    for (const classe of CLASSES) {
      await doesNotReject(access(join(icones, `${classe}.png`)), `icons/${classe}.png`);
    }
  });
});
