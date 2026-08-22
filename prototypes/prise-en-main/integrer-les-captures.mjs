/**
 * Embarque `img/*.png` dans `index.html`, en data-URI.
 *
 * Pourquoi : un navigateur en bac à sable (Zen, Firefox, Chrome en Flatpak)
 * ouvert par le portail ne reçoit l'accès qu'au FICHIER qu'on lui désigne. Le
 * dossier `img/` voisin lui est invisible, et toutes les captures échouent.
 * Un seul fichier autonome, comme les autres prototypes du dépôt.
 *
 * Se rejoue après chaque nouvelle capture :  node integrer-les-captures.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const page = join(ici, 'index.html');

const captures = {};
let total = 0;
for (const nom of readdirSync(join(ici, 'img')).sort()) {
  if (!nom.endsWith('.png')) continue;
  const octets = readFileSync(join(ici, 'img', nom));
  captures[nom] = `data:image/png;base64,${octets.toString('base64')}`;
  total += octets.length;
  console.log(`  ${nom.padEnd(34)} ${String(Math.round(octets.length / 1024)).padStart(4)} Ko`);
}

const bloc = `<!-- CAPTURES-DEBUT -->\n<script>\n/* Généré par \`integrer-les-captures.mjs\` — ne pas éditer à la main. */\nglobalThis.CAPTURES = ${JSON.stringify(captures)};\n</script>\n<!-- CAPTURES-FIN -->`;

const src = readFileSync(page, 'utf8');
const motif = /<!-- CAPTURES-DEBUT -->[\s\S]*?<!-- CAPTURES-FIN -->/;
if (!motif.test(src)) throw new Error('marqueurs CAPTURES absents de index.html');
writeFileSync(page, src.replace(motif, () => bloc));

console.log(`\n${Object.keys(captures).length} capture(s), ${Math.round(total / 1024)} Ko embarqués.`);
