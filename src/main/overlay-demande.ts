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

import type { Bornes, Surjeu } from './surjeu.ts';

/** Shell size. Lot 8 draws the content and will settle its own. */
export const TAILLE = { largeur: 460, hauteur: 300 } as const;

export class OverlayDemande {
  readonly fenetre: BrowserWindow;
  #enAttente = false;
  #attache = false;
  #jeuAFocus = false;
  #bornesJeu: Bornes | null = null;

  /**
   * What the player's drags have added to the centred spot. Kept as an offset
   * and not as an absolute position, so the panel keeps following the game
   * window when it moves. In memory only — Lot 8 decides whether it persists.
   */
  #decalage = { x: 0, y: 0 };
  readonly #surAffichage: () => void;

  constructor(
    surjeu: Surjeu,
    options: { preload: string; page: string; surAffichage?: () => void },
  ) {
    this.#surAffichage = options.surAffichage ?? (() => {});
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
    // Before the first show, and it has to be: X ignores the change on a mapped
    // window. Without it Mutter places this panel where it likes and then
    // refuses every `setPosition` we make.
    surjeu.poserHorsGestionnaire(this.fenetre);
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
    if (this.fenetre.isVisible()) this.#placer();
    this.appliquer();
  }

  /**
   * The player dragged the panel. The lock never touches this surface, so this
   * is always allowed.
   */
  deplacer(dx: number, dy: number): void {
    this.#decalage = { x: this.#decalage.x + dx, y: this.#decalage.y + dy };
    this.#placer();
  }

  /** Centred on the game window. Exact, the window manager being out of it. */
  #placer(): void {
    const bornes = this.#bornesJeu;
    if (bornes === null || this.fenetre.isDestroyed()) return;
    this.fenetre.setPosition(
      Math.round(bornes.x + (bornes.width - TAILLE.largeur) / 2 + this.#decalage.x),
      Math.round(bornes.y + (bornes.height - TAILLE.hauteur) / 2 + this.#decalage.y),
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
      // Both surfaces are override-redirect, so their stacking is plain X order
      // and the last one raised wins. This one must sit UNDER the fiche du
      // Tour: a question about the Roster must never hide what to play.
      this.#surAffichage();
    }
  }
}
