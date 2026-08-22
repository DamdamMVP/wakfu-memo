/**
 * The rules of the three global shortcuts, listed by the Réglages mockup (ADR
 * `0013`) — without Electron, so testable without launching the app.
 *
 * The lock one is mandatory and cannot be cleared: a locked Overlay is
 * click-through, padlock included, so this shortcut is the only way back. It
 * can be changed, it cannot be removed.
 */

import type { Reglages } from '../persistance/reglages.ts';

export const RACCOURCIS = ['overlay', 'verrou', 'fenetre'] as const;
export type NomRaccourci = (typeof RACCOURCIS)[number];

export const EFFACABLE: Record<NomRaccourci, boolean> = {
  overlay: true,
  verrou: false,
  fenetre: true,
};

/** Where each one lives in `reglages.json`. The screen sends a name, not a key. */
export const CLE_REGLAGE: Record<NomRaccourci, keyof Reglages> = {
  overlay: 'raccourciOverlay',
  verrou: 'raccourciVerrou',
  fenetre: 'raccourciFenetre',
};

export const estNomDeRaccourci = (brut: unknown): brut is NomRaccourci =>
  typeof brut === 'string' && (RACCOURCIS as readonly string[]).includes(brut);

/**
 * The default combinations are NOT settled — the Réglages mockup gives them as
 * examples. What is frozen is that there are three and that the lock one always
 * exists.
 */
export const DEFAUT_VERROU = 'Ctrl+Alt+L';

export type EtatRaccourci = 'pris' | 'refuse' | 'absent';

export type Poses = Record<NomRaccourci, { combinaison: string | null; etat: EtatRaccourci }>;

/**
 * Electron's accelerator modifiers, as the capture writes them.
 *
 * A **bare** combination is refused, and that is not cosmetic: a global shortcut
 * takes the key from every application, so registering `A` would cost the player
 * the letter A inside Wakfu — chat included. The Réglages refuse it at capture
 * time, and this rule refuses it again on the way in: a surface is never the
 * last word.
 */
const MODIFICATEURS = new Set([
  'Ctrl',
  'Control',
  'CmdOrCtrl',
  'CommandOrControl',
  'Cmd',
  'Command',
  'Alt',
  'Option',
  'AltGr',
  'Shift',
  'Super',
  'Meta',
]);

/** Vrai si la combinaison porte au moins un modificateur **et** une autre touche. */
export function combinaisonAcceptable(combinaison: string): boolean {
  const touches = combinaison.split('+').map((touche) => touche.trim());
  if (touches.some((touche) => touche === '')) return false;
  return (
    touches.some((touche) => MODIFICATEURS.has(touche)) &&
    touches.some((touche) => !MODIFICATEURS.has(touche))
  );
}

/** An empty shortcut is allowed, except for the lock which falls back. */
export function combinaisonRetenue(nom: NomRaccourci, brut: unknown): string | null {
  const propre = typeof brut === 'string' ? brut.trim() : '';
  const combinaison = propre !== '' && combinaisonAcceptable(propre) ? propre : null;
  if (combinaison !== null) return combinaison;
  return EFFACABLE[nom] ? null : DEFAUT_VERROU;
}

/** Une touche pressée, telle qu'un `keydown` la donne, sans le DOM. */
export type Frappe = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
};

/**
 * La combinaison qu'une frappe désigne, ou `null` tant qu'elle n'en désigne
 * aucune — un modificateur tenu seul, ou une touche nue.
 *
 * L'ordre des modificateurs est fixé ici : deux captures de la même combinaison
 * doivent écrire la même chaîne, sinon le fichier garde deux orthographes pour
 * un même raccourci.
 */
export function combinaisonDeLaFrappe(frappe: Frappe): string | null {
  const modificateurs = [
    frappe.ctrlKey ? 'Ctrl' : '',
    frappe.altKey ? 'Alt' : '',
    frappe.shiftKey ? 'Shift' : '',
    frappe.metaKey ? 'Super' : '',
  ].filter((nom) => nom !== '');

  const touche =
    frappe.key.length === 1
      ? frappe.key.toUpperCase()
      : MODIFICATEURS.has(frappe.key) || frappe.key === 'Dead'
        ? null
        : frappe.key;

  if (touche === null || modificateurs.length === 0) return null;
  return [...modificateurs, touche].join('+');
}
