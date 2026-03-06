import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';

describe('request-id', () => {
  describe('getOrCreateRequestId', () => {
    it('returns new UUID when req is null', () => {
      const id = getOrCreateRequestId(null);
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('returns new UUID when req is undefined', () => {
      const id = getOrCreateRequestId(undefined);
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('returns new UUID when req has no headers', () => {
      const id = getOrCreateRequestId({});
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('returns new UUID when req.headers has no get', () => {
      const id = getOrCreateRequestId({ headers: {} });
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('returns header value when x-request-id is present and non-empty', () => {
      const id = getOrCreateRequestId({
        headers: { get: (name: string) => (name === 'x-request-id' ? '  client-req-123  ' : null) },
      });
      expect(id).toBe('client-req-123');
    });

    it('returns new UUID when x-request-id is empty string', () => {
      const id = getOrCreateRequestId({
        headers: { get: (name: string) => (name === 'x-request-id' ? '' : null) },
      });
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('returns new UUID when x-request-id is only whitespace', () => {
      const id = getOrCreateRequestId({
        headers: { get: (name: string) => (name === 'x-request-id' ? '   ' : null) },
      });
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('jsonWithRequestId', () => {
    it('returns response with status 200 and x-request-id header', () => {
      const res = jsonWithRequestId({ ok: true }, { requestId: 'req-1' });
      expect(res.status).toBe(200);
      expect(res.headers.get('x-request-id')).toBe('req-1');
      expect(res).toBeInstanceOf(Response);
    });

    it('returns response with given status and x-request-id header', () => {
      const res = jsonWithRequestId({ error: 'Bad request' }, { status: 400, requestId: 'req-2' });
      expect(res.status).toBe(400);
      expect(res.headers.get('x-request-id')).toBe('req-2');
    });

    it('serializes body as JSON', async () => {
      const res = jsonWithRequestId({ data: [1, 2] }, { requestId: 'r' });
      const body = await res.json();
      expect(body).toEqual({ data: [1, 2] });
    });
  });
});
