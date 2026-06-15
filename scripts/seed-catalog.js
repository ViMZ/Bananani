/**
 * Remplit le catalogue d'ingrédients avec un large jeu d'ingrédients courants,
 * chacun avec son rayon (catégorie) et une unité par défaut raisonnable.
 *
 * Usage : npm run db:seed-catalog
 *
 * Idempotent : s'appuie sur resolveOrCreate (clé = nom normalisé). Les entrées
 * déjà présentes (créées depuis tes recettes) sont enrichies — unité/catégorie
 * ne sont posées que si elles manquaient, jamais écrasées. À lancer sans crainte
 * autant de fois que voulu.
 */
import { resolveOrCreate } from '../src/lib/server/ingredients/catalog.js';
import { db } from '../src/lib/server/db/index.js';
import { ingredientCatalog } from '../src/lib/server/db/schema.js';

/**
 * Ingrédients par rayon : [nom, unité par défaut].
 * @type {Record<string, Array<[string, string]>>}
 */
const CATALOG = {
  'Fruits & légumes': [
    ['Tomate', 'pièce'], ['Tomates cerises', 'g'], ['Pomme de terre', 'g'], ['Carotte', 'g'],
    ['Oignon', 'pièce'], ['Oignon rouge', 'pièce'], ['Échalote', 'pièce'], ['Ail', 'gousse'],
    ['Poireau', 'pièce'], ['Courgette', 'pièce'], ['Aubergine', 'pièce'], ['Poivron', 'pièce'],
    ['Concombre', 'pièce'], ['Laitue', 'pièce'], ['Épinards', 'g'], ['Brocoli', 'pièce'],
    ['Chou-fleur', 'pièce'], ['Chou', 'pièce'], ['Haricots verts', 'g'], ['Petits pois', 'g'],
    ['Champignons de Paris', 'g'], ['Céleri', 'g'], ['Navet', 'g'], ['Betterave', 'g'],
    ['Radis', 'botte'], ['Fenouil', 'pièce'], ['Patate douce', 'g'], ['Potiron', 'g'],
    ['Pomme', 'pièce'], ['Poire', 'pièce'], ['Banane', 'pièce'], ['Orange', 'pièce'],
    ['Citron', 'pièce'], ['Citron vert', 'pièce'], ['Fraise', 'g'], ['Framboise', 'g'],
    ['Myrtille', 'g'], ['Raisin', 'g'], ['Pêche', 'pièce'], ['Abricot', 'pièce'],
    ['Melon', 'pièce'], ['Ananas', 'pièce'], ['Mangue', 'pièce'], ['Avocat', 'pièce'],
    ['Kiwi', 'pièce'], ['Gingembre', 'g']
  ],
  'Viandes & volailles': [
    ['Filet de poulet', 'pièce'], ['Cuisse de poulet', 'pièce'], ['Bœuf haché', 'g'],
    ['Steak', 'pièce'], ['Côte de porc', 'pièce'], ['Lardons', 'g'], ['Jambon', 'tranche'],
    ['Saucisse', 'pièce'], ['Merguez', 'pièce'], ['Agneau', 'g'], ['Veau', 'g'],
    ['Escalope de dinde', 'pièce'], ['Magret de canard', 'pièce'], ['Bacon', 'tranche'],
    ['Chair à saucisse', 'g']
  ],
  'Poissons & fruits de mer': [
    ['Pavé de saumon', 'pièce'], ['Cabillaud', 'g'], ['Thon', 'g'], ['Crevettes', 'g'],
    ['Moules', 'g'], ['Filet de poisson blanc', 'pièce'], ['Sardines', 'g'], ['Truite', 'pièce'],
    ['Calamars', 'g'], ['Noix de Saint-Jacques', 'pièce']
  ],
  'Crémerie & œufs': [
    ['Lait', 'ml'], ['Œufs', 'pièce'], ['Beurre', 'g'], ['Crème fraîche', 'ml'],
    ['Crème liquide', 'ml'], ['Yaourt nature', 'pièce'], ['Fromage râpé', 'g'], ['Parmesan', 'g'],
    ['Mozzarella', 'g'], ['Emmental', 'g'], ['Comté', 'g'], ['Fromage de chèvre', 'g'],
    ['Feta', 'g'], ['Ricotta', 'g'], ['Mascarpone', 'g'], ['Crème de soja', 'ml']
  ],
  'Boulangerie': [
    ['Pain', 'pièce'], ['Baguette', 'pièce'], ['Pain de mie', 'pièce'], ['Brioche', 'pièce'],
    ['Pâte feuilletée', 'pièce'], ['Pâte brisée', 'pièce'], ['Pâte sablée', 'pièce'],
    ['Pâte à pizza', 'pièce'], ['Biscottes', 'pièce']
  ],
  'Épicerie salée': [
    ['Pâtes', 'g'], ['Spaghetti', 'g'], ['Riz', 'g'], ['Riz basmati', 'g'], ['Lentilles', 'g'],
    ['Pois chiches', 'g'], ['Haricots rouges', 'g'], ['Farine', 'g'], ['Semoule', 'g'],
    ['Quinoa', 'g'], ['Boulgour', 'g'], ['Polenta', 'g'], ['Tomates concassées', 'g'],
    ['Concentré de tomate', 'g'], ['Sauce tomate', 'ml'], ['Bouillon cube', 'pièce'],
    ['Olives', 'g'], ['Cornichons', 'g'], ['Maïs', 'g'], ['Thon en boîte', 'boîte'],
    ['Lait de coco', 'ml'], ['Chapelure', 'g']
  ],
  'Épicerie sucrée': [
    ['Sucre', 'g'], ['Sucre vanillé', 'sachet'], ['Cassonade', 'g'], ['Sucre glace', 'g'],
    ['Chocolat noir', 'g'], ['Chocolat au lait', 'g'], ['Cacao', 'g'], ['Pépites de chocolat', 'g'],
    ['Miel', 'g'], ['Confiture', 'g'], ['Pâte à tartiner', 'g'], ['Compote', 'g'],
    ['Levure chimique', 'sachet'], ['Levure de boulanger', 'sachet'],
    ['Sirop d’érable', 'ml'], ['Lait concentré', 'ml'], ['Vanille', 'pièce']
  ],
  'Épices & condiments': [
    ['Sel', 'g'], ['Poivre', 'pincée'], ['Cumin', 'c. à café'], ['Curry', 'c. à café'],
    ['Paprika', 'c. à café'], ['Curcuma', 'c. à café'], ['Cannelle', 'pincée'],
    ['Muscade', 'pincée'], ['Piment', 'c. à café'], ['Moutarde', 'c. à soupe'], ['Ketchup', 'ml'],
    ['Mayonnaise', 'c. à soupe'], ['Sauce soja', 'ml'], ['Herbes de Provence', 'c. à café'],
    ['Bouillon de légumes', 'ml'], ['Pâte de curry', 'c. à soupe'], ['Graines de sésame', 'g']
  ],
  'Herbes aromatiques': [
    ['Persil', 'botte'], ['Basilic', 'botte'], ['Coriandre', 'botte'], ['Ciboulette', 'botte'],
    ['Thym', 'branche'], ['Romarin', 'branche'], ['Menthe', 'botte'], ['Laurier', 'feuille'],
    ['Aneth', 'botte'], ['Estragon', 'botte']
  ],
  'Huiles & vinaigres': [
    ['Huile d’olive', 'ml'], ['Huile de tournesol', 'ml'], ['Huile de sésame', 'ml'],
    ['Vinaigre', 'ml'], ['Vinaigre balsamique', 'ml'], ['Vinaigre de cidre', 'ml']
  ],
  'Surgelés': [
    ['Petits pois surgelés', 'g'], ['Épinards surgelés', 'g'], ['Légumes surgelés', 'g'],
    ['Glace', 'ml'], ['Frites', 'g'], ['Poisson pané', 'pièce']
  ],
  'Boissons': [
    ['Eau', 'ml'], ['Vin blanc', 'ml'], ['Vin rouge', 'ml'], ['Bière', 'ml'],
    ['Jus d’orange', 'ml'], ['Café', 'g'], ['Thé', 'sachet'], ['Lait d’amande', 'ml']
  ]
};

async function seed() {
  const before = (await db.select({ id: ingredientCatalog.id }).from(ingredientCatalog)).length;

  let total = 0;
  for (const [category, entries] of Object.entries(CATALOG)) {
    for (const [name, unit] of entries) {
      await resolveOrCreate(name, unit, category);
      total++;
    }
  }

  const after = (await db.select({ id: ingredientCatalog.id }).from(ingredientCatalog)).length;
  console.log(`${total} ingrédients traités sur ${Object.keys(CATALOG).length} rayons.`);
  console.log(`Catalogue : ${before} entrées avant → ${after} après (${after - before} créées).`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
