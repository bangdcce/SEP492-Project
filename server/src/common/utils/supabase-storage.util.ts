import { getKycBucket, supabaseClient } from '../../config/supabase.config';
import { encryptFile, decryptFile } from './encryption.util';
import { addWatermark, WatermarkOptions } from './watermark.util';
import * as path from 'path';

/**
 * Supabase Storage utility for KYC documents
 * All files are encrypted before upload
 */

export interface UploadResult {
  path: string;
  publicUrl: string;
  signedUrl: string;
}

/**
 * Upload encrypted file to Supabase Storage
 * @param fileBuffer - File buffer to encrypt and upload
 * @param userId - User ID for folder organization
 * @param fileType - Type of document (e.g., 'id-front', 'id-back', 'selfie')
 * @param mimeType - MIME type of the file
 * @returns Storage path (string)
 */
export const uploadEncryptedFile = async (
  fileBuffer: Buffer,
  userId: string,
  fileType: string,
  mimeType: string,
): Promise<string> => {
  try {
    // Encrypt file buffer
    const encryptedBuffer = encryptFile(fileBuffer);
    
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? '.jpg' : '.png';
    const filename = `${fileType}-${timestamp}${ext}.encrypted`;
    
    // Storage path: kyc/{userId}/{filename}
    const storagePath = `kyc/${userId}/${filename}`;
    
    // Upload to Supabase
    const bucket = getKycBucket();
    console.log('[Supabase] Uploading to:', storagePath);
    console.log('[Supabase] Buffer size:', encryptedBuffer.length);
    
    const { data, error } = await bucket.upload(storagePath, encryptedBuffer, {
      contentType: 'application/octet-stream', // Binary encrypted data
      cacheControl: '3600',
      upsert: false, // Don't overwrite if exists
    });
    
    console.log('[Supabase] Upload result:', { data, error });
    
    if (error) {
      console.error('[Supabase] Upload error details:', JSON.stringify(error, null, 2));
      throw new Error(`Supabase upload failed: ${error.message}`);
    }
    
    return storagePath;
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload encrypted file to storage');
  }
};

/**
 * Download and decrypt file from Supabase Storage
 * @param storagePath - Path in Supabase storage
 * @returns Decrypted file buffer
 */
export const downloadEncryptedFile = async (storagePath: string): Promise<Buffer> => {
  try {
    const bucket = getKycBucket();
    
    // Download file
    const { data, error } = await bucket.download(storagePath);
    
    if (error) {
      throw new Error(`Supabase download failed: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('No data returned from storage');
    }
    
    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    const encryptedBuffer = Buffer.from(arrayBuffer);
    
    // Decrypt file
    const decryptedBuffer = decryptFile(encryptedBuffer);
    
    return decryptedBuffer;
  } catch (error) {
    console.error('Download error:', error);
    throw new Error('Failed to download and decrypt file');
  }
};

/**
 * Download, decrypt, and add watermark to file (for admin/staff viewing)
 * CRITICAL: This creates forensic trail if document is leaked
 * @param storagePath - Path in Supabase storage
 * @param watermarkOptions - Reviewer info for watermark
 * @returns Watermarked file buffer
 */
export const downloadWithWatermark = async (
  storagePath: string,
  watermarkOptions: WatermarkOptions,
): Promise<Buffer> => {
  try {
    // Step 1: Download and decrypt
    const decryptedBuffer = await downloadEncryptedFile(storagePath);
    
    // Step 2: Add forensic watermark
    const watermarkedBuffer = await addWatermark(decryptedBuffer, watermarkOptions);
    
    return watermarkedBuffer;
  } catch (error) {
    console.error('Download with watermark error:', error);
    throw new Error('Failed to create watermarked document');
  }
};

/**
 * Generate a new signed URL for existing file
 * @param storagePath - Path in Supabase storage
 * @param expiresIn - Expiry time in seconds (default 1 hour)
 * @returns Signed URL
 */
export const getSignedUrl = async (
  storagePath: string,
  expiresIn: number = 3600,
): Promise<string> => {
  if (!storagePath) {
    return '';
  }

  try {
    const bucket = getKycBucket();
    
    const { data, error } = await bucket.createSignedUrl(storagePath, expiresIn);
    
    if (error) {
      const message = (error.message || '').toLowerCase();
      if (message.includes('object not found') || message.includes('not found')) {
        console.warn(`[Supabase] Signed URL missing for ${storagePath}`);
        return '';
      }
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }
    
    return data?.signedUrl || '';
  } catch (error: any) {
    const message = (error?.message || '').toLowerCase();
    if (message.includes('object not found') || message.includes('not found')) {
      console.warn(`[Supabase] Signed URL missing for ${storagePath}`);
      return '';
    }
    console.error('Get signed URL error:', error);
    throw new Error('Failed to generate signed URL');
  }
};

/**
 * Delete file from Supabase Storage
 * @param storagePath - Path in Supabase storage
 */
export const deleteFile = async (storagePath: string): Promise<void> => {
  try {
    const bucket = getKycBucket();
    
    const { error } = await bucket.remove([storagePath]);
    
    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
  } catch (error) {
    console.error('Delete error:', error);
    throw new Error('Failed to delete file from storage');
  }
};

/**
 * List all files for a user
 * @param userId - User ID
 * @returns List of file paths
 */
export const listUserFiles = async (userId: string): Promise<string[]> => {
  try {
    const bucket = getKycBucket();
    
    const { data, error } = await bucket.list(`kyc/${userId}`);
    
    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
    
    return data.map(file => `kyc/${userId}/${file.name}`);
  } catch (error) {
    console.error('List files error:', error);
    throw new Error('Failed to list user files');
  }
};
