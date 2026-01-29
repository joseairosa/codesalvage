# E2E Tests with Playwright

End-to-end tests for CodeSalvage marketplace using Playwright.

## Setup

Playwright is already installed. Browser binaries are downloaded during setup.

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (visual test runner)
npm run test:e2e:ui

# Run in debug mode (step through tests)
npm run test:e2e:debug

# Run in headed mode (see browser window)
npm run test:e2e:headed
```

## Test Structure

```
e2e/
├── README.md           # This file
├── example.spec.ts     # Example tests (delete after writing real tests)
├── auth.spec.ts        # Authentication tests
├── protected-routes.spec.ts  # Protected route tests
├── utils/
│   └── test-helpers.ts # Helper functions
├── fixtures/
│   └── auth.ts         # Authentication fixtures
└── screenshots/        # Debug screenshots (gitignored)
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad } from './utils/test-helpers';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Arrange
    await navigateTo(page, '/some-page');

    // Act
    await page.click('button[type="submit"]');

    // Assert
    await expect(page).toHaveURL('/expected-url');
  });
});
```

### Using Test Helpers

```typescript
import {
  navigateTo,
  waitForPageLoad,
  fillFormField,
  clickAndWait,
  isAuthenticated,
  isNotAuthenticated,
  cleanupTestUser,
} from './utils/test-helpers';

test('example with helpers', async ({ page }) => {
  await navigateTo(page, '/');
  await fillFormField(page, 'input[name="email"]', 'test@example.com');
  await clickAndWait(page, 'button[type="submit"]');

  const authed = await isAuthenticated(page);
  expect(authed).toBe(true);
});
```

### Cleanup After Tests

```typescript
test.afterEach(async () => {
  // Clean up test data
  await cleanupTestUser('test@example.com');
});
```

## Best Practices

1. **Use Descriptive Test Names**
   - Good: `test('should redirect to sign-in when accessing protected route')`
   - Bad: `test('test1')`

2. **Arrange-Act-Assert Pattern**
   - Arrange: Set up test conditions
   - Act: Perform the action being tested
   - Assert: Verify the expected outcome

3. **Avoid Hard-Coded Waits**
   - Bad: `await page.waitForTimeout(5000)`
   - Good: `await page.waitForSelector('selector')`

4. **Use Page Object Model for Complex Pages**
   - Create classes that represent pages
   - Encapsulate page interactions

5. **Test User Journeys, Not Implementation**
   - Test what users do, not how the code works
   - Focus on business value

6. **Clean Up Test Data**
   - Always clean up test users/data after tests
   - Use `test.afterEach()` for cleanup

## Debugging

### Take Screenshots

```typescript
await page.screenshot({ path: 'e2e/screenshots/debug.png' });
```

### Use Debug Mode

```bash
npm run test:e2e:debug
```

### Inspect Elements

```typescript
const element = await page.locator('selector');
console.log(await element.textContent());
```

### View Test Reports

After running tests, open the HTML report:

```bash
npx playwright show-report
```

## Environment Variables

Tests use environment variables from `.env.test.local`:

- `DATABASE_URL` - Test database connection
- `NEXTAUTH_URL` - Auth callback URL
- `NEXTAUTH_SECRET` - Auth secret
- `AUTH_GITHUB_ID` - GitHub OAuth app ID (test app)
- `AUTH_GITHUB_SECRET` - GitHub OAuth app secret (test app)

## CI/CD Integration

Tests run in CI with the following configuration:

- Single worker (no parallel tests)
- 2 retries for flaky tests
- Screenshots and videos on failure
- HTML report artifact uploaded

## Accessibility Testing

Tests include accessibility checks using axe-core:

```typescript
import { checkAccessibility } from './utils/test-helpers';

test('should be accessible', async ({ page }) => {
  await navigateTo(page, '/');
  await checkAccessibility(page);
});
```

## Cross-Browser Testing

Tests run on:

- Chromium (Chrome/Edge)
- Firefox
- WebKit (Safari)

To run specific browser:

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Mobile Testing

To test mobile viewports, configure in `playwright.config.ts`:

```typescript
{
  name: 'Mobile Chrome',
  use: { ...devices['Pixel 5'] },
}
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
