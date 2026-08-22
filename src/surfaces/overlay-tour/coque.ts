/**
 * The Overlay du Tour, surface side: it draws the fiche, and nothing else.
 *
 * The whole state comes from the main process — the fiche, the four aspect
 * settings, the lock, the list of Strats. Nothing is computed here and nothing
 * is remembered: this file is a painter, plus the three gestures that live on
 * the object (ADR `0013`) and the two buttons of the Strat bar.
 *
 * Two invariants nothing may break:
 *
 *  1. **It says nothing about itself** (ADR `0006`). No missing-bridge message,
 *     no "waiting for a combat", no doubtful counter. If the bridge is missing,
 *     the fiche stays away — the Fenêtre principale is the only place that
 *     explains (ADR `0012`).
 *  2. **It declares what it occupies.** The window covers the whole game window;
 *     without the declaration, unlocking the Overlay would swallow every click
 *     meant for the game.
 */

type Rectangle = { x: number; y: number; width: number; height: number };

/**
 * Copied by hand from `src/suivi/fiche.ts` and `src/main/overlay-tour.ts`.
 *
 * A surface has no Node API and is compiled as its own project, so importing
 * the real types would drag the modules that read the disk into the renderer.
 * The shapes are small and the compiler on the other side owns them.
 */
type Segment = { t: string; c?: string };

type LigneDeFiche = {
  rang: number;
  classe: string;
  couleur: string;
  consigne: Segment[];
  inactif: boolean;
  enAvant: boolean;
};

type Fiche = {
  stratId: string;
  nom: string;
  tour: number;
  global: Segment[];
  note: string | null;
  lignes: LigneDeFiche[];
  audelaDe: number | null;
};

type Aspect = { opacite: number; tailleTexte: number; largeur: number; x: number; y: number };

type EtatOverlayTour = {
  verrouille: boolean;
  dessine: boolean;
  fiche: Fiche | null;
  aspect: Aspect;
  strats: { id: string; nom: string }[];
};

type PontMemo = {
  surOverlayTour: (rappel: (etat: EtatOverlayTour) => void) => void;
  declarerZonesCliquables: (zones: Rectangle[]) => void;
  choisirStrat: (id: string | null) => void;
  basculerVerrou: () => void;
  poserLargeurFiche: (largeur: number | null) => void;
  poserPositionFiche: (x: number, y: number) => void;
};

const memo = (window as unknown as { memo?: PontMemo }).memo;

/** The minimum width of a fiche, frozen by #5. */
const LARGEUR_MINI = 340;

/** The padlock's shackle: closed above the body, or tipped to the right. */
const ANSE = {
  ferme: 'M2.9 5.6V3.6a2.6 2.6 0 0 1 5.2 0v2',
  ouvert: 'M2.9 5.6V3.6a2.6 2.6 0 0 1 5.2 0',
};

const par = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const fiche = par<HTMLElement>('fiche');
const poignee = par<HTMLElement>('poignee-largeur');
const stratbar = par<HTMLElement>('stratbar');
const stratpick = par<HTMLButtonElement>('stratpick');
const stratNom = par<HTMLElement>('strat-nom');
const stratmenu = par<HTMLElement>('stratmenu');
const cadenas = par<HTMLButtonElement>('cadenas');
const anse = document.getElementById('anse') as SVGPathElement | null;
const entete = document.querySelector<HTMLElement>('.fiche > header');
const tnum = par<HTMLElement>('tnum');
const glob = par<HTMLElement>('glob');
const audela = par<HTMLElement>('audela');
const rows = par<HTMLElement>('rows');
const note = par<HTMLElement>('note');
const noteTexte = par<HTMLElement>('note-texte');

let dernier: EtatOverlayTour | null = null;
/** The Strat menu is unfolded. Local: a menu is not a state of the app. */
let menuOuvert = false;
/**
 * A gesture is under way on the fiche. While it lasts, the aspect the main
 * process sends is ignored: it is one message behind the pointer, and applying
 * it would make the fiche jump back under the hand.
 */
let enGeste = false;

/* ============================================================== le rendu === */

/** One `<span>` per segment: a single attribute, so no parser and no HTML. */
function ecrireSegments(hote: HTMLElement, segments: Segment[]): void {
  hote.replaceChildren();
  for (const segment of segments) {
    const morceau = document.createElement('span');
    morceau.textContent = segment.t;
    // The tint is picked from the closed palette on the way in; a segment
    // without one takes the fiche's colour.
    if (segment.c !== undefined) morceau.style.color = segment.c;
    hote.append(morceau);
  }
}

