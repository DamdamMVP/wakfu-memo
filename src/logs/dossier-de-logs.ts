/**
 * Finding the log file to read — the derivation `VeilleWakfuLog` waits for.
 *
 * Two arbitrations, and they are not the same question:
 *
 *  1. **Which folder.** There is not one single install: Steam and the Ankama
 *     launcher can coexist on the same machine, and they do on the author's. The
 *     most recently written one is the install actually being played.
 *  2. **Which file inside it.** ⚠️ This one is new, and it corrects the letter
 *     of ADR `0008`. Wakfu does not keep one file: it rotates, and in
 *     multi-account **two of them are written at the same second** — measured on
 *     2026-08-22, `wakfu.log` and `wakfu.log.1` both last written at 21:48:43,
 *     each holding a complete and identical copy of the fight. The name
 *     `wakfu.log` therefore does not mean "the current file", it means "the
 *     first one taken". Following it blindly loses every fight that started
 *     before the rotation that created it.
 *
 * What this module returns is exactly the second display condition of ADR
 * `0014`: **a readable log file is found**. The file, not the folder — and
 * nothing about freshness *of the retained file*: one untouched for six hours is
 * a player who has not played for six hours, not a failure. Freshness only ever
 * serves to compare **siblings**, which is another question entirely.
 */

import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { unCombatEstOuvert } from './session.ts';

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

/**
 * `wakfu.log`, then the rotated ones beside it. ADR `0008` says two exist; we
 * probe a couple more, at the cost of two `stat` that fail.
 *
 * ⚠️ The suffix orders **nothing**. `.1` is not "older than `wakfu.log`": on the
 * author's machine it was the one being written while `wakfu.log` had just been
 * created empty of the fight in progress. Only the modification date and the
 * content decide.
 */
const SUFFIXES = ['', '.1', '.2', '.3', '.4'] as const;

/**
 * How far behind the freshest sibling a file may be and still count as being
 * written.
 *
 * The one arbitrary number of this module, and it is here to keep a **dead file
 * from being believed**: a rotated file cut mid-fight declares that fight open
 * for ever, so "it holds an open fight" is only worth anything on a file
 * somebody is still writing to. Measured on the author's machine at the moment
 * the question arose: the two live files were at the **same second**, and the
 * dead one twelve minutes behind. A running client writes far more often than
 * this — the fight lines alone, and the chat channels besides.
 */
const VIVANT_MS = 120_000;

/** One log file of a folder: what a `stat` says of it. */
export type FichierDeLogs = {
  readonly fichier: string;
  readonly dateDeModification: number;
};

/**
 * The readable log files of one folder, freshest first. Empty when the folder
 * holds none — which is what makes the folder itself not a candidate.
 */
export function fichiersDeLogs(
  fs: SystemeDeFichiers,
  dossier: string,
  p: Chemins,
): FichierDeLogs[] {
  const trouves: FichierDeLogs[] = [];
  for (const suffixe of SUFFIXES) {
    const fichier = p.join(dossier, `${NOM_DU_FICHIER}${suffixe}`);
    const dateDeModification = fs.dateDeModification(fichier);
    if (dateDeModification !== null) trouves.push({ fichier, dateDeModification });
  }
  return trouves.sort((a, b) => b.dateDeModification - a.dateDeModification);
}

/**
 * Which of a folder's log files to follow.
 *
 * The rule, in the order it is applied:
 *
 *  1. **Only the files being written are considered.** A file nobody writes to
 *     any more cannot hold the fight being played, whatever it claims.
 *  2. **Among those, one holding an open combat wins.** That is the whole point:
 *     at the second a rotation happens, the brand new file is the freshest and
 *     the most ignorant — the fight started before it existed.
 *  3. **Otherwise, the freshest.** Out of combat there is nothing to preserve,
 *     and the freshest is where the next fight will be written.
 *
 * Reading is done on the live files only, so the big rotated ones are never
 * opened — they are ruled out on their date.
 */
export function fichierARetenir(
  fs: SystemeDeFichiers,
  fichiers: readonly FichierDeLogs[],
): FichierDeLogs | null {
  const premier = fichiers[0];
  if (premier === undefined) return null;

  const vivants = fichiers.filter(
    (fichier) => premier.dateDeModification - fichier.dateDeModification <= VIVANT_MS,
  );
  // Already sorted freshest first, so the first match is also the freshest.
  const enCombat = vivants.find((fichier) => {
    const contenu = fs.lire(fichier.fichier);
    return contenu !== null && unCombatEstOuvert(contenu);
  });
  return enCombat ?? premier;
}

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

/**
 * A folder becomes a candidate through its **freshest** log file, `wakfu.log` or
 * a rotated one. Judging it on `wakfu.log` alone would drop an install whose
 * current file happens to be `wakfu.log.1`, and would compare a played install
 * against a stale name.
 *
 * Which file is actually followed is settled later, on one folder only: it costs
 * a read, and there is no reason to pay it for the install nobody is playing.
 */
function enCandidat(
  fs: SystemeDeFichiers,
  installation: Installation,
  dossier: string,
  p: Chemins,
): Candidat | null {
  const plusFrais = fichiersDeLogs(fs, dossier, p)[0];
  if (plusFrais === undefined) return null;
  return {
    installation,
    dossier,
    fichier: plusFrais.fichier,
    dateDeModification: plusFrais.dateDeModification,
  };
}

/** The readable log files found on the machine, all installs together. */
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
    const retenu = fichierARetenir(fs, fichiersDeLogs(fs, options.dossierDesigne, p));
    if (retenu === null) return null;
    return {
      dossier: options.dossierDesigne,
      fichier: retenu.fichier,
      origine: 'designe',
      installation: null,
      dateDeModification: retenu.dateDeModification,
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

  if (retenu === null) return null;
  // The folder is settled; now, and only now, which of its files.
  const fichier = fichierARetenir(fs, fichiersDeLogs(fs, retenu.dossier, p));
  if (fichier === null) return null;
  return { ...retenu, ...fichier, origine: 'detecte' };
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
