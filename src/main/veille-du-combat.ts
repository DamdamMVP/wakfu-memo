/**
 * The combat, followed live: `wakfu.log` grows → the Tour courant and the
 * Rotation move.
 *
 * This is what turns the Lot 1 reader into the product. Nothing here decides
 * anything: `FluxDuLog` reads, `suivreLaSession` counts, and this class owns
 * only the rhythm and the right not to repeat itself.
 *
 * ⚠️ It knows neither Electron nor the Overlay, and the polling is a public
 * method: `rattraper()` does one pass, so the whole thing tests on a temp file
 * without a timer.
 */

import type { Composition } from '../domaine/composition.ts';
import { FluxDuLog } from '../logs/flux.ts';
import { suivreLaSession } from '../logs/session.ts';
import type { EtatDuSuivi } from '../suivi/suivi-du-tour.ts';

/**
 * The poll period. A `stat` on a file, at a rhythm that is not the game's:
 * Wakfu is turn-based, and a turn boundary lighting the next line a third of a
 * second late is invisible. Anything faster buys nothing.
 */
export const PERIODE_MS = 400;

export type SurCombat = (combat: EtatDuSuivi | null) => void;

/**
 * What the fiche reads of the state. Comparing it is what keeps a static
 * out-of-combat fiche from being repainted twice a second — and, above all,
 * from re-declaring its clickable zones each time.
 *
 * ⚠️ The **Liaison is part of it** since the Échange par clic exists: two
 * fighters swapping places changes no Rang, no Tour and no active Rang, so a
 * signature without it would call the swap "no change" and the fiche would go on
 * naming the wrong pseudo. The played roster is in it for the same reason on the
 * other surface — a fighter arriving is a Demande d'ajout to pose.
 */
function signature(combat: EtatDuSuivi | null): string {
  if (combat === null) return 'aucun';
  return [
    combat.fightId,
    combat.ouvert,
    combat.tourCourant,
    combat.rangCourant,
    combat.rangsActifs.join('·'),
    [...combat.liaison].map(([rang, combattant]) => `${rang}=${combattant.idEntite}`).join('·'),
    combat.roster.map((combattant) => combattant.idEntite).join('·'),
  ].join('|');
}

export class VeilleDuCombat {
  readonly #flux = new FluxDuLog();
  readonly #surCombat: SurCombat;
  readonly #periode: number;

  /**
   * Empty until a Strat is chosen. An empty Composition gives a Rotation with
   * nothing to stop on: the count does not move, which is exactly right — the
   * Overlay is not drawn without a Strat anyway (ADR `0006`).
   */
  #composition: Composition = [];
  /**
   * The Préférences de liaison of the chosen Strat, as Rang → ID d'entité. Empty
   * until an Échange par clic writes one down.
   */
  #liaisonsForcees: ReadonlyMap<number, string> = new Map();
  #combat: EtatDuSuivi | null = null;
  #signature = signature(null);
  #minuterie: NodeJS.Timeout | null = null;

  constructor(surCombat: SurCombat, periode = PERIODE_MS) {
    this.#surCombat = surCombat;
    this.#periode = periode;
  }

  get combat(): EtatDuSuivi | null {
    return this.#combat;
  }

  /**
   * Follows a `wakfu.log`, or nothing. Changing the file replays it whole: that
   * is the launch replay of ADR `0007`, and it is the same code as the first
   * pass.
   */
  suivre(chemin: string | null): void {
    // Idempotent: the same file asked for twice is not replayed. Two callers
    // reach here — the watch that says the file appeared, and the gesture that
    // designates a folder — and they overlap.
    if (chemin === this.#flux.chemin && (chemin === null || this.#minuterie !== null)) return;
    this.#flux.suivre(chemin);
    this.#combat = null;
    this.#signature = signature(null);
    this.arreter();
    if (chemin !== null) {
      // The whole file, right away: this is the launch replay of ADR `0007`, and
      // it is the same two calls as every later pass.
      this.#flux.rattraper();
      this.#calculer();
      this.#minuterie = setInterval(() => this.rattraper(), this.#periode);
      // The poll must never be what keeps the app alive.
      this.#minuterie.unref?.();
    }
    // Announced whatever it found: the caller holds the previous state, and a
    // change of file makes it stale even when the new one carries no combat.
    this.#surCombat(this.#combat);
  }

  /**
   * The chosen Strat changed, or its Préférences de liaison did, so the Liaison
   * and the active Rangs did. The state is recomputed from the events already
   * read — no re-reading, the events do not depend on the Composition.
   *
   * The two arrive together because they are read together: a Préférence names
   * an Emplacement of **this** Strat, and applying one against the other's
   * Composition would put a Personnage on somebody else's place.
   */
  poserComposition(
    composition: Composition,
    liaisonsForcees: ReadonlyMap<number, string> = new Map(),
  ): void {
    this.#composition = composition;
    this.#liaisonsForcees = liaisonsForcees;
    this.#calculer();
    this.#surCombat(this.#combat);
  }

  /** One pass. Returns whether the state moved. */
  rattraper(): boolean {
    if (!this.#flux.rattraper()) return false;
    if (!this.#calculer()) return false;
    this.#surCombat(this.#combat);
    return true;
  }

  arreter(): void {
    if (this.#minuterie !== null) clearInterval(this.#minuterie);
    this.#minuterie = null;
  }

  /** Recomputes, and says whether what the fiche reads of it moved. */
  #calculer(): boolean {
    const { combatEnCours } = suivreLaSession(this.#flux.evenements, this.#composition, {
      liaisonsForcees: this.#liaisonsForcees,
    });
    this.#combat = combatEnCours;
    const signee = signature(combatEnCours);
    if (signee === this.#signature) return false;
    this.#signature = signee;
    return true;
  }
}
