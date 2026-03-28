/**
 * Obsidian FLOW Plugin — Main entry point.
 *
 * Keeps lifecycle management minimal per AGENTS.md conventions.
 * All feature logic is delegated to separate modules.
 *
 * Performance: DashboardModal and ECharts are lazy-loaded via dynamic import()
 * to avoid bundling ~1MB of chart code into the startup path.
 */

import { Notice, Plugin, TFolder } from "obsidian";
import { FlowPluginSettings } from "./types";
import { DEFAULT_SETTINGS, detectCurrentPreset } from "./constants";
import { FlowSettingTab } from "./settings";
import { installFlowSort } from "./core/folder-sorter";
import { TagTaxonomySuggest } from "./features/taxonomy/tag-suggest";
import { NotificationWorker } from "./features/reminders/worker";

export default class FlowPlugin extends Plugin {
	settings: FlowPluginSettings = DEFAULT_SETTINGS;

	private sortUninstall: (() => void) | undefined;
	private ribbonIconEl: HTMLElement | undefined;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private tocEventRefs: any[] = [];

	async onload() {
		await this.loadSettings();

		// ── Ribbon icon (lazy-loads Dashboard on click) ─────
		if (this.settings.showRibbonIcon) {
			this.ribbonIconEl = this.addRibbonIcon(
				"waves",
				"FLOW Dashboard",
				async () => {
					const { DashboardModal } = await import("./features/dashboard/dashboard-modal");
					new DashboardModal(this.app, this.settings).open();
				}
			);
		}

		// ── Commands ─────────────────────────────────────────
		this.addCommand({
			id: "flow-create-folders",
			name: "Create missing FLOW folders",
			callback: async () => {
				const { createMissingFlowFolders } = await import("./core/folder-manager");
				const created = await createMissingFlowFolders(
					this.app.vault,
					this.settings.folderMap
				);
				if (created.length === 0) {
					new Notice("FLOW: All folders already exist.");
				}
			},
		});

		this.addCommand({
			id: "flow-open-dashboard",
			name: "Open FLOW Dashboard",
			callback: async () => {
				const { DashboardModal } = await import("./features/dashboard/dashboard-modal");
				new DashboardModal(this.app, this.settings).open();
			},
		});

		this.addCommand({
			id: "flow-open-dashboard-stats",
			name: "Open FLOW Dashboard (Statistics)",
			callback: async () => {
				const { DashboardModal } = await import("./features/dashboard/dashboard-modal");
				new DashboardModal(this.app, this.settings, "statistics").open();
			},
		});

		this.addCommand({
			id: "flow-open-dashboard-navigator",
			name: "Open FLOW Dashboard (Navigator)",
			callback: async () => {
				const { DashboardModal } = await import("./features/dashboard/dashboard-modal");
				new DashboardModal(this.app, this.settings, "navigator").open();
			},
		});

		this.addCommand({
			id: "flow-detect-preset",
			name: "Detect current preset from vault folders",
			callback: async () => {
				await this.autoDetectPresetIfNeeded(true);
			},
		});

		// ── Settings tab ─────────────────────────────────────
		this.addSettingTab(new FlowSettingTab(this.app, this));

		// ── Tag Taxonomy Suggest ──────────────────────────────
		this.registerEditorSuggest(new TagTaxonomySuggest(this));

		// ── Lifecycle: after layout ready ────────────────────
		this.app.workspace.onLayoutReady(async () => {
			// Auto-detect vault preset on first run (deferred to avoid blocking startup)
			await this.autoDetectPresetIfNeeded();

			// Auto-create folders (lazy-loaded)
			if (this.settings.autoCreateFolders) {
				const { createMissingFlowFolders } = await import("./core/folder-manager");
				await createMissingFlowFolders(
					this.app.vault,
					this.settings.folderMap
				);
			}

			// Install custom sort
			if (this.settings.enableCustomSort) {
				this.sortUninstall = installFlowSort(
					this,
					this.settings.folderMap
				);
			}

			// Invalidate stats cache on vault changes
			import("./features/dashboard/stats-collector").then(({ invalidateStatsCache }) => {
				this.registerEvent(this.app.vault.on("create", invalidateStatsCache));
				this.registerEvent(this.app.vault.on("delete", invalidateStatsCache));
				this.registerEvent(this.app.vault.on("rename", invalidateStatsCache));
				this.registerEvent(this.app.vault.on("modify", invalidateStatsCache));
			});

			// Start background notification worker
			const notificationWorker = new NotificationWorker(this);
			notificationWorker.start();

			// NOTE: TOC watcher (Phase 4) — not yet implemented.
			// Empty event handlers were removed to avoid startup overhead.
		});
	}

	onunload() {
		this.uninstallSort();
		this.disableTOCWatcher();
	}

	// ── Settings persistence ─────────────────────────────────

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<FlowPluginSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}


	// ── Sort management ──────────────────────────────────────

	reinstallSort() {
		this.uninstallSort();
		if (this.settings.enableCustomSort) {
			this.sortUninstall = installFlowSort(
				this,
				this.settings.folderMap
			);
		}
	}

	uninstallSort() {
		if (this.sortUninstall) {
			this.sortUninstall();
			this.sortUninstall = undefined;

			// Request default sort to clean up
			const leaf =
				this.app.workspace.getLeavesOfType("file-explorer")?.[0];
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const view = leaf?.view as any;
			if (view?.requestSort) {
				view.requestSort();
			}
		}
	}

	// ── TOC watcher (Phase 4 — not yet implemented) ─────────
	// Stubs kept for settings UI compatibility.
	// When Phase 4 is implemented, these should register debounced
	// vault event handlers for automatic TOC regeneration.

	enableTOCWatcher() {
		// TODO: Phase 4 — register debounced vault events for TOC regeneration
		// Empty handlers were removed to avoid startup overhead on mobile.
	}

	disableTOCWatcher() {
		for (const ref of this.tocEventRefs) {
			this.app.vault.offref(ref);
		}
		this.tocEventRefs = [];
	}

	// ── Auto-detect vault's FLOW preset ──────────────────────

	/**
	 * Scans root-level folders and detects which FLOW preset matches.
	 * On first run (no data saved), automatically applies the detected preset.
	 * @param force If true, always detect and apply (used by command)
	 */
	private async autoDetectPresetIfNeeded(force = false) {
		const savedData = await this.loadData();

		// Only auto-detect on first run (no saved settings) or when forced
		if (savedData && !force) return;

		const rootFolders = this.app.vault
			.getRoot()
			.children.filter((f): f is TFolder => f instanceof TFolder)
			.map((f) => f.name);

		const detected = detectCurrentPreset(rootFolders);

		if (detected) {
			this.settings.presetId = detected.presetId;
			this.settings.folderMap = detected.folderMap;
			this.settings.useNumberPrefix = detected.usePrefix;
			await this.saveSettings();
			new Notice(
				`FLOW: Detected "${detected.presetId}" preset from existing vault folders.`
			);
		} else if (force) {
			new Notice(
				"FLOW: Could not detect a matching preset from vault folders."
			);
		}
	}
}
