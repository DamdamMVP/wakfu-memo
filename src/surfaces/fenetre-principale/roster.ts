/**
 * L'écran Roster : un **mur de portraits**.
 *
 * Une bande par Profil de joueur, des vignettes de 64 px, le portrait devant le
 * pseudo. Forme retenue en #22 **sur des mesures**, pas à l'œil : à quinze
 * Personnages elle tient en 814 px de défilement contre 1568 pour la liste
 * groupée, dont le bandeau « à identifier » (178 px, 34 % du visible) partait
 * hors de vue dès le second profil.
 *
 * ⚠️ Le prix est assumé, et il se voit dans ce fichier :
 *
 *  - **le pseudo passe derrière le portrait** alors que c'est lui la clef de
 *    jointure tant qu'aucun ID d'entité n'est attaché. Une étiquette sur neuf se
 *    casse déjà à 74 px ;
 *  - **une vignette n'a la place d'aucun bouton**, donc tout geste passe par un
 *    menu ancré — sept gestes contre cinq pour la liste, et le menu recouvre le
 *    mur contre lequel on décide.
 *
 * Deux règles de domaine tiennent le reste :
 *
 *  - **l'asymétrie de parole** (ADR `0002`) : un Personnage confirmé par le log
 *    est muet — le cas normal n'a rien à dire de lui-même — et celui qui attend
 *    son premier combat le montre par son cadre en pointillé et son pseudo en
 *    italique. Ni rouge ni alerte : c'est un état normal, et transitoire. La
 *    phrase « jamais vu en combat », elle, reste en **infobulle** et dans le
 *    menu : écrite sous la vignette elle la rendait plus haute que ses voisines
 *    et cassait l'alignement du mur, pour un état qu'on lit déjà au pointillé ;
 *  - **un Personnage n'a pas de Couleur** (ADR `0003`) : aucun liseré ici.
 */

import { bouton, element } from './dom.ts';
import { canoniserNom, estNomPossible } from './noms.ts';
import {
  CLASSES,
  type DemandeDAjout,
  type Etat,
  editerLeRoster,
  memo,
  nomDeClasse,
  type Personnage,
  type Profil,
  pluriel,
} from './pont.ts';
import { ancrer, repeindre, vue } from './vue.ts';

const leProfil = (etat: Etat, id: string | null): Profil | undefined =>
  etat.profils.find((profil) => profil.id === id);

const lePersonnage = (etat: Etat, id: string | null): Personnage | undefined =>
  etat.personnages.find((personnage) => personnage.id === id);

const laDemande = (etat: Etat, idEntite: string): DemandeDAjout | undefined =>
  etat.aIdentifier.find((demande) => demande.idEntite === idEntite);

const personnagesDe = (etat: Etat, profilId: string): Personnage[] =>
  etat.personnages.filter((personnage) => personnage.profilId === profilId);

/** Ceux qui attendent encore leur premier combat : les seuls rattachables. */
const sansIdEntite = (etat: Etat): Personnage[] =>
  etat.personnages.filter((personnage) => personnage.idEntite === null);

/**
 * Le portrait seul. Pas `iconeDeClasse` : celle-là porte le liseré de 3 px d'un
 * Emplacement, et un Personnage n'a pas de Couleur (ADR `0003`).
 */
function portrait(classe: string, taille: string): HTMLElement {
  const hote = element('span', `cls ${taille}`.trim());
  const image = element('img');
  // La clé de Classe nomme le fichier, jamais le `breed` (`domaine/classes.ts`).
  image.src = `../../icons/${classe}.png`;
  image.alt = '';
  hote.append(image);
  return hote;
}

/* ======================================================== les vignettes == */

function vignette(
  classe: string,
  nom: string,
  sorte: 'confirme' | 'sans-id' | 'a-identifier',
  ouvrir: (evenement: MouseEvent) => void,
): HTMLElement {
  const sansId = sorte === 'sans-id';
  const hote = element('div', `tile ${sorte === 'confirme' ? '' : sorte}`.trim());
  hote.title = `${nom} — ${nomDeClasse(classe)}${sansId ? ' — jamais vu en combat' : ''}`;
  const cadre = element('div', 'frame');
  cadre.append(portrait(classe, 'xl'));
  if (sorte === 'a-identifier') cadre.append(element('span', 'mark', '?'));
  hote.append(cadre, element('div', 'lab', nom));
  hote.addEventListener('click', ouvrir);
  return hote;
}

