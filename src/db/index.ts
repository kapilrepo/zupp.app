import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

// Create the connection
const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString, { prepare: false });

// Create the database instance
export const db = drizzle(client);

// Export the client for raw queries if needed
export { client };