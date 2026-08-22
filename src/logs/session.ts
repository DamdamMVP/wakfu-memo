/**
 * The replay at startup: from a whole `wakfu.log` to the state of the combat in
 * progress, if there is one.
 *
 * Replaying is not reading history (ADR `0007`): we rebuild a living state — the
 * combat playing on screen while the app starts — and exhume no past. Nothing
 * is learned from finished combats.
 */

import type { Composition } from '../domaine/composition.ts';
import { type EtatDuSuivi, suivreLeCombat } from '../suivi/suivi-du-tour.ts';
import type { EvenementDeLog } from './evenements.ts';
import { analyserLigne } from './tokenizer.ts';

export type Session = {
  /**
   * `true` when the window starts on a `log path=`. `false` when the file
   * carries none: that happens on a **rotated** file, which can start
   * mid-session — `wakfu.log.1` carries 43 `[_FL_]` lines and zero `log path=`.
   */
  readonly bornee: boolean;
  readonly evenements: readonly EvenementDeLog[];
};

export type Decoupage = {
  readonly combats: readonly {
    readonly fightId: string;
    readonly evenements: readonly EvenementDeLog[];
  }[];
  /** The combat still open at the end of the stream, if there is one. */
  readonly ouvertALaFin: string | null;
};

export type Relecture = {
  readonly session: Session;
  /**
   * The combats of the session, in file order. They are here to be verifiable:
   * only `combatEnCours` feeds the Overlay, and ADR `0007` forbids learning
   * anything from the others.
   */
  readonly combats: readonly EtatDuSuivi[];
  /** The combat to pick up in motion, or `null` — indistinguishable from "no combat". */
  readonly combatEnCours: EtatDuSuivi | null;
};

/** The events of a `wakfu.log`, in line order: the byte order is what counts. */
export function analyser(contenu: string): EvenementDeLog[] {
  const evenements: EvenementDeLog[] = [];
  for (const ligne of contenu.split('\n')) {
    const evenement = analyserLigne(ligne);
    if (evenement !== null) evenements.push(evenement);
  }
  return evenements;
}

/**
 * The replay window: from the **last `log path=`**, the bound of the current
 * client launch.
 *
 * The bound is not an optimisation, it is what makes the rule correct. "The last
 * `[_FL_]` without an `End fight`" taken alone produces a demonstrated false
 * positive: combat `1552042367` has its burst, 145 lines and 18 minutes of
 * turns, then nothing — the client was closed mid-combat, and the combat would
 * stay declared in progress for the following **4 h 39**.
 */
export function fenetreDeSession(evenements: readonly EvenementDeLog[]): Session {
  for (let index = evenements.length - 1; index >= 0; index -= 1) {
    if (evenements[index]?.type === 'debutDeSession') {
      return { bornee: true, evenements: evenements.slice(index) };
    }
  }
  // With no bound, we replay everything. The combat fantôme stays out through
  // its two other defences: the shutdown marker, and the display condition "une
  // fenêtre de Wakfu existe" of ADR `0014` — a closed client has none.
  return { bornee: false, evenements };
}

/**
 * The combats of the window, each with its events.
 *
 * Frontières de tour and Transitions do **not** carry a `fightId`: they belong
 * to the combat open at that point of the stream, and are lost if there is none.
 * Only the line order counts — the `fightId` is not monotonic, it orders
 * nothing.
 */
export function decouperEnCombats(evenements: readonly EvenementDeLog[]): Decoupage {
  const combats: { fightId: string; evenements: EvenementDeLog[] }[] = [];
  const parFightId = new Map<string, EvenementDeLog[]>();
  let ouvert: string | null = null;

  for (const evenement of evenements) {
    if (evenement.type === 'combattant') {
      let buffer = parFightId.get(evenement.fightId);
      if (buffer === undefined) {
        // An already seen `fightId` **reopens** instead of opening a second
        // combat: the two clients write in blocks, and the second one's block
        // carries its own `[_FL_]` burst of the same combat, sometimes after the
        // first one's `End fight` (`revive2`). That is what makes `k` rise from
        // 1 to 2 before its Frontières land.
        buffer = [];
        parFightId.set(evenement.fightId, buffer);
        combats.push({ fightId: evenement.fightId, evenements: buffer });
      }
      ouvert = evenement.fightId;
      buffer.push(evenement);
      continue;
    }

    if (evenement.type === 'finDeCombat') {
      parFightId.get(evenement.fightId)?.push(evenement);
      if (ouvert === evenement.fightId) ouvert = null;
      continue;
    }

    if (evenement.type === 'debutDeSession') continue;

    if (ouvert !== null) parFightId.get(ouvert)?.push(evenement);
    if (evenement.type === 'marqueurArret') ouvert = null;
  }

  return { combats, ouvertALaFin: ouvert };
}

/**
 * The state of the combats of a session window, and which one is in progress.
 *
 * Separated from `relire` because the events reach us two ways — the whole file
 * read at launch, and the appended bytes of `FluxDuLog` afterwards — and both
 * must produce the state through the same door. The rule is unchanged either
 * way: the tracking sees the **whole** event list of a combat, so a rising `k`
 * replays it (ADR `0009`).
 *
 * The catch-up is allowed to fail, never to approximate: with no rebuildable
 * open combat, the state returned is the out-of-combat one, indistinguishable
 * from "no combat" — ADR `0006` forbids both the guessed position and the
 * confession.
 */
export function suivreLaSession(
  evenements: readonly EvenementDeLog[],
  composition: Composition,
): Pick<Relecture, 'combats' | 'combatEnCours'> {
  const decoupage = decouperEnCombats(evenements);
  const combats = decoupage.combats.map((combat) => suivreLeCombat(combat.evenements, composition));

  // Only one combat can be in progress: the one still open at the end of the
  // stream. An older combat left without an `End fight` — client killed, no
  // shutdown marker — is not the one being played.
  const combatEnCours =
    combats.find((combat) => combat.ouvert && combat.fightId === decoupage.ouvertALaFin) ?? null;

  return { combats, combatEnCours };
}

/**
 * The combat in progress and its state, rebuilt from the content of
 * `wakfu.log`. The launch replay of ADR `0007`.
 */
export function relire(contenu: string, composition: Composition): Relecture {
  const session = fenetreDeSession(analyser(contenu));
  return { session, ...suivreLaSession(session.evenements, composition) };
}
