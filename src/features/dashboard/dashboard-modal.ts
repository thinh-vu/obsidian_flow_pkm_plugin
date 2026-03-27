/**
 * Dashboard Modal
 * Displays a full-screen or large modal with Vault statistics.
 * Renders 4 tabs with ECharts: Properties, Tags, Activity, Mood.
 */

import { App, Modal, setIcon, TFolder } from "obsidian";
import type * as echarts from "echarts";
import { FlowPluginSettings, FlowRole, TagNode, VaultMission } from "../../types";
import { VaultStats, collectVaultStats, invalidateStatsCache, extractWikilinkName } from "./stats-collector";
import { detectBlueprintMissions } from "../../core/blueprint-detect";
import { renderFlowProgressionTab } from "./tabs/flow-progression";
import { CHART_PALETTE, WARM_CHART_PALETTE, HEATMAP_RAMP, ACTIVITY_COLOR, ACTIVITY_AREA, ACTIVITY_AVGLINE, MISSION_STATUS, FEELING_PALETTE, BRAND } from "../../brand-colors";

import { TFile } from "obsidian";

let echartsModule: typeof import("echarts") | null = null;
async function getECharts() {
	if (!echartsModule) echartsModule = await import("echarts");
	return echartsModule;
}

type DashboardTab = "properties" | "tags" | "activity" | "mood" | "taxonomy";
type DashboardView = "statistics" | "navigator" | "flow";

export class DashboardModal extends Modal {
	private settings: FlowPluginSettings;
	private activeView: DashboardView = "flow";
	private activeTab: DashboardTab = "properties";
	private stats: VaultStats | null = null;
	private chartInstanceLeft: echarts.ECharts | null = null;
	private chartInstanceRight: echarts.ECharts | null = null;
	private chartInstanceSingle: echarts.ECharts | null = null;
	private chartInstances: echarts.ECharts[] = [];
	private controlsContainer: HTMLElement | null = null;
	private chartContainer: HTMLElement | null = null;
	private navigatorContainer: HTMLElement | null = null;
	private overviewContainer: HTMLElement | null = null;

	// properties tab state
	private selectedPropertyCategory: string | null = null;
	private excludedProperties: Set<string> = new Set(["created", "summary", "publish_url", "mindmap-plugin", "min-impact", "created-after"]);

	// Activity tab state
	private activityAggregation: "dayOfMonth" | "dayOfWeek" | "weekOfYear" | "monthOfYear" | "hourOfDay" = "dayOfMonth";

	// Navigator state
	private navigatorSortCol: number = 0;
	private navigatorSortAsc: boolean = true;
	private navigatorVisibleCols: boolean[] = [];
	private navigatorCurrentPage: number = 1;
	private navigatorPageSize: number = 100;
	private navigatorStripedRows: boolean = false;
	private navigatorCustomCols: string[] = [];
	private navigatorSearchQuery: string = "";
	private navigatorActiveFilter: { type: string; value: string } | null = null;

	constructor(app: App, settings: FlowPluginSettings) {
		super(app);
		this.settings = settings;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.addClass("flow-dashboard-modal");

		// Default to Navigator on mobile for better usability
		const isMobile = window.innerWidth <= 768;
		if (isMobile) this.activeView = "navigator";

		// Set modal geometry to be 80%x80% (CSS handles this, but we can hint via classes)
		this.modalEl.addClass("flow-dashboard-ui-1");

		contentEl.empty();

		// Header Row
		const headerContainer = contentEl.createDiv("flow-dashboard-header");
		headerContainer.style.display = "flex";
		headerContainer.style.justifyContent = "center";
		headerContainer.style.alignItems = "center";
		headerContainer.style.position = "relative";
		const titleRow = headerContainer.createDiv();
		titleRow.style.cssText = "display:flex;align-items:center;justify-content:center;gap:8px;";
		const wavesIcon = titleRow.createSpan();
		setIcon(wavesIcon, "waves");
		wavesIcon.style.cssText = "display:flex;align-items:center;color:var(--text-accent);";
		titleRow.createEl("h2", { text: "FLOW Dashboard", cls: "flow-dashboard-title" });
		titleRow.querySelector("h2")!.style.margin = "0";

		// Learn Anything watermark
		const watermark = headerContainer.createEl("a");
		watermark.href = "https://learn-anything.vn/download-obsidian-flow";
		watermark.style.cssText = "position:absolute;bottom:12px;right:20px;opacity:0.35;transition:opacity 0.2s;z-index:5;";
		watermark.onmouseenter = () => watermark.style.opacity = "0.7";
		watermark.onmouseleave = () => watermark.style.opacity = "0.35";
		const logo = watermark.createEl("img");
		logo.style.cssText = "height:24px;";
		logo.src = "https://learn-anything.vn/img/logo-learn-anything-new-rec_trans.png";
		logo.onerror = () => {
			try {
				const adapter = this.app.vault.adapter as any;
				if (adapter.getResourcePath) {
					const basePath = adapter.getBasePath?.() || "";
					logo.src = `app://local/${basePath}/.obsidian/plugins/obsidian-flow/src/learn-anything-logo-rec-trans.png`;
				}
			} catch { /* ignore */ }
		};
		logo.alt = "Learn Anything";
		logo.title = "Download mẫu Vault FLOW từ Learn Anything";

		this.overviewContainer = contentEl.createDiv("flow-overview-container");
		this.overviewContainer.style.marginTop = "24px";

		// Top-level view toggle: Statistics vs Navigator
		this.renderViewToggle(contentEl);

		// Chart sub-tabs (only visible in Statistics mode)
		this.renderTabs(contentEl);

		// Controls container (for things like Activity dropdown)
		this.controlsContainer = contentEl.createDiv("flow-dashboard-controls");
		this.controlsContainer.style.marginBottom = "10px";
		this.controlsContainer.style.display = "flex";
		this.controlsContainer.style.justifyContent = "center";
		this.renderControls();

		// Chart container (for ECharts)
		this.chartContainer = contentEl.createDiv("flow-chart-container");
		this.chartContainer.addClass("flow-dashboard-ui-2");
		this.chartContainer.style.display = "flex";
		this.chartContainer.addClass("flow-dashboard-ui-3");

		// Navigator container (for Data Table)
		this.navigatorContainer = contentEl.createDiv("flow-navigator-container");
		this.navigatorContainer.addClass("flow-dashboard-ui-4");
		this.navigatorContainer.style.display = "none";

		// Handle window resize early
		window.addEventListener("resize", this.handleResize);

		// ── Data collection (synchronous — sub-100ms) ──────────────────
		invalidateStatsCache();
		this.stats = collectVaultStats(this.app, this.settings.folderMap, this.settings);

		// Persist cache for next open
		this.settings.lastCachedStats = this.stats as unknown as Record<string, any>;
		const plugin = (this.app as any).plugins?.plugins?.["obsidian-flow"];
		if (plugin && plugin.saveSettings) plugin.saveSettings();

		// Render everything immediately
		if (this.overviewContainer) {
			this.renderOverviewRow(this.overviewContainer);
		}
		this.renderView();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();

		for (const chart of this.chartInstances) {
			chart.dispose();
		}
		this.chartInstances = [];
		this.chartInstanceSingle = null;
		this.chartInstanceLeft = null;
		this.chartInstanceRight = null;

		window.removeEventListener("resize", this.handleResize);
	}

	private handleResize = () => {
		for (const chart of this.chartInstances) {
			chart.resize();
		}
	};

	private renderOverviewRow(container: HTMLElement) {
		if (!this.stats) return;

		const row = container.createDiv("flow-dashboard-overview");

		const createStatBox = (label: string, value: string | number) => {
			const box = row.createDiv("flow-stat-box");
			box.createDiv("flow-stat-label").setText(label);
			box.createDiv("flow-stat-value").setText(String(value));
		};

		createStatBox(this.settings.language === "vi" ? "📝 Tổng Ghi chú Hoạt động" : "📝 Total Active Notes", this.stats.totalActiveNotes);

		// Count Capture vs Forge vs Exhibit
		createStatBox("📥 Capture", this.stats.notesPerFolder[FlowRole.CAPTURE] || 0);
		createStatBox("🗓️ Track", this.stats.notesPerFolder[FlowRole.TRACK] || 0);
		createStatBox("🔨 Forge", this.stats.notesPerFolder[FlowRole.FORGE] || 0);
		createStatBox("🏛️ Exhibit", this.stats.notesPerFolder[FlowRole.EXHIBIT] || 0);
	}

