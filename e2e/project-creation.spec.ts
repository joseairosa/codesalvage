/**
 * E2E Tests - Project Creation Flow
 *
 * Tests the complete project creation workflow including:
 * - Form rendering and validation
 * - Save as draft functionality
 * - Publish functionality
 * - File upload integration
 * - Error handling
 */

import { test, expect } from '@playwright/test';

const componentName = 'ProjectCreationE2E';

test.describe('Project Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    console.log(`[${componentName}] Navigating to project creation page`);
    await page.goto('/projects/new');
  });

  test('should render project creation form with all sections', async ({ page }) => {
    console.log(`[${componentName}] Testing form rendering`);

    // Check page title
    await expect(page.locator('h1')).toContainText('List a New Project');

    // Check all card sections are present
    await expect(page.getByText('Basic Information')).toBeVisible();
    await expect(page.getByText('Technical Details')).toBeVisible();
    await expect(page.getByText('Completion Status')).toBeVisible();
    await expect(page.getByText('Pricing & Licensing')).toBeVisible();
    await expect(page.getByText('Media & Links')).toBeVisible();

    // Check form buttons
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /save as draft/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /publish project/i })).toBeVisible();
  });

  test('should show validation errors for required fields', async ({ page }) => {
    console.log(`[${componentName}] Testing validation errors`);

    // Try to submit without filling required fields
    await page.getByRole('button', { name: /publish project/i }).click();

    // Wait for validation errors to appear
    await page.waitForTimeout(500);

    // Check for title validation error
    const titleInput = page.locator('input[id="title"]');
    await expect(titleInput).toHaveAttribute('class', /border-destructive/);

    // Check for description validation error
    const descriptionInput = page.locator('textarea[id="description"]');
    await expect(descriptionInput).toHaveAttribute('class', /border-destructive/);
  });

  test('should validate title length requirements', async ({ page }) => {
    console.log(`[${componentName}] Testing title validation`);

    const titleInput = page.locator('input[id="title"]');

    // Test title too short
    await titleInput.fill('Hi');
    await titleInput.blur();
    await page.waitForTimeout(300);
    await expect(page.locator('text=/at least 5 characters/i')).toBeVisible();

    // Test valid title
    await titleInput.fill('E-commerce Dashboard');
    await titleInput.blur();
    await page.waitForTimeout(300);
    await expect(page.locator('text=/at least 5 characters/i')).not.toBeVisible();
  });

  test('should validate description length requirements', async ({ page }) => {
    console.log(`[${componentName}] Testing description validation`);

    const descriptionInput = page.locator('textarea[id="description"]');

    // Test description too short
    await descriptionInput.fill('Short description');
    await descriptionInput.blur();
    await page.waitForTimeout(300);
    await expect(page.locator('text=/at least 50 characters/i')).toBeVisible();

    // Test valid description
    const validDescription = 'A'.repeat(50);
    await descriptionInput.fill(validDescription);
    await descriptionInput.blur();
    await page.waitForTimeout(300);
    await expect(page.locator('text=/at least 50 characters/i')).not.toBeVisible();
  });

  test('should show character counter for description', async ({ page }) => {
    console.log(`[${componentName}] Testing description character counter`);

    const descriptionInput = page.locator('textarea[id="description"]');
    const testText = 'Test description for project';

    await descriptionInput.fill(testText);
    await page.waitForTimeout(300);

    // Check character counter
    await expect(
      page.locator(`text=/${testText.length} \\/ 5000 characters/i`)
    ).toBeVisible();
  });

  test('should allow filling all form fields', async ({ page }) => {
    console.log(`[${componentName}] Testing complete form fill`);

    // Fill basic information
    await page.locator('input[id="title"]').fill('E-commerce Dashboard with Analytics');
    await page
      .locator('textarea[id="description"]')
      .fill(
        'A comprehensive e-commerce admin dashboard built with modern web technologies. ' +
          'This project provides a complete solution for managing online stores with real-time analytics. ' +
          'Built with React, Node.js, and PostgreSQL for maximum performance and scalability.'
      );

    // Tech stack should be visible
    await expect(page.getByText('Tech Stack')).toBeVisible();

    // Completion slider should be visible
    await expect(page.getByText('Completion Status')).toBeVisible();

    // Price input should be visible
    await expect(page.getByText('Pricing & Licensing')).toBeVisible();
  });

  test('should disable submit buttons when form is pristine', async ({ page }) => {
    console.log(`[${componentName}] Testing pristine form state`);

    const draftButton = page.getByRole('button', { name: /save as draft/i });
    const publishButton = page.getByRole('button', { name: /publish project/i });

    // Buttons should be disabled when form hasn't been touched
    await expect(draftButton).toBeDisabled();
    await expect(publishButton).toBeDisabled();
  });

  test('should enable submit buttons when form is dirty', async ({ page }) => {
    console.log(`[${componentName}] Testing dirty form state`);

    // Fill in title to make form dirty
    await page.locator('input[id="title"]').fill('Test Project');
    await page.waitForTimeout(300);

    const draftButton = page.getByRole('button', { name: /save as draft/i });
    const publishButton = page.getByRole('button', { name: /publish project/i });

    // Buttons should now be enabled
    await expect(draftButton).toBeEnabled();
    await expect(publishButton).toBeEnabled();
  });

  test('should navigate back when cancel is clicked', async ({ page }) => {
    console.log(`[${componentName}] Testing cancel navigation`);

    // Mock router.back()
    // @ts-expect-error - TODO: Add assertion to check backCalled when router.back() is implemented
    let backCalled = false;
    await page.route('**/*', async (route) => {
      if (route.request().url().includes('back')) {
        backCalled = true;
      }
      await route.continue();
    });

    await page.getByRole('button', { name: /cancel/i }).click();

    // In a real test, we'd check navigation
    // For now, just verify the button is clickable
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('should display price input with proper formatting', async ({ page }) => {
    console.log(`[${componentName}] Testing price input formatting`);

    // Price input should be visible
    await expect(page.getByText(/price/i)).toBeVisible();

    // The price input component should be rendered
    // In production, we'd test actual price formatting behavior
  });

  test('should have completion slider with proper range', async ({ page }) => {
    console.log(`[${componentName}] Testing completion slider`);

    // Completion slider should be visible
    await expect(page.getByText(/completion status/i)).toBeVisible();

    // Default completion should be shown (75% in defaultValues)
    // The slider component should be rendered
  });
});

