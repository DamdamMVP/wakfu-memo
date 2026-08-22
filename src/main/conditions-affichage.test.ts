import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AUCUNE,
  CONDITIONS,
  type Conditions,
  conditionsManquantes,
  EtatConditions,
  overlayDessine,
} from './conditions-affichage.ts';

const TOUTES: Conditions = {
  affichageDemande: true,
  logsTrouves: true,
  fenetreWakfu: true,
  stratChoisie: true,
};

describe('les quatre conditions d’affichage', () => {
  it('ne dessine l’Overlay que si les quatre sont vraies ensemble', () => {
    strictEqual(overlayDessine(TOUTES), true);
    for (const nom of CONDITIONS) {
      strictEqual(overlayDessine({ ...TOUTES, [nom]: false }), false, nom);
    }
  });

  it('énumère les manquantes dans l’ordre gelé du Socle d’état (ADR 0014)', () => {
    deepStrictEqual(conditionsManquantes(AUCUNE), [
      'affichageDemande',
      'logsTrouves',
      'fenetreWakfu',
      'stratChoisie',
    ]);
    deepStrictEqual(conditionsManquantes({ ...TOUTES, logsTrouves: false, stratChoisie: false }), [
      'logsTrouves',
      'stratChoisie',
    ]);
  });

  it('les logs trouvés sont la deuxième ligne, entre l’interrupteur et la fenêtre', () => {
    strictEqual(CONDITIONS[1], 'logsTrouves');
  });
});

describe('l’état vivant des conditions', () => {
  it('part de rien et ne dessine pas', () => {
    const etat = new EtatConditions();
    strictEqual(etat.dessine, false);
    deepStrictEqual(etat.valeurs, AUCUNE);
  });

  it('ne prévient que sur un vrai changement', () => {
    const etat = new EtatConditions();
    const vus: boolean[] = [];
    etat.surChangement((_, dessine) => vus.push(dessine));

    etat.poser('affichageDemande', true);
    etat.poser('affichageDemande', true);
    etat.poser('logsTrouves', true);
    etat.poser('fenetreWakfu', true);
    etat.poser('stratChoisie', true);

    deepStrictEqual(vus, [false, false, false, true]);
  });

  it('éteint l’Overlay dès qu’une condition retombe — le wakfu.log perdu en pleine partie', () => {
    const etat = new EtatConditions(TOUTES);
    strictEqual(etat.dessine, true);

    etat.poser('logsTrouves', false);

    strictEqual(etat.dessine, false);
    deepStrictEqual(etat.manquantes, ['logsTrouves']);
  });

  it('se désabonne', () => {
    const etat = new EtatConditions();
    let appels = 0;
    const stop = etat.surChangement(() => appels++);
    etat.poser('affichageDemande', true);
    stop();
    etat.poser('logsTrouves', true);
    strictEqual(appels, 1);
  });
});
