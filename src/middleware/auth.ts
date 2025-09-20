import type { Context, Next } from 'hono';
import { AuthService } from '../lib/auth';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthContext {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = AuthService.extractTokenFromHeader(authHeader);

    if (!token) {
      return c.json({ error: 'Authorization token required' }, 401);
    }

    const payload = AuthService.verifyToken(token);
    
    // Verify user still exists and is active
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user.length || !user[0].isActive) {
      return c.json({ error: 'User not found or inactive' }, 401);
    }

    // Add user info to context
    c.set('user', {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    });

    await next();
  } catch (error) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
};

export const requireRole = (roles: string[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthContext['user'];
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (!roles.includes(user.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    await next();
  };
};

export const requireAdmin = requireRole(['admin']);
export const requireStaff = requireRole(['admin', 'staff']);