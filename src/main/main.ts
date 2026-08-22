/**
 * The bootstrap: the frozen constraints first, the app second.
 *
 * Three surfaces, only one of which is a window — the Fenêtre principale, plus
 * the Overlay du Tour and the Overlay de la Demande d'ajout (ADR `0010`). A
 * normal application: closing it closes everything.
 */

import { dirname, join } from 'node:path';
import { app, dialog, ipcMain, shell } from 'electron';
import {
  dossierDeLogs,
  environnementReel,
  systemeDeFichiersReel,
} from '../logs/dossier-de-logs.ts';
import {
  type Avertissement,
  BORNES,
  type CommandeEdition,
  type CommandeRoster,
  compositionDe,
  editer,
  editerRoster,
  engagements,
  Persistance,
  type Personnage,
  type PersonnageIgnore,
  type Profil,
  REGLAGES_PAR_DEFAUT,
  type Strat,
  supprimerEmplacement,
  supprimerProfil,
  supprimerStrat,
} from '../persistance/index.ts';
import { ficheDuTour } from '../suivi/fiche.ts';
import type { EtatDuSuivi } from '../suivi/suivi-du-tour.ts';
import { CANAL } from './canaux.ts';
import { type Conditions, EtatConditions, type NomCondition } from './conditions-affichage.ts';
import { type DemandeDAjout, DemandesEnAttente, demandesDuCombat } from './demandes-en-attente.ts';
import { FenetrePrincipale } from './fenetre-principale.ts';
import { type ContenuDemande, OverlayDemande } from './overlay-demande.ts';
import { type Aspect, type ContenuOverlay, OverlayTour } from './overlay-tour.ts';
import {
  CLE_REGLAGE,
  combinaisonAcceptable,
  estNomDeRaccourci,
  type NomRaccourci,
  type Poses,
  Raccourcis,
} from './raccourcis.ts';
import { type Bornes, Surjeu, TITRE_FENETRE_WAKFU } from './surjeu.ts';
import { VeilleDuCombat } from './veille-du-combat.ts';
import { VeilleWakfuLog } from './veille-wakfu-log.ts';

const OZONE_X11 = '--ozone-platform=x11';

/**
 * How often the choice of log file is reconsidered, out of combat only.
 *
 * Not the rhythm of the game and not the rhythm of the fight: it is the rhythm
 * at which Wakfu may hand over from one file to the next, which happens once in
 * a session. Five seconds is already far more often than needed, and it is only
 * paid between two fights.
 */
