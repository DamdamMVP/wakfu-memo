/**
 * Ce que la Fenêtre principale reçoit, et les deux seules choses qu'elle
 * demande.
 *
 * Les formes sont **recopiées à la main** depuis `src/persistance/` et
 * `src/main/main.ts` : une surface n'a pas d'API Node et se compile comme son
 * propre projet, donc importer les vrais types traînerait les modules qui lisent
 * le disque dans le rendu. C'est le même choix que l'Overlay du Tour, pour la
 * même raison, et le compilateur de l'autre côté possède les originaux.
 *
 * Un seul canal écrit : `editerStrats`. La surface envoie une **intention**, et
 * `persistance/edition-strats.ts` décide — elle ne choisit jamais une Couleur
 * libre, ne calcule jamais un Rang, n'invente jamais un id.
 */

export type Segment = { readonly t: string; readonly c?: string };

export type Emplacement = {
  readonly id: string;
  readonly classe: string;
  readonly couleur: string;
};

export type Tour = {
  readonly global?: readonly Segment[];
  readonly note?: string;
  readonly consignes: Readonly<Record<string, readonly Segment[]>>;
};

export type Strat = {
  readonly id: string;
  readonly nom: string;
  readonly emplacements: readonly Emplacement[];
  readonly tours: readonly Tour[];
};

/* ------------------------------------------------------------- le Roster - */

export type Profil = {
  readonly id: string;
  readonly nom: string;
  readonly estMoi: boolean;
};

export type Personnage = {
  readonly id: string;
  readonly profilId: string;
  readonly nom: string;
  readonly classe: string;
  /** `null` tant qu'aucun combat ne l'a confirmé : il est encore une hypothèse. */
  readonly idEntite: string | null;
};

export type PersonnageIgnore = {
  readonly idEntite: string;
  readonly nomVu: string;
};

/** Un combattant joué que le Roster ne connaît pas, et qu'on n'a pas classé. */
export type DemandeDAjout = {
  readonly idEntite: string;
  readonly nom: string;
  readonly classe: string;
};

/** Miroir de `Avertissement` de `src/persistance/`. */
export type Avertissement = {
  readonly sorte: 'migration' | 'mise-de-cote' | 'refus';
  readonly fichier: string;
  readonly depuis?: number;
  readonly sauvegarde?: string;
  readonly miseDeCote?: string | null;
};

export type Pose = {
  readonly combinaison: string | null;
  readonly etat: 'pris' | 'refuse' | 'absent';
};

/** Les quatre réglages d'aspect, tels que le décor factice les dessine. */
export type Aspect = {
  readonly opacite: number;
  readonly tailleTexte: number;
  readonly largeur: number;
  readonly x: number;
  readonly y: number;
};

/** L'instantané que le processus principal pousse à chaque changement. */
export type Etat = {
  readonly conditions: Record<string, boolean>;
  readonly manquantes: readonly string[];
  readonly dessine: boolean;
  readonly attache: boolean;
  readonly titreCible: string;
  readonly verrouille: boolean;
  readonly demandeEnAttente: boolean;
  readonly wakfuLog: string | null;
  readonly dossierLogs: string | null;
  readonly dossierLogsManuel: string | null;
  readonly aspect: Aspect;
  readonly stratChoisie: string | null;
  readonly stratChoisieId: string | null;
  readonly strats: readonly Strat[];
  readonly profils: readonly Profil[];
  readonly personnages: readonly Personnage[];
  readonly ignores: readonly PersonnageIgnore[];
  readonly aIdentifier: readonly DemandeDAjout[];
  readonly ficheMiniFenetre: number;
  readonly raccourcis: Record<string, Pose> | null;
  readonly dossierDonnees: string;
  readonly avertissements: readonly Avertissement[];
};

