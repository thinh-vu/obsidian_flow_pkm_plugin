import { App, setIcon } from "obsidian";
import { VaultStats } from "../stats-collector";
import { FlowPluginSettings, FlowRole } from "../../../types";
import { computeAllHealthScores, StageHealthResult, CriterionResult } from "../health-scorer";
import { STAGE_COLORS, HEALTH_COLORS, BRAND } from "../../../brand-colors";

// ── i18n ─────────────────────────────────────────────────────────────────

const LABELS = {
	vi: {
		blueprint: "Bản thiết kế", blueprintBadge: "Trung tâm",
		blueprintDesc: "Lĩnh vực và sứ mệnh cốt lõi.",
		activeMissions: "Sứ mệnh",
		capture: "Thu thập", captureDesc: "Nắm bắt thông tin & ý tưởng mới.",
		totalNotes: "Tổng ghi chú", linked: "Đã liên kết", rawNotes: "Ghi chú thô",
		track: "Theo dõi", trackDesc: "Nhật ký, thời gian & nhiệm vụ.",
		totalLogs: "Nhật ký", taskDone: "Hoàn thành", taskPending: "Tồn đọng", completion: "hoàn thành",
		forge: "Rèn giũa", forgeDesc: "Phát triển ý tưởng thành bản thảo.",
		totalDrafts: "Bản nháp", wip: "Đang xử lý", heatLabel: "Nhiệt độ:",
		exhibit: "Trưng bày", exhibitDesc: "Nội dung chắt lọc sẵn sàng công bố.",
		totalContent: "Nội dung", topTags: "Top:",
		vault: "Kho lưu trữ", vaultDesc: "Lưu trữ dài hạn & dự phòng.",
		totalFiles: "Tổng file", size: "Dung lượng", orphan: "Ghi chú mồ côi", wasted: "File lớn",
		healthScore: "Sức khoẻ", overallHealth: "Sức khoẻ tổng thể Vault",
		levelBasic: "Cơ bản", levelGood: "Khá", levelAdvanced: "Nâng cao",
		clickForDetail: "Nhấn vào điểm sức khoẻ của từng card để xem chi tiết.",
	},
	en: {
		blueprint: "Blueprint", blueprintBadge: "Core Focus",
		blueprintDesc: "Core domains, and missions.",
		activeMissions: "Missions",
		capture: "Capture", captureDesc: "Catch ideas & info from the world.",
		totalNotes: "Total Notes", linked: "Linked", rawNotes: "Raw Notes",
		track: "Track", trackDesc: "Daily logs, tasks & time tracking.",
		totalLogs: "Log Notes", taskDone: "Completed", taskPending: "Pending", completion: "completed",
		forge: "Forge", forgeDesc: "Refine ideas into polished drafts.",
		totalDrafts: "Drafts", wip: "In Progress", heatLabel: "Temperature:",
		exhibit: "Exhibit", exhibitDesc: "Content ready for publishing.",
		totalContent: "Assets", topTags: "Top:",
		vault: "Vault", vaultDesc: "Long-term cold storage.",
		totalFiles: "Files", size: "Size", orphan: "Orphaned", wasted: "Wasted",
		healthScore: "Health", overallHealth: "Overall Vault Health",
		levelBasic: "Basic", levelGood: "Good", levelAdvanced: "Advanced",
		clickForDetail: "Click a card's health score for details.",
	}
};

function getLabels(settings: FlowPluginSettings) {
	return LABELS[settings.language === "en" ? "en" : "vi"];
}

/**
 * FLOW Progression — Branching layout with health summary + detail panel:
 *
 * ┌──────── Health Summary Zone ────────┐
 * │ Overall: 72  [detail panel here]    │
 * └─────────────────────────────────────┘
 * Desktop: Blueprint → [Capture/Track] → Forge → [Exhibit/Vault]
 * Mobile: vertical stack
 */
