import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 *
 * Combines clsx for conditional classes and tailwind-merge
 * to properly handle conflicting Tailwind utilities.
 *
 * @example
 * cn('px-2 py-1', { 'bg-red-500': isError })
 * cn('px-2 px-4') // Result: 'px-4' (later value wins)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format price in cents to USD string
 *
 * @example
 * formatPrice(1000) // "$10.00"
 * formatPrice(99) // "$0.99"
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format date to relative time
 *
 * @example
 * formatRelativeTime(new Date('2024-01-01')) // "2 months ago"
 */
export function formatRelativeTime(date: Date): string {
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = date.getTime() - Date.now();
  const diffInSeconds = Math.floor(diff / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (Math.abs(diffInDays) > 0) {
    return formatter.format(diffInDays, 'day');
  } else if (Math.abs(diffInHours) > 0) {
    return formatter.format(diffInHours, 'hour');
  } else if (Math.abs(diffInMinutes) > 0) {
    return formatter.format(diffInMinutes, 'minute');
  } else {
    return formatter.format(diffInSeconds, 'second');
  }
}

/**
 * Truncate text to specified length with ellipsis
 *
 * @example
 * truncate('Hello World', 8) // "Hello..."
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Sleep utility for testing and development
 *
 * @example
 * await sleep(1000) // Wait 1 second
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
