import { BRAND_LOGO_ASPECT, BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand';

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

const LOGO_HEIGHT_DEFAULT = 40;

export function Logo({ height = LOGO_HEIGHT_DEFAULT, className = '', priority = false, fillWidth = false }: Props) {
  const width = Math.round(height * BRAND_LOGO_ASPECT);

  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={BRAND_NAME}
      className={`${fillWidth ? 'w-full h-auto block' : 'shrink-0 object-contain block'} ${className}`}
      style={fillWidth ? undefined : { height, width }}
      width={fillWidth ? undefined : width}
      height={fillWidth ? undefined : height}
      {...(priority ? { fetchPriority: 'high' } : {})}
    />
  );
}
