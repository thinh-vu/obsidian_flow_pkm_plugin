/**
 * FLOW Vault Statistics Collector — v2 (Single-Pass Flat-Index).
 *
 * Design philosophy: Obsidian's metadataCache already indexes every file
 * in memory. We should NEVER do recursive folder walks or async I/O.
 * Instead, we grab the flat file list once and classify each file by
 * its path prefix — exactly how Dataview achieves sub-second queries.
 *
 * Performance target: < 100ms for 10,000+ file vaults.
 */

import { App, TFile, getAllTags } from "obsidian";
import { FlowFolderMap, FlowRole, FlowPluginSettings } from "../../types";

// ── Exported Interfaces ─────────────────────────────────────────────────

export interface RoleStats {
	noteCount: number;
	propertiesGrouped: Record<string, Record<string, number>>;
	tagsCount: Record<string, number>;
	// --- Health Scoring Metrics ---
	notesWithAnyMetadata: number;
	notesWithTags: number;
	notesWithProperties: number;
	notesWithWikilinks: number;
	maxFolderDepth: number;
	subfolderCount: number;
	notesInRoot: number;
	notesPerSubfolder: Record<string, number>;
	// --- Role Specifics ---
	captureHasWikilink: number;
	captureRawNotes: number;
	trackTasksCompleted: number;
	trackTasksPending: number;
	trackHasFeeling: number;
	forgeWipCount: number;
	forgeHeatmap: Record<string, "hot"|"warm"|"cold"|"empty">;
	forgeProgressDistribution: Record<string, number>;
	topLinkedFiles?: Array<{name: string, linkCount: number}>;
}

export interface VaultStats {
	// ── Global Aggregates (Used by main Dashboard charts) ─────────────
	totalActiveNotes: number;
	notesPerFolder: Record<string, number>;
	propertiesGrouped: Record<string, Record<string, number>>;
	tagsCount: Record<string, number>;
	activityTimestamps: number[];
	moodByDate: Record<string, number>;
	feelingCounts: Record<string, number>;
	feelingByDate: Record<string, string[]>;

	// ── Role-specific Telemetry (Used by Flow Progression) ─────────────
	roleStats: Record<string, RoleStats>;

	// ── Vault/Cold Storage Stats ─────────────
	vaultTotalFiles: number;
	vaultTotalSize: number;
	vaultLargestFolders: Array<{name: string, size: number}>;
	orphanedAttachmentsCount: number;
	orphanedAttachmentsSize: number;

	// ── Health Scoring Stats ─────────────
	oversizedFiles: Array<{path: string; size: number; ext: string}>;
	hasGitRepo: boolean;
	captureNoteAges: number[];

	// ── Overall Discipline ─────────────
	namingConventions: {
		zettelkasten: number;
		natural: number;
		kebab: number;
		snake: number;
		camel: number;
		pascal: number;
		other: number;
	};
}

// ── Cache ────────────────────────────────────────────────────────────────

let cachedStats: VaultStats | null = null;

