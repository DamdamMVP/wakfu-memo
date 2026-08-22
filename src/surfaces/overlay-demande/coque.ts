/**
 * L'Overlay de la Demande d'ajout, côté surface : la question, et rien d'autre.
 *
 * Tout l'état vient du processus principal — les inconnus, les Profils, les
 * Personnages rattachables, l'opacité. Ce fichier peint et transmet des
 * intentions ; c'est `persistance/edition-roster.ts` qui décide, exactement comme
 * pour l'écran Roster, et pour la même raison : les invariants de `roster.json`
 * ont un seul gardien.
 *
 * Trois règles tiennent ce qui suit, et aucune n'a d'exception :
 *
 *  1. **Rien ne ressemble à un refus.** Pas de ✕, pas d'« annuler », pas de
 *     « plus tard » qui vide la liste : ne pas répondre ne vaut pas refus
 *     (ADR `0010`). Le seul refus est « ignorer », et il est dans la question.
 *  2. **Tous les inconnus, à plat.** Répondre pour l'un fabrique un Conflit pour
 *     l'autre : une file d'attente devrait se recalculer après chaque réponse,
 *     ce qui a tué la variante « une question à la fois » (#16).
 *  3. **Le menu des réponses est natif.** Ce panneau fait deux ou trois lignes,
 *     et une liste de profils posée dans son DOM serait coupée par son propre
 *     cadre. `Menu.popup()` déborde ; seul l'écran le contraint encore.
 */

type DemandeDAjout = { idEntite: string; nom: string; classe: string };
type Profil = { id: string; nom: string };
type Rattachable = { id: string; nom: string; classe: string };

type ContenuDemande = {
  demandes: DemandeDAjout[];
  profils: Profil[];
  rattachables: Rattachable[];
  opacite: number;
};

/** Ce que le menu natif a rendu, ou `null` : il a été fermé sans choisir. */
type ChoixDeDemande =
  | { sorte: 'profil'; profilId: string }
  | { sorte: 'nouveau-profil' }
  | { sorte: 'rattacher'; personnageId: string }
  | { sorte: 'ignorer' };

/**
 * Miroir de `CommandeRoster`. La surface n'en construit jamais d'autre, et elle
 * n'invente ni id, ni nom, ni classe : le nom et la classe viennent du log.
 */
type CommandeRoster =
  | { sorte: 'creer-profil' }
  | { sorte: 'renommer-profil'; profilId: string; nom: string }
  | {
      sorte: 'ajouter-personnage';
      profilId: string;
      idEntite: string;
      nom: string;
      classe: string;
    }
  | { sorte: 'rattacher'; personnageId: string; idEntite: string; nom: string; classe: string }
  | { sorte: 'ignorer'; idEntite: string; nomVu: string };

type PontMemo = {
  surOverlayDemande: (rappel: (contenu: ContenuDemande) => void) => void;
  deplacerDemande: (dx: number, dy: number) => void;
  poserHauteurDemande: (hauteur: number) => void;
  replierDemande: (replie: boolean) => void;
  menuDeDemande: (idEntite: string, x: number, y: number) => Promise<ChoixDeDemande | null>;
  editerRoster: (commande: CommandeRoster) => Promise<{ profilId: string | null }>;
};

const memo = (window as unknown as { memo?: PontMemo }).memo;

/**
 * Les dix-huit classes, recopiées à la main depuis `domaine/classes.ts` : une
 * surface se compile comme son propre projet, et importer le vrai fichier
 * traînerait les modules qui lisent le disque dans le rendu.
 */
const NOMS_DE_CLASSE: Record<string, string> = {
  feca: 'Féca',
  osamodas: 'Osamodas',
  enutrof: 'Enutrof',
  sram: 'Sram',
  xelor: 'Xélor',
  ecaflip: 'Ecaflip',
  eniripsa: 'Eniripsa',
  iop: 'Iop',
  cra: 'Crâ',
  sadida: 'Sadida',
  sacrieur: 'Sacrieur',
  pandawa: 'Pandawa',
  roublard: 'Roublard',
  zobal: 'Zobal',
  ouginak: 'Ouginak',
  steamer: 'Steamer',
  eliotrope: 'Eliotrope',
  huppermage: 'Huppermage',
};

