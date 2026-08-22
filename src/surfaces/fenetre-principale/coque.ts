/**
 * La Fenêtre principale : la colonne, le Socle d'état, et l'écran courant.
 *
 * C'est le **seul endroit où l'app s'explique** (ADR `0012`). L'ADR `0006`
 * retire à l'Overlay tout vocabulaire pour son propre doute, et cette fenêtre
 * en porte la contrepartie : quatre conditions écrites, cochées ou non, dans un
 * ordre gelé, et la phrase qui conclut. Ce n'est pas un pari sur le contexte,
 * c'est un dispositif permanent.
 *
 * Ce fichier ne décide rien du modèle. Il peint ce que le processus principal
 * pousse, et il renvoie des intentions.
 */

import { bouton, element } from './dom.ts';
import { type Etat, memo } from './pont.ts';
import { calquesRoster, ecranRoster, validerLeNomDeProfil } from './roster.ts';
import { calquesStrats, ecranStrats, validerLeNom } from './strats.ts';
import { type Ecran, fermerLesCalques, repeindre, surRepeindre, vue } from './vue.ts';

const par = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/**
 * Si le pont manque, la fenêtre le dit. Sans cette garde elle s'ouvre vide et
 * muette — c'est arrivé, un preload en bac à sable ne pouvant pas charger un
 * fichier voisin. La Fenêtre principale est le seul endroit qui explique, y
 * compris quand c'est elle qui est cassée.
 */
if (memo === undefined) {
  const dire = element('p', 'alerte');
  dire.textContent =
    'Le pont vers le processus principal ne s’est pas chargé : cette fenêtre ne peut rien montrer ni rien commander. Voir la console (Ctrl+Maj+I).';
  dire.hidden = false;
  document.body.prepend(dire);
  throw new Error('pont absent');
}

/**
 * Les quatre conditions, dans l'ordre que l'ADR `0014` a gelé : la liste **est**
 * les conditions, elle ne change pas de forme selon les circonstances, sinon
 * elle cesse d'être un objet qu'on apprend. Les deux faits qui parlent du jeu se
 * lisent côte à côte — installé, puis lancé.
 */
const PHRASES: readonly (readonly [string, string])[] = [
  ['affichageDemande', 'l’Affichage est demandé'],
  ['logsTrouves', 'les logs de Wakfu sont trouvés'],
  ['fenetreWakfu', 'une fenêtre de Wakfu existe'],
  ['stratChoisie', 'une Strat est choisie'],
];

const ENTREES: readonly (readonly [Ecran, string])[] = [
  ['strats', 'Strats'],
  ['roster', 'Roster'],
  ['reglages', 'Réglages'],
  ['prise-en-main', 'Prise en main'],
];

const NOMS_RACCOURCIS: Record<string, string> = {
  overlay: 'Afficher / masquer l’overlay',
  verrou: 'Verrouiller / déverrouiller',
  fenetre: 'Rappeler la fenêtre principale',
};

let dernier: Etat | null = null;

function allerA(ecran: Ecran): void {
  vue.ecran = ecran;
  fermerLesCalques();
  if (ecran === 'strats') vue.ouverteId = null;
  // Changer d'écran abandonne ce qui était commencé sur celui qu'on quitte :
  // un formulaire de saisie qui ressurgirait au retour serait un revenant.
  vue.saisie = null;
  vue.renommeProfilId = null;
  repeindre();
}

/* ================================================== la colonne latérale == */