export function renderFlowProgressionTab(
	container: HTMLElement,
	stats: VaultStats,
	app: App,
	settings: FlowPluginSettings
) {
	container.empty();
	container.addClass("flow-progression-tab");
	container.style.flexDirection = "column"; // Fix: force horizontal row for summary vs grid
	container.style.overflowY = "auto";
	// CSS is now in styles.css (fp-* classes)
	const L = getLabels(settings);

	// Compute health scores
	const healthScores = computeAllHealthScores(stats, settings);

	// Compute overall vault score (weighted average)
	const stageKeys = Object.keys(healthScores);
	const overallScore = stageKeys.length > 0
		? Math.round(stageKeys.reduce((sum, k) => sum + (healthScores[k]?.totalScore || 0), 0) / stageKeys.length)
		: 0;
	const overallLevel = overallScore >= 71 ? "advanced" : overallScore >= 41 ? "good" : "basic";
	const overallColor = HEALTH_COLORS[overallLevel];

	const stageOrder = [FlowRole.BLUEPRINT, FlowRole.CAPTURE, FlowRole.TRACK, FlowRole.FORGE, FlowRole.EXHIBIT, FlowRole.VAULT];
	const stageNames: Record<string, string> = {
		[FlowRole.BLUEPRINT]: L.blueprint, [FlowRole.CAPTURE]: L.capture,
		[FlowRole.TRACK]: L.track, [FlowRole.FORGE]: L.forge,
		[FlowRole.EXHIBIT]: L.exhibit, [FlowRole.VAULT]: L.vault,
	};

	const naming = stats.namingConventions;
	const totalNamed = naming.zettelkasten + naming.natural + naming.kebab + naming.snake + naming.camel + naming.pascal + naming.other;
	const maxStyleCount = Math.max(naming.zettelkasten, naming.natural, naming.kebab, naming.snake, naming.camel, naming.pascal);
	const consistencyRate = totalNamed > 0 ? maxStyleCount / totalNamed : 0;

	let namingPts = 0;
	if (consistencyRate > 0.8) namingPts = 15;
	else if (consistencyRate > 0.5) namingPts = 10;
	else namingPts = 5;
	if (totalNamed > 0 && naming.zettelkasten > totalNamed * 0.1) namingPts += 5;

	const isVi = L.healthScore === "Sức khoẻ";
	let evaluationText = "";

	if (overallScore >= 71) {
		if (namingPts >= 18) evaluationText = isVi ? "Rất tuyệt! Hệ thống số định danh (Zettel/JD) đang được ứng dụng tốt. Hãy duy trì nhịp điệu này." : "Excellent! Your Zettelkasten/JD naming system is well applied. Keep it up.";
		else evaluationText = isVi ? "Vault được tổ chức mạch lạc. Dung lượng và cấu trúc thư mục đang ở trạng thái tối ưu." : "The Vault is well-organized. Size and folder structure are highly optimized.";
	} else if (overallScore >= 41) {
		if (consistencyRate < 0.5) evaluationText = isVi ? "Cấu trúc khá ổn, nhưng cách đặt tên file chưa nhất quán. Hãy chọn 1 quy chuẩn (VD: luôn dùng khoảng trắng) để dễ tìm kiếm." : "Structure is fair, but file naming lacks consistency. Adopt a single convention (e.g., spaces) for clarity.";
		else evaluationText = isVi ? "Vault đang hoạt động tốt. Có thể cải thiện bằng cách giảm bớt các thư mục quá sâu hoặc dọn dẹp tệp mồ côi." : "The Vault is functioning well. Improve it by reducing overly deep folders or cleaning orphaned files.";
	} else {
		const totalSubfolders = Object.values(stats.roleStats).reduce((acc, rs) => acc + (rs?.subfolderCount || 0), 0);
		if (totalSubfolders === 0) evaluationText = isVi ? "Vault đang thiếu cấu trúc phân tầng cơ bản. Hãy cân nhắc gom nhóm ghi chú vào thư mục theo chủ đề." : "Vault lacks basic hierarchy. Consider grouping notes into thematic folders.";
		else evaluationText = isVi ? "Sức khỏe ở mức cơ bản. Hãy ưu tiên xử lý file kích thước lớn hoặc dọn dẹp cấu trúc thư mục." : "Health is basic. Prioritize handling large files and cleaning up folder structure.";
	}

	const overallHealthRes: StageHealthResult = {
		totalScore: overallScore,
		level: overallLevel as "basic" | "good" | "advanced",
		evaluationText: evaluationText,
		criteria: stageOrder.map(role => {
			const hs = healthScores[role];
			return {
				name: stageNames[role] || role,
				nameVi: stageNames[role] || role,
				score: hs?.totalScore || 0,
				maxScore: 100,
				level: hs?.level || "basic"
			};
		})
	};

	// ── Health Summary Zone ─────────────────────────────────────────
	const summaryZone = container.createDiv("fp-summary-zone");
	const summaryHeader = summaryZone.createDiv("fp-summary-header");

	// Overall score ring
	const overallRing = summaryHeader.createDiv("fp-overall-ring");
	overallRing.style.setProperty("--ring-pct", String(overallScore));
	overallRing.style.setProperty("--ring-color", overallColor);
	overallRing.createEl("span", { text: `${overallScore}`, cls: "fp-ring-value" });

	// Overall label
	const overallInfo = summaryHeader.createDiv("fp-overall-info");
	overallInfo.createEl("span", { text: L.overallHealth, cls: "fp-overall-title" });

	// Remove old mini stage bars, insert textual evaluation directly here.
	const evalTextWrap = summaryHeader.createDiv("fp-summary-eval");
	evalTextWrap.style.cssText = "flex: 1; min-width: 250px; font-size: 0.85em; color: var(--text-normal); line-height: 1.4;";
	const evalP = evalTextWrap.createEl("p", { text: overallHealthRes.evaluationText });
	evalP.style.margin = "0";

	// Detail panel (populated with Vault Health by default, later overridden on card ring click)
	const detailPanel = summaryZone.createDiv("fp-detail-panel");
	detailPanel.style.display = "block";

	// ── Card Grid ───────────────────────────────────────────────────
	const grid = container.createDiv("fp-grid");

	const showDetail = (role: string | null, health: StageHealthResult) => {
		detailPanel.empty();
		detailPanel.style.display = "flex";
		detailPanel.style.flexDirection = "column";
		detailPanel.style.gap = "8px";

		if (role) {
			evalTextWrap.style.display = "none";
		} else {
			evalTextWrap.style.display = "block";
		}

		const isVi = L.healthScore === "Sức khoẻ";
		const stageName = role ? (stageNames[role] || role) : L.vault;
		const stageColor = role ? (STAGE_COLORS[role] || BRAND.gray) : overallColor;

		if (role) {
			const header = detailPanel.createDiv("fp-dp-header");
			header.createEl("span", {
				text: `${stageName} — ${health.totalScore}/100`,
				cls: "fp-dp-title"
			});
			header.style.borderLeft = `4px solid ${stageColor}`;

			const closeBtn = header.createEl("span", { text: "✕", cls: "fp-dp-close" });
			closeBtn.onclick = () => { showDetail(null, overallHealthRes); };
		}

		if (health.evaluationText && role !== null) {
			const evalEl = detailPanel.createDiv("fp-dp-evaluation");
			const p = evalEl.createEl("p", { text: health.evaluationText });
			p.style.margin = "0";
			if (!role) {
				evalEl.style.fontSize = "0.95em";
				evalEl.style.color = "var(--text-normal)";
				evalEl.style.lineHeight = "1.5";
				evalEl.style.paddingBottom = "8px";
			} else {
				evalEl.style.fontSize = "0.85em";
				evalEl.style.color = "var(--text-muted)";
				evalEl.style.paddingBottom = "4px";
			}
		}

		const criteriaGrid = detailPanel.createDiv("fp-dp-criteria");
		for (const c of health.criteria) {
			const row = criteriaGrid.createDiv("fp-dp-row");
			const label = isVi ? c.nameVi : c.name;
			const lvlLabel = c.level === "advanced" ? L.levelAdvanced
				: c.level === "good" ? L.levelGood : L.levelBasic;
			const lvlColor = HEALTH_COLORS[c.level];

			row.createSpan({ text: label, cls: "fp-dp-label" });
			// Progress bar
			const barWrap = row.createDiv("fp-dp-bar-wrap");
			const barFill = barWrap.createDiv("fp-dp-bar-fill");
			barFill.style.width = `${(c.score / c.maxScore) * 100}%`;
			barFill.style.backgroundColor = lvlColor;
			row.createSpan({ text: `${c.score}/${c.maxScore}`, cls: "fp-dp-score" });
			const lvlBadge = row.createSpan({ text: lvlLabel, cls: "fp-dp-badge" });
			lvlBadge.style.backgroundColor = lvlColor + "20";
			lvlBadge.style.color = lvlColor;
		}
	};

	// ── Col 1: Blueprint ────────────────────────────────────────────
	const col1 = grid.createDiv("fp-col fp-col-single");
	renderCard(col1, "fp-blueprint", "compass", L.blueprint, null, L.blueprintDesc,
		healthScores[FlowRole.BLUEPRINT], FlowRole.BLUEPRINT, L, showDetail, (body) => {
			const rs = stats.roleStats[FlowRole.BLUEPRINT];
			const hero = body.createDiv("fp-metric-hero");
			hero.createEl("span", { text: String(rs?.noteCount || 0), cls: "fp-hero-number" });
			hero.createEl("span", { text: L.activeMissions, cls: "fp-hero-label" });

			const top5 = rs?.topLinkedFiles || [];
			if (top5.length > 0) {
				const list = body.createDiv();
				list.style.marginTop = "12px";
				const header = list.createDiv();
				header.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 0.72em; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dashed var(--background-modifier-border);";

				const leftH = header.createSpan();
				leftH.style.cssText = "display: flex; align-items: center; gap: 4px;";
				const hIcon = leftH.createSpan();
				setIcon(hIcon, "link");
				(hIcon.querySelector("svg") as SVGElement)?.setAttribute("width", "12");
				(hIcon.querySelector("svg") as SVGElement)?.setAttribute("height", "12");
				leftH.createSpan({ text: L.healthScore === "Sức khoẻ" ? "Sứ Mệnh Nổi Bật" : "Top Missions" });

				const rightH = header.createSpan({ text: "Links" });
				rightH.style.cssText = "flex-shrink: 0; text-align: right;";

				for (const file of top5) {
					const row = list.createDiv();
					row.style.cssText = "display:flex; justify-content:space-between; align-items:center; font-size: 0.82em; padding: 3px 0; gap: 8px; width: 100%;";

					const nameEl = row.createSpan({ text: file.name.replace(/\.md$/i, "") });
					nameEl.style.cssText = "white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-muted); flex: 1; min-width: 0;";

					const badge = row.createSpan({ text: String(file.linkCount) });
					badge.style.cssText = "font-weight: bold; color: var(--text-normal); font-size: 0.9em; flex-shrink: 0; min-width: 24px; text-align: right;";
				}
			}
		});

	setArrowSvg(grid.createDiv("fp-col-arrow"), arrowSplitH());

	// ── Col 2: Capture + Track ──────────────────────────────────────
	const col2 = grid.createDiv("fp-col fp-col-pair");
	renderCard(col2, "fp-capture", "inbox", L.capture, null, L.captureDesc,
		healthScores[FlowRole.CAPTURE], FlowRole.CAPTURE, L, showDetail, (body) => {
			const rs = stats.roleStats[FlowRole.CAPTURE];
			const total = rs?.noteCount || 0;
			const linked = rs?.captureHasWikilink || 0;
			const pct = total > 0 ? Math.round((linked / total) * 100) : 0;
			addMetric(body, "file-text", L.totalNotes, total);
			addMetric(body, "link", L.linked, `${linked} (${pct}%)`);
			addProgressBar(body, pct, STAGE_COLORS.capture || BRAND.orange);
			addMetric(body, "file", L.rawNotes, rs?.captureRawNotes || 0);
		});
	renderCard(col2, "fp-track", "calendar", L.track, null, L.trackDesc,
		healthScores[FlowRole.TRACK], FlowRole.TRACK, L, showDetail, (body) => {
			const rs = stats.roleStats[FlowRole.TRACK];
			const done = rs?.trackTasksCompleted || 0;
			const pending = rs?.trackTasksPending || 0;
			const taskT = done + pending;
			const pct = taskT > 0 ? Math.round((done / taskT) * 100) : 0;
			addMetric(body, "book-open", L.totalLogs, rs?.noteCount || 0);
			addMetric(body, "check-circle", L.taskDone, done);
			addMetric(body, "clock", L.taskPending, pending);
			if (taskT > 0) {
				addProgressBar(body, pct, STAGE_COLORS.track || BRAND.aqua);
				body.createEl("span", { text: `${pct}% ${L.completion}`, cls: "fp-progress-label" });
			}
		});

	setArrowSvg(grid.createDiv("fp-col-arrow"), arrowMergeH());

	// ── Col 3: Forge ────────────────────────────────────────────────
	const col3 = grid.createDiv("fp-col fp-col-single");
	renderCard(col3, "fp-forge", "hammer", L.forge, null, L.forgeDesc,
		healthScores[FlowRole.FORGE], FlowRole.FORGE, L, showDetail, (body) => {
			const rs = stats.roleStats[FlowRole.FORGE];
			addMetric(body, "layers", L.totalDrafts, rs?.noteCount || 0);
			addMetric(body, "wrench", L.wip, rs?.forgeWipCount || 0);
			if (rs?.forgeHeatmap && Object.keys(rs.forgeHeatmap).length > 0) {
				const hm = body.createDiv("fp-heatmap");
				hm.createEl("span", { text: L.heatLabel, cls: "fp-heat-label" });
				const chips = hm.createDiv("fp-heat-chips");
				for (const [name, temp] of Object.entries(rs.forgeHeatmap)) {
					let shortName = name.replace(/FLOW system/gi, "").trim();
					if (shortName.startsWith("- ")) shortName = shortName.substring(2).trim();
					if (!shortName) shortName = "FLOW System";
					if (shortName.length > 15) shortName = shortName.substring(0, 13) + "...";

					const chip = chips.createEl("span", { text: shortName, cls: `fp-chip fp-chip-${temp}` });
					chip.title = name;
					const icoEl = chip.createSpan({ cls: "fp-chip-icon" });
					if (temp === "hot") setIcon(icoEl, "flame");
					else if (temp === "warm") setIcon(icoEl, "sun");
					else setIcon(icoEl, "snowflake");
					chip.prepend(icoEl);
				}
			}
		});

	setArrowSvg(grid.createDiv("fp-col-arrow"), arrowSplitH(true));

	// ── Col 4: Exhibit + Vault ──────────────────────────────────────
	const col4 = grid.createDiv("fp-col fp-col-pair");
	renderCard(col4, "fp-exhibit", "library", L.exhibit, null, L.exhibitDesc,
		healthScores[FlowRole.EXHIBIT], FlowRole.EXHIBIT, L, showDetail, (body) => {
			const rs = stats.roleStats[FlowRole.EXHIBIT];
			addMetric(body, "archive", L.totalContent, rs?.noteCount || 0);
			if (rs?.tagsCount) {
				const top = Object.entries(rs.tagsCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
				if (top.length > 0) {
					const row = body.createDiv("fp-tags-row");
					const tagIcon = row.createSpan({ cls: "fp-tag-icon" });
					setIcon(tagIcon, "tag");
					row.createSpan({ text: L.topTags, cls: "fp-tag-label" });
					for (const [tag, c] of top) row.createEl("span", { text: `#${tag} (${c})`, cls: "fp-tag-pill" });
				}
			}
		});
	renderCard(col4, "fp-vault", "hard-drive", L.vault, null, L.vaultDesc,
		healthScores[FlowRole.VAULT], FlowRole.VAULT, L, showDetail, (body) => {
			const sizeMB = (stats.vaultTotalSize / (1024 * 1024)).toFixed(1);
			const orphanMB = (stats.orphanedAttachmentsSize / (1024 * 1024)).toFixed(1);
			addMetric(body, "folder", L.totalFiles, stats.vaultTotalFiles);
			addMetric(body, "database", L.size, `${sizeMB} MB`);
			addMetric(body, "ghost", L.orphan, stats.orphanedAttachmentsCount);
			if (stats.orphanedAttachmentsSize > 0) addMetric(body, "trash-2", L.wasted, `${orphanMB} MB`);
		});

	// By default, display the overarching evaluation and criteria breakdown without clicking
	showDetail(null, overallHealthRes);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function renderCard(
	parent: HTMLElement, cls: string, icon: string, title: string,
	badge: string | null, desc: string,
	health: StageHealthResult | undefined,
	role: string,
	L: typeof LABELS["vi"],
	showDetail: (role: string, health: StageHealthResult) => void,
	renderBody: (body: HTMLElement) => void
) {
	const stageColor = STAGE_COLORS[role] || BRAND.gray;
	const card = parent.createDiv(`fp-card ${cls}`);
	card.style.setProperty("--card-accent", stageColor);

	// Header row
	const header = card.createDiv("fp-card-header");

	const iconEl = header.createSpan("fp-card-icon");
	setIcon(iconEl, icon);
	header.createEl("h3", { text: title, cls: "fp-card-title" });
	if (badge) {
		const badgeEl = header.createSpan({ cls: "fp-card-badge" });
		const badgeIcon = badgeEl.createSpan({ cls: "fp-badge-icon" });
		setIcon(badgeIcon, "target");
		badgeEl.createSpan({ text: badge });
	}

	// Health score ring
	if (health) {
		const ring = header.createDiv("fp-health-ring");
		const pct = Math.round(health.totalScore);
		const color = HEALTH_COLORS[health.level];
		ring.style.setProperty("--ring-pct", String(pct));
		ring.style.setProperty("--ring-color", color);
		ring.createEl("span", { text: `${pct}`, cls: "fp-ring-value" });
		ring.title = `${L.healthScore}: ${pct}%`;

		// Click → show detail in summary zone
		ring.addEventListener("click", (e) => {
			e.stopPropagation();
			showDetail(role, health);
		});
	}

	// Description + Body
	card.createEl("p", { text: desc, cls: "fp-card-desc" });
	const body = card.createDiv("fp-card-body");
	renderBody(body);
}

function addMetric(p: HTMLElement, iconName: string, label: string, value: string | number) {
	const row = p.createDiv("fp-metric-row");
	const labelSpan = row.createEl("span", { cls: "fp-metric-label" });
	const ico = labelSpan.createSpan({ cls: "fp-metric-icon" });
	setIcon(ico, iconName);
	labelSpan.createSpan({ text: ` ${label}` });
	row.createEl("span", { text: String(value), cls: "fp-metric-value" });
}

function addProgressBar(p: HTMLElement, pct: number, color: string) {
	const bar = p.createDiv("fp-progress-bar");
	const fill = bar.createDiv("fp-progress-fill");
	fill.style.width = `${Math.min(pct, 100)}%`;
	fill.style.background = color;
}

function arrowSplitH(dashedBottom = false) {
	return `
	<svg class="fp-svg-h" viewBox="0 0 40 80">
		<path d="M2,40 C20,40 20,15 38,15" stroke="currentColor" fill="none" stroke-width="2" opacity="0.35"/>
		<path d="M2,40 C20,40 20,65 38,65" stroke="currentColor" fill="none" stroke-width="2" ${dashedBottom ? 'stroke-dasharray="4,3"' : ""} opacity="0.35"/>
		<polygon points="35,11 40,15 35,19" fill="currentColor" opacity="0.35"/>
		<polygon points="35,61 40,65 35,69" fill="currentColor" opacity="0.35"/>
	</svg>
	<svg class="fp-svg-v" viewBox="0 0 24 32">
		<path d="M12,2 L12,24" stroke="currentColor" fill="none" stroke-width="2" opacity="0.35"/>
		<polygon points="8,22 12,30 16,22" fill="currentColor" opacity="0.35"/>
	</svg>`;
}

function arrowMergeH() {
	return `
	<svg class="fp-svg-h" viewBox="0 0 40 80">
		<path d="M2,15 C20,15 20,40 38,40" stroke="currentColor" fill="none" stroke-width="2" opacity="0.35"/>
		<path d="M2,65 C20,65 20,40 38,40" stroke="currentColor" fill="none" stroke-width="2" opacity="0.35"/>
		<polygon points="35,36 40,40 35,44" fill="currentColor" opacity="0.35"/>
	</svg>
	<svg class="fp-svg-v" viewBox="0 0 24 32">
		<path d="M12,2 L12,24" stroke="currentColor" fill="none" stroke-width="2" opacity="0.35"/>
		<polygon points="8,22 12,30 16,22" fill="currentColor" opacity="0.35"/>
	</svg>`;
}

/** Safely set SVG content by parsing and appending DOM nodes */
function setArrowSvg(container: HTMLElement, svgMarkup: string) {
	const parser = new DOMParser();
	const wrapper = `<div xmlns="http://www.w3.org/1999/xhtml">${svgMarkup}</div>`;
	const doc = parser.parseFromString(wrapper, "text/html");
	const nodes = doc.body.firstElementChild?.childNodes;
	if (nodes) {
		for (const node of Array.from(nodes)) {
			container.appendChild(document.importNode(node, true));
		}
	}
}
