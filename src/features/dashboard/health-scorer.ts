/**
 * FLOW Health Scorer — Computes a 0–100 health score per stage.
 *
 * Each stage has weighted criteria. Scores are clamped to [0, 100].
 * Three levels: 🔴 Basic (0–40), 🟡 Good (41–70), 🟢 Advanced (71–100).
 */

import { FlowPluginSettings, FlowRole, VaultMission } from "../../types";
import { VaultStats, RoleStats } from "./stats-collector";

// ── Types ───────────────────────────────────────────────────────────────

export interface CriterionResult {
	name: string;
	nameVi: string;
	score: number;
	maxScore: number;
	level: "basic" | "good" | "advanced";
}

export interface StageHealthResult {
	totalScore: number;
	level: "basic" | "good" | "advanced";
	criteria: CriterionResult[];
	evaluationText?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}

function toLevel(score: number, max: number): "basic" | "good" | "advanced" {
	const pct = max > 0 ? (score / max) * 100 : 0;
	if (pct >= 71) return "advanced";
	if (pct >= 41) return "good";
	return "basic";
}

function criterion(name: string, nameVi: string, score: number, maxScore: number): CriterionResult {
	return { name, nameVi, score: clamp(Math.round(score), 0, maxScore), maxScore, level: toLevel(score, maxScore) };
}

// ── Universal: Folder Organization ──────────────────────────────────────

function folderOrgScore(rs: RoleStats, maxPts: number, settings: FlowPluginSettings): CriterionResult {
	let score = maxPts;
	const totalNotes = rs.noteCount;
	const hs = settings.healthScoring;
	const allowedDepth = hs.maxSubfolderDepth;
	const maxNotes = hs.maxNotesPerFolder;
	const maxRoot = hs.maxRootNotes;
	if (totalNotes === 0) return criterion("Folder Organization", "Tổ chức thư mục", 0, maxPts);

	// Rule 1: Deep nesting penalty
	if (rs.maxFolderDepth > allowedDepth) {
		const excess = rs.maxFolderDepth - allowedDepth;
		score -= excess * 5;
	}

	// Rule 2: Flat structure with too many notes (no subfolders but > maxNotes)
	if (rs.subfolderCount === 0 && totalNotes > maxNotes) {
		score -= 8;
	}

	// Rule 3: Per-subfolder balance (max ± 2 ideal)
	const subfolders = Object.entries(rs.notesPerSubfolder);
	for (const [, count] of subfolders) {
		if (count > maxNotes) score -= 2;       // overfull subfolder
		if (count === 0) score -= 2;             // empty subfolder
		if (count > 0 && count < 2) score -= 1;  // too few (premature split)
	}

	// Rule 4: Root notes balance
	if (rs.notesInRoot > maxRoot) score -= 3;

	return criterion("Folder Organization", "Tổ chức thư mục", score, maxPts);
}

// ── BLUEPRINT ───────────────────────────────────────────────────────────

function scoreBlueprint(rs: RoleStats, stats: VaultStats, settings: FlowPluginSettings): StageHealthResult {
	const missions = settings.vaultMissions || [];
	const activeMissions = missions.filter(m => m.status === "active");

	// 1. Mission defined (25)
	const c1 = criterion("Missions Defined", "Nhiệm vụ được định nghĩa",
		missions.length >= 1 ? 25 : 0, 25);

	// 2. Properties on notes (20)
	const propRate = rs.noteCount > 0 ? rs.notesWithProperties / rs.noteCount : 0;
	const c2 = criterion("Properties Usage", "Sử dụng Properties",
		propRate * 20, 20);

	// 3. Wikilink/MOC creation (20)
	const linkRate = rs.noteCount > 0 ? rs.notesWithWikilinks / rs.noteCount : 0;
	const c3 = criterion("Wikilink / MOC", "Liên kết / MOC",
		linkRate * 20, 20);

	// 4. Tags (10)
	const missionsWithTags = missions.filter(m => m.relatedTags && m.relatedTags.length > 0).length;
	const c4 = criterion("Mission Tags", "Tag cho nhiệm vụ",
		Math.min(missionsWithTags * 5, 10), 10);

	// 5. Folder organization (25)
	const c5 = folderOrgScore(rs, 25, settings);

	const criteria = [c1, c2, c3, c4, c5];
	const totalScore = clamp(criteria.reduce((a, c) => a + c.score, 0), 0, 100);
	return { totalScore, level: toLevel(totalScore, 100), criteria };
}

// ── CAPTURE ─────────────────────────────────────────────────────────────

