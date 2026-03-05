import React, { useMemo, useState } from "react";
import { CheckCircle2, Moon, Paintbrush, RefreshCcw, Sun } from "lucide-react";
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
  const activePalette = useMemo(
    () => (themeEditorMode === "light" ? lightTheme : darkTheme),
    [themeEditorMode, lightTheme, darkTheme]
  );

  const handleSave = async () => {
    try {
      await saveThemeSettings();
      setSaveMessage("Theme settings saved successfully.");
    } catch (err: any) {
      setSaveMessage(err?.message || "Failed to save theme settings.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-0 pb-10 space-y-6 overflow-x-hidden">
      <section className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-border bg-gradient-to-r from-muted/20 via-card to-muted/10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
                <Paintbrush className="w-7 h-7 text-primary" />
                Theme Studio
              </h2>
              <p className="text-sm text-muted-foreground">Build a complete UI palette for both light and dark mode.</p>
            </div>
            <div className="inline-flex rounded-xl border border-border bg-background/80 p-1.5 gap-1 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setThemeEditorMode("light")}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-black rounded-lg transition-all ${
                  isEditingLight
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Light Mode
              </button>
              <button
                type="button"
                onClick={() => setThemeEditorMode("dark")}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-black rounded-lg transition-all ${
                  !isEditingLight
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark Mode
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[320px,1fr] min-w-0">
        <aside className="lg:sticky lg:top-6 h-fit min-w-0">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-foreground">Live Preview</h3>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] bg-muted text-muted-foreground">
                {isEditingLight ? "Light" : "Dark"} Palette
              </span>
            </div>
            <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: activePalette.sidebar }}>
              <div className="p-3 border-b border-border/60 flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: activePalette.sidebarForeground }}>
                  Sidebar
                </span>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activePalette.icon }} />
              </div>
              <div className="p-3 space-y-2">
                <div className="h-2.5 rounded-full" style={{ backgroundColor: activePalette.accent }} />
                <div className="h-2.5 w-4/5 rounded-full" style={{ backgroundColor: activePalette.muted }} />
                <div className="h-2.5 w-3/5 rounded-full" style={{ backgroundColor: activePalette.muted }} />
              </div>
            </div>
            <div className="rounded-xl border border-border p-4 space-y-3" style={{ backgroundColor: activePalette.card }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold" style={{ color: activePalette.cardForeground }}>
                  Card Preview
                </p>
                <span className="px-2 py-1 rounded-md text-xs font-semibold" style={{ backgroundColor: activePalette.info, color: activePalette.primaryForeground }}>
                  Info
                </span>
              </div>
              <p className="text-xs" style={{ color: activePalette.mutedForeground }}>
                This preview updates instantly for the currently edited mode.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="h-8 rounded-md text-xs font-bold"
                  style={{ backgroundColor: activePalette.button, color: activePalette.primaryForeground }}
                >
                  Button
                </button>
                <div className="h-8 rounded-md border px-2 flex items-center text-xs" style={{ borderColor: activePalette.border, color: activePalette.foreground }}>
                  Input
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[activePalette.success, activePalette.warning, activePalette.error, activePalette.info].map((color, idx) => (
                  <span key={idx} className="h-2 rounded-full block" style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-4 min-w-0">
          {themeLoading ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading theme settings...
            </div>
          ) : (
            <>
              {themeTokenGroups.map((group) => (
                <div key={group.title} className="rounded-2xl border border-border bg-card/80 p-4 sm:p-5 space-y-4 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-[0.14em] text-foreground">{group.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{group.description}</p>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground font-bold uppercase tracking-[0.12em]">
                      {group.keys.length} tokens
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
                    {group.keys.map((key) => {
                      const value = activePalette[key];
                      return (
                        <label
                          key={key}
                          className="rounded-xl border border-border bg-gradient-to-br from-muted/30 to-card p-3 space-y-2 transition-colors hover:border-primary/50 min-w-0"
                        >
                          <span className="text-[11px] uppercase tracking-[0.16em] font-black text-muted-foreground">{themeTokenLabels[key]}</span>
                          <div className="grid grid-cols-[48px,1fr,88px] items-center gap-2">
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
                              className="h-9 px-2 rounded-md border border-border bg-background text-foreground text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20 min-w-0"
                            />
                            <span className="h-9 rounded-md border border-border" style={{ backgroundColor: value }} />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
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
              <RefreshCcw className="w-3.5 h-3.5 mr-2" />
              Reset Default
            </button>
            {saveMessage && (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <CheckCircle2 className="w-4 h-4 text-status-success" />
                {saveMessage}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
