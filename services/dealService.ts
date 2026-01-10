import { supabase } from './supabase';
import { Deal } from '../types';

export const dealService = {
    async getDeals(): Promise<Deal[]> {
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching deals:', error);
            return [];
        }

        return (data || []).map(mapFromDb);
    },

    async createDeal(deal: Omit<Deal, 'id'>): Promise<Deal | null> {
        const { data, error } = await supabase
            .from('deals')
            .insert([mapToDb(deal)])
            .select()
            .single();

        if (error) {
            console.error('Error creating deal:', error);
            return null;
        }

        return mapFromDb(data);
    },

    async updateDeal(id: string, deal: Partial<Deal>): Promise<Deal | null> {
        const { data, error } = await supabase
            .from('deals')
            .update(mapToDb(deal))
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating deal:', error);
            return null;
        }

        return mapFromDb(data);
    },

    async deleteDeal(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('deals')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting deal:', error);
            return false;
        }

        return true;
    }
};

// Mappers to handle potential camelCase (frontend) vs snake_case (database) conversion
function mapToDb(deal: Partial<Deal>) {
    return {
        cif_number: deal.cifNumber,
        date: deal.date,
        name: deal.name,
        company_name: deal.companyName,
        brand: deal.brand,
        contact_no: deal.contactNo,
        email: deal.email,
        lead_source: deal.leadSource,
        services: deal.services,
        service_closed: deal.serviceClosed,
        service_amount: deal.serviceAmount,
        closing_date: deal.closingDate,
        payment_status: deal.paymentStatus
    };
}

function mapFromDb(dbDeal: any): Deal {
    return {
        id: dbDeal.id,
        cifNumber: dbDeal.cif_number,
        date: dbDeal.date,
        name: dbDeal.name,
        companyName: dbDeal.company_name,
        brand: dbDeal.brand,
        contactNo: dbDeal.contact_no,
        email: dbDeal.email,
        leadSource: dbDeal.lead_source,
        services: dbDeal.services,
        serviceClosed: dbDeal.service_closed,
        serviceAmount: dbDeal.service_amount,
        closingDate: dbDeal.closing_date,
        paymentStatus: dbDeal.payment_status
    };
}
