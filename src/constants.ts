/**
 * Constants and preset definitions for the FLOW plugin.
 *
 * All presets use numbered prefix format ("1. Capture") matching the
 * official FLOW vault structure.
 */

import { FlowPluginSettings, FlowPreset, FlowRole, FLOW_ROLE_ORDER, FlowFolderMap } from "./types";

// ── Presets ──────────────────────────────────────────────────────────────

export const FLOW_PRESETS: FlowPreset[] = [
	{
		id: "default",
		label: "Default (FLOW)",
		folders: {
			[FlowRole.CAPTURE]: "1. Capture",
			[FlowRole.TRACK]: "2. Track",
			[FlowRole.FORGE]: "3. Forge",
			[FlowRole.BLUEPRINT]: "4. Blueprint",
			[FlowRole.EXHIBIT]: "5. Exhibit",
			[FlowRole.VAULT]: "6. Vault",
		},
	},
	{
		id: "gardener",
		label: "Gardener (Người làm vườn)",
		folders: {
			[FlowRole.CAPTURE]: "1. Seed",
			[FlowRole.TRACK]: "2. Growth Cycle",
			[FlowRole.FORGE]: "3. Greenhouse",
			[FlowRole.BLUEPRINT]: "4. Root System",
			[FlowRole.EXHIBIT]: "5. Knowledge Garden",
			[FlowRole.VAULT]: "6. Old Roots",
		},
	},
	{
		id: "explorer",
		label: "Explorer (Nhà thám hiểm)",
		folders: {
			[FlowRole.CAPTURE]: "1. Compass",
			[FlowRole.TRACK]: "2. Trail",
			[FlowRole.FORGE]: "3. Expedition",
			[FlowRole.BLUEPRINT]: "4. Basecamp",
			[FlowRole.EXHIBIT]: "5. Treasure Trove",
			[FlowRole.VAULT]: "6. Lost Archives",
		},
	},
	{
		id: "writer",
		label: "Writer (Nhà văn)",
		folders: {
			[FlowRole.CAPTURE]: "1. Scribble",
			[FlowRole.TRACK]: "2. Drafts",
			[FlowRole.FORGE]: "3. Workshop",
			[FlowRole.BLUEPRINT]: "4. Story Arc",
			[FlowRole.EXHIBIT]: "5. Library",
			[FlowRole.VAULT]: "6. Archive",
		},
	},
	{
		id: "alchemist",
		label: "Alchemist (Nhà giả kim)",
		folders: {
			[FlowRole.CAPTURE]: "1. Spark",
			[FlowRole.TRACK]: "2. Transmutation",
			[FlowRole.FORGE]: "3. Crucible",
			[FlowRole.BLUEPRINT]: "4. Formula",
			[FlowRole.EXHIBIT]: "5. Elixir",
			[FlowRole.VAULT]: "6. Vault of Secrets",
		},
	},
	{
		id: "navigator",
		label: "Navigator (Hoa tiêu)",
		folders: {
			[FlowRole.CAPTURE]: "1. Map",
			[FlowRole.TRACK]: "2. Voyage",
			[FlowRole.FORGE]: "3. Dock",
			[FlowRole.BLUEPRINT]: "4. Navigation Plan",
			[FlowRole.EXHIBIT]: "5. Captain's Log",
			[FlowRole.VAULT]: "6. Shipwreck",
		},
	},
	{
		id: "architect",
		label: "Architect (Kiến trúc sư)",
		folders: {
			[FlowRole.CAPTURE]: "1. Blueprint",
			[FlowRole.TRACK]: "2. Foundation",
			[FlowRole.FORGE]: "3. Construction Site",
			[FlowRole.BLUEPRINT]: "4. Master Plan",
			[FlowRole.EXHIBIT]: "5. Archive",
			[FlowRole.VAULT]: "6. Blueprints Vault",
		},
	},
	{
		id: "scholar",
		label: "Scholar (Học giả)",
		folders: {
			[FlowRole.CAPTURE]: "1. Query",
			[FlowRole.TRACK]: "2. Study",
			[FlowRole.FORGE]: "3. Lab",
			[FlowRole.BLUEPRINT]: "4. Thesis",
			[FlowRole.EXHIBIT]: "5. Codex",
			[FlowRole.VAULT]: "6. Manuscript Vault",
		},
	},
	{
		id: "strategist",
		label: "Strategist (Chiến lược gia)",
		folders: {
			[FlowRole.CAPTURE]: "1. Intelligence",
			[FlowRole.TRACK]: "2. Operations",
			[FlowRole.FORGE]: "3. Command Post",
			[FlowRole.BLUEPRINT]: "4. Strategy Board",
			[FlowRole.EXHIBIT]: "5. Archive",
			[FlowRole.VAULT]: "6. Classified",
		},
	},
	{
		id: "inventor",
		label: "Inventor (Nhà phát minh)",
		folders: {
			[FlowRole.CAPTURE]: "1. Idea",
			[FlowRole.TRACK]: "2. Experiment",
			[FlowRole.FORGE]: "3. Workshop",
			[FlowRole.BLUEPRINT]: "4. Invention Plan",
			[FlowRole.EXHIBIT]: "5. Patent Library",
			[FlowRole.VAULT]: "6. Prototype Vault",
		},
	},
	{
		id: "historian",
		label: "Historian (Sử gia)",
		folders: {
			[FlowRole.CAPTURE]: "1. Chronicle",
			[FlowRole.TRACK]: "2. Timeline",
			[FlowRole.FORGE]: "3. Archives",
			[FlowRole.BLUEPRINT]: "4. Historical Map",
			[FlowRole.EXHIBIT]: "5. Library of Records",
			[FlowRole.VAULT]: "6. Lost Relics",
		},
	},
];