function ouvrirLeMenu(element_: HTMLElement, menu: Exclude<typeof vue.menuRoster, null>): void {
  const boite = element_.getBoundingClientRect();
  menu.x = boite.left;
  menu.y = boite.bottom + 5;
  vue.menuRoster = menu;
  repeindre();
}

/* =================================================== la bande à identifier */

/**
 * La **même** liste que l'Overlay de la Demande d'ajout : répondre ici ou
 * là-bas donne le même résultat, c'est le même Roster. En tête du mur et dans
 * le même idiome, ambre et non rouge — ce n'est pas une erreur, c'est une
 * question restée sans réponse (ADR `0010`).
 *
 * ⚠️ Elle ne survit pas à la fermeture de l'app : `roster.json` n'a aucune clef
 * pour une question sans réponse, et on l'assume. L'inconnu revient au prochain
 * combat où il joue.
 */
function bandeAIdentifier(etat: Etat): HTMLElement | null {
  if (etat.aIdentifier.length === 0) return null;
  const bande = element('div', 'band');

  const tete = element('header');
  tete.append(
    element(
      'h3',
      'amb',
      etat.aIdentifier.length === 1
        ? 'Un combattant à identifier'
        : `${etat.aIdentifier.length} combattants à identifier`,
    ),
  );
  tete.append(element('span', 'why', 'vus en combat, pas encore dans le Roster'));
  bande.append(tete);

  const vignettes = element('div', 'tiles');
  for (const demande of etat.aIdentifier) {
    vignettes.append(
      vignette(demande.classe, demande.nom, 'a-identifier', (evenement) => {
        evenement.stopPropagation();
        ouvrirLeMenu(evenement.currentTarget as HTMLElement, {
          sorte: 'ajouter',
          idEntite: demande.idEntite,
          x: 0,
          y: 0,
        });
      }),
    );
  }
  bande.append(vignettes);
  return bande;
}

/* ======================================================= les bandes ====== */

/**
 * Le nom d'un Profil en cours de frappe. Il vit ici et non dans le champ, pour
 * la raison de l'écran des Strats : un re-rendu détruit le champ, et un élément
 * retiré du document ne perd pas le focus proprement — son `blur` n'arrive pas.
 */
let enFrappe: { profilId: string; nom: string } | null = null;

export function validerLeNomDeProfil(): void {
  const frappe = enFrappe;
  enFrappe = null;
  if (frappe === null) return;
  vue.renommeProfilId = null;
  void editerLeRoster({ sorte: 'renommer-profil', profilId: frappe.profilId, nom: frappe.nom });
}

function champDuNomDeProfil(profil: Profil): HTMLInputElement {
  const saisie = element('input', 'ren');
  saisie.value = profil.nom;
  saisie.addEventListener('click', (evenement) => evenement.stopPropagation());
  saisie.addEventListener('input', () => {
    enFrappe = { profilId: profil.id, nom: saisie.value };
  });
  const valider = (): void => {
    if (vue.renommeProfilId !== profil.id) return;
    vue.renommeProfilId = null;
    validerLeNomDeProfil();
    repeindre();
  };
  saisie.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter') valider();
    if (evenement.key === 'Escape') {
      enFrappe = null;
      vue.renommeProfilId = null;
      repeindre();
    }
  });
  saisie.addEventListener('blur', valider);
  return saisie;
}

function enTeteDeBande(etat: Etat, profil: Profil): HTMLElement {
  const tete = element('header');
  if (vue.renommeProfilId === profil.id) {
    tete.append(champDuNomDeProfil(profil));
  } else {
    tete.append(element('h3', '', profil.nom));
  }
  // Le badge « moi » n'apparaît qu'après un renommage : « moi [moi] » ne dit
  // rien. Son autre information — non supprimable — est portée par l'ABSENCE
  // du bouton Supprimer, pas par une étiquette.
  if (profil.estMoi && profil.nom !== 'moi') tete.append(element('span', 'badge', 'moi'));
  tete.append(element('span', 'why', String(personnagesDe(etat, profil.id).length)));
  tete.append(element('div', 'grow'));

  const gestes = element('div', 'acts');
  gestes.append(
    bouton('ghost', 'Renommer', () => {
      vue.renommeProfilId = profil.id;
      repeindre();
    }),
  );
  if (!profil.estMoi) {
    gestes.append(
      bouton('ghost danger', 'Supprimer…', () => void demanderLeProfil(profil.id, profil.nom)),
    );
  }
  tete.append(gestes);
  return tete;
}

