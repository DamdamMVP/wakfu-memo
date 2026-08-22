/**
 * La forme canonique d'un nom Wakfu, **recopiée** de `src/domaine/noms.ts`.
 *
 * ⚠️ La copie n'est pas de la négligence, c'est le même choix que les tables de
 * `pont.ts` : une surface se compile comme son propre projet, en ESM et sans API
 * Node, et importer un module du processus principal le ferait émettre deux fois
 * dans `dist/`, sous deux formats. Le compilateur de l'autre côté possède
 * l'original, et `edition-roster.ts` canonise de toute façon ce qu'il reçoit :
 * cette copie ne décide rien, elle **montre**.
 *
 * Et c'est tout son intérêt. On canonise **pendant la frappe** : l'utilisateur
 * tape `s'alu-ca'va` et lit `S'Alu-Ca'Va`. Rien ne se cache dans un `===`, le
 * champ affiche exactement ce qui sera comparé, et l'avertissement de #17 — « le
 * nom doit être exactement celui en jeu » — n'a plus d'objet : il est sorti du
 * produit.
 */

const HORS_ALPHABET = /[^A-Za-z'-]/gu;
const DIACRITIQUES = /[\u0300-\u036f]/gu;
const APRES_SEPARATEUR = /(^|['-])([a-z])/gu;

export function canoniserNom(saisi: string): string {
  const sansAccent = saisi.normalize('NFD').replace(DIACRITIQUES, '');
  const lettres = sansAccent.replace(HORS_ALPHABET, '').toLowerCase();
  return lettres.replace(
    APRES_SEPARATEUR,
    (_tout, separateur: string, lettre: string) => separateur + lettre.toUpperCase(),
  );
}

/** Un nom sans une seule lettre n'est pas un nom : le jeu n'en a pas. */
export const estNomPossible = (saisi: string): boolean => /[A-Za-z]/u.test(canoniserNom(saisi));
