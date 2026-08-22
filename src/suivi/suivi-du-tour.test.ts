import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Classe } from '../domaine/classes.ts';
import type { Composition } from '../domaine/composition.ts';
import {
  CAPTURES_EN_DEUX_FICHIERS,
  evenementsDesBornes,
  evenementsDuChat,
} from '../echantillons/echantillons.ts';
import type { Combattant, EvenementDeLog } from '../logs/evenements.ts';
import { clientsEngages, suivreLeCombat } from './suivi-du-tour.ts';

const combattant = (
  nom: string,
  classe: Classe | null,
  extra: Partial<Combattant> = {},
): EvenementDeLog => ({
  type: 'combattant',
  fightId: '1',
  nom,
  breed: 0,
  classe,
  idEntite: nom,
  controleParIA: classe === null,
  obstacleId: -1,
  position: '0, 0, 0',
  ...extra,
});

const frontiere: EvenementDeLog = { type: 'frontiereDeTour', secondes: 0 };
const ko = (nom: string): EvenementDeLog => ({ type: 'transition', forme: 'ko', nom });
const reanime = (nom: string): EvenementDeLog => ({ type: 'transition', forme: 'reanime', nom });

const TRIO: Composition = [
  { classe: 'ecaflip', couleur: 'rouge' },
  { classe: 'osamodas', couleur: 'bleu' },
  { classe: 'iop', couleur: 'vert' },
];

const parRang = (liaison: ReadonlyMap<number, Combattant>): string[] =>
  [...liaison].map(([rang, c]) => `${rang}:${c.nom}`);

/** The expected counts, checked by hand on the files. */
const ATTENDUS = {
  'duo-2026-08-20': { frontieres: 31, tours: 16 },
  'duel-2026-08-20': { frontieres: 12, tours: 6 },
  'pack4-2026-08-20': { frontieres: 16, tours: 8 },
  'revive-2026-08-20': { frontieres: 6, tours: 3 },
  'invoc-2026-08-20': { frontieres: 4, tours: 2 },
};

describe('`k`, le nombre de clients engagés', () => {
  for (const capture of CAPTURES_EN_DEUX_FICHIERS) {
    it(`vaut 2 sur ${capture}, lu sur ses bornes de combat`, () => {
      strictEqual(clientsEngages(evenementsDesBornes(capture)), 2);
    });
  }

  it('ne se lit pas sur le nombre d’entités jouées, qui n’arrivent pas ensemble', () => {
    // The `duo` burst: the monster and PJ2 first, PJ1 only 1.7 s later. Counting
    // the `isControlledByAI=false` entities of the first burst would give `k=1` —
    // the overlay twice too fast, the worst failure mode. The maximum of the
    // copies, on the other hand, reaches 2 on the monster.
    const rafale: EvenementDeLog[] = [
      combattant('Sac à patates', null),
      combattant('PJ2', 'osamodas'),
      combattant('Sac à patates', null),
      combattant('PJ2', 'osamodas'),
      combattant('PJ1', 'ecaflip'),
      combattant('PJ1', 'ecaflip'),
    ];
    strictEqual(clientsEngages(rafale.slice(0, 4)), 2);
    strictEqual(clientsEngages(rafale), 2);
    strictEqual(new Set(rafale.map((e) => e.type === 'combattant' && e.nom)).size, 3);
  });

  it('deux monstres homonymes ne le font pas doubler', () => {
    // `pack4` carries two `Moogrron` of the same `breed`, and its ID d'entité are
    // scrambled to `[ENTITE]` for everyone: confusing them would give `k=4` for
    // two clients, an overlay twice too slow.
    const bornes = evenementsDesBornes('pack4-2026-08-20');
    const moogrron = bornes.filter((e) => e.type === 'combattant' && e.nom === 'Moogrron');
    strictEqual(moogrron.length, 4);
    deepStrictEqual(
      [...new Set(moogrron.map((e) => e.type === 'combattant' && e.idEntite))],
      ['ENTITE'],
    );
    strictEqual(clientsEngages(bornes), 2);
  });

  it('un combat sans aucune ligne `[_FL_]` vaut 1, jamais 0', () => {
    strictEqual(clientsEngages([]), 1);
  });
});

describe('le comptage des Frontières de tour', () => {
  for (const capture of CAPTURES_EN_DEUX_FICHIERS) {
    it(`${capture} : autant de fins de tour que de tours joués`, () => {
      const evenements = evenementsDuChat(capture);
      const { frontieres, tours } = ATTENDUS[capture];

      strictEqual(evenements.filter((e) => e.type === 'frontiereDeTour').length, frontieres);
      strictEqual(suivreLeCombat(evenements, [], { clientsEngages: 2 }).finsDeTour, tours);
    });

    it(`${capture} : un \`k\` mal lu compte deux fois trop`, () => {
      // The product's only defence against the overlay twice too fast, and
      // nothing would display it (ADR `0006`). Were `k` read as 1, here is the
      // count.
      strictEqual(
        suivreLeCombat(evenementsDuChat(capture), [], { clientsEngages: 1 }).finsDeTour,
        ATTENDUS[capture].frontieres,
      );
    });
  }

  it('la frontière orpheline de `duo` est absorbée', () => {
    // 31 lines for 16 turns: an odd number, because the first one has a single
    // copy. A cut into absolute packets of `k` would drift for the whole rest of
    // the combat; the rule is relative to the last accepted Frontière, and it
    // absorbs it exactly.
    const evenements = evenementsDuChat('duo-2026-08-20');
    strictEqual(evenements.filter((e) => e.type === 'frontiereDeTour').length % 2, 1);
    strictEqual(suivreLeCombat(evenements, [], { clientsEngages: 2 }).finsDeTour, 16);
  });

  it('la première frontière est une fin de tour, pas la fin du placement', () => {
    strictEqual(suivreLeCombat([combattant('PJ1', 'ecaflip'), frontiere], TRIO).finsDeTour, 1);
  });

  it('un combat peut ne contenir aucune frontière', () => {
    const etat = suivreLeCombat([combattant('PJ1', 'ecaflip')], TRIO);
    strictEqual(etat.finsDeTour, 0);
    strictEqual(etat.tourCourant, 1);
  });
});