function scoreCapture(rs: RoleStats, stats: VaultStats, settings: FlowPluginSettings): StageHealthResult {
	const forgeRs = stats.roleStats[FlowRole.FORGE];
	const total = rs.noteCount;

	// 1. Flow balance (15)
	let flowPts = 0;
	if (total === 0 && (!forgeRs || forgeRs.noteCount === 0)) flowPts = 0;
	else if (total > 0 && forgeRs && forgeRs.noteCount > 0) flowPts = 15;
	else if (total > 0 && (!forgeRs || forgeRs.noteCount === 0)) flowPts = 5;
	else flowPts = 10;
	const c1 = criterion("Flow Balance", "Cân bằng luồng", flowPts, 15);

	// 2. Staleness (20) — average age of capture notes
	let stalePts = 20;
	const [sGood, sWarn, sBad] = settings.healthScoring.staleThresholdDays;
	if (stats.captureNoteAges.length > 0) {
		const avgAge = stats.captureNoteAges.reduce((a, b) => a + b, 0) / stats.captureNoteAges.length;
		if (avgAge > sBad) stalePts = 0;
		else if (avgAge > sWarn) stalePts = 5;
		else if (avgAge > sGood) stalePts = 12;
		else stalePts = 20;
	}
	const c2 = criterion("Freshness", "Độ tươi mới", stalePts, 20);

	// 3. Metadata coverage (25) — tiered at good%/excellent%
	const [metaGood, metaExc] = settings.healthScoring.metaCoverageThresholds;
	const metaRate = total > 0 ? rs.notesWithAnyMetadata / total : 0;
	let metaPts = 0;
	if (metaRate >= metaExc / 100) metaPts = 25;
	else if (metaRate >= metaGood / 100) metaPts = 15;
	else if (metaRate > 0) metaPts = 5;
	const c3 = criterion("Metadata Coverage", "Bao phủ Metadata", metaPts, 25);

	// 4. Wikilink enrichment (15)
	const linkRate = total > 0 ? rs.captureHasWikilink / total : 0;
	const c4 = criterion("Wikilinks", "Liên kết", linkRate * 15, 15);

	// 5. Folder organization (25)
	const c5 = folderOrgScore(rs, 25, settings);

	const criteria = [c1, c2, c3, c4, c5];
	const totalScore = clamp(criteria.reduce((a, c) => a + c.score, 0), 0, 100);
	return { totalScore, level: toLevel(totalScore, 100), criteria };
}

// ── TRACK ───────────────────────────────────────────────────────────────

function scoreTrack(rs: RoleStats, stats: VaultStats, settings: FlowPluginSettings): StageHealthResult {
	const done = rs.trackTasksCompleted;
	const pending = rs.trackTasksPending;
	const total = rs.noteCount;

	// 1. Task completion (25)
	const taskT = done + pending;
	let completionPts = 12; // neutral
	if (taskT > 0) completionPts = (done / taskT) * 25;
	const c1 = criterion("Task Completion", "Hoàn thành nhiệm vụ", completionPts, 25);

	// 2. Consistency (15)
	let consPts = 0;
	if (total >= 30) consPts = 15;
	else if (total >= 15) consPts = 12;
	else if (total >= 7) consPts = 8;
	else if (total >= 1) consPts = 4;
	const c2 = criterion("Consistency", "Tần suất", consPts, 15);

	// 3. Emotional tracking (15)
	const feelRate = total > 0 ? rs.trackHasFeeling / total : 0;
	const c3 = criterion("Emotion Tracking", "Theo dõi cảm xúc", feelRate * 15, 15);

	// 4. Progress bonus (10) — optional, notes with progress=done get bonus
	const progressDist = rs.forgeProgressDistribution || {};
	const doneCount = progressDist["done"] || 0;
	let progPts = 5; // neutral
	if (Object.keys(progressDist).length > 0 && doneCount > 0) progPts = 10;
	const c4 = criterion("Progress Tracking", "Theo dõi tiến trình", progPts, 10);

	// 5. Pending backlog (10)
	let backlogPts = 0;
	if (pending === 0) backlogPts = 10;
	else if (pending <= 3) backlogPts = 7;
	else if (pending <= 7) backlogPts = 3;
	const c5 = criterion("Backlog", "Tồn đọng", backlogPts, 10);

	// 6. Folder organization (25)
	const c6 = folderOrgScore(rs, 25, settings);

	const criteria = [c1, c2, c3, c4, c5, c6];
	const totalScore = clamp(criteria.reduce((a, c) => a + c.score, 0), 0, 100);
	return { totalScore, level: toLevel(totalScore, 100), criteria };
}

