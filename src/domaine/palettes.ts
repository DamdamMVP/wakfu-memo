/**
 * The two palettes, hexadecimal on both sides (ADR `0004`).
 *
 * They are two closed sets, and that is what guarantees the contrast: a colour
 * is picked from a swatch, never typed as a hex. The Couleur names live in
 * `composition.ts` because the turn tracking speaks them too; only the tints
 * are here.
 */

import { COULEURS, type Couleur } from './composition.ts';

/**
 * The six Couleurs of an Emplacement, settled in #21 and filed by ADR `0003`:
 * five hues at least 47° apart, plus the achromatic `gris`. At six Couleurs the
 * green–cyan–blue region cannot carry two distinct ones, and grey does without.
 *
 * The disk stores the hex, not the name (ADR `0004`) — the reserve being that
 * retouching a tint will need a migration remapping the old values.
 */
export const HEXA_DE_COULEUR: Record<Couleur, string> = {
  rouge: '#ff5252',
  jaune: '#ffdd33',
  vert: '#4ade50',
  bleu: '#22d3d3',
  rose: '#ff4fd8',
  gris: '#a3a8b0',
};

/** The Couleur a stored hex names, or `null` when it names none of the six. */
export function couleurDeHexa(hexa: unknown): Couleur | null {
  if (typeof hexa !== 'string') return null;
  const cherche = hexa.trim().toLowerCase();
  return COULEURS.find((couleur) => HEXA_DE_COULEUR[couleur] === cherche) ?? null;
}

/**
 * The ten text tints of a Consigne — a palette distinct from the Emplacements',
 * so that a coloured word never reads as a Couleur. A segment without `c` takes
 * the fiche's default colour.
 */
export const TEINTES_TEXTE = [
  '#ef5350',
  '#f08c3a',
  '#e8c33c',
  '#48c07d',
  '#2fb3c9',
  '#5b8cff',
  '#a97ae8',
  '#e85fa8',
  '#9aa2b2',
  '#e8eaef',
] as const;

export type TeinteTexte = (typeof TEINTES_TEXTE)[number];

export function estTeinteTexte(valeur: unknown): valeur is TeinteTexte {
  return typeof valeur === 'string' && (TEINTES_TEXTE as readonly string[]).includes(valeur);
}
