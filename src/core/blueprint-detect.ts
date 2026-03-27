/**
 * Blueprint auto-detection utility.
 * Shared logic for discovering Blueprint files as missions.
 * Used by both Settings tab and Dashboard modal.
 */

import { TFile, TFolder, Vault } from "obsidian";
import { FlowFolderMap, FlowRole, VaultMission } from "../types";
import { findExistingFlowFolder } from "./folder-manager";
import { FLOW_PRESETS } from "../constants";

/**
 * Detect files in the Blueprint folder and return them as VaultMission objects.
 * Deduplicates against existing missions and tries multiple path lookups.
 *
 * @param vault The Obsidian vault
 * @param folderMap Current folder name mapping
 * @param existingMissions Already known missions (avoids duplicates)
 * @returns Combined list of existing + newly detected missions
 */
export function detectBlueprintMissions(
	vault: Vault,
	folderMap: FlowFolderMap,
	existingMissions: VaultMission[],
	language: "en" | "vi" = "en"
): VaultMission[] {
	const missions = [...existingMissions];
	const existingNames = new Set(missions.map((m) => m.name.toLowerCase()));

	// Try primary folder map first
	const blueprintFolderName = folderMap[FlowRole.BLUEPRINT];
	let blueprintFolder = findExistingFlowFolder(vault, blueprintFolderName);

	// Fallback: try all preset names for blueprint role
	if (!blueprintFolder) {
		for (const preset of FLOW_PRESETS) {
			blueprintFolder = findExistingFlowFolder(vault, preset.folders[FlowRole.BLUEPRINT]);
			if (blueprintFolder) break;
		}
	}

	if (!blueprintFolder) return missions;

	// Scan Blueprint folder for markdown files
	for (const child of blueprintFolder.children) {
		if (
			child instanceof TFile &&
			child.extension === "md" &&
			child.basename !== "0. TOC"
		) {
			if (!existingNames.has(child.basename.toLowerCase())) {
				missions.push({
					id: crypto.randomUUID
						? crypto.randomUUID()
						: Date.now().toString(36) + Math.random().toString(36).slice(2),
					name: child.basename,
					description: language === "vi" ? `Tự nhận diện trong vault` : `Auto-detected from vault`,
					relatedTags: [],
					status: "active",
				});
				existingNames.add(child.basename.toLowerCase());
			}
		}
	}

	return missions;
}
