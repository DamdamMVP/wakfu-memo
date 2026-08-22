import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type DemandeDAjout, DemandesEnAttente } from './demandes-en-attente.ts';

const NOZADAH: DemandeDAjout = { idEntite: '5513', nom: 'Nozadah', classe: 'ecaflip' };
const NOZAHEAL: DemandeDAjout = { idEntite: '5514', nom: 'Nozaheal', classe: 'eniripsa' };
const PASSANT: DemandeDAjout = { idEntite: '5515', nom: 'Pandacoucou', classe: 'pandawa' };

const ids = (liste: readonly DemandeDAjout[]): string[] => liste.map((demande) => demande.idEntite);

describe('les Demandes d’ajout en attente', () => {
  it('part vide, et le dit', () => {
    const attente = new DemandesEnAttente();
    strictEqual(attente.enAttente, false);
    deepStrictEqual(attente.liste, []);
  });

  it('ajoute ce qu’un combat trouve, sans jamais remplacer : la question survit', () => {
    const attente = new DemandesEnAttente();
    ok(attente.poser([NOZADAH, NOZAHEAL]));
    ok(attente.poser([PASSANT]));
    deepStrictEqual(ids(attente.liste), ['5513', '5514', '5515']);
    strictEqual(attente.enAttente, true);
  });

  it('ne repose pas la même question, et ne bouge pas pour rien', () => {
    const attente = new DemandesEnAttente();
    attente.poser([NOZADAH]);
    // Le combat suivant revoit le même combattant : c'est la même question.
    strictEqual(attente.poser([NOZADAH]), false);
    strictEqual(attente.poser([{ ...NOZADAH, nom: 'Autrement' }]), false);
    strictEqual(attente.poser([]), false);
    deepStrictEqual(ids(attente.liste), ['5513']);
  });

  it('dédoublonne le lot lui-même', () => {
    const attente = new DemandesEnAttente();
    attente.poser([NOZADAH, NOZADAH, NOZAHEAL]);
    deepStrictEqual(ids(attente.liste), ['5513', '5514']);
  });

  it('ne retire une question que sur une réponse', () => {
    const attente = new DemandesEnAttente();
    attente.poser([NOZADAH, NOZAHEAL, PASSANT]);
    ok(attente.repondre('5514'));
    deepStrictEqual(ids(attente.liste), ['5513', '5515']);
    // Un id inconnu, ou une commande qui n'a répondu à personne.
    strictEqual(attente.repondre('5514'), false);
    strictEqual(attente.repondre(null), false);
  });

  it('se vide d’un coup, et ne bouge pas si elle est déjà vide', () => {
    const attente = new DemandesEnAttente();
    attente.poser([NOZADAH]);
    ok(attente.vider());
    strictEqual(attente.enAttente, false);
    strictEqual(attente.vider(), false);
  });
});
