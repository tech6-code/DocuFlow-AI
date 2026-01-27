import React from 'react';
import {
    QuestionMarkCircleIcon,
    ChevronLeftIcon
} from '../icons';

interface CtType1Step10Props {
    questionnaireAnswers: Record<number, string>;
    handleQuestionnaireChange: (idx: number, val: string) => void;
    handleBack: () => void;
    handleContinueToReport: () => void;
}

const questions = [
    "Is the business a Qualifying Free Zone Person (QFZP)?",
    "Did the business have taxable income exceeding AED 375,000?",
    "Does the business have any exempt income (e.g., dividends from resident persons)?",
    "Are there any related party transactions at non-arm's length prices?",
    "Has the business utilized any carried-forward tax losses?",
    "Are there any disallowed expenses (e.g., 50% entertainment, fines, penalties)?",
    "Is the business eligible for Small Business Relief (SBR) - Revenue < AED 3M?",
    "Did the business have any foreign permanent establishments?",
    "Are there any specific industry exemptions applicable (e.g., Natural Resources)?",
    "Has the business correctly identified its first tax period?"
];

export const CtType1Step10: React.FC<CtType1Step10Props> = ({
    questionnaireAnswers,
    handleQuestionnaireChange,
    handleBack,
    handleContinueToReport
}) => {
    const isComplete = questions.every((_, idx) => questionnaireAnswers[idx]);

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="bg-[#0B1120] rounded-[2.5rem] border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-10 border-b border-gray-800 bg-gradient-to-r from-blue-900/10 to-indigo-900/10">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/5">
                            <QuestionMarkCircleIcon className="w-10 h-10 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-white tracking-tight uppercase">CT Questionnaire</h3>
                            <p className="text-gray-400 mt-1 font-medium italic">General Corporate Tax compliance mapping for UAE FTA filing.</p>
                        </div>
                    </div>
                </div>

                <div className="p-10">
                    <div className="space-y-6">
                        {questions.map((q, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-gray-800/20 rounded-2xl border border-gray-800/50 hover:border-blue-500/30 transition-all group">
                                <span className="text-sm text-gray-300 font-bold max-w-xl group-hover:text-white transition-colors">{idx + 1}. {q}</span>
                                <div className="flex bg-black/40 p-1.5 rounded-xl border border-gray-800 mt-4 md:mt-0">
                                    {['Yes', 'No', 'N/A'].map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => handleQuestionnaireChange(idx, opt)}
                                            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${questionnaireAnswers[idx] === opt ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-105' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={handleBack} className="flex items-center px-10 py-4 bg-transparent text-gray-400 hover:text-white font-black text-xs uppercase tracking-[0.2em] transition-all">
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Previous
                </button>
                <div className="flex gap-6 items-center">
                    {!isComplete && <span className="text-[10px] text-orange-400 font-black uppercase tracking-widest animate-pulse">Required: All questions</span>}
                    <button
                        onClick={handleContinueToReport}
                        disabled={!isComplete}
                        className="px-14 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-2xl shadow-blue-900/40 transform hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale uppercase tracking-widest text-xs"
                    >
                        Generate Final Report
                    </button>
                </div>
            </div>
        </div>
    );
};
