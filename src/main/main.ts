/**
 * The bootstrap: the frozen constraints first, the app second.
 *
 * Three surfaces, only one of which is a window — the Fenêtre principale, plus
 * the Overlay du Tour and the Overlay de la Demande d'ajout (ADR `0010`). A
 * normal application: closing it closes everything.
 */

import { join } from 'node:path';
import { app, dialog, ipcMain, shell } from 'electron';
import {
  dossierDeLogs,
  environnementReel,
  systemeDeFichiersReel,
} from '../logs/dossier-de-logs.ts';
import { CANAL } from './canaux.ts';
import { type Conditions, EtatConditions, type NomCondition } from './conditions-affichage.ts';
import { DepotReglages } from './depot-reglages.ts';
import { FenetrePrincipale } from './fenetre-principale.ts';
import { OverlayDemande } from './overlay-demande.ts';
import { OverlayTour } from './overlay-tour.ts';
import { CLE_REGLAGE, type Poses, Raccourcis } from './raccourcis.ts';
import { type Bornes, Surjeu, TITRE_FENETRE_WAKFU } from './surjeu.ts';
import { VeilleWakfuLog } from './veille-wakfu-log.ts';

const OZONE_X11 = '--ozone-platform=x11';

/**
 * One code path, X11: native on Windows, through XWayland on Linux. Since
 * Electron 38 the default is `auto`, and under native Wayland `setPosition`,
 * `getCursorScreenPoint` and `globalShortcut` all three disappear — the game
 * window tracking, the pointer, and the only way back from the lock.
 *
 * `app.commandLine.appendSwitch('ozone-platform', 'x11')` is NOT enough,
 * contrary to what this lot had frozen. Measured on 2026-08-21 under
 * GNOME/Wayland with Electron 43: the Ozone platform is picked before this
 * script runs, so the call always arrives too late, `ready` or not. The process
 * starts under Wayland, something then tries to present through X11
 * (`XGetWindowAttributes failed for window 1`), and no window ever appears.
 * `ELECTRON_OZONE_PLATFORM_HINT=x11` is ignored the same way. Only the command
 * line argument is read.
 *
 * Hence this relaunch, before taking the single instance lock: a process
 * relaunching itself must not lock itself out.
 */
function relanceEnX11(): boolean {
  if (process.platform !== 'linux') return false;
  if (process.argv.includes(OZONE_X11)) return false;
  app.relaunch({ args: [...process.argv.slice(1), OZONE_X11] });
  app.exit(0);
  return true;
}

type Instantane = {
  conditions: Conditions;
  manquantes: NomCondition[];
  dessine: boolean;
  attache: boolean;
  titreCible: string;
  verrouille: boolean;
  demandeEnAttente: boolean;
  wakfuLog: string | null;
  dossierLogsManuel: string | null;
  stratChoisie: string | null;
  raccourcis: Poses | null;
  dossierDonnees: string;
  reglagesRefuses: boolean;
  reglagesCorrompus: boolean;
};

