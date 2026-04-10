/**
 * Format date to locale string
 */
export const formatDate = (
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  };

  return dateObj.toLocaleDateString("vi-VN", defaultOptions);
};

/**
 * Format date to time string
 */
export const formatTime = (date: string | Date): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Format currency
 */
export const formatCurrency = (
  amount: number,
  currency: string = "USD",
): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

/**
 * Format relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (date: string | Date): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  const intervals: Array<{ unit: string; secondsInUnit: number }> = [
    { unit: "year", secondsInUnit: 31536000 },
    { unit: "month", secondsInUnit: 2592000 },
    { unit: "week", secondsInUnit: 604800 },
    { unit: "day", secondsInUnit: 86400 },
    { unit: "hour", secondsInUnit: 3600 },
    { unit: "minute", secondsInUnit: 60 },
    { unit: "second", secondsInUnit: 1 },
  ];

  for (const { unit, secondsInUnit } of intervals) {
    const interval = Math.floor(diffInSeconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? "s" : ""} ago`;
    }
  }

  return "just now";
};
