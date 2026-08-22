/**
 * Editing a Strat: one pure reducer, one command at a time.
 *
 * The Strats screen of the Fenêtre principale is the only writer, and it lives
 * in a surface — no Node API, no disk. It therefore sends an **intent**, and
 * this module decides: the surface never picks a free Couleur, never computes a
 * Rang, never remaps a Consigne onto a new id. Every invariant of `strats.json`
 * has exactly one enforcer, it is here, and it is testable without Electron.
 *
 * Two consequences worth stating, because they shape every branch below:
 *
 *  - **A command that names something gone returns the state unchanged, and
 *    identical by reference.** That is what tells `Persistance.appliquer` there
 *    is nothing to write. A stale click is not an error (ADR `0004`).
 *  - **The Rang and the Tour number are positions, never stored** (`strats.ts`).
 *    So reordering the Composition *is* renumbering the Rangs, and the Consignes
 *    follow without being touched: they are indexed by Emplacement id.
 */

import { type Classe, estClasse } from '../domaine/classes.ts';
import { COULEURS, type Couleur } from '../domaine/composition.ts';
import { normaliserSegments, type Segment } from '../domaine/texte-riche.ts';
import { nouvelId } from './ids.ts';
import {
  couleursLibres,
  type Emplacement,
  MAX_EMPLACEMENTS,
  type Strat,
  type Tour,
} from './strats.ts';
import { type Etat, supprimerEmplacement, supprimerStrat } from './suppressions.ts';

/** The name a Strat is born with. Free and not unique (#11), so it repeats. */
export const NOM_PAR_DEFAUT = 'Nouvelle strat';

/** What an empty name falls back to: `strats.json` trims, it does not invent. */
export const NOM_DE_SECOURS = 'Sans nom';

export type CommandeEdition =
  | { readonly sorte: 'creer' }
  | { readonly sorte: 'renommer'; readonly stratId: string; readonly nom: string }
  | { readonly sorte: 'dupliquer'; readonly stratId: string }
  | { readonly sorte: 'supprimer-strat'; readonly stratId: string }
  | { readonly sorte: 'ajouter-emplacement'; readonly stratId: string; readonly classe: Classe }
  | {
      readonly sorte: 'poser-classe';
      readonly stratId: string;
      readonly emplacementId: string;
      readonly classe: Classe;
    }
  | {
      readonly sorte: 'poser-couleur';
      readonly stratId: string;
      readonly emplacementId: string;
      readonly couleur: Couleur;
    }
  | {
      readonly sorte: 'deplacer-emplacement';
      readonly stratId: string;
      readonly emplacementId: string;
      /** The destination index, 0-based: the Rang the Emplacement is dropped on. */
      readonly vers: number;
    }
  | {
      readonly sorte: 'supprimer-emplacement';
      readonly stratId: string;
      readonly emplacementId: string;
    }
  | { readonly sorte: 'ajouter-tour'; readonly stratId: string }
  | { readonly sorte: 'supprimer-tour'; readonly stratId: string; readonly tour: number }
  | {
      readonly sorte: 'deplacer-tour';
      readonly stratId: string;
      readonly tour: number;
      /** Le numéro d'arrivée, compté depuis 0. */
      readonly vers: number;
    }
  | {
      readonly sorte: 'poser-consigne';
      readonly stratId: string;
      readonly tour: number;
      readonly emplacementId: string;
      readonly segments: readonly unknown[];
    }
  | {
      readonly sorte: 'poser-global';
      readonly stratId: string;
      readonly tour: number;
      readonly segments: readonly unknown[];
    }
  | {
      readonly sorte: 'poser-note';
      readonly stratId: string;
      readonly tour: number;
      readonly note: string;
    }
  | { readonly sorte: 'inconnue' };

export type Edition = {
  readonly etat: Etat;
  /**
   * The Strat the command produced — a creation, a duplication — so the screen
   * can put its name straight into edition. `null` for everything else.
   */
  readonly stratId: string | null;
};

/**
 * `« X (copie) »`, then `« X (copie 2) »`. #11 froze that names are NOT unique:
 * keeping the same one twice stays legal, it is only a pointless default to
 * offer. So this counter is not a uniqueness constraint in disguise.
 */
