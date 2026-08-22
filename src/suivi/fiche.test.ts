import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Composition } from '../domaine/composition.ts';
import { lire, WAKFU_LOG_ALTERNANCE } from '../echantillons/echantillons.ts';
import type { EvenementDeLog } from '../logs/evenements.ts';
import { analyser, decouperEnCombats } from '../logs/session.ts';
import type { Strat } from '../persistance/strats.ts';
import { ficheDuTour } from './fiche.ts';
import { type EtatDuSuivi, suivreLeCombat } from './suivi-du-tour.ts';

const NOZADAH: Strat = {
  id: 's1',
  nom: 'Nozadah',
  emplacements: [
    { id: 'e1', classe: 'iop', couleur: 'rouge' },
    { id: 'e2', classe: 'eniripsa', couleur: 'jaune' },
    { id: 'e3', classe: 'cra', couleur: 'vert' },
  ],
  tours: [
    { global: [{ t: 'Placement' }], consignes: { e1: [{ t: 'entre en dernier' }] } },
    { note: '(TP SUR HUPPER)', consignes: { e2: [{ t: 'soin de zone' }] } },
  ],
};

const COMPOSITION: Composition = NOZADAH.emplacements;

const combattant = (nom: string, breed: number, classe: 'iop' | 'eniripsa'): EvenementDeLog => ({
  type: 'combattant',
  fightId: '1',
  nom,
  breed,
  classe,
  idEntite: nom,
  controleParIA: false,
  obstacleId: -1,
  position: '0, 0, 0',
});
const frontiere: EvenementDeLog = { type: 'frontiereDeTour', secondes: 0 };

/** A combat with the Iop and the Eniripsa: the Crâ's Emplacement is absent. */
const duo = (...suite: EvenementDeLog[]): EtatDuSuivi =>
  suivreLeCombat(
    [combattant('PJ1', 8, 'iop'), combattant('PJ2', 7, 'eniripsa'), ...suite],
    COMPOSITION,
    { clientsEngages: 1 },
  );

describe('hors combat, la fiche est celle du Tour 1', () => {
  it('aucune Mise en avant, et rien de grisé', () => {
    const fiche = ficheDuTour(NOZADAH, null);

    strictEqual(fiche.tour, 1);
    // The whole result of #18: the appearance of the Mise en avant is the only
    // sign that a combat is alive. Out of combat there is no Liaison, so no
    // Emplacement is known absent.
    deepStrictEqual(
      fiche.lignes.map((ligne) => [ligne.enAvant, ligne.inactif]),
      [
        [false, false],
        [false, false],
        [false, false],
      ],
    );
  });

  it('un combat refermé est indistinguable de « pas de combat »', () => {
    // `End fight` brings the fiche back to Tour 1 through the same door as the
    // launch: one code path for both.
    const referme = duo(frontiere, frontiere, frontiere, { type: 'finDeCombat', fightId: '1' });
    strictEqual(referme.tourCourant, 2);

    const fiche = ficheDuTour(NOZADAH, referme);
    strictEqual(fiche.tour, 1);
    strictEqual(
      fiche.lignes.some((ligne) => ligne.enAvant || ligne.inactif),
      false,
    );
  });

  it('la fiche porte ce que le Tour contient, Consignes vides comprises', () => {
    const fiche = ficheDuTour(NOZADAH, null);

    deepStrictEqual(
      fiche.lignes.map((ligne) => ligne.consigne.map((segment) => segment.t).join('')),
      ['entre en dernier', '', ''],
    );
    deepStrictEqual(fiche.global, [{ t: 'Placement' }]);
    strictEqual(fiche.note, null);
    strictEqual(fiche.audelaDe, null);
  });
});

describe('en combat', () => {
  it('la Mise en avant est sur le Rang où la Rotation est arrivée, une seule ligne', () => {
    const fiche = ficheDuTour(NOZADAH, duo());

    deepStrictEqual(
      fiche.lignes.map((ligne) => ligne.enAvant),
      [true, false, false],
    );
  });

  it('elle avance d’une ligne par Frontière de tour, et le Tour change au bouclage', () => {
    const avance = (frontieres: number): string => {
      const fiche = ficheDuTour(NOZADAH, duo(...Array(frontieres).fill(frontiere)));
      const enAvant = fiche.lignes.find((ligne) => ligne.enAvant);
      return `T${fiche.tour}/rang ${enAvant?.rang}`;
    };

    // Two active Emplacements out of three: the Rotation never stops on the
    // absent one, and the Tour changes when it comes back to the lowest Rang.
    strictEqual(avance(0), 'T1/rang 1');
    strictEqual(avance(1), 'T1/rang 2');
    strictEqual(avance(2), 'T2/rang 1');
    strictEqual(avance(3), 'T2/rang 2');
    strictEqual(avance(4), 'T3/rang 1');
  });

  it('l’Emplacement absent et l’Emplacement tombé sont grisés pareil', () => {
    const absent = ficheDuTour(NOZADAH, duo());
    // The Crâ has nobody in this combat: Rang 3 is greyed, and nothing says why.
    deepStrictEqual(
      absent.lignes.map((ligne) => ligne.inactif),
      [false, false, true],
    );

    const tombe = ficheDuTour(NOZADAH, duo({ type: 'transition', forme: 'ko', nom: 'PJ2' }));
    deepStrictEqual(
      tombe.lignes.map((ligne) => ligne.inactif),
      [false, true, true],
    );

    const releve = ficheDuTour(
      NOZADAH,
      duo(
        { type: 'transition', forme: 'ko', nom: 'PJ2' },
        { type: 'transition', forme: 'reanime', nom: 'PJ2' },
      ),
    );
    deepStrictEqual(
      releve.lignes.map((ligne) => ligne.inactif),
      [false, false, true],
    );
  });

  it('le Tour donne sa note en pied, et elle n’est pas du texte riche', () => {
    const fiche = ficheDuTour(NOZADAH, duo(frontiere));
    strictEqual(fiche.tour, 1);

    const auDeuxieme = ficheDuTour(NOZADAH, duo(frontiere, frontiere));
    strictEqual(auDeuxieme.tour, 2);
    strictEqual(auDeuxieme.note, '(TP SUR HUPPER)');
    deepStrictEqual(auDeuxieme.global, []);
  });
});

