/**
 * Dashboard Modal
 * Displays a full-screen or large modal with Vault statistics.
 * Acts as a controller, delegating rendering to separate View components.
 */

import { App, Modal, setIcon } from "obsidian";
// import type * as echarts from "echarts/core";
import { FlowPluginSettings, FlowRole } from "../../types";
import { VaultStats, collectVaultStats, invalidateStatsCache } from "./stats-collector";
import { renderFlowProgressionTab } from "./tabs/flow-progression";

// View Modules
import { NavigatorView } from "./views/navigator-view";
import { StatisticsView } from "./views/statistics-view";
import { TaxonomyView } from "./views/taxonomy-view";
import { TaskView } from "./views/task-view";

let echartsModule: typeof import("echarts/core") | null = null;
async function getECharts() {
	if (!echartsModule) {
		const mod = await import("../../utils/echarts-setup");
		echartsModule = mod.default;
	}
	return echartsModule;
}

type DashboardTab = "properties" | "tags" | "activity" | "mood" | "taxonomy";
export type DashboardView = "statistics" | "navigator" | "flow" | "tasks";

export class DashboardModal extends Modal {
	private settings: FlowPluginSettings;
	private activeView: DashboardView = "flow";
	private activeTab: DashboardTab = "activity";
	private stats: VaultStats | null = null;
	
	private controlsContainer: HTMLElement | null = null;
	private chartContainer: HTMLElement | null = null;
	private navigatorContainer: HTMLElement | null = null;
	private taskContainer: HTMLElement | null = null;
	private overviewContainer: HTMLElement | null = null;
	private viewToggleBar: HTMLElement | null = null;

	// View Controllers
	private navigatorViewInstance: NavigatorView | null = null;
	private statisticsViewInstance: StatisticsView | null = null;
	private taxonomyViewInstance: TaxonomyView | null = null;
	private taskViewInstance: TaskView | null = null;

	constructor(app: App, settings: FlowPluginSettings, initialView: DashboardView = "flow") {
		super(app);
		this.settings = settings;
		this.activeView = initialView;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.addClass("flow-dashboard-modal");

		// Set modal geometry
		this.modalEl.addClass("flow-dashboard-ui-1");

		contentEl.empty();

		// Header Row
		const headerContainer = contentEl.createDiv("flow-dashboard-header");
		headerContainer.setCssProps({ "display": "flex" })
		headerContainer.setCssProps({ "justify-content": "center" })
		headerContainer.setCssProps({ "align-items": "center" })
		headerContainer.setCssProps({ "position": "relative" })
		const titleRow = headerContainer.createDiv();
		titleRow.setCssProps({ "display": "flex", "align-items": "center", "justify-content": "center", "gap": "8px" })
		const wavesIcon = titleRow.createSpan();
		setIcon(wavesIcon, "waves");
		wavesIcon.setCssProps({ "display": "flex", "align-items": "center", "color": "var(--text-accent)" })
		titleRow.createEl("h2", { text: "Flow dashboard", cls: "flow-dashboard-title" });
		titleRow.querySelector("h2")!.setCssProps({ "margin": "0" });


		this.overviewContainer = contentEl.createDiv("flow-overview-container");
		this.overviewContainer.setCssProps({ "margin-top": "24px" })

		// Top-level view toggle: Statistics vs Navigator
		this.renderViewToggle(contentEl);

		// Chart sub-tabs (only visible in Statistics mode)
		this.renderTabs(contentEl);

		// Controls container
		this.controlsContainer = contentEl.createDiv("flow-dashboard-controls");
		this.controlsContainer.setCssProps({ "margin-bottom": "10px" })
		this.controlsContainer.setCssProps({ "display": "flex" })
		this.controlsContainer.setCssProps({ "justify-content": "center" })
		this.renderControls();

		// Chart container
		this.chartContainer = contentEl.createDiv("flow-chart-container");
		this.chartContainer.addClass("flow-dashboard-ui-2");
		this.chartContainer.setCssProps({ "display": "flex" })
		this.chartContainer.addClass("flow-dashboard-ui-3");

		// Navigator container
		this.navigatorContainer = contentEl.createDiv("flow-navigator-container");
		this.navigatorContainer.addClass("flow-dashboard-ui-4");
		this.navigatorContainer.setCssProps({ "display": "none" })

		// Task container
		this.taskContainer = contentEl.createDiv("flow-task-container");
		this.taskContainer.addClass("flow-dashboard-ui-task"); // Use a semantic class or similar structure
		this.taskContainer.setCssProps({ "display": "none" })
		this.taskContainer.setCssProps({ "height": "100%" }) // Needed for scrolling list

		// Preload ECharts module if needed
		const echartsLoaded = await getECharts();

		// Initialize View Controllers
		this.navigatorViewInstance = new NavigatorView(this.app, this.settings, this.navigatorContainer, () => this.close());
		this.statisticsViewInstance = new StatisticsView(this.app, this.settings, this.chartContainer, echartsLoaded);
		this.taxonomyViewInstance = new TaxonomyView(this.app, this.settings, this.chartContainer, echartsLoaded);
		this.taskViewInstance = new TaskView(this.app, this.settings, this.taskContainer, () => this.close());

		window.addEventListener("resize", this.handleResize);

		// Data collection
		invalidateStatsCache();
		this.stats = collectVaultStats(this.app, this.settings.folderMap, this.settings);

		// Persist cache
		this.settings.lastCachedStats = this.stats as unknown as Record<string, unknown>;
		const appWithPlugins = this.app as App & { plugins?: { plugins?: Record<string, { saveSettings?: () => void }> } };
		const plugin = appWithPlugins.plugins?.plugins?.["obsidian-flow"];
		if (plugin && typeof plugin.saveSettings === "function") plugin.saveSettings();

		// Render immediately
		if (this.overviewContainer) {
			this.renderOverviewRow(this.overviewContainer);
		}
		this.renderView();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		window.removeEventListener("resize", this.handleResize);
		
		if (this.statisticsViewInstance) this.statisticsViewInstance.destroy();
		if (this.taxonomyViewInstance) this.taxonomyViewInstance.destroy();
	}

