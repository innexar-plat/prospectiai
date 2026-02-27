/**
 * Unit tests for structured logger and getRequestId
 */

import { logger, getRequestId } from '@/lib/logger';

describe('logger', () => {
    let stderrWrite: jest.SpyInstance;
    let stdoutWrite: jest.SpyInstance;

    beforeEach(() => {
        stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
        stdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
        stderrWrite.mockRestore();
        stdoutWrite.mockRestore();
    });

    it('info writes JSON to stdout with level and message', () => {
        logger.info('test message');
        expect(stdoutWrite).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(stdoutWrite.mock.calls[0][0]);
        expect(payload.level).toBe('info');
        expect(payload.message).toBe('test message');
        expect(payload.timestamp).toBeDefined();
    });

    it('info includes meta when provided', () => {
        logger.info('msg', { key: 'value' });
        const payload = JSON.parse(stdoutWrite.mock.calls[0][0]);
        expect(payload.key).toBe('value');
    });

    it('warn writes JSON to stdout', () => {
        logger.warn('warning');
        const payload = JSON.parse(stdoutWrite.mock.calls[0][0]);
        expect(payload.level).toBe('warn');
        expect(payload.message).toBe('warning');
    });

    it('error writes JSON to stderr', () => {
        logger.error('error message', { err: 'detail' });
        expect(stderrWrite).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(stderrWrite.mock.calls[0][0]);
        expect(payload.level).toBe('error');
        expect(payload.message).toBe('error message');
        expect(payload.err).toBe('detail');
    });
});

describe('getRequestId', () => {
    it('returns header value when x-request-id is present', () => {
        const req = { headers: { get: (name: string) => (name === 'x-request-id' ? 'req-123' : null) } };
        expect(getRequestId(req)).toBe('req-123');
    });

    it('returns undefined when x-request-id is missing', () => {
        const req = { headers: { get: () => null } };
        expect(getRequestId(req)).toBeUndefined();
    });

    it('returns undefined when header is empty string', () => {
        const req = { headers: { get: (name: string) => (name === 'x-request-id' ? '' : null) } };
        expect(getRequestId(req)).toBeUndefined();
    });
});
