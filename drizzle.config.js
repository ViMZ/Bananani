/** @type {import('drizzle-kit').Config} */
export default {
  schema: './src/lib/server/db/schema.js',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:./data/bananani.db'
  }
};