function bandeDeProfil(etat: Etat, profil: Profil): HTMLElement {
  const bande = element('div', 'band');
  bande.append(enTeteDeBande(etat, profil));

  const vignettes = element('div', 'tiles');
  for (const personnage of personnagesDe(etat, profil.id)) {
    vignettes.append(
      vignette(
        personnage.classe,
        personnage.nom,
        personnage.idEntite === null ? 'sans-id' : 'confirme',
        (evenement) => {
          evenement.stopPropagation();
          ouvrirLeMenu(evenement.currentTarget as HTMLElement, {
            sorte: 'personnage',
            personnageId: personnage.id,
            x: 0,
            y: 0,
          });
        },
      ),
    );
  }

  // La saisie à la main est le SECOURS, pas le chemin nominal : le Roster se
  // remplit tout seul au premier combat (#17). D'où le ＋ en fin de bande, gris,
  // et non un bouton en tête d'écran.
  const ajout = element('div', 'tile add');
  ajout.title = 'saisir un personnage à la main';
  const cadre = element('div', 'frame');
  cadre.textContent = '＋';
  ajout.append(cadre, element('div', 'lab why', 'à la main'));
  ajout.addEventListener('click', (evenement) => {
    evenement.stopPropagation();
    ouvrirLaSaisie(evenement.currentTarget as HTMLElement, profil.id, null);
  });
  vignettes.append(ajout);

  bande.append(vignettes);
  return bande;
}

/* ====================================================== les ignorés ====== */

/**
 * Les Personnages ignorés vivent **ici**, et pas dans les Réglages : tranché par
 * #23, « pas ici, et pas même en renvoi ». C'est une donnée du Roster.
 *
 * ⚠️ Pas de portrait sur ces lignes, et ce n'est pas un oubli : le modèle gelé
 * par #11 ne retient d'un ignoré que son **ID d'entité** et le nom vu. Il n'a
 * pas de Classe à montrer, et lui en inventer une demanderait une clef de plus
 * pour une liste qu'on ouvre une fois par an.
 */
function lesIgnores(etat: Etat): HTMLElement {
  const hote = element('details', 'ignores');
  hote.append(element('summary', '', `Personnages ignorés (${etat.ignores.length})`));

  for (const ignore of etat.ignores) {
    const ligne = element('div', 'igrow');
    ligne.append(element('span', 'nm', ignore.nomVu === '' ? 'sans nom vu' : ignore.nomVu));
    ligne.append(element('div', 'grow'));
    ligne.append(
      bouton('ghost', 'Proposer à nouveau', () => {
        void editerLeRoster({ sorte: 'ne-plus-ignorer', idEntite: ignore.idEntite });
      }),
    );
    hote.append(ligne);
  }

  hote.append(
    element(
      'p',
      'ignotes',
      etat.ignores.length === 0
        ? 'Aucun. Ignorer un combattant, c’est dire « ne me le propose plus » — c’est réversible, et ça se défait d’ici.'
        : 'Jamais reproposés, et réversible : « proposer à nouveau » remet le combattant dans la liste au-dessus au prochain combat où il joue.',
    ),
  );
  return hote;
}

/* ======================================================== le premier jour  */

/**
 * Le Roster vide. #17 a décidé que l'onboarding n'a **rien** à constituer et que
 * le Roster se remplit tout seul : cet écran annonce, il ne demande rien, et il
 * range la saisie à la main en **secours** — petit, en dessous, formulé comme un
 * recours.
 *
 * ⚠️ Il n'y a plus d'avertissement « le nom doit être exactement celui en jeu ».
 * Le champ canonise pendant la frappe, donc l'avertissement n'a plus d'objet.
 */
