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
  ouvrirDossierDonnees: 'memo:ouvrir-dossier-donnees',
  /** Demande d'ajout → main: the player dragged the panel, by this much. */
  deplacerDemande: 'memo:deplacer-demande',
  /**
   * Overlay du Tour → main: the two gestures on the object itself (ADR `0013`).
   * A `null` width asks for the automatic one.
   */
  largeurFiche: 'memo:largeur-fiche',
  positionFiche: 'memo:position-fiche',
  /** Lot 2 test bench: makes the Demande d'ajout shell appear. */
  bancDemande: 'memo:banc-demande',
  /** Lot 4 test bench: sows a Strat, until Lot 5 brings the editor. */
  bancStrat: 'memo:banc-strat',
} as const;
