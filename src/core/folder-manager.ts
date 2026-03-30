/**
 * Manages FLOW folder creation and renaming in the vault.
 *
 * Folder detection is prefix-aware: "1. Capture" and "Capture"
 * are treated as the same FLOW role folder.
 */

import { Notice, TFolder, Vault } from "obsidian";
import { FlowFolderMap, FlowRole, FLOW_ROLE_ORDER } from "../types";
import { FLOW_PRESETS } from "../constants";

/** Strip numeric prefix like "1. " from a folder name */
function stripPrefix(name: string): string {
	return name.replace(/^\d+\.\s*/, "");
}

/**
 * Find an existing folder in the vault that matches a FLOW role,
 * regardless of whether it has a numeric prefix or not.
 * Also supports case-insensitive matching as a final fallback.
 *
 * For example, if folderMap says "1. Capture", this will match
 * both "1. Capture" and "Capture" if either exists.
 * It will also match "capture", "CAPTURE", etc.
 */
export function findExistingFlowFolder(
	vault: Vault,
	expectedName: string
): TFolder | undefined {
	// 1. Try exact match first
	const exact = vault.getAbstractFileByPath(expectedName);
	if (exact && exact instanceof TFolder) return exact;

	// 2. Try bare name (without prefix)
	const bare = stripPrefix(expectedName);
	if (bare !== expectedName) {
		const bareFolder = vault.getAbstractFileByPath(bare);
		if (bareFolder && bareFolder instanceof TFolder) return bareFolder;
	}

	// 3. Try with common prefix patterns
	for (let i = 1; i <= 6; i++) {
		const prefixed = `${i}. ${bare}`;
		if (prefixed !== expectedName) {
			const prefixedFolder = vault.getAbstractFileByPath(prefixed);
			if (prefixedFolder && prefixedFolder instanceof TFolder) return prefixedFolder;
		}
	}

	// 4. Case-insensitive fallback: scan root folders
	const bareLower = bare.toLowerCase();
	const root = vault.getRoot();
	for (const child of root.children) {
		if (child instanceof TFolder) {
			const childBare = stripPrefix(child.name).toLowerCase();
			if (childBare === bareLower) return child;
		}
	}

	return undefined;
}

/**
 * Find a FLOW folder for a given role, trying the current folderMap first,
 * then falling back to ALL preset names for that role (case-insensitive).
 * This enables recognition of e.g. "Capture", "Seed", "Compass" all as FlowRole.CAPTURE.
 */
export function findFlowFolderByRole(
	vault: Vault,
	folderMap: FlowFolderMap,
	role: FlowRole
): TFolder | undefined {
	// 1. Try current folder map setting
	const primary = findExistingFlowFolder(vault, folderMap[role]);
	if (primary) return primary;

	// 2. Try all preset names for this role
	for (const preset of FLOW_PRESETS) {
		const presetName = preset.folders[role];
		const found = findExistingFlowFolder(vault, presetName);
		if (found) return found;
	}

	return undefined;
}

/**
 * Create any missing FLOW folders in the vault root.
 * Uses prefix-aware detection to avoid creating duplicates.
 * @returns Array of created folder names
 */
export async function createMissingFlowFolders(
	vault: Vault,
	folderMap: FlowFolderMap
): Promise<string[]> {
	const created: string[] = [];

	for (const role of FLOW_ROLE_ORDER) {
		const folderName = folderMap[role];
		const existing = findExistingFlowFolder(vault, folderName);

		if (!existing) {
			try {
				await vault.createFolder(folderName);
				created.push(folderName);
			} catch (e) {
				console.warn(`[FLOW] Failed to create folder "${folderName}":`, e);
			}
		}
	}

	if (created.length > 0) {
		new Notice(`FLOW: Created ${created.length} folder(s): ${created.join(", ")}`);
	}

	return created;
}

/**
 * Rename FLOW folders from an old mapping to a new mapping.
 * Uses prefix-aware detection: if oldMap says "Capture" but vault has
 * "1. Capture", it will find and rename the correct folder.
 * @returns Array of [oldName, newName] pairs that were renamed
 */
export async function renameFlowFolders(
	vault: Vault,
	oldMap: FlowFolderMap,
	newMap: FlowFolderMap
): Promise<[string, string][]> {
	const renamed: [string, string][] = [];

	for (const role of FLOW_ROLE_ORDER) {
		const oldName = oldMap[role];
		const newName = newMap[role];

		if (oldName === newName) continue;

		// Use prefix-aware detection to find the actual folder
		const existing = findExistingFlowFolder(vault, oldName);
		if (existing) {
			// Check if target name already exists
			const targetExists = findExistingFlowFolder(vault, newName);
			if (targetExists && targetExists.path !== existing.path) {
				new Notice(`FLOW: Cannot rename "${existing.path}" → "${newName}" — target already exists.`);
				continue;
			}

			try {
				await vault.rename(existing, newName);
				renamed.push([existing.path, newName]);
			} catch (e) {
				console.warn(`[FLOW] Failed to rename "${existing.path}" to "${newName}":`, e);
			}
		}
	}

	if (renamed.length > 0) {
		const summary = renamed.map(([o, n]) => `${o} → ${n}`).join(", ");
		new Notice(`FLOW: Renamed ${renamed.length} folder(s): ${summary}`);
	}

	return renamed;
}

