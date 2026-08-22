/**
 * `reglages.json` — a tolerant key bag (ADR `0004`): a missing key takes the
 * code default, an unknown key survives the rewrite. Adding a setting therefore
 * needs no migration; only a rename does, and that is why the schema number
 * stays. Keeping unknown keys covers downgrading for free — a v1 rereading a v2
 * file does not destroy what it does not understand.
 *
 * The inventory is frozen (issue #11). Where these values are *changed* is
 * another question, settled by ADR `0013` — the aspect of the Overlay is set on
 * the Overlay — and that does not move where they live.
 *
 * This replaces the provisional store Lot 2 carried, and keeps its key names: it
 * writes the same file, and a rename would have cost a migration for nothing.
 */

import type { Brut, Forme } from './fichier-versionne.ts';

export const SCHEMA_REGLAGES = 1;

export type Reglages = {
  /** % — the Overlay's opacity, judged against the game's pixels (ADR `0013`). */
  readonly opacite: number;
  /** px — the fiche's text size. */
  readonly tailleTexte: number;
  /** px — the width of the Overlay's fiche, global: only one fiche is visible. */
  readonly largeurFiche: number;
  /**
   * px — the fiche's top-left corner, **inside the game window**: the Overlay
   * covers the whole window, so the fiche moves within it and no window is
   * moved. The fourth aspect setting of ADR `0013`, which the frozen inventory
   * of #11 had left out — the tolerant key bag is what makes adding it free.
   */
  readonly ficheX: number;
  readonly ficheY: number;
  /** px — the other quantity: the minimum fiche width in the Fenêtre principale. */
  readonly ficheMiniFenetre: number;
  /** The three global shortcuts. `null` means cleared; the rules decide the fallback. */
  readonly raccourciOverlay: string | null;
  readonly raccourciVerrou: string | null;
  readonly raccourciFenetre: string | null;
  /** Log folder designated by hand. `null` = automatic discovery (ADR `0014`). */
  readonly dossierLogsManuel: string | null;
  /** Affichage demandé: an intention, not a window state. */
  readonly affichageDemande: boolean;
  /** The id of the Strat chosen — a display condition, `null` possible. */
  readonly stratChoisie: string | null;
  readonly onboardingVu: boolean;
};

/** The slider bounds, read off the Réglages and editor mockups. */
export const BORNES = {
  opacite: { min: 40, max: 100 },
  tailleTexte: { min: 11, max: 22 },
  /** No maximum: it is a window's width, the screen bounds it. */
  largeurFiche: { min: 340, max: Number.POSITIVE_INFINITY },
  /** The game window bounds them, and it is not known here. */
  fichePosition: { min: 0, max: Number.POSITIVE_INFINITY },
  ficheMiniFenetre: { min: 300, max: 700 },
} as const;

export const REGLAGES_PAR_DEFAUT: Reglages = {
  opacite: 85,
  tailleTexte: 14,
  largeurFiche: 420,
  // Off the top-left corner, where no game window puts anything vital.
  ficheX: 40,
  ficheY: 40,
  ficheMiniFenetre: 400,
  // Not settled — the mockup gives them as examples. What is frozen is that
  // there are three, and `raccourcis-regles.ts` holds the rule that the lock one
  // always resolves to something.
  raccourciOverlay: 'Ctrl+Alt+W',
  raccourciVerrou: 'Ctrl+Alt+L',
  raccourciFenetre: null,
  dossierLogsManuel: null,
  // The intention starts off: the onboarding is what sets it, once the Roster
  // holds someone and a Strat exists.
  affichageDemande: false,
  stratChoisie: null,
  onboardingVu: false,
};

const CLES_CONNUES = new Set(Object.keys(REGLAGES_PAR_DEFAUT));

function entier(valeur: unknown, bornes: { min: number; max: number }, defaut: number): number {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return defaut;
  return Math.min(Math.max(Math.round(valeur), bornes.min), bornes.max);
}

function booleen(valeur: unknown, defaut: boolean): boolean {
  return typeof valeur === 'boolean' ? valeur : defaut;
}

function chaineOuNull(valeur: unknown, defaut: string | null): string | null {
  if (valeur === null) return null;
  if (typeof valeur !== 'string') return defaut;
  const propre = valeur.trim();
  return propre === '' ? null : propre;
}

function lire(brut: Brut): Reglages {
  const d = REGLAGES_PAR_DEFAUT;
  return {
    opacite: entier(brut['opacite'], BORNES.opacite, d.opacite),
    tailleTexte: entier(brut['tailleTexte'], BORNES.tailleTexte, d.tailleTexte),
    largeurFiche: entier(brut['largeurFiche'], BORNES.largeurFiche, d.largeurFiche),
    ficheX: entier(brut['ficheX'], BORNES.fichePosition, d.ficheX),
    ficheY: entier(brut['ficheY'], BORNES.fichePosition, d.ficheY),
    ficheMiniFenetre: entier(brut['ficheMiniFenetre'], BORNES.ficheMiniFenetre, d.ficheMiniFenetre),
    raccourciOverlay: chaineOuNull(brut['raccourciOverlay'], d.raccourciOverlay),
    raccourciVerrou: chaineOuNull(brut['raccourciVerrou'], d.raccourciVerrou),
    raccourciFenetre: chaineOuNull(brut['raccourciFenetre'], d.raccourciFenetre),
    dossierLogsManuel: chaineOuNull(brut['dossierLogsManuel'], d.dossierLogsManuel),
    affichageDemande: booleen(brut['affichageDemande'], d.affichageDemande),
    stratChoisie: chaineOuNull(brut['stratChoisie'], d.stratChoisie),
    onboardingVu: booleen(brut['onboardingVu'], d.onboardingVu),
  };
}

function ecrire(reglages: Reglages, brutPrecedent: Brut | null): Brut {
  const contenu: Brut = {};
  // The unknown keys first, so none of them can cover a known one.
  for (const [cle, valeur] of Object.entries(brutPrecedent ?? {})) {
    if (cle !== 'schema' && !CLES_CONNUES.has(cle)) contenu[cle] = valeur;
  }
  return { ...contenu, ...reglages };
}

export const FORME_REGLAGES: Forme<Reglages> = {
  nom: 'reglages',
  schema: SCHEMA_REGLAGES,
  defauts: () => REGLAGES_PAR_DEFAUT,
  lire,
  ecrire,
};
