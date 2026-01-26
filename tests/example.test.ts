/**
 * Example Test Suite
 *
 * This file demonstrates the testing setup and can be used to verify
 * that Vitest is configured correctly.
 *
 * Delete this file once you have real tests.
 */

import { describe, it, expect } from 'vitest';

describe('Vitest Setup', () => {
  it('should run basic tests', () => {
    expect(true).toBe(true);
  });

  it('should support TypeScript', () => {
    const value: string = 'test';
    expect(value).toBe('test');
  });

  it('should support async tests', async () => {
    const promise = Promise.resolve('async value');
    await expect(promise).resolves.toBe('async value');
  });

  it('should have access to test utilities', () => {
    expect(expect).toBeDefined();
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
  });
});

describe('Environment Variables', () => {
  it('should have test environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3011');
  });
});
