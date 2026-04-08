import { useTheme } from '@/contexts/ThemeContext';

type Props = {
  /** Height of the logo in px */
  height?: number;
  /** Container class */
  className?: string;
  /** Mark as high priority for LCP */
  priority?: boolean;
};

const LOGO_HEIGHT_DEFAULT = 168;

export function Logo({ height = LOGO_HEIGHT_DEFAULT, className = '', priority = false }: Props) {
  const { theme } = useTheme();
  const webpSrc = theme === 'light' ? '/precisionai-logo-light.webp' : '/precisionai-logo-dark.webp';
  const pngSrc = theme === 'light' ? '/precisionai-logo-light.png' : '/precisionai-logo-dark.png';
  const w = Math.round(height * 1.5);

  return (
    <div className={`inline-flex items-center shrink-0 ${className}`}>
      <picture>
        <source srcSet={webpSrc} type="image/webp" />
        <img
          src={pngSrc}
          alt="PrecisionAI"
          className="shrink-0 object-contain max-w-full"
          style={{ height }}
          width={w}
          height={height}
          {...(priority ? { fetchPriority: 'high' } : {})}
        />
      </picture>
    </div>
  );
}