const nomDeClasse = (classe: string): string => NOMS_DE_CLASSE[classe] ?? classe;

const par = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const panneau = par<HTMLElement>('panneau');
const entete = par<HTMLElement>('entete');
const titre = par<HTMLElement>('titre');
const plusTard = par<HTMLButtonElement>('plus-tard');
const corps = par<HTMLElement>('corps');

let dernier: ContenuDemande | null = null;

/**
 * Les deux calques du panneau, tous les deux locaux et tous les deux éphémères.
 *
 *  - `avertissement` : le rattachement vise un Personnage d'une autre classe.
 *    L'ADR `0002` interdit de garder une classe fausse sur un ID attaché, donc
 *    rattacher **écrase** la classe saisie, et « non » annule le geste entier
 *    plutôt que d'accepter un mensonge ;
 *  - `profilNeuf` : le champ de nom d'un profil qui n'existe pas encore.
 *
 * Ni l'un ni l'autre ne remonte au processus principal : un calque ouvert n'est
 * pas un état de l'application — la Fenêtre principale et l'Overlay du Tour
 * tiennent le même raisonnement pour leurs menus.
 */
let avertissement: { idEntite: string; personnageId: string } | null = null;
let profilNeuf: string | null = null;

/* ============================================================ des nœuds ==== */

/**
 * Un élément, sa classe, son texte. La surface se construit en nœuds, jamais en
 * `innerHTML` : un pseudo vient du log et un nom de profil est tapé, et
 * `textContent` ne les interprète jamais.
 */
function element<B extends keyof HTMLElementTagNameMap>(
  balise: B,
  classe = '',
  texte = '',
): HTMLElementTagNameMap[B] {
  const cree = document.createElement(balise);
  if (classe !== '') cree.className = classe;
  if (texte !== '') cree.textContent = texte;
  return cree;
}

function bouton(classe: string, texte: string, geste: (evenement: MouseEvent) => void) {
  const cree = element('button', classe, texte);
  cree.type = 'button';
  cree.addEventListener('click', geste);
  return cree;
}

/** Le portrait, nommé par la clé de Classe — jamais par le `breed`. */
function portrait(classe: string): HTMLElement {
  const hote = element('span', 'cls');
  const image = element('img');
  image.src = `../../icons/${classe}.png`;
  image.alt = '';
  hote.append(image);
  return hote;
}

/* =========================================================== les réponses == */

async function repondre(commande: CommandeRoster): Promise<void> {
  avertissement = null;
  profilNeuf = null;
  await memo?.editerRoster(commande);
}

/**
 * « ＋ nouveau profil », validé. Trois commandes, dans cet ordre : le profil naît
 * avec son nom par défaut, il est renommé, puis le combattant y entre. La
 * surface n'invente pas l'id — elle le reçoit.
 *
 * Un nom vide laisse le nom par défaut : une bande sans titre reste visée dans
 * l'écran Roster, et refuser ici obligerait à expliquer pourquoi.
 */
async function creerLeProfil(demande: DemandeDAjout, nom: string): Promise<void> {
  const { profilId } = (await memo?.editerRoster({ sorte: 'creer-profil' })) ?? { profilId: null };
  if (profilId === null) return;
  const propre = nom.trim();
  if (propre !== '') await memo?.editerRoster({ sorte: 'renommer-profil', profilId, nom: propre });
  await repondre({
    sorte: 'ajouter-personnage',
    profilId,
    idEntite: demande.idEntite,
    nom: demande.nom,
    classe: demande.classe,
  });
}

/**
 * Ce que le menu natif a rendu, appliqué.
 *
 * Deux choix ne répondent pas tout de suite et ouvrent un calque : le profil
 * neuf, qui attend un nom, et le rattachement vers une autre classe, qui attend
 * un « oui ».
 */