	private viewToggleBar: HTMLElement | null = null;

	private renderViewToggle(container: HTMLElement) {
		// Create once, update in-place
		if (!this.viewToggleBar) {
			this.viewToggleBar = container.createDiv("flow-view-toggle");
			this.viewToggleBar.style.display = "flex";
			this.viewToggleBar.addClass("flow-dashboard-ui-5");
		}
		this.viewToggleBar.empty();

		const isVi = this.settings.language === "vi";
		const views: { id: DashboardView; label: string; icon: string }[] = [
			{ id: "flow", label: isVi ? "Tiến trình" : "Progress", icon: "activity" },
			{ id: "statistics", label: isVi ? "Thống kê" : "Statistics", icon: "bar-chart-2" },
			{ id: "navigator", label: isVi ? "Bảng nội dung" : "Navigator", icon: "table" },
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

		const hasMoodData = this.stats && (Object.keys(this.stats.moodByDate).length > 0 || Object.keys(this.stats.feelingCounts).length > 0);
		if (!hasMoodData) {
			tabs = tabs.filter(t => t.id !== "mood");
			if (this.activeTab === "mood") this.activeTab = "activity";
		}

		for (const tab of tabs) {
			const btn = tabBar.createDiv(`flow-tab ${this.activeTab === tab.id ? "active" : ""}`);
			setIcon(btn, tab.icon);
			btn.createSpan({ text: tab.name });

			btn.addEventListener("click", () => {
				if (this.activeTab === tab.id) return;
				tabBar.querySelectorAll(".flow-tab").forEach(t => t.removeClass("active"));
				btn.addClass("active");

				this.activeTab = tab.id as DashboardTab;
				this.renderControls();
				this.renderView();
			});
		}
	}

	private renderControls() {
		if (!this.controlsContainer) return;
		this.controlsContainer.empty();

		// No controls needed for current tabs (calendar heatmap has no aggregation selector)
	}

	private renderView() {
		if (!this.chartContainer || !this.navigatorContainer) return;

		// Get references
		const tabBar = this.contentEl.querySelector("#flow-chart-tabs") as HTMLElement;

		if (this.activeView === "navigator") {
			// Navigator mode: hide chart & tabs, show table
			this.chartContainer.style.display = "none";
			if (this.controlsContainer) this.controlsContainer.style.display = "none";
			if (tabBar) tabBar.style.display = "none";
			if (this.overviewContainer) this.overviewContainer.style.display = "";
			this.navigatorContainer.style.display = "block";
			this.renderNavigator();
		} else if (this.activeView === "flow") {
			this.navigatorContainer.style.display = "none";
			if (tabBar) tabBar.style.display = "none";
			if (this.controlsContainer) this.controlsContainer.style.display = "none";
			if (this.overviewContainer) this.overviewContainer.style.display = "none";
			this.chartContainer.style.display = "flex";
			this.chartContainer.empty();
			if (this.stats) renderFlowProgressionTab(this.chartContainer, this.stats, this.app, this.settings);
		} else {
			// Statistics mode: show chart & tabs, hide table
			this.navigatorContainer.style.display = "none";
			if (tabBar) tabBar.style.display = "flex";
			if (this.controlsContainer) this.controlsContainer.style.display = "flex";
			if (this.overviewContainer) this.overviewContainer.style.display = "";
			this.chartContainer.style.display = "flex";
			this.renderControls();
			this.renderChart();
		}
	}

	private async renderChart() {
		if (!this.chartContainer || !this.stats) return;

		// Clear containers completely for fresh layout
		this.chartContainer.empty();
		for (const chart of this.chartInstances) {
			chart.dispose();
		}
		this.chartInstances = [];
		this.chartInstanceSingle = null;
		this.chartInstanceLeft = null;
		this.chartInstanceRight = null;

		const echarts = await getECharts();
		const theme = "light";

		if (this.activeTab === "properties") {
			// SPLIT LAYOUT (Master-Detail)
			// Config icon to toggle excluded properties
			const configBar = this.chartContainer.createDiv();
			configBar.addClass("flow-dashboard-ui-6");
			const isVi = this.settings.language === "vi";
			const configBtn = configBar.createEl("button");
			configBtn.addClass("flow-dashboard-ui-7");
			configBtn.title = isVi ? "Lọc thuộc tính" : "Filter properties";

			const iconSpan = configBtn.createSpan();
			setIcon(iconSpan, "settings");
			iconSpan.addClass("flow-dashboard-ui-8");
			configBtn.createSpan({ text: isVi ? "Lọc thuộc tính" : "Filter Props", cls: "flow-filter-props-text" });

			configBtn.onclick = () => {
				// Toggle popup
				let popup = this.chartContainer!.querySelector(".flow-prop-filter-popup") as HTMLElement;
				if (popup) { popup.remove(); return; }

				popup = this.chartContainer!.createDiv("flow-prop-filter-popup");
				popup.addClass("flow-dashboard-ui-9");

				popup.createEl("div", { text: isVi ? "Loại trừ thuộc tính:" : "Exclude Properties:" }).style.fontWeight = "600";

				const allKeys = Object.keys(this.stats!.propertiesGrouped).sort();
				for (const key of allKeys) {
					const row = popup.createDiv();
					row.addClass("flow-dashboard-ui-10");

					const cb = row.createEl("input", { type: "checkbox" }) as HTMLInputElement;
					cb.checked = !this.excludedProperties.has(key);
					row.createEl("label", { text: key });

					cb.onchange = () => {
						if (cb.checked) {
							this.excludedProperties.delete(key);
						} else {
							this.excludedProperties.add(key);
						}
						this.renderChart();
					};
				}

				// Close on outside click
				setTimeout(() => {
					const handler = (e: MouseEvent) => {
						if (popup && !popup.contains(e.target as Node) && e.target !== configBtn) {
							popup.remove();
							document.removeEventListener("click", handler);
						}
					};
					document.addEventListener("click", handler);
				}, 0);
			};

			this.chartContainer.style.position = "relative";

			const leftDiv = this.chartContainer.createDiv();
			const isMobileView = window.innerWidth <= 768;
			if (isMobileView) {
				this.chartContainer.style.flexDirection = "column";
				leftDiv.addClass("flow-dashboard-ui-11");
			} else {
				this.chartContainer.style.flexDirection = "row";
				leftDiv.addClass("flow-dashboard-ui-12");
			}

			const rightDiv = this.chartContainer.createDiv();
			if (isMobileView) {
				rightDiv.addClass("flow-dashboard-ui-13");
			} else {
				rightDiv.addClass("flow-dashboard-ui-14");
			}

			this.chartInstanceLeft = echarts.init(leftDiv, theme);
			this.chartInstanceRight = echarts.init(rightDiv, theme);
			if (this.chartInstanceLeft) this.chartInstances.push(this.chartInstanceLeft);
			if (this.chartInstanceRight) this.chartInstances.push(this.chartInstanceRight);

			this.renderPropertiesInteractive();
		} else if (this.activeTab === "activity") {
			// SPLIT LAYOUT for Activity: Heatmap (top/left) + Day-of-Week bar chart (bottom/right)
			this.chartContainer.style.position = "relative";

			const isMobileView = window.innerWidth <= 768;

			if (isMobileView) {
				this.chartContainer.style.flexDirection = "column";
			} else {
				this.chartContainer.style.flexDirection = "column";
			}

			const topDiv = this.chartContainer.createDiv();
			topDiv.addClass("flow-dashboard-ui-15");

			const bottomDiv = this.chartContainer.createDiv();
			bottomDiv.addClass("flow-dashboard-ui-16");

			this.chartInstanceLeft = echarts.init(topDiv, theme);
			this.chartInstanceRight = echarts.init(bottomDiv, theme);
			if (this.chartInstanceLeft) this.chartInstances.push(this.chartInstanceLeft);
			if (this.chartInstanceRight) this.chartInstances.push(this.chartInstanceRight);

			// Heatmap chart (taller)
			const heatmapOption = this.getActivityChartOption();
			if (heatmapOption.calendar) {
				const numYears = Array.isArray(heatmapOption.calendar) ? heatmapOption.calendar.length : 1;
				topDiv.style.minHeight = (numYears * 180 + 140) + "px";
			}
			heatmapOption.backgroundColor = "transparent";
			this.chartInstanceLeft.setOption(heatmapOption, true);

			// Day-of-week bar chart
			const dowOption = this.getActivityByDayOfWeekOption();
			dowOption.backgroundColor = "transparent";
			this.chartInstanceRight.setOption(dowOption, true);

			// Resize both on window resize
			setTimeout(() => {
				this.chartInstanceLeft?.resize();
				this.chartInstanceRight?.resize();
			}, 100);
		} else if (this.activeTab === "taxonomy") {
			// TAXONOMY: No ECharts needed, render custom DOM
			this.renderTaxonomyView();
		} else {
			// SINGLE LAYOUT
			const singleDiv = this.chartContainer.createDiv();
			singleDiv.style.width = "100%";
			singleDiv.style.height = "100%";

			this.chartInstanceSingle = echarts.init(singleDiv, theme);
			if (this.chartInstanceSingle) this.chartInstances.push(this.chartInstanceSingle);

			let option: echarts.EChartsOption = {};
			switch (this.activeTab) {
				case "tags": option = this.getTagsChartOption(); break;
				case "mood": option = this.getMoodChartOption(); break;
			}
			option.backgroundColor = "transparent";
			this.chartInstanceSingle.setOption(option, true);
		}
	}

	private renderPropertiesInteractive() {
		if (!this.stats || !this.chartInstanceLeft || !this.chartInstanceRight) return;

		// 1. MASTER CHART: Treemap of all Properties (excluding user-hidden ones)
		const propKeys = Object.keys(this.stats.propertiesGrouped)
			.filter(k => !this.excludedProperties.has(k));

		const treemapData = propKeys.map(key => {
			const group = this.stats!.propertiesGrouped[key];
			const totalCount = Object.values(group || {}).reduce((a, b) => a + b, 0);
			return { name: key, value: totalCount };
		}).sort((a, b) => b.value - a.value).slice(0, 50);

		const leftOption: echarts.EChartsOption = {
			backgroundColor: "transparent",
			title: { text: this.settings.language === "vi" ? "Thuộc tính (Nhấn vào biểu đồ để xem chi tiết)" : "Properties (Click chart to view details)", left: "center", bottom: 0, textStyle: { fontSize: 11, color: "var(--text-muted)", fontWeight: "normal" } },
			tooltip: { formatter: "{b}: {c} notes" },
			series: [{
				type: "treemap",
				data: treemapData,
				roam: false,
				nodeClick: false,
				breadcrumb: { show: false },
				label: { show: true, formatter: "{b}\n({c})" }
			}]
		};

		this.chartInstanceLeft.setOption(leftOption, true);

		// Default to 'progress' if available, otherwise the largest
		if (!this.selectedPropertyCategory) {
			const hasProgress = treemapData.find(d => d.name === "progress");
			this.selectedPropertyCategory = hasProgress ? "progress" : (treemapData[0]?.name || null);
		}

		// Click Listener for interactivity
		this.chartInstanceLeft.on("click", (params) => {
			if (params.name) {
				this.selectedPropertyCategory = params.name;
				this.updatePropertiesDetailChart();
			}
		});

		this.updatePropertiesDetailChart();
	}

	private updatePropertiesDetailChart() {
		if (!this.stats || !this.chartInstanceRight || !this.selectedPropertyCategory) return;
		const isVi = this.settings.language === "vi";

		const group = this.stats.propertiesGrouped[this.selectedPropertyCategory] || {};

		const aggregated: Record<string, number> = {};
		for (const [name, value] of Object.entries(group)) {
			let strName = String(name);
			if (this.selectedPropertyCategory === "publish" && strName.includes("T")) {
				strName = strName.split("T")[0] || strName;
			}
			aggregated[strName] = (aggregated[strName] || 0) + (value as number);
		}

		const detailData = Object.entries(aggregated)
			.map(([name, value]) => ({ name, value }))
			.sort((a, b) => b.value - a.value);

		const rightOption: echarts.EChartsOption = {
			backgroundColor: "transparent",
			title: { text: isVi ? `Giá trị cho '${this.selectedPropertyCategory}'` : `Values for '${this.selectedPropertyCategory}'`, left: "center", top: 10, textStyle: { fontSize: 14 } },
			tooltip: { trigger: "item" },
			xAxis: { type: "category", data: detailData.map(d => d.name), axisLabel: { interval: 0, rotate: 30 } },
			yAxis: { type: "value" },
			series: [{
				type: "bar",
				data: detailData.map(d => d.value),
				itemStyle: { color: BRAND.teal },
				label: { show: true, position: "top" }
			}]
		};

		this.chartInstanceRight.setOption(rightOption, true);
	}

	private async renderTaxonomyView() {
		if (!this.chartContainer) return;
		const isVi = this.settings.language === "vi";

		this.chartContainer.style.display = "flex";
		this.chartContainer.addClass("flow-dashboard-ui-17");

		const taxonomy = this.settings.tagTaxonomy || [];
		let missions = [...(this.settings.vaultMissions || [])];

		// Auto-detect Blueprint files as missions if not already registered
		missions = detectBlueprintMissions(this.app.vault, this.settings.folderMap, missions, this.settings.language);

		// ── Top: Sunburst Chart for Tag Hierarchy ──
		// Use taxonomy if available, otherwise build from vault stats
		const hasTaxonomy = taxonomy.length > 0;
		const hasVaultTags = this.stats && Object.keys(this.stats.tagsCount).length > 0;

		if (hasTaxonomy || hasVaultTags) {
			const chartDiv = this.chartContainer.createDiv();
			chartDiv.addClass("flow-dashboard-ui-18");

			const echarts = await getECharts();
			const chartInstance = echarts.init(chartDiv, "light");
			this.chartInstances.push(chartInstance);

			let sunburstData: any[];

			if (hasTaxonomy) {
				// Use registered taxonomy
				const convertToSunburst = (nodes: TagNode[]): any[] => {
					return nodes.map(node => ({
						name: node.name,
						value: node.children?.length > 0 ? undefined : 1,
						children: node.children?.length > 0 ? convertToSunburst(node.children) : undefined,
					}));
				};
				sunburstData = convertToSunburst(taxonomy);
			} else if (this.stats) {
				// Build hierarchy from vault tags (e.g. "flow/idea" → parent "flow" → child "idea")
				const tagTree: Record<string, any> = {};
				for (const [tag, count] of Object.entries(this.stats.tagsCount)) {
					const parts = tag.split("/");
					let current = tagTree;
					for (const part of parts) {
						if (!current[part]) current[part] = { _count: 0, _children: {} };
						current[part]._count += count;
						current = current[part]._children;
					}
				}

				const treeToData = (tree: Record<string, any>): any[] => {
					return Object.entries(tree).map(([name, node]) => {
						const children = treeToData(node._children || {});
						return {
							name,
							value: children.length > 0 ? undefined : (node._count || 1),
							children: children.length > 0 ? children : undefined,
						};
					});
				};
				sunburstData = treeToData(tagTree);
			} else {
				sunburstData = [];
			}

			const warmPalette = [...WARM_CHART_PALETTE];
			const sunburstOption: echarts.EChartsOption = {
				backgroundColor: "transparent",
				title: { text: isVi ? "Hệ thống thẻ" : "Tag Hierarchy", left: "center", top: 10, textStyle: { fontSize: 14 } },
				tooltip: { trigger: "item", formatter: "{b}" },
				color: warmPalette,
				series: [{
					type: "sunburst",
					data: sunburstData,
					radius: ["15%", "85%"],
					label: { rotate: "radial", fontSize: 11, color: "#333" },
					itemStyle: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" },
					levels: [
						{},
						{ r0: "15%", r: "40%", label: { fontSize: 13, fontWeight: "bold" }, itemStyle: { borderWidth: 2 } },
						{ r0: "40%", r: "62%", label: { fontSize: 11 } },
						{ r0: "62%", r: "85%", label: { fontSize: 10 } },
					],
				}],
			};

			chartInstance.setOption(sunburstOption as any, true);
		} else {
			const emptyTag = this.chartContainer.createDiv();
			emptyTag.addClass("flow-dashboard-ui-19");
			emptyTag.setText("No tags found in your vault. Add tags to your notes or register a tag hierarchy in Settings → FLOW → Taxonomy.");
		}

		// ── Middle: Properties by Dimension Chart ──
		const dimensions = this.settings.taxonomyDimensions || [];
		if (dimensions.length > 0 && this.stats) {
			const dimChartDiv = this.chartContainer.createDiv();
			dimChartDiv.addClass("flow-dashboard-ui-20");
			dimChartDiv.style.marginTop = "50px";

			const echarts = await getECharts();
			const dimChart = echarts.init(dimChartDiv, "light");
			this.chartInstances.push(dimChart);

			// Build treemap data: each dimension is a parent, dimension values are children
			// Count occurrences from vault stats
			// IMPORTANT: vault property values may be comma-separated, so we split them
			const treemapData: any[] = [];
			const dimPalette = [...CHART_PALETTE];

			for (let di = 0; di < dimensions.length; di++) {
				const dim = dimensions[di];
				if (!dim) continue;
				const valueCounts: Record<string, number> = {};

				// Match dimension id against propertiesGrouped keys
				const propGroup = this.stats.propertiesGrouped[dim.id];
				if (propGroup) {
					// Count occurrences — split comma-separated values into individual items
					for (const [rawKey, count] of Object.entries(propGroup)) {
						// Split by comma and trim whitespace
						const subValues = rawKey.split(",").map(s => s.trim()).filter(Boolean);
						for (const sv of subValues) {
							valueCounts[sv] = (valueCounts[sv] || 0) + (count as number);
						}
					}
				}

				// Build children from dimension config values + any discovered vault values
				const children: any[] = [];
				const addedValues = new Set<string>();

				for (const val of dim.values) {
					const lcVal = val.toLowerCase();
					let count = valueCounts[val] || valueCounts[lcVal] || 0;
					// Also check for case-insensitive match
					for (const [k, v] of Object.entries(valueCounts)) {
						if (k.toLowerCase() === lcVal && k !== val && k !== lcVal) {
							count += v;
						}
					}
					children.push({ name: val, value: count || 1 });
					addedValues.add(lcVal);
				}

				// Include values found in vault but not in dimension config
				for (const [key, count] of Object.entries(valueCounts)) {
					if (!addedValues.has(key.toLowerCase())) {
						children.push({ name: `${key} ⚬`, value: count });
					}
				}

				if (children.length > 0) {
					treemapData.push({
						name: dim.label,
						children: children,
						itemStyle: { color: dimPalette[di % dimPalette.length] },
					});
				}
			}

			if (treemapData.length > 0) {
				const dimOption: echarts.EChartsOption = {
					backgroundColor: "transparent",
					title: { text: isVi ? "Thuộc tính theo phân loại" : "Properties by Dimension", left: "center", top: 50, textStyle: { fontSize: 14 } },
					tooltip: {
						formatter: (params: any) => {
							const treePathInfo = params.treePathInfo || [];
							const path = treePathInfo.map((p: any) => p.name).filter(Boolean).join(" → ");
							return `${path}: <b>${params.value}</b> note(s)`;
						},
					},
					series: [{
						type: "treemap",
						data: treemapData,
						roam: false,
						nodeClick: false,
						breadcrumb: { show: true, top: "bottom" },
						label: { show: true, formatter: "{b}\n({c})", fontSize: 11 },
						levels: [
							{
								itemStyle: { borderWidth: 3, borderColor: "#fff", gapWidth: 3 },
								upperLabel: { show: true, height: 28, fontSize: 13, fontWeight: "bold", color: "#fff" },
							},
							{
								itemStyle: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", gapWidth: 1 },
								colorSaturation: [0.3, 0.7],
							},
						],
					}],
				};

				dimChart.setOption(dimOption as any, true);
			} else {
				dimChartDiv.remove();
			}
		}

		// ── Bottom: Mission Board ──
		const missionBoard = this.chartContainer.createDiv();
		missionBoard.style.padding = "16px";

		const mTitle = missionBoard.createEl("h4", { text: "🎯 Blueprints" });
		mTitle.style.marginBottom = "12px";
		mTitle.style.color = "var(--text-normal)";

		if (missions.length === 0) {
			const emptyM = missionBoard.createDiv();
			emptyM.addClass("flow-dashboard-ui-21");
			emptyM.setText("No missions defined. Go to Settings → FLOW → Taxonomy to create your first mission.");
		} else {
			const grid = missionBoard.createDiv();
			grid.addClass("flow-dashboard-ui-22");

			for (const m of missions) {
				const card = grid.createDiv();
				card.addClass("flow-dashboard-ui-23");

				// Status border color
				const statusColor = m.status === "active" ? MISSION_STATUS.active : m.status === "paused" ? MISSION_STATUS.paused : MISSION_STATUS.done;
				card.style.borderLeft = `4px solid ${statusColor}`;

				const statusIcon = m.status === "active" ? "🟢" : m.status === "paused" ? "🟡" : "✅";
				const header = card.createDiv();
				header.addClass("flow-dashboard-ui-24");

				header.createSpan({ text: statusIcon });
				const nameEl = header.createSpan({ text: m.name });
				nameEl.style.fontWeight = "600";
				nameEl.style.fontSize = "1.05em";

				const isVi = this.settings.language === "vi";
				const displayStatus = isVi ? (m.status === "active" ? "HOẠT ĐỘNG" : m.status === "paused" ? "TẠM DỪNG" : "HOÀN THÀNH") : m.status.toUpperCase();
				const statusBadge = header.createSpan({ text: displayStatus });
				statusBadge.addClass("flow-dashboard-ui-25");
				statusBadge.style.backgroundColor = statusColor;
				statusBadge.style.color = "#fff";
				statusBadge.style.fontWeight = "600";

				if (m.description) {
					const desc = card.createDiv({ text: m.description });
					desc.addClass("flow-dashboard-ui-26");
				}

				if (m.relatedTags.length > 0) {
					const tagsDiv = card.createDiv();
					tagsDiv.addClass("flow-dashboard-ui-27");

					for (const tag of m.relatedTags) {
						const tagChip = tagsDiv.createSpan({ text: `#${tag}` });
						tagChip.addClass("flow-dashboard-ui-28");

						// Count matching tags in stats
						if (this.stats?.tagsCount) {
							const count = this.stats.tagsCount[tag] || 0;
							if (count > 0) {
								tagChip.setText(`#${tag} (${count})`);
							}
						}
					}
				}
			}
		}
	}

	// ── Chart Generators ──────────────────────────────────────────────────

	// Note: getPropertiesChartOption is removed as it was replaced by the split layout method

	private getTagsChartOption(): echarts.EChartsOption {
		if (!this.stats) return {};
		const isVi = this.settings.language === "vi";

		// Top 100 tags for Treemap
		const data = Object.entries(this.stats.tagsCount)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 100)
			.map(([name, value]) => ({ name, value }));

		if (data.length === 0) return { title: { text: "No tags found", left: "center" } };

		return {
			title: { text: isVi ? "Top 100 thẻ" : "Top 100 Tags", left: "center", top: 10 },
			tooltip: { formatter: "{b}: {c}" },
			series: [
				{
					type: "treemap",
					data: data,
					roam: false,
					nodeClick: false,
					breadcrumb: { show: false },
					label: { show: true, formatter: "{b}\n({c})" },
					itemStyle: {
						borderColor: "#fff"
					}
				}
			]
		};
	}

