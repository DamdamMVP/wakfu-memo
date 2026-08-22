/**
 * Rich text is a flat list of segments `[{ t, c }]`.
 *
 * There is a single attribute — the colour — so no nesting is possible and a
 * flat list is the exact shape: no parser to write nor to keep in sync between
 * the editor and the Overlay, no HTML injection, one `<span>` per segment. Plain
 * text is a segment without a colour, so it is not a special case.
 *
 * Accepted corollary: never bold, italic nor underline. The day we want one, the
 * segment gains a boolean.
 */

import { estTeinteTexte, type TeinteTexte } from './palettes.ts';

export type Segment = {
  readonly t: string;
  readonly c?: TeinteTexte;
};

/**
 * Repairs a segment list on read: what is not a segment goes, an empty `t` goes,
 * and a tint outside the palette falls back to the default colour. An empty list
 * is said by an absent key, never by an empty array — one way to say "nothing to
 * do".
 */
export function normaliserSegments(brut: unknown): Segment[] {
  if (!Array.isArray(brut)) return [];
  const segments: Segment[] = [];
  for (const candidat of brut) {
    if (typeof candidat !== 'object' || candidat === null) continue;
    const { t, c } = candidat as { t?: unknown; c?: unknown };
    if (typeof t !== 'string' || t === '') continue;
    segments.push(estTeinteTexte(c) ? { t, c } : { t });
  }
  return segments;
}

/** The text of a Consigne without its colours — for a search, an export. */
export function texteBrut(segments: readonly Segment[]): string {
  return segments.map((segment) => segment.t).join('');
}
