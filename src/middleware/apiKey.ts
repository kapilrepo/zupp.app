import { Context, Next } from 'hono';
import { db } from '../db';
import { apiKeys } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const apiKeyMiddleware = async (c: Context, next: Next) => {
  try {
    const apiKey = c.req.header('X-API-Key') || c.req.query('api_key');

    if (!apiKey) {
      return c.json({ error: 'API key is required' }, 401);
    }

    // Find the API key in the database
    const [keyRecord] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.key, apiKey),
          eq(apiKeys.isActive, true)
        )
      );

    if (!keyRecord) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    // Check if the API key has expired
    if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
      return c.json({ error: 'API key has expired' }, 401);
    }

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyRecord.id));

    // Store the API key info in context for later use
    c.set('apiKey', keyRecord);

    await next();
  } catch (error) {
    console.error('API key middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
};