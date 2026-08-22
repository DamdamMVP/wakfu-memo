/**
 * L'écran des Strats : une liste plein écran, puis la descente dans une Strat.
 *
 * Quatre choix de #21 tiennent cet écran, et ils se répondent :
 *
 *  - la **pastille de choix est à gauche de la ligne**, donc choisir n'oblige
 *    pas à ouvrir. Ni bordure de couleur ni badge « choisie » sur les lignes :
 *    la pastille suffit ;
 *  - **renommer se fait sur place dans la liste**, dans le menu `⋯`. La descente
 *    ne sait donc pas renommer, et c'est pourquoi **créer et dupliquer restent
 *    dans la liste** ;
 *  - l'état **« aucune Strat »** porte une invitation, parce que l'ADR `0006`
 *    empêche l'Overlay de se dessiner sans Strat choisie : c'est le seul écran
 *    qui puisse donner envie d'en créer une (ADR `0012`) ;
 *  - la **suppression annonce le compte de ce qui part** (#11) et, quand c'est
 *    la Strat choisie, **où passe le choix** — ou que l'Overlay s'éteint.
 */

import { bouton, element } from './dom.ts';
import { editeur, iconeDeClasse, panneauDeLaPlace } from './editeur.ts';
import { type Etat, editer, memo, pluriel, type Strat } from './pont.ts';
import { ancrer, repeindre, vue } from './vue.ts';

const laStrat = (etat: Etat, id: string | null): Strat | undefined =>
  id === null ? undefined : etat.strats.find((strat) => strat.id === id);

const compteDe = (strat: Strat): string =>
  `${pluriel(strat.tours.length, 'tour')} · ${pluriel(strat.emplacements.length, 'emplacement')}`;

/* ============================================================== la liste = */

function pastilleDeChoix(etat: Etat, strat: Strat): HTMLElement {
  const choix = bouton(`pick ${etat.stratChoisieId === strat.id ? 'on' : ''}`.trim(), '', () =>
    memo?.choisirStrat(strat.id),
  );
  choix.title = 'utiliser cette strat';
  return choix;
}

/** La composition en une rangée : le seul résumé qu'un Emplacement autorise. */
function bandeDeCompo(strat: Strat): HTMLElement {
  const bande = element('span', 'compostrip');
  for (const emplacement of strat.emplacements) {
    bande.append(iconeDeClasse(emplacement, 'xs'));
  }
  return bande;
}

function ligneDeStrat(etat: Etat, strat: Strat): HTMLElement {
  const ligne = element('div', `srow ${vue.menu?.stratId === strat.id ? 'menu' : ''}`.trim());
  ligne.append(pastilleDeChoix(etat, strat));

  const corps = element('div', 'grow');
  if (vue.renommeId === strat.id) {
    const saisie = element('input', 'ren');
    saisie.value = strat.nom;
    // Un clic DANS la saisie ne doit rien déclencher : le champ vit dans le
    // conteneur qui ouvre la Strat, et le clic remontait jusqu'à lui.
    saisie.addEventListener('click', (evenement) => evenement.stopPropagation());
    saisie.addEventListener('input', () => {
      enFrappe = { stratId: strat.id, nom: saisie.value };
    });
    const valider = (): void => {
      if (vue.renommeId !== strat.id) return;
      vue.renommeId = null;
      validerLeNom();
      repeindre();
    };
    saisie.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Enter') valider();
      if (evenement.key === 'Escape') {
        enFrappe = null;
        vue.renommeId = null;
        repeindre();
      }
    });
    saisie.addEventListener('blur', valider);
    corps.append(saisie);
  } else {
    corps.append(element('div', 'nm', strat.nom === '' ? 'Sans nom' : strat.nom));
  }
  corps.append(element('div', 'meta', compteDe(strat)));
  corps.addEventListener('click', () => {
    vue.ouverteId = strat.id;
    vue.menu = null;
    repeindre();
  });
  ligne.append(corps, bandeDeCompo(strat));

  const gestes = element('div', 'acts');
  gestes.append(
    bouton('ghost', 'Ouvrir', () => {
      vue.ouverteId = strat.id;
      vue.menu = null;
      repeindre();
    }),
  );
  const menu = bouton('ghost', '⋯', (evenement) => {
    const boite = menu.getBoundingClientRect();
    const memeLigne = vue.menu?.stratId === strat.id;
    vue.panneau = null;
    vue.menu = memeLigne ? null : { stratId: strat.id, x: boite.left - 130, y: boite.bottom + 4 };
    evenement.stopPropagation();
    repeindre();
  });
  gestes.append(menu);
  ligne.append(gestes);
  return ligne;
}

/* ================================================== « aucune Strat » ===== */