function premierLancement(etat: Etat): HTMLElement {
  const hote = element('div', 'vide');
  hote.append(element('h2', '', 'Le Roster est vide, et c’est normal.'));
  hote.append(
    element(
      'p',
      '',
      'Il se remplit tout seul : au premier combat, l’app propose d’enregistrer les personnages qu’elle voit jouer. Rien à préparer.',
    ),
  );
  hote.append(
    element(
      'p',
      'sec',
      'Tu peux quand même les saisir à la main, si tu veux écrire une strat avant de jouer.',
    ),
  );
  const moi = etat.profils.find((profil) => profil.estMoi) ?? etat.profils[0];
  if (moi !== undefined) {
    hote.append(
      bouton('cta ghost', 'Saisir un personnage à la main', (evenement) => {
        evenement.stopPropagation();
        ouvrirLaSaisie(evenement.currentTarget as HTMLElement, moi.id, null);
      }),
    );
  }
  return hote;
}

/* ============================================================== l'écran == */

export function ecranRoster(etat: Etat): DocumentFragment {
  const hote = document.createDocumentFragment();
  const vide = etat.personnages.length === 0 && etat.aIdentifier.length === 0;

  const tete = element('div', 'scrhead');
  tete.append(element('h1', '', 'Roster'));
  if (!vide) {
    tete.append(
      element(
        'p',
        'why',
        `${pluriel(etat.personnages.length, 'personnage')} · ${pluriel(etat.profils.length, 'profil')}`,
      ),
    );
  }
  tete.append(element('div', 'grow'));
  // Sur un Roster vide, « ＋ Nouveau profil » était l'élément le plus voyant de
  // l'écran : un bouton pour créer un contenant vide là où rien n'existe encore.
  if (!vide) tete.append(bouton('', '＋ Nouveau profil', () => void creerUnProfil()));
  hote.append(tete);

  const corps = element('div', 'scrbody');
  if (vide) {
    corps.append(premierLancement(etat));
  } else {
    const mur = element('div', 'wall');
    const aIdentifier = bandeAIdentifier(etat);
    if (aIdentifier !== null) mur.append(aIdentifier);
    for (const profil of etat.profils) mur.append(bandeDeProfil(etat, profil));
    mur.append(lesIgnores(etat));
    corps.append(mur);
  }
  hote.append(corps);
  return hote;
}

/* =============================================================== gestes == */

/** Un Profil naît en édition : un profil sans nom ne sert à rien. */
async function creerUnProfil(): Promise<void> {
  const { profilId } = await editerLeRoster({ sorte: 'creer-profil' });
  vue.renommeProfilId = profilId;
  repeindre();
}

function ouvrirLaSaisie(ancre: HTMLElement, profilId: string, personnage: Personnage | null): void {
  const boite = ancre.getBoundingClientRect();
  vue.menuRoster = null;
  vue.saisie = {
    profilId,
    personnageId: personnage?.id ?? null,
    nom: personnage?.nom ?? '',
    classe: personnage?.classe ?? CLASSES[0]?.[0] ?? 'feca',
    x: boite.left,
    y: boite.bottom + 5,
  };
  repeindre();
}

async function demanderLePersonnage(personnageId: string, nom: string): Promise<void> {
  const consequence = await memo?.consequenceSuppressionPersonnage(personnageId);
  if (consequence === undefined) return;
  vue.menuRoster = null;
  vue.aSupprimer = { sorte: 'personnage', personnageId, nom, consequence };
  repeindre();
}

async function demanderLeProfil(profilId: string, nom: string): Promise<void> {
  const consequence = await memo?.consequenceSuppressionProfil(profilId);
  if (consequence === undefined) return;
  vue.menuRoster = null;
  vue.aSupprimer = { sorte: 'profil', profilId, nom, consequence };
  repeindre();
}

const repondre = (commande: Parameters<typeof editerLeRoster>[0]): void => {
  vue.menuRoster = null;
  void editerLeRoster(commande);
  repeindre();
};

/* =============================================================== calques = */

function boiteDeMenu(point: { x: number; y: number }, hauteur: number): HTMLElement {
  const hote = element('div', 'menupop');
  hote.addEventListener('click', (evenement) => evenement.stopPropagation());
  ancrer(hote, point, { largeur: 210, hauteur });
  return hote;
}

/**
 * Le menu d'une vignette. Il porte ce qu'une vignette ne peut pas porter : la
 * phrase de l'ADR `0002` sur l'origine du nom, et les deux seuls gestes.
 */
