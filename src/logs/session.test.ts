import { deepStrictEqual, ok, partialDeepStrictEqual, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Composition } from '../domaine/composition.ts';
import { lire, WAKFU_LOG, WAKFU_LOG_ALTERNANCE } from '../echantillons/echantillons.ts';
import { suivreLeCombat } from '../suivi/suivi-du-tour.ts';
import { analyser, decouperEnCombats, fenetreDeSession, relire } from './session.ts';

/** The `revive2` team: PJ4 (Eniripsa) plays first, PJ3 (Enutrof) next. */
const EQUIPE_REVIVE2: Composition = [
  { classe: 'eniripsa', couleur: 'rouge' },
  { classe: 'enutrof', couleur: 'bleu' },
];

const ECAFLIP_SEUL: Composition = [{ classe: 'ecaflip', couleur: 'rouge' }];

const LOG_PATH =
  ' INFO 15:54:39,381 [main] (com.ankamagames.wakfu.client.WakfuClient:213) - log path=/home/USER/.config/zaap/gamesLogs/wakfu';
const prefixe = ' INFO 15:55:14,118 [AWT-EventQueue-0] (faw:1405) - ';
const rejoint = (fightId: string, nom: string, breed: number, idEntite: string): string =>
  `${prefixe}[_FL_] fightId=${fightId} ${nom} breed : ${breed} [${idEntite}] isControlledByAI=false obstacleId : -1 join the fight at {Point3 : (0, 0, 0)}`;
const FRONTIERE = `${prefixe}[Information (combat)] 0 seconde reportée pour le tour suivant.`;
const ARRET = `${prefixe}Sending DisconnectionMessage to Servers. Reason : {UI Closed}`;
const finDeCombat = (fightId: string): string => `${prefixe}[FIGHT] End fight with id ${fightId}`;

describe('l’échantillon `revive2` — le seul vrai `wakfu.log`', () => {
  it('trois tours joués, deux clients, et le combat refermé', () => {
    const relecture = relire(lire(WAKFU_LOG), EQUIPE_REVIVE2);

    strictEqual(relecture.session.bornee, true);
    strictEqual(relecture.combats.length, 1);
    partialDeepStrictEqual(relecture.combats[0], {
      fightId: '1584021160',
      ouvert: false,
      clientsEngages: 2,
      finsDeTour: 3,
      avances: 3,
      tourCourant: 3,
    });
    // The combat is over: the Overlay has nothing to pick up.
    strictEqual(relecture.combatEnCours, null);
  });

  it('la Liaison sort de `[_FL_]`, monstres et Invocations exclus', () => {
    const combat = relire(lire(WAKFU_LOG), EQUIPE_REVIVE2).combats[0];
    ok(combat);

    deepStrictEqual(
      [...combat.liaison].map(([rang, c]) => `${rang}:${c.nom}`),
      ['1:PJ4', '2:PJ3'],
    );
    deepStrictEqual(
      combat.roster.map((c) => c.nom),
      ['Enutroffre-Fort', 'PJ4', 'PJ3', 'Phorreur Mature'],
    );
    // PJ3 is KO before having played, then revived: it is back in the Rotation at
    // the end of the combat.
    deepStrictEqual(combat.rangsActifs, [1, 2]);
  });

  it('un seul tour dans la fenêtre KO → réanimation, pour deux Personnages dont un à terre', () => {
    // Were it still emitting one, there would be two. That is what this sample
    // establishes: a fallen one emits no more Frontière.
    const evenements = analyser(lire(WAKFU_LOG));
    const ko = evenements.findIndex((e) => e.type === 'transition' && e.forme === 'ko');
    const reanime = evenements.findIndex((e) => e.type === 'transition' && e.forme === 'reanime');

    strictEqual(
      evenements.slice(ko, reanime).filter((e) => e.type === 'frontiereDeTour').length,
      1,
    );
  });

  it('`k` monte de 1 à 2 entre les deux blocs, et le combat rejoué compte pareil', () => {
    // The two clients write in BLOCKS, not alternating: on block A alone — the
    // only one visible during the combat — there is one copy per entity, so `k`
    // reads as 1 for 3 Frontières. On the whole file, `k` is 2 for 6 Frontières.
    // Both ends land right: what would drift is keeping block A's count and
    // adding the late copies to it with the old `k` — hence replaying the combat
    // from its `[_FL_]`.
    const lignes = lire(WAKFU_LOG).split('\n');
    const couture = lignes.findIndex((ligne) => ligne.startsWith('N 15:54:51,726'));
    strictEqual(couture > 0, true);

    partialDeepStrictEqual(relire(lignes.slice(0, couture).join('\n'), EQUIPE_REVIVE2).combats[0], {
      clientsEngages: 1,
      finsDeTour: 3,
      avances: 3,
      tourCourant: 3,
    });
    partialDeepStrictEqual(relire(lignes.join('\n'), EQUIPE_REVIVE2).combats[0], {
      clientsEngages: 2,
      finsDeTour: 3,
      avances: 3,
      tourCourant: 3,
    });
  });
});

