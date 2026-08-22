/**
 * Everything `electron-overlay-window` knows about the Wakfu window.
 *
 * One code path, X11 — native on Windows, through XWayland on Linux. The
 * library initialises once and drives a single window: the Overlay du Tour.
 * The Overlay de la Demande d'ajout follows the same bounds by hand.
 *
 * This is the only module that knows the library exists.
 */

import { dirname } from 'node:path';

import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { OVERLAY_WINDOW_OPTS, OverlayController } from 'electron-overlay-window';

/**
 * The library's own native module, loaded as-is so we share its X connection.
 * `setInputRegion` is added by `patches/electron-overlay-window.patch`.
 */
type NatifSurjeu = {
  setInputRegion?: (rects: Int32Array | null) => void;
  setOverrideRedirect?: (poignee: Buffer) => void;
};

const natif = require('node-gyp-build')(
  dirname(require.resolve('electron-overlay-window/package.json')),
) as NatifSurjeu;

/**
 * The client names its window after the connected character — "S'Alu-Ca'Va -
 * WAKFU" — and the library compared titles with a plain `strcmp`. The patch
 * accepts equality or a suffix preceded by " - "; the rule is covered by
 * `surjeu-titre.test.ts`.
 *
 * `WAKFU_MEMO_TITRE_FENETRE` aims at another window, which is what makes this
 * testable without launching the game (`docs/verification-manuelle.md`).
 */
export const TITRE_FENETRE_WAKFU = process.env['WAKFU_MEMO_TITRE_FENETRE'] || 'WAKFU';

export type Bornes = { x: number; y: number; width: number; height: number };

/**
 * `OVERLAY_WINDOW_OPTS` already gives frameless, transparent, hidden, off the
 * taskbar. Maximising is refused on purpose: Mutter ignores
 * `_NET_WM_STATE_ABOVE` on a maximised window, so a maximised Overlay sinks
 * below the game. Rounded corners are refused for the same kind of reason —
 * they are a window shape, and Chromium would reapply it over our input region.
 */
export const OPTIONS_OVERLAY: BrowserWindowConstructorOptions = {
  ...OVERLAY_WINDOW_OPTS,
  maximizable: false,
  minimizable: false,
  roundedCorners: false,
};

export type EvenementsSurjeu = {
  attache: (bornes: Bornes) => void;
  detache: () => void;
  deplacement: (bornes: Bornes) => void;
  focus: () => void;
  blur: () => void;
};

export class Surjeu {
  #attache = false;

  get attache(): boolean {
    return this.#attache;
  }

  get bornes(): Bornes {
    return OverlayController.targetBounds;
  }

  get jeuAFocus(): boolean {
    return OverlayController.targetHasFocus;
  }

  /**
   * `fenetreTour` is the window the library drives — position, size, visibility
   * — and it must outlive the app. Our listeners are added after the library's
   * own, registered at import time: it shows and repositions, we then decide
   * whether the four conditions allow what it just did.
   */
  demarrer(fenetreTour: BrowserWindow, ecoute: Partial<EvenementsSurjeu>): void {
    const { events } = OverlayController;

    events.on('attach', (evenement: Bornes) => {
      this.#attache = true;
      ecoute.attache?.(evenement);
    });
    events.on('detach', () => {
      this.#attache = false;
      ecoute.detache?.();
    });
    events.on('moveresize', (evenement: Bornes) => ecoute.deplacement?.(evenement));
    events.on('focus', () => ecoute.focus?.());
    events.on('blur', () => ecoute.blur?.());

    OverlayController.attachByTitle(fenetreTour, TITRE_FENETRE_WAKFU);
  }

  /**
   * What catches clicks: nothing, or exactly these rectangles.
   *
   * The Overlay window covers the whole game but only draws the fiche, so
   * unlocking must hand clicks to the fiche and not to the transparent pixels
   * around it.
   *
   * One path or the other, never both. `setIgnoreMouseEvents` is the normal
   * route and works on Windows, but on Linux/X11 it is a no-op since Electron
   * 43 (electron#52456) and it applies asynchronously: called alongside ours it
   * overwrites our region a moment later — measured. Under X11 the region alone
   * decides.
   *
   * Windows lacks the fine grain: Electron locks or unlocks the whole window
   * there, so unlocking will swallow every click until mouse event forwarding
   * is written. Not verifiable from here.
   */
  poserZonesCliquables(fenetre: BrowserWindow, zones: readonly Bornes[]): void {
    if (process.platform !== 'linux') {
      fenetre.setIgnoreMouseEvents(zones.length === 0);
      return;
    }
    const plat = new Int32Array(zones.length * 4);
    zones.forEach((zone, i) => {
      plat[i * 4 + 0] = Math.round(zone.x);
      plat[i * 4 + 1] = Math.round(zone.y);
      plat[i * 4 + 2] = Math.round(zone.width);
      plat[i * 4 + 3] = Math.round(zone.height);
    });
    natif.setInputRegion?.(plat);
  }

  /**
   * Takes a window out of the window manager's hands, under X11.
   *
   * The Overlay du Tour lands exactly where it is told because the library does
   * this to it before it is ever mapped. The Overlay de la Demande d'ajout is
   * not the window the library drives, so without this it stays an ordinary
   * managed window — and Mutter refuses to move it at all: `setPosition` on it
   * is a measured no-op, whatever the delay, and the panel lands wherever the
   * window manager fancies.
   *
   * MUST be called before the window is first shown. X ignores the change on a
   * mapped window until the next mapping.
   */
  poserHorsGestionnaire(fenetre: BrowserWindow): void {
    if (process.platform !== 'linux') return;
    natif.setOverrideRedirect?.(fenetre.getNativeWindowHandle());
  }

  /**
   * The library's focus dance — and not under X11.
   *
   * `activateOverlay` gives keyboard focus to the Overlay, `focusTarget` hands
   * it back to the game: that is what Windows needs for a transparent window to
   * become clickable. Under X11 the input region is enough, and the dance makes
   * the Overlay vanish — Electron emits a `blur` on an override-redirect window
   * whose focus it does not track, and the library hides it. Measured.
   */
  deverrouiller(): void {
    if (process.platform === 'linux') return;
    OverlayController.activateOverlay();
  }

  verrouiller(): void {
    if (process.platform === 'linux') return;
    OverlayController.focusTarget();
  }
}
