export type ThemeTokenKey =
  | "background"
  | "foreground"
  | "primary"
  | "primaryForeground"
  | "secondary"
  | "secondaryForeground"
  | "border"
  | "card"
  | "cardForeground"
  | "popover"
  | "popoverForeground"
  | "sidebar"
  | "sidebarForeground"
  | "muted"
  | "mutedForeground"
  | "accent"
  | "accentForeground"
  | "destructiveForeground"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "button"
  | "input"
  | "ring"
  | "icon"
  | "iconMuted";

export type ThemePalette = Record<ThemeTokenKey, string>;

export const THEME_TOKEN_KEYS: ThemeTokenKey[] = [
  "background",
  "foreground",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "border",
  "card",
  "cardForeground",
  "popover",
  "popoverForeground",
  "sidebar",
  "sidebarForeground",
  "muted",
  "mutedForeground",
  "accent",
  "accentForeground",
  "destructiveForeground",
  "success",
  "warning",
  "error",
  "info",
  "button",
  "input",
  "ring",
  "icon",
  "iconMuted"
];

export const DEFAULT_LIGHT_THEME: ThemePalette = {
  background: "#ffffff",
  foreground: "#0a0a0b",
  primary: "#18181b",
  primaryForeground: "#fafafa",
  secondary: "#f4f4f5",
  secondaryForeground: "#18181b",
  border: "#e4e4e7",
  card: "#ffffff",
  cardForeground: "#0a0a0b",
  popover: "#ffffff",
  popoverForeground: "#0a0a0b",
  sidebar: "#ffffff",
  sidebarForeground: "#0a0a0b",
  muted: "#f4f4f5",
  mutedForeground: "#71717a",
  accent: "#f4f4f5",
  accentForeground: "#18181b",
  destructiveForeground: "#fafafa",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
  button: "#18181b",
  input: "#e4e4e7",
  ring: "#18181b",
  icon: "#0a0a0b",
  iconMuted: "#71717a"
};

export const DEFAULT_DARK_THEME: ThemePalette = {
  background: "#09090b",
  foreground: "#fafafa",
  primary: "#fafafa",
  primaryForeground: "#18181b",
  secondary: "#27272a",
  secondaryForeground: "#fafafa",
  border: "#27272a",
  card: "#09090b",
  cardForeground: "#fafafa",
  popover: "#09090b",
  popoverForeground: "#fafafa",
  sidebar: "#09090b",
  sidebarForeground: "#fafafa",
  muted: "#27272a",
  mutedForeground: "#a1a1aa",
  accent: "#27272a",
  accentForeground: "#fafafa",
  destructiveForeground: "#fafafa",
  success: "#34d399",
  warning: "#fbbf24",
  error: "#f87171",
  info: "#60a5fa",
  button: "#fafafa",
  input: "#27272a",
  ring: "#d4d4d8",
  icon: "#fafafa",
  iconMuted: "#a1a1aa"
};

export const normalizeHex = (value: string) => {
  const trimmed = String(value || "").trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const valid = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(withHash);
  if (!valid) return "#000000";
  if (withHash.length === 4) {
    const [_, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return withHash.toLowerCase();
};

export const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex).replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
};

export const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const hexToHslVar = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) h = ((gNorm - bNorm) / delta) % 6;
    else if (max === gNorm) h = (bNorm - rNorm) / delta + 2;
    else h = (rNorm - gNorm) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

export const hslVarToHex = (value: string) => {
  const cleaned = String(value || "").trim().replace(/\s*\/.*$/, "");
  const match = cleaned.match(/^(\d+(\.\d+)?)\s+(\d+(\.\d+)?)%\s+(\d+(\.\d+)?)%$/);
  if (!match) return "#000000";
  const h = Number(match[1]);
  const s = Number(match[3]) / 100;
  const l = Number(match[5]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};

export const getContrastText = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#111111" : "#ffffff";
};

export const toSoftHslVar = (hex: string, alpha: number) => {
  return `${hexToHslVar(hex)} / ${alpha}`;
};

export const mergeThemePalette = (base: ThemePalette, incoming?: Partial<Record<string, unknown>>): ThemePalette => {
  const next = { ...base };
  if (!incoming || typeof incoming !== "object") return next;
  THEME_TOKEN_KEYS.forEach((key) => {
    const raw = incoming[key];
    if (typeof raw === "string" && raw.trim()) {
      next[key] = normalizeHex(raw);
    }
  });
  return next;
};
