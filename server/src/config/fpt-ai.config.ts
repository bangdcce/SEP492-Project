/**
 * FPT.AI eKYC Configuration
 * Docs: https://ekyc-v3.fpt.ai/documentation/
 */

export const fptAiConfig = {
  // Get from console.fpt.ai
  apiKey: process.env.FPT_AI_API_KEY || '',
  apiUrl: process.env.FPT_AI_API_URL || 'https://api.fpt.ai/vision/idr/vnm',
  
  // Additional endpoints
  faceCompareUrl: 'https://api.fpt.ai/vision/face/compare',
  
  // Confidence thresholds
  autoApproveThreshold: parseFloat(process.env.FPT_AI_AUTO_APPROVE_THRESHOLD || '0.95'), // 95%
  adminReviewThreshold: parseFloat(process.env.FPT_AI_ADMIN_REVIEW_THRESHOLD || '0.70'), // 70%
  
  // Enable/disable AI verification
  enabled: process.env.FPT_AI_ENABLED === 'true',
};

export const validateFptAiConfig = () => {
  if (fptAiConfig.enabled && !fptAiConfig.apiKey) {
    console.warn('⚠️  FPT.AI is enabled but API key is not set!');
    return false;
  }
  return true;
};
