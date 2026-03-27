/**
 * Resolves FLOW role names to actual folder paths in the vault.
 * This is the single source of truth for path resolution.
 */

import { FlowFolderMap, FlowRole, FLOW_ROLE_ORDER } from "../types";

/**
 * Resolve the actual folder path for a given FLOW role.
 */
export function resolveFlowPath(folderMap: FlowFolderMap, role: FlowRole): string {
	return folderMap[role];
}

/**
 * Get all FLOW folder paths in canonical order.
 */
export function getAllFlowPaths(folderMap: FlowFolderMap): string[] {
	return FLOW_ROLE_ORDER.map((role) => folderMap[role]);
}

/**
 * Check if a given folder path corresponds to a FLOW folder.
 * Returns the role if found, undefined otherwise.
 */
export function getRoleForPath(folderMap: FlowFolderMap, folderName: string): FlowRole | undefined {
	for (const role of FLOW_ROLE_ORDER) {
		if (folderMap[role] === folderName) {
			return role;
		}
	}
	return undefined;
}

/**
 * Get the sort index for a folder name.
 * Returns the FLOW order index (0-5) or -1 if not a FLOW folder.
 */
export function getFlowSortIndex(folderMap: FlowFolderMap, folderName: string): number {
	for (let i = 0; i < FLOW_ROLE_ORDER.length; i++) {
		const role = FLOW_ROLE_ORDER[i]!;
		if (folderMap[role] === folderName) {
			return i;
		}
	}
	return -1;
}
