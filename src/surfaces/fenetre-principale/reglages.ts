/**
 * L'écran des Réglages : la porte, trois raccourcis, une largeur, deux dossiers.
 *
 * Le fait qui définit cet écran est ce qu'il **ne porte pas**. Aucun curseur
 * d'opacité, aucun curseur de taille de texte, aucune largeur de fiche, aucune
 * position : les quatre réglages d'aspect se prennent sur l'Overlay lui-même
 * (ADR `0013`). Ce qui reste ici est exactement ce qui n'a pas de place sur
 * l'objet, et ça tient **sans défilement**.
 *
 * À la place des curseurs, une **porte** : elle ouvre un **décor factice** —
 * nommé comme tel — où l'opacité et la taille du texte se règlent sur une fiche.
 * Elle ouvre **toujours**, quelles que soient les quatre conditions : un écran
 * de réglages qui refuse de régler tant que le jeu n'est pas lancé serait muet
 * au premier lancement, quand on vient justement le voir.
 *
 * Le jeu reste le meilleur juge, et la porte le dit : l'Overlay déverrouillé
 * porte la **même barrette**, plus les deux gestes à la souris. Cette porte a
 * donc une charge que les autres blocs n'ont pas — **personne ne devine qu'on
 * attrape le bord droit d'une fiche**, elle est le seul texte qui le nomme, et
 * l'Overlay le seul objet qui le montre, en découvrant sa poignée dès qu'il est
 * déverrouillé.
 */

import { bouton, element } from './dom.ts';
import { iconeDeClasse } from './editeur.ts';
import { type Emplacement, type Etat, memo, type Segment, type Strat } from './pont.ts';
import { peindreSegments } from './texte-riche.ts';
import { type NomRaccourci, repeindre, vue } from './vue.ts';

/**
 * Les bornes et les règles, **recopiées** de `persistance/reglages.ts` et de
 * `main/raccourcis-regles.ts` — même choix que `noms.ts`, et pour la même
 * raison : une surface se compile comme son propre projet, sans API Node.
 *
 * Cette copie ne décide rien. Le processus principal reborne tout ce qu'il
 * reçoit et refuse une combinaison nue quoi qu'on lui envoie ; ce qui est ici
 * ne sert qu'à **montrer** — un curseur a besoin de ses deux bouts.
 */
const BORNES = {
  opacite: { min: 40, max: 100 },
  tailleTexte: { min: 11, max: 22 },
  ficheMiniFenetre: { min: 300, max: 700 },
} as const;

/** La largeur minimale d'une fiche d'Overlay, gelée par #5. */
const LARGEUR_MINI = 340;

/**
 * Les trois raccourcis, dans l'ordre de la maquette. Aucun ne se retire : ils se
 * **changent**. Le second ne le pourrait de toute façon pas — l'Overlay
 * verrouillé est traversé par les clics, cadenas compris, donc il est le seul
 * retour, et le vider le condamnerait.
 */
const RACCOURCIS: readonly (readonly [NomRaccourci, string, string])[] = [
  [
    'overlay',
    'Afficher / masquer l’overlay',
    'c’est l’Affichage demandé, le même que l’interrupteur du bas',
  ],
  [
    'verrou',
    'Verrouiller / déverrouiller l’overlay',
    'verrouillé, le cadenas de la fiche est traversé lui aussi : ce raccourci est le seul retour',
  ],
  [
    'fenetre',
    'Rappeler la fenêtre principale',
    'facultatif — la fenêtre se perd derrière le jeu en fenêtré sans bordure',
  ],
];

const MODIFICATEURS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'Dead']);

/**
 * La combinaison qu'une frappe désigne, ou `null` tant qu'elle n'en désigne
 * aucune. Une combinaison **nue** est refusée : un raccourci global prend la
 * touche à toutes les applications, donc capturer `A` coûterait la lettre A dans
 * le jeu, discussion comprise.
 */
