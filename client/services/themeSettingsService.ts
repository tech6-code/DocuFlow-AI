import { apiFetch } from "./apiClient";

export interface UserThemeSettingsRow {
  id: string;
  user_id: string;
  light_theme: Record<string, string>;
  dark_theme: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

export const themeSettingsService = {
  async getMyThemeSettings(): Promise<UserThemeSettingsRow | null> {
    const data = await apiFetch("/theme-settings/me");
    return data || null;
  },

  async upsertMyThemeSettings(payload: {
    lightTheme: Record<string, string>;
    darkTheme: Record<string, string>;
  }): Promise<UserThemeSettingsRow> {
    return apiFetch("/theme-settings/me", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async deleteMyThemeSettings(): Promise<{ ok: boolean }> {
    return apiFetch("/theme-settings/me", {
      method: "DELETE"
    });
  }
};