function menuDuPersonnage(etat: Etat, personnageId: string, point: MenuPoint): HTMLElement | null {
  const personnage = lePersonnage(etat, personnageId);
  if (personnage === undefined) return null;
  const hote = boiteDeMenu(point, 170);
  hote.append(element('h5', '', personnage.nom));
  hote.append(
    element(
      'p',
      'hint',
      personnage.idEntite === null
        ? `${nomDeClasse(personnage.classe)} — jamais vu en combat. Nom et classe restent corrigeables.`
        : `${nomDeClasse(personnage.classe)} — confirmé par le log. Le log fait foi : nom et classe ne sont plus éditables.`,
    ),
  );
  if (personnage.idEntite === null) {
    hote.append(
      bouton('', 'Corriger le nom / la classe', (evenement) => {
        evenement.stopPropagation();
        ouvrirLaSaisie(hote, personnage.profilId, personnage);
      }),
    );
  }
  hote.append(element('div', 'sepline'));
  hote.append(
    bouton('', 'Supprimer…', () => void demanderLePersonnage(personnage.id, personnage.nom)),
  );
  return hote;
}

/**
 * « Ajouter à ▾ » : un **seul** menu ancré, la forme retenue en #16. Les trois
 * réponses y sont, et « ne pas répondre » n'en est pas une — il n'y a donc rien
 * qui ferme la question sans la trancher.
 */
function menuDAjout(etat: Etat, idEntite: string, point: MenuPoint): HTMLElement | null {
  const demande = laDemande(etat, idEntite);
  if (demande === undefined) return null;
  const hote = boiteDeMenu(point, 250);
  hote.append(element('h5', '', `Ajouter ${demande.nom} à`));
  for (const profil of etat.profils) {
    hote.append(
      bouton('', profil.nom, () =>
        repondre({
          sorte: 'ajouter-personnage',
          profilId: profil.id,
          idEntite,
          nom: demande.nom,
          classe: demande.classe,
        }),
      ),
    );
  }
  hote.append(element('div', 'sepline'));
  hote.append(bouton('', '＋ nouveau profil', () => void ajouterDansUnProfilNeuf(demande)));
  hote.append(element('div', 'sepline'));
  hote.append(
    bouton('', 'Rattacher à un personnage saisi…', () => {
      vue.menuRoster = { sorte: 'rattacher', idEntite, x: point.x, y: point.y };
      repeindre();
    }),
  );
  hote.append(
    bouton('', 'Ignorer', () => repondre({ sorte: 'ignorer', idEntite, nomVu: demande.nom })),
  );
  return hote;
}

async function ajouterDansUnProfilNeuf(demande: DemandeDAjout): Promise<void> {
  const { profilId } = await editerLeRoster({ sorte: 'creer-profil' });
  if (profilId === null) return;
  vue.menuRoster = null;
  vue.renommeProfilId = profilId;
  await editerLeRoster({
    sorte: 'ajouter-personnage',
    profilId,
    idEntite: demande.idEntite,
    nom: demande.nom,
    classe: demande.classe,
  });
  repeindre();
}

/**
 * « Rattacher à ▾ ». Le rattachement ne passe devant qu'à **classe égale**
 * (#16) : « rattacher d'abord » proposait l'erreur en tête de liste. Les autres
 * classes restent atteignables, précédées de l'avertissement qu'elles valent.
 */
function menuDeRattachement(etat: Etat, idEntite: string, point: MenuPoint): HTMLElement | null {
  const demande = laDemande(etat, idEntite);
  if (demande === undefined) return null;
  const hote = boiteDeMenu(point, 250);
  hote.append(element('h5', '', `Rattacher ${demande.nom} à`));

  const libres = sansIdEntite(etat);
  if (libres.length === 0) {
    hote.append(
      element(
        'p',
        'hint',
        'Aucun personnage saisi à la main n’attend son premier combat. Le rattachement est le filet de la saisie manuelle : sans saisie, rien à rattraper.',
      ),
    );
    return hote;
  }

  const memeClasse = libres.filter((personnage) => personnage.classe === demande.classe);
  const autres = libres.filter((personnage) => personnage.classe !== demande.classe);

  const ligne = (personnage: Personnage): HTMLElement => {
    const geste = bouton('', personnage.nom, () => {
      if (personnage.classe === demande.classe) {
        repondre({
          sorte: 'rattacher',
          personnageId: personnage.id,
          idEntite,
          nom: demande.nom,
          classe: demande.classe,
        });
        return;
      }
      vue.menuRoster = {
        sorte: 'classe-differente',
        idEntite,
        personnageId: personnage.id,
        x: point.x,
        y: point.y,
      };
      repeindre();
    });
    geste.append(element('span', 'why', nomDeClasse(personnage.classe)));
    return geste;
  };

  for (const personnage of memeClasse) hote.append(ligne(personnage));
  if (memeClasse.length === 0) {
    hote.append(element('p', 'hint', `Aucun ${nomDeClasse(demande.classe)} saisi à la main.`));
  }
  if (autres.length > 0) {
    hote.append(element('div', 'sepline'));
    hote.append(
      element(
        'p',
        'hint warn',
        'Classe différente — l’app préviendra, et « non » annule le rattachement.',
      ),
    );
    for (const personnage of autres) hote.append(ligne(personnage));
  }
  return hote;
}

