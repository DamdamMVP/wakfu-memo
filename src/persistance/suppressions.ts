/**
 * Deletions: an explicit cascade at the moment of the gesture — that is where
 * the intent is — plus a tolerant read everywhere else, where a dead reference
 * is ignored and never an error (ADR `0004`, ADR `0005`).
 *
 * Everything is pure: compute, show the confirmation with what the computation
 * returned, and apply only if the user confirms. Each function therefore returns
 * both the state after and what the question needs to say.
 *
 * Deleting is not ignoring: a deleted Personnage is proposed again at the next
 * fight, because "stop proposing this one" is the `ignorer` gesture. The
 * confirmation offers both, and they are two distinct calls.
 */

import type { Couleur } from '../domaine/composition.ts';
import type { Reglages } from './reglages.ts';
import type { Personnage, Roster } from './roster.ts';
import type { Strats } from './strats.ts';

export type Etat = {
  readonly reglages: Reglages;
  readonly roster: Roster;
  readonly strats: Strats;
};

/**
 * Where a Personnage is engaged — « le rouge dans *Ombre Épaisse* ». Strat name
 * plus Couleur, the only identity an Emplacement carries since ADR `0003`.
 */
export type Engagement = {
  readonly stratId: string;
  readonly stratNom: string;
  readonly emplacementId: string;
  readonly couleur: Couleur;
};

/**
 * A Personnage's engagements, read through its Préférences de liaison. A
 * Préférence aiming at a vanished Strat or Emplacement does not count: it is
 * dead, not wrong.
 */
export function engagements(etat: Etat, personnageId: string): Engagement[] {
  const trouves: Engagement[] = [];
  for (const preference of etat.roster.preferences) {
    if (preference.personnageId !== personnageId) continue;
    const strat = etat.strats.strats.find((candidat) => candidat.id === preference.stratId);
    const emplacement = strat?.emplacements.find(
      (candidat) => candidat.id === preference.emplacementId,
    );
    if (strat === undefined || emplacement === undefined) continue;
    trouves.push({
      stratId: strat.id,
      stratNom: strat.nom,
      emplacementId: emplacement.id,
      couleur: emplacement.couleur,
    });
  }
  return trouves;
}

function sansCesPersonnages(roster: Roster, personnageIds: ReadonlySet<string>): Roster {
  return {
    ...roster,
    personnages: roster.personnages.filter((personnage) => !personnageIds.has(personnage.id)),
    preferences: roster.preferences.filter(
      (preference) => !personnageIds.has(preference.personnageId),
    ),
  };
}

/** A Personnage carries away its Préférences, and nothing else. */
export function supprimerPersonnage(
  etat: Etat,
  personnageId: string,
): { readonly etat: Etat; readonly engagements: readonly Engagement[] } {
  return {
    etat: { ...etat, roster: sansCesPersonnages(etat.roster, new Set([personnageId])) },
    engagements: engagements(etat, personnageId),
  };
}

/**
 * A Profil is the mate who farms with you: if they leave, their Personnages
 * leave. « moi » cannot be deleted — the screen must not offer it, and calling
 * this is a programming error, not a use case.
 */
export function supprimerProfil(
  etat: Etat,
  profilId: string,
): { readonly etat: Etat; readonly personnages: readonly Personnage[] } {
  const profil = etat.roster.profils.find((candidat) => candidat.id === profilId);
  if (profil?.estMoi === true) {
    throw new Error(`Le Profil « ${profil.nom} » n'est pas supprimable.`);
  }
  const emportes = etat.roster.personnages.filter((personnage) => personnage.profilId === profilId);
  const roster = sansCesPersonnages(etat.roster, new Set(emportes.map((p) => p.id)));
  return {
    etat: {
      ...etat,
      roster: { ...roster, profils: roster.profils.filter((candidat) => candidat.id !== profilId) },
    },
    personnages: emportes,
  };
}

