/**
 * LOT 4 TEST BENCH. A Strat sown from code, and it exists for one reason: the
 * Overlay is not drawn without a Strat chosen (ADR `0006`), and the editor that
 * writes one is Lot 5. Without this, the fiche of this lot could not be looked
 * at once.
 *
 * Lot 5 deletes this file. Nothing else imports it, and the content is the
 * fictional one of the #5 and #6 mockups — six Emplacements, seven Tours, so
 * that a combat of twelve turns goes past the last one and the overflow shows.
 */

import type { Classe } from '../domaine/classes.ts';
import type { Couleur } from '../domaine/composition.ts';
import { nouvelId, type Strat, type Tour } from '../persistance/index.ts';

/** `[classe, couleur]`, in Rang order — the Rang being the place in the list. */
const PLACES: readonly [Classe, Couleur][] = [
  ['iop', 'rouge'],
  ['eniripsa', 'jaune'],
  ['osamodas', 'vert'],
  ['cra', 'bleu'],
  ['feca', 'rose'],
  ['xelor', 'gris'],
];

/**
 * `[description globale, [consigne par Rang], note]`. A `null` Consigne is an
 * Emplacement with nothing to do this Tour — the case the fiche has to draw
 * without a word.
 */
const TOURS: readonly [string, readonly (string | null)[], string][] = [
  [
    'Placement haut-droite, personne au contact',
    [
      'entre en dernier',
      'reste à 3 cases',
      'invoque le Tofu',
      'ligne de tir sur le boss',
      'armure sur l’Iop',
      'ne bouge pas',
    ],
    '',
  ],
  [
    'Le boss aggro le plus proche',
    [
      'provoque puis recule de 2',
      'soin de zone si 2 alliés touchés',
      'crapaud sur le add gauche',
      'flèche assaillante',
      'glyphe sous le boss',
      'vol du temps sur le boss',
    ],
    '(TP SUR HUPPER)',
  ],
  [
    'Les adds sortent',
    ['nettoie les adds', null, 'gobgob en poussée', null, 'mur au sud', null],
    '',
  ],
  [
    'Phase de burst',
    [
      'TOUT LÂCHER',
      'buff PA',
      'sacrifie le Tofu',
      'oeil de taupe + tir critique',
      null,
      'PA à l’Iop',
    ],
    '',
  ],
  [
    'Le boss se soigne si un add est vivant',
    [null, null, 'ramène le crapaud', 'tue l’add restant', null, null],
    'ATTENTION : ne pas tuer le boss avant les adds',
  ],
  ['Dernier tiers', ['contact', 'plein soin', null, null, 'armure de groupe', null], ''],
  ['Achever', ['contact', null, null, 'tir', null, null], ''],
];

export function stratDEssai(): Strat {
  const emplacements = PLACES.map(([classe, couleur]) => ({ id: nouvelId(), classe, couleur }));

  const tours: Tour[] = TOURS.map(([global, consignes, note]) => {
    const parEmplacement: Record<string, { t: string }[]> = {};
    consignes.forEach((consigne, index) => {
      const emplacement = emplacements[index];
      if (consigne === null || emplacement === undefined) return;
      parEmplacement[emplacement.id] = [{ t: consigne }];
    });
    return {
      global: [{ t: global }],
      ...(note !== '' ? { note } : {}),
      consignes: parEmplacement,
    };
  });

  return { id: nouvelId(), nom: 'Nozadah', emplacements, tours };
}
