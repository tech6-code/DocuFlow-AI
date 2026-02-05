import React from 'react';
import { useCtType2StepContext } from '../CtType2StepContext';

export const Step13: React.FC = () => {
    const {
        CT_QUESTIONS,
        questionnaireAnswers,
        setQuestionnaireAnswers,
        ftaFormValues,
        currency,
        formatNumber,
        CheckIcon,
        InformationCircleIcon,
        QuestionMarkCircleIcon,
        ChevronLeftIcon,
        ChevronRightIcon,
        handleBack,
        handleContinueToReport
    } = useCtType2StepContext();

    const handleAnswerChange = (questionId: any, answer: string) => {
        setQuestionnaireAnswers((prev: any) => ({ ...prev, [questionId]: answer }));
    };

    if (ftaFormValues && !questionnaireAnswers['curr_revenue'] && ftaFormValues.actualOperatingRevenue !== undefined) {
        setTimeout(() => {
            setQuestionnaireAnswers((prev: any) => ({
                ...prev,
                'curr_revenue': String(ftaFormValues.actualOperatingRevenue)
            }));
        }, 0);
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-[#0F172A]/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                            <QuestionMarkCircleIcon className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight uppercase">Corporate Tax Questionnaire</h3>
                            <p className="text-sm text-gray-400 mt-1">Please provide additional details for final tax computation.</p>
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700">
                        {Object.keys(questionnaireAnswers).filter(k => !isNaN(Number(k))).length} / {CT_QUESTIONS.length} Completed
                    </div>
                </div>

                <div className="divide-y divide-gray-800 max-h-[60vh] overflow-y-auto custom-scrollbar bg-black/20">
                    {CT_QUESTIONS.map((q: any) => (
                        <div key={q.id} className="p-6 hover:bg-white/5 transition-colors group">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex gap-4 flex-1">
                                    <span className="text-xs font-bold text-gray-600 font-mono mt-1">{String(q.id).padStart(2, '0')}</span>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-medium text-gray-200 leading-relaxed">{q.text}</p>
                                        {ftaFormValues && q.id === 6 && (
                                            <div className="mt-2 space-y-3">
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Operating Revenue of Current Period</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={questionnaireAnswers['curr_revenue'] || ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                setQuestionnaireAnswers((prev: any) => ({ ...prev, 'curr_revenue': val }));
                                                            }}
                                                            className="bg-gray-800 border border-blue-900/50 rounded-lg px-4 py-2 text-white text-sm w-full md:w-64 focus:ring-1 focus:ring-blue-500 outline-none placeholder-gray-600 transition-all font-mono text-right"
                                                            placeholder="0.00"
                                                        />
                                                        <span className="absolute left-3 top-2 text-gray-500 text-sm">{currency}</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-1">
                                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Operating Revenue for Previous Period</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={questionnaireAnswers['prev_revenue'] || ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                setQuestionnaireAnswers((prev: any) => ({ ...prev, 'prev_revenue': val }));
                                                            }}
                                                            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm w-full md:w-64 focus:ring-1 focus:ring-blue-500 outline-none placeholder-gray-600 transition-all font-mono text-right"
                                                            placeholder="0.00"
                                                        />
                                                        <span className="absolute left-3 top-2 text-gray-500 text-sm">{currency}</span>
                                                    </div>
                                                </div>

                                                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                                    {(() => {
                                                        const currentRev = parseFloat(questionnaireAnswers['curr_revenue']) || 0;
                                                        const prevRev = parseFloat(questionnaireAnswers['prev_revenue']) || 0;
                                                        const totalRev = currentRev + prevRev;
                                                        const isIneligible = currentRev >= 3000000 || prevRev >= 3000000;
                                                        const isSbrPotential = !isIneligible;

                                                        return (
                                                            <>
                                                                <p className="text-xs text-gray-300 flex justify-between mb-1">
                                                                    <span>Total Revenue:</span>
                                                                    <span className="font-mono font-bold">{currency} {formatNumber(totalRev)}</span>
                                                                </p>
                                                                <p className={`text-xs font-bold ${isSbrPotential ? 'text-green-400' : 'text-blue-400'} flex items-center gap-2`}>
                                                                    {isSbrPotential ? (
                                                                        <>
                                                                            <CheckIcon className="w-4 h-4" />
                                                                            Small Business Relief Applicable ( &lt; 3M AED )
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <InformationCircleIcon className="w-4 h-4" />
                                                                            Standard Tax Calculation Applies ( &gt;= 3M AED )
                                                                        </>
                                                                    )}
                                                                </p>
                                                                {questionnaireAnswers[6] === 'Yes' && <p className="text-[10px] text-gray-500 mt-1 pl-6">All financial amounts in the final report will be set to 0.</p>}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {q.id === 11 ? (
                                    <input
                                        type="text"
                                        value={questionnaireAnswers[q.id] || ''}
                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm w-40 focus:ring-1 focus:ring-blue-500 outline-none placeholder-gray-600 transition-all font-mono text-right"
                                        placeholder="0"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 bg-[#0F172A] p-1 rounded-xl border border-gray-800 shrink-0 shadow-inner">
                                        {(() => {
                                            const currentRev = parseFloat(questionnaireAnswers['curr_revenue']) || 0;
                                            const prevRev = parseFloat(questionnaireAnswers['prev_revenue']) || 0;
                                            const isIneligible = currentRev >= 3000000 || prevRev >= 3000000;
                                            const currentAnswer = (q.id === 6 && isIneligible) ? 'No' : (questionnaireAnswers[q.id] || '');

                                            if (isIneligible && questionnaireAnswers[q.id] !== 'No' && q.id === 6) {
                                                setTimeout(() => handleAnswerChange(6, 'No'), 0);
                                            }

                                            return ['Yes', 'No'].map((option) => (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => (q.id === 6 && isIneligible) ? null : handleAnswerChange(q.id, option)}
                                                    disabled={q.id === 6 && isIneligible}
                                                    className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${currentAnswer === option
                                                        ? 'bg-blue-600 text-white shadow-lg'
                                                        : 'text-gray-500 hover:text-white hover:bg-gray-800'
                                                        } ${q.id === 6 && isIneligible ? 'cursor-not-allowed opacity-50 grayscale' : ''}`}
                                                >
                                                    {option}
                                                </button>
                                            ));
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-8 bg-black border-t border-gray-800 flex justify-between items-center">
                    <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all">
                        <ChevronLeftIcon className="w-5 h-5 mr-2" /> Back
                    </button>
                    <button
                        onClick={handleContinueToReport}
                        disabled={Object.keys(questionnaireAnswers).filter(k => !isNaN(Number(k))).length < CT_QUESTIONS.length}
                        className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl shadow-blue-900/30 flex items-center disabled:opacity-50 disabled:grayscale transition-all transform hover:scale-[1.02]"
                    >
                        Continue to Report
                        <ChevronRightIcon className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>
        </div>
    );
};
