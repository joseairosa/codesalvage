# Load Testing Guide - CodeSalvage

This directory contains load testing scripts using [k6](https://k6.io/) to validate production performance.

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Windows (via Chocolatey)
choco install k6

# Linux
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Test Scenarios

### 1. Homepage Load Test

Tests homepage performance under load.

**Target**: 100 concurrent users for 5 minutes
**Expected**: P95 response time < 2s

```bash
k6 run homepage-load-test.js
```

### 2. Search API Load Test

Tests search functionality under heavy load.

**Target**: 50 concurrent users for 3 minutes
**Expected**: P95 response time < 500ms

```bash
k6 run search-api-load-test.js
```

### 3. Payment Flow Load Test

Tests payment intent creation under moderate load.

**Target**: 20 concurrent authenticated users for 2 minutes
**Expected**: P95 response time < 3s

```bash
k6 run payment-flow-load-test.js
```

### 4. Spike Test

Tests system behavior during traffic spikes.

**Target**: 0 → 200 users → 0 over 10 minutes
**Expected**: No errors, graceful degradation

```bash
k6 run spike-test.js
```

## Environment Variables

Create a `.env.k6` file:

```bash
# Production URL
BASE_URL=https://codesalvage.com

# Test user credentials (GitHub OAuth)
TEST_USER_EMAIL=your-test-user@example.com

# API tokens for authenticated requests
TEST_AUTH_TOKEN=your-auth-token-here
```

## Performance Targets

| Metric               | Target  | Critical |
| -------------------- | ------- | -------- |
| Homepage (P95)       | < 2.0s  | < 3.0s   |
| Search API (P95)     | < 500ms | < 1.0s   |
| Project Detail (P95) | < 1.5s  | < 2.5s   |
| Payment Intent (P95) | < 3.0s  | < 5.0s   |
| API Error Rate       | < 0.1%  | < 1.0%   |
| Database Queries     | < 100ms | < 200ms  |

## Running Load Tests

### Development

```bash
# Run against local environment
BASE_URL=http://localhost:3011 k6 run homepage-load-test.js
```

### Staging

```bash
# Run against staging environment
BASE_URL=https://staging-codesalvage.railway.app k6 run homepage-load-test.js
```

### Production (CAREFUL)

```bash
# Run with reduced load for production smoke test
BASE_URL=https://codesalvage.com k6 run --vus 10 --duration 1m homepage-load-test.js
```

## Interpreting Results

### Good Results ✅

```
✓ http_req_duration.............avg=450ms  p95=800ms
✓ http_req_failed...............0.00%
✓ http_reqs.....................5000
```

### Warning Results ⚠️

```
✓ http_req_duration.............avg=1.2s   p95=2.8s
✗ http_req_failed...............0.15%
✓ http_reqs.....................4800
```

### Critical Issues ❌

```
✗ http_req_duration.............avg=5.2s   p95=15s
✗ http_req_failed...............5.4%
✗ http_reqs.....................2000
```

## Monitoring During Tests

1. **Honeybadger Dashboard** - Watch for error spikes
2. **Railway Metrics** - Monitor CPU, memory, database connections
3. **Redis Metrics** - Check cache hit rate, memory usage
4. **Database Performance** - Monitor slow query logs

## Common Issues

### Rate Limiting Triggered

If you see 429 errors, reduce VUs or increase duration:

```bash
k6 run --vus 20 --duration 5m homepage-load-test.js
```

### Database Connection Pool Exhausted

Check Railway Postgres metrics and adjust `connection_limit` in Prisma.

### Redis Memory Full

Monitor Redis memory usage and adjust TTLs if needed.

## Load Testing Best Practices

1. **Start Small**: Begin with 10 VUs, gradually increase
2. **Monitor**: Watch metrics in real-time during tests
3. **Test Off-Peak**: Run production tests during low traffic periods
4. **Clean Data**: Use test data, clean up after tests
5. **Document Results**: Save results for comparison over time

## CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Run Load Tests
  run: |
    k6 run --vus 10 --duration 30s tests/load-testing/homepage-load-test.js
```

## Results Storage

Results are stored in:

- `results/` directory (gitignored)
- Export to InfluxDB/Grafana for long-term tracking (optional)

---

**Created**: January 28, 2026
**Last Updated**: January 28, 2026