	private handleResize = () => {
		if (this.activeView === "statistics") {
			if (this.activeTab === "taxonomy") {
				if (this.taxonomyViewInstance) this.taxonomyViewInstance.resize();
			} else {
				if (this.statisticsViewInstance) this.statisticsViewInstance.resize();
			}
		}
	};

	private renderOverviewRow(container: HTMLElement) {
		if (!this.stats) return;

		const row = container.createDiv("flow-dashboard-overview");

		const createStatBox = (iconName: string, label: string, value: string | number) => {
			const box = row.createDiv("flow-stat-box");
			const titleWrap = box.createDiv("flow-stat-label");
			titleWrap.setCssProps({ "display": "flex" })
			titleWrap.setCssProps({ "align-items": "center" })
			titleWrap.setCssProps({ "gap": "6px" })
			titleWrap.setCssProps({ "justify-content": "center" })
			
			const iconEl = titleWrap.createSpan();
			setIcon(iconEl, iconName);
			(iconEl.querySelector("svg") as SVGElement)?.setAttribute("width", "14");
			(iconEl.querySelector("svg") as SVGElement)?.setAttribute("height", "14");
			
			titleWrap.createSpan({ text: label });
			box.createDiv("flow-stat-value").setText(String(value));
		};

		createStatBox("file-text", this.settings.language === "vi" ? "TỔNG GHI CHÚ HOẠT ĐỘNG" : "TOTAL ACTIVE NOTES", this.stats.totalActiveNotes);

		createStatBox("inbox", "CAPTURE", this.stats.notesPerFolder[FlowRole.CAPTURE] || 0);
		createStatBox("calendar", "TRACK", this.stats.notesPerFolder[FlowRole.TRACK] || 0);
		createStatBox("hammer", "FORGE", this.stats.notesPerFolder[FlowRole.FORGE] || 0);
		createStatBox("library", "EXHIBIT", this.stats.notesPerFolder[FlowRole.EXHIBIT] || 0);
	}

	private renderViewToggle(container: HTMLElement) {
		if (!this.viewToggleBar) {
			this.viewToggleBar = container.createDiv("flow-view-toggle");
			this.viewToggleBar.setCssProps({ "display": "flex" })
			this.viewToggleBar.addClass("flow-dashboard-ui-5");
		}
		this.viewToggleBar.empty();

		const isVi = this.settings.language === "vi";
		const views: { id: DashboardView; label: string; icon: string }[] = [
			{ id: "flow", label: isVi ? "Tiến trình" : "Progress", icon: "activity" },
			{ id: "navigator", label: isVi ? "Bảng nội dung" : "Navigator", icon: "table" },
			{ id: "tasks", label: isVi ? "Nhiệm vụ" : "Tasks", icon: "check-square" },
			{ id: "statistics", label: isVi ? "Thống kê" : "Statistics", icon: "bar-chart-2" },
		];

		for (const v of views) {
			const isActive = this.activeView === v.id;
			const btn = this.viewToggleBar.createEl("button");
			btn.addClass("flow-view-btn");
			if (isActive) btn.addClass("active");

			const iconEl = btn.createSpan();
			setIcon(iconEl, v.icon);
			btn.createSpan({ text: v.label });

			btn.addEventListener("click", () => {
				if (this.activeView === v.id) return;
				this.activeView = v.id;
				this.renderViewToggle(container);
				this.renderView();
			});
		}
	}

