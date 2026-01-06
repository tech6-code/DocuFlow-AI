import { supabase } from "./supabase";
import type { User } from "../types";

/** Local cache to reduce repeated DB hits */
let userProfileCache: Record<string, User> = {};
let profileFetchPromises: Record<string, Promise<User | null>> = {};

type Result<T> =
    | { ok: true; data: T }
    | { ok: false; message: string };

// ✅ Accept PromiseLike (Supabase builders) + wrap safely
function withTimeout<T>(promiseLike: PromiseLike<T>, ms = 8000): Promise<T> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Request timeout. Please try again.")), ms);

        Promise.resolve(promiseLike)
            .then((v) => {
                clearTimeout(t);
                resolve(v);
            })
            .catch((e) => {
                clearTimeout(t);
                reject(e);
            });
    });
}

export const userService = {
    clearCache() {
        userProfileCache = {};
        profileFetchPromises = {};
    },

    // ---------------------------------------------------------------------------
    // AUTH (FAST)
    // ---------------------------------------------------------------------------

    async signIn(email: string, password: string): Promise<Result<null>> {
        const { data, error } = await withTimeout(
            supabase.auth.signInWithPassword({ email, password }),
            10000
        );

        if (error) {
            if (error.message?.toLowerCase().includes("invalid login credentials")) {
                return { ok: false, message: "Invalid email or password" };
            }
            return { ok: false, message: error.message || "Login failed" };
        }

        if (!data.session?.user) {
            return { ok: false, message: "Login failed. No session created." };
        }

        return { ok: true, data: null };
    },

    async signUp(
        name: string,
        email: string,
        password: string
    ): Promise<Result<{ needsEmailConfirm: boolean; message?: string }>> {
        const { data, error } = await withTimeout(
            supabase.auth.signUp({
                email,
                password,
                options: { data: { name } },
            }),
            10000
        );

        if (error) return { ok: false, message: error.message || "Registration failed" };
        if (!data.user) return { ok: false, message: "Registration failed: No user returned." };

        // If email confirmation is ON, session is null
        if (!data.session) {
            return {
                ok: true,
                data: {
                    needsEmailConfirm: true,
                    message: "Registration successful! Please check your email to confirm.",
                },
            };
        }

        // Session exists immediately -> ensure profile row exists
        await this.ensureProfile({
            id: data.user.id,
            name,
            email,
            roleId: "finance-clerk",
            departmentId: "",
        });

        return { ok: true, data: { needsEmailConfirm: false } };
    },

    // ---------------------------------------------------------------------------
    // PROFILE
    // ---------------------------------------------------------------------------

    async ensureProfile(user: Pick<User, "id" | "name" | "email" | "roleId" | "departmentId">) {
        try {
            // check exists
            const { data: existing, error: selErr } = await withTimeout(
                supabase.from("users").select("id").eq("id", user.id).maybeSingle(),
                8000
            );

            // If select blocked by RLS, we can't check; just try insert
            if (!selErr && existing?.id) return;

            const insertPayload = {
                id: user.id,
                name: user.name,
                email: user.email,
                role_id: user.roleId,
                department_id: user.departmentId ? user.departmentId : null,
            };

            const { error: insErr } = await withTimeout(
                supabase.from("users").insert([insertPayload]),
                8000
            );

            if (insErr) {
                console.warn("ensureProfile insert blocked/failed:", insErr.message);
            }
        } catch (e: any) {
            console.warn("ensureProfile error:", e?.message || e);
        }
    },

    async getUserProfile(id: string): Promise<User | null> {
        if (!id) return null;

        if (userProfileCache[id]) return userProfileCache[id];
        if (profileFetchPromises[id]) return profileFetchPromises[id];

        profileFetchPromises[id] = (async () => {
            try {
                const { data: profile, error } = await withTimeout(
                    supabase.from("users").select("*").eq("id", id).single(),
                    8000
                );

                if (error || !profile) {
                    console.error("Profile fetch failed:", error?.message || error);
                    return null;
                }

                const user: User = {
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    roleId: profile.role_id,
                    departmentId: profile.department_id || "",
                };

                userProfileCache[id] = user;
                return user;
            } catch (err: any) {
                console.error("getUserProfile error:", err?.message || err);
                return null;
            } finally {
                delete profileFetchPromises[id];
            }
        })();

        return profileFetchPromises[id];
    },

    // ---------------------------------------------------------------------------
    // USERS CRUD
    // ---------------------------------------------------------------------------

    async getUsers(): Promise<User[] | null> {
        try {
            const { data, error } = await withTimeout(
                supabase.from("users").select("*"),
                8000
            );

            if (error) {
                console.error("Supabase error fetching users:", error.message || error);
                return null;
            }

            if (!data) return [];

            return data.map((u: any) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                roleId: u.role_id,
                departmentId: u.department_id || "",
            }));
        } catch (e) {
            console.error("getUsers error:", e);
            return null;
        }
    },

    async createUser(user: Omit<User, 'id'>): Promise<User | null> {
        try {
            // Generate a unique ID for the user
            const userId = crypto.randomUUID();

            const insertPayload = {
                id: userId,
                name: user.name,
                email: user.email,
                role_id: user.roleId,
                department_id: user.departmentId ? user.departmentId : null,
            };

            const { data, error } = await withTimeout(
                supabase.from("users").insert([insertPayload]).select().single(),
                8000
            );

            if (error) {
                console.error("Error creating user:", error.message || error);
                throw new Error(error.message);
            }

            const newUser: User = {
                id: data.id,
                name: data.name,
                email: data.email,
                roleId: data.role_id,
                departmentId: data.department_id || "",
            };

            userProfileCache[newUser.id] = newUser;
            return newUser;
        } catch (e: any) {
            console.error("createUser error:", e);
            throw new Error(e.message || "Failed to create user");
        }
    },

    async updateUser(user: User): Promise<User | null> {
        const updatePayload: any = {
            name: user.name,
            email: user.email,
            role_id: user.roleId,
            department_id: user.departmentId ? user.departmentId : null,
        };

        const { data, error } = await withTimeout(
            supabase.from("users").update(updatePayload).eq("id", user.id).select().single(),
            8000
        );

        if (error) {
            console.error("Error updating user:", error.message || error);
            throw new Error(error.message);
        }

        const updatedUser: User = {
            id: data.id,
            name: data.name,
            email: data.email,
            roleId: data.role_id,
            departmentId: data.department_id || "",
        };

        userProfileCache[updatedUser.id] = updatedUser;
        return updatedUser;
    },

    async deleteUser(id: string): Promise<boolean> {
        const { error } = await withTimeout(
            supabase.from("users").delete().eq("id", id),
            8000
        );

        if (error) {
            console.error("Error deleting user:", error.message || error);
            return false;
        }

        delete userProfileCache[id];
        return true;
    },
};
