import { deepStrictEqual, partialDeepStrictEqual, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evenementsDuLog, WAKFU_LOG } from '../echantillons/echantillons.ts';
import { analyserLigne, analyserMessage } from './tokenizer.ts';

const ligne = (message: string): string =>
  ` INFO 15:55:14,118 [AWT-EventQueue-0] (faw:1405) - ${message}`;

const compter = (type: string): number =>
  evenementsDuLog(WAKFU_LOG).filter((evenement) => evenement.type === type).length;

describe('[_FL_] — le roster du combat', () => {
  it('rend l’identité, le camp et la Classe', () => {
    deepStrictEqual(
      analyserLigne(
        ligne(
          '[_FL_] fightId=1552042365 Damdamisback breed : 19 [4768528] isControlledByAI=false obstacleId : -1 join the fight at {Point3 : (-2, -12, 0)}',
        ),
      ),
      {
        type: 'combattant',
        fightId: '1552042365',
        nom: 'Damdamisback',
        breed: 19,
        classe: 'huppermage',
        idEntite: '4768528',
        controleParIA: false,
        obstacleId: -1,
        position: '-2, -12, 0',
      },
    );
  });

  it('accepte un nom à espaces, et rend `null` comme Classe pour un monstre', () => {
    partialDeepStrictEqual(
      analyserLigne(
        ligne(
          '[_FL_] fightId=1552042365 Sac à patates breed : 2335 [-1706442044709728] isControlledByAI=true obstacleId : -1 join the fight at {Point3 : (0, -14, 0)}',
        ),
      ),
      {
        nom: 'Sac à patates',
        breed: 2335,
        classe: null,
        idEntite: '-1706442044709728',
        controleParIA: true,
      },
    );
  });

  it('accepte les deux formes d’ID d’entité : le vrai log et les échantillons anonymisés', () => {
    // A regex accepting digits only fails on the fixtures, and a regex written
    // against the fixtures is too lax.
    for (const idEntite of ['4768528', '-1706442044709728', 'ENTITE874', 'ENTITE']) {
      partialDeepStrictEqual(
        analyserLigne(
          ligne(
            `[_FL_] fightId=1568042324 PJ2 breed : 2 [${idEntite}] isControlledByAI=false obstacleId : -1 join the fight at {Point3 : (122, 8, 0)}`,
          ),
        ),
        { idEntite },
      );
    }
  });

  it('une Invocation porte un obstacleId positif et se déclare contrôlée par l’IA', () => {
    partialDeepStrictEqual(
      analyserLigne(
        ligne(
          '[_FL_] fightId=1568041546 Gobgob breed : 1620 [ENTITE] isControlledByAI=true obstacleId : 1 join the fight at {Point3 : (120, 8, 0)}',
        ),
      ),
      { nom: 'Gobgob', controleParIA: true, obstacleId: 1, classe: null },
    );
  });

  it('le `breed` 17 — le Désincarné — n’est pas une Classe', () => {
    partialDeepStrictEqual(
      analyserLigne(
        ligne(
          '[_FL_] fightId=1568042324 PJ2 breed : 17 [ENTITE] isControlledByAI=false obstacleId : -1',
        ),
      ),
      { classe: null },
    );
  });
});

describe('les bornes', () => {
  it('la fin de combat porte son `fightId`', () => {
    deepStrictEqual(
      analyserLigne(
        ' INFO 22:54:36,128 [AWT-EventQueue-0] (aWk:91) - [FIGHT] End fight with id 1552032575',
      ),
      { type: 'finDeCombat', fightId: '1552032575' },
    );
  });

  it('`log path=` borne la session', () => {
    deepStrictEqual(
      analyserLigne(
        ' INFO 15:54:39,381 [main] (com.ankamagames.wakfu.client.WakfuClient:213) - log path=/home/USER/.config/zaap/gamesLogs/wakfu',
      ),
      { type: 'debutDeSession', racine: '/home/USER/.config/zaap/gamesLogs/wakfu' },
    );
  });

  it('un arrêt du client est un marqueur d’arrêt', () => {
    deepStrictEqual(
      analyserLigne(ligne('Sending DisconnectionMessage to Servers. Reason : {UI Closed}')),
      { type: 'marqueurArret', raison: 'UI Closed' },
    );
    deepStrictEqual(analyserLigne(ligne('Stopping cGz...')), {
      type: 'marqueurArret',
      raison: 'Stopping cGz',
    });
  });

  it('une déconnexion `{Dispatch}` n’est pas un arrêt', () => {
    // `revive2` carries two, one per client opening: taking those for shutdowns
    // would close a combat very much alive.
    strictEqual(
      analyserLigne(ligne('Sending DisconnectionMessage to Servers. Reason : {Dispatch}')),
      null,
    );
  });
});

