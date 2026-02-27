import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading = false, icon, children, disabled, ...props }, ref) => {

        const baseStyles = "inline-flex items-center justify-center font-bold rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";

        const variants = {
            primary: "bg-[#8b5cf6] text-white shadow-[0_4px_14px_0_rgba(139,92,246,0.3)] hover:bg-[#7c3aed] hover:shadow-[0_6px_20px_rgba(139,92,246,0.4)] hover:-translate-y-0.5",
            secondary: "border border-border bg-surface text-foreground hover:bg-card hover:border-border/80 hover:-translate-y-0.5",
            ghost: "bg-transparent text-muted hover:text-foreground hover:bg-surface",
            danger: "bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white",
        };

        const sizes = {
            sm: "h-9 px-4 text-xs",
            md: "h-12 px-6 text-sm",
            lg: "h-14 px-10 text-base",
            icon: "h-12 w-12 p-3",
        };

        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                {...props}
            >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {!isLoading && icon && <span className={cn(children ? "mr-2" : "")}>{icon}</span>}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
