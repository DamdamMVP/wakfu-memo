import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import type { Composition } from '../domaine/composition.ts';
import { ficheDuTour } from '../suivi/fiche.ts';
import type { EtatDuSuivi } from '../suivi/suivi-du-tour.ts';
import { VeilleDuCombat } from './veille-du-combat.ts';

const prefixe = ' INFO 15:55:14,118 [AWT-EventQueue-0] (faw:1405) - ';
const LOG_PATH = `${prefixe}log path=/home/USER/.config/zaap/gamesLogs/wakfu`;
const FRONTIERE = `${prefixe}[Information (combat)] 0 seconde reportée pour le tour suivant.`;
const BAVARDAGE = `${prefixe}[Communauté (FR)] PJ1 : on repull ?`;
const rejoint = (fightId: string, nom: string, breed: number, idEntite: string): string =>
  `${prefixe}[_FL_] fightId=${fightId} ${nom} breed : ${breed} [${idEntite}] isControlledByAI=false obstacleId : -1 join the fight at {Point3 : (0, 0, 0)}`;
const finDeCombat = (fightId: string): string => `${prefixe}[FIGHT] End fight with id ${fightId}`;

const DUO: Composition = [
  { classe: 'iop', couleur: 'rouge' },
  { classe: 'eniripsa', couleur: 'jaune' },
];

let dossier: string;
let fichier: string;

before(() => {
  dossier = mkdtempSync(join(tmpdir(), 'wakfu-memo-veille-'));
  fichier = join(dossier, 'wakfu.log');
});
after(() => rmSync(dossier, { recursive: true, force: true }));

const ecrire = (...lignes: string[]): void => writeFileSync(fichier, `${lignes.join('\n')}\n`);
const ajouter = (...lignes: string[]): void => appendFileSync(fichier, `${lignes.join('\n')}\n`);

/** A watch on the temp file, and the log of everything it announced. */
function bancDEssai(): { veille: VeilleDuCombat; annonces: (EtatDuSuivi | null)[] } {
  const annonces: (EtatDuSuivi | null)[] = [];
  const veille = new VeilleDuCombat((combat) => annonces.push(combat));
  veille.poserComposition(DUO);
  annonces.length = 0;
  veille.suivre(fichier);
  return { veille, annonces };
}

