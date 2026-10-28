import { BRAND_MARK_ASPECT, BRAND_MARK_SRC } from '@/lib/brand';

type Props = {
  className?: string;
  size?: number;
};

/** Brand mark only (P-pin), transparent background. */
export function LogoIcon({ className, size = 32 }: Props) {
  const width = Math.round(size * BRAND_MARK_ASPECT);

  return (
    <img
      src={BRAND_MARK_SRC}
      alt=""
      aria-hidden
      width={width}
      height={size}
      className={className}
      style={{ width, height: size }}
    />
  );
}
