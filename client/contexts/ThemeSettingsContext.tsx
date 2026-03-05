import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "./AuthContext";
import { themeSettingsService } from "../services/themeSettingsService";
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  ThemePalette,
  ThemeTokenKey,
  hexToHslVar,
  mergeThemePalette,
  toSoftHslVar
} from "../utils/themeUtils";

type ThemeMode = "light" | "dark";

type ThemeSettingsContextType = {
  lightTheme: ThemePalette;
  darkTheme: ThemePalette;
  loading: boolean;
  saving: boolean;
  updateToken: (mode: ThemeMode, key: ThemeTokenKey, value: string) => void;
  saveThemeSettings: () => Promise<void>;
  resetThemeSettings: () => Promise<void>;
};

const ThemeSettingsContext = createContext<ThemeSettingsContextType | undefined>(undefined);

const applyThemePaletteToDocument = (palette: ThemePalette, mode: ThemeMode) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const setVar = (name: string, hex: string) => {
    root.style.setProperty(name, hexToHslVar(hex));
  };
  const setRawVar = (name: string, rawHsl: string) => {
    root.style.setProperty(name, rawHsl);
  };

  setVar("--background", palette.background);
  setVar("--foreground", palette.foreground);
  setVar("--card", palette.card);
  setVar("--popover", palette.popover);
  setVar("--primary", palette.primary);
  setVar("--secondary", palette.secondary);
  setVar("--muted", palette.muted);
  setVar("--accent", palette.accent);
  setVar("--border", palette.border);
  setVar("--input", palette.input);
  setVar("--ring", palette.ring);
  setVar("--destructive", palette.error);
  setVar("--status-success", palette.success);
  setVar("--status-warning", palette.warning);
  setVar("--status-danger", palette.error);
  setVar("--status-info", palette.info);
  setRawVar("--status-success-soft", toSoftHslVar(palette.success, mode === "dark" ? 0.16 : 0.12));
  setRawVar("--status-warning-soft", toSoftHslVar(palette.warning, mode === "dark" ? 0.16 : 0.12));
  setRawVar("--status-danger-soft", toSoftHslVar(palette.error, mode === "dark" ? 0.16 : 0.12));
  setRawVar("--status-info-soft", toSoftHslVar(palette.info, mode === "dark" ? 0.16 : 0.12));
  setVar("--sidebar", palette.sidebar);
  setVar("--sidebar-foreground", palette.sidebarForeground);
  setVar("--button", palette.button);
  setVar("--icon", palette.icon);
  setVar("--icon-muted", palette.iconMuted);

  setVar("--card-foreground", palette.cardForeground);
  setVar("--popover-foreground", palette.popoverForeground);
  setVar("--muted-foreground", palette.mutedForeground);
  setVar("--accent-foreground", palette.accentForeground);
  setVar("--secondary-foreground", palette.secondaryForeground);
  setVar("--primary-foreground", palette.primaryForeground);
  setVar("--destructive-foreground", palette.destructiveForeground);
};

export const ThemeSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resolvedTheme } = useTheme();
  const { currentUser } = useAuth();
  const [lightTheme, setLightTheme] = useState<ThemePalette>(DEFAULT_LIGHT_THEME);
  const [darkTheme, setDarkTheme] = useState<ThemePalette>(DEFAULT_DARK_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeMode: ThemeMode = resolvedTheme === "dark" ? "dark" : "light";

  const fetchThemeSettings = useCallback(async () => {
    if (!currentUser?.id) {
      setLightTheme(DEFAULT_LIGHT_THEME);
      setDarkTheme(DEFAULT_DARK_THEME);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const row = await themeSettingsService.getMyThemeSettings();
      if (!row) {
        setLightTheme(DEFAULT_LIGHT_THEME);
        setDarkTheme(DEFAULT_DARK_THEME);
      } else {
        setLightTheme(mergeThemePalette(DEFAULT_LIGHT_THEME, row.light_theme));
        setDarkTheme(mergeThemePalette(DEFAULT_DARK_THEME, row.dark_theme));
      }
    } catch (err) {
      console.error("Failed to fetch theme settings:", err);
      setLightTheme(DEFAULT_LIGHT_THEME);
      setDarkTheme(DEFAULT_DARK_THEME);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchThemeSettings();
  }, [fetchThemeSettings]);

  useEffect(() => {
    const palette = activeMode === "dark" ? darkTheme : lightTheme;
    applyThemePaletteToDocument(palette, activeMode);
  }, [activeMode, lightTheme, darkTheme]);

  const updateToken = useCallback((mode: ThemeMode, key: ThemeTokenKey, value: string) => {
    if (mode === "light") {
      setLightTheme(prev => ({ ...prev, [key]: value }));
    } else {
      setDarkTheme(prev => ({ ...prev, [key]: value }));
    }
  }, []);

  const saveThemeSettings = useCallback(async () => {
    setSaving(true);
    try {
      await themeSettingsService.upsertMyThemeSettings({
        lightTheme,
        darkTheme
      });
    } finally {
      setSaving(false);
    }
  }, [lightTheme, darkTheme]);

  const resetThemeSettings = useCallback(async () => {
    setLightTheme(DEFAULT_LIGHT_THEME);
    setDarkTheme(DEFAULT_DARK_THEME);
    setSaving(true);
    try {
      if (currentUser?.id) {
        await themeSettingsService.deleteMyThemeSettings();
      }
    } finally {
      setSaving(false);
    }
  }, [currentUser?.id]);

  const value = useMemo(
    () => ({
      lightTheme,
      darkTheme,
      loading,
      saving,
      updateToken,
      saveThemeSettings,
      resetThemeSettings
    }),
    [lightTheme, darkTheme, loading, saving, updateToken, saveThemeSettings, resetThemeSettings]
  );

  return <ThemeSettingsContext.Provider value={value}>{children}</ThemeSettingsContext.Provider>;
};

export const useThemeSettings = () => {
  const context = useContext(ThemeSettingsContext);
  if (!context) throw new Error("useThemeSettings must be used within ThemeSettingsProvider");
  return context;
};
