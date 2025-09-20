import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db';
import { apiKeys, createApiKeySchema, updateApiKeySchema } from '../db/schema';
import { authMiddleware, requireStaff } from '../middleware/auth';
import { eq, desc, count, like, and } from 'drizzle-orm';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const apiKeysRouter = new Hono();

// All API key routes require staff authentication
apiKeysRouter.use('*', authMiddleware);
apiKeysRouter.use('*', requireStaff);

// Query schema for filtering and pagination
const querySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  active: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'lastUsedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Generate a secure API key
function generateApiKey(): string {
  const prefix = 'zk_';
  const randomPart = randomBytes(32).toString('hex');
  return prefix + randomPart;
}

// Get all API keys
apiKeysRouter.get('/', zValidator('query', querySchema), async (c) => {
  try {
    const query = c.req.valid('query');
    const page = parseInt(query.page);
    const limit = parseInt(query.limit);
    const offset = (page - 1) * limit;

    let whereConditions = [];

    if (query.search) {
      whereConditions.push(like(apiKeys.name, `%${query.search}%`));
    }

    if (query.active === 'true') {
      whereConditions.push(eq(apiKeys.isActive, true));
    } else if (query.active === 'false') {
      whereConditions.push(eq(apiKeys.isActive, false));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(apiKeys)
      .where(whereClause);

    // Get paginated results
    const results = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        key: apiKeys.key,
        description: apiKeys.description,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
        updatedAt: apiKeys.updatedAt,
      })
      .from(apiKeys)
      .where(whereClause)
      .orderBy(query.sortOrder === 'desc' ? desc(apiKeys[query.sortBy]) : apiKeys[query.sortBy])
      .limit(limit)
      .offset(offset);

    return c.json({
      data: results,
      pagination: {
        page,
        limit,
        total: totalResult.count,
        totalPages: Math.ceil(totalResult.count / limit),
      },
    });
  } catch (error) {
    console.error('Get API keys error:', error);
    return c.json({ error: 'Failed to fetch API keys' }, 500);
  }
});

// Get single API key
apiKeysRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id));

    if (!apiKey) {
      return c.json({ error: 'API key not found' }, 404);
    }

    return c.json({ data: apiKey });
  } catch (error) {
    console.error('Get API key error:', error);
    return c.json({ error: 'Failed to fetch API key' }, 500);
  }
});

// Create new API key
apiKeysRouter.post('/', zValidator('json', createApiKeySchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const user = c.get('user');

    const newApiKey = {
      ...data,
      key: generateApiKey(),
      createdBy: user.id,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    };

    const [created] = await db
      .insert(apiKeys)
      .values(newApiKey)
      .returning();

    return c.json({ data: created }, 201);
  } catch (error) {
    console.error('Create API key error:', error);
    return c.json({ error: 'Failed to create API key' }, 500);
  }
});

// Update API key
apiKeysRouter.put('/:id', zValidator('json', updateApiKeySchema), async (c) => {
  try {
    const id = c.req.param('id');
    const data = c.req.valid('json');

    const updateData = {
      ...data,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(apiKeys)
      .set(updateData)
      .where(eq(apiKeys.id, id))
      .returning();

    if (!updated) {
      return c.json({ error: 'API key not found' }, 404);
    }

    return c.json({ data: updated });
  } catch (error) {
    console.error('Update API key error:', error);
    return c.json({ error: 'Failed to update API key' }, 500);
  }
});

// Delete API key
apiKeysRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const [deleted] = await db
      .delete(apiKeys)
      .where(eq(apiKeys.id, id))
      .returning();

    if (!deleted) {
      return c.json({ error: 'API key not found' }, 404);
    }

    return c.json({ message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Delete API key error:', error);
    return c.json({ error: 'Failed to delete API key' }, 500);
  }
});

// Regenerate API key
apiKeysRouter.post('/:id/regenerate', async (c) => {
  try {
    const id = c.req.param('id');

    const [updated] = await db
      .update(apiKeys)
      .set({
        key: generateApiKey(),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, id))
      .returning();

    if (!updated) {
      return c.json({ error: 'API key not found' }, 404);
    }

    return c.json({ data: updated });
  } catch (error) {
    console.error('Regenerate API key error:', error);
    return c.json({ error: 'Failed to regenerate API key' }, 500);
  }
});

export default apiKeysRouter;