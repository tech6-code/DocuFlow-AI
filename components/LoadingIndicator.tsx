
import React from 'react';
import { SparklesIcon } from './icons';

interface LoadingIndicatorProps {
  progress: number;
  statusText: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ progress, statusText }) => {
  return (
    <div className="w-full max-w-[480px] p-10 bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl text-center relative mx-auto">
        {/* Glow Effect */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none"></div>

        {/* Icon Area */}
        <div className="flex justify-center mb-8 relative z-10">
            <div className="relative">
                <SparklesIcon className="w-8 h-8 text-white" />
                <div className="absolute inset-0 bg-white/40 blur-md rounded-full animate-pulse"></div>
            </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-8 tracking-tight relative z-10">
            Analyzing Your Document...
        </h3>

        {/* Progress Bar */}
        <div className="w-full bg-gray-800 rounded-full h-1.5 mb-6 overflow-hidden relative z-10">
            <div 
                className="bg-white h-1.5 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
            ></div>
        </div>

        {/* Footer Text */}
        <div className="flex justify-between items-center text-xs font-medium relative z-10">
            <span className="text-gray-400 truncate max-w-[80%]">{statusText}</span>
            <span className="text-white font-bold">{Math.round(progress)}%</span>
        </div>
    </div>
  );
};
