import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ReactNode;
    error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, icon, error, ...props }, ref) => {
        return (
            <div className="w-full">
                <div className="relative flex items-center">
                    {icon && (
                        <div className="absolute left-3 text-muted">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={cn(
                            "flex h-[44px] w-full rounded-xl border bg-bg-input px-3 py-2 text-sm text-foreground transition-all duration-150",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
                            icon ? "pl-10" : "",
                            error
                                ? "border-danger focus-visible:ring-danger/30"
                                : "border-border hover:border-primary/50 focus-visible:border-primary focus-visible:ring-primary/20",
                            className
                        )}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="mt-1 text-xs text-danger">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
