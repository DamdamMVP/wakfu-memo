/**
 * The Overlay de la Demande d'ajout: the second surface, shell only.
 *
 * ADR `0010` — a question asked during a fight is not a window: no title bar,
 * no close button, because a close button would mean "no" when not answering is
 * not a refusal. Its content is Lot 8.
 *
 * Two differences with the Overlay du Tour, both held by the domain:
 *
 * - The lock never applies here. "A question with no possible answer" makes no
 *   sense, so this surface always catches clicks.
 * - It is not driven by `electron-overlay-window`, which only handles one
 *   window. It follows the same bounds by hand.
 */

import { BrowserWindow } from 'electron';

import type { Bornes } from './surjeu.ts';

/** Shell size. Lot 8 draws the content and will settle its own. */
export const TAILLE = { largeur: 460, hauteur: 300 } as const;

export class OverlayDemande {
  readonly fenetre: BrowserWindow;
  #enAttente = false;
  #attache = false;
  #jeuAFocus = false;
  #bornesJeu: Bornes | null = null;

  constructor(options: { preload: string; page: string }) {
    this.fenetre = new BrowserWindow({
      width: TAILLE.largeur,
      height: TAILLE.hauteur,
      frame: false,
      show: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      skipTaskbar: true,
      webPreferences: { preload: options.preload, contextIsolation: true, sandbox: true },
    });
    void this.fenetre.loadFile(options.page);
  }

  get enAttente(): boolean {
    return this.#enAttente;
  }

  /**
   * A Demande waits for an answer, or no longer does. It stays until answered:
   * the end of a fight does not clear it.
   */
  poserQuestion(enAttente: boolean): void {
    this.#enAttente = enAttente;
    this.appliquer();
  }

  attache(bornes: Bornes): void {
    this.#attache = true;
    this.#jeuAFocus = true;
    this.suivre(bornes);
  }

  detache(): void {
    this.#attache = false;
    this.#jeuAFocus = false;
    this.appliquer();
  }

  focusJeu(estAuJeu: boolean): void {
    this.#jeuAFocus = estAuJeu;
    this.appliquer();
  }

  /** Centred on the game window; Lot 8 settles the definitive spot. */
  suivre(bornes: Bornes): void {
    if (bornes.width === 0 || bornes.height === 0) return;
    this.#bornesJeu = bornes;
    // Only while visible: `appliquer` places it itself right after showing it.
    if (this.fenetre.isVisible()) this.#placer();
    this.appliquer();
  }

  /**
   * Must be replayed after every show, not only when the game moves. This
   * surface is not driven by the library, so the window manager treats it as an
   * ordinary window and puts it where it likes at map time — measured under
   * Mutter, which throws a window asked for elsewhere to the top left of the
   * desktop. A position set before showing does not survive; one set after does.
   */
  #placer(): void {
    const bornes = this.#bornesJeu;
    if (bornes === null || this.fenetre.isDestroyed()) return;
    this.fenetre.setPosition(
      Math.round(bornes.x + (bornes.width - TAILLE.largeur) / 2),
      Math.round(bornes.y + (bornes.height - TAILLE.hauteur) / 2),
    );
  }

  appliquer(): void {
    if (this.fenetre.isDestroyed()) return;

    // Not the four conditions: this is a Roster question, not the Overlay du
    // Tour. It needs the game in sight and something to ask.
    const doitParaitre =
      this.#enAttente && this.#attache && (this.#jeuAFocus || this.fenetre.isFocused());

    if (!doitParaitre) {
      if (this.fenetre.isVisible()) this.fenetre.hide();
      return;
    }
    if (!this.fenetre.isVisible()) {
      this.fenetre.showInactive();
      this.fenetre.setAlwaysOnTop(true, 'screen-saver');
      this.#placer();
    }
  }
}
