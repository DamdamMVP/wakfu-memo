/**
 * `strats.json` — the flat list of Strats. A pure, shareable artefact: it holds
 * no Préférence de liaison (ADR `0005`), nothing of a fight's composition, no
 * monster signature, no dungeon group, no "default" flag.
 *
 * Two things are not stored because they *are* a position:
 *   — an Emplacement's Rang, which is its place in `emplacements`;
 *   — a Tour's number, which is its place in `tours`.
 * Storing them would create two sources of truth for one thing, and the drift to
 * repair with it.
 *
 * The invariants — unique Couleur, at most six Emplacements — are enforced on
 * write by the editor, the only writer, and repaired in silence here: we chose a
 * readable JSON, so someone will eventually open it.
 *
 * On disk the Couleur is a hex (ADR `0004`), in memory it is the name the
 * Rotation and the players speak (`domaine/composition.ts`). The boundary is
 * this file, and it is the only place that knows both.
 */

import { type Classe, estClasse } from '../domaine/classes.ts';
import { COULEURS, type Composition, type Couleur } from '../domaine/composition.ts';
import { couleurDeHexa, HEXA_DE_COULEUR } from '../domaine/palettes.ts';
import { normaliserSegments, type Segment } from '../domaine/texte-riche.ts';
import type { Brut, Forme } from './fichier-versionne.ts';
import { nouvelId } from './ids.ts';

export const SCHEMA_STRATS = 1;

/** At most six Emplacements, so six Couleurs are enough (ADR `0003`). */
export const MAX_EMPLACEMENTS = COULEURS.length;

/** The Composition's Emplacement, plus the id the Consignes index on. */
export type Emplacement = {
  readonly id: string;
  readonly classe: Classe;
  /** Mandatory and unique in the Strat: it is the Emplacement's identity. */
  readonly couleur: Couleur;
};

export type Tour = {
  /** The global description is consigne, so it is rich text. */
  readonly global?: readonly Segment[];
  /** The footer note is plain text: the amber italic is its signature. */
  readonly note?: string;
  /** Indexed by Emplacement id. An empty Consigne is said by an absent key. */
  readonly consignes: Readonly<Record<string, readonly Segment[]>>;
};

export type Strat = {
  readonly id: string;
  /** Free and NOT unique: duplicating a Strat is an expected gesture. */
  readonly nom: string;
  readonly emplacements: readonly Emplacement[];
  readonly tours: readonly Tour[];
};

export type Strats = {
  readonly strats: readonly Strat[];
};

export function stratsParDefaut(): Strats {
  return { strats: [] };
}

/**
 * What the turn tracking needs of a Strat. The ids drop out: the Rotation only
 * ever needs the Classe and the Couleur, in Rang order.
 */
export function compositionDe(strat: Strat): Composition {
  return strat.emplacements;
}

/** The Couleurs no Emplacement of the Strat carries yet. */
export function couleursLibres(emplacements: readonly { couleur: Couleur }[]): Couleur[] {
  const prises = new Set(emplacements.map((emplacement) => emplacement.couleur));
  return COULEURS.filter((couleur) => !prises.has(couleur));
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

function lireEmplacements(brut: unknown): Emplacement[] {
  const retenus: Array<{ id: string; classe: Classe; couleur: Couleur | null }> = [];
  const vus = new Set<string>();
  for (const candidat of objets(brut)) {
    if (retenus.length === MAX_EMPLACEMENTS) break; // past six, we cut
    const classe = candidat['classe'];
    if (!estClasse(classe)) continue;
    const id = texte(candidat['id']) || nouvelId();
    // A duplicated id: the first one keeps it, and the Consignes stay its.
    if (vus.has(id)) continue;
    vus.add(id);
    retenus.push({ id, classe, couleur: couleurDeHexa(candidat['couleur']) });
  }

  // A duplicated or unknown Couleur takes the first free one: uniqueness is what
  // tells two Emplacements of the same Classe apart.
  const prises = new Set<Couleur>();
  for (const emplacement of retenus) {
    if (emplacement.couleur !== null && !prises.has(emplacement.couleur)) {
      prises.add(emplacement.couleur);
    } else {
      emplacement.couleur = null;
    }
  }
  const libres = COULEURS.filter((couleur) => !prises.has(couleur));
  let prochaine = 0;
  return retenus.map(({ id, classe, couleur }) => ({
    id,
    classe,
    // Safe: at most six Emplacements are kept, so there are always enough free
    // Couleurs for those that lost theirs.
    couleur: couleur ?? (libres[prochaine++] as Couleur),
  }));
}

function lireTour(brut: Brut, idsEmplacements: ReadonlySet<string>): Tour {
  const consignes: Record<string, readonly Segment[]> = {};
  const brutConsignes = brut['consignes'];
  if (
    typeof brutConsignes === 'object' &&
    brutConsignes !== null &&
    !Array.isArray(brutConsignes)
  ) {
    for (const [emplacementId, valeur] of Object.entries(brutConsignes as Brut)) {
      // An orphan key in `tours` is a dirty file: it goes.
      if (!idsEmplacements.has(emplacementId)) continue;
      const segments = normaliserSegments(valeur);
      if (segments.length > 0) consignes[emplacementId] = segments;
    }
  }
  const global = normaliserSegments(brut['global']);
  const note = texte(brut['note']);
  return {
    ...(global.length > 0 ? { global } : {}),
    ...(note !== '' ? { note } : {}),
    consignes,
  };
}

function lireStrats(brut: unknown): Strat[] {
  const strats: Strat[] = [];
  const vus = new Set<string>();
  for (const candidat of objets(brut)) {
    const id = texte(candidat['id']) || nouvelId();
    if (vus.has(id)) continue;
    vus.add(id);
    const emplacements = lireEmplacements(candidat['emplacements']);
    const idsEmplacements = new Set(emplacements.map((emplacement) => emplacement.id));
    strats.push({
      id,
      nom: texte(candidat['nom']),
      emplacements,
      tours: objets(candidat['tours']).map((tour) => lireTour(tour, idsEmplacements)),
    });
  }
  return strats;
}

function lire(brut: Brut): Strats {
  return { strats: lireStrats(brut['strats']) };
}

function ecrireTour(tour: Tour): Brut {
  const consignes: Brut = {};
  for (const [emplacementId, segments] of Object.entries(tour.consignes)) {
    if (segments.length > 0) consignes[emplacementId] = segments;
  }
  return {
    ...(tour.global !== undefined && tour.global.length > 0 ? { global: tour.global } : {}),
    ...(tour.note !== undefined && tour.note !== '' ? { note: tour.note } : {}),
    consignes,
  };
}

function ecrire(donnees: Strats): Brut {
  return {
    strats: donnees.strats.map((strat) => ({
      id: strat.id,
      nom: strat.nom,
      emplacements: strat.emplacements.map((emplacement) => ({
        id: emplacement.id,
        classe: emplacement.classe,
        couleur: HEXA_DE_COULEUR[emplacement.couleur],
      })),
      tours: strat.tours.map(ecrireTour),
    })),
  };
}

export const FORME_STRATS: Forme<Strats> = {
  nom: 'strats',
  schema: SCHEMA_STRATS,
  defauts: stratsParDefaut,
  lire,
  ecrire,
};
