import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { AuthLayout } from './AuthLayout';

describe('AuthLayout', () => {
  it('renders form title and subtitle', () => {
    renderWithProviders(
      <AuthLayout
        formTitle="Sign in"
        formSubtitle="Enter your credentials"
        sideTitle="Welcome"
        sideDescription="Description text"
      >
        <div>Form content</div>
      </AuthLayout>
    );
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Enter your credentials')).toBeInTheDocument();
    expect(screen.getByText('Form content')).toBeInTheDocument();
  });

  it('renders side title and description', () => {
    renderWithProviders(
      <AuthLayout
        formTitle="Form"
        formSubtitle="Sub"
        sideTitle={<span>Side Title</span>}
        sideDescription="Side desc"
      >
        <div />
      </AuthLayout>
    );
    expect(screen.getByText('Side Title')).toBeInTheDocument();
    expect(screen.getByText('Side desc')).toBeInTheDocument();
  });
});
