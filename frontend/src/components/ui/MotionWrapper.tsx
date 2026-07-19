import React from 'react';
import type { HTMLMotionProps } from 'framer-motion';

type MotionDivProps = HTMLMotionProps<'div'>;

const LazyDiv = React.lazy(() =>
  import('framer-motion').then((mod) => ({
    default: mod.motion.div,
  }))
);

export function MotionDiv({ className, style, children, ...motionProps }: MotionDivProps) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <React.Suspense fallback={<div className={className} style={style as any}>{children as any}</div>}>
      <LazyDiv className={className} style={style} {...motionProps}>
        {children}
      </LazyDiv>
    </React.Suspense>
  );
}