describe('l’échantillon `alternance` — trois rounds contre une vérité terrain', () => {
  // The only sample checked against turns counted by hand at the table: three
  // full rounds, two characters, so six turns. And the only one where the two
  // clients write in **alternation** — 3 to 47 ms apart — where `revive2` had
  // them 345 lines apart, in blocks.
  const EQUIPE: Composition = [
    { classe: 'eniripsa', couleur: 'rouge' },
    { classe: 'enutrof', couleur: 'bleu' },
  ];

  it('douze frontières brutes, `k=2`, six tours joués', () => {
    const evenements = analyser(lire(WAKFU_LOG_ALTERNANCE));
    const combat = decouperEnCombats(evenements).combats.find((c) => c.fightId === '1552052456');
    ok(combat);

    strictEqual(combat.evenements.filter((e) => e.type === 'frontiereDeTour').length, 12);
    partialDeepStrictEqual(suivreLeCombat(combat.evenements, EQUIPE), {
      clientsEngages: 2,
      finsDeTour: 6,
      avances: 6,
      tourCourant: 4,
      ouvert: false,
    });
  });

  it('l’Invocation est dans le roster, jamais dans la Rotation', () => {
    const evenements = analyser(lire(WAKFU_LOG_ALTERNANCE));
    const combat = decouperEnCombats(evenements).combats.find((c) => c.fightId === '1552052456');
    ok(combat);

    const etat = suivreLeCombat(combat.evenements, EQUIPE);
    // Mama Wapin, the two Personnages, and the Phorreur summoned with
    // `obstacleId : 3` — four in the roster, two Emplacements.
    strictEqual(etat.roster.length, 4);
    deepStrictEqual(etat.rangsActifs, [1, 2]);
  });

  it('`{Quit Request From Client}` n’est pas un marqueur d’arrêt', () => {
    // The file carries it once, 33 ms before the `{UI Closed}` that is one.
    // Counting both would close a combat twice.
    const evenements = analyser(lire(WAKFU_LOG_ALTERNANCE));
    strictEqual(evenements.filter((e) => e.type === 'marqueurArret').length, 1);
    strictEqual(evenements.filter((e) => e.type === 'debutDeSession').length, 2);
    strictEqual(evenements.filter((e) => e.type === 'finDeCombat').length, 4);
  });

  it('limite connue : un client relancé en plein combat perd le combat', () => {
    // The case is **out of scope** — game windows are not supposed to close
    // mid-combat — and this test pins what the reader does instead of pretending
    // it is right. The relaunched client writes a new `log path=`, which pushes
    // the session bound past the opening of combat `1552052456`: the catch-up
    // loses it entirely and keeps only the rejoined one, at `k=1` instead of 2.
    const relecture = relire(lire(WAKFU_LOG_ALTERNANCE), EQUIPE);

    deepStrictEqual(
      relecture.combats.map((c) => `${c.fightId}/k=${c.clientsEngages}/${c.finsDeTour}`),
      ['1552052503/k=1/0'],
    );
    strictEqual(relecture.combatEnCours, null);
  });
});

describe('la fenêtre de session', () => {
  it('part du dernier `log path=`', () => {
    const contenu = [
      LOG_PATH,
      rejoint('1552042367', 'PJ1', 6, 'ENTITE827'),
      FRONTIERE,
      LOG_PATH,
      rejoint('1568042324', 'PJ2', 2, 'ENTITE279'),
    ].join('\n');

    const session = fenetreDeSession(analyser(contenu));
    strictEqual(session.bornee, true);
    strictEqual(session.evenements.length, 2);

    // A combat opened before the last client start is never in progress: it is
    // the bound, not the `[_FL_]`-without-`End fight` rule, that rules out the
    // false positive.
    deepStrictEqual(
      relire(contenu, []).combats.map((c) => c.fightId),
      ['1568042324'],
    );
  });

  it('se dit non bornée quand le fichier ne porte aucun `log path=`', () => {
    // The case of a rotated file, which can start mid-session.
    const session = fenetreDeSession(analyser(rejoint('1', 'PJ1', 6, 'ENTITE827')));
    strictEqual(session.bornee, false);
    strictEqual(session.evenements.length, 1);
  });
});

describe('le combat en cours', () => {
  it('un `[_FL_]` sans `End fight` est un combat à reprendre en marche', () => {
    const relecture = relire(
      [LOG_PATH, rejoint('1', 'PJ1', 6, 'ENTITE827'), FRONTIERE].join('\n'),
      ECAFLIP_SEUL,
    );

    partialDeepStrictEqual(relecture.combatEnCours, {
      fightId: '1',
      ouvert: true,
      tourCourant: 2,
    });
  });

  it('un marqueur d’arrêt écarte le combat fantôme', () => {
    // The real case: combat `1552042367` has its burst, its turns, then nothing —
    // the client was closed mid-combat, and without this rule it would stay
    // declared in progress for 4 h 39.
    const relecture = relire(
      [LOG_PATH, rejoint('1552042367', 'PJ1', 6, 'ENTITE827'), FRONTIERE, ARRET].join('\n'),
      ECAFLIP_SEUL,
    );

    partialDeepStrictEqual(relecture.combats[0], { fightId: '1552042367', ouvert: false });
    strictEqual(relecture.combatEnCours, null);
  });

  it('un combat plus ancien resté ouvert n’est pas celui qui se joue', () => {
    const relecture = relire(
      [
        LOG_PATH,
        rejoint('1', 'PJ1', 6, 'ENTITE827'),
        FRONTIERE,
        rejoint('2', 'PJ1', 6, 'ENTITE827'),
        FRONTIERE,
        finDeCombat('2'),
      ].join('\n'),
      ECAFLIP_SEUL,
    );

    deepStrictEqual(
      relecture.combats.map((c) => c.fightId),
      ['1', '2'],
    );
    strictEqual(relecture.combatEnCours, null);
  });

  it('les frontières vont au combat ouvert, et sont perdues s’il n’y en a aucun', () => {
    const relecture = relire([LOG_PATH, FRONTIERE, FRONTIERE].join('\n'), []);
    strictEqual(relecture.combats.length, 0);
    strictEqual(relecture.combatEnCours, null);
  });
});