/**
 * L'avertissement de classe. L'ADR `0002` interdit de garder une classe fausse
 * sur un ID attaché, donc rattacher **écrase** la classe saisie, et « non »
 * annule tout le geste plutôt que d'accepter un mensonge.
 */
function avertissementDeClasse(
  etat: Etat,
  idEntite: string,
  personnageId: string,
  point: MenuPoint,
): HTMLElement | null {
  const demande = laDemande(etat, idEntite);
  const personnage = lePersonnage(etat, personnageId);
  if (demande === undefined || personnage === undefined) return null;
  const hote = boiteDeMenu(point, 190);
  hote.append(element('h5', '', 'Classe différente'));
  const dire = element('p', 'hint');
  dire.append(
    document.createTextNode('Le log dit que '),
    element('b', '', demande.nom),
    document.createTextNode(` est ${nomDeClasse(demande.classe)}, et tu l’avais saisi `),
    element('b', '', personnage.nom),
    document.createTextNode(
      `, ${nomDeClasse(personnage.classe)}. Rattacher écrasera la classe saisie par celle du log.`,
    ),
  );
  hote.append(dire);
  hote.append(
    bouton('', 'Oui, c’est le même personnage', () =>
      repondre({
        sorte: 'rattacher',
        personnageId,
        idEntite,
        nom: demande.nom,
        classe: demande.classe,
      }),
    ),
  );
  hote.append(
    bouton('ghost', 'Non, annuler le rattachement', () => {
      vue.menuRoster = null;
      repeindre();
    }),
  );
  return hote;
}

type MenuPoint = { x: number; y: number };

/* ------------------------------------------------------- la saisie ------ */

/**
 * La saisie manuelle : un nom et une Classe, sans ID d'entité (#17).
 *
 * Le champ **canonise pendant la frappe** — on tape `s'alu-ca'va` et on lit
 * `S'Alu-Ca'Va`. Deux conséquences dans ce code :
 *
 *  - le doublon se dit **ici**, avant d'exister, parce qu'un nom canonique
 *    appartient à un seul personnage du serveur ;
 *  - rien ne se repeint à chaque touche : un re-rendu détruirait le champ et le
 *    caret sauterait. L'avis et le bouton se mettent à jour **sur place**.
 */
