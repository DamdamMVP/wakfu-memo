/**
 * Writes `compile_commands.json` so a C language server can open
 * `tools/essai-titre.c` without a wall of errors.
 *
 * The file is compiled by `src/main/surjeu-titre.test.ts` with two include
 * paths — the patched library sources under `node_modules`, and our libuv stub.
 * An editor knows neither, so it must be told. Absolute paths, hence generated
 * per machine and never committed.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = join(racine, 'node_modules', 'electron-overlay-window', 'src', 'lib');
const bouchons = join(racine, 'tools', 'entetes-bouchons');
const source = join(racine, 'tools', 'essai-titre.c');

if (!existsSync(lib)) {
  console.warn('[commandes] electron-overlay-window absent : rien à décrire.');
  process.exit(0);
}

const commandes = [
  {
    directory: racine,
    file: source,
    arguments: ['gcc', '-std=c99', '-I', bouchons, '-I', lib, '-c', source],
  },
];

writeFileSync(join(racine, 'compile_commands.json'), `${JSON.stringify(commandes, null, 2)}\n`);
console.info('[commandes] compile_commands.json écrit.');
