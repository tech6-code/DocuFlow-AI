import React, { useState } from 'react';
import { XMarkIcon, ArrowRightIcon, DocumentDuplicateIcon } from './icons';
import { generateSalesEmail } from '../services/geminiService';
import { Deal } from '../types';

interface AIEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    deal: Partial<Deal>;
}

export const AIEmailModal: React.FC<AIEmailModalProps> = ({ isOpen, onClose, deal }) => {
    const [step, setStep] = useState<'select' | 'generate'>('select');
    const [emailType, setEmailType] = useState('intro');
    const [tone, setTone] = useState('Professional');
    const [generatedEmail, setGeneratedEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const emailTypes = [
        { id: 'intro', label: 'Introduction', desc: 'First contact with the client' },
        { id: 'followup', label: 'Follow Up', desc: 'Checking in after no response' },
        { id: 'proposal', label: 'Proposal', desc: 'Sending the quote/proposal' },
        { id: 'closing', label: 'Closing', desc: 'Pushing for the final sign-off' },
    ];

    const tones = ['Professional', 'Friendly', 'Persuasive', 'Urgent'];

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const email = await generateSalesEmail({
                recipientName: deal.name || 'Client',
                companyName: deal.companyName || 'Company',
                dealStage: deal.serviceClosed || 'New',
                goal: `Send a ${emailType} email`,
                tone: tone,
                keyPoints: [deal.serviceRequired || deal.services || 'Our Services', `${deal.serviceAmount} AED Value`]
            });
            setGeneratedEmail(email);
            setStep('generate');
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedEmail);
        alert('Copied to clipboard!');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <h3 className="text-xl font-bold text-white tracking-tight">AI Email Assistant</h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {step === 'select' ? (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-3">What kind of email?</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {emailTypes.map((type) => (
                                        <div
                                            key={type.id}
                                            onClick={() => setEmailType(type.id)}
                                            className={`p-4 rounded-xl border cursor-pointer transition-all ${emailType === type.id ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'}`}
                                        >
                                            <div className="font-bold text-sm mb-1">{type.label}</div>
                                            <div className="text-xs opacity-70">{type.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-3">Tone</label>
                                <div className="flex gap-2 flex-wrap">
                                    {tones.map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setTone(t)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${tone === t ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? 'Generating...' : (
                                    <>
                                        Generate Draft <ArrowRightIcon className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <textarea
                                className="w-full h-64 bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-white resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                value={generatedEmail}
                                onChange={(e) => setGeneratedEmail(e.target.value)}
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('select')}
                                    className="flex-1 py-3 bg-gray-800 text-gray-300 font-bold rounded-xl hover:bg-gray-700 transition-all"
                                >
                                    Try Again
                                </button>
                                <button
                                    onClick={copyToClipboard}
                                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
                                >
                                    <DocumentDuplicateIcon className="w-5 h-5" /> Copy
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
