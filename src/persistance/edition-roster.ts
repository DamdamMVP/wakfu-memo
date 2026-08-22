/**
 * Editing the Roster: one pure reducer, one command at a time.
 *
 * Same shape and same reason as `edition-strats.ts`. The Roster screen lives in
 * a surface — no Node API, no disk — so it sends an **intent** and this module
 * decides: it never invents an id, never picks the name a new Profil is born
 * with, never canonises on its own authority, and never chooses what a purge
 * takes away. Every invariant of `roster.json` has one enforcer, it is here, and
 * it is testable without Electron.
 *
 * Three rules shape almost every branch below:
 *
 *  - **A command naming something gone returns the state identical by
 *    reference**, which is what tells `Persistance.appliquer` there is nothing
 *    to write. A stale click is not an error (ADR `0004`).
 *  - **Once an ID d'entité is attached, the log has the final word** (ADR
 *    `0002`): the name and the Classe are no longer editable, and a rattachement
 *    overwrites both rather than keeping a typed Classe that the log denies.
 *  - **Attaching an ID purges the exact homonym without one** (ADR `0011`), and
 *    silently: what leaves is a dead duplicate, never a living Personnage.
 */

import { type Classe, estClasse } from '../domaine/classes.ts';
import { canoniserNom, estNomPossible } from '../domaine/noms.ts';
import { nouvelId } from './ids.ts';
import type { Personnage, Roster } from './roster.ts';
import { type Etat, ignorer, nePlusIgnorer, supprimerProfil } from './suppressions.ts';

/** The name a Profil is born with, then `« … 2 »`. It is born in edition. */
export const NOM_PROFIL_PAR_DEFAUT = 'Nouveau profil';

export type CommandeRoster =
  | { readonly sorte: 'creer-profil' }
  | { readonly sorte: 'renommer-profil'; readonly profilId: string; readonly nom: string }
  | { readonly sorte: 'supprimer-profil'; readonly profilId: string }
  /** The manual entry: a name and a Classe, no ID d'entité (#17). */
  | {
      readonly sorte: 'saisir-personnage';
      readonly profilId: string;
      readonly nom: string;
      readonly classe: Classe;
    }
  /** Correcting one's own typing — only while no ID has attached. */
  | {
      readonly sorte: 'corriger-personnage';
      readonly personnageId: string;
      readonly nom: string;
      readonly classe: Classe;
    }
  | { readonly sorte: 'supprimer-personnage'; readonly personnageId: string }
  /** A Demande d'ajout answered: this fighter becomes a Personnage of a Profil. */
  | {
      readonly sorte: 'ajouter-personnage';
      readonly profilId: string;
      readonly idEntite: string;
      readonly nom: string;
      readonly classe: Classe;
    }
  /** The same answer, onto a Personnage typed by hand: the ID lands on it. */
  | {
      readonly sorte: 'rattacher';
      readonly personnageId: string;
      readonly idEntite: string;
      readonly nom: string;
      readonly classe: Classe;
    }
  | { readonly sorte: 'ignorer'; readonly idEntite: string; readonly nomVu: string }
  | { readonly sorte: 'ne-plus-ignorer'; readonly idEntite: string }
  | { readonly sorte: 'inconnue' };

export type EditionRoster = {
  readonly etat: Etat;
  /**
   * The Profil the command created, so the screen can put its name straight
   * into edition — a Profil with no name is of no use. `null` otherwise.
   */
  readonly profilId: string | null;
  /**
   * The ID d'entité that has just been answered for. Its Demande d'ajout leaves
   * the pending list, and that list is **not** in this file: it is worth a
   * session and nothing more (ADR `0007`, and the resolution of #22).
   */
  readonly repondu: string | null;
};

const sans = (etat: Etat): EditionRoster => ({ etat, profilId: null, repondu: null });

function avecRoster(etat: Etat, roster: Roster): Etat {
  return roster === etat.roster ? etat : { ...etat, roster };
}

/** Rewrites one Personnage in place, keeping its rank in its band. */
function remplacerPersonnage(
  etat: Etat,
  personnageId: string,
  refaire: (personnage: Personnage) => Personnage,
): Etat {
  const vise = etat.roster.personnages.find((candidat) => candidat.id === personnageId);
  if (vise === undefined) return etat;
  const refait = refaire(vise);
  if (refait === vise) return etat;
  return avecRoster(etat, {
    ...etat.roster,
    personnages: etat.roster.personnages.map((candidat) =>
      candidat.id === personnageId ? refait : candidat,
    ),
  });
}

