import React from 'react';
import { ChevronLeftIcon, ArrowRightIcon } from './icons';

interface WorkflowNavigationProps {
    onBack?: () => void;
    onNext?: () => void;
    backLabel?: string;
    nextLabel?: string;
    nextDisabled?: boolean;
    isFirstStep?: boolean;
    isLastStep?: boolean;
    /** If true, shows a loading spinner on next button */
    isLoading?: boolean;
    loadingLabel?: string;
    /** Optional skip button */
    showSkip?: boolean;
    onSkip?: () => void;
    skipLabel?: string;
    /** Custom content to render on the right side (replaces default next button) */
    rightContent?: React.ReactNode;
    /** Additional content rendered between back and next */
    centerContent?: React.ReactNode;
}

export const WorkflowNavigation: React.FC<WorkflowNavigationProps> = ({
    onBack,
    onNext,
    backLabel = 'Back',
    nextLabel = 'Confirm & Continue',
    nextDisabled = false,
    isFirstStep = false,
    isLastStep = false,
    isLoading = false,
    loadingLabel = 'Processing...',
    showSkip = false,
    onSkip,
    skipLabel = 'Skip',
    rightContent,
    centerContent
}) => {
    return (
        <div className="sticky bottom-0 z-30 mt-8 -mx-8 px-8 py-4 bg-background/95 backdrop-blur-sm border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-center max-w-6xl mx-auto">
                {/* Left: Back button */}
                <div>
                    {!isFirstStep && onBack && (
                        <button
                            onClick={onBack}
                            className="flex items-center px-6 py-3 text-muted-foreground hover:text-foreground font-bold transition-all rounded-xl hover:bg-muted"
                        >
                            <ChevronLeftIcon className="w-5 h-5 mr-2" />
                            {backLabel}
                        </button>
                    )}
                </div>

                {/* Center: optional content */}
                {centerContent && <div>{centerContent}</div>}

                {/* Right: Next / Skip / Custom content */}
                <div className="flex items-center gap-3">
                    {rightContent ? (
                        rightContent
                    ) : (
                        <>
                            {showSkip && onSkip && (
                                <button
                                    onClick={onSkip}
                                    className="px-6 py-3 bg-muted hover:bg-muted/80 text-foreground/80 font-bold rounded-xl border border-border transition-all uppercase text-xs tracking-widest"
                                >
                                    {skipLabel}
                                </button>
                            )}
                            {onNext && (
                                <button
                                    onClick={onNext}
                                    disabled={nextDisabled || isLoading}
                                    className="flex items-center px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl shadow-primary/20 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase text-xs tracking-widest"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-3" />
                                            {loadingLabel}
                                        </>
                                    ) : (
                                        <>
                                            {nextLabel}
                                            {!isLastStep && <ArrowRightIcon className="w-4 h-4 ml-2" />}
                                        </>
                                    )}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
