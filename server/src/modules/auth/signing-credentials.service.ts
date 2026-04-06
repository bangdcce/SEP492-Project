import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createSign,
  createVerify,
  generateKeyPairSync,
  pbkdf2Sync,
  randomBytes,
} from 'crypto';
import { Repository } from 'typeorm';
import { UserSigningCredentialEntity } from '../../database/entities/user-signing-credential.entity';

const SIGNING_PIN_REGEX = /^\d{4,8}$/;
const DEFAULT_KDF_ITERATIONS = 210000;
const DEFAULT_RSA_MODULUS_LENGTH = 2048;
const SUPPORTED_RSA_MODULUS_LENGTHS = new Set([2048, 4096]);
const MAX_FAILED_PIN_ATTEMPTS = 5;
const PIN_LOCK_WINDOW_MINUTES = 15;

@Injectable()
export class SigningCredentialsService {
  constructor(
    @InjectRepository(UserSigningCredentialEntity)
    private readonly signingCredentialsRepository: Repository<UserSigningCredentialEntity>,
  ) {}

  async getCredentialStatus(userId: string) {
    const credential = await this.signingCredentialsRepository.findOne({
      where: { userId },
      select: [
        'id',
        'keyFingerprint',
        'keyAlgorithm',
        'keyVersion',
        'lockedUntil',
        'rotatedAt',
        'createdAt',
      ],
    });

    if (!credential) {
      return {
        initialized: false,
      };
    }

    return {
      initialized: true,
      keyFingerprint: credential.keyFingerprint,
      keyAlgorithm: credential.keyAlgorithm,
      keyVersion: credential.keyVersion,
      lockedUntil: credential.lockedUntil,
      rotatedAt: credential.rotatedAt,
      createdAt: credential.createdAt,
    };
  }

