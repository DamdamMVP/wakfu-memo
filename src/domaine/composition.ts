/**
 * What the turn tracking needs to know of a Strat: its Composition.
 *
 * The rest of the Strat — the Tours, the Consignes — is none of the log
 * reader's business, which only produces a Tour courant number and a position
 * in the Rotation.
 */

import type { Classe } from './classes.ts';

/** The six Couleurs, unique within a Strat. */
export const COULEURS = ['rouge', 'jaune', 'vert', 'bleu', 'rose', 'gris'] as const;

export type Couleur = (typeof COULEURS)[number];

/** A place in a Strat: a Classe, plus a Couleur. No label. */
export type Emplacement = {
  readonly classe: Classe;
  readonly couleur: Couleur;
};

/**
 * The Emplacements of a Strat, in turn order. The Rang is the place in this
 * list — 1 to 6 — and not a value of its own: reordering the Composition
 * changes the Rangs.
 */
export type Composition = readonly Emplacement[];

/** The Rang of an Emplacement, 1 to 6. */
export function rangDe(composition: Composition, emplacement: Emplacement): number {
  return composition.indexOf(emplacement) + 1;
}
