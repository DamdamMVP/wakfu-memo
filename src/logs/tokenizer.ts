/**
 * One line of `wakfu.log` → one typed event, or nothing.
 *
 * The file is verbose — 17 000 lines for four client launches, carrying
 * `[NATION]`, `[Commerce]`, multi-line Java traces and all the public chat.
 * This module recognises only the seven shapes the combat tracking needs and
 * returns `null` on everything else, which is the vast majority of lines.
 *
 * Three traps, all verified on the repo samples:
 *
 *  1. **The `#` headers.** The samples carry a comment header that contains the
 *     very words being looked for — a naive `grep -c 'End fight'` counts 3 in
 *     `revive2` where there are 2. `#` lines are dropped up front.
 *  2. **The prefix must be intact.** At the seam of two write blocks a line is
 *     destroyed: `revive2` carries `N 15:54:51,726 [...]`, whose ` WARN` head
 *     was overwritten. The damage is harmless there, but nothing guarantees the
 *     lost line is not a Frontière — and nothing guarantees two fragments do
 *     not glue into a line that parses crooked. Guard: accept a complete prefix
 *     only.
 *  3. **ID d'entité are not always digits.** The real log carries `[4768528]`
 *     and `[-1706442044709728]`, the anonymised samples `[ENTITE874]` or
 *     `[ENTITE]`. A regex accepting digits only fails on the fixtures; the
 *     reverse is too lax. We accept both shapes, and nothing more.
 */

import { classeDuBreed } from '../domaine/classes.ts';
import type { EvenementDeLog } from './evenements.ts';

/**
 * The `wakfu.log` prefix:
 * ` INFO HH:MM:SS,mmm [thread] (obfuscated class:line) - <message>`.
 *
 * The level is right-aligned on five characters, hence the leading space of
 * ` INFO` and ` WARN`. Levels are enumerated rather than guessed: that is what
 * makes the line destroyed at the block seam fail.
 */
const PREFIXE =
  /^(?:ERROR|FATAL|DEBUG|TRACE| INFO| WARN) \d\d:\d\d:\d\d,\d\d\d \[[^\]]*\] \([^)]*\) - (.*)$/;

/**
 * The chat channels kept. The whitelist is structural, not a precaution (ADR
 * `0008`): the chat logger being additive, `wakfu.log` carries every channel,
 * including `[Messages d'erreur] En attente de : PJ2, PJ1`, which names two
 * characters mid-action without being a combat event.
 *
 * ⚠️ These labels are **localised**, and the language is knowable nowhere: the
 * log grammar concludes one must apply the union of the four pattern sets
 * (`fr`, `en`, `es`, `pt`) without detecting the language. Only `fr` is here —
 * the other three are generated from the client i18n bundles
 * (`tools/extract-i18n-patterns.sh`), which are not in the repo.
 */
const CANAUX_RETENUS = new Set(['Information (combat)']);

const COMBATTANT =
  /^\[_FL_\] fightId=(\d+) (.+?) breed : (\d+) \[([-A-Za-z0-9]+)\] isControlledByAI=(true|false) obstacleId : (-?\d+)(?: join the fight at \{Point3 : \(([^)]*)\)\})?$/;

const FIN_DE_COMBAT = /^\[FIGHT\] End fight with id (\d+)$/;

const DEBUT_DE_SESSION = /^log path=(.+)$/;

/**
 * The client shutdown markers (ADR `0007`).
 *
 * ⚠️ The reason matters. `Sending DisconnectionMessage` alone is **not** a
 * shutdown: `Reason : {Dispatch}` is a normal connection step, and `revive2`
 * carries two of them, one per client opening. Taking those for shutdowns would
 * close a combat very much alive.
 */
const MARQUEUR_ARRET =
  /^(?:Sending DisconnectionMessage to Servers\. Reason : \{(UI Closed)\}|(Stopping cGz)\.\.\.)/;

