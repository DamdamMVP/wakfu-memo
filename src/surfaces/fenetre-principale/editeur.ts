/**
 * L'intérieur d'une Strat : la composition à gauche, les fiches de Tour à
 * droite.
 *
 * La forme est celle que #5 a figée et que #21 n'a pas rediscutée — une fiche
 * par Tour, en-tête `T1` plus description globale, une ligne par Emplacement,
 * note en pied — plus les trois choses que #21 a tranchées : la colonne
 * **serrée** de 64 px, la palette de coloration **permanente** dans cette
 * colonne, et les fiches en **grille** dont le seul réglage est une largeur
 * minimale.
 *
 * Rien n'est calculé ici. Un geste devient une `CommandeEdition` et part :
 * `persistance/edition-strats.ts` choisit la Couleur libre, échange celle qui
 * est prise, renumérote les Rangs, emporte les Consignes d'un Emplacement
 * supprimé. Cette surface n'est qu'une main.
 */

import { element } from './dom.ts';
import {
  CLASSES,
  COULEURS,
  type Emplacement,
  editer,
  hexaDeCouleur,
  MAX_EMPLACEMENTS,
  memo,
  nomDeClasse,
  type Segment,
  type Strat,
} from './pont.ts';
import {
  bornesDeLaSelection,
  colorer,
  lireSegments,
  peindreSegments,
  poserLaSelection,
  TEINTES,
} from './texte-riche.ts';
import { ancrer, repeindre, vue } from './vue.ts';

/**
 * L'icône de classe : carrée, sans arrondi, et le liseré de Couleur de 3 px
 * collé à son bord gauche (#5, ADR 0003). Le filet sombre est dans la feuille de
 * style, sur `.edge`.
 */
export function iconeDeClasse(emplacement: Emplacement, taille: string): HTMLElement {
  const hote = element('span', `cls ${taille}`.trim());
  const liseret = element('span', 'edge');
  // Le modèle porte le MOT, le CSS veut la teinte.
  liseret.style.setProperty('--c', hexaDeCouleur(emplacement.couleur));
  const portrait = element('img');
  // La clé de Classe nomme le portrait, jamais le `breed`, dont la numérotation
  // a un trou (`domaine/classes.ts`).
  portrait.src = `../../icons/${emplacement.classe}.png`;
  portrait.alt = '';
  portrait.title = `${nomDeClasse(emplacement.classe)} — ${emplacement.couleur}`;
  hote.append(liseret, portrait);
  return hote;
}

/* ==================================================== les textes libres === */

/**
 * Un champ libre. Deux gardes, et les deux sont là pour le modèle :
 *
 *  - **Entrée est refusée** : le modèle n'a pas de retour à la ligne et
 *    l'Overlay ne saurait pas le dessiner ;
 *  - **un collage devient du texte brut**, sauts de ligne compris. Sans ça, une
 *    Consigne collée depuis un document Word apporterait sa mise en forme, qui
 *    disparaîtrait à la première relecture du fichier — l'utilisateur croirait
 *    l'avoir perdue.
 */
function champLibre(classe: string, invite: string): HTMLElement {
  const champ = element('div', classe);
  champ.contentEditable = 'true';
  champ.dataset['ph'] = invite;
  champ.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter') evenement.preventDefault();
  });
  champ.addEventListener('paste', (evenement) => {
    evenement.preventDefault();
    const brut = evenement.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, brut.replace(/\s*\r?\n\s*/gu, ' '));
  });
  return champ;
}

function champRiche(
  classe: string,
  invite: string,
  segments: readonly Segment[],
  poser: (segments: readonly Segment[]) => void,
): HTMLElement {
  const champ = champLibre(classe, invite);
  // Ce qui dit à la palette que ce champ accepte la couleur. La note ne l'a pas :
  // elle est du texte brut, son italique ambre étant sa signature.
  champ.dataset['riche'] = '';
  peindreSegments(champ, segments);
  champ.addEventListener('input', () => poser(lireSegments(champ)));
  return champ;
}

