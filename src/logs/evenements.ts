/**
 * What a line of `wakfu.log` can tell the reader. Everything else in the file —
 * and that is the bulk of it — says nothing and produces no event.
 *
 * Two families, and the distinction is the one of `CONTEXT.md`:
 *  - the **Frontière de tour** is a Tick: we count it, so we deduplicate it
 *    (ADR `0009`);
 *  - everything else is a **Transition**: it sets a state, it is idempotent,
 *    and it has no need to be deduplicated.
 */

import type { Classe } from '../domaine/classes.ts';

/** A fighter as `[_FL_]` declares it: the only complete roster of the combat. */
export type Combattant = {
  readonly type: 'combattant';
  readonly fightId: string;
  readonly nom: string;
  readonly breed: number;
  /** `null` for a monster or an Invocation, whose `breed` is not a Classe. */
  readonly classe: Classe | null;
  readonly idEntite: string;
  readonly controleParIA: boolean;
  /** `-1` for a unit of the combat start, positive for an Invocation. */
  readonly obstacleId: number;
  /** The starting position, as written: `122, 8, 0`. */
  readonly position: string;
};

export type EvenementDeLog =
  | Combattant
  | { readonly type: 'finDeCombat'; readonly fightId: string }
  /** The `N seconde(s) reportée(s)` line. `secondes` is kept, nobody uses it. */
  | { readonly type: 'frontiereDeTour'; readonly secondes: number }
  | {
      readonly type: 'transition';
      readonly forme: 'ko' | 'reanime' | 'ressuscite' | 'horsCombat';
      readonly nom: string;
    }
  /** `log path=<racine>`: the client launch bound, where the replay starts. */
  | { readonly type: 'debutDeSession'; readonly racine: string }
  /** A client shutdown. Closes the combat it was leaving open (ADR `0007`). */
  | { readonly type: 'marqueurArret'; readonly raison: string };
