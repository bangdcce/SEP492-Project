import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceService } from './evidence.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DisputeEvidenceEntity, DisputeEntity } from 'src/database/entities';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';

// Mock các dependencies (phụ thuộc) để test cô lập service
const mockEvidenceRepo = {};
const mockDisputeRepo = {};
const mockCacheManager = {};
const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'SUPABASE_URL') return 'https://mock.supabase.co';
    if (key === 'SUPABASE_SERVICE_KEY') return 'mock-key';
    return null;
  }),
};
const mockDataSource = {}; // Simple mock for DataSource
const mockEventEmitter = { emit: jest.fn() };

describe('EvidenceService - Unit Tests', () => {
  let service: EvidenceService;

  beforeEach(async () => {
    // Tạo môi trường test giả lập (Testing Module)
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService, // Service cần test
        { provide: getRepositoryToken(DisputeEvidenceEntity), useValue: mockEvidenceRepo },
        { provide: getRepositoryToken(DisputeEntity), useValue: mockDisputeRepo },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<EvidenceService>(EvidenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ===========================================================================
  // TEST HÀM DỄ NHẤT: validateFileUpload
  // Hàm này chỉ chạy logic if/else, không gọi database -> Dễ test nhất
  // ===========================================================================
  describe('validateFileUpload', () => {
    it('should return VALID for a correct image file', () => {
      // 1. Chuẩn bị input (Arrange)
      const fileName = 'proof.png';
      const fileSize = 1024 * 1024; // 1MB
      const mimeType = 'image/png';

      // 2. Gọi hàm (Act)
      const result = service.validateFileUpload(fileName, fileSize, mimeType);

      // 3. Kiểm tra kết quả (Assert)
      expect(result.isValid).toBe(true);
      expect(result.sanitizedFileName).toBe('proof.png');
      expect(result.error).toBeUndefined();
    });

    it('should return INVALID if file type is not allowed', () => {
      // Input: File .exe (không cho phép)
      const result = service.validateFileUpload('virus.exe', 1000, 'application/x-msdownload');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should return INVALID if file size is too big', () => {
      // Input: File ảnh 20MB (Limit của png là 10MB)
      const hugeSize = 20 * 1024 * 1024;
      const result = service.validateFileUpload('big.png', hugeSize, 'image/png');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds limit');
    });

    it('should return INVALID if extension does not match mime type', () => {
      // Input: Tên là .jpg nhưng mime lại là application/pdf -> Đáng ngờ
      const result = service.validateFileUpload('document.jpg', 1000, 'application/pdf');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('extension does not match');
    });

    it('should sanitize dangerous filenames', () => {
      // Input: Tên file chứa ký tự đặc biệt
      const dangerousName = 'report<script>.pdf';

      const result = service.validateFileUpload(dangerousName, 1000, 'application/pdf');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedFileName).toBe('report_script_.pdf'); // Dấu < > bị thay bằng _
    });
  });
});
