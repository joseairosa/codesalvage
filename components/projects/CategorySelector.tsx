/**
 * CategorySelector Component
 *
 * Select dropdown for choosing project category.
 *
 * Responsibilities:
 * - Display list of valid project categories
 * - Allow selecting a single category
 * - Provide category descriptions
 *
 * Architecture:
 * - Client Component (uses React hooks for state)
 * - Controlled component pattern
 * - Uses Radix UI Select primitive
 *
 * @example
 * <CategorySelector
 *   value="web_app"
 *   onChange={(category) => setCategory(category)}
 * />
 */

'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface CategorySelectorProps {
  /**
   * Current selected category
   */
  value: string;

  /**
   * Callback when category changes
   */
  onChange: (category: string) => void;

  /**
   * Label for the selector
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

/**
 * Project categories with descriptions
 */
const PROJECT_CATEGORIES = [
  {
    value: 'web_app',
    label: 'Web Application',
    description: 'Full-stack web applications, SPAs, dashboards',
  },
  {
    value: 'mobile_app',
    label: 'Mobile Application',
    description: 'iOS, Android, React Native, Flutter apps',
  },
  {
    value: 'desktop_app',
    label: 'Desktop Application',
    description: 'Electron, native desktop applications',
  },
  {
    value: 'backend_api',
    label: 'Backend API',
    description: 'REST APIs, GraphQL servers, microservices',
  },
  {
    value: 'cli_tool',
    label: 'CLI Tool',
    description: 'Command-line utilities and tools',
  },
  {
    value: 'library',
    label: 'Library/Package',
    description: 'Reusable libraries, npm packages, SDKs',
  },
  {
    value: 'dashboard',
    label: 'Dashboard',
    description: 'Admin panels, analytics dashboards, monitoring tools',
  },
  {
    value: 'game',
    label: 'Game',
    description: 'Web games, mobile games, game engines',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other types of projects',
  },
] as const;

// ============================================
// CATEGORY SELECTOR COMPONENT
// ============================================

export function CategorySelector({
  value,
  onChange,
  label = 'Project Category',
  error,
  className,
  disabled = false,
}: CategorySelectorProps) {
  const componentName = 'CategorySelector';

  console.log(`[${componentName}] Rendered with:`, { value });

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Handle category change
   */
  const handleValueChange = (newValue: string) => {
    console.log(`[${componentName}] Category changed:`, newValue);
    onChange(newValue);
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================

  /**
   * Get selected category details
   */
  const selectedCategory = PROJECT_CATEGORIES.find((cat) => cat.value === value);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <Label htmlFor="category-select">{label}</Label>

      {/* Select Dropdown */}
      <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger id="category-select" className={cn(error && 'border-destructive')}>
          <SelectValue placeholder="Select a category" />
        </SelectTrigger>
        <SelectContent>
          {PROJECT_CATEGORIES.map((category) => (
            <SelectItem key={category.value} value={category.value}>
              <div className="flex flex-col">
                <span className="font-medium">{category.label}</span>
                <span className="text-xs text-muted-foreground">
                  {category.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Helper Text */}
      {!error && selectedCategory && (
        <p className="text-xs text-muted-foreground">{selectedCategory.description}</p>
      )}

      {/* Error Message */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
