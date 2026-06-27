import { BRAND_FAVICON_ASPECT, BRAND_FAVICON_SRC } from '@/lib/brand';

type Props = {
  className?: string;
  size?: number;
};

export function LogoIcon({ className, size = 32 }: Props) {
  const width = Math.round(size * BRAND_FAVICON_ASPECT);

  return (
    <img
      src={BRAND_FAVICON_SRC}
      alt=""
      aria-hidden
      width={width}
      height={size}
      className={className}
      style={{ width, height: size }}
    />
  );
}
