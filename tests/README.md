# Testing Guide

Comprehensive testing setup for CodeSalvage marketplace with unit tests, integration tests, and E2E tests.

## Quick Start

```bash
# Run unit tests (fast, no database required)
npm run test:ci

# Run integration tests (require test database)
npm run test:db:setup        # Start test database
npm run test:integration     # Run integration tests
npm run test:db:stop         # Clean up

# Run all tests with database (CI)
npm run test:with-db

# Run tests in watch mode
npm run test:watch           # Unit tests only
npm run test:integration:watch  # Integration tests only

# Check coverage
npm run test:coverage
npm run test:integration:coverage
```

## Testing Architecture

### Test Types

#### 1. Unit Tests (`lib/**/__tests__/*.test.ts`)

- **Purpose**: Test individual functions/classes in isolation
- **Database**: Mocked (no real database)
- **Speed**: Very fast (~10-50ms per test)
- **When to use**: Services, utilities, business logic, pure functions
- **Example**: `lib/services/__tests__/EmailService.test.ts`

```typescript
// Unit test example
import { describe, it, expect, vi } from 'vitest';
import { EmailService } from '../EmailService';

// Mock external dependencies
vi.mock('@sendgrid/mail', () => ({
  default: { send: vi.fn() },
}));

describe('EmailService', () => {
  it('should send email', async () => {
    // Test with mocks
  });
});
```

#### 2. Integration Tests (`tests/integration/*.integration.test.ts`)

- **Purpose**: Test database operations and API interactions
- **Database**: Real PostgreSQL test database
- **Speed**: Medium (~100-500ms per test)
- **When to use**: Repositories, database queries, API routes
- **Example**: `tests/integration/UserRepository.integration.test.ts`

```typescript
// Integration test example
import { setupTestDatabase, cleanDatabase } from '@/tests/helpers/db';
import { createTestUser } from '@/tests/helpers/fixtures';
import { userRepository } from '@/lib/repositories/UserRepository';

describe('UserRepository (Integration)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should create user in database', async () => {
    const user = await userRepository.createUser({...});
    expect(user.id).toBeDefined();
  });
});
```

#### 3. E2E Tests (`e2e/*.spec.ts`)

- **Purpose**: Test complete user journeys
- **Browser**: Real browser (Playwright)
- **Speed**: Slow (~1-5s per test)
- **When to use**: Critical user flows, full application tests
- **Example**: Authentication flow, purchase flow

## Test Database Setup

### Architecture

- **Separate database**: `codesalvage_test` (port 5445)
- **Separate Redis**: `redis://localhost:6391`
- **Ephemeral storage**: Uses tmpfs (in-memory) for speed
- **Isolated**: Never touches development database

### Commands

```bash
# Start test database containers
npm run test:db:setup

# Stop and clean up
npm run test:db:stop

# Reset database (wipe and restart)
npm run test:db:reset

# Manual setup
docker-compose -f docker-compose.test.yml up -d
DATABASE_URL="postgresql://codesalvage_test:password_test@localhost:5445/codesalvage_test" \
  npx prisma migrate deploy
```

### Connection Details

- **Host**: localhost
- **Port**: 5445 (dev is 5444)
- **Database**: codesalvage_test
- **User**: codesalvage_test
- **Password**: password_test
- **URL**: `postgresql://codesalvage_test:password_test@localhost:5445/codesalvage_test`

## Test Helpers

### Database Helpers (`tests/helpers/db.ts`)

```typescript
import {
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from '@/tests/helpers/db';

// Setup connection (call in beforeAll)
await setupTestDatabase();

// Clean data between tests (call in beforeEach)
await cleanDatabase();

// Disconnect (call in afterAll)
await teardownTestDatabase();

// Transaction helper for rollback
await withTransaction(async (tx) => {
  // Operations here auto-rollback after test
});
```

### Test Fixtures (`tests/helpers/fixtures.ts`)

```typescript
import {
  createTestUser,
  createTestSeller,
  createTestProject,
} from '@/tests/helpers/fixtures';

// Create test user with defaults
const user = await createTestUser();

// Create with overrides
const seller = await createTestSeller({
  email: 'custom@example.com',
  username: 'customuser',
});

// Create project
const project = await createTestProject({
  sellerId: seller.id,
  priceCents: 50000,
});

// Create complete scenario
const { seller, buyer, project, transaction, review } =
  await createCompleteTestScenario();
```

## Test Patterns

