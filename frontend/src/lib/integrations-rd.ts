/** RD Station OAuth callback error messages for Integrações UI. */
export function resolveRdOAuthErrorMessage(reason: string | null, t: (key: string) => string): string {
    if (reason === 'unauthorized') return t('page.integracoes.toast.rdErrorUnauthorized');
    return t('page.integracoes.toast.rdErrorReconnect');
}
