import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    onReset?: () => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
        this.props.onReset?.();
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="min-h-[50vh] flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                        <div className="text-status-danger mb-4 text-lg font-semibold">Something went wrong</div>
                        <p className="text-muted-foreground mb-2 text-sm">
                            {this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
                        </p>
                        <div className="flex justify-center gap-3 mt-6">
                            <button
                                onClick={this.handleRetry}
                                className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                Try Again
                            </button>
                            {this.props.onReset && (
                                <button
                                    onClick={this.props.onReset}
                                    className="px-5 py-2 bg-muted text-foreground font-semibold rounded-lg hover:bg-muted/80 transition-colors"
                                >
                                    Start Over
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
