import { db } from '../db';
import { users } from '../db/schema';
import { AuthService } from '../lib/auth';
import { eq } from 'drizzle-orm';

async function createAdminUser() {
  try {
    const adminEmail = 'admin@zupp.store';
    const adminPassword = 'admin123';

    // Check if admin user already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log('Admin user already exists:', adminEmail);
      return;
    }

    // Hash the password
    const hashedPassword = await AuthService.hashPassword(adminPassword);

    // Create admin user
    const newAdmin = await db
      .insert(users)
      .values({
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true,
        emailVerified: true,
      })
      .returning();

    console.log('Admin user created successfully!');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('User ID:', newAdmin[0].id);
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    process.exit(0);
  }
}

createAdminUser();