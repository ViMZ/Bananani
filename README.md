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

### Déployer

```bash
fly deploy      # build l'image depuis le répertoire LOCAL et la met en ligne
fly status      # état de la/les machine(s) : started / stopped
fly releases    # historique des versions déployées
fly logs        # logs en direct
```

- `fly deploy` lit les **fichiers locaux** (pas git) : pas besoin de commit/push pour
  déployer. Ce qui est exclu du build est dans [`.dockerignore`](./.dockerignore)
  (notamment `static/uploads/*` et `data/`).

### ⚠️ L'intégration GitHub ne déploie PAS vraiment

Une intégration Fly↔GitHub (`fly-io[bot]`) est connectée et **crée une entrée de
déploiement à chaque push sur `main`** (visible dans l'onglet *Deployments* de GitHub,
pas dans *Actions* — il n'y a aucun workflow GitHub Actions dans le repo).

**MAIS ces déploiements restent bloqués sur `in_progress` et ne produisent jamais de
nouvelle release.** Toutes les vraies mises en ligne (v1→v5) ont été faites
**manuellement** via `fly deploy`. ⇒ **Un push ne suffit pas à publier ; il faut
lancer `fly deploy`.**

(Si on veut un jour un vrai déploiement auto sur push : ajouter un workflow GitHub
Actions avec `superfly/flyctl-actions` + secret `FLY_API_TOKEN`.)

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
