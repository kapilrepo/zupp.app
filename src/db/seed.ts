import { db } from './index';
import { categories, products, productCategories } from './schema/products';

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Insert categories
    console.log('📂 Inserting categories...');
    const insertedCategories = await db.insert(categories).values([
      {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic devices and gadgets',
        isActive: true,
        sortOrder: 1
      },
      {
        name: 'Clothing',
        slug: 'clothing',
        description: 'Fashion and apparel for all ages',
        isActive: true,
        sortOrder: 2
      },
      {
        name: 'Home & Garden',
        slug: 'home-garden',
        description: 'Home improvement and garden supplies',
        isActive: true,
        sortOrder: 3
      },
      {
        name: 'Books',
        slug: 'books',
        description: 'Books, magazines, and educational materials',
        isActive: true,
        sortOrder: 4
      },
      {
        name: 'Sports & Outdoors',
        slug: 'sports-outdoors',
        description: 'Sports equipment and outdoor gear',
        isActive: true,
        sortOrder: 5
      }
    ]).returning();

    console.log(`✅ Inserted ${insertedCategories.length} categories`);

    // Get category IDs for product associations
    const electronicsCategory = insertedCategories.find(c => c.slug === 'electronics');
    const clothingCategory = insertedCategories.find(c => c.slug === 'clothing');
    const homeGardenCategory = insertedCategories.find(c => c.slug === 'home-garden');
    const booksCategory = insertedCategories.find(c => c.slug === 'books');
    const sportsCategory = insertedCategories.find(c => c.slug === 'sports-outdoors');

    // Insert products
    console.log('📦 Inserting products...');
    const insertedProducts = await db.insert(products).values([
      {
        name: 'Wireless Bluetooth Headphones',
        slug: 'wireless-bluetooth-headphones',
        description: 'High-quality wireless headphones with noise cancellation and 30-hour battery life.',
        shortDescription: 'Premium wireless headphones with noise cancellation',
        sku: 'WBH-001',
        price: '199.99',
        compareAtPrice: '249.99',
        quantity: 50,
        isActive: true,
        isFeatured: true,
        images: ['/images/headphones-1.jpg', '/images/headphones-2.jpg'],
        tags: ['electronics', 'audio', 'wireless', 'bluetooth']
      },
      {
        name: 'Smartphone Case - Clear',
        slug: 'smartphone-case-clear',
        description: 'Transparent protective case for smartphones with drop protection and wireless charging compatibility.',
        shortDescription: 'Clear protective smartphone case',
        sku: 'SPC-001',
        price: '24.99',
        quantity: 100,
        isActive: true,
        isFeatured: false,
        images: ['/images/phone-case-1.jpg'],
        tags: ['electronics', 'accessories', 'protection']
      },
      {
        name: 'Cotton T-Shirt - Navy Blue',
        slug: 'cotton-tshirt-navy-blue',
        description: '100% organic cotton t-shirt in navy blue. Comfortable fit and sustainable materials.',
        shortDescription: 'Organic cotton t-shirt in navy blue',
        sku: 'CTN-001',
        price: '29.99',
        quantity: 75,
        isActive: true,
        isFeatured: true,
        images: ['/images/tshirt-navy-1.jpg', '/images/tshirt-navy-2.jpg'],
        tags: ['clothing', 'cotton', 'casual', 'organic']
      },
      {
        name: 'Denim Jeans - Classic Fit',
        slug: 'denim-jeans-classic-fit',
        description: 'Classic fit denim jeans made from premium denim with comfortable stretch.',
        shortDescription: 'Classic fit denim jeans',
        sku: 'DNM-001',
        price: '79.99',
        compareAtPrice: '99.99',
        quantity: 40,
        isActive: true,
        isFeatured: false,
        images: ['/images/jeans-1.jpg'],
        tags: ['clothing', 'denim', 'casual']
      },
      {
        name: 'Indoor Plant Pot Set',
        slug: 'indoor-plant-pot-set',
        description: 'Set of 3 ceramic plant pots with drainage holes and saucers. Perfect for indoor plants.',
        shortDescription: 'Set of 3 ceramic plant pots',
        sku: 'IPP-001',
        price: '45.99',
        quantity: 30,
        isActive: true,
        isFeatured: false,
        images: ['/images/plant-pots-1.jpg', '/images/plant-pots-2.jpg'],
        tags: ['home', 'garden', 'plants', 'ceramic']
      },
      {
        name: 'Programming Book - JavaScript Guide',
        slug: 'programming-book-javascript-guide',
        description: 'Complete guide to modern JavaScript programming with practical examples and exercises.',
        shortDescription: 'Complete JavaScript programming guide',
        sku: 'PBK-001',
        price: '39.99',
        quantity: 25,
        isActive: true,
        isFeatured: true,
        images: ['/images/js-book-1.jpg'],
        tags: ['books', 'programming', 'javascript', 'education']
      },
      {
        name: 'Yoga Mat - Premium',
        slug: 'yoga-mat-premium',
        description: 'Premium non-slip yoga mat with extra cushioning and eco-friendly materials.',
        shortDescription: 'Premium non-slip yoga mat',
        sku: 'YGM-001',
        price: '59.99',
        quantity: 35,
        isActive: true,
        isFeatured: false,
        images: ['/images/yoga-mat-1.jpg'],
        tags: ['sports', 'fitness', 'yoga', 'eco-friendly']
      },
      {
        name: 'Running Shoes - Athletic',
        slug: 'running-shoes-athletic',
        description: 'Lightweight running shoes with advanced cushioning and breathable mesh upper.',
        shortDescription: 'Lightweight athletic running shoes',
        sku: 'RNS-001',
        price: '129.99',
        compareAtPrice: '159.99',
        quantity: 60,
        isActive: true,
        isFeatured: true,
        images: ['/images/running-shoes-1.jpg', '/images/running-shoes-2.jpg'],
        tags: ['sports', 'running', 'shoes', 'athletic']
      }
    ]).returning();

    console.log(`✅ Inserted ${insertedProducts.length} products`);

    // Create product-category associations
    console.log('🔗 Creating product-category associations...');
    const productCategoryAssociations = [];

    // Electronics products
    const electronicsProducts = insertedProducts.filter(p => 
      p.slug === 'wireless-bluetooth-headphones' || p.slug === 'smartphone-case-clear'
    );
    electronicsProducts.forEach(product => {
      if (electronicsCategory) {
        productCategoryAssociations.push({
          productId: product.id,
          categoryId: electronicsCategory.id
        });
      }
    });

    // Clothing products
    const clothingProducts = insertedProducts.filter(p => 
      p.slug === 'cotton-tshirt-navy-blue' || p.slug === 'denim-jeans-classic-fit'
    );
    clothingProducts.forEach(product => {
      if (clothingCategory) {
        productCategoryAssociations.push({
          productId: product.id,
          categoryId: clothingCategory.id
        });
      }
    });

    // Home & Garden products
    const homeGardenProducts = insertedProducts.filter(p => 
      p.slug === 'indoor-plant-pot-set'
    );
    homeGardenProducts.forEach(product => {
      if (homeGardenCategory) {
        productCategoryAssociations.push({
          productId: product.id,
          categoryId: homeGardenCategory.id
        });
      }
    });

    // Books products
    const booksProducts = insertedProducts.filter(p => 
      p.slug === 'programming-book-javascript-guide'
    );
    booksProducts.forEach(product => {
      if (booksCategory) {
        productCategoryAssociations.push({
          productId: product.id,
          categoryId: booksCategory.id
        });
      }
    });

    // Sports & Outdoors products
    const sportsProducts = insertedProducts.filter(p => 
      p.slug === 'yoga-mat-premium' || p.slug === 'running-shoes-athletic'
    );
    sportsProducts.forEach(product => {
      if (sportsCategory) {
        productCategoryAssociations.push({
          productId: product.id,
          categoryId: sportsCategory.id
        });
      }
    });

    if (productCategoryAssociations.length > 0) {
      await db.insert(productCategories).values(productCategoryAssociations);
      console.log(`✅ Created ${productCategoryAssociations.length} product-category associations`);
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Categories: ${insertedCategories.length}`);
    console.log(`   - Products: ${insertedProducts.length}`);
    console.log(`   - Associations: ${productCategoryAssociations.length}`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run the seeding function
seedDatabase()
  .then(() => {
    console.log('✅ Seeding process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding process failed:', error);
    process.exit(1);
  });