function combinaisonDeLaFrappe(evenement: KeyboardEvent): string | null {
  const modificateurs = [
    evenement.ctrlKey ? 'Ctrl' : '',
    evenement.altKey ? 'Alt' : '',
    evenement.shiftKey ? 'Shift' : '',
    evenement.metaKey ? 'Super' : '',
  ].filter((nom) => nom !== '');
  const touche =
    evenement.key.length === 1
      ? evenement.key.toUpperCase()
      : MODIFICATEURS.has(evenement.key)
        ? null
        : evenement.key;
  if (touche === null || modificateurs.length === 0) return null;
  return [...modificateurs, touche].join('+');
}

/* ======================================================== les briques ==== */

/** La ligne d'un réglage : libellé, phrase d'explication, contrôles. */
function ligne(libelle: string, pourquoi: string, ...controles: HTMLElement[]): HTMLElement {
  const hote = element('div', 'line');
  const gauche = element('div', 'lbl');
  gauche.append(element('b', '', libelle));
  if (pourquoi !== '') gauche.append(element('span', 'why', pourquoi));
  const droite = element('div', 'ctl');
  droite.append(...controles);
  hote.append(gauche, droite);
  return hote;
}

function section(titre: string, ...lignes: HTMLElement[]): HTMLElement {
  const hote = element('div', 'sect');
  hote.append(element('h2', '', titre));
  const corps = element('div', 'lines');
  corps.append(...lignes);
  hote.append(corps);
  return hote;
}

function curseur(
  bornes: { min: number; max: number },
  pas: number,
  valeur: number,
  surCran: (valeur: number, curseur: HTMLInputElement) => void,
): HTMLInputElement {
  const glissiere = element('input');
  glissiere.type = 'range';
  glissiere.min = String(bornes.min);
  glissiere.max = String(bornes.max);
  glissiere.step = String(pas);
  glissiere.value = String(valeur);
  glissiere.addEventListener('input', () => surCran(Number(glissiere.value), glissiere));
  return glissiere;
}

/* =========================================================== la porte ==== */

/**
 * Ce qui remplace les curseurs, et **un seul geste, toujours le même** : on part
 * régler sur le décor factice, et on revient. Quelles que soient les quatre
 * conditions — Wakfu fermé, aucune Strat choisie, Affichage éteint —, l'opacité
 * et la taille du texte doivent rester réglables. Un écran de réglages qui
 * refuse de régler n'est pas un écran de réglages.
 *
 * ⚠️ Cela **assouplit l'ADR `0013`**, qui voulait que ces deux-là ne se jugent
 * que contre les pixels du jeu. Le jeu reste le meilleur juge, et la porte le
 * dit : sur l'Overlay déverrouillé, la barrette porte les deux mêmes curseurs.
 * Mais il n'est plus la seule porte, sans quoi le réglage disparaît dès que le
 * jeu n'est pas là.
 */
function porte(etat: Etat): HTMLElement {
  const hote = element('div', 'porte');
  const textes = element('div', 'txtcol');
  textes.append(element('h2', '', 'Régler l’overlay'));
  textes.append(
    element(
      'p',
      '',
      'L’opacité et la taille du texte se règlent ici, sur un décor factice, à tout moment — Wakfu lancé ou non, strat choisie ou non.',
    ),
  );
  // Le seul endroit qui nomme les gestes sur l'objet, et le raccourci qui y
  // donne accès : verrouillé, l'Overlay est traversé, donc rien d'autre n'ouvre.
  const verrou = etat.raccourcis?.['verrou']?.combinaison;
  textes.append(
    element(
      'p',
      '',
      `Sur le jeu, ${verrou ?? 'le raccourci du verrou'} déverrouille l’overlay : glisse la fiche pour la placer, attrape son bord droit pour la largeur, et la barrette du bas porte les deux mêmes curseurs — c’est là que l’opacité se juge contre les vrais pixels.`,
    ),
  );
  hote.append(textes);
  hote.append(
    bouton('cta', 'Régler maintenant', () => {
      vue.decorFactice = true;
      repeindre();
    }),
  );
  return hote;
}

