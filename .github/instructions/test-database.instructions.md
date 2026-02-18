---
---

# Test Database Setup

Integration tests use a **separate test database** on different ports.

## Database Ports

| Environment | Postgres | Redis |
| ----------- | -------- | ----- |
| Development | 5444     | 6390  |
| Test        | 5445     | 6391  |

**Never run tests against the development database.**

## Quick Commands

```bash
# Start test DB (Postgres + Redis)
npm run test:db:setup

# Stop test DB
npm run test:db:stop

# Reset test DB (stop + start fresh)
npm run test:db:reset

# Run all tests with DB (setup → test → teardown)
npm run test:with-db
```

## Test Database Connection

```bash
# Postgres
postgresql://projectfinish_test:password_test@localhost:5445/projectfinish_test

# Redis
redis://localhost:6391
```

## Manual Setup

```bash
# 1. Start test containers
docker-compose -f docker-compose.test.yml up -d

# 2. Wait for database
timeout 30 bash -c 'until docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U projectfinish_test > /dev/null 2>&1; do sleep 1; done'

# 3. Run migrations
DATABASE_URL="postgresql://projectfinish_test:password_test@localhost:5445/projectfinish_test" npx prisma migrate deploy

# 4. Run tests
npm run test:ci

# 5. Clean up
docker-compose -f docker-compose.test.yml down -v
```

## Integration Test Example

```typescript
// lib/repositories/__tests__/UserRepository.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { userRepository } from '../UserRepository';

describe('UserRepository (Integration)', () => {
  beforeAll(async () => {
    // Test DB should already be running via npm run test:db:setup
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    // Disconnect after all tests
    await prisma.$disconnect();
  });

  it('should create user in database', async () => {
    const user = await userRepository.createUser({
      email: 'test@example.com',
      username: 'testuser',
    });

    expect(user.id).toBeDefined();

    // Verify in database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(dbUser).toBeTruthy();
  });
});
```

## CI/CD Usage

```yaml
# .github/workflows/test.yml
- name: Run tests with database
  run: npm run test:with-db
```

This command:

1. Starts test containers
2. Runs migrations
3. Executes all tests
4. Cleans up containers

## Key Rules

✅ **Always:**

- Start test DB before integration tests
- Use separate ports (5445, 6391)
- Clean up test data in `beforeEach`
- Disconnect in `afterAll`

❌ **Never:**

- Run tests against dev database (port 5444)
- Run tests against production
- Commit test database data
- Share test DB between parallel runs
- Leave test containers running

## Troubleshooting

**Port conflict (5445 already in use):**

```bash
npm run test:db:stop  # Stop previous containers
npm run test:db:setup # Restart
```

**Migrations out of sync:**

```bash
npm run test:db:reset  # Wipe and rebuild
```

**Tests hang on database calls:**

- Check test DB is running: `docker ps | grep postgres-test`
- Check connection: `DATABASE_URL="..." npx prisma migrate status`
