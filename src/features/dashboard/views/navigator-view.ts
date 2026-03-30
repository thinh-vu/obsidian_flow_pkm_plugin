import { App, setIcon, TFile } from "obsidian";
import { FlowPluginSettings, FlowRole } from "../../../types";
import { VaultStats, extractWikilinkName } from "../stats-collector";
import { BRAND } from "../../../brand-colors";

export class NavigatorView {
	private navigatorSortCol: number = 0;
	private navigatorSortAsc: boolean = true;
	private navigatorVisibleCols: boolean[] = [];
	private navigatorCurrentPage: number = 1;
	private navigatorPageSize: number = 100;
	private navigatorStripedRows: boolean = false;
	private navigatorCustomCols: string[] = [];
	private navigatorSearchQuery: string = "";
	private navigatorActiveFilters: { type: string; value: string }[] = [];
	private navigatorSelectedFiles: Set<string> = new Set();
	private stats!: VaultStats;

	constructor(
		private app: App,
		private settings: FlowPluginSettings,
		private container: HTMLElement,
		private closeModal: () => void
	) { }

	public render(stats: VaultStats) {
		this.stats = stats;
		this.container.empty();
		this.container.style.overflow = "hidden";
		this.container.style.display = "flex";
		this.container.style.flexDirection = "column";
		this.container.style.height = "100%";

		const baseCols = ["#", "Name", "Folder", "Created", "Modified", "Tags", "Impact", "Urgency", "Category", "Channel", "Publish", "Summary", "Feeling", "Aliases"];
		const allColNames = [...baseCols, ...this.navigatorCustomCols];

		if (this.navigatorVisibleCols.length < allColNames.length) {
			const diff = allColNames.length - this.navigatorVisibleCols.length;
			this.navigatorVisibleCols.push(...Array(diff).fill(true));
		}

		let triggerRenderTable: () => void = () => { };
		let triggerRenderRows: () => void = () => { };

		const toolbar = this.container.createDiv();
		toolbar.addClass("flow-dashboard-ui-29");
		toolbar.style.position = "relative";
		toolbar.style.zIndex = "100";

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

		if (this.navigatorActiveFilters.length > 0) {
			const clearBtn = filtersDiv.createEl("button");
			clearBtn.addClass("flow-dashboard-ui-34");
			clearBtn.style.cssText = "padding:4px 8px;display:flex;align-items:center;gap:4px;color:var(--text-error);border-color:var(--text-error);";
			const clearIcon = clearBtn.createSpan();
			setIcon(clearIcon, "x");
			clearBtn.title = "Clear filters";
			clearBtn.onclick = () => {
				this.navigatorActiveFilters = [];
				this.navigatorCurrentPage = 1;
				this.render(this.stats);
			};
		}

		const createFilterGroupBtn = (groupLabel: string, groupIcon: string, items: { label: string; value: string; icon?: string }[], filterType: string) => {
			if (items.length === 0) return;
			const btnWrap = filtersDiv.createDiv();
			btnWrap.style.position = "relative";

			const btn = btnWrap.createEl("button");
			btn.addClass("flow-dashboard-ui-31");
			const selectedItems = items.filter(i => this.navigatorActiveFilters.some(f => f.type === filterType && f.value === i.value));
			const isActiveGroup = selectedItems.length > 0;
			if (isActiveGroup) btn.addClass("flow-dashboard-ui-33");

			const btnIcon = btn.createSpan("flow-filter-icon");
			setIcon(btnIcon, groupIcon);
			btnIcon.addClass("flow-dashboard-ui-32");

			const labelText = selectedItems.length > 0 
				? (selectedItems.length === 1 ? selectedItems[0]!.label : `${groupLabel} (${selectedItems.length})`) 
				: groupLabel;
			const labelSpan = btn.createSpan({ text: labelText });
			if (isActiveGroup) labelSpan.style.fontWeight = "bold";

			const chevron = btn.createSpan();
			setIcon(chevron, "chevron-down");
			chevron.style.cssText = "display:flex;align-items:center;margin-left:4px;opacity:0.5;";

			btn.onclick = (e) => {
				e.stopPropagation();
				document.querySelectorAll(".flow-filter-popup").forEach(p => p.remove());

				const popup = this.container.createDiv("flow-filter-popup");
				const rect = btnWrap.getBoundingClientRect();
				popup.style.cssText = `position:fixed; top:${rect.bottom + 4}px; left:${rect.left}px; z-index:99999; min-width:180px; max-height:300px; overflow-y:auto; background:var(--background-primary); border:1px solid var(--background-modifier-border); border-radius:8px; padding:6px 0; box-shadow:0 8px 24px rgba(0,0,0,0.15);`;

				for (const item of items) {
					const row = popup.createDiv();
					row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 16px;cursor:pointer;font-size:0.85em;justify-content:space-between;";
					row.onmouseenter = () => row.style.backgroundColor = "var(--background-modifier-hover)";
					row.onmouseleave = () => row.style.backgroundColor = "transparent";

					const leftSide = row.createDiv();
					leftSide.style.cssText = "display:flex;align-items:center;gap:8px;";

					if (item.icon) {
						const iEl = leftSide.createSpan();
						setIcon(iEl, item.icon);
						iEl.style.cssText = "display:flex;align-items:center;color:var(--text-muted);";
						(iEl.querySelector("svg") as SVGElement)?.setAttribute("width", "14");
						(iEl.querySelector("svg") as SVGElement)?.setAttribute("height", "14");
					}
					leftSide.createSpan({ text: item.label });

					const isActive = this.navigatorActiveFilters.some(f => f.type === filterType && f.value === item.value);
					if (isActive) {
						leftSide.style.fontWeight = "700";
						leftSide.style.color = "var(--interactive-accent)";
						
						const rightSide = row.createSpan();
						setIcon(rightSide, "check");
						rightSide.style.color = "var(--interactive-accent)";
						(rightSide.querySelector("svg") as SVGElement)?.setAttribute("width", "14");
						(rightSide.querySelector("svg") as SVGElement)?.setAttribute("height", "14");
					}

					row.onclick = () => {
						const idx = this.navigatorActiveFilters.findIndex(f => f.type === filterType && f.value === item.value);
						if (idx > -1) this.navigatorActiveFilters.splice(idx, 1);
						else this.navigatorActiveFilters.push({ type: filterType, value: item.value });
						
						this.navigatorCurrentPage = 1;
						popup.remove();
						this.render(this.stats);
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

		const folderItems = orderedRoles.map(role => {
			const folderName = this.settings.folderMap[role as FlowRole];
			const cleanLabel = folderName?.replace(/^\d+\.\s*/, "") || role;
			return { label: cleanLabel, value: role, icon: roleIcons[role] || "folder" };
		}).filter(i => i.label);
		createFilterGroupBtn("Folder", "folder", folderItems, "folder");

		createFilterGroupBtn("Eisenhower", "zap", [
			{ label: "P1 — Urgent & Important", value: "p1", icon: "alert-triangle" },
			{ label: "P2 — Important", value: "p2", icon: "target" },
			{ label: "P3 — Urgent", value: "p3", icon: "clock" },
			{ label: "P4 — Neither", value: "p4", icon: "minus" },
		], "eisenhower");

		createFilterGroupBtn("Temperature", "thermometer", [
			{ label: "Hot (< 3 days)", value: "hot", icon: "flame" },
			{ label: "Warm (3–30 days)", value: "warm", icon: "sun" },
			{ label: "Cold (> 30 days)", value: "cold", icon: "snowflake" },
		], "temperature");

		const channelField = this.settings.channelFieldName || "channel";
		if (this.stats?.propertiesGrouped[channelField]) {
			const rawChannels = Object.keys(this.stats.propertiesGrouped[channelField]);
			const normalizedChannelSet = new Set<string>();
			for (const rc of rawChannels) {
				const parts = rc.split(",").map(p => p.trim()).filter(p => p);
				for (const p of parts) {
					const normalized = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
					normalizedChannelSet.add(normalized);
				}
			}
			const channels = Array.from(normalizedChannelSet).sort();
			if (channels.length > 0) {
				const channelItems = channels.map(ch => ({ label: ch, value: ch, icon: "radio" }));
				createFilterGroupBtn("Channel", "radio", channelItems, "channel");
			}
		}

		createFilterGroupBtn("Publish", "calendar-clock", [
			{ label: "Today", value: "today", icon: "calendar-check" },
			{ label: "Next 3 days", value: "3days", icon: "calendar-range" },
			{ label: "Next 7 days", value: "7days", icon: "calendar" },
			{ label: "Next 2 weeks", value: "2weeks", icon: "calendar-days" },
			{ label: "Later", value: "later", icon: "calendar-off" },
		], "publish");

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

		const isVi = this.settings.language === "vi";

		createFilterGroupBtn(
			isVi ? "Nhiệm vụ" : "Tasks",
			"check-square",
			[
				{ label: isVi ? "Dở dang" : "Todo", value: "todo", icon: "square" },
				{ label: isVi ? "Hoàn thành" : "Done", value: "done", icon: "check-square" },
			],
			"task"
		);

		createFilterGroupBtn(
			isVi ? "Sức khoẻ Vault" : "Vault Health",
			"heart-pulse",
			[
				{ label: isVi ? "Ghi chú mồ côi" : "Orphan notes", value: "orphan-notes", icon: "file-question" },
				{ label: isVi ? "Chưa có properties" : "No properties", value: "no-properties", icon: "list" },
				{ label: isVi ? "Chưa có tag" : "No tags", value: "no-tags", icon: "tag" },
				{ label: isVi ? "Tag mồ côi" : "Orphan tag", value: "single-tag", icon: "alert-circle" },
				{ label: isVi ? "Property mồ côi" : "Orphan property", value: "single-property", icon: "alert-triangle" },
			],
			"vault-health"
		);

		const allVaultFiles = this.app.vault.getFiles().filter(f => f.extension !== "md" && f.extension !== "canvas");
		const extSet = new Set<string>();
		for (const f of allVaultFiles) extSet.add(f.extension.toLowerCase());
		const extTypeMap: Record<string, string> = {
			png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", bmp: "image", svg: "image", avif: "image",
			mp4: "video", mov: "video", avi: "video", mkv: "video", webm: "video",
			mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio", flac: "audio",
			pdf: "pdf", doc: "document", docx: "document", xls: "document", xlsx: "document", ppt: "document", pptx: "document",
			zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
		};
		const typeIconMap: Record<string, string> = { image: "image", video: "film", audio: "music", pdf: "file-text", document: "file", archive: "package", other: "paperclip" };
		const typeLabels: Record<string, string> = { image: isVi ? "Ảnh" : "Images", video: "Video", audio: isVi ? "Âm thanh" : "Audio", pdf: "PDF", document: isVi ? "Tài liệu" : "Documents", archive: isVi ? "Nén" : "Archives", other: isVi ? "Khác" : "Other" };

		const discoveredTypes = new Set<string>();
		for (const ext of extSet) discoveredTypes.add(extTypeMap[ext] || "other");
		const attachItems: { label: string; value: string; icon?: string }[] = [
			{ label: "> 10 MB", value: "size-10mb", icon: "hard-drive" },
			{ label: "> 5 MB", value: "size-5mb", icon: "hard-drive" },
			{ label: "> 2 MB", value: "size-2mb", icon: "hard-drive" },
			{ label: "> 1 MB", value: "size-1mb", icon: "hard-drive" },
		];
		for (const t of ["image", "video", "audio", "pdf", "document", "archive", "other"]) {
			if (discoveredTypes.has(t)) attachItems.push({ label: typeLabels[t] || t, value: `type-${t}`, icon: typeIconMap[t] || "paperclip" });
		}
		if (allVaultFiles.length > 0) {
			createFilterGroupBtn(isVi ? "Đính kèm" : "Attachments", "paperclip", attachItems, "attachment");
		}

		const spacer = toolbar.createDiv();
		spacer.style.flex = "1";

		const rightControlsDiv = toolbar.createDiv();
		rightControlsDiv.addClass("flow-dashboard-ui-37");

		const searchWrapper = rightControlsDiv.createDiv();
		searchWrapper.addClass("flow-dashboard-ui-38");

		const searchIconSpan = searchWrapper.createSpan();
		setIcon(searchIconSpan, "search");
		searchIconSpan.addClass("flow-dashboard-ui-39");

		const searchInput = searchWrapper.createEl("input", { type: "text", placeholder: "Search notes..." });
		searchInput.addClass("flow-dashboard-ui-40");
		searchInput.style.paddingLeft = "28px";
		searchInput.value = this.navigatorSearchQuery;

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

		const colBtn = rightControlsDiv.createEl("button");
		setIcon(colBtn, "columns");
		colBtn.title = "Show/Hide Columns";
		colBtn.addClass("flow-dashboard-ui-41");

		colBtn.onclick = (e) => {
			e.stopPropagation();
			let popup = this.container.querySelector(".flow-col-popup") as HTMLElement;
			if (popup) { popup.remove(); return; }

			const rect = colBtn.getBoundingClientRect();
			popup = this.container.createDiv("flow-col-popup");
			popup.style.cssText = `position:fixed; top:${rect.bottom + 4}px; right:${window.innerWidth - rect.right}px; z-index:99999; min-width:180px; max-height:400px; overflow-y:auto; background:var(--background-primary); border:1px solid var(--background-modifier-border); border-radius:6px; padding:10px; box-shadow:0 8px 24px rgba(0,0,0,0.15);`;

			allColNames.forEach((name, i) => {
				const row = popup.createDiv();
				row.style.cssText = "display:flex;align-items:center;gap:6px;padding:3px 0;";
				const cb = row.createEl("input", { type: "checkbox" }) as HTMLInputElement;
				cb.checked = this.navigatorVisibleCols[i] ?? true;
				cb.style.margin = "0";
				row.createEl("label", { text: name });
				cb.onchange = () => {
					this.navigatorVisibleCols[i] = cb.checked;
					triggerRenderTable();
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
					this.render(this.stats);
				}
			};

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

		const paginationDiv = rightControlsDiv.createDiv();
		paginationDiv.addClass("flow-dashboard-ui-45");

		const pageInfo = paginationDiv.createSpan({ text: `Page ${this.navigatorCurrentPage}` });
		const prevBtn = paginationDiv.createEl("button");
		setIcon(prevBtn, "chevron-left");
		prevBtn.style.padding = "4px";
		const nextBtn = paginationDiv.createEl("button");
		setIcon(nextBtn, "chevron-right");
		nextBtn.style.padding = "4px";

		const tableArea = this.container.createDiv();
		tableArea.addClass("flow-dashboard-ui-46");

		const quickActionBar = this.container.createDiv();
		quickActionBar.style.cssText = `display:none; align-items:center; gap:8px; padding:8px 12px; background:var(--background-secondary); border-radius:8px; border:1px solid var(--interactive-accent); margin-bottom:8px; flex-wrap:wrap;`;
		const qaCountLabel = quickActionBar.createSpan();
		qaCountLabel.style.cssText = "font-size:0.85em;color:var(--text-muted);margin-right:4px;";

		const createQABtn = (label: string, icon: string, color?: string) => {
			const btn = quickActionBar.createEl("button");
			btn.style.cssText = `display:flex;flex-direction:row;align-items:center;justify-content:center;gap:6px;padding:6px 14px;font-size:0.85em;border-radius:6px;cursor:pointer;height:auto;min-height:32px;white-space:nowrap;line-height:1;width:auto;flex-wrap:nowrap;${color ? `color:${color};border-color:${color};` : ""}`;
			const ic = btn.createSpan();
			ic.style.cssText = "display:flex;align-items:center;justify-content:center;";
			setIcon(ic, icon);
			btn.createSpan({ text: label });
			return btn;
		};

		const btnAddTag = createQABtn(isVi ? "Gắn tag" : "Add Tag", "tag");
		const btnAddProp = createQABtn(isVi ? "Gắn properties" : "Add Property", "list-plus");
		const btnMove = createQABtn(isVi ? "Di chuyển" : "Move", "folder-input");
		const btnDelete = createQABtn(isVi ? "Xoá" : "Delete", "trash-2", "var(--text-error)");

		const updateQABar = () => {
			const count = this.navigatorSelectedFiles.size;
			if (count === 0) quickActionBar.style.display = "none";
			else {
				quickActionBar.style.display = "flex";
				qaCountLabel.setText(isVi ? `${count} file được chọn:` : `${count} selected:`);
			}
		};

		const getSelectedTFiles = () => {
			return [...this.navigatorSelectedFiles]
				.map(p => this.app.vault.getAbstractFileByPath(p))
				.filter((f): f is TFile => f instanceof TFile);
		};

		btnAddTag.onclick = (e) => {
			e.stopPropagation();
			const selectedFiles = getSelectedTFiles().filter(f => f.extension === "md");
			if (selectedFiles.length === 0) return;

			const popup = this.container.createDiv();
			popup.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:10px;padding:20px;min-width:300px;box-shadow:0 8px 32px rgba(0,0,0,0.2);`;
			popup.createEl("h4", { text: isVi ? "Gắn tag" : "Add Tag" }).style.margin = "0 0 12px 0";
			const inp = popup.createEl("input", { type: "text", placeholder: isVi ? "Nhập tag (không có #)" : "Tag name (no #)" });
			inp.style.cssText = "width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--background-modifier-border);margin-bottom:10px;";
			const rowBtns = popup.createDiv(); rowBtns.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
			const cancelB = rowBtns.createEl("button", { text: isVi ? "Huỷ" : "Cancel" });
			const confirmB = rowBtns.createEl("button", { text: isVi ? "Gắn" : "Apply" });
			confirmB.style.cssText = "background:var(--interactive-accent);color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;";
			cancelB.onclick = () => popup.remove();
			confirmB.onclick = async () => {
				const tag = inp.value.trim().replace(/^#/, "");
				if (!tag) return;
				for (const f of selectedFiles) {
					await (this.app as any).fileManager.processFrontMatter(f, (fm: any) => {
						if (!fm.tags) fm.tags = [];
						if (!Array.isArray(fm.tags)) fm.tags = [String(fm.tags)];
						if (!fm.tags.includes(tag)) fm.tags.push(tag);
					});
				}
				popup.remove();
				triggerRenderRows();
			};
			inp.focus();
		};

		btnAddProp.onclick = (e) => {
			e.stopPropagation();
			const selectedFiles = getSelectedTFiles().filter(f => f.extension === "md");
			if (selectedFiles.length === 0) return;

			const popup = this.container.createDiv();
			popup.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:10px;padding:20px;min-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.2);`;
			popup.createEl("h4", { text: isVi ? "Gắn properties" : "Add Property" }).style.margin = "0 0 12px 0";
			const keyInp = popup.createEl("input", { type: "text", placeholder: isVi ? "Tên thuộc tính (key)" : "Property key" });
			keyInp.style.cssText = "width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--background-modifier-border);margin-bottom:8px;";
			const valInp = popup.createEl("input", { type: "text", placeholder: isVi ? "Giá trị" : "Value" });
			valInp.style.cssText = "width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--background-modifier-border);margin-bottom:10px;";
			const rowBtns = popup.createDiv(); rowBtns.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
			const cancelB = rowBtns.createEl("button", { text: isVi ? "Huỷ" : "Cancel" });
			const confirmB = rowBtns.createEl("button", { text: isVi ? "Gắn" : "Apply" });
			confirmB.style.cssText = "background:var(--interactive-accent);color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;";
			cancelB.onclick = () => popup.remove();
			confirmB.onclick = async () => {
				const key = keyInp.value.trim();
				const val = valInp.value.trim();
				if (!key) return;
				for (const f of selectedFiles) {
					await (this.app as any).fileManager.processFrontMatter(f, (fm: any) => {
						fm[key] = val;
					});
				}
				popup.remove();
				triggerRenderRows();
			};
			keyInp.focus();
		};

		btnMove.onclick = (e) => {
			e.stopPropagation();
			const selectedFiles = getSelectedTFiles();
			if (selectedFiles.length === 0) return;

			const popup = this.container.createDiv();
			popup.addClass("flow-popup-csstext");
			popup.createEl("h4", { text: isVi ? "Di chuyển file" : "Move files", cls: "flow-popup-h4" });

			const allFolders: string[] = [];
			interface FolderLike { children?: { path: string; children?: unknown }[] }
			const collectFolders = (folder: FolderLike) => {
				for (const child of folder.children || []) {
					if (child.children !== undefined) {
						allFolders.push(child.path);
						collectFolders(child as FolderLike);
					}
				}
			};
			collectFolders(this.app.vault.getRoot());
			allFolders.unshift("/");

			const sel = popup.createEl("select");
			sel.style.cssText = "width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--background-modifier-border);margin-bottom:10px;";
			for (const folder of allFolders) {
				sel.createEl("option", { text: folder === "/" ? "/ (root)" : folder, value: folder });
			}

			const rowBtns = popup.createDiv(); rowBtns.addClass("flow-popup-btn-row");
			const cancelB = rowBtns.createEl("button", { text: isVi ? "Huỷ" : "Cancel" });
			const confirmB = rowBtns.createEl("button", { text: isVi ? "Di chuyển" : "Move" });
			confirmB.addClass("flow-popup-confirm-btn");
			cancelB.onclick = () => popup.remove();
			confirmB.onclick = async () => {
				const dest = sel.value;
				for (const f of selectedFiles) {
					const newPath = dest === "/" ? f.name : `${dest}/${f.name}`;
					try { await this.app.fileManager.renameFile(f, newPath); } catch { /* rename failed, skip */ }
				}
				popup.remove();
				this.navigatorSelectedFiles.clear();
				updateQABar();
				triggerRenderRows();
			};
		};

		btnDelete.onclick = (e) => {
			e.stopPropagation();
			const selectedFiles = getSelectedTFiles();
			if (selectedFiles.length === 0) return;

			const popup = this.container.createDiv();
			popup.addClass("flow-popup-csstext");
			popup.createEl("h4", { text: isVi ? "Xác nhận xoá" : "Confirm delete", cls: "flow-popup-h4" });
			popup.createEl("p", { text: isVi ? `Xoá ${selectedFiles.length} file đã chọn vào thùng rác?` : `Move ${selectedFiles.length} file(s) to trash?`, cls: "flow-popup-error-text" });
			const rowBtns = popup.createDiv(); rowBtns.addClass("flow-popup-btn-row");
			const cancelB = rowBtns.createEl("button", { text: isVi ? "Huỷ" : "Cancel" });
			const confirmB = rowBtns.createEl("button", { text: isVi ? "Xoá" : "Delete" });
			confirmB.addClass("flow-popup-delete-btn");
			cancelB.onclick = () => popup.remove();
			confirmB.onclick = async () => {
				for (const f of selectedFiles) {
					try { await this.app.fileManager.trashFile(f); } catch { /* trash failed, skip */ }
				}
				popup.remove();
				this.navigatorSelectedFiles.clear();
				updateQABar();
				this.render(this.stats);
			};
		};

		this.container.insertBefore(quickActionBar, tableArea);

		const mdFiles = this.app.vault.getMarkdownFiles();

		let incomingFiles = new Map<string, import("obsidian").TFile[]>();

		triggerRenderTable = () => {
			tableArea.empty();

			const isAttachmentMode = this.navigatorActiveFilters.some(f => f.type === "attachment");
			const isTagHealthMode = !isAttachmentMode && this.navigatorActiveFilters.some(f => f.value === "single-tag");
			const isPropHealthMode = !isAttachmentMode && !isTagHealthMode && this.navigatorActiveFilters.some(f => f.value === "single-property");

			let activeColNames: string[];
			if (isAttachmentMode) {
				activeColNames = ["☑", "#", "Name", "Folder", "Size", "Type", "Links", "Linked Files", "Modified"];
			} else if (isTagHealthMode) {
				activeColNames = ["☑", "#", "Tag Name", "Used in Note"];
			} else if (isPropHealthMode) {
				activeColNames = ["☑", "#", "Property Name", "Used in Note", "Values"];
			} else {
				activeColNames = ["☑", ...allColNames];
			}

			const tableContainer = tableArea.createDiv("flow-table-container");
			tableContainer.addClass("flow-dashboard-ui-47");

			const table = tableContainer.createEl("table");
			table.addClass("flow-dashboard-ui-48");

			const thead = table.createEl("thead");
			const trHead = thead.createEl("tr");

			let selectAllCb: HTMLInputElement | null = null;
			activeColNames.forEach((h, colIdx) => {
				if (isAttachmentMode || isTagHealthMode || isPropHealthMode) {
					// show all for attachment mode and health modes
				} else if (colIdx > 0 && !this.navigatorVisibleCols[colIdx - 1]) return;

				const th = trHead.createEl("th");
				th.addClass("flow-dashboard-ui-49");

				if (h === "☑") {
					selectAllCb = th.createEl("input", { type: "checkbox" }) as HTMLInputElement;
					selectAllCb.title = isVi ? "Chọn tất cả" : "Select all";
					selectAllCb.style.cursor = "pointer";
				} else {
					th.setText(h);
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
				}
			});

			const tbody = table.createEl("tbody");

			const getValString = (file: any, colIdx: number): string => {
				const name = (activeColNames[colIdx] || "").toLowerCase();
				if (name === "#" || name === "☑") return "";
				if (name === "tag name" || name === "property name" || name === "name") return (file.basename || "").toLowerCase();
				if (name === "used in note") return (file.file?.basename || "").toLowerCase();
				if (name === "values") return String(file.values || "").toLowerCase();
				
				if (name === "folder") return (file.parent?.path || "").toLowerCase();
				if (name === "created") return new Date(file.stat?.ctime || 0).toISOString();
				if (name === "modified") return new Date(file.stat?.mtime || 0).toISOString();
				if (isAttachmentMode) {
					if (name === "size") return (file.stat.size / (1024 * 1024)).toFixed(2) + " MB";
					if (name === "type") return file.extension.toLowerCase();
					if (name === "links" || name === "linked files") return String(incomingFiles.get(file.path)?.length || 0);
				}

				const cache = this.app.metadataCache.getFileCache(file);
				if (name === "tags") {
					if (cache?.tags) return cache.tags.map((t: any) => t.tag).join(", ");
					if (cache?.frontmatter?.tags) return String(cache.frontmatter.tags);
					return "";
				}
				if (cache?.frontmatter && cache.frontmatter[name] !== undefined) {
					const val = cache.frontmatter[name];
					return Array.isArray(val) ? val.map((v: any) => extractWikilinkName(String(v))).join(", ") : extractWikilinkName(String(val));
				}
				return "";
			};

			triggerRenderRows = () => {
				tbody.empty();

				const lowerQuery = this.navigatorSearchQuery.toLowerCase();
				const resolvedLinks = this.app.metadataCache.resolvedLinks;
				incomingFiles.clear();
				for (const src in resolvedLinks) {
					for (const tgt in resolvedLinks[src]) {
						if (!incomingFiles.has(tgt)) incomingFiles.set(tgt, []);
						const srcFile = this.app.vault.getAbstractFileByPath(src);
						if (srcFile && (srcFile as any).extension === "md") {
							incomingFiles.get(tgt)!.push(srcFile as import("obsidian").TFile);
						}
					}
				}

				let sourceFiles: any[];
				if (isAttachmentMode) {
					sourceFiles = allVaultFiles;
				} else if (isTagHealthMode || isPropHealthMode) {
					sourceFiles = [];
					let tagCounts: Record<string, import("obsidian").TFile[]> = {};
					let propCounts: Record<string, { file: import("obsidian").TFile, values: any }[]> = {};

					for (const f of mdFiles) {
						const c = this.app.metadataCache.getFileCache(f);
						if (!c) continue;
						
						if (isTagHealthMode) {
							const tags = c.tags ? c.tags.map(t => t.tag.replace(/^#/, "")) : (c.frontmatter?.tags ? [c.frontmatter.tags].flat().map(t => String(t).replace(/^#/, "")) : []);
							for (const t of tags) {
								if (t) {
									if (!tagCounts[t]) tagCounts[t] = [];
									tagCounts[t].push(f);
								}
							}
						}
						
						if (isPropHealthMode) {
							const keys = c.frontmatter ? Object.keys(c.frontmatter).filter(k => k !== "position" && k !== "cssclasses") : [];
							for (const k of keys) {
								if (!propCounts[k]) propCounts[k] = [];
								propCounts[k].push({ file: f, values: c.frontmatter![k] });
							}
						}
					}

					if (isTagHealthMode) {
						for (const [tag, files] of Object.entries(tagCounts)) {
							// Global checking: only 1 file in the whole vault
							if (files.length === 1) {
								sourceFiles.push({
									isOrphanItem: true,
									path: `tag:${tag}`,
									basename: tag,
									file: files[0]!,
									stat: files[0]!.stat,
									parent: files[0]!.parent,
									extension: files[0]!.extension
								});
							}
						}
					} else if (isPropHealthMode) {
						for (const [prop, files] of Object.entries(propCounts)) {
							if (files.length === 1) {
								sourceFiles.push({
									isOrphanItem: true,
									path: `prop:${prop}`,
									basename: prop,
									file: files[0]!.file,
									values: files[0]!.values,
									stat: files[0]!.file.stat,
									parent: files[0]!.file.parent,
									extension: files[0]!.file.extension
								});
							}
						}
					}
				} else {
					sourceFiles = mdFiles.slice();
				}

				let filteredFiles = sourceFiles.filter(f => {
					if (lowerQuery) {
						const matchQuery = f.basename.toLowerCase().includes(lowerQuery) || (f.parent?.path || "").toLowerCase().includes(lowerQuery);
						if (!matchQuery) return false;
					}

					if (this.navigatorActiveFilters.length > 0) {
						const cache = this.app.metadataCache.getFileCache(f.isOrphanItem ? f.file : f);
						const fm = cache?.frontmatter;
						const now = Date.now();
						const typedFilters: Record<string, string[]> = {};
						
						for (const filter of this.navigatorActiveFilters) {
							if (!typedFilters[filter.type]) typedFilters[filter.type] = [];
							typedFilters[filter.type]!.push(filter.value);
						}

						for (const [fType, fValues] of Object.entries(typedFilters)) {
							let typeMatch = false;

							for (const val of fValues) {
								let valMatch = false;

								if (fType === "folder") {
									const folderName = this.settings.folderMap[val as FlowRole];
									if (folderName) {
										const cleanActiveFolder = folderName.replace(/^\d+\.\s*/, "").trim().toLowerCase();
										const NotePath = (f.isOrphanItem ? f.file.parent?.path : f.parent?.path) || "";
										const cleanFolderPath = NotePath.replace(/^\d+\.\s*/, "").trim().toLowerCase();
										valMatch = cleanFolderPath.startsWith(cleanActiveFolder);
									}
								} else if (fType === "task") {
									if (val === "todo") valMatch = cache?.listItems?.some((li: any) => li.task !== undefined && li.task === " ") ?? false;
									else if (val === "done") valMatch = cache?.listItems?.some((li: any) => li.task !== undefined && li.task !== " ") ?? false;
								} else if (fType === "eisenhower") {
									const urgencyField = this.settings.urgencyConfig?.fieldName || "urgency";
									const impactField = this.settings.impactConfig?.fieldName || "impact";
									const urgencyVal = Number(fm?.[urgencyField]) || 0;
									const impactVal = Number(fm?.[impactField]) || 0;
									const urgencyLevels = this.settings.urgencyConfig?.levels || [];
									const impactLevels = this.settings.impactConfig?.levels || [];
									const urgencyHigh = urgencyLevels.length > 0 ? urgencyVal >= (urgencyLevels[Math.floor(urgencyLevels.length / 2)]?.value ?? 3) : urgencyVal >= 3;
									const impactHigh = impactLevels.length > 0 ? impactVal >= (impactLevels[Math.floor(impactLevels.length / 2)]?.value ?? 3) : impactVal >= 3;
									if (val === "p1") valMatch = urgencyHigh && impactHigh;
									else if (val === "p2") valMatch = impactHigh && !urgencyHigh;
									else if (val === "p3") valMatch = urgencyHigh && !impactHigh;
									else if (val === "p4") valMatch = !urgencyHigh && !impactHigh;

								} else if (fType === "temperature") {
									const ageDays = (now - (f.isOrphanItem ? f.file.stat.mtime : f.stat.mtime)) / (24 * 60 * 60 * 1000);
									if (val === "hot") valMatch = ageDays < 3;
									else if (val === "warm") valMatch = ageDays >= 3 && ageDays <= 30;
									else if (val === "cold") valMatch = ageDays > 30;

								} else if (fType === "channel") {
									const chField = this.settings.channelFieldName || "channel";
									const chVal = fm?.[chField];
									if (chVal) {
										const channels = Array.isArray(chVal) ? chVal.flatMap(v => String(v).split(",").map(s => s.trim().toLowerCase())) : String(chVal).split(",").map(c => c.trim().toLowerCase());
										valMatch = channels.includes(val.toLowerCase());
									}

								} else if (fType === "publish") {
									const pubField = this.settings.publishFieldName || "publish";
									const pubVal = fm?.[pubField];
									if (!pubVal && val === "later") valMatch = true;
									else if (pubVal) {
										const pubDate = new Date(String(pubVal)).getTime();
										if (!isNaN(pubDate)) {
											const diffDays = (pubDate - now) / (86400000);
											if (val === "today") valMatch = diffDays >= 0 && diffDays <= 1;
											else if (val === "3days") valMatch = diffDays >= 0 && diffDays <= 3;
											else if (val === "7days") valMatch = diffDays >= 0 && diffDays <= 7;
											else if (val === "2weeks") valMatch = diffDays >= 0 && diffDays <= 14;
											else if (val === "later") valMatch = diffDays > 14;
										}
									}

								} else if (fType === "feeling") {
									const feelVal = fm?.feeling;
									if (feelVal) {
										const feelings = Array.isArray(feelVal) ? feelVal.map((v: any) => String(v).toLowerCase()) : [String(feelVal).toLowerCase()];
										valMatch = feelings.includes(val.toLowerCase());
									}

								} else if (fType === "vault-health") {
									if (val === "orphan-notes") {
										valMatch = (incomingFiles.get(f.path)?.length || 0) === 0;
									} else if (val === "no-properties") {
										const meaningfulKeys = fm ? Object.keys(fm).filter(k => k !== "position" && k !== "cssclasses") : [];
										valMatch = meaningfulKeys.length === 0;
									} else if (val === "no-tags") {
										const allTags = cache?.tags?.length ? cache.tags : (fm?.tags ? [fm.tags].flat() : []);
										valMatch = allTags.length === 0;
									} else if (val === "single-tag") {
										valMatch = !!f.isOrphanItem;
									} else if (val === "single-property") {
										valMatch = !!f.isOrphanItem;
									}

								} else if (fType === "attachment") {
									const sizeMB = f.stat.size / (1024 * 1024);
									if (val === "size-10mb") valMatch = sizeMB > 10;
									else if (val === "size-5mb") valMatch = sizeMB > 5;
									else if (val === "size-2mb") valMatch = sizeMB > 2;
									else if (val === "size-1mb") valMatch = sizeMB > 1;
									else if (val.startsWith("type-")) {
										const expectedType = val.slice(5);
										const fileType = extTypeMap[f.extension.toLowerCase()] || "other";
										valMatch = fileType === expectedType;
									}
								}

								if (valMatch) {
									typeMatch = true;
									break; // OR logic within same group
								}
							}

							if (!typeMatch) {
								return false; // AND logic between different groups
							}
						}
					}
					return true;
				});

				const dir = this.navigatorSortAsc ? 1 : -1;
				filteredFiles.sort((a, b) => {
					if (this.navigatorSortCol === 0) return 0;
					const va = getValString(a, this.navigatorSortCol);
					const vb = getValString(b, this.navigatorSortCol);
					return dir * va.localeCompare(vb);
				});

				const totalPages = Math.ceil(filteredFiles.length / this.navigatorPageSize) || 1;
				if (this.navigatorCurrentPage > totalPages) this.navigatorCurrentPage = totalPages;

				pageInfo.setText(`Page ${this.navigatorCurrentPage} of ${totalPages}`);

				const startIdx = (this.navigatorCurrentPage - 1) * this.navigatorPageSize;
				const displayFiles = filteredFiles.slice(startIdx, startIdx + this.navigatorPageSize);

				if (selectAllCb) {
					const pagePaths = displayFiles.map(f => f.path);
					const allSelected = pagePaths.length > 0 && pagePaths.every(p => this.navigatorSelectedFiles.has(p));
					selectAllCb.checked = allSelected;
					selectAllCb.indeterminate = !allSelected && pagePaths.some(p => this.navigatorSelectedFiles.has(p));
					selectAllCb.onchange = () => {
						if (selectAllCb!.checked) {
							pagePaths.forEach(p => this.navigatorSelectedFiles.add(p));
						} else {
							pagePaths.forEach(p => this.navigatorSelectedFiles.delete(p));
						}
						updateQABar();
						triggerRenderRows();
					};
				}

				displayFiles.forEach((file, displayIdx) => {
					const rowIdx = startIdx + displayIdx + 1;
					const tr = tbody.createEl("tr");
					tr.style.borderBottom = "1px solid var(--background-modifier-border-hover)";
					const isChecked = this.navigatorSelectedFiles.has(file.path);
					if (isChecked) tr.style.backgroundColor = "var(--background-modifier-active-hover)";

					const stripeBg = "rgba(128, 128, 128, 0.08)";
					if (!isChecked && this.navigatorStripedRows && displayIdx % 2 === 1) {
						tr.style.backgroundColor = stripeBg;
					}

					tr.onmouseenter = () => {
						if (!this.navigatorSelectedFiles.has(file.path)) tr.style.backgroundColor = "var(--background-modifier-hover)";
					};
					tr.onmouseleave = () => {
						if (this.navigatorSelectedFiles.has(file.path)) {
							tr.style.backgroundColor = "var(--background-modifier-active-hover)";
						} else {
							tr.style.backgroundColor = (this.navigatorStripedRows && displayIdx % 2 === 1) ? stripeBg : "transparent";
						}
					};

					const cache = this.app.metadataCache.getFileCache(file);

					if (isAttachmentMode) {
						const tdCb = tr.createEl("td"); tdCb.style.padding = "4px 6px";
						const cb = tdCb.createEl("input", { type: "checkbox" }) as HTMLInputElement;
						cb.checked = this.navigatorSelectedFiles.has(file.path);
						cb.onchange = () => {
							if (cb.checked) this.navigatorSelectedFiles.add(file.path);
							else this.navigatorSelectedFiles.delete(file.path);
							updateQABar();
							triggerRenderRows();
						};

						const tdIdx = tr.createEl("td"); tdIdx.style.cssText = "padding:6px 8px;color:var(--text-faint);font-size:0.85em;";
						tdIdx.setText(String(rowIdx));

						const tdName = tr.createEl("td"); tdName.style.padding = "6px 8px";
						tdName.createEl("span", { text: file.basename + "." + file.extension });

						const tdFolder = tr.createEl("td"); tdFolder.style.cssText = "padding:6px 8px;color:var(--text-muted);font-size:0.85em;";
						tdFolder.setText(file.parent?.path || "/");

						const fileSizeMB = file.stat.size / (1024 * 1024);
						const sizeText = fileSizeMB >= 1 ? `${fileSizeMB.toFixed(1)} MB` : `${(file.stat.size / 1024).toFixed(0)} KB`;
						const tdSize = tr.createEl("td"); tdSize.style.cssText = "padding:6px 8px;font-size:0.85em;text-align:right;";
						tdSize.setText(sizeText);
						if (fileSizeMB > 10) tdSize.style.color = "var(--text-error)";
						else if (fileSizeMB > 2) tdSize.style.color = "var(--color-orange)";

						const fileType = extTypeMap[file.extension.toLowerCase()] || "other";
						const tdType = tr.createEl("td"); tdType.style.cssText = "padding:6px 8px;font-size:0.82em;color:var(--text-accent);";
						tdType.setText(file.extension.toLowerCase());

						const incomingForFile = incomingFiles.get(file.path) || [];
						
						const tdLinks = tr.createEl("td"); tdLinks.style.cssText = "padding:6px 8px;font-size:0.85em;text-align:center;";
						tdLinks.setText(String(incomingForFile.length));

						const tdLinkedFiles = tr.createEl("td"); tdLinkedFiles.style.cssText = "padding:6px 8px;font-size:0.85em;";
						if (incomingForFile.length > 0) {
							const linkContainer = tdLinkedFiles.createDiv();
							linkContainer.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;";
							incomingForFile.forEach(srcFile => {
								const pill = linkContainer.createSpan();
								pill.style.cssText = "padding:2px 6px;border-radius:4px;background-color:var(--background-modifier-active-hover);color:var(--text-accent);cursor:pointer;font-size:0.9em;";
								pill.setText(srcFile.basename);
								pill.title = srcFile.path;
								pill.onclick = (e) => {
									e.stopPropagation();
									this.app.workspace.getLeaf(false).openFile(srcFile);
								};
							});
						}

						const tdMod = tr.createEl("td"); tdMod.style.cssText = "padding:6px 8px;color:var(--text-faint);font-size:0.85em;";
						tdMod.setText(new Date(file.stat.mtime).toISOString().split("T")[0] || "");
					} else if (isTagHealthMode || isPropHealthMode) {
						const tdCb = tr.createEl("td"); tdCb.style.padding = "4px 6px";
						const cb = tdCb.createEl("input", { type: "checkbox" }) as HTMLInputElement;
						cb.checked = this.navigatorSelectedFiles.has(file.path);
						cb.onchange = () => {
							if (cb.checked) this.navigatorSelectedFiles.add(file.path);
							else this.navigatorSelectedFiles.delete(file.path);
							updateQABar();
							triggerRenderRows();
						};

						const tdIdx = tr.createEl("td"); tdIdx.style.cssText = "padding:6px 8px;color:var(--text-faint);font-size:0.85em;";
						tdIdx.setText(String(rowIdx));

						const tdName = tr.createEl("td"); tdName.style.padding = "6px 8px";
						const pill = tdName.createSpan();
						pill.style.cssText = "padding:2px 8px;border-radius:12px;background-color:var(--background-modifier-active-hover);color:var(--interactive-accent);font-weight:600;font-size:0.85em;";
						pill.setText(isTagHealthMode ? `#${file.basename}` : file.basename);

						const tdNote = tr.createEl("td"); tdNote.style.cssText = "padding:6px 8px;font-size:0.85em;";
						const noteLink = tdNote.createSpan();
						noteLink.style.cssText = "color:var(--text-accent);cursor:pointer;text-decoration:underline;";
						noteLink.setText(file.file.basename);
						noteLink.onclick = (e) => {
							e.stopPropagation();
							this.app.workspace.getLeaf(false).openFile(file.file);
						};

						if (isPropHealthMode) {
							const tdVals = tr.createEl("td"); tdVals.style.cssText = "padding:6px 8px;font-size:0.85em;color:var(--text-muted);word-break:break-all;";
							tdVals.setText(String(file.values || ""));
						}
					} else {
						const tdCb = tr.createEl("td"); tdCb.style.padding = "4px 6px";
						const cb = tdCb.createEl("input", { type: "checkbox" }) as HTMLInputElement;
						cb.checked = this.navigatorSelectedFiles.has(file.path);
						cb.onchange = () => {
							if (cb.checked) this.navigatorSelectedFiles.add(file.path);
							else this.navigatorSelectedFiles.delete(file.path);
							updateQABar();
							triggerRenderRows();
						};

						allColNames.forEach((colName, colIdx) => {
							if (!this.navigatorVisibleCols[colIdx]) return;

							const td = tr.createEl("td");
							td.addClass("flow-nav-td");
							const lowerCol = colName.toLowerCase();

							if (lowerCol === "#") {
								td.setText(String(rowIdx));
								td.addClass("flow-nav-td-faint");
							} else if (lowerCol === "name") {
								const link = td.createEl("a", { text: file.basename });
								link.addClass("flow-nav-link-cursor");
								link.onclick = (e) => { e.preventDefault(); this.app.workspace.getLeaf(false).openFile(file); this.closeModal(); };
							} else if (lowerCol === "folder") {
								td.setText(file.parent?.path || "/");
								td.addClass("flow-nav-td-muted");
							} else if (lowerCol === "created") {
								td.setText(new Date(file.stat.ctime).toISOString().split("T")[0] || "");
								td.addClass("flow-nav-td-faint");
							} else if (lowerCol === "modified") {
								td.setText(new Date(file.stat.mtime).toISOString().split("T")[0] || "");
								td.addClass("flow-nav-td-faint");
							} else if (lowerCol === "tags") {
								let tagsText = "";
								if (cache?.tags) tagsText = cache.tags.map(t => t.tag).join(", ");
								else if (cache?.frontmatter?.tags) {
									const fmTags = cache.frontmatter.tags;
									tagsText = Array.isArray(fmTags) ? fmTags.join(", ") : String(fmTags);
								}
								td.setText(tagsText || "-");
								td.addClass("flow-nav-td-accent");
							} else {
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
								td.addClass("flow-nav-td-small");
							}
						});
					}
				});

				if (displayFiles.length === 0) {
					const tr = tbody.createEl("tr");
					const td = tr.createEl("td", { text: isVi ? "Không tìm thấy file nào." : "No files found." });
					td.colSpan = activeColNames.length;
					td.addClass("flow-dashboard-ui-50");
				}
			};

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
