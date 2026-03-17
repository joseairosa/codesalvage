import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSubmitPayoutDetails } = vi.hoisted(() => ({
  mockSubmitPayoutDetails: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('@/lib/services/PayoutService', () => ({
  PayoutService: vi.fn().mockImplementation(() => ({
    submitPayoutDetails: mockSubmitPayoutDetails,
  })),
  PayoutValidationError: class extends Error {
    field: string | undefined;
    constructor(message: string, field?: string) {
      super(message);
      this.name = 'PayoutValidationError';
      this.field = field;
    }
  },
}));

vi.mock('@/lib/services', () => ({
  emailService: {},
}));

import { authenticateApiRequest } from '@/lib/api-auth';
import { POST } from '../route';

const mockAuth = authenticateApiRequest as ReturnType<typeof vi.fn>;

describe('POST /api/seller/onboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const request = new Request('http://localhost/api/seller/onboard', {
      method: 'POST',
      body: JSON.stringify({ payoutMethod: 'paypal', payoutEmail: 'test@paypal.com' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 for missing payoutEmail', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = new Request('http://localhost/api/seller/onboard', {
      method: 'POST',
      body: JSON.stringify({ payoutMethod: 'paypal' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid email format', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    const { PayoutValidationError } = await import('@/lib/services/PayoutService');
    mockSubmitPayoutDetails.mockRejectedValue(
      new PayoutValidationError('Invalid email format', 'payoutEmail')
    );

    const request = new Request('http://localhost/api/seller/onboard', {
      method: 'POST',
      body: JSON.stringify({
        payoutMethod: 'paypal',
        payoutEmail: 'not-an-email',
        acceptedTerms: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 200 on successful onboarding', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockSubmitPayoutDetails.mockResolvedValue({
      id: 'ulid-1',
      userId: 'user-1',
      payoutMethod: 'paypal',
      payoutEmail: 'seller@paypal.com',
      isActive: true,
    });

    const request = new Request('http://localhost/api/seller/onboard', {
      method: 'POST',
      body: JSON.stringify({
        payoutMethod: 'paypal',
        payoutEmail: 'seller@paypal.com',
        acceptedTerms: true,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.payoutEmail).toBe('seller@paypal.com');
    expect(data.isVerifiedSeller).toBe(true);
  });

  it('should return 400 when terms not accepted', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = new Request('http://localhost/api/seller/onboard', {
      method: 'POST',
      body: JSON.stringify({
        payoutMethod: 'paypal',
        payoutEmail: 'seller@paypal.com',
        acceptedTerms: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
