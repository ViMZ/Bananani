/**
 * Fixtures de dev : insère 10 recettes avec leurs ingrédients.
 *
 * Usage : npm run db:seed          (n'insère que si la table recipes est vide)
 *         npm run db:seed -- --force  (vide recipes/recipe_ingredients puis réinsère)
 *
 * À ne lancer qu'en dev — n'ajoute rien à shopping_items.
 */
import { db } from '../src/lib/server/db/index.js';
import { recipes, recipeIngredients } from '../src/lib/server/db/schema.js';
import { generateRecipeCode } from '../src/lib/server/codes.js';
import { resolveOrCreate } from '../src/lib/server/ingredients/catalog.js';
import { eq } from 'drizzle-orm';

const force = process.argv.includes('--force');

/**
 * @typedef {{ name: string, brand?: string, productReference?: string,
 *   quantity?: number, unit?: string, notes?: string }} Ing
 * @typedef {{ title: string, description: string, servings: number,
 *   instructions: string, ingredients: Ing[] }} Fixture
 */

/** @type {Fixture[]} */
const FIXTURES = [
  {
    title: 'Pâtes à la carbonara',
    description: 'La vraie carbonara romaine, sans crème.',
    servings: 2,
    instructions:
      "1. Faire cuire les spaghetti al dente.\n2. Faire revenir le guanciale à sec.\n3. Battre les jaunes avec le pecorino et beaucoup de poivre.\n4. Mélanger hors du feu avec un peu d'eau de cuisson.",
    ingredients: [
      { name: 'Spaghetti', brand: 'De Cecco', productReference: 'n°12', quantity: 200, unit: 'g' },
      { name: 'Guanciale', brand: 'Levoni', quantity: 100, unit: 'g' },
      { name: 'Jaunes d’œuf', quantity: 3, unit: 'pièce' },
      { name: 'Pecorino Romano', brand: 'Locatelli', quantity: 50, unit: 'g', notes: 'râpé fin' },
      { name: 'Poivre noir', unit: 'pincée', notes: 'fraîchement moulu' }
    ]
  },
  {
    title: 'Curry de pois chiches',
    description: 'Curry végétarien crémeux au lait de coco.',
    servings: 4,
    instructions:
      '1. Faire revenir oignon, ail, gingembre.\n2. Ajouter les épices puis la tomate.\n3. Verser pois chiches et lait de coco, mijoter 20 min.\n4. Servir avec du riz basmati.',
    ingredients: [
      { name: 'Pois chiches', brand: 'Sabarot', quantity: 400, unit: 'g', notes: 'égouttés' },
      { name: 'Lait de coco', brand: 'Aroy-D', quantity: 400, unit: 'ml' },
      { name: 'Pâte de curry', brand: 'Patak’s', productReference: 'Madras', quantity: 2, unit: 'c. à soupe' },
      { name: 'Tomates concassées', brand: 'Mutti', quantity: 200, unit: 'g' },
      { name: 'Oignon', quantity: 1, unit: 'pièce' },
      { name: 'Riz basmati', brand: 'Tilda', quantity: 250, unit: 'g' }
    ]
  },
  {
    title: 'Salade César',
    description: 'Classique avec sa sauce maison et ses croûtons.',
    servings: 2,
    instructions:
      '1. Griller le poulet et le trancher.\n2. Préparer la sauce (anchois, ail, parmesan, citron, jaune).\n3. Assaisonner la romaine, ajouter croûtons et poulet.',
    ingredients: [
      { name: 'Laitue romaine', quantity: 1, unit: 'pièce' },
      { name: 'Filet de poulet', quantity: 2, unit: 'pièce' },
      { name: 'Parmesan', brand: 'Parmigiano Reggiano', quantity: 40, unit: 'g' },
      { name: 'Anchois', brand: 'Ortiz', quantity: 4, unit: 'filet' },
      { name: 'Pain de campagne', quantity: 4, unit: 'tranche', notes: 'pour les croûtons' }
    ]
  },
  {
    title: 'Soupe miso',
    description: 'Bouillon japonais réconfortant en 10 minutes.',
    servings: 2,
    instructions:
      '1. Chauffer le dashi.\n2. Délayer le miso hors ébullition.\n3. Ajouter tofu et wakame, servir aussitôt.',
    ingredients: [
      { name: 'Pâte de miso', brand: 'Hikari', productReference: 'shiro', quantity: 2, unit: 'c. à soupe' },
      { name: 'Tofu soyeux', brand: 'Clearspring', quantity: 150, unit: 'g' },
      { name: 'Algues wakame', quantity: 5, unit: 'g' },
      { name: 'Dashi', quantity: 600, unit: 'ml' },
      { name: 'Ciboule', quantity: 2, unit: 'pièce' }
    ]
  },
  {
    title: 'Chili sin carne',
    description: 'Chili végétalien aux haricots rouges et maïs.',
    servings: 4,
    instructions:
      '1. Revenir oignon, poivron, ail.\n2. Ajouter épices, tomates, haricots et maïs.\n3. Mijoter 30 min à feu doux.',
    ingredients: [
      { name: 'Haricots rouges', brand: 'Cassegrain', quantity: 400, unit: 'g', notes: 'égouttés' },
      { name: 'Maïs doux', brand: 'Géant Vert', quantity: 150, unit: 'g' },
      { name: 'Tomates concassées', brand: 'Mutti', quantity: 400, unit: 'g' },
      { name: 'Poivron rouge', quantity: 1, unit: 'pièce' },
      { name: 'Cumin moulu', brand: 'Ducros', quantity: 1, unit: 'c. à café' }
    ]
  },
  {
    title: 'Tarte aux pommes',
    description: 'Tarte fine sur pâte brisée maison.',
    servings: 6,
    instructions:
      '1. Foncer le moule avec la pâte.\n2. Disposer les lamelles de pommes en rosace.\n3. Saupoudrer de sucre, cuire 35 min à 180°C.',
    ingredients: [
      { name: 'Pommes', brand: 'Golden', quantity: 5, unit: 'pièce' },
      { name: 'Pâte brisée', brand: 'Marie', quantity: 1, unit: 'pièce' },
      { name: 'Sucre', brand: 'Daddy', quantity: 60, unit: 'g' },
      { name: 'Beurre', brand: 'Président', quantity: 30, unit: 'g' },
      { name: 'Cannelle', brand: 'Ducros', unit: 'pincée' }
    ]
  },
  {
    title: 'Risotto aux champignons',
    description: 'Risotto crémeux aux cèpes.',
    servings: 3,
    instructions:
      '1. Nacrer le riz avec l’échalote.\n2. Déglacer au vin blanc.\n3. Ajouter le bouillon louche par louche.\n4. Finir au parmesan et au beurre.',
    ingredients: [
      { name: 'Riz arborio', brand: 'Gallo', quantity: 250, unit: 'g' },
      { name: 'Cèpes séchés', quantity: 30, unit: 'g' },
      { name: 'Vin blanc sec', quantity: 100, unit: 'ml' },
      { name: 'Parmesan', brand: 'Parmigiano Reggiano', quantity: 50, unit: 'g' },
      { name: 'Échalote', quantity: 2, unit: 'pièce' },
      { name: 'Bouillon de légumes', brand: 'Knorr', quantity: 1, unit: 'L' }
    ]
  },
  {
    title: 'Tacos au poulet',
    description: 'Tortillas garnies de poulet épicé.',
    servings: 4,
    instructions:
      '1. Mariner et saisir le poulet.\n2. Réchauffer les tortillas.\n3. Garnir avec poulet, avocat, oignon et coriandre.',
    ingredients: [
      { name: 'Tortillas de maïs', brand: 'Old El Paso', quantity: 8, unit: 'pièce' },
      { name: 'Filet de poulet', quantity: 400, unit: 'g' },
      { name: 'Avocat', quantity: 2, unit: 'pièce' },
      { name: 'Mélange épices tacos', brand: 'Old El Paso', quantity: 1, unit: 'sachet' },
      { name: 'Coriandre fraîche', quantity: 1, unit: 'botte' }
    ]
  },
  {
    title: 'Omelette aux herbes',
    description: 'Omelette baveuse aux fines herbes.',
    servings: 1,
    instructions:
      '1. Battre les œufs avec les herbes.\n2. Cuire à feu vif dans le beurre.\n3. Rouler et servir.',
    ingredients: [
      { name: 'Œufs', quantity: 3, unit: 'pièce' },
      { name: 'Persil', quantity: 1, unit: 'c. à soupe', notes: 'ciselé' },
      { name: 'Ciboulette', quantity: 1, unit: 'c. à soupe', notes: 'ciselée' },
      { name: 'Beurre', brand: 'Président', quantity: 15, unit: 'g' }
    ]
  },
  {
    title: 'Pancakes',
    description: 'Pancakes moelleux à l’américaine.',
    servings: 4,
    instructions:
      '1. Mélanger secs et liquides séparément.\n2. Réunir sans trop travailler la pâte.\n3. Cuire à la poêle, servir avec sirop d’érable.',
    ingredients: [
      { name: 'Farine', brand: 'Francine', quantity: 250, unit: 'g' },
      { name: 'Lait', brand: 'Lactel', quantity: 300, unit: 'ml' },
      { name: 'Œufs', quantity: 2, unit: 'pièce' },
      { name: 'Levure chimique', brand: 'Alsa', quantity: 1, unit: 'sachet' },
      { name: 'Sirop d’érable', brand: 'Maple Joe', quantity: 1, unit: 'pièce' }
    ]
  }
];

