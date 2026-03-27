/**
 * FLOW Brand Color System
 *
 * Core brand colors + 25-color chart palette harmonized around the brand.
 * All color references across the plugin should import from here.
 */

// ── Core Brand Colors ───────────────────────────────────────────────────

export const BRAND = {
	teal:       "#008080",  // Primary
	orange:     "#FF6F61",  // Accent / urgency
	deepBlue:   "#00334D",  // Calm / muted
	aqua:       "#66CCCC",  // Light highlight
	gray:       "#808080",  // Neutral
} as const;

// ── FLOW Stage Colors ───────────────────────────────────────────────────

export const STAGE_COLORS: Record<string, string> = {
	blueprint:  BRAND.teal,      // Core hub
	capture:    BRAND.orange,    // Action / intake
	track:      BRAND.aqua,      // Daily rhythm
	forge:      "#D4563D",       // Deep orange-red (forge heat)
	exhibit:    BRAND.deepBlue,  // Polished / published
	vault:      BRAND.gray,      // Cold storage
};

// ── Health Score Level Colors ────────────────────────────────────────────

export const HEALTH_COLORS = {
	advanced: "#22c55e",
	good:     "#f59e0b",
	basic:    "#ef4444",
} as const;

// ── 25-Color Chart Palette ──────────────────────────────────────────────
// Harmonized around brand: teal/aqua variations + orange/warm variations
// + deep blue/cool variations + neutrals

export const CHART_PALETTE = [
	"#008080",  // Teal (primary)
	"#FF6F61",  // Sunset Orange
	"#00334D",  // Deep Blue
	"#66CCCC",  // Soft Aqua
	"#D4563D",  // Forge Red-Orange
	"#009B9B",  // Brighter Teal
	"#FF8A75",  // Light Coral
	"#004D6D",  // Darker Cerulean
	"#88DDDD",  // Lighter Aqua
	"#B84030",  // Burnt Sienna
	"#006666",  // Dark Teal
	"#FFA58C",  // Peach
	"#1A5276",  // Steel Blue
	"#44BBAA",  // Mint Teal
	"#E85C48",  // Vermilion
	"#2E8B8B",  // Medium Teal
	"#FFB399",  // Apricot
	"#2C3E50",  // Midnight
	"#77DDBB",  // Sea Green
	"#CD503B",  // Terra Cotta
	"#5FA5A5",  // Muted Teal
	"#FF7F6E",  // Salmon
	"#1B4F72",  // Navy
	"#99E2D0",  // Foam Green
	"#A0A0A0",  // Silver Gray
] as const;

// ── Sunburst / Warm Palette (for sunburst, pie, treemap) ────────────────

export const WARM_CHART_PALETTE = [
	"#FF6F61", "#008080", "#66CCCC", "#D4563D", "#00334D",
	"#009B9B", "#FF8A75", "#004D6D", "#88DDDD", "#B84030",
	"#006666", "#FFA58C", "#1A5276", "#44BBAA", "#E85C48",
	"#2E8B8B", "#FFB399", "#2C3E50", "#77DDBB", "#CD503B",
] as const;

// ── Heatmap Color Ramp ──────────────────────────────────────────────────

export const HEATMAP_RAMP = [
	"#e8f4f4",  // lightest (no activity)
	"#99DDCC",  // light
	"#66CCCC",  // medium (Soft Aqua)
	"#009B9B",  // active
	"#008080",  // heavy (Teal)
] as const;

// ── Activity / Mood Chart ───────────────────────────────────────────────

export const ACTIVITY_COLOR   = BRAND.teal;
export const ACTIVITY_AREA    = "rgba(0, 128, 128, 0.1)";
export const ACTIVITY_AVGLINE = BRAND.aqua;

// ── Mission Status Colors ───────────────────────────────────────────────

export const MISSION_STATUS = {
	active:  "#008080",
	paused:  "#FF6F61",
	done:    "#808080",
} as const;

// ── Feeling Chart Colors ────────────────────────────────────────────────

export const FEELING_PALETTE = [
	"#FF6F61", "#008080", "#66CCCC", "#D4563D", "#00334D",
	"#009B9B", "#FF8A75", "#44BBAA", "#E85C48", "#88DDDD",
	"#B84030", "#FFA58C", "#2E8B8B", "#FF7F6E", "#1A5276",
] as const;
