import React from 'react';

type MotionDivProps = React.ComponentProps<'div'> & {
  initial?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  exit?: Record<string, unknown>;
  transition?: Record<string, unknown>;
  variants?: Record<string, unknown>;
  whileHover?: Record<string, unknown>;
  whileTap?: Record<string, unknown>;
  whileInView?: Record<string, unknown>;
  viewport?: Record<string, unknown>;
  layout?: boolean | string;
  layoutId?: string;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
};

const MotionLazy = React.lazy(() =>
  import('framer-motion').then((mod) => ({
    default: mod.motion.div,
  }))
);

export function MotionDiv(props: MotionDivProps) {
  const { initial, animate, exit, transition, variants, whileHover, whileTap, whileInView, viewport, layout, layoutId, style, className, children, ...rest } = props;
  return (
    <React.Suspense fallback={<div className={className} style={style} {...rest}>{children}</div>}>
      <MotionLazy
        initial={initial}
        animate={animate}
        exit={exit}
        transition={transition}
        variants={variants}
        whileHover={whileHover}
        whileTap={whileTap}
        whileInView={whileInView}
        viewport={viewport}
        layout={layout}
        layoutId={layoutId}
        style={style}
        className={className}
      >
        {children}
      </MotionLazy>
    </React.Suspense>
  );
}