/**
 * An Emplacement carries away its Consignes in every Tour, and the Préférences
 * aiming at it. The count of lost Consignes goes into the confirmation.
 */
export function supprimerEmplacement(
  etat: Etat,
  stratId: string,
  emplacementId: string,
): {
  readonly etat: Etat;
  readonly consignesPerdues: number;
  readonly preferencesPerdues: number;
} {
  let consignesPerdues = 0;
  const strats = etat.strats.strats.map((strat) => {
    if (strat.id !== stratId) return strat;
    return {
      ...strat,
      emplacements: strat.emplacements.filter((candidat) => candidat.id !== emplacementId),
      tours: strat.tours.map((tour) => {
        if (!(emplacementId in tour.consignes)) return tour;
        consignesPerdues += 1;
        const consignes = { ...tour.consignes };
        delete consignes[emplacementId];
        return { ...tour, consignes };
      }),
    };
  });
  const preferences = etat.roster.preferences.filter(
    (preference) => !(preference.stratId === stratId && preference.emplacementId === emplacementId),
  );
  return {
    etat: { ...etat, strats: { strats }, roster: { ...etat.roster, preferences } },
    consignesPerdues,
    preferencesPerdues: etat.roster.preferences.length - preferences.length,
  };
}

/**
 * A Strat carries away its Tours, its Emplacements and the Préférences aiming at
 * it. If it was the Strat chosen, **the choice passes to the first Strat left**,
 * and only dies with it when it was the last.
 *
 * Lot 3 dropped the choice to `null` in every case, and ADR `0012` rectifies it:
 * deleting the chosen Strat must announce *where the choice goes*, or that the
 * Overlay will no longer be drawn. Falling to "none" while another Strat sat
 * right there made every deletion a silent extinction of the Overlay — the one
 * action of the app that puts it out without naming it.
 *
 * Everything the confirmation has to say comes back with the state, and nothing
 * is written until it is confirmed.
 */
export function supprimerStrat(
  etat: Etat,
  stratId: string,
): {
  readonly etat: Etat;
  readonly tours: number;
  readonly emplacements: number;
  readonly estChoisie: boolean;
  /** Where the choice goes. `null` when it was not the chosen one, or the last. */
  readonly choixPasseA: { readonly id: string; readonly nom: string } | null;
} {
  const strat = etat.strats.strats.find((candidat) => candidat.id === stratId);
  const restantes = etat.strats.strats.filter((candidat) => candidat.id !== stratId);
  const estChoisie = etat.reglages.stratChoisie === stratId;
  const suivante = estChoisie ? (restantes[0] ?? null) : null;
  return {
    etat: {
      reglages: estChoisie
        ? { ...etat.reglages, stratChoisie: suivante?.id ?? null }
        : etat.reglages,
      roster: {
        ...etat.roster,
        preferences: etat.roster.preferences.filter((preference) => preference.stratId !== stratId),
      },
      strats: { strats: restantes },
    },
    tours: strat?.tours.length ?? 0,
    emplacements: strat?.emplacements.length ?? 0,
    estChoisie,
    choixPasseA: suivante === null ? null : { id: suivante.id, nom: suivante.nom },
  };
}

/**
 * "Stop proposing this one": the fighter is held by its ID d'entité, never
 * proposed again, and it is reversible. Nothing to do with deleting the
 * Personnage, which may or may not accompany it.
 */
export function ignorer(etat: Etat, idEntite: string, nomVu: string): Etat {
  if (etat.roster.ignores.some((ignore) => ignore.idEntite === idEntite)) return etat;
  return {
    ...etat,
    roster: { ...etat.roster, ignores: [...etat.roster.ignores, { idEntite, nomVu }] },
  };
}

/** The way back: the fighter becomes proposable again. */
export function nePlusIgnorer(etat: Etat, idEntite: string): Etat {
  return {
    ...etat,
    roster: {
      ...etat.roster,
      ignores: etat.roster.ignores.filter((ignore) => ignore.idEntite !== idEntite),
    },
  };
}
