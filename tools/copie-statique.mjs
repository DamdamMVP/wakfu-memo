/**
 * Copies the files `tsc` knows nothing about — the HTML and CSS of the three
 * surfaces — from `src/` to `dist/`, keeping the tree.
 */
import { cpSync, existsSync, globSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const relatif of globSync('src/surfaces/**/*.{html,css}', { cwd: racine })) {
  const source = join(racine, relatif);
  const cible = join(racine, relatif.replace(/^src[/\\]/, 'dist/'));
  cpSync(source, cible, { recursive: false, force: true });
}

if (!existsSync(join(racine, 'dist', 'main', 'main.js'))) {
  console.error('dist/main/main.js manque : `tsc` n’a rien produit.');
  process.exit(1);
}
