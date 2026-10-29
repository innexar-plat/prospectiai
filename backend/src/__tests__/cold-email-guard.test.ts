jest.mock('node:dns/promises', () => ({ resolveMx: jest.fn() }));
import { resolveMx } from 'node:dns/promises';
import { brtDayStart, domainAcceptsMail, htmlToText, isBusinessHoursBrt, isRiskyRecipient, perRunQuota, warmupDailyCap } from '@/lib/cold-email-guard';

const mockMx = resolveMx as unknown as jest.Mock;
const D = (iso: string) => new Date(iso);

describe('warmupDailyCap', () => {
    it('ramps 15 → 30 → 60 → configured ceiling (max 120)', () => {
        const start = D('2026-11-02T12:00:00Z');
        expect(warmupDailyCap(null, start, 200)).toBe(15);
        expect(warmupDailyCap(start, D('2026-11-05T12:00:00Z'), 200)).toBe(15);
        expect(warmupDailyCap(start, D('2026-11-10T12:00:00Z'), 200)).toBe(30);
        expect(warmupDailyCap(start, D('2026-11-17T12:00:00Z'), 200)).toBe(60);
        expect(warmupDailyCap(start, D('2026-12-01T12:00:00Z'), 200)).toBe(120);
        expect(warmupDailyCap(start, D('2026-12-01T12:00:00Z'), 80)).toBe(80);
        expect(warmupDailyCap(null, start, 10)).toBe(10);
    });
});

describe('isRiskyRecipient', () => {
    it.each(['nfe@empresa.com.br', 'fiscal@empresa.com.br', 'contabilidade.silva@gmail.com', 'joao@escritoriocontabil.com.br', 'xml.notas@x.com.br', 'noreply@x.com', 'invalido'])('flags %s', (e) => {
        expect(isRiskyRecipient(e)).toBe(true);
    });
    it.each(['joao@padariasol.com.br', 'contato@clinica.com.br', 'maria.souza@gmail.com', 'comercial@distribuidora.com.br'])('accepts %s', (e) => {
        expect(isRiskyRecipient(e)).toBe(false);
    });
});

describe('domainAcceptsMail', () => {
    it('requires an MX record and caches per domain', async () => {
        mockMx.mockResolvedValueOnce([{ exchange: 'mx.a.com', priority: 10 }]).mockRejectedValueOnce(new Error('ENOTFOUND'));
        expect(await domainAcceptsMail('x@empresa-a.com.br')).toBe(true);
        expect(await domainAcceptsMail('y@empresa-a.com.br')).toBe(true);
        expect(await domainAcceptsMail('z@morta.com.br')).toBe(false);
        expect(mockMx).toHaveBeenCalledTimes(2);
    });
});

describe('business hours and quota', () => {
    it('sends Mon–Fri 09:00–17:59 Brasília only', () => {
        expect(isBusinessHoursBrt(D('2026-11-03T13:00:00Z'))).toBe(true); // Tue 10:00 BRT
        expect(isBusinessHoursBrt(D('2026-11-03T21:30:00Z'))).toBe(false); // Tue 18:30 BRT
        expect(isBusinessHoursBrt(D('2026-11-07T14:00:00Z'))).toBe(false); // Sat
        expect(brtDayStart(D('2026-11-03T02:00:00Z')).toISOString()).toBe('2026-11-02T03:00:00.000Z');
    });

    it('spreads the remaining quota over the runs left today', () => {
        expect(perRunQuota(15, D('2026-11-03T12:00:00Z'))).toBe(1); // 09:00 BRT, 18 runs left
        expect(perRunQuota(10, D('2026-11-03T20:30:00Z'))).toBe(10); // 17:30 BRT, last run
        expect(perRunQuota(0, D('2026-11-03T12:00:00Z'))).toBe(0);
    });
});

describe('htmlToText', () => {
    it('keeps links and paragraphs readable', () => {
        expect(htmlToText('<p>Olá <b>Ana</b></p><p>Veja <a href="https://x.com">aqui</a></p><img src="p.gif">'))
            .toBe('Olá Ana\nVeja aqui (https://x.com)');
    });
});
