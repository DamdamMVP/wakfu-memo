/**
 * The Overlay du Tour: the window, and what it is given to draw.
 *
 * A window with no title bar and no close button, covering the Wakfu window and
 * following it. The fiche places itself inside — the window is never moved for
 * it, and never resized.
 *
 * Three rules carry everything:
 *
 * 1. The four conditions. The Overlay is drawn only if the Affichage is
 *    demande, the logs are found, a Wakfu window exists and a Strat is chosen.
 *    Otherwise it is not hidden behind a state: it is not there.
 * 2. Locked by default, and the lock lets every click through — the fiche's
 *    padlock included, which is why the global shortcut is the only way back.
 *    Unlocked, only the rectangles the surface declares catch clicks; see
 *    `Surjeu.poserZonesCliquables`.
 * 3. The content is **pulled**, not stored here: `contenu()` is asked at every
 *    send. This window owns no state of the combat nor of the Strat, so nothing
 *    can go stale in two places at once.
 */

import { BrowserWindow } from 'electron';

import type { Fiche } from '../suivi/fiche.ts';
import { CANAL } from './canaux.ts';
import type { EtatConditions } from './conditions-affichage.ts';
import { type Bornes, OPTIONS_OVERLAY, type Surjeu } from './surjeu.ts';

const REPOSE_MS = 250;

/** The four aspect settings of ADR `0013`, as the surface needs them. */
export type Aspect = {
  readonly opacite: number;
  readonly tailleTexte: number;
  readonly largeur: number;
  readonly x: number;
  readonly y: number;
};

export type ContenuOverlay = {
  /** `null` when no Strat is chosen: then the Overlay draws nothing at all. */
  readonly fiche: Fiche | null;
  readonly aspect: Aspect;
  /** The flat list the Strat bar opens, names free and not unique. */
  readonly strats: readonly { readonly id: string; readonly nom: string }[];
  /**
   * How many questions are waiting behind a folded Overlay de la Demande
   * d'ajout, `0` when none is. The **pastille** of the Strat bar, and its only
   * job: bringing back what « plus tard » put away.
   *
   * ⚠️ It never counts a Conflit. A Conflit is not asked about — it is settled
   * by the lowest Rang and repaired by the Échange par clic — and a badge for a
   * doubt is exactly what ADR `0006` takes away from this surface.
   */
  readonly demandesRepliees: number;
};

export type EtatOverlayTour = ContenuOverlay & {
  readonly verrouille: boolean;
  readonly dessine: boolean;
};

export class OverlayTour {
  readonly fenetre: BrowserWindow;
  readonly #etat: EtatConditions;
  readonly #surjeu: Surjeu;
  readonly #surChangement: () => void;
  readonly #contenu: () => ContenuOverlay;

  /**
   * The last payload sent, verbatim. The surjeu fires a `moveresize` per pixel
   * of a window drag, and each one would otherwise repaint the fiche and make it
   * re-declare its clickable zones.
   */
  #dernierEnvoi = '';

  /**
   * In memory only: unlocking is a tool gesture, not an aspect of the Overlay,
   * so a restart hands the clicks back to the game.
   */
  #verrouille = true;

  /**
   * What the surface says it occupies, in window pixels. Empty until it
   * declares something — so nothing catches clicks, which is the right default.
   */
  #zones: readonly Bornes[] = [];
  #reposeDifferee: NodeJS.Timeout | null = null;

