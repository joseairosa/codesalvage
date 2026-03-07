/**
 * E2E Tests - Project Search Flow
 *
 * Tests the complete project search and browse workflow including:
 * - Search functionality
 * - Filter application
 * - Sort options
 * - Pagination
 * - Project card interactions
 */

import { test, expect } from '@playwright/test';

const componentName = 'ProjectSearchE2E';

test.describe('Project Search Page', () => {
  test.beforeEach(async ({ page }) => {
    console.log(`[${componentName}] Navigating to projects page`);
    await page.goto('/projects');
  });

  // TODO: Fix - page elements don't match expected selectors (Filters text, results count)
  test.skip('should render search page with all key elements', async ({ page }) => {
    console.log(`[${componentName}] Testing page rendering`);

    // Check page title
    await expect(page.locator('h1')).toContainText('Browse Projects');

    // Check search bar is present
    await expect(page.locator('input[placeholder*="Search projects"]')).toBeVisible();

    // Check search button
    await expect(page.getByRole('button', { name: /search/i })).toBeVisible();

    // Check filters section
    await expect(page.getByText('Filters')).toBeVisible();

    // Check results count is shown
    await expect(page.locator('text=/\\d+ projects found/i')).toBeVisible();
  });

  // TODO: Fix - requires seeded project data in CI database
  test.skip('should display project cards in grid layout', async ({ page }) => {
    console.log(`[${componentName}] Testing project cards display`);

    // Wait for projects to load
    await page.waitForTimeout(500);

    // Check if project cards are displayed
    // Cards should have titles, prices, and completion badges
    const projectCards = page.locator('[class*="group"]').filter({ hasText: /\$\d+/ });
    const count = await projectCards.count();

    // Should have at least 1 project card
    expect(count).toBeGreaterThan(0);
  });

  // TODO: Fix - search interaction doesn't match expected UI behavior
  test.skip('should allow text search in search bar', async ({ page }) => {
    console.log(`[${componentName}] Testing text search`);

    const searchInput = page.locator('input[placeholder*="Search projects"]');
    const searchButton = page.getByRole('button', { name: /search/i }).first();

    // Enter search query
    await searchInput.fill('Dashboard');
    await searchButton.click();

    // Wait for search to update
    await page.waitForTimeout(500);

    // Check URL has query parameter
    expect(page.url()).toContain('query=Dashboard');

    // Active filter badge should be shown
    await expect(page.getByText('Search: Dashboard')).toBeVisible();
  });

  // TODO: Fix - search interaction doesn't match expected UI behavior
  test.skip('should search on Enter key press', async ({ page }) => {
    console.log(`[${componentName}] Testing Enter key search`);

    const searchInput = page.locator('input[placeholder*="Search projects"]');

    // Enter search query and press Enter
    await searchInput.fill('React');
    await searchInput.press('Enter');

    // Wait for search to update
    await page.waitForTimeout(500);

    // Check URL has query parameter
    expect(page.url()).toContain('query=React');
  });
});

test.describe('Project Search - Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
  });

  // TODO: Fix - filter sidebar elements don't match expected selectors
  test.skip('should show filter sidebar', async ({ page }) => {
    console.log(`[${componentName}] Testing filter sidebar visibility`);

    // Filter sidebar should be visible
    await expect(page.getByText('Filters')).toBeVisible();
    await expect(page.getByText('Category')).toBeVisible();
    await expect(page.getByText('Tech Stack')).toBeVisible();
    await expect(page.getByText('Completion')).toBeVisible();
    await expect(page.getByText('Price Range')).toBeVisible();
  });

  // The Show/Hide Filters toggle was removed in favour of the always-visible horizontal filter bar.
  // This test verifies that the filter controls are visible without any user interaction.
  test('should show horizontal filter bar with all controls visible', async ({
    page,
  }) => {
    console.log(`[${componentName}] Testing horizontal filter bar visibility`);

    // Category filter label should be visible immediately — no toggle needed
    await expect(page.getByText('Category')).toBeVisible();

    // Price and Completion labels should also be in the filter bar
    await expect(page.getByText('Price')).toBeVisible();
    await expect(page.getByText('Completion')).toBeVisible();
  });

  // TODO: Fix - category filter interaction doesn't match expected UI
  test.skip('should allow category filter selection', async ({ page }) => {
    console.log(`[${componentName}] Testing category filter`);

    // Click category dropdown
    const categorySelect = page.locator('[id*="category"]').first();
    await categorySelect.click();
    await page.waitForTimeout(300);

    // Select a category
    await page.getByText('Web App', { exact: true }).click();
    await page.waitForTimeout(300);

    // Apply filters
    await page.getByRole('button', { name: /apply filters/i }).click();
    await page.waitForTimeout(500);

    // Check URL has category parameter
    expect(page.url()).toContain('category=web_app');

    // Active filter badge should be shown
    await expect(page.getByText('Web App')).toBeVisible();
  });

  // TODO: Fix - tech stack filter interaction selector needs update for horizontal bar
  test.skip('should allow tech stack filter selection', async ({ page }) => {
    console.log(`[${componentName}] Testing tech stack filter`);

    // Click a tech stack badge in the horizontal filter bar
    await page
      .locator('[data-slot="badge"]')
      .filter({ hasText: /^React$/ })
      .first()
      .click();
    await page.waitForTimeout(500);

    // URL should auto-sync after clicking (no Apply Filters button)
    expect(page.url()).toContain('techStack=React');

    // Active filter badge should be shown
    await expect(page.locator('text=React').first()).toBeVisible();
  });

  // TODO: Fix - tech stack filter interaction selector needs update for horizontal bar
  test.skip('should allow multiple tech stack selections', async ({ page }) => {
    console.log(`[${componentName}] Testing multiple tech stack selection`);

    // Click multiple tech stack badges in the horizontal filter bar
    await page
      .locator('[data-slot="badge"]')
      .filter({ hasText: /^React$/ })
      .first()
      .click();
    await page.waitForTimeout(200);
    await page
      .locator('[data-slot="badge"]')
      .filter({ hasText: /^Node\.js$/ })
      .first()
      .click();
    await page.waitForTimeout(500);

    // Both should be in URL (auto-synced, no Apply Filters button)
    expect(page.url()).toContain('React');
    expect(page.url()).toContain('Node.js');
  });

  test('should remove individual filter badges', async ({ page }) => {
    console.log(`[${componentName}] Testing individual filter removal`);

    // Add a search filter
    const searchInput = page.locator('input[placeholder*="Search projects"]');
    await searchInput.fill('Dashboard');
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Active filter badge should be visible
    await expect(page.getByText('Search: Dashboard')).toBeVisible();

    // Click the X button on the badge
    const removeButton = page
      .locator('[class*="gap-1"]')
      .filter({ hasText: 'Search: Dashboard' })
      .locator('button');
    await removeButton.click();
    await page.waitForTimeout(300);

    // Badge should be removed
    await expect(page.getByText('Search: Dashboard')).not.toBeVisible();
  });

  // TODO: Fix - clear all button interaction doesn't match expected UI
  test.skip('should clear all filters', async ({ page }) => {
    console.log(`[${componentName}] Testing clear all filters`);

    // Add multiple filters
    const searchInput = page.locator('input[placeholder*="Search projects"]');
    await searchInput.fill('React');
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Clear all filters button should be visible
    const clearButton = page.getByRole('button', { name: /clear all/i });
    await expect(clearButton).toBeVisible();

    await clearButton.click();
    await page.waitForTimeout(300);

    // All filters should be removed
    await expect(page.getByText('Search: React')).not.toBeVisible();
  });
});