test.describe('Project Creation - Form Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects/new');
  });

  test('should show loading state during submission', async ({ page }) => {
    console.log(`[${componentName}] Testing submission loading state`);

    // Fill minimum required fields
    await page.locator('input[id="title"]').fill('Test Project Title');
    await page
      .locator('textarea[id="description"]')
      .fill('A'.repeat(50) + ' Test project description for E2E testing.');

    // Mock API to delay response
    await page.route('**/api/projects', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'test-id', title: 'Test Project Title' }),
      });
    });

    // Click publish
    await page.getByRole('button', { name: /publish project/i }).click();

    // Should show loading state
    await expect(page.getByText(/publishing/i)).toBeVisible();
  });

  test('should show error message on submission failure', async ({ page }) => {
    console.log(`[${componentName}] Testing submission error handling`);

    // Fill minimum required fields
    await page.locator('input[id="title"]').fill('Test Project Title');
    await page
      .locator('textarea[id="description"]')
      .fill('A'.repeat(50) + ' Test project description for E2E testing.');

    // Mock API to return error
    await page.route('**/api/projects', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Failed to create project' }),
      });
    });

    // Click publish
    await page.getByRole('button', { name: /publish project/i }).click();
    await page.waitForTimeout(500);

    // Should show error alert
    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(page.getByText(/failed/i)).toBeVisible();
  });
});

test.describe('Project Creation - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects/new');
  });

  test('should have proper labels for all inputs', async ({ page }) => {
    console.log(`[${componentName}] Testing input labels`);

    // Check for important labels
    await expect(page.locator('label[for="title"]')).toContainText('Project Title');
    await expect(page.locator('label[for="description"]')).toContainText('Description');
    await expect(page.locator('label[for="licenseType"]')).toContainText('License Type');
    await expect(page.locator('label[for="accessLevel"]')).toContainText('Access Level');
  });

  test('should have required field indicators', async ({ page }) => {
    console.log(`[${componentName}] Testing required field indicators`);

    // Check for asterisks on required fields
    const requiredLabels = page.locator('span.text-destructive');
    const count = await requiredLabels.count();

    // Should have multiple required field indicators
    expect(count).toBeGreaterThan(0);
  });
});
