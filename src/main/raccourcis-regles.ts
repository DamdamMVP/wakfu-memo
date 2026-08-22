/**
 * The rules of the three global shortcuts, listed by the Réglages mockup (ADR
 * `0013`) — without Electron, so testable without launching the app.
 *
 * The lock one is mandatory and cannot be cleared: a locked Overlay is
 * click-through, padlock included, so this shortcut is the only way back. It
 * can be changed, it cannot be removed.
 */

export const RACCOURCIS = ['overlay', 'verrou', 'fenetre'] as const;
export type NomRaccourci = (typeof RACCOURCIS)[number];

/** The `reglages.json` keys where the combinations live. */
export const CLE_REGLAGE: Record<NomRaccourci, string> = {
  overlay: 'raccourciOverlay',
  verrou: 'raccourciVerrou',
  fenetre: 'raccourciFenetre',
};

export const EFFACABLE: Record<NomRaccourci, boolean> = {
  overlay: true,
  verrou: false,
  fenetre: true,
};

/**
 * The default combinations are NOT settled — the Réglages mockup gives them as
 * examples. What is frozen is that there are three and that the lock one always
 * exists.
 */
export const DEFAUT_VERROU = 'Ctrl+Alt+L';

export type EtatRaccourci = 'pris' | 'refuse' | 'absent';

export type Poses = Record<NomRaccourci, { combinaison: string | null; etat: EtatRaccourci }>;

/** An empty shortcut is allowed, except for the lock which falls back. */
export function combinaisonRetenue(nom: NomRaccourci, brut: unknown): string | null {
  const combinaison = typeof brut === 'string' && brut.trim() !== '' ? brut.trim() : null;
  if (combinaison !== null) return combinaison;
  return EFFACABLE[nom] ? null : DEFAUT_VERROU;
}
