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

// What moves the fiche: its content, and the size of the game window.
new ResizeObserver(declarerZones).observe(document.body);
window.addEventListener('resize', declarerZones);
declarerZones();

export {};