// ── Default settings ────────────────────────────────────────────────────

const defaultPreset = FLOW_PRESETS[0]!;

export const DEFAULT_SETTINGS: FlowPluginSettings = {
	presetId: "default",
	folderMap: { ...defaultPreset.folders },
	useNumberPrefix: false,
	enableCustomSort: true,
	autoCreateFolders: false,
	showRibbonIcon: true,
	reminderCheckIntervalSec: 3600, // 1 hour
	autoTOC: false,
	tocDataViewQueries: true,
	maxSubfolders: 9,
	captureStaleDays: 7,
	namingConvention: "any",
	healthScoring: {
		maxSubfolderDepth: 2,
		maxNotesPerFolder: 9,
		maxRootNotes: 9,
		staleThresholdDays: [3, 7, 14],
		metaCoverageThresholds: [50, 80],
		orphanRateThresholds: [5, 15, 30],
		oversizedFileThresholds: [5, 10],
	},
	reminders: {
		consolidateCapture: { enabled: false, frequency: "weekly", lastTriggered: 0 },
		dailyNote: { enabled: false, frequency: "daily", lastTriggered: 0 },
		weeklyReview: { enabled: false, frequency: "weekly", dayOfWeek: 0, lastTriggered: 0 },
		publishContent: { enabled: false, frequency: "weekly", lastTriggered: 0 },
		forgeCleanup: { enabled: false, frequency: "monthly", lastTriggered: 0 },
	},
	tagTaxonomy: [],
	vaultMissions: [],
	taxonomyDimensions: [
		{ id: "domain", label: "Domain", values: [] },
		{ id: "format", label: "Format", values: ["article", "video", "podcast", "note"] },
		{ id: "lifecycle", label: "Lifecycle", values: ["idea", "draft", "review", "published", "archived"] },
	],

	progressLifecycle: {
		stages: ["raw", "medium", "done", "archived"],
	},
	selectedFeelings: [],
	lastCachedStats: null,
	dashboardRefreshIntervalMin: 30,
	language: "vi",
	urgencyConfig: {
		fieldName: "urgency",
		levels: [
			{ value: 0, label: "Không khẩn cấp" },
			{ value: 1, label: "Khẩn cấp" },
		],
	},
	impactConfig: {
		fieldName: "impact",
		levels: [
			{ value: 1, label: "Rất thấp" },
			{ value: 2, label: "Thấp" },
			{ value: 3, label: "Trung bình" },
			{ value: 4, label: "Cao" },
			{ value: 5, label: "Rất cao" },
		],
	},
	publishFieldName: "publish",
	channelFieldName: "channel",
};

/** Find a preset by id */
export function getPresetById(id: string): FlowPreset | undefined {
	return FLOW_PRESETS.find((p) => p.id === id);
}

/**
 * Applies or removes the numerical prefix from a folder map.
 */
export function applyPrefixFormat(
	folderMap: FlowFolderMap,
	usePrefix: boolean
): FlowFolderMap {
	const result = { ...folderMap };
	for (const role of FLOW_ROLE_ORDER) {
		const roleIndex = FLOW_ROLE_ORDER.indexOf(role) + 1;
		const name = folderMap[role];
		const baseName = name.replace(/^\d+\.\s*/, "");
		result[role] = usePrefix ? `${roleIndex}. ${baseName}` : baseName;
	}
	return result;
}

/**
 * Detect the current preset based on existing vault folders.
 * Scans root folders and matches against known presets.
 * Supports folders with OR without number prefixes.
 */
export function detectCurrentPreset(rootFolderNames: string[]): { presetId: string; folderMap: Record<FlowRole, string>; usePrefix: boolean } | undefined {
	// Normalize: strip leading "N. " prefix for matching
	const stripPrefix = (name: string): string => name.replace(/^\d+\.\s*/, "");

	for (const preset of FLOW_PRESETS) {
		const presetNames = Object.values(preset.folders);
		const presetBareNames = presetNames.map(stripPrefix);

		// Check if all 6 preset folder names exist in the vault (with or without numbers)
		let matched = true;
		const detectedMap: Partial<Record<FlowRole, string>> = {};
		let usePrefixFound = false;

		for (const role of Object.keys(preset.folders) as FlowRole[]) {
			const presetName = preset.folders[role];
			const bareName = stripPrefix(presetName);

			// Try exact match first, then try bare name match
			const found = rootFolderNames.find((f) => f === presetName || stripPrefix(f) === bareName);
			if (found) {
				if (/^\d+\.\s*/.test(found)) {
					usePrefixFound = true;
				}
				detectedMap[role] = found; // Use the actual folder name on disk
			} else {
				matched = false;
				break;
			}
		}

		if (matched) {
			return { presetId: preset.id, folderMap: detectedMap as Record<FlowRole, string>, usePrefix: usePrefixFound };
		}
	}

	return undefined;
}
