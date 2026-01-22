import { apiFetch, setSession } from "./apiClient";
import type { User } from "../types";

let userProfileCache: Record<string, User> = {};
let profileFetchPromises: Record<string, Promise<User | null>> = {};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function mapUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roleId: row.role_id,
    departmentId: row.department_id || ""
  };
}

export const userService = {
  clearCache() {
    userProfileCache = {};
    profileFetchPromises = {};
  },

  async signIn(email: string, password: string): Promise<Result<User>> {
    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      if (!res?.session?.access_token) {
        return { ok: false, message: "Login failed. No session created." };
      }

      setSession(res.session);
      if (!res?.profile) {
        return { ok: false, message: "Login failed. No profile returned." };
      }
      return { ok: true, data: mapUser(res.profile) };
    } catch (err: any) {
      return { ok: false, message: err.message || "Login failed" };
    }
  },

  async signUp(
    name: string,
    email: string,
    password: string
  ): Promise<Result<{ needsEmailConfirm: boolean; message?: string }>> {
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      });

      // Auto-login after registration
      const loginRes = await this.signIn(email, password);
      if (!loginRes.ok) return { ok: false, message: loginRes.message };

      return { ok: true, data: { needsEmailConfirm: false } };
    } catch (err: any) {
      return { ok: false, message: err.message || "Registration failed" };
    }
  },

  async getUserProfile(id: string): Promise<User | null> {
    if (!id) return null;
    if (userProfileCache[id]) return userProfileCache[id];
    if (profileFetchPromises[id]) return profileFetchPromises[id];

    profileFetchPromises[id] = (async () => {
      try {
        const row = await apiFetch(`/users/${id}`);
        if (!row) return null;
        const user = mapUser(row);
        userProfileCache[id] = user;
        return user;
      } catch (err) {
        return null;
      } finally {
        delete profileFetchPromises[id];
      }
    })();

    return profileFetchPromises[id];
  },

  async getUsers(): Promise<User[] | null> {
    try {
      const data = await apiFetch("/users");
      return (data || []).map(mapUser);
    } catch (_err) {
      return null;
    }
  },

  async createUser(user: Omit<User, "id">): Promise<User | null> {
    const data = await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        departmentId: user.departmentId
      })
    });

    return data ? mapUser(data) : null;
  },

  async updateUser(user: User): Promise<User | null> {
    const data = await apiFetch(`/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        departmentId: user.departmentId
      })
    });

    const updated = data ? mapUser(data) : null;
    if (updated) userProfileCache[updated.id] = updated;
    return updated;
  },

  async deleteUser(id: string): Promise<boolean> {
    await apiFetch(`/users/${id}`, { method: "DELETE" });
    delete userProfileCache[id];
    return true;
  }
};