/* ===================================================== les trois blocs === */

function lignesDesRaccourcis(etat: Etat): HTMLElement[] {
  return RACCOURCIS.map(([nom, libelle, pourquoi]) => {
    const pose = etat.raccourcis?.[nom] ?? { combinaison: null, etat: 'absent' as const };
    const enCapture = vue.captureRaccourci === nom;
    const touche = bouton(
      `kbd ${enCapture ? 'cap' : ''}`.trim(),
      enCapture ? 'appuyez sur une combinaison…' : (pose.combinaison ?? 'aucun'),
      (evenement) => {
        vue.captureRaccourci = enCapture ? null : nom;
        // Sans ça, le clic remonte au document, qui referme la capture qu'on
        // vient d'ouvrir.
        evenement.stopPropagation();
        repeindre();
      },
    );
    // Aucun « retirer » : un raccourci se CHANGE. Celui du verrou ne peut pas
    // disparaître — il est le seul retour d'un Overlay verrouillé —, et les deux
    // autres n'y gagnaient rien qu'une case vide de plus à comprendre.
    const controles: HTMLElement[] = [touche];
    // Le système est le seul à savoir si une combinaison est libre, et un
    // raccourci qu'il a refusé doit se lire quelque part.
    if (pose.etat === 'refuse') {
      controles.push(element('span', 'refuse', 'refusé par le système — déjà pris ailleurs'));
    }
    return ligne(libelle, pourquoi, ...controles);
  });
}

/**
 * La largeur minimale d'une fiche **dans la grille de la Fenêtre principale**.
 * Ce n'est pas la largeur de la fiche de l'Overlay, qui s'attrape à son bord
 * droit : deux grandeurs de natures différentes, et l'autre ne figure même pas
 * sur cet écran, ce qui règle la confusion que #21 craignait.
 */
function ligneDeLaLargeur(etat: Etat): HTMLElement {
  const lu = element('span', 'val', `${etat.ficheMiniFenetre} px`);
  const glissiere = curseur(BORNES.ficheMiniFenetre, 10, etat.ficheMiniFenetre, (valeur, champ) => {
    lu.textContent = `${valeur} px`;
    champ.title = `${colonnes(valeur)} colonnes à la taille actuelle de la fenêtre`;
    memo?.poserFicheMiniFenetre(valeur);
  });
  const nombre = colonnes(etat.ficheMiniFenetre);
  return ligne(
    'Largeur minimale d’une fiche',
    `dans l’écran des strats — ${nombre} colonne${nombre > 1 ? 's' : ''} à la taille actuelle de la fenêtre`,
    glissiere,
    lu,
  );
}

/**
 * Ce que la grille des Tours peut tenir : la colonne latérale, la colonne de la
 * composition et les marges ne sont pas de la grille, et `auto-fill` place
 * `floor((large + gouttière) / (mini + gouttière))` colonnes. Les nombres
 * viennent de `coque.css` — s'ils y bougent, cette phrase ment.
 */
const HORS_GRILLE = 206 + 1 + 64 + 1 + 36;
const GOUTTIERE = 12;

function colonnes(mini: number): number {
  const large = window.innerWidth - HORS_GRILLE;
  return Math.max(1, Math.floor((large + GOUTTIERE) / (mini + GOUTTIERE)));
}

/**
 * Les deux dossiers. L'arbitrage entre deux installations de Wakfu **tient
 * toujours** — on départage sur le `wakfu.log` le plus récemment modifié (ADR
 * `0014`) — mais il a cessé d'être un écran : personne ne joue sur deux Wakfu
 * différents. On montre le dossier retenu, et le secours qui le remplace.
 */