function appliquerLeChoix(
  demande: DemandeDAjout,
  contenu: ContenuDemande,
  choix: ChoixDeDemande,
): void {
  switch (choix.sorte) {
    case 'profil':
      void repondre({
        sorte: 'ajouter-personnage',
        profilId: choix.profilId,
        idEntite: demande.idEntite,
        nom: demande.nom,
        classe: demande.classe,
      });
      return;
    case 'nouveau-profil':
      avertissement = null;
      profilNeuf = demande.idEntite;
      peindre();
      return;
    case 'ignorer':
      void repondre({ sorte: 'ignorer', idEntite: demande.idEntite, nomVu: demande.nom });
      return;
    default: {
      const vise = contenu.rattachables.find((personnage) => personnage.id === choix.personnageId);
      if (vise === undefined) return;
      if (vise.classe === demande.classe) {
        void repondre({
          sorte: 'rattacher',
          personnageId: vise.id,
          idEntite: demande.idEntite,
          nom: demande.nom,
          classe: demande.classe,
        });
        return;
      }
      profilNeuf = null;
      avertissement = { idEntite: demande.idEntite, personnageId: vise.id };
      peindre();
    }
  }
}

async function ouvrirLeMenu(
  demande: DemandeDAjout,
  contenu: ContenuDemande,
  ancre: HTMLElement,
): Promise<void> {
  const boite = ancre.getBoundingClientRect();
  // Sous le bouton, à son bord gauche : le menu est natif, il déborde du panneau
  // et n'a donc aucune raison de se retourner (#16).
  const choix = await memo?.menuDeDemande(
    demande.idEntite,
    Math.round(boite.x),
    Math.round(boite.bottom),
  );
  if (choix === null || choix === undefined) return;
  appliquerLeChoix(demande, contenu, choix);
}

/* ============================================================== le rendu === */

/**
 * L'avertissement de classe. Le log fait foi (ADR `0002`), donc rattacher écrase
 * la classe saisie — et « non » annule le rattachement au lieu d'accepter une
 * classe fausse sur un ID attaché.
 */
function boiteDAvertissement(demande: DemandeDAjout, vise: Rattachable): HTMLElement {
  const hote = element('div', 'avertit');
  const dire = element('p');
  dire.append(
    document.createTextNode('Le log dit que '),
    element('b', '', demande.nom),
    document.createTextNode(` est ${nomDeClasse(demande.classe)}, et tu l’avais saisi `),
    element('b', '', vise.nom),
    document.createTextNode(
      `, ${nomDeClasse(vise.classe)}. Rattacher écrasera la classe saisie par celle du log.`,
    ),
  );
  hote.append(dire);
  const reponses = element('div', 'reponses');
  reponses.append(
    bouton('on', 'Oui, c’est le même personnage', () => {
      void repondre({
        sorte: 'rattacher',
        personnageId: vise.id,
        idEntite: demande.idEntite,
        nom: demande.nom,
        classe: demande.classe,
      });
    }),
    bouton('ghost', 'Non, annuler le rattachement', () => {
      avertissement = null;
      peindre();
    }),
  );
  hote.append(reponses);
  return hote;
}

/** Le champ de nom d'un profil qui n'existe pas encore. */
function champDeProfil(demande: DemandeDAjout): HTMLElement {
  const hote = element('div', 'profil-neuf');
  const champ = element('input');
  champ.type = 'text';
  champ.placeholder = 'nom du profil';
  champ.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter') void creerLeProfil(demande, champ.value);
    if (evenement.key === 'Escape') {
      profilNeuf = null;
      peindre();
    }
  });
  hote.append(champ);
  hote.append(bouton('on', 'Ajouter', () => void creerLeProfil(demande, champ.value)));
  hote.append(
    bouton('ghost', 'Annuler', () => {
      profilNeuf = null;
      peindre();
    }),
  );
  // Le champ vient d'apparaître, et c'est lui qu'on allait remplir.
  queueMicrotask(() => champ.focus());
  return hote;
}

