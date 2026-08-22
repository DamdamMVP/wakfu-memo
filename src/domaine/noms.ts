/**
 * The canonical form of a Wakfu character name.
 *
 * Established **in the game**, not on the logs: when creating a character Wakfu
 * accepts only the letters of the alphabet, the hyphen and the apostrophe — no
 * digit, no space, **no accent** — and it **forces** the capital in three
 * places, with no say in it: at the head, after every hyphen, and after every
 * apostrophe (`Salut-Mec-Ca-Va`, `S'Alu-Ca'Va`; see the "La forme d'un nom de
 * personnage" section of the log grammar).
 *
 * A sequence of letters therefore has **one single valid spelling**, and the
 * case is not information: it is **derived**. Three consequences, and they are
 * what this module exists for:
 *
 *  1. The app canonises **what the user types**, never what the log says — the
 *     log is canonical by construction. So the field shows what will be
 *     compared, and nothing hides in a `===`.
 *  2. ADR `0011` keeps its rule intact. Both sides of "same string exactly"
 *     being canonical, the exact comparison stays a fact and not a judgement —
 *     only its textbook case dies, `Nozahéal` no longer being typable.
 *  3. Two Personnages **without** an ID d'entité cannot bear the same canonical
 *     name, that name belonging to a single character on the server. The
 *     duplicate is therefore seen **at typing time**, instead of manufacturing
 *     an ambiguity to arbitrate mid-fight.
 *
 * What it does **not** repair: a real typo. `Nozahael` against `Nozaheal` are
 * two canonical names, and only the rattachement of a Demande d'ajout reunites
 * them.
 */

/** Letters, hyphen, apostrophe: everything else falls at canonisation. */
const HORS_ALPHABET = /[^A-Za-z'-]/gu;

const DIACRITIQUES = /[\u0300-\u036f]/gu;

/** The head of the name, and every letter that follows a separator. */
const APRES_SEPARATEUR = /(^|['-])([a-z])/gu;

/**
 * The single spelling of what was typed. Idempotent: canonising a canonical
 * name returns it unchanged, which is what lets the comparison be exact on both
 * sides.
 */
export function canoniserNom(saisi: string): string {
  const sansAccent = saisi.normalize('NFD').replace(DIACRITIQUES, '');
  const lettres = sansAccent.replace(HORS_ALPHABET, '').toLowerCase();
  return lettres.replace(
    APRES_SEPARATEUR,
    (_tout, separateur, lettre) => separateur + (lettre as string).toUpperCase(),
  );
}

/**
 * Whether the canonical form names anything at all. A string of separators
 * survives canonisation — `-'-` is still `-'-` — and it is not a name: the
 * game has no character without a letter.
 */
export function estNomPossible(saisi: string): boolean {
  return /[A-Za-z]/u.test(canoniserNom(saisi));
}
