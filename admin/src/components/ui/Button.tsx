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

        const baseStyles = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

        const variants = {
            primary: "bg-gradient-to-br from-primary to-[#1D4ED8] text-white shadow-sm hover:shadow-glow hover:translate-y-[-1px]",
            secondary: "bg-transparent border border-border text-foreground hover:bg-card-hover hover:border-primary",
            ghost: "bg-transparent text-foreground hover:bg-card-hover border border-transparent",
            danger: "bg-danger text-white hover:bg-red-600 shadow-sm",
        };

        const sizes = {
            sm: "h-9 px-3 text-xs",
            md: "h-[44px] px-5 text-sm",
            lg: "h-12 px-8 text-base",
            icon: "h-10 w-10 p-2",
        };

        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                {...props}
            >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {!isLoading && icon && <span className="mr-2">{icon}</span>}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
