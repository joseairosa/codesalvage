/**
 * CompletionSlider Component
 *
 * Slider for selecting project completion percentage (50-95%).
 *
 * Responsibilities:
 * - Allow selecting completion percentage within valid range
 * - Display visual progress indicator
 * - Show current percentage value
 * - Validate range (50-95%)
 *
 * Architecture:
 * - Client Component (uses React hooks for state)
 * - Controlled component pattern
 * - Uses Radix UI Slider primitive
 *
 * @example
 * <CompletionSlider
 *   value={75}
 *   onChange={(value) => setCompletion(value)}
 * />
 */

'use client';

import * as React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface CompletionSliderProps {
  /**
   * Current completion percentage (50-95)
   */
  value: number;

  /**
   * Callback when completion percentage changes
   */
  onChange: (value: number) => void;

  /**
   * Minimum completion percentage (default: 50)
   */
  min?: number;

  /**
   * Maximum completion percentage (default: 95)
   */
  max?: number;

  /**
   * Label for the slider
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

const DEFAULT_MIN = 50;
const DEFAULT_MAX = 95;

// ============================================
// COMPLETION SLIDER COMPONENT
// ============================================

export function CompletionSlider({
  value,
  onChange,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  label = 'Project Completion',
  error,
  className,
  disabled = false,
}: CompletionSliderProps) {
  const componentName = 'CompletionSlider';

  console.log(`[${componentName}] Rendered with:`, {
    value,
    min,
    max,
  });

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Handle slider value change
   */
  const handleValueChange = (values: number[]) => {
    const newValue = values[0];
    if (newValue === undefined) return;

    console.log(`[${componentName}] Value changed:`, newValue);
    onChange(newValue);
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================

  /**
   * Calculate completion level category
   */
  const getCompletionLevel = (): {
    label: string;
    color: string;
  } => {
    if (value >= 90) {
      return { label: 'Nearly Complete', color: 'text-green-600' };
    } else if (value >= 80) {
      return { label: 'Almost There', color: 'text-blue-600' };
    } else if (value >= 70) {
      return { label: 'Well Advanced', color: 'text-indigo-600' };
    } else if (value >= 60) {
      return { label: 'More than Half', color: 'text-purple-600' };
    } else {
      return { label: 'Good Start', color: 'text-gray-600' };
    }
  };

  const completionLevel = getCompletionLevel();

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={cn('space-y-4', className)}>
      {/* Label and Current Value */}
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <span className={cn('text-2xl font-bold', completionLevel.color)}>
            {value}%
          </span>
          <span className="text-xs text-muted-foreground">{completionLevel.label}</span>
        </div>
      </div>

      {/* Slider */}
      <Slider
        value={[value]}
        onValueChange={handleValueChange}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        className="w-full"
      />

      {/* Range Indicators */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}% min</span>
        <span>{max}% max</span>
      </div>

      {/* Helper Text */}
      {!error && (
        <p className="text-xs text-muted-foreground">
          Projects must be between {min}% and {max}% complete to be listed. This helps
          buyers know they're getting a project that's truly underway.
        </p>
      )}

      {/* Error Message */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Visual Progress Bar */}
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'absolute left-0 top-0 h-full transition-all duration-300',
            completionLevel.color.replace('text-', 'bg-')
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
