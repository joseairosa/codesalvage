/**
 * Test Utilities
 *
 * Responsibilities:
 * - Provide custom render function with providers
 * - Mock data generators
 * - Common test helpers
 * - Custom matchers and assertions
 *
 * Architecture:
 * - Wraps React Testing Library
 * - Adds common providers (Session, Query, etc.)
 * - Reusable across all tests
 */

import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

/**
 * Custom render options
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  session?: Session | null;
  // Add other provider props as needed
}

/**
 * All providers wrapper for testing
 */
function AllTheProviders({
  children,
  session,
}: {
  children: ReactNode;
  session?: Session | null;
}) {
  return (
    <SessionProvider session={session ?? null}>
      {/* Add other providers here as needed (QueryClientProvider, etc.) */}
      {children}
    </SessionProvider>
  );
}

/**
 * Custom render function
 *
 * Wraps component with necessary providers for testing
 *
 * @example
 * render(<MyComponent />, { session: mockSession });
 */
export function render(
  ui: ReactElement,
  { session, ...renderOptions }: CustomRenderOptions = {}
) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders session={session ?? null}>{children}</AllTheProviders>
    ),
    ...renderOptions,
  });
}

/**
 * Re-export everything from React Testing Library
 */
export * from '@testing-library/react';

/**
 * Custom user event with default options
 */
export { default as userEvent } from '@testing-library/user-event';