function aucuneStrat(): HTMLElement {
  const hote = element('div', 'nostrat');
  hote.append(element('h2', '', 'Aucune strat'));
  hote.append(
    element(
      'p',
      '',
      'Une strat, c’est le plan d’un donjon : jusqu’à six emplacements, et une fiche par tour qui dit à chacun ce qu’il fait.',
    ),
  );
  hote.append(bouton('cta', 'Créer ma première strat', () => void creerUneStrat()));
  hote.append(
    element(
      'p',
      'adr',
      'Tant qu’aucune strat n’est choisie, l’overlay ne se dessine pas — même si l’affichage est demandé.',
    ),
  );
  return hote;
}

/* =============================================================== gestes == */

/**
 * Le nom en cours de frappe. Il vit ici, et non dans le champ, pour une raison
 * précise : un re-rendu **détruit** le champ, et un élément retiré du document
 * ne perd pas le focus proprement — son `blur` n'arrive pas. Sans cette copie,
 * cliquer ailleurs pendant qu'on renomme perdait la frappe en silence.
 */
let enFrappe: { stratId: string; nom: string } | null = null;

/**
 * Valide ce qui était en train de s'écrire. Appelée à la validation, à la perte
 * du focus, **et avant tout re-rendu** : c'est la seule garantie qui ne dépende
 * pas d'un événement que le navigateur peut ne pas envoyer.
 */
export function validerLeNom(): void {
  const frappe = enFrappe;
  enFrappe = null;
  if (frappe === null) return;
  // Un autre geste met fin à la saisie : le focus est parti ailleurs, et laisser
  // le champ ouvert le ferait reprendre le focus au re-rendu suivant.
  vue.renommeId = null;
  void editer({ sorte: 'renommer', stratId: frappe.stratId, nom: frappe.nom });
}

/**
 * Créer, puis renommer tout de suite : on nomme sa strat en la créant. La
 * première créée est choisie d'office, et c'est `edition-strats.ts` qui le
 * décide — la surface ne fait que demander.
 */
async function creerUneStrat(): Promise<void> {
  const { stratId } = await editer({ sorte: 'creer' });
  vue.ouverteId = null;
  vue.renommeId = stratId;
  repeindre();
}

/** Dupliquer met le nom en édition : on duplique pour ajuster (#11). */
async function dupliquerUneStrat(stratId: string): Promise<void> {
  const { stratId: copie } = await editer({ sorte: 'dupliquer', stratId });
  vue.menu = null;
  // On reste dans la liste : c'est le seul endroit qui sait renommer.
  vue.ouverteId = null;
  vue.renommeId = copie;
  repeindre();
}

async function demanderLaSuppression(stratId: string, nom: string): Promise<void> {
  const consequence = await memo?.consequenceSuppressionStrat(stratId);
  if (consequence === undefined) return;
  vue.menu = null;
  vue.aSupprimer = { sorte: 'strat', stratId, nom, consequence };
  repeindre();
}

/* ================================================================ l'écran */

function enTeteDeLaListe(etat: Etat): HTMLElement {
  const tete = element('div', 'scrhead');
  tete.append(element('h1', '', 'Strats'));
  tete.append(element('p', 'why', `${pluriel(etat.strats.length, 'strat')} · noms libres`));
  tete.append(element('div', 'grow'));
  tete.append(bouton('', '＋ Nouvelle strat', () => void creerUneStrat()));
  return tete;
}

function enTeteDeLaDescente(etat: Etat, strat: Strat): HTMLElement {
  const tete = element('div', 'scrhead');
  tete.append(
    bouton('ghost', '‹ Toutes les strats', () => {
      vue.ouverteId = null;
      repeindre();
    }),
  );
  tete.append(element('h1', '', strat.nom === '' ? 'Sans nom' : strat.nom));
  // Le badge survit ICI, et seulement ici : un en-tête d'écran n'a pas de
  // pastille, donc rien d'autre ne dirait que c'est la Strat choisie.
  if (etat.stratChoisieId === strat.id) {
    tete.append(element('span', 'badge', 'choisie'));
  } else {
    tete.append(bouton('ghost', 'Utiliser cette strat', () => memo?.choisirStrat(strat.id)));
  }
  tete.append(element('div', 'grow'));
  tete.append(bouton('ghost', 'Dupliquer', () => void dupliquerUneStrat(strat.id)));
  tete.append(
    bouton('ghost danger', 'Supprimer', () => void demanderLaSuppression(strat.id, strat.nom)),
  );
  return tete;
}

