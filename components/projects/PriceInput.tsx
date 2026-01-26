/**
 * PriceInput Component
 *
 * Formatted input for project pricing with validation.
 *
 * Responsibilities:
 * - Display price in formatted USD currency
 * - Convert to/from cents for backend storage
 * - Validate min/max price range ($100 - $100,000)
 * - Format as user types
 *
 * Architecture:
 * - Client Component (uses React hooks for state)
 * - Controlled component pattern
 * - Real-time validation and formatting
 *
 * @example
 * <PriceInput
 *   value={50000} // cents
 *   onChange={(cents) => setPriceCents(cents)}
 *   minCents={10000}  // $100
 *   maxCents={10000000}  // $100,000
 * />
 */

'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface PriceInputProps {
  /**
   * Current price in cents
   */
  value: number;

  /**
   * Callback when price changes (in cents)
   */
  onChange: (cents: number) => void;

  /**
   * Minimum price in cents (default: 10000 = $100)
   */
  minCents?: number;

  /**
   * Maximum price in cents (default: 10000000 = $100,000)
   */
  maxCents?: number;

  /**
   * Label for the input
   */
  label?: string;

  /**
   * Error message to display
   */
  error?: string;

  /**
   * Optional className for styling
   */
  className?: string;

  /**
   * Disabled state
   */
  disabled?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_MIN_CENTS = 10000; // $100
const DEFAULT_MAX_CENTS = 10000000; // $100,000

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Converts cents to formatted dollar string
 *
 * @param cents - Amount in cents
 * @returns Formatted string (e.g., "1,234.56")
 */
function formatCentsToDisplay(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Converts user input to cents
 *
 * @param input - User input string
 * @returns Amount in cents
 */
function parseInputToCents(input: string): number {
  // Remove all non-numeric characters except decimal point
  const cleaned = input.replace(/[^\d.]/g, '');

  // Parse as float and convert to cents
  const dollars = parseFloat(cleaned) || 0;
  return Math.round(dollars * 100);
}

/**
 * Validates price is within range
 *
 * @param cents - Amount in cents
 * @param minCents - Minimum allowed
 * @param maxCents - Maximum allowed
 * @returns Error message or null if valid
 */
function validatePrice(cents: number, minCents: number, maxCents: number): string | null {
  if (cents < minCents) {
    return `Price must be at least $${(minCents / 100).toLocaleString()}`;
  }

  if (cents > maxCents) {
    return `Price cannot exceed $${(maxCents / 100).toLocaleString()}`;
  }

  return null;
}

// ============================================
// PRICE INPUT COMPONENT
// ============================================

export function PriceInput({
  value,
  onChange,
  minCents = DEFAULT_MIN_CENTS,
  maxCents = DEFAULT_MAX_CENTS,
  label = 'Price',
  error,
  className,
  disabled = false,
}: PriceInputProps) {
  const componentName = 'PriceInput';

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  const [displayValue, setDisplayValue] = React.useState(formatCentsToDisplay(value));
  const [isFocused, setIsFocused] = React.useState(false);

  console.log(`[${componentName}] Rendered with:`, {
    valueCents: value,
    valueDollars: value / 100,
    displayValue,
  });

  // ============================================
  // SYNC EXTERNAL VALUE CHANGES
  // ============================================

  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatCentsToDisplay(value));
    }
  }, [value, isFocused]);

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Handle input change
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target.value;
    setDisplayValue(input);

    // Convert to cents and validate
    const cents = parseInputToCents(input);
    const validationError = validatePrice(cents, minCents, maxCents);

    // Always call onChange even if validation fails
    // Parent component can handle validation
    onChange(cents);

    console.log(`[${componentName}] Input changed:`, {
      input,
      cents,
      validationError,
    });
  };

  /**
   * Handle focus
   */
  const handleFocus = () => {
    setIsFocused(true);
    console.log(`[${componentName}] Input focused`);
  };

  /**
   * Handle blur
   */
  const handleBlur = () => {
    setIsFocused(false);

    // Format the display value on blur
    const cents = parseInputToCents(displayValue);
    setDisplayValue(formatCentsToDisplay(cents));

    console.log(`[${componentName}] Input blurred, formatted to:`, {
      cents,
      formatted: formatCentsToDisplay(cents),
    });
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const validationError = validatePrice(value, minCents, maxCents);
  const displayError = error || validationError;

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <Label htmlFor="price-input">
        {label}
        <span className="ml-2 text-xs text-muted-foreground">
          ($
          {(minCents / 100).toLocaleString()} - ${(maxCents / 100).toLocaleString()})
        </span>
      </Label>

      {/* Input with $ prefix */}
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          $
        </div>
        <Input
          id="price-input"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className={cn('pl-7', displayError && 'border-destructive')}
        />
      </div>

      {/* Helper Text / Current Value */}
      {!displayError && (
        <p className="text-xs text-muted-foreground">
          Enter the price for your project in USD
        </p>
      )}

      {/* Error Message */}
      {displayError && <p className="text-xs text-destructive">{displayError}</p>}
    </div>
  );
}
