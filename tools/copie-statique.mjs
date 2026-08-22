/**
 * Copies the files `tsc` knows nothing about — the HTML and CSS of the three
 * surfaces, the eighteen class portraits, and the screenshots of the Prise en
 * main — from the repo to `dist/`, keeping the tree.
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

// The portraits are named by Classe key — `ecaflip.png` — and a surface asks for
// them at `../../icons/`, which is `dist/icons/`. They are not under `src/`
// because they are not code: the Fenêtre principale and the Roster will want the
// same folder.
cpSync(join(racine, 'icons'), join(racine, 'dist', 'icons'), { recursive: true, force: true });

// The Prise en main is a slideshow of screenshots, asked for at
// `../../prise-en-main/` the way the portraits are asked for at `../../icons/`.
// They are not data-URIs: the surfaces run under `img-src 'self'`, so they are
// files like any other.
//
// ⚠️ NOT a folder named `captures`: `.gitignore` reserves that name for raw Wakfu
// client logs, so screenshots put there are silently ignored, and a fresh clone
// builds without a single image.
cpSync(join(racine, 'prise-en-main'), join(racine, 'dist', 'prise-en-main'), {
  recursive: true,
  force: true,
});

// A missing screenshot leaves one step of the Prise en main blank, which is
// degraded and not fatal — so it warns rather than stopping the build. The list
// is the one `prise-en-main.ts` names, and the two must be changed together.
const CAPTURES = [
  'fiche-overlay.png',
  'combat-en-jeu.png',
  'strat-editeur.png',
  'roster.png',
  'demande-ajout.png',
  'reglages.png',
];
for (const nom of CAPTURES) {
  if (!existsSync(join(racine, 'prise-en-main', nom))) {
    console.warn(
      `prise-en-main/${nom} manque : l’étape correspondante de la Prise en main sera vide.`,
    );
  }
}

if (!existsSync(join(racine, 'dist', 'main', 'main.js'))) {
  console.error('dist/main/main.js manque : `tsc` n’a rien produit.');
  process.exit(1);
}
