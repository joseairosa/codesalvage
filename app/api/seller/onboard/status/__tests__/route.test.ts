import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    sellerPayoutDetails: {
      findUnique: vi.fn(),
    },
  },
}));

import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { GET } from '../route';

const mockAuth = authenticateApiRequest as ReturnType<typeof vi.fn>;
const mockFindUnique = (prisma as any).sellerPayoutDetails.findUnique as ReturnType<typeof vi.fn>;

describe('GET /api/seller/onboard/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const request = new Request('http://localhost/api/seller/onboard/status');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return isOnboarded=false when no payout details', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/seller/onboard/status');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.isOnboarded).toBe(false);
    expect(data.payoutMethod).toBeNull();
  });

  it('should return isOnboarded=true when active payout details exist', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindUnique.mockResolvedValue({
      id: 'ulid-1',
      userId: 'user-1',
      payoutMethod: 'paypal',
      payoutEmail: 'seller@paypal.com',
      isActive: true,
    });

    const request = new Request('http://localhost/api/seller/onboard/status');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.isOnboarded).toBe(true);
    expect(data.payoutMethod).toBe('paypal');
    expect(data.payoutEmail).toBe('seller@paypal.com');
  });

  it('should return isOnboarded=false when payout details are inactive', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindUnique.mockResolvedValue({
      id: 'ulid-1',
      userId: 'user-1',
      payoutMethod: 'paypal',
      payoutEmail: 'seller@paypal.com',
      isActive: false,
    });

    const request = new Request('http://localhost/api/seller/onboard/status');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.isOnboarded).toBe(false);
  });
});