  constructor(
    etat: EtatConditions,
    surjeu: Surjeu,
    options: {
      preload: string;
      page: string;
      contenu: () => ContenuOverlay;
      surChangement?: () => void;
    },
  ) {
    this.#etat = etat;
    this.#surjeu = surjeu;
    this.#contenu = options.contenu;
    this.#surChangement = options.surChangement ?? (() => {});

    this.fenetre = new BrowserWindow({
      ...OPTIONS_OVERLAY,
      webPreferences: { preload: options.preload, contextIsolation: true, sandbox: true },
    });
    void this.fenetre.loadFile(options.page);
    this.fenetre.webContents.on('did-finish-load', () => {
      // A fresh page knows nothing, whatever we sent to the previous one.
      this.#dernierEnvoi = '';
      this.envoyerEtat();
    });

    // Chromium rewrites the window shape on every bounds change and wipes the
    // input region along the way — measured: an empty region becomes a full
    // rectangle after a plain `setBounds`, and the library issues one every
    // time the game moves. So we lay the region down again behind it.
    this.fenetre.on('resize', () => this.#poserZones());
    this.fenetre.on('move', () => this.#poserZones());
    this.fenetre.on('show', () => this.#poserZones());

    etat.surChangement(() => this.appliquer());
  }

  get verrouille(): boolean {
    return this.#verrouille;
  }

  get dessine(): boolean {
    return this.#etat.dessine && this.#surjeu.attache;
  }

  /**
   * The only place that decides what is seen and what the mouse goes through.
   * Called after every surjeu event: the library shows and re-locks the window
   * on its own at attach and focus time, we come in behind it.
   */
  appliquer(): void {
    if (this.fenetre.isDestroyed()) return;

    const visibleSiVerrouille = this.#surjeu.jeuAFocus;
    const doitParaitre =
      this.dessine && (visibleSiVerrouille || !this.#verrouille || this.fenetre.isFocused());

    if (!doitParaitre) {
      // Nothing may come back catching the player's clicks: an Overlay that
      // goes dark re-locks itself, and says so.
      const etaitDeverrouille = !this.#verrouille;
      this.#verrouille = true;
      this.#poserZones();
      if (this.fenetre.isVisible()) this.fenetre.hide();
      if (etaitDeverrouille) {
        this.envoyerEtat();
        this.#surChangement();
      }
      return;
    }

    if (!this.fenetre.isVisible()) {
      this.fenetre.showInactive();
      this.fenetre.setAlwaysOnTop(true, 'screen-saver');
    }
    // After showing: a region laid on an unmapped window does not survive the
    // mapping.
    this.#poserZones();
    this.envoyerEtat();
  }

  /**
   * Laid down twice, once deferred. Chromium rewrites the window shape when its
   * bounds change and when it produces its first frame; those rewrites
   * sometimes land after our call and erase it. One late repeat is enough for
   * the region to hold — measured. Without it the Overlay starts by swallowing
   * every click, which is the worse of the two failures.
   */
  #poserZones(): void {
    if (this.fenetre.isDestroyed()) return;
    this.#surjeu.poserZonesCliquables(this.fenetre, this.#verrouille ? [] : this.#zones);
    if (this.#reposeDifferee) clearTimeout(this.#reposeDifferee);
    this.#reposeDifferee = setTimeout(() => {
      this.#reposeDifferee = null;
      if (this.fenetre.isDestroyed()) return;
      this.#surjeu.poserZonesCliquables(this.fenetre, this.#verrouille ? [] : this.#zones);
    }, REPOSE_MS);
  }

  basculerVerrou(): void {
    if (this.#verrouille) this.deverrouiller();
    else this.verrouiller();
  }

  deverrouiller(): void {
    if (!this.dessine) return;
    this.#verrouille = false;
    this.appliquer();
    this.#surjeu.deverrouiller();
    this.envoyerEtat();
    this.#surChangement();
  }

  verrouiller(): void {
    this.#verrouille = true;
    this.appliquer();
    this.#surjeu.verrouiller();
    this.envoyerEtat();
    this.#surChangement();
  }

  /**
   * Back above the Demande d'ajout, which has just appeared under it. Raising
   * reconfigures the window, and Chromium wipes the input region when it does,
   * so the zones go back down behind it.
   */
  remonter(): void {
    if (this.fenetre.isDestroyed() || !this.fenetre.isVisible()) return;
    this.fenetre.moveTop();
    this.#poserZones();
  }

  /** The surface declares what it occupies: it alone knows. */
  declarerZones(zones: readonly Bornes[]): void {
    this.#zones = zones;
    this.#poserZones();
  }

  /**
   * Bounds come from the surjeu; the fiche places itself inside. The window
   * covers the whole game, so there is nothing to move and nothing to resize —
   * the fiche's own position and width are aspect settings, held on the surface
   * side and persisted through `positionFiche` / `largeurFiche`.
   */
  suivre(_bornes: Bornes): void {
    this.appliquer();
  }

  /**
   * The one place the surface hears from. Silent when it would repeat itself:
   * an out-of-combat fiche is a static image, and repainting it at the rhythm of
   * the game window's moves would cost the lock its zones.
   */
  envoyerEtat(): void {
    if (this.fenetre.isDestroyed()) return;
    const etat: EtatOverlayTour = {
      ...this.#contenu(),
      verrouille: this.#verrouille,
      dessine: this.dessine,
    };
    const serialise = JSON.stringify(etat);
    if (serialise === this.#dernierEnvoi) return;
    this.#dernierEnvoi = serialise;
    this.fenetre.webContents.send(CANAL.overlayTour, etat);
  }
}
