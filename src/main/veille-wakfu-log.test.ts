import { strictEqual } from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import { VeilleWakfuLog, wakfuLogLisible } from './veille-wakfu-log.ts';

const dossier = mkdtempSync(join(tmpdir(), 'wakfu-memo-logs-'));

describe('un wakfu.log lisible est trouvé', () => {
  it('un dossier sans fichier de log — Wakfu jamais lancé — ne compte pas', () => {
    strictEqual(wakfuLogLisible(join(dossier, 'wakfu.log')), false);
  });

  it('rien à surveiller : le chemin n’a pas été trouvé', () => {
    strictEqual(wakfuLogLisible(null), false);
  });

  it('un dossier au lieu d’un fichier ne compte pas', () => {
    strictEqual(wakfuLogLisible(dossier), false);
  });

  it('un wakfu.log illisible — droits — ne compte pas', () => {
    if (process.getuid?.() === 0) return; // root lit tout : le cas ne se joue pas
    const chemin = join(dossier, 'illisible.log');
    writeFileSync(chemin, 'x');
    chmodSync(chemin, 0o000);
    strictEqual(wakfuLogLisible(chemin), false);
    chmodSync(chemin, 0o644);
  });

  it('ne dit rien de la fraîcheur : un fichier intouché reste trouvé', () => {
    const chemin = join(dossier, 'wakfu.log');
    writeFileSync(chemin, '');
    const vieux = new Date('2020-01-01T00:00:00Z');
    // A six-year-old `wakfu.log` is still a `wakfu.log` that was found.
    utimesSync(chemin, vieux, vieux);
    strictEqual(wakfuLogLisible(chemin), true);
  });
});

describe('la veille sur le fichier retenu', () => {
  it('annonce trouvé puis perdu, sans repasser deux fois le même état', () => {
    const chemin = join(dossier, 'veille.log');
    const annonces: boolean[] = [];
    const veille = new VeilleWakfuLog((trouve) => annonces.push(trouve));

    veille.suivre(chemin);
    strictEqual(veille.trouve, false);

    writeFileSync(chemin, '');
    veille.suivre(chemin); // même chemin : simple réévaluation
    strictEqual(veille.trouve, true);

    rmSync(chemin);
    veille.suivre(null); // le dossier désigné est retiré
    strictEqual(veille.trouve, false);
    veille.arreter();

    // The first `suivre` finds nothing, so it announces nothing new.
    strictEqual(annonces.join(), 'true,false');
  });
});

after(() => rmSync(dossier, { recursive: true, force: true }));
