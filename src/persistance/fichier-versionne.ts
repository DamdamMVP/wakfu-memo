/**
 * The mechanism the three files share (ADR `0004`): an indented JSON carrying
 * its own `"schema"`, migrated independently of the other two, written
 * atomically and debounced.
 *
 * Everything here is synchronous, and that is not laziness: `before-quit` cannot
 * await, so a promise-based flush loses the last write on quit. Reading happens
 * once, at boot, where there is nothing else to do.
 *
 * The data folder is a parameter: it will be `app.getPath('userData')`, but
 * nothing here imports Electron, so it all tests in a temp folder.
 *
 * The single instance lock is what allows this simplicity: there is never a
 * second writer, so no file lock and no read-merge. The in-memory model is the
 * truth, the disk follows it.
 */

import {
  closeSync,
  copyFileSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

/** The debounce of ADR `0004`: at most one write per 400 ms. */
export const ANTI_REBOND_MS = 400;

export type Brut = Record<string, unknown>;

/**
 * What the read gave, and what has to be announced afterwards — a migration is
 * silent but not mute, and a file set aside or refused must be said, otherwise
 * the user believes their data is lost.
 */
export type Verdict =
  | { readonly etat: 'charge'; readonly migreDepuis: number | null }
  | { readonly etat: 'defauts'; readonly cause: 'absent' }
  | {
      readonly etat: 'defauts';
      readonly cause: 'illisible';
      /** The name the file was set aside under, or `null` if even that failed. */
      readonly miseDeCote: string | null;
    }
  | { readonly etat: 'refuse'; readonly schemaTrouve: number; readonly schemaConnu: number };

/** The shape of one of the three files: its schema, its defaults, its repairs. */
export type Forme<T> = {
  /** Without the extension: `roster` gives `roster.json`. */
  readonly nom: string;
  readonly schema: number;
  readonly defauts: () => T;
  /** Repairs in silence: the JSON is readable, so someone will edit it. */
  readonly lire: (brut: Brut) => T;
  /**
   * `brutPrecedent` is what the disk carried just before — that is how the
   * unknown keys of the Réglages survive a rewrite.
   */
  readonly ecrire: (donnees: T, brutPrecedent: Brut | null) => Brut;
  /** Rung `n` migrates a schema `n` to `n + 1`. */
  readonly migrations?: Readonly<Record<number, (brut: Brut) => Brut>>;
};

export type OptionsFichier = {
  readonly antiRebondMs?: number;
  readonly maintenant?: () => Date;
  readonly surErreur?: (erreur: unknown) => void;
};

/** `2026-08-21-14-32-05` — a timestamp that fits in a file name. */
function horodatage(date: Date): string {
  return date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function analyser(texte: string): Brut | null {
  let valeur: unknown;
  try {
    valeur = JSON.parse(texte);
  } catch {
    return null;
  }
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) return null;
  return valeur as Brut;
}

/**
 * A missing or absurd schema number is not an invariant we repair: it is a file
 * we do not know what to do with, so it goes aside instead of being guessed.
 */
function schemaDe(brut: Brut): number | null {
  const schema = brut['schema'];
  return typeof schema === 'number' && Number.isInteger(schema) && schema >= 1 ? schema : null;
}

export class FichierVersionne<T> {
  readonly chemin: string;
  readonly #dossier: string;
  readonly #forme: Forme<T>;
  readonly #antiRebond: number;
  readonly #maintenant: () => Date;
  readonly #surErreur: (erreur: unknown) => void;

  #verdict: Verdict = { etat: 'defauts', cause: 'absent' };
  #modele: T;
  #brutPrecedent: Brut | null = null;
  #minuterie: NodeJS.Timeout | null = null;
  #sale = false;

  constructor(dossierDonnees: string, forme: Forme<T>, options: OptionsFichier = {}) {
    this.#dossier = dossierDonnees;
    this.#forme = forme;
    this.chemin = join(dossierDonnees, `${forme.nom}.json`);
    this.#antiRebond = options.antiRebondMs ?? ANTI_REBOND_MS;
    this.#maintenant = options.maintenant ?? (() => new Date());
    this.#surErreur = options.surErreur ?? (() => {});
    this.#modele = forme.defauts();
  }

  get verdict(): Verdict {
    return this.#verdict;
  }

  /** True if the file was of a higher version: we never overwrite it. */
  get refuse(): boolean {
    return this.#verdict.etat === 'refuse';
  }

  /** True if the file was set aside at load time. */
  get corrompu(): boolean {
    return this.#verdict.etat === 'defauts' && this.#verdict.cause === 'illisible';
  }

  get modifiable(): boolean {
    return !this.refuse;
  }

  lire(): T {
    return this.#modele;
  }

  /** Replaces the model and schedules the write. Throws if the file is refused. */
  ecrire(donnees: T): void {
    if (this.refuse) {
      const trouve = this.#verdict.etat === 'refuse' ? this.#verdict.schemaTrouve : '?';
      throw new Error(
        `${this.#forme.nom}.json vient d'une version plus récente (${trouve}) que celle connue ` +
          `(${this.#forme.schema}) : refusé, donc jamais écrasé.`,
      );
    }
    this.#modele = donnees;
    this.#sale = true;
    this.#programmer();
  }

  charger(): void {
    let texte: string | null = null;
    try {
      texte = readFileSync(this.chemin, 'utf8');
    } catch (erreur) {
      if ((erreur as NodeJS.ErrnoException).code === 'ENOENT') {
        this.#poser({ etat: 'defauts', cause: 'absent' }, null);
        return;
      }
      // Unreadable for another reason (rights, disk): we can neither read nor
      // rename, but we still start — one file does not block the boot.
      this.#surErreur(erreur);
      this.#poser({ etat: 'defauts', cause: 'illisible', miseDeCote: null }, null);
      return;
    }

    const brut = analyser(texte);
    const schemaTrouve = brut === null ? null : schemaDe(brut);
    if (brut === null || schemaTrouve === null) {
      this.#poser(this.#mettreDeCote(), null);
      return;
    }

    // A version higher than the one we know is refused, never overwritten: a
    // failed update, or a file copied from another machine.
    if (schemaTrouve > this.#forme.schema) {
      this.#poser({ etat: 'refuse', schemaTrouve, schemaConnu: this.#forme.schema }, null);
      return;
    }

    let migre = brut;
    if (schemaTrouve < this.#forme.schema) {
      const echelons = this.#echelons(schemaTrouve);
      if (echelons === null) {
        this.#poser(this.#mettreDeCote(), null);
        return;
      }
      // The backup copy first: the migration is silent, it does not get to be
      // the only trace of what was there before.
      copyFileSync(this.chemin, join(this.#dossier, `${this.#forme.nom}.v${schemaTrouve}.bak`));
      try {
        for (const echelon of echelons) migre = echelon(migre);
      } catch (erreur) {
        this.#surErreur(erreur);
        this.#poser(this.#mettreDeCote(), null);
        return;
      }
    }

    let donnees: T;
    try {
      donnees = this.#forme.lire(migre);
    } catch (erreur) {
      this.#surErreur(erreur);
      this.#poser(this.#mettreDeCote(), null);
      return;
    }

    const migreDepuis = schemaTrouve < this.#forme.schema ? schemaTrouve : null;
    this.#verdict = { etat: 'charge', migreDepuis };
    this.#modele = donnees;
    this.#brutPrecedent = migre;
    if (migreDepuis !== null) {
      // The disk follows memory at once: the backup is already down, and leaving
      // the old format in place would migrate again at every launch.
      this.#sale = true;
      this.vider();
    }
  }

  /** Writes whatever is pending, right now — called on `before-quit`. */
  vider(): void {
    if (this.#minuterie !== null) {
      clearTimeout(this.#minuterie);
      this.#minuterie = null;
    }
    // Nothing to write writes nothing: quitting does not touch the file.
    if (this.refuse || !this.#sale) return;
    this.#sale = false;

    const contenu: Brut = { schema: this.#forme.schema };
    for (const [cle, valeur] of Object.entries(
      this.#forme.ecrire(this.#modele, this.#brutPrecedent),
    )) {
      // `schema` leads, and the tolerant key bag does not get to cover it.
      if (cle !== 'schema') contenu[cle] = valeur;
    }

    try {
      this.#ecrireAtomiquement(`${JSON.stringify(contenu, null, 2)}\n`);
      this.#brutPrecedent = contenu;
    } catch (erreur) {
      this.#surErreur(erreur);
    }
  }

  #poser(verdict: Verdict, brut: Brut | null): void {
    this.#verdict = verdict;
    this.#modele = this.#forme.defauts();
    this.#brutPrecedent = brut;
  }

  /** The rungs from `depuis` up to the known schema, or `null` if one is missing. */
  #echelons(depuis: number): Array<(brut: Brut) => Brut> | null {
    const migrations = this.#forme.migrations ?? {};
    const echelons: Array<(brut: Brut) => Brut> = [];
    for (let version = depuis; version < this.#forme.schema; version += 1) {
      const echelon = migrations[version];
      if (echelon === undefined) return null;
      echelons.push(echelon);
    }
    return echelons;
  }

  /** Sets the file aside without destroying anything, and restarts on defaults. */
  #mettreDeCote(): Verdict {
    const nom = `${this.#forme.nom}.corrompu-${horodatage(this.#maintenant())}.json`;
    try {
      renameSync(this.chemin, join(this.#dossier, nom));
      return { etat: 'defauts', cause: 'illisible', miseDeCote: nom };
    } catch (erreur) {
      this.#surErreur(erreur);
      return { etat: 'defauts', cause: 'illisible', miseDeCote: null };
    }
  }

  /**
   * A sibling temp file, then a `rename`. A power cut leaves the old file whole,
   * never a half-written one. The temp name is fixed, so a crash mid-write
   * leaves one file to reuse instead of littering a folder we invite the user to
   * open.
   */
  #ecrireAtomiquement(texte: string): void {
    const temporaire = `${this.chemin}.tmp`;
    const poignee = openSync(temporaire, 'w');
    try {
      writeFileSync(poignee, texte, 'utf8');
      fsyncSync(poignee);
    } finally {
      closeSync(poignee);
    }
    renameSync(temporaire, this.chemin);
  }

  /**
   * A ceiling, not a postponement: the first change sets the deadline and the
   * following ones join it. A continuous typing burst is therefore written every
   * 400 ms, which is the point of ADR `0004` — a crash must not cost twenty
   * minutes of typing. Resetting the timer on every keystroke would give the
   * opposite: a file written only once the hands stop.
   */
  #programmer(): void {
    if (this.refuse || this.#minuterie !== null) return;
    this.#minuterie = setTimeout(() => {
      this.#minuterie = null;
      this.vider();
    }, this.#antiRebond);
    this.#minuterie.unref();
  }
}
