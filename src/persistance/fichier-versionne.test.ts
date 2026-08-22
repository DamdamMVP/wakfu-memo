import { deepStrictEqual, match, strictEqual, throws } from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { type Brut, FichierVersionne, type Forme } from './fichier-versionne.ts';

const dossierNeuf = () => mkdtempSync(join(tmpdir(), 'wakfu-memo-test-'));

type Essai = { readonly valeur: string };

/**
 * A test shape at schema 2, because the three real files are all at 1: there is
 * no earlier schema to migrate from yet. This is where the real case goes the
 * day one of them moves to 2.
 */
const FORME: Forme<Essai> = {
  nom: 'essai',
  schema: 2,
  defauts: () => ({ valeur: 'défaut' }),
  lire: (brut) => ({ valeur: typeof brut['valeur'] === 'string' ? brut['valeur'] : 'défaut' }),
  ecrire: (donnees) => ({ valeur: donnees.valeur }),
  // v1 said « texte », v2 says « valeur ».
  migrations: { 1: (brut: Brut) => ({ valeur: brut['texte'] }) },
};

const ouvrir = (dossier: string, forme = FORME, options = {}) => {
  const fichier = new FichierVersionne(dossier, forme, { antiRebondMs: 5, ...options });
  fichier.charger();
  return fichier;
};

const lireJson = (dossier: string, nom: string): Brut =>
  JSON.parse(readFileSync(join(dossier, nom), 'utf8')) as Brut;