describe('au-delà du dernier Tour écrit', () => {
  it('la Strat s’arrête, le combat continue, et les lignes restent vides', () => {
    // Two Tours written, four turns played: the only admission ADR `0006`
    // leaves standing, because it is a fact and not a doubt.
    const fiche = ficheDuTour(NOZADAH, duo(frontiere, frontiere, frontiere, frontiere));

    strictEqual(fiche.tour, 3);
    strictEqual(fiche.audelaDe, 2);
    strictEqual(fiche.lignes.length, 3);
    deepStrictEqual(
      fiche.lignes.map((ligne) => ligne.consigne),
      [[], [], []],
    );
    // And the Mise en avant is still there: the Rotation has not stopped.
    strictEqual(
      fiche.lignes.some((ligne) => ligne.enAvant),
      true,
    );
  });
});

describe('la règle unique : l’Overlay dessine ce que la Strat contient', () => {
  it('aucun Tour donne T1 et des lignes vides, sans une phrase', () => {
    const vide: Strat = { ...NOZADAH, tours: [] };

    const horsCombat = ficheDuTour(vide, null);
    strictEqual(horsCombat.tour, 1);
    strictEqual(horsCombat.lignes.length, 3);
    // No overflow: nothing is being gone past. "If the Strat is too empty,
    // then…" would reopen ADR `0006` through the window.
    strictEqual(horsCombat.audelaDe, null);

    strictEqual(ficheDuTour(vide, duo(frontiere, frontiere, frontiere)).audelaDe, null);
  });

  it('aucun Emplacement donne l’en-tête seul', () => {
    const fiche = ficheDuTour({ ...NOZADAH, emplacements: [] }, null);
    deepStrictEqual(fiche.lignes, []);
    strictEqual(fiche.tour, 1);
    strictEqual(fiche.nom, 'Nozadah');
  });

  it('une Strat entièrement vide se dessine quand même', () => {
    const fiche = ficheDuTour({ id: 's', nom: '', emplacements: [], tours: [] }, null);
    deepStrictEqual(fiche.lignes, []);
    deepStrictEqual(fiche.global, []);
    strictEqual(fiche.note, null);
    strictEqual(fiche.audelaDe, null);
  });
});

describe('un combat rejoué depuis un échantillon', () => {
  /**
   * `alternance`, the only sample checked against turns counted by hand: three
   * full rounds at two characters, so six turns. Replayed event by event, the
   * Mise en avant must walk down the lines and the Tour change on each wrap.
   */
  const EQUIPE: Strat = {
    id: 's',
    nom: 'alternance',
    emplacements: [
      { id: 'a', classe: 'eniripsa', couleur: 'rouge' },
      { id: 'b', classe: 'enutrof', couleur: 'bleu' },
    ],
    tours: [{ consignes: {} }, { consignes: {} }],
  };

  it('la Mise en avant avance ligne par ligne, et le Tour au bouclage', () => {
    const evenements = analyser(lire(WAKFU_LOG_ALTERNANCE));
    const combat = decouperEnCombats(evenements).combats.find((c) => c.fightId === '1552052456');
    if (combat === undefined) throw new Error('le combat de l’échantillon a disparu');

    // Replaying is calling the same pure function on a longer prefix — which is
    // exactly what the live follow does when `k` rises (ADR `0009`).
    const etapes: string[] = [];
    for (let jusqua = 1; jusqua <= combat.evenements.length; jusqua += 1) {
      const suivi = suivreLeCombat(combat.evenements.slice(0, jusqua), EQUIPE.emplacements);
      const fiche = ficheDuTour(EQUIPE, suivi);
      const enAvant = fiche.lignes.find((ligne) => ligne.enAvant);
      const dit = `T${fiche.tour}/${enAvant?.rang ?? '-'}${fiche.audelaDe === null ? '' : '+'}`;
      if (etapes[etapes.length - 1] !== dit) etapes.push(dit);
    }

    deepStrictEqual(etapes, [
      // Before the `[_FL_]` burst there is no Liaison and no Mise en avant.
      'T1/-',
      'T1/1',
      'T1/2',
      // Six turns, two Emplacements: three wraps, and the Strat holds two Tours,
      // so the third one is past its end.
      'T2/1',
      'T2/2',
      'T3/1+',
      'T3/2+',
      'T4/1+',
      // `End fight`: back to the fiche of Tour 1, without a tint.
      'T1/-',
    ]);
  });
});
