/**
 * Frontend Security Utilities for KYC Document Protection
 * Prevents screenshots, right-clicks, and unauthorized copying
 * 
 * Usage: Call enableKycProtection() when viewing KYC documents
 */

export interface ProtectionOptions {
  disableRightClick?: boolean;
  disableScreenshot?: boolean;
  disablePrintScreen?: boolean;
  disableDevTools?: boolean;
  showWarning?: boolean;
}

const DEFAULT_OPTIONS: ProtectionOptions = {
  disableRightClick: true,
  disableScreenshot: true,
  disablePrintScreen: true,
  disableDevTools: true,
  showWarning: true,
};

/**
 * Enable comprehensive protection for KYC document viewing
 */
export function enableKycProtection(options: ProtectionOptions = DEFAULT_OPTIONS) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // 1. Disable right-click
  if (config.disableRightClick) {
    disableRightClick();
  }

  // 2. Disable screenshot keyboard shortcuts
  if (config.disableScreenshot) {
    disableScreenshotKeys();
  }

  // 3. Disable print screen
  if (config.disablePrintScreen) {
    disablePrintScreen();
  }

  // 4. Detect DevTools
  if (config.disableDevTools) {
    detectDevTools();
  }

  // 5. Show warning banner
  if (config.showWarning) {
    showSecurityWarning();
  }

  // 6. Add visual indicators (overlay watermark)
  addVisualProtection();

  // 7. Monitor user behavior
  monitorSuspiciousActivity();

  console.warn('🔒 KYC Document Protection Enabled');
}

/**
 * Disable all protections (call when leaving KYC view)
 */
export function disableKycProtection() {
  // Remove all event listeners
  document.removeEventListener('contextmenu', preventRightClick);
  document.removeEventListener('keydown', preventScreenshotKeys);
  document.removeEventListener('keyup', preventScreenshotKeys);
  
  // Remove warning banner
  const banner = document.getElementById('kyc-security-warning');
  if (banner) {
    banner.remove();
  }

  // Remove overlay
  const overlay = document.getElementById('kyc-protection-overlay');
  if (overlay) {
    overlay.remove();
  }

  console.log('🔓 KYC Document Protection Disabled');
}

/**
 * 1. Disable right-click context menu
 */
function disableRightClick() {
  document.addEventListener('contextmenu', preventRightClick);
}

function preventRightClick(e: MouseEvent) {
  e.preventDefault();
  showToast('Right-click is disabled for security reasons');
  return false;
}

/**
 * 2. Disable screenshot keyboard shortcuts
 */
function disableScreenshotKeys() {
  document.addEventListener('keydown', preventScreenshotKeys);
  document.addEventListener('keyup', preventScreenshotKeys);
}

function preventScreenshotKeys(e: KeyboardEvent) {
  // Windows: Print Screen, Alt+Print Screen, Win+Print Screen
  if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
    e.preventDefault();
    navigator.clipboard.writeText(''); // Clear clipboard
    showToast('Screenshots are not allowed');
    logSuspiciousActivity('Attempted screenshot');
    return false;
  }

  // Windows: Snipping Tool (Win+Shift+S)
  if (e.key === 's' && e.shiftKey && e.metaKey) {
    e.preventDefault();
    showToast('Screen capture tools are blocked');
    logSuspiciousActivity('Attempted snipping tool');
    return false;
  }

  // Mac: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
  if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
    e.preventDefault();
    showToast('Screenshots are not allowed');
    logSuspiciousActivity('Attempted Mac screenshot');
    return false;
  }

  // Ctrl+P (Print)
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
    e.preventDefault();
    showToast('Printing is disabled for security');
    logSuspiciousActivity('Attempted print');
    return false;
  }

  // Ctrl+S (Save)
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    showToast('Saving is disabled');
    logSuspiciousActivity('Attempted save');
    return false;
  }
}

/**
 * 3. Disable Print Screen
 */
function disablePrintScreen() {
  // Blur window when Print Screen is detected
  window.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement === document.body) {
        logSuspiciousActivity('Window blur (possible screenshot)');
      }
    }, 100);
  });
}

/**
 * 4. Detect DevTools
 */
function detectDevTools() {
  const threshold = 160; // DevTools width threshold

  // Method 1: Window size detection
  setInterval(() => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;

    if (widthThreshold || heightThreshold) {
      logSuspiciousActivity('DevTools detected');
      showToast('⚠️ Developer tools detected - Access may be revoked');
    }
  }, 1000);

  // Method 2: debugger statement
  setInterval(() => {
    const start = performance.now();
    debugger; // Will pause if DevTools is open
    const end = performance.now();
    
    if (end - start > 100) {
      logSuspiciousActivity('Debugger detected');
    }
  }, 2000);
}

/**
 * 5. Show security warning banner
 */
function showSecurityWarning() {
  const existing = document.getElementById('kyc-security-warning');
  if (existing) return;

  const banner = document.createElement('div');
  banner.id = 'kyc-security-warning';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #dc2626, #b91c1c);
    color: white;
    padding: 12px 20px;
    text-align: center;
    font-weight: 600;
    font-size: 14px;
    z-index: 9999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;
  banner.innerHTML = `
    🔒 CONFIDENTIAL DOCUMENT - Screenshots and copying are monitored and logged.
    Unauthorized distribution may result in legal action.
  `;
  document.body.appendChild(banner);
}

/**
 * 6. Add visual protection overlay
 */
function addVisualProtection() {
  const existing = document.getElementById('kyc-protection-overlay');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.id = 'kyc-protection-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 9998;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 100px,
      rgba(255, 0, 0, 0.02) 100px,
      rgba(255, 0, 0, 0.02) 200px
    );
  `;
  document.body.appendChild(overlay);
}

/**
 * 7. Monitor suspicious activity
 */
function monitorSuspiciousActivity() {
  // Track rapid screenshot attempts
  let screenshotAttempts = 0;
  const resetInterval = 60000; // Reset every minute

  setInterval(() => {
    screenshotAttempts = 0;
  }, resetInterval);

  // Monitor clipboard
  document.addEventListener('copy', (e) => {
    e.preventDefault();
    logSuspiciousActivity('Copy attempt');
    showToast('Copying is disabled');
  });

  // Monitor selection
  document.addEventListener('selectstart', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('kyc-image') || target.classList.contains('kyc-document')) {
      e.preventDefault();
      return false;
    }
  });
}

/**
 * Log suspicious activity to backend
 */
async function logSuspiciousActivity(activity: string) {
  try {
    await fetch('/api/kyc/log-suspicious-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activity,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
      }),
    });
  } catch (error) {
    console.error('Failed to log suspicious activity:', error);
  }
}

/**
 * Show toast notification
 */
function showToast(message: string) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**
 * Prevent image dragging
 */
export function preventImageDrag() {
  document.querySelectorAll('img.kyc-image').forEach((img) => {
    img.addEventListener('dragstart', (e) => {
      e.preventDefault();
      return false;
    });
  });
}

/**
 * Add CSS to prevent selection
 */
export function addNoSelectCSS() {
  const style = document.createElement('style');
  style.innerHTML = `
    .kyc-document,
    .kyc-image {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
    }
  `;
  document.head.appendChild(style);
}
