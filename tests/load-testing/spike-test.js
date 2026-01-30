/**
 * Spike Test
 *
 * Tests system behavior during sudden traffic spikes.
 * Simulates sudden increase from 0 to 200 users and back to 0.
 * Tests rate limiting, database connection pooling, and system recovery.
 *
 * Run:
 * k6 run spike-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const rateLimitHits = new Counter('rate_limit_hits');
const serverErrors = new Counter('server_errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Normal load
    { duration: '30s', target: 200 }, // Spike to 200 users
    { duration: '1m', target: 200 }, // Hold spike
    { duration: '30s', target: 10 }, // Drop back to normal
    { duration: '30s', target: 0 }, // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% should be below 5s (relaxed for spike)
    http_req_failed: ['rate<0.05'], // Less than 5% errors (relaxed for spike)
    errors: ['rate<0.05'], // Less than 5% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3011';

// Mixed workload to simulate real traffic
const endpoints = [
  { path: '/', weight: 0.3 },
  { path: '/projects', weight: 0.25 },
  { path: '/api/projects?page=1&limit=20', weight: 0.2 },
  { path: '/api/featured', weight: 0.15 },
  { path: '/api/subscriptions/pricing', weight: 0.1 },
];

function selectEndpoint() {
  const random = Math.random();
  let cumulative = 0;

  for (const endpoint of endpoints) {
    cumulative += endpoint.weight;
    if (random <= cumulative) {
      return endpoint.path;
    }
  }

  return endpoints[0].path;
}

export default function () {
  const endpoint = selectEndpoint();
  const url = `${BASE_URL}${endpoint}`;

  const res = http.get(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '10s', // Increased timeout for spike test
  });

  // Track rate limiting
  if (res.status === 429) {
    rateLimitHits.add(1);
  }

  // Track server errors
  if (res.status >= 500) {
    serverErrors.add(1);
  }

  // Validate response
  const check_result = check(res, {
    'status is not 500': (r) => r.status !== 500,
    'status is not timeout': (r) => r.status !== 0,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  errorRate.add(!check_result);

  // Minimal sleep during spike test
  sleep(Math.random() * 1 + 0.5); // Random sleep between 0.5-1.5 seconds
}

export function handleSummary(data) {
  return {
    'results/spike-test-summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';

  let summary = '\n';
  summary += `${indent}✓ Spike Test Results\n`;
  summary += `${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Requests
  const reqDuration = data.metrics.http_req_duration;
  summary += `${indent}HTTP Request Duration:\n`;
  summary += `${indent}  avg: ${reqDuration.values.avg.toFixed(2)}ms\n`;
  summary += `${indent}  p50: ${reqDuration.values['p(50)'].toFixed(2)}ms\n`;
  summary += `${indent}  p95: ${reqDuration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}  p99: ${reqDuration.values['p(99)'].toFixed(2)}ms\n`;
  summary += `${indent}  max: ${reqDuration.values.max.toFixed(2)}ms\n\n`;

  // Rate limiting
  const rateLimits = data.metrics.rate_limit_hits;
  if (rateLimits) {
    summary += `${indent}Rate Limit Hits (429): ${rateLimits.values.count}\n`;
  }

  // Server errors
  const serverErrs = data.metrics.server_errors;
  if (serverErrs) {
    summary += `${indent}Server Errors (5xx): ${serverErrs.values.count}\n`;
  }

  // Success rate
  const reqFailed = data.metrics.http_req_failed;
  const successRate = (1 - reqFailed.values.rate) * 100;
  summary += `${indent}Success Rate: ${successRate.toFixed(2)}%\n`;
  summary += `${indent}Total Requests: ${data.metrics.http_reqs.values.count}\n\n`;

  // Thresholds
  summary += `${indent}Thresholds:\n`;
  for (const [name, threshold] of Object.entries(data.thresholds)) {
    const passed = threshold.ok ? '✓' : '✗';
    summary += `${indent}  ${passed} ${name}\n`;
  }

  // Interpretation
  summary += `\n${indent}Spike Test Interpretation:\n`;
  summary += `${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (successRate >= 95) {
    summary += `${indent}✅ EXCELLENT: System handled spike gracefully\n`;
  } else if (successRate >= 90) {
    summary += `${indent}✓ GOOD: System remained stable with minor degradation\n`;
  } else if (successRate >= 85) {
    summary += `${indent}⚠️  WARNING: Significant degradation during spike\n`;
  } else {
    summary += `${indent}❌ CRITICAL: System struggled to handle spike\n`;
  }

  if (rateLimits && rateLimits.values.count > 0) {
    summary += `${indent}ℹ️  Rate limiting engaged (expected behavior)\n`;
  }

  if (serverErrs && serverErrs.values.count > 10) {
    summary += `${indent}⚠️  Server errors detected - investigate logs\n`;
  }

  return summary;
}
