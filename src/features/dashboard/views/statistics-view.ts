import { App, setIcon } from "obsidian";
import type * as echartsCore from "echarts/core";
import type { EChartsOption } from "echarts";
import { FlowPluginSettings } from "../../../types";
import { VaultStats, extractWikilinkName } from "../stats-collector";
import { CHART_PALETTE, WARM_CHART_PALETTE, HEATMAP_RAMP, ACTIVITY_COLOR, ACTIVITY_AREA, ACTIVITY_AVGLINE, FEELING_PALETTE, BRAND } from "../../../brand-colors";

type DashboardTab = "properties" | "tags" | "activity" | "mood";

export class StatisticsView {
	private chartInstanceLeft: echartsCore.EChartsType | null = null;
	private chartInstanceRight: echartsCore.EChartsType | null = null;
	private chartInstanceSingle: echartsCore.EChartsType | null = null;
	private chartInstances: echartsCore.EChartsType[] = [];

	private selectedPropertyCategory: string | null = null;
	private excludedProperties: Set<string> = new Set(["created", "summary", "publish_url", "mindmap-plugin", "min-impact", "created-after"]);

	constructor(
		private app: App,
		private settings: FlowPluginSettings,
		private container: HTMLElement,
		private echartsModule: typeof echartsCore
	) { }

	public destroy() {
		for (const chart of this.chartInstances) {
			chart.dispose();
		}
		this.chartInstances = [];
		this.chartInstanceSingle = null;
		this.chartInstanceLeft = null;
		this.chartInstanceRight = null;
	}

	public resize() {
		for (const chart of this.chartInstances) {
			chart.resize();
		}
	}

	public render(stats: VaultStats, activeTab: DashboardTab) {
		this.destroy();
		this.container.empty();

		const theme = "light";

		if (activeTab === "properties") {
			const configBar = this.container.createDiv();
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
				let popup = this.container.querySelector(".flow-prop-filter-popup") as HTMLElement;
				if (popup) { popup.remove(); return; }

				popup = this.container.createDiv("flow-prop-filter-popup");
				popup.addClass("flow-dashboard-ui-9");

				popup.createEl("div", { text: isVi ? "Loại trừ thuộc tính:" : "Exclude Properties:" }).style.fontWeight = "600";

				const allKeys = Object.keys(stats.propertiesGrouped).sort();
				for (const key of allKeys) {
					const row = popup.createDiv();
					row.addClass("flow-dashboard-ui-10");

					const cb = row.createEl("input", { type: "checkbox" }) as HTMLInputElement;
					cb.checked = !this.excludedProperties.has(key);
					row.createEl("label", { text: key });

					cb.onchange = () => {
						if (cb.checked) this.excludedProperties.delete(key);
						else this.excludedProperties.add(key);
						this.render(stats, activeTab);
					};
				}

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

			this.container.style.position = "relative";

			const leftDiv = this.container.createDiv();
			const isMobileView = window.innerWidth <= 768;
			if (isMobileView) {
				this.container.style.flexDirection = "column";
				leftDiv.addClass("flow-dashboard-ui-11");
			} else {
				this.container.style.flexDirection = "row";
				leftDiv.addClass("flow-dashboard-ui-12");
			}

			const rightDiv = this.container.createDiv();
			if (isMobileView) rightDiv.addClass("flow-dashboard-ui-13");
			else rightDiv.addClass("flow-dashboard-ui-14");

			this.chartInstanceLeft = this.echartsModule.init(leftDiv, theme);
			this.chartInstanceRight = this.echartsModule.init(rightDiv, theme);
			if (this.chartInstanceLeft) this.chartInstances.push(this.chartInstanceLeft);
			if (this.chartInstanceRight) this.chartInstances.push(this.chartInstanceRight);

			this.renderPropertiesInteractive(stats);

		} else if (activeTab === "activity") {
			this.container.style.position = "relative";
			this.container.style.flexDirection = "column";

			const topDiv = this.container.createDiv();
			topDiv.addClass("flow-dashboard-ui-15");

			const bottomDiv = this.container.createDiv();
			bottomDiv.addClass("flow-dashboard-ui-16");

			this.chartInstanceLeft = this.echartsModule.init(topDiv, theme);
			this.chartInstanceRight = this.echartsModule.init(bottomDiv, theme);
			if (this.chartInstanceLeft) this.chartInstances.push(this.chartInstanceLeft);
			if (this.chartInstanceRight) this.chartInstances.push(this.chartInstanceRight);

			const heatmapOption = this.getActivityChartOption(stats);
			if (heatmapOption.calendar) {
				const numYears = Array.isArray(heatmapOption.calendar) ? heatmapOption.calendar.length : 1;
				topDiv.style.minHeight = (numYears * 180 + 140) + "px";
			}
			heatmapOption.backgroundColor = "transparent";
			this.chartInstanceLeft?.setOption(heatmapOption, true);

			const dowOption = this.getActivityByDayOfWeekOption(stats);
			dowOption.backgroundColor = "transparent";
			this.chartInstanceRight?.setOption(dowOption, true);

			setTimeout(() => {
				this.chartInstanceLeft?.resize();
				this.chartInstanceRight?.resize();
			}, 100);

		} else {
			const singleDiv = this.container.createDiv();
			singleDiv.style.width = "100%";
			singleDiv.style.height = "100%";

			this.chartInstanceSingle = this.echartsModule.init(singleDiv, theme);
			if (this.chartInstanceSingle) this.chartInstances.push(this.chartInstanceSingle);

			let option: EChartsOption = {};
			switch (activeTab) {
				case "tags": option = this.getTagsChartOption(stats); break;
				case "mood": option = this.getMoodChartOption(stats); break;
			}
			option.backgroundColor = "transparent";
			this.chartInstanceSingle?.setOption(option, true);
		}
	}

