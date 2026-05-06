/**
 * Obsidian FLOW Plugin — Main entry point.
 *
 * Keeps lifecycle management minimal per AGENTS.md conventions.
 * All feature logic is delegated to separate modules.
 *
 * Performance: DashboardModal and ECharts are lazy-loaded via dynamic import()
 * to avoid bundling ~1MB of chart code into the startup path.
 */

import { Notice, Plugin, TFolder, TFile, setIcon, App } from "obsidian";
import type { EventRef } from "obsidian";
import { FlowPluginSettings } from "./types";
import { DEFAULT_SETTINGS, detectCurrentPreset } from "./constants";
import { FlowSettingTab } from "./settings";
import { installFlowSort } from "./core/folder-sorter";
import { TagTaxonomySuggest } from "./features/taxonomy/tag-suggest";
import { NotificationWorker } from "./features/reminders/worker";
import { TaskSidebarView } from "./features/dashboard/views/task-sidebar-view";
import { VIEW_TYPE_TASK_SIDEBAR } from "./constants";

export default class FlowPlugin extends Plugin {
	settings: FlowPluginSettings = DEFAULT_SETTINGS;

	private sortUninstall: (() => void) | undefined;
	private ribbonIconEl: HTMLElement | undefined;
	private tocEventRefs: EventRef[] = [];
	
	isUiRevealed: boolean = false;
	private uiToggleStatusBarItem: HTMLElement | undefined;

