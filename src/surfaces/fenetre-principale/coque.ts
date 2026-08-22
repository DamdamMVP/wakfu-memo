/**
 * The Lot 2 test bench. It shows the state the main process pushes, and offers
 * the gestures needed to check the surjeu by hand.
 *
 * This is not the Socle d'état: that one is permanent, lives at the foot of the
 * side column, and Lot 5 lays it down. The four sentences below are those of
 * `CONTEXT.md` and ADR `0014`, in their frozen order, because there is no
 * reason to invent others just to verify.
 */

type Pose = { combinaison: string | null; etat: 'pris' | 'refuse' | 'absent' };

type Etat = {
  conditions: Record<string, boolean>;
  manquantes: string[];
  dessine: boolean;
  attache: boolean;
  titreCible: string;
  verrouille: boolean;
  demandeEnAttente: boolean;
  wakfuLog: string | null;
  dossierLogsManuel: string | null;
  stratChoisie: string | null;
  raccourcis: Record<string, Pose> | null;
  dossierDonnees: string;
  reglagesRefuses: boolean;
  reglagesCorrompus: boolean;
};

type PontMemo = {
  etat: () => Promise<Etat>;
  surEtat: (rappel: (etat: Etat) => void) => void;
  basculerAffichage: () => void;
  choisirStrat: (nom: string | null) => void;
  basculerVerrou: () => void;
  designerDossierLogs: () => Promise<string | null>;
  oublierDossierLogs: () => void;
  ouvrirDossierDonnees: () => void;
  bancDemande: (enAttente: boolean) => void;
};

const memo = (window as unknown as { memo?: PontMemo }).memo;

/**
 * If the bridge is missing, the Fenêtre principale says so. Without this guard
 * it opens empty and mute — which happened, a sandboxed preload being unable to
 * load a neighbouring file. The Fenêtre principale is the only place that
 * explains (ADR `0012`), including when it is the broken one.
 */
if (memo === undefined) {
  const dire = document.createElement('p');
  dire.className = 'alerte';
  dire.textContent =
    'Le pont vers le processus principal ne s’est pas chargé : cette fenêtre ne peut rien montrer ni rien commander. Voir la console (Ctrl+Maj+I).';
  document.querySelector('main')?.prepend(dire);
  throw new Error('pont absent');
}

const PHRASES: Record<string, string> = {
  affichageDemande: 'l’Affichage est demandé',
  logsTrouves: 'les logs de Wakfu sont trouvés',
  fenetreWakfu: 'une fenêtre de Wakfu existe',
  stratChoisie: 'une Strat est choisie',
};

const NOMS_RACCOURCIS: Record<string, string> = {
  overlay: 'Afficher / masquer l’overlay',
  verrou: 'Verrouiller / déverrouiller',
  fenetre: 'Rappeler la fenêtre principale',
};

const par = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function ligneDefinition(parent: HTMLElement, terme: string, valeur: string, classe = ''): void {
  const dt = document.createElement('dt');
  dt.textContent = terme;
  const dd = document.createElement('dd');
  dd.textContent = valeur;
  if (classe) dd.className = classe;
  parent.append(dt, dd);
}

