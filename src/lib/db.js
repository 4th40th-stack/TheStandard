import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

export function getSql() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local for Neon (pending logins).');
  }

  return neon(connectionString);
}
