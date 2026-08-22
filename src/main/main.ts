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
import {
  type Avertissement,
  BORNES,
  compositionDe,
  Persistance,
  REGLAGES_PAR_DEFAUT,
  type Strat,
} from '../persistance/index.ts';
import { ficheDuTour } from '../suivi/fiche.ts';
import type { EtatDuSuivi } from '../suivi/suivi-du-tour.ts';
import { stratDEssai } from './banc-strat.ts';
import { CANAL } from './canaux.ts';
import { type Conditions, EtatConditions, type NomCondition } from './conditions-affichage.ts';
import { FenetrePrincipale } from './fenetre-principale.ts';
import { OverlayDemande } from './overlay-demande.ts';
import { type ContenuOverlay, OverlayTour } from './overlay-tour.ts';
import { type Poses, Raccourcis } from './raccourcis.ts';
import { type Bornes, Surjeu, TITRE_FENETRE_WAKFU } from './surjeu.ts';
import { VeilleDuCombat } from './veille-du-combat.ts';
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
  /** The name, for the sentence the Socle d'état concludes with (ADR `0012`). */
  stratChoisie: string | null;
  /** The id, because two Strats may bear the same name. */
  stratChoisieId: string | null;
  strats: { id: string; nom: string }[];
  raccourcis: Poses | null;
  dossierDonnees: string;
  avertissements: Avertissement[];
};

