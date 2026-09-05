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

### Validation des rayons

La création et la modification d’une recette passent par « Vérifier les rayons ».
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

Configurer `MISTRAL_API_KEY` uniquement côté serveur : variable d’environnement
en local, secret Fly.io en production (`fly secrets import` via l’entrée standard).
Ne jamais placer la clé dans le dépôt ou une variable publique. L’extraction
utilise `mistral-ocr-latest` avec annotations structurées. Limite : 20 analyses par
utilisateur et par heure, un appel simultané ; compteur en mémoire réinitialisé
au redémarrage. Délai maximal : 90 secondes.
Vérifications : `node --test scripts/recipe-ocr.test.js` et `npm run build`.

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
