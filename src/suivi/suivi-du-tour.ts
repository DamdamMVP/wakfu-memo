/**
 * The events of one combat → the Tour courant and the Rotation.
 *
 * This is the piece that carries the whole risk of the product: there is no
 * safety net. ADR `0006` takes from the Overlay any vocabulary for its own
 * doubt, so nothing ever displays that we got it wrong — a misread `k` gives an
 * overlay twice too fast, mute and false.
 *
 * The function is **pure**: the same event stream always gives the same state.
 * That is what makes the rule "`k` rises → replay the combat from its `[_FL_]`"
 * free — replaying is calling this function again on the complete event list.
 */

import type { Composition } from '../domaine/composition.ts';
import type { Combattant, EvenementDeLog } from '../logs/evenements.ts';

export type EtatDuSuivi = {
  readonly fightId: string;
  /** A combat with no `[FIGHT] End fight` and no shutdown marker after it. */
  readonly ouvert: boolean;
  /** `k`: the number of Wakfu clients engaged in the combat. */
  readonly clientsEngages: number;
  /** The Frontières de tour kept, copies dropped. */
  readonly finsDeTour: number;
  /** The Rotation advances. Equal to the number of turns actually played. */
  readonly avances: number;
  /** The Tour of the Strat in force. Worth 1 when the combat opens. */
  readonly tourCourant: number;
  /** The Rang the Rotation reached, or `null` if no Emplacement is active. */
  readonly rangCourant: number | null;
  /** The Rangs the Rotation stops on, ascending. */
  readonly rangsActifs: readonly number[];
  /** Rang → the Personnage holding it for this combat. */
  readonly liaison: ReadonlyMap<number, Combattant>;
  /** The combat roster, one entry per fighter. */
  readonly roster: readonly Combattant[];
};

export type OptionsDeSuivi = {
  /**
   * `k`, when it is known from elsewhere. Serves the five samples captured in
   * two files, whose `[_FL_]` lines sit in the neighbouring file.
   */
  readonly clientsEngages?: number;
};

/**
 * The declared identity of a fighter. ADR `0002` makes it the ID d'entité,
 * whose nom and `breed` are only derived attributes — they are here because the
 * repo samples are anonymised **down to the IDs**: `duo`, `invoc` and `pack4`
 * carry `[ENTITE]` for *everyone*, and the ID alone would shrink their roster
 * to a single fighter.
 */
function cleDIdentite(c: Combattant): string {
  return `${c.idEntite}|${c.nom}|${c.breed}`;
}

/**
 * What makes two `[_FL_]` lines two **copies** of the same event: everything the
 * line says, `obstacleId` and starting position included.
 *
 * The position is there only for the samples with scrambled IDs, where it is the
 * one discriminant left between two homonymous monsters — `pack4` has two
 * `Moogrron` of the same `breed` and the same `[ENTITE]`, and confusing them
 * would give `k=4` for two clients, an overlay twice too slow. On a real log it
 * is redundant: the ID d'entité already separates homonyms there.
 *
 * A key that fine can **split** two real copies, when one client sees a
 * character on one cell and the other on the next — that happens during the
 * placement phase, where people move (`duo`: PJ2 is seen at `(1, -17, 0)` then
 * at `(1, -14, 0)`). It has no effect because `k` is a **maximum** over the
 * whole roster: one fighter seen identically by every client is enough, and the
 * monsters, which do not move during the placement, guarantee it.
 */
function cleDeCopie(c: Combattant): string {
  return `${cleDIdentite(c)}|${c.controleParIA}|${c.obstacleId}|${c.position}`;
}

/**
 * `k`, the number of engaged clients: the **maximum number of copies of the
 * `[_FL_]` line of one same entity** (ADR `0009`).
 *
 * And above all not the number of distinct `isControlledByAI=false` entities:
 * entities do not arrive together. On `duo`, PJ2 joins at 18:38:34,415 and PJ1
 * only 1.7 s later — concluding `k=1` on the first burst would give the overlay
 * twice too fast. The maximum reaches 2 on the `Sac à patates` second copy, 75 s
 * before the first Frontière.
 */
export function clientsEngages(evenements: readonly EvenementDeLog[]): number {
  const copies = new Map<string, number>();
  for (const evenement of evenements) {
    if (evenement.type !== 'combattant') continue;
    const cle = cleDeCopie(evenement);
    copies.set(cle, (copies.get(cle) ?? 0) + 1);
  }
  return Math.max(1, ...copies.values());
}

/** The combat roster, one entry per fighter, in arrival order. */
function roster(evenements: readonly EvenementDeLog[]): Combattant[] {
  const vus = new Map<string, Combattant>();
  for (const evenement of evenements) {
    if (evenement.type !== 'combattant') continue;
    const cle = cleDIdentite(evenement);
    if (!vus.has(cle)) vus.set(cle, evenement);
  }
  return [...vus.values()];
}

/**
 * The Liaison: which Personnage holds which Emplacement, computed by Classe
 * from `[_FL_]`.
 *
 * A Conflit — several Personnages of one Classe for several Emplacements of
 * that Classe — is settled here by the **lowest Rang**, in combat arrival
 * order. That is what ADR `0007` prescribes for a combat caught up cold; on a
 * combat seen from its start, the Demande d'ajout and the Échange par clic catch
 * it, and they are not of this lot.
 */
