import { supabase } from './supabase';
import { SalesSettingItem, SalesSettings } from '../types';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'dropdown' | 'radio' | 'checkbox';

export interface CustomField {
    id: string;
    type: FieldType;
    label: string;
    placeholder?: string;
    required: boolean;
    options?: string[];
    module: 'leads' | 'deals' | 'customers';
    sort_order?: number;
}

const STORAGE_KEY = 'docuflow_sales_settings_extra'; // for brands and owners

const DEFAULT_EXTRA = {
    brands: [],
    leadOwners: [],
    services: ['VAT Filing', 'Registration', 'Audit', 'Bookkeeping'],
    serviceClosedOptions: ['Yes', 'No'],
    paymentStatusOptions: ['Paid', 'Pending', 'Overdue', 'Partial'],
    customFields: [] as CustomField[]
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

    async updateLeadSource(id: string, name: string): Promise<SalesSettingItem> {
        const { data, error } = await supabase.from('lead_sources').update({ name }).eq('id', id).select().single();
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

    async updateServiceRequired(id: string, name: string): Promise<SalesSettingItem> {
        const { data, error } = await supabase.from('service_required').update({ name }).eq('id', id).select().single();
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

    async updateLeadQualification(id: string, name: string): Promise<SalesSettingItem> {
        const { data, error } = await supabase.from('lead_qualifications').update({ name }).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteLeadQualification(id: string): Promise<void> {
        const { error } = await supabase.from('lead_qualifications').delete().eq('id', id);
        if (error) throw error;
    },

    async getBrands(): Promise<SalesSettingItem[]> {
        const { data, error } = await supabase.from('brands').select('*').order('name');
        if (error) throw error;
        return data || [];
    },

    async addBrand(name: string): Promise<SalesSettingItem> {
        const { data, error } = await supabase.from('brands').insert([{ name }]).select().single();
        if (error) throw error;
        return data;
    },

    async updateBrand(id: string, name: string): Promise<SalesSettingItem> {
        const { data, error } = await supabase.from('brands').update({ name }).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteBrand(id: string): Promise<void> {
        const { error } = await supabase.from('brands').delete().eq('id', id);
        if (error) throw error;
    },

    async getLeadOwners(): Promise<SalesSettingItem[]> {
        const { data, error } = await supabase.from('lead_owners').select('*').order('name');
        if (error) throw error;
        return data || [];
    },

    async addLeadOwner(name: string): Promise<SalesSettingItem> {
        const { data, error } = await supabase.from('lead_owners').insert([{ name }]).select().single();
        if (error) throw error;
        return data;
    },

    async updateLeadOwner(id: string, name: string): Promise<SalesSettingItem> {
        const { data, error } = await supabase.from('lead_owners').update({ name }).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteLeadOwner(id: string): Promise<void> {
        const { error } = await supabase.from('lead_owners').delete().eq('id', id);
        if (error) throw error;
    },

    // Custom Fields Methods backed by Supabase
    async getCustomFields(module: 'leads' | 'deals' | 'customers' = 'leads'): Promise<CustomField[]> {
        const { data, error } = await supabase
            .from('custom_fields')
            .select('*')
            .eq('module', module)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async addCustomField(field: Omit<CustomField, 'id'>): Promise<CustomField> {
        const { data, error } = await supabase
            .from('custom_fields')
            .insert([field])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateCustomField(id: string, field: Partial<CustomField>): Promise<CustomField> {
        const { data, error } = await supabase
            .from('custom_fields')
            .update(field)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteCustomField(id: string): Promise<void> {
        const { error } = await supabase
            .from('custom_fields')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // Remaining simple settings still in localStorage
    getExtraSettings() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            const extra = stored ? JSON.parse(stored) : {};
            return {
                ...DEFAULT_EXTRA,
                ...extra,
                brands: [], // These are now handled separately
                leadOwners: [],
                customFields: [] // No longer in localStorage
            };
        } catch (e) {
            return DEFAULT_EXTRA;
        }
    },

    saveExtraSettings(settings: any) {
        // Remove customFields from settings before saving to localStorage to avoid duplication
        const { customFields, ...rest } = settings;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    }
};
