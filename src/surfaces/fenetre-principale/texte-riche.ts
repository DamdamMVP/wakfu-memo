/**
 * Le texte riche, entre le DOM et le modèle.
 *
 * Le modèle est une liste plate de segments `[{ t, c }]` : un seul attribut, la
 * couleur, donc aucune imbrication possible et rien à analyser
 * (`domaine/texte-riche.ts`). Un `contenteditable`, lui, produit des balises.
 * Ce fichier est la frontière entre les deux, et il n'y en a pas d'autre.
 *
 * ⚠️ Les prototypes de #5 et de #21 stockaient du **HTML** dans le modèle, pour
 * que la couleur survive à un re-rendu. C'était un raccourci de maquette
 * assumé : #11 a gelé des runs. La conversion est ici, et elle a trois règles.
 *
 *  1. **Seule une couleur posée en ligne compte.** Jamais la couleur calculée :
 *     `blanc` (`#e8eaef`) est aussi la couleur par défaut de la fiche, donc lire
 *     le calculé rendrait tout texte ordinaire explicitement blanc, et le
 *     premier changement de thème réécrirait dix strats.
 *  2. **Une teinte hors palette tombe**, comme à la relecture du fichier : le
 *     texte reste, la couleur non. C'est ce qui rend le collage inoffensif.
 *  3. **Aucun retour à la ligne n'entre.** Le modèle n'en a pas la notion et
 *     l'Overlay ne saurait pas le dessiner — son `white-space` est normal. La
 *     touche Entrée est donc refusée dans les trois textes libres, et un collage
 *     multiligne devient des espaces.
 *
 * ⚠️ **La coloration ne passe PAS par `document.execCommand('foreColor')`**, et
 * ce n'est pas une question de dépréciation. Mesuré le 22 août 2026, Electron 43,
 * sous la CSP de cette surface : `execCommand` écrit bien un attribut
 * `style="color: …"`, et la CSP `style-src 'self'` **refuse de l'appliquer** —
 * violation rapportée, `getComputedStyle` reste au noir. La couleur serait donc
 * dans le DOM et invisible à l'écran. Le **CSSOM** (`element.style.color = …`),
 * lui, n'est pas couvert par la CSP et rend normalement.
 *
 * D'où la forme retenue, qui est aussi la plus juste : la sélection se mesure en
 * **caractères**, la couleur s'applique aux **segments**, et le champ est
 * repeint depuis le modèle. Le modèle et ce qu'on voit ne peuvent plus diverger.
 */

import type { Segment } from './pont.ts';

/**
 * Les dix teintes de texte de `domaine/palettes.ts`, dans son ordre, plus le mot
 * qui les nomme (#21). Palette distincte de celle des Emplacements, pour qu'un
 * mot coloré ne se lise jamais comme une Couleur.
 */
export const TEINTES: readonly (readonly [string, string])[] = [
  ['rouge', '#ef5350'],
  ['orange', '#f08c3a'],
  ['jaune', '#e8c33c'],
  ['vert', '#48c07d'],
  ['cyan', '#2fb3c9'],
  ['bleu', '#5b8cff'],
  ['violet', '#a97ae8'],
  ['rose', '#e85fa8'],
  ['gris', '#9aa2b2'],
  ['blanc', '#e8eaef'],
];

const CONNUES = new Set(TEINTES.map(([, hexa]) => hexa));

/**
 * `rgb(239, 83, 80)` ou `#EF5350` vers `#ef5350`, et `null` si la valeur ne
 * nomme aucune des dix. `execCommand` écrit du `rgb()`, un collage écrit ce
 * qu'il veut.
 */
export function teinteConnue(valeur: string): string | null {
  const propre = valeur.trim().toLowerCase();
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(propre);
  const hexa =
    rgb === null
      ? propre
      : `#${[rgb[1], rgb[2], rgb[3]]
          .map((canal) => Number(canal).toString(16).padStart(2, '0'))
          .join('')}`;
  return CONNUES.has(hexa) ? hexa : null;
}

/** Un `<span>` par segment : un seul attribut, donc jamais de HTML à écrire. */
export function peindreSegments(hote: HTMLElement, segments: readonly Segment[]): void {
  hote.replaceChildren();
  for (const segment of segments) {
    const morceau = document.createElement('span');
    morceau.textContent = segment.t;
    if (segment.c !== undefined) morceau.style.color = segment.c;
    hote.append(morceau);
  }
}

/**
 * Ce que le champ contient, ramené au modèle : les segments voisins de même
 * teinte fusionnent, et un champ qui ne porte que du blanc revient vide — c'est
 * ainsi qu'une Consigne effacée redevient une clef absente.
 */
