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
 */
function signature(combat: EtatDuSuivi | null): string {
  if (combat === null) return 'aucun';
  return [
    combat.fightId,
    combat.ouvert,
    combat.tourCourant,
    combat.rangCourant,
    combat.rangsActifs.join('·'),
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
   * The chosen Strat changed, so the Liaison and the active Rangs did. The state
   * is recomputed from the events already read — no re-reading, the events do
   * not depend on the Composition.
   */
  poserComposition(composition: Composition): void {
    this.#composition = composition;
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
    const { combatEnCours } = suivreLaSession(this.#flux.evenements, this.#composition);
    this.#combat = combatEnCours;
    const signee = signature(combatEnCours);
    if (signee === this.#signature) return false;
    this.#signature = signee;
    return true;
  }
}