export function nomDeCopie(strats: readonly Strat[], nom: string): string {
  const pris = new Set(strats.map((strat) => strat.nom));
  const premier = `${nom} (copie)`;
  if (!pris.has(premier)) return premier;
  for (let rang = 2; ; rang += 1) {
    const candidat = `${nom} (copie ${rang})`;
    if (!pris.has(candidat)) return candidat;
  }
}

function avecStrats(etat: Etat, strats: readonly Strat[]): Etat {
  return { ...etat, strats: { strats } };
}

/** Rewrites one Strat in place in the list, keeping its rank in it. */
function remplacer(etat: Etat, stratId: string, refaire: (strat: Strat) => Strat): Etat {
  const strat = etat.strats.strats.find((candidat) => candidat.id === stratId);
  if (strat === undefined) return etat;
  const refait = refaire(strat);
  if (refait === strat) return etat;
  return avecStrats(
    etat,
    etat.strats.strats.map((candidat) => (candidat.id === stratId ? refait : candidat)),
  );
}

/** Rewrites one Tour of one Strat. An out-of-range number changes nothing. */
function remplacerTour(
  etat: Etat,
  stratId: string,
  numero: number,
  refaire: (tour: Tour) => Tour,
): Etat {
  return remplacer(etat, stratId, (strat) => {
    const tour = strat.tours[numero];
    if (tour === undefined) return strat;
    const refait = refaire(tour);
    if (refait === tour) return strat;
    return {
      ...strat,
      tours: strat.tours.map((candidat, index) => (index === numero ? refait : candidat)),
    };
  });
}

/**
 * A Consigne, a global description or a note that says nothing is said by an
 * **absent key**, never by an empty value — one single way to say "nothing to
 * do", on disk as in memory (`strats.ts`).
 */
function tourSansVide(tour: Tour, consignes: Record<string, readonly Segment[]>): Tour {
  return {
    ...(tour.global !== undefined && tour.global.length > 0 ? { global: tour.global } : {}),
    ...(tour.note !== undefined && tour.note !== '' ? { note: tour.note } : {}),
    consignes,
  };
}

/**
 * Creating the first Strat **chooses it**. Without that the player has just
 * typed everything and the Overlay still draws nothing, ADR `0006` forbidding it
 * to say why (ADR `0012`). A dangling id counts as no choice, for the same
 * reason the display condition refuses it.
 */
function choisirSiRien(etat: Etat, stratId: string): Etat {
  const choisie = etat.reglages.stratChoisie;
  const existe = etat.strats.strats.some((candidat) => candidat.id === choisie);
  if (choisie !== null && existe) return etat;
  return { ...etat, reglages: { ...etat.reglages, stratChoisie: stratId } };
}

function creer(etat: Etat): Edition {
  const strat: Strat = { id: nouvelId(), nom: NOM_PAR_DEFAUT, emplacements: [], tours: [] };
  return {
    etat: choisirSiRien(avecStrats(etat, [...etat.strats.strats, strat]), strat.id),
    stratId: strat.id,
  };
}

/**
 * The copy lands right after its original, and every Emplacement gets a fresh
 * id — so the Consignes are remapped onto them, or they would point at the
 * original's places and read as orphan keys the next time the file is read.
 */
function dupliquer(etat: Etat, stratId: string): Edition {
  const rang = etat.strats.strats.findIndex((candidat) => candidat.id === stratId);
  const modele = etat.strats.strats[rang];
  if (modele === undefined) return { etat, stratId: null };

  const nouveaux = new Map<string, string>();
  const emplacements = modele.emplacements.map((emplacement) => {
    const id = nouvelId();
    nouveaux.set(emplacement.id, id);
    return { ...emplacement, id };
  });
  const copie: Strat = {
    id: nouvelId(),
    nom: nomDeCopie(etat.strats.strats, modele.nom),
    emplacements,
    tours: modele.tours.map((tour) => {
      const consignes: Record<string, readonly Segment[]> = {};
      for (const [ancien, segments] of Object.entries(tour.consignes)) {
        const neuf = nouveaux.get(ancien);
        if (neuf !== undefined) consignes[neuf] = segments;
      }
      return tourSansVide(tour, consignes);
    }),
  };

  const strats = [...etat.strats.strats];
  strats.splice(rang + 1, 0, copie);
  return { etat: avecStrats(etat, strats), stratId: copie.id };
}

