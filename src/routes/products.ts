import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db';
import { products, categories, productCategories, insertProductSchema, insertCategorySchema } from '../db/schema';
import { authMiddleware, requireStaff } from '../middleware/auth';
import { eq, like, and, desc, asc } from 'drizzle-orm';
import { z } from 'zod';

const productsRouter = new Hono();

// Query schema for filtering and pagination
const querySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  category: z.string().optional(),
  featured: z.string().optional(),
  active: z.string().optional(),
  sortBy: z.enum(['name', 'price', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Get all products (public)
productsRouter.get('/', zValidator('query', querySchema), async (c) => {
  try {
    const query = c.req.valid('query');
    const page = parseInt(query.page);
    const limit = parseInt(query.limit);
    const offset = (page - 1) * limit;

    let whereConditions = [];
    
    // Only show active products for public API
    whereConditions.push(eq(products.isActive, true));

    if (query.search) {
      whereConditions.push(like(products.name, `%${query.search}%`));
    }

    if (query.featured === 'true') {
      whereConditions.push(eq(products.isFeatured, true));
    }

    // Build order by clause
    const orderBy = query.sortOrder === 'asc' 
      ? asc(products[query.sortBy as keyof typeof products])
      : desc(products[query.sortBy as keyof typeof products]);

    const result = await db
      .select()
      .from(products)
      .where(and(...whereConditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: products.id })
      .from(products)
      .where(and(...whereConditions));

    return c.json({
      products: result,
      pagination: {
        page,
        limit,
        total: totalResult.length,
        pages: Math.ceil(totalResult.length / limit),
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get single product by ID or slug (public)
productsRouter.get('/:identifier', async (c) => {
  try {
    const identifier = c.req.param('identifier');
    
    // Check if identifier is UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    const result = await db
      .select()
      .from(products)
      .where(
        and(
          isUUID ? eq(products.id, identifier) : eq(products.slug, identifier),
          eq(products.isActive, true)
        )
      )
      .limit(1);

    if (!result.length) {
      return c.json({ error: 'Product not found' }, 404);
    }

    return c.json({ product: result[0] });
  } catch (error) {
    console.error('Get product error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Admin routes (require authentication)
productsRouter.use('/admin/*', authMiddleware, requireStaff);

// Get all products for admin (includes inactive)
productsRouter.get('/admin/products', zValidator('query', querySchema), async (c) => {
  try {
    const query = c.req.valid('query');
    const page = parseInt(query.page);
    const limit = parseInt(query.limit);
    const offset = (page - 1) * limit;

    let whereConditions = [];

    if (query.search) {
      whereConditions.push(like(products.name, `%${query.search}%`));
    }

    if (query.active === 'true') {
      whereConditions.push(eq(products.isActive, true));
    } else if (query.active === 'false') {
      whereConditions.push(eq(products.isActive, false));
    }

    if (query.featured === 'true') {
      whereConditions.push(eq(products.isFeatured, true));
    }

    const orderBy = query.sortOrder === 'asc' 
      ? asc(products[query.sortBy as keyof typeof products])
      : desc(products[query.sortBy as keyof typeof products]);

    const result = await db
      .select()
      .from(products)
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: products.id })
      .from(products)
      .where(whereConditions.length ? and(...whereConditions) : undefined);

    return c.json({
      products: result,
      pagination: {
        page,
        limit,
        total: totalResult.length,
        pages: Math.ceil(totalResult.length / limit),
      },
    });
  } catch (error) {
    console.error('Get admin products error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create product
productsRouter.post('/admin/products', zValidator('json', insertProductSchema), async (c) => {
  try {
    const productData = c.req.valid('json');

    const result = await db
      .insert(products)
      .values(productData)
      .returning();

    return c.json({
      message: 'Product created successfully',
      product: result[0],
    }, 201);
  } catch (error) {
    console.error('Create product error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update product
productsRouter.put('/admin/products/:id', zValidator('json', insertProductSchema.partial()), async (c) => {
  try {
    const id = c.req.param('id');
    const updateData = c.req.valid('json');

    const result = await db
      .update(products)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    if (!result.length) {
      return c.json({ error: 'Product not found' }, 404);
    }

    return c.json({
      message: 'Product updated successfully',
      product: result[0],
    });
  } catch (error) {
    console.error('Update product error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete product
productsRouter.delete('/admin/products/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const result = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();

    if (!result.length) {
      return c.json({ error: 'Product not found' }, 404);
    }

    return c.json({
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Categories routes
productsRouter.get('/categories', async (c) => {
  try {
    const result = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    return c.json({ categories: result });
  } catch (error) {
    console.error('Get categories error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

productsRouter.post('/admin/categories', zValidator('json', insertCategorySchema), async (c) => {
  try {
    const categoryData = c.req.valid('json');

    const result = await db
      .insert(categories)
      .values(categoryData)
      .returning();

    return c.json({
      message: 'Category created successfully',
      category: result[0],
    }, 201);
  } catch (error) {
    console.error('Create category error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default productsRouter;