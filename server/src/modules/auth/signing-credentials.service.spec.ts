import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { UserSigningCredentialEntity } from '../../database/entities/user-signing-credential.entity';
import { SigningCredentialsService } from './signing-credentials.service';

const createCredentialTemplate = (
  userId: string,
  overrides: Partial<UserSigningCredentialEntity> = {},
): UserSigningCredentialEntity => ({
  id: 'cred-1',
  userId,
  publicKeyPem: 'placeholder-public-key',
  encryptedPrivateKeyPem: 'placeholder-encrypted-private-key',
  encryptionSalt: '11'.repeat(16),
  encryptionIv: '22'.repeat(12),
  encryptionAuthTag: '33'.repeat(16),
  kdfIterations: 210000,
  keyAlgorithm: 'RSA-2048',
  keyFingerprint: 'f'.repeat(64),
  failedPinAttempts: 0,
  lockedUntil: null,
  keyVersion: 1,
  rotatedAt: null,
  createdAt: new Date('2026-04-01T00:00:00.000Z'),
  updatedAt: new Date('2026-04-01T00:00:00.000Z'),
  user: undefined as any,
  ...overrides,
});

const createSigningCredentialRepositoryMock = () => {
  let record: UserSigningCredentialEntity | null = null;

  return {
    findOne: jest.fn(
      async (options?: {
        where?: { userId?: string };
        select?: Array<keyof UserSigningCredentialEntity>;
      }) => {
        const userId = options?.where?.userId;
        if (!record || (userId && record.userId !== userId)) {
          return null;
        }

        if (Array.isArray(options?.select) && options.select.length > 0) {
          const selected = {} as Partial<UserSigningCredentialEntity>;
          options.select.forEach((field) => {
            selected[field] = record?.[field] as never;
          });
          return selected;
        }

        return { ...record };
      },
    ),
    create: jest.fn((input: Partial<UserSigningCredentialEntity>) => ({
      ...input,
    })),
    save: jest.fn(async (input: Partial<UserSigningCredentialEntity>) => {
      const now = new Date();
      const nextRecord = {
        ...(record || {}),
        ...input,
      } as UserSigningCredentialEntity;

      nextRecord.id = nextRecord.id || 'cred-1';
      nextRecord.createdAt = nextRecord.createdAt || now;
      nextRecord.updatedAt = now;

      record = nextRecord;
      return { ...nextRecord };
    }),
    __setRecord: (nextRecord: UserSigningCredentialEntity | null) => {
      record = nextRecord ? { ...nextRecord } : null;
    },
    __getRecord: () => {
      return record ? { ...record } : null;
    },
  };
};

describe('SigningCredentialsService', () => {
  const userId = 'user-1';

  let service: SigningCredentialsService;
  let repository: ReturnType<typeof createSigningCredentialRepositoryMock>;

  beforeEach(() => {
    repository = createSigningCredentialRepositoryMock();
    service = new SigningCredentialsService(repository as any);
  });

  it('returns uninitialized status when the user has no signing credential', async () => {
    await expect(service.getCredentialStatus(userId)).resolves.toEqual({
      initialized: false,
    });
  });

  it('initializes a Mini CA credential and signs a content hash with the same PIN', async () => {
    const status = await service.initializeCredential(userId, '123456');
    expect(status).toMatchObject({
      initialized: true,
      keyAlgorithm: 'RSA-2048',
      keyVersion: 1,
    });

    const signatureProof = await service.signContentHash(userId, '123456', 'contract-content-hash');

    expect(signatureProof).toMatchObject({
      signatureAlgorithm: 'RSA-SHA256',
      keyVersion: 1,
      keyFingerprint: expect.any(String),
      signatureBase64: expect.any(String),
    });
    expect(signatureProof.signatureBase64.length).toBeGreaterThan(32);
    expect(signatureProof.certificateSerial).toBe(
      `INTERDEV-MCA-1-${signatureProof.keyFingerprint.slice(0, 16).toUpperCase()}`,
    );
  });

  it('rejects invalid PIN format during initialization', async () => {
    await expect(service.initializeCredential(userId, '12ab')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects initialization when signing credential already exists', async () => {
    repository.__setRecord(createCredentialTemplate(userId));

    await expect(service.initializeCredential(userId, '123456')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('locks signing PIN after repeated wrong attempts during key rotation', async () => {
    await service.initializeCredential(userId, '123456');

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(service.rotateCredential(userId, '999999', '654321')).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      const record = repository.__getRecord();
      expect(record?.failedPinAttempts).toBe(attempt);
      expect(record?.lockedUntil).toBeNull();
    }

    await expect(service.rotateCredential(userId, '999999', '654321')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const lockedRecord = repository.__getRecord();
    expect(lockedRecord?.failedPinAttempts).toBe(0);
    expect(lockedRecord?.lockedUntil).toBeInstanceOf(Date);

    await expect(
      service.signContentHash(userId, '123456', 'contract-content-hash'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('clears expired lock and failed attempts before signing', async () => {
    await service.initializeCredential(userId, '123456');
    const current = repository.__getRecord();
    repository.__setRecord(
      createCredentialTemplate(userId, {
        ...current,
        lockedUntil: new Date(Date.now() - 1000),
        failedPinAttempts: 3,
      }),
    );

    await expect(
      service.signContentHash(userId, '123456', 'expired-lock-content-hash'),
    ).resolves.toMatchObject({
      signatureAlgorithm: 'RSA-SHA256',
    });

    const updated = repository.__getRecord();
    expect(updated?.failedPinAttempts).toBe(0);
    expect(updated?.lockedUntil).toBeNull();
  });

  it('rotates keypair and requires the new PIN for subsequent signatures', async () => {
    await service.initializeCredential(userId, '123456');

    const statusAfterRotate = await service.rotateCredential(userId, '123456', '654321', 2048);
    expect(statusAfterRotate).toMatchObject({
      initialized: true,
      keyVersion: 2,
      keyAlgorithm: 'RSA-2048',
    });

    await expect(
      service.signContentHash(userId, '654321', 'post-rotation-content-hash'),
    ).resolves.toMatchObject({
      keyVersion: 2,
      signatureAlgorithm: 'RSA-SHA256',
    });

    await expect(
      service.signContentHash(userId, '123456', 'post-rotation-content-hash'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
