/**
 * Un élément, sa classe, son texte. Trois lignes, et la raison d'être de ce
 * fichier : la fenêtre se construit en nœuds, jamais en `innerHTML`.
 *
 * Ce n'est pas du purisme. Un nom de Strat, une Consigne et une note sont du
 * texte que l'utilisateur tape, et qu'un collage peut remplir de n'importe quoi.
 * `textContent` ne l'interprète jamais ; un gabarit de chaînes demanderait un
 * échappement à chaque interpolation, et il suffit d'en oublier un.
 */
export function element<B extends keyof HTMLElementTagNameMap>(
  balise: B,
  classe = '',
  texte = '',
): HTMLElementTagNameMap[B] {
  const cree = document.createElement(balise);
  if (classe !== '') cree.className = classe;
  if (texte !== '') cree.textContent = texte;
  return cree;
}

/**
 * Un bouton, qui a toujours un `type` : sans lui, il soumet.
 *
 * Le geste reçoit l'événement, et ce n'est pas du confort : celui qui **ouvre**
 * un calque doit arrêter la propagation, sinon le clic remonte jusqu'au
 * document, qui referme ce qu'on vient d'ouvrir.
 */
export function bouton(
  classe: string,
  texte: string,
  geste: (evenement: MouseEvent) => void,
): HTMLButtonElement {
  const cree = element('button', classe, texte);
  cree.type = 'button';
  cree.addEventListener('click', geste);
  return cree;
}