	private getActivityChartOption(): echarts.EChartsOption {
		if (!this.stats) return {};
		const isVi = this.settings.language === "vi";

		const timestamps = this.stats.activityTimestamps;

		// Build daily activity counts for calendar heatmap
		const dailyCounts: Record<string, number> = {};
		for (const ts of timestamps) {
			const d = new Date(ts);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
			dailyCounts[key] = (dailyCounts[key] || 0) + 1;
		}

		const data = Object.entries(dailyCounts).map(([date, count]) => [date, count]);
		if (data.length === 0) return { title: { text: "No activity data", left: "center" } };

		// Get date range
		const allDates = data.map(d => d[0] as string).sort();
		const startDate = allDates[0]!;
		const endDate = allDates[allDates.length - 1]!;

		// Get year range for calendar(s)
		const startYear = new Date(startDate).getFullYear();
		const endYear = new Date(endDate).getFullYear();
		const maxVal = Math.max(...data.map(d => d[1] as number));

		const calendars: any[] = [];
		const series: any[] = [];

		for (let y = startYear; y <= endYear; y++) {
			const calIndex = y - startYear;
			calendars.push({
				top: 60 + calIndex * 160,
				left: 60,
				right: 40,
				cellSize: ["auto", 15],
				range: String(y),
				itemStyle: {
					borderWidth: 2,
					borderColor: "#fff",
					color: "#f0f7f7",
				},
				splitLine: { show: false },
				yearLabel: { show: true, margin: 30, fontSize: 14 },
				dayLabel: {
					firstDay: 1,
					nameMap: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
					fontSize: 10,
				},
				monthLabel: { fontSize: 10 },
			});
			series.push({
				type: "heatmap",
				coordinateSystem: "calendar",
				calendarIndex: calIndex,
				data: data.filter(d => (d[0] as string).startsWith(String(y))),
			});
		}

		return {
			title: { text: isVi ? "Biểu đồ hoạt động" : "Activity Heatmap", left: "center", top: 10, textStyle: { fontSize: 14 } },
			tooltip: {
				formatter: (params: any) => {
					return `${params.value[0]}: <b>${params.value[1]}</b> note(s)`;
				},
			},
			visualMap: {
				min: 0,
				max: maxVal,
				calculable: true,
				orient: "horizontal",
				left: "center",
				top: calendars.length * 160 + 50,
				inRange: {
					color: [...HEATMAP_RAMP],
				},
				textStyle: { fontSize: 11 },
			},
			calendar: calendars.length === 1 ? calendars[0] : calendars,
			series: series,
		};
	}

