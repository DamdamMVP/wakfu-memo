/**
 * Finding the `wakfu.log` to read — the derivation `VeilleWakfuLog` waits for.
 *
 * The path is never hard-coded, and there is not one single install: Steam and
 * the Ankama launcher can coexist on the same machine, and they do on the
 * author's. So both must be looked for, and arbitrated — on the most recently
 * modified `wakfu.log`, which is the install actually played (ADR `0008`: that
 * is the file we really open, and the chat log is not purged between sessions,
 * so its modification date is a poorer witness).
 *
 * What this module returns is exactly the second display condition of ADR
 * `0014`: **a readable `wakfu.log` is found**. The file, not the folder — and
 * nothing about freshness: a `wakfu.log` untouched for six hours is a player who
 * has not played for six hours, not a failure.
 */

import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** A platform's path functions: `path.posix` or `path.win32`. */
type Chemins = typeof path.posix;

export type SystemeDeFichiers = {
  /** A file's content, or `null` if it is missing or unreadable. */
  lire(chemin: string): string | null;
  /** The modification date in milliseconds, or `null` if the file is not readable. */
  dateDeModification(chemin: string): number | null;
};

export type Environnement = {
  readonly plateforme: 'linux' | 'win32' | 'darwin';
  readonly home: string;
  /** `%AppData%` under Windows. */
  readonly appData?: string | undefined;
};

export type Installation = 'steam' | 'launcher';

export type Candidat = {
  readonly installation: Installation;
  readonly dossier: string;
  readonly fichier: string;
  readonly dateDeModification: number;
};

export type DossierDeLogs = {
  readonly dossier: string;
  readonly fichier: string;
  /** What the Réglages screen shows: **détecté** or **désigné** (ADR `0014`). */
  readonly origine: 'detecte' | 'designe';
  readonly installation: Installation | null;
  readonly dateDeModification: number;
};

/** Wakfu's Steam `appId`, read in `zaapi.yml`. */
const APP_ID_STEAM = '215080';

/** Wakfu's `gameUid` at Zaap: `<racine>/gamesLogs/<gameUid>/logs/`. */
const GAME_UID = 'wakfu';

const NOM_DU_FICHIER = 'wakfu.log';

function chemins(env: Environnement): Chemins {
  return env.plateforme === 'win32' ? path.win32 : path.posix;
}

/**
 * The Steam roots to probe. The library itself is not guessed: it is read in
 * `libraryfolders.vdf`.
 */
function racinesSteam(env: Environnement): string[] {
  const p = chemins(env);
  if (env.plateforme === 'win32') {
    return [
      p.join('C:\\', 'Program Files (x86)', 'Steam'),
      p.join('C:\\', 'Program Files', 'Steam'),
    ];
  }
  return [
    p.join(env.home, '.steam', 'steam'),
    p.join(env.home, '.steam', 'root'),
    p.join(env.home, '.local', 'share', 'Steam'),
    p.join(env.home, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam'),
  ];
}

/**
 * Zaap's userData root, from which everything derives.
 *
 * ⚠️ `~/.config/zaap` is **measured** under Linux. `%AppData%\zaap` is
 * **expected** by the Electron rule (`app.getPath('userData')` =
 * `<appData>/<name>`, and `appData` = `%AppData%` Roaming on win32) but **never
 * measured**: it is the one unknown of the discovery, and it has its own ticket.
 */
function racineZaap(env: Environnement): string | null {
  const p = chemins(env);
  if (env.plateforme === 'win32') {
    return env.appData === undefined ? null : p.join(env.appData, 'zaap');
  }
  return p.join(env.home, '.config', 'zaap');
}

/**
 * The Steam libraries that declare Wakfu's `appId`.
 *
 * `libraryfolders.vdf` is VDF, not JSON. We need one thing from it — each
 * library's `path` and the list of its `apps` — so we cut on the `"path"` keys
 * and check whether the block that follows mentions the appId, rather than
 * writing a full VDF parser for two keys.
 */
function bibliothequesSteam(contenu: string): string[] {
  // Each library block runs from its own `"path"` to the next one's.
  const trouves = [...contenu.matchAll(/"path"\s*"([^"]+)"/g)];

  return trouves
    .filter((trouve, index) =>
      contenu
        .slice(trouve.index, trouves[index + 1]?.index ?? contenu.length)
        .includes(`"${APP_ID_STEAM}"`),
    )
    .map((trouve) => (trouve[1] ?? '').replace(/\\\\/g, '\\'));
}

function candidatSteam(fs: SystemeDeFichiers, env: Environnement): Candidat[] {
  const p = chemins(env);
  const candidats: Candidat[] = [];

  for (const racine of racinesSteam(env)) {
    const vdf = fs.lire(p.join(racine, 'steamapps', 'libraryfolders.vdf'));
    if (vdf === null) continue;

    for (const bibliotheque of bibliothequesSteam(vdf)) {
      const manifeste = fs.lire(
        p.join(bibliotheque, 'steamapps', `appmanifest_${APP_ID_STEAM}.acf`),
      );
      if (manifeste === null) continue;

      const installdir = /"installdir"\s*"([^"]+)"/.exec(manifeste)?.[1];
      if (installdir === undefined) continue;

      // Under Steam, `WAKFU_PREF_FILE_DIRECTORY` is `./preferences`, relative
      // to the install folder.
      const dossier = p.join(
        bibliotheque,
        'steamapps',
        'common',
        installdir,
        'preferences',
        'logs',
      );
      const candidat = enCandidat(fs, 'steam', dossier, p);
      if (candidat !== null) candidats.push(candidat);
    }
  }

  return candidats;
}

