/**
 * `wakfu.log` followed while it grows: the appended bytes → the events of the
 * session.
 *
 * The replay of ADR `0007` reads the whole file once, at launch. Following it
 * afterwards could do the same thing again on every pass, and the debug probe
 * `tools/suivre-en-direct.ts` does exactly that — 1,47 Mo re-tokenised twice a
 * second. Here we read only what was appended, and keep the events.
 *
 * That is a change of mechanism, not of rule: the state is still computed by
 * `suivreLeCombat` over the **whole** event list of the combat, so "`k` rises →
 * replay the combat from its `[_FL_]`" stays free (ADR `0009`). What is
 * incremental is the reading, never the counting.
 *
 * Three traps, and each one would silently break the count:
 *
 *  1. **A line cut between two reads.** The client writes when it wants, so a
 *     read stops mid-line. The tail is kept and only complete lines are
 *     tokenised — a half `reportées pour le tour suivant.` parsed twice would
 *     count a turn twice.
 *  2. **A character cut between two reads.** The bytes are cut, and UTF-8 is
 *     multi-byte: `reportées` split at the wrong byte decodes as two replacement
 *     characters, and the Frontière de tour pattern no longer matches. Hence
 *     `StringDecoder`, which holds the incomplete sequence back.
 *  3. **The file shrinking.** A rotation puts a fresh `wakfu.log` in place; then
 *     our offset points past its end. Reading from zero again is the only
 *     correct move, and the events collected go with it.
 */

import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';

import type { EvenementDeLog } from './evenements.ts';
import { analyserLigne } from './tokenizer.ts';

/** One read per pass at most, for a client that writes in blocks. */
const TAILLE_TAMPON = 256 * 1024;

export class FluxDuLog {
  #chemin: string | null = null;
  /** Bytes consumed, including those the decoder is still holding. */
  #position = 0;
  #decodeur = new StringDecoder('utf8');
  /** The incomplete line at the end of the last read. */
  #reste = '';
  #evenements: EvenementDeLog[] = [];

  get chemin(): string | null {
    return this.#chemin;
  }

  /**
   * The events of the session, in file order — which is the only order that
   * counts: `fightId` is not monotonic, and the lines carry no usable date.
   */
  get evenements(): readonly EvenementDeLog[] {
    return this.#evenements;
  }

  /** Changes the followed file. Nothing of the previous one survives. */
  suivre(chemin: string | null): void {
    this.#chemin = chemin;
    this.#repartirDeZero();
  }

  /**
   * One pass: reads what was appended and returns whether anything was read.
   *
   * Public and synchronous so the whole thing tests without a timer — the caller
   * owns the rhythm.
   */
  rattraper(): boolean {
    if (this.#chemin === null) return false;

    let taille: number;
    try {
      taille = statSync(this.#chemin).size;
    } catch {
      // Gone or unreadable. The display condition of ADR `0014` is what turns
      // the Overlay off; here we only make sure a file coming back is read
      // whole.
      this.#repartirDeZero();
      return false;
    }

    if (taille < this.#position) this.#repartirDeZero();
    if (taille === this.#position) return false;

    const texte = this.#lireDepuis(taille);
    if (texte === '') return false;

    const lignes = (this.#reste + texte).split('\n');
    // The last piece has no newline behind it: it is either an incomplete line
    // or the empty string that follows a complete one.
    this.#reste = lignes.pop() ?? '';

    for (const ligne of lignes) {
      const evenement = analyserLigne(ligne);
      if (evenement === null) continue;
      // `log path=` bounds the session (ADR `0007`): everything before it
      // belongs to a previous client launch, and replaying it would exhume a
      // past. Dropping it here is `fenetreDeSession`, applied as we go.
      if (evenement.type === 'debutDeSession') this.#evenements.length = 0;
      this.#evenements.push(evenement);
    }

    return true;
  }

  #lireDepuis(taille: number): string {
    let descripteur: number;
    try {
      descripteur = openSync(this.#chemin as string, 'r');
    } catch {
      return '';
    }

    const tampon = Buffer.allocUnsafe(TAILLE_TAMPON);
    let texte = '';
    try {
      while (this.#position < taille) {
        const aLire = Math.min(TAILLE_TAMPON, taille - this.#position);
        const lus = readSync(descripteur, tampon, 0, aLire, this.#position);
        if (lus <= 0) break;
        this.#position += lus;
        texte += this.#decodeur.write(tampon.subarray(0, lus));
      }
    } catch {
      // Truncated under our feet, or a read error: the next pass sees the file's
      // real size and starts over if it shrank.
    } finally {
      closeSync(descripteur);
    }
    return texte;
  }

  #repartirDeZero(): void {
    this.#position = 0;
    this.#decodeur = new StringDecoder('utf8');
    this.#reste = '';
    this.#evenements = [];
  }
}