function peindreLeRail(etat: Etat): void {
  const hote = par('entrees');
  hote.replaceChildren();
  for (const [ecran, libelle] of ENTREES) {
    const entree = bouton(vue.ecran === ecran ? 'cur' : '', libelle, () => allerA(ecran));
    if (ecran === 'strats') {
      entree.append(element('span', 'cnt', String(etat.strats.length)));
    }
    if (ecran === 'roster') {
      // Le témoin d'une Demande d'ajout sans réponse, et c'est un COMPTE : sans
      // lui, une question posée en combat et laissée de côté n'aurait aucune
      // trace ici — personne ne va sur le Roster « au cas où ». Ne pas répondre
      // ne vaut pas refus. Sinon, le nombre de Personnages, comme les Strats.
      const reste = etat.aIdentifier.length;
      const temoin = element(
        'span',
        reste > 0 ? 'temoin' : 'cnt',
        String(reste > 0 ? reste : etat.personnages.length),
      );
      if (reste > 0) {
        temoin.title =
          reste === 1
            ? 'un combattant attend d’être identifié'
            : `${reste} combattants attendent d’être identifiés`;
      }
      entree.append(temoin);
    }
    hote.append(entree);
  }
}

function peindreLeSocle(etat: Etat): void {
  const hote = par('socle');
  hote.replaceChildren();

  const demande = etat.conditions['affichageDemande'] === true;
  const interrupteur = bouton(`sw ${demande ? 'on' : ''}`.trim(), '', () =>
    memo?.basculerAffichage(),
  );
  const piste = element('span', 'track');
  piste.append(element('i'));
  interrupteur.append(piste, element('span', 'cap', 'Afficher l’overlay'));
  hote.append(interrupteur);

  const conditions = element('div', 'conds');
  for (const [nom, phrase] of PHRASES) {
    const vraie = etat.conditions[nom] === true;
    const ligne = element('div', `cond ${vraie ? 'ok' : ''}`.trim());
    ligne.append(element('em', '', vraie ? '✓' : '·'));
    // La ligne des logs est la seule à porter une action, et l'asymétrie est
    // assumée : à qui il manque une Strat sait où aller, personne ne devine
    // qu'un dossier se désigne dans les Réglages (ADR 0014).
    if (nom === 'logsTrouves' && !vraie) {
      ligne.append(bouton('porte', phrase, () => allerA('reglages')));
    } else {
      ligne.append(element('span', '', phrase));
    }
    conditions.append(ligne);
  }
  hote.append(conditions);

  const conclusion = element('p', `why ${etat.dessine ? 'dessine' : ''}`.trim());
  if (etat.dessine && etat.stratChoisie !== null) {
    conclusion.append(
      document.createTextNode('L’overlay est dessiné, sur '),
      element('b', '', etat.stratChoisie),
      document.createTextNode('.'),
    );
  } else {
    conclusion.textContent = 'L’overlay n’est pas dessiné.';
  }
  hote.append(conclusion);
}

/* ================================================= les écrans en attente = */

function ligneDeDefinition(hote: HTMLElement, terme: string, valeur: string, classe = ''): void {
  hote.append(element('dt', '', terme));
  hote.append(element('dd', classe, valeur));
}

function ecranEnAttente(titre: string, lot: string, ticket: string): DocumentFragment {
  const hote = document.createDocumentFragment();
  const tete = element('div', 'scrhead');
  tete.append(element('h1', '', titre));
  hote.append(tete);

  const corps = element('div', 'scrbody');
  const attente = element('div', 'todo');
  attente.append(document.createTextNode('Écran '));
  attente.append(element('b', '', 'volontairement vide'));
  attente.append(document.createTextNode(` : il appartient au ${lot} (${ticket}).`));
  attente.append(element('br'));
  attente.append(
    document.createTextNode('La colonne doit seulement montrer qu’on y va, et à quel prix.'),
  );
  corps.append(attente);
  hote.append(corps);
  return hote;
}

/**
 * Le banc du Lot 6, et il ne survivra qu'au Lot 8 : rien d'autre ne peut
 * fabriquer une Demande d'ajout tant que le combat ne la produit pas. Il sème
 * les trois combattants de la maquette de #22, et les retire.
 */
function bancDuRoster(etat: Etat): HTMLElement {
  const banc = element('div', 'banc');
  banc.append(element('h2', '', 'Banc d’essai — le Lot 8 le remplace'));
  const gestes = element('div', 'gestes');
  gestes.append(
    bouton(
      etat.demandeEnAttente ? 'on' : '',
      etat.demandeEnAttente
        ? 'Retirer les combattants à identifier'
        : 'Semer trois combattants à identifier',
      () => memo?.bancDemande(!etat.demandeEnAttente),
    ),
  );
  banc.append(gestes);
  return banc;
}

