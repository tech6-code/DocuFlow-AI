
import React from 'react';

interface SimpleLoadingProps {
    message?: string;
}

export const SimpleLoading: React.FC<SimpleLoadingProps> = ({ message = 'Loading...' }) => {
    return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-muted-foreground font-medium animate-pulse">{message}</p>
        </div>
    );
};
