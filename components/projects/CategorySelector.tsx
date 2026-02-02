/**
 * CategorySelector Component
 *
 * Visual card grid for choosing project category.
 *
 * Responsibilities:
 * - Display list of valid project categories as selectable cards
 * - Allow selecting a single category
 * - Provide category descriptions and icons
 *
 * Architecture:
 * - Client Component (uses React hooks for state)
 * - Controlled component pattern
 * - Card-grid layout with icons
 *
 * @example
 * <CategorySelector
 *   value="web_app"
 *   onChange={(category) => setCategory(category)}
 * />
 */

'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Globe,
  Smartphone,
  Monitor,
  Server,
  Terminal,
  Package,
  LayoutDashboard,
  Gamepad2,
  MoreHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
 * Project categories with descriptions and icons
 */
const PROJECT_CATEGORIES: ReadonlyArray<{
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: 'web_app',
    label: 'Web Application',
    description: 'Full-stack web apps, SPAs',
    icon: Globe,
  },
  {
    value: 'mobile_app',
    label: 'Mobile App',
    description: 'iOS, Android, React Native',
    icon: Smartphone,
  },
  {
    value: 'desktop_app',
    label: 'Desktop App',
    description: 'Electron, native apps',
    icon: Monitor,
  },
  {
    value: 'backend_api',
    label: 'Backend API',
    description: 'REST, GraphQL, microservices',
    icon: Server,
  },
  {
    value: 'cli_tool',
    label: 'CLI Tool',
    description: 'Command-line utilities',
    icon: Terminal,
  },
  {
    value: 'library',
    label: 'Library / Package',
    description: 'npm packages, SDKs',
    icon: Package,
  },
  {
    value: 'dashboard',
    label: 'Dashboard',
    description: 'Admin panels, analytics',
    icon: LayoutDashboard,
  },
  {
    value: 'game',
    label: 'Game',
    description: 'Web, mobile, game engines',
    icon: Gamepad2,
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other project types',
    icon: MoreHorizontal,
  },
];

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
  // RENDER
  // ============================================

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <Label>{label}</Label>

      {/* Category Grid */}
      <div
        className={cn(
          'grid grid-cols-2 gap-2 sm:grid-cols-3',
          disabled && 'pointer-events-none opacity-50'
        )}
      >
        {PROJECT_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isSelected = value === category.value;
          return (
            <button
              key={category.value}
              type="button"
              onClick={() => {
                console.log(`[${componentName}] Category changed:`, category.value);
                onChange(category.value);
              }}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 text-center transition-all',
                isSelected
                  ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                  : 'border-transparent bg-muted/40 text-muted-foreground hover:border-gray-300 hover:bg-muted/70',
                error && !isSelected && 'border-red-100'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5',
                  isSelected ? 'text-purple-600' : 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-xs font-medium leading-tight',
                  isSelected && 'text-purple-700'
                )}
              >
                {category.label}
              </span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                {category.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Error Message */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
