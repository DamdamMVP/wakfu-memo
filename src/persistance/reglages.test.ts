import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FORME_REGLAGES, REGLAGES_PAR_DEFAUT } from './reglages.ts';

describe('reglages.json — un sac de clés tolérant', () => {
  it('remplit les clés absentes avec les défauts du code', () => {
    deepStrictEqual(FORME_REGLAGES.lire({ schema: 1, opacite: 60 }), {
      ...REGLAGES_PAR_DEFAUT,
      opacite: 60,
    });
  });

  it('conserve une clé inconnue à la réécriture — un lot suivant n’a rien à migrer', () => {
    const brutPrecedent = { schema: 1, opacite: 60, tailleDeLaLune: 'gibbeuse' };
    const reecrit = FORME_REGLAGES.ecrire(FORME_REGLAGES.lire(brutPrecedent), brutPrecedent);

    strictEqual(reecrit['tailleDeLaLune'], 'gibbeuse');
    strictEqual(reecrit['opacite'], 60);
  });

  it('répare en silence une valeur aberrante ou hors bornes', () => {
    const reglages = FORME_REGLAGES.lire({
      schema: 1,
      opacite: 5000,
      tailleTexte: 'gros',
      largeurFiche: 12,
      affichageDemande: 'oui',
      stratChoisie: '   ',
    });

    strictEqual(reglages.opacite, 100);
    strictEqual(reglages.tailleTexte, REGLAGES_PAR_DEFAUT.tailleTexte);
    strictEqual(reglages.largeurFiche, 340);
    strictEqual(reglages.affichageDemande, false);
    strictEqual(reglages.stratChoisie, null);
  });

  it('accepte `null` là où `null` a un sens', () => {
    const reglages = FORME_REGLAGES.lire({
      schema: 1,
      dossierLogsManuel: null,
      raccourciFenetre: null,
      raccourciOverlay: null,
      stratChoisie: null,
    });

    strictEqual(reglages.dossierLogsManuel, null);
    strictEqual(reglages.stratChoisie, null);
    // Un raccourci effacé le reste : c'est `raccourcis-regles.ts` qui décide
    // lequel se rattrape sur un défaut, pas le fichier.
    strictEqual(reglages.raccourciOverlay, null);
    strictEqual(reglages.raccourciFenetre, null);
  });

  it('part sur les mêmes défauts que le dépôt provisoire du Lot 2', () => {
    // Le fichier écrit par le lot précédent doit se relire sans surprise : les
    // clés portent les mêmes noms et les mêmes valeurs de départ.
    strictEqual(REGLAGES_PAR_DEFAUT.affichageDemande, false);
    strictEqual(REGLAGES_PAR_DEFAUT.stratChoisie, null);
    strictEqual(REGLAGES_PAR_DEFAUT.dossierLogsManuel, null);
    strictEqual(REGLAGES_PAR_DEFAUT.raccourciOverlay, 'Ctrl+Alt+W');
    strictEqual(REGLAGES_PAR_DEFAUT.raccourciVerrou, 'Ctrl+Alt+L');
    strictEqual(REGLAGES_PAR_DEFAUT.raccourciFenetre, null);
  });
});
