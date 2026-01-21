import * as crypto from 'crypto';

/**
 * Encryption utility for sensitive files (KYC documents)
 * Uses AES-256-GCM encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

// Get encryption key from environment (should be 32 bytes for AES-256)
const getEncryptionKey = (): Buffer => {
  const key = process.env.KYC_ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('KYC_ENCRYPTION_KEY is not set in environment variables');
  }

  // Hash the key to ensure it's exactly 32 bytes
  return crypto.createHash('sha256').update(key).digest();
};

/**
 * Encrypt file buffer
 * @param buffer - File buffer to encrypt
 * @returns Encrypted buffer with IV and auth tag prepended
 */
export const encryptFile = (buffer: Buffer): Buffer => {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(buffer),
      cipher.final(),
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Format: [IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Data]
    return Buffer.concat([iv, authTag, encrypted]);
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt file');
  }
};

/**
 * Decrypt file buffer
 * @param encryptedBuffer - Encrypted buffer with IV and auth tag
 * @returns Decrypted buffer
 */
export const decryptFile = (encryptedBuffer: Buffer): Buffer => {
  try {
    const key = getEncryptionKey();
    
    // Extract IV, auth tag, and encrypted data
    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = encryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt file');
  }
};

/**
 * Generate a random encryption key (for initial setup)
 * Run this once and store in .env as KYC_ENCRYPTION_KEY
 */
export const generateEncryptionKey = (): string => {
  return crypto.randomBytes(32).toString('base64');
};

/**
 * Hash document number for indexing (one-way hash)
 * Use this for searching without storing plain text
 * Returns first 20 characters to fit VARCHAR(20) constraint
 */
export const hashDocumentNumber = (documentNumber: string): string => {
  const salt = process.env.DOCUMENT_HASH_SALT || 'default-salt-change-in-production';
  const fullHash = crypto
    .createHash('sha256')
    .update(documentNumber + salt)
    .digest('hex');
  
  // Truncate to 20 characters to fit database constraint
  return fullHash.substring(0, 20);
};
