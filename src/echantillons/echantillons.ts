/**
 * Access to the captures of `docs/research/samples/`. Test material only.
 *
 * One single sample is a real `wakfu.log`: `revive2`. The five others were
 * captured **in two files** — `*-fights.log` for the combat bounds,
 * `*-chat.log` for the turn detail — before ADR `0008` made `wakfu.log` the
 * only file read. They are therefore unusable end to end, but perfect for
 * testing the rules separately: `k` is read on the bounds, the Frontière
 * counting on the chat.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EvenementDeLog } from '../logs/evenements.ts';
import { analyserLigne, analyserMessage } from '../logs/tokenizer.ts';

const SAMPLES = join(import.meta.dirname, '..', '..', 'docs', 'research', 'samples');

/** The five two-file captures, in the order the map counted them. */
export const CAPTURES_EN_DEUX_FICHIERS = [
  'duo-2026-08-20',
  'duel-2026-08-20',
  'pack4-2026-08-20',
  'revive-2026-08-20',
  'invoc-2026-08-20',
] as const;

export const WAKFU_LOG = 'revive2-2026-08-21-wakfu.log';

export function lire(nom: string): string {
  return readFileSync(join(SAMPLES, nom), 'utf8');
}

/** The events of a `wakfu.log`, through the reader's normal path. */
export function evenementsDuLog(nom: string): EvenementDeLog[] {
  return lire(nom)
    .split('\n')
    .map(analyserLigne)
    .filter((evenement): evenement is EvenementDeLog => evenement !== null);
}

/** The combat bounds of a two-file capture: real `wakfu.log` lines. */
export function evenementsDesBornes(capture: string): EvenementDeLog[] {
  return evenementsDuLog(`${capture}-fights.log`);
}

/**
 * The events of the chat file of a two-file capture.
 *
 * Its prefix is `HH:MM:SS,mmm - `, where `wakfu.log` carries
 * ` INFO HH:MM:SS,mmm [thread] (class:line) - `. The **message** is the same in
 * both files — the chat logger is additive — so we hand it to
 * `analyserMessage`, without ever making the reader believe it opens a second
 * file (ADR `0008`).
 */
export function evenementsDuChat(capture: string): EvenementDeLog[] {
  const evenements: EvenementDeLog[] = [];
  for (const ligne of lire(`${capture}-chat.log`).split('\n')) {
    if (ligne.startsWith('#')) continue;
    const message = /^\d\d:\d\d:\d\d,\d\d\d - (.*)$/.exec(ligne)?.[1];
    if (message === undefined) continue;
    const evenement = analyserMessage(message);
    if (evenement !== null) evenements.push(evenement);
  }
  return evenements;
}