/** Miroir de `CommandeEdition`. La surface n'en construit jamais d'autre. */
export type CommandeEdition =
  | { readonly sorte: 'creer' }
  | { readonly sorte: 'renommer'; readonly stratId: string; readonly nom: string }
  | { readonly sorte: 'dupliquer'; readonly stratId: string }
  | { readonly sorte: 'supprimer-strat'; readonly stratId: string }
  | { readonly sorte: 'ajouter-emplacement'; readonly stratId: string; readonly classe: string }
  | {
      readonly sorte: 'poser-classe';
      readonly stratId: string;
      readonly emplacementId: string;
      readonly classe: string;
    }
  | {
      readonly sorte: 'poser-couleur';
      readonly stratId: string;
      readonly emplacementId: string;
      readonly couleur: string;
    }
  | {
      readonly sorte: 'deplacer-emplacement';
      readonly stratId: string;
      readonly emplacementId: string;
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
      readonly vers: number;
    }
  | {
      readonly sorte: 'poser-consigne';
      readonly stratId: string;
      readonly tour: number;
      readonly emplacementId: string;
      readonly segments: readonly Segment[];
    }
  | {
      readonly sorte: 'poser-global';
      readonly stratId: string;
      readonly tour: number;
      readonly segments: readonly Segment[];
    }
  | {
      readonly sorte: 'poser-note';
      readonly stratId: string;
      readonly tour: number;
      readonly note: string;
    };

/** Miroir de `CommandeRoster`. Même contrat, et même gardien de l'autre côté. */
export type CommandeRoster =
  | { readonly sorte: 'creer-profil' }
  | { readonly sorte: 'renommer-profil'; readonly profilId: string; readonly nom: string }
  | { readonly sorte: 'supprimer-profil'; readonly profilId: string }
  | {
      readonly sorte: 'saisir-personnage';
      readonly profilId: string;
      readonly nom: string;
      readonly classe: string;
    }
  | {
      readonly sorte: 'corriger-personnage';
      readonly personnageId: string;
      readonly nom: string;
      readonly classe: string;
    }
  | { readonly sorte: 'supprimer-personnage'; readonly personnageId: string }
  | {
      readonly sorte: 'ajouter-personnage';
      readonly profilId: string;
      readonly idEntite: string;
      readonly nom: string;
      readonly classe: string;
    }
  | {
      readonly sorte: 'rattacher';
      readonly personnageId: string;
      readonly idEntite: string;
      readonly nom: string;
      readonly classe: string;
    }
  | { readonly sorte: 'ignorer'; readonly idEntite: string; readonly nomVu: string }
  | { readonly sorte: 'ne-plus-ignorer'; readonly idEntite: string };

/** Ce que la confirmation d'une suppression a besoin de dire (ADR 0012). */
export type ConsequenceSuppression = {
  readonly tours: number;
  readonly emplacements: number;
  readonly estChoisie: boolean;
  readonly choixPasseA: { readonly id: string; readonly nom: string } | null;
};

/** Idem pour un Emplacement : les Consignes qu'il emporte dans tous les Tours. */
export type ConsequenceSuppressionEmplacement = {
  readonly consignesPerdues: number;
  readonly preferencesPerdues: number;
};

/**
 * Ce qu'emporte la suppression d'un Personnage. `idEntite` à `null` **est** la
 * seconde forme de la confirmation : sans ID d'entité il n'y a rien à retenir de
 * lui, donc « ignorer » n'a pas de bouton — et la boîte ne l'explique pas.
 */
export type ConsequenceSuppressionPersonnage = {
  readonly idEntite: string | null;
  readonly engagements: readonly { readonly stratNom: string; readonly couleur: string }[];
};

/** Idem pour un Profil : ses Personnages partent avec lui (#11). */
export type ConsequenceSuppressionProfil = {
  readonly personnages: readonly {
    readonly nom: string;
    readonly classe: string;
    readonly aUnIdEntite: boolean;
  }[];
  readonly preferences: number;
};

