# Bananani 🍌

Site web personnel de gestion de recettes : on crée des recettes avec ingrédients
détaillés, on imprime des fiches A4 avec un QR Code, on les colle sur le frigo, puis
on scanne (`/scan`) pour remplir automatiquement la liste de courses.

> Pour l'architecture détaillée (modèle de données, routes, conventions de code),
> voir [`CLAUDE.md`](./CLAUDE.md). Ce README couvre surtout le **lancement** et le
> **déploiement** — les petits pièges à ne pas réoublier.

## Lancer en local

```bash
npm run dev          # http://localhost:5173 (ou 5174 si occupé)
npm run db:studio    # UI Drizzle pour inspecter/éditer la base SQLite
npm run db:push      # resynchronise schema.js → DB (après modif du schéma)
npm run build        # build production
npm run preview      # preview du build
```

- La base SQLite (`data/bananani.db`) se **crée toute seule au démarrage** — rien à
  initialiser à la main.
- Login dans l'app (plus de Basic Auth).
- **Scan caméra** : marche sur `localhost`, mais sur un vrai mobile la caméra exige
  du HTTPS (donc OK en prod Fly, pas en HTTP local depuis le tel). En dépannage, on
  peut toujours taper le code à la main sur `/scan`.

## Hébergement : Fly.io

### Recettes, portions et courses

Les nouveaux ingrédients sont ajoutés à la fin de la recette. Les boutons
« Monter » et « Descendre » permettent de changer leur ordre, conservé à
l’enregistrement et sur les fiches imprimées.

Le nombre de personnes d’une recette correspond à ses quantités de référence.
Dans « Semaine », chaque repas possède son propre nombre de personnes (1 à 50).
La génération des courses adapte proportionnellement les quantités : une recette
pour 4 personnes lundi et 2 mardi produit les courses pour 6 portions. La vue
« Par recette » affiche le total. Les portions sont conservées lors d’un déplacement
ou d’une copie de semaine. Les courses sont un instantané : modifier ensuite la
recette ne change pas une liste déjà générée. Les anciens placements héritent des
portions de leur recette jusqu’à leur premier ajustement.

Une case vide dans les courses signifie « à acheter » ; cochée, elle signifie
« dans le panier ou acheté ». Décocher remet l’article à acheter. La corbeille
exclut un article ; « Retirer les articles achetés » retire les lignes cochées.
L’impression contient uniquement les articles non cochés. Les unités dénombrables
s’accordent avec les quantités affichées ; les symboles g, ml… restent invariables.

### Illustrer un plat

Le formulaire propose l’appareil photo, la galerie et un aperçu avant enregistrement.
« Rechercher une image » interroge Wikimedia Commons, sans clé supplémentaire.
L’auteur, la licence et le lien source sont conservés avec l’image et affichés sur
la recette et les fiches. Seules les images JPEG, PNG et WebP avec licence CC BY,
CC BY-SA, CC0 ou domaine public identifiée sont proposées. Les métadonnées sont
revérifiées à l’enregistrement, puis l’image est stockée sur le volume local.
Limites : 60 recherches par utilisateur et par heure (en mémoire), téléchargement
de 5 Mo maximum ; délais de 15 s pour la recherche et 20 s pour l’image.

### Vérifications

Utiliser Node 22, comme dans Docker, pour le module SQLite natif.

```sh
npm test
npm run build
npm run test:integration
```

Les tests utilisent des bases SQLite temporaires et vérifient notamment les
migrations, l’ordre des ingrédients, les portions, les totaux, le cochage,
l’impression et l’isolation entre comptes. Le workflow de déploiement les exécute
avant de publier. Pour vérifier aussi une vraie recherche et un import Commons :
exécuter `npm run test:integration` avec `LIVE_COMMONS=1` dans l’environnement.

### Validation des rayons

La création et la modification d’une recette passent par « Vérifier les rayons ».
Il est possible de sélectionner un rayon ou d’en saisir un nouveau (80 caractères).
Les rayons personnalisés enregistrés sont proposés dans les recettes suivantes.
Les rayons connus du catalogue sont réutilisés. Un seul appel à
`ministral-3b-2512` propose les rayons manquants, parmi la liste autorisée.
Les noms des ingrédients inconnus sont transmis à Mistral avec la même clé
serveur que l’OCR. La suggestion ne modifie pas la base : seuls les choix
enregistrés avec la recette corrigent le catalogue commun (et donc le classement
des ingrédients correspondants). Une valeur vide conserve le rayon déjà connu,
ou reste dans « Autres » si aucun rayon n’existe.
En cas d’échec, la sélection manuelle reste disponible. Limites : 100 ingrédients
par requête, 30 appels par utilisateur et par heure en mémoire, délai de 20 s.
Tests : `node --test scripts/ingredient-categories.test.js`.

### Importer une recette papier

Dans « Nouvelle recette », prendre une photo ou choisir une image JPEG, PNG ou
WebP (une page), puis lancer l’analyse. Les photos sont automatiquement réduites
à 3 000 pixels sur le grand côté et compressées en JPEG si cela les allège, avant
de vérifier la limite d’envoi de 10 Mo. Appliquer le résultat au
formulaire et le relire avant l’enregistrement. Les images sont transmises à
Mistral et ne sont pas conservées par Bananani pour le scan.

Les fiches personnelles, manuscrites et les pages de livre sont acceptées ; un titre
et des ingrédients suffisent même sans quantités, portions ni étapes. Photographier la
fiche de près, à plat et sans reflet. L’écran « Scanner » sert à retrouver une
recette existante via son code Bananani ; son lien « Importer une recette papier »
ouvre la lecture OCR pour les documents sans code.

