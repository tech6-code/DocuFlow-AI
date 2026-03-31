import React from 'react';
import { CheckIcon } from './icons';

interface WorkflowStepperProps {
    steps: string[];
    currentStep: number;
    onStepClick?: (stepNumber: number) => void;
    /** The highest step the user has completed. Steps up to this + 1 are clickable. */
    maxCompletedStep?: number;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
    steps,
    currentStep,
    onStepClick,
    maxCompletedStep
}) => {
    const highestClickable = maxCompletedStep != null ? maxCompletedStep + 1 : currentStep;

    return (
        <div className="flex items-center w-full max-w-6xl mx-auto mb-8 overflow-x-auto pb-2">
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isCompleted = currentStep > stepNumber;
                const isActive = currentStep === stepNumber;
                const isClickable = onStepClick && stepNumber <= highestClickable && stepNumber !== currentStep;

                return (
                    <React.Fragment key={step}>
                        <div
                            className={`flex flex-col items-center text-center z-10 px-2 min-w-[100px] ${isClickable ? 'cursor-pointer group' : ''}`}
                            onClick={isClickable ? () => onStepClick(stepNumber) : undefined}
                            title={isClickable ? `Go to ${step}` : undefined}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isCompleted ? 'bg-primary border-primary' :
                                isActive ? 'border-primary bg-background' : 'border-muted bg-muted/20'
                                } ${isClickable ? 'group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20' : ''}`}>
                                {isCompleted ? <CheckIcon className="w-6 h-6 text-primary-foreground" /> : <span className={`font-bold text-lg ${isActive ? 'text-foreground' : 'text-muted-foreground/40'}`}>{stepNumber}</span>}
                            </div>
                            <p className={`mt-2 text-xs font-semibold ${isCompleted || isActive ? 'text-foreground' : 'text-muted-foreground/40'
                                } ${isClickable ? 'group-hover:text-primary' : ''}`}>{step}</p>
                        </div>
                        {index < steps.length - 1 && (
                            <div className="flex-1 h-0.5 bg-muted relative min-w-[20px]">
                                <div className={`absolute top-0 left-0 h-full bg-primary transition-all duration-500`} style={{ width: isCompleted ? '100%' : '0%' }}></div>
                            </div>
                        )}
                    </React.Fragment>
                )
            })}
        </div>
    );
};
