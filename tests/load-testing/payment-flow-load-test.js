/**
 * Payment Flow Load Test
 *
 * Simulates 20 concurrent authenticated users creating payment intents.
 * Tests Stripe API integration, transaction creation, and database performance.
 *
 * IMPORTANT: This test creates real Stripe test mode payment intents.
 * Ensure you're using test mode API keys.
 *
 * Run:
 * TEST_AUTH_TOKEN=your-token k6 run payment-flow-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const paymentIntentSuccessRate = new Rate('payment_intent_success');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 }, // Ramp up to 5 users
    { duration: '1m', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 }, // Stay at 20 users
    { duration: '30s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests should be below 3s
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    payment_intent_success: ['rate>0.99'], // 99%+ payment intents created successfully
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3011';
const AUTH_TOKEN = __ENV.TEST_AUTH_TOKEN || '';

// Test project IDs (update with actual IDs from your database)
const testProjectIds = ['test-project-id-1', 'test-project-id-2', 'test-project-id-3'];

export default function () {
  if (!AUTH_TOKEN) {
    console.error('TEST_AUTH_TOKEN environment variable is required');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Cookie: `authjs.session-token=${AUTH_TOKEN}`, // Auth.js session token
  };

  // Select a random project
  const projectId = testProjectIds[Math.floor(Math.random() * testProjectIds.length)];

  // 1. Get project details
  const projectRes = http.get(`${BASE_URL}/api/projects/${projectId}`, { headers });

  const projectCheck = check(projectRes, {
    'project fetch status is 200': (r) => r.status === 200,
    'project fetch in < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!projectCheck);
  sleep(1);

  // 2. Create payment intent
  const paymentIntentPayload = JSON.stringify({
    projectId: projectId,
  });

  const paymentIntentRes = http.post(
    `${BASE_URL}/api/transactions/create-payment-intent`,
    paymentIntentPayload,
    { headers }
  );

  const paymentIntentCheck = check(paymentIntentRes, {
    'payment intent status is 200': (r) => r.status === 200,
    'payment intent created in < 3s': (r) => r.timings.duration < 3000,
    'payment intent has client secret': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.clientSecret !== undefined;
      } catch (e) {
        return false;
      }
    },
    'payment intent has transaction ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.transactionId !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  paymentIntentSuccessRate.add(paymentIntentCheck);
  errorRate.add(!paymentIntentCheck);

  // 3. Check transaction status
  try {
    const paymentBody = JSON.parse(paymentIntentRes.body);
    if (paymentBody.transactionId) {
      sleep(1);

      const transactionRes = http.get(
        `${BASE_URL}/api/transactions/${paymentBody.transactionId}`,
        { headers }
      );

      const transactionCheck = check(transactionRes, {
        'transaction fetch status is 200': (r) => r.status === 200,
        'transaction has payment status': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.paymentStatus !== undefined;
          } catch (e) {
            return false;
          }
        },
      });

      errorRate.add(!transactionCheck);
    }
  } catch (e) {
    console.error('Error parsing payment intent response:', e);
  }

  // Simulate user time between purchases
  sleep(Math.random() * 5 + 3); // Random sleep between 3-8 seconds
}

export function handleSummary(data) {
  return {
    'results/payment-flow-load-test-summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';

  let summary = '\n';
  summary += `${indent}✓ Payment Flow Load Test Results\n`;
  summary += `${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Requests
  const reqDuration = data.metrics.http_req_duration;
  summary += `${indent}HTTP Request Duration:\n`;
  summary += `${indent}  avg: ${reqDuration.values.avg.toFixed(2)}ms\n`;
  summary += `${indent}  p95: ${reqDuration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}  max: ${reqDuration.values.max.toFixed(2)}ms\n\n`;

  // Payment intent success rate
  const paymentSuccess = data.metrics.payment_intent_success;
  if (paymentSuccess) {
    const successPercentage = paymentSuccess.values.rate * 100;
    summary += `${indent}Payment Intent Success Rate: ${successPercentage.toFixed(2)}%\n\n`;
  }

  // Success rate
  const reqFailed = data.metrics.http_req_failed;
  const successRate = (1 - reqFailed.values.rate) * 100;
  summary += `${indent}Overall Success Rate: ${successRate.toFixed(2)}%\n`;
  summary += `${indent}Total Requests: ${data.metrics.http_reqs.values.count}\n\n`;

  // Thresholds
  summary += `${indent}Thresholds:\n`;
  for (const [name, threshold] of Object.entries(data.thresholds)) {
    const passed = threshold.ok ? '✓' : '✗';
    summary += `${indent}  ${passed} ${name}\n`;
  }

  summary += `\n${indent}⚠️  NOTE: This test creates real Stripe test mode payment intents.\n`;
  summary += `${indent}   Clean up test transactions after completion.\n`;

  return summary;
}
