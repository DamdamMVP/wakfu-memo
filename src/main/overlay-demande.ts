/**
 * The Overlay de la Demande d'ajout: the second surface, and the question it
 * carries.
 *
 * ADR `0010` — a question asked during a fight is not a window: no title bar,
 * no close button, because a close button would mean "no" when not answering is
 * not a refusal. The only explicit refusal is the Personnage ignoré, and it is
 * chosen **inside** the question.
 *
 * Three differences with the Overlay du Tour, all three held by the domain:
 *
 * - The lock never applies here. "A question with no possible answer" makes no
 *   sense, so this surface always catches clicks.
 * - It is not driven by `electron-overlay-window`, which only handles one
 *   window. It follows the same bounds by hand.
 * - It is not subject to the four conditions of ADR `0014`: this is a question
 *   about the Roster, not the fiche du Tour. It needs the game in sight and
 *   something to ask, and nothing else — an unanswered Demande survives the
 *   `End fight` that put the fiche back to Tour 1.
 *
 * What folds it is « plus tard », and nothing else; what brings it back is the
 * pastille of the fiche. Folding is **not** an answer, so the list keeps its
 * questions and a new fighter unfolds it again.
 */

import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron';

import { nomDeClasse } from '../domaine/classes.ts';
import { CANAL } from './canaux.ts';
import type { DemandeDAjout } from './demandes-en-attente.ts';
import type { Bornes, Surjeu } from './surjeu.ts';

/** Wide enough for a pseudo, a Classe and two buttons on one line. */
export const LARGEUR = 520;
/** Before the surface has measured itself. One line's worth, roughly. */
export const HAUTEUR_DEPART = 116;
/** Below this, nothing of the panel would be readable. */
export const HAUTEUR_MINI = 64;
/** Six unknowns at most in a fight, plus a warning open under one of them. */
export const HAUTEUR_MAX = 560;

/** What the surface is given to draw. Pulled at every send, never stored twice. */
export type ContenuDemande = {
  readonly demandes: readonly DemandeDAjout[];
  readonly profils: readonly { readonly id: string; readonly nom: string }[];
  /**
   * The Personnages still waiting for their first fight: the only ones a
   * rattachement can land on (ADR `0002`). Sent whole because the surface shows
   * the typed Classe next to the one the log says.
   */
  readonly rattachables: readonly {
    readonly id: string;
    readonly nom: string;
    readonly classe: string;
  }[];
  /** The opacity of the fiche: this panel speaks the same language (#16). */
  readonly opacite: number;
};

/** What the native menu gave back, or `null` — it was closed without choosing. */
export type ChoixDeDemande =
  | { readonly sorte: 'profil'; readonly profilId: string }
  | { readonly sorte: 'nouveau-profil' }
  | { readonly sorte: 'rattacher'; readonly personnageId: string }
  | { readonly sorte: 'ignorer' };

export class OverlayDemande {
  readonly fenetre: BrowserWindow;
  #enAttente = false;
  #replie = false;
  #attache = false;
  #jeuAFocus = false;
  #bornesJeu: Bornes | null = null;
  #hauteur = HAUTEUR_DEPART;
  #dernierEnvoi = '';

  /**
   * What the player's drags have added to the centred spot. Kept as an offset
   * and not as an absolute position, so the panel keeps following the game
   * window when it moves. In memory only: where a question stood is not worth a
   * key on disk.
   */
  #decalage = { x: 0, y: 0 };
  readonly #surAffichage: () => void;
  readonly #contenu: () => ContenuDemande;

