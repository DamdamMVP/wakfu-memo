/**
 * The Fenêtre principale: the only one of the three surfaces that is a window.
 *
 * Native, with its title bar and its close button — and closing it closes
 * everything, both Overlays included (ADR `0010`). No tray icon: out of scope.
 *
 * This lot lays down the shell only. Lot 5 puts the side column, the Socle
 * d'état and the Strats screen in it.
 */

import { BrowserWindow } from 'electron';

export class FenetrePrincipale {
  readonly fenetre: BrowserWindow;

  constructor(options: { preload: string; page: string; surFermeture: () => void }) {
    this.fenetre = new BrowserWindow({
      width: 1180,
      height: 780,
      minWidth: 912,
      minHeight: 620,
      title: 'Wakfu Mémo',
      backgroundColor: '#0f1115',
      // Shown at once on its final background — no white flash, and no app
      // running without a window the day the first frame never arrives (broken
      // graphics driver, software rendering that stalls).
      show: true,
      webPreferences: { preload: options.preload, contextIsolation: true, sandbox: true },
    });

    void this.fenetre.loadFile(options.page);
    this.fenetre.on('closed', options.surFermeture);
  }

  /** The third shortcut, and the second instance: bring the window forward. */
  rappeler(): void {
    if (this.fenetre.isDestroyed()) return;
    if (this.fenetre.isMinimized()) this.fenetre.restore();
    this.fenetre.show();
    this.fenetre.focus();
  }

  envoyer(canal: string, charge: unknown): void {
    if (this.fenetre.isDestroyed()) return;
    this.fenetre.webContents.send(canal, charge);
  }
}