function ligneDeDemande(demande: DemandeDAjout, contenu: ContenuDemande): HTMLElement {
  const hote = element('div', 'demande');
  const ligne = element('div', 'ligne');
  ligne.append(portrait(demande.classe));

  const dit = element('div', 'dit');
  dit.append(element('div', 'nom', demande.nom));
  dit.append(element('div', 'sous', `${nomDeClasse(demande.classe)} · vu en combat`));
  ligne.append(dit);

  const gestes = element('div', 'gestes');
  const ajouter = bouton('', 'Ajouter à ▾', (evenement) => {
    void ouvrirLeMenu(demande, contenu, evenement.currentTarget as HTMLElement);
  });
  gestes.append(ajouter);
  // « ignorer » est en clair et pas dans le menu : c'est le seul refus explicite
  // qu'il y ait, et le cacher derrière « Ajouter à » le rendrait introuvable.
  gestes.append(
    bouton('ghost', 'ignorer', () => {
      void repondre({ sorte: 'ignorer', idEntite: demande.idEntite, nomVu: demande.nom });
    }),
  );
  ligne.append(gestes);
  hote.append(ligne);

  if (avertissement?.idEntite === demande.idEntite) {
    const vise = contenu.rattachables.find(
      (personnage) => personnage.id === avertissement?.personnageId,
    );
    if (vise !== undefined) hote.append(boiteDAvertissement(demande, vise));
  }
  if (profilNeuf === demande.idEntite) hote.append(champDeProfil(demande));
  return hote;
}

function peindre(): void {
  const contenu = dernier;
  if (contenu === null) return;

  // Un calque qui vise une question déjà répondue n'a plus de sujet.
  const existe = (idEntite: string | null) =>
    contenu.demandes.some((demande) => demande.idEntite === idEntite);
  if (!existe(avertissement?.idEntite ?? null)) avertissement = null;
  if (!existe(profilNeuf)) profilNeuf = null;

  panneau.style.opacity = String(contenu.opacite / 100);
  titre.replaceChildren(
    element('b', '', String(contenu.demandes.length)),
    document.createTextNode(
      contenu.demandes.length > 1 ? ' combattants à identifier' : ' combattant à identifier',
    ),
  );
  corps.replaceChildren();
  for (const demande of contenu.demandes) corps.append(ligneDeDemande(demande, contenu));

  // Le panneau se mesure : le processus principal ne peut pas deviner la hauteur
  // d'une liste qui va de un à six, ni celle d'un avertissement ouvert dessous.
  memo?.poserHauteurDemande(panneau.offsetHeight);
}

/* ============================================================= les gestes == */

/**
 * « plus tard » replie, et ne répond pas. La question reste entière — la
 * pastille de la fiche la ramène, et un combattant jamais vu la rouvre.
 */
plusTard.addEventListener('click', () => memo?.replierDemande(true));

/**
 * Le panneau se traîne par son en-tête. Reporté en coordonnées d'écran, pour que
 * le geste survive à la fenêtre qui bouge sous le pointeur — et elle bouge,
 * puisque c'est nous qui la déplaçons. Ce panneau est une vraie fenêtre, à la
 * différence de la fiche du Tour, qui ne se déplace que dans sa propre surface.
 */
entete.addEventListener('pointerdown', (evenement) => {
  if (evenement.button !== 0) return;
  if ((evenement.target as HTMLElement).closest('button') !== null) return;

  let dernierX = evenement.screenX;
  let dernierY = evenement.screenY;
  entete.setPointerCapture(evenement.pointerId);

  const suivre = (mouvement: PointerEvent): void => {
    memo?.deplacerDemande(mouvement.screenX - dernierX, mouvement.screenY - dernierY);
    dernierX = mouvement.screenX;
    dernierY = mouvement.screenY;
  };
  const relacher = (): void => {
    entete.removeEventListener('pointermove', suivre);
    entete.removeEventListener('pointerup', relacher);
    entete.removeEventListener('pointercancel', relacher);
  };

  entete.addEventListener('pointermove', suivre);
  entete.addEventListener('pointerup', relacher);
  entete.addEventListener('pointercancel', relacher);
});

memo?.surOverlayDemande((contenu) => {
  dernier = contenu;
  peindre();
});

export {};
