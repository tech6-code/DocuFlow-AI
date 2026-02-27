import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { ctFilingService } from '../services/ctFilingService';
import { CtType, Company } from '../types';
import {
    ChevronLeftIcon,
    TrashIcon,
    BuildingOfficeIcon,
    EyeIcon,
    ArrowPathIcon
} from './icons';
import { SimpleLoading } from './SimpleLoading';

export const CtFilingConversionsList: React.FC = () => {
    const { customerId, typeName, periodId } = useParams<{ customerId: string, typeName: string, periodId: string }>();
    const navigate = useNavigate();
    const { projectCompanies, users } = useData();
    const [company, setCompany] = useState<Company | null>(null);
    const [conversions, setConversions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentType, setCurrentType] = useState<CtType | null>(null);

    const userNameById = useMemo(() => {
        const map = new Map<string, string>();
        users.forEach((u) => {
            if (u?.id) map.set(u.id, u.name || u.email || '');
        });
        return map;
    }, [users]);

    const getConversionUserLabel = (conv: any) => {
        if (!conv) return 'Unknown User';
        const byId = conv.user_id ? userNameById.get(conv.user_id) : undefined;
        if (byId) return byId;
        if (conv.user_name) return conv.user_name;
        if (conv.user_email) return conv.user_email;
        if (conv.user_id) return `${String(conv.user_id).slice(0, 8)}...`;
        return 'Unknown User';
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!customerId || !typeName || !periodId) return;

            setLoading(true);
            try {
                // Find company
                const foundCompany = projectCompanies.find(c => c.id === customerId);
                if (foundCompany) setCompany(foundCompany);

                // Fetch CT types to find the ID for typeName
                const types = await ctFilingService.getCtTypes();

                // Support both legacy names (e.g. "CT Type 1") and custom names
                // like "TYPE 4 WORKFLOW (AUDIT REPORT)" using the route slug (type4).
                const typeNum = (typeName.match(/\d+/)?.[0] || '').trim();
                const targetName = `CT Type ${typeNum}`;
                const matchedType =
                    types.find(t => t.name.toLowerCase() === targetName.toLowerCase()) ||
                    (typeNum ? types.find(t => new RegExp(`\\btype\\s*${typeNum}\\b`, 'i').test(t.name)) : undefined);

                if (matchedType) {
                    setCurrentType(matchedType);
                    const dbConversions = await ctFilingService.listConversions(periodId, matchedType.id);
                    setConversions(dbConversions);
                }
            } catch (error) {
                console.error("Error fetching conversions:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [customerId, typeName, periodId, projectCompanies]);

    const handleDeleteConversion = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this workflow attempt? This will permanently remove all experimental data associated with this run.")) return;

        try {
            await ctFilingService.deleteConversion(id);
            setConversions(prev => prev.filter(c => c.id !== id));
        } catch (error: any) {
            alert("Error deleting conversion: " + error.message);
        }
    };

    if (loading) return <SimpleLoading message="Loading workflow attempts..." />;
    if (!company || !currentType) return <div className="p-8 text-center text-red-500">Resource not found</div>;

    return (
        <div className="min-h-full bg-background text-foreground p-8">
            <button
                onClick={() => navigate(`/projects/ct-filing/${customerId}/${typeName}/filing-periods`)}
                className="mb-6 text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"
            >
                <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Filing Periods
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
                            Filing Period Attempts
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="grid grid-cols-[1.5fr_1fr_1fr_120px] gap-4 px-6 py-4 bg-muted/50 border-b border-border">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date Created</div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Action</div>
                </div>

                {conversions.length === 0 ? (
                    <div className="px-6 py-16 text-center text-muted-foreground">
                        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full text-muted-foreground/30">
                            <ArrowPathIcon className="w-8 h-8" />
                        </div>
                        <p className="text-lg mb-2 font-medium text-foreground">No attempts found</p>
                        <p className="text-sm">Start a new workflow to see your processing history here.</p>
                    </div>
                ) : (
                    conversions.map(conv => (
                        <div key={conv.id} className="grid grid-cols-[1.5fr_1fr_1fr_120px] gap-4 px-6 py-5 border-b border-border/50 last:border-b-0 items-center hover:bg-accent/50 transition-colors">
                            <div className="text-sm font-medium text-foreground">{new Date(conv.created_at).toLocaleString()}</div>
                            <div className="text-sm text-muted-foreground">{getConversionUserLabel(conv)}</div>
                            <div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${conv.status === 'submitted' || conv.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                    conv.status === 'draft' ? 'bg-primary/10 text-primary border-primary/20' :
                                        'bg-muted text-muted-foreground border-border'
                                    }`}>
                                    {conv.status.charAt(0).toUpperCase() + conv.status.slice(1)}
                                </span>
                            </div>
                            <div className="flex items-center justify-end space-x-2">
                                <button
                                    onClick={() => navigate(`/projects/ct-filing/${customerId}/${typeName}/${periodId}/conversions/${conv.id}`)}
                                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="View / Continue Workflow"
                                >
                                    <EyeIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleDeleteConversion(conv.id)}
                                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                    title="Delete Attempt"
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