// ── FORGE ───────────────────────────────────────────────────────────────

function scoreForge(rs: RoleStats, stats: VaultStats, settings: FlowPluginSettings): StageHealthResult {
	const hm = rs.forgeHeatmap || {};
	const totalFolders = Object.keys(hm).length;
	const hotCount = Object.values(hm).filter(v => v === "hot").length;
	const warmCount = Object.values(hm).filter(v => v === "warm").length;
	const coldCount = Object.values(hm).filter(v => v === "cold").length;
	const activeCount = hotCount + warmCount;

	// 1. Active ratio (25)
	let activeRate = totalFolders > 0 ? activeCount / totalFolders : 0;
	let activePts = 5;
	if (activeRate > 0.6) activePts = 25;
	else if (activeRate > 0.4) activePts = 15;
	const c1 = criterion("Active Ratio", "Tỷ lệ hoạt động", activePts, 25);

	// 2. Progress distribution (20) — mediumRate
	const dist = rs.forgeProgressDistribution || {};
	const distTotal = Object.values(dist).reduce((a, b) => a + b, 0);
	const mediumCount = dist["medium"] || 0;
	const mediumRate = distTotal > 0 ? mediumCount / distTotal : 0;
	const c2 = criterion("Progress Distribution", "Phân bổ tiến trình", mediumRate * 20, 20);

	// 3. Metadata quality (15)
	const metaRate = rs.noteCount > 0 ? rs.notesWithAnyMetadata / rs.noteCount : 0;
	const c3 = criterion("Metadata Quality", "Chất lượng Metadata", metaRate * 15, 15);

	// 4. Cold stagnation (15) — ratio-based
	const coldRate = totalFolders > 0 ? coldCount / totalFolders : 0;
	let coldPts = 15;
	if (coldRate >= 0.4) coldPts = 5;
	else if (coldRate >= 0.2) coldPts = 10;
	const c4 = criterion("Cold Stagnation", "Dự án ngủ đông", coldPts, 15);

	// 5. Folder organization (25)
	const c5 = folderOrgScore(rs, 25, settings);

	const criteria = [c1, c2, c3, c4, c5];
	const totalScore = clamp(criteria.reduce((a, c) => a + c.score, 0), 0, 100);
	return { totalScore, level: toLevel(totalScore, 100), criteria };
}

// ── EXHIBIT ─────────────────────────────────────────────────────────────

function scoreExhibit(rs: RoleStats, stats: VaultStats, settings: FlowPluginSettings): StageHealthResult {
	const total = rs.noteCount;

	// 1. Tag diversity (20)
	const uniqueTags = Object.keys(rs.tagsCount).length;
	let tagPts = 0;
	if (uniqueTags >= 5) tagPts = 20;
	else if (uniqueTags >= 3) tagPts = 15;
	else if (uniqueTags >= 1) tagPts = 8;
	const c1 = criterion("Tag Diversity", "Đa dạng Tag", tagPts, 20);

	// 2. Properties usage (20)
	const propRate = total > 0 ? rs.notesWithProperties / total : 0;
	const c2 = criterion("Properties Usage", "Sử dụng Properties", propRate * 20, 20);

	// 3. Content volume (10)
	let volPts = 0;
	if (total >= 5) volPts = 10;
	else if (total >= 1) volPts = 6;
	const c3 = criterion("Content Volume", "Số lượng nội dung", volPts, 10);

	// 4. Subfolder/notes balance (25)
	const c4 = folderOrgScore(rs, 25, settings);

	// 5. Notes-per-subfolder (25)
	const maxNotes = settings.healthScoring.maxNotesPerFolder;
	let npsScore = 25;
	if (rs.subfolderCount === 0 && total > 0) npsScore = 5; // flat, no structure
	else if (rs.subfolderCount > 0) {
		// Check if subfolders are balanced
		const counts = Object.values(rs.notesPerSubfolder);
		const emptyFolders = counts.filter(c => c === 0).length;
		const overflowFolders = counts.filter(c => c > maxNotes).length;
		npsScore -= emptyFolders * 3;
		npsScore -= overflowFolders * 3;
	}
	const c5 = criterion("Structure Balance", "Cân bằng cấu trúc", npsScore, 25);

	const criteria = [c1, c2, c3, c4, c5];
	const totalScore = clamp(criteria.reduce((a, c) => a + c.score, 0), 0, 100);
	return { totalScore, level: toLevel(totalScore, 100), criteria };
}

// ── VAULT ───────────────────────────────────────────────────────────────

