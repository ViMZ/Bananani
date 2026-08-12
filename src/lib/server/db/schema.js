import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').default(''),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull()
});

export const ingredientCatalog = sqliteTable('ingredient_catalog', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  normalizedKey: text('normalized_key').notNull().unique(),
  defaultUnit: text('default_unit').default(''),
  category: text('category').default(''),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull()
});

export const recipes = sqliteTable('recipes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').default(''),
  owner: text('owner').default(''),
  servings: integer('servings').default(2),
  instructions: text('instructions').default(''),
  photoPath: text('photo_path'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull()
});

export const recipeIngredients = sqliteTable('recipe_ingredients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  canonicalId: integer('canonical_id').references(() => ingredientCatalog.id, {
    onDelete: 'set null'
  }),
  name: text('name').notNull(),
  brand: text('brand').default(''),
  productReference: text('product_reference').default(''),
  quantity: real('quantity').default(0),
  unit: text('unit').default(''),
  notes: text('notes').default(''),
  position: integer('position').default(0)
});

export const shoppingItems = sqliteTable('shopping_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  recipeId: integer('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
  canonicalId: integer('canonical_id').references(() => ingredientCatalog.id, {
    onDelete: 'set null'
  }),
  recipeTitle: text('recipe_title').default(''),
  name: text('name').notNull(),
  brand: text('brand').default(''),
  productReference: text('product_reference').default(''),
  quantity: real('quantity').default(0),
  unit: text('unit').default(''),
  notes: text('notes').default(''),
  checked: integer('checked', { mode: 'boolean' }).default(false),
  addedAt: text('added_at').default(sql`(CURRENT_TIMESTAMP)`).notNull()
});
