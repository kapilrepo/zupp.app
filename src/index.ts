import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { serveStatic } from 'hono/bun';
import { config } from 'dotenv';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import productsRoutes from './routes/products';
import adminRoutes from './routes/admin';
import apiKeysRoutes from './routes/apiKeys';
import publicRoutes from './routes/public';

// Load environment variables
config();

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3001', 
    'http://localhost:3002', 
    'http://localhost:3003',
    'http://localhost:5174',
    'https://zuppstorefront-4z2o42hdw-kapil-sharmas-projects-31b4bc76.vercel.app'
  ],
  credentials: true,
}));

// API routes
const apiPrefix = process.env.API_PREFIX || '/api/v1';

app.route(`${apiPrefix}/auth`, authRoutes);
app.route(`${apiPrefix}/products`, productsRoutes);
app.route(`${apiPrefix}/admin`, adminRoutes);
app.route(`${apiPrefix}/admin/api-keys`, apiKeysRoutes);
app.route(`${apiPrefix}/public`, publicRoutes);

// Serve static files from www directory (admin dashboard) directly on root
// This should come AFTER API routes to avoid conflicts
app.use('*', serveStatic({
  root: path.join(__dirname, 'www'),
}));

// Fallback for SPA routing - serve index.html for non-API routes
app.get('*', (c) => {
  // Don't serve static files for API routes
  if (c.req.path.startsWith('/api/')) {
    return c.notFound();
  }
  return serveStatic({
    path: path.join(__dirname, 'www', 'index.html'),
  })(c);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  }, 500);
});

const port = parseInt(process.env.PORT || '3001');

console.log(`🚀 Zupp.store API starting on port ${port}`);
console.log(`📚 API Documentation: http://localhost:${port}${apiPrefix}`);
console.log(`🏥 Health Check: http://localhost:${port}/health`);

export default {
  port,
  fetch: app.fetch,
};