function lignesDesDossiers(etat: Etat): HTMLElement[] {
  const manuel = etat.dossierLogsManuel;
  const trouve = etat.conditions['logsTrouves'] === true;
  const chemin = element(
    'span',
    `path ${trouve ? '' : 'non'}`.trim(),
    manuel ?? etat.dossierLogs ?? 'aucun dossier trouvé',
  );

  const gestesLogs: HTMLElement[] = [
    chemin,
    bouton('', 'Désigner un dossier…', () => void memo?.designerDossierLogs()),
  ];
  if (manuel !== null) {
    gestesLogs.push(bouton('ghost', 'retrouver tout seul', () => memo?.oublierDossierLogs()));
  }

  return [
    ligne(
      'Dossier de logs',
      trouve
        ? manuel !== null
          ? 'désigné à la main — un dossier désigné suspend la découverte automatique'
          : 'trouvé tout seul, sur le wakfu.log le plus récemment modifié'
        : 'aucun wakfu.log lisible ici, et sans lui l’overlay ne se dessine pas : c’est la deuxième ligne du socle, à gauche',
      ...gestesLogs,
    ),
    ligne(
      'Dossier de données',
      'les trois fichiers de l’app : réglages, roster, strats',
      element('span', 'path', etat.dossierDonnees),
      bouton('', 'Ouvrir le dossier', () => memo?.ouvrirDossierDonnees()),
    ),
  ];
}

/* ============================================================= l'écran == */

export function ecranReglages(etat: Etat): DocumentFragment {
  const hote = document.createDocumentFragment();
  const tete = element('div', 'scrhead');
  tete.append(element('h1', '', 'Réglages'));
  tete.append(element('p', 'why', 'l’aspect de l’overlay se règle sur l’overlay'));
  hote.append(tete);

  const corps = element('div', 'scrbody');
  corps.append(porte(etat));
  corps.append(section('Raccourcis', ...lignesDesRaccourcis(etat)));
  corps.append(section('La fenêtre principale', ligneDeLaLargeur(etat)));
  corps.append(section('Chemins et données', ...lignesDesDossiers(etat)));
  hote.append(corps);
  return hote;
}

/* ==================================================== le décor factice == */

const laStratChoisie = (etat: Etat): Strat | undefined =>
  etat.strats.find((strat) => strat.id === etat.stratChoisieId);

/** Le cadenas de la fiche, anse basculée : le même dessin que sur l'Overlay. */
function cadenasOuvert(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const dessin = document.createElementNS(NS, 'svg');
  dessin.setAttribute('width', '11');
  dessin.setAttribute('height', '13');
  dessin.setAttribute('viewBox', '0 0 11 13');
  dessin.setAttribute('fill', 'none');
  dessin.setAttribute('stroke', 'currentColor');
  dessin.setAttribute('stroke-width', '1.3');
  dessin.setAttribute('aria-hidden', 'true');
  const corps = document.createElementNS(NS, 'rect');
  const attributs: readonly (readonly [string, string])[] = [
    ['x', '0.7'],
    ['y', '5.6'],
    ['width', '9.6'],
    ['height', '6.7'],
    ['rx', '1.4'],
    ['fill', 'currentColor'],
    ['stroke', 'none'],
    ['opacity', '.85'],
  ];
  for (const [nom, valeur] of attributs) corps.setAttribute(nom, valeur);
  const anse = document.createElementNS(NS, 'path');
  // L'anse basculée à droite : déverrouillé, comme l'Overlay pendant le réglage.
  anse.setAttribute('d', 'M2.9 5.6V3.6a2.6 2.6 0 0 1 5.2 0');
  dessin.append(corps, anse);
  return dessin;
}

type LigneFactice = { readonly emplacement: Emplacement; readonly consigne: readonly Segment[] };

type ContenuFactice = {
  readonly nom: string;
  readonly global: readonly Segment[];
  readonly note: string | null;
  readonly lignes: readonly LigneFactice[];
};

const EXEMPLE_LIGNES: readonly (readonly [string, string, string])[] = [
  ['iop', 'rouge', 'entre en dernier'],
  ['eniripsa', 'jaune', 'reste à 3 cases'],
  ['osamodas', 'vert', 'invoque le Tofu'],
  ['cra', 'bleu', 'ligne de tir sur le boss'],
];

