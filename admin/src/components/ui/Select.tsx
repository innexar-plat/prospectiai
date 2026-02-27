import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, error, children, ...props }, ref) => {
        return (
            <div className="w-full">
                <div className="relative flex items-center">
                    <select
                        ref={ref}
                        className={cn(
                            "appearance-none flex h-[44px] w-full rounded-xl border bg-bg-input px-3 py-2 text-sm text-foreground transition-all duration-150",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
                            error
                                ? "border-danger focus-visible:ring-danger/30"
                                : "border-border hover:border-primary/50 focus-visible:border-primary focus-visible:ring-primary/20",
                            className
                        )}
                        {...props}
                    >
                        {children}
                    </select>
                    <div className="pointer-events-none absolute right-3 text-muted">
                        <ChevronDown size={16} />
                    </div>
                </div>
                {error && (
                    <p className="mt-1 text-xs text-danger">{error}</p>
                )}
            </div>
        );
    }
);

Select.displayName = 'Select';
