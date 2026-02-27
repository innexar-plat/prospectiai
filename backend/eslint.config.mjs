import nextConfig from 'eslint-config-next';

export default [
  ...nextConfig,
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
  },
];