function ajouterEmplacement(etat: Etat, stratId: string, classe: Classe): Etat {
  return remplacer(etat, stratId, (strat) => {
    // Six at most, so six Couleurs are enough (ADR `0003`). The screen shows the
    // maximum by closing the column — the `＋` disappears — and this is what
    // makes it true rather than shown.
    if (strat.emplacements.length >= MAX_EMPLACEMENTS) return strat;
    const libre = couleursLibres(strat.emplacements)[0];
    if (libre === undefined) return strat;
    const emplacement: Emplacement = { id: nouvelId(), classe, couleur: libre };
    return { ...strat, emplacements: [...strat.emplacements, emplacement] };
  });
}

/**
 * Changing the Classe keeps the Emplacement's id, so it keeps its Consignes:
 * this is a correction, not a replacement. Choosing the Classe it already wears
 * changes nothing at all.
 */
function poserClasse(etat: Etat, stratId: string, emplacementId: string, classe: Classe): Etat {
  return remplacer(etat, stratId, (strat) => {
    const vise = strat.emplacements.find((candidat) => candidat.id === emplacementId);
    if (vise === undefined || vise.classe === classe) return strat;
    return {
      ...strat,
      emplacements: strat.emplacements.map((candidat) =>
        candidat.id === emplacementId ? { ...candidat, classe } : candidat,
      ),
    };
  });
}

/**
 * A Couleur is unique in a Strat, so taking one that is already worn **swaps**
 * it with the Emplacement that wore it, rather than accepting a duplicate: it is
 * the Couleur that tells two Emplacements of the same Classe apart (ADR `0003`).
 */
function poserCouleur(etat: Etat, stratId: string, emplacementId: string, couleur: Couleur): Etat {
  return remplacer(etat, stratId, (strat) => {
    const vise = strat.emplacements.find((candidat) => candidat.id === emplacementId);
    if (vise === undefined || vise.couleur === couleur) return strat;
    return {
      ...strat,
      emplacements: strat.emplacements.map((candidat) => {
        if (candidat.id === emplacementId) return { ...candidat, couleur };
        return candidat.couleur === couleur ? { ...candidat, couleur: vise.couleur } : candidat;
      }),
    };
  });
}

/**
 * Dragging an Emplacement inserts it at its destination — it does not swap two
 * places. That is what "reordering the Composition changes the Rangs" means:
 * everything between the two positions shifts by one.
 */
function deplacerEmplacement(
  etat: Etat,
  stratId: string,
  emplacementId: string,
  vers: number,
): Etat {
  return remplacer(etat, stratId, (strat) => {
    const de = strat.emplacements.findIndex((candidat) => candidat.id === emplacementId);
    const cible = Math.min(Math.max(Math.trunc(vers), 0), strat.emplacements.length - 1);
    if (de < 0 || de === cible || !Number.isFinite(vers)) return strat;
    const emplacements = [...strat.emplacements];
    const [deplace] = emplacements.splice(de, 1);
    if (deplace === undefined) return strat;
    emplacements.splice(cible, 0, deplace);
    return { ...strat, emplacements };
  });
}

function ajouterTour(etat: Etat, stratId: string): Etat {
  return remplacer(etat, stratId, (strat) => ({
    ...strat,
    tours: [...strat.tours, { consignes: {} }],
  }));
}

/**
 * Déplacer un Tour, c'est le renuméroter — le numéro **est** la place dans la
 * liste, comme le Rang est la place dans la Composition. Les Consignes suivent
 * sans être touchées : elles appartiennent au Tour, et c'est le Tour entier qui
 * bouge.
 *
 * Comme pour un Emplacement, déposer **insère** : ce qui est entre les deux
 * positions se décale d'un cran, jamais d'échange sec. C'est ce qui permet de
 * rattraper un Tour supprimé par erreur — on en ajoute un, qui arrive en
 * dernier, puis on le ramène à sa place.
 */
function deplacerTour(etat: Etat, stratId: string, de: number, vers: number): Etat {
  return remplacer(etat, stratId, (strat) => {
    const cible = Math.min(Math.max(Math.trunc(vers), 0), strat.tours.length - 1);
    if (strat.tours[de] === undefined || de === cible || !Number.isFinite(vers)) return strat;
    const tours = [...strat.tours];
    const [deplace] = tours.splice(de, 1);
    if (deplace === undefined) return strat;
    tours.splice(cible, 0, deplace);
    return { ...strat, tours };
  });
}

