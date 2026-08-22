/**
 * L'écran Prise en main : six étapes en plein cadre, une capture par étape.
 *
 * Transcrit de `prototypes/prise-en-main/`, variante C, retenue en maquettant
 * les trois formes contre l'app finie (#34). Ce qui la distingue des deux
 * autres — une suite d'étapes dans l'écran, une page qui défile — c'est qu'elle
 * **masque la colonne** : la visite prend la fenêtre, et l'image domine. C'est
 * le seul écran de l'app qui retire la colonne, et c'est délibéré : il montre
 * des captures de cette colonne, l'afficher deux fois brouillait la lecture.
 *
 * Trois choix tiennent cet écran, et ils se répondent :
 *
 *  - il **explique, il n'agit pas**. Aucun contrôle ici — pas de sélecteur de
 *    dossier, pas de création de profil, pas de curseur. Un texte survit à un
 *    changement d'écran, un widget dupliqué non, et c'est ce qui périmait les
 *    tutoriels que #17 refusait d'écrire d'avance ;
 *  - il **montre plutôt qu'il ne raconte** : deux phrases par étape, et une
 *    capture en grand. Les captures vivent dans `prise-en-main/`, copiées vers
 *    `dist/` comme les portraits de classe ;
 *  - il **ne se rejoue pas depuis les Réglages** (#32 l'y a retiré, ça
 *    doublonnait) : l'entrée de la colonne est le seul chemin de retour.
 *
 * ⚠️ Deux choses que la séquence porte et que rien d'autre dans le produit ne
 * dit : **le fenêtré** (étape 2) — en plein écran exclusif l'Overlay est
 * invisible, et c'est la seule panne totale que rien n'annonce — et **le bord
 * droit de la fiche** (étape 6), que l'ADR `0013` confie à la Porte, mais que
 * « personne ne devine » selon #34. Ce sont les deux seuls endroits où cet
 * écran est la source, et pas un rappel.
 */

import { bouton, element } from './dom.ts';
import type { Etat } from './pont.ts';
import { memo } from './pont.ts';
import { repeindre, vue } from './vue.ts';

/** Le raccourci du verrou, tel qu'il est posé — l'étape 6 le nomme. */
function raccourciDuVerrou(etat: Etat): string {
  return etat.raccourcis?.['verrou']?.combinaison ?? 'le raccourci du verrou';
}

type Etape = {
  /** Le fichier de `prise-en-main/`. `null` : l'étape n'en a pas. */
  readonly capture: string | null;
  readonly titre: string;
  /** Rendu en fragments pour que la mise en gras reste du DOM, pas du HTML. */
  readonly texte: (etat: Etat) => readonly HTMLElement[];
};

/**
 * Une phrase avec des passages en gras, sans passer par `innerHTML` : la CSP de
 * la Fenêtre principale n'autorise que ses propres ressources, et un texte de
 * tutoriel n'a aucune raison d'être la seule chose qu'on injecte en brut.
 *
 * Les morceaux d'indice **impair** sont en gras — `phrase('a', 'b', 'c')` donne
 * « a**b**c ».
 */
function phrase(...morceaux: readonly string[]): HTMLElement {
  const p = element('p');
  morceaux.forEach((morceau, index) => {
    if (morceau === '') return;
    p.append(index % 2 === 1 ? element('b', '', morceau) : document.createTextNode(morceau));
  });
  return p;
}

/** L'encart d'une étape : ce qu'elle est seule à apprendre. */
function encart(...morceaux: readonly string[]): HTMLElement {
  const bloc = phrase(...morceaux);
  bloc.className = 'encart';
  return bloc;
}

