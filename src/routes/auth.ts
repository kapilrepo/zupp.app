import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db';
import { users, loginSchema, registerSchema, type User } from '../db/schema';
import { AuthService } from '../lib/auth';
import { authMiddleware } from '../middleware/auth';
import { eq } from 'drizzle-orm';

const auth = new Hono();

// Register
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  try {
    const { email, password, firstName, lastName, phone } = c.req.valid('json');

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return c.json({ error: 'User already exists with this email' }, 400);
    }

    // Hash password
    const hashedPassword = await AuthService.hashPassword(password);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: 'customer',
      })
      .returning();

    const user = newUser[0];
    const token = AuthService.generateToken(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return c.json({
      message: 'User registered successfully',
      user: userWithoutPassword,
      token,
    }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Login
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const { email, password } = c.req.valid('json');

    // Find user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!userResult.length) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const user = userResult[0];

    // Check if user is active
    if (!user.isActive) {
      return c.json({ error: 'Account is deactivated' }, 401);
    }

    // Verify password
    const isValidPassword = await AuthService.comparePassword(password, user.password);
    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    // Generate token
    const token = AuthService.generateToken(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return c.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get current user profile
auth.get('/me', authMiddleware, async (c) => {
  try {
    const { id } = c.get('user');

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!userResult.length) {
      return c.json({ error: 'User not found' }, 404);
    }

    const { password: _, ...userWithoutPassword } = userResult[0];

    return c.json({
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Refresh token
auth.post('/refresh', authMiddleware, async (c) => {
  try {
    const { id } = c.get('user');

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!userResult.length || !userResult[0].isActive) {
      return c.json({ error: 'User not found or inactive' }, 404);
    }

    const token = AuthService.generateToken(userResult[0]);

    return c.json({
      message: 'Token refreshed successfully',
      token,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default auth;