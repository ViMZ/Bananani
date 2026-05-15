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
```

Pas de tests configurés à ce stade.

## Architecture

**Stack** : SvelteKit 2 (Svelte 5, runes), better-sqlite3 + Drizzle ORM, Tailwind CSS, jsbarcode (génération), @zxing/browser (scan caméra).

**Stockage** : tout est local au repo.
- `data/bananani.db` — SQLite (créé au démarrage, ignoré par git)
- `static/uploads/` — photos des recettes uploadées (ignoré par git sauf `.gitkeep`)

**Bootstrap DB** : `src/lib/server/db/index.js` exécute des `CREATE TABLE IF NOT EXISTS` à l'import. C'est suffisant pour un projet perso ; pas de système de migration Drizzle actif pour l'instant. Si on modifie `schema.js`, soit on adapte aussi le SQL de bootstrap, soit on lance `npm run db:push`.

**Modèle de données** (`src/lib/server/db/schema.js`) :
- `recipes` — recette principale, `code` unique sert d'identifiant code-barres
- `recipe_ingredients` — lignes d'ingrédients liées à une recette (cascade delete), incluent `brand` et `product_reference` (important pour le projet)
- `shopping_items` — items de la liste de courses ; **dénormalisés** (on copie `name/brand/qty/unit` au moment de l'ajout) pour qu'éditer une recette ne mute pas une liste de courses déjà constituée. `recipe_id` + `recipe_title` sont conservés pour grouper l'affichage.

**Couche serveur** (`src/lib/server/*`) :
- `recipes.js` — créer/éditer/supprimer/récupérer recettes ; parse les champs d'ingrédients depuis FormData (champs répétés `ing_name`/`ing_brand`/...).
- `uploads.js` — sauve les photos dans `static/uploads/` sous un nom horodaté + random.
- `codes.js` — `generateRecipeCode()` ; `recipes.js#uniqueRecipeCode()` retente jusqu'à 10 fois en cas de collision.

**Routes** (toutes utilisent les actions natives SvelteKit, pas d'API JSON séparée) :
- `/` — accueil avec stats et dernières recettes
- `/recipes`, `/recipes/new`, `/recipes/[id]`, `/recipes/[id]/edit` — CRUD
- `/recipes/[id]/card` — fiche A4 imprimable avec photo + Code 128
- `/scan` — caméra (@zxing) + saisie manuelle ; POST `?/add` ajoute les ingrédients à `shopping_items`
- `/shopping` — liste interactive (toggle/remove/clear/add manuel)
- `/shopping/print` — vue imprimable, n'affiche que les items non cochés

**Print CSS** : la classe `.no-print` (définie dans `src/app.css`) cache éléments à l'impression ; les pages imprimables (`card`, `shopping/print`) ont un `<style>` local qui masque header/footer globaux.

## Conventions à connaître

- **Svelte 5 runes** partout : `$props()`, `$state()`, `$derived()`, `$effect()`. Pas de `export let` ni de `$:`.
- **JS pur, pas TypeScript**. `jsconfig.json` active `checkJs` pour les annotations JSDoc.
- **Validation au boundary** : on fait confiance aux données venant de la DB ; on valide ce qui vient de FormData (présence du titre, conversion numérique des quantités).
- **Dénormalisation volontaire** sur `shopping_items` — ne pas la "corriger" en faisant un JOIN dynamique sur `recipes`. Le besoin métier est que la liste de courses soit un snapshot.
- **Codes-barres = Code 128 sur le `code` interne**, pas EAN-13. Si on veut étendre vers les vrais codes-barres produit (pour scanner des emballages au lieu de fiches), c'est une fonctionnalité distincte, ne pas mélanger.
- **Scan caméra** : `@zxing/browser` import dynamique côté client uniquement (`onMount`). Sur mobile la caméra exige HTTPS en prod.