function formulaireDeSaisie(etat: Etat): HTMLElement | null {
  const saisie = vue.saisie;
  if (saisie === null) return null;
  const profil = leProfil(etat, saisie.profilId);
  const correction = saisie.personnageId !== null;

  const hote = element('div', 'form');
  hote.addEventListener('click', (evenement) => evenement.stopPropagation());
  hote.append(
    element(
      'h5',
      '',
      correction ? 'Corriger' : `Saisir à la main${profil === undefined ? '' : ` — ${profil.nom}`}`,
    ),
  );

  const champ = element('input', 'fnom');
  champ.value = saisie.nom;
  champ.placeholder = 'nom en jeu';
  hote.append(champ);

  const avis = element('p', 'warn');
  hote.append(avis);

  const grille = element('div', 'clsgrid');
  for (const [cle, nom] of CLASSES) {
    const image = element('img', cle === saisie.classe ? 'cur' : '');
    image.src = `../../icons/${cle}.png`;
    image.alt = nom;
    image.title = nom;
    image.addEventListener('click', () => {
      saisie.classe = cle;
      repeindre();
    });
    grille.append(image);
  }
  hote.append(grille);

  const valider = (): void => {
    const nom = canoniserNom(champ.value);
    if (!estNomPossible(nom) || doublon(etat, nom, saisie.personnageId) !== undefined) return;
    vue.saisie = null;
    void editerLeRoster(
      saisie.personnageId === null
        ? { sorte: 'saisir-personnage', profilId: saisie.profilId, nom, classe: saisie.classe }
        : {
            sorte: 'corriger-personnage',
            personnageId: saisie.personnageId,
            nom,
            classe: saisie.classe,
          },
    );
    repeindre();
  };

  const gestes = element('div', 'acts');
  gestes.append(
    bouton('ghost', 'Annuler', () => {
      vue.saisie = null;
      repeindre();
    }),
  );
  const poser = bouton('', correction ? 'Corriger' : 'Ajouter', valider);
  gestes.append(poser);
  hote.append(gestes);

  const majDuChamp = (): void => {
    // Canoniser sous le curseur : on remet le caret là où il était, sinon il
    // saute en fin de champ à chaque lettre insérée au milieu.
    const position = champ.selectionStart ?? champ.value.length;
    const canonique = canoniserNom(champ.value);
    if (canonique !== champ.value) {
      const recule = champ.value.length - canonique.length;
      champ.value = canonique;
      const ou = Math.max(0, Math.min(position - recule, canonique.length));
      champ.setSelectionRange(ou, ou);
    }
    saisie.nom = champ.value;
    const deja = doublon(etat, champ.value, saisie.personnageId);
    const sonProfil = deja === undefined ? undefined : leProfil(etat, deja.profilId);
    avis.replaceChildren();
    if (deja !== undefined) {
      avis.append(
        document.createTextNode(`« ${deja.nom} » est déjà dans ton Roster`),
        ...(sonProfil === undefined
          ? []
          : [document.createTextNode(', profil '), element('b', '', sonProfil.nom)]),
        document.createTextNode(
          ', et attend son premier combat. Un nom appartient à un seul personnage.',
        ),
      );
    }
    poser.disabled = deja !== undefined || !estNomPossible(champ.value);
  };

  champ.addEventListener('input', majDuChamp);
  champ.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter') valider();
    if (evenement.key === 'Escape') {
      vue.saisie = null;
      repeindre();
    }
  });
  majDuChamp();

  ancrer(hote, saisie, { largeur: 266, hauteur: 300 });
  return hote;
}

/**
 * Le doublon, calculé du côté de la surface pour pouvoir le **dire** pendant la
 * frappe. Ce n'est pas lui qui décide : `edition-roster.ts` refait le calcul et
 * refuse la commande, et c'est là qu'est la règle.
 */
function doublon(etat: Etat, nom: string, sauf: string | null): Personnage | undefined {
  const canonique = canoniserNom(nom);
  return etat.personnages.find(
    (personnage) =>
      personnage.id !== sauf &&
      personnage.idEntite === null &&
      canoniserNom(personnage.nom) === canonique,
  );
}

/* ------------------------------------------------- les deux confirmations */

/**
 * ⚠️ La confirmation d'un Personnage a **deux formes**, et elle se tait sur la
 * seconde. #11 a gelé qu'elle offre les deux gestes — supprimer n'est pas
 * ignorer — mais « ignorer » retient un **ID d'entité**, et un Personnage saisi
 * à la main n'en a pas : il n'y a rien à retenir de lui. Le bouton n'apparaît
 * simplement pas, et **rien ne l'explique** : la phrase qui le disait mettait
 * « ID d'entité » devant les yeux du joueur pour un cas rare.
 */