### Unit Test Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ServiceName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle happy path', () => {
      // Arrange
      const input = { ... };

      // Act
      const result = service.methodName(input);

      // Assert
      expect(result).toBe(expected);
    });

    it('should handle error case', () => {
      // Test error handling
    });

    it('should validate input', () => {
      // Test validation
    });
  });
});
```

### Integration Test Pattern

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from '@/tests/helpers/db';

describe('Repository (Integration)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(); // Ensure test isolation
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('should perform database operation', async () => {
    // Real database test
    const result = await repository.method();
    expect(result).toBeDefined();
  });
});
```

### API Route Test Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/route';

describe('API Route', () => {
  it('should return 200 for valid request', async () => {
    const request = new Request('http://localhost:3011/api/route', {
      method: 'POST',
      body: JSON.stringify({ ... })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

## Coverage Requirements

- **Lines**: 70% minimum
- **Functions**: 70% minimum
- **Branches**: 70% minimum
- **Statements**: 70% minimum

```bash
# Check coverage
npm run test:coverage           # Unit tests
npm run test:integration:coverage  # Integration tests
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run all tests with database
        run: npm run test:with-db
```

## Debugging Tests

### Run specific test file

```bash
# Unit test
npm run test:ci lib/services/__tests__/EmailService.test.ts

# Integration test
npm run test:integration tests/integration/UserRepository.integration.test.ts
```

### Run specific test case

```bash
# By test name pattern
npm run test:ci -- -t "should send email"

# With verbose output
npm run test:ci -- --reporter=verbose
```

### Watch mode for development

```bash
# Watch unit tests
npm run test:watch

# Watch integration tests (requires test DB running)
npm run test:db:setup
npm run test:integration:watch
```

## Best Practices

### ✅ DO:

- Write tests BEFORE implementation (TDD)
- Use descriptive test names ("should create user when valid data provided")
- Test both happy paths and error cases
- Clean database between tests (beforeEach)
- Use test fixtures for consistent test data
- Mock external dependencies (SendGrid, Stripe, etc.)
- Run integration tests against test database only
- Keep tests fast (unit tests < 50ms, integration < 500ms)

### ❌ DON'T:

- Run tests against development database
- Run tests against production database
- Share test data between test cases
- Leave test database running when not testing
- Mock the database in integration tests
- Commit test database data to git
- Skip tests in CI
- Use real API keys in tests

## Troubleshooting

### Test database connection failed

```bash
# Verify test database is running
docker ps | grep postgres-test

# Restart test database
npm run test:db:reset

# Check logs
docker logs recycleai-postgres-test-1
```

### Tests fail with "Connection refused"

- Test database not started: Run `npm run test:db:setup`
- Wrong port: Test DB is on 5445, not 5444
- Check `tests/setup.ts` has correct DATABASE_URL

### Tests are slow

- Use unit tests instead of integration tests where possible
- Clean database efficiently (truncate instead of delete)
- Use transactions for test isolation
- Run integration tests sequentially (configured in vitest.integration.config.ts)

### Coverage not meeting threshold

- Write more tests for uncovered code
- Check coverage report: `open coverage/index.html`
- Focus on critical paths first (authentication, payments, etc.)

## File Structure

```
tests/
├── README.md                     # This file
├── setup.ts                      # Global test setup
├── test-db-setup.sh             # Start test database
├── test-db-teardown.sh          # Stop test database
├── helpers/
│   ├── db.ts                    # Database test helpers
│   ├── fixtures.ts              # Test data factories
│   └── index.ts                 # Helper exports
└── integration/
    └── *.integration.test.ts    # Integration tests

lib/
├── services/__tests__/          # Service unit tests
├── repositories/__tests__/      # Repository unit tests
└── utils/__tests__/             # Utility unit tests

e2e/
└── *.spec.ts                    # E2E tests
```

## Example Test Commands Cheat Sheet

```bash
# Development
npm run test:watch              # Watch unit tests
npm run test:integration:watch  # Watch integration tests (requires DB)

# CI/CD
npm run test:ci                 # Run unit tests once
npm run test:integration        # Run integration tests once
npm run test:with-db            # Full test cycle with DB setup/teardown
npm run test:all                # All tests (unit + integration)

# Coverage
npm run test:coverage           # Unit test coverage
npm run test:integration:coverage  # Integration test coverage

# Database Management
npm run test:db:setup           # Start test database
npm run test:db:stop            # Stop test database
npm run test:db:reset           # Reset test database

# E2E Tests
npm run test:e2e                # Run E2E tests
npm run test:e2e:ui             # E2E with UI
npm run test:e2e:debug          # E2E with debugger
```

## Questions?

See CLAUDE.md for comprehensive TDD guidelines and testing requirements.