	private renderPropertiesInteractive(stats: VaultStats) {
		if (!this.chartInstanceLeft || !this.chartInstanceRight) return;

		const propKeys = Object.keys(stats.propertiesGrouped)
			.filter(k => !this.excludedProperties.has(k));

		const treemapData = propKeys.map(key => {
			const group = stats.propertiesGrouped[key];
			const totalCount = Object.values(group || {}).reduce((a, b) => a + b, 0);
			return { name: key, value: totalCount };
		}).sort((a, b) => b.value - a.value).slice(0, 50);

		const leftOption: EChartsOption = {
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

		if (!this.selectedPropertyCategory) {
			const hasProgress = treemapData.find(d => d.name === "progress");
			this.selectedPropertyCategory = hasProgress ? "progress" : (treemapData[0]?.name || null);
		}

		this.chartInstanceLeft.on("click", (params: any) => {
			if (params.name) {
				this.selectedPropertyCategory = params.name;
				this.updatePropertiesDetailChart(stats);
			}
		});

		this.updatePropertiesDetailChart(stats);
	}

	private updatePropertiesDetailChart(stats: VaultStats) {
		if (!this.chartInstanceRight || !this.selectedPropertyCategory) return;
		const isVi = this.settings.language === "vi";

		const group = stats.propertiesGrouped[this.selectedPropertyCategory] || {};

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

		const rightOption: EChartsOption = {
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

	private getTagsChartOption(stats: VaultStats): EChartsOption {
		const isVi = this.settings.language === "vi";

		const data = Object.entries(stats.tagsCount)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 100)
			.map(([name, value]) => ({ name, value }));

		if (data.length === 0) return { title: { text: "No tags found", left: "center" } };

		return {
			title: { text: isVi ? "Top 100 thẻ" : "Top 100 Tags", left: "center", top: 10 },
			tooltip: { formatter: "{b}: {c}" },
			series: [{
				type: "treemap",
				data: data,
				roam: false,
				nodeClick: false,
				breadcrumb: { show: false },
				label: { show: true, formatter: "{b}\n({c})" },
				itemStyle: { borderColor: "#fff" }
			}]
		};
	}

	private getActivityChartOption(stats: VaultStats): EChartsOption {
		const isVi = this.settings.language === "vi";
		const timestamps = stats.activityTimestamps;

		const dailyCounts: Record<string, number> = {};
		for (const ts of timestamps) {
			const d = new Date(ts);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
			dailyCounts[key] = (dailyCounts[key] || 0) + 1;
		}

		const data = Object.entries(dailyCounts).map(([date, count]) => [date, count]);
		if (data.length === 0) return { title: { text: "No activity data", left: "center" } };

		const allDates = data.map(d => d[0] as string).sort();
		const startDate = allDates[0]!;
		const endDate = allDates[allDates.length - 1]!;

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
				itemStyle: { borderWidth: 2, borderColor: "#fff", color: "#f0f7f7" },
				splitLine: { show: false },
				yearLabel: { show: true, margin: 30, fontSize: 14 },
				dayLabel: { firstDay: 1, nameMap: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], fontSize: 10 },
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
			tooltip: { formatter: (params: any) => `${params.value[0]}: <b>${params.value[1]}</b> note(s)` },
			visualMap: {
				min: 0,
				max: maxVal,
				calculable: true,
				orient: "horizontal",
				left: "center",
				top: calendars.length * 160 + 50,
				inRange: { color: [...HEATMAP_RAMP] },
				textStyle: { fontSize: 11 },
			},
			calendar: calendars.length === 1 ? calendars[0] : calendars,
			series: series,
		};
	}

