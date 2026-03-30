/**
 * Custom sort for FLOW folders in the File Explorer.
 * Uses monkey-patching pattern from obsidian-custom-sort.
 */

import { Plugin } from "obsidian";
import { FlowFolderMap } from "../types";
import { getFlowSortIndex } from "./flow-resolver";

// monkey-around is a tiny utility for safe monkey-patching
// We inline a minimal implementation to avoid the external dependency
type UninstallFn = () => void;

// Minimal monkey-patching utility (replaces monkey-around dependency)
function around(
	obj: Record<string, unknown>,
	factories: Record<string, (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown>
): UninstallFn {
	const originals: Record<string, unknown> = {};
	for (const key of Object.keys(factories)) {
		originals[key] = obj[key];
		const factory = factories[key]!;
		const original = obj[key] as (...args: unknown[]) => unknown;
		obj[key] = factory(original);
	}
	return () => {
		for (const key of Object.keys(originals)) {
			obj[key] = originals[key];
		}
	};
}

// Obsidian internal types for File Explorer (not in public API)
interface FileExplorerLeaf {
	view: Record<string, unknown> & { getSortedFolderItems?: (...args: unknown[]) => unknown[]; requestSort?: () => void; containerEl?: HTMLElement };
	isDeferred?: boolean;
}

// Internal Obsidian folder item type
interface FileItem {
	file?: { name: string; path: string };
}

/**
 * Install the custom sort patch on the File Explorer.
 * Returns an uninstaller function.
 */
export function installFlowSort(
	plugin: Plugin,
	folderMap: FlowFolderMap
): UninstallFn | undefined {
	const fileExplorerLeaf = getFileExplorerLeaf(plugin);
	if (!fileExplorerLeaf) {
		console.warn("[FLOW] File Explorer not found, cannot install custom sort.");
		return undefined;
	}

	if (fileExplorerLeaf.isDeferred) {
		console.debug("[FLOW] File Explorer is deferred, setting up watcher.");
		return setupDeferredWatcher(plugin, fileExplorerLeaf, folderMap);
	}

	return patchFileExplorer(fileExplorerLeaf, folderMap);
}

function getFileExplorerLeaf(plugin: Plugin): FileExplorerLeaf | undefined {
	return plugin.app.workspace.getLeavesOfType("file-explorer")?.[0] as
		| FileExplorerLeaf
		| undefined;
}

function patchFileExplorer(
	leaf: FileExplorerLeaf,
	folderMap: FlowFolderMap
): UninstallFn | undefined {
	if (
		!leaf.view ||
		typeof leaf.view.getSortedFolderItems !== "function" ||
		typeof leaf.view.requestSort !== "function"
	) {
		console.warn("[FLOW] File Explorer view does not have expected methods.");
		return undefined;
	}

	const proto = Object.getPrototypeOf(leaf.view) as Record<string, unknown>;

	const uninstall = around(proto, {
		getSortedFolderItems(old: (...args: unknown[]) => unknown[]) {
			return function (this: unknown, ...args: unknown[]): unknown[] {
				const folder = args[0] as { path: string; children: unknown[] } | undefined;
				const result = old.call(this, ...args);

				// Only reorder items at the vault root level
				if (folder && (folder.path === "/" || folder.path === "")) {
					return reorderFlowFolders(result, folderMap);
				}

				return result;
			};
		},
	});

	// Trigger a re-sort so our patch takes effect immediately
	leaf.view.requestSort();

	return uninstall;
}

/**
 * Reorder the File Explorer items so that FLOW folders appear
 * in their canonical order at the top, followed by everything else.
 */
function reorderFlowFolders(items: unknown[], folderMap: FlowFolderMap): unknown[] {
	const flowItems: [number, unknown][] = [];
	const otherItems: unknown[] = [];

	for (const item of items) {
		const fileItem = item as FileItem;
		const name = fileItem?.file?.name;
		if (name) {
			const idx = getFlowSortIndex(folderMap, name);
			if (idx >= 0) {
				flowItems.push([idx, item]);
				continue;
			}
		}
		otherItems.push(item);
	}

	// Sort FLOW items by their canonical index
	flowItems.sort((a, b) => a[0] - b[0]);

	// FLOW folders first, then everything else in their original order
	return [...flowItems.map(([, item]) => item), ...otherItems];
}

/**
 * If the File Explorer is in a deferred state, watch for it to become active.
 */
function setupDeferredWatcher(
	plugin: Plugin,
	leaf: FileExplorerLeaf,
	folderMap: FlowFolderMap
): UninstallFn {
	let patchUninstall: UninstallFn | undefined;

	const parentEl =
		(leaf.view as unknown as { containerEl?: HTMLElement })?.containerEl?.parentElement ??
		document.querySelector(".workspace");

	if (!parentEl) {
		console.warn("[FLOW] Cannot watch for deferred File Explorer.");
		return () => {};
	}

	const observer = new MutationObserver(() => {
		const readyLeaf = getFileExplorerLeaf(plugin);
		if (readyLeaf && !readyLeaf.isDeferred) {
			observer.disconnect();
			patchUninstall = patchFileExplorer(readyLeaf, folderMap);
		}
	});

	observer.observe(parentEl, { childList: true, subtree: true });

	return () => {
		observer.disconnect();
		patchUninstall?.();
	};
}
