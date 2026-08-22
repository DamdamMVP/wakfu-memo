import {
  deepStrictEqual,
  notStrictEqual,
  partialDeepStrictEqual,
  strictEqual,
} from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  candidats,
  dossierDeLogs,
  type Environnement,
  type SystemeDeFichiers,
} from './dossier-de-logs.ts';

const LINUX: Environnement = { plateforme: 'linux', home: '/home/damdam' };
const WINDOWS: Environnement = {
  plateforme: 'win32',
  home: 'C:\\Users\\damdam',
  appData: 'C:\\Users\\damdam\\AppData\\Roaming',
};

/** A fake file system: path → content, and path → modification date. */
function faux(
  fichiers: Record<string, string>,
  dates: Record<string, number> = {},
): SystemeDeFichiers {
  return {
    lire: (chemin) => fichiers[chemin] ?? null,
    dateDeModification: (chemin) => dates[chemin] ?? (chemin in fichiers ? 0 : null),
  };
}

const LIBRARYFOLDERS = `"libraryfolders"
{
	"0"
	{
		"path"		"/home/damdam/.local/share/Steam"
		"apps"
		{
			"570"		"12345"
		}
	}
	"1"
	{
		"path"		"/mnt/games/SteamLibrary"
		"apps"
		{
			"215080"		"6789012"
		}
	}
}`;

const APPMANIFEST = `"AppState"
{
	"appid"		"215080"
	"installdir"		"Wakfu"
}`;

const LOGS_STEAM = '/mnt/games/SteamLibrary/steamapps/common/Wakfu/preferences/logs';
const LOGS_LAUNCHER = '/home/damdam/.config/zaap/gamesLogs/wakfu/logs';

const STEAM = {
  '/home/damdam/.steam/steam/steamapps/libraryfolders.vdf': LIBRARYFOLDERS,
  '/mnt/games/SteamLibrary/steamapps/appmanifest_215080.acf': APPMANIFEST,
  [`${LOGS_STEAM}/wakfu.log`]: '',
};

const LAUNCHER = { [`${LOGS_LAUNCHER}/wakfu.log`]: '' };