async function seed() {
  const existing = await db.select().from(recipes).limit(1);
  if (existing.length > 0) {
    if (!force) {
      console.log(
        'La table recipes contient déjà des données. Relance avec `-- --force` pour réinitialiser.'
      );
      process.exit(0);
    }
    console.log('--force : suppression des recettes existantes…');
    await db.delete(recipeIngredients);
    await db.delete(recipes);
  }

  const used = new Set();
  /** @returns {string} */
  function freshCode() {
    for (let i = 0; i < 20; i++) {
      const code = generateRecipeCode();
      if (!used.has(code)) {
        used.add(code);
        return code;
      }
    }
    throw new Error('Impossible de générer un code unique');
  }

  for (const f of FIXTURES) {
    const [inserted] = await db
      .insert(recipes)
      .values({
        code: freshCode(),
        title: f.title,
        description: f.description,
        servings: f.servings,
        instructions: f.instructions,
        photoPath: null
      })
      .returning();

    const rows = [];
    for (let position = 0; position < f.ingredients.length; position++) {
      const ing = f.ingredients[position];
      rows.push({
        recipeId: inserted.id,
        canonicalId: await resolveOrCreate(ing.name, ing.unit),
        name: ing.name,
        brand: ing.brand ?? '',
        productReference: ing.productReference ?? '',
        quantity: ing.quantity ?? 0,
        unit: ing.unit ?? '',
        notes: ing.notes ?? '',
        position
      });
    }
    await db.insert(recipeIngredients).values(rows);

    console.log(`  ✓ ${inserted.code}  ${f.title}`);
  }

  console.log(`\n${FIXTURES.length} recettes insérées.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
