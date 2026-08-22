/**
 * The title matching rule lives in the patched C
 * (`patches/electron-overlay-window.patch`): this test compiles and runs it. It
 * skips itself where a compiler or the patch is missing, so the suite stays
 * green on a machine with no build toolchain yet.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const lib = join(racine, 'node_modules', 'electron-overlay-window', 'src', 'lib');
const entete = join(lib, 'overlay_window.h');
const bouchons = join(racine, 'tools', 'entetes-bouchons');
const source = join(racine, 'tools', 'essai-titre.c');

const compilateurPresent = (): boolean => {
  try {
    execFileSync('gcc', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

test('la fenêtre du jeu se reconnaît au suffixe « - WAKFU »', (t) => {
  if (!existsSync(entete) || !readFileSync(entete, 'utf8').includes('ow_title_matches')) {
    t.skip('la rustine n’est pas appliquée (npm run rustine)');
    return;
  }
  if (!compilateurPresent()) {
    t.skip('pas de compilateur ici');
    return;
  }

  const dossier = mkdtempSync(join(tmpdir(), 'wakfu-memo-titre-'));
  try {
    const binaire = join(dossier, 'essai-titre');
    // `tools/entetes-bouchons` stands in for libuv, which the patched header
    // includes but the rule under test never touches. Without it the compile
    // would need the Node headers node-gyp caches — a path that only exists
    // after a native build, and that no editor can resolve.
    execFileSync('gcc', ['-std=c99', '-I', bouchons, '-I', lib, source, '-o', binaire]);
    const sortie = execFileSync(binaire, { encoding: 'utf8' });
    if (sortie.trim() !== 'OK') throw new Error(sortie);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});