const CANAL = /^\[([^\]]+)\] (.*)$/;

/**
 * The Frontière de tour, agreeing in the singular **and** the plural: the game
 * writes `0 seconde reportée` as well as `54 secondes reportées`, and it writes
 * it even when there is no time left to carry over — it is a reliable tick, not
 * a conditional signal.
 */
const FRONTIERE = /^(\d+) secondes? reportées? pour le tour suivant\.$/;

const TRANSITIONS = [
  { forme: 'ko', motif: /^(.+?) est KO !$/ },
  { forme: 'reanime', motif: /^(.+?)\s*:? est réanimé$/ },
  { forme: 'ressuscite', motif: /^(.+?) est ressuscité !$/ },
  { forme: 'horsCombat', motif: /^(.+?) est hors-combat !$/ },
] as const;

/** One line of `wakfu.log` → one event, or `null` if it says nothing useful. */
export function analyserLigne(ligne: string): EvenementDeLog | null {
  // The repo samples' headers. The client never writes any, but a parser that
  // reads them counts wrong, and that has happened.
  if (ligne.startsWith('#')) return null;

  // The client writes CRLF under Windows, and a `\r` dragged to the end of the
  // line would break every pattern anchored at the end — the Frontière de tour
  // included, which ends on a period. No sample is CRLF: all six were captured
  // under Linux.
  const propre = ligne.endsWith('\r') ? ligne.slice(0, -1) : ligne;

  const prefixe = PREFIXE.exec(propre);
  if (prefixe === null) return null;

  const [, message = ''] = prefixe;
  return analyserMessage(message);
}

/**
 * The message of a line, prefix removed → one event, or `null`.
 *
 * Exposed separately because it is the only thing `wakfu.log` and
 * `wakfu_chat.log` have in common: the chat logger being additive, both files
 * carry the **same** message under two different prefixes. The app reads only
 * `wakfu.log` (ADR `0008`) — but five of the six repo samples were captured in
 * two files, before that ADR, and can only be replayed through here.
 */
export function analyserMessage(message: string): EvenementDeLog | null {
  const combattant = COMBATTANT.exec(message);
  if (combattant !== null) {
    // The defaults are unreachable — none of these groups is optional — but they
    // spare the reader an assertion on every field.
    const [
      ,
      fightId = '',
      nom = '',
      breedEcrit = '',
      idEntite = '',
      ia = '',
      obstacle = '',
      position = '',
    ] = combattant;
    const breed = Number(breedEcrit);
    return {
      type: 'combattant',
      fightId,
      nom,
      breed,
      classe: classeDuBreed(breed),
      idEntite,
      controleParIA: ia === 'true',
      obstacleId: Number(obstacle),
      position,
    };
  }

  const fin = FIN_DE_COMBAT.exec(message);
  if (fin !== null) return { type: 'finDeCombat', fightId: fin[1] ?? '' };

  const session = DEBUT_DE_SESSION.exec(message);
  if (session !== null) return { type: 'debutDeSession', racine: session[1] ?? '' };

  const arret = MARQUEUR_ARRET.exec(message);
  if (arret !== null) return { type: 'marqueurArret', raison: arret[1] ?? arret[2] ?? '' };

  const canal = CANAL.exec(message);
  if (canal === null) return null;

  const [, nomDuCanal = '', texte = ''] = canal;
  if (!CANAUX_RETENUS.has(nomDuCanal)) return null;

  return analyserLigneDeCombat(texte);
}

function analyserLigneDeCombat(texte: string): EvenementDeLog | null {
  const frontiere = FRONTIERE.exec(texte);
  if (frontiere !== null) {
    return { type: 'frontiereDeTour', secondes: Number(frontiere[1]) };
  }

  for (const { forme, motif } of TRANSITIONS) {
    const transition = motif.exec(texte);
    if (transition !== null) return { type: 'transition', forme, nom: transition[1] ?? '' };
  }

  return null;
}
