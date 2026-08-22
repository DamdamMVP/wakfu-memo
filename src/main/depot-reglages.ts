/**
 * `reglages.json` — the bare minimum for this lot to keep its promise.
 *
 * TEMPORARY. Lot 3 carries full persistence: three separately versioned files,
 * forced migration with a backup, cascading deletes. This store only exists
 * because Affichage demandé is persisted. It already honours the ADR `0004`
 * rules that protect the file — atomic write, 400 ms debounce, tolerant key
 * bag, refusal of a higher version, illegible file set aside — and leaves
 * everything else to Lot 3, which will replace it.
 */

import { randomBytes } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const SCHEMA_REGLAGES = 1;
export const ANTI_REBOND_MS = 400;
export const NOM_FICHIER = 'reglages.json';

export type Reglages = { schema: number } & Record<string, unknown>;

/**
 * The defaults this lot needs. The bag is tolerant: anything not listed here
 * that sits in the file survives the rewrite, so later lots add their keys
 * without a migration.
 *
 * The combinations come from the Réglages mockup, which gives them as examples:
 * the default is not settled, only the existence of the three shortcuts is.
 */
export const DEFAUTS: Reglages = {
  schema: SCHEMA_REGLAGES,
  affichageDemande: false,
  stratChoisie: null,
  dossierLogsManuel: null,
  raccourciOverlay: 'Ctrl+Alt+W',
  raccourciVerrou: 'Ctrl+Alt+L',
  raccourciFenetre: null,
};

export type Relecture = {
  reglages: Reglages;
  /** Higher version than we know: we read the defaults and stop writing. */
  refuse: boolean;
  /** Illegible: the file is set aside, the app restarts from the defaults. */
  corrompu: boolean;
};

/** The part that tests without a disk: raw text to settings. */
export function relire(brut: string | null): Relecture {
  if (brut === null) return { reglages: { ...DEFAUTS }, refuse: false, corrompu: false };

  let lu: unknown;
  try {
    lu = JSON.parse(brut);
  } catch {
    return { reglages: { ...DEFAUTS }, refuse: false, corrompu: true };
  }
  if (typeof lu !== 'object' || lu === null || Array.isArray(lu)) {
    return { reglages: { ...DEFAUTS }, refuse: false, corrompu: true };
  }

  const sac = lu as Record<string, unknown>;
  const schema = typeof sac['schema'] === 'number' ? sac['schema'] : SCHEMA_REGLAGES;
  if (schema > SCHEMA_REGLAGES) {
    return { reglages: { ...DEFAUTS }, refuse: true, corrompu: false };
  }

  // Tolerant bag: unknown keys survive, missing keys take the code default.
  return {
    reglages: { ...DEFAUTS, ...sac, schema: SCHEMA_REGLAGES },
    refuse: false,
    corrompu: false,
  };
}

export function nomDeMiseDeCote(quand: Date): string {
  const jour = quand.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `reglages.corrompu-${jour}.json`;
}

/**
 * One read at startup, debounced writes, a flush on `before-quit`. A single
 * writer — the single instance lock is what allows it (ADR `0004`).
 */
export class DepotReglages {
  readonly chemin: string;
  readonly #dossier: string;
  #valeurs: Reglages = { ...DEFAUTS };
  #refuse = false;
  #corrompu = false;
  #minuterie: NodeJS.Timeout | null = null;
  #sale = false;

  constructor(dossierDonnees: string) {
    this.#dossier = dossierDonnees;
    this.chemin = join(dossierDonnees, NOM_FICHIER);
  }

  /** True if the file was of a higher version: we never overwrite it. */
  get refuse(): boolean {
    return this.#refuse;
  }

  /** True if the file was set aside at load time. */
  get corrompu(): boolean {
    return this.#corrompu;
  }

  charger(): void {
    let brut: string | null = null;
    try {
      brut = readFileSync(this.chemin, 'utf8');
    } catch (erreur) {
      if ((erreur as NodeJS.ErrnoException).code !== 'ENOENT') throw erreur;
    }

    const relecture = relire(brut);
    this.#valeurs = relecture.reglages;
    this.#refuse = relecture.refuse;
    this.#corrompu = relecture.corrompu;

    if (relecture.corrompu) {
      // Set aside, never overwritten: readable JSON is a support tool.
      renameSync(this.chemin, join(this.#dossier, nomDeMiseDeCote(new Date())));
    }
  }

  lire<T>(cle: string, defaut: T): T {
    const valeur = this.#valeurs[cle];
    return (valeur ?? defaut) as T;
  }

  get tout(): Reglages {
    return { ...this.#valeurs };
  }

  ecrire(cle: string, valeur: unknown): void {
    if (this.#valeurs[cle] === valeur) return;
    this.#valeurs = { ...this.#valeurs, [cle]: valeur };
    this.#sale = true;
    this.#programmer();
  }

  #programmer(): void {
    if (this.#refuse) return;
    if (this.#minuterie) clearTimeout(this.#minuterie);
    this.#minuterie = setTimeout(() => this.vider(), ANTI_REBOND_MS);
  }

  /** Writes whatever is pending, right now — called on `before-quit`. */
  vider(): void {
    if (this.#minuterie) {
      clearTimeout(this.#minuterie);
      this.#minuterie = null;
    }
    // Nothing to write writes nothing: quitting does not touch the file.
    if (this.#refuse || !this.#sale) return;
    this.#sale = false;

    // Atomic: a sibling temp file, then a `rename`. A power cut leaves the old
    // file whole, never a half-written one.
    const temporaire = `${this.chemin}.${randomBytes(4).toString('hex')}.tmp`;
    writeFileSync(temporaire, `${JSON.stringify(this.#valeurs, null, 1)}\n`, 'utf8');
    renameSync(temporaire, this.chemin);
  }
}
