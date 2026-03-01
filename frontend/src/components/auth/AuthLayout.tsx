import React from 'react';
import { Logo } from '@/components/brand/Logo';

interface AuthLayoutProps {
    children: React.ReactNode;
    sideTitle: React.ReactNode;
    sideDescription: string;
    sideElements?: React.ReactNode;
    formTitle: string;
    formSubtitle: string;
}

export function AuthLayout({
    children,
    sideTitle,
    sideDescription,
    sideElements,
    formTitle,
    formSubtitle
}: AuthLayoutProps) {
    return (
        <div className="h-screen min-h-[600px] grid lg:grid-cols-2 bg-background selection:bg-violet-500/30 overflow-hidden">
            {/* LEFT SIDE: Visual/Value Prop */}
            <div className="hidden lg:flex flex-col justify-center p-8 lg:p-10 xl:p-12 relative overflow-hidden border-r border-border bg-[radial-gradient(circle_at_0%_0%,rgba(139,92,246,0.1)_0%,transparent_50%)]">
                <div className="relative z-10 max-w-md">
                    <div className="mb-6">
                        <Logo iconSize={40} textClassName="text-foreground text-lg" />
                    </div>
                    <h2 className="text-3xl xl:text-4xl font-black text-foreground leading-tight mb-5">
                        {sideTitle}
                    </h2>
                    <p className="text-muted leading-relaxed mb-8">
                        {sideDescription}
                    </p>
                    {sideElements}
                </div>
                <div className="absolute top-1/2 -right-24 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />
            </div>

            {/* RIGHT SIDE: Form */}
            <div className="flex flex-col justify-center items-center py-8 px-6 md:px-10">
                <div className="w-full max-w-[380px] animate-fade">
                    <div className="lg:hidden flex justify-center mb-6">
                        <Logo iconSize={36} iconOnly={false} textClassName="text-foreground text-sm" />
                    </div>

                    <div className="mb-6 text-center lg:text-left">
                        <h1 className="text-2xl font-black text-foreground mb-1">{formTitle}</h1>
                        <p className="text-muted text-sm">{formSubtitle}</p>
                    </div>

                    {children}
                </div>
            </div>
        </div>
    );
}