const PERIODE_ROTATION_MS = 5_000;

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
  /** Something is still unanswered — the rail of the Fenêtre principale says so. */
  demandeEnAttente: boolean;
  wakfuLog: string | null;
  /** The folder the retained `wakfu.log` sits in — what the Réglages show. */
  dossierLogs: string | null;
  dossierLogsManuel: string | null;
  /**
   * The four aspect settings, for the décor factice alone: the Fenêtre
   * principale draws them nowhere else — it has no slider for them (ADR `0013`).
   */
  aspect: Aspect;
  /** The name, for the sentence the Socle d'état concludes with (ADR `0012`). */
  stratChoisie: string | null;
  /** The id, because two Strats may bear the same name. */
  stratChoisieId: string | null;
  /**
   * The Strats **whole**: the Fenêtre principale is where they are written, so
   * it gets the model and not a summary. The Overlay still gets `{ id, nom }`
   * only — all its Strat menu ever needs.
   */
  strats: readonly Strat[];
  /** Idem for the Roster, and for the same reason: the screen writes it. */
  profils: readonly Profil[];
  personnages: readonly Personnage[];
  ignores: readonly PersonnageIgnore[];
  /** The Demandes d'ajout still unanswered. Session only — never on disk. */
  aIdentifier: readonly DemandeDAjout[];
  /** px — the minimum width of a fiche in the grid of the Strats screen. */
  ficheMiniFenetre: number;
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

  /**
   * The unanswered Demandes d'ajout, for this session and no longer (#22). Two
   * surfaces read the same list — the Roster screen, and from Lot 8 the Overlay
   * de la Demande d'ajout — so answering on one empties it for the other.
   */
  const aIdentifier = new DemandesEnAttente();

  let fenetre: FenetrePrincipale | undefined;
  let overlayTour: OverlayTour | undefined;
  let overlayDemande: OverlayDemande | undefined;
  let raccourcis: Raccourcis | undefined;
  let rotation: NodeJS.Timeout | null = null;

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
    // The `[_FL_]` burst is the placement phase, and it is the complete roster of
    // the fight: this is where the question surges, without anything having to
    // watch for a phase the log never names.
    poserLesDemandes();
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

  /**
   * The ID d'entité of every Personnage of the Roster. The fiche needs it for
   * one thing: an Échange par clic is remembered as a Préférence de liaison, and
   * a Préférence names a Personnage — so nothing can be exchanged onto a fighter
   * the Roster has never heard of.
   */
  const idsConnus = (): Set<string> => {
    const connus = new Set<string>();
    for (const personnage of persistance.roster.lire().personnages) {
      if (personnage.idEntite !== null) connus.add(personnage.idEntite);
    }
    return connus;
  };

  /** The four aspect settings of ADR `0013`, as both surfaces need them. */
  const aspectCourant = (): Aspect => {
    const reglages = persistance.reglages.lire();
    return {
      opacite: reglages.opacite,
      tailleTexte: reglages.tailleTexte,
      largeur: reglages.largeurFiche,
      x: reglages.ficheX,
      y: reglages.ficheY,
    };
  };

  /** What the Overlay is given to draw, pulled at every send. */
  const contenuOverlay = (): ContenuOverlay => {
    const strat = stratChoisie();
    return {
      fiche: strat === null ? null : ficheDuTour(strat, combat, idsConnus()),
      aspect: aspectCourant(),
      strats: persistance.strats.lire().strats.map((autre) => ({ id: autre.id, nom: autre.nom })),
      // The pastille exists only to bring back what « plus tard » folded away.
      // Never a count of Conflits — nothing asks about those (#16).
      demandesRepliees: overlayDemande?.replie === true ? aIdentifier.liste.length : 0,
    };
  };

  /**
   * What the Overlay de la Demande d'ajout is given to draw, pulled the same way.
   *
   * A rattachement only lands on a Personnage still waiting for its first fight:
   * once an ID d'entité is attached the log has the final word, and moving it
   * would rewrite an identity (ADR `0002`).
   */
  const contenuDemande = (): ContenuDemande => {
    const roster = persistance.roster.lire();
    return {
      demandes: aIdentifier.liste,
      profils: roster.profils.map((profil) => ({ id: profil.id, nom: profil.nom })),
      rattachables: roster.personnages
        .filter((personnage) => personnage.idEntite === null)
        .map((personnage) => ({
          id: personnage.id,
          nom: personnage.nom,
          classe: personnage.classe,
        })),
      opacite: persistance.reglages.lire().opacite,
    };
  };

  /**
   * The Préférences de liaison of the chosen Strat, translated into what the
   * tracking speaks: **Rang → ID d'entité**.
   *
   * A Préférence naming a vanished Emplacement, or a Personnage that never
   * fought, is dropped here rather than purged: it is dead, not wrong, and
   * `strats.json` may well have been set aside on this very boot (ADR `0005`).
   */
  const liaisonsForcees = (): Map<number, string> => {
    const forcees = new Map<number, string>();
    const strat = stratChoisie();
    if (strat === null) return forcees;
    const roster = persistance.roster.lire();
    for (const preference of roster.preferences) {
      if (preference.stratId !== strat.id) continue;
      const personnage = roster.personnages.find(
        (candidat) => candidat.id === preference.personnageId,
      );
      if (personnage === undefined || personnage.idEntite === null) continue;
      const index = strat.emplacements.findIndex(
        (emplacement) => emplacement.id === preference.emplacementId,
      );
      if (index === -1) continue;
      forcees.set(index + 1, personnage.idEntite);
    }
    return forcees;
  };

  const instantane = (): Instantane => ({
    conditions: etat.valeurs,
    manquantes: etat.manquantes,
    dessine: etat.dessine,
    attache: surjeu.attache,
    titreCible: TITRE_FENETRE_WAKFU,
    verrouille: overlayTour?.verrouille ?? true,
    demandeEnAttente: aIdentifier.enAttente,
    wakfuLog: veilleLogs.chemin,
    dossierLogs: veilleLogs.chemin === null ? null : dirname(veilleLogs.chemin),
    dossierLogsManuel: persistance.reglages.lire().dossierLogsManuel,
    aspect: aspectCourant(),
    stratChoisie: stratChoisie()?.nom ?? null,
    stratChoisieId: stratChoisie()?.id ?? null,
    strats: persistance.strats.lire().strats,
    profils: persistance.roster.lire().profils,
    personnages: persistance.roster.lire().personnages,
    ignores: persistance.roster.lire().ignores,
    aIdentifier: aIdentifier.liste,
    ficheMiniFenetre: persistance.reglages.lire().ficheMiniFenetre,
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
   *
   * Called after the choice moves **and after every edition** — renaming the
   * chosen Strat, adding an Emplacement, typing a Consigne all change what the
   * Overlay draws, and the Composition is what the Rotation walks. Without it
   * the Rotation would keep stopping on Emplacements that no longer exist.
   *
   * It does NOT call `appliquer()`. What decides whether the Overlay is drawn is
   * the condition, and `EtatConditions` carries a real change to the Overlay by
   * itself. Calling it again would lay the surjeu's input region down at every
   * keystroke, for nothing.
   */
  const rafraichirLaStratChoisie = (): void => {
    const strat = stratChoisie();
    etat.poser('stratChoisie', strat !== null);
    // The Composition and the Préférences travel together: a Préférence names an
    // Emplacement of THIS Strat, and applying one against the other's
    // Composition would put a Personnage on somebody else's place.
    veilleCombat.poserComposition(strat === null ? [] : compositionDe(strat), liaisonsForcees());
    overlayTour?.envoyerEtat();
    diffuser();
  };

  /**
   * The Échange par clic: the Personnages of two Emplacements permute, and it is
   * written down as a Préférence de liaison so the correction outlives the fight.
   *
   * ⚠️ **A successful exchange is invisible** — two Emplacements of one Classe
   * carry the same icon, the Consigne belongs to the Emplacement and does not
   * move, and ADR `0003` forbids the pseudo at rest. What proves it landed is
   * the surface's business: the two lines blink and say their pseudo for a
   * second. Here, only the Liaison changes.
   *
   * Refused when either side is unknown to the Roster: there would be nothing to
   * write down. The fiche does not offer the click in that case, and the way out
   * is the Demande d'ajout — which is what gave that question its own surface.
   */
  const echangerLaLiaison = (rangA: number, rangB: number): void => {
    const strat = stratChoisie();
    if (strat === null || combat === null || rangA === rangB) return;
    const a = combat.liaison.get(rangA);
    const b = combat.liaison.get(rangB);
    const emplacementA = strat.emplacements[rangA - 1];
    const emplacementB = strat.emplacements[rangB - 1];
    if (a === undefined || b === undefined) return;
    if (emplacementA === undefined || emplacementB === undefined) return;
    // Same Classe, or it is not an exchange: a Strat is written against Classes.
    if (emplacementA.classe !== emplacementB.classe) return;

    const roster = persistance.roster.lire();
    const parEntite = (idEntite: string) =>
      roster.personnages.find((personnage) => personnage.idEntite === idEntite);
    const versA = parEntite(b.idEntite);
    const versB = parEntite(a.idEntite);
    if (versA === undefined || versB === undefined) return;

    let apres = persistance.etat();
    for (const [emplacement, personnage] of [
      [emplacementA, versA],
      [emplacementB, versB],
    ] as const) {
      apres = editerRoster(apres, {
        sorte: 'preferer',
        stratId: strat.id,
        emplacementId: emplacement.id,
        personnageId: personnage.id,
      }).etat;
    }
    persistance.appliquer(apres);
    rafraichirLaStratChoisie();
  };

  /**
   * A question appeared or was answered. The Overlay de la Demande d'ajout is
   * the same fact seen from the game — it surges while something is unanswered,
   * and goes away when the list empties — and the rail of the Fenêtre principale
   * carries the count, because nobody visits the Roster "just in case".
   *
   * `neuf` is what unfolds a panel put off with « plus tard »: a fighter never
   * asked about is another question, and putting one off is not putting off the
   * next.
   */
  const rafraichirLesDemandes = (neuf = false): void => {
    overlayDemande?.poserQuestion(aIdentifier.enAttente, neuf);
    overlayDemande?.envoyerEtat();
    // The pastille of the fiche appears and disappears with the panel.
    overlayTour?.envoyerEtat();
    diffuser();
  };

  /**
   * What the fight has just found, added to what is still unanswered.
   *
   * A Demande survives its fight (#18), so this **adds to** the list and never
   * replaces it: an ID d'entité already there keeps its place and its first
   * spelling. Nothing here is written down — the list is worth a session, and an
   * unknown comes back at the next fight where they play (#22).
   */
  const poserLesDemandes = (): void => {
    if (!aIdentifier.poser(demandesDuCombat(combat, persistance.roster.lire()))) return;
    rafraichirLesDemandes(true);
  };

  const poserStratChoisie = (id: string | null): void => {
    persistance.modifierReglages({ stratChoisie: id });
    overlayTour?.appliquer();
    rafraichirLaStratChoisie();
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

  /**
   * Wakfu rotates its log files, and in multi-account two of them are written at
   * once: the one to follow is not settled once and for all at launch.
   *
   * ⚠️ **Only out of combat**, and that is the whole safety of it. Changing file
   * replays the new one from its first byte — nothing of the old one survives,
   * so no turn is ever counted twice — but a file created mid-fight does not
   * hold that fight's `[_FL_]`, and switching to it would drop the Mise en avant
   * in the middle of a pull. So we look elsewhere only when there is nothing to
   * lose, which is also the moment before the next fight is written.
   *
   * The pass costs a `stat` per sibling; a read only reaches the ones being
   * written, the big rotated ones being ruled out on their date.
   */
  const surveillerLaRotation = (): void => {
    if (combat?.ouvert === true) return;
    suivreLeFichier();
  };

  const poserDossierLogs = (dossier: string | null): void => {
    persistance.modifierReglages({ dossierLogsManuel: dossier });
    // Clearing it does not turn the condition off: it hands the arbitration back
    // to the detection, which is the return the Réglages promise.
    suivreLeFichier();
    overlayTour?.appliquer();
    diffuser();
  };

  /**
   * The porte of the Réglages, and the « Terminé » of the barrette. Unlocking
   * only takes on a drawn Overlay — `deverrouiller()` refuses otherwise, and
   * that refusal is why the screen offers the décor factice instead.
   */
  const poserVerrou = (verrouille: boolean): void => {
    if (verrouille) overlayTour?.verrouiller();
    else overlayTour?.deverrouiller();
  };

  /**
   * The two settings of the barrette. Clamped here and nowhere else: a surface
   * sends what a slider gave it, and `reglages.json` holds the bounds.
   */
  const poserAspect = (recu: { opacite?: unknown; tailleTexte?: unknown }): void => {
    const courant = persistance.reglages.lire();
    const borner = (valeur: unknown, bornes: { min: number; max: number }, defaut: number) =>
      typeof valeur === 'number' && Number.isFinite(valeur)
        ? Math.min(Math.max(Math.round(valeur), bornes.min), bornes.max)
        : defaut;
    persistance.modifierReglages({
      opacite: borner(recu?.opacite, BORNES.opacite, courant.opacite),
      tailleTexte: borner(recu?.tailleTexte, BORNES.tailleTexte, courant.tailleTexte),
    });
    overlayTour?.envoyerEtat();
    // La Demande d'ajout suit la même opacité : elle parle la langue de la fiche
    // (#16), et deux translucidités se liraient comme deux natures.
    overlayDemande?.envoyerEtat();
    diffuser();
  };

  /**
   * A captured combination. All three are laid down again behind it: the system
   * is the only one that knows whether a combination is free, and re-registering
   * is how a refusal turns up in the snapshot.
   */
  const poserRaccourci = (nom: NomRaccourci, combinaison: string | null): void => {
    persistance.modifierReglages({ [CLE_REGLAGE[nom]]: combinaison });
    const apres = persistance.reglages.lire();
    raccourcis?.poser({
      overlay: apres.raccourciOverlay,
      verrou: apres.raccourciVerrou,
      fenetre: apres.raccourciFenetre,
    });
    diffuser();
  };

  app.on('second-instance', () => fenetre?.rappeler());
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    raccourcis?.retirer();
    veilleCombat.arreter();
    veilleLogs.arreter();
    if (rotation !== null) clearInterval(rotation);
    persistance.vider();
  });

  ipcMain.handle(CANAL.demanderEtat, () => instantane());
  ipcMain.on(CANAL.basculerAffichage, () => poserAffichageDemande(!etat.valeurs.affichageDemande));
  ipcMain.on(CANAL.choisirStrat, (_evenement, id: string | null) => poserStratChoisie(id));
  ipcMain.on(CANAL.basculerVerrou, () => overlayTour?.basculerVerrou());
  ipcMain.on(CANAL.poserVerrou, (_evenement, verrouille: boolean) => poserVerrou(verrouille));
  ipcMain.on(
    CANAL.aspectOverlay,
    (_evenement, aspect: { opacite?: number; tailleTexte?: number }) => poserAspect(aspect ?? {}),
  );
  ipcMain.on(CANAL.ficheMiniFenetre, (_evenement, largeur: number) => {
    if (!Number.isFinite(largeur)) return;
    persistance.modifierReglages({
      ficheMiniFenetre: Math.min(
        Math.max(Math.round(largeur), BORNES.ficheMiniFenetre.min),
        BORNES.ficheMiniFenetre.max,
      ),
    });
    diffuser();
  });
  ipcMain.on(CANAL.poserRaccourci, (_evenement, nom: string, combinaison: string | null) => {
    // A surface is never the last word: an unknown name, or a bare
    // combination, is dropped here rather than registered globally.
    if (!estNomDeRaccourci(nom)) return;
    const propre = typeof combinaison === 'string' ? combinaison.trim() : null;
    if (propre !== null && !combinaisonAcceptable(propre)) return;
    poserRaccourci(nom, propre === '' ? null : propre);
  });
  ipcMain.on(CANAL.zonesCliquables, (_evenement, zones: Bornes[]) =>
    overlayTour?.declarerZones(zones),
  );
  ipcMain.on(CANAL.deplacerDemande, (_evenement, dx: number, dy: number) =>
    overlayDemande?.deplacer(dx, dy),
  );
  ipcMain.on(CANAL.hauteurDemande, (_evenement, hauteur: number) =>
    overlayDemande?.poserHauteur(hauteur),
  );
  /**
   * « plus tard » folds, the pastille of the fiche unfolds. Neither is an
   * answer: only `editerRoster` empties a question (ADR `0010`).
   */
  ipcMain.on(CANAL.replierDemande, (_evenement, replie: boolean) => {
    overlayDemande?.replier(replie === true);
    overlayTour?.envoyerEtat();
  });
  /**
   * The native answer menu. It is popped here because it must be able to leave
   * a panel two lines tall, and only the main process can pop a system menu
   * (#16). What it gives back is a **choice**, not a write: the surface turns it
   * into a Roster command, or into the warning that a different Classe deserves.
   */
  ipcMain.handle(
    CANAL.menuDeDemande,
    async (_evenement, idEntite: string, x: number, y: number) => {
      const demande = aIdentifier.liste.find((candidat) => candidat.idEntite === idEntite);
      if (demande === undefined || overlayDemande === undefined) return null;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return overlayDemande.menu(demande, contenuDemande(), { x, y });
    },
  );
  ipcMain.on(CANAL.echangerLiaison, (_evenement, rangA: number, rangB: number) => {
    if (!Number.isInteger(rangA) || !Number.isInteger(rangB)) return;
    echangerLaLiaison(rangA, rangB);
  });
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
    // The décor factice drags the same fiche, and it lives in the Fenêtre
    // principale: without this, its own copy of the position would go stale.
    diffuser();
  });
  /**
   * Every write of the Strats screen comes through here. The surface sends an
   * intent, `edition-strats.ts` decides, and only what moved is rewritten. The
   * id of a Strat just created goes back, so the screen can put its name into
   * edition — nothing else needs an answer.
   */
  ipcMain.handle(CANAL.editerStrats, (_evenement, commande: CommandeEdition) => {
    const { etat: apres, stratId } = editer(persistance.etat(), commande ?? { sorte: 'inconnue' });
    persistance.appliquer(apres);
    rafraichirLaStratChoisie();
    return { stratId };
  });
  /**
   * What the confirmation says, computed by the very function that will apply
   * the deletion — it is pure, so asking costs nothing and the sentence cannot
   * drift from the act (ADR `0012`).
   */
  ipcMain.handle(CANAL.consequenceSuppressionStrat, (_evenement, stratId: string) => {
    const { tours, emplacements, estChoisie, choixPasseA } = supprimerStrat(
      persistance.etat(),
      stratId,
    );
    return { tours, emplacements, estChoisie, choixPasseA };
  });
  ipcMain.handle(
    CANAL.consequenceSuppressionEmplacement,
    (_evenement, stratId: string, emplacementId: string) => {
      const { consignesPerdues, preferencesPerdues } = supprimerEmplacement(
        persistance.etat(),
        stratId,
        emplacementId,
      );
      return { consignesPerdues, preferencesPerdues };
    },
  );
  /**
   * Every write of the Roster screen comes through here — the Profils, the
   * Personnages, and the three answers to a Demande d'ajout. Answering removes
   * the question from the pending list, and that is the only thing that does:
   * not answering is not a refusal (ADR `0010`).
   */
  ipcMain.handle(CANAL.editerRoster, (_evenement, commande: CommandeRoster) => {
    const {
      etat: apres,
      profilId,
      repondu,
    } = editerRoster(persistance.etat(), commande ?? { sorte: 'inconnue' });
    persistance.appliquer(apres);
    aIdentifier.repondre(repondu);
    // A fighter that has just become a Personnage changes the Liaison: they are
    // now someone a Préférence can name, so the fiche gains an Échange par clic
    // it did not offer a moment ago.
    rafraichirLaStratChoisie();
    rafraichirLesDemandes();
    return { profilId };
  });
  /**
   * What the confirmation has to say, computed from the state that will be
   * written. Two shapes, and the second one keeps quiet: « ignorer » holds an ID
   * d'entité, a Personnage typed by hand has none, so its confirmation simply
   * lacks the button rather than explaining why (#22).
   */
  ipcMain.handle(CANAL.consequenceSuppressionPersonnage, (_evenement, personnageId: string) => {
    const courant = persistance.etat();
    const personnage = courant.roster.personnages.find((candidat) => candidat.id === personnageId);
    return {
      idEntite: personnage?.idEntite ?? null,
      engagements: engagements(courant, personnageId).map((engagement) => ({
        stratNom: engagement.stratNom,
        couleur: engagement.couleur,
      })),
    };
  });
  ipcMain.handle(CANAL.consequenceSuppressionProfil, (_evenement, profilId: string) => {
    const courant = persistance.etat();
    const profil = courant.roster.profils.find((candidat) => candidat.id === profilId);
    // « moi » is not deletable: the screen does not offer it, so a question
    // about it has no honest answer to give.
    if (profil === undefined || profil.estMoi) return { personnages: [], preferences: 0 };
    const { personnages } = supprimerProfil(courant, profilId);
    return {
      personnages: personnages.map((personnage) => ({
        nom: personnage.nom,
        classe: personnage.classe,
        aUnIdEntite: personnage.idEntite !== null,
      })),
      preferences: personnages.reduce(
        (compte, personnage) => compte + engagements(courant, personnage.id).length,
        0,
      ),
    };
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
      contenu: contenuDemande,
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
    veilleCombat.poserComposition(
      auDemarrage === null ? [] : compositionDe(auDemarrage),
      liaisonsForcees(),
    );

    // A migration, a file set aside or refused is announced afterwards, never
    // asked about beforehand (ADR `0004`). The Fenêtre principale carries the
    // banner; the terminal is what reports during a manual check.
    for (const avertissement of persistance.avertissements) {
      console.warn(`[persistance] ${JSON.stringify(avertissement)}`);
    }
    suivreLeFichier();
    rotation = setInterval(surveillerLaRotation, PERIODE_ROTATION_MS);
    // The rotation watch must never be what keeps the app alive.
    rotation.unref?.();

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
