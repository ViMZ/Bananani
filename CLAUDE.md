# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Le projet

Bananani est un site web personnel de gestion de recettes. Cycle d'usage :

1. L'utilisateur crée une recette (titre, photo, ingrédients détaillés avec marque/référence/quantité, instructions).
2. Le système génère un **code interne** unique de type `BAN-AB12CD` (généré dans `src/lib/server/codes.js`, alphabet sans 0/O/1/I/L).
3. La route `/recipes/[id]/card` produit une **fiche A4 imprimable** avec photo + Code 128 du `code` interne.
4. L'utilisateur colle ces fiches sur le frigo. Quand il prépare la semaine, il va sur `/scan`, scanne via la caméra (ou tape le code), et tous les ingrédients de la recette sont ajoutés à `shopping_items`.
5. `/shopping` affiche/coche/édite la liste ; `/shopping/print` produit une version papier.

Les codes-barres sont **internes** (pas des EAN-13 produit) — ils encodent juste l'identifiant `BAN-XXXXXX` de la recette en Code 128.

## Commandes

```bash
npm run dev          # serveur de dev Vite (http://localhost:5173, ou 5174 si occupé)
npm run build        # build production
npm run preview      # preview du build
npm run db:studio    # UI Drizzle pour inspecter la base SQLite
npm run db:push      # synchronise schema.js vers la DB (utile après modif du schéma)
npm run db:seed      # fixtures dev : 10 recettes (refuse d'écraser ; -- --force pour réinitialiser)
npm run db:seed-catalog  # remplit ingredient_catalog avec ~180 ingrédients par rayon (idempotent)
npm run db:seed -- --user <id>   # fixtures : rattache les 10 recettes au compte <id> (crée le compte avant)

# Comptes (multi-tenant) — création manuelle, mot de passe transmis à la main :
npm run user:create -- <identifiant> [mot-de-passe] [--name "Nom"]  # sans mdp : en génère un et l'affiche
npm run user:passwd -- <identifiant> [mot-de-passe]                 # réinitialise (invalide les sessions)
npm run user:list                                                  # liste les comptes
```

Pas de tests configurés à ce stade.

## Architecture

**Stack** : SvelteKit 2 (Svelte 5, runes), better-sqlite3 + Drizzle ORM, Tailwind CSS, jsbarcode (génération), @zxing/browser (scan caméra), svelte-dnd-action (drag-and-drop du planning).

**Stockage** : tout est local au repo.
- `data/bananani.db` — SQLite (créé au démarrage, ignoré par git)
- `static/uploads/` — photos des recettes uploadées (ignoré par git sauf `.gitkeep`)

**Bootstrap DB** : `src/lib/server/db/index.js` exécute des `CREATE TABLE IF NOT EXISTS` à l'import. C'est suffisant pour un projet perso ; pas de système de migration Drizzle actif pour l'instant. Si on modifie `schema.js`, soit on adapte aussi le SQL de bootstrap, soit on lance `npm run db:push`. Pour **ajouter une colonne à une table existante**, `CREATE TABLE IF NOT EXISTS` ne suffit pas : utiliser le helper `addColumnIfMissing()` (ALTER TABLE gardé via `PRAGMA table_info`) déjà présent dans `index.js`.

