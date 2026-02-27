import { useTheme } from '@/contexts/ThemeContext';

type Props = {
  /** Size of the logo icon in px (desktop) */
  iconSize?: number;
  /** Size on mobile */
  iconSizeMobile?: number;
  /** Show only the icon (e.g., for mobile) */
  iconOnly?: boolean;
  /** Container class */
  className?: string;
  /** Text class */
  textClassName?: string;
};

const LOGO_HEIGHT_DEFAULT = 40;

export function Logo({ iconSize = LOGO_HEIGHT_DEFAULT, iconSizeMobile, iconOnly = false, className = '', textClassName = '' }: Props) {
  const { theme } = useTheme();
  const baseSize = iconSizeMobile ?? iconSize;
  const useResponsive = iconSizeMobile != null && iconSizeMobile !== iconSize;
  const imgClass = useResponsive
    ? 'shrink-0 object-contain w-12 h-12 md:w-14 md:h-14'
    : 'shrink-0 object-contain';
  const imgStyle = useResponsive ? undefined : { width: baseSize, height: baseSize };

  const logoSrc = theme === 'light' ? '/lopclaro.png' : '/logop.png';

  return (
    <div className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      <img
        src={logoSrc}
        alt=""
        className={imgClass}
        style={imgStyle}
        aria-hidden
      />
      {!iconOnly && (
        <span
          className={`font-black tracking-tight leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'} ${textClassName}`}
          style={{ fontSize: `${baseSize * 0.52}px` }}
        >
          Prospector<span className="text-violet-500">AI</span>
        </span>
      )}
    </div>
  );
}
