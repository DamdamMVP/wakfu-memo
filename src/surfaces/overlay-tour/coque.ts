/**
 * The Overlay du Tour shell, surface side.
 *
 * One of its two jobs outlives Lot 4: declaring what the surface really
 * occupies. The window covers the whole game window but only the fiche is
 * drawn; without this declaration, unlocking the Overlay would swallow every
 * click meant for the game.
 *
 * The convention is an attribute: any element marked `data-cliquable` catches
 * clicks while the Overlay is unlocked. Lot 4 will put it on the fiche.
 */

type Rectangle = { x: number; y: number; width: number; height: number };

type PontMemo = {
  surOverlayTour: (rappel: (etat: { verrouille: boolean; dessine: boolean }) => void) => void;
  declarerZonesCliquables: (zones: Rectangle[]) => void;
};

// The Overlay has no words for its own doubt (ADR 0006): if the bridge is
// missing it stays quiet rather than painting an error over the game.
const memo = (window as unknown as { memo?: PontMemo }).memo;

/**
 * In physical pixels: that is what the X server expects for an input region,
 * whereas the DOM measures in logical ones. On a screen scaled by 2, forgetting
 * this would offset the zone by half.
 */
function declarerZones(): void {
  const ratio = window.devicePixelRatio || 1;
  const marques = Array.from(document.querySelectorAll<HTMLElement>('[data-cliquable]'));
  const zones = marques.map((element) => {
    const boite = element.getBoundingClientRect();
    return {
      x: boite.x * ratio,
      y: boite.y * ratio,
      width: boite.width * ratio,
      height: boite.height * ratio,
    };
  });
  memo?.declarerZonesCliquables(zones);
}

memo?.surOverlayTour((etat) => {
  const ligne = document.getElementById('etat');
  if (ligne) {
    ligne.textContent = etat.verrouille
      ? 'verrouillé — les clics vont au jeu'
      : 'déverrouillé — la fiche attrape les clics, le reste les laisse passer';
  }
  // The text changes length, so the fiche does too.
  declarerZones();
});

/**
 * Dragging the fiche moves it INSIDE the surface, and does not move a window:
 * the Overlay du Tour covers the whole game, so there is nothing to move. Only
 * possible while unlocked — locked, the input region is empty and the pointer
 * never reaches us at all, which is why the fiche seems frozen until
 * `Ctrl+Alt+L`.
 *
 * Lot 4 owns the fiche's real position and its persistence (ADR 0013: the
 * aspect of the Overlay is set on the Overlay). This is the mechanism, not the
 * memory of it.
 */
const fiche = document.querySelector<HTMLElement>('.repere');

fiche?.addEventListener('pointerdown', (evenement) => {
  if (evenement.button !== 0) return;
  if ((evenement.target as HTMLElement).closest('button, a, input')) return;

  const boite = fiche.getBoundingClientRect();
  const prise = { x: evenement.clientX - boite.x, y: evenement.clientY - boite.y };
  fiche.setPointerCapture(evenement.pointerId);

  const suivre = (mouvement: PointerEvent): void => {
    fiche.style.left = `${mouvement.clientX - prise.x}px`;
    fiche.style.top = `${mouvement.clientY - prise.y}px`;
    // The fiche moved, so what catches clicks moved with it.
    declarerZones();
  };
  const relacher = (): void => {
    fiche.removeEventListener('pointermove', suivre);
    fiche.removeEventListener('pointerup', relacher);
    fiche.removeEventListener('pointercancel', relacher);
    declarerZones();
  };

  fiche.addEventListener('pointermove', suivre);
  fiche.addEventListener('pointerup', relacher);
  fiche.addEventListener('pointercancel', relacher);
});

// What moves the fiche: its content, and the size of the game window.
new ResizeObserver(declarerZones).observe(document.body);
window.addEventListener('resize', declarerZones);
declarerZones();

export {};
