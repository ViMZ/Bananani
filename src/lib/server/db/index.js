import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as schema from './schema.js';

const DATA_DIR = process.env.DATA_DIR ?? './data';
const DB_PATH = join(DATA_DIR, 'bananani.db');

if (!existsSync(dirname(DB_PATH))) {
  mkdirSync(dirname(DB_PATH), { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// Bootstrap tables on first run (idempotent).
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS ingredient_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    normalized_key TEXT NOT NULL UNIQUE,
    default_unit TEXT DEFAULT '',
    category TEXT DEFAULT '',
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    servings INTEGER DEFAULT 2,
    instructions TEXT DEFAULT '',
    photo_path TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    canonical_id INTEGER REFERENCES ingredient_catalog(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    brand TEXT DEFAULT '',
    product_reference TEXT DEFAULT '',
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    position INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS shopping_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
    canonical_id INTEGER REFERENCES ingredient_catalog(id) ON DELETE SET NULL,
    recipe_title TEXT DEFAULT '',
    name TEXT NOT NULL,
    brand TEXT DEFAULT '',
    product_reference TEXT DEFAULT '',
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    checked INTEGER DEFAULT 0,
    added_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
  );
`);

// Migration douce : ajoute des colonnes aux tables déjà créées avant l'introduction
// du catalogue. CREATE TABLE IF NOT EXISTS ne modifie pas une table existante, on
// passe donc par des ALTER TABLE gardés (no-op si la colonne est déjà là).
function addColumnIfMissing(table, column, definition) {
  const cols = sqlite.pragma(`table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

for (const table of ['recipe_ingredients', 'shopping_items']) {
  addColumnIfMissing(
    table,
    'canonical_id',
    'INTEGER REFERENCES ingredient_catalog(id) ON DELETE SET NULL'
  );
}
addColumnIfMissing('ingredient_catalog', 'default_unit', "TEXT DEFAULT ''");
addColumnIfMissing('ingredient_catalog', 'category', "TEXT DEFAULT ''");