/**
 * A canonical name belongs to a single character on the server, so two
 * Personnages **without** an ID d'entité cannot share one. The stock is
 * canonical from now on, but a file written before the rule is not: both sides
 * are canonised here, which costs nothing and spares a migration.
 */
export function doublonSansIdEntite(
  roster: Roster,
  nom: string,
  sauf: string | null = null,
): Personnage | undefined {
  const canonique = canoniserNom(nom);
  return roster.personnages.find(
    (candidat) =>
      candidat.id !== sauf &&
      candidat.idEntite === null &&
      canoniserNom(candidat.nom) === canonique,
  );
}

/**
 * ADR `0011`, at the one moment it fires: an ID d'entité attaches, and every
 * other Personnage **without** one bearing exactly the same name goes — its
 * pseudo is taken elsewhere, it will never attach to anything. The comparison is
 * character for character; both names being canonical, that stays a fact.
 *
 * The purged Personnage takes its Préférences de liaison with it, as any
 * deletion does.
 */
function purgerLHomonyme(roster: Roster, nom: string, sauf: string): Roster {
  const morts = new Set(
    roster.personnages
      .filter(
        (candidat) => candidat.id !== sauf && candidat.idEntite === null && candidat.nom === nom,
      )
      .map((candidat) => candidat.id),
  );
  if (morts.size === 0) return roster;
  return {
    ...roster,
    personnages: roster.personnages.filter((candidat) => !morts.has(candidat.id)),
    preferences: roster.preferences.filter((preference) => !morts.has(preference.personnageId)),
  };
}

/** `« Nouveau profil »`, then `« Nouveau profil 2 »`. Not a uniqueness rule. */
export function nomDeProfilLibre(roster: Roster): string {
  const pris = new Set(roster.profils.map((profil) => profil.nom));
  if (!pris.has(NOM_PROFIL_PAR_DEFAUT)) return NOM_PROFIL_PAR_DEFAUT;
  for (let rang = 2; ; rang += 1) {
    const candidat = `${NOM_PROFIL_PAR_DEFAUT} ${rang}`;
    if (!pris.has(candidat)) return candidat;
  }
}

function creerProfil(etat: Etat): EditionRoster {
  const profil = { id: nouvelId(), nom: nomDeProfilLibre(etat.roster), estMoi: false };
  return {
    etat: avecRoster(etat, { ...etat.roster, profils: [...etat.roster.profils, profil] }),
    profilId: profil.id,
    repondu: null,
  };
}

/**
 * The Profil is the mate who farms with you, so its name is free text and is
 * **not** canonised: it names a person, not a character. An empty name keeps the
 * old one — a band with no title cannot be aimed at.
 */
function renommerProfil(etat: Etat, profilId: string, nom: string): Etat {
  const propre = nom.trim();
  const vise = etat.roster.profils.find((candidat) => candidat.id === profilId);
  if (vise === undefined || propre === '' || propre === vise.nom) return etat;
  return avecRoster(etat, {
    ...etat.roster,
    profils: etat.roster.profils.map((candidat) =>
      candidat.id === profilId ? { ...candidat, nom: propre } : candidat,
    ),
  });
}

/**
 * The manual entry. Canonised, refused when it says nothing, and refused when
 * another Personnage without an ID already bears the name: the duplicate is seen
 * here, where the user can see it too, instead of mid-fight.
 */
function saisirPersonnage(etat: Etat, profilId: string, nom: string, classe: Classe): Etat {
  if (!etat.roster.profils.some((candidat) => candidat.id === profilId)) return etat;
  if (!estNomPossible(nom)) return etat;
  const canonique = canoniserNom(nom);
  if (doublonSansIdEntite(etat.roster, canonique) !== undefined) return etat;
  const personnage: Personnage = {
    id: nouvelId(),
    profilId,
    nom: canonique,
    classe,
    idEntite: null,
  };
  return avecRoster(etat, {
    ...etat.roster,
    personnages: [...etat.roster.personnages, personnage],
  });
}

/**
 * Correcting a manual entry. Refused outright once an ID d'entité is attached:
 * the log has the final word on the name and the Classe (ADR `0002`), and the
 * screen does not even offer it.
 */
function corrigerPersonnage(etat: Etat, personnageId: string, nom: string, classe: Classe): Etat {
  if (!estNomPossible(nom)) return etat;
  const canonique = canoniserNom(nom);
  if (doublonSansIdEntite(etat.roster, canonique, personnageId) !== undefined) return etat;
  return remplacerPersonnage(etat, personnageId, (personnage) => {
    if (personnage.idEntite !== null) return personnage;
    if (personnage.nom === canonique && personnage.classe === classe) return personnage;
    return { ...personnage, nom: canonique, classe };
  });
}

