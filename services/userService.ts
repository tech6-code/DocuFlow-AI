
import { supabase } from './supabase';
import type { User } from '../types';

export const userService = {
    async getUsers(): Promise<User[] | null> {
        const { data, error } = await supabase
            .from('users')
            .select('*');
        
        if (error) {
            console.error('Supabase error fetching users:', error.message || error);
            if (error.message.includes('Could not find the table') || error.code === '42P01') {
                console.warn("%cACTION REQUIRED:", "color: red; font-weight: bold; font-size: 14px;");
                console.warn("The 'users' table does not exist in your Supabase project.");
            }
            return null;
        }
        
        if (!data) return [];

        return data.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            roleId: u.role_id,
            departmentId: u.department_id || '' // Handle null from DB by converting to empty string
            // Password is not returned as it is securely stored in Supabase Auth
        }));
    },

    async authenticate(email: string, password: string): Promise<User | null> {
        // 1. Authenticate with Supabase Auth (Checks hashed password)
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            // Handle "Email not confirmed" specifically - do not log as console.error
            if (error.message.includes("Email not confirmed")) {
                throw new Error("Email not confirmed. Please check your inbox for the verification link.");
            }
            
            // Handle Invalid Credentials without spamming console
            if (error.message.includes("Invalid login credentials")) {
                return null;
            }

            console.error("Authentication failed:", error.message);
            return null;
        }

        if (!data.session?.user) {
            return null;
        }

        // 2. Fetch User Profile from public 'users' table
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.session.user.id)
            .single();

        if (profileError || !profile) {
            console.error("Profile fetch failed:", profileError?.message);
            return null;
        }

        return {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            roleId: profile.role_id,
            departmentId: profile.department_id || ''
        };
    },

    async register(user: Omit<User, 'id' | 'roleId' | 'departmentId'>): Promise<User | null> {
        // Check user count to assign Super Admin role to the first user
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
        
        const defaultRole = count === 0 ? 'super-admin' : 'finance-clerk';
        // No default department. User must create departments first.
        const defaultDept = ''; 

        return this.createUser({
            ...user,
            roleId: defaultRole,
            departmentId: defaultDept
        });
    },

    async createUser(user: Omit<User, 'id'>): Promise<User | null> {
        // 1. Create Auth User (Handles Password Hashing)
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: user.email,
            password: user.password || '12345678', // Default password if not provided
            options: {
                data: {
                    name: user.name,
                }
            }
        });
            
        if (authError) {
            console.error('Error creating auth user:', authError.message);
            throw new Error(authError.message);
        }

        if (!authData.user) {
            throw new Error("User creation failed: No user returned.");
        }

        // 2. Create Public Profile linked by ID
        // Note: If email confirmation is ON, authData.session is null.
        // We still need to create the profile row using the unauthenticated RLS policy we set up.
        
        const { data: profileData, error: profileError } = await supabase
            .from('users')
            .insert([{
                id: authData.user.id, // Link to Auth User ID
                name: user.name,
                email: user.email,
                role_id: user.roleId,
                department_id: user.departmentId || null // Convert empty string to null for DB FK
            }])
            .select()
            .single();

        if (profileError) {
            console.error('Error creating user profile:', profileError.message);
            
            // Check for specific RLS error
            if (profileError.message.includes('row-level security') || profileError.code === '42501') {
                const msg = `Database Policy Error. To fix: Run the SQL script provided in the instructions to enable 'INSERT' for public.users.`;
                throw new Error(msg);
            }
            
            // Check for FK violation (invalid department)
            if (profileError.message.includes('foreign key constraint')) {
                throw new Error("Invalid Department. Please ensure the selected department exists.");
            }
            
            throw new Error(profileError.message);
        }

        // 3. Handle Email Confirmation Flow
        if (!authData.session) {
            throw new Error("Registration successful! Please check your email to confirm your account before logging in.");
        }

        return {
            id: profileData.id,
            name: profileData.name,
            email: profileData.email,
            roleId: profileData.role_id,
            departmentId: profileData.department_id || ''
        };
    },

    async updateUser(user: User): Promise<User | null> {
        const updatePayload: any = {
            name: user.name,
            email: user.email,
            role_id: user.roleId,
            department_id: user.departmentId || null // Handle empty string -> null update
        };

        const { data, error } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('id', user.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating user:', error.message || error);
            throw new Error(error.message);
        }

        return {
            id: data.id,
            name: data.name,
            email: data.email,
            roleId: data.role_id,
            departmentId: data.department_id || ''
        };
    },

    async deleteUser(id: string): Promise<boolean> {
        // Deletes the public profile. 
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);
            
        if (error) {
            console.error('Error deleting user:', error.message || error);
            return false;
        }
        return true;
    }
};
