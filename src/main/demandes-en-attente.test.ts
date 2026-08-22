import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Combattant } from '../logs/evenements.ts';
import type { Roster } from '../persistance/roster.ts';
import type { EtatDuSuivi } from '../suivi/suivi-du-tour.ts';
import { type DemandeDAjout, DemandesEnAttente, demandesDuCombat } from './demandes-en-attente.ts';

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

/* ------------------------------------------ ce qu'un combat a à demander -- */

const combattant = (
  idEntite: string,
  nom: string,
  classe: Combattant['classe'],
  controleParIA = false,
): Combattant => ({
  type: 'combattant',
  fightId: '1',
  nom,
  breed: 6,
  classe,
  idEntite,
  controleParIA,
  obstacleId: -1,
  position: '0, 0, 0',
});

/** Seul `roster` compte ici : le reste de l'état du suivi n'est pas lu. */
const combatAvec = (...roster: Combattant[]): EtatDuSuivi => ({ roster }) as unknown as EtatDuSuivi;

const rosterVide: Roster = { profils: [], personnages: [], ignores: [], preferences: [] };

describe('ce qu’un combat a à demander', () => {
  it('hors combat, rien', () => {
    deepStrictEqual(demandesDuCombat(null, rosterVide), []);
  });

  it('tout combattant joué que le Roster ne connaît pas', () => {
    const demandes = demandesDuCombat(
      combatAvec(
        combattant('5513', 'Nozadah', 'ecaflip'),
        combattant('5514', 'Nozaheal', 'eniripsa'),
      ),
      rosterVide,
    );
    deepStrictEqual(demandes, [
      { idEntite: '5513', nom: 'Nozadah', classe: 'ecaflip' },
      { idEntite: '5514', nom: 'Nozaheal', classe: 'eniripsa' },
    ]);
  });

  it('ni les monstres, ni les Invocations : `isControlledByAI` et la Classe', () => {
    const demandes = demandesDuCombat(
      combatAvec(
        // Un monstre : contrôlé par l'IA, et son `breed` ne nomme aucune Classe.
        combattant('900', 'Moogrron', null, true),
        // Une Invocation : le client la compte comme non contrôlée, mais son
        // `breed` est à quatre chiffres et ne donne pas de Classe.
        combattant('901', 'Bouftou', null),
        combattant('5513', 'Nozadah', 'ecaflip'),
      ),
      rosterVide,
    );
    deepStrictEqual(ids(demandes), ['5513']);
  });

  it('ni un Personnage déjà enregistré, ni un Personnage ignoré', () => {
    const demandes = demandesDuCombat(
      combatAvec(
        combattant('4021', 'Damdam', 'ecaflip'),
        combattant('10662067', 'Madamedame', 'eniripsa'),
        combattant('5513', 'Nozadah', 'ecaflip'),
      ),
      {
        ...rosterVide,
        personnages: [
          { id: 'c1', profilId: 'p1', nom: 'Damdam', classe: 'ecaflip', idEntite: '4021' },
          // Une saisie manuelle : sans ID d'entité, elle ne répond de personne.
          { id: 'c2', profilId: 'p1', nom: 'Nozadah', classe: 'ecaflip', idEntite: null },
        ],
        ignores: [{ idEntite: '10662067', nomVu: 'Madamedame' }],
      },
    );
    // `Nozadah` reste demandé : le nom saisi ne vaut pas identité, seul l'ID le
    // fait (ADR `0002`). C'est le rattachement qui les réunira.
    deepStrictEqual(ids(demandes), ['5513']);
  });

  it('un combattant vu deux fois n’est demandé qu’une fois', () => {
    const demandes = demandesDuCombat(
      combatAvec(
        combattant('5513', 'Nozadah', 'ecaflip'),
        combattant('5513', 'Nozadah', 'ecaflip'),
      ),
      rosterVide,
    );
    deepStrictEqual(ids(demandes), ['5513']);
  });
});