describe('le combat suivi en direct', () => {
  it('le Tour courant avance à chaque Frontière, et l’annonce est unique', () => {
    ecrire(LOG_PATH, rejoint('1', 'PJ1', 8, 'ENTITE1'), rejoint('1', 'PJ2', 7, 'ENTITE2'));
    const { veille, annonces } = bancDEssai();

    strictEqual(annonces.length, 1);
    strictEqual(veille.combat?.tourCourant, 1);
    strictEqual(veille.combat?.rangCourant, 1);

    ajouter(FRONTIERE);
    strictEqual(veille.rattraper(), true);
    strictEqual(veille.combat?.rangCourant, 2);

    ajouter(FRONTIERE);
    strictEqual(veille.rattraper(), true);
    strictEqual(veille.combat?.tourCourant, 2);
    strictEqual(veille.combat?.rangCourant, 1);

    veille.arreter();
    strictEqual(annonces.length, 3);
  });

  it('une ligne qui ne dit rien du combat ne repeint pas la fiche', () => {
    // The file is verbose — trade, public chat, Java traces — and repainting on
    // every line would make the Overlay re-declare its clickable zones for
    // nothing, several times a second.
    ecrire(LOG_PATH, rejoint('1', 'PJ1', 8, 'ENTITE1'));
    const { veille, annonces } = bancDEssai();
    annonces.length = 0;

    ajouter(BAVARDAGE, BAVARDAGE);
    strictEqual(veille.rattraper(), false);
    strictEqual(annonces.length, 0);
    veille.arreter();
  });

  it('`End fight` ramène la fiche au Tour 1, sans teinte', () => {
    ecrire(
      LOG_PATH,
      rejoint('1', 'PJ1', 8, 'ENTITE1'),
      rejoint('1', 'PJ2', 7, 'ENTITE2'),
      FRONTIERE,
      FRONTIERE,
      FRONTIERE,
    );
    const { veille } = bancDEssai();
    strictEqual(veille.combat?.tourCourant, 2);

    ajouter(finDeCombat('1'));
    strictEqual(veille.rattraper(), true);
    // Not "frozen on the last Tour played": in farm you do not reread the combat
    // you have just finished, and the first thing seen at the next run would be
    // stale.
    strictEqual(veille.combat, null);
    veille.arreter();
  });

  it('un `[_FL_]` de `fightId` neuf réinitialise tout, sans délai d’expiration', () => {
    // The reset that counts is at the START of a combat: a stale state cures
    // itself at the next pull, so no timeout has to judge our own reliability.
    ecrire(
      LOG_PATH,
      rejoint('1', 'PJ1', 8, 'ENTITE1'),
      rejoint('1', 'PJ2', 7, 'ENTITE2'),
      FRONTIERE,
      FRONTIERE,
      FRONTIERE,
    );
    const { veille } = bancDEssai();
    strictEqual(veille.combat?.tourCourant, 2);

    // No `End fight` — client crash, disconnection, kick — then the next pull.
    ajouter(rejoint('2', 'PJ1', 8, 'ENTITE1'), rejoint('2', 'PJ2', 7, 'ENTITE2'));
    strictEqual(veille.rattraper(), true);
    strictEqual(veille.combat?.fightId, '2');
    strictEqual(veille.combat?.tourCourant, 1);
    veille.arreter();
  });

  it('changer de Strat recalcule la Liaison sans relire le fichier', () => {
    ecrire(LOG_PATH, rejoint('1', 'PJ1', 8, 'ENTITE1'), rejoint('1', 'PJ2', 7, 'ENTITE2'));
    const { veille } = bancDEssai();
    deepStrictEqual(veille.combat?.rangsActifs, [1, 2]);

    // A Strat written against three Classes, played by two: the Emplacement
    // nobody holds is greyed, and the Rotation never stops on it.
    veille.poserComposition([
      { classe: 'eniripsa', couleur: 'rouge' },
      { classe: 'cra', couleur: 'jaune' },
      { classe: 'iop', couleur: 'vert' },
    ]);
    deepStrictEqual(veille.combat?.rangsActifs, [1, 3]);
    veille.arreter();
  });

  it('perdre le fichier lâche l’état de combat', () => {
    ecrire(LOG_PATH, rejoint('1', 'PJ1', 8, 'ENTITE1'), FRONTIERE);
    const { veille, annonces } = bancDEssai();
    strictEqual(veille.combat?.ouvert, true);
    annonces.length = 0;

    // What ADR `0014` turns off is the Overlay; here we make sure the fiche does
    // not stay frozen on a Tour nothing will ever move again.
    veille.suivre(null);
    strictEqual(veille.combat, null);
    deepStrictEqual(annonces, [null]);
    veille.arreter();
  });

  it('la fiche du Tour se construit de ce que la veille annonce', () => {
    // The seam of the lot, in one assertion: bytes on disk → a tinted line.
    ecrire(LOG_PATH, rejoint('1', 'PJ1', 8, 'ENTITE1'), rejoint('1', 'PJ2', 7, 'ENTITE2'));
    const { veille } = bancDEssai();
    ajouter(FRONTIERE);
    veille.rattraper();

    const fiche = ficheDuTour(
      {
        id: 's',
        nom: 'Nozadah',
        emplacements: [
          { id: 'a', classe: 'iop', couleur: 'rouge' },
          { id: 'b', classe: 'eniripsa', couleur: 'jaune' },
        ],
        tours: [{ consignes: { a: [{ t: 'contact' }] } }],
      },
      veille.combat,
    );

    deepStrictEqual(
      fiche.lignes.map((ligne) => ligne.enAvant),
      [false, true],
    );
    veille.arreter();
  });
});
