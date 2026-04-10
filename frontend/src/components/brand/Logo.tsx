import { useTheme } from '@/contexts/ThemeContext';

type Props = {
  /** Height of the logo in px */
  height?: number;
  /** Container class */
  className?: string;
  /** Mark as high priority for LCP */
  priority?: boolean;
  /** If true, removes fixed height and lets the image scale to fill container width */
  fillWidth?: boolean;
};

const LOGO_HEIGHT_DEFAULT = 168;

export function Logo({ height = LOGO_HEIGHT_DEFAULT, className = '', priority = false, fillWidth = false }: Props) {
  const { theme } = useTheme();
  const webpSrc = theme === 'light' ? '/precisionai-logo-light.webp' : '/precisionai-logo-dark.webp';
  const pngSrc = theme === 'light' ? '/precisionai-logo-light.png' : '/precisionai-logo-dark.png';
  const w = Math.round(height * 1.5);

  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={pngSrc}
        alt="PrecisionAI"
        className={`${fillWidth ? 'w-full h-auto block' : 'shrink-0 object-contain block'} ${className}`}
        style={fillWidth ? undefined : { height }}
        width={fillWidth ? undefined : w}
        height={fillWidth ? undefined : height}
        {...(priority ? { fetchPriority: 'high' } : {})}
      />
    </picture>
  );
}
