/**
 * Projects Browse Layout Tests
 *
 * Tests for the static metadata in app/projects/layout.tsx:
 * - Title is "Browse Projects — CodeSalvage"
 * - OG tags present
 * - Twitter card set
 */

import { describe, it, expect } from 'vitest';
import { metadata } from '../layout';

describe('Browse page metadata', () => {
  it('has correct title', () => {
    expect(metadata.title).toBe('Browse Projects — CodeSalvage');
  });

  it('has a description', () => {
    expect(typeof metadata.description).toBe('string');
    expect((metadata.description ?? '').length).toBeGreaterThan(0);
  });

  it('has openGraph type website', () => {
    const og = metadata.openGraph as { type?: string } | undefined;
    expect(og?.type).toBe('website');
  });

  it('has openGraph title', () => {
    const og = metadata.openGraph as { title?: string } | undefined;
    expect(og?.title).toBeDefined();
  });

  it('has twitter card', () => {
    const twitter = metadata.twitter as { card?: string } | undefined;
    expect(twitter?.card).toBe('summary_large_image');
  });
});
