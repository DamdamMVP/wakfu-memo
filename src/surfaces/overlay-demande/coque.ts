/**
 * The Demande d'ajout shell, surface side.
 *
 * The counter proves clicks land: the lock never touches this surface. The drag
 * moves the window itself — this panel is a real window, unlike the fiche of
 * the Overlay du Tour, which only moves inside its own surface.
 */

type PontMemo = { deplacerDemande: (dx: number, dy: number) => void };

const memo = (window as unknown as { memo?: PontMemo }).memo;

let clics = 0;
const bouton = document.getElementById('preuve');
bouton?.addEventListener('click', () => {
  clics += 1;
  bouton.textContent = `Cliqué ${clics} fois`;
});

const panneau = document.querySelector<HTMLElement>('.panneau');

/**
 * Reported in screen coordinates, so the drag survives the window moving under
 * the pointer — which it does, since we are the ones moving it.
 */
panneau?.addEventListener('pointerdown', (evenement) => {
  if (evenement.button !== 0) return;
  if ((evenement.target as HTMLElement).closest('button')) return;

  let dernierX = evenement.screenX;
  let dernierY = evenement.screenY;
  panneau.setPointerCapture(evenement.pointerId);

  const suivre = (mouvement: PointerEvent): void => {
    memo?.deplacerDemande(mouvement.screenX - dernierX, mouvement.screenY - dernierY);
    dernierX = mouvement.screenX;
    dernierY = mouvement.screenY;
  };
  const relacher = (): void => {
    panneau.removeEventListener('pointermove', suivre);
    panneau.removeEventListener('pointerup', relacher);
    panneau.removeEventListener('pointercancel', relacher);
  };

  panneau.addEventListener('pointermove', suivre);
  panneau.addEventListener('pointerup', relacher);
  panneau.addEventListener('pointercancel', relacher);
});

export {};