function scoreVault(rs: RoleStats | undefined, stats: VaultStats, settings: FlowPluginSettings): StageHealthResult {
	// Vault doesn't have a RoleStats entry (tracked globally), so use global stats.

	// 1. Naming Consistency (20)
	const naming = stats.namingConventions;
	const totalNamed = naming.zettelkasten + naming.natural + naming.kebab + naming.snake + naming.camel + naming.pascal + naming.other;
	const maxStyleCount = Math.max(naming.zettelkasten, naming.natural, naming.kebab, naming.snake, naming.camel, naming.pascal);
	const consistencyRate = totalNamed > 0 ? maxStyleCount / totalNamed : 0;
	
	let namingPts = 0;
	if (consistencyRate > 0.8) namingPts = 15;
	else if (consistencyRate > 0.5) namingPts = 10;
	else namingPts = 5;

	// Bonus for Zettelkasten / JD
	if (totalNamed > 0 && naming.zettelkasten > totalNamed * 0.1) namingPts += 5;

	const c1 = criterion("Naming Consistency", "Độ nhất quán tên tệp", namingPts, 20);

	// 2. Orphan cleanup (20)
	const [orphGood, orphWarn, orphBad] = settings.healthScoring.orphanRateThresholds;
	const orphanRate = stats.vaultTotalSize > 0
		? stats.orphanedAttachmentsSize / stats.vaultTotalSize
		: 0;
	let orphanPts = 0;
	if (orphanRate < orphGood / 100) orphanPts = 20;
	else if (orphanRate < orphWarn / 100) orphanPts = 12;
	else if (orphanRate < orphBad / 100) orphanPts = 6;
	const c2 = criterion("Orphan Cleanup", "Dọn dẹp tệp mồ côi", orphanPts, 20);

	// 3. File size hygiene (20)
	const [overWarn, overBad] = settings.healthScoring.oversizedFileThresholds;
	const oversized = stats.oversizedFiles.length;
	let filePts = 20;
	if (oversized > overBad) filePts = 5;
	else if (oversized > overWarn) filePts = 10;
	else if (oversized > 0) filePts = 15;
	const c3 = criterion("File Size Hygiene", "Dung lượng tệp", filePts, 20);

	// 4. Version Control (15)
	const c4 = criterion("Version Control", "Quản lý phiên bản",
		stats.hasGitRepo ? 15 : 0, 15);

	// 5. Folder organization (25)
	const c5 = rs
		? folderOrgScore(rs, 25, settings)
		: criterion("Folder Organization", "Tổ chức thư mục", 15, 25);

	const criteria = [c1, c2, c3, c4, c5];
	const totalScore = clamp(criteria.reduce((a, c) => a + c.score, 0), 0, 100);

	return { totalScore, level: toLevel(totalScore, 100), criteria };
}

// ── Public API ──────────────────────────────────────────────────────────

export function computeAllHealthScores(
	stats: VaultStats,
	settings: FlowPluginSettings
): Record<string, StageHealthResult> {
	const bpRs = stats.roleStats[FlowRole.BLUEPRINT];
	const capRs = stats.roleStats[FlowRole.CAPTURE];
	const trkRs = stats.roleStats[FlowRole.TRACK];
	const frgRs = stats.roleStats[FlowRole.FORGE];
	const exhRs = stats.roleStats[FlowRole.EXHIBIT];

	const emptyRs: RoleStats = {
		noteCount: 0, propertiesGrouped: {}, tagsCount: {},
		notesWithAnyMetadata: 0, notesWithTags: 0, notesWithProperties: 0,
		notesWithWikilinks: 0, maxFolderDepth: 0, subfolderCount: 0,
		notesInRoot: 0, notesPerSubfolder: {},
		captureHasWikilink: 0, captureRawNotes: 0,
		trackTasksCompleted: 0, trackTasksPending: 0, trackHasFeeling: 0,
		forgeWipCount: 0, forgeHeatmap: {}, forgeProgressDistribution: {},
	};

	return {
		[FlowRole.BLUEPRINT]: scoreBlueprint(bpRs || emptyRs, stats, settings),
		[FlowRole.CAPTURE]: scoreCapture(capRs || emptyRs, stats, settings),
		[FlowRole.TRACK]: scoreTrack(trkRs || emptyRs, stats, settings),
		[FlowRole.FORGE]: scoreForge(frgRs || emptyRs, stats, settings),
		[FlowRole.EXHIBIT]: scoreExhibit(exhRs || emptyRs, stats, settings),
		[FlowRole.VAULT]: scoreVault(undefined, stats, settings),
	};
}