function dialogueDeSuppression(): HTMLElement | null {
  const cible = vue.aSupprimer;
  if (cible === null || (cible.sorte !== 'personnage' && cible.sorte !== 'profil')) return null;

  const voile = element('div', 'scrim');
  const boite = element('div', 'dlg');
  const gestes = element('div', 'acts');
  const fermer = (): void => {
    vue.aSupprimer = null;
    repeindre();
  };
  gestes.append(bouton('ghost', 'Annuler', fermer));

  if (cible.sorte === 'personnage') {
    const { idEntite, engagements } = cible.consequence;
    boite.append(element('h2', '', `Supprimer « ${cible.nom} » ?`));
    if (engagements.length === 0) {
      boite.append(element('p', '', 'Il n’est engagé dans aucune strat : rien ne part avec lui.'));
    } else {
      // « le rouge dans Ombre Épaisse » : nom de Strat plus Couleur, la seule
      // identité qu'un Emplacement porte (ADR 0003).
      const ou = element('p');
      ou.append(document.createTextNode(`${cible.nom} est `));
      engagements.forEach((engagement, rang) => {
        if (rang > 0) {
          ou.append(document.createTextNode(rang === engagements.length - 1 ? ' et ' : ', '));
        }
        ou.append(
          element('span', 'count', `le ${engagement.couleur}`),
          document.createTextNode(' dans '),
          element('i', '', engagement.stratNom),
        );
      });
      ou.append(document.createTextNode('.'));
      boite.append(ou);
      const compte = element('p');
      compte.append(
        element('span', 'count', pluriel(engagements.length, 'préférence de liaison')),
        document.createTextNode(
          engagements.length > 1
            ? ' partent avec lui. Les strats, elles, ne bougent pas : elles sont écrites contre des classes.'
            : ' part avec lui. Les strats, elles, ne bougent pas : elles sont écrites contre des classes.',
        ),
      );
      boite.append(compte);
    }
    if (idEntite !== null) {
      boite.append(
        element(
          'p',
          'warn',
          'Le supprimer ne l’empêche pas de revenir : il sera reproposé au prochain combat où il joue. Pour ne plus qu’on te le propose, c’est « ignorer ».',
        ),
      );
      gestes.append(
        bouton('danger', 'Supprimer et ignorer', () => {
          vue.aSupprimer = null;
          // Deux appels, parce que ce sont deux actes : l'un retire le
          // Personnage, l'autre retient son ID d'entité pour toujours.
          void editerLeRoster({ sorte: 'supprimer-personnage', personnageId: cible.personnageId });
          void editerLeRoster({ sorte: 'ignorer', idEntite, nomVu: cible.nom });
          repeindre();
        }),
      );
    }
    gestes.append(
      bouton('danger', 'Supprimer', () => {
        vue.aSupprimer = null;
        void editerLeRoster({ sorte: 'supprimer-personnage', personnageId: cible.personnageId });
        repeindre();
      }),
    );
  } else {
    const { personnages, preferences } = cible.consequence;
    boite.append(element('h2', '', `Supprimer le profil « ${cible.nom} » ?`));
    if (personnages.length === 0) {
      boite.append(element('p', '', 'Il ne contient aucun personnage.'));
    } else {
      const emportes = element('p');
      emportes.append(
        element('span', 'count', pluriel(personnages.length, 'personnage')),
        document.createTextNode(
          `${personnages.length > 1 ? ' partent' : ' part'} avec lui : ${personnages
            .map((personnage) => personnage.nom)
            .join(', ')}.`,
        ),
      );
      boite.append(emportes);
    }
    if (preferences > 0) {
      const compte = element('p');
      compte.append(
        element('span', 'count', pluriel(preferences, 'préférence de liaison')),
        document.createTextNode(preferences > 1 ? ' partent aussi.' : ' part aussi.'),
      );
      boite.append(compte);
    }
    boite.append(
      element(
        'p',
        'warn',
        'Un profil, c’est le pote qui farme avec toi : s’il part, ses personnages partent. Ceux qui ont déjà joué seront reproposés au prochain combat.',
      ),
    );
    gestes.append(
      bouton('danger', 'Supprimer le profil', () => {
        vue.aSupprimer = null;
        void editerLeRoster({ sorte: 'supprimer-profil', profilId: cible.profilId });
        repeindre();
      }),
    );
  }

  boite.append(gestes);
  voile.append(boite);
  return voile;
}

/** Les calques de cet écran, dans l'ordre où ils se recouvrent. */
export function calquesRoster(etat: Etat): HTMLElement[] {
  const menu = vue.menuRoster;
  let ancre: HTMLElement | null = null;
  if (menu !== null) {
    switch (menu.sorte) {
      case 'personnage':
        ancre = menuDuPersonnage(etat, menu.personnageId, menu);
        break;
      case 'ajouter':
        ancre = menuDAjout(etat, menu.idEntite, menu);
        break;
      case 'rattacher':
        ancre = menuDeRattachement(etat, menu.idEntite, menu);
        break;
      case 'classe-differente':
        ancre = avertissementDeClasse(etat, menu.idEntite, menu.personnageId, menu);
        break;
      default:
        ancre = null;
    }
  }
  return [ancre, formulaireDeSaisie(etat), dialogueDeSuppression()].filter(
    (calque): calque is HTMLElement => calque !== null,
  );
}
