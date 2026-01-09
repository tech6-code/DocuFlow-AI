import { supabase } from './supabase';
import { Lead } from '../types';

export const leadsService = {
    async getLeads(): Promise<Lead[]> {
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching leads:', error);
            throw error;
        }

        return data.map((item: any) => ({
            id: item.id,
            date: item.date,
            companyName: item.company_name,
            mobileNumber: item.mobile_number,
            email: item.email,
            leadSource: item.lead_source,
            status: item.status,
            createdAt: item.created_at
        }));
    },



    async deleteLead(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting lead:', error);
            throw error;
        }

        return true;
    },

    async createLead(lead: Omit<Lead, 'id'> & { userId: string }): Promise<Lead | null> {
        const { data, error } = await supabase
            .from('leads')
            .insert([{
                user_id: lead.userId,
                date: lead.date,
                company_name: lead.companyName,
                mobile_number: lead.mobileNumber,
                email: lead.email,
                lead_source: lead.leadSource,
                status: lead.status,
                is_active: true
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating lead:', error);
            throw error;
        }

        return {
            id: data.id,
            date: data.date,
            companyName: data.company_name,
            mobileNumber: data.mobile_number,
            email: data.email,
            leadSource: data.lead_source,
            status: data.status,
            createdAt: data.created_at
        };
    },

    async updateLead(lead: Lead): Promise<Lead | null> {
        const { data, error } = await supabase
            .from('leads')
            .update({
                date: lead.date,
                company_name: lead.companyName,
                mobile_number: lead.mobileNumber,
                email: lead.email,
                lead_source: lead.leadSource,
                status: lead.status
            })
            .eq('id', lead.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating lead:', error);
            throw error;
        }

        return {
            id: data.id,
            date: data.date,
            companyName: data.company_name,
            mobileNumber: data.mobile_number,
            email: data.email,
            leadSource: data.lead_source,
            status: data.status,
            createdAt: data.created_at
        };
    }
};
