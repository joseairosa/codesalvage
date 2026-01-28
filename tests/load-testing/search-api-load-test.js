/**
 * Search API Load Test
 *
 * Simulates 50 concurrent users performing searches with various filters.
 * Tests Redis caching, database query performance, and API rate limiting.
 *
 * Run:
 * k6 run search-api-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const cacheHitRate = new Rate('cache_hits');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],  // 95% of requests should be below 500ms
    'http_req_failed': ['rate<0.01'],    // Less than 1% errors
    'errors': ['rate<0.01'],             // Less than 1% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3011';

// Search variations to test
const searchQueries = [
  '?category=web_app&completion=80',
  '?search=react&sort=newest',
  '?search=typescript&minPrice=1000&maxPrice=5000',
  '?techStack=nextjs&techStack=tailwind',
  '?category=mobile&sort=price_low',
  '?completion=100&sort=featured',
  '?search=dashboard',
  '?category=backend&primaryLanguage=javascript',
];

export default function () {
  // Select a random search query
  const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];

  // Perform search
  const searchRes = http.get(`${BASE_URL}/api/projects${query}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Check if response is from cache (custom header if implemented)
  if (searchRes.headers['X-Cache-Hit'] === 'true') {
    cacheHitRate.add(1);
  } else {
    cacheHitRate.add(0);
  }

  // Validate response
  const searchCheck = check(searchRes, {
    'search status is 200': (r) => r.status === 200,
    'search responds in < 500ms': (r) => r.timings.duration < 500,
    'search returns JSON': (r) => r.headers['Content-Type']?.includes('application/json'),
    'search has projects array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.projects);
      } catch (e) {
        return false;
      }
    },
    'search has pagination': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.total !== undefined && body.page !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  errorRate.add(!searchCheck);

  // Simulate user viewing results
  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds

  // Test project detail page (get first project from results)
  try {
    const searchBody = JSON.parse(searchRes.body);
    if (searchBody.projects && searchBody.projects.length > 0) {
      const projectId = searchBody.projects[0].id;
      const projectRes = http.get(`${BASE_URL}/api/projects/${projectId}`);

      const projectCheck = check(projectRes, {
        'project detail status is 200': (r) => r.status === 200,
        'project detail responds in < 500ms': (r) => r.timings.duration < 500,
      });

      errorRate.add(!projectCheck);
    }
  } catch (e) {
    console.error('Error accessing project detail:', e);
  }

  // Simulate user browsing
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'results/search-api-load-test-summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';

  let summary = '\n';
  summary += `${indent}✓ Search API Load Test Results\n`;
  summary += `${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Requests
  const reqDuration = data.metrics.http_req_duration;
  summary += `${indent}HTTP Request Duration:\n`;
  summary += `${indent}  avg: ${reqDuration.values.avg.toFixed(2)}ms\n`;
  summary += `${indent}  p95: ${reqDuration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}  max: ${reqDuration.values.max.toFixed(2)}ms\n\n`;

  // Cache performance
  const cacheHits = data.metrics.cache_hits;
  if (cacheHits) {
    const cacheHitPercentage = cacheHits.values.rate * 100;
    summary += `${indent}Cache Hit Rate: ${cacheHitPercentage.toFixed(2)}%\n\n`;
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

  return summary;
}
