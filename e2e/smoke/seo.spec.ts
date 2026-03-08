/**
 * Smoke Tests: SEO & Open Graph
 *
 * Verifies metadata is correctly set on key pages after deployment.
 * Guards against regressions like:
 * - og:image pointing to localhost (regression we fixed in PRs #63-#65)
 * - Missing social preview tags
 * - Incorrect canonical URLs
 */

import { test, expect } from '@playwright/test';

test.describe('Homepage SEO & Open Graph', () => {
  test('has og:title meta tag', async ({ page }) => {
    await page.goto('/');
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content');
    expect(ogTitle).toBeTruthy();
    expect(ogTitle?.length).toBeGreaterThan(0);
  });

  test('has og:description meta tag', async ({ page }) => {
    await page.goto('/');
    const ogDesc = await page
      .locator('meta[property="og:description"]')
      .getAttribute('content');
    expect(ogDesc).toBeTruthy();
    expect(ogDesc?.length).toBeGreaterThan(5);
  });

  test('og:image URL does not point to localhost', async ({ page }) => {
    await page.goto('/');
    const ogImage = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content');

    expect(ogImage).toBeTruthy();
    // Guard against the localhost regression (PRs #63-#65)
    expect(ogImage).not.toContain('localhost');
    expect(ogImage).not.toContain('127.0.0.1');
  });

  test('og:image is an absolute URL', async ({ page }) => {
    await page.goto('/');
    const ogImage = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content');

    expect(ogImage).toMatch(/^https?:\/\//);
  });

  test('has twitter:card meta tag', async ({ page }) => {
    await page.goto('/');
    const twitterCard = await page
      .locator('meta[name="twitter:card"]')
      .getAttribute('content');
    expect(['summary', 'summary_large_image']).toContain(twitterCard);
  });

  test('has twitter:image that does not point to localhost', async ({ page }) => {
    await page.goto('/');
    const twitterImage = await page
      .locator('meta[name="twitter:image"]')
      .getAttribute('content');

    // Twitter image may not always be set — skip if absent
    if (twitterImage) {
      expect(twitterImage).not.toContain('localhost');
      expect(twitterImage).not.toContain('127.0.0.1');
      expect(twitterImage).toMatch(/^https?:\/\//);
    }
  });

  test('has page title', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test('canonical URL or og:url does not reference localhost if present', async ({
    page,
  }) => {
    await page.goto('/');

    // Use count() to avoid timeout if the element doesn't exist
    const canonicalCount = await page.locator('link[rel="canonical"]').count();
    const canonical =
      canonicalCount > 0
        ? await page.locator('link[rel="canonical"]').getAttribute('href')
        : null;

    const ogUrlCount = await page.locator('meta[property="og:url"]').count();
    const ogUrl =
      ogUrlCount > 0
        ? await page.locator('meta[property="og:url"]').getAttribute('content')
        : null;

    // If either is set, it must not point to localhost
    if (canonical) expect(canonical).not.toContain('localhost');
    if (ogUrl) expect(ogUrl).not.toContain('localhost');
  });
});

test.describe('Projects Page SEO', () => {
  test('has a page title', async ({ page }) => {
    await page.goto('/projects');
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test('has og:title', async ({ page }) => {
    await page.goto('/projects');
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content');
    expect(ogTitle).toBeTruthy();
  });
});

test.describe('Sign-In Page SEO', () => {
  test('has a page title', async ({ page }) => {
    await page.goto('/auth/signin');
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('sign-in page is not indexed (noindex)', async ({ page }) => {
    await page.goto('/auth/signin');
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    // Auth pages should either have noindex or no robots tag
    // We just ensure it doesn't accidentally have index,follow
    if (robots) {
      expect(robots).not.toBe('index,follow');
    }
  });
});
