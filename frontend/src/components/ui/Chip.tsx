import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
    label: string;
    onRemove?: () => void;
}

export const Chip = ({ label, onRemove, className, ...props }: ChipProps) => {
    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-sm font-medium transition-colors",
                "bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20",
                className
            )}
            {...props}
        >
            <span>{label}</span>
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="rounded-full p-0.5 hover:bg-primary/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <X size={14} />
                    <span className="sr-only">Remover filtro</span>
                </button>
            )}
        </div>
    );
};
