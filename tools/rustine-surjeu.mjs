/**
 * Applies the `electron-overlay-window` patch and rebuilds the native module.
 *
 * WHY the patch (`patches/electron-overlay-window.patch`), twice over:
 *
 * 1. The title. The library looked for the game window by strict equality, but
 *    the Wakfu client names its window after the connected character —
 *    "S'Alu-Ca'Va - WAKFU" — so equality only held before login, and never in
 *    multi-account. The patch accepts equality, or the suffix preceded by " - ".
 * 2. Click-through. `setIgnoreMouseEvents` is a no-op under Linux/X11 since
 *    Electron 43 (electron#52456): the input region stays full and a locked
 *    Overlay swallows every click meant for the game. Reproduced on 42.9.3 too,
 *    so there is no way out through the version. The patch exposes
 *    `setInputRegion`, which lays the region down by hand through xcb-shape.
 *
 * WHY REBUILD. The binary shipped by the library carries the old comparison.
 * `node-gyp-build` prefers `build/Release/` over `prebuilds/`, so a local build
 * takes precedence without erasing anything.
 *
 * This needs a toolchain. On Fedora:
 * `sudo dnf install gcc-c++ make python3 libxcb-devel` — `g++` is used for
 * linking even though the sources are C. On Windows, the Visual Studio Build
 * Tools.
 *
 * Packaging V1 will have to ship this binary for every platform — a player has
 * no compiler. The library already does it for itself with `prebuildify`; the
 * patch will need the same.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const paquet = join(racine, 'node_modules', 'electron-overlay-window');
const rustine = join(racine, 'patches', 'electron-overlay-window.patch');
const marque = 'ow_set_input_region';
const entete = join(paquet, 'src', 'lib', 'overlay_window.h');
const construit = join(paquet, 'build', 'Release');

if (!existsSync(paquet)) {
  console.error(`[rustine] ${paquet} est absent : lancez d’abord « npm install ».`);
  process.exit(1);
}

const dejaRustine = readFileSync(entete, 'utf8').includes(marque);

if (!dejaRustine) {
  try {
    // `--directory`, and from the repo root. Run from a subdirectory, `git
    // apply` resolves the patch paths against the repo root, silently ignores
    // those falling outside the current directory, and exits successfully: the
    // patch looked applied without being applied.
    execFileSync(
      'git',
      ['apply', '-p1', '--directory=node_modules/electron-overlay-window', rustine],
      { cwd: racine, stdio: 'pipe' },
    );
  } catch (erreur) {
    console.error('[rustine] la rustine ne s’applique pas — la bibliothèque a sans doute changé.');
    console.error(String(erreur.stderr ?? erreur.message).trim());
    console.error(`Relire ${rustine} contre ${join(paquet, 'src', 'lib')}.`);
    process.exit(1);
  }

  // We do not trust the exit code: we read the source back.
  if (!readFileSync(entete, 'utf8').includes(marque)) {
    console.error(`[rustine] git apply n’a rien signalé, mais ${marque} est absent de l’en-tête.`);
    process.exit(1);
  }
  console.log('[rustine] titre par suffixe + traversée des clics par région d’entrée.');
}

const binaire = existsSync(construit)
  ? readdirSync(construit)
      .filter((f) => f.endsWith('.node'))
      .map((f) => join(construit, f))[0]
  : undefined;

// A binary already built after the patch has nothing to redo.
if (binaire && statSync(binaire).mtimeMs > statSync(entete).mtimeMs) {
  console.log(`[rustine] module natif déjà à jour (${binaire.replace(racine, '.')}).`);
  process.exit(0);
}

const nodeGyp = join(
  racine,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'node-gyp.cmd' : 'node-gyp',
);
try {
  execFileSync(nodeGyp, ['rebuild'], { cwd: paquet, stdio: 'inherit' });
} catch {
  console.error(
    '\n[rustine] la compilation du module natif a échoué. Il faut de quoi bâtir :\n' +
      '  Fedora : sudo dnf install gcc-c++ make python3 libxcb-devel\n' +
      '  Debian : sudo apt install g++ make python3 libxcb1-dev\n' +
      '  Windows: Visual Studio Build Tools\n' +
      '(« g++: No such file or directory » à l’édition de liens = il manque gcc-c++,\n' +
      ' même si les sources sont du C.)\n' +
      'Sans ce module, l’app ne trouvera la fenêtre du jeu que si son titre vaut\n' +
      'exactement « WAKFU » — donc jamais une fois le personnage connecté.',
  );
  process.exit(1);
}
console.log('[rustine] module natif recompilé.');
