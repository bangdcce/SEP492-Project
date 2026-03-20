import { AppDataSource } from '../data-source';
import { seedSkillDomains } from './skill-domains.seed';
import { seedSkills } from './skills.seed';
import { join } from 'path';
import * as fs from 'fs';

async function runSeeds() {
  try {
    // Initialize connection using official DataSource
    await AppDataSource.initialize();
    console.log('📦 Database connection established via AppDataSource');

    // Run seeds
    console.log('\n🌱 Starting database seeding...\n');

    await seedSkillDomains(AppDataSource);
    await seedSkills(AppDataSource);

    // Run SQL seeds
    console.log('📜 Running SQL seeds...');
    const wizardSql = fs.readFileSync(join(__dirname, 'wizard-seed.sql'), 'utf8');
    await AppDataSource.query(wizardSql);
    console.log('✅ Wizard seeds completed');

    console.log('\n✅ All seeds completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('👋 Database connection closed');
    }
  }
}

// Run seeds
runSeeds();