describe('la découverte du dossier de logs', () => {
  it('Steam : la bibliothèque se lit dans `libraryfolders.vdf`, jamais devinée', () => {
    deepStrictEqual(candidats(faux(STEAM), LINUX), [
      {
        installation: 'steam',
        dossier: LOGS_STEAM,
        fichier: `${LOGS_STEAM}/wakfu.log`,
        dateDeModification: 0,
      },
    ]);
  });

  it('Steam : une bibliothèque qui ne déclare pas l’`appId` de Wakfu est ignorée', () => {
    const sansWakfu = {
      '/home/damdam/.steam/steam/steamapps/libraryfolders.vdf': LIBRARYFOLDERS,
      '/home/damdam/.local/share/Steam/steamapps/appmanifest_215080.acf': APPMANIFEST,
      '/home/damdam/.local/share/Steam/steamapps/common/Wakfu/preferences/logs/wakfu.log': '',
    };
    deepStrictEqual(candidats(faux(sansWakfu), LINUX), []);
  });

  it('launcher : tout dérive de la racine userData de Zaap', () => {
    deepStrictEqual(candidats(faux(LAUNCHER), LINUX), [
      {
        installation: 'launcher',
        dossier: LOGS_LAUNCHER,
        fichier: `${LOGS_LAUNCHER}/wakfu.log`,
        dateDeModification: 0,
      },
    ]);
  });

  it('launcher sous Windows : `%AppData%\\zaap`', () => {
    const fichier = 'C:\\Users\\damdam\\AppData\\Roaming\\zaap\\gamesLogs\\wakfu\\logs\\wakfu.log';
    partialDeepStrictEqual(candidats(faux({ [fichier]: '' }), WINDOWS), [
      { installation: 'launcher', fichier },
    ]);
  });

  it('les deux modes coexistent : le `wakfu.log` le plus récent gagne', () => {
    // That is the case on the author's machine. The arbitration reads `wakfu.log`
    // and not `wakfu_chat.log` (ADR `0008`): that is the file we really open, and
    // the chat log is not purged between sessions.
    const fs = faux(
      { ...STEAM, ...LAUNCHER },
      { [`${LOGS_STEAM}/wakfu.log`]: 1000, [`${LOGS_LAUNCHER}/wakfu.log`]: 2000 },
    );

    strictEqual(candidats(fs, LINUX).length, 2);
    partialDeepStrictEqual(dossierDeLogs(fs, LINUX), {
      installation: 'launcher',
      origine: 'detecte',
      dateDeModification: 2000,
    });
  });

  it('le départage se reconsidère : le joueur peut changer de mode', () => {
    const fs = faux(
      { ...STEAM, ...LAUNCHER },
      { [`${LOGS_STEAM}/wakfu.log`]: 3000, [`${LOGS_LAUNCHER}/wakfu.log`]: 2000 },
    );
    partialDeepStrictEqual(dossierDeLogs(fs, LINUX), { installation: 'steam' });
  });

  it('un dossier désigné passe devant tout et suspend le départage', () => {
    const fs = faux({ ...STEAM, ...LAUNCHER, '/ailleurs/logs/wakfu.log': '' });

    deepStrictEqual(dossierDeLogs(fs, LINUX, { dossierDesigne: '/ailleurs/logs' }), {
      dossier: '/ailleurs/logs',
      fichier: '/ailleurs/logs/wakfu.log',
      origine: 'designe',
      installation: null,
      dateDeModification: 0,
    });
  });

  it('un dossier désigné sans `wakfu.log` lisible ne retombe pas sur la détection', () => {
    // Otherwise the return to automatic detection the Réglages offer would make
    // no sense: whoever designated the wrong folder would have no way out, and
    // the Socle d'état would lie about what produced the folder.
    const fs = faux({ ...STEAM, ...LAUNCHER });
    strictEqual(dossierDeLogs(fs, LINUX, { dossierDesigne: '/ailleurs/logs' }), null);
  });

  it('aucun `wakfu.log` trouvé : l’Overlay ne se dessinera pas du tout', () => {
    // The second display condition of ADR `0014`, and it swallows its two
    // neighbours: folder found but empty, folder found but unreadable.
    strictEqual(dossierDeLogs(faux({}), LINUX), null);
    strictEqual(
      dossierDeLogs(
        faux({ '/home/damdam/.steam/steam/steamapps/libraryfolders.vdf': LIBRARYFOLDERS }),
        LINUX,
      ),
      null,
    );
  });

  it('ne dit rien de la fraîcheur : un log vieux de six heures est trouvé', () => {
    // A `wakfu.log` untouched for six hours is a player who has not played for
    // six hours, not a failure.
    const fs = faux(LAUNCHER, {
      [`${LOGS_LAUNCHER}/wakfu.log`]: Date.now() - 6 * 3600 * 1000,
    });
    notStrictEqual(dossierDeLogs(fs, LINUX), null);
  });
});

/* ============================ le choix du fichier dans un dossier ========= */

/**
 * Les trois fichiers relevés sur la machine de l'auteur le 22 août 2026, à la
 * minute où le bogue s'est produit :
 *
 *  - `wakfu.log` venait d'être créé et ne portait PAS le combat en cours ;
 *  - `wakfu.log.1` était écrit à la même seconde et le portait en entier ;
 *  - `wakfu.log.2`, mort depuis douze minutes, déclarait encore ouvert le combat
 *    que la rotation avait coupé en deux.
 */
const RAFALE = (fightId: string, nom: string) =>
  ` INFO 21:36:34,283 [AWT-EventQueue-0] (faw:1405) - [_FL_] fightId=${fightId} ${nom} breed : 3 [10910227] isControlledByAI=false obstacleId : -1 join the fight at {Point3 : (9, 1, 1)}\n`;
const FIN = (fightId: string) =>
  ` INFO 21:37:49,152 [AWT-EventQueue-0] (aWF:91) - [FIGHT] End fight with id ${fightId}\n`;
const BAVARDAGE =
  ' INFO 21:48:43,000 [AWT-EventQueue-0] (aPV:174) - [Communauté (FR)] Siphala : bonjour\n';

