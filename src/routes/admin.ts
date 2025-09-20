import { Hono } from 'hono';
import { db } from '../db';
import { users, products, orders } from '../db/schema';
import { authMiddleware, requireStaff } from '../middleware/auth';
import { eq, count, sql } from 'drizzle-orm';
import { z } from 'zod';

const adminRouter = new Hono();

// All admin routes require staff authentication
adminRouter.use('*', authMiddleware);
adminRouter.use('*', requireStaff);

// Dashboard stats endpoint
adminRouter.get('/dashboard', async (c) => {
  try {
    // Get total counts
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalProducts] = await db.select({ count: count() }).from(products);
    const [totalOrders] = await db.select({ count: count() }).from(orders);

    // Get recent stats (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    const [recentUsers] = await db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.createdAt} >= ${thirtyDaysAgoISO}`);

    const [recentOrders] = await db
      .select({ count: count() })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${thirtyDaysAgoISO}`);

    // Calculate total revenue (assuming orders have a total field)
    const [totalRevenue] = await db
      .select({ 
        total: sql<number>`COALESCE(SUM(${orders.total}), 0)` 
      })
      .from(orders);

    const [recentRevenue] = await db
      .select({ 
        total: sql<number>`COALESCE(SUM(${orders.total}), 0)` 
      })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${thirtyDaysAgoISO}`);

    return c.json({
      stats: {
        totalUsers: totalUsers.count,
        totalProducts: totalProducts.count,
        totalOrders: totalOrders.count,
        totalRevenue: totalRevenue.total || 0,
        recentUsers: recentUsers.count,
        recentOrders: recentOrders.count,
        recentRevenue: recentRevenue.total || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return c.json({ error: 'Failed to fetch dashboard stats' }, 500);
  }
});

// Query schema for user filtering and pagination
const userQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  role: z.enum(['customer', 'staff', 'admin']).optional(),
  sortBy: z.enum(['firstName', 'email', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Get all users (admin only)
adminRouter.get('/users', async (c) => {
  try {
    const query = c.req.query();
    const validatedQuery = userQuerySchema.parse(query);
    
    const page = parseInt(validatedQuery.page);
    const limit = parseInt(validatedQuery.limit);
    const offset = (page - 1) * limit;

    let whereConditions = [];
    
    if (validatedQuery.search) {
      whereConditions.push(
        sql`(${users.firstName} ILIKE ${'%' + validatedQuery.search + '%'} OR 
            ${users.lastName} ILIKE ${'%' + validatedQuery.search + '%'} OR 
            ${users.email} ILIKE ${'%' + validatedQuery.search + '%'})`
      );
    }

    if (validatedQuery.role) {
      whereConditions.push(eq(users.role, validatedQuery.role));
    }

    // Build the query
    let query_builder = db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    }).from(users);

    if (whereConditions.length > 0) {
      query_builder = query_builder.where(sql`${whereConditions.join(' AND ')}`);
    }

    // Add ordering
    const orderColumn = users[validatedQuery.sortBy as keyof typeof users];
    if (validatedQuery.sortOrder === 'asc') {
      query_builder = query_builder.orderBy(sql`${orderColumn} ASC`);
    } else {
      query_builder = query_builder.orderBy(sql`${orderColumn} DESC`);
    }

    // Add pagination
    const result = await query_builder.limit(limit).offset(offset);

    // Get total count for pagination
    let countQuery = db.select({ count: count() }).from(users);
    if (whereConditions.length > 0) {
      countQuery = countQuery.where(sql`${whereConditions.join(' AND ')}`);
    }
    const [totalCount] = await countQuery;

    return c.json({
      users: result,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

export default adminRouter;