Après l’OCR, une relecture par `mistral-small-latest` connaît le schéma de Bananani
et propose une recette structurée : nettoyage du bruit OCR et des doublons,
correction des noms, portions et quantités manquantes, étapes de préparation,
description et rayons. Les variantes et les contraintes de la fiche sont conservées ;
les marques et auteurs ne doivent pas être inventés. Les champs ajustés, ajouts
et retraits sont signalés dans l’aperçu, avec les explications du modèle. Les
estimations restent à vérifier. On peut consulter la lecture OCR d’origine et
choisir de l’utiliser seule, puis modifier le formulaire avant l’enregistrement.
Les suggestions n’enregistrent aucune recette ni aucun ingrédient en base.

Le second appel reçoit uniquement le texte OCR (30 000 caractères maximum) et
les champs extraits, avec les unités et rayons autorisés. Sa réponse structurée
est validée côté serveur, y compris les liens avec les lignes d’origine. Si cette
relecture sépare des ingrédients au choix (« tomates ou sauce tomate »), ils sont
regroupés pour ne compter qu’une alternative dans les courses. Si cette
relecture échoue, la lecture OCR reste utilisable avec un avertissement. Une
annotation OCR manquante peut être récupérée à partir du texte brut par la relecture.

Configurer `MISTRAL_API_KEY` uniquement côté serveur : variable d’environnement
en local, secret Fly.io en production (`fly secrets import` via l’entrée standard).
Ne jamais placer la clé dans le dépôt ou une variable publique. L’extraction
utilise `mistral-ocr-latest` avec annotations structurées, puis une requête de chat
à `mistral-small-latest` pour la relecture. Même clé pour les deux appels.
Limite : 20 analyses par
utilisateur et par heure, un appel simultané ; compteur en mémoire réinitialisé
au redémarrage. Délais maximaux : 90 secondes pour l’OCR et 45 secondes pour la
relecture, sans nouvelle tentative automatique.
Vérifications : `npm test`, `npm run build` et `npm run test:integration`.
Les tests HTTP simulent Mistral dans leur processus isolé et vérifient également
la chaîne complète et son repli en cas de panne de la relecture.

L'app tourne sur **https://bananani.fly.dev** (région `cdg`). Config dans
[`fly.toml`](./fly.toml) + [`Dockerfile`](./Dockerfile).

### Coût minimal : scale-to-zero (déjà configuré)

Le bloc `[http_service]` de `fly.toml` est réglé pour ne payer que quand on utilise
l'app :

```toml
auto_stop_machines = "stop"   # éteint la machine après inactivité
auto_start_machines = true    # la rallume à la 1re requête HTTP
min_machines_running = 0      # 0 machine en permanence
```

- À l'arrêt, on ne paie ~plus que le **volume persistant** (`bananani_data`, ~0,15 $/Go/mois)
  et l'IP (IPv6 gratuite). La VM `shared-cpu-1x` 256 Mo est le tier le moins cher.
- Compromis : **cold start** ~1-3 s sur la première requête après une pause, le temps
  que la machine se rallume. Acceptable pour un usage perso.

### ⚠️ SQLite = exactement UNE machine

La base est un fichier SQLite sur le volume local de la machine. Il faut **une seule
machine** : avec 2+ machines, chacune a son propre volume → données incohérentes selon
le routage. Vérifier avec `fly status` (ne doit lister qu'une machine `app`).

### Déployer : auto sur push (GitHub Actions)

**Un push sur `main` déclenche automatiquement le déploiement.** C'est géré par
[`.github/workflows/fly-deploy.yml`](./.github/workflows/fly-deploy.yml) qui lance
`flyctl deploy --remote-only` à chaque push.

- Le workflow s'authentifie via le secret de dépôt **`FLY_API_TOKEN`** (réglages
  GitHub → *Secrets and variables* → *Actions*). Pour le régénérer :
  `fly tokens create deploy` puis `gh secret set FLY_API_TOKEN`.
- Suivre un déploiement : `gh run list` / `gh run watch <id>`, ou l'onglet *Actions*
  du repo.

### Déploiement manuel (fallback)

```bash
fly deploy      # build l'image depuis le répertoire LOCAL et la met en ligne
fly status      # état de la/les machine(s) : started / stopped
fly releases    # historique des versions déployées
fly logs        # logs en direct
```

- `fly deploy` lit les **fichiers locaux** (pas git). Ce qui est exclu du build est
  dans [`.dockerignore`](./.dockerignore) (notamment `static/uploads/*` et `data/`).

### ⚠️ Ne PAS réactiver l'auto-deploy natif de Fly

Fly propose aussi son propre « Auto-Deploy on push » (le bot `fly-io[bot]`, réglages
Fly → *GitHub Repository Settings*). **Il était cassé** (déploiements bloqués en
`in_progress`, jamais finalisés) et fait **double emploi** avec notre workflow GitHub
Actions. Il doit rester **désactivé** — sinon chaque push lance deux déploiements
concurrents.

## PWA (installable « comme une appli »)

Le site est une PWA : on peut l'installer sur l'écran d'accueil (plein écran, sans
barre de navigateur).

- Manifest : [`static/manifest.webmanifest`](./static/manifest.webmanifest) (`display: standalone`).
- Icônes : `static/icon.svg` (source), `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, `favicon.ico`. Régénérables depuis le SVG avec
  `rsvg-convert` (tailles) + `magick`/`convert` (pour le `.ico`).
- Balises dans [`src/app.html`](./src/app.html) (`manifest`, `apple-touch-icon`,
  meta web-app).
- **Installer sur Android/Chrome** : ouvrir l'URL → menu ⋮ → « Installer l'application ».
- Comme c'est hébergé sur Fly, le scale-to-zero s'applique aussi à la PWA installée
  (cold start sur la première ouverture après une pause).
