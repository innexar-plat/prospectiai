import { BRAND_LOGO_ASPECT, BRAND_LOGO_DARK_SRC, BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand';

type Props = {
  /** Height of the logo in px */
  height?: number;
  /** Container class */
  className?: string;
  /** Mark as high priority for LCP */
  priority?: boolean;
  /** If true, removes fixed height and lets the image scale to fill container width */
  fillWidth?: boolean;
  /** 'auto' follows the app theme; 'light'/'dark' force the version for that background. */
  tone?: 'auto' | 'light' | 'dark';
};

const LOGO_HEIGHT_DEFAULT = 40;

export function Logo({ height = LOGO_HEIGHT_DEFAULT, className = '', priority = false, fillWidth = false, tone = 'auto' }: Props) {
  const width = Math.round(height * BRAND_LOGO_ASPECT);
  const base = fillWidth ? 'w-full h-auto' : 'shrink-0 object-contain';
  const sizing = fillWidth ? {} : { style: { height, width }, width, height };
  const fetch = priority ? { fetchPriority: 'high' as const } : {};

  if (tone !== 'auto') {
    return (
      <img src={tone === 'dark' ? BRAND_LOGO_DARK_SRC : BRAND_LOGO_SRC} alt={BRAND_NAME} className={`${base} block ${className}`} {...sizing} {...fetch} />
    );
  }

  return (
    <>
      <img src={BRAND_LOGO_SRC} alt={BRAND_NAME} className={`${base} block dark:hidden ${className}`} {...sizing} {...fetch} />
      <img src={BRAND_LOGO_DARK_SRC} alt={BRAND_NAME} className={`${base} hidden dark:block ${className}`} {...sizing} {...fetch} />
    </>
  );
}
