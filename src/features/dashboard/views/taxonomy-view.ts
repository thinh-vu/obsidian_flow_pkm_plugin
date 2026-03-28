import { App, setIcon } from "obsidian";
import type * as echartsCore from "echarts/core";
import type { EChartsOption } from "echarts";
import { FlowPluginSettings, TagNode } from "../../../types";
import { VaultStats } from "../stats-collector";
import { detectBlueprintMissions } from "../../../core/blueprint-detect";
import { CHART_PALETTE, WARM_CHART_PALETTE, MISSION_STATUS } from "../../../brand-colors";

export class TaxonomyView {
	private chartInstances: echartsCore.EChartsType[] = [];

	constructor(
		private app: App,
		private settings: FlowPluginSettings,
		private container: HTMLElement,
		private echartsModule: typeof echartsCore
	) {}

	public destroy() {
		for (const chart of this.chartInstances) {
			chart.dispose();
		}
		this.chartInstances = [];
	}

	public resize() {
		for (const chart of this.chartInstances) {
			chart.resize();
		}
	}

	public render(stats: VaultStats) {
		this.destroy();
		this.container.empty();
		
		const isVi = this.settings.language === "vi";

		this.container.style.display = "flex";
		this.container.addClass("flow-dashboard-ui-17");

		const taxonomy = this.settings.tagTaxonomy || [];
		let missions = [...(this.settings.vaultMissions || [])];

		// Auto-detect Blueprint files as missions if not already registered
		missions = detectBlueprintMissions(this.app.vault, this.settings.folderMap, missions, this.settings.language);

		// ── Top: Sunburst Chart for Tag Hierarchy ──
		const hasTaxonomy = taxonomy.length > 0;
		const hasVaultTags = stats && Object.keys(stats.tagsCount).length > 0;

		if (hasTaxonomy || hasVaultTags) {
			const chartDiv = this.container.createDiv();
			chartDiv.addClass("flow-dashboard-ui-18");

			const chartInstance = this.echartsModule.init(chartDiv, "light");
			this.chartInstances.push(chartInstance);

			let sunburstData: any[];

			if (hasTaxonomy) {
				const convertToSunburst = (nodes: TagNode[]): any[] => {
					return nodes.map(node => ({
						name: node.name,
						value: node.children?.length > 0 ? undefined : 1,
						children: node.children?.length > 0 ? convertToSunburst(node.children) : undefined,
					}));
				};
				sunburstData = convertToSunburst(taxonomy);
			} else if (stats) {
				const tagTree: Record<string, any> = {};
				for (const [tag, count] of Object.entries(stats.tagsCount)) {
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
			const sunburstOption: EChartsOption = {
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
			const emptyTag = this.container.createDiv();
			emptyTag.addClass("flow-dashboard-ui-19");
			emptyTag.setText("No tags found in your vault. Add tags to your notes or register a tag hierarchy in Settings → FLOW → Taxonomy.");
		}

		// ── Middle: Properties by Dimension Chart ──
		const dimensions = this.settings.taxonomyDimensions || [];
		if (dimensions.length > 0 && stats) {
			const dimChartDiv = this.container.createDiv();
			dimChartDiv.addClass("flow-dashboard-ui-20");
			dimChartDiv.style.marginTop = "150px";

			const dimChart = this.echartsModule.init(dimChartDiv, "light");
			this.chartInstances.push(dimChart);

			const treemapData: any[] = [];
			const dimPalette = [...CHART_PALETTE];

			for (let di = 0; di < dimensions.length; di++) {
				const dim = dimensions[di];
				if (!dim) continue;
				const valueCounts: Record<string, number> = {};

				const propGroup = stats.propertiesGrouped[dim.id];
				if (propGroup) {
					for (const [rawKey, count] of Object.entries(propGroup)) {
						const subValues = rawKey.split(",").map(s => s.trim()).filter(Boolean);
						for (const sv of subValues) {
							valueCounts[sv] = (valueCounts[sv] || 0) + (count as number);
						}
					}
				}

				const children: any[] = [];
				const addedValues = new Set<string>();

				for (const val of dim.values) {
					const lcVal = val.toLowerCase();
					let count = valueCounts[val] || valueCounts[lcVal] || 0;
					for (const [k, v] of Object.entries(valueCounts)) {
						if (k.toLowerCase() === lcVal && k !== val && k !== lcVal) {
							count += v;
						}
					}
					children.push({ name: val, value: count || 1 });
					addedValues.add(lcVal);
				}

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
				const dimOption: EChartsOption = {
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
		const missionBoard = this.container.createDiv();
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

				const statusColor = m.status === "active" ? MISSION_STATUS.active : m.status === "paused" ? MISSION_STATUS.paused : MISSION_STATUS.done;
				card.style.borderLeft = `4px solid ${statusColor}`;

				const statusIcon = m.status === "active" ? "🟢" : m.status === "paused" ? "🟡" : "✅";
				const header = card.createDiv();
				header.addClass("flow-dashboard-ui-24");

				header.createSpan({ text: statusIcon });
				const nameEl = header.createSpan({ text: m.name });
				nameEl.style.fontWeight = "600";
				nameEl.style.fontSize = "1.05em";

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

						if (stats?.tagsCount) {
							const count = stats.tagsCount[tag] || 0;
							if (count > 0) {
								tagChip.setText(`#${tag} (${count})`);
							}
						}
					}
				}
			}
		}
	}
}
