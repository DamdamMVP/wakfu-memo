/**
 * The game's `breed` table, and the translation into a Classe key.
 *
 * Copied by hand from the `breed.<id>` keys of `i18n_fr.jar` — the log grammar
 * says why it is not generated: eighteen lines, and generating them would mean
 * interpreting the game's gender syntax (`breed.11=Sacrieu{[1*]?se:r}`) for
 * nothing. That is the opposite of the choice made for the combat patterns,
 * which are hundreds across four languages.
 *
 * Two traps this table makes explicit:
 *  - `breed` 17 (`Désincarné`) is not a playable Classe: the numbering has a
 *    hole, the eighteen Classes are `1..16`, `18` and `19`.
 *  - the order is not the one of the game's class selection screen. No index
 *    derives from another by arithmetic, hence the keys — and they are what
 *    names the portraits of `icons/`.
 */

export const CLASSES = [
  'feca',
  'osamodas',
  'enutrof',
  'sram',
  'xelor',
  'ecaflip',
  'eniripsa',
  'iop',
  'cra',
  'sadida',
  'sacrieur',
  'pandawa',
  'roublard',
  'zobal',
  'ouginak',
  'steamer',
  'eliotrope',
  'huppermage',
] as const;

export type Classe = (typeof CLASSES)[number];

const PAR_BREED = new Map<number, Classe>([
  [1, 'feca'],
  [2, 'osamodas'],
  [3, 'enutrof'],
  [4, 'sram'],
  [5, 'xelor'],
  [6, 'ecaflip'],
  [7, 'eniripsa'],
  [8, 'iop'],
  [9, 'cra'],
  [10, 'sadida'],
  [11, 'sacrieur'],
  [12, 'pandawa'],
  [13, 'roublard'],
  [14, 'zobal'],
  [15, 'ouginak'],
  [16, 'steamer'],
  [18, 'eliotrope'],
  [19, 'huppermage'],
]);

/**
 * The Classe of a `breed`, or `null` when the `breed` names none: monsters and
 * Invocations are four digits (`1381`, `1620`, `2335`), and `17` is the
 * `Désincarné`.
 */
export function classeDuBreed(breed: number): Classe | null {
  return PAR_BREED.get(breed) ?? null;
}

/** Whether a stored value names one of the eighteen Classes. */
export function estClasse(valeur: unknown): valeur is Classe {
  return typeof valeur === 'string' && (CLASSES as readonly string[]).includes(valeur);
}

/**
 * How a Classe is spelled to a human. The key is what the model carries and
 * what names the portrait; this is only ever read aloud.
 *
 * The surfaces keep their own hand copy of this table — they compile as their
 * own project and importing this file would drag the disk readers into the
 * renderer. Here it serves the one place in the main process that writes a
 * Classe out: the native menu of the Demande d'ajout, which says which Classe
 * the log claims against the one that was typed.
 */
const NOMS: Record<Classe, string> = {
  feca: 'Féca',
  osamodas: 'Osamodas',
  enutrof: 'Enutrof',
  sram: 'Sram',
  xelor: 'Xélor',
  ecaflip: 'Ecaflip',
  eniripsa: 'Eniripsa',
  iop: 'Iop',
  cra: 'Crâ',
  sadida: 'Sadida',
  sacrieur: 'Sacrieur',
  pandawa: 'Pandawa',
  roublard: 'Roublard',
  zobal: 'Zobal',
  ouginak: 'Ouginak',
  steamer: 'Steamer',
  eliotrope: 'Eliotrope',
  huppermage: 'Huppermage',
};

export const nomDeClasse = (classe: string): string => (estClasse(classe) ? NOMS[classe] : classe);