/**
 * Ce que le Lot 7 remplacera, et ce qui doit survivre en attendant : la
 * deuxième ligne du Socle d'état mène ici (ADR `0014`), et une explication en
 * cul-de-sac n'explique pas. Les trois raccourcis y sont aussi, parce qu'un
 * raccourci que le système refuse doit se lire quelque part.
 */
function bancDesReglages(etat: Etat): HTMLElement {
  const banc = element('div', 'banc');
  banc.append(element('h2', '', 'Banc d’essai — le Lot 7 le remplace'));

  const gestes = element('div', 'gestes');
  gestes.append(bouton('', 'Désigner le dossier de logs…', () => void memo?.designerDossierLogs()));
  gestes.append(bouton('', 'Revenir à la détection', () => memo?.oublierDossierLogs()));
  gestes.append(bouton('', 'Ouvrir le dossier de données', () => memo?.ouvrirDossierDonnees()));
  banc.append(gestes);

  const liste = element('dl');
  // Lequel des deux a produit le dossier retenu — détecté ou désigné.
  ligneDeDefinition(
    liste,
    'dossier de logs',
    etat.dossierLogsManuel !== null
      ? `désigné — ${etat.dossierLogsManuel}`
      : etat.wakfuLog !== null
        ? 'détecté'
        : 'aucun',
    etat.wakfuLog !== null ? '' : 'non',
  );
  ligneDeDefinition(liste, 'wakfu.log', etat.wakfuLog ?? 'aucun', etat.wakfuLog ? '' : 'non');
  ligneDeDefinition(liste, 'fenêtre visée', etat.titreCible);
  ligneDeDefinition(
    liste,
    'attachement',
    etat.attache ? 'attaché à la fenêtre du jeu' : 'aucune fenêtre trouvée',
    etat.attache ? '' : 'non',
  );
  for (const [nom, pose] of Object.entries(etat.raccourcis ?? {})) {
    const dit =
      pose.etat === 'pris'
        ? (pose.combinaison ?? '')
        : pose.etat === 'refuse'
          ? `${pose.combinaison} — refusé par le système`
          : 'aucun';
    ligneDeDefinition(
      liste,
      NOMS_RACCOURCIS[nom] ?? nom,
      dit,
      pose.etat === 'refuse' ? 'refuse' : '',
    );
  }
  ligneDeDefinition(liste, 'dossier de données', etat.dossierDonnees);
  banc.append(liste);
  return banc;
}

function ecranCourant(etat: Etat): DocumentFragment {
  switch (vue.ecran) {
    case 'roster': {
      const hote = ecranRoster(etat);
      hote.querySelector('.scrbody')?.append(bancDuRoster(etat));
      return hote;
    }
    case 'reglages': {
      const hote = ecranEnAttente('Réglages', 'Lot 7', '#32');
      hote.querySelector('.scrbody')?.append(bancDesReglages(etat));
      return hote;
    }
    case 'prise-en-main':
      return ecranEnAttente('Prise en main', 'Lot 9', '#34');
    default:
      return ecranStrats(etat);
  }
}

/* ==================================================== le rendu, et sa garde */

/**
 * Le bandeau de la persistance, annoncé après coup et une ligne par fichier :
 * une migration est silencieuse mais pas muette, et un fichier mis de côté ou
 * refusé doit se dire, sinon l'utilisateur croit avoir perdu ses données.
 */
function phraseAvertissement(avertissement: Etat['avertissements'][number]): string {
  const fichier = avertissement.fichier;
  switch (avertissement.sorte) {
    case 'migration':
      return `${fichier} a été migré depuis la version ${avertissement.depuis} ; l’ancien est gardé sous ${avertissement.sauvegarde}.`;
    case 'refus':
      return `${fichier} vient d’une version plus récente : il est refusé, jamais écrasé, et rien ne sera enregistré.`;
    default:
      return avertissement.miseDeCote === null || avertissement.miseDeCote === undefined
        ? `${fichier} était illisible et n’a même pas pu être mis de côté ; l’app est repartie sur les défauts.`
        : `${fichier} était illisible : il a été mis de côté sous ${avertissement.miseDeCote} et l’app est repartie sur les défauts.`;
  }
}