const ETAPES: readonly Etape[] = [
  {
    // Le rendu en jeu ouvre la visite : la première image doit montrer le
    // produit EN SITUATION, pas un de ses morceaux détouré.
    capture: 'combat-en-jeu.png',
    titre: 'Le carnet de notes de tes runs',
    texte: () => [
      phrase(
        'Wakfu Mémo garde tes ',
        'notes de farm',
        ' : ce que chaque personnage doit faire, donjon par donjon, tour par tour.',
      ),
      phrase('À la place du doc partagé qu’on relit en catastrophe entre deux combats.'),
    ],
  },
  {
    // La fiche détourée, une fois qu'on a vu où elle se pose : c'est le détail
    // de ce qu'on lit, et il ne se distingue pas sur la capture d'ensemble.
    capture: 'fiche-overlay.png',
    titre: 'Pendant le combat, sous les yeux',
    texte: () => [
      phrase(
        'La fiche du tour s’affiche ',
        'par-dessus le jeu',
        ', et la ligne de celui qui joue s’allume toute seule — l’app suit le combat en lisant les logs de Wakfu.',
      ),
      phrase('Tes clics la traversent : elle est là, elle ne gêne pas.'),
      // Le plein écran exclusif est hors périmètre, et rien d'autre dans le
      // produit ne le dit. C'est la seule panne totale que rien n'annonce.
      encart(
        'Joue en ',
        'fenêtré',
        ', ou en fenêtré sans bordure : en plein écran exclusif, rien ne peut se dessiner par-dessus le jeu.',
      ),
    ],
  },
  {
    capture: 'strat-editeur.png',
    titre: 'Écris tes strats',
    texte: () => [
      phrase(
        'Une strat par donjon : la ',
        'compo',
        ' à gauche, une ',
        'fiche par tour',
        ', et une consigne par personnage. Plus une annotation en pied de tour quand il faut crier.',
      ),
      phrase('Autant de strats que de donjons, et on choisit celle qui sert.'),
    ],
  },
  {
    capture: 'roster.png',
    titre: 'Ton roster, une fois pour toutes',
    texte: () => [
      phrase('Tes personnages, et ceux de tes ', 'partenaires de farm', ', rangés par profil.'),
      phrase(
        'L’app les reconnaît d’un combat à l’autre — même après un renommage — et sait donc toute seule qui occupe quelle place dans la strat.',
      ),
    ],
  },
  {
    capture: 'demande-ajout.png',
    titre: 'Un inconnu en combat ? Il te le demande',
    texte: () => [
      phrase(
        'Un combattant que le roster ne connaît pas, et la question arrive ',
        'pendant le placement',
        ' : tu l’ajoutes à un profil, ou tu l’ignores.',
      ),
      phrase('Tu peux répondre plus tard : ça t’attend, et ça ne bloque rien.'),
    ],
  },
  {
    capture: 'reglages.png',
    titre: 'Et tu règles le reste',
    texte: (etat) => [
      phrase('Opacité, taille du texte, raccourcis, dossiers.'),
      phrase(
        'La position et la largeur de la fiche, elles, se prennent ',
        'sur la fiche',
        ` : ${raccourciDuVerrou(etat)} la déverrouille, tu la glisses où tu veux et tu `,
        'attrapes son bord droit',
        ' pour la largeur.',
      ),
    ],
  },
];

export const NOMBRE_D_ETAPES = ETAPES.length;

/**
 * La capture de l'étape. Absente du disque, elle **retire sa place** au lieu de
 * la garder vide.
 *
 * Une capture manquante est un défaut de build — `copie-statique.mjs` prévient —
 * et pas un état de l'app. Mais vider la scène sans la retirer laissait un
 * `flex: 1` qui mangeait toute la fenêtre : l'étape avait l'air cassée, alors
 * qu'elle est seulement sans image. Retirée, le texte se centre et l'étape se
 * lit comme ce qu'elle est.
 */
function capture(fichier: string, diapo: HTMLElement): HTMLElement {
  const scene = element('div', 'scene');
  const image = document.createElement('img');
  image.className = 'shot';
  image.alt = '';
  // `onerror` avant `src` : posé après, une erreur immédiate passe à côté.
  image.onerror = () => {
    scene.remove();
    diapo.classList.add('sans-capture');
  };
  image.src = `../../prise-en-main/${fichier}`;
  scene.append(image);
  return scene;
}

function points(): HTMLElement {
  const hote = element('div', 'points');
  ETAPES.forEach((etape, index) => {
    const point = bouton(index === vue.etape ? 'on' : '', '', () => {
      vue.etape = index;
      repeindre();
    });
    point.title = etape.titre;
    hote.append(point);
  });
  return hote;
}

/**
 * Le bout du parcours et « Passer » font la même chose : marquer la Prise en
 * main vue, et poser l'utilisateur sur les Strats. Un second tour forcé est
 * pire qu'un tour manqué, et l'entrée de la colonne reste là pour le rejouer.
 */
function sortir(): void {
  memo?.marquerPriseEnMainVue();
  vue.ecran = 'strats';
  vue.etape = 0;
  repeindre();
}

export function ecranPriseEnMain(etat: Etat): DocumentFragment {
  const hote = document.createDocumentFragment();
  const etape = ETAPES[vue.etape] ?? ETAPES[0];
  if (etape === undefined) return hote;

  const diapo = element('div', 'diapo');

  // Rejouée depuis la colonne, il n'y a rien à « passer » : on en sort par où
  // l'on veut. Au premier lancement, en revanche, la sortie doit être visible
  // avant d'avoir lu quoi que ce soit.
  const haut = element('div', 'haut');
  haut.append(element('span', 'grow'));
  haut.append(bouton('ghost', etat.priseEnMainVue ? 'Fermer' : 'Passer', sortir));
  diapo.append(haut);

  if (etape.capture !== null) diapo.append(capture(etape.capture, diapo));

  const bas = element('div', 'bas');
  const textes = element('div', 'txt');
  textes.append(element('h2', '', etape.titre));
  textes.append(...etape.texte(etat));
  bas.append(textes);

  const nav = element('div', 'nav');
  nav.append(points());
  nav.append(element('span', 'rang', `${vue.etape + 1} / ${ETAPES.length}`));
  if (vue.etape > 0) {
    nav.append(
      bouton('ghost', 'Retour', () => {
        vue.etape -= 1;
        repeindre();
      }),
    );
  }
  nav.append(
    vue.etape < ETAPES.length - 1
      ? bouton('suiv', 'Suivant', () => {
          vue.etape += 1;
          repeindre();
        })
      : bouton('suiv', 'Créer ma première strat', sortir),
  );
  bas.append(nav);

  diapo.append(bas);
  hote.append(diapo);
  return hote;
}
