import '@testing-library/jest-dom';
declare module 'vitest' {
  interface Assertion {
    toHaveNoViolations(): void;
  }
}
