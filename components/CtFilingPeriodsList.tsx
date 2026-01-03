
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { ctFilingService } from '../services/ctFilingService';
import { CtFilingPeriod, CtType, Company } from '../types';
import {
    ChevronLeftIcon,
    ArrowRightIcon,
    TrashIcon,
    BuildingOfficeIcon,
    EyeIcon,
    PencilIcon
} from './icons';
import { SimpleLoading } from './SimpleLoading';

export const CtFilingPeriodsList: React.FC = () => {
    const { customerId, typeName } = useParams<{ customerId: string, typeName: string }>();
    const navigate = useNavigate();
    const { projectCompanies } = useData();
    const [company, setCompany] = useState<Company | null>(null);
    const [periods, setPeriods] = useState<CtFilingPeriod[]>([]);
    const [loading, setLoading] = useState(true);
    const [ctTypes, setCtTypes] = useState<CtType[]>([]);
    const [currentType, setCurrentType] = useState<CtType | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!customerId || !typeName) return;

            setLoading(true);
            try {
                // Find company
                const foundCompany = projectCompanies.find(c => c.id === customerId);
                if (foundCompany) setCompany(foundCompany);

                // Fetch CT types to find the ID for typeName
                const types = await ctFilingService.getCtTypes();
                setCtTypes(types);

                // Map typeName (e.g., 'type1') to ct_types name (e.g., 'CT Type 1')
                const typeNum = typeName.replace('type', '');
                const targetName = `CT Type ${typeNum}`;
                const matchedType = types.find(t => t.name.toLowerCase() === targetName.toLowerCase());

                if (matchedType) {
                    setCurrentType(matchedType);
                    const dbPeriods = await ctFilingService.getFilingPeriods(customerId, matchedType.id);
                    setPeriods(dbPeriods);
                }
            } catch (error) {
                console.error("Error fetching periods:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [customerId, typeName, projectCompanies]);

    const handleDeletePeriod = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this filing period?")) return;

        try {
            await ctFilingService.deleteFilingPeriod(id);
            setPeriods(prev => prev.filter(p => p.id !== id));
        } catch (error: any) {
            alert("Error deleting period: " + error.message);
        }
    };

    if (loading) return <SimpleLoading message="Loading filing periods..." />;
    if (!company || !currentType) return <div className="p-8 text-center text-red-500">Resource not found</div>;

    return (
        <div className="min-h-screen bg-[#0a0f1a] text-white">
            <button
                onClick={() => navigate(`/projects/ct-filing/${customerId}`)}
                className="mb-6 text-sm text-gray-400 hover:text-white flex items-center transition-colors"
            >
                <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Type Selection
            </button>

            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center border border-gray-700">
                        <BuildingOfficeIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{company.name}</h1>
                        <p className="text-sm text-gray-400 flex items-center mt-1">
                            <span className="inline-block px-2 py-0.5 bg-blue-900/40 text-blue-400 rounded text-xs font-medium mr-2 border border-blue-500/30">
                                {currentType.name}
                            </span>
                            {company.trn}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate(`/projects/ct-filing/${customerId}/${typeName}/add-period`)}
                    className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors flex items-center space-x-2"
                >
                    <span className="text-xl">+</span>
                    <span>Add Filing Period</span>
                </button>
            </div>

            <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
                <div className="grid grid-cols-[1.5fr_1.5fr_1.5fr_1fr_150px] gap-4 px-6 py-4 bg-[#0f1419] border-b border-gray-700">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Period From</div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Period To</div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Due Date</div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Action</div>
                </div>

                {periods.length === 0 ? (
                    <div className="px-6 py-16 text-center text-gray-500">
                        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-gray-800/50 rounded-full text-gray-600">
                            <EyeIcon className="w-8 h-8" />
                        </div>
                        <p className="text-lg mb-2 font-medium">No filing periods added yet</p>
                        <p className="text-sm">Create your first filing period to start the {currentType.name} workflow.</p>
                    </div>
                ) : (
                    periods.map(period => (
                        <div key={period.id} className="grid grid-cols-[1.5fr_1.5fr_1.5fr_1fr_150px] gap-4 px-6 py-5 border-b border-gray-700/50 last:border-b-0 items-center hover:bg-gray-800/30 transition-colors">
                            <div className="text-sm font-medium">{new Date(period.periodFrom).toLocaleDateString()}</div>
                            <div className="text-sm font-medium">{new Date(period.periodTo).toLocaleDateString()}</div>
                            <div className="text-sm font-medium">{new Date(period.dueDate).toLocaleDateString()}</div>
                            <div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${period.status === 'Completed' ? 'bg-green-900/20 text-green-400 border-green-500/30' :
                                    period.status === 'In Progress' ? 'bg-blue-900/20 text-blue-400 border-blue-500/30' :
                                        'bg-gray-800 text-gray-400 border-gray-700'
                                    }`}>
                                    {period.status}
                                </span>
                            </div>
                            <div className="flex items-center justify-end space-x-2">
                                <button
                                    onClick={() => navigate(`/projects/ct-filing/${customerId}/${typeName}/${period.id}/upload`)}
                                    className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                                    title="Go To Workflow"
                                >
                                    <ArrowRightIcon className="w-5 h-5" />
                                </button>
                                <button className="p-2 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors" title="View Details">
                                    <EyeIcon className="w-5 h-5" />
                                </button>
                                <button className="p-2 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors" title="Edit Period">
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleDeletePeriod(period.id)}
                                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Delete Period"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
