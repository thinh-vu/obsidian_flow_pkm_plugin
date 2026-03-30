/**
 * Core types for the Obsidian FLOW plugin.
 */

/** The 6 roles in the FLOW methodology */
export enum FlowRole {
	CAPTURE = "capture",
	TRACK = "track",
	FORGE = "forge",
	BLUEPRINT = "blueprint",
	EXHIBIT = "exhibit",
	VAULT = "vault",
}

/** Ordered list of FLOW roles — defines the canonical sort order */
export const FLOW_ROLE_ORDER: FlowRole[] = [
	FlowRole.CAPTURE,
	FlowRole.TRACK,
	FlowRole.FORGE,
	FlowRole.BLUEPRINT,
	FlowRole.EXHIBIT,
	FlowRole.VAULT,
];

/** Semantic description for each role */
export const FLOW_ROLE_DESCRIPTIONS: Record<FlowRole, string> = {
	[FlowRole.CAPTURE]: "Thu thập dữ liệu thô, ý tưởng nhanh",
	[FlowRole.TRACK]: "Daily note, reflection, task tracking theo thời gian",
	[FlowRole.FORGE]: "Ghi chú đang rèn dũa, sáng tạo, tinh chỉnh",
	[FlowRole.BLUEPRINT]: "Chủ đề xuyên suốt, kế hoạch sản xuất nội dung",
	[FlowRole.EXHIBIT]: "Nội dung hoàn thiện, sẵn sàng chia sẻ",
	[FlowRole.VAULT]: "Lưu trữ dài hạn, archive",
};

/** A mapping from role → actual folder name in the vault */
export type FlowFolderMap = Record<FlowRole, string>;

/** A named preset with folder names for all 6 roles */
export interface FlowPreset {
	id: string;
	label: string;
	folders: FlowFolderMap;
}

/** Configuration for a single reminder type */
export interface ReminderConfig {
	enabled: boolean;
	frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
	dayOfWeek?: number; // 0=Sun, 1=Mon, ... (Legacy)
	activeDays?: number[]; // [0, 1, 2, 3, 4, 5, 6]
	activeStartTime?: string; // "08:00"
	activeEndTime?: string; // "22:00"
	lastTriggered: number; // timestamp
}

/** All reminder types */
export interface RemindersSettings {
	consolidateCapture: ReminderConfig;
	dailyNote: ReminderConfig;
	weeklyReview: ReminderConfig;
	publishContent: ReminderConfig;
	forgeCleanup: ReminderConfig;
}

/** A node in the tag hierarchy */
export interface TagNode {
	name: string;          // e.g. "project", "topic/tech"
	description?: string;  // Short description
	children: TagNode[];   // Sub-tags
	color?: string;        // Display color on Dashboard
}

/** A Blueprint/Mission of the Vault */
export interface VaultMission {
	id: string;            // UUID
	name: string;          // e.g. "Python Mastery"
	description: string;
	relatedTags: string[]; // Associated tags
	status: "active" | "completed" | "paused";
}

/** A dimension for classifying information */
export interface TaxonomyDimension {
	id: string;            // e.g. "domain", "format"
	label: string;         // e.g. "Lĩnh vực", "Định dạng"
	values: string[];      // e.g. ["tech", "finance", "health"]
}

/** Progress lifecycle stage mapping */
export interface ProgressLifecycleConfig {
	/** Ordered list of stage names (default: raw, medium, done, archived) */
	stages: string[];
}

/** Naming convention preference */
export type NamingConvention = "any" | "space" | "snake_case" | "kebab-case" | "camelCase" | "PascalCase";

/** Health scoring configuration — all thresholds used by health-scorer */
export interface HealthScoringConfig {
	/** Max subfolder nesting depth recommended (default: 2) */
	maxSubfolderDepth: number;
	/** Max notes per folder before penalty (default: 9) */
	maxNotesPerFolder: number;
	/** Max notes at root before penalty (default: 9) */
	maxRootNotes: number;
	/** Capture staleness thresholds in days [good, warning, bad] (default: [3, 7, 14]) */
	staleThresholdDays: [number, number, number];
	/** Metadata coverage % thresholds [good, excellent] (default: [50, 80]) */
	metaCoverageThresholds: [number, number];
	/** Orphan attachment rate % thresholds [good, warning, bad] (default: [5, 15, 30]) */
	orphanRateThresholds: [number, number, number];
	/** Oversized file count thresholds [warning, bad] (default: [5, 10]) */
	oversizedFileThresholds: [number, number];
}

/** Plugin settings interface */
export interface FlowPluginSettings {
	/** Currently selected preset id, or "custom" for manual names */
	presetId: string;
	/** The actual folder name mapping (editable when presetId is "custom") */
	folderMap: FlowFolderMap;
	/** Whether to use numerical prefixes (e.g., "1. Capture" vs "Capture") */
	useNumberPrefix: boolean;
	/** Whether to enable custom sort for FLOW folders in File Explorer */
	enableCustomSort: boolean;
	/** Whether to auto-create FLOW folders on startup if missing */
	autoCreateFolders: boolean;
	/** Reminder settings */
	reminders: RemindersSettings;
	/** Whether Dashboard icon is shown on ribbon */
	showRibbonIcon: boolean;
	/** Reminder check interval in seconds */
	reminderCheckIntervalSec: number;
	/** Auto-generate TOC files */
	autoTOC: boolean;
	/** Include DataView queries in TOC */
	tocDataViewQueries: boolean;
	/** Maximum subfolders per folder — vault-wide guideline for health monitoring */
	maxSubfolders: number;
	/** Days before a Capture note is considered stale */
	captureStaleDays: number;
	/** Preferred naming convention for files */
	namingConvention: NamingConvention;
	/** Health scoring thresholds for Dashboard */
	healthScoring: HealthScoringConfig;
	/** Tag taxonomy hierarchy */
	tagTaxonomy: TagNode[];
	/** Vault-level missions / blueprints */
	vaultMissions: VaultMission[];
	/** Information classification dimensions */
	taxonomyDimensions: TaxonomyDimension[];
	/** Progress lifecycle configuration */
	progressLifecycle: ProgressLifecycleConfig;
	/** Selected feelings from the emotion wheel for property suggestions */
	selectedFeelings: string[];
	/** Cached dashboard statistics for zero-latency loading */
	lastCachedStats: Record<string, unknown> | null;
	/** Dashboard stats auto-refresh interval in minutes (0 = disabled) */
	dashboardRefreshIntervalMin: number;
	/** Plugin language */
	language: "vi" | "en";
	/** Urgency field configuration (Eisenhower Matrix) */
	urgencyConfig: { fieldName: string; levels: { value: number; label: string }[] };
	/** Impact field configuration (Eisenhower Matrix) */
	impactConfig: { fieldName: string; levels: { value: number; label: string }[] };
	/** Publish date property name (for filtering by publish timeline) */
	publishFieldName: string;
	/** Channel property name (for filtering by channel) */
	channelFieldName: string;
}