function demarrer(): void {
  const racine = join(__dirname, '..');
  const preload = join(racine, 'pont', 'pont.js');
  const page = (surface: string) => join(racine, 'surfaces', surface, 'index.html');

  const persistance = new Persistance(app.getPath('userData'));
  persistance.charger();

  const etat = new EtatConditions();
  const surjeu = new Surjeu();

  let fenetre: FenetrePrincipale | undefined;
  let overlayTour: OverlayTour | undefined;
  let overlayDemande: OverlayDemande | undefined;
  let raccourcis: Raccourcis | undefined;

  /**
   * The combat in progress, as the reader last saw it. `null` is out of combat
   * **and** a combat we could not rebuild: the two are indistinguishable on
   * purpose (ADR `0006`).
   */
  let combat: EtatDuSuivi | null = null;

  /**
   * The Tour courant and the Rotation, followed live. Every change repaints the
   * fiche and nothing else: the Overlay has no other source.
   */
  const veilleCombat = new VeilleDuCombat((enCours) => {
    combat = enCours;
    overlayTour?.envoyerEtat();
  });

  const veilleLogs = new VeilleWakfuLog((trouve, chemin) => {
    etat.poser('logsTrouves', trouve);
    // The file the Overlay follows is the one the condition rules on: losing it
    // drops the combat state with it, rather than freezing the fiche on a Tour
    // that nothing will ever move again.
    veilleCombat.suivre(trouve ? chemin : null);
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
      dossierDesigne: persistance.reglages.lire().dossierLogsManuel ?? undefined,
    })?.fichier ?? null;

  /**
   * The chosen Strat, or `null` — including when the stored id names a Strat
   * that no longer exists. A dangling id is not a chosen Strat: it must not let
   * the condition pass, or the Overlay would have to draw a fiche of nothing,
   * which is precisely the state ADR `0006` refuses.
   */
  const stratChoisie = (): Strat | null => {
    const id = persistance.reglages.lire().stratChoisie;
    if (id === null) return null;
    return persistance.strats.lire().strats.find((strat) => strat.id === id) ?? null;
  };

  /** What the Overlay is given to draw, pulled at every send. */
  const contenuOverlay = (): ContenuOverlay => {
    const strat = stratChoisie();
    const reglages = persistance.reglages.lire();
    return {
      fiche: strat === null ? null : ficheDuTour(strat, combat),
      aspect: {
        opacite: reglages.opacite,
        tailleTexte: reglages.tailleTexte,
        largeur: reglages.largeurFiche,
        x: reglages.ficheX,
        y: reglages.ficheY,
      },
      strats: persistance.strats.lire().strats.map((autre) => ({ id: autre.id, nom: autre.nom })),
    };
  };

  const instantane = (): Instantane => ({
    conditions: etat.valeurs,
    manquantes: etat.manquantes,
    dessine: etat.dessine,
    attache: surjeu.attache,
    titreCible: TITRE_FENETRE_WAKFU,
    verrouille: overlayTour?.verrouille ?? true,
    demandeEnAttente: overlayDemande?.enAttente ?? false,
    wakfuLog: veilleLogs.chemin,
    dossierLogsManuel: persistance.reglages.lire().dossierLogsManuel,
    stratChoisie: stratChoisie()?.nom ?? null,
    stratChoisieId: stratChoisie()?.id ?? null,
    strats: persistance.strats.lire().strats.map((strat) => ({ id: strat.id, nom: strat.nom })),
    raccourcis: raccourcis?.poses ?? null,
    dossierDonnees: app.getPath('userData'),
    avertissements: persistance.avertissements,
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
    persistance.modifierReglages({ affichageDemande: demande });
    etat.poser('affichageDemande', demande);
    overlayTour?.appliquer();
    diffuser();
  };

  /**
   * The chosen Strat drives two things at once, and they must not drift: the
   * fourth display condition, and the Composition the Rotation stops on.
   */
  const poserStratChoisie = (id: string | null): void => {
    persistance.modifierReglages({ stratChoisie: id });
    const strat = stratChoisie();
    etat.poser('stratChoisie', strat !== null);
    veilleCombat.poserComposition(strat === null ? [] : compositionDe(strat));
    overlayTour?.appliquer();
    overlayTour?.envoyerEtat();
    diffuser();
  };

  /**
   * The two watches on the same file, laid down together: the condition of ADR
   * `0014` only fires when the fact **changes**, so designating another folder
   * that also holds a readable `wakfu.log` would leave the combat watch on the
   * old one.
   */
  const suivreLeFichier = (): void => {
    veilleLogs.suivre(cheminWakfuLog());
    veilleCombat.suivre(veilleLogs.trouve ? veilleLogs.chemin : null);
  };

  const poserDossierLogs = (dossier: string | null): void => {
    persistance.modifierReglages({ dossierLogsManuel: dossier });
    // Clearing it does not turn the condition off: it hands the arbitration back
    // to the detection, which is the return the Réglages promise.
    suivreLeFichier();
    overlayTour?.appliquer();
    diffuser();
  };

  app.on('second-instance', () => fenetre?.rappeler());
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    raccourcis?.retirer();
    veilleCombat.arreter();
    veilleLogs.arreter();
    persistance.vider();
  });

  ipcMain.handle(CANAL.demanderEtat, () => instantane());
  ipcMain.on(CANAL.basculerAffichage, () => poserAffichageDemande(!etat.valeurs.affichageDemande));
  ipcMain.on(CANAL.choisirStrat, (_evenement, id: string | null) => poserStratChoisie(id));
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
  /**
   * The width of the fiche, caught at its right edge — a global setting, only
   * one fiche being visible. `null` is the double-click: back to the automatic
   * width, which here is the code default, there being no grid to fill.
   */
  ipcMain.on(CANAL.largeurFiche, (_evenement, largeur: number | null) => {
    persistance.modifierReglages({
      largeurFiche:
        largeur === null || !Number.isFinite(largeur)
          ? REGLAGES_PAR_DEFAUT.largeurFiche
          : Math.max(BORNES.largeurFiche.min, Math.round(largeur)),
    });
    overlayTour?.envoyerEtat();
    diffuser();
  });
  ipcMain.on(CANAL.positionFiche, (_evenement, x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    persistance.modifierReglages({
      ficheX: Math.max(0, Math.round(x)),
      ficheY: Math.max(0, Math.round(y)),
    });
    overlayTour?.envoyerEtat();
  });
  /**
   * LOT 4 TEST BENCH. The Overlay is not drawn without a Strat chosen, and the
   * editor is Lot 5: without this, the fiche could not be looked at once. Sowing
   * one chooses it, exactly as creating the first Strat will (ADR `0012`).
   */
  ipcMain.on(CANAL.bancStrat, () => {
    const strat = stratDEssai();
    const strats = persistance.strats.lire();
    persistance.strats.ecrire({ strats: [...strats.strats, strat] });
    poserStratChoisie(strat.id);
  });
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
      contenu: contenuOverlay,
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

    const reglages = persistance.reglages.lire();
    const poses = lesRaccourcis.poser({
      overlay: reglages.raccourciOverlay,
      verrou: reglages.raccourciVerrou,
      fenetre: reglages.raccourciFenetre,
    });
    for (const [nom, pose] of Object.entries(poses)) {
      if (pose.etat === 'refuse') {
        console.warn(`[raccourci] ${nom} : « ${pose.combinaison} » refusé par le système`);
      }
    }

    // The starting state, as the disk knows it.
    etat.poser('affichageDemande', reglages.affichageDemande);
    const auDemarrage = stratChoisie();
    etat.poser('stratChoisie', auDemarrage !== null);
    veilleCombat.poserComposition(auDemarrage === null ? [] : compositionDe(auDemarrage));

    // A migration, a file set aside or refused is announced afterwards, never
    // asked about beforehand (ADR `0004`). The Fenêtre principale carries the
    // banner; the terminal is what reports during a manual check.
    for (const avertissement of persistance.avertissements) {
      console.warn(`[persistance] ${JSON.stringify(avertissement)}`);
    }
    suivreLeFichier();

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
