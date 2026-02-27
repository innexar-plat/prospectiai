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
                <div className="relative flex items-center group">
                    {icon && (
                        <div className="absolute left-4 text-muted group-focus-within:text-[#8b5cf6] transition-colors">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={cn(
                            "flex h-12 w-full rounded-2xl border border-border bg-surface px-4 py-2 text-sm text-foreground transition-all duration-300",
                            "placeholder:text-muted focus:outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#8b5cf6]/10 disabled:cursor-not-allowed disabled:opacity-50",
                            icon ? "pl-12" : "",
                            error
                                ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/10"
                                : "",
                            className
                        )}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="mt-1.5 ml-1 text-xs font-medium text-red-400">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
