import React from 'react';
import { ExclamationTriangleIcon } from './icons';

interface ConfirmationDialogProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    children: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    isOpen,
    onConfirm,
    onCancel,
    title,
    children,
    confirmText = 'Confirm',
    cancelText = 'Cancel'
}) => {
    if (!isOpen) {
        return null;
    }

    // Handle Escape key press
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onCancel();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onCancel]);


    return (
        <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 ease-in-out"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={onCancel} // Close on backdrop click
        >
            <div
                className="bg-card rounded-lg shadow-xl w-full max-w-md m-4 transform transition-all duration-300 ease-in-out border border-border"
                role="document"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
            >
                <div className="p-6">
                    <div className="flex items-start">
                        <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-muted sm:mx-0 sm:h-10 sm:w-10">
                            <ExclamationTriangleIcon className="h-6 w-6 text-foreground" aria-hidden="true" />
                        </div>
                        <div className="ml-4 text-left">
                            <h3 className="text-lg font-semibold leading-6 text-foreground" id="dialog-title">
                                {title}
                            </h3>
                            <div className="mt-2 text-sm text-muted-foreground">
                                {children}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-muted/50 border-t border-border flex flex-row-reverse space-x-2 space-x-reverse">
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="inline-flex justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        {confirmText}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="inline-flex justify-center rounded-md bg-transparent px-4 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-border hover:bg-muted focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
};