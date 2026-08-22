/**
 * Ce que la fenêtre montre, et qui n'est pas dans le modèle.
 *
 * L'écran courant, la Strat ouverte, le nom en cours de saisie, un menu, un
 * panneau, une confirmation : rien de tout cela ne se persiste, et rien ne
 * remonte au processus principal. Un menu ouvert n'est pas un état de l'app —
 * l'Overlay du Tour tient le même raisonnement pour son menu des Strats.
 */

import type {
  ConsequenceSuppression,
  ConsequenceSuppressionPersonnage,
  ConsequenceSuppressionProfil,
} from './pont.ts';

export type Ecran = 'strats' | 'roster' | 'reglages' | 'prise-en-main';

export type Vue = {
  ecran: Ecran;
  /** La Strat descendue dans l'éditeur. `null` : la liste plein écran. */
  ouverteId: string | null;
  /** Le nom en cours de saisie. Ne vit que dans la liste (#21). */
  renommeId: string | null;
  menu: { stratId: string; x: number; y: number } | null;
  /** Le panneau d'un Emplacement. `emplacementId` à `null` : c'est un ajout. */
  panneau: { stratId: string; emplacementId: string | null; x: number; y: number } | null;
  /**
   * Ce qu'une confirmation attend. Quatre sortes, et une seule boîte : ce qui se
   * supprime ici emporte toujours du travail écrit, et le compte de ce qui part
   * est ce qui rend la question honnête.
   */
  aSupprimer: ADemander | null;
  /* ---------------------------------------------------------- le Roster -- */
  /** Le Profil dont le nom est en cours de saisie, dans l'en-tête de sa bande. */
  renommeProfilId: string | null;
  /**
   * Le menu ancré du mur : une vignette n'a la place d'aucun bouton, donc tout
   * geste du Roster passe par là. C'est le prix de la forme, mesuré en #22 —
   * sept gestes contre cinq pour la liste — et il se paie ici.
   */
  menuRoster: MenuRoster | null;
  /** La saisie manuelle. `personnageId` non nul : c'est une correction. */
  saisie: {
    profilId: string;
    personnageId: string | null;
    nom: string;
    classe: string;
    x: number;
    y: number;
  } | null;
};

export type MenuRoster = { x: number; y: number } & (
  | { sorte: 'personnage'; personnageId: string }
  | { sorte: 'profil'; profilId: string }
  /** Les trois réponses à une Demande d'ajout, sur un seul menu (#16). */
  | { sorte: 'ajouter'; idEntite: string }
  | { sorte: 'rattacher'; idEntite: string }
  /** L'avertissement de l'ADR `0002` : « non » annule le rattachement. */
  | { sorte: 'classe-differente'; idEntite: string; personnageId: string }
);

export type ADemander =
  | {
      sorte: 'strat';
      stratId: string;
      nom: string;
      consequence: ConsequenceSuppression;
    }
  | {
      sorte: 'emplacement';
      stratId: string;
      emplacementId: string;
      /** « l'emplacement Iop rouge » : un Emplacement n'a pas d'autre nom. */
      designation: string;
      consignes: number;
    }
  | {
      sorte: 'personnage';
      personnageId: string;
      nom: string;
      consequence: ConsequenceSuppressionPersonnage;
    }
  | {
      sorte: 'profil';
      profilId: string;
      nom: string;
      consequence: ConsequenceSuppressionProfil;
    };

export const vue: Vue = {
  ecran: 'strats',
  ouverteId: null,
  renommeId: null,
  menu: null,
  panneau: null,
  aSupprimer: null,
  renommeProfilId: null,
  menuRoster: null,
  saisie: null,
};

/**
 * Vrai s'il y avait quelque chose à fermer : un clic ailleurs referme.
 *
 * La saisie manuelle n'en est pas : un formulaire à moitié rempli ne se ferme
 * pas sur un clic de travers — il a son « Annuler » et sa touche Échap.
 */
export function fermerLesCalques(): boolean {
  const ouvert = vue.menu !== null || vue.panneau !== null || vue.menuRoster !== null;
  vue.menu = null;
  vue.panneau = null;
  vue.menuRoster = null;
  return ouvert;
}

let peintre: () => void = () => {};

export function surRepeindre(rappel: () => void): void {
  peintre = rappel;
}

export function repeindre(): void {
  peintre();
}

/**
 * Pose un calque dans la fenêtre sans le laisser sortir : le panneau d'un
 * Emplacement s'ouvre au bord d'une colonne de 64 px, donc il déborde par
 * construction, et près du bas il déborderait la fenêtre.
 */
export function ancrer(
  calque: HTMLElement,
  point: { x: number; y: number },
  taille: { largeur: number; hauteur: number },
): void {
  calque.style.left = `${Math.max(6, Math.min(point.x, window.innerWidth - taille.largeur - 6))}px`;
  calque.style.top = `${Math.max(6, Math.min(point.y, window.innerHeight - taille.hauteur - 6))}px`;
}
