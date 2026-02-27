import React from 'react';

type Props = {
  className?: string;
  size?: number;
};

export function LogoIcon({ className, size = 32 }: Props) {
  const id = React.useId().replace(/:/g, '');
  const gradId = `logo-grad-${id}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="15" r="11" stroke={`url(#${gradId})`} strokeWidth="2.5" fill="none" />
      <path d="M9 22 L4 30" stroke={`url(#${gradId})`} strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M16 11 L16 19 M12 15 L16 11 L20 15"
        stroke={`url(#${gradId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
