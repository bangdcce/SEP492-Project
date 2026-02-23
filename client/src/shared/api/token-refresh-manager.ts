/**
 * Token Refresh Manager
 * 
 * Proactively refreshes access tokens before they expire to prevent
 * session interruptions during user activity (e.g., filling forms).
 * 
 * Features:
 * - Background refresh timer
 * - User activity detection
 * - Idle state handling
 * - Single-instance across tabs (using localStorage events)
 */

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes (access token expires in 15min)
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity = idle
const MIN_TIME_SINCE_START = 2 * 60 * 1000; // Wait at least 2 minutes after login before first refresh
const STORAGE_KEY = 'last_token_refresh';
const START_TIME_KEY = 'token_refresh_start_time';

export class TokenRefreshManager {
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private lastActivityTime: number = Date.now();
  private activityListeners: (() => void)[] = [];
  private isActive = false;
  private refreshCallback: (() => Promise<void>) | null = null;

  /**
   * Start the token refresh manager
   * @param refreshCallback - Function to call when refresh is needed
   */
  public start(refreshCallback: () => Promise<void>): void {
    if (this.isActive) return;

    this.refreshCallback = refreshCallback;
    this.isActive = true;
    this.lastActivityTime = Date.now();

    // Mark start time to avoid refreshing too soon after login
    try {
      localStorage.setItem(START_TIME_KEY, Date.now().toString());
    } catch {
      // Ignore localStorage errors
    }

    // Setup activity tracking
    this.setupActivityTracking();

    // Start refresh timer
    this.startRefreshTimer();
  }

  /**
   * Stop the token refresh manager
   */
  public stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.stopRefreshTimer();
    this.removeActivityTracking();
  }

  /**
   * Check if user is currently idle
   */
  private isUserIdle(): boolean {
    const idleDuration = Date.now() - this.lastActivityTime;
    return idleDuration > IDLE_TIMEOUT;
  }

  /**
   * Check if it's too soon after starting (login) to refresh
   */
  private isTooSoonAfterStart(): boolean {
    try {
      const startTime = localStorage.getItem(START_TIME_KEY);
      if (!startTime) return false;

      const timeSinceStart = Date.now() - parseInt(startTime, 10);
      return timeSinceStart < MIN_TIME_SINCE_START;
    } catch {
      return false;
    }
  }

  /**
   * Setup user activity tracking
   */
  private setupActivityTracking(): void {
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

    const activityHandler = () => {
      this.lastActivityTime = Date.now();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, activityHandler, { passive: true });
      this.activityListeners.push(() =>
        window.removeEventListener(event, activityHandler)
      );
    });

    // Track visibility changes
    const visibilityHandler = () => {
      if (!document.hidden) {
        this.lastActivityTime = Date.now();
      }
    };

    document.addEventListener('visibilitychange', visibilityHandler);
    this.activityListeners.push(() =>
      document.removeEventListener('visibilitychange', visibilityHandler)
    );
  }

  /**
   * Remove activity tracking listeners
   */
  private removeActivityTracking(): void {
    this.activityListeners.forEach((removeListener) => removeListener());
    this.activityListeners = [];
  }

  /**
   * Start the periodic refresh timer
   */
  private startRefreshTimer(): void {
    this.refreshTimer = setInterval(async () => {
      if (!this.isActive || !this.refreshCallback) return;

      // Don't refresh too soon after login (cookies might not be fully set)
      if (this.isTooSoonAfterStart()) {
        return;
      }

      // Don't refresh if user is idle
      if (this.isUserIdle()) {
        return;
      }

      // Check if another tab already refreshed recently
      if (this.wasRecentlyRefreshedByAnotherTab()) {
        return;
      }

      try {
        await this.refreshCallback();
        this.markRefreshTime();
      } catch (error) {
        // Don't stop the timer, let the reactive 401 handler deal with it
      }
    }, REFRESH_INTERVAL);
  }

  /**
   * Stop the refresh timer
   */
  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Check if token was refreshed recently by another tab
   */
  private wasRecentlyRefreshedByAnotherTab(): boolean {
    try {
      const lastRefresh = localStorage.getItem(STORAGE_KEY);
      if (!lastRefresh) return false;

      const lastRefreshTime = parseInt(lastRefresh, 10);
      const timeSinceRefresh = Date.now() - lastRefreshTime;

      // If refreshed in the last 5 minutes, skip
      return timeSinceRefresh < 5 * 60 * 1000;
    } catch {
      return false;
    }
  }

  /**
   * Mark the current time as last refresh time
   */
  private markRefreshTime(): void {
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      // localStorage might be disabled
    }
  }
}

// Singleton instance
export const tokenRefreshManager = new TokenRefreshManager();