	private renderTabs(container: HTMLElement) {
		const tabBar = container.createDiv("flow-tabs");
		tabBar.id = "flow-chart-tabs";

		const isVi = this.settings.language === "vi";
		let tabs: { id: DashboardTab; name: string; icon: string }[] = [
			{ id: "activity", name: isVi ? "Hoạt động" : "Activity", icon: "activity" },
			{ id: "mood", name: isVi ? "Tâm trạng" : "Mood Tracking", icon: "smile" },
			{ id: "properties", name: isVi ? "Thuộc tính" : "Properties", icon: "list-tree" },
			{ id: "tags", name: isVi ? "Thẻ" : "Tags", icon: "tags" },
			{ id: "taxonomy", name: isVi ? "Phân loại" : "Taxonomy", icon: "git-branch" },
		];

		// Default to always showing mood tab as requested
		// const hasMoodData = this.stats && (Object.keys(this.stats.moodByDate).length > 0 || Object.keys(this.stats.feelingCounts).length > 0);
		// if (!hasMoodData) {
		// 	tabs = tabs.filter(t => t.id !== "mood");
		// 	if (this.activeTab === "mood") this.activeTab = "activity";
		// }

		for (const tab of tabs) {
			const btn = tabBar.createDiv(`flow-tab ${this.activeTab === tab.id ? "active" : ""}`);
			setIcon(btn, tab.icon);
			btn.createSpan({ text: tab.name });

			btn.addEventListener("click", () => {
				if (this.activeTab === tab.id) return;
				tabBar.querySelectorAll(".flow-tab").forEach(t => t.removeClass("active"));
				btn.addClass("active");

				this.activeTab = tab.id;
				this.renderControls();
				this.renderView();
			});
		}
	}

	private renderControls() {
		if (!this.controlsContainer) return;
		this.controlsContainer.empty();
	}

	private renderView() {
		if (!this.chartContainer || !this.navigatorContainer || !this.taskContainer) return;
		const tabBar = this.contentEl.querySelector("#flow-chart-tabs") as HTMLElement;

		if (this.activeView === "navigator") {
			this.chartContainer.setCssProps({ "display": "none" })
			if (this.controlsContainer) this.controlsContainer.setCssProps({ "display": "none" })
			if (tabBar) tabBar.setCssProps({ "display": "none" })
			if (this.overviewContainer) this.overviewContainer.setCssProps({ "display": "" })
			this.taskContainer.setCssProps({ "display": "none" })
			this.navigatorContainer.setCssProps({ "display": "block" })
			
			if (this.stats && this.navigatorViewInstance) {
				this.navigatorViewInstance.render(this.stats);
			}
		} else if (this.activeView === "tasks") {
			this.chartContainer.setCssProps({ "display": "none" })
			this.navigatorContainer.setCssProps({ "display": "none" })
			if (this.controlsContainer) this.controlsContainer.setCssProps({ "display": "none" })
			if (tabBar) tabBar.setCssProps({ "display": "none" })
			if (this.overviewContainer) this.overviewContainer.setCssProps({ "display": "" })
			this.taskContainer.setCssProps({ "display": "block" })
			
			if (this.stats && this.taskViewInstance) {
				void this.taskViewInstance.render(this.stats);
			}
		} else if (this.activeView === "flow") {
			this.navigatorContainer.setCssProps({ "display": "none" })
			this.taskContainer.setCssProps({ "display": "none" })
			if (tabBar) tabBar.setCssProps({ "display": "none" })
			if (this.controlsContainer) this.controlsContainer.setCssProps({ "display": "none" })
			if (this.overviewContainer) this.overviewContainer.setCssProps({ "display": "none" })
			
			// Clean up previous charts if any
			if (this.statisticsViewInstance) this.statisticsViewInstance.destroy();
			if (this.taxonomyViewInstance) this.taxonomyViewInstance.destroy();
			
			this.chartContainer.setCssProps({ "display": "flex" })
			this.chartContainer.empty();
			
			if (this.stats) {
				renderFlowProgressionTab(this.chartContainer, this.stats, this.app, this.settings);
			}
		} else { // Statistics mode
			this.navigatorContainer.setCssProps({ "display": "none" })
			this.taskContainer.setCssProps({ "display": "none" })
			if (tabBar) tabBar.setCssProps({ "display": "flex" })
			if (this.controlsContainer) this.controlsContainer.setCssProps({ "display": "flex" })
			if (this.overviewContainer) this.overviewContainer.setCssProps({ "display": "" })
			this.chartContainer.setCssProps({ "display": "flex" })
			
			this.renderControls();
			
			if (this.stats) {
				if (this.activeTab === "taxonomy") {
					if (this.statisticsViewInstance) this.statisticsViewInstance.destroy();
					if (this.taxonomyViewInstance) this.taxonomyViewInstance.render(this.stats);
				} else {
					if (this.taxonomyViewInstance) this.taxonomyViewInstance.destroy();
					if (this.statisticsViewInstance) this.statisticsViewInstance.render(this.stats, this.activeTab);
				}
			}
		}
	}
}