describe('le fichier versionné', () => {
  it('part sur les défauts quand le fichier est absent, sans rien écrire', () => {
    const dossier = dossierNeuf();
    const fichier = ouvrir(dossier);

    deepStrictEqual(fichier.verdict, { etat: 'defauts', cause: 'absent' });
    deepStrictEqual(fichier.lire(), { valeur: 'défaut' });
    deepStrictEqual(readdirSync(dossier), []);
  });

  it('fait un aller-retour fidèle, en JSON indenté avec le schéma en tête', () => {
    const dossier = dossierNeuf();
    const premier = ouvrir(dossier);
    premier.ecrire({ valeur: 'Ombre Épaisse' });
    premier.vider();

    strictEqual(
      readFileSync(join(dossier, 'essai.json'), 'utf8'),
      '{\n  "schema": 2,\n  "valeur": "Ombre Épaisse"\n}\n',
    );
    deepStrictEqual(ouvrir(dossier).lire(), { valeur: 'Ombre Épaisse' });
  });

  it('agglutine une rafale de modifications en une écriture, et garde la dernière', () => {
    const dossier = dossierNeuf();
    const fichier = ouvrir(dossier);
    for (const valeur of ['a', 'ab', 'abc', 'abcd']) fichier.ecrire({ valeur });

    // Rien sur le disque avant l'échéance : c'est l'anti-rebond.
    deepStrictEqual(readdirSync(dossier), []);
    fichier.vider();
    deepStrictEqual(lireJson(dossier, 'essai.json'), { schema: 2, valeur: 'abcd' });
  });

  it('écrit pendant une saisie continue, sans attendre qu’elle s’arrête', async () => {
    const dossier = dossierNeuf();
    const fichier = ouvrir(dossier, FORME, { antiRebondMs: 20 });

    // Une frappe toutes les 5 ms : l'échéance est fixée par la première
    // modification et ne se reporte pas, sinon un crash coûterait toute la
    // saisie. On ne vide jamais à la main ici, c'est le minuteur qu'on observe.
    for (let frappe = 0; frappe < 20; frappe += 1) {
      fichier.ecrire({ valeur: `frappe ${frappe}` });
      await new Promise((resoudre) => setTimeout(resoudre, 5));
    }

    match(String(lireJson(dossier, 'essai.json')['valeur']), /^frappe /);
  });

  it('met de côté un fichier illisible et repart sur les défauts', () => {
    const dossier = dossierNeuf();
    writeFileSync(join(dossier, 'essai.json'), '{ ceci n’est pas du JSON', 'utf8');

    const fichier = ouvrir(dossier, FORME, {
      maintenant: () => new Date('2026-08-21T14:32:05Z'),
    });

    deepStrictEqual(fichier.verdict, {
      etat: 'defauts',
      cause: 'illisible',
      miseDeCote: 'essai.corrompu-2026-08-21-14-32-05.json',
    });
    strictEqual(fichier.corrompu, true);
    deepStrictEqual(fichier.lire(), { valeur: 'défaut' });
    // Mis de côté, pas écrasé : le texte d'origine est intact sous son nouveau nom.
    strictEqual(
      readFileSync(join(dossier, 'essai.corrompu-2026-08-21-14-32-05.json'), 'utf8'),
      '{ ceci n’est pas du JSON',
    );
    deepStrictEqual(readdirSync(dossier), ['essai.corrompu-2026-08-21-14-32-05.json']);
  });

  it('met de côté un fichier sans numéro de schéma, plutôt que de deviner', () => {
    const dossier = dossierNeuf();
    writeFileSync(join(dossier, 'essai.json'), '{"valeur":"orpheline"}', 'utf8');

    const fichier = ouvrir(dossier);

    strictEqual(fichier.corrompu, true);
    strictEqual(fichier.lire().valeur, 'défaut');
  });

  it('refuse une version plus récente, ne l’écrase jamais, et refuse d’écrire', () => {
    const dossier = dossierNeuf();
    const venuDuFutur = '{\n  "schema": 3,\n  "valeur": "écrite par une version d’après"\n}\n';
    writeFileSync(join(dossier, 'essai.json'), venuDuFutur, 'utf8');

    const fichier = ouvrir(dossier);

    deepStrictEqual(fichier.verdict, { etat: 'refuse', schemaTrouve: 3, schemaConnu: 2 });
    strictEqual(fichier.modifiable, false);
    throws(() => fichier.ecrire({ valeur: 'écrasement' }), /refusé/);
    fichier.vider();
    strictEqual(readFileSync(join(dossier, 'essai.json'), 'utf8'), venuDuFutur);
  });

  it('migre d’office, laisse sa sauvegarde, et réécrit le fichier au passage', () => {
    const dossier = dossierNeuf();
    const v1 = '{\n  "schema": 1,\n  "texte": "Tal Kasha duo"\n}\n';
    writeFileSync(join(dossier, 'essai.json'), v1, 'utf8');

    const fichier = ouvrir(dossier);

    deepStrictEqual(fichier.verdict, { etat: 'charge', migreDepuis: 1 });
    deepStrictEqual(fichier.lire(), { valeur: 'Tal Kasha duo' });
    strictEqual(readFileSync(join(dossier, 'essai.v1.bak'), 'utf8'), v1);
    deepStrictEqual(lireJson(dossier, 'essai.json'), { schema: 2, valeur: 'Tal Kasha duo' });

    // Deuxième lancement : plus rien à migrer, donc plus rien à annoncer.
    deepStrictEqual(ouvrir(dossier).verdict, { etat: 'charge', migreDepuis: null });
  });

  it('met de côté quand un échelon de migration manque', () => {
    const dossier = dossierNeuf();
    writeFileSync(join(dossier, 'essai.json'), '{"schema":1,"texte":"perdu"}', 'utf8');

    const fichier = ouvrir(dossier, { ...FORME, schema: 4 });

    strictEqual(fichier.corrompu, true);
    strictEqual(fichier.lire().valeur, 'défaut');
  });

  it('ne laisse pas de fichier temporaire derrière lui', () => {
    const dossier = dossierNeuf();
    const fichier = ouvrir(dossier);
    fichier.ecrire({ valeur: 'un' });
    fichier.vider();
    fichier.ecrire({ valeur: 'deux' });
    fichier.vider();

    deepStrictEqual(readdirSync(dossier), ['essai.json']);
  });

  it('quitter sans rien avoir changé ne touche pas au fichier', () => {
    const dossier = dossierNeuf();
    ouvrir(dossier).vider();
    deepStrictEqual(readdirSync(dossier), []);
  });
});