/**
 * La fiche qu'on règle quand aucune Strat n'est choisie.
 *
 * ⚠️ C'est un **spécimen**, exactement ce que la forme retenue avait écarté — et
 * c'est assumé : sans lui, l'opacité et la taille du texte seraient irréglables
 * tant qu'une Strat n'existe pas, c'est-à-dire au premier lancement, quand on
 * ouvre les Réglages justement pour ça. Il est nommé comme tel dans sa barre, et
 * il ne paraît jamais quand il y a une vraie fiche à montrer. Les six lignes
 * viennent de la maquette de #23, pas d'une invention de plus.
 */
const EXEMPLE: ContenuFactice = {
  nom: 'Fiche d’exemple',
  global: [{ t: 'Placement haut-droite, personne au contact' }],
  note: '(TP SUR HUPPER)',
  lignes: EXEMPLE_LIGNES.map(([classe, couleur, consigne]) => ({
    emplacement: { id: classe, classe, couleur },
    consigne: [{ t: consigne }],
  })),
};

/** Le Tour 1 de la Strat choisie, ou le spécimen s'il n'y en a pas. */
function contenuFactice(strat: Strat | undefined): ContenuFactice {
  if (strat === undefined) return EXEMPLE;
  const tour = strat.tours[0];
  return {
    nom: strat.nom === '' ? 'Sans nom' : strat.nom,
    global: tour?.global ?? [],
    note: tour?.note ?? null,
    lignes: strat.emplacements.map((emplacement) => ({
      emplacement,
      consigne: tour?.consignes[emplacement.id] ?? [],
    })),
  };
}

/**
 * La fiche du Tour 1, telle que l'Overlay la dessinerait hors combat : aucune
 * Mise en avant, puisque rien ne joue. C'est une **copie** du peintre de
 * `surfaces/overlay-tour/`, et elle n'a qu'un objet — donner aux gestes quelque
 * chose à déplacer quand le jeu n'est pas là.
 */
function ficheFactice(etat: Etat, contenu: ContenuFactice): HTMLElement {
  const fiche = element('div', 'fiche');
  fiche.style.fontSize = `${etat.aspect.tailleTexte}px`;

  const barre = element('div', 'stratbar');
  barre.append(element('span', 'stratpick', contenu.nom));
  barre.append(element('div', 'grow'));
  // Le cadenas ferme le décor comme il reverrouille l'Overlay : c'est le geste
  // qu'il faut avoir appris avant d'être devant le jeu.
  const cadenas = bouton('cadenas', '', () => fermerLeDecor());
  cadenas.title = 'reverrouiller — ici, ça ferme le décor factice';
  cadenas.append(cadenasOuvert());
  barre.append(cadenas);
  fiche.append(barre);

  const entete = element('header');
  entete.append(element('span', 'tnum', 'T1'));
  const global = element('span', 'glob');
  peindreSegments(global, contenu.global);
  entete.append(global);
  fiche.append(entete);

  const lignes = element('div', 'rows');
  for (const { emplacement, consigne } of contenu.lignes) {
    const rangee = element('div', 'row');
    rangee.append(iconeDeClasse(emplacement, 'sm'));
    const texte = element('div', `cons ${consigne.length === 0 ? 'vide' : ''}`.trim());
    if (consigne.length === 0) texte.textContent = '—';
    else peindreSegments(texte, consigne);
    rangee.append(texte);
    lignes.append(rangee);
  }
  fiche.append(lignes);

  if (contenu.note !== null && contenu.note !== '') {
    const note = element('p', 'note');
    note.append(element('span', 'arrow', '↳'), element('span', 'txt', contenu.note));
    fiche.append(note);
  }
  return fiche;
}

/** Un geste est en cours sur le décor : un instantané ne doit rien reconstruire. */
let enGeste = false;

