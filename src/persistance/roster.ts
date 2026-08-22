/**
 * `roster.json` — the Profils de joueur, the Personnages, the Personnages
 * ignorés, and the Préférences de liaison. Global: it does not depend on the
 * Strat.
 *
 * The Préférences live here and not in `strats.json` (ADR `0005`): this is
 * information about *who plays what*, and it keeps `strats.json` a pure,
 * shareable artefact. The list is flat because it is read both ways — by Strat
 * at the start of a fight, by Personnage when deleting one.
 *
 * Read repairs are strictly *intra-file*. A reference leaving the file — a
 * Préférence's `stratId` and `emplacementId` — is never purged here, because
 * `strats.json` may well be refused or set aside on the same boot: it is ignored
 * when used, and cleaned by the cascade at the gesture (see `suppressions.ts`).
 */

import { type Classe, estClasse } from '../domaine/classes.ts';
import type { Brut, Forme } from './fichier-versionne.ts';
import { nouvelId } from './ids.ts';

export const SCHEMA_ROSTER = 1;

export type Profil = {
  readonly id: string;
  readonly nom: string;
  /** « moi » exists by default and cannot be deleted. Exactly one carries it. */
  readonly estMoi: boolean;
};

export type Personnage = {
  readonly id: string;
  readonly profilId: string;
  readonly nom: string;
  readonly classe: Classe;
  /** A string: we never compute on it. `null` until a fight captures it. */
  readonly idEntite: string | null;
};

export type PersonnageIgnore = {
  readonly idEntite: string;
  readonly nomVu: string;
};

export type PreferenceDeLiaison = {
  readonly stratId: string;
  readonly personnageId: string;
  readonly emplacementId: string;
};

export type Roster = {
  readonly profils: readonly Profil[];
  readonly personnages: readonly Personnage[];
  readonly ignores: readonly PersonnageIgnore[];
  readonly preferences: readonly PreferenceDeLiaison[];
};

export const NOM_PROFIL_MOI = 'moi';

export function profilMoi(): Profil {
  return { id: nouvelId(), nom: NOM_PROFIL_MOI, estMoi: true };
}

export function rosterParDefaut(): Roster {
  return { profils: [profilMoi()], personnages: [], ignores: [], preferences: [] };
}

function objets(valeur: unknown): Brut[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter(
    (element): element is Brut =>
      typeof element === 'object' && element !== null && !Array.isArray(element),
  );
}

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

/** An ID d'entité stays a string, even when someone retyped it as a number. */
function idEntite(valeur: unknown): string | null {
  if (typeof valeur === 'string') return valeur.trim() === '' ? null : valeur.trim();
  if (typeof valeur === 'number' && Number.isFinite(valeur)) return String(valeur);
  return null;
}

function lireProfils(brut: unknown): Profil[] {
  const profils: Profil[] = [];
  const vus = new Set<string>();
  for (const candidat of objets(brut)) {
    const id = texte(candidat['id']) || nouvelId();
    if (vus.has(id)) continue; // a duplicated id: the first one keeps it
    vus.add(id);
    profils.push({ id, nom: texte(candidat['nom']), estMoi: candidat['estMoi'] === true });
  }
  // Exactly one « moi »: it is the one that cannot be deleted, so it can neither
  // be missing nor be two.
  const premierMoi = profils.findIndex((profil) => profil.estMoi);
  if (premierMoi === -1) {
    return [profilMoi(), ...profils.map((profil) => ({ ...profil, estMoi: false }))];
  }
  return profils.map((profil, index) => ({ ...profil, estMoi: index === premierMoi }));
}

function lirePersonnages(brut: unknown, profils: readonly Profil[]): Personnage[] {
  const idsProfils = new Set(profils.map((profil) => profil.id));
  const personnages: Personnage[] = [];
  const vus = new Set<string>();
  const entitesVues = new Set<string>();
  for (const candidat of objets(brut)) {
    const profilId = texte(candidat['profilId']);
    // A Personnage without a living Profil is unreachable: deleting a Profil
    // carries its Personnages away, so an orphan is a dirty file.
    if (!idsProfils.has(profilId)) continue;
    const classe = candidat['classe'];
    // No known Classe, so nothing to match against: we do not invent one.
    if (!estClasse(classe)) continue;
    const id = texte(candidat['id']) || nouvelId();
    if (vus.has(id)) continue;
    vus.add(id);
    const entite = idEntite(candidat['idEntite']);
    // The ID d'entité is the identity (ADR `0002`): two Personnages cannot share
    // it, and the first one keeps it.
    const unique = entite !== null && !entitesVues.has(entite) ? entite : null;
    if (unique !== null) entitesVues.add(unique);
    personnages.push({ id, profilId, nom: texte(candidat['nom']), classe, idEntite: unique });
  }
  return personnages;
}

function lireIgnores(brut: unknown): PersonnageIgnore[] {
  const ignores: PersonnageIgnore[] = [];
  const vus = new Set<string>();
  for (const candidat of objets(brut)) {
    const entite = idEntite(candidat['idEntite']);
    if (entite === null || vus.has(entite)) continue;
    vus.add(entite);
    ignores.push({ idEntite: entite, nomVu: texte(candidat['nomVu']) });
  }
  return ignores;
}

function lirePreferences(brut: unknown, personnages: readonly Personnage[]): PreferenceDeLiaison[] {
  const idsPersonnages = new Set(personnages.map((personnage) => personnage.id));
  // A `(Strat, Personnage)` key answers once: the last one wins, the way
  // resolving a Conflit overwrites.
  const parCle = new Map<string, PreferenceDeLiaison>();
  for (const candidat of objets(brut)) {
    const stratId = texte(candidat['stratId']);
    const personnageId = texte(candidat['personnageId']);
    const emplacementId = texte(candidat['emplacementId']);
    if (stratId === '' || emplacementId === '') continue;
    if (!idsPersonnages.has(personnageId)) continue;
    parCle.set(`${stratId} ${personnageId}`, { stratId, personnageId, emplacementId });
  }
  return [...parCle.values()];
}

function lire(brut: Brut): Roster {
  const profils = lireProfils(brut['profils']);
  const personnages = lirePersonnages(brut['personnages'], profils);
  return {
    profils,
    personnages,
    ignores: lireIgnores(brut['ignores']),
    preferences: lirePreferences(brut['preferences'], personnages),
  };
}

function ecrire(roster: Roster): Brut {
  return {
    // `estMoi` is written only where it is true: an absent flag is a false flag,
    // and it keeps the file readable to the eye.
    profils: roster.profils.map((profil) =>
      profil.estMoi
        ? { id: profil.id, nom: profil.nom, estMoi: true }
        : { id: profil.id, nom: profil.nom },
    ),
    personnages: roster.personnages.map((personnage) => ({ ...personnage })),
    ignores: roster.ignores.map((ignore) => ({ ...ignore })),
    preferences: roster.preferences.map((preference) => ({ ...preference })),
  };
}

export const FORME_ROSTER: Forme<Roster> = {
  nom: 'roster',
  schema: SCHEMA_ROSTER,
  defauts: rosterParDefaut,
  lire,
  ecrire,
};