function demarrer(): void {
  const racine = join(__dirname, '..');
  const preload = join(racine, 'pont', 'pont.js');
  const page = (surface: string) => join(racine, 'surfaces', surface, 'index.html');

  const depot = new DepotReglages(app.getPath('userData'));
  depot.charger();

  const etat = new EtatConditions();
  const surjeu = new Surjeu();

  let fenetre: FenetrePrincipale | undefined;
  let overlayTour: OverlayTour | undefined;
  let overlayDemande: OverlayDemande | undefined;
  let raccourcis: Raccourcis | undefined;

  const veilleLogs = new VeilleWakfuLog((trouve) => {
    etat.poser('logsTrouves', trouve);
    diffuser();
  });

  /**
   * The `wakfu.log` to watch: the dossier désigné when there is one, otherwise
   * the derivation across the Steam and launcher installs, arbitrated on the
   * most recently modified `wakfu.log` (ADR `0014`).
   *
   * Called at startup and on demand only — never on a timer. The condition
   * itself stays live, but on the retained file: that is `VeilleWakfuLog`'s job,
   * not this one's.
   */
  const cheminWakfuLog = (): string | null =>
    dossierDeLogs(systemeDeFichiersReel(), environnementReel(), {
      dossierDesigne: depot.lire<string | null>('dossierLogsManuel', null) ?? undefined,
    })?.fichier ?? null;

  const instantane = (): Instantane => ({
    conditions: etat.valeurs,
    manquantes: etat.manquantes,
    dessine: etat.dessine,
    attache: surjeu.attache,
    titreCible: TITRE_FENETRE_WAKFU,
    verrouille: overlayTour?.verrouille ?? true,
    demandeEnAttente: overlayDemande?.enAttente ?? false,
    wakfuLog: veilleLogs.chemin,
    dossierLogsManuel: depot.lire<string | null>('dossierLogsManuel', null),
    stratChoisie: depot.lire<string | null>('stratChoisie', null),
    raccourcis: raccourcis?.poses ?? null,
    dossierDonnees: app.getPath('userData'),
    reglagesRefuses: depot.refuse,
    reglagesCorrompus: depot.corrompu,
  });

  const diffuser = (): void => fenetre?.envoyer(CANAL.etat, instantane());

  /**
   * This lot is verified by hand with Wakfu running, and the terminal is the
   * only place that can report on it — the Overlay has no words for itself
   * (ADR `0006`). One line per toggle, not a journal.
   */
  const raconter = (quoi: string): void => {
    const manque = etat.manquantes;
    console.info(
      `[wakfu-memo] ${quoi} — overlay ${etat.dessine && surjeu.attache ? 'dessiné' : 'pas dessiné'}` +
        `${manque.length > 0 ? ` (manque : ${manque.join(', ')})` : ''}`,
    );
  };

  /** Affichage demandé is persisted: it is never asked again between fights. */
  const poserAffichageDemande = (demande: boolean): void => {
    depot.ecrire('affichageDemande', demande);
    etat.poser('affichageDemande', demande);
    overlayTour?.appliquer();
    diffuser();
  };

  const poserStratChoisie = (nom: string | null): void => {
    depot.ecrire('stratChoisie', nom);
    etat.poser('stratChoisie', nom !== null);
    overlayTour?.appliquer();
    diffuser();
  };

  const poserDossierLogs = (dossier: string | null): void => {
    depot.ecrire('dossierLogsManuel', dossier);
    // Clearing it does not turn the condition off: it hands the arbitration back
    // to the detection, which is the return the Réglages promise.
    veilleLogs.suivre(cheminWakfuLog());
    overlayTour?.appliquer();
    diffuser();
  };

  app.on('second-instance', () => fenetre?.rappeler());
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    raccourcis?.retirer();
    veilleLogs.arreter();
    depot.vider();
  });

  ipcMain.handle(CANAL.demanderEtat, () => instantane());
  ipcMain.on(CANAL.basculerAffichage, () => poserAffichageDemande(!etat.valeurs.affichageDemande));
  ipcMain.on(CANAL.choisirStrat, (_evenement, nom: string | null) => poserStratChoisie(nom));
  ipcMain.on(CANAL.basculerVerrou, () => overlayTour?.basculerVerrou());
  ipcMain.on(CANAL.zonesCliquables, (_evenement, zones: Bornes[]) =>
    overlayTour?.declarerZones(zones),
  );
  ipcMain.on(CANAL.deplacerDemande, (_evenement, dx: number, dy: number) =>
    overlayDemande?.deplacer(dx, dy),
  );
  ipcMain.on(CANAL.bancDemande, (_evenement, enAttente: boolean) =>
    overlayDemande?.poserQuestion(enAttente),
  );
  ipcMain.on(CANAL.oublierDossierLogs, () => poserDossierLogs(null));
  ipcMain.on(CANAL.ouvrirDossierDonnees, () => {
    void shell.openPath(app.getPath('userData'));
  });
  ipcMain.handle(CANAL.designerDossierLogs, async () => {
    const choix = await dialog.showOpenDialog({
      title: 'Désigner le dossier de logs de Wakfu',
      properties: ['openDirectory'],
    });
    const dossier = choix.canceled ? null : (choix.filePaths[0] ?? null);
    if (dossier !== null) poserDossierLogs(dossier);
    return dossier;
  });

  void app.whenReady().then(() => {
    const laFenetre = new FenetrePrincipale({
      preload,
      page: page('fenetre-principale'),
      // Closing the Fenêtre principale quits everything, Overlays included.
      surFermeture: () => app.quit(),
    });
    fenetre = laFenetre;

    const leTour = new OverlayTour(etat, surjeu, {
      preload,
      page: page('overlay-tour'),
      surChangement: diffuser,
    });
    overlayTour = leTour;

    const laDemande = new OverlayDemande(surjeu, {
      preload,
      page: page('overlay-demande'),
      surAffichage: () => leTour.remonter(),
    });
    overlayDemande = laDemande;

    surjeu.demarrer(leTour.fenetre, {
      attache: (bornes) => {
        etat.poser('fenetreWakfu', true);
        leTour.appliquer();
        laDemande.attache(bornes);
        raconter(
          `attaché à une fenêtre « … ${TITRE_FENETRE_WAKFU} » ${bornes.width}×${bornes.height}`,
        );
        diffuser();
      },
      detache: () => {
        etat.poser('fenetreWakfu', false);
        leTour.appliquer();
        laDemande.detache();
        raconter('fenêtre du jeu disparue');
        diffuser();
      },
      deplacement: (bornes) => {
        leTour.suivre(bornes);
        laDemande.suivre(bornes);
      },
      focus: () => {
        leTour.appliquer();
        laDemande.focusJeu(true);
      },
      blur: () => {
        leTour.appliquer();
        laDemande.focusJeu(false);
      },
    });

    const lesRaccourcis = new Raccourcis({
      overlay: () => poserAffichageDemande(!etat.valeurs.affichageDemande),
      verrou: () => leTour.basculerVerrou(),
      fenetre: () => laFenetre.rappeler(),
    });
    raccourcis = lesRaccourcis;

    const poses = lesRaccourcis.poser({
      overlay: depot.lire<unknown>(CLE_REGLAGE.overlay, null),
      verrou: depot.lire<unknown>(CLE_REGLAGE.verrou, null),
      fenetre: depot.lire<unknown>(CLE_REGLAGE.fenetre, null),
    });
    for (const [nom, pose] of Object.entries(poses)) {
      if (pose.etat === 'refuse') {
        console.warn(`[raccourci] ${nom} : « ${pose.combinaison} » refusé par le système`);
      }
    }

    // The starting state, as the disk knows it.
    etat.poser('affichageDemande', depot.lire('affichageDemande', false));
    etat.poser('stratChoisie', depot.lire<string | null>('stratChoisie', null) !== null);
    veilleLogs.suivre(cheminWakfuLog());

    etat.surChangement(diffuser);
    leTour.appliquer();
    raconter('démarré');
    diffuser();
  });
}

/**
 * The single instance lock. Not ergonomics: it is what allows persistence in
 * plain JSON files with no file lock and no read-merge (ADR `0004`). Removing
 * it breaks persistence.
 */
if (!relanceEnX11()) {
  if (app.requestSingleInstanceLock()) {
    demarrer();
  } else {
    app.quit();
  }
}
