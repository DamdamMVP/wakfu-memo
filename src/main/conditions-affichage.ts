/**
 * The four display conditions of the Overlay — and the AND that ties them.
 *
 * `CONTEXT.md`, entry *Affichage demandé*: the overlay is drawn only if four
 * conditions are true together. The order of the list is frozen by ADR `0014`:
 * it is the order of the four lines of the Socle d'état, and it does not change
 * with the circumstances, otherwise the Socle stops being something you learn.
 *
 * This module knows neither Electron nor the disk.
 */

export const CONDITIONS = [
  'affichageDemande',
  'logsTrouves',
  'fenetreWakfu',
  'stratChoisie',
] as const;

export type NomCondition = (typeof CONDITIONS)[number];

export type Conditions = { readonly [N in NomCondition]: boolean };

/** At startup nothing is true: no window found, no log ruled on. */
export const AUCUNE: Conditions = {
  affichageDemande: false,
  logsTrouves: false,
  fenetreWakfu: false,
  stratChoisie: false,
};

export function overlayDessine(conditions: Conditions): boolean {
  return CONDITIONS.every((nom) => conditions[nom]);
}

/** The missing ones, in the frozen order of the Socle d'état. */
export function conditionsManquantes(conditions: Conditions): NomCondition[] {
  return CONDITIONS.filter((nom) => !conditions[nom]);
}

export type Abonne = (conditions: Conditions, dessine: boolean) => void;

/**
 * The live state of the four conditions. Each is set by the source that knows
 * it — the switch, the `wakfu.log` watch, the Wakfu window, the chosen Strat —
 * and nobody else decides whether the Overlay is drawn.
 */
export class EtatConditions {
  #valeurs: Conditions;
  readonly #abonnes = new Set<Abonne>();

  constructor(depart: Conditions = AUCUNE) {
    this.#valeurs = { ...depart };
  }

  get valeurs(): Conditions {
    return this.#valeurs;
  }

  get dessine(): boolean {
    return overlayDessine(this.#valeurs);
  }

  get manquantes(): NomCondition[] {
    return conditionsManquantes(this.#valeurs);
  }

  /** Only notifies on a real change: the Overlay must not flicker. */
  poser(nom: NomCondition, valeur: boolean): void {
    if (this.#valeurs[nom] === valeur) return;
    this.#valeurs = { ...this.#valeurs, [nom]: valeur };
    const instantane = this.#valeurs;
    const dessine = this.dessine;
    for (const abonne of this.#abonnes) abonne(instantane, dessine);
  }

  surChangement(abonne: Abonne): () => void {
    this.#abonnes.add(abonne);
    return () => this.#abonnes.delete(abonne);
  }
}
