/** The channels between the main process and the three surfaces. */
export const CANAL = {
  /** main → Fenêtre principale: the full snapshot. */
  etat: 'memo:etat',
  /** main → Overlay du Tour: the fiche, its aspect, the lock, and drawing. */
  overlayTour: 'memo:overlay-tour',
  /** Overlay du Tour → main: the rectangles the surface really occupies. */
  zonesCliquables: 'memo:zones-cliquables',
  /** surface → main, as `invoke`: give me the snapshot. */
  demanderEtat: 'memo:etat-demande',
  basculerAffichage: 'memo:basculer-affichage',
  choisirStrat: 'memo:choisir-strat',
  designerDossierLogs: 'memo:designer-dossier-logs',
  oublierDossierLogs: 'memo:oublier-dossier-logs',
  basculerVerrou: 'memo:basculer-verrou',
  /**
   * Réglages screen → main: the porte, and the way back. Not a toggle — the
   * screen says which side it wants, a toggle sent from a window that is not
   * the Overlay could always land on the wrong one.
   */
  poserVerrou: 'memo:poser-verrou',
  /**
   * Barrette → main: the two aspect settings that have no handle on the object
   * (ADR `0013`). Sent at every notch of the slider, so the judgement is made
   * against the game's pixels and not against a preview.
   */
  aspectOverlay: 'memo:aspect-overlay',
  /** Réglages screen → main: the OTHER width — the one of the grid of fiches. */
  ficheMiniFenetre: 'memo:fiche-mini-fenetre',
  /**
   * Réglages screen → main: one of the three global shortcuts, captured. All
   * three are laid down again behind it, the system being the only one that
   * knows whether a combination is free.
   */
  poserRaccourci: 'memo:poser-raccourci',
  ouvrirDossierDonnees: 'memo:ouvrir-dossier-donnees',
  /** Demande d'ajout → main: the player dragged the panel, by this much. */
  deplacerDemande: 'memo:deplacer-demande',
  /**
   * Overlay du Tour → main: the two gestures on the object itself (ADR `0013`).
   * A `null` width asks for the automatic one.
   */
  largeurFiche: 'memo:largeur-fiche',
  positionFiche: 'memo:position-fiche',
  /**
   * Strats screen → main, as `invoke`: one edition command, and back the id of
   * the Strat it created, so the screen can put its name into edition.
   */
  editerStrats: 'memo:editer-strats',
  /**
   * Strats screen → main, as `invoke`: what deleting this Strat would cost, and
   * where the choice would go. Asked before the confirmation, so the sentence
   * ADR `0012` requires is computed by the module that will apply it, once.
   */
  consequenceSuppressionStrat: 'memo:consequence-suppression-strat',
  /**
   * Idem pour un Emplacement : le nombre de Consignes qu'il emporte dans tous
   * les Tours. Sans confirmation, un clic effacerait sept Consignes écrites.
   */
  consequenceSuppressionEmplacement: 'memo:consequence-suppression-emplacement',
  /**
   * Roster screen → main, as `invoke`: one edition command, and back the id of
   * the Profil it created. Same contract as `editerStrats`, and same reason —
   * `edition-roster.ts` owns every invariant of `roster.json`.
   */
  editerRoster: 'memo:editer-roster',
  /**
   * What deleting this Personnage would cost: where it is engaged, and whether
   * it can be ignored at all — « ignorer » holds an ID d'entité, and a
   * Personnage typed by hand has none.
   */
  consequenceSuppressionPersonnage: 'memo:consequence-suppression-personnage',
  /** Idem for a Profil: the Personnages it carries away, and their Préférences. */
  consequenceSuppressionProfil: 'memo:consequence-suppression-profil',
  /**
   * Lot 6 test bench: seeds the Demandes d'ajout the log will produce in Lot 8,
   * and clears them. Nothing else can fill that list until the fight does.
   */
  bancDemande: 'memo:banc-demande',
} as const;