function peindre(etat: Etat): void {
  const liste = par<HTMLUListElement>('conditions');
  liste.replaceChildren();
  for (const [cle, phrase] of Object.entries(PHRASES)) {
    const vraie = etat.conditions[cle] === true;
    const li = document.createElement('li');
    li.className = vraie ? 'vraie' : '';
    const marque = document.createElement('span');
    marque.className = 'marque';
    marque.textContent = vraie ? '✓' : '·';
    const texte = document.createElement('span');
    texte.textContent = phrase;
    li.append(marque, texte);
    liste.append(li);
  }

  const conclusion = par<HTMLParagraphElement>('conclusion');
  conclusion.textContent = etat.dessine
    ? `l’overlay est dessiné${etat.stratChoisie ? `, sur ${etat.stratChoisie}` : ''}`
    : 'l’overlay n’est pas dessiné';
  conclusion.className = `conclusion${etat.dessine ? ' dessine' : ''}`;

  const affichage = par<HTMLButtonElement>('affichage');
  affichage.textContent = etat.conditions['affichageDemande']
    ? 'Ne plus demander l’affichage'
    : 'Demander l’affichage';
  affichage.classList.toggle('on', etat.conditions['affichageDemande'] === true);

  const verrou = par<HTMLButtonElement>('verrou');
  verrou.textContent = etat.verrouille
    ? 'Déverrouiller l’Overlay du Tour'
    : 'Verrouiller l’Overlay du Tour';
  verrou.classList.toggle('on', !etat.verrouille);

  const demande = par<HTMLButtonElement>('demande');
  demande.textContent = etat.demandeEnAttente
    ? 'Répondre à la Demande d’ajout'
    : 'Faire surgir la Demande d’ajout';
  demande.classList.toggle('on', etat.demandeEnAttente);

  const surjeu = par<HTMLDListElement>('surjeu');
  surjeu.replaceChildren();
  ligneDefinition(surjeu, 'fenêtre visée', etat.titreCible);
  ligneDefinition(
    surjeu,
    'attachement',
    etat.attache ? 'attaché à la fenêtre du jeu' : 'aucune fenêtre trouvée',
    etat.attache ? '' : 'non',
  );
  ligneDefinition(surjeu, 'wakfu.log', etat.wakfuLog ?? 'aucun', etat.wakfuLog ? '' : 'non');
  ligneDefinition(
    surjeu,
    'dossier désigné',
    etat.dossierLogsManuel ?? 'aucun — la découverte est le Lot 1',
    etat.dossierLogsManuel ? '' : 'non',
  );
  ligneDefinition(
    surjeu,
    'Strat choisie',
    etat.stratChoisie ?? 'aucune',
    etat.stratChoisie ? '' : 'non',
  );
  for (const [nom, pose] of Object.entries(etat.raccourcis ?? {})) {
    const dit =
      pose.etat === 'pris'
        ? (pose.combinaison ?? '')
        : pose.etat === 'refuse'
          ? `${pose.combinaison} — refusé par le système`
          : 'aucun';
    ligneDefinition(
      surjeu,
      NOMS_RACCOURCIS[nom] ?? nom,
      dit,
      pose.etat === 'refuse' ? 'refuse' : '',
    );
  }
  ligneDefinition(surjeu, 'dossier de données', etat.dossierDonnees);

  const alerte = par<HTMLParagraphElement>('alerte');
  if (etat.reglagesRefuses) {
    alerte.textContent =
      'reglages.json vient d’une version plus récente : il est refusé, jamais écrasé, et rien ne sera enregistré.';
    alerte.hidden = false;
  } else if (etat.reglagesCorrompus) {
    alerte.textContent =
      'reglages.json était illisible : il a été mis de côté et l’app est repartie sur les défauts.';
    alerte.hidden = false;
  } else {
    alerte.hidden = true;
  }
}

let dernier: Etat | null = null;

const rafraichir = (etat: Etat): void => {
  dernier = etat;
  peindre(etat);
};

memo.surEtat(rafraichir);
void memo.etat().then(rafraichir);

par('affichage').addEventListener('click', () => memo.basculerAffichage());
par('verrou').addEventListener('click', () => memo.basculerVerrou());
par('demande').addEventListener('click', () =>
  memo.bancDemande(!(dernier?.demandeEnAttente ?? false)),
);
par('choisir-strat').addEventListener('click', () => {
  const nom = par<HTMLInputElement>('nom-strat').value.trim();
  memo.choisirStrat(nom === '' ? null : nom);
});
par('retirer-strat').addEventListener('click', () => memo.choisirStrat(null));
par('designer-dossier').addEventListener('click', () => void memo.designerDossierLogs());
par('oublier-dossier').addEventListener('click', () => memo.oublierDossierLogs());
par('dossier-donnees').addEventListener('click', () => memo.ouvrirDossierDonnees());

export {};
