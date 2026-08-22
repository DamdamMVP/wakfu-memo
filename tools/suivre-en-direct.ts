/**
 * Sonde de mise au point : suit `wakfu.log` en direct et imprime le Tour
 * courant à chaque changement.
 *
 * Ce n'est **pas** le produit — l'Overlay, la coque Electron et la surveillance
 * du fichier sont d'autres lots. C'est le moyen de vérifier le lecteur contre
 * un vrai client Wakfu, sur un vrai combat, ce que les échantillons ne peuvent
 * pas faire.
 *
 *   node --experimental-strip-types tools/suivre-en-direct.ts
 *   node --experimental-strip-types tools/suivre-en-direct.ts --ordre Madamedame,Damdamnesique
 *
 * Sans `--ordre`, les Emplacements sont créés dans l'ordre d'arrivée des
 * `[_FL_]`, qui n'est **pas** l'ordre des tours : le Tour courant et le nombre
 * d'avances restent justes, la Mise en avant non. Le Rang se déclare — c'est
 * tout l'objet de `--ordre` ici, et de la Composition d'une Strat dans l'app.
 */

import { readFileSync } from 'node:fs';

import type { Composition, Couleur } from '../src/domaine/composition.ts';
import {
  dossierDeLogs,
  environnementReel,
  systemeDeFichiersReel,
} from '../src/logs/dossier-de-logs.ts';
import { relire } from '../src/logs/session.ts';
import type { EtatDuSuivi } from '../src/suivi/suivi-du-tour.ts';

const COULEURS: Couleur[] = ['rouge', 'jaune', 'vert', 'bleu', 'rose', 'gris'];
const PERIODE = 500;

const ordreDemande = (() => {
  const index = process.argv.indexOf('--ordre');
  return index === -1 ? [] : (process.argv[index + 1] ?? '').split(',').filter(Boolean);
})();

const fs = systemeDeFichiersReel();
const env = environnementReel();

/**
 * La Composition, déduite du roster du combat faute de Strat — le lot des
 * fichiers JSON versionnés n'est pas encore là.
 */
function compositionDuCombat(contenu: string): Composition {
  const roster = relire(contenu, []).combatEnCours?.roster ?? [];
  const joues = roster.filter((c) => !c.controleParIA && c.classe !== null);
  const ordonnes =
    ordreDemande.length === 0
      ? joues
      : [...joues].sort((a, b) => {
          const rang = (nom: string): number => {
            const trouve = ordreDemande.indexOf(nom);
            return trouve === -1 ? ordreDemande.length : trouve;
          };
          return rang(a.nom) - rang(b.nom);
        });

  return ordonnes.map((c, index) => ({
    classe: c.classe!,
    couleur: COULEURS[index % COULEURS.length]!,
  }));
}

function decrire(etat: EtatDuSuivi | null, fichier: string): string {
  if (etat === null) return `hors combat — ${fichier}`;

  const fiche = [...etat.liaison]
    .map(([rang, c]) => {
      const mise = rang === etat.rangCourant ? '>' : ' ';
      const tombe = etat.rangsActifs.includes(rang) ? '' : ' (tombé)';
      return `${mise}${rang}. ${c.nom} [${c.classe}]${tombe}`;
    })
    .join('  ');

  return `combat ${etat.fightId} · Tour ${etat.tourCourant} · k=${etat.clientsEngages} · ${etat.finsDeTour} fins de tour · ${fiche}`;
}

let dernier = '';

setInterval(() => {
  // Le départage se reconsidère à chaud : le joueur peut changer de mode.
  const retenu = dossierDeLogs(fs, env);
  if (retenu === null) {
    imprimer('aucun `wakfu.log` lisible — l’Overlay ne se dessinerait pas du tout');
    return;
  }

  let contenu: string;
  try {
    contenu = readFileSync(retenu.fichier, 'utf8');
  } catch {
    imprimer(`illisible : ${retenu.fichier}`);
    return;
  }

  const combat = relire(contenu, compositionDuCombat(contenu)).combatEnCours;
  imprimer(decrire(combat, `${retenu.installation}, ${retenu.origine}`));
}, PERIODE);

function imprimer(ligne: string): void {
  if (ligne === dernier) return;
  dernier = ligne;
  console.log(`${new Date().toLocaleTimeString('fr-FR')}  ${ligne}`);
}