**Modèle de données** (`src/lib/server/db/schema.js`) :
- `users` — comptes (multi-tenant). `username` unique (stocké en minuscules), `password_hash` (scrypt), `display_name`. Créés **uniquement** en CLI (`user:create`), pas d'inscription en ligne.
- `recipes` — recette principale, `code` unique sert d'identifiant code-barres. `user_id` (NOT NULL, cascade) = propriétaire.
- `recipe_ingredients` — lignes d'ingrédients liées à une recette (cascade delete), incluent `brand` et `product_reference` (important pour le projet). `canonical_id` → `ingredient_catalog`.
- `meal_plan` — **planning hebdomadaire** : une ligne = une recette (`recipe_id`, cascade) posée sur un jour (`day_of_week` 0=lundi…6=dimanche) d'une semaine (`week_start` = lundi 'YYYY-MM-DD'). `user_id` NOT NULL (cascade). `position` ordonne les recettes d'un même jour. Une recette peut être placée plusieurs fois. Alimente `/planning`.
- `shopping_items` — items de la liste de courses ; `user_id` (NOT NULL, cascade) = propriétaire ; **dénormalisés** (on copie `name/brand/qty/unit` au moment de l'ajout) pour qu'éditer une recette ne mute pas une liste de courses déjà constituée. `recipe_id` + `recipe_title` sont conservés pour grouper l'affichage ; `canonical_id` aussi (copié au scan) pour l'agrégation par ingrédient.
- `ingredient_catalog` — **ingrédients canoniques** : **partagé entre tous les comptes** (pas de `user_id`) — ce sont des noms d'ingrédients génériques, tout le monde bénéficie des suggestions. `normalized_key` unique (via `normalizeName`), `default_unit`, `category` (rayon). Alimenté au fil de l'eau à la sauvegarde des recettes + par `db:seed-catalog`. Résout le problème du free-text : « Farine » et « farine » pointent vers la même entrée.

**Couche serveur** (`src/lib/server/*`) :
- `recipes.js` — créer/éditer/supprimer/récupérer recettes ; parse les champs d'ingrédients depuis FormData (champs répétés `ing_name`/`ing_brand`/`ing_category`/...). `withCanonicalIds()` résout chaque ingrédient via le catalogue ; `ing_category` est transient (sert à enrichir le catalogue, n'est pas une colonne de `recipe_ingredients`).
- `ingredients/catalog.js` — `listCatalog()` ; `resolveOrCreate(name, unit, category)` : trouve/crée l'entrée canonique et enrichit unité+catégorie (première valeur non vide gagnante, jamais d'écrasement).
- `uploads.js` — sauve les photos dans `static/uploads/` sous un nom horodaté + random.
- `codes.js` — `generateRecipeCode()` ; `recipes.js#uniqueRecipeCode()` retente jusqu'à 10 fois en cas de collision. Les codes sont **uniques globalement** (pas par compte).
- `auth.js` + `users.js` — **multi-tenant**. `users.js` = accès DB pur aux comptes (aucun import d'auth pour éviter un cycle). `auth.js` = hachage scrypt (`hashPassword`/`verifyPassword`), `authenticate(username, password)`, et sessions **sans état** : cookie `<userId>.<exp>.<hmac>` signé HMAC avec `SESSION_SECRET` **+ le hash du mot de passe** (⇒ changer le mdp invalide les sessions). `verifySession` relit l'utilisateur en base. `hooks.server.js` exige une session sur toute route hors `/login` et pose `event.locals.user = { id, username, displayName }`.
  - **`SESSION_SECRET`** : à définir en prod (variable d'env). En dev, fallback non sûr `bananani-dev-insecure-secret`. Changer ce secret invalide toutes les sessions.
  - **Back-office admin** (`/admin`) : **realm séparé** des comptes utilisateurs, protégé par le mot de passe `ADMIN_PASSWORD` (env). Sans cette variable, le BO est désactivé (routes `/admin` → 404, sauf `/admin/login` qui affiche un message). Cookie admin distinct (`bananani_admin`, path `/admin`, signé avec SECRET + `ADMIN_PASSWORD`), session courte (8 h). `hooks.server.js` gère les deux realms indépendamment (`handleAdmin` vs auth utilisateur) : un cookie admin ne donne aucun accès à l'app, et inversement. La page `/admin` liste/crée/réinitialise/supprime les comptes (mêmes opérations que le CLI `user:*`) ; à la création/réinit., le mot de passe (saisi ou généré) est affiché **une seule fois**.
  - **Scoping** : chaque `load`/action lit `locals.user.id` et le passe aux fonctions serveur (`createRecipe(userId, …)`, `getRecipeByCode(userId, …)`, requêtes `shopping_items` filtrées sur `user_id`, y compris les toggle/remove par `ids`). Toute nouvelle requête sur `recipes`/`shopping_items` **doit** filtrer par `user_id`.

**Agrégation ingrédients** (`src/lib/ingredients/*`, modules **purs, client-importables** — hors `$lib/server/`) :
- `normalize.js` — `normalizeName()` : clé de regroupement (minuscules/accents/espaces/pluriel conservateur). Sert de clé catalogue ET de fallback de regroupement pour les items sans `canonical_id`.
- `units.js` — familles d'unités convertibles (masse g/kg, volume ml/cl/L) ; `resolveUnit()`, `formatQuantity()`. Les unités hors familles (pièce, c. à soupe…) ne s'additionnent qu'entre elles.
- `categories.js` — les 12 rayons ordonnés (parcours magasin) + `UNCATEGORIZED` (« Autres »).
- `aggregate.js` — `aggregateItems()` regroupe par `canonical_id` (sinon nom normalisé) et additionne par famille d'unité ; `groupByCategory()` ordonne par rayon.

**Routes** (toutes utilisent les actions natives SvelteKit, pas d'API JSON séparée) :
- `/` — accueil avec stats et dernières recettes
- `/recipes`, `/recipes/new`, `/recipes/[id]`, `/recipes/[id]/edit` — CRUD
- `/recipes/[id]/card` — fiche A4 imprimable avec photo + Code 128
- `/planning` — **calendrier hebdomadaire** (pensé mobile). On place des recettes (carte simplifiée `RecipeMiniCard` : miniature + nom) sur les jours via **drag-and-drop** (`svelte-dnd-action`, tactile ; fallback tap-to-place via le `+` de chaque jour). Actions `place`/`move`/`remove` (persistées en `meal_plan`, appelées en `fetch` + `invalidateAll`, modèle `/scan`). Bouton **« Générer la liste de courses »** : action `generate` qui ajoute à `shopping_items` les ingrédients des recettes de la semaine affichée, **en ignorant les jours déjà passés** (`isPastDay`) ; un placement = une occurrence des ingrédients (doublons voulus, sommés à l'affichage). `?mode=append|replace` (popup Ajouter/Remplacer si la liste n'est pas vide). Navigation par semaine via `?week=YYYY-MM-DD`. Utilitaires de date purs dans `src/lib/date/week.js` (lundi ISO, 7 jours, jour passé), **en heure locale** (pas `toISOString`).
- `/scan` — caméra (@zxing) + saisie manuelle ; POST `?/add` ajoute les ingrédients à `shopping_items`
- `/shopping` — liste interactive (toggle/remove/clear/add manuel). Toggle de vue **« par ingrédient »** (quantités additionnées, groupées par rayon) / **« par recette »** (groupement d'origine), mémorisé en `localStorage`. Les actions toggle/remove acceptent un `ids` (CSV) en plus d'un `id` unique, pour agir sur tout un groupe agrégé.
- `/shopping/print` — vue imprimable, n'affiche que les items non cochés ; `?view=ingredient|recipe` (défaut `ingredient`).

**Print CSS** : la classe `.no-print` (définie dans `src/app.css`) cache éléments à l'impression ; les pages imprimables (`card`, `shopping/print`) ont un `<style>` local qui masque header/footer globaux.

## Conventions à connaître

- **Svelte 5 runes** partout : `$props()`, `$state()`, `$derived()`, `$effect()`. Pas de `export let` ni de `$:`.
- **JS pur, pas TypeScript**. `jsconfig.json` active `checkJs` pour les annotations JSDoc.
- **Validation au boundary** : on fait confiance aux données venant de la DB ; on valide ce qui vient de FormData (présence du titre, conversion numérique des quantités).
- **Dénormalisation volontaire** sur `shopping_items` — ne pas la "corriger" en faisant un JOIN dynamique sur `recipes`. Le besoin métier est que la liste de courses soit un snapshot. (Le JOIN sur `ingredient_catalog` pour la catégorie est une exception assumée : la catégorie est une propriété de l'ingrédient canonique, pas du snapshot.)
- **Agrégation = vue, jamais matérialisée** : on n'additionne/fusionne pas de lignes en base. `aggregateItems` calcule à la volée au load/`$derived` ; les lignes `shopping_items` restent des snapshots intacts.
- **`ingredients/` vs `server/ingredients/`** : la logique pure d'agrégation (`normalize`/`units`/`categories`/`aggregate`) vit dans `src/lib/ingredients/` car elle est importée **côté client** (vues) ; tout ce qui touche la DB (catalogue) reste dans `src/lib/server/`.
- **Unité/rayon = liste fermée, nom = libre.** Dans `RecipeForm`, les trois champs à suggestions passent par `Combobox.svelte` (autocomplétion maison qui remplace le `<datalist>` natif, inutilisable sur mobile — chevauchait le clavier, hauteur incontrôlable). Le champ **Nom** est ouvert (`Combobox` non strict : on peut créer un nouvel ingrédient). Les champs **Unité** (liste curée `UNITS` dans `units.js`) et **Rayon** (`CATEGORIES`) sont en `strict` : toute saisie hors liste est effacée à la perte de focus (une valeur vide reste permise = « aucune »). La flexibilité métier est préservée *dans* la liste (tomates en `pièce` ou en `g`), mais on n'accepte plus de texte libre qui créerait des doublons (« gr »/« g », « Epicerie »/« Épicerie salée »). Si une unité manque, l'ajouter à `UNITS`. L'agrégation gère toujours les familles d'unités incompatibles en sous-lignes.
- **Codes-barres = Code 128 sur le `code` interne**, pas EAN-13. Si on veut étendre vers les vrais codes-barres produit (pour scanner des emballages au lieu de fiches), c'est une fonctionnalité distincte, ne pas mélanger.
- **Scan caméra** : `@zxing/browser` import dynamique côté client uniquement (`onMount`). Sur mobile la caméra exige HTTPS en prod.

## Git

- **Ne JAMAIS ajouter de ligne `Co-Authored-By`** dans les messages de commit (ni mention d'outil/d'assistant). Les commits ne contiennent que la description du changement.
