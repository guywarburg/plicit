import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getDb, closeDb } from './client.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '..', 'drizzle');

function main() {
  if (!existsSync(migrationsFolder)) {
    console.error(
      `No migrations directory at ${migrationsFolder}. Run \`pnpm --filter @plicit/db drizzle:generate\` first.`,
    );
    process.exit(1);
  }
  const db = getDb();
  migrate(db, { migrationsFolder });
  closeDb();
  // eslint-disable-next-line no-console
  console.log(`Migrations applied from ${migrationsFolder}`);
}

main();
