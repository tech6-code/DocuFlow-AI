
import React from 'react';
import { SparklesIcon } from './icons';

interface LoadingIndicatorProps {
    progress: number;
    statusText: string;
    title?: string;
    size?: 'default' | 'compact';
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ progress, statusText, title = "Analyzing Your Document...", size = 'default' }) => {
    const isCompact = size === 'compact';

    return (
        <div className={`w-full ${isCompact ? 'max-w-[320px] p-5 rounded-xl' : 'max-w-[480px] p-10 rounded-2xl'} bg-card border border-border shadow-2xl text-center relative mx-auto`}>
            {/* Glow Effect */}
            <div className={`absolute -top-20 left-1/2 -translate-x-1/2 ${isCompact ? 'w-24 h-24 blur-[40px]' : 'w-40 h-40 blur-[60px]'} bg-primary/10 rounded-full pointer-events-none`}></div>

            {/* Icon Area */}
            <div className={`flex justify-center ${isCompact ? 'mb-4' : 'mb-8'} relative z-10`}>
                <div className="relative">
                    <SparklesIcon className={`${isCompact ? 'w-5 h-5' : 'w-8 h-8'} text-foreground`} />
                    <div className="absolute inset-0 bg-primary/40 blur-md rounded-full animate-pulse"></div>
                </div>
            </div>

            {/* Title */}
            <h3 className={`${isCompact ? 'text-base mb-4' : 'text-xl mb-8'} font-bold text-foreground tracking-tight relative z-10`}>
                {title}
            </h3>

            {/* Progress Bar */}
            <div className={`w-full bg-muted rounded-full ${isCompact ? 'h-1 mb-3' : 'h-1.5 mb-6'} overflow-hidden relative z-10`}>
                <div
                    className={`bg-primary ${isCompact ? 'h-1' : 'h-1.5'} rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(var(--primary),0.3)]`}
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                ></div>
            </div>

            {/* Footer Text */}
            <div className={`flex justify-between items-center ${isCompact ? 'text-[10px]' : 'text-xs'} font-medium relative z-10`}>
                <span className="text-muted-foreground truncate max-w-[80%]">{statusText}</span>
                <span className="text-foreground font-bold">{Math.round(progress)}%</span>
            </div>
        </div>
    );
};
