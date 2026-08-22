/**
 * Persistence: three JSON files versioned separately (ADR `0004`).
 *
 * Each carries its own `"schema"` and migrates independently of the other two,
 * because the three states are written at unrelated rhythms — the réglages on
 * every opacity drag, the strats on every keystroke, the roster once per fight at
 * most — and because one corruption must not carry all three away.
 *
 * The data folder is a parameter: it is `app.getPath('userData')`
 * (`%AppData%\wakfu-memo\`, `~/.config/wakfu-memo/`), but nothing here imports
 * Electron. `before-quit` calls `vider()`.
 */

import { mkdirSync } from 'node:fs';
import { FichierVersionne, type OptionsFichier, type Verdict } from './fichier-versionne.ts';
import { FORME_REGLAGES, type Reglages } from './reglages.ts';
import { FORME_ROSTER, type Roster } from './roster.ts';
import { FORME_STRATS, type Strats } from './strats.ts';
import type { Etat } from './suppressions.ts';

export * from './fichier-versionne.ts';
export * from './ids.ts';
export * from './reglages.ts';
export * from './roster.ts';
export * from './strats.ts';
export * from './suppressions.ts';

/**
 * What gets announced afterwards, in a single banner: a migration is silent but
 * not mute, and a file set aside or refused must be said, otherwise the user
 * believes they lost their data.
 */
export type Avertissement =
  | {
      readonly sorte: 'migration';
      readonly fichier: string;
      readonly depuis: number;
      readonly sauvegarde: string;
    }
  | {
      readonly sorte: 'mise-de-cote';
      readonly fichier: string;
      /** `null` when even the rename failed. */
      readonly miseDeCote: string | null;
    }
  | {
      readonly sorte: 'refus';
      readonly fichier: string;
      readonly schemaTrouve: number;
      readonly schemaConnu: number;
    };

function avertissementDe(fichier: string, verdict: Verdict): Avertissement | null {
  switch (verdict.etat) {
    case 'charge':
      return verdict.migreDepuis === null
        ? null
        : {
            sorte: 'migration',
            fichier: `${fichier}.json`,
            depuis: verdict.migreDepuis,
            sauvegarde: `${fichier}.v${verdict.migreDepuis}.bak`,
          };
    case 'defauts':
      // An absent file is the first launch, and that is not an event.
      return verdict.cause === 'absent'
        ? null
        : { sorte: 'mise-de-cote', fichier: `${fichier}.json`, miseDeCote: verdict.miseDeCote };
    default:
      return {
        sorte: 'refus',
        fichier: `${fichier}.json`,
        schemaTrouve: verdict.schemaTrouve,
        schemaConnu: verdict.schemaConnu,
      };
  }
}

export class Persistance {
  readonly dossierDonnees: string;
  readonly reglages: FichierVersionne<Reglages>;
  readonly roster: FichierVersionne<Roster>;
  readonly strats: FichierVersionne<Strats>;

  constructor(dossierDonnees: string, options: OptionsFichier = {}) {
    this.dossierDonnees = dossierDonnees;
    this.reglages = new FichierVersionne(dossierDonnees, FORME_REGLAGES, options);
    this.roster = new FichierVersionne(dossierDonnees, FORME_ROSTER, options);
    this.strats = new FichierVersionne(dossierDonnees, FORME_STRATS, options);
  }

  /** One read per file, at startup. A stable order makes the banner reproducible. */
  charger(): void {
    mkdirSync(this.dossierDonnees, { recursive: true });
    this.reglages.charger();
    this.roster.charger();
    this.strats.charger();
  }

  get avertissements(): Avertissement[] {
    return [
      avertissementDe(FORME_REGLAGES.nom, this.reglages.verdict),
      avertissementDe(FORME_ROSTER.nom, this.roster.verdict),
      avertissementDe(FORME_STRATS.nom, this.strats.verdict),
    ].filter((avertissement): avertissement is Avertissement => avertissement !== null);
  }

  /** The three models as one block, the shape the cascades expect. */
  etat(): Etat {
    return {
      reglages: this.reglages.lire(),
      roster: this.roster.lire(),
      strats: this.strats.lire(),
    };
  }

  /** Rewrites what moved, and only that. */
  appliquer(etat: Etat): void {
    if (etat.reglages !== this.reglages.lire()) this.reglages.ecrire(etat.reglages);
    if (etat.roster !== this.roster.lire()) this.roster.ecrire(etat.roster);
    if (etat.strats !== this.strats.lire()) this.strats.ecrire(etat.strats);
  }

  /** One key, or a few: the bag is typed, so a typo does not reach the disk. */
  modifierReglages(patch: Partial<Reglages>): void {
    this.reglages.ecrire({ ...this.reglages.lire(), ...patch });
  }

  vider(): void {
    this.reglages.vider();
    this.roster.vider();
    this.strats.vider();
  }
}