function supprimerTour(etat: Etat, stratId: string, numero: number): Etat {
  return remplacer(etat, stratId, (strat) => {
    if (strat.tours[numero] === undefined) return strat;
    return { ...strat, tours: strat.tours.filter((_, index) => index !== numero) };
  });
}

function poserConsigne(
  etat: Etat,
  stratId: string,
  numero: number,
  emplacementId: string,
  brut: readonly unknown[],
): Etat {
  const strat = etat.strats.strats.find((candidat) => candidat.id === stratId);
  // An orphan key in `tours` is a dirty file: a Consigne is only written for an
  // Emplacement that exists.
  if (!(strat?.emplacements.some((candidat) => candidat.id === emplacementId) ?? false)) {
    return etat;
  }
  const segments = normaliserSegments(brut);
  return remplacerTour(etat, stratId, numero, (tour) => {
    const consignes = { ...tour.consignes };
    if (segments.length === 0) delete consignes[emplacementId];
    else consignes[emplacementId] = segments;
    return tourSansVide(tour, consignes);
  });
}

function poserGlobal(etat: Etat, stratId: string, numero: number, brut: readonly unknown[]): Etat {
  const segments = normaliserSegments(brut);
  return remplacerTour(etat, stratId, numero, (tour) =>
    tourSansVide({ ...tour, global: segments }, { ...tour.consignes }),
  );
}

function poserNote(etat: Etat, stratId: string, numero: number, note: string): Etat {
  const propre = note.trim();
  return remplacerTour(etat, stratId, numero, (tour) =>
    tourSansVide({ ...tour, note: propre }, { ...tour.consignes }),
  );
}

/**
 * The one door in. `Persistance.appliquer` rewrites only what moved, so a
 * command that changes nothing costs no write at all.
 */
export function editer(etat: Etat, commande: CommandeEdition): Edition {
  const sans = (apres: Etat): Edition => ({ etat: apres, stratId: null });
  switch (commande.sorte) {
    case 'creer':
      return creer(etat);
    case 'renommer':
      return sans(
        remplacer(etat, commande.stratId, (strat) => {
          const nom = commande.nom.trim() === '' ? NOM_DE_SECOURS : commande.nom.trim();
          return nom === strat.nom ? strat : { ...strat, nom };
        }),
      );
    case 'dupliquer':
      return dupliquer(etat, commande.stratId);
    case 'supprimer-strat':
      return sans(supprimerStrat(etat, commande.stratId).etat);
    case 'ajouter-emplacement':
      return sans(
        estClasse(commande.classe)
          ? ajouterEmplacement(etat, commande.stratId, commande.classe)
          : etat,
      );
    case 'poser-classe':
      return sans(
        estClasse(commande.classe)
          ? poserClasse(etat, commande.stratId, commande.emplacementId, commande.classe)
          : etat,
      );
    case 'poser-couleur':
      return sans(
        COULEURS.includes(commande.couleur)
          ? poserCouleur(etat, commande.stratId, commande.emplacementId, commande.couleur)
          : etat,
      );
    case 'deplacer-emplacement':
      return sans(
        deplacerEmplacement(etat, commande.stratId, commande.emplacementId, commande.vers),
      );
    case 'supprimer-emplacement':
      // The cascade of Lot 3: it takes the Consignes of this Emplacement in
      // every Tour, and the Préférences de liaison aiming at it.
      return sans(supprimerEmplacement(etat, commande.stratId, commande.emplacementId).etat);
    case 'ajouter-tour':
      return sans(ajouterTour(etat, commande.stratId));
    case 'supprimer-tour':
      return sans(supprimerTour(etat, commande.stratId, commande.tour));
    case 'deplacer-tour':
      return sans(deplacerTour(etat, commande.stratId, commande.tour, commande.vers));
    case 'poser-consigne':
      return sans(
        poserConsigne(
          etat,
          commande.stratId,
          commande.tour,
          commande.emplacementId,
          commande.segments,
        ),
      );
    case 'poser-global':
      return sans(poserGlobal(etat, commande.stratId, commande.tour, commande.segments));
    case 'poser-note':
      return sans(poserNote(etat, commande.stratId, commande.tour, commande.note));
    default:
      return sans(etat);
  }
}