describe('quel fichier suivre dans un dossier', () => {
  const D = LOGS_LAUNCHER;
  const suivi = (fichiers: Record<string, string>, dates: Record<string, number>) =>
    dossierDeLogs(faux(fichiers, dates), LINUX, { dossierDesigne: D })?.fichier ?? null;

  it('le combat en cours est dans `wakfu.log.1` : c’est lui qu’on suit, pas `wakfu.log`', () => {
    // Le bogue exact : le fichier le plus frais est le plus ignorant, parce que
    // le combat avait commencé onze secondes avant qu'il n'existe.
    strictEqual(
      suivi(
        {
          [`${D}/wakfu.log`]: BAVARDAGE,
          [`${D}/wakfu.log.1`]: RAFALE('1552058722', 'Damdamnesique') + BAVARDAGE,
        },
        { [`${D}/wakfu.log`]: 2_000, [`${D}/wakfu.log.1`]: 1_000 },
      ),
      `${D}/wakfu.log.1`,
    );
  });

  it('⚠️ un fichier mort qui déclare un combat ouvert n’est pas cru', () => {
    // `wakfu.log.2` a été coupé en plein combat par la rotation : sa fin de
    // combat est partie ailleurs, donc il dira « combat ouvert » pour toujours.
    // Mesuré : douze minutes après sa dernière écriture, il le disait encore.
    strictEqual(
      suivi(
        {
          [`${D}/wakfu.log`]: BAVARDAGE,
          [`${D}/wakfu.log.2`]: RAFALE('1552058722', 'Damdamnesique'),
        },
        { [`${D}/wakfu.log`]: 900_000, [`${D}/wakfu.log.2`]: 180_000 },
      ),
      `${D}/wakfu.log`,
    );
  });

  it('hors combat, le plus frais gagne — c’est là que le prochain s’écrira', () => {
    strictEqual(
      suivi(
        { [`${D}/wakfu.log`]: BAVARDAGE, [`${D}/wakfu.log.1`]: RAFALE('1', 'X') + FIN('1') },
        { [`${D}/wakfu.log`]: 2_000, [`${D}/wakfu.log.1`]: 1_000 },
      ),
      `${D}/wakfu.log`,
    );
  });

  it('les deux vivants portent le même combat : le plus frais suffit', () => {
    // Vérifié sur la machine : les deux fichiers vivants donnent le même tour,
    // la même Liaison, le même `k`. Il n’y a donc rien à fusionner.
    const rafale = RAFALE('1552058845', 'Damdamnesique');
    strictEqual(
      suivi(
        { [`${D}/wakfu.log`]: rafale, [`${D}/wakfu.log.1`]: rafale },
        { [`${D}/wakfu.log`]: 2_000, [`${D}/wakfu.log.1`]: 1_999 },
      ),
      `${D}/wakfu.log`,
    );
  });

  it('un dossier qui n’a QUE des fichiers tournés reste un dossier de logs', () => {
    // Avant, l'absence du nom exact `wakfu.log` faisait disparaître la condition
    // d'affichage, donc l'Overlay tout entier.
    strictEqual(
      suivi({ [`${D}/wakfu.log.1`]: BAVARDAGE }, { [`${D}/wakfu.log.1`]: 1_000 }),
      `${D}/wakfu.log.1`,
    );
  });

  it('le suffixe n’ordonne rien : `.1` peut être le fichier vivant', () => {
    strictEqual(
      suivi(
        { [`${D}/wakfu.log`]: BAVARDAGE, [`${D}/wakfu.log.1`]: BAVARDAGE },
        { [`${D}/wakfu.log`]: 1_000, [`${D}/wakfu.log.1`]: 2_000 },
      ),
      `${D}/wakfu.log.1`,
    );
  });

  it('le départage entre installations se lit aussi sur les fichiers tournés', () => {
    const fichiers = { ...STEAM, [`${LOGS_LAUNCHER}/wakfu.log.1`]: BAVARDAGE };
    const retenu = dossierDeLogs(
      faux(fichiers, {
        [`${LOGS_STEAM}/wakfu.log`]: 1_000,
        [`${LOGS_LAUNCHER}/wakfu.log.1`]: 2_000,
      }),
      LINUX,
    );
    strictEqual(retenu?.fichier, `${LOGS_LAUNCHER}/wakfu.log.1`);
    strictEqual(retenu?.installation, 'launcher');
  });
});