function peindreLesLignes(lignes: LigneDeFiche[]): void {
  rows.replaceChildren();
  for (const ligne of lignes) {
    const div = document.createElement('div');
    div.className = `row${ligne.inactif ? ' inactif' : ''}${ligne.enAvant ? ' avant' : ''}`;
    div.style.setProperty('--c', ligne.couleur);

    const classe = document.createElement('span');
    classe.className = 'cls';
    const lisere = document.createElement('span');
    lisere.className = 'edge';
    lisere.style.setProperty('--c', ligne.couleur);
    const portrait = document.createElement('img');
    // The Classe key names the portrait — never the `breed`, whose numbering has
    // a hole (ADR of the model, `classes.ts`).
    portrait.src = `../../icons/${ligne.classe}.png`;
    portrait.alt = '';
    classe.append(lisere, portrait);

    const consigne = document.createElement('div');
    consigne.className = 'cons';
    if (ligne.consigne.length === 0) {
      consigne.classList.add('vide');
      consigne.textContent = '—';
    } else {
      ecrireSegments(consigne, ligne.consigne);
    }

    div.append(classe, consigne);
    rows.append(div);
  }
}

function peindreLeMenu(etat: EtatOverlayTour): void {
  stratmenu.hidden = !menuOuvert;
  if (!menuOuvert) {
    stratmenu.replaceChildren();
    return;
  }
  stratmenu.replaceChildren();
  for (const strat of etat.strats) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.textContent = strat.nom;
    if (strat.id === etat.fiche?.stratId) bouton.className = 'courante';
    bouton.dataset['strat'] = strat.id;
    stratmenu.append(bouton);
  }
}

function appliquerLAspect(aspect: Aspect): void {
  if (enGeste) return;
  fiche.style.width = `${Math.max(LARGEUR_MINI, aspect.largeur)}px`;
  fiche.style.fontSize = `${aspect.tailleTexte}px`;
  fiche.style.opacity = String(aspect.opacite / 100);
  poser(aspect.x, aspect.y);
}

function peindre(etat: EtatOverlayTour): void {
  dernier = etat;
  // Locking folds the menu, exactly as it takes back the clicks: the padlock is
  // let through too, so a menu left open could never be closed.
  if (etat.verrouille) menuOuvert = false;

  // No Strat chosen means the Overlay draws nothing at all — not an empty fiche
  // and not a sentence (ADR `0006`).
  if (!etat.dessine || etat.fiche === null) {
    fiche.hidden = true;
    declarerZones();
    return;
  }

  const contenu = etat.fiche;
  fiche.hidden = false;
  appliquerLAspect(etat.aspect);

  stratNom.textContent = contenu.nom;
  cadenas.classList.toggle('ferme', etat.verrouille);
  cadenas.title = etat.verrouille
    ? 'verrouillé — les clics vont au jeu. Le raccourci le déverrouille.'
    : 'déverrouillé — l’overlay attrape les clics. Cliquer : verrouiller.';
  anse?.setAttribute('d', etat.verrouille ? ANSE.ferme : ANSE.ouvert);

  tnum.textContent = `T${contenu.tour}`;
  ecrireSegments(glob, contenu.global);

  if (contenu.audelaDe === null) {
    audela.hidden = true;
    audela.replaceChildren();
  } else {
    audela.hidden = false;
    audela.replaceChildren(
      document.createTextNode('La strat '),
      elementTexte('b', contenu.nom),
      document.createTextNode(' s’arrête au '),
      elementTexte('b', `T${contenu.audelaDe}`),
      document.createTextNode('. Le combat continue sans consigne.'),
    );
  }

  peindreLesLignes(contenu.lignes);

  note.hidden = contenu.note === null;
  noteTexte.textContent = contenu.note ?? '';

  peindreLeMenu(etat);
  declarerZones();
}

function elementTexte(balise: string, texte: string): HTMLElement {
  const element = document.createElement(balise);
  element.textContent = texte;
  return element;
}

/* ========================================================== la position === */

/**
 * Where the fiche sits, clamped so it stays reachable: the Overlay's window is
 * the game's window, and the game can be resized smaller than the fiche's
 * corner. Clamping is for the drawing only — the stored position is not
 * rewritten behind the player's back by a window briefly made small.
 */
function poser(x: number, y: number): void {
  const large = fiche.offsetWidth || LARGEUR_MINI;
  const haut = fiche.offsetHeight || 0;
  fiche.style.left = `${Math.max(0, Math.min(x, Math.max(0, window.innerWidth - large)))}px`;
  fiche.style.top = `${Math.max(0, Math.min(y, Math.max(0, window.innerHeight - haut)))}px`;
}

/**
 * In physical pixels: that is what the X server expects for an input region,
 * whereas the DOM measures in logical ones. On a screen scaled by 2, forgetting
 * this would offset the zone by half.
 */
