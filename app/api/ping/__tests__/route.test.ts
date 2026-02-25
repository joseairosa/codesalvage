import { describe, it, expect } from 'vitest';
import { GET } from '../route';

describe('GET /api/ping', () => {
  it('should return 200 with ok: true', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });
});
