/**
 * TechStackSelector Component
 *
 * Multi-select component for selecting technologies/frameworks.
 *
 * Responsibilities:
 * - Display predefined list of popular technologies
 * - Allow adding custom technologies
 * - Display selected technologies as removable badges
 * - Validate maximum number of selections (20)
 *
 * Architecture:
 * - Client Component (uses React hooks for state)
 * - Follows controlled component pattern
 * - Comprehensive validation and error handling
 *
 * @example
 * <TechStackSelector
 *   value={['React', 'Node.js']}
 *   onChange={(techStack) => setTechStack(techStack)}
 *   maxSelections={20}
 * />
 */

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface TechStackSelectorProps {
  /**
   * Current selected technologies
   */
  value: string[];

  /**
   * Callback when tech stack changes
   */
  onChange: (techStack: string[]) => void;

  /**
   * Maximum number of technologies allowed (default: 20)
   */
  maxSelections?: number;

  /**
   * Label for the component
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
}

// ============================================
// CONSTANTS
// ============================================

const POPULAR_TECHNOLOGIES = [
  // Frontend
  'React',
  'Vue.js',
  'Angular',
  'Next.js',
  'Svelte',
  'Tailwind CSS',
  'TypeScript',
  'JavaScript',

  // Backend
  'Node.js',
  'Express.js',
  'Python',
  'Django',
  'Flask',
  'Ruby on Rails',
  'PHP',
  'Laravel',

  // Databases
  'PostgreSQL',
  'MongoDB',
  'MySQL',
  'Redis',
  'SQLite',

  // Mobile
  'React Native',
  'Flutter',
  'Swift',
  'Kotlin',

  // DevOps/Cloud
  'Docker',
  'AWS',
  'Google Cloud',
  'Azure',
  'Kubernetes',

  // Other
  'GraphQL',
  'REST API',
  'WebSockets',
  'Git',
];

const DEFAULT_MAX_SELECTIONS = 20;

// ============================================
// TECH STACK SELECTOR COMPONENT
// ============================================

export function TechStackSelector({
  value,
  onChange,
  maxSelections = DEFAULT_MAX_SELECTIONS,
  label = 'Tech Stack',
  error,
  className,
}: TechStackSelectorProps) {
  const componentName = 'TechStackSelector';

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  const [customInput, setCustomInput] = React.useState('');
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  console.log(`[${componentName}] Rendered with:`, {
    valueCount: value.length,
    maxSelections,
  });

  // ============================================
  // COMPUTED VALUES
  // ============================================

  /**
   * Filter suggestions based on search query
   */
  const filteredSuggestions = React.useMemo(() => {
    if (!searchQuery) return POPULAR_TECHNOLOGIES;

    const query = searchQuery.toLowerCase();
    return POPULAR_TECHNOLOGIES.filter(
      (tech) => tech.toLowerCase().includes(query) && !value.includes(tech)
    );
  }, [searchQuery, value]);

  /**
   * Check if at max selections
   */
  const isAtMaxSelections = value.length >= maxSelections;

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Add a technology to the selection
   */
  const addTechnology = (tech: string) => {
    if (isAtMaxSelections) {
      console.warn(`[${componentName}] Maximum selections reached:`, maxSelections);
      return;
    }

    if (value.includes(tech)) {
      console.warn(`[${componentName}] Technology already selected:`, tech);
      return;
    }

    console.log(`[${componentName}] Adding technology:`, tech);
    onChange([...value, tech]);
  };

  /**
   * Remove a technology from the selection
   */
  const removeTechnology = (tech: string) => {
    console.log(`[${componentName}] Removing technology:`, tech);
    onChange(value.filter((t) => t !== tech));
  };

  /**
   * Handle custom technology input
   */
  const handleAddCustom = () => {
    const trimmedInput = customInput.trim();

    if (!trimmedInput) return;

    if (isAtMaxSelections) {
      console.warn(`[${componentName}] Maximum selections reached:`, maxSelections);
      return;
    }

    if (value.includes(trimmedInput)) {
      console.warn(`[${componentName}] Technology already selected:`, trimmedInput);
      setCustomInput('');
      return;
    }

    console.log(`[${componentName}] Adding custom technology:`, trimmedInput);
    onChange([...value, trimmedInput]);
    setCustomInput('');
    setShowSuggestions(false);
  };

  /**
   * Handle Enter key press on custom input
   */
  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddCustom();
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={cn('space-y-3', className)}>
      {/* Label */}
      <Label>
        {label}
        {isAtMaxSelections && (
          <span className="ml-2 text-xs text-muted-foreground">
            (Max {maxSelections} reached)
          </span>
        )}
      </Label>

      {/* Selected Technologies */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tech) => (
            <div
              key={tech}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground"
            >
              <span>{tech}</span>
              <button
                type="button"
                onClick={() => removeTechnology(tech)}
                className="rounded-full p-0.5 hover:bg-primary-foreground/20"
                aria-label={`Remove ${tech}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input for adding technologies */}
      <div className="relative">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Search or add custom technology..."
            value={customInput}
            onChange={(e) => {
              setCustomInput(e.target.value);
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyPress={handleKeyPress}
            disabled={isAtMaxSelections}
            className={cn(error && 'border-destructive')}
          />
          <Button
            type="button"
            onClick={handleAddCustom}
            disabled={!customInput.trim() || isAtMaxSelections}
            size="sm"
          >
            Add
          </Button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && !isAtMaxSelections && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-lg">
            <div className="space-y-1 p-2">
              <p className="px-2 py-1 text-xs text-muted-foreground">
                Popular Technologies
              </p>
              {filteredSuggestions.map((tech) => (
                <button
                  key={tech}
                  type="button"
                  onClick={() => {
                    addTechnology(tech);
                    setCustomInput('');
                    setSearchQuery('');
                    setShowSuggestions(false);
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground">
        Select from popular technologies or add your own. Maximum {maxSelections}{' '}
        technologies.
        {value.length > 0 && ` (${value.length}/${maxSelections} selected)`}
      </p>

      {/* Error Message */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
