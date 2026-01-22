import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons';
import { DealFollowUp } from '../types';

interface AddFollowUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (followUp: Omit<DealFollowUp, 'id' | 'dealId' | 'created'> | Partial<DealFollowUp>) => void;
    dealName: string;
    initialData?: DealFollowUp | null;
}

const AddFollowUpModal: React.FC<AddFollowUpModalProps> = ({ isOpen, onClose, onSave, dealName, initialData }) => {
    const [nextFollowUp, setNextFollowUp] = useState('');
    const [startTime, setStartTime] = useState('');
    const [sendReminder, setSendReminder] = useState(true);
    const [remindBefore, setRemindBefore] = useState(1);
    const [remindUnit, setRemindUnit] = useState<'Day(s)' | 'Hour(s)' | 'Minute(s)'>('Day(s)');
    const [remark, setRemark] = useState('');
    const [status, setStatus] = useState<'Pending' | 'Completed' | 'Cancelled'>('Pending');

    useEffect(() => {
        if (isOpen && initialData) {
            setNextFollowUp(initialData.nextFollowUp);
            setStartTime(initialData.startTime);
            setSendReminder(initialData.sendReminder);
            setRemindBefore(initialData.remindBefore);
            setRemindUnit(initialData.remindUnit);
            setRemark(initialData.remark);
            setStatus(initialData.status);
        } else if (isOpen) {
            // Reset form for new entry
            setNextFollowUp('');
            setStartTime('');
            setSendReminder(true);
            setRemindBefore(1);
            setRemindUnit('Day(s)');
            setRemark('');
            setStatus('Pending');
        }
    }, [isOpen, initialData]);

    const handleSave = () => {
        if (!nextFollowUp || !startTime) {
            alert('Please fill in all required fields');
            return;
        }

        const formData: Partial<DealFollowUp> = {
            nextFollowUp,
            startTime,
            sendReminder,
            remindBefore,
            remindUnit,
            remark,
            status
        };

        if (initialData) {
            formData.id = initialData.id;
        }

        onSave(formData as any);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white">{initialData ? 'Edit Follow Up' : 'Add Follow Up'}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Lead Name (Read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Lead Name
                        </label>
                        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-gray-300">
                            {dealName}
                        </div>
                    </div>

                    {/* Follow Up Next and Start Time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Follow Up Next <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={nextFollowUp}
                                onChange={(e) => setNextFollowUp(e.target.value)}
                                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Start Time <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Status Field (only for edit) */}
                    {initialData && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Status
                            </label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as any)}
                                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            >
                                <option value="Pending">Pending</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                    )}

                    {/* Send Reminder */}
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="sendReminder"
                            checked={sendReminder}
                            onChange={(e) => setSendReminder(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                        />
                        <label htmlFor="sendReminder" className="ml-2 text-sm text-gray-300">
                            Send Reminder
                        </label>
                    </div>

                    {/* Remind Before */}
                    {sendReminder && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Remind before <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="number"
                                    min="1"
                                    value={remindBefore}
                                    onChange={(e) => setRemindBefore(parseInt(e.target.value) || 1)}
                                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                />
                                <select
                                    value={remindUnit}
                                    onChange={(e) => setRemindUnit(e.target.value as 'Day(s)' | 'Hour(s)' | 'Minute(s)')}
                                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                >
                                    <option value="Day(s)">Day(s)</option>
                                    <option value="Hour(s)">Hour(s)</option>
                                    <option value="Minute(s)">Minute(s)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Remark */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Remark
                        </label>
                        <textarea
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            rows={4}
                            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                            placeholder="Enter any additional notes..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {initialData ? 'Update' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddFollowUpModal;
