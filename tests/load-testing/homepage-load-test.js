/**
 * Homepage Load Test
 *
 * Simulates 100 concurrent users browsing the homepage for 5 minutes.
 * Tests Next.js SSR performance, Redis caching, and database queries.
 *
 * Run:
 * k6 run homepage-load-test.js
 *
 * With custom params:
 * k6 run --vus 50 --duration 3m homepage-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 20 }, // Ramp up to 20 users
    { duration: '3m', target: 100 }, // Ramp up to 100 users
    { duration: '3m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    errors: ['rate<0.01'], // Less than 1% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3011';

export default function () {
  // Test homepage
  const homepageRes = http.get(`${BASE_URL}/`);

  // Validate response
  const homepageCheck = check(homepageRes, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage loads in < 2s': (r) => r.timings.duration < 2000,
    'homepage has title': (r) => r.body.includes('<title>'),
    'homepage has nav': (r) => r.body.includes('nav'),
  });

  errorRate.add(!homepageCheck);

  // Simulate user reading page
  sleep(Math.random() * 3 + 2); // Random sleep between 2-5 seconds

  // Test projects browse page
  const projectsRes = http.get(`${BASE_URL}/projects`);

  const projectsCheck = check(projectsRes, {
    'projects status is 200': (r) => r.status === 200,
    'projects loads in < 2s': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!projectsCheck);

  // Simulate user browsing
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'results/homepage-load-test-summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  let summary = '\n';
  summary += `${indent}✓ Homepage Load Test Results\n`;
  summary += `${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Requests
  const reqDuration = data.metrics.http_req_duration;
  summary += `${indent}HTTP Request Duration:\n`;
  summary += `${indent}  avg: ${reqDuration.values.avg.toFixed(2)}ms\n`;
  summary += `${indent}  p95: ${reqDuration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}  max: ${reqDuration.values.max.toFixed(2)}ms\n\n`;

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

  return summary;
}