export function invalidateStatsCache(): void {
	cachedStats = null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function extractWikilinkName(text: string): string {
	return text.replace(/\[\[(.*?)\]\]/g, (_match, inner) => {
		const parts = inner.split("|");
		if (parts.length > 1) return parts[1].trim();
		const path = parts[0].trim();
		const segments = path.split("/");
		let name = segments[segments.length - 1];
		if (name.toLowerCase().endsWith(".md")) {
			name = name.slice(0, -3);
		}
		return name;
	});
}

/**
 * Determine which FLOW role a file belongs to based on its path.
 * Returns undefined if the file is not inside any FLOW folder.
 */
function classifyFile(filePath: string, folderMap: FlowFolderMap): FlowRole | undefined {
	const lowerPath = filePath.toLowerCase() + "/"; // trailing slash for prefix matching
	for (const role of [FlowRole.CAPTURE, FlowRole.TRACK, FlowRole.FORGE, FlowRole.BLUEPRINT, FlowRole.EXHIBIT]) {
		const folderName = folderMap[role];
		if (!folderName) continue;
		const prefix = folderName.toLowerCase() + "/";
		if (lowerPath.startsWith(prefix) || filePath.startsWith(folderName + "/")) {
			return role;
		}
	}
	return undefined;
}

/**
 * Extract the first sub-folder name inside a Forge directory.
 * e.g. "Forge/ProjectA/file.md" → "ProjectA"
 */
function getForgeSubfolder(filePath: string, forgeFolderName: string): string | undefined {
	const rest = filePath.slice(forgeFolderName.length + 1); // strip "Forge/"
	const slashIdx = rest.indexOf("/");
	if (slashIdx > 0) {
		return rest.slice(0, slashIdx);
	}
	return undefined;
}

// ── Main Collector (SYNCHRONOUS — no async, no recursion) ───────────────

export function collectVaultStats(
	app: App,
	folderMap: FlowFolderMap,
	settings: FlowPluginSettings
): VaultStats {
	if (cachedStats) return cachedStats;

	const now = Date.now();
	const hotLimit = 3 * 24 * 60 * 60 * 1000;   // 3 days
	const warmLimit = 30 * 24 * 60 * 60 * 1000;  // 30 days

	const skipKeys = new Set(["position", "tags", "cssclasses", "aliases", "cssclass"]);

	const stats: VaultStats = {
		propertiesGrouped: {},
		tagsCount: {},
		activityTimestamps: [],
		moodByDate: {},
		feelingCounts: {},
		feelingByDate: {},
		totalActiveNotes: 0,
		notesPerFolder: {},
		roleStats: {},
		vaultTotalFiles: 0,
		vaultTotalSize: 0,
		vaultLargestFolders: [],
		orphanedAttachmentsCount: 0,
		orphanedAttachmentsSize: 0,
		oversizedFiles: [],
		hasGitRepo: false,
		captureNoteAges: [],
		namingConventions: {
			zettelkasten: 0,
			natural: 0,
			kebab: 0,
			snake: 0,
			camel: 0,
			pascal: 0,
			other: 0,
		},
	};

	// Initialize role stats
	const activeRoles = [FlowRole.CAPTURE, FlowRole.TRACK, FlowRole.FORGE, FlowRole.BLUEPRINT, FlowRole.EXHIBIT];
	for (const r of activeRoles) {
		stats.roleStats[r] = {
			noteCount: 0,
			propertiesGrouped: {},
			tagsCount: {},
			notesWithAnyMetadata: 0,
			notesWithTags: 0,
			notesWithProperties: 0,
			notesWithWikilinks: 0,
			maxFolderDepth: 0,
			subfolderCount: 0,
			notesInRoot: 0,
			notesPerSubfolder: {},
			captureHasWikilink: 0,
			captureRawNotes: 0,
			trackTasksCompleted: 0,
			trackTasksPending: 0,
			trackHasFeeling: 0,
			forgeWipCount: 0,
			forgeHeatmap: {},
			forgeProgressDistribution: {},
		};
	}

	// ── PASS 1: ALL files (md + attachments) — single flat loop ──────────

	const allFiles = app.vault.getFiles();
	const folderSizes: Record<string, number> = {};

	// Pre-build incoming link counts (also used for orphan detection)
	const incomingLinkCounts = new Map<string, number>();
	const resolvedLinks = app.metadataCache.resolvedLinks;
	for (const source in resolvedLinks) {
		const targets = resolvedLinks[source];
		if (targets) {
			for (const target in targets) {
				incomingLinkCounts.set(target, (incomingLinkCounts.get(target) || 0) + (targets[target] || 0));
			}
		}
	}

	// Track max mtime per Forge subfolder for heatmap
	const forgeSubfolderMaxMtime: Record<string, number> = {};

	const progressStages = settings.progressLifecycle?.stages || [];
	const wipStages = progressStages.length >= 3 ? new Set(progressStages.slice(1, -1)) : null;

	const blueprintLinks: Array<{name: string, linkCount: number}> = [];

	const vaultFolder = folderMap[FlowRole.VAULT];
	const settingsPath = vaultFolder ? `${vaultFolder}/settings/` : null;

	for (const file of allFiles) {
		// Skip files in the dynamic 'Vault/settings' folder to avoid noise in reports
		if (settingsPath && file.path.startsWith(settingsPath)) continue;

		stats.vaultTotalFiles++;
		stats.vaultTotalSize += file.stat.size;

		// Folder size tracking
		const topFolder = file.path.split("/")[0];
		if (topFolder && topFolder !== file.name) {
			folderSizes[topFolder] = (folderSizes[topFolder] || 0) + file.stat.size;
		}

		// Orphan attachment detection + oversized file tracking
		if (file.extension !== "md" && file.extension !== "canvas") {
			if (!incomingLinkCounts.has(file.path)) {
				stats.orphanedAttachmentsCount++;
				stats.orphanedAttachmentsSize += file.stat.size;
			}
			// Oversized file detection
			const ext = file.extension.toLowerCase();
			const imgExts = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"]);
			const docExts = new Set(["pdf"]);
			if (imgExts.has(ext) && file.stat.size > 2 * 1024 * 1024) {
				stats.oversizedFiles.push({ path: file.path, size: file.stat.size, ext });
			} else if (docExts.has(ext) && file.stat.size > 5 * 1024 * 1024) {
				stats.oversizedFiles.push({ path: file.path, size: file.stat.size, ext });
			}
			continue;
		}

		// Skip non-.md files from here
		if (file.extension !== "md") continue;

		// Classify into FLOW role (delayed so we can extract global metrics first)
		
		// ── GLOBAL MOOD & FEELING TRACKING ──
		const preCache = app.metadataCache.getFileCache(file);
		if (preCache?.frontmatter) {
			const fmRaw = preCache.frontmatter;
			const moodKey = Object.keys(fmRaw).find(k => k.toLowerCase() === "mood");
			const rawMood = moodKey ? fmRaw[moodKey] : undefined;
			
			const feelingKey = Object.keys(fmRaw).find(k => k.toLowerCase() === "feeling" || k.toLowerCase() === "feelings");
			const rawFeeling = feelingKey ? fmRaw[feelingKey] : undefined;

			if (rawMood !== undefined && rawMood !== null) {
				const moodNum = Number(rawMood);
				if (!isNaN(moodNum)) {
					const dateMatch = file.basename.match(/\d{4}-\d{2}-\d{2}/);
					const dStr = dateMatch ? dateMatch[0] : (new Date(file.stat.ctime).toISOString().split("T")[0] as string);
					stats.moodByDate[dStr] = moodNum;
				}
			}
			if (rawFeeling !== undefined && rawFeeling !== null) {
				const feelings: string[] = Array.isArray(rawFeeling) ? rawFeeling : [String(rawFeeling)];
				const fdMatch = file.basename.match(/\d{4}-\d{2}-\d{2}/);
				const fDate = fdMatch ? fdMatch[0] : (new Date(file.stat.ctime).toISOString().split("T")[0] as string);
				for (const f of feelings) {
					const text = String(f).trim().toLowerCase();
					if (text) {
						stats.feelingCounts[text] = (stats.feelingCounts[text] || 0) + 1;
						if (!stats.feelingByDate[fDate]) stats.feelingByDate[fDate] = [];
						stats.feelingByDate[fDate].push(text);
					}
				}
			}
		}

		const role = classifyFile(file.path, folderMap);
		if (!role) continue; // Not a FLOW file

		// Skip TOC files
		if (file.name === "0. TOC.md") continue;

		const rs = stats.roleStats[role];
		if (!rs) continue;

		// Blueprint top links tracking
		if (role === FlowRole.BLUEPRINT) {
			const count = incomingLinkCounts.get(file.path) || 0;
			blueprintLinks.push({ name: file.basename, linkCount: count });
		}

		stats.totalActiveNotes++;
		stats.notesPerFolder[role] = (stats.notesPerFolder[role] || 0) + 1;
		rs.noteCount++;

		// Analyze naming convention
		const baseName = file.basename;
		if (/^\d{2,}(?:\.\d+)?[\s\-_]/.test(baseName) || /^\d{12,}/.test(baseName)) {
			stats.namingConventions.zettelkasten++; // Zettelkasten UID or Johnny.Decimal
		} else if (baseName.includes(" ")) {
			stats.namingConventions.natural++;
		} else if (baseName.includes("-") && baseName.toLowerCase() === baseName) {
			stats.namingConventions.kebab++;
		} else if (baseName.includes("_") && baseName.toLowerCase() === baseName) {
			stats.namingConventions.snake++;
		} else if (/^[a-z]+[A-Z][a-zA-Z]*$/.test(baseName)) {
			stats.namingConventions.camel++;
		} else if (/^[A-Z][a-zA-Z]*$/.test(baseName)) {
			stats.namingConventions.pascal++;
		} else {
			stats.namingConventions.other++;
		}

		// ── Folder depth + organization tracking ──
		const roleFolder = folderMap[role];
		const relPath = file.path.slice(roleFolder.length + 1); // strip "RoleFolder/"
		const segments = relPath.split("/");
		const depth = segments.length - 1; // 0 = root of role folder
		if (depth > rs.maxFolderDepth) rs.maxFolderDepth = depth;
		if (depth === 0) {
			rs.notesInRoot++;
		} else {
			const firstSub = segments[0] || "";
			rs.notesPerSubfolder[firstSub] = (rs.notesPerSubfolder[firstSub] || 0) + 1;
		}

		// ── Activity timestamps ──
		stats.activityTimestamps.push(file.stat.ctime);
		if (file.stat.ctime !== file.stat.mtime) {
			stats.activityTimestamps.push(file.stat.mtime);
		}

		// ── Forge Heatmap: track max mtime per subfolder ──
		if (role === FlowRole.FORGE) {
			const sub = getForgeSubfolder(file.path, folderMap[FlowRole.FORGE]);
			if (sub) {
				const prev = forgeSubfolderMaxMtime[sub] || 0;
				if (file.stat.mtime > prev) {
					forgeSubfolderMaxMtime[sub] = file.stat.mtime;
				}
			}
		}

		// ── Metadata from cache (instant — already in memory) ──
		const cache = app.metadataCache.getFileCache(file);
		let isRaw = true;

		if (cache) {
			// ── Track per-note metadata presence ──
			const hasWikilinks = !!(cache.links && cache.links.length > 0);
			const tags = getAllTags(cache) || [];
			const hasTags = tags.length > 0;
			let hasProperties = false;

			// Capture wikilinks (any role)
			if (hasWikilinks) {
				rs.notesWithWikilinks++;
				if (role === FlowRole.CAPTURE) rs.captureHasWikilink++;
			}
			if (hasTags) rs.notesWithTags++;

			// Track tasks
			if (role === FlowRole.TRACK && cache.listItems) {
				for (const li of cache.listItems) {
					if (li.task !== undefined && li.task !== null) {
						if (li.task === " " || li.task === "") rs.trackTasksPending++;
						else rs.trackTasksCompleted++;
					}
				}
			}

			if (cache.frontmatter) {
				const fm = cache.frontmatter;

				// Raw detection
				const meaningfulKeys = Object.keys(fm).filter(k => k !== "position" && k !== "cssclasses");
				if (meaningfulKeys.length > 0) {
					isRaw = false;
					hasProperties = true;
					rs.notesWithProperties++;
				}

				// Forge WIP + progress distribution
				if (role === FlowRole.FORGE && fm.progress) {
					const pVal = String(fm.progress).toLowerCase();
					rs.forgeProgressDistribution[pVal] = (rs.forgeProgressDistribution[pVal] || 0) + 1;
					if (wipStages) {
						if (wipStages.has(fm.progress)) rs.forgeWipCount++;
					} else {
						if (!["raw", "done", "archived", "completed"].includes(pVal)) {
							rs.forgeWipCount++;
						}
					}
				}

				// Tags
				const tags = getAllTags(cache) || [];
				for (const tag of tags) {
					const cleanTag = tag.replace(/^#/, "");
					stats.tagsCount[cleanTag] = (stats.tagsCount[cleanTag] || 0) + 1;
					rs.tagsCount[cleanTag] = (rs.tagsCount[cleanTag] || 0) + 1;
				}

				// Properties
				for (const [key, value] of Object.entries(fm)) {
					if (skipKeys.has(key)) continue;
					if (value === null || value === undefined) continue;

					const values = Array.isArray(value) ? value : [value];
					for (const val of values) {
						if (typeof val === "object" && val !== null) continue;
						const valStr = extractWikilinkName(String(val).trim());
						if (valStr === "") continue;

						if (!stats.propertiesGrouped[key]) stats.propertiesGrouped[key] = {};
						stats.propertiesGrouped[key][valStr] = (stats.propertiesGrouped[key][valStr] || 0) + 1;

						if (!rs.propertiesGrouped[key]) rs.propertiesGrouped[key] = {};
						rs.propertiesGrouped[key][valStr] = (rs.propertiesGrouped[key][valStr] || 0) + 1;
					}
				}

				// Track Vault Health (Journaling score)
				const feelingKey = Object.keys(fm).find(k => k.toLowerCase() === "feeling" || k.toLowerCase() === "feelings");
				if (feelingKey && fm[feelingKey] !== undefined && fm[feelingKey] !== null) {
					if (role === FlowRole.TRACK) rs.trackHasFeeling++;
				}
			}

			// ── Aggregate per-note metadata presence ──
			if (hasWikilinks || hasTags || hasProperties) {
				rs.notesWithAnyMetadata++;
			}

			// Capture raw check
			if (role === FlowRole.CAPTURE && isRaw) {
				rs.captureRawNotes++;
			}

			// Capture note age tracking
			if (role === FlowRole.CAPTURE) {
				const ageDays = (now - file.stat.ctime) / (24 * 60 * 60 * 1000);
				stats.captureNoteAges.push(ageDays);
			}
		}
	}

	// ── POST-PROCESSING (all synchronous, trivial cost) ─────────────────

	// Build Top 5 Blueprint Linked
	const blueprintRs = stats.roleStats[FlowRole.BLUEPRINT];
	if (blueprintRs) {
		blueprintLinks.sort((a, b) => b.linkCount - a.linkCount);
		blueprintRs.topLinkedFiles = blueprintLinks.slice(0, 5);
	}

	// Build Forge heatmap from collected mtime data
	const forgeRs = stats.roleStats[FlowRole.FORGE];
	if (forgeRs) {
		for (const [subName, maxMtime] of Object.entries(forgeSubfolderMaxMtime)) {
			const diff = now - maxMtime;
			if (diff <= hotLimit) forgeRs.forgeHeatmap[subName] = "hot";
			else if (diff <= warmLimit) forgeRs.forgeHeatmap[subName] = "warm";
			else forgeRs.forgeHeatmap[subName] = "cold";
		}
	}

	// Compute subfolder counts for all roles
	for (const role of activeRoles) {
		const rs = stats.roleStats[role];
		if (rs) {
			rs.subfolderCount = Object.keys(rs.notesPerSubfolder).length;
		}
	}

	// Detect git repo
	const gitFolder = app.vault.getAbstractFileByPath(".git");
	stats.hasGitRepo = !!gitFolder;

	// Sort mood dates
	const sortedMood: Record<string, number> = {};
	Object.keys(stats.moodByDate).sort().forEach((date) => {
		const val = stats.moodByDate[date];
		if (val !== undefined) {
			sortedMood[date] = val;
		}
	});
	stats.moodByDate = sortedMood;

	// Largest folders
	const sortedFolders = Object.keys(folderSizes)
		.map(name => ({ name, size: folderSizes[name] || 0 }))
		.sort((a, b) => b.size - a.size);
	stats.vaultLargestFolders = sortedFolders.slice(0, 5);

	cachedStats = stats;
	return stats;
}