function lier(composition: Composition, roster: readonly Combattant[]): Map<number, Combattant> {
  const liaison = new Map<number, Combattant>();
  const pris = new Set<number>();

  for (const combattant of roster) {
    // `isControlledByAI=false` isolates the played Personnages: the client
    // treats its own Invocations as uncontrolled, so the filter is enough.
    if (combattant.controleParIA || combattant.classe === null) continue;

    const rang = composition.findIndex(
      (emplacement, index) => emplacement.classe === combattant.classe && !pris.has(index + 1),
    );
    if (rang === -1) continue;

    pris.add(rang + 1);
    liaison.set(rang + 1, combattant);
  }

  return liaison;
}

export function suivreLeCombat(
  evenements: readonly EvenementDeLog[],
  composition: Composition,
  options: OptionsDeSuivi = {},
): EtatDuSuivi {
  const k = options.clientsEngages ?? clientsEngages(evenements);
  const combattants = roster(evenements);
  const liaison = lier(composition, combattants);

  const fightId = evenements.find((evenement) => evenement.type === 'combattant')?.fightId ?? '';

  /** The Emplacements gone out on `est KO !`, by Rang. */
  const tombes = new Set<number>();
  const rangsActifs = (): number[] =>
    [...liaison.keys()].filter((rang) => !tombes.has(rang)).sort((a, b) => a - b);

  let ouvert = false;
  let finsDeTour = 0;
  let avances = 0;
  let tourCourant = 1;
  let rangCourant: number | null = null;

  /**
   * The copies of the last kept Frontière still to be ignored.
   *
   * The wording matters: the rule is **relative to the last accepted
   * Frontière**, never a cut into absolute packets of `k`. An **orpheline**
   * Frontière does exist in the logs — the first of `duo` has a single copy,
   * hence 31 lines for 16 turns — and a packet cut would drift for the whole
   * rest of the combat. Here it is absorbed: the only effect is that from it on
   * the second copy is the one kept, 40 ms late (ADR `0009`).
   */
  let copiesAIgnorer = 0;

  const avancerLaRotation = (): void => {
    const actifs = rangsActifs();
    const premier = actifs[0];
    if (premier === undefined) {
      // No Emplacement to stop on: somebody played whom the Strat does not know.
      // The Rotation does not move, and neither does the Tour courant.
      return;
    }

    avances += 1;

    const suivant = actifs.find((rang) => rangCourant === null || rang > rangCourant);
    // No greater active Rang: the Rotation comes back to the smallest one, and
    // the Tour changes.
    if (suivant === undefined) tourCourant += 1;
    rangCourant = suivant ?? premier;
  };

  for (const evenement of evenements) {
    switch (evenement.type) {
      case 'combattant':
        // The `[_FL_]` burst opens the combat. It **reopens** it too: the two
        // clients write in blocks, and the second one's block can land after the
        // first one's `End fight`, with its own burst of the same `fightId`
        // (`revive2`).
        ouvert = true;
        if (rangCourant === null) rangCourant = rangsActifs()[0] ?? null;
        break;

      case 'finDeCombat':
        ouvert = false;
        break;

      case 'frontiereDeTour':
        if (copiesAIgnorer > 0) {
          copiesAIgnorer -= 1;
          break;
        }
        finsDeTour += 1;
        copiesAIgnorer = k - 1;
        avancerLaRotation();
        break;

      case 'transition':
        appliquerLaTransition(evenement, liaison, tombes);
        if (rangCourant === null) rangCourant = rangsActifs()[0] ?? null;
        break;

      case 'marqueurArret':
        // A client shutdown closes the combat it was leaving open (ADR `0007`).
        // Without it, a client closed mid-combat leaves a combat fantôme
        // declared in progress for hours — 4 h 39 on the real log.
        ouvert = false;
        break;

      case 'debutDeSession':
        break;
    }
  }

  return {
    fightId,
    ouvert,
    clientsEngages: k,
    finsDeTour,
    avances,
    tourCourant,
    rangCourant,
    rangsActifs: rangsActifs(),
    liaison,
    roster: combattants,
  };
}

/**
 * A Transition sets a state: we apply it on first sight, and its copies reapply
 * it with no effect. No deduplication, which makes the 1253 ms skew measured on
 * `est KO !` moot.
 *
 * `est hors-combat !` touches no Emplacement: that is a **monster** leaving.
 * Personnages leave on `est KO !`, and confusing the two shapes would drop an
 * Emplacement for the death of a homonymous monster.
 */
function appliquerLaTransition(
  evenement: Extract<EvenementDeLog, { type: 'transition' }>,
  liaison: ReadonlyMap<number, Combattant>,
  tombes: Set<number>,
): void {
  if (evenement.forme === 'horsCombat') return;

  for (const [rang, combattant] of liaison) {
    if (combattant.nom !== evenement.nom) continue;
    if (evenement.forme === 'ko') tombes.add(rang);
    else tombes.delete(rang);
  }
}