function champTexte(
  classe: string,
  invite: string,
  texte: string,
  poser: (texte: string) => void,
): HTMLElement {
  const champ = champLibre(classe, invite);
  champ.textContent = texte;
  champ.addEventListener('input', () => poser(champ.textContent ?? ''));
  return champ;
}

/* ======================================================== la composition = */

/** Ce que la souris tient, entre `dragstart` et `drop`. */
let pris: { stratId: string; emplacementId: string } | null = null;

/** Idem pour un Tour : c'est sa pastille `T1` qui se glisse, pas la fiche. */
let tourPris: { stratId: string; tour: number } | null = null;

function place(strat: Strat, emplacement: Emplacement, rang: number): HTMLElement {
  const hote = element('div', 'slot');
  hote.draggable = true;
  hote.append(element('span', 'rank', String(rang)), iconeDeClasse(emplacement, 'lg'));

  hote.addEventListener('click', (evenement) => {
    const boite = hote.getBoundingClientRect();
    const memeCible =
      vue.panneau?.stratId === strat.id && vue.panneau.emplacementId === emplacement.id;
    vue.menu = null;
    vue.panneau = memeCible
      ? null
      : {
          stratId: strat.id,
          emplacementId: emplacement.id,
          x: boite.right + 6,
          y: boite.top - 8,
        };
    evenement.stopPropagation();
    repeindre();
  });

  // Glisser-déposer : #14 l'a choisi contre un champ numérique, #5 l'a figé.
  // Déposer INSÈRE, il n'échange pas deux places — c'est ce que « réordonner la
  // composition change les Rangs » veut dire.
  hote.addEventListener('dragstart', (evenement) => {
    pris = { stratId: strat.id, emplacementId: emplacement.id };
    hote.classList.add('drag');
    if (evenement.dataTransfer !== null) evenement.dataTransfer.effectAllowed = 'move';
  });
  hote.addEventListener('dragend', () => {
    pris = null;
    hote.classList.remove('drag');
  });
  hote.addEventListener('dragover', (evenement) => {
    if (pris === null || pris.stratId !== strat.id) return;
    evenement.preventDefault();
    if (pris.emplacementId !== emplacement.id) hote.classList.add('over');
  });
  hote.addEventListener('dragleave', () => hote.classList.remove('over'));
  hote.addEventListener('drop', (evenement) => {
    if (pris === null || pris.stratId !== strat.id) return;
    evenement.preventDefault();
    hote.classList.remove('over');
    void editer({
      sorte: 'deplacer-emplacement',
      stratId: strat.id,
      emplacementId: pris.emplacementId,
      vers: rang - 1,
    });
    pris = null;
  });

  return hote;
}

/**
 * La palette de coloration, permanente sous la composition. #5 avait gelé les
 * dix teintes et le retrait des raccourcis clavier, en laissant le placement aux
 * maquettes ; #21 l'a tranché : dans la colonne, deux par ligne, pastilles
 * carrées, et une case hachurée qui retire la couleur.
 */