function candidatLauncher(fs: SystemeDeFichiers, env: Environnement): Candidat[] {
  const p = chemins(env);
  const racine = racineZaap(env);
  if (racine === null) return [];

  // Under the launcher, `WAKFU_PREF_FILE_DIRECTORY` is absolute and outside the
  // install. The install folder itself is read in the `location` key of
  // `repositories/production/<gameUid>/<canal>/release.json` — it only serves the
  // i18n bundles, which this lot does not need.
  const dossier = p.join(racine, 'gamesLogs', GAME_UID, 'logs');
  const candidat = enCandidat(fs, 'launcher', dossier, p);
  return candidat === null ? [] : [candidat];
}

function enCandidat(
  fs: SystemeDeFichiers,
  installation: Installation,
  dossier: string,
  p: Chemins,
): Candidat | null {
  const fichier = p.join(dossier, NOM_DU_FICHIER);
  const dateDeModification = fs.dateDeModification(fichier);
  if (dateDeModification === null) return null;
  return { installation, dossier, fichier, dateDeModification };
}

/** The readable `wakfu.log` found on the machine, all installs together. */
export function candidats(fs: SystemeDeFichiers, env: Environnement): Candidat[] {
  return [...candidatSteam(fs, env), ...candidatLauncher(fs, env)];
}

/**
 * The `wakfu.log` retained, or `null` — in which case the Overlay is not drawn at
 * all (ADR `0014`), and the Socle d'état unchecks its second line.
 *
 * A **dossier désigné** comes before everything else and **suspends the
 * arbitration**: nobody plays on two Wakfu, and an explicit choice replaces the
 * two-install rule. If it carries no readable `wakfu.log`, the condition is
 * false and we do not fall back to detection — otherwise the return to automatic
 * detection the Réglages offer would make no sense.
 */
export function dossierDeLogs(
  fs: SystemeDeFichiers,
  env: Environnement,
  options: { readonly dossierDesigne?: string | undefined } = {},
): DossierDeLogs | null {
  const p = chemins(env);

  if (options.dossierDesigne !== undefined) {
    const fichier = p.join(options.dossierDesigne, NOM_DU_FICHIER);
    const dateDeModification = fs.dateDeModification(fichier);
    if (dateDeModification === null) return null;
    return {
      dossier: options.dossierDesigne,
      fichier,
      origine: 'designe',
      installation: null,
      dateDeModification,
    };
  }

  // The arbitration, and it is reconsidered live: the player can change mode
  // between two sessions.
  const retenu = candidats(fs, env).reduce<Candidat | null>(
    (meilleur, candidat) =>
      meilleur === null || candidat.dateDeModification > meilleur.dateDeModification
        ? candidat
        : meilleur,
    null,
  );

  return retenu === null ? null : { ...retenu, origine: 'detecte' };
}

/** The real file system. Read-only, like everything the app does. */
export function systemeDeFichiersReel(): SystemeDeFichiers {
  return {
    lire(chemin) {
      try {
        return readFileSync(chemin, 'utf8');
      } catch {
        return null;
      }
    },
    dateDeModification(chemin) {
      try {
        return statSync(chemin).mtimeMs;
      } catch {
        return null;
      }
    },
  };
}

/** The environment of the machine the app runs on. */
export function environnementReel(): Environnement {
  return {
    plateforme:
      process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux',
    home: homedir(),
    appData: process.env['APPDATA'],
  };
}