/**
 * Vrai quand le curseur est dans un champ. Un instantané qui arrive **pendant**
 * la frappe ne doit pas reconstruire l'écran : le caret sauterait à chaque
 * lettre, et le champ contient déjà ce qu'on vient d'y taper. La contrepartie
 * assumée : la liste peut rester une seconde en retard si la Strat choisie
 * change ailleurs — dans le menu de l'Overlay — pendant qu'on écrit.
 */
function saisieEnCours(): boolean {
  const actif = document.activeElement;
  return actif instanceof HTMLElement && (actif.isContentEditable || actif.tagName === 'INPUT');
}

/**
 * Le défilement est à nous, pas au modèle : un re-rendu ne remonte pas en haut.
 * Deux boîtes défilent, jamais plus — la liste des Strats, et la grille des
 * fiches — et elles ne coexistent pas.
 */
const defilement = (): number =>
  document.querySelector<HTMLElement>('.scrbody, .turns')?.scrollTop ?? 0;

function peindre(menager = false): void {
  const etat = dernier;
  if (etat === null) return;

  const alerte = par<HTMLParagraphElement>('alerte');
  alerte.textContent = etat.avertissements.map(phraseAvertissement).join(' ');
  alerte.hidden = etat.avertissements.length === 0;

  peindreLeRail(etat);
  peindreLeSocle(etat);

  if (menager) return;

  // Avant de reconstruire : un nom à moitié tapé se perdrait avec son champ.
  validerLeNom();
  validerLeNomDeProfil();

  const avant = defilement();
  document.documentElement.style.setProperty('--fichemin', `${etat.ficheMiniFenetre}px`);

  const ecran = par('ecran');
  ecran.replaceChildren(ecranCourant(etat));

  const calques = par('calques');
  const dessus =
    vue.ecran === 'strats'
      ? calquesStrats(etat)
      : vue.ecran === 'roster'
        ? calquesRoster(etat)
        : [];
  calques.replaceChildren(...dessus);

  const apres = document.querySelector<HTMLElement>('.scrbody, .turns');
  if (apres !== null) apres.scrollTop = avant;

  // Le nom d'une Strat ou d'un Profil qu'on vient de créer part en édition : on
  // le nomme en le créant. Et le champ de la saisie manuelle prend le focus dès
  // qu'il s'ouvre, sinon il faut cliquer dedans pour taper.
  const saisie = document.querySelector<HTMLInputElement>('input.ren, input.fnom');
  if (saisie !== null && document.activeElement !== saisie) {
    saisie.focus();
    saisie.select();
  }
}

surRepeindre(() => peindre(false));

const rafraichir = (etat: Etat): void => {
  dernier = etat;
  peindre(saisieEnCours());
};

memo.surEtat(rafraichir);
void memo.etat().then(rafraichir);

// Un clic ailleurs referme le menu d'une ligne et le panneau d'un Emplacement.
// Ceux qui les ouvrent arrêtent la propagation, sans quoi ils se refermeraient
// aussitôt.
document.addEventListener('click', () => {
  if (fermerLesCalques()) peindre(false);
});

document.addEventListener('keydown', (evenement) => {
  if (evenement.key !== 'Escape') return;
  // La saisie manuelle répond déjà pour elle-même quand son champ a le focus.
  // Ce filet est pour l'autre cas : on vient de cliquer une icône de classe, le
  // focus a quitté le champ, et Échap n'aurait plus rien fermé.
  const avaitUnCalque = vue.aSupprimer !== null || vue.saisie !== null;
  vue.aSupprimer = null;
  vue.saisie = null;
  if (fermerLesCalques() || avaitUnCalque) peindre(false);
});
