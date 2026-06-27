import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';

/** @deprecated Use `render` from `@testing-library/react` — I18nProvider is applied globally in test setup. */
export function renderWithI18n(ui: ReactElement, options?: RenderOptions) {
    return render(ui, options);
}
