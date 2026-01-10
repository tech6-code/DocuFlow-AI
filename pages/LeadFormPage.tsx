
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { LeadForm } from '../components/LeadForm';
import { Lead } from '../types';

export const LeadFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { leads, addLead, updateLead, salesSettings, users } = useData();
    const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);

    useEffect(() => {
        if (id) {
            const lead = leads.find(l => l.id === id);
            if (lead) {
                setLeadToEdit(lead);
            } else {
                // If ID is provided but lead not found, maybe still loading or invalid ID
                console.error(`Lead with ID ${id} not found`);
                // Optionally navigate back if not found
                // navigate('/sales/leads');
            }
        } else {
            setLeadToEdit(null);
        }
    }, [id, leads]);

    const handleSave = async (data: any) => {
        if (id && leadToEdit) {
            await updateLead({ ...data, id: leadToEdit.id });
        } else {
            await addLead(data);
        }
        navigate('/sales/leads');
    };

    const handleCancel = () => {
        navigate('/sales/leads');
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <LeadForm
                lead={leadToEdit}
                onSave={handleSave}
                onCancel={handleCancel}
                salesSettings={salesSettings}
                users={users}
            />
        </div>
    );
};