	private getActivityByDayOfWeekOption(): echarts.EChartsOption {
		if (!this.stats) return {};
		const isVi = this.settings.language === "vi";

		const timestamps = this.stats.activityTimestamps;
		if (timestamps.length === 0) return { title: { text: "No activity data", left: "center" } };

		// Aggregate by day of week
		const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
		const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Mon=0 ... Sun=6

		for (const ts of timestamps) {
			const d = new Date(ts);
			// getDay(): 0=Sun, 1=Mon, ..., 6=Sat → convert to Mon=0 ... Sun=6
			const dow = (d.getDay() + 6) % 7;
			dayCounts[dow] = (dayCounts[dow] ?? 0) + 1;
		}

		const maxCount = Math.max(...dayCounts);
		const colors = dayCounts.map(c => {
			const ratio = maxCount > 0 ? c / maxCount : 0;
			if (ratio > 0.75) return HEATMAP_RAMP[4];
			if (ratio > 0.5) return HEATMAP_RAMP[3];
			if (ratio > 0.25) return HEATMAP_RAMP[2];
			return HEATMAP_RAMP[1];
		});

		return {
			title: { text: isVi ? "Hoạt động theo thứ trong tuần" : "Activity by Day of Week", left: "center", top: 10, textStyle: { fontSize: 14 } },
			tooltip: {
				trigger: "axis",
				formatter: (params: any) => {
					const p = Array.isArray(params) ? params[0] : params;
					return `${p.name}: <b>${p.value}</b> ${isVi ? "hoạt động" : "activity events"}`;
				},
			},
			grid: { left: "10%", right: "10%", bottom: "15%", top: "20%" },
			xAxis: {
				type: "category",
				data: dayNames,
				axisLabel: { fontSize: 12 },
			},
			yAxis: {
				type: "value",
				name: "Events",
				nameTextStyle: { fontSize: 11 },
			},
			series: [{
				type: "bar",
				data: dayCounts.map((val, idx) => ({
					value: val,
					itemStyle: { color: colors[idx] || HEATMAP_RAMP[1], borderRadius: [4, 4, 0, 0] },
				})),
				barWidth: "50%",
				label: { show: true, position: "top", fontSize: 11 },
			}],
		};
	}

