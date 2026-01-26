/**
 * LoadingSpinner Component
 *
 * Responsibilities:
 * - Display loading indicator
 * - Support multiple sizes
 * - Full accessibility (ARIA labels, screen reader support)
 * - Customizable colors and styles
 * - Optional loading text
 *
 * Architecture:
 * - Client Component (animated SVG)
 * - Variant-based design (size, color)
 * - Accessibility-first (role, aria-label)
 * - Reusable across the application
 */

'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Custom className for additional styling */
  className?: string;
  /** Optional loading text to display */
  text?: string;
  /** Color variant */
  variant?: 'primary' | 'secondary' | 'white' | 'gray';
  /** Screen reader label */
  label?: string;
  /** Center in container */
  centered?: boolean;
}

/**
 * Size mappings for spinner
 */
const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

/**
 * Text size mappings
 */
const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

/**
 * Color variant mappings
 */
const colorClasses = {
  primary: 'text-blue-600',
  secondary: 'text-gray-600',
  white: 'text-white',
  gray: 'text-gray-400',
};

/**
 * LoadingSpinner Component
 *
 * @example
 * <LoadingSpinner size="md" text="Loading..." />
 *
 * @example
 * <LoadingSpinner size="lg" variant="primary" centered />
 */
export function LoadingSpinner({
  size = 'md',
  className,
  text,
  variant = 'primary',
  label = 'Loading',
  centered = false,
}: LoadingSpinnerProps) {
  const spinnerContent = (
    <div
      className={cn('flex items-center gap-3', centered && 'justify-center', className)}
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className={cn('animate-spin', sizeClasses[size], colorClasses[variant])}
        aria-hidden="true"
      />

      {text && (
        <span className={cn('font-medium', colorClasses[variant], textSizeClasses[size])}>
          {text}
        </span>
      )}

      {/* Screen reader only text */}
      <span className="sr-only">{label}</span>
    </div>
  );

  if (centered) {
    return (
      <div className="flex min-h-[200px] w-full items-center justify-center">
        {spinnerContent}
      </div>
    );
  }

  return spinnerContent;
}

/**
 * FullPageLoadingSpinner - Covers entire viewport
 *
 * Use for page-level loading states
 *
 * @example
 * <FullPageLoadingSpinner text="Loading your dashboard..." />
 */
export function FullPageLoadingSpinner({
  text = 'Loading...',
  variant = 'primary',
}: {
  text?: string;
  variant?: LoadingSpinnerProps['variant'];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <LoadingSpinner size="xl" text={text} variant={variant} />
    </div>
  );
}

/**
 * InlineLoadingSpinner - Small inline loader
 *
 * Use for button loading states or inline loading
 *
 * @example
 * <Button disabled>
 *   <InlineLoadingSpinner />
 *   Saving...
 * </Button>
 */
export function InlineLoadingSpinner({
  className,
  variant = 'white',
}: {
  className?: string;
  variant?: LoadingSpinnerProps['variant'];
}) {
  return (
    <Loader2
      className={cn('h-4 w-4 animate-spin', colorClasses[variant], className)}
      aria-hidden="true"
    />
  );
}

/**
 * CardLoadingSpinner - Loading state for cards/sections
 *
 * Use for loading states within cards or content sections
 *
 * @example
 * <Card>
 *   <CardLoadingSpinner text="Loading project details..." />
 * </Card>
 */
export function CardLoadingSpinner({
  text = 'Loading...',
  minHeight = 'min-h-[300px]',
}: {
  text?: string;
  minHeight?: string;
}) {
  return (
    <div className={cn('flex w-full items-center justify-center', minHeight)}>
      <LoadingSpinner size="lg" text={text} variant="primary" />
    </div>
  );
}

/**
 * LoadingDots - Alternative loading indicator
 *
 * Animated dots for subtle loading states
 *
 * @example
 * <LoadingDots />
 */
export function LoadingDots({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="status"
      aria-label="Loading"
    >
      <span
        className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.3s]"
        aria-hidden="true"
      />
      <span
        className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.15s]"
        aria-hidden="true"
      />
      <span
        className="h-2 w-2 animate-bounce rounded-full bg-blue-600"
        aria-hidden="true"
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/**
 * LoadingSkeleton - Skeleton loader for content
 *
 * Use for content placeholders while loading
 *
 * @example
 * <LoadingSkeleton className="h-20 w-full" />
 */
export function LoadingSkeleton({
  className,
  lines = 1,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div
      className={cn('space-y-3', className)}
      role="status"
      aria-label="Loading content"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-md bg-gray-200"
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Loading content</span>
    </div>
  );
}
