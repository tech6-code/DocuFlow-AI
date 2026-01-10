import { supabase } from './supabase';
import { SalesSettingItem, SalesSettings } from '../types';

const STORAGE_KEY = 'docuflow_sales_settings_extra'; // for brands and owners

const DEFAULT_EXTRA = {
    brands: [],
    leadOwners: [],
    services: ['VAT Filing', 'Registration', 'Audit', 'Bookkeeping'],
    serviceClosedOptions: ['Yes', 'No'],
    paymentStatusOptions: ['Paid', 'Pending', 'Overdue', 'Partial']
};

export const salesSettingsService = {
    async getLeadSources(): Promise<SalesSettingItem[]> {
        const { data, error } = await supabase.from('lead_sources').select('*').order('name');
        if (error) throw error;
        return data || [];
    },

    async addLeadSource(name: string): Promise<SalesSettingItem> {
        const { data, error } = await supabase.from('lead_sources').insert([{ name }]).select().single();
        if (error) throw error;
        return data;
    },

    async deleteLeadSource(id: string): Promise<void> {
        const { error } = await supabase.from('lead_sources').delete().eq('id', id);
        if (error) throw error;
    },

    async getServicesRequired(): Promise<SalesSettingItem[]> {
        const { data, error } = await supabase.from('service_required').select('*').order('name');
        if (error) throw error;
        return data || [];
    },

    async addServiceRequired(name: string): Promise<SalesSettingItem> {
        const { data, error } = await supabase.from('service_required').insert([{ name }]).select().single();
        if (error) throw error;
        return data;
    },

    async deleteServiceRequired(id: string): Promise<void> {
        const { error } = await supabase.from('service_required').delete().eq('id', id);
        if (error) throw error;
    },

    async getLeadQualifications(): Promise<SalesSettingItem[]> {
        const { data, error } = await supabase.from('lead_qualifications').select('*').order('name');
        if (error) throw error;
        return data || [];
    },

    async addLeadQualification(name: string): Promise<SalesSettingItem> {
        const { data, error } = await supabase.from('lead_qualifications').insert([{ name }]).select().single();
        if (error) throw error;
        return data;
    },

    async deleteLeadQualification(id: string): Promise<void> {
        const { error } = await supabase.from('lead_qualifications').delete().eq('id', id);
        if (error) throw error;
    },

    // Brands and Lead Owners still in localStorage for now
    getExtraSettings() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? { ...DEFAULT_EXTRA, ...JSON.parse(stored) } : DEFAULT_EXTRA;
        } catch (e) {
            return DEFAULT_EXTRA;
        }
    },

    saveExtraSettings(settings: { brands: string[], leadOwners: string[], services: string[], serviceClosedOptions: string[], paymentStatusOptions: string[] }) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
};