	private getActivityByDayOfWeekOption(stats: VaultStats): EChartsOption {
		const isVi = this.settings.language === "vi";
		const timestamps = stats.activityTimestamps;
		if (timestamps.length === 0) return { title: { text: "No activity data", left: "center" } };

		const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
		const dayCounts = [0, 0, 0, 0, 0, 0, 0];

		for (const ts of timestamps) {
			const d = new Date(ts);
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
			xAxis: { type: "category", data: dayNames, axisLabel: { fontSize: 12 } },
			yAxis: { type: "value", name: "Events", nameTextStyle: { fontSize: 11 } },
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

	private getMoodChartOption(stats: VaultStats): EChartsOption {
		const isVi = this.settings.language === "vi";

		const numericData: [string, number][] = Object.entries(stats.moodByDate);
		const feelingByDate = stats.feelingByDate;
		const feelingDates = Object.keys(feelingByDate).sort();

		const hasNumeric = numericData.length > 0;
		const hasFeelings = feelingDates.length > 0;

		const monthNames = isVi ? ["Thg 1", "Thg 2", "Thg 3", "Thg 4", "Thg 5", "Thg 6", "Thg 7", "Thg 8", "Thg 9", "Thg 10", "Thg 11", "Thg 12"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		const formatDate = (dateStr: string) => {
			const d = new Date(dateStr);
			const month = monthNames[d.getMonth()] || "";
			return `${month} ${d.getDate()}`;
		};

		if (!hasNumeric && !hasFeelings) {
			return {
				title: { text: isVi ? "Theo dõi tâm trạng & cảm xúc" : "Mood & Feeling Tracking", subtext: isVi ? "Không tìm thấy dữ liệu tâm trạng/cảm xúc.\nThêm 'mood: 7' (số) hoặc 'feeling: happy' vào ghi chú để bắt đầu." : "No mood/feeling data found.\nAdd 'mood: excited' or 'feeling: happy' to your notes.", left: "center", top: "center" }
			};
		}

		if (hasFeelings) {
			const allFeelings = Object.keys(stats.feelingCounts).sort();
			const feelingColors = [...FEELING_PALETTE];

			const series: any[] = allFeelings.map((feeling, idx) => {
				const data: any[] = [];
				for (const date of feelingDates) {
					const fArr = feelingByDate[date] || [];
					if (fArr.includes(feeling)) {
						data.push({ value: [date, idx], symbolSize: 16 });
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
					axisLabel: { formatter: (val: string) => formatDate(val), rotate: 0, fontSize: 11 },
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
				dataZoom: [{ type: "inside", xAxisIndex: 0 }, { type: "slider", xAxisIndex: 0, bottom: 10, height: 20 }],
				series,
			};
		}

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
			xAxis: { type: "category", data: numericData.map(d => d[0]), axisLabel: { formatter: (val: string) => formatDate(val), fontSize: 11 } },
			yAxis: { type: "value", min: 1, max: 10, name: "Mood Score", nameTextStyle: { fontSize: 11 } },
			dataZoom: [{ type: "inside", xAxisIndex: 0 }, { type: "slider", xAxisIndex: 0, bottom: 10, height: 20 }],
			series: [{
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
			}]
		};
	}
}
