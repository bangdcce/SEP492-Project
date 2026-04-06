/**
 * Admin Seeder CLI Tool
 *
 * Bảo mật: Chỉ chạy được khi có ADMIN_SEED_SECRET đúng trong env
 *
 * Chạy: npm run seed:admin
 */

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config();

// ============================================
// CONFIGURATION
// ============================================
const EXPECTED_SECRET = process.env.ADMIN_SEED_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@interdev.local';
const BCRYPT_SALT_ROUNDS = 12; // Match AuthService

// ============================================
// COLORS FOR TERMINAL OUTPUT
// ============================================
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logBox(lines: string[]) {
  const maxLen = Math.max(...lines.map((l) => l.length));
  const border = '═'.repeat(maxLen + 2);
  log(`╔${border}╗`, colors.cyan);
  lines.forEach((line) => {
    const padding = ' '.repeat(maxLen - line.length);
    log(`║ ${line}${padding} ║`, colors.cyan);
  });
  log(`╚${border}╝`, colors.cyan);
}

// ============================================
// GENERATE RANDOM PASSWORD
// ============================================
function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

// ============================================
// MAIN SEEDER FUNCTION
// ============================================
async function seedAdmin() {
  log('\n🔐 InterDev Admin Seeder', colors.bold);
  log('━'.repeat(40), colors.cyan);

  // 1. Validate secret key
  if (!EXPECTED_SECRET || EXPECTED_SECRET === 'your-secret-key-here-remove-after-use') {
    log('❌ ERROR: ADMIN_SEED_SECRET is not set or is placeholder value', colors.red);
    log('   Please set a valid secret in .env file', colors.yellow);
    log('   Generate with: openssl rand -hex 32\n', colors.yellow);
    process.exit(1);
  }

  log('✅ Secret key validated', colors.green);
  log(`📧 Target email: ${ADMIN_EMAIL}`, colors.cyan);

  // 2. Create DataSource và connect
  const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
    logging: false,
    entities: [
      path.join(__dirname, '../database/entities/*.entity{.ts,.js}'),
      path.join(__dirname, '../modules/**/entities/*.entity{.ts,.js}'),
    ],
  });

  try {
    await AppDataSource.initialize();
    log('✅ Database connected', colors.green);

    // 3. Check if this email already exists
    const userRepo = AppDataSource.getRepository('UserEntity');
    const existingUser = await userRepo.findOne({
      where: { email: ADMIN_EMAIL },
    });

    if (existingUser) {
      log(`\n⚠️  User with email ${ADMIN_EMAIL} already exists!`, colors.yellow);
      log('   Use a different ADMIN_EMAIL in .env\n', colors.yellow);
      await AppDataSource.destroy();
      process.exit(0);
    }

    // 4. Generate password và hash (giống AuthService)
    const plainPassword = generatePassword(16);
    const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);

    // 5. Insert admin user
    const now = new Date();
    const adminUser = {
      email: ADMIN_EMAIL,
      passwordHash: passwordHash,
      fullName: 'System Administrator',
      role: 'ADMIN',
      isVerified: true,
      emailVerifiedAt: now,
      currentTrustScore: 5.0,
      totalProjectsFinished: 0,
      totalProjectsCancelled: 0,
      totalDisputesLost: 0,
      totalLateProjects: 0,
    };

    await userRepo.insert(adminUser);
    log('✅ Admin account created successfully!\n', colors.green);

    // 6. Display credentials (CHỈ HIỆN 1 LẦN)
    logBox([
      '🔑 ADMIN CREDENTIALS (SAVE THIS!)',
      '──────────────────────────────────',
      `Email:    ${ADMIN_EMAIL}`,
      `Password: ${plainPassword}`,
      '──────────────────────────────────',
      '⚠️  This password is shown ONCE only!',
      '⚠️  Remove ADMIN_SEED_SECRET from .env',
    ]);

    log('\n💡 You can now login via web with these credentials\n', colors.cyan);

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    log(`\n❌ ERROR: ${(error as Error).message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run
seedAdmin();