  constructor(
    surjeu: Surjeu,
    options: {
      preload: string;
      page: string;
      contenu: () => ContenuDemande;
      surAffichage?: () => void;
    },
  ) {
    this.#surAffichage = options.surAffichage ?? (() => {});
    this.#contenu = options.contenu;
    this.fenetre = new BrowserWindow({
      width: LARGEUR,
      height: HAUTEUR_DEPART,
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
    this.fenetre.webContents.on('did-finish-load', () => {
      // A fresh page knows nothing, whatever we sent to the previous one.
      this.#dernierEnvoi = '';
      this.envoyerEtat();
    });
    // Before the first show, and it has to be: X ignores the change on a mapped
    // window. Without it Mutter places this panel where it likes and then
    // refuses every `setPosition` we make.
    surjeu.poserHorsGestionnaire(this.fenetre);
  }

  get enAttente(): boolean {
    return this.#enAttente;
  }

  /** Folded away by « plus tard », and waiting behind the pastille of the fiche. */
  get replie(): boolean {
    return this.#enAttente && this.#replie;
  }

  /**
   * A Demande waits for an answer, or no longer does. It stays until answered:
   * the end of a fight does not clear it.
   *
   * `neuf` says a question was **added**, not merely still there. That is what
   * unfolds: « plus tard » is a "not this one, not now", and a fighter nobody
   * has been asked about yet is another question. Answering the last one folds
   * nothing — there is no panel left to fold.
   */
  poserQuestion(enAttente: boolean, neuf = false): void {
    this.#enAttente = enAttente;
    if (neuf || !enAttente) this.#replie = false;
    this.appliquer();
    this.envoyerEtat();
  }

  replier(replie: boolean): void {
    if (this.#replie === replie) return;
    this.#replie = replie;
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

  /**
   * The surface measured its content. The panel has no scrollbar and must not
   * grow one: a list that scrolls hides a question, and the whole point of
   * listing the unknowns flat is that they are all in sight at once (#16).
   */
  poserHauteur(hauteur: number): void {
    if (!Number.isFinite(hauteur) || this.fenetre.isDestroyed()) return;
    const voulue = Math.min(HAUTEUR_MAX, Math.max(HAUTEUR_MINI, Math.round(hauteur)));
    if (voulue === this.#hauteur) return;
    this.#hauteur = voulue;
    this.fenetre.setSize(LARGEUR, voulue);
    this.#placer();
  }

  /**
   * The answer menu, **native**: it has to be able to leave a panel two lines
   * tall, and a `<div>` cannot (#16).
   *
   * The order is the one the mockup settled. A rattachement of the **same
   * Classe** comes right after the Profils, because that is the net under the
   * manual entry and the one moment the typed name and the real one are side by
   * side. Applied literally, "rattacher d'abord" put « Nozadah l'Ecaflip →
   * Nozahéal l'Eniripsa » at the top — the mistake first — so a different Classe
   * goes below, and says so.
   */
  menu(
    demande: DemandeDAjout,
    contenu: ContenuDemande,
    point: { x: number; y: number },
  ): Promise<ChoixDeDemande | null> {
    if (this.fenetre.isDestroyed()) return Promise.resolve(null);
    return new Promise((resoudre) => {
      let choix: ChoixDeDemande | null = null;
      const entrees: MenuItemConstructorOptions[] = [
        { label: `Ajouter ${demande.nom} à`, enabled: false },
      ];
      for (const profil of contenu.profils) {
        entrees.push({
          label: profil.nom,
          click: () => {
            choix = { sorte: 'profil', profilId: profil.id };
          },
        });
      }
      entrees.push({
        label: '＋ nouveau profil',
        click: () => {
          choix = { sorte: 'nouveau-profil' };
        },
      });

      const memeClasse = contenu.rattachables.filter(
        (personnage) => personnage.classe === demande.classe,
      );
      const autres = contenu.rattachables.filter(
        (personnage) => personnage.classe !== demande.classe,
      );
      const rattachement = (personnage: { id: string; nom: string; classe: string }) => ({
        label:
          personnage.classe === demande.classe
            ? `Rattacher à « ${personnage.nom} »`
            : `Rattacher à « ${personnage.nom} » — saisi ${nomDeClasse(personnage.classe)}, le log dit ${nomDeClasse(demande.classe)}`,
        click: () => {
          choix = { sorte: 'rattacher', personnageId: personnage.id };
        },
      });
      if (memeClasse.length > 0 || autres.length > 0) entrees.push({ type: 'separator' });
      for (const personnage of memeClasse) entrees.push(rattachement(personnage));
      for (const personnage of autres) entrees.push(rattachement(personnage));

      entrees.push({ type: 'separator' });
      entrees.push({
        label: 'Ignorer',
        click: () => {
          choix = { sorte: 'ignorer' };
        },
      });

      Menu.buildFromTemplate(entrees).popup({
        window: this.fenetre,
        x: Math.round(point.x),
        y: Math.round(point.y),
        // Fires once the menu is closed, chosen or not: closing without choosing
        // is not an answer either, and resolves `null`.
        callback: () => resoudre(choix),
      });
    });
  }

  /** Centred on the game window. Exact, the window manager being out of it. */
  #placer(): void {
    const bornes = this.#bornesJeu;
    if (bornes === null || this.fenetre.isDestroyed()) return;
    this.fenetre.setPosition(
      Math.round(bornes.x + (bornes.width - LARGEUR) / 2 + this.#decalage.x),
      Math.round(bornes.y + (bornes.height - this.#hauteur) / 2 + this.#decalage.y),
    );
  }

  /**
   * The one place the surface hears from. Silent when it would repeat itself:
   * the state is pushed at every fight tick, and repainting the panel under the
   * hand would close the menu the pointer is aiming at.
   */
  envoyerEtat(): void {
    if (this.fenetre.isDestroyed()) return;
    const contenu = this.#contenu();
    const serialise = JSON.stringify(contenu);
    if (serialise === this.#dernierEnvoi) return;
    this.#dernierEnvoi = serialise;
    this.fenetre.webContents.send(CANAL.overlayDemande, contenu);
  }

  appliquer(): void {
    if (this.fenetre.isDestroyed()) return;

    // Not the four conditions: this is a Roster question, not the Overlay du
    // Tour. It needs the game in sight and something to ask.
    const doitParaitre =
      this.#enAttente &&
      !this.#replie &&
      this.#attache &&
      (this.#jeuAFocus || this.fenetre.isFocused());

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
