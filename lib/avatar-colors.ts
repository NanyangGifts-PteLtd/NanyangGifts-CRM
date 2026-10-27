export type AvatarColorOption = {
  label: string;
  value: string;
  family: AvatarColorFamily;
};

export type AvatarColorFamily =
  | "Reds & oranges"
  | "Yellows & earth"
  | "Greens"
  | "Teals & blues"
  | "Purples & pinks"
  | "Neutrals";

export const AVATAR_COLOR_FAMILIES: AvatarColorFamily[] = [
  "Reds & oranges",
  "Yellows & earth",
  "Greens",
  "Teals & blues",
  "Purples & pinks",
  "Neutrals",
];

// Solid, high-contrast colours so initials remain legible. This is deliberately
// a shared palette: selected colours are stored on the profile and are not a
// browser-specific preference.
export const AVATAR_COLOR_OPTIONS: AvatarColorOption[] = [
  { label: "Blush", value: "#fecdd3", family: "Reds & oranges" },
  { label: "Peach", value: "#fed7aa", family: "Reds & oranges" },
  { label: "Salmon", value: "#fda4af", family: "Reds & oranges" },
  { label: "Coral", value: "#e25555", family: "Reds & oranges" },
  { label: "Rose", value: "#e11d48", family: "Reds & oranges" },
  { label: "Ruby", value: "#be123c", family: "Reds & oranges" },
  { label: "Wine", value: "#9f1239", family: "Reds & oranges" },
  { label: "Red", value: "#dc2626", family: "Reds & oranges" },
  { label: "Crimson", value: "#b91c1c", family: "Reds & oranges" },
  { label: "Orange", value: "#ea580c", family: "Reds & oranges" },
  { label: "Tangerine", value: "#c2410c", family: "Reds & oranges" },
  { label: "Terracotta", value: "#b4533c", family: "Reds & oranges" },

  { label: "Sand", value: "#e7c98a", family: "Yellows & earth" },
  { label: "Amber", value: "#d97706", family: "Yellows & earth" },
  { label: "Caramel", value: "#b45309", family: "Yellows & earth" },
  { label: "Yellow", value: "#a16207", family: "Yellows & earth" },
  { label: "Mustard", value: "#8f7208", family: "Yellows & earth" },
  { label: "Bronze", value: "#8b5e34", family: "Yellows & earth" },
  { label: "Cocoa", value: "#795548", family: "Yellows & earth" },
  { label: "Mocha", value: "#6d4c41", family: "Yellows & earth" },

  { label: "Sage", value: "#a7c7a1", family: "Greens" },
  { label: "Lime", value: "#65a30d", family: "Greens" },
  { label: "Apple", value: "#4d7c0f", family: "Greens" },
  { label: "Green", value: "#16a34a", family: "Greens" },
  { label: "Leaf", value: "#15803d", family: "Greens" },
  { label: "Forest", value: "#166534", family: "Greens" },
  { label: "Emerald", value: "#059669", family: "Greens" },
  { label: "Jade", value: "#047857", family: "Greens" },
  { label: "Pine", value: "#0f6b50", family: "Greens" },

  { label: "Ice blue", value: "#bae6fd", family: "Teals & blues" },
  { label: "Aqua", value: "#a5f3fc", family: "Teals & blues" },
  { label: "Powder blue", value: "#bfdbfe", family: "Teals & blues" },
  { label: "Teal", value: "#0f766e", family: "Teals & blues" },
  { label: "Lagoon", value: "#147d82", family: "Teals & blues" },
  { label: "Cyan", value: "#0e7490", family: "Teals & blues" },
  { label: "Turquoise", value: "#087f8c", family: "Teals & blues" },
  { label: "Petrol", value: "#155e75", family: "Teals & blues" },
  { label: "Sky", value: "#0284c7", family: "Teals & blues" },
  { label: "Cerulean", value: "#0369a1", family: "Teals & blues" },
  { label: "Blue", value: "#2563eb", family: "Teals & blues" },
  { label: "Cobalt", value: "#1d4ed8", family: "Teals & blues" },
  { label: "Denim", value: "#1e40af", family: "Teals & blues" },
  { label: "Navy", value: "#1e3a8a", family: "Teals & blues" },

  { label: "Lavender", value: "#ddd6fe", family: "Purples & pinks" },
  { label: "Lilac", value: "#e9d5ff", family: "Purples & pinks" },
  { label: "Baby pink", value: "#fbcfe8", family: "Purples & pinks" },
  { label: "Periwinkle", value: "#6366f1", family: "Purples & pinks" },
  { label: "Indigo", value: "#4f46e5", family: "Purples & pinks" },
  { label: "Violet", value: "#7c3aed", family: "Purples & pinks" },
  { label: "Amethyst", value: "#6d28d9", family: "Purples & pinks" },
  { label: "Purple", value: "#9333ea", family: "Purples & pinks" },
  { label: "Plum", value: "#6b21a8", family: "Purples & pinks" },
  { label: "Grape", value: "#7e22ce", family: "Purples & pinks" },
  { label: "Fuchsia", value: "#c026d3", family: "Purples & pinks" },
  { label: "Orchid", value: "#a21caf", family: "Purples & pinks" },
  { label: "Pink", value: "#db2777", family: "Purples & pinks" },
  { label: "Raspberry", value: "#be185d", family: "Purples & pinks" },
  { label: "Mulberry", value: "#9d174d", family: "Purples & pinks" },

  { label: "Silver", value: "#cbd5e1", family: "Neutrals" },
  { label: "Mushroom", value: "#c4b5a5", family: "Neutrals" },
  { label: "Taupe", value: "#74655b", family: "Neutrals" },
  { label: "Stone", value: "#57534e", family: "Neutrals" },
  { label: "Slate", value: "#475569", family: "Neutrals" },
  { label: "Steel", value: "#52677d", family: "Neutrals" },
  { label: "Graphite", value: "#374151", family: "Neutrals" },
];

const LEGACY_GRADIENTS = [
  "linear-gradient(150deg, #7ae9f0, #ff95cd)",
  "linear-gradient(150deg, #f2ffb0, #ff7b7b)",
  "linear-gradient(150deg, #74a2ff, #caffd4)",
  "linear-gradient(150deg, #ccffcc, #51aaf3)",
  "linear-gradient(150deg, #f9a8d4, #818cf8)",
  "linear-gradient(150deg, #cba3ff, rgb(151, 177, 255))",
  "linear-gradient(150deg, #59bdff, #7b64cc)",
];

export function isAvatarColor(value: unknown): value is string {
  return (
    typeof value === "string" &&
    AVATAR_COLOR_OPTIONS.some((option) => option.value === value)
  );
}

export function avatarBackgroundForId(
  id: string,
  avatarColor?: string | null,
): string {
  if (isAvatarColor(avatarColor)) return avatarColor;

  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 6 + id.charCodeAt(index)) >>> 0;
  }
  return LEGACY_GRADIENTS[hash % LEGACY_GRADIENTS.length];
}

