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
	private navigatorActiveFilter: { type: string; value: string } | null = null;
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
				this.render(this.stats);
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
				document.querySelectorAll(".flow-filter-popup").forEach(p => p.remove());

				const popup = this.container.createDiv("flow-filter-popup");
				const rect = btnWrap.getBoundingClientRect();
				popup.style.cssText = `position:fixed; top:${rect.bottom + 4}px; left:${rect.left}px; z-index:99999; min-width:180px; max-height:300px; overflow-y:auto; background:var(--background-primary); border:1px solid var(--background-modifier-border); border-radius:8px; padding:6px 0; box-shadow:0 8px 24px rgba(0,0,0,0.15);`;

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
						if (isActive) this.navigatorActiveFilter = null;
						else this.navigatorActiveFilter = { type: filterType, value: item.value };
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
			const channels = Object.keys(this.stats.propertiesGrouped[channelField]).sort();
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
			isVi ? "Sức khoẻ Vault" : "Vault Health",
			"heart-pulse",
			[
				{ label: isVi ? "Ghi chú mồ côi" : "Orphan notes", value: "orphan-notes", icon: "file-question" },
				{ label: isVi ? "Chưa có properties" : "No properties", value: "no-properties", icon: "list" },
				{ label: isVi ? "Chưa có tag" : "No tags", value: "no-tags", icon: "tag" },
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
			btn.style.cssText = `display:flex;align-items:center;gap:5px;padding:5px 10px;font-size:0.82em;border-radius:6px;cursor:pointer;${color ? `color:${color};border-color:${color};` : ""}`;
			const ic = btn.createSpan();
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
			popup.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:10px;padding:20px;min-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.2);`;
			popup.createEl("h4", { text: isVi ? "Di chuyển file" : "Move Files" }).style.margin = "0 0 12px 0";

			const allFolders: string[] = [];
			const collectFolders = (folder: any) => {
				for (const child of folder.children || []) {
					if (child.children !== undefined) {
						allFolders.push(child.path);
						collectFolders(child);
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

			const rowBtns = popup.createDiv(); rowBtns.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
			const cancelB = rowBtns.createEl("button", { text: isVi ? "Huỷ" : "Cancel" });
			const confirmB = rowBtns.createEl("button", { text: isVi ? "Di chuyển" : "Move" });
			confirmB.style.cssText = "background:var(--interactive-accent);color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;";
			cancelB.onclick = () => popup.remove();
			confirmB.onclick = async () => {
				const dest = sel.value;
				for (const f of selectedFiles) {
					const newPath = dest === "/" ? f.name : `${dest}/${f.name}`;
					try { await this.app.fileManager.renameFile(f, newPath); } catch { }
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
			popup.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:10px;padding:20px;min-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.2);`;
			popup.createEl("h4", { text: isVi ? "Xác nhận xoá" : "Confirm Delete" }).style.margin = "0 0 8px 0";
			popup.createEl("p", { text: isVi ? `Xoá ${selectedFiles.length} file đã chọn vào thùng rác?` : `Move ${selectedFiles.length} file(s) to trash?` }).style.cssText = "margin-bottom:12px;color:var(--text-error);";
			const rowBtns = popup.createDiv(); rowBtns.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
			const cancelB = rowBtns.createEl("button", { text: isVi ? "Huỷ" : "Cancel" });
			const confirmB = rowBtns.createEl("button", { text: isVi ? "Xoá" : "Delete" });
			confirmB.style.cssText = "background:var(--text-error);color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;";
			cancelB.onclick = () => popup.remove();
			confirmB.onclick = async () => {
				for (const f of selectedFiles) {
					try { await this.app.vault.trash(f, true); } catch { }
				}
				popup.remove();
				this.navigatorSelectedFiles.clear();
				updateQABar();
				this.render(this.stats);
			};
		};

		this.container.insertBefore(quickActionBar, tableArea);

		const mdFiles = this.app.vault.getMarkdownFiles();

		triggerRenderTable = () => {
			tableArea.empty();

			const af = this.navigatorActiveFilter;
			const isAttachmentMode = af?.type === "attachment";

			const activeColNames = isAttachmentMode
				? ["☑", "#", "Name", "Folder", "Size", "Type", "Modified"]
				: ["☑", ...allColNames];

			const tableContainer = tableArea.createDiv("flow-table-container");
			tableContainer.addClass("flow-dashboard-ui-47");

			const table = tableContainer.createEl("table");
			table.addClass("flow-dashboard-ui-48");

			const thead = table.createEl("thead");
			const trHead = thead.createEl("tr");

			let selectAllCb: HTMLInputElement | null = null;
			activeColNames.forEach((h, colIdx) => {
				if (isAttachmentMode) {
					// show all for attachment mode
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
				const name = (allColNames[colIdx] || "").toLowerCase();
				if (name === "#") return "";
				if (name === "name") return file.basename.toLowerCase();
				if (name === "folder") return (file.parent?.path || "").toLowerCase();
				if (name === "created") return new Date(file.stat.ctime).toISOString();
				if (name === "modified") return new Date(file.stat.mtime).toISOString();
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
				const incomingCounts = new Map<string, number>();
				for (const src in resolvedLinks) {
					for (const tgt in resolvedLinks[src]) {
						incomingCounts.set(tgt, (incomingCounts.get(tgt) || 0) + 1);
					}
				}

				let sourceFiles: TFile[];
				if (isAttachmentMode) {
					sourceFiles = allVaultFiles;
				} else {
					sourceFiles = mdFiles.slice();
				}

				let filteredFiles = sourceFiles.filter(f => {
					if (lowerQuery) {
						const matchQuery = f.basename.toLowerCase().includes(lowerQuery) || (f.parent?.path || "").toLowerCase().includes(lowerQuery);
						if (!matchQuery) return false;
					}

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
							const feelings = Array.isArray(feelVal) ? feelVal.map((v: any) => String(v).toLowerCase()) : [String(feelVal).toLowerCase()];
							if (!feelings.includes(af.value.toLowerCase())) return false;

						} else if (af.type === "vault-health") {
							if (af.value === "orphan-notes") {
								if (incomingCounts.get(f.path) ?? 0 > 0) return false;
							} else if (af.value === "no-properties") {
								const meaningfulKeys = fm ? Object.keys(fm).filter(k => k !== "position" && k !== "cssclasses") : [];
								if (meaningfulKeys.length > 0) return false;
							} else if (af.value === "no-tags") {
								const allTags = cache?.tags?.length
									? cache.tags
									: (fm?.tags ? [fm.tags].flat() : []);
								if (allTags.length > 0) return false;
							}

						} else if (af.type === "attachment") {
							const sizeMB = f.stat.size / (1024 * 1024);
							if (af.value === "size-10mb" && sizeMB <= 10) return false;
							else if (af.value === "size-5mb" && sizeMB <= 5) return false;
							else if (af.value === "size-2mb" && sizeMB <= 2) return false;
							else if (af.value === "size-1mb" && sizeMB <= 1) return false;
							else if (af.value.startsWith("type-")) {
								const expectedType = af.value.slice(5);
								const fileType = extTypeMap[f.extension.toLowerCase()] || "other";
								if (fileType !== expectedType) return false;
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

						const tdMod = tr.createEl("td"); tdMod.style.cssText = "padding:6px 8px;color:var(--text-faint);font-size:0.85em;";
						tdMod.setText(new Date(file.stat.mtime).toISOString().split("T")[0] || "");
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
							td.style.padding = "6px 8px";
							td.style.color = "var(--text-normal)";
							const lowerCol = colName.toLowerCase();

							if (lowerCol === "#") {
								td.setText(String(rowIdx));
								td.style.color = "var(--text-faint)";
							} else if (lowerCol === "name") {
								const link = td.createEl("a", { text: file.basename });
								link.style.cursor = "pointer";
								link.onclick = (e) => { e.preventDefault(); this.app.workspace.getLeaf(false).openFile(file); this.closeModal(); };
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