export function lireSegments(hote: HTMLElement): Segment[] {
  const segments: Segment[] = [];

  const pousser = (texte: string, teinte: string | null): void => {
    if (texte === '') return;
    const dernier = segments[segments.length - 1];
    if (dernier !== undefined && (dernier.c ?? null) === teinte) {
      segments[segments.length - 1] =
        teinte === null ? { t: dernier.t + texte } : { t: dernier.t + texte, c: teinte };
      return;
    }
    segments.push(teinte === null ? { t: texte } : { t: texte, c: teinte });
  };

  const parcourir = (noeud: Node, herite: string | null): void => {
    for (const enfant of Array.from(noeud.childNodes)) {
      if (enfant.nodeType === Node.TEXT_NODE) {
        // L'espace insécable que Chromium pose en fin de champ redevient un
        // espace. Un remplacement caractère pour caractère, jamais une
        // réduction : les bornes de la sélection sont comptées sur ce texte.
        pousser((enfant.textContent ?? '').replace(/\u00a0/gu, ' '), herite);
      } else if (enfant instanceof HTMLBRElement) {
        // Une coupure ne se dessine pas dans l'Overlay : elle devient un espace.
        pousser(' ', herite);
      } else if (enfant instanceof HTMLElement) {
        parcourir(enfant, teinteConnue(enfant.style.color) ?? herite);
      }
    }
  };

  parcourir(hote, null);
  const total = segments.map((segment) => segment.t).join('');
  return total.trim() === '' ? [] : segments;
}

/* ============================================ la sélection, en caractères = */

/** La position d'un point du DOM, en caractères depuis le début du champ. */
function position(hote: HTMLElement, noeud: Node, decalage: number): number {
  // La sélection peut se poser SUR le champ — un champ vide, un caret entre deux
  // spans — et le décalage compte alors des enfants, pas des caractères.
  if (noeud === hote) {
    let total = 0;
    for (const enfant of Array.from(hote.childNodes).slice(0, decalage)) {
      total += (enfant.textContent ?? '').length;
    }
    return total;
  }
  let total = 0;
  const marcheur = document.createTreeWalker(hote, NodeFilter.SHOW_TEXT);
  for (let texte = marcheur.nextNode(); texte !== null; texte = marcheur.nextNode()) {
    if (texte === noeud) return total + decalage;
    total += (texte.textContent ?? '').length;
  }
  return total;
}

/** Les bornes de la sélection dans ce champ, ou `null` si elle est ailleurs. */
export function bornesDeLaSelection(hote: HTMLElement): { debut: number; fin: number } | null {
  const selection = document.getSelection();
  if (selection === null || selection.rangeCount === 0) return null;
  const portee = selection.getRangeAt(0);
  if (!hote.contains(portee.startContainer) || !hote.contains(portee.endContainer)) return null;
  const debut = position(hote, portee.startContainer, portee.startOffset);
  const fin = position(hote, portee.endContainer, portee.endOffset);
  return debut <= fin ? { debut, fin } : { debut: fin, fin: debut };
}

/** Repose la sélection sur les mêmes caractères, le champ ayant été repeint. */
export function poserLaSelection(hote: HTMLElement, debut: number, fin: number): void {
  const ou = (cible: number): [Node, number] => {
    let total = 0;
    const marcheur = document.createTreeWalker(hote, NodeFilter.SHOW_TEXT);
    for (let texte = marcheur.nextNode(); texte !== null; texte = marcheur.nextNode()) {
      const longueur = (texte.textContent ?? '').length;
      if (cible <= total + longueur) return [texte, cible - total];
      total += longueur;
    }
    return [hote, hote.childNodes.length];
  };
  const portee = document.createRange();
  const [noeudDebut, decalageDebut] = ou(debut);
  const [noeudFin, decalageFin] = ou(fin);
  portee.setStart(noeudDebut, decalageDebut);
  portee.setEnd(noeudFin, decalageFin);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(portee);
}

/**
 * Applique une teinte à `[debut, fin)` d'une liste de segments — `null` la
 * retire. Un seul attribut par segment, donc découper puis recoller suffit : il
 * n'y a rien à imbriquer.
 */
export function colorer(
  segments: readonly Segment[],
  debut: number,
  fin: number,
  teinte: string | null,
): Segment[] {
  if (fin <= debut) return [...segments];
  const sortie: Segment[] = [];
  const pousser = (texte: string, couleur: string | null): void => {
    if (texte === '') return;
    const dernier = sortie[sortie.length - 1];
    if (dernier !== undefined && (dernier.c ?? null) === couleur) {
      sortie[sortie.length - 1] =
        couleur === null ? { t: dernier.t + texte } : { t: dernier.t + texte, c: couleur };
      return;
    }
    sortie.push(couleur === null ? { t: texte } : { t: texte, c: couleur });
  };

  let curseur = 0;
  for (const segment of segments) {
    const longueur = segment.t.length;
    const borne = (valeur: number): number => Math.min(Math.max(valeur, 0), longueur);
    const dedansDebut = borne(debut - curseur);
    const dedansFin = borne(fin - curseur);
    pousser(segment.t.slice(0, dedansDebut), segment.c ?? null);
    pousser(segment.t.slice(dedansDebut, dedansFin), teinte);
    pousser(segment.t.slice(dedansFin), segment.c ?? null);
    curseur += longueur;
  }
  return sortie;
}
