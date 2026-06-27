import { describe, it, expect } from 'vitest';
import { resolveRdOAuthErrorMessage } from './integrations-rd';

const t = (key: string) => key;

describe('resolveRdOAuthErrorMessage', () => {
    it('maps unauthorized to session message', () => {
        expect(resolveRdOAuthErrorMessage('unauthorized', t)).toBe('page.integracoes.toast.rdErrorUnauthorized');
    });

    it('maps oauth failures to reconnect message', () => {
        expect(resolveRdOAuthErrorMessage('oauth_callback_failed', t)).toBe('page.integracoes.toast.rdErrorReconnect');
        expect(resolveRdOAuthErrorMessage('missing_code_or_state', t)).toBe('page.integracoes.toast.rdErrorReconnect');
        expect(resolveRdOAuthErrorMessage(null, t)).toBe('page.integracoes.toast.rdErrorReconnect');
    });
});
