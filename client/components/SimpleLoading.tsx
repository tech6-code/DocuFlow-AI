
import React from 'react';

interface SimpleLoadingProps {
    message?: string;
}

export const SimpleLoading: React.FC<SimpleLoadingProps> = ({ message = 'Loading...' }) => {
    return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-gray-400 font-medium animate-pulse">{message}</p>
        </div>
    );
};
