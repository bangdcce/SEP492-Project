import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { seedSkillDomains } from './skill-domains.seed';
import { seedSkills } from './skills.seed';

// Load environment variables
config({ path: join(__dirname, '../../../.env') });

async function runSeeds() {
  // Create DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [join(__dirname, '../entities/**/*.entity{.ts,.js}')],
    synchronize: false,
  });

  try {
    // Initialize connection
    await dataSource.initialize();
    console.log('📦 Database connection established');

    // Run seeds
    console.log('\n🌱 Starting database seeding...\n');
    
    await seedSkillDomains(dataSource);
    await seedSkills(dataSource);
    
    console.log('\n✅ All seeds completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('👋 Database connection closed');
  }
}

// Run seeds
runSeeds();