	private getMoodChartOption(): echarts.EChartsOption {
		if (!this.stats) return {};
		const isVi = this.settings.language === "vi";

		const numericData: [string, number][] = Object.entries(this.stats.moodByDate);
		const feelingByDate = this.stats.feelingByDate;
		const feelingDates = Object.keys(feelingByDate).sort();

		const hasNumeric = numericData.length > 0;
		const hasFeelings = feelingDates.length > 0;

		// Human-readable date formatter
		const monthNames = isVi ? ["Thg 1", "Thg 2", "Thg 3", "Thg 4", "Thg 5", "Thg 6", "Thg 7", "Thg 8", "Thg 9", "Thg 10", "Thg 11", "Thg 12"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		const formatDate = (dateStr: string) => {
			const d = new Date(dateStr);
			const month = monthNames[d.getMonth()] || "";
			return `${month} ${d.getDate()}`;
		};

		if (!hasNumeric && !hasFeelings) {
			return {
				title: { text: isVi ? "Theo dõi tâm trạng & cảm xúc" : "Mood & Feeling Tracking", subtext: isVi ? "Không tìm thấy dữ liệu tâm trạng/cảm xúc trong ghi chú 'Track'.\nThêm 'mood: 7' (số) hoặc 'feeling: happy' vào daily note để bắt đầu." : "No mood/feeling data found in 'Track' notes.\nAdd 'mood: 7' (numeric) or 'feeling: happy' to your daily notes.", left: "center", top: "center" }
			};
		}

		// Feeling scatter chart with emoji-like colored dots
		if (hasFeelings) {
			const allFeelings = Object.keys(this.stats.feelingCounts).sort();
			const feelingColors = [...FEELING_PALETTE];

			// Build scatter data: each feeling is a series, x=date, y=feeling index
			const series: any[] = allFeelings.map((feeling, idx) => {
				const data: any[] = [];
				for (const date of feelingDates) {
					const fArr = feelingByDate[date] || [];
					if (fArr.includes(feeling)) {
						data.push({
							value: [date, idx],
							symbolSize: 16,
						});
					}
				}
				return {
					name: feeling.charAt(0).toUpperCase() + feeling.slice(1),
					type: "scatter",
					data: data,
					itemStyle: { color: feelingColors[idx % feelingColors.length] },
					symbolSize: 14,
					emphasis: { scale: 1.5 },
				};
			});

			return {
				title: { text: isVi ? "Dòng thời gian cảm xúc" : "Feeling Timeline", left: "center", top: 10, textStyle: { fontSize: 14 } },
				tooltip: {
					trigger: "item",
					formatter: (params: any) => {
						const date = formatDate(params.value[0]);
						return `<b>${date}</b><br/>${params.seriesName}`;
					},
				},
				legend: { bottom: 40, type: "scroll", textStyle: { fontSize: 12 } },
				grid: { left: "12%", right: "5%", bottom: "20%", top: "15%" },
				xAxis: {
					type: "category",
					data: feelingDates,
					axisLabel: {
						formatter: (val: string) => formatDate(val),
						rotate: 0,
						fontSize: 11,
					},
					axisTick: { alignWithLabel: true },
				},
				yAxis: {
					type: "value",
					min: -0.5,
					max: allFeelings.length - 0.5,
					interval: 1,
					axisLabel: {
						formatter: (val: number) => {
							const idx = Math.round(val);
							if (idx >= 0 && idx < allFeelings.length) {
								const f = allFeelings[idx] || "";
								return f.charAt(0).toUpperCase() + f.slice(1);
							}
							return "";
						},
						fontSize: 11,
					},
					splitLine: { lineStyle: { type: "dashed", color: "#eee" } },
				},
				dataZoom: [
					{ type: "inside", xAxisIndex: 0 },
					{ type: "slider", xAxisIndex: 0, bottom: 10, height: 20 },
				],
				series,
			};
		}

		// Numeric mood line chart with human dates + dataZoom
		return {
			title: { text: "Mood Score Over Time", left: "center", top: 10, textStyle: { fontSize: 14 } },
			tooltip: {
				trigger: "axis",
				formatter: (params: any) => {
					const p = Array.isArray(params) ? params[0] : params;
					return `<b>${formatDate(p.name)}</b><br/>Mood: ${p.value}`;
				},
			},
			grid: { left: "10%", right: "5%", bottom: "20%", top: "15%" },
			xAxis: {
				type: "category",
				data: numericData.map(d => d[0]),
				axisLabel: {
					formatter: (val: string) => formatDate(val),
					fontSize: 11,
				},
			},
			yAxis: { type: "value", min: 1, max: 10, name: "Mood Score", nameTextStyle: { fontSize: 11 } },
			dataZoom: [
				{ type: "inside", xAxisIndex: 0 },
				{ type: "slider", xAxisIndex: 0, bottom: 10, height: 20 },
			],
			series: [
				{
					name: "Mood",
					type: "line",
					data: numericData.map(d => d[1]),
					itemStyle: { color: ACTIVITY_COLOR },
					areaStyle: { color: ACTIVITY_AREA },
					markLine: {
						data: [{ type: "average", name: "Avg" }],
						lineStyle: { color: ACTIVITY_AVGLINE },
					},
					smooth: true,
					symbolSize: 8,
				}
			]
		};
	}

	// ── Navigator Data Table ──────────────────────────────────────────────

	private renderNavigator() {
		if (!this.navigatorContainer) return;

		this.navigatorContainer.empty();
		this.navigatorContainer.style.overflow = "hidden";
		this.navigatorContainer.style.display = "flex";
		this.navigatorContainer.style.flexDirection = "column";
		this.navigatorContainer.style.height = "100%";

		// Base columns + custom columns
		const baseCols = ["#", "Name", "Folder", "Created", "Modified", "Tags", "Impact", "Urgency", "Category", "Channel", "Publish", "Summary", "Feeling", "Aliases"];
		const allColNames = [...baseCols, ...this.navigatorCustomCols];

		if (this.navigatorVisibleCols.length < allColNames.length) {
			const diff = allColNames.length - this.navigatorVisibleCols.length;
			this.navigatorVisibleCols.push(...Array(diff).fill(true));
		}

		let triggerRenderTable: () => void = () => { };
		let triggerRenderRows: () => void = () => { };

		// === Toolbar: Search + Column Visibility + Toggles ===
		const toolbar = this.navigatorContainer.createDiv();
		toolbar.addClass("flow-dashboard-ui-29");
		toolbar.style.position = "relative";
		toolbar.style.zIndex = "100";

		// --- Quick Filters (Left side) ---
		const filtersDiv = toolbar.createDiv();
		filtersDiv.style.cssText = "display:flex;gap:8px;flex-wrap:nowrap;align-items:center;flex-shrink:0;";

		const roleIcons: Record<string, string> = {
			[FlowRole.CAPTURE]: "inbox",
			[FlowRole.TRACK]: "calendar",
			[FlowRole.FORGE]: "hammer",
			[FlowRole.BLUEPRINT]: "compass",
			[FlowRole.EXHIBIT]: "library",
			[FlowRole.VAULT]: "vault"
		};

		const orderedRoles = [
			FlowRole.CAPTURE, FlowRole.TRACK, FlowRole.FORGE,
			FlowRole.BLUEPRINT, FlowRole.EXHIBIT, FlowRole.VAULT
		];

		// Clear filter button (show only if active)
		if (this.navigatorActiveFilter) {
			const clearBtn = filtersDiv.createEl("button");
			clearBtn.addClass("flow-dashboard-ui-34");
			clearBtn.style.cssText = "padding:4px 8px;display:flex;align-items:center;gap:4px;color:var(--text-error);border-color:var(--text-error);";
			const clearIcon = clearBtn.createSpan();
			setIcon(clearIcon, "x");
			clearBtn.title = "Clear filter";
			clearBtn.onclick = () => {
				this.navigatorActiveFilter = null;
				this.navigatorCurrentPage = 1;
				this.renderNavigator();
			};
		}

		const createFilterGroupBtn = (groupLabel: string, groupIcon: string, items: { label: string; value: string; icon?: string }[], filterType: string) => {
			if (items.length === 0) return;
			const btnWrap = filtersDiv.createDiv();
			btnWrap.style.position = "relative";

			const btn = btnWrap.createEl("button");
			btn.addClass("flow-dashboard-ui-31");
			const isActiveGroup = this.navigatorActiveFilter?.type === filterType;
			if (isActiveGroup) btn.addClass("flow-dashboard-ui-33");

			const btnIcon = btn.createSpan("flow-filter-icon");
			setIcon(btnIcon, groupIcon);
			btnIcon.addClass("flow-dashboard-ui-32");

			const activeItem = isActiveGroup ? items.find(i => i.value === this.navigatorActiveFilter!.value) : null;
			const labelSpan = btn.createSpan({ text: activeItem ? activeItem.label : groupLabel });
			if (isActiveGroup) labelSpan.style.fontWeight = "bold";

			const chevron = btn.createSpan();
			setIcon(chevron, "chevron-down");
			chevron.style.cssText = "display:flex;align-items:center;margin-left:4px;opacity:0.5;";

			btn.onclick = (e) => {
				e.stopPropagation();
				// Close any existing popups
				document.querySelectorAll(".flow-filter-popup").forEach(p => p.remove());

				const popup = document.body.createDiv("flow-filter-popup");
				const rect = btnWrap.getBoundingClientRect();
				popup.style.cssText = `
					position:fixed; top:${rect.bottom + 4}px; left:${rect.left}px; z-index:99999;
					min-width:180px; max-height:300px; overflow-y:auto;
					background:var(--background-primary);
					border:1px solid var(--background-modifier-border);
					border-radius:8px; padding:6px 0;
					box-shadow:0 8px 24px rgba(0,0,0,0.15);
				`;

				for (const item of items) {
					const row = popup.createDiv();
					row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 16px;cursor:pointer;font-size:0.85em;";
					row.onmouseenter = () => row.style.backgroundColor = "var(--background-modifier-hover)";
					row.onmouseleave = () => row.style.backgroundColor = "transparent";

					if (item.icon) {
						const iEl = row.createSpan();
						setIcon(iEl, item.icon);
						iEl.style.cssText = "display:flex;align-items:center;color:var(--text-muted);";
						(iEl.querySelector("svg") as SVGElement)?.setAttribute("width", "14");
						(iEl.querySelector("svg") as SVGElement)?.setAttribute("height", "14");
					}
					row.createSpan({ text: item.label });

					const isActive = isActiveGroup && this.navigatorActiveFilter?.value === item.value;
					if (isActive) {
						row.style.fontWeight = "700";
						row.style.color = BRAND.teal;
					}

					row.onclick = () => {
						if (isActive) {
							this.navigatorActiveFilter = null;
						} else {
							this.navigatorActiveFilter = { type: filterType, value: item.value };
						}
						this.navigatorCurrentPage = 1;
						popup.remove();
						this.renderNavigator();
					};
				}

				const closeHandler = (ev: MouseEvent) => {
					if (!popup.contains(ev.target as Node)) {
						popup.remove();
						document.removeEventListener("click", closeHandler);
					}
				};
				setTimeout(() => document.addEventListener("click", closeHandler), 0);
			};
		};

		// 1. Folder filters
		const folderItems = orderedRoles.map(role => {
			const folderName = this.settings.folderMap[role as FlowRole];
			const cleanLabel = folderName?.replace(/^\d+\.\s*/, "") || role;
			return { label: cleanLabel, value: role, icon: roleIcons[role] || "folder" };
		}).filter(i => i.label);
		createFilterGroupBtn("Folder", "folder", folderItems, "folder");

		// 2. Eisenhower filters
		createFilterGroupBtn("Eisenhower", "zap", [
			{ label: "P1 — Urgent & Important", value: "p1", icon: "alert-triangle" },
			{ label: "P2 — Important", value: "p2", icon: "target" },
			{ label: "P3 — Urgent", value: "p3", icon: "clock" },
			{ label: "P4 — Neither", value: "p4", icon: "minus" },
		], "eisenhower");

		// 3. Temperature filters
		createFilterGroupBtn("Temperature", "thermometer", [
			{ label: "Hot (< 3 days)", value: "hot", icon: "flame" },
			{ label: "Warm (3–30 days)", value: "warm", icon: "sun" },
			{ label: "Cold (> 30 days)", value: "cold", icon: "snowflake" },
		], "temperature");

		// 4. Channel filters
		const channelField = this.settings.channelFieldName || "channel";
		if (this.stats?.propertiesGrouped[channelField]) {
			const channels = Object.keys(this.stats.propertiesGrouped[channelField]).sort();
			if (channels.length > 0) {
				const channelItems = channels.map(ch => ({ label: ch, value: ch, icon: "radio" }));
				createFilterGroupBtn("Channel", "radio", channelItems, "channel");
			}
		}

		// 5. Publish timeline
		createFilterGroupBtn("Publish", "calendar-clock", [
			{ label: "Today", value: "today", icon: "calendar-check" },
			{ label: "Next 3 days", value: "3days", icon: "calendar-range" },
			{ label: "Next 7 days", value: "7days", icon: "calendar" },
			{ label: "Next 2 weeks", value: "2weeks", icon: "calendar-days" },
			{ label: "Later", value: "later", icon: "calendar-off" },
		], "publish");

		// 6. Feeling filters
		if (this.stats?.feelingCounts && Object.keys(this.stats.feelingCounts).length > 0) {
			const feelings = Object.keys(this.stats.feelingCounts).sort();
			const feelingIcons: Record<string, string> = {
				"happy": "smile", "cheerful": "smile", "excited": "zap", "grateful": "heart", "hopeful": "star", "proud": "award",
				"calm": "coffee", "peaceful": "sun", "confident": "shield", "secure": "lock", "accepted": "check-circle",
				"anxious": "alert-circle", "nervous": "activity", "worried": "help-circle", "insecure": "shield-off", "overwhelmed": "cloud-rain",
				"amazed": "star", "confused": "help-circle", "curious": "search", "shocked": "zap",
				"sad": "frown", "lonely": "user", "disappointed": "cloud-drizzle", "guilty": "alert-triangle", "empty": "circle",
				"bored": "meh", "disgusted": "thumbs-down", "frustrated": "x-circle", "tired": "battery-low",
				"angry": "angry", "irritated": "flame", "stressed": "activity", "jealous": "eye", "resentful": "frown",
				"motivated": "target", "creative": "pen-tool", "focused": "crosshair", "energetic": "battery-charging", "productive": "check-square", "reflective": "book-open"
			};
			const feelItems = feelings.map(f => ({ label: f, value: f, icon: feelingIcons[f] || "heart" }));
			createFilterGroupBtn("Feeling", "smile", feelItems, "feeling");
		}

		// Spacer
		const spacer = toolbar.createDiv();
		spacer.style.flex = "1";

		// --- Search, Toggles, and Pagination (Right side) ---
		const rightControlsDiv = toolbar.createDiv();
		rightControlsDiv.addClass("flow-dashboard-ui-37");

		const searchWrapper = rightControlsDiv.createDiv();
		searchWrapper.addClass("flow-dashboard-ui-38");

		const searchIconSpan = searchWrapper.createSpan();
		setIcon(searchIconSpan, "search");
		searchIconSpan.addClass("flow-dashboard-ui-39");

		const searchInput = searchWrapper.createEl("input", { type: "text", placeholder: "Search queries..." });
		searchInput.addClass("flow-dashboard-ui-40");
		searchInput.style.paddingLeft = "28px";
		searchInput.value = this.navigatorSearchQuery;

		// Striped rows toggle
		const stripeBtn = rightControlsDiv.createEl("button");
		setIcon(stripeBtn, "align-justify");
		stripeBtn.title = "Toggle Striped Rows";
		stripeBtn.style.cursor = "pointer";
		stripeBtn.style.padding = "4px 8px";
		if (this.navigatorStripedRows) {
			stripeBtn.style.backgroundColor = "var(--interactive-accent)";
			stripeBtn.style.color = "white";
		}
		stripeBtn.onclick = () => {
			this.navigatorStripedRows = !this.navigatorStripedRows;
			if (this.navigatorStripedRows) {
				stripeBtn.style.backgroundColor = "var(--interactive-accent)";
				stripeBtn.style.color = "white";
			} else {
				stripeBtn.style.backgroundColor = "transparent";
				stripeBtn.style.color = "var(--text-normal)";
			}
			triggerRenderRows();
		};

		// Column visibility button
		const colBtn = rightControlsDiv.createEl("button");
		setIcon(colBtn, "columns");
		colBtn.title = "Show/Hide Columns";
		colBtn.addClass("flow-dashboard-ui-41");

		colBtn.onclick = (e) => {
			e.stopPropagation();
			let popup = document.body.querySelector(".flow-col-popup") as HTMLElement;
			if (popup) { popup.remove(); return; }

			const rect = colBtn.getBoundingClientRect();
			popup = document.body.createDiv("flow-col-popup");
			popup.style.cssText = `
				position:fixed; top:${rect.bottom + 4}px; 
				right:${window.innerWidth - rect.right}px; 
				z-index:99999;
				min-width:180px;
				max-height:400px; overflow-y:auto;
				background:var(--background-primary);
				border:1px solid var(--background-modifier-border);
				border-radius:6px; padding:10px;
				box-shadow:0 8px 24px rgba(0,0,0,0.15);
			`;

			allColNames.forEach((name, i) => {
				const row = popup.createDiv();
				row.style.cssText = "display:flex;align-items:center;gap:6px;padding:3px 0;";
				const cb = row.createEl("input", { type: "checkbox" }) as HTMLInputElement;
				cb.checked = this.navigatorVisibleCols[i] ?? true;
				cb.style.margin = "0";
				row.createEl("label", { text: name });
				cb.onchange = () => {
					this.navigatorVisibleCols[i] = cb.checked;
					triggerRenderTable(); // Rebuild headers & rows, leaves popup open
				};
			});

			const newColRow = popup.createDiv();
			newColRow.style.cssText = "margin-top:8px;border-top:1px solid var(--background-modifier-border);padding-top:8px;display:flex;gap:4px;";
			const newColInput = newColRow.createEl("input", { type: "text", placeholder: "Custom prop..." });
			newColInput.style.flex = "1";
			newColInput.style.width = "100px";
			const newColAdd = newColRow.createEl("button");
			setIcon(newColAdd, "plus");
			newColAdd.style.padding = "4px";
			newColAdd.onclick = () => {
				const val = newColInput.value.trim();
				if (val && !allColNames.includes(val)) {
					this.navigatorCustomCols.push(val);
					this.navigatorVisibleCols.push(true);
					popup.remove();
					this.renderNavigator(); // Needs full refresh for new columns
				}
			};

			// Close on outside click
			setTimeout(() => {
				const handler = (ev: MouseEvent) => {
					if (popup && !popup.contains(ev.target as Node) && ev.target !== colBtn) {
						popup.remove();
						document.removeEventListener("click", handler);
					}
				};
				document.addEventListener("click", handler);
			}, 0);
		};

		// Pagination controls
		const paginationDiv = rightControlsDiv.createDiv();
		paginationDiv.addClass("flow-dashboard-ui-45");

		const pageInfo = paginationDiv.createSpan({ text: `Page ${this.navigatorCurrentPage}` });
		const prevBtn = paginationDiv.createEl("button");
		setIcon(prevBtn, "chevron-left");
		prevBtn.style.padding = "4px";
		const nextBtn = paginationDiv.createEl("button");
		setIcon(nextBtn, "chevron-right");
		nextBtn.style.padding = "4px";

		// === Table Area ===
		const tableArea = this.navigatorContainer.createDiv();
		tableArea.addClass("flow-dashboard-ui-46");

		const files = this.app.vault.getMarkdownFiles();

		triggerRenderTable = () => {
			tableArea.empty();

			const tableContainer = tableArea.createDiv("flow-table-container");
			tableContainer.addClass("flow-dashboard-ui-47");

			const table = tableContainer.createEl("table");
			table.addClass("flow-dashboard-ui-48");

			const thead = table.createEl("thead");
			const trHead = thead.createEl("tr");

			// Build sortable headers
			allColNames.forEach((h, colIdx) => {
				if (!this.navigatorVisibleCols[colIdx]) return;
				const th = trHead.createEl("th", { text: h });
				th.addClass("flow-dashboard-ui-49");

				// Sort indicator
				if (this.navigatorSortCol === colIdx) {
					th.textContent = h + (this.navigatorSortAsc ? " ↑" : " ↓");
				}

				th.onclick = () => {
					if (this.navigatorSortCol === colIdx) {
						this.navigatorSortAsc = !this.navigatorSortAsc;
					} else {
						this.navigatorSortCol = colIdx;
						this.navigatorSortAsc = true;
					}
					triggerRenderTable();
				};
			});

			const tbody = table.createEl("tbody");

			const getValString = (file: any, colIdx: number): string => {
				const name = (allColNames[colIdx] || "").toLowerCase();
				if (name === "#") return ""; // Custom sort not needed
				if (name === "name") return file.basename.toLowerCase();
				if (name === "folder") return (file.parent?.path || "").toLowerCase();
				if (name === "created") return new Date(file.stat.ctime).toISOString();
				if (name === "modified") return new Date(file.stat.mtime).toISOString();
				const cache = this.app.metadataCache.getFileCache(file);
				if (name === "tags") {
					if (cache?.tags) return cache.tags.map(t => t.tag).join(", ");
					if (cache?.frontmatter?.tags) return String(cache.frontmatter.tags);
					return "";
				}
				if (cache?.frontmatter && cache.frontmatter[name] !== undefined) {
					const val = cache.frontmatter[name];
					return Array.isArray(val) ? val.map(v => extractWikilinkName(String(v))).join(", ") : extractWikilinkName(String(val));
				}
				return "";
			};

			triggerRenderRows = () => {
				tbody.empty();

				const lowerQuery = this.navigatorSearchQuery.toLowerCase();
				const af = this.navigatorActiveFilter;

				let filteredFiles = files.filter(f => {
					// Apply Search query
					if (lowerQuery) {
						const matchQuery = f.basename.toLowerCase().includes(lowerQuery) || (f.parent?.path || "").toLowerCase().includes(lowerQuery);
						if (!matchQuery) return false;
					}

					// Apply active filter
					if (af) {
						const cache = this.app.metadataCache.getFileCache(f);
						const fm = cache?.frontmatter;
						const now = Date.now();

						if (af.type === "folder") {
							const folderName = this.settings.folderMap[af.value as FlowRole];
							if (!folderName) return false;
							const cleanActiveFolder = folderName.replace(/^\d+\.\s*/, "").trim().toLowerCase();
							const cleanFolderPath = (f.parent?.path || "").replace(/^\d+\.\s*/, "").trim().toLowerCase();
							if (!cleanFolderPath.startsWith(cleanActiveFolder)) return false;

						} else if (af.type === "eisenhower") {
							const urgencyField = this.settings.urgencyConfig?.fieldName || "urgency";
							const impactField = this.settings.impactConfig?.fieldName || "impact";
							const urgencyVal = Number(fm?.[urgencyField]) || 0;
							const impactVal = Number(fm?.[impactField]) || 0;
							const urgencyLevels = this.settings.urgencyConfig?.levels || [];
							const impactLevels = this.settings.impactConfig?.levels || [];
							const urgencyHigh = urgencyLevels.length > 0 ? urgencyVal >= (urgencyLevels[Math.floor(urgencyLevels.length / 2)]?.value ?? 3) : urgencyVal >= 3;
							const impactHigh = impactLevels.length > 0 ? impactVal >= (impactLevels[Math.floor(impactLevels.length / 2)]?.value ?? 3) : impactVal >= 3;

							if (af.value === "p1" && !(urgencyHigh && impactHigh)) return false;
							if (af.value === "p2" && !(impactHigh && !urgencyHigh)) return false;
							if (af.value === "p3" && !(urgencyHigh && !impactHigh)) return false;
							if (af.value === "p4" && !(!urgencyHigh && !impactHigh)) return false;

						} else if (af.type === "temperature") {
							const ageDays = (now - f.stat.mtime) / (24 * 60 * 60 * 1000);
							if (af.value === "hot" && ageDays >= 3) return false;
							if (af.value === "warm" && (ageDays < 3 || ageDays > 30)) return false;
							if (af.value === "cold" && ageDays <= 30) return false;

						} else if (af.type === "channel") {
							const chField = this.settings.channelFieldName || "channel";
							const chVal = fm?.[chField];
							if (!chVal) return false;
							const channels = Array.isArray(chVal) ? chVal.map(String) : [String(chVal)];
							if (!channels.some(c => c.toLowerCase() === af.value.toLowerCase())) return false;

						} else if (af.type === "publish") {
							const pubField = this.settings.publishFieldName || "publish";
							const pubVal = fm?.[pubField];
							if (!pubVal) return af.value === "later" ? true : false;
							const pubDate = new Date(String(pubVal)).getTime();
							if (isNaN(pubDate)) return false;
							const diffDays = (pubDate - now) / (24 * 60 * 60 * 1000);
							if (af.value === "today" && (diffDays < 0 || diffDays > 1)) return false;
							if (af.value === "3days" && (diffDays < 0 || diffDays > 3)) return false;
							if (af.value === "7days" && (diffDays < 0 || diffDays > 7)) return false;
							if (af.value === "2weeks" && (diffDays < 0 || diffDays > 14)) return false;
							if (af.value === "later" && diffDays <= 14) return false;

						} else if (af.type === "feeling") {
							const feelVal = fm?.feeling;
							if (!feelVal) return false;
							const feelings = Array.isArray(feelVal) ? feelVal.map(v => String(v).toLowerCase()) : [String(feelVal).toLowerCase()];
							if (!feelings.includes(af.value.toLowerCase())) return false;
						}
					}
					return true;
				});

				// Sort
				const dir = this.navigatorSortAsc ? 1 : -1;
				filteredFiles.sort((a, b) => {
					if (this.navigatorSortCol === 0) return 0; // retain default order
					const va = getValString(a, this.navigatorSortCol);
					const vb = getValString(b, this.navigatorSortCol);
					return dir * va.localeCompare(vb);
				});

				// Pagination
				const totalPages = Math.ceil(filteredFiles.length / this.navigatorPageSize) || 1;
				if (this.navigatorCurrentPage > totalPages) this.navigatorCurrentPage = totalPages;

				pageInfo.setText(`Page ${this.navigatorCurrentPage} of ${totalPages}`);

				const startIdx = (this.navigatorCurrentPage - 1) * this.navigatorPageSize;
				const displayFiles = filteredFiles.slice(startIdx, startIdx + this.navigatorPageSize);

				displayFiles.forEach((file, displayIdx) => {
					const rowIdx = startIdx + displayIdx + 1;
					const tr = tbody.createEl("tr");
					tr.style.borderBottom = "1px solid var(--background-modifier-border-hover)";

					const stripeBg = "rgba(128, 128, 128, 0.08)";

					if (this.navigatorStripedRows && displayIdx % 2 === 1) {
						tr.style.backgroundColor = stripeBg;
					}

					tr.onmouseenter = () => tr.style.backgroundColor = "var(--background-modifier-hover)";
					tr.onmouseleave = () => {
						tr.style.backgroundColor = (this.navigatorStripedRows && displayIdx % 2 === 1)
							? stripeBg
							: "transparent";
					};

					const cache = this.app.metadataCache.getFileCache(file);

					allColNames.forEach((colName, colIdx) => {
						if (!this.navigatorVisibleCols[colIdx]) return;

						const td = tr.createEl("td");
						td.style.padding = "6px 8px";
						td.style.color = "var(--text-normal)";
						const lowerCol = colName.toLowerCase();

						if (lowerCol === "#") {
							td.setText(String(rowIdx));
							td.style.color = "var(--text-faint)";
						} else if (lowerCol === "name") {
							const link = td.createEl("a", { text: file.basename });
							link.style.cursor = "pointer";
							link.onclick = (e) => { e.preventDefault(); this.app.workspace.getLeaf(false).openFile(file); this.close(); };
						} else if (lowerCol === "folder") {
							td.setText(file.parent?.path || "/");
							td.style.color = "var(--text-muted)";
						} else if (lowerCol === "created") {
							td.setText(new Date(file.stat.ctime).toISOString().split("T")[0] || "");
							td.style.color = "var(--text-faint)";
						} else if (lowerCol === "modified") {
							td.setText(new Date(file.stat.mtime).toISOString().split("T")[0] || "");
							td.style.color = "var(--text-faint)";
						} else if (lowerCol === "tags") {
							let tagsText = "";
							if (cache?.tags) tagsText = cache.tags.map(t => t.tag).join(", ");
							else if (cache?.frontmatter?.tags) {
								const fmTags = cache.frontmatter.tags;
								tagsText = Array.isArray(fmTags) ? fmTags.join(", ") : String(fmTags);
							}
							td.setText(tagsText || "-");
							td.style.fontSize = "0.85em";
							td.style.color = "var(--text-accent)";
						} else {
							// Frontmatter property
							let valText = "-";
							const readProp = (propValue: any) => {
								return Array.isArray(propValue) ? propValue.map(v => extractWikilinkName(String(v))).join(", ") : extractWikilinkName(String(propValue));
							};

							if (cache?.frontmatter && cache.frontmatter[lowerCol] !== undefined) {
								valText = readProp(cache.frontmatter[lowerCol]);
							} else if (cache?.frontmatter && cache.frontmatter[colName] !== undefined) {
								valText = readProp(cache.frontmatter[colName]);
							}
							td.setText(valText);
							td.style.fontSize = "0.85em";
							td.style.color = "var(--text-muted)";
						}
					});
				});

				if (displayFiles.length === 0) {
					const tr = tbody.createEl("tr");
					const td = tr.createEl("td", { text: "No notes found." });
					td.colSpan = allColNames.filter((_, i) => this.navigatorVisibleCols[i]).length;
					td.addClass("flow-dashboard-ui-50");
				}
			};

			// Re-bind stable triggers
			searchInput.oninput = (e) => {
				this.navigatorSearchQuery = (e.target as HTMLInputElement).value;
				this.navigatorCurrentPage = 1;
				triggerRenderRows();
			};

			prevBtn.onclick = () => {
				if (this.navigatorCurrentPage > 1) {
					this.navigatorCurrentPage--;
					triggerRenderRows();
				}
			};

			nextBtn.onclick = () => {
				this.navigatorCurrentPage++;
				triggerRenderRows();
			};

			triggerRenderRows();
		};

		triggerRenderTable();
	}
}
