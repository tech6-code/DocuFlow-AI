import React from 'react';
import { useCtType2 } from '../Layout';
import { QuestionMarkCircleIcon, ChevronLeftIcon, ChevronRightIcon, DocumentArrowDownIcon, ExclamationTriangleIcon, CheckCircleIcon, XMarkIcon } from '../../../icons';
import { CT_QUESTIONS } from '../types';

export const Step13: React.FC = () => {
    const {
        questionnaireAnswers,
        setQuestionnaireAnswers,
        handleBack,
        handleExportStep13Questionnaire,
        setCurrentStep
    } = useCtType2();

    const handleQuestionnaireChange = (id: number, value: string) => {
        setQuestionnaireAnswers(prev => ({
            ...prev,
            [id]: value
        }));
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0B1120] rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 bg-[#0F172A]/50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
                            <QuestionMarkCircleIcon className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Corporate Tax Questionnaire</h3>
                            <p className="text-sm text-gray-400">Please answer the following mandatory questions for the tax return.</p>
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-gray-800">
                    {CT_QUESTIONS.map((q) => (
                        <div key={q.id} className="p-6 hover:bg-white/5 transition-colors group">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex gap-3">
                                        <span className="text-gray-500 font-mono text-sm opacity-50">#{q.id}</span>
                                        <p className="text-gray-200 font-medium text-sm leading-relaxed max-w-4xl">{q.text}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 min-w-[200px]">
                                    <label className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg border cursor-pointer transition-all ${questionnaireAnswers[q.id] === 'Yes' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 font-bold' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                                        <input
                                            type="radio"
                                            name={`q-${q.id}`}
                                            value="Yes"
                                            checked={questionnaireAnswers[q.id] === 'Yes'}
                                            onChange={() => handleQuestionnaireChange(q.id, 'Yes')}
                                            className="hidden"
                                        />
                                        Yes
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg border cursor-pointer transition-all ${questionnaireAnswers[q.id] === 'No' ? 'bg-red-500/20 border-red-500 text-red-400 font-bold' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                                        <input
                                            type="radio"
                                            name={`q-${q.id}`}
                                            value="No"
                                            checked={questionnaireAnswers[q.id] === 'No'}
                                            onChange={() => handleQuestionnaireChange(q.id, 'No')}
                                            className="hidden"
                                        />
                                        No
                                    </label>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={handleBack}
                    className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"
                >
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Back
                </button>
                <div className="flex gap-4">
                    <button
                        onClick={handleExportStep13Questionnaire}
                        className="flex items-center px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-black rounded-xl border border-white/10 transition-all uppercase text-[10px] tracking-widest group"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-blue-400 group-hover:scale-110 transition-transform" />
                        Export Answers
                    </button>
                    <button
                        onClick={() => setCurrentStep(14)}
                        className="flex items-center px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all"
                    >
                        Review Final Report
                        <ChevronRightIcon className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>
        </div>
    );
};
