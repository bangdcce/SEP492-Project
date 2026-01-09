// src/database/transformers/column-numeric.transformer.ts

import { ValueTransformer } from 'typeorm';

/**
 * Transformer để chuyển đổi decimal từ PostgreSQL (string) sang number
 * PostgreSQL trả về decimal dưới dạng string để tránh mất precision
 */
export class ColumnNumericTransformer implements ValueTransformer {
  /**
   * Chuyển đổi từ JS sang DB
   */
  to(data: number | null | undefined): number | null {
    if (data === null || data === undefined) {
      return null;
    }
    return data;
  }

  /**
   * Chuyển đổi từ DB sang JS
   */
  from(data: string | null | undefined): number | null {
    if (data === null || data === undefined) {
      return null;
    }
    const parsed = parseFloat(data);
    return isNaN(parsed) ? null : parsed;
  }
}

/**
 * Shared instance để tránh tạo nhiều object
 * Sử dụng: transformer: numericTransformer
 */
export const numericTransformer: ValueTransformer = new ColumnNumericTransformer();
