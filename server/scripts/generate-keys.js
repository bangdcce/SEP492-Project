/**
 * Generate encryption keys for KYC document security
 * Run: node scripts/generate-keys.js
 */

const crypto = require('crypto');

console.log('\n🔐 KYC Encryption Key Generator\n');
console.log('='.repeat(60));

// Generate KYC encryption key (32 bytes for AES-256)
const kycEncryptionKey = crypto.randomBytes(32).toString('base64');
console.log('\n📌 KYC_ENCRYPTION_KEY (AES-256):');
console.log(kycEncryptionKey);

// Generate document hash salt
const documentHashSalt = crypto.randomBytes(32).toString('base64');
console.log('\n📌 DOCUMENT_HASH_SALT:');
console.log(documentHashSalt);

// Generate JWT secret (optional)
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('\n📌 JWT_SECRET (optional):');
console.log(jwtSecret);

console.log('\n' + '='.repeat(60));
console.log('\n✅ Add these to your .env file:');
console.log('\nKYC_ENCRYPTION_KEY=' + kycEncryptionKey);
console.log('DOCUMENT_HASH_SALT=' + documentHashSalt);
console.log('JWT_SECRET=' + jwtSecret);

console.log('\n⚠️  IMPORTANT:');
console.log('- Keep these keys SECRET');
console.log('- Never commit to git');
console.log('- Use different keys for dev/staging/production');
console.log('- Rotate keys periodically\n');