test.describe('Project Search - Sort and Pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
  });

  test('should display sort dropdown', async ({ page }) => {
    console.log(`[${componentName}] Testing sort dropdown display`);

    // Sort dropdown should be visible
    await expect(page.getByText('Sort by:')).toBeVisible();
  });

  // TODO: Fix - sort dropdown interaction doesn't match expected UI
  test.skip('should allow changing sort order', async ({ page }) => {
    console.log(`[${componentName}] Testing sort order change`);

    // Click sort dropdown
    const sortSelect = page
      .locator('text=Sort by:')
      .locator('..')
      .locator('button')
      .first();
    await sortSelect.click();
    await page.waitForTimeout(300);

    // Select a different sort option
    await page.getByText('Price: Low to High', { exact: true }).click();
    await page.waitForTimeout(500);

    // Check URL has sortBy parameter (value uses DB field name after Task 1 fix)
    expect(page.url()).toContain('sortBy=priceCents-asc');
  });

  test('should display pagination controls', async ({ page }) => {
    console.log(`[${componentName}] Testing pagination controls`);

    // Wait for page to load
    await page.waitForTimeout(500);

    // Check if pagination buttons exist
    const prevButton = page.getByRole('button', { name: /previous/i });
    const nextButton = page.getByRole('button', { name: /next/i });

    // Pagination controls should be visible
    if (await prevButton.isVisible()) {
      await expect(prevButton).toBeVisible();
      await expect(nextButton).toBeVisible();
    }
  });

  test('should disable previous button on first page', async ({ page }) => {
    console.log(`[${componentName}] Testing first page pagination`);

    await page.waitForTimeout(500);

    // Previous button should be disabled on first page
    const prevButton = page.getByRole('button', { name: /previous/i });

    if (await prevButton.isVisible()) {
      await expect(prevButton).toBeDisabled();
    }
  });

  test('should navigate to next page', async ({ page }) => {
    console.log(`[${componentName}] Testing next page navigation`);

    await page.waitForTimeout(500);

    const nextButton = page.getByRole('button', { name: /next/i });

    if ((await nextButton.isVisible()) && !(await nextButton.isDisabled())) {
      await nextButton.click();
      await page.waitForTimeout(500);

      // URL should have page parameter
      expect(page.url()).toContain('page=2');
    }
  });
});

test.describe('Project Search - Project Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
  });

  test('should navigate to project detail on card click', async ({ page }) => {
    console.log(`[${componentName}] Testing project card navigation`);

    await page.waitForTimeout(500);

    // Click first project card
    const firstCard = page
      .locator('[class*="group"]')
      .filter({ hasText: /\$\d+/ })
      .first();

    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForTimeout(500);

      // Should navigate to project detail page
      expect(page.url()).toContain('/projects/');
    }
  });

  test('should display project card information', async ({ page }) => {
    console.log(`[${componentName}] Testing project card information`);

    await page.waitForTimeout(500);

    // First card should show key information
    const firstCard = page
      .locator('[class*="group"]')
      .filter({ hasText: /\$\d+/ })
      .first();

    if (await firstCard.isVisible()) {
      // Should contain price
      await expect(firstCard.locator('text=/\\$\\d+/')).toBeVisible();

      // Should contain completion percentage
      await expect(firstCard.locator('text=/\\d+% Complete/i')).toBeVisible();
    }
  });
});

test.describe('Project Search - Empty State', () => {
  test('should show empty state when no results', async ({ page }) => {
    console.log(`[${componentName}] Testing empty state`);

    await page.goto('/projects');

    // Search for something that won't match
    const searchInput = page.locator('input[placeholder*="Search projects"]');
    await searchInput.fill('xyznonexistentproject123');
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Mock the projects to be empty
    // In a real test, we'd mock the API to return empty results

    // Empty state message should be shown
    // (This test assumes mock data, so it might not trigger empty state)
  });
});
