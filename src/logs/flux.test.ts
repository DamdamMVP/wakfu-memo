import { strictEqual } from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { FluxDuLog } from './flux.ts';

const prefixe = ' INFO 15:55:14,118 [AWT-EventQueue-0] (faw:1405) - ';
const LOG_PATH = `${prefixe}log path=/home/USER/.config/zaap/gamesLogs/wakfu`;
const FRONTIERE = `${prefixe}[Information (combat)] 0 seconde reportée pour le tour suivant.`;
/** The plural, which is where the accents sit — and where a cut byte shows. */
const FRONTIERES = `${prefixe}[Information (combat)] 54 secondes reportées pour le tour suivant.`;
const rejoint = (fightId: string, nom: string): string =>
  `${prefixe}[_FL_] fightId=${fightId} ${nom} breed : 6 [ENTITE1] isControlledByAI=false obstacleId : -1 join the fight at {Point3 : (0, 0, 0)}`;

let dossier: string;
let fichier: string;

before(() => {
  dossier = mkdtempSync(join(tmpdir(), 'wakfu-memo-flux-'));
  fichier = join(dossier, 'wakfu.log');
});
after(() => rmSync(dossier, { recursive: true, force: true }));

const semer = (...lignes: string[]): void => writeFileSync(fichier, `${lignes.join('\n')}\n`);
/** A Buffer, not a string: this is the only way to append half a character. */
const ajouter = (morceau: string | Buffer): void => appendFileSync(fichier, morceau);
const types = (flux: FluxDuLog): string[] => flux.evenements.map((e) => e.type);

describe('le suivi d’un `wakfu.log` qui grandit', () => {
  it('ne lit que ce qui a été ajouté, et cumule les événements', () => {
    semer(LOG_PATH, rejoint('1', 'PJ1'));
    const flux = new FluxDuLog();
    flux.suivre(fichier);

    strictEqual(flux.rattraper(), true);
    strictEqual(types(flux).join(','), 'debutDeSession,combattant');

    // Nothing appended: nothing read, and nothing announced.
    strictEqual(flux.rattraper(), false);

    ajouter(`${FRONTIERE}\n`);
    strictEqual(flux.rattraper(), true);
    strictEqual(types(flux).join(','), 'debutDeSession,combattant,frontiereDeTour');
  });

  it('garde la ligne coupée en deux lectures, et ne la compte qu’une fois', () => {
    semer(LOG_PATH);
    const flux = new FluxDuLog();
    flux.suivre(fichier);
    flux.rattraper();

    // The client writes when it wants: a read stops mid-line.
    const coupe = Math.floor(FRONTIERE.length / 2);
    ajouter(FRONTIERE.slice(0, coupe));
    strictEqual(flux.rattraper(), true);
    // Half a line says nothing — and above all it must not say a turn ended.
    strictEqual(types(flux).join(','), 'debutDeSession');

    ajouter(`${FRONTIERE.slice(coupe)}\n`);
    strictEqual(flux.rattraper(), true);
    strictEqual(flux.evenements.filter((e) => e.type === 'frontiereDeTour').length, 1);
  });

  it('garde le caractère coupé entre deux lectures', () => {
    // `reportées` is where it hurts: the Frontière de tour pattern is anchored on
    // it, and a byte cut in the middle of `é` decodes as two replacement
    // characters. The turn would be lost, silently.
    semer(LOG_PATH);
    const flux = new FluxDuLog();
    flux.suivre(fichier);
    flux.rattraper();

    const octets = Buffer.from(`${FRONTIERES}\n`, 'utf8');
    const accent = octets.indexOf(Buffer.from('é', 'utf8'));
    strictEqual(accent > 0, true);

    // Cut between the two bytes of the `é` of `reportées`.
    ajouter(octets.subarray(0, accent + 1));
    flux.rattraper();
    ajouter(octets.subarray(accent + 1));
    flux.rattraper();

    strictEqual(flux.evenements.filter((e) => e.type === 'frontiereDeTour').length, 1);
  });

  it('repart de zéro quand le fichier rapetisse', () => {
    semer(LOG_PATH, rejoint('1', 'PJ1'), FRONTIERE, FRONTIERE);
    const flux = new FluxDuLog();
    flux.suivre(fichier);
    flux.rattraper();
    strictEqual(flux.evenements.length, 4);

    // A rotation puts a fresh `wakfu.log` in place, and our offset then points
    // past its end.
    semer(LOG_PATH, rejoint('2', 'PJ2'));
    strictEqual(flux.rattraper(), true);
    strictEqual(types(flux).join(','), 'debutDeSession,combattant');
  });

  it('un `log path=` neuf jette ce qui précède', () => {
    // The session window of ADR `0007`, applied as we go: what comes before the
    // last client launch belongs to a previous session, and replaying it would
    // exhume a past.
    semer(LOG_PATH, rejoint('1', 'PJ1'), FRONTIERE);
    const flux = new FluxDuLog();
    flux.suivre(fichier);
    flux.rattraper();
    strictEqual(flux.evenements.length, 3);

    ajouter(`${LOG_PATH}\n${rejoint('2', 'PJ2')}\n`);
    flux.rattraper();
    strictEqual(types(flux).join(','), 'debutDeSession,combattant');
  });

  it('suivre un autre fichier ne garde rien du précédent', () => {
    semer(LOG_PATH, rejoint('1', 'PJ1'));
    const flux = new FluxDuLog();
    flux.suivre(fichier);
    flux.rattraper();
    strictEqual(flux.evenements.length, 2);

    flux.suivre(null);
    strictEqual(flux.evenements.length, 0);
    strictEqual(flux.rattraper(), false);
  });

  it('un fichier absent ne casse rien, et se lit entier quand il paraît', () => {
    const flux = new FluxDuLog();
    flux.suivre(join(dossier, 'jamais-ecrit.log'));
    strictEqual(flux.rattraper(), false);
    strictEqual(flux.evenements.length, 0);
  });
});
