
import { supabase } from './supabase';
import type { Department } from '../types';

export const departmentService = {
    async getDepartments(): Promise<Department[]> {
        const { data, error } = await supabase
            .from('departments')
            .select('*')
            .order('name');
        
        if (error) {
            console.error('Error fetching departments:', error);
            return [];
        }
        
        return data || [];
    },

    async createDepartment(name: string): Promise<Department | null> {
        const { data, error } = await supabase
            .from('departments')
            .insert([{ name }])
            .select()
            .single();

        if (error) {
            console.error('Error creating department:', error);
            throw new Error(error.message);
        }

        return data;
    },

    async updateDepartment(department: Department): Promise<Department | null> {
        const { data, error } = await supabase
            .from('departments')
            .update({ name: department.name })
            .eq('id', department.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating department:', error);
            throw new Error(error.message);
        }

        return data;
    },

    async deleteDepartment(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('departments')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting department:', error);
            return false;
        }
        return true;
    }
};
