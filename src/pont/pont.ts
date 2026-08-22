/**
 * What the three surfaces are allowed to ask of the main process. Context
 * isolation and sandbox, so nothing else gets through.
 */

import { contextBridge, ipcRenderer } from 'electron';

import type { CANAL as CANAUX } from '../main/canaux.ts';

/**
 * The channel names are copied, not imported.
 *
 * A sandboxed preload can only `require` `electron` and a handful of Node
 * modules: a neighbouring file is refused, and the bridge then fails to load at
 * all — `window.memo` stays undefined and the three surfaces go mute without
 * saying anything.
 *
 * The `import type` above is erased at compile time, so it does not exist at
 * runtime. It serves one purpose: `typeof CANAUX` forces this list to stay
 * identical to the one in `canaux.ts`, or compilation fails.
 */
const CANAL: typeof CANAUX = {
  etat: 'memo:etat',
  overlayTour: 'memo:overlay-tour',
  zonesCliquables: 'memo:zones-cliquables',
  demanderEtat: 'memo:etat-demande',
  basculerAffichage: 'memo:basculer-affichage',
  choisirStrat: 'memo:choisir-strat',
  designerDossierLogs: 'memo:designer-dossier-logs',
  oublierDossierLogs: 'memo:oublier-dossier-logs',
  basculerVerrou: 'memo:basculer-verrou',
  poserVerrou: 'memo:poser-verrou',
  aspectOverlay: 'memo:aspect-overlay',
  ficheMiniFenetre: 'memo:fiche-mini-fenetre',
  poserRaccourci: 'memo:poser-raccourci',
  ouvrirDossierDonnees: 'memo:ouvrir-dossier-donnees',
  deplacerDemande: 'memo:deplacer-demande',
  largeurFiche: 'memo:largeur-fiche',
  positionFiche: 'memo:position-fiche',
  editerStrats: 'memo:editer-strats',
  consequenceSuppressionStrat: 'memo:consequence-suppression-strat',
  consequenceSuppressionEmplacement: 'memo:consequence-suppression-emplacement',
  editerRoster: 'memo:editer-roster',
  consequenceSuppressionPersonnage: 'memo:consequence-suppression-personnage',
  consequenceSuppressionProfil: 'memo:consequence-suppression-profil',
  bancDemande: 'memo:banc-demande',
};

const memo = {
  etat: () => ipcRenderer.invoke(CANAL.demanderEtat),
  surEtat: (rappel: (etat: unknown) => void) => {
    ipcRenderer.on(CANAL.etat, (_evenement, etat) => rappel(etat));
  },
  surOverlayTour: (rappel: (etat: unknown) => void) => {
    ipcRenderer.on(CANAL.overlayTour, (_evenement, etat) => rappel(etat));
  },
  basculerAffichage: () => ipcRenderer.send(CANAL.basculerAffichage),
  choisirStrat: (nom: string | null) => ipcRenderer.send(CANAL.choisirStrat, nom),
  basculerVerrou: () => ipcRenderer.send(CANAL.basculerVerrou),
  /** The porte of the Réglages, and the « Terminé » of the barrette. */
  poserVerrou: (verrouille: boolean) => ipcRenderer.send(CANAL.poserVerrou, verrouille),
  /** The barrette, on the Overlay or on the décor factice: opacity, text size. */
  poserAspect: (aspect: { opacite?: number; tailleTexte?: number }) =>
    ipcRenderer.send(CANAL.aspectOverlay, aspect),
  poserFicheMiniFenetre: (largeur: number) => ipcRenderer.send(CANAL.ficheMiniFenetre, largeur),
  poserRaccourci: (nom: string, combinaison: string | null) =>
    ipcRenderer.send(CANAL.poserRaccourci, nom, combinaison),
  declarerZonesCliquables: (zones: { x: number; y: number; width: number; height: number }[]) =>
    ipcRenderer.send(CANAL.zonesCliquables, zones),
  designerDossierLogs: () => ipcRenderer.invoke(CANAL.designerDossierLogs),
  oublierDossierLogs: () => ipcRenderer.send(CANAL.oublierDossierLogs),
  ouvrirDossierDonnees: () => ipcRenderer.send(CANAL.ouvrirDossierDonnees),
  deplacerDemande: (dx: number, dy: number) => ipcRenderer.send(CANAL.deplacerDemande, dx, dy),
  /** `null`: back to the automatic width, on a double-click at the right edge. */
  poserLargeurFiche: (largeur: number | null) => ipcRenderer.send(CANAL.largeurFiche, largeur),
  poserPositionFiche: (x: number, y: number) => ipcRenderer.send(CANAL.positionFiche, x, y),
  /**
   * The only way the Strats screen writes. One command in, the id of what it
   * created back: the surface never touches `strats.json` and never invents an
   * id — `edition-strats.ts` owns every rule.
   */
  editerStrats: (commande: unknown) => ipcRenderer.invoke(CANAL.editerStrats, commande),
  consequenceSuppressionStrat: (stratId: string) =>
    ipcRenderer.invoke(CANAL.consequenceSuppressionStrat, stratId),
  consequenceSuppressionEmplacement: (stratId: string, emplacementId: string) =>
    ipcRenderer.invoke(CANAL.consequenceSuppressionEmplacement, stratId, emplacementId),
  /** The Roster screen's only way of writing. Same contract as `editerStrats`. */
  editerRoster: (commande: unknown) => ipcRenderer.invoke(CANAL.editerRoster, commande),
  consequenceSuppressionPersonnage: (personnageId: string) =>
    ipcRenderer.invoke(CANAL.consequenceSuppressionPersonnage, personnageId),
  consequenceSuppressionProfil: (profilId: string) =>
    ipcRenderer.invoke(CANAL.consequenceSuppressionProfil, profilId),
  bancDemande: (enAttente: boolean) => ipcRenderer.send(CANAL.bancDemande, enAttente),
};

contextBridge.exposeInMainWorld('memo', memo);

export type PontMemo = typeof memo;
