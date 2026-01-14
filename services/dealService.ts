import { supabase } from './supabase';
import { Deal } from '../types';

export const dealService = {
    async getDeals(): Promise<Deal[]> {
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .order('deal_date', { ascending: false });

        if (error) {
            console.error('Error fetching deals:', error);
            return [];
        }

        return (data || []).map(mapFromDb);
    },

    async createDeal(deal: Omit<Deal, 'id'> & { userId?: string }): Promise<Deal | null> {
        const dealData = mapToDb(deal);

        // Add user_id if provided
        if (deal.userId) {
            dealData.user_id = deal.userId;
        }

        const { data, error } = await supabase
            .from('deals')
            .insert([dealData])
            .select()
            .single();

        if (error) {
            console.error('Error creating deal:', error);
            throw new Error(`Failed to create deal: ${error.message}`);
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
            throw new Error(`Failed to update deal: ${error.message}`);
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
            throw new Error(`Failed to delete deal: ${error.message}`);
        }

        return true;
    }
};

// Mappers to handle camelCase (frontend) vs snake_case (database) conversion
function mapToDb(deal: Partial<Deal> | any): any {
    const mapped: any = {};

    // Map fields according to actual database schema
    if (deal.cifNumber !== undefined) mapped.cif = deal.cifNumber;
    if (deal.date !== undefined) mapped.deal_date = deal.date || null;
    if (deal.name !== undefined) mapped.name = deal.name;
    if (deal.companyName !== undefined) mapped.company_name = deal.companyName;
    if (deal.brand !== undefined) mapped.brand = deal.brand || null;
    if (deal.contactNo !== undefined) mapped.contact_number = deal.contactNo;
    if (deal.email !== undefined) mapped.email = deal.email;
    if (deal.leadSource !== undefined) mapped.lead_source = deal.leadSource || null;
    if (deal.services !== undefined) mapped.service = deal.services || null;
    if (deal.serviceClosed !== undefined) mapped.service_closed = deal.serviceClosed === 'Yes';
    if (deal.serviceAmount !== undefined) mapped.service_amount = deal.serviceAmount || 0;
    if (deal.closingDate !== undefined) mapped.closing_date = deal.closingDate || null;
    if (deal.paymentStatus !== undefined) mapped.payment_status = deal.paymentStatus;
    if (deal.custom_data !== undefined) mapped.custom_data = deal.custom_data;

    return mapped;
}

function mapFromDb(dbDeal: any): Deal {
    return {
        id: dbDeal.id,
        cifNumber: dbDeal.cif || '',
        date: dbDeal.deal_date || '',
        name: dbDeal.name || '',
        companyName: dbDeal.company_name || '',
        brand: dbDeal.brand || '',
        contactNo: dbDeal.contact_number || '',
        email: dbDeal.email || '',
        leadSource: dbDeal.lead_source || '',
        services: dbDeal.service || '',
        serviceClosed: dbDeal.service_closed ? 'Yes' : 'No',
        serviceAmount: dbDeal.service_amount || 0,
        closingDate: dbDeal.closing_date || '',
        paymentStatus: dbDeal.payment_status || 'Pending',
        custom_data: dbDeal.custom_data
    };
}
