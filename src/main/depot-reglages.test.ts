import { deepStrictEqual, match, strictEqual } from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  DEFAUTS,
  DepotReglages,
  nomDeMiseDeCote,
  relire,
  SCHEMA_REGLAGES,
} from './depot-reglages.ts';

const dossierNeuf = () => mkdtempSync(join(tmpdir(), 'wakfu-memo-test-'));

describe('relire reglages.json', () => {
  it('sans fichier, ce sont les défauts', () => {
    const { reglages, refuse, corrompu } = relire(null);
    deepStrictEqual(reglages, DEFAUTS);
    strictEqual(refuse, false);
    strictEqual(corrompu, false);
  });

  it('garde les clés inconnues — le sac est tolérant, un lot suivant n’a rien à migrer', () => {
    const { reglages } = relire(
      JSON.stringify({ schema: 1, opacite: 0.8, affichageDemande: true }),
    );
    strictEqual(reglages['opacite'], 0.8);
    strictEqual(reglages['affichageDemande'], true);
    strictEqual(reglages['raccourciVerrou'], DEFAUTS['raccourciVerrou']);
  });

  it('refuse une version plus haute, sans rien écraser', () => {
    const { reglages, refuse } = relire(
      JSON.stringify({ schema: SCHEMA_REGLAGES + 1, affichageDemande: true }),
    );
    strictEqual(refuse, true);
    strictEqual(reglages['affichageDemande'], DEFAUTS['affichageDemande']);
  });

  it('signale un fichier illisible plutôt que de refuser de démarrer', () => {
    strictEqual(relire('{ ceci n’est pas du JSON').corrompu, true);
    strictEqual(relire('[1, 2, 3]').corrompu, true);
  });

  it('date la copie mise de côté', () => {
    match(
      nomDeMiseDeCote(new Date('2026-08-21T14:05:09.000Z')),
      /^reglages\.corrompu-2026-08-21-14-05-09\.json$/,
    );
  });
});

describe('le dépôt sur disque', () => {
  it('fait un aller-retour fidèle, en écrivant atomiquement', () => {
    const dossier = dossierNeuf();
    const depot = new DepotReglages(dossier);
    depot.charger();
    depot.ecrire('affichageDemande', true);
    depot.ecrire('stratChoisie', 'Ombre Épaisse');
    depot.vider();

    const relu = new DepotReglages(dossier);
    relu.charger();
    strictEqual(relu.lire('affichageDemande', false), true);
    strictEqual(relu.lire('stratChoisie', null), 'Ombre Épaisse');
    deepStrictEqual(
      readdirSync(dossier).filter((n) => n.endsWith('.tmp')),
      [],
      'aucun temporaire ne survit',
    );
  });

  it('quitter sans avoir rien changé n’écrit pas le fichier', () => {
    const dossier = dossierNeuf();
    const depot = new DepotReglages(dossier);
    depot.charger();
    depot.vider();
    deepStrictEqual(readdirSync(dossier), []);
  });

  it('met de côté un fichier illisible et repart sur les défauts', () => {
    const dossier = dossierNeuf();
    writeFileSync(join(dossier, 'reglages.json'), 'brrr', 'utf8');

    const depot = new DepotReglages(dossier);
    depot.charger();

    strictEqual(depot.corrompu, true);
    strictEqual(depot.lire('affichageDemande', true), false);
    strictEqual(
      readdirSync(dossier).some((n) => n.startsWith('reglages.corrompu-')),
      true,
    );
  });

  it('n’écrase jamais un fichier d’une version plus haute', () => {
    const dossier = dossierNeuf();
    const futur = JSON.stringify({ schema: SCHEMA_REGLAGES + 1, cadeau: 'du futur' });
    writeFileSync(join(dossier, 'reglages.json'), futur, 'utf8');

    const depot = new DepotReglages(dossier);
    depot.charger();
    strictEqual(depot.refuse, true);

    depot.ecrire('affichageDemande', true);
    depot.vider();

    strictEqual(readFileSync(join(dossier, 'reglages.json'), 'utf8'), futur);
  });
});