  async initializeCredential(userId: string, pin: string, modulusLength?: number) {
    this.assertValidPin(pin);

    const existing = await this.signingCredentialsRepository.findOne({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException(
        'Signing credential already initialized. Rotate the key if you need to replace it.',
      );
    }

    const normalizedModulusLength = this.normalizeModulusLength(modulusLength);
    const generated = this.generateAndEncryptKeypair(pin, normalizedModulusLength);

    const credential = this.signingCredentialsRepository.create({
      userId,
      publicKeyPem: generated.publicKeyPem,
      encryptedPrivateKeyPem: generated.encryptedPrivateKeyPem,
      encryptionSalt: generated.encryptionSalt,
      encryptionIv: generated.encryptionIv,
      encryptionAuthTag: generated.encryptionAuthTag,
      kdfIterations: DEFAULT_KDF_ITERATIONS,
      keyAlgorithm: `RSA-${normalizedModulusLength}`,
      keyFingerprint: generated.keyFingerprint,
      failedPinAttempts: 0,
      lockedUntil: null,
      keyVersion: 1,
      rotatedAt: null,
    });

    await this.signingCredentialsRepository.save(credential);
    return this.getCredentialStatus(userId);
  }

  async rotateCredential(userId: string, oldPin: string, newPin: string, modulusLength?: number) {
    this.assertValidPin(oldPin);
    this.assertValidPin(newPin);

    const credential = await this.signingCredentialsRepository.findOne({
      where: { userId },
    });

    if (!credential) {
      throw new NotFoundException('Signing credential is not initialized for this account.');
    }

    await this.assertPinNotLocked(credential);

    try {
      this.decryptPrivateKeyPem(credential, oldPin);
    } catch {
      await this.registerFailedPinAttempt(credential);
      throw new ForbiddenException('Current signing PIN is incorrect.');
    }

    const normalizedModulusLength = this.normalizeModulusLength(modulusLength);
    const rotated = this.generateAndEncryptKeypair(newPin, normalizedModulusLength);

    credential.publicKeyPem = rotated.publicKeyPem;
    credential.encryptedPrivateKeyPem = rotated.encryptedPrivateKeyPem;
    credential.encryptionSalt = rotated.encryptionSalt;
    credential.encryptionIv = rotated.encryptionIv;
    credential.encryptionAuthTag = rotated.encryptionAuthTag;
    credential.kdfIterations = DEFAULT_KDF_ITERATIONS;
    credential.keyAlgorithm = `RSA-${normalizedModulusLength}`;
    credential.keyFingerprint = rotated.keyFingerprint;
    credential.failedPinAttempts = 0;
    credential.lockedUntil = null;
    credential.keyVersion = (credential.keyVersion || 0) + 1;
    credential.rotatedAt = new Date();

    await this.signingCredentialsRepository.save(credential);
    return this.getCredentialStatus(userId);
  }

  async signContentHash(
    userId: string,
    pin: string,
    contentHash: string,
  ): Promise<{
    signatureBase64: string;
    signatureAlgorithm: string;
    keyFingerprint: string;
    keyVersion: number;
    certificateSerial: string;
  }> {
    this.assertValidPin(pin);

    const normalizedContentHash = contentHash?.trim();
    if (!normalizedContentHash) {
      throw new BadRequestException('contentHash is required for signing.');
    }

    const credential = await this.signingCredentialsRepository.findOne({
      where: { userId },
    });

    if (!credential) {
      throw new BadRequestException(
        'Mini CA signing key is not initialized. Please configure signing security in your profile first.',
      );
    }

    await this.assertPinNotLocked(credential);

    let privateKeyPem: string;
    try {
      privateKeyPem = this.decryptPrivateKeyPem(credential, pin);
    } catch {
      await this.registerFailedPinAttempt(credential);
      throw new ForbiddenException('Signing PIN is incorrect.');
    }

    const signer = createSign('RSA-SHA256');
    signer.update(normalizedContentHash);
    signer.end();
    const signatureBase64 = signer.sign(privateKeyPem, 'base64');

    const verifier = createVerify('RSA-SHA256');
    verifier.update(normalizedContentHash);
    verifier.end();
    const verified = verifier.verify(credential.publicKeyPem, signatureBase64, 'base64');
    if (!verified) {
      throw new ForbiddenException('Mini CA signature verification failed.');
    }

    if (credential.failedPinAttempts > 0 || credential.lockedUntil) {
      credential.failedPinAttempts = 0;
      credential.lockedUntil = null;
      await this.signingCredentialsRepository.save(credential);
    }

    const certificateSerial = `INTERDEV-MCA-${credential.keyVersion}-${credential.keyFingerprint
      .slice(0, 16)
      .toUpperCase()}`;

    return {
      signatureBase64,
      signatureAlgorithm: 'RSA-SHA256',
      keyFingerprint: credential.keyFingerprint,
      keyVersion: credential.keyVersion,
      certificateSerial,
    };
  }

  private assertValidPin(pin: string) {
    if (!SIGNING_PIN_REGEX.test(pin || '')) {
      throw new BadRequestException('Signing PIN must be 4 to 8 numeric digits.');
    }
  }

  private normalizeModulusLength(modulusLength?: number): number {
    if (!modulusLength) {
      return DEFAULT_RSA_MODULUS_LENGTH;
    }
    if (!SUPPORTED_RSA_MODULUS_LENGTHS.has(modulusLength)) {
      throw new BadRequestException('Only RSA modulus lengths 2048 or 4096 are supported.');
    }
    return modulusLength;
  }

  private getPinPepper(): string {
    // Uses a dedicated pepper when available; falls back to existing server secret for local/dev continuity.
    return (
      process.env.MINI_CA_PIN_PEPPER?.trim() ||
      process.env.KYC_ENCRYPTION_KEY?.trim() ||
      'interdev-mini-ca-dev-only-change-me'
    );
  }

  private deriveAesKey(pin: string, saltHex: string, iterations: number): Buffer {
    return pbkdf2Sync(
      `${pin}:${this.getPinPepper()}`,
      Buffer.from(saltHex, 'hex'),
      iterations,
      32,
      'sha512',
    );
  }

  private generateAndEncryptKeypair(pin: string, modulusLength: number) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const encryptionSalt = randomBytes(16).toString('hex');
    const encryptionIv = randomBytes(12).toString('hex');
    const aesKey = this.deriveAesKey(pin, encryptionSalt, DEFAULT_KDF_ITERATIONS);
    const cipher = createCipheriv('aes-256-gcm', aesKey, Buffer.from(encryptionIv, 'hex'));
    const encryptedBuffer = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
    const encryptionAuthTag = cipher.getAuthTag().toString('hex');

    return {
      publicKeyPem: publicKey,
      encryptedPrivateKeyPem: encryptedBuffer.toString('base64'),
      encryptionSalt,
      encryptionIv,
      encryptionAuthTag,
      keyFingerprint: createHash('sha256').update(publicKey).digest('hex'),
    };
  }

  private decryptPrivateKeyPem(credential: UserSigningCredentialEntity, pin: string): string {
    const aesKey = this.deriveAesKey(pin, credential.encryptionSalt, credential.kdfIterations);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      aesKey,
      Buffer.from(credential.encryptionIv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(credential.encryptionAuthTag, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(credential.encryptedPrivateKeyPem, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  private async assertPinNotLocked(credential: UserSigningCredentialEntity): Promise<void> {
    if (!credential.lockedUntil) {
      return;
    }

    if (credential.lockedUntil.getTime() <= Date.now()) {
      credential.lockedUntil = null;
      credential.failedPinAttempts = 0;
      await this.signingCredentialsRepository.save(credential);
      return;
    }

    throw new ForbiddenException(
      `Signing PIN is temporarily locked until ${credential.lockedUntil.toISOString()}.`,
    );
  }

  private async registerFailedPinAttempt(credential: UserSigningCredentialEntity): Promise<void> {
    const nextFailedAttemptCount = (credential.failedPinAttempts || 0) + 1;

    if (nextFailedAttemptCount >= MAX_FAILED_PIN_ATTEMPTS) {
      credential.failedPinAttempts = 0;
      credential.lockedUntil = new Date(Date.now() + PIN_LOCK_WINDOW_MINUTES * 60 * 1000);
    } else {
      credential.failedPinAttempts = nextFailedAttemptCount;
    }

    await this.signingCredentialsRepository.save(credential);
  }
}
