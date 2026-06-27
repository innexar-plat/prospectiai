import { escapeHtml, sendTelegramAlert } from '@/lib/telegram-alert';

describe('escapeHtml', () => {
    it('escapes &, < and > for Telegram HTML', () => {
        expect(escapeHtml('a & b <script>')).toBe('a &amp; b &lt;script&gt;');
    });

    it('leaves safe characters unchanged', () => {
        expect(escapeHtml('ok_123 (test)')).toBe('ok_123 (test)');
    });
});

describe('sendTelegramAlert', () => {
    const originalFetch = global.fetch;
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    const originalChatId = process.env.TELEGRAM_CHAT_ID;

    beforeEach(() => {
        process.env.TELEGRAM_BOT_TOKEN = 'test-token';
        process.env.TELEGRAM_CHAT_ID = '12345';
        global.fetch = jest.fn().mockResolvedValue({ ok: true });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.TELEGRAM_BOT_TOKEN = originalToken;
        process.env.TELEGRAM_CHAT_ID = originalChatId;
        jest.restoreAllMocks();
    });

    it('sends HTML parse_mode with escaped dynamic content', async () => {
        const ok = await sendTelegramAlert({
            level: 'warning',
            title: 'Test <alert>',
            message: 'Line with & special chars',
            meta: { host: 'a<b' },
        });

        expect(ok).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(init.body as string) as {
            parse_mode: string;
            text: string;
        };

        expect(body.parse_mode).toBe('HTML');
        expect(body.text).toContain('&lt;alert&gt;');
        expect(body.text).toContain('Line with &amp; special chars');
        expect(body.text).toContain('<code>a&lt;b</code>');
        expect(body.text).not.toContain('MarkdownV2');
    });

    it('returns false when Telegram is not configured', async () => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        const ok = await sendTelegramAlert({
            level: 'info',
            title: 'x',
            message: 'y',
        });
        expect(ok).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
