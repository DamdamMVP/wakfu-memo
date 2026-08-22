/**
 * Opaque ids on Profil, Personnage, Strat and Emplacement.
 *
 * The Emplacement needs one because the Consignes index on it and because its
 * two distinctive attributes — Rang and Couleur — both move: the Rang is its
 * place in the Composition, changed by a drag, and the Couleur is swapped when a
 * taken one is picked. So the Couleur cannot be the key, unique as it is.
 *
 * The shape is nanoid's — 21 characters of a URL-safe alphabet, out of the
 * system's CSPRNG — without the dependency: the repo carries one runtime
 * dependency and it is the overlay.
 */

import { randomBytes } from 'node:crypto';

const ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
const LONGUEUR = 21;

export function nouvelId(): string {
  const octets = randomBytes(LONGUEUR);
  let id = '';
  for (const octet of octets) id += ALPHABET[octet & 63];
  return id;
}
