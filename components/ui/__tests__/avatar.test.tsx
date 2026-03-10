/**
 * Avatar Component Tests
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar, AvatarImage, AvatarFallback } from '../avatar';

// Radix AvatarImage withholds the <img> from the DOM until the image loads.
// In jsdom images never load, so we mock the primitive to render directly.
vi.mock('@radix-ui/react-avatar', async (importOriginal) => {
  const original = await importOriginal<typeof import('@radix-ui/react-avatar')>();
  return {
    ...original,
    Image: React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
      ({ className, ...props }, ref) => <img ref={ref} className={className} {...props} />
    ),
  };
});

describe('AvatarImage', () => {
  it('renders with object-cover to prevent squashing non-square images', () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.jpg" alt="Test user" />
        <AvatarFallback>TU</AvatarFallback>
      </Avatar>
    );

    const img = screen.getByRole('img', { name: 'Test user' });
    expect(img.className).toContain('object-cover');
  });

  it('renders fallback initials when no src provided', () => {
    render(
      <Avatar>
        <AvatarFallback>JA</AvatarFallback>
      </Avatar>
    );

    expect(screen.getByText('JA')).toBeDefined();
  });
});
