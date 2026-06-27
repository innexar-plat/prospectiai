import { vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

vi.mock('@testing-library/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@testing-library/react')>();
    const { render: rtlRender } = actual;
    const { I18nProvider } = await import('@/contexts/I18nContext');

    function wrapWithI18n(ui: ReactElement, options?: Parameters<typeof rtlRender>[1]) {
        const UserWrapper = options?.wrapper;
        function Wrapper({ children }: { children: ReactNode }) {
            const inner = UserWrapper ? <UserWrapper>{children}</UserWrapper> : children;
            return <I18nProvider>{inner}</I18nProvider>;
        }
        return rtlRender(ui, { ...options, wrapper: Wrapper });
    }

    return {
        ...actual,
        render: wrapWithI18n,
    };
});