	async onload() {
		await this.loadSettings();

		// ── Ribbon icon (lazy-loads Dashboard on click) ─────
		if (this.settings.showRibbonIcon) {
			this.ribbonIconEl = this.addRibbonIcon(
				"waves",
				"Flow dashboard",
				async () => {
					const { DashboardModal } = await import("./features/dashboard/dashboard-modal");
					new DashboardModal(this.app, this.settings).open();
				}
			);
		}

		this.uiToggleStatusBarItem = this.addStatusBarItem();
		this.uiToggleStatusBarItem.addClass("flow-ui-toggle-status");
		this.uiToggleStatusBarItem.onClickEvent(() => {
			this.isUiRevealed = !this.isUiRevealed;
			this.applyUiState();
		});
		this.updateUiToggleStatusBar();
		
		// ── Commands ─────────────────────────────────────────
		this.addCommand({
			id: "flow-create-folders",
			name: "Create missing flow folders",
			callback: async () => {
				const { createMissingFlowFolders } = await import("./core/folder-manager");
				const created = await createMissingFlowFolders(
					this.app.vault,
					this.settings.folderMap
				);
				if (created.length === 0) {
					new Notice("Flow: all folders already exist.");
				}
			},
		});

		this.addCommand({
			id: "flow-open-dashboard",
			name: "Open flow dashboard",
			callback: async () => {
				const { DashboardModal } = await import("./features/dashboard/dashboard-modal");
				new DashboardModal(this.app, this.settings).open();
			},
		});

		this.addCommand({
			id: "flow-open-dashboard-tasks",
			name: "Open flow dashboard (tasks)",
			callback: async () => {
				const { DashboardModal } = await import("./features/dashboard/dashboard-modal");
				new DashboardModal(this.app, this.settings, "tasks").open();
			},
		});

		this.addCommand({
			id: "flow-open-dashboard-stats",
			name: "Open flow dashboard (statistics)",
			callback: async () => {
				const { DashboardModal } = await import("./features/dashboard/dashboard-modal");
				new DashboardModal(this.app, this.settings, "statistics").open();
			},
		});

		this.addCommand({
			id: "flow-open-dashboard-navigator",
			name: "Open flow dashboard (navigator)",
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
		this.addCommand({
			id: "flow-open-task-sidebar",
			name: "Open flow task sidebar",
			callback: async () => {
				await this.activateTaskSidebar();
			},
		});

		this.addCommand({
			id: "flow-toggle-ui",
			name: "Toggle zen mode",
			callback: () => {
				this.isUiRevealed = !this.isUiRevealed;
				this.applyUiState();
			},
		});

		// ── Register Views ────────────────────────────────────
		this.registerView(
			VIEW_TYPE_TASK_SIDEBAR,
			(leaf) => new TaskSidebarView(leaf, this.settings)
		);
		// ── Settings tab ─────────────────────────────────────
		this.addSettingTab(new FlowSettingTab(this.app, this));

		// ── Tag Taxonomy Suggest ──────────────────────────────
		this.registerEditorSuggest(new TagTaxonomySuggest(this));

		// ── Lifecycle: after layout ready ────────────────────
		this.app.workspace.onLayoutReady(async () => {
			this.applyUiState();
			
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
			void import("./features/dashboard/stats-collector").then(({ invalidateStatsCache }) => {
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

			// Execute Startup Action
			const action = this.settings.startupAction;
			if (action.startsWith("dashboard")) {
				const { DashboardModal } = await import("./features/dashboard/dashboard-modal");
				if (action === "dashboard") {
					new DashboardModal(this.app, this.settings).open();
				} else if (action === "dashboard-navigator") {
					new DashboardModal(this.app, this.settings, "navigator").open();
				} else if (action === "dashboard-tasks") {
					new DashboardModal(this.app, this.settings, "tasks").open();
				} else if (action === "dashboard-statistics") {
					new DashboardModal(this.app, this.settings, "statistics").open();
				}
			} else if (action === "graph") {
				// Internal obsidian command to open graph view
				(this.app as App & { commands?: { executeCommandById: (id: string) => void } }).commands?.executeCommandById("graph:open");
			} else if (action === "file" && this.settings.startupFilePath) {
				const file = this.app.vault.getAbstractFileByPath(this.settings.startupFilePath);
				if (file instanceof TFile) {
					await this.app.workspace.getLeaf(false).openFile(file);
				}
			}
		});
	}

	applyUiState() {
		const body = document.body;
		const level = this.settings.zenModeLevel;

		if (level === 0) {
			// Disable Zen mode entirely
			body.classList.remove("flow-zen-active", "flow-zen-level-1", "flow-zen-level-2", "flow-zen-fallback");
			if (this.uiToggleStatusBarItem) this.uiToggleStatusBarItem.hide();
			return;
		}

		if (this.uiToggleStatusBarItem) this.uiToggleStatusBarItem.show();

		const borderismClasses = [
			"Ribbon-autohide", 
			"tab-autohide", 
			"nav-header-autohide", 
			"tab-title-bar-autohide", 
			"vault-profile-autohide"
		];
		
		const activeTheme = (this.app as App & { customCss?: { theme?: string } }).customCss?.theme || "";
		const isBorderism = activeTheme === "Borderism";

		if (this.isUiRevealed) {
			// Show UI
			body.classList.remove("flow-zen-active", "flow-zen-level-1", "flow-zen-level-2", "flow-zen-fallback");

			if (isBorderism) {
				borderismClasses.forEach(cls => body.classList.remove(cls));
			}

			// Expand sidebars
			const { workspace } = this.app;
			if (workspace.leftSplit) workspace.leftSplit.expand();
			if (workspace.rightSplit) workspace.rightSplit.expand();
		} else {
			// Hide UI (Zen mode)
			body.classList.add("flow-zen-active", `flow-zen-level-${level}`);
			body.classList.remove(`flow-zen-level-${level === 1 ? 2 : 1}`);

			if (isBorderism) {
				borderismClasses.forEach(cls => body.classList.add(cls));
			} else {
				body.classList.add("flow-zen-fallback");
			}

			// If level 2, collapse sidebars
			if (level === 2) {
				const { workspace } = this.app;
				if (workspace.leftSplit) workspace.leftSplit.collapse();
				if (workspace.rightSplit) workspace.rightSplit.collapse();
			}
		}

		this.updateUiToggleStatusBar();
	}

	updateUiToggleStatusBar() {
		if (!this.uiToggleStatusBarItem) return;
		
		this.uiToggleStatusBarItem.empty();
		
		if (this.isUiRevealed) {
			setIcon(this.uiToggleStatusBarItem, "maximize");
			this.uiToggleStatusBarItem.createSpan({ text: " UI" });
			this.uiToggleStatusBarItem.setCssProps({ "color": "var(--text-muted)" })
			this.uiToggleStatusBarItem.setCssProps({ "font-weight": "normal" })
		} else {
			setIcon(this.uiToggleStatusBarItem, "minimize");
			this.uiToggleStatusBarItem.createSpan({ text: " Zen" });
			this.uiToggleStatusBarItem.setCssProps({ "color": "var(--text-accent)" })
			this.uiToggleStatusBarItem.setCssProps({ "font-weight": "bold" })
		}
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
			const view = leaf?.view as Record<string, unknown> | undefined;
			if (view && typeof view.requestSort === "function") {
				(view.requestSort as () => void)();
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
		const savedData = await this.loadData() as Partial<FlowPluginSettings> | null;

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
				"Flow: could not detect a matching preset from vault folders."
			);
		}
	}

	async activateTaskSidebar() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_TASK_SIDEBAR)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (!rightLeaf) return;
			leaf = rightLeaf;
			await leaf.setViewState({
				type: VIEW_TYPE_TASK_SIDEBAR,
				active: true,
			});
		}

		// @ts-ignore
		await workspace.revealLeaf(leaf);
	}
}
