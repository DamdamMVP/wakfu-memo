/**
 * The second condition: the Wakfu logs are found (ADR `0014`).
 *
 * The fact means "a readable `wakfu.log` is found" — the file, not the folder —
 * and a `stat` settles it. It says nothing about freshness: a `wakfu.log`
 * untouched for six hours is a player who has not played for six hours, not a
 * failure. No modification date is read here, deliberately.
 *
 * The condition is live on the retained file: losing the `wakfu.log` we watch
 * turns the Overlay off, mid-game included.
 *
 * This module cannot discover the log folder — arbitrating between the Steam
 * install and the launcher one is Lot 1 (`docs/research/wakfu-log-grammar.md`).
 * It takes a path and watches it; Lot 1 plugs into `suivre()` without touching
 * the rest. Until then only the designated folder of ADR `0014` feeds the
 * condition.
 */

import { accessSync, constants, statSync, unwatchFile, watchFile } from 'node:fs';
import { join } from 'node:path';

export const NOM_WAKFU_LOG = 'wakfu.log';

/** The file ADR `0008` names as the only one read, in a given folder. */
export function wakfuLogDe(dossier: string | null): string | null {
  return dossier ? join(dossier, NOM_WAKFU_LOG) : null;
}

/** A `stat`, and nothing else: the file exists and lets itself be read. */
export function wakfuLogLisible(chemin: string | null): boolean {
  if (chemin === null) return false;
  try {
    if (!statSync(chemin).isFile()) return false;
    accessSync(chemin, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export type SurTrouve = (trouve: boolean, chemin: string | null) => void;

export class VeilleWakfuLog {
  readonly #surTrouve: SurTrouve;
  readonly #intervalle: number;
  #chemin: string | null = null;
  #trouve = false;

  constructor(surTrouve: SurTrouve, intervalle = 2_000) {
    this.#surTrouve = surTrouve;
    this.#intervalle = intervalle;
  }

  get chemin(): string | null {
    return this.#chemin;
  }

  get trouve(): boolean {
    return this.#trouve;
  }

  /** Changes the retained file — a designated folder, or Lot 1's derivation. */
  suivre(chemin: string | null): void {
    if (chemin === this.#chemin) {
      this.#reevaluer();
      return;
    }
    this.arreter();
    this.#chemin = chemin;
    if (chemin !== null) {
      // `watchFile` covers the two moves that matter: the file appears, the
      // file disappears. We ignore what it says about the content.
      watchFile(chemin, { interval: this.#intervalle }, () => this.#reevaluer());
    }
    this.#reevaluer();
  }

  arreter(): void {
    if (this.#chemin !== null) unwatchFile(this.#chemin);
    this.#chemin = null;
  }

  #reevaluer(): void {
    const trouve = wakfuLogLisible(this.#chemin);
    if (trouve === this.#trouve) return;
    this.#trouve = trouve;
    this.#surTrouve(trouve, this.#chemin);
  }
}
