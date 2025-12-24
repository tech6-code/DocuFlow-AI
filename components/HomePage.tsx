
import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowRightIcon, 
    BanknotesIcon, 
    DocumentTextIcon, 
    BriefcaseIcon, 
    SparklesIcon, 
    ShieldCheckIcon,
    ChartPieIcon,
    CheckIcon,
    BuildingOfficeIcon,
    UsersIcon,
    LightBulbIcon,
    ChevronDownIcon,
    DocumentDuplicateIcon,
    CalendarDaysIcon,
    ScaleIcon,
    IdentificationIcon,
    ArrowUpIcon
} from './icons';

interface HomePageProps {
    onGetStarted: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onGetStarted }) => {
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [showBackToTop, setShowBackToTop] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const toggleFaq = (index: number) => {
        setOpenFaq(openFaq === index ? null : index);
    };

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        const container = scrollContainerRef.current;
        if (element && container) {
            // Calculate position relative to container
            const top = element.getBoundingClientRect().top + container.scrollTop - 80; // 80px offset for header
            container.scrollTo({ top, behavior: 'smooth' });
        }
    };

    const scrollToTop = () => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        const handleScroll = () => {
            if (container) {
                setShowBackToTop(container.scrollTop > 500);
            }
        };

        container?.addEventListener('scroll', handleScroll);
        return () => container?.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div ref={scrollContainerRef} className="h-screen bg-black text-white font-sans selection:bg-blue-500/30 overflow-x-hidden overflow-y-auto scroll-smooth">
            {/* --- Navigation --- */}
            <nav className="fixed top-0 left-0 right-0 border-b border-gray-800 bg-black/80 backdrop-blur-xl z-50 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={scrollToTop}>
                        <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                            <SparklesIcon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white">DocuFlow</span>
                    </div>
                    
                    <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-400">
                        <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">Features</button>
                        <button onClick={() => scrollToSection('security')} className="hover:text-white transition-colors">Security</button>
                        <button onClick={() => scrollToSection('pricing')} className="hover:text-white transition-colors">Pricing</button>
                        <button onClick={() => scrollToSection('faq')} className="hover:text-white transition-colors">FAQ</button>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button 
                            onClick={onGetStarted} 
                            className="text-sm font-medium text-gray-300 hover:text-white transition-colors hidden sm:block"
                        >
                            Sign In
                        </button>
                        <button 
                            onClick={onGetStarted}
                            className="bg-white text-black px-6 py-2.5 rounded-full text-sm font-bold hover:bg-gray-200 transition-all transform hover:scale-105 shadow-xl shadow-white/10"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* --- Section 1: Hero --- */}
            <div className="relative pt-40 pb-20 lg:pt-52 lg:pb-32 overflow-hidden min-h-screen flex flex-col justify-center">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none opacity-40 animate-pulse"></div>
                <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none opacity-30"></div>

                <div className="max-w-5xl mx-auto px-6 text-center relative z-10 flex-1 flex flex-col justify-center">
                    <div>
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold mb-8 backdrop-blur-md">
                            <span className="flex h-2 w-2 rounded-full bg-blue-400 mr-2 animate-ping"></span>
                            v2.0 Now Live: Corporate Tax Automation
                        </div>
                        
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
                            Accounting on Autopilot. <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-white">
                                Powered by Gemini AI.
                            </span>
                        </h1>
                        
                        <p className="text-xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed">
                            Transform bank statements, invoices, and legal documents into audit-ready financial reports. 
                            Zero data entry. 100% compliant with UAE Tax Laws.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
                            <button 
                                onClick={onGetStarted}
                                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center group"
                            >
                                Start Free Trial
                                <ArrowRightIcon className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button 
                                onClick={() => scrollToSection('how-it-works')}
                                className="w-full sm:w-auto px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white border border-gray-700 hover:border-gray-600 rounded-2xl font-semibold text-lg transition-all"
                            >
                                See How It Works
                            </button>
                        </div>

                        <div className="mt-16 pt-8 border-t border-gray-800/60 flex flex-wrap justify-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                        {['Google Cloud', 'Supabase', 'React', 'Tailwind', 'TypeScript'].map(brand => (
                            <span key={brand} className="text-xl font-bold text-gray-500">{brand}</span>
                        ))}
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce cursor-pointer" onClick={() => scrollToSection('features')}>
                    <ChevronDownIcon className="w-8 h-8 text-gray-500 hover:text-white transition-colors" />
                </div>
            </div>

            {/* --- Section 2: Stats / Trust --- */}
            <div className="bg-gray-900/30 border-y border-gray-800" id="how-it-works">
                <div className="max-w-7xl mx-auto px-6 py-12">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        <div className="p-4">
                            <p className="text-4xl font-bold text-white mb-2">10k+</p>
                            <p className="text-sm text-gray-500 uppercase tracking-wider">Documents Processed</p>
                        </div>
                        <div className="p-4">
                            <p className="text-4xl font-bold text-white mb-2">99.8%</p>
                            <p className="text-sm text-gray-500 uppercase tracking-wider">Extraction Accuracy</p>
                        </div>
                        <div className="p-4">
                            <p className="text-4xl font-bold text-white mb-2">50x</p>
                            <p className="text-sm text-gray-500 uppercase tracking-wider">Faster Than Manual</p>
                        </div>
                        <div className="p-4">
                            <p className="text-4xl font-bold text-white mb-2">24/7</p>
                            <p className="text-sm text-gray-500 uppercase tracking-wider">Automated Availability</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Section 3: Feature Deep Dive (Bank Statements) --- */}
            <div id="features" className="py-32 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col lg:flex-row items-center gap-16">
                        <div className="lg:w-1/2">
                            <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-900/30 text-green-400 text-xs font-bold mb-6 border border-green-800">
                                <BanknotesIcon className="w-3 h-3 mr-2" />
                                Bank Reconciliation
                            </div>
                            <h2 className="text-4xl font-bold mb-6 leading-tight">Turn PDF Statements into <br/><span className="text-blue-500">Actionable Data</span>.</h2>
                            <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                                Stop manually typing transaction rows from scanned PDFs. DocuFlow intelligently extracts dates, descriptions, and amounts, categorizing them automatically against your Chart of Accounts.
                            </p>
                            <ul className="space-y-4 mb-8">
                                {[
                                    'Supports all major UAE and International banks',
                                    'Auto-detects currency (AED, USD, EUR, etc.)',
                                    'Identifies recurring payments automatically',
                                    'Export directly to Excel or CSV'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center text-gray-300">
                                        <div className="w-6 h-6 rounded-full bg-blue-900/50 flex items-center justify-center mr-3 border border-blue-800">
                                            <CheckIcon className="w-3 h-3 text-blue-400" />
                                        </div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={onGetStarted} className="text-blue-400 font-bold flex items-center hover:text-blue-300 transition-colors">
                                Try Bank Analysis <ArrowRightIcon className="w-4 h-4 ml-2" />
                            </button>
                        </div>
                        <div className="lg:w-1/2 relative">
                            <div className="absolute inset-0 bg-blue-600/20 blur-[100px] rounded-full"></div>
                            <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                                <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                                            <BanknotesIcon className="w-6 h-6 text-green-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">Statement #2024-001</div>
                                            <div className="text-xs text-green-400">Processing Complete</div>
                                        </div>
                                    </div>
                                    <div className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded border border-green-800 font-mono">100% Conf.</div>
                                </div>
                                <div className="space-y-3 font-mono text-xs">
                                    <div className="flex justify-between text-gray-500 border-b border-gray-800 pb-2">
                                        <span>Date</span><span>Description</span><span>Amount</span>
                                    </div>
                                    <div className="flex justify-between text-gray-300">
                                        <span>01/10/24</span><span>Salaries & Wages</span><span className="text-red-400">- 45,000</span>
                                    </div>
                                    <div className="flex justify-between text-gray-300">
                                        <span>05/10/24</span><span>Client Payment #99</span><span className="text-green-400">+ 12,500</span>
                                    </div>
                                    <div className="flex justify-between text-gray-300">
                                        <span>12/10/24</span><span>Office Rent Oct</span><span className="text-red-400">- 8,000</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Section 4: Feature Deep Dive (Invoices) --- */}
            <div className="py-32 bg-gray-900/20 border-y border-gray-800 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
                        <div className="lg:w-1/2">
                            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-900/30 text-blue-400 text-xs font-bold mb-6 border border-blue-800">
                                <DocumentTextIcon className="w-3 h-3 mr-2" />
                                Invoice Processing
                            </div>
                            <h2 className="text-4xl font-bold mb-6 leading-tight">Extract Every Detail. <br/><span className="text-purple-500">Automate Your AP/AR.</span></h2>
                            <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                                Upload invoices in bulk. We extract line items, detect tax rates, verify TRN numbers, and distinguish between sales and purchases automatically.
                            </p>
                            <ul className="space-y-4 mb-8">
                                {[
                                    'Line-item level extraction & validation',
                                    'Knowledge Base learns from your vendors',
                                    'Automatic Tax (VAT) calculation checks',
                                    'Matches invoices to Purchase Orders (Coming Soon)'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center text-gray-300">
                                        <div className="w-6 h-6 rounded-full bg-purple-900/50 flex items-center justify-center mr-3 border border-purple-800">
                                            <CheckIcon className="w-3 h-3 text-purple-400" />
                                        </div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={onGetStarted} className="text-purple-400 font-bold flex items-center hover:text-purple-300 transition-colors">
                                Process Invoices <ArrowRightIcon className="w-4 h-4 ml-2" />
                            </button>
                        </div>
                        <div className="lg:w-1/2 relative">
                            <div className="absolute inset-0 bg-purple-600/20 blur-[100px] rounded-full"></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg transform translate-y-8">
                                    <div className="h-8 w-8 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3 text-blue-400"><DocumentTextIcon className="w-5 h-5"/></div>
                                    <div className="h-2 w-16 bg-gray-600 rounded mb-2"></div>
                                    <div className="h-2 w-24 bg-gray-700 rounded"></div>
                                </div>
                                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
                                    <div className="h-8 w-8 bg-purple-500/20 rounded-lg flex items-center justify-center mb-3 text-purple-400"><ScaleIcon className="w-5 h-5"/></div>
                                    <div className="h-2 w-16 bg-gray-600 rounded mb-2"></div>
                                    <div className="h-2 w-24 bg-gray-700 rounded"></div>
                                </div>
                                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg col-span-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-xs text-gray-400">Total Extracted</div>
                                        <div className="text-sm font-bold text-white">AED 142,500.00</div>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                                        <div className="bg-purple-500 h-1.5 rounded-full w-3/4"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Section 5: The Full Suite (Grid) --- */}
            <div className="py-32">
                <div className="max-w-7xl mx-auto px-6 text-center mb-20">
                    <h2 className="text-4xl font-bold mb-4">Complete Financial Intelligence</h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">Everything you need to manage company financials, from raw documents to final audit reports.</p>
                </div>

                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: <BriefcaseIcon className="w-6 h-6 text-blue-400"/>, title: 'Corporate Tax Filing', desc: 'Streamline CT filing with automated data aggregation, trial balance adjustments, and compliance checks.' },
                        { icon: <ChartPieIcon className="w-6 h-6 text-orange-400"/>, title: 'VAT Returns', desc: 'Auto-calculate VAT on sales and purchases. Generate accurate return summaries for tax authorities.' },
                        { icon: <ShieldCheckIcon className="w-6 h-6 text-red-400"/>, title: 'Audit Reports', desc: 'Generate IFRS-compliant financial statements including Balance Sheets and Profit & Loss reports.' },
                        { icon: <UsersIcon className="w-6 h-6 text-teal-400"/>, title: 'Customer Profiles', desc: 'Maintain detailed customer ledgers, tax details, and document history in one place.' },
                        { icon: <IdentificationIcon className="w-6 h-6 text-yellow-400"/>, title: 'Smart KYC', desc: 'Extract data from Emirates IDs, Passports, and Trade Licenses to build entities automatically.' },
                        { icon: <LightBulbIcon className="w-6 h-6 text-white"/>, title: 'Financial Insights', desc: 'Get AI-driven summaries of cash flow, spending habits, and recurring payment alerts.' },
                    ].map((feature, idx) => (
                        <div key={idx} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl hover:border-gray-600 transition-all hover:-translate-y-1 duration-300">
                            <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-6">{feature.icon}</div>
                            <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- Section 6: Security --- */}
            <div id="security" className="py-24 bg-gray-900/50 border-y border-gray-800">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/20 text-green-400 mb-8 border border-green-900">
                        <ShieldCheckIcon className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-bold mb-6">Enterprise-Grade Security</h2>
                    <p className="text-gray-400 mb-10 text-lg">
                        Your financial data is sensitive. We treat it that way. 
                        DocuFlow employs state-of-the-art encryption and strictly adheres to data privacy regulations.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                        <div className="bg-black p-5 rounded-lg border border-gray-800">
                            <h4 className="font-bold text-white mb-2">Encrypted Storage</h4>
                            <p className="text-sm text-gray-500">AES-256 encryption for all stored documents and database entries.</p>
                        </div>
                        <div className="bg-black p-5 rounded-lg border border-gray-800">
                            <h4 className="font-bold text-white mb-2">Role-Based Access</h4>
                            <p className="text-sm text-gray-500">Granular permissions ensure only authorized personnel see sensitive info.</p>
                        </div>
                        <div className="bg-black p-5 rounded-lg border border-gray-800">
                            <h4 className="font-bold text-white mb-2">Local Compliance</h4>
                            <p className="text-sm text-gray-500">Built with UAE Federal Tax Authority requirements in mind.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Section 7: Pricing --- */}
            <div id="pricing" className="py-32">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
                        <p className="text-gray-400">Choose the plan that fits your business scale.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {/* Starter */}
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col">
                            <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
                            <p className="text-gray-400 text-sm mb-6">For freelancers & small consultancies.</p>
                            <div className="text-4xl font-bold text-white mb-6">$49<span className="text-lg text-gray-500 font-normal">/mo</span></div>
                            <button onClick={onGetStarted} className="w-full py-3 bg-gray-800 text-white rounded-xl font-semibold mb-8 hover:bg-gray-700 transition-colors">Start Free Trial</button>
                            <ul className="space-y-4 flex-1">
                                {['100 Documents / mo', 'Basic Bank Analysis', 'Invoice Processing', '1 User'].map(f => (
                                    <li key={f} className="flex items-center text-sm text-gray-300"><CheckIcon className="w-4 h-4 text-gray-500 mr-3"/>{f}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Pro */}
                        <div className="bg-gray-900 border border-blue-600 rounded-2xl p-8 flex flex-col relative transform scale-105 shadow-2xl shadow-blue-900/20">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase">Most Popular</div>
                            <h3 className="text-xl font-bold text-white mb-2">Professional</h3>
                            <p className="text-gray-400 text-sm mb-6">For growing accounting firms.</p>
                            <div className="text-4xl font-bold text-white mb-6">$149<span className="text-lg text-gray-500 font-normal">/mo</span></div>
                            <button onClick={onGetStarted} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold mb-8 hover:bg-blue-500 transition-colors">Start Free Trial</button>
                            <ul className="space-y-4 flex-1">
                                {['1,000 Documents / mo', 'Advanced Analysis', 'VAT & Corporate Tax', '5 Users', 'Priority Support'].map(f => (
                                    <li key={f} className="flex items-center text-sm text-white"><CheckIcon className="w-4 h-4 text-blue-400 mr-3"/>{f}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Enterprise */}
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col">
                            <h3 className="text-xl font-bold text-white mb-2">Enterprise</h3>
                            <p className="text-gray-400 text-sm mb-6">For large organizations.</p>
                            <div className="text-4xl font-bold text-white mb-6">Custom</div>
                            <button onClick={onGetStarted} className="w-full py-3 bg-gray-800 text-white rounded-xl font-semibold mb-8 hover:bg-gray-700 transition-colors">Contact Sales</button>
                            <ul className="space-y-4 flex-1">
                                {['Unlimited Documents', 'Custom AI Models', 'API Access', 'Unlimited Users', 'Dedicated Account Manager'].map(f => (
                                    <li key={f} className="flex items-center text-sm text-gray-300"><CheckIcon className="w-4 h-4 text-gray-500 mr-3"/>{f}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Section 8: FAQ --- */}
            <div id="faq" className="py-24 bg-black border-t border-gray-800">
                <div className="max-w-3xl mx-auto px-6">
                    <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
                    <div className="space-y-4">
                        {[
                            { q: "Is my data secure?", a: "Yes. We use AES-256 encryption for storage and TLS for data in transit. We do not use your data to train public AI models." },
                            { q: "Does it support Arabic documents?", a: "Yes! Our AI models are capable of extracting and translating data from Arabic documents, including Trade Licenses and Invoices." },
                            { q: "Can I export to Xero or QuickBooks?", a: "Currently we support Excel and CSV exports formatted for major accounting software. Direct API integrations are on our roadmap." },
                            { q: "How accurate is the extraction?", a: "We typically see 98-99% accuracy for standard typed documents. Handwriting recognition varies but is supported." }
                        ].map((item, idx) => (
                            <div key={idx} className="border border-gray-800 rounded-lg bg-gray-900 overflow-hidden">
                                <button 
                                    onClick={() => toggleFaq(idx)}
                                    className="w-full p-5 text-left flex justify-between items-center hover:bg-gray-800 transition-colors"
                                >
                                    <span className="font-semibold text-gray-200">{item.q}</span>
                                    <ChevronDownIcon className={`w-5 h-5 text-gray-500 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                                </button>
                                {openFaq === idx && (
                                    <div className="p-5 pt-0 text-gray-400 text-sm leading-relaxed border-t border-gray-800/50">
                                        {item.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- Section 9: CTA --- */}
            <div className="py-20 bg-gradient-to-b from-gray-900 to-black border-t border-gray-800">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-4xl font-bold text-white mb-6">Ready to streamline your workflow?</h2>
                    <p className="text-xl text-gray-400 mb-10">Join thousands of finance professionals saving hours every week.</p>
                    <button 
                        onClick={onGetStarted}
                        className="px-10 py-4 bg-white text-black text-lg font-bold rounded-full hover:bg-gray-200 transition-all shadow-xl hover:scale-105"
                    >
                        Get Started for Free
                    </button>
                </div>
            </div>

            {/* --- Footer --- */}
            <footer className="border-t border-gray-800 py-12 bg-black text-sm">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
                    <div className="flex items-center space-x-2 mb-4 md:mb-0">
                        <div className="w-6 h-6 bg-gradient-to-tr from-blue-600 to-purple-600 rounded flex items-center justify-center">
                            <SparklesIcon className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-lg font-bold text-gray-200">DocuFlow</span>
                    </div>
                    <div className="flex space-x-8 text-gray-500">
                        <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-white transition-colors">Contact Support</a>
                    </div>
                    <p className="text-gray-600 mt-4 md:mt-0">
                        &copy; 2025 DocuFlow. All rights reserved.
                    </p>
                </div>
            </footer>

            {/* Scroll to Top Button */}
            {showBackToTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-8 right-8 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg transition-all animate-bounce z-50"
                    aria-label="Scroll to top"
                >
                    <ArrowUpIcon className="w-6 h-6" />
                </button>
            )}
        </div>
    );
};