describe('la Frontière de tour', () => {
  it('s’accorde au singulier et au pluriel', () => {
    deepStrictEqual(
      analyserMessage('[Information (combat)] 0 seconde reportée pour le tour suivant.'),
      {
        type: 'frontiereDeTour',
        secondes: 0,
      },
    );
    deepStrictEqual(
      analyserMessage('[Information (combat)] 54 secondes reportées pour le tour suivant.'),
      { type: 'frontiereDeTour', secondes: 54 },
    );
  });
});

describe('les Transitions', () => {
  it('les quatre formes, dont celle à deux points', () => {
    deepStrictEqual(analyserMessage('[Information (combat)] PJ3 est KO !'), {
      type: 'transition',
      forme: 'ko',
      nom: 'PJ3',
    });
    deepStrictEqual(analyserMessage('[Information (combat)] PJ3: est réanimé'), {
      type: 'transition',
      forme: 'reanime',
      nom: 'PJ3',
    });
    deepStrictEqual(analyserMessage('[Information (combat)] PJ3 est ressuscité !'), {
      type: 'transition',
      forme: 'ressuscite',
      nom: 'PJ3',
    });
    deepStrictEqual(analyserMessage('[Information (combat)] Moogrron est hors-combat !'), {
      type: 'transition',
      forme: 'horsCombat',
      nom: 'Moogrron',
    });
  });
});

describe('ce que le tokenizer refuse', () => {
  it('un canal hors liste blanche, même quand il nomme des personnages', () => {
    // The concrete justification of the whitelist: a parser filtering by
    // blacklist lets this one through and believes it sees two actors.
    strictEqual(analyserMessage("[Messages d'erreur] En attente de : PJ2, PJ1"), null);
    strictEqual(analyserMessage('[Information (jeu)] Vous avez défié amicalement PJ2'), null);
  });

  it('une ligne dont le préfixe a été détruit à la couture des blocs', () => {
    // The real line of `revive2`, whose ` WARN` head was overwritten.
    strictEqual(
      analyserLigne(
        'N 15:54:51,726 [Initialization-Tasks-0] (ME:157) - Unable to get value for key content.15.32134',
      ),
      null,
    );
  });

  it('les traces Java multi-lignes, qui ne portent pas d’horodatage', () => {
    strictEqual(analyserLigne('java.lang.Exception'), null);
    strictEqual(analyserLigne('\tat aqJ.a(SourceFile:72)'), null);
    strictEqual(analyserLigne('amO: Unable to get craftHandler of user'), null);
    strictEqual(analyserLigne(''), null);
  });

  it('une ligne en CRLF s’analyse quand même', () => {
    // The client writes CRLF under Windows, and no sample carries any.
    deepStrictEqual(
      analyserLigne(
        ' INFO 15:55:35,631 [AWT-EventQueue-0] (aPV:174) - [Information (combat)] 61 secondes reportées pour le tour suivant.\r',
      ),
      { type: 'frontiereDeTour', secondes: 61 },
    );
  });

  it('les en-têtes de commentaires des échantillons', () => {
    strictEqual(analyserLigne('#  1. UN TOMBÉ N’ÉMET PLUS DE FRONTIÈRE. PJ3 est KO !'), null);
  });

  it('les en-têtes ne gonflent aucun compte sur l’échantillon réel', () => {
    // A naive `grep -c 'End fight'` counts 3 in `revive2`, because of a comment
    // line. There are 2 — one per client.
    strictEqual(compter('finDeCombat'), 2);
    strictEqual(compter('debutDeSession'), 1);
    strictEqual(compter('frontiereDeTour'), 6);
    strictEqual(compter('combattant'), 8);
  });
});
