/**
 * The fiche du Tour: a Strat plus the state of the combat → what the Overlay
 * draws. The one place where the two halves of the product meet.
 *
 * It is **pure**, and that is the whole point: everything this lot has to get
 * right is checkable here, against the repo samples, without Electron and
 * without the game.
 *
 * Three rules carry it, and none of them has an exception:
 *
 * 1. **Out of combat is not a screen.** It is the fiche of Tour 1 without any
 *    Mise en avant, and nothing greyed — there is no Liaison out of combat, so
 *    no Emplacement is known absent. The corollary is the whole result of #18:
 *    the appearance of the Mise en avant is the only sign that a combat is
 *    alive. One sign, zero words.
 * 2. **It draws what the Strat contains**, even next to nothing: no Tour gives
 *    `T1` and empty lines, no Emplacement gives the header alone. Writing "if
 *    the Strat is too empty, then…" reopens ADR `0006` through the window.
 * 3. **Nothing here knows about doubt** (ADR `0006`). The only admission kept is
 *    the overflow past the last written Tour, and it is not a doubt: it is a
 *    fact — the Strat is finished and the combat is not.
 */

import type { Classe } from '../domaine/classes.ts';
import type { Couleur } from '../domaine/composition.ts';
import type { Segment } from '../domaine/texte-riche.ts';
/**
 * A type, so it is erased at compile time: this module keeps knowing neither
 * Electron nor the disk. The Strat model happens to live next to the file that
 * reads it.
 */
import type { Strat } from '../persistance/strats.ts';
import type { EtatDuSuivi } from './suivi-du-tour.ts';

/** One Emplacement's line: no text but the Consigne (ADR `0003`). */
export type LigneDeFiche = {
  readonly rang: number;
  readonly classe: Classe;
  readonly couleur: Couleur;
  /** Empty when the Tour holds no Consigne for this Emplacement. */
  readonly consigne: readonly Segment[];
  /** Greyed: absent or tombé, the two causes being indistinguishable. */
  readonly inactif: boolean;
  /** The Mise en avant. One line at a time, and the next is not announced. */
  readonly enAvant: boolean;
  /**
   * The pseudo of whoever holds this Emplacement in this combat, `null` out of
   * combat and on an Emplacement nobody plays.
   *
   * ⚠️ It is here to be shown **during the gesture only** — the survol of the
   * Échange par clic — never at rest: ADR `0003` gives an Emplacement its
   * Couleur for identity and no text beside the icon. The surface owns that
   * restraint; this field only makes it possible.
   */
  readonly pseudo: string | null;
  /**
   * The Rangs this one exchanges with. Empty when nothing can be exchanged,
   * which is the state the Échange par clic must show **before** the click.
   */
  readonly partenaires: readonly number[];
};

export type Fiche = {
  readonly stratId: string;
  readonly nom: string;
  /** The Tour courant, `1` out of combat. */
  readonly tour: number;
  readonly global: readonly Segment[];
  readonly note: string | null;
  readonly lignes: readonly LigneDeFiche[];
  /**
   * The number of Tours the Strat holds, when the combat has gone past it —
   * `null` the rest of the time. The only admission ADR `0006` leaves standing.
   */
  readonly audelaDe: number | null;
};

/**
 * `suivi` is the combat in progress, or `null`. A combat we could not rebuild is
 * given as `null` on purpose: it is indistinguishable from "no combat", which
 * is the only honest option left once ADR `0006` forbids both the guessed
 * position and the confession.
 *
 * `connus` holds the ID d'entité of every Personnage of the Roster, and it
 * decides one thing only: **what can be exchanged**. An Échange par clic is
 * remembered as a Préférence de liaison, which names a Personnage — so a
 * fighter the Roster does not know has nothing to write down, and offering the
 * gesture on them would be offering a click that does nothing. That is the hole
 * of the cold start, named and assumed in #16: with an incomplete Roster,
 * `permutable → rien`, and the way out is to identify them first.
 *
 * The **pseudo is not gated the same way**: hovering names any icon, known or
 * not (#16). Learning who is there costs nothing; only a doublon is clickable.
 */
export function ficheDuTour(
  strat: Strat,
  suivi: EtatDuSuivi | null,
  connus: ReadonlySet<string> = new Set(),
): Fiche {
  // A combat only counts while it is alive: an `End fight`, or a client
  // shutdown, brings the fiche back to Tour 1 by this single door — the same
  // door the launch comes through, so there is one code path for both.
  const vivant = suivi?.ouvert === true ? suivi : null;
  const tour = vivant?.tourCourant ?? 1;
  const ecrit = strat.tours[tour - 1];

  // No Tour written at all: no overflow either, since nothing is being gone
  // past. That is the shape of #18's near-empty Strat, without the sentence.
  const audelaDe = strat.tours.length > 0 && tour > strat.tours.length ? strat.tours.length : null;

  const lignes = strat.emplacements.map((emplacement, index): LigneDeFiche => {
    const rang = index + 1;
    const lie = vivant?.liaison.get(rang) ?? null;
    return {
      rang,
      classe: emplacement.classe,
      couleur: emplacement.couleur,
      consigne: ecrit?.consignes[emplacement.id] ?? [],
      inactif: vivant !== null && !vivant.rangsActifs.includes(rang),
      enAvant: vivant?.rangCourant === rang,
      pseudo: lie?.nom ?? null,
      // Filled just below: a partner is a fact about two lines, so it cannot be
      // decided while the first of them is still being built.
      partenaires: [],
    };
  });

  // The doublons. Same Classe, both held, both held by a Personnage the Roster
  // knows — the three conditions of a swap that can be written down.
  const echangeable = (ligne: LigneDeFiche): boolean => {
    const lie = vivant?.liaison.get(ligne.rang);
    return lie !== undefined && connus.has(lie.idEntite);
  };
  const avecPartenaires = lignes.map((ligne): LigneDeFiche => {
    if (!echangeable(ligne)) return ligne;
    return {
      ...ligne,
      partenaires: lignes
        .filter(
          (autre) =>
            autre.rang !== ligne.rang && autre.classe === ligne.classe && echangeable(autre),
        )
        .map((autre) => autre.rang),
    };
  });

  return {
    stratId: strat.id,
    nom: strat.nom,
    tour,
    global: ecrit?.global ?? [],
    note: ecrit?.note ?? null,
    lignes: avecPartenaires,
    audelaDe,
  };
}