export const gesteSurLeDecor = (): boolean => enGeste;

function fermerLeDecor(): void {
  vue.decorFactice = false;
  repeindre();
}

/** Le glisser d'un pointeur, rapporté une seule fois au relâchement. */
function glisser(
  saisie: HTMLElement,
  depart: PointerEvent,
  suivre: (mouvement: PointerEvent) => void,
  relacher: () => void,
): void {
  enGeste = true;
  saisie.setPointerCapture(depart.pointerId);
  const bouger = (mouvement: PointerEvent): void => suivre(mouvement);
  const finir = (): void => {
    saisie.removeEventListener('pointermove', bouger);
    saisie.removeEventListener('pointerup', finir);
    saisie.removeEventListener('pointercancel', finir);
    enGeste = false;
    relacher();
  };
  saisie.addEventListener('pointermove', bouger);
  saisie.addEventListener('pointerup', finir);
  saisie.addEventListener('pointercancel', finir);
}

/**
 * Le décor factice : un plateau qui n'est pas le jeu et le dit, la fiche
 * dessus, et la barrette collée en bas — le même aller-retour que sur le jeu.
 *
 * Le plateau porte **une zone très claire et une zone très sombre**, et ce n'est
 * pas de la décoration : l'opacité ne se juge que contre les pixels qu'elle
 * laisse passer, donc un fond uni ne se jugerait pas du tout.
 */
