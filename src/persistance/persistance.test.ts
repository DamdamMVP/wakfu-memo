/**
 * The three files together, in a real data folder.
 *
 * No migration here: the three schemas are 1, so there is no earlier schema to
 * migrate from. The mechanism — rungs, backup, rewrite — is proven on a test
 * shape in `fichier-versionne.test.ts`, and that is where the real case goes the
 * day a schema moves to 2.
 */

import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { Persistance } from './index.ts';

const dossierNeuf = () => mkdtempSync(join(tmpdir(), 'wakfu-memo-test-'));

const ouvrir = (dossierDonnees: string, options = {}) => {
  const persistance = new Persistance(dossierDonnees, { antiRebondMs: 5, ...options });
  persistance.charger();
  return persistance;
};

describe('la persistance', () => {
  it('fait un aller-retour fidèle sur les trois fichiers', () => {
    const dossier = dossierNeuf();
    const premier = ouvrir(dossier);

    const profil = premier.roster.lire().profils[0];
    if (profil === undefined) throw new Error('le profil « moi » manque');
    premier.roster.ecrire({
      ...premier.roster.lire(),
      personnages: [
        { id: 'c1', profilId: profil.id, nom: 'Damdam', classe: 'ecaflip', idEntite: '11379827' },
      ],
      ignores: [{ idEntite: '10662067', nomVu: 'Madamedame' }],
      preferences: [{ stratId: 's1', personnageId: 'c1', emplacementId: 'e1' }],
    });
    premier.strats.ecrire({
      strats: [
        {
          id: 's1',
          nom: 'Ombre Épaisse',
          emplacements: [{ id: 'e1', classe: 'ecaflip', couleur: 'rouge' }],
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
    premier.modifierReglages({ opacite: 70, stratChoisie: 's1' });
    premier.vider();

    const second = ouvrir(dossier);
    deepStrictEqual(second.etat(), premier.etat());
    deepStrictEqual(second.avertissements, []);
    deepStrictEqual(readdirSync(dossier).sort(), ['reglages.json', 'roster.json', 'strats.json']);
  });

  it('met un fichier corrompu de côté sans toucher aux deux autres', () => {
    const dossier = dossierNeuf();
    const premier = ouvrir(dossier);
    premier.modifierReglages({ opacite: 70 });
    premier.strats.ecrire({
      strats: [{ id: 's1', nom: 'Ombre Épaisse', emplacements: [], tours: [] }],
    });
    premier.vider();
    writeFileSync(join(dossier, 'roster.json'), 'la moitié d’un fich', 'utf8');

    const second = ouvrir(dossier, { maintenant: () => new Date('2026-08-21T14:32:05Z') });

    deepStrictEqual(second.avertissements, [
      {
        sorte: 'mise-de-cote',
        fichier: 'roster.json',
        miseDeCote: 'roster.corrompu-2026-08-21-14-32-05.json',
      },
    ]);
    // Les deux autres sont intacts, et le roster repart sur « moi ».
    strictEqual(second.reglages.lire().opacite, 70);
    strictEqual(second.strats.lire().strats.length, 1);
    strictEqual(second.roster.lire().profils[0]?.nom, 'moi');
    strictEqual(
      readFileSync(join(dossier, 'roster.corrompu-2026-08-21-14-32-05.json'), 'utf8'),
      'la moitié d’un fich',
    );
  });

  it('refuse un fichier d’une version future sans l’écraser', () => {
    const dossier = dossierNeuf();
    const venuDuFutur = '{\n  "schema": 9,\n  "strats": []\n}\n';
    writeFileSync(join(dossier, 'strats.json'), venuDuFutur, 'utf8');

    const persistance = ouvrir(dossier);

    deepStrictEqual(persistance.avertissements, [
      { sorte: 'refus', fichier: 'strats.json', schemaTrouve: 9, schemaConnu: 1 },
    ]);
    strictEqual(persistance.strats.modifiable, false);
    // Les deux autres restent modifiables : un schéma par fichier, c'est tout
    // l'intérêt de ne pas avoir un fichier unique.
    strictEqual(persistance.roster.modifiable, true);
    strictEqual(persistance.reglages.modifiable, true);

    throws(() => persistance.strats.ecrire({ strats: [] }));
    persistance.vider();
    strictEqual(readFileSync(join(dossier, 'strats.json'), 'utf8'), venuDuFutur);
  });

  it('n’écrit que les fichiers qu’une cascade a touchés', () => {
    const dossier = dossierNeuf();
    const persistance = ouvrir(dossier);

    const avant = persistance.etat();
    persistance.appliquer({ ...avant, reglages: { ...avant.reglages, opacite: 55 } });
    persistance.vider();

    deepStrictEqual(readdirSync(dossier), ['reglages.json']);
    strictEqual(ouvrir(dossier).reglages.lire().opacite, 55);
  });

  it('relit sans broncher le reglages.json qu’écrivait le dépôt provisoire', () => {
    const dossier = dossierNeuf();
    // Ce que le Lot 2 posait sur le disque, indentation d'un espace comprise.
    writeFileSync(
      join(dossier, 'reglages.json'),
      `${JSON.stringify(
        {
          schema: 1,
          affichageDemande: true,
          stratChoisie: null,
          dossierLogsManuel: '/home/damdam/wakfu/logs',
          raccourciOverlay: 'Ctrl+Alt+W',
          raccourciVerrou: 'Ctrl+Alt+L',
          raccourciFenetre: null,
        },
        null,
        1,
      )}\n`,
      'utf8',
    );

    const reglages = ouvrir(dossier).reglages.lire();

    strictEqual(reglages.affichageDemande, true);
    strictEqual(reglages.dossierLogsManuel, '/home/damdam/wakfu/logs');
    strictEqual(reglages.raccourciVerrou, 'Ctrl+Alt+L');
    // Et les clés que le Lot 2 ne connaissait pas prennent leur défaut.
    strictEqual(reglages.opacite, 85);
    strictEqual(reglages.onboardingVu, false);
  });
});