export function ecranStrats(etat: Etat): DocumentFragment {
  const hote = document.createDocumentFragment();
  const ouverte = laStrat(etat, vue.ouverteId);

  if (ouverte !== undefined) {
    hote.append(enTeteDeLaDescente(etat, ouverte));
    const corps = element('div', 'scrbody plein');
    corps.append(editeur(ouverte));
    hote.append(corps);
    return hote;
  }

  hote.append(enTeteDeLaListe(etat));
  const corps = element('div', 'scrbody');
  if (etat.strats.length === 0) {
    corps.append(aucuneStrat());
  } else {
    const liste = element('div', 'slist');
    for (const strat of etat.strats) liste.append(ligneDeStrat(etat, strat));
    corps.append(liste);
  }
  hote.append(corps);
  return hote;
}

/* =============================================================== calques = */

function menuDeLigne(etat: Etat): HTMLElement | null {
  const ouvert = vue.menu;
  const strat = laStrat(etat, ouvert?.stratId ?? null);
  if (ouvert === null || strat === undefined) return null;

  const hote = element('div', 'menupop');
  hote.addEventListener('click', (evenement) => evenement.stopPropagation());
  hote.append(
    bouton('', 'Renommer', () => {
      vue.menu = null;
      vue.renommeId = strat.id;
      repeindre();
    }),
  );
  hote.append(bouton('', 'Dupliquer', () => void dupliquerUneStrat(strat.id)));
  hote.append(element('div', 'sepline'));
  hote.append(bouton('', 'Supprimer…', () => void demanderLaSuppression(strat.id, strat.nom)));
  ancrer(hote, ouvert, { largeur: 186, hauteur: 132 });
  return hote;
}

/**
 * La confirmation, pour les deux choses qui emportent du travail écrit : une
 * Strat et un Emplacement. Ce qu'elle dit vient de la fonction qui appliquera la
 * suppression — elle est pure, donc la demander ne coûte rien, et la phrase ne
 * peut pas dériver de l'acte.
 */
function dialogueDeSuppression(): HTMLElement | null {
  const cible = vue.aSupprimer;
  // Le Roster a ses deux sortes à lui, et sa propre boîte : une confirmation
  // dit ce qui part, et ce qui part n'est pas de la même nature.
  if (cible === null || (cible.sorte !== 'strat' && cible.sorte !== 'emplacement')) return null;

  const voile = element('div', 'scrim');
  const boite = element('div', 'dlg');

  if (cible.sorte === 'strat') {
    const { tours, emplacements, estChoisie, choixPasseA } = cible.consequence;
    boite.append(element('h2', '', `Supprimer « ${cible.nom === '' ? 'Sans nom' : cible.nom} » ?`));
    const compte = element('p');
    compte.append(
      element('span', 'count', pluriel(tours, 'tour')),
      document.createTextNode(' et '),
      element('span', 'count', pluriel(emplacements, 'emplacement')),
      document.createTextNode(' partent avec elle.'),
    );
    boite.append(compte);
    if (estChoisie) {
      boite.append(
        element(
          'p',
          'warn',
          choixPasseA === null
            ? 'C’est la strat choisie, et la dernière : plus aucune strat ne sera choisie, et l’overlay ne se dessinera plus.'
            : `C’est la strat choisie : le choix passera à « ${choixPasseA.nom} ».`,
        ),
      );
    }
  } else {
    boite.append(element('h2', '', `Supprimer ${cible.designation} ?`));
    const compte = element('p');
    compte.append(
      element('span', 'count', pluriel(cible.consignes, 'consigne')),
      document.createTextNode(
        cible.consignes > 1
          ? ' partent avec lui, dans tous les tours.'
          : ' part avec lui, dans tous les tours.',
      ),
    );
    boite.append(compte);
  }

  const gestes = element('div', 'acts');
  gestes.append(
    bouton('ghost', 'Annuler', () => {
      vue.aSupprimer = null;
      repeindre();
    }),
  );
  gestes.append(
    bouton('danger', 'Supprimer', () => {
      vue.aSupprimer = null;
      if (cible.sorte === 'strat') {
        if (vue.ouverteId === cible.stratId) vue.ouverteId = null;
        void editer({ sorte: 'supprimer-strat', stratId: cible.stratId });
      } else {
        void editer({
          sorte: 'supprimer-emplacement',
          stratId: cible.stratId,
          emplacementId: cible.emplacementId,
        });
      }
      repeindre();
    }),
  );
  boite.append(gestes);
  voile.append(boite);
  return voile;
}

/** Les trois calques de cet écran, dans l'ordre où ils se recouvrent. */
export function calquesStrats(etat: Etat): HTMLElement[] {
  const ouverte = laStrat(etat, vue.ouverteId);
  return [
    menuDeLigne(etat),
    ouverte === undefined ? null : panneauDeLaPlace(ouverte),
    dialogueDeSuppression(),
  ].filter((calque): calque is HTMLElement => calque !== null);
}
