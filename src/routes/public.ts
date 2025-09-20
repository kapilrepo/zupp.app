import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db';
import { products, categories, productCategories } from '../db/schema';
import { apiKeyMiddleware } from '../middleware/apiKey';
import { eq, like, and, desc, asc, count } from 'drizzle-orm';
import { z } from 'zod';

const publicRouter = new Hono();

// All public routes require API key authentication
publicRouter.use('*', apiKeyMiddleware);

// Query schema for filtering and pagination
const querySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  category: z.string().optional(),
  featured: z.string().optional(),
  sortBy: z.enum(['name', 'price', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Get store information
publicRouter.get('/store', async (c) => {
  try {
    // Get basic store stats
    const [totalProducts] = await db.select({ count: count() }).from(products).where(eq(products.isActive, true));
    const [totalCategories] = await db.select({ count: count() }).from(categories).where(eq(categories.isActive, true));

    return c.json({
      data: {
        name: 'Zupp Store',
        description: 'Your modern e-commerce solution',
        totalProducts: totalProducts.count,
        totalCategories: totalCategories.count,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get store info error:', error);
    return c.json({ error: 'Failed to fetch store information' }, 500);
  }
});

// Get all products (public API with API key)
publicRouter.get('/products', zValidator('query', querySchema), async (c) => {
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

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(products)
      .where(whereClause);

    // Get paginated results
    const results = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        description: products.description,
        shortDescription: products.shortDescription,
        sku: products.sku,
        price: products.price,
        compareAtPrice: products.compareAtPrice,
        images: products.images,
        tags: products.tags,
        isFeatured: products.isFeatured,
        quantity: products.quantity,
        trackQuantity: products.trackQuantity,
        weight: products.weight,
        dimensions: products.dimensions,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(whereClause)
      .orderBy(query.sortOrder === 'desc' ? desc(products[query.sortBy]) : asc(products[query.sortBy]))
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
    console.error('Get products error:', error);
    return c.json({ error: 'Failed to fetch products' }, 500);
  }
});

// Get single product by ID or slug
publicRouter.get('/products/:identifier', async (c) => {
  try {
    const identifier = c.req.param('identifier');
    
    // Try to find by ID first, then by slug
    const [product] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
            ? eq(products.id, identifier)
            : eq(products.slug, identifier)
        )
      );

    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    return c.json({ data: product });
  } catch (error) {
    console.error('Get product error:', error);
    return c.json({ error: 'Failed to fetch product' }, 500);
  }
});

// Get all categories
publicRouter.get('/categories', async (c) => {
  try {
    const results = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        image: categories.image,
        parentId: categories.parentId,
        sortOrder: categories.sortOrder,
        createdAt: categories.createdAt,
      })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    return c.json({ data: results });
  } catch (error) {
    console.error('Get categories error:', error);
    return c.json({ error: 'Failed to fetch categories' }, 500);
  }
});

// Get single category by ID or slug
publicRouter.get('/categories/:identifier', async (c) => {
  try {
    const identifier = c.req.param('identifier');
    
    // Try to find by ID first, then by slug
    const [category] = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.isActive, true),
          identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
            ? eq(categories.id, identifier)
            : eq(categories.slug, identifier)
        )
      );

    if (!category) {
      return c.json({ error: 'Category not found' }, 404);
    }

    return c.json({ data: category });
  } catch (error) {
    console.error('Get category error:', error);
    return c.json({ error: 'Failed to fetch category' }, 500);
  }
});

// Search products
publicRouter.get('/search', zValidator('query', z.object({
  q: z.string().min(1, 'Search query is required'),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
})), async (c) => {
  try {
    const { q, page: pageStr, limit: limitStr } = c.req.valid('query');
    const page = parseInt(pageStr);
    const limit = parseInt(limitStr);
    const offset = (page - 1) * limit;

    const searchCondition = and(
      eq(products.isActive, true),
      like(products.name, `%${q}%`)
    );

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(products)
      .where(searchCondition);

    // Get search results
    const results = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        description: products.description,
        shortDescription: products.shortDescription,
        price: products.price,
        compareAtPrice: products.compareAtPrice,
        images: products.images,
        isFeatured: products.isFeatured,
      })
      .from(products)
      .where(searchCondition)
      .orderBy(desc(products.isFeatured), asc(products.name))
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
      query: q,
    });
  } catch (error) {
    console.error('Search products error:', error);
    return c.json({ error: 'Failed to search products' }, 500);
  }
});

export default publicRouter;