/**
 * Sync Obsidian's internal config files after FLOW folders are renamed.
 * Updates paths in all JSON files inside .obsidian/ root and .obsidian/plugins/
 */
export async function syncObsidianConfigs(
	vault: Vault,
	oldMap: FlowFolderMap,
	newMap: FlowFolderMap
): Promise<void> {
	const pairsToSync: [string, string][] = [];
	for (const role of FLOW_ROLE_ORDER) {
		const oldPath = oldMap[role];
		const newPath = newMap[role];
		if (oldPath !== newPath) {
			pairsToSync.push([oldPath, newPath]);
		}
	}

	if (pairsToSync.length === 0) return;

	const adapter = vault.adapter;

	// Helper to collect JSON files recursively
	async function collectJsonFiles(dirPath: string): Promise<string[]> {
		const files: string[] = [];
		try {
			if (!(await adapter.exists(dirPath))) return files;
			const listed = await adapter.list(dirPath);
			for (const file of listed.files) {
				if (file.endsWith(".json")) {
					files.push(file);
				}
			}
			for (const folder of listed.folders) {
				const subFiles = await collectJsonFiles(folder);
				files.push(...subFiles);
			}
		} catch (e) {
			console.warn(`[FLOW] Error collecting JSON files in ${dirPath}:`, e);
		}
		return files;
	}

	// Collect JSON files from .obsidian/ root and recursively from .obsidian/plugins/
	const configFiles: string[] = [];
	try {
		if (await adapter.exists(vault.configDir)) {
			const obsidianListed = await adapter.list(vault.configDir);
			for (const file of obsidianListed.files) {
				if (file.endsWith(".json")) {
					configFiles.push(file);
				}
			}
		}

		const pluginsFiles = await collectJsonFiles(`${vault.configDir}/plugins`);
		configFiles.push(...pluginsFiles);
	} catch (e) {
		console.warn("[FLOW] Failed to read config directory", e);
	}

	let updatedCount = 0;

	for (const configPath of configFiles) {
		try {
			let content = await adapter.read(configPath);
			let modified = false;

			for (const [oldPath, newPath] of pairsToSync) {
				// Strip numeric prefixes for matching
				const oldBare = oldPath.replace(/^\d+\.\s*/, "");
				const newBare = newPath.replace(/^\d+\.\s*/, "");

				// Try to replace exact quotes string e.g., "Capture" -> "1. Capture"
				// or path starts e.g., "Capture/ -> "1. Capture/
				// To be safe but exhaustive, we replace bare matches:
				const replacements: [string, string][] = [
					[oldPath, newPath],
				];
				if (oldBare !== oldPath) {
					replacements.push([oldBare, newBare]);
				}

				for (const [oldStr, newStr] of replacements) {
					// Look for occurrences that resemble part of a path or exact string
					// A regex ensuring it is surrounded by non-alphanumeric chars might be safer,
					// but split/join maintains the original intended broad replacement
					if (content.includes(oldStr)) {
						// Only replace if it looks like a whole word or path component
						// Escape string for regex
						const escapedOld = oldStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
						// Match quotes, slashes, or word boundaries
						const regex = new RegExp(`(?<=[\\s"/\\\\])${escapedOld}(?=[\\s"/\\\\.,;}]|$)`, "g");
						
						if (regex.test(content)) {
							content = content.replace(regex, newStr);
							modified = true;
						} else if (content.includes(`"${oldStr}"`) || content.includes(`${oldStr}/`)) {
							// fallback for basic split/join if regex didn't catch weird cases
							content = content.split(`"${oldStr}"`).join(`"${newStr}"`);
							content = content.split(`${oldStr}/`).join(`${newStr}/`);
							modified = true;
						}
					}
				}
			}

			if (modified) {
				await adapter.write(configPath, content);
				updatedCount++;
			}
		} catch (e) {
			// Config file doesn't exist or is unreadable — skip silently
			console.warn(`[FLOW] Could not update config file "${configPath}":`, e);
		}
	}

	if (updatedCount > 0) {
		new Notice(`FLOW: Updated ${updatedCount} Obsidian config file(s) with new folder paths. Please reload Obsidian to apply.`);
	}
}
