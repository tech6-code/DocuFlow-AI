import React, { useState } from "react";
import { Moon, Paintbrush, Sun } from "lucide-react";
import { CheckIcon } from "./icons";
import { useThemeSettings } from "../contexts/ThemeSettingsContext";
import { ThemeTokenKey } from "../utils/themeUtils";

type ThemeTokenGroup = {
  title: string;
  description: string;
  keys: ThemeTokenKey[];
};

const themeTokenLabels: Record<ThemeTokenKey, string> = {
  background: "Background",
  foreground: "Foreground",
  primary: "Primary",
  primaryForeground: "Primary Text",
  secondary: "Secondary",
  secondaryForeground: "Secondary Text",
  border: "Border",
  card: "Card",
  cardForeground: "Card Text",
  popover: "Popover",
  popoverForeground: "Popover Text",
  sidebar: "Sidebar",
  sidebarForeground: "Sidebar Text",
  muted: "Muted",
  mutedForeground: "Muted Text",
  accent: "Accent",
  accentForeground: "Accent Text",
  destructiveForeground: "Error Text",
  success: "Success",
  warning: "Warning",
  error: "Error",
  info: "Info",
  button: "Button",
  input: "Input",
  ring: "Focus Ring",
  icon: "Icon",
  iconMuted: "Icon Muted"
};

const themeTokenGroups: ThemeTokenGroup[] = [
  {
    title: "Surfaces",
    description: "Main backgrounds and containers.",
    keys: ["background", "card", "popover", "secondary", "muted", "accent", "input", "border"]
  },
  {
    title: "Text",
    description: "Primary and contextual text colors.",
    keys: [
      "foreground",
      "cardForeground",
      "popoverForeground",
      "mutedForeground",
      "primaryForeground",
      "secondaryForeground",
      "accentForeground",
      "destructiveForeground"
    ]
  },
  {
    title: "Brand & Actions",
    description: "Primary accents and interactive highlights.",
    keys: ["primary", "button", "ring"]
  },
  {
    title: "Sidebar",
    description: "Sidebar panel and text readability.",
    keys: ["sidebar", "sidebarForeground"]
  },
  {
    title: "Icons",
    description: "Global icon tone and muted icon state.",
    keys: ["icon", "iconMuted"]
  },
  {
    title: "Status",
    description: "Success, warning, error and information states.",
    keys: ["success", "warning", "error", "info"]
  }
];

export const ThemeSettingsPage: React.FC = () => {
  const [themeEditorMode, setThemeEditorMode] = useState<"light" | "dark">("light");
  const [saveMessage, setSaveMessage] = useState("");
  const {
    lightTheme,
    darkTheme,
    loading: themeLoading,
    saving: themeSaving,
    updateToken,
    saveThemeSettings,
    resetThemeSettings
  } = useThemeSettings();

  const isEditingLight = themeEditorMode === "light";

  const handleSave = async () => {
    try {
      await saveThemeSettings();
      setSaveMessage("Theme settings saved successfully.");
    } catch (err: any) {
      setSaveMessage(err?.message || "Failed to save theme settings.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-0 pb-10 space-y-6">
      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-border">
          <div className="space-y-1">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
              <Paintbrush className="w-7 h-7 text-primary" />
              Theme Settings
            </h2>
            <p className="text-sm text-muted-foreground">Customize light and dark themes with instant preview.</p>
          </div>
        </div>

        <section className="p-5 sm:p-8 space-y-4">
          <div className="flex justify-end">
            <div className="inline-flex rounded-xl border border-border bg-background/70 p-1.5 gap-1">
              <button
                type="button"
                onClick={() => setThemeEditorMode("light")}
                className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-black rounded-lg transition-all ${
                  isEditingLight
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
              <button
                type="button"
                onClick={() => setThemeEditorMode("dark")}
                className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-black rounded-lg transition-all ${
                  !isEditingLight
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
            </div>
          </div>

          {themeLoading ? (
            <div className="text-sm text-muted-foreground">Loading theme settings...</div>
          ) : (
            <div className="space-y-4">
              {themeTokenGroups.map((group) => (
                <div key={group.title} className="rounded-2xl border border-border bg-card/70 p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-[0.14em] text-foreground">{group.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{group.description}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {group.keys.map((key) => {
                      const palette = themeEditorMode === "light" ? lightTheme : darkTheme;
                      const value = palette[key];
                      return (
                        <label key={key} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                          <span className="text-[11px] uppercase tracking-[0.16em] font-black text-muted-foreground">
                            {themeTokenLabels[key]}
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={value}
                              onChange={(e) => updateToken(themeEditorMode, key, e.target.value)}
                              className="h-9 w-12 rounded-md border border-border bg-background cursor-pointer"
                            />
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => {
                                const candidate = e.target.value.trim();
                                const validHex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(candidate);
                                if (validHex) {
                                  updateToken(themeEditorMode, key, candidate);
                                }
                              }}
                              placeholder="#000000"
                              className="flex-1 h-9 px-2 rounded-md border border-border bg-background text-foreground text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={themeSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-[0.14em] disabled:opacity-50"
            >
              <CheckIcon className="w-4 h-4" />
              {themeSaving ? "Saving..." : "Save Theme"}
            </button>
            <button
              type="button"
              onClick={resetThemeSettings}
              disabled={themeSaving}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-border bg-muted hover:bg-accent text-foreground text-xs font-black uppercase tracking-[0.14em] disabled:opacity-50"
            >
              Reset Default
            </button>
            {saveMessage && <span className="text-xs text-muted-foreground font-medium">{saveMessage}</span>}
          </div>
        </section>
      </div>
    </div>
  );
};
