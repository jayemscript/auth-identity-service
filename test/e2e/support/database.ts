import { Client } from 'pg';
import { readE2EConfig } from './config';

export async function withDatabase<T>(
  work: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client(readE2EConfig().db);
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

export async function deleteTestUser(email: string): Promise<void> {
  await withDatabase(async (client) => {
    await client.query('DELETE FROM identity.users WHERE email = $1', [email]);
  });
}
