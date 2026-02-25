
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
    PencilIcon,
    PlusIcon
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

                // Support both legacy names (e.g. "CT Type 1") and custom names
                // like "TYPE 4 WORKFLOW (AUDIT REPORT)" using the route slug (type4).
                const typeNum = (typeName.match(/\d+/)?.[0] || '').trim();
                const targetName = `CT Type ${typeNum}`;
                const matchedType =
                    types.find(t => t.name.toLowerCase() === targetName.toLowerCase()) ||
                    (typeNum ? types.find(t => new RegExp(`\\btype\\s*${typeNum}\\b`, 'i').test(t.name)) : undefined);

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
        <div className="min-h-full bg-background text-foreground p-8">
            <button
                onClick={() => navigate(`/projects/ct-filing/${customerId}`)}
                className="mb-6 text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"
            >
                <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Type Selection
            </button>

            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center border border-border">
                        <BuildingOfficeIcon className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">{company.name}</h1>
                        <p className="text-sm text-muted-foreground flex items-center mt-1">
                            <span className="inline-block px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium mr-2 border border-primary/20">
                                {currentType.name}
                            </span>
                            {company.corporateTaxTrn || 'N/A'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate(`/projects/ct-filing/${customerId}/${typeName}/add-period`)}
                    className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center space-x-2 shadow-lg shadow-primary/20"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>Add Filing Period</span>
                </button>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="grid grid-cols-[1.5fr_1.5fr_1.5fr_1fr_150px] gap-4 px-6 py-4 bg-muted/50 border-b border-border">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Period From</div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Period To</div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date</div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Action</div>
                </div>

                {periods.length === 0 ? (
                    <div className="px-6 py-16 text-center text-muted-foreground">
                        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full text-muted-foreground/30">
                            <EyeIcon className="w-8 h-8" />
                        </div>
                        <p className="text-lg mb-2 font-medium text-foreground">No filing periods added yet</p>
                        <p className="text-sm">Create your first filing period to start the {currentType.name} workflow.</p>
                    </div>
                ) : (
                    periods.map(period => (
                        <div key={period.id} className="grid grid-cols-[1.5fr_1.5fr_1.5fr_1fr_150px] gap-4 px-6 py-5 border-b border-border/50 last:border-b-0 items-center hover:bg-accent/50 transition-colors">
                            <div className="text-sm font-medium text-foreground">{new Date(period.periodFrom).toLocaleDateString()}</div>
                            <div className="text-sm font-medium text-foreground">{new Date(period.periodTo).toLocaleDateString()}</div>
                            <div className="text-sm font-medium text-foreground">{new Date(period.dueDate).toLocaleDateString()}</div>
                            <div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${period.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                    period.status === 'In Progress' ? 'bg-primary/10 text-primary border-primary/20' :
                                        'bg-muted text-muted-foreground border-border'
                                    }`}>
                                    {period.status}
                                </span>
                            </div>
                            <div className="flex items-center justify-end space-x-2">
                                <button
                                    onClick={() => navigate(`/projects/ct-filing/${customerId}/${typeName}/${period.id}/upload`)}
                                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="Go To Workflow"
                                >
                                    <ArrowRightIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => navigate(`/projects/ct-filing/${customerId}/${typeName}/${period.id}/upload?new=true`)}
                                    className="p-2 text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                    title="New Conversion Attempt"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => navigate(`/projects/ct-filing/${customerId}/${typeName}/${period.id}/conversions`)}
                                    className="p-2 text-muted-foreground hover:bg-accent rounded-lg transition-colors"
                                    title="View Conversion Attempts"
                                >
                                    <EyeIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => navigate(`/projects/ct-filing/${customerId}/${typeName}/${period.id}/edit`)}
                                    className="p-2 text-muted-foreground hover:bg-accent rounded-lg transition-colors"
                                    title="Edit Period"
                                >
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleDeletePeriod(period.id)}
                                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
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