type PontMemo = {
  etat: () => Promise<Etat>;
  surEtat: (rappel: (etat: Etat) => void) => void;
  basculerAffichage: () => void;
  choisirStrat: (id: string | null) => void;
  poserAspect: (aspect: { opacite?: number; tailleTexte?: number }) => void;
  poserLargeurFiche: (largeur: number | null) => void;
  poserPositionFiche: (x: number, y: number) => void;
  poserFicheMiniFenetre: (largeur: number) => void;
  poserRaccourci: (nom: string, combinaison: string | null) => void;
  designerDossierLogs: () => Promise<string | null>;
  oublierDossierLogs: () => void;
  ouvrirDossierDonnees: () => void;
  editerStrats: (commande: CommandeEdition) => Promise<{ stratId: string | null }>;
  consequenceSuppressionStrat: (stratId: string) => Promise<ConsequenceSuppression>;
  consequenceSuppressionEmplacement: (
    stratId: string,
    emplacementId: string,
  ) => Promise<ConsequenceSuppressionEmplacement>;
  editerRoster: (commande: CommandeRoster) => Promise<{ profilId: string | null }>;
  consequenceSuppressionPersonnage: (
    personnageId: string,
  ) => Promise<ConsequenceSuppressionPersonnage>;
  consequenceSuppressionProfil: (profilId: string) => Promise<ConsequenceSuppressionProfil>;
};

export const memo = (window as unknown as { memo?: PontMemo }).memo;

/**
 * Les six Couleurs d'Emplacement : **le mot**, puis la teinte qui le peint.
 *
 * ⚠️ Le modèle transporte le **mot** — `rouge`, `gris` — et pas l'hexadécimal :
 * sur le disque la Couleur est une teinte (ADR 0004), mais en mémoire c'est le
 * nom que la Rotation et les joueurs prononcent, et c'est la frontière de
 * `persistance/strats.ts` qui traduit. Une surface reçoit donc toujours le mot.
 *
 * Le CSS, lui, ne sait pas peindre « rouge ». D'où cette table, recopiée de
 * `domaine/palettes.ts` : elle ne sert qu'à **peindre**, jamais à comparer.
 * Comparer se fait sur le mot, et envoyer une Couleur aussi — le réducteur
 * refuse tout ce qui n'est pas l'un des six mots.
 */
export const COULEURS: readonly (readonly [string, string])[] = [
  ['rouge', '#ff5252'],
  ['jaune', '#ffdd33'],
  ['vert', '#4ade50'],
  ['bleu', '#22d3d3'],
  ['rose', '#ff4fd8'],
  ['gris', '#a3a8b0'],
];

/** Six Emplacements au maximum, donc six Couleurs suffisent (ADR 0003). */
export const MAX_EMPLACEMENTS = COULEURS.length;

/**
 * Les dix-huit classes. L'ordre est celui de `domaine/classes.ts`, et la clé est
 * ce qui nomme le portrait de `icons/` — jamais le `breed`, dont la numérotation
 * a un trou.
 */
export const CLASSES: readonly (readonly [string, string])[] = [
  ['feca', 'Féca'],
  ['osamodas', 'Osamodas'],
  ['enutrof', 'Enutrof'],
  ['sram', 'Sram'],
  ['xelor', 'Xélor'],
  ['ecaflip', 'Ecaflip'],
  ['eniripsa', 'Eniripsa'],
  ['iop', 'Iop'],
  ['cra', 'Crâ'],
  ['sadida', 'Sadida'],
  ['sacrieur', 'Sacrieur'],
  ['pandawa', 'Pandawa'],
  ['roublard', 'Roublard'],
  ['zobal', 'Zobal'],
  ['ouginak', 'Ouginak'],
  ['steamer', 'Steamer'],
  ['eliotrope', 'Eliotrope'],
  ['huppermage', 'Huppermage'],
];

const NOM_DE_CLASSE = new Map(CLASSES);

export const nomDeClasse = (classe: string): string => NOM_DE_CLASSE.get(classe) ?? classe;

const HEXA_DE_COULEUR = new Map(COULEURS);

/** La teinte d'une Couleur, pour la peindre. `transparent` si le mot est neuf. */
export const hexaDeCouleur = (couleur: string): string =>
  HEXA_DE_COULEUR.get(couleur) ?? 'transparent';

/** « 7 tours », « 1 emplacement » — le pluriel se compte, il ne se devine pas. */
export const pluriel = (compte: number, mot: string): string =>
  `${compte} ${mot}${compte > 1 ? 's' : ''}`;

export function editer(commande: CommandeEdition): Promise<{ stratId: string | null }> {
  return memo?.editerStrats(commande) ?? Promise.resolve({ stratId: null });
}

export function editerLeRoster(commande: CommandeRoster): Promise<{ profilId: string | null }> {
  return memo?.editerRoster(commande) ?? Promise.resolve({ profilId: null });
}
