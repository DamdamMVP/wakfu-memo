/**
 * The Demandes d'ajout still waiting for an answer.
 *
 * ⚠️ **Nothing here is persisted, and that is a decision** (#22). `roster.json`
 * has `profils`, `personnages`, `ignores` and `preferences` — no key for a
 * question without an answer — and no key is added. The list is worth a
 * **session**: an unknown fighter is proposed again at the next fight where they
 * play. It is self-cleaning, exactly the spirit of ADR `0007`, where one more
 * key would accumulate forever the questions about passers-by met once.
 *
 * The consequence to know, and the one thing it rectifies: the "catch it two
 * minutes later" of #16 only holds **if the app has not been closed**.
 *
 * A question survives its fight (#18), so a new fight **adds to** the list and
 * never replaces it. Two surfaces read it — the Roster and, from Lot 8, the
 * Overlay de la Demande d'ajout — and answering on either empties the same
 * entry: it is the same Roster.
 */

import type { Classe } from '../domaine/classes.ts';

/** A fighter played in a fight that the Roster does not know. */
export type DemandeDAjout = {
  /** The identity (ADR `0002`), and the key of this list. */
  readonly idEntite: string;
  /** The name as the log spells it — canonical by construction. */
  readonly nom: string;
  readonly classe: Classe;
};

export class DemandesEnAttente {
  #liste: DemandeDAjout[] = [];

  get liste(): readonly DemandeDAjout[] {
    return this.#liste;
  }

  get enAttente(): boolean {
    return this.#liste.length > 0;
  }

  /**
   * Adds what a fight has just found. An ID d'entité already in the list keeps
   * its place and its first spelling: the question is the same one, asked again.
   * Returns whether anything moved, so the caller only repaints when it did.
   */
  poser(demandes: readonly DemandeDAjout[]): boolean {
    const connus = new Set(this.#liste.map((demande) => demande.idEntite));
    const neufs: DemandeDAjout[] = [];
    for (const demande of demandes) {
      if (connus.has(demande.idEntite)) continue;
      connus.add(demande.idEntite);
      neufs.push(demande);
    }
    if (neufs.length === 0) return false;
    this.#liste = [...this.#liste, ...neufs];
    return true;
  }

  /**
   * An answer was given for this fighter — added, rattaché, or ignored. Not
   * answering is not a refusal, so this is the only thing that removes one.
   */
  repondre(idEntite: string | null): boolean {
    if (idEntite === null) return false;
    const reste = this.#liste.filter((demande) => demande.idEntite !== idEntite);
    if (reste.length === this.#liste.length) return false;
    this.#liste = reste;
    return true;
  }

  vider(): boolean {
    if (this.#liste.length === 0) return false;
    this.#liste = [];
    return true;
  }
}
