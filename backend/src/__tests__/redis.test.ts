jest.mock('ioredis', () => {
  const mockGet = jest.fn();
  const mockSet = jest.fn();
  const mockConnect = jest.fn().mockResolvedValue(undefined);
  return jest.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
    connect: mockConnect,
    on: jest.fn(),
  }));
});

const Redis = require('ioredis');

describe('redis lib', () => {
  beforeEach(() => { jest.resetModules(); });
  it('getCached returns null when Redis not configured', async () => {
    const orig = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    jest.isolateModules(() => {
      const redis = require('@/lib/redis');
      Redis.mockImplementation(() => ({ connect: () => Promise.reject(new Error('connect')), get: () => null, set: () => null, on: () => {} }));
      return redis.getCached('key').then((v) => {
        expect(v).toBeNull();
      });
    });
    if (orig !== undefined) process.env.REDIS_URL = orig;
  });
});