function decorFactice(etat: Etat): HTMLElement {
  const hote = element('div', 'decor');
  const plateau = element('div', 'plateau');
  plateau.append(
    element('div', 'fauxwakfu', 'Décor factice — ce n’est pas le jeu, et l’overlay non plus'),
  );

  const objet = element('div', 'ovl');
  objet.style.width = `${Math.max(LARGEUR_MINI, etat.aspect.largeur)}px`;
  objet.style.opacity = String(etat.aspect.opacite / 100);
  objet.style.left = `${Math.max(0, etat.aspect.x)}px`;
  objet.style.top = `${Math.max(34, etat.aspect.y)}px`;

  const fiche = ficheFactice(etat, contenuFactice(laStratChoisie(etat)));
  const poignee = element('div', 'poignee-largeur');
  poignee.title = 'glisser : la largeur de la fiche';
  objet.append(fiche, poignee);
  plateau.append(objet);
  hote.append(plateau);

  /* --- les deux gestes sur l'objet, ceux que la porte doit apprendre ----- */

  const mesures = element('span', 'why');
  const direLesMesures = (): void => {
    mesures.textContent = `largeur ${Math.round(objet.offsetWidth)} px · x ${Math.round(objet.offsetLeft)} · y ${Math.round(objet.offsetTop)}`;
  };

  // La position se prend en déplaçant la fiche, jamais dans un champ. La barre
  // de Strat et l'en-tête sont les poignées ; les lignes ne le sont pas, ce sont
  // elles que l'Échange par clic cliquera un jour.
  const prises = [fiche.querySelector<HTMLElement>('.stratbar'), fiche.querySelector('header')];
  for (const prise of prises) {
    if (prise === null) continue;
    prise.addEventListener('pointerdown', (pointeur) => {
      if (pointeur.button !== 0) return;
      if ((pointeur.target as HTMLElement).closest('button') !== null) return;
      const boite = objet.getBoundingClientRect();
      const cadre = plateau.getBoundingClientRect();
      const saisiA = { x: pointeur.clientX - boite.x, y: pointeur.clientY - boite.y };
      let x = boite.x - cadre.x;
      let y = boite.y - cadre.y;
      glisser(
        prise,
        pointeur,
        (mouvement) => {
          x = Math.max(
            0,
            Math.min(mouvement.clientX - saisiA.x - cadre.x, cadre.width - boite.width),
          );
          y = Math.max(
            0,
            Math.min(mouvement.clientY - saisiA.y - cadre.y, cadre.height - boite.height),
          );
          objet.style.left = `${Math.round(x)}px`;
          objet.style.top = `${Math.round(y)}px`;
          direLesMesures();
        },
        // ⚠️ Ce qui part sur le disque est une position **dans la fenêtre du
        // jeu**, et le plateau en tient lieu. Il n'a pas sa taille : la fiche
        // retombera plus près du coin haut-gauche sur un grand écran, et
        // l'Overlay reborne de toute façon ce qu'il dessine.
        () => memo?.poserPositionFiche(Math.round(x), Math.round(y)),
      );
    });
  }

  poignee.addEventListener('pointerdown', (pointeur) => {
    if (pointeur.button !== 0) return;
    const boite = objet.getBoundingClientRect();
    const saisiA = pointeur.clientX - (boite.x + boite.width);
    let largeur = objet.offsetWidth;
    glisser(
      poignee,
      pointeur,
      (mouvement) => {
        largeur = Math.max(LARGEUR_MINI, Math.round(mouvement.clientX - saisiA - boite.x));
        objet.style.width = `${largeur}px`;
        direLesMesures();
      },
      () => memo?.poserLargeurFiche(largeur),
    );
  });
  poignee.addEventListener('dblclick', () => memo?.poserLargeurFiche(null));

  /* --- la barrette : ce qui n'a pas de poignée sur l'objet --------------- */

  const barrette = element('div', 'barrette');
  barrette.append(element('span', 'tag', 'décor factice'));

  const opacite = element('span', 'val', `${etat.aspect.opacite} %`);
  const groupeOpacite = element('div', 'grp');
  groupeOpacite.append(
    element('label', '', 'opacité'),
    curseur(BORNES.opacite, 1, etat.aspect.opacite, (valeur) => {
      objet.style.opacity = String(valeur / 100);
      opacite.textContent = `${valeur} %`;
      memo?.poserAspect({ opacite: valeur });
    }),
    opacite,
  );

  const taille = element('span', 'val', `${etat.aspect.tailleTexte} px`);
  const groupeTaille = element('div', 'grp');
  groupeTaille.append(
    element('label', '', 'texte'),
    curseur(BORNES.tailleTexte, 1, etat.aspect.tailleTexte, (valeur) => {
      fiche.style.fontSize = `${valeur}px`;
      taille.textContent = `${valeur} px`;
      direLesMesures();
      memo?.poserAspect({ tailleTexte: valeur });
    }),
    taille,
  );

  barrette.append(groupeOpacite, groupeTaille, element('div', 'grow'), mesures);
  barrette.append(bouton('fin', 'Terminé', () => fermerLeDecor()));
  hote.append(barrette);

  // Après l'insertion : les mesures se lisent sur la boîte, qui n'existe pas
  // encore. Un `requestAnimationFrame` suffit, la barrette étant déjà peinte.
  requestAnimationFrame(direLesMesures);
  return hote;
}

export function calquesReglages(etat: Etat): HTMLElement[] {
  return vue.decorFactice ? [decorFactice(etat)] : [];
}

/* ============================================== la capture d'un raccourci */

/**
 * Une frappe, et c'est fini. En phase de **capture** et propagation arrêtée :
 * sans ça, Échap fermerait aussi ce que la coque ferme sur Échap, et une
 * combinaison passerait au reste de la fenêtre avant d'être lue.
 */
document.addEventListener(
  'keydown',
  (evenement) => {
    const cible = vue.captureRaccourci;
    if (cible === null) return;
    evenement.preventDefault();
    evenement.stopPropagation();
    if (evenement.key === 'Escape') {
      vue.captureRaccourci = null;
      repeindre();
      return;
    }
    // Un modificateur tenu seul n'est pas une combinaison : on attend la suite.
    const combinaison = combinaisonDeLaFrappe(evenement);
    if (combinaison === null) return;
    vue.captureRaccourci = null;
    memo?.poserRaccourci(cible, combinaison);
    repeindre();
  },
  true,
);
