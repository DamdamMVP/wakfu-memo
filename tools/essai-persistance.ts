/**
 * A sandbox to watch the persistence work, by hand.
 *
 *   node tools/essai-persistance.ts [folder]     (default: /tmp/wakfu-memo-essai)
 *
 * First run: the folder is empty, the script sows a Roster and a Strat. Then open
 * the three files, break them the way a user would — two Emplacements of the same
 * Couleur, a seventh Emplacement, a Consigne aiming at a vanished id, a
 * `"schema": 9`, a truncated JSON — and run it again: it prints what the read made
 * of it. Nothing is written unless there is something to sow, so it can be run as
 * often as wanted.
 *
 * It never touches the real data folder unless you name it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Persistance } from '../src/persistance/index.ts';

const dossierDonnees = process.argv[2] ?? '/tmp/wakfu-memo-essai';
const persistance = new Persistance(dossierDonnees);
persistance.charger();

console.log(`\nDossier de données : ${dossierDonnees}\n`);
for (const [nom, fichier] of [
  ['reglages', persistance.reglages],
  ['roster', persistance.roster],
  ['strats', persistance.strats],
] as const) {
  console.log(`${nom.padEnd(9)} ${JSON.stringify(fichier.verdict)}`);
}

if (persistance.avertissements.length > 0) {
  console.log('\nÀ annoncer dans le bandeau :');
  for (const avertissement of persistance.avertissements) {
    console.log(` — ${JSON.stringify(avertissement)}`);
  }
}

const vide = persistance.strats.lire().strats.length === 0;
if (vide && !persistance.strats.modifiable) {
  console.log('\nRien à semer : strats.json est refusé, donc on n’y touche pas.');
} else if (vide) {
  console.log('\nRien à lire : on sème une Strat et un Personnage.');
  const moi = persistance.roster.lire().profils[0];
  if (moi === undefined) throw new Error('le profil « moi » manque');
  persistance.strats.ecrire({
    strats: [
      {
        id: 'ombre',
        nom: 'Ombre Épaisse',
        emplacements: [
          { id: 'e1', classe: 'ecaflip', couleur: 'rouge' },
          { id: 'e2', classe: 'huppermage', couleur: 'bleu' },
        ],
        tours: [
          {
            global: [{ t: 'Phase de burst', c: '#ef5350' }],
            note: 'TP SUR HUPPER',
            consignes: {
              e1: [{ t: 'oeil de taupe + ' }, { t: 'tir critique', c: '#e8c33c' }],
              e2: [{ t: 'coalescence' }],
            },
          },
          { consignes: { e1: [{ t: 'rester au contact' }] } },
        ],
      },
    ],
  });
  persistance.roster.ecrire({
    ...persistance.roster.lire(),
    personnages: [
      { id: 'c1', profilId: moi.id, nom: 'Damdam', classe: 'ecaflip', idEntite: '11379827' },
    ],
    preferences: [{ stratId: 'ombre', personnageId: 'c1', emplacementId: 'e1' }],
  });
  persistance.modifierReglages({ stratChoisie: 'ombre' });
  persistance.vider();
}

console.log('\n--- ce que la lecture a retenu ---');
for (const strat of persistance.strats.lire().strats) {
  console.log(
    `\n${strat.nom} — ${strat.emplacements.length} emplacement(s), ${strat.tours.length} tour(s)`,
  );
  strat.emplacements.forEach((emplacement, index) => {
    // Le Rang EST la position : c'est `index + 1`, il n'est nulle part sur le disque.
    console.log(`  rang ${index + 1} · ${emplacement.classe.padEnd(11)} ${emplacement.couleur}`);
  });
}
for (const personnage of persistance.roster.lire().personnages) {
  console.log(`\n${personnage.nom} (${personnage.classe}) — id d’entité ${personnage.idEntite}`);
}

console.log('\n--- strats.json sur le disque ---');
console.log(readFileSync(join(dossierDonnees, 'strats.json'), 'utf8'));
