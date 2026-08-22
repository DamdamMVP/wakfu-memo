/** The channels between the main process and the three surfaces. */
export const CANAL = {
  /** main → Fenêtre principale: the full snapshot. */
  etat: 'memo:etat',
  /** main → Overlay du Tour: lock and drawing. */
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
  /** Lot 2 test bench: makes the Demande d'ajout shell appear. */
  bancDemande: 'memo:banc-demande',
} as const;
