/**
 * Indian Locale & Operational Formatters for StockPilot WMS
 */

/**
 * Format currency amount in Indian Rupees (INR) with Indian numbering grouping (e.g., ₹1,24,500.00)
 */
export function formatINR(amount: number, showDecimals = true): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);
}

/**
 * Format numbers with Indian number grouping (e.g., 1,24,500)
 */
export function formatNumberIN(num: number): string {
  if (isNaN(num) || num === null || num === undefined) {
    return '0';
  }
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Format timestamps in Asia/Kolkata (Indian Standard Time)
 * Example: "14 Oct 2026, 01:20 PM IST"
 */
export function formatIST(dateInput: string | Date | null | undefined, includeTime = true): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }
      : {}),
  };

  const formatted = new Intl.DateTimeFormat('en-IN', options).format(d);
  return includeTime ? `${formatted} IST` : formatted;
}

/**
 * Short relative time helper for task ages (e.g., "12m ago", "2h ago", "1d ago")
 */
export function formatRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
