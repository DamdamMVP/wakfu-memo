import { ok, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canoniserNom, estNomPossible } from './noms.ts';

describe('la forme canonique d’un nom Wakfu', () => {
  it('force la majuscule en tête, après chaque tiret et après chaque apostrophe', () => {
    // Les deux personnages créés en jeu pour établir la règle.
    strictEqual(canoniserNom('salut-mec-ca-va'), 'Salut-Mec-Ca-Va');
    strictEqual(canoniserNom("s'alu-ca'va"), "S'Alu-Ca'Va");
  });

  it('reproduit les trois vrais pseudos du document de grammaire', () => {
    // Ce n'étaient pas des exceptions à la majuscule initiale : c'est la règle
    // entière, dont on ne connaissait que la moitié.
    strictEqual(canoniserNom("thor'rompiche"), "Thor'Rompiche");
    strictEqual(canoniserNom("jt'invok"), "Jt'Invok");
    strictEqual(canoniserNom('anusky-bail'), 'Anusky-Bail');
  });

  it('retire les accents, puisqu’un nom n’en porte jamais', () => {
    strictEqual(canoniserNom('Nozahéal'), 'Nozaheal');
    strictEqual(canoniserNom('ÉLÉONORE'), 'Eleonore');
  });

  it('retire tout ce que le jeu n’accepte pas — chiffres, espaces, ponctuation', () => {
    strictEqual(canoniserNom('Damdam 42 !'), 'Damdam');
    // « Wingardium Nozadah » ne peut donc pas être un pseudo : l'espace ne
    // survit pas, et ce que la ligne portait était un nom plus un suffixe.
    strictEqual(canoniserNom('Wingardium Nozadah'), 'Wingardiumnozadah');
  });

  it('est idempotente : c’est ce qui rend la comparaison exacte des deux côtés', () => {
    for (const nom of ["S'Alu-Ca'Va", 'Salut-Mec-Ca-Va', 'Damdam', "Thor'Rompiche"]) {
      strictEqual(canoniserNom(nom), nom);
      strictEqual(canoniserNom(canoniserNom(nom)), nom);
    }
  });

  it('ramène la casse à une seule orthographe, jamais à deux personnages', () => {
    strictEqual(canoniserNom('NOZAHAEL'), 'Nozahael');
    strictEqual(canoniserNom('nozahael'), 'Nozahael');
  });

  it('ne répare pas une vraie faute de frappe — ce qui reste au rattachement', () => {
    ok(canoniserNom('Nozahael') !== canoniserNom('Nozaheal'));
  });

  it('refuse ce qui n’a aucune lettre, séparateurs compris', () => {
    ok(!estNomPossible(''));
    ok(!estNomPossible('   '));
    ok(!estNomPossible("-'-"));
    ok(estNomPossible('a'));
  });
});