/** A Personnage carries away its Préférences de liaison, and nothing else. */
function supprimerPersonnage(etat: Etat, personnageId: string): Etat {
  if (!etat.roster.personnages.some((candidat) => candidat.id === personnageId)) return etat;
  return avecRoster(etat, {
    ...etat.roster,
    personnages: etat.roster.personnages.filter((candidat) => candidat.id !== personnageId),
    preferences: etat.roster.preferences.filter(
      (preference) => preference.personnageId !== personnageId,
    ),
  });
}

/**
 * A fighter seen in the log becomes a Personnage of a Profil. Its name and its
 * Classe come from the log, never from a field: they are already canonical, and
 * the ID is what identifies it from now on (ADR `0002`).
 */
function ajouterPersonnage(
  etat: Etat,
  profilId: string,
  idEntite: string,
  nom: string,
  classe: Classe,
): Etat {
  if (!etat.roster.profils.some((candidat) => candidat.id === profilId)) return etat;
  // An ID d'entité identifies exactly one Personnage: answering twice for the
  // same fighter — two windows, a stale click — must not split it in two.
  if (etat.roster.personnages.some((candidat) => candidat.idEntite === idEntite)) return etat;
  const personnage: Personnage = { id: nouvelId(), profilId, nom, classe, idEntite };
  return avecRoster(
    etat,
    purgerLHomonyme(
      { ...etat.roster, personnages: [...etat.roster.personnages, personnage] },
      nom,
      personnage.id,
    ),
  );
}

/**
 * The rattachement: the same fighter, but the user had typed it by hand. The ID
 * lands on the Personnage that was waiting, and the log overwrites the name and
 * the Classe — this is the one thing that repairs a real typo, and the reason
 * the manual entry keeps a net at all.
 */
function rattacher(
  etat: Etat,
  personnageId: string,
  idEntite: string,
  nom: string,
  classe: Classe,
): Etat {
  if (etat.roster.personnages.some((candidat) => candidat.idEntite === idEntite)) return etat;
  const apres = remplacerPersonnage(etat, personnageId, (personnage) =>
    // Only a Personnage still waiting for its first fight can receive an ID:
    // moving one from a Personnage to another would rewrite an identity.
    personnage.idEntite === null ? { ...personnage, nom, classe, idEntite } : personnage,
  );
  if (apres === etat) return etat;
  return avecRoster(apres, purgerLHomonyme(apres.roster, nom, personnageId));
}

/**
 * The one door in. `Persistance.appliquer` rewrites only what moved, so a
 * command that changes nothing costs no write at all.
 */
export function editerRoster(etat: Etat, commande: CommandeRoster): EditionRoster {
  switch (commande.sorte) {
    case 'creer-profil':
      return creerProfil(etat);
    case 'renommer-profil':
      return sans(renommerProfil(etat, commande.profilId, commande.nom));
    case 'supprimer-profil': {
      const vise = etat.roster.profils.find((candidat) => candidat.id === commande.profilId);
      // « moi » is not deletable, and the screen does not offer it: a command
      // that names it is a stale click, not a use case worth an exception.
      if (vise === undefined || vise.estMoi) return sans(etat);
      return sans(supprimerProfil(etat, commande.profilId).etat);
    }
    case 'saisir-personnage':
      return sans(
        estClasse(commande.classe)
          ? saisirPersonnage(etat, commande.profilId, commande.nom, commande.classe)
          : etat,
      );
    case 'corriger-personnage':
      return sans(
        estClasse(commande.classe)
          ? corrigerPersonnage(etat, commande.personnageId, commande.nom, commande.classe)
          : etat,
      );
    case 'supprimer-personnage':
      return sans(supprimerPersonnage(etat, commande.personnageId));
    case 'ajouter-personnage':
      return {
        etat: estClasse(commande.classe)
          ? ajouterPersonnage(
              etat,
              commande.profilId,
              commande.idEntite,
              commande.nom,
              commande.classe,
            )
          : etat,
        profilId: null,
        repondu: commande.idEntite,
      };
    case 'rattacher':
      return {
        etat: estClasse(commande.classe)
          ? rattacher(etat, commande.personnageId, commande.idEntite, commande.nom, commande.classe)
          : etat,
        profilId: null,
        repondu: commande.idEntite,
      };
    case 'ignorer':
      // The only explicit refusal there is. Held by the ID d'entité, never by a
      // name, and reversible.
      return {
        etat: ignorer(etat, commande.idEntite, commande.nomVu),
        profilId: null,
        repondu: commande.idEntite,
      };
    case 'ne-plus-ignorer':
      return sans(nePlusIgnorer(etat, commande.idEntite));
    default:
      return sans(etat);
  }
}