function declarerZones(): void {
  const ratio = window.devicePixelRatio || 1;
  const marques = Array.from(document.querySelectorAll<HTMLElement>('[data-cliquable]'));
  const zones = marques
    .map((element) => element.getBoundingClientRect())
    .filter((boite) => boite.width > 0 && boite.height > 0)
    .map((boite) => ({
      x: boite.x * ratio,
      y: boite.y * ratio,
      width: boite.width * ratio,
      height: boite.height * ratio,
    }));
  memo?.declarerZonesCliquables(zones);
}

/* ============================================================ les gestes == */

/** Runs a pointer drag on `saisie`, and reports once at release. */
function glisser(
  saisie: HTMLElement,
  depart: PointerEvent,
  suivre: (mouvement: PointerEvent) => void,
  relacher: () => void,
): void {
  enGeste = true;
  saisie.setPointerCapture(depart.pointerId);

  const bouger = (mouvement: PointerEvent): void => {
    suivre(mouvement);
    // What catches clicks moved with the fiche.
    declarerZones();
  };
  const finir = (): void => {
    saisie.removeEventListener('pointermove', bouger);
    saisie.removeEventListener('pointerup', finir);
    saisie.removeEventListener('pointercancel', finir);
    enGeste = false;
    relacher();
    declarerZones();
  };

  saisie.addEventListener('pointermove', bouger);
  saisie.addEventListener('pointerup', finir);
  saisie.addEventListener('pointercancel', finir);
}

/**
 * Dragging the fiche moves it INSIDE the surface, and moves no window: the
 * Overlay du Tour covers the whole game, so there is nothing to move. Only
 * possible while unlocked — locked, the input region is empty and the pointer
 * never reaches us, which is why the fiche seems frozen until the shortcut.
 *
 * The grip is the Strat bar and the header, never a row: the rows are where the
 * Échange par clic will click icons.
 */
for (const poigneeDeDeplacement of [stratbar, entete]) {
  poigneeDeDeplacement?.addEventListener('pointerdown', (evenement) => {
    if (evenement.button !== 0) return;
    if ((evenement.target as HTMLElement).closest('button, .stratmenu')) return;

    const boite = fiche.getBoundingClientRect();
    const prise = { x: evenement.clientX - boite.x, y: evenement.clientY - boite.y };
    let x = boite.x;
    let y = boite.y;

    glisser(
      poigneeDeDeplacement,
      evenement,
      (mouvement) => {
        x = mouvement.clientX - prise.x;
        y = mouvement.clientY - prise.y;
        poser(x, y);
      },
      () => memo?.poserPositionFiche(Math.round(x), Math.round(y)),
    );
  });
}

/** The width, caught at the right edge. Global: only one fiche is visible. */
poignee.addEventListener('pointerdown', (evenement) => {
  if (evenement.button !== 0) return;
  // No `preventDefault` here: it would cost the double-click of the next line,
  // and the drag needs nothing of it — `user-select: none` covers the selection.

  // Measured from the left edge, the fiche not moving while its width changes.
  // Minus where in the 9 px grip the pointer landed, otherwise the width jumps
  // by a few pixels the moment the drag starts.
  const boite = fiche.getBoundingClientRect();
  const prise = evenement.clientX - (boite.x + boite.width);
  let largeur = fiche.offsetWidth;

  glisser(
    poignee,
    evenement,
    (mouvement) => {
      largeur = Math.max(LARGEUR_MINI, Math.round(mouvement.clientX - prise - boite.x));
      fiche.style.width = `${largeur}px`;
    },
    () => memo?.poserLargeurFiche(largeur),
  );
});

/** Double-click: back to the automatic width, as in the editor (#5). */
poignee.addEventListener('dblclick', () => memo?.poserLargeurFiche(null));

/* ======================================================== les deux boutons = */

stratpick.addEventListener('click', () => {
  menuOuvert = !menuOuvert;
  if (dernier !== null) {
    peindreLeMenu(dernier);
    declarerZones();
  }
});

stratmenu.addEventListener('click', (evenement) => {
  const choisi = (evenement.target as HTMLElement).closest<HTMLElement>('[data-strat]');
  const id = choisi?.dataset['strat'];
  if (id === undefined) return;
  menuOuvert = false;
  memo?.choisirStrat(id);
});

cadenas.addEventListener('click', () => memo?.basculerVerrou());

memo?.surOverlayTour(peindre);

// What moves the fiche: its content, and the size of the game window.
new ResizeObserver(() => {
  if (dernier !== null && !enGeste) appliquerLAspect(dernier.aspect);
  declarerZones();
}).observe(document.body);
window.addEventListener('resize', () => {
  if (dernier !== null && !enGeste) appliquerLAspect(dernier.aspect);
  declarerZones();
});
declarerZones();

export {};