describe('la Rotation et le Tour courant', () => {
  const trio: EvenementDeLog[] = [
    combattant('PJ1', 'ecaflip'),
    combattant('PJ2', 'osamodas'),
    combattant('PJ3', 'iop'),
  ];

  it('la Liaison se calcule par Classe, et le Rang est la place dans la Composition', () => {
    const etat = suivreLeCombat(trio, TRIO);
    deepStrictEqual(parRang(etat.liaison), ['1:PJ1', '2:PJ2', '3:PJ3']);
    strictEqual(etat.rangCourant, 1);
    strictEqual(etat.tourCourant, 1);
  });

  it('le Tour courant change quand la Rotation revient au plus petit Rang actif', () => {
    const etat = suivreLeCombat([...trio, frontiere, frontiere, frontiere, frontiere], TRIO);
    strictEqual(etat.avances, 4);
    strictEqual(etat.rangCourant, 2);
    strictEqual(etat.tourCourant, 2);
  });

  it('la Rotation franchit un Emplacement absent sans l’attendre', () => {
    // No Osamodas in this combat: Rang 2 is inactive, and stopping on it would
    // block the tracking forever — a monster never emits a Frontière.
    const sansOsamodas = [combattant('PJ1', 'ecaflip'), combattant('PJ3', 'iop')];
    const etat = suivreLeCombat([...sansOsamodas, frontiere], TRIO);
    deepStrictEqual(etat.rangsActifs, [1, 3]);
    strictEqual(etat.rangCourant, 3);
    strictEqual(etat.tourCourant, 1);
  });

  it('un tombé sort de la Rotation, et une réanimation le fait rentrer', () => {
    // The case measured on `revive2`: the reviver plays BEFORE the revived one in
    // the declared order, so "just after the current unit" — the game's insertion
    // rule — is exactly the revived one's place. The first Frontière skips Rang 3,
    // fallen; the second stops on it, and the revived one's Frontière is not lost.
    const etat = suivreLeCombat([...trio, ko('PJ3'), frontiere, reanime('PJ3'), frontiere], TRIO);
    deepStrictEqual(etat.rangsActifs, [1, 2, 3]);
    strictEqual(etat.rangCourant, 3);
    strictEqual(etat.avances, 2);
    strictEqual(etat.tourCourant, 1);
  });

  it('limite connue : un réanimé au-dessous de la Rotation attend le Tour suivant', () => {
    // The case no capture covers, and that the declared Rang cannot express: the
    // reviver plays AFTER the revived one in the declared order, so the game
    // inserts the revived one at the end of the round while the Rotation has
    // already gone past. It loops and gives the Rang back on the next Tour.
    const etat = suivreLeCombat([...trio, ko('PJ2'), frontiere, reanime('PJ2'), frontiere], TRIO);
    deepStrictEqual(etat.rangsActifs, [1, 2, 3]);
    strictEqual(etat.rangCourant, 1);
    strictEqual(etat.tourCourant, 2);
  });

  it('`est hors-combat !` ne fait pas tomber un Emplacement', () => {
    // That is a monster leaving. Personnages leave on `est KO !`, and confusing
    // the two shapes would drop an Emplacement for the death of a homonymous
    // monster.
    const etat = suivreLeCombat(
      [...trio, { type: 'transition', forme: 'horsCombat', nom: 'PJ2' }],
      TRIO,
    );
    deepStrictEqual(etat.rangsActifs, [1, 2, 3]);
  });

  it('la Rotation ne s’arrête jamais sur un monstre ni sur une Invocation', () => {
    const etat = suivreLeCombat(
      [
        combattant('PJ1', 'ecaflip'),
        combattant('Moogrron', null),
        combattant('Gobgob', null, { obstacleId: 1 }),
        frontiere,
      ],
      TRIO,
    );
    deepStrictEqual(etat.rangsActifs, [1]);
    strictEqual(etat.rangCourant, 1);
    strictEqual(etat.tourCourant, 2);
  });

  it('sans aucun Emplacement actif, rien n’avance', () => {
    const etat = suivreLeCombat([combattant('Moogrron', null), frontiere], TRIO);
    strictEqual(etat.finsDeTour, 1);
    strictEqual(etat.avances, 0);
    strictEqual(etat.rangCourant, null);
    strictEqual(etat.tourCourant, 1);
  });

  it('un Conflit est tranché par le Rang le plus bas', () => {
    // Two Ecaflips for two Ecaflip Emplacements: the Liaison follows the combat
    // arrival order. That is what ADR `0007` prescribes for a caught-up combat,
    // and the Échange par clic stays the fix.
    const deuxEcaflips: Composition = [
      { classe: 'ecaflip', couleur: 'rouge' },
      { classe: 'ecaflip', couleur: 'jaune' },
    ];
    const etat = suivreLeCombat(
      [combattant('PJ9', 'ecaflip'), combattant('PJ1', 'ecaflip')],
      deuxEcaflips,
    );
    deepStrictEqual(parRang(etat.liaison), ['1:PJ9', '2:PJ1']);
  });
});
