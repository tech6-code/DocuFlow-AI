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
            brand: item.brand_id,
            mobileNumber: item.mobile_number,
            email: item.email,
            leadSource: item.lead_source,
            status: item.status,
            serviceRequired: item.service_required_id,
            leadQualification: item.lead_qualification_id,
            leadOwner: item.lead_owner_id,
            remarks: item.remarks,
            lastContact: item.last_contact,
            closingCycle: item.closing_cycle?.toString(),
            closingDate: item.expected_closing,
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
        // Safe integer parsing for closing_cycle
        const cycle = parseInt(lead.closingCycle || '');
        const closingCycle = isNaN(cycle) ? null : cycle;

        const { data, error } = await supabase
            .from('leads')
            .insert([{
                user_id: lead.userId,
                date: lead.date,
                company_name: lead.companyName,
                brand_id: lead.brand,
                mobile_number: lead.mobileNumber,
                email: lead.email,
                lead_source: lead.leadSource,
                status: lead.status,
                service_required_id: lead.serviceRequired,
                lead_qualification_id: lead.leadQualification,
                lead_owner_id: lead.leadOwner,
                remarks: lead.remarks,
                last_contact: lead.lastContact,
                closing_cycle: closingCycle,
                expected_closing: lead.closingDate,
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
            brand: data.brand_id,
            mobileNumber: data.mobile_number,
            email: data.email,
            leadSource: data.lead_source,
            status: data.status,
            serviceRequired: data.service_required_id,
            leadQualification: data.lead_qualification_id,
            leadOwner: data.lead_owner_id,
            remarks: data.remarks,
            lastContact: data.last_contact,
            closingCycle: data.closing_cycle?.toString(),
            closingDate: data.expected_closing,
            createdAt: data.created_at
        };
    },

    async updateLead(lead: Lead): Promise<Lead | null> {
        // Safe integer parsing for closing_cycle
        const cycle = parseInt(lead.closingCycle || '');
        const closingCycle = isNaN(cycle) ? null : cycle;

        const { data, error } = await supabase
            .from('leads')
            .update({
                date: lead.date,
                company_name: lead.companyName,
                brand_id: lead.brand,
                mobile_number: lead.mobileNumber,
                email: lead.email,
                lead_source: lead.leadSource,
                status: lead.status,
                service_required_id: lead.serviceRequired,
                lead_qualification_id: lead.leadQualification,
                lead_owner_id: lead.leadOwner,
                remarks: lead.remarks,
                last_contact: lead.lastContact,
                closing_cycle: closingCycle,
                expected_closing: lead.closingDate
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
            brand: data.brand_id,
            mobileNumber: data.mobile_number,
            email: data.email,
            leadSource: data.lead_source,
            status: data.status,
            serviceRequired: data.service_required_id,
            leadQualification: data.lead_qualification_id,
            leadOwner: data.lead_owner_id,
            remarks: data.remarks,
            lastContact: data.last_contact,
            closingCycle: data.closing_cycle?.toString(),
            closingDate: data.expected_closing,
            createdAt: data.created_at
        };
    }
};
