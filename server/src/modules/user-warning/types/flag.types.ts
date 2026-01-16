/**
 * User Warning/Flag Types
 * Định nghĩa các loại cảnh báo cho hệ thống
 */

// Re-export FlagStatus from entity to avoid duplication
export { FlagStatus } from 'src/database/entities';

export enum UserFlagType {
  // Dispute-related flags
  HIGH_DISPUTE_RATE = 'HIGH_DISPUTE_RATE', // Tỷ lệ thua dispute cao
  MULTIPLE_DISPUTES_LOST = 'MULTIPLE_DISPUTES_LOST', // Thua nhiều dispute
  DISPUTE_FRAUD = 'DISPUTE_FRAUD', // Thua dispute vì gian lận
  REPEAT_OFFENDER = 'REPEAT_OFFENDER', // Vi phạm nhiều lần

  // Review-related flags
  SUSPICIOUS_REVIEW = 'SUSPICIOUS_REVIEW', // Review đáng ngờ
  FAKE_REVIEW_DETECTED = 'FAKE_REVIEW_DETECTED', // Phát hiện review giả
  REVIEW_MANIPULATION = 'REVIEW_MANIPULATION', // Thao túng review

  // Behavior-related flags
  COLLUSION_RISK = 'COLLUSION_RISK', // Nguy cơ thông đồng
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY', // Hoạt động đáng ngờ
  PAYMENT_ISSUE = 'PAYMENT_ISSUE', // Vấn đề thanh toán

  // Performance flags
  HIGH_CANCELLATION_RATE = 'HIGH_CANCELLATION_RATE', // Tỷ lệ hủy dự án cao
  CHRONIC_LATE_DELIVERY = 'CHRONIC_LATE_DELIVERY', // Thường xuyên trễ deadline

  // Admin flags
  MANUAL_WARNING = 'MANUAL_WARNING', // Admin cảnh báo thủ công
  UNDER_INVESTIGATION = 'UNDER_INVESTIGATION', // Đang điều tra
  TEMPORARY_RESTRICTION = 'TEMPORARY_RESTRICTION', // Hạn chế tạm thời
}

/**
 * Flag severity levels
 */
export enum FlagSeverity {
  LOW = 1, // Nhẹ - chỉ ghi nhận
  MEDIUM = 2, // Trung bình - hiển thị cảnh báo
  HIGH = 3, // Cao - hạn chế một số tính năng
  CRITICAL = 4, // Nghiêm trọng - hạn chế nhiều tính năng
  SEVERE = 5, // Rất nghiêm trọng - có thể ban
}

// FlagStatus is imported from entity above, no need to redefine

/**
 * Thresholds for automatic flag creation
 */
export const FLAG_THRESHOLDS = {
  // Số lần thua dispute để trigger warning
  DISPUTES_LOST_WARNING: 2, // >=2 lần thua → warning
  DISPUTES_LOST_SEVERE: 4, // >=4 lần thua → severe

  // Tỷ lệ thua dispute
  DISPUTE_LOSS_RATE_WARNING: 0.5, // 50% thua → warning (tối thiểu 2 disputes)

  // Số dự án hủy
  CANCELLATION_WARNING: 3, // >=3 dự án hủy
  CANCELLATION_RATE_WARNING: 0.3, // 30% hủy

  // Số lần trễ deadline
  LATE_DELIVERY_WARNING: 3, // >=3 lần trễ

  // Trust score thấp
  LOW_TRUST_SCORE: 2.5, // Điểm < 2.5 → cảnh báo
};

/**
 * Configuration for each flag type
 */
export const FLAG_CONFIG: Record<
  UserFlagType,
  {
    defaultSeverity: FlagSeverity;
    autoExpireDays?: number; // Số ngày tự động hết hạn (null = không hết hạn)
    canAppeal: boolean; // Có thể khiếu nại không
    requiresReview: boolean; // Cần admin review không
  }
> = {
  [UserFlagType.HIGH_DISPUTE_RATE]: {
    defaultSeverity: FlagSeverity.HIGH,
    autoExpireDays: 180,
    canAppeal: true,
    requiresReview: false,
  },
  [UserFlagType.MULTIPLE_DISPUTES_LOST]: {
    defaultSeverity: FlagSeverity.MEDIUM,
    autoExpireDays: 90,
    canAppeal: true,
    requiresReview: false,
  },
  [UserFlagType.DISPUTE_FRAUD]: {
    defaultSeverity: FlagSeverity.SEVERE,
    autoExpireDays: undefined, // Không hết hạn
    canAppeal: true,
    requiresReview: true,
  },
  [UserFlagType.REPEAT_OFFENDER]: {
    defaultSeverity: FlagSeverity.CRITICAL,
    autoExpireDays: 365,
    canAppeal: true,
    requiresReview: true,
  },
  [UserFlagType.SUSPICIOUS_REVIEW]: {
    defaultSeverity: FlagSeverity.LOW,
    autoExpireDays: 60,
    canAppeal: true,
    requiresReview: true,
  },
  [UserFlagType.FAKE_REVIEW_DETECTED]: {
    defaultSeverity: FlagSeverity.HIGH,
    autoExpireDays: 180,
    canAppeal: true,
    requiresReview: true,
  },
  [UserFlagType.REVIEW_MANIPULATION]: {
    defaultSeverity: FlagSeverity.CRITICAL,
    autoExpireDays: 365,
    canAppeal: true,
    requiresReview: true,
  },
  [UserFlagType.COLLUSION_RISK]: {
    defaultSeverity: FlagSeverity.HIGH,
    autoExpireDays: undefined,
    canAppeal: true,
    requiresReview: true,
  },
  [UserFlagType.SUSPICIOUS_ACTIVITY]: {
    defaultSeverity: FlagSeverity.MEDIUM,
    autoExpireDays: 30,
    canAppeal: true,
    requiresReview: true,
  },
  [UserFlagType.PAYMENT_ISSUE]: {
    defaultSeverity: FlagSeverity.HIGH,
    autoExpireDays: undefined,
    canAppeal: true,
    requiresReview: true,
  },
  [UserFlagType.HIGH_CANCELLATION_RATE]: {
    defaultSeverity: FlagSeverity.MEDIUM,
    autoExpireDays: 90,
    canAppeal: true,
    requiresReview: false,
  },
  [UserFlagType.CHRONIC_LATE_DELIVERY]: {
    defaultSeverity: FlagSeverity.LOW,
    autoExpireDays: 60,
    canAppeal: true,
    requiresReview: false,
  },
  [UserFlagType.MANUAL_WARNING]: {
    defaultSeverity: FlagSeverity.MEDIUM,
    autoExpireDays: 90,
    canAppeal: true,
    requiresReview: false,
  },
  [UserFlagType.UNDER_INVESTIGATION]: {
    defaultSeverity: FlagSeverity.HIGH,
    autoExpireDays: undefined,
    canAppeal: false,
    requiresReview: true,
  },
  [UserFlagType.TEMPORARY_RESTRICTION]: {
    defaultSeverity: FlagSeverity.CRITICAL,
    autoExpireDays: 30,
    canAppeal: true,
    requiresReview: true,
  },
};