function palette(): HTMLElement {
  const hote = element('div', 'palette');
  const poser = (teinte: string | null, pastille: HTMLElement): void => {
    pastille.addEventListener('mousedown', (evenement) => {
      // Sans ce `preventDefault`, le clic vole le focus et la sélection
      // disparaît avant qu'on ait pu la colorer. Invisible, et ça casse en
      // silence : c'était déjà noté dans le prototype de #5.
      evenement.preventDefault();
      const actif = document.activeElement;
      // La note n'est pas colorable : elle est du texte brut, son italique ambre
      // étant sa signature.
      if (!(actif instanceof HTMLElement) || actif.dataset['riche'] === undefined) return;
      const bornes = bornesDeLaSelection(actif);
      if (bornes === null || bornes.fin === bornes.debut) return;
      peindreSegments(actif, colorer(lireSegments(actif), bornes.debut, bornes.fin, teinte));
      poserLaSelection(actif, bornes.debut, bornes.fin);
      // Le champ remonte au modèle par sa propre porte : un seul chemin d'écriture.
      actif.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  for (const [nom, hexa] of TEINTES) {
    const bouton = element('button', 'swatch');
    bouton.type = 'button';
    bouton.title = nom;
    bouton.style.background = hexa;
    poser(hexa, bouton);
    hote.append(bouton);
  }
  const nette = element('button', 'swatch clear');
  nette.type = 'button';
  nette.title = 'retirer la couleur';
  poser(null, nette);
  hote.append(nette);
  return hote;
}

function colonne(strat: Strat): HTMLElement {
  const hote = element('aside', 'compo');
  hote.title = "L'ordre est le Rang : glisser pour le corriger.";
  hote.append(element('h2', '', 'Compo'));

  const places = element('div', 'slots');
  strat.emplacements.forEach((emplacement, index) => {
    places.append(place(strat, emplacement, index + 1));
  });

  // Le ＋ disparaît à six : « la colonne se ferme d'elle-même » (#5). Le maximum
  // ne s'écrit nulle part, il se voit.
  if (strat.emplacements.length < MAX_EMPLACEMENTS) {
    const plus = element('button', 'plus', '＋');
    plus.type = 'button';
    plus.title = 'ajouter un emplacement';
    plus.addEventListener('click', (evenement) => {
      const boite = plus.getBoundingClientRect();
      vue.menu = null;
      vue.panneau =
        vue.panneau?.emplacementId === null && vue.panneau.stratId === strat.id
          ? null
          : { stratId: strat.id, emplacementId: null, x: boite.right + 6, y: boite.top - 8 };
      evenement.stopPropagation();
      repeindre();
    });
    places.append(plus);
  }

  hote.append(places, palette());
  return hote;
}

/* ====================================================== les fiches de Tour */

/**
 * La poignée d'un Tour est sa **pastille numérotée**, jamais la fiche entière :
 * un `draggable` posé sur la carte empêcherait de sélectionner du texte dans les
 * Consignes qu'elle contient, et cette sélection est ce qui sert à colorer.
 *
 * Déposer sur une autre fiche **insère** — même geste et même règle que le Rang
 * dans la composition. C'est le retour en arrière d'un Tour supprimé par
 * erreur : on en rajoute un, il arrive en dernier, on le ramène à sa place.
 */
function poigneeDuTour(strat: Strat, numero: number, carte: HTMLElement): HTMLElement {
  const pastille = element('span', 'tnum', `T${numero + 1}`);
  pastille.draggable = true;
  pastille.title = 'glisser : déplacer ce tour';
  pastille.addEventListener('dragstart', (evenement) => {
    tourPris = { stratId: strat.id, tour: numero };
    carte.classList.add('drag');
    if (evenement.dataTransfer !== null) {
      evenement.dataTransfer.effectAllowed = 'move';
      // Sans ça l'image traînée est la pastille seule, et on ne voit pas ce
      // qu'on déplace.
      evenement.dataTransfer.setDragImage(carte, 30, 20);
    }
  });
  pastille.addEventListener('dragend', () => {
    tourPris = null;
    carte.classList.remove('drag');
  });

  carte.addEventListener('dragover', (evenement) => {
    if (tourPris === null || tourPris.stratId !== strat.id) return;
    evenement.preventDefault();
    if (tourPris.tour !== numero) carte.classList.add('over');
  });
  carte.addEventListener('dragleave', () => carte.classList.remove('over'));
  carte.addEventListener('drop', (evenement) => {
    if (tourPris === null || tourPris.stratId !== strat.id) return;
    evenement.preventDefault();
    carte.classList.remove('over');
    void editer({ sorte: 'deplacer-tour', stratId: strat.id, tour: tourPris.tour, vers: numero });
    tourPris = null;
  });

  return pastille;
}

function fiche(strat: Strat, numero: number): HTMLElement {
  const tour = strat.tours[numero];
  const carte = element('div', 'card');

  const entete = element('header');
  entete.append(poigneeDuTour(strat, numero, carte));
  entete.append(
    champRiche('glob', 'description du tour…', tour?.global ?? [], (segments) => {
      void editer({ sorte: 'poser-global', stratId: strat.id, tour: numero, segments });
    }),
  );
  const retirer = element('button', 'ghost del', '×');
  retirer.type = 'button';
  retirer.title = 'supprimer le tour';
  retirer.addEventListener('click', () => {
    void editer({ sorte: 'supprimer-tour', stratId: strat.id, tour: numero });
  });
  entete.append(retirer);
  carte.append(entete);

  const lignes = element('div', 'rows');
  for (const emplacement of strat.emplacements) {
    const ligne = element('div', 'row');
    ligne.append(iconeDeClasse(emplacement, 'sm'));
    ligne.append(
      champRiche('cons', 'consigne…', tour?.consignes[emplacement.id] ?? [], (segments) => {
        void editer({
          sorte: 'poser-consigne',
          stratId: strat.id,
          tour: numero,
          emplacementId: emplacement.id,
          segments,
        });
      }),
    );
    lignes.append(ligne);
  }
  if (strat.emplacements.length === 0) {
    lignes.append(
      element('div', 'vide', 'Déclarer la composition à gauche pour avoir des lignes de consigne.'),
    );
  }
  carte.append(lignes);

  const note = element('div', 'note');
  note.append(element('span', 'arrow', '↳'));
  note.append(
    champTexte('txt', 'annotation après ce tour…', tour?.note ?? '', (texte) => {
      void editer({ sorte: 'poser-note', stratId: strat.id, tour: numero, note: texte });
    }),
  );
  carte.append(note);

  return carte;
}

function fiches(strat: Strat): HTMLElement {
  const hote = element('section', 'turns');
  if (strat.tours.length === 0) {
    // Ce que #18 a gelé, dit sans dramatiser : l'Overlay dessinerait quand même
    // la fiche du Tour 1 et ses lignes vides.
    hote.append(
      element(
        'p',
        'noturn large',
        'Aucun tour. L’overlay dessinerait quand même la fiche T1 et ses lignes vides.',
      ),
    );
  }
  for (let numero = 0; numero < strat.tours.length; numero += 1) {
    hote.append(fiche(strat, numero));
  }

  const ajouter = element('button', 'addturn large', `＋ Tour ${strat.tours.length + 1}`);
  ajouter.type = 'button';
  ajouter.addEventListener('click', () => {
    void editer({ sorte: 'ajouter-tour', stratId: strat.id });
  });
  hote.append(ajouter);
  return hote;
}

export function editeur(strat: Strat): HTMLElement {
  const hote = element('div', 'ed');
  hote.append(colonne(strat), fiches(strat));
  return hote;
}

/* =============================================== le panneau d'une place == */

/**
 * Supprimer un Emplacement emporte ses Consignes dans **tous** les Tours : sept
 * Tours remplis, c'est sept Consignes qui partent d'un clic. Donc on demande —
 * mais seulement s'il y a quelque chose à perdre : une suppression annonce le
 * compte de ce qui part, et quand ce compte est nul il n'y a rien à annoncer.
 *
 * Le compte vient de la fonction même qui appliquera la cascade : elle est pure,
 * donc le demander ne coûte rien, et la phrase ne peut pas dériver de l'acte.
 *
 * ⚠️ Un Emplacement n'a **ni libellé ni pseudo** (ADR 0003) : la question le
 * désigne donc par sa classe et sa Couleur — « l'emplacement Iop rouge » — ce
 * qui est exactement le nom qu'on lui donne à voix haute.
 */
function boutonDeSuppression(strat: Strat, emplacement: Emplacement): HTMLElement {
  const retirer = element('button', 'del', 'Supprimer cet emplacement');
  retirer.type = 'button';
  retirer.addEventListener('click', () => {
    void (async () => {
      const consequence = await memo?.consequenceSuppressionEmplacement(strat.id, emplacement.id);
      vue.panneau = null;
      if (consequence === undefined || consequence.consignesPerdues === 0) {
        void editer({
          sorte: 'supprimer-emplacement',
          stratId: strat.id,
          emplacementId: emplacement.id,
        });
      } else {
        vue.aSupprimer = {
          sorte: 'emplacement',
          stratId: strat.id,
          emplacementId: emplacement.id,
          designation: `l’emplacement ${nomDeClasse(emplacement.classe)} ${emplacement.couleur}`,
          consignes: consequence.consignesPerdues,
        };
      }
      repeindre();
    })();
  });
  return retirer;
}

/**
 * La classe, la Couleur, et la suppression d'un Emplacement — regroupées ici
 * parce que la colonne de 64 px n'a la place ni du bouton de Couleur ni du ✕ que
 * #5 posait sur la ligne.
 *
 * La suppression **emporte les Consignes** de cet Emplacement dans tous les
 * Tours, et elle le dit avant : voir `boutonDeSuppression`.
 */
export function panneauDeLaPlace(strat: Strat): HTMLElement | null {
  const ouvert = vue.panneau;
  if (ouvert === null || ouvert.stratId !== strat.id) return null;
  const ajout = ouvert.emplacementId === null;
  const vise = ajout
    ? undefined
    : strat.emplacements.find((candidat) => candidat.id === ouvert.emplacementId);
  if (!ajout && vise === undefined) return null;

  const hote = element('div', 'slotpop');
  hote.addEventListener('click', (evenement) => evenement.stopPropagation());
  hote.append(element('h5', '', ajout ? 'Ajouter un emplacement' : 'Classe'));

  // La grille des 18 que #5 a figée, six par ligne, la classe courante cerclée.
  const grille = element('div', 'clsgrid');
  for (const [cle, nom] of CLASSES) {
    const portrait = element('img');
    portrait.src = `../../icons/${cle}.png`;
    portrait.alt = nom;
    portrait.title = nom;
    if (vise?.classe === cle) portrait.className = 'cur';
    portrait.addEventListener('click', () => {
      vue.panneau = null;
      void editer(
        ajout
          ? { sorte: 'ajouter-emplacement', stratId: strat.id, classe: cle }
          : {
              sorte: 'poser-classe',
              stratId: strat.id,
              emplacementId: ouvert.emplacementId ?? '',
              classe: cle,
            },
      );
      repeindre();
    });
    grille.append(portrait);
  }
  hote.append(grille);

  if (vise !== undefined) {
    hote.append(element('h5', '', 'Couleur'));
    const rangee = element('div', 'colrow');
    for (const [nom, hexa] of COULEURS) {
      // On compare et on envoie le MOT ; l'hexa ne sert qu'à peindre la pastille.
      const prise = strat.emplacements.some(
        (candidat) => candidat.id !== vise.id && candidat.couleur === nom,
      );
      const pastille = element('button');
      pastille.type = 'button';
      pastille.style.background = hexa;
      pastille.className = `${vise.couleur === nom ? 'cur' : ''} ${prise ? 'taken' : ''}`.trim();
      pastille.title = `${nom}${prise ? ' — déjà prise, elle sera échangée' : ''}`;
      pastille.addEventListener('click', () => {
        void editer({
          sorte: 'poser-couleur',
          stratId: strat.id,
          emplacementId: vise.id,
          couleur: nom,
        });
      });
      rangee.append(pastille);
    }
    hote.append(rangee);

    hote.append(boutonDeSuppression(strat, vise));
  }

  // Mesuré après coup : la hauteur dépend du panneau — ajout ou correction.
  ancrer(hote, ouvert, { largeur: 246, hauteur: ajout ? 132 : 250 });
  return hote;
}
