/**
 * Ce que la fenêtre montre, et qui n'est pas dans le modèle.
 *
 * L'écran courant, la Strat ouverte, le nom en cours de saisie, un menu, un
 * panneau, une confirmation : rien de tout cela ne se persiste, et rien ne
 * remonte au processus principal. Un menu ouvert n'est pas un état de l'app —
 * l'Overlay du Tour tient le même raisonnement pour son menu des Strats.
 */

import type { ConsequenceSuppression } from './pont.ts';

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
   * Ce qu'une confirmation attend. Deux sortes, et une seule boîte : ce qui se
   * supprime ici emporte toujours du travail écrit, et le compte de ce qui part
   * est ce qui rend la question honnête.
   */
  aSupprimer: ADemander | null;
};

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
    };

export const vue: Vue = {
  ecran: 'strats',
  ouverteId: null,
  renommeId: null,
  menu: null,
  panneau: null,
  aSupprimer: null,
};

/** Vrai s'il y avait quelque chose à fermer : un clic ailleurs referme. */
export function fermerLesCalques(): boolean {
  const ouvert = vue.menu !== null || vue.panneau !== null;
  vue.menu = null;
  vue.panneau = null;
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
