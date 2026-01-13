import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { DealForm } from '../components/DealForm';
import { Deal } from '../types';

export const DealFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { deals, addDeal, updateDeal } = useData();
    const [dealToEdit, setDealToEdit] = useState<Deal | null>(null);

    useEffect(() => {
        if (id) {
            const deal = deals.find(d => d.id === id);
            if (deal) {
                setDealToEdit(deal);
            } else {
                console.error(`Deal with ID ${id} not found`);
                // Optionally navigate back if not found
            }
        } else {
            setDealToEdit(null);
        }
    }, [id, deals]);

    const handleSave = async (data: Omit<Deal, 'id'>) => {
        if (id && dealToEdit) {
            await updateDeal({ ...data, id: dealToEdit.id });
        } else {
            await addDeal(data);
        }
        navigate('/sales/deals');
    };

    const handleCancel = () => {
        navigate('/sales/deals');
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <DealForm
                initialData={dealToEdit}
                onSave={handleSave}
                onCancel={handleCancel}
            />
        </div>
    );
};
