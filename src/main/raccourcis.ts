/**
 * Registering the three global shortcuts with the system.
 *
 * The rules — which one clears, which one falls back to a default, which
 * combination is even acceptable — live in `raccourcis-regles.ts`, which does
 * not know Electron. Here we register and report what the system refused; the
 * Réglages screen captures a new combination and asks for all three to be laid
 * down again.
 */

import { globalShortcut } from 'electron';

import {
  combinaisonRetenue,
  type NomRaccourci,
  type Poses,
  RACCOURCIS,
} from './raccourcis-regles.ts';

export {
  CLE_REGLAGE,
  combinaisonAcceptable,
  combinaisonDeLaFrappe,
  combinaisonRetenue,
  DEFAUT_VERROU,
  EFFACABLE,
  type EtatRaccourci,
  estNomDeRaccourci,
  type Frappe,
  type NomRaccourci,
  type Poses,
  RACCOURCIS,
} from './raccourcis-regles.ts';

export class Raccourcis {
  readonly #actions: Record<NomRaccourci, () => void>;
  #poses: Poses = {
    overlay: { combinaison: null, etat: 'absent' },
    verrou: { combinaison: null, etat: 'absent' },
    fenetre: { combinaison: null, etat: 'absent' },
  };

  constructor(actions: Record<NomRaccourci, () => void>) {
    this.#actions = actions;
  }

  get poses(): Poses {
    return this.#poses;
  }

  /** Re-registers all three at once — as a settings change will. */
  poser(combinaisons: Record<NomRaccourci, unknown>): Poses {
    globalShortcut.unregisterAll();
    const poses = {} as Poses;

    for (const nom of RACCOURCIS) {
      const combinaison = combinaisonRetenue(nom, combinaisons[nom]);
      if (combinaison === null) {
        poses[nom] = { combinaison: null, etat: 'absent' };
        continue;
      }
      let pris = false;
      try {
        pris = globalShortcut.register(combinaison, this.#actions[nom]);
      } catch {
        pris = false; // malformed combination: treated as refused
      }
      poses[nom] = { combinaison, etat: pris ? 'pris' : 'refuse' };
    }

    this.#poses = poses;
    return poses;
  }

  retirer(): void {
    globalShortcut.unregisterAll();
  }
}
