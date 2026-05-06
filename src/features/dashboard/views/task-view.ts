 
import { App, setIcon, TFile, moment, Notice, Platform } from "obsidian";
import { FlowPluginSettings, FlowRole } from "../../../types";
import { VaultStats } from "../stats-collector";

export interface TaskItem {
	file: TFile;
	line: number;
	text: string;
	status: string;
	folder: string;
	level?: number;
	id?: string;
	parentId?: string;
	recur?: string;
}

export class TaskView {
	private stats!: VaultStats;
	private tasks: TaskItem[] = [];
	private filterFolder: string = "all";
	private searchQuery: string = "";
	private viewMode: "list" | "kanban" = "list";
	
	private quickAddContainer!: HTMLElement;
	private toolbarContainer!: HTMLElement;
	private listContainer!: HTMLElement;

	constructor(
		private app: App,
		private settings: FlowPluginSettings,
		private container: HTMLElement,
		private closeModal: () => void
	) {}

	public async render(stats: VaultStats) {
		this.stats = stats;
		this.container.empty();
		this.container.setCssProps({ "display": "flex" })
		this.container.setCssProps({ "flex-direction": "column" })
		this.container.setCssProps({ "height": "100%" })
		this.container.setCssProps({ "overflow": "hidden" })
		// Add padding to container for breathing room
		this.container.setCssProps({ "padding": "8px 16px" })

		this.quickAddContainer = this.container.createDiv("flow-task-quickadd-container");
		this.toolbarContainer = this.container.createDiv("flow-task-toolbar-container");
		this.listContainer = this.container.createDiv("flow-task-list-container");
		this.listContainer.setCssProps({ "flex": "1", "overflow-y": "auto", "display": "flex", "flex-direction": "column", "gap": "12px", "padding-bottom": "24px", "padding-right": "4px" })

		// Initialize task filters setting if it doesn't exist
		if (!this.settings.taskFilters) {
			this.settings.taskFilters = { status: ["todo", "doing"], priority: ["all"] };
		} else {
			// Migrate from string to array
			if (typeof this.settings.taskFilters.status === "string") {
				this.settings.taskFilters.status = ["todo", "doing"];
			}
			if (typeof this.settings.taskFilters.priority === "string") {
				this.settings.taskFilters.priority = ["all"];
			}
		}

		await this.loadTasks();
		this.renderQuickAdd();
		this.renderToolbar();
		void this.renderTaskList();
	}

	private async loadTasks() {
		this.tasks = [];
		const mdFiles = this.app.vault.getMarkdownFiles();
		
		for (const file of mdFiles) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache || !cache.listItems) continue;

			const taskItems = cache.listItems.filter(li => li.task !== undefined);
			if (taskItems.length === 0) continue;

			const content = await this.app.vault.cachedRead(file);
			const lines = content.split('\n');

			for (const li of taskItems) {
				const lineNum = li.position.start.line;
				const lineText = lines[lineNum] || "";
				// Extract task text without the markdown checkbox
				const textMatch = lineText.match(/^([ \t]*)[-*+]\s+\[(.)\]\s+(.*)$/);
				let text = "";
				let level = 0;
				if (textMatch) {
					const indentStr = textMatch[1] || "";
					text = textMatch[3] || "";
					for (const char of indentStr) {
						if (char === '\t') level++;
						else if (char === ' ') level += 0.25;
					}
					level = Math.floor(level);
				} else {
					text = lineText;
				}

				const idMatch = text.match(/%%id:([^%]+)%%/);
				const parentMatch = text.match(/%%parent:([^%]+)%%/);
				const recurCommentMatch = text.match(/%%recur:([^%]+)%%/);
				const recurRawMatch = text.match(/\?\?([\w-~+]+)/);
				
				const id = idMatch ? idMatch[1] : undefined;
				const parentId = parentMatch ? parentMatch[1] : undefined;
				
				let recur: string | undefined;
				if (recurCommentMatch) recur = recurCommentMatch[1];
				else if (recurRawMatch) recur = recurRawMatch[1];

				this.tasks.push({
					file,
					line: lineNum,
					text,
					status: li.task || " ",
					folder: file.parent?.path || "/",
					level,
					id,
					parentId,
					recur
				});
			}
		}
	}

	private renderQuickAdd() {
		this.quickAddContainer.empty();
		
		const wrap = this.quickAddContainer.createDiv();
		wrap.setCssProps({ "display": "flex", "gap": "12px", "align-items": "center", "margin-bottom": "16px", "padding": "4px 0" })

		const inputWrapper = wrap.createDiv();
		inputWrapper.setCssProps({ "flex": "1", "position": "relative", "display": "flex", "align-items": "center" })

		const iconSpan = inputWrapper.createSpan();
		setIcon(iconSpan, "plus");
		iconSpan.setCssProps({ "position": "absolute", "left": "16px", "color": "var(--text-muted)", "opacity": "0.7", "display": "flex", "align-items": "center", "justify-content": "center" })

		const isVi = this.settings.language === "vi";
		const input = inputWrapper.createEl("input", { type: "text", placeholder: isVi ? "Thêm tác vụ mới (Nhấn Enter để lưu)..." : "Add a new task (Press Enter to save)..." });
		input.setCssProps({ "width": "100%", "padding": "12px 16px 12px 42px", "border-radius": "12px", "background": "var(--background-primary)", "border": "1px solid var(--background-modifier-border)", "color": "var(--text-normal)", "font-size": "1em", "outline": "none", "transition": "all 0.2s ease", "box-shadow": "0 2px 6px rgba(0,0,0,0.03)" })
		input.onfocus = () => {
			input.setCssProps({ "border-color": "var(--interactive-accent)" })
			input.setCssProps({ "box-shadow": "0 4px 12px rgba(0,0,0,0.05)" })
		};
		const suggestionsPopup = inputWrapper.createDiv();
		suggestionsPopup.setCssProps({ "position": "absolute", "top": "100%", "left": "0", "width": "100%", "background": "var(--background-primary)", "border": "1px solid var(--background-modifier-border)", "border-radius": "8px", "box-shadow": "0 4px 12px rgba(0,0,0,0.1)", "z-index": "200", "max-height": "250px", "overflow-y": "auto", "display": "none", "margin-top": "4px", "padding": "4px" })
		
		const presets = [
			{ key: "@today", label: "Hôm nay", type: "date" },
			{ key: "@this afternoon", label: "Chiều nay", type: "date" },
			{ key: "@this evening", label: "Tối nay", type: "date" },
			{ key: "@tomorrow", label: "Ngày mai", type: "date" },
			{ key: "@tomorrow morning", label: "Sáng mai", type: "date" },
			{ key: "@tomorrow afternoon", label: "Chiều mai", type: "date" },
			{ key: "@tomorrow evening", label: "Tối mai", type: "date" },
			{ key: "@weekend", label: "Cuối tuần", type: "date" },
			{ key: "@next week", label: "Tuần sau", type: "date" },
			{ key: "$08:00", label: "Sáng 8h", type: "time" },
			{ key: "$10:00", label: "Sáng 10h", type: "time" },
			{ key: "$14:00", label: "Chiều 2h", type: "time" },
			{ key: "$16:00", label: "Chiều 4h", type: "time" },
			{ key: "$20:00", label: "Tối 8h", type: "time" },
			{ key: "!p1", label: "P1", type: "priority" },
			{ key: "!p2", label: "P2", type: "priority" },
			{ key: "!p3", label: "P3", type: "priority" },
			{ key: "!p4", label: "P4", type: "priority" },
			{ key: "!important", label: "Quan trọng", type: "matrix" },
			{ key: "!urgent", label: "Khẩn cấp", type: "matrix" },
			{ key: "!not-important", label: "Không quan trọng", type: "matrix" },
			{ key: "!not-urgent", label: "Không khẩn cấp", type: "matrix" }
		];
		
		interface SuggestionPreset { key: string; label: string; type: string; taskRef?: { id?: string; file: import("obsidian").TFile; line: number }; }
		let dynamicPresets: SuggestionPreset[] = [...presets];

		// Recurring Tasks
		dynamicPresets.push(
			{ key: "??~", label: "Lặp lại vô hạn", type: "recur" },
			{ key: "??+3", label: "3 ngày sau", type: "recur" },
			{ key: "??+7", label: "1 tuần sau", type: "recur" },
			{ key: "??+14", label: "2 tuần sau", type: "recur" },
			{ key: "??+30", label: "1 tháng sau", type: "recur" },
			{ key: "??", label: "Lặp lại đến ngày... (vd: ??2026-06-30)", type: "recur" }
		);
		
		let activeIndex = -1;
		let currentFiltered: SuggestionPreset[] = [];
		let matchMatch: RegExpMatchArray | null = null;
		
		const closePopup = () => {
			suggestionsPopup.setCssProps({ "display": "none" })
			activeIndex = -1;
		};

		const renderSuggestions = (query: string, matchPrefix: string, matchStart: number, presetsToUse: SuggestionPreset[] = dynamicPresets) => {
			suggestionsPopup.empty();
			
			currentFiltered = presetsToUse.filter(p => p.key.startsWith(matchPrefix) && p.key.toLowerCase().includes(query.toLowerCase()));
			
			if (currentFiltered.length === 0) {
				closePopup();
				return;
			}
			
			suggestionsPopup.setCssProps({ "display": "block" })
			currentFiltered.forEach((p, idx) => {
				const item = suggestionsPopup.createDiv();
				item.setCssProps({ "padding": `8px 12px`, "border-radius": `6px`, "cursor": `pointer`, "display": `flex`, "justify-content": `space-between`, "align-items": `center`, "margin-bottom": `2px`, "transition": `background 0.1s`, "background": idx === activeIndex ? "var(--background-modifier-hover)" : "" });
				
				// Show label on the left (primary) and key on the right (secondary)
				item.createSpan({ text: p.label, cls: "flow-task-suggestion-label" }).setCssProps({ "font-weight": "500", "color": "var(--text-normal)", "flex": "1", "overflow": "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" });
				item.createSpan({ text: p.key, cls: "flow-task-suggestion-key" }).setCssProps({ "color": "var(--text-muted)", "font-size": "0.8em", "margin-left": "12px", "font-family": "var(--font-monospace)" });
				
				item.onmouseenter = () => {
					activeIndex = idx;
					Array.from(suggestionsPopup.children).forEach((c, i) => {
						(c as HTMLElement).setCssProps({ "background": i === idx ? "var(--background-modifier-hover)" : "transparent" });
					});
				};
				
				item.onmousedown = (e) => {
					e.preventDefault();
					void applySuggestion(p, matchStart, query.length);
				};
			});
		};

		const applySuggestion = async (suggestion: SuggestionPreset, matchStart: number, queryLength: number) => {
			const val = input.value;
			let insertKey = suggestion.key;
			
			if (suggestion.key.startsWith("??+")) {
				const days = parseInt(suggestion.key.replace("??+", ""));
				const targetDate = moment().add(days, 'days').format("YYYY-MM-DD");
				insertKey = `%%recur:${targetDate}%%`;
			} else if (suggestion.key.startsWith("??")) {
				const rule = suggestion.key.replace("??", "");
				insertKey = `%%recur:${rule || "YYYY-MM-DD"}%%`;
			} else if (suggestion.type === "parent_task") {
				const t = suggestion.taskRef as { id: string; file: TFile; line: number };
				let parentId = t.id;
				if (!parentId) {
					parentId = Math.random().toString(36).substring(2, 6).toUpperCase();
					t.id = parentId;
					const fileContent = await this.app.vault.read(t.file);
					const lines = fileContent.split('\n');
					if (lines[t.line]) {
						lines[t.line] += ` %%id:${parentId}%%`;
						await this.app.vault.modify(t.file, lines.join('\n'));
					}
				}
				insertKey = `%%parent:${parentId}%%`;
			}
			
			input.value = val.substring(0, matchStart) + insertKey + " " + val.substring(matchStart + queryLength);
			closePopup();
			input.focus();
		};

		input.oninput = () => {
			const val = input.value;
			const cursor = input.selectionStart || val.length;
			const textBeforeCursor = val.substring(0, cursor);
			
			const match = textBeforeCursor.match(/(^|\s)([@!$#][\w_À-ỹ-:]*|\[\[[^\]]*|\?\?[\w-~+]*|>>.*)$/);
			if (match && match[1] !== undefined && match[2] !== undefined) {
				matchMatch = match;
				let prefix = match[2].charAt(0);
				if (match[2].startsWith("[[")) prefix = "[[";
				if (match[2].startsWith("??")) prefix = "??";
				if (match[2].startsWith(">>")) prefix = ">>";
				const query = match[2];
				const matchStart = match.index! + match[1].length;
				let currentPresets = dynamicPresets;
				if (prefix === ">>") {
					const taskPresets = this.tasks
						.filter(t => t.status === " " || t.status === "/")
						.map(t => {
							const display = t.text.replace(/#[\w/-]+/g, "").replace(/%%[^%]+%%/g, "").replace(/\(@[^)]+\)/g, "").trim();
							return {
								key: `>>${display.substring(0, 50)}`,
								label: display,
								type: "parent_task",
								taskRef: t
							};
						});
					currentPresets = [...currentPresets, ...taskPresets];
				} else if (prefix === "[[") {
					const blueprintFolder = this.settings.folderMap[FlowRole.BLUEPRINT] || "4. Blueprint";
					const blueprintFiles = this.app.vault.getMarkdownFiles().filter(f => f.path.includes(blueprintFolder));
					const projectPresets = blueprintFiles.map(f => ({
						key: `[[${f.basename}]]`,
						label: `Dự án: ${f.basename}`,
						type: "project"
					}));
					currentPresets = [...currentPresets, ...projectPresets];
				}
				
				activeIndex = 0;
				renderSuggestions(query, prefix, matchStart, currentPresets);
			} else {
				closePopup();
			}
		};

		input.onblur = () => {
			input.setCssProps({ "border-color": "var(--background-modifier-border)" })
			input.setCssProps({ "box-shadow": "0 2px 6px rgba(0,0,0,0.03)" })
			setTimeout(closePopup, 150);
		};

		input.onkeydown = async (e) => {
			if (suggestionsPopup.style.display === "block" && matchMatch && matchMatch[1] !== undefined && matchMatch[2] !== undefined) {
				if (e.key === "ArrowDown") {
					e.preventDefault();
					activeIndex = (activeIndex + 1) % currentFiltered.length;
					const matchStart = matchMatch.index! + matchMatch[1].length;
					let prefix = matchMatch[2].charAt(0);
					if (matchMatch[2].startsWith("[[")) prefix = "[[";
					if (matchMatch[2].startsWith("??")) prefix = "??";
					renderSuggestions(matchMatch[2], prefix, matchStart);
					return;
				}
				if (e.key === "ArrowUp") {
					e.preventDefault();
					activeIndex = (activeIndex - 1 + currentFiltered.length) % currentFiltered.length;
					const matchStart = matchMatch.index! + matchMatch[1].length;
					let prefix = matchMatch[2].charAt(0);
					if (matchMatch[2].startsWith("[[")) prefix = "[[";
					if (matchMatch[2].startsWith("??")) prefix = "??";
					renderSuggestions(matchMatch[2], prefix, matchStart);
					return;
				}
				if (e.key === "Tab" || e.key === "Enter") {
					e.preventDefault();
					const current = currentFiltered[activeIndex];
					if (activeIndex >= 0 && current) {
						const matchStart = matchMatch.index! + matchMatch[1].length;
						await applySuggestion(current, matchStart, matchMatch[2].length);
					}
					return;
				}
				if (e.key === "Escape") {
					e.preventDefault();
					closePopup();
					return;
				}
			}

			if (e.key === "Enter" && input.value.trim()) {
				e.preventDefault();
				const { text, targetDateStr } = this.parseQuickAddText(input.value.trim(), moment().format("YYYY-MM-DD"));
				
				await this.createTask(text, targetDateStr);
				input.value = "";
				closePopup();
				
				// Optimistic UI update
				const parentMatch = text.match(/%%parent:([^%]+)%%/);
				const parentId = parentMatch ? parentMatch[1] : undefined;
				
				let targetFile: TFile | null = null;
				let targetFolder = "/";
				
				if (parentId) {
					const parentTask = this.tasks.find(t => t.id === parentId);
					if (parentTask && parentTask.file instanceof TFile) {
						targetFile = parentTask.file;
						targetFolder = parentTask.folder;
					}
				} else {
					const trackFolder = this.getTrackFolder();
					const file = this.app.vault.getAbstractFileByPath(`${trackFolder}/${targetDateStr}.md`);
					if (file instanceof TFile) {
						targetFile = file;
						targetFolder = trackFolder;
					}
				}
				
				const recurMatch = text.match(/%%recur:([^%]+)%%/);
				const recurRule = recurMatch ? recurMatch[1] : undefined;
				
				if (targetFile) {
					const newTask: TaskItem = {
						file: targetFile,
						line: 9999, // Dummy line for optimistic update
						text: text,
						status: " ",
						folder: targetFolder,
						parentId: parentId,
						recur: recurRule,
						level: 0
					};
					
					if (parentId) {
						const parentIndex = this.tasks.findIndex(t => t.id === parentId);
						if (parentIndex !== -1) {
							const pTask = this.tasks[parentIndex];
							newTask.level = (pTask && pTask.level ? pTask.level : 0) + 1;
							this.tasks.splice(parentIndex + 1, 0, newTask);
						} else {
							this.tasks.unshift(newTask);
						}
					} else {
						this.tasks.unshift(newTask);
					}
					void this.renderTaskList();
				}
			}
		};
	}

	private parseQuickAddText(rawText: string, defaultDate: string): { text: string; targetDateStr: string } {
		let text = rawText;
		let targetDateStr = defaultDate;
		let targetTimeStr = "";
		
		// Parse explicit time ($HH:mm)
		const exactTimeMatch = text.match(/\$(\d{1,2}:\d{2})/);
		if (exactTimeMatch && exactTimeMatch[1]) {
			targetTimeStr = exactTimeMatch[1];
			// format to HH:mm
			if (targetTimeStr.length === 4) targetTimeStr = "0" + targetTimeStr;
			text = text.replace(exactTimeMatch[0], "");
		}
		
		const todayMatch = text.match(/@(today|hôm nay)/i);
		const thisMorningMatch = text.match(/@(this morning|sáng nay|morning|sáng)/i);
		const thisAfternoonMatch = text.match(/@(this afternoon|chiều nay|afternoon|chiều)/i);
		const thisEveningMatch = text.match(/@(this evening|tối nay|evening|tối)/i);
		
		const tomorrowMatch = text.match(/@(tomorrow|tommorrow|ngày mai)/i);
		const tomorrowMorningMatch = text.match(/@(tomorrow morning|sáng mai)/i);
		const tomorrowAfternoonMatch = text.match(/@(tomorrow afternoon|chiều mai)/i);
		const tomorrowEveningMatch = text.match(/@(tomorrow evening|tối mai)/i);

		const weekendMatch = text.match(/@(weekend|cuối tuần)/i);
		const nextWeekMatch = text.match(/@(next week|tuần sau|tuần tới)/i);
		const isoMatch = text.match(/@(\d{4}-\d{2}-\d{2})/);
		const wikiMatch = text.match(/\[\[(\d{4}-\d{2}-\d{2})\]\]/);

		const assignDateTime = (date: string, defaultTime: string, matchString: string) => {
			targetDateStr = date;
			if (!targetTimeStr) targetTimeStr = defaultTime;
			text = text.replace(matchString, "");
		};

		if (isoMatch && isoMatch[1]) {
			targetDateStr = isoMatch[1];
			text = text.replace(isoMatch[0], "");
		} else if (wikiMatch && wikiMatch[1]) {
			targetDateStr = wikiMatch[1];
			// Do not remove wikiMatch so user can keep the backlink
		} else if (todayMatch) {
			assignDateTime(moment().format("YYYY-MM-DD"), "08:00", todayMatch[0]);
		} else if (thisMorningMatch) {
			assignDateTime(moment().format("YYYY-MM-DD"), "08:00", thisMorningMatch[0]);
		} else if (thisAfternoonMatch) {
			assignDateTime(moment().format("YYYY-MM-DD"), "14:00", thisAfternoonMatch[0]);
		} else if (thisEveningMatch) {
			assignDateTime(moment().format("YYYY-MM-DD"), "19:00", thisEveningMatch[0]);
		} else if (tomorrowMorningMatch) {
			assignDateTime(moment().add(1, 'day').format("YYYY-MM-DD"), "08:00", tomorrowMorningMatch[0]);
		} else if (tomorrowAfternoonMatch) {
			assignDateTime(moment().add(1, 'day').format("YYYY-MM-DD"), "14:00", tomorrowAfternoonMatch[0]);
		} else if (tomorrowEveningMatch) {
			assignDateTime(moment().add(1, 'day').format("YYYY-MM-DD"), "19:00", tomorrowEveningMatch[0]);
		} else if (tomorrowMatch) {
			assignDateTime(moment().add(1, 'day').format("YYYY-MM-DD"), "08:00", tomorrowMatch[0]);
		} else if (weekendMatch) {
			let m = moment();
			while (m.day() !== 6) { m.add(1, 'day'); }
			assignDateTime(m.format("YYYY-MM-DD"), "08:00", weekendMatch[0]);
		} else if (nextWeekMatch) {
			let m = moment().add(1, 'weeks').startOf('isoWeek');
			assignDateTime(m.format("YYYY-MM-DD"), "08:00", nextWeekMatch[0]);
		}

		const importantMatch = text.match(/!(important|quan-trong|quan trọng)\b/i);
		const notImportantMatch = text.match(/!(not-important|khong-quan-trong|không quan trọng)\b/i);
		const urgentMatch = text.match(/!(urgent|khan-cap|khẩn cấp)\b/i);
		const notUrgentMatch = text.match(/!(not-urgent|non-urgent|khong-khan-cap|không khẩn cấp)\b/i);

		const p1Match = text.match(/!(p1|1)\b/i);
		const p2Match = text.match(/!(p2|2)\b/i);
		const p3Match = text.match(/!(p3|3)\b/i);
		const p4Match = text.match(/!(p4|4)\b/i);

		let priorityLevel: number | null = null;
		if (p1Match) priorityLevel = 1;
		else if (p2Match) priorityLevel = 2;
		else if (p3Match) priorityLevel = 3;
		else if (p4Match) priorityLevel = 4;

		const isImportant = importantMatch !== null;
		const isNotImportant = notImportantMatch !== null;
		const isUrgent = urgentMatch !== null;
		const isNotUrgent = notUrgentMatch !== null;

		if (importantMatch) text = text.replace(importantMatch[0], "");
		if (notImportantMatch) text = text.replace(notImportantMatch[0], "");
		if (urgentMatch) text = text.replace(urgentMatch[0], "");
		if (notUrgentMatch) text = text.replace(notUrgentMatch[0], "");

		if (p1Match) text = text.replace(p1Match[0], "");
		if (p2Match) text = text.replace(p2Match[0], "");
		if (p3Match) text = text.replace(p3Match[0], "");
		if (p4Match) text = text.replace(p4Match[0], "");

		text = text.trim().replace(/\s+/g, ' ');
		
		let tags = "";
		if (priorityLevel === 1 || (isImportant && isUrgent)) {
			tags += " #task/priority/p1";
		} else if (priorityLevel === 2 || (isImportant && (isNotUrgent || (!isUrgent && !isNotUrgent)))) {
			tags += " #task/priority/p2";
		} else if (priorityLevel === 3 || (isUrgent && (isNotImportant || (!isImportant && !isNotImportant)))) {
			tags += " #task/priority/p3";
		} else if (priorityLevel === 4 || (isNotImportant && isNotUrgent) || (isNotImportant && !isUrgent && !isNotUrgent) || (isNotUrgent && !isImportant && !isNotImportant)) {
			tags += " #task/priority/p4";
		}

		// Capture all #tags and auto-format
		const tagMatches = text.match(/#[\w_À-ỹ-]+/g);
		if (tagMatches) {
			for (const tag of tagMatches) {
				const tagName = tag.substring(1).toLowerCase();
				if (tagName.startsWith("task/")) {
					if (!tags.includes(tag)) tags += ` ${tag}`;
				} else {
					tags += ` #task/label/${tagName}`;
				}
				text = text.replace(tag, "");
			}
		}
		
		if (tags) {
			text += tags;
		}

		if (targetTimeStr) {
			text += ` (@${targetDateStr} ${targetTimeStr})`;
		}
		
		const recurMatch = text.match(/\?\?([\w-~+]+)/);
		if (recurMatch) {
			const rule = recurMatch[1];
			text = text.replace(recurMatch[0], `%%recur:${rule}%%`);
		}
		
		return { text: text.trim(), targetDateStr };
	}

	private renderToolbar() {
		this.toolbarContainer.empty();
		
		const toolbar = this.toolbarContainer.createDiv("flow-task-toolbar");
		toolbar.setCssProps({ "display": "flex" })
		toolbar.setCssProps({ "gap": "12px" })
		toolbar.setCssProps({ "padding": "4px 0 16px 0" })
		toolbar.setCssProps({ "align-items": "center" })
		toolbar.setCssProps({ "flex-shrink": "0" })
		toolbar.setCssProps({ "position": "relative" })
		toolbar.setCssProps({ "z-index": "10" })
		// Remove background and border to match Navigator style
		// toolbar.setCssProps({ "background": "var(--background-secondary)" })
		// toolbar.setCssProps({ "border": "1px solid var(--background-modifier-border)" })

		const isVi = this.settings.language === "vi";

		const filtersDiv = toolbar.createDiv();
		filtersDiv.setCssProps({ "display": "flex", "gap": "8px", "flex-wrap": "nowrap", "align-items": "center", "flex-shrink": "0" })

		// View Mode Toggle
		const viewToggleWrapper = filtersDiv.createDiv();
		viewToggleWrapper.setCssProps({ "display": "flex", "gap": "4px", "background": "var(--background-modifier-form-field)", "padding": "4px", "border-radius": "8px", "margin-right": "8px" })
		
		const listBtn = viewToggleWrapper.createEl("button");
		setIcon(listBtn, "list");
		listBtn.setCssProps({ "display": `flex`, "align-items": `center`, "justify-content": `center`, "padding": `4px 8px`, "border-radius": `4px`, "border": `none`, "cursor": `pointer`, "color": `var(--text-normal)`, "transition": `all 0.2s ease`, "background": `${this.viewMode === 'list' ? 'var(--background-primary)' : 'transparent'}`, "box-shadow": `${this.viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'}` })
		listBtn.title = "List view";
		listBtn.onclick = () => { this.viewMode = 'list'; this.renderToolbar(); void this.renderTaskList(); };

		const kanbanBtn = viewToggleWrapper.createEl("button");
		setIcon(kanbanBtn, "columns");
		kanbanBtn.setCssProps({ "display": `flex`, "align-items": `center`, "justify-content": `center`, "padding": `4px 8px`, "border-radius": `4px`, "border": `none`, "cursor": `pointer`, "color": `var(--text-normal)`, "transition": `all 0.2s ease`, "background": `${this.viewMode === 'kanban' ? 'var(--background-primary)' : 'transparent'}`, "box-shadow": `${this.viewMode === 'kanban' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'}` })
		kanbanBtn.title = "Kanban view";
		kanbanBtn.onclick = () => { this.viewMode = 'kanban'; this.renderToolbar(); void this.renderTaskList(); };

		const createFilterGroupBtn = (groupLabel: string, groupIcon: string, items: { label: string; value: string; icon?: string }[], currentValues: string[], onChange: (vals: string[]) => void) => {
			if (items.length === 0) return;
			const btnWrap = filtersDiv.createDiv();
			btnWrap.setCssProps({ "position": "relative" })

			const btn = btnWrap.createEl("button");
			// Styling similar to Navigator view buttons but slightly softer
			btn.setCssProps({ "display": "flex", "align-items": "center", "gap": "6px", "padding": "6px 12px", "background": "transparent", "border": "1px solid var(--background-modifier-border)", "border-radius": "8px", "color": "var(--text-normal)", "font-size": "0.85em", "cursor": "pointer", "transition": "all 0.2s ease", "box-shadow": "0 1px 2px rgba(0,0,0,0.02)" })
			
			const isActiveGroup = currentValues.length > 0 && !currentValues.includes("all");
			if (isActiveGroup) {
				btn.setCssProps({ "background": "var(--background-modifier-hover)" })
				btn.setCssProps({ "border-color": "var(--interactive-accent)" })
			}

			const btnIcon = btn.createSpan("flow-filter-icon");
			setIcon(btnIcon, groupIcon);
			btnIcon.setCssProps({ "display": "flex", "align-items": "center", "opacity": "0.7" });
			(btnIcon.querySelector("svg") as SVGElement)?.setAttribute("width", "14");
			(btnIcon.querySelector("svg") as SVGElement)?.setAttribute("height", "14");

			const labelText = isActiveGroup && currentValues.length === 1 
				? items.find(i => i.value === currentValues[0])?.label || groupLabel 
				: (isActiveGroup ? `${groupLabel} (${currentValues.length})` : groupLabel);
			const labelSpan = btn.createSpan({ text: labelText });
			labelSpan.addClass("flow-task-filter-label");
			if (isActiveGroup) labelSpan.setCssProps({ "font-weight": "600" })

			const chevron = btn.createSpan();
			setIcon(chevron, "chevron-down");
			chevron.setCssProps({ "display": "flex", "align-items": "center", "opacity": "0.5" });
			(chevron.querySelector("svg") as SVGElement)?.setAttribute("width", "14");
			(chevron.querySelector("svg") as SVGElement)?.setAttribute("height", "14");

			btn.onclick = (e) => {
				e.stopPropagation();
				document.querySelectorAll(".flow-task-filter-popup").forEach(p => p.remove());

				const popup = this.container.createDiv("flow-task-filter-popup");
				const rect = btnWrap.getBoundingClientRect();
				popup.setCssProps({ "position": `fixed`, "top": `${rect.bottom + 4}px`, "left": `${rect.left}px`, "z-index": `99999`, "min-width": `180px`, "max-height": `300px`, "overflow-y": `auto`, "background": `var(--background-primary)`, "border": `1px solid var(--background-modifier-border)`, "border-radius": `12px`, "padding": `6px 0`, "box-shadow": `0 8px 24px rgba(0,0,0,0.1)` })

				for (const item of items) {
					const row = popup.createDiv();
					row.setCssProps({ "display": "flex", "align-items": "center", "gap": "8px", "padding": "8px 16px", "cursor": "pointer", "font-size": "0.85em", "justify-content": "space-between", "transition": "background 0.1s" })
					row.onmouseenter = () => row.setCssProps({ "background-color": "var(--background-modifier-hover)" })
					row.onmouseleave = () => row.setCssProps({ "background-color": "transparent" })

					const leftSide = row.createDiv();
					leftSide.setCssProps({ "display": "flex", "align-items": "center", "gap": "8px" })

					if (item.icon) {
						const iEl = leftSide.createSpan();
						setIcon(iEl, item.icon);
						iEl.setCssProps({ "display": "flex", "align-items": "center", "color": "var(--text-muted)" });
						(iEl.querySelector("svg") as SVGElement)?.setAttribute("width", "14");
						(iEl.querySelector("svg") as SVGElement)?.setAttribute("height", "14");
					}
					leftSide.createSpan({ text: item.label });

					if (currentValues.includes(item.value)) {
						leftSide.setCssProps({ "font-weight": "600" })
						leftSide.setCssProps({ "color": "var(--interactive-accent)" })
						
						const rightSide = row.createSpan();
						setIcon(rightSide, "check");
						rightSide.setCssProps({ "color": "var(--interactive-accent)" });
						(rightSide.querySelector("svg") as SVGElement)?.setAttribute("width", "14");
						(rightSide.querySelector("svg") as SVGElement)?.setAttribute("height", "14");
					}

					row.onclick = () => {
						let newValues = [...currentValues];
						if (item.value === "all") {
							newValues = ["all"];
						} else {
							// Remove "all" if selecting a specific value
							newValues = newValues.filter(v => v !== "all");
							if (newValues.includes(item.value)) {
								newValues = newValues.filter(v => v !== item.value);
								if (newValues.length === 0) newValues = ["all"]; // fallback
							} else {
								newValues.push(item.value);
							}
						}
						popup.remove();
						onChange(newValues);
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

		createFilterGroupBtn(
			isVi ? "Trạng thái" : "Status",
			"check-circle",
			[
				{ label: isVi ? "Tất cả" : "All Tasks", value: "all", icon: "list" },
				{ label: isVi ? "Chưa làm (Todo)" : "Todo", value: "todo", icon: "square" },
				{ label: isVi ? "Đang làm (Doing)" : "Doing", value: "doing", icon: "play-circle" },
				{ label: isVi ? "Hoàn thành (Done)" : "Done", value: "done", icon: "check-square" },
				{ label: isVi ? "Đã ẩn (Hidden)" : "Hidden", value: "hidden", icon: "eye-off" },
			],
			Array.isArray(this.settings.taskFilters!.status) ? this.settings.taskFilters!.status : [this.settings.taskFilters!.status],
			(vals) => {
				this.settings.taskFilters!.status = vals;
				void this.renderTaskList();
				this.renderToolbar();
			}
		);

		createFilterGroupBtn(
			isVi ? "Ưu tiên" : "Priority",
			"alert-circle",
			[
				{ label: isVi ? "Tất cả" : "All", value: "all", icon: "list" },
				{ label: isVi ? "Quan trọng & Khẩn cấp" : "Important & Urgent", value: "important_urgent", icon: "alert-triangle" },
				{ label: isVi ? "Quan trọng" : "Important", value: "important", icon: "star" },
				{ label: isVi ? "Khẩn cấp" : "Urgent", value: "urgent", icon: "zap" },
			],
			Array.isArray(this.settings.taskFilters!.priority) ? this.settings.taskFilters!.priority : [this.settings.taskFilters!.priority],
			(vals) => {
				this.settings.taskFilters!.priority = vals;
				void this.renderTaskList();
				this.renderToolbar();
			}
		);

		const folders = [...new Set(this.tasks.map(t => t.folder))].sort();
		const folderItems = [
			{ label: isVi ? "Tất cả thư mục" : "All Folders", value: "all", icon: "folder" },
			...folders.map(f => ({
				label: f === "/" ? "/ (root)" : f,
				value: f,
				icon: "folder"
			}))
		];

		createFilterGroupBtn(
			isVi ? "Thư mục" : "Folder",
			"folder-tree",
			folderItems,
			[this.filterFolder],
			(vals) => {
				this.filterFolder = (vals.length > 0 ? vals[0] : "all") || "all"; // Folder is still single-select for now
				void this.renderTaskList();
				this.renderToolbar();
			}
		);

		// Search Wrapper
		const searchWrapper = toolbar.createDiv();
		searchWrapper.setCssProps({ "flex": "1", "position": "relative", "display": "flex", "align-items": "center" })
		
		const searchIconSpan = searchWrapper.createSpan();
		setIcon(searchIconSpan, "search");
		searchIconSpan.setCssProps({ "position": "absolute", "left": "12px", "color": "var(--text-muted)", "opacity": "0.7", "display": "flex", "align-items": "center", "justify-content": "center" })
		
		const isMobile = Platform.isMobile;
		const placeholderText = isMobile ? "" : (isVi ? "Tìm kiếm tác vụ..." : "Search tasks...");
		const searchInput = searchWrapper.createEl("input", { type: "text", placeholder: placeholderText });
		searchInput.setCssProps({ "width": "100%", "padding": "6px 16px 6px 36px", "border-radius": "8px", "background": "var(--background-primary)", "border": "1px solid var(--background-modifier-border)", "color": "var(--text-normal)", "font-size": "0.95em", "outline": "none", "transition": "all 0.2s ease", "box-shadow": "0 1px 2px rgba(0,0,0,0.02)" })
		searchInput.onfocus = () => {
			searchInput.setCssProps({ "border-color": "var(--interactive-accent)" })
		};
		searchInput.onblur = () => {
			searchInput.setCssProps({ "border-color": "var(--background-modifier-border)" })
		};
		searchInput.value = this.searchQuery;
		searchInput.oninput = () => {
			this.searchQuery = searchInput.value;
			void this.renderTaskList();
		};
	}

	private renderTaskList() {
		this.listContainer.empty();

		const filteredTasks = this.tasks.filter(t => {
			const statusChar = t.status.trim().toLowerCase();
			const isDone = statusChar === "x";
			const isHidden = statusChar === "-";
			const isDoing = statusChar === "/";

			const activeStatuses = Array.isArray(this.settings.taskFilters!.status) 
				? this.settings.taskFilters!.status 
				: [this.settings.taskFilters!.status];
			
			let statusMatch = false;
			if (activeStatuses.includes("all") && !isHidden) statusMatch = true;
			if (activeStatuses.includes("todo") && !isDone && !isHidden && !isDoing) statusMatch = true;
			if (activeStatuses.includes("doing") && isDoing) statusMatch = true;
			if (activeStatuses.includes("done") && isDone) statusMatch = true;
			if (activeStatuses.includes("hidden") && isHidden) statusMatch = true;
			if (!statusMatch) return false;

			const hasImportant = t.text.includes("#task/priority/important") || t.text.includes("#task/important") || t.text.includes("#important");
			const hasUrgent = t.text.includes("#task/priority/urgent") || t.text.includes("#task/urgent") || t.text.includes("#urgent");
			
			const activePriorities = Array.isArray(this.settings.taskFilters!.priority)
				? this.settings.taskFilters!.priority
				: [this.settings.taskFilters!.priority];

			let priorityMatch = false;
			if (activePriorities.includes("all")) priorityMatch = true;
			if (activePriorities.includes("important_urgent") && hasImportant && hasUrgent) priorityMatch = true;
			if (activePriorities.includes("important") && hasImportant) priorityMatch = true;
			if (activePriorities.includes("urgent") && hasUrgent) priorityMatch = true;
			if (!priorityMatch) return false;

			if (this.filterFolder !== "all" && t.folder !== this.filterFolder) return false;
			if (this.searchQuery) {
				const query = this.searchQuery.toLowerCase();
				if (!t.text.toLowerCase().includes(query) && !t.file.basename.toLowerCase().includes(query)) {
					return false;
				}
			}
			return true;
		});

		const isVi = this.settings.language === "vi";

		if (filteredTasks.length === 0) {
			const emptyState = this.listContainer.createDiv();
			emptyState.setCssProps({ "display": "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", "height": "100%", "color": "var(--text-muted)", "opacity": "0.6" })
			const icon = emptyState.createSpan();
			setIcon(icon, "check-square");
			icon.setCssProps({ "transform": "scale(2)", "margin-bottom": "16px", "display": "flex", "align-items": "center", "justify-content": "center" })
			emptyState.createSpan({ text: isVi ? "Không tìm thấy tác vụ nào." : "No tasks found." });
			return;
		}

		if (this.viewMode === "kanban") {
			this.renderKanban(filteredTasks);
		} else {
			this.renderList(filteredTasks);
		}
	}

	private renderList(filteredTasks: TaskItem[]) {
		this.listContainer.setCssProps({ "flex-direction": "column" })
		this.listContainer.setCssProps({ "overflow-x": "hidden" })
		this.listContainer.setCssProps({ "padding": "0 4px 24px 0" })

		for (const task of filteredTasks) {
			const item = this.listContainer.createDiv();
			
			// Calculate depth
			let depth = task.level || 0;
			if (task.parentId) {
				depth = 0;
				let curr = task;
				const seen = new Set<string>();
				if (curr.id) seen.add(curr.id);
				
				while (curr.parentId) {
					const parent = this.tasks.find(t => t.id === curr.parentId);
					if (parent && (!parent.id || !seen.has(parent.id))) {
						depth++;
						curr = parent;
						if (curr.id) seen.add(curr.id);
					} else {
						break;
					}
				}
			}

			const indentPx = depth * 32;
			item.setCssProps({ "display": `flex`, "align-items": `flex-start`, "gap": `16px`, "padding": `16px 20px`, "margin-left": `${indentPx}px`, "background": `var(--background-primary)`, "border": `1px solid var(--background-modifier-border)`, "border-radius": `12px`, "transition": `all 0.2s ease`, "box-shadow": `0 1px 3px rgba(0,0,0,0.03)` })
			
			item.onmouseenter = () => {
				item.setCssProps({ "transform": "translateY(-1px)", "box-shadow": "0 6px 16px rgba(0,0,0,0.06)", "border-color": "var(--interactive-accent)" })
			};
			item.onmouseleave = () => {
				item.setCssProps({ "transform": "none", "box-shadow": "0 2px 4px rgba(0,0,0,0.02)", "border-color": "var(--background-modifier-border)" })
			};

			item.draggable = true;
			item.ondragstart = (e) => {
				if (e.dataTransfer) {
					e.dataTransfer.setData("application/json", JSON.stringify({ sourcePath: task.file.path, sourceLine: task.line, sourceId: task.id }));
					e.dataTransfer.effectAllowed = "move";
				}
				item.setCssProps({ "opacity": "0.5" })
			};
			item.ondragend = () => {
				item.setCssProps({ "opacity": "1" })
				this.listContainer.findAll('.flow-drag-over-top, .flow-drag-over-bottom, .flow-drag-over-center').forEach(el => {
					el.removeClass('flow-drag-over-top', 'flow-drag-over-bottom', 'flow-drag-over-center');
					el.setCssProps({ "border-top": "", "border-bottom": "", "background": "var(--background-primary)" })
				});
			};
			item.ondragover = (e) => {
				e.preventDefault();
				if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
				
				const rect = item.getBoundingClientRect();
				const y = e.clientY - rect.top;
				item.removeClass('flow-drag-over-top', 'flow-drag-over-bottom', 'flow-drag-over-center');
				item.setCssProps({ "border-top": "", "border-bottom": "", "background": "var(--background-primary)" })
				
				if (y < rect.height * 0.25) {
					item.addClass('flow-drag-over-top');
					item.setCssProps({ "border-top": "2px solid var(--interactive-accent)" })
				} else if (y > rect.height * 0.75) {
					item.addClass('flow-drag-over-bottom');
					item.setCssProps({ "border-bottom": "2px solid var(--interactive-accent)" })
				} else {
					item.addClass('flow-drag-over-center');
					item.setCssProps({ "background": "var(--background-modifier-hover)" })
				}
			};
			item.ondragleave = () => {
				item.removeClass('flow-drag-over-top', 'flow-drag-over-bottom', 'flow-drag-over-center');
				item.setCssProps({ "border-top": "", "border-bottom": "", "background": "var(--background-primary)" })
			};
			item.ondrop = (e) => {
				e.preventDefault();
				item.removeClass('flow-drag-over-top', 'flow-drag-over-bottom', 'flow-drag-over-center');
				item.setCssProps({ "border-top": "", "border-bottom": "", "background": "var(--background-primary)" })
				if (!e.dataTransfer) return;
				try {
					const dataStr = e.dataTransfer.getData("application/json");
					if (!dataStr) return;
					const data = JSON.parse(dataStr) as { sourcePath: string; sourceLine: number; sourceId?: string };
					if (data.sourcePath === task.file.path && data.sourceLine === task.line) return;
					
					const rect = item.getBoundingClientRect();
					const y = e.clientY - rect.top;
					let dropPosition: "top" | "bottom" | "center" = "center";
					if (y < rect.height * 0.25) dropPosition = "top";
					else if (y > rect.height * 0.75) dropPosition = "bottom";
					
					void (async () => {
						await this.handleTaskDrop(data, task, dropPosition);
					})();
				} catch (err) {
					console.error(err);
				}
			};

			const statusChar = task.status.trim().toLowerCase();
			const isDone = statusChar === "x";
			const isHidden = statusChar === "-";
			const isDoing = statusChar === "/";

			const checkbox = item.createEl("input", { type: "checkbox" });
			checkbox.checked = isDone;
			checkbox.setCssProps({ "margin-top": "3px", "cursor": "pointer", "width": "18px", "height": "18px", "border-radius": "6px", "accent-color": "var(--interactive-accent)", "flex-shrink": "0" })
			if (isHidden) {
				checkbox.disabled = true;
				checkbox.setCssProps({ "opacity": "0.5" })
			}
			
			const contentWrap = item.createDiv();
			contentWrap.setCssProps({ "flex": "1", "display": "flex", "flex-direction": "column", "gap": "4px" })

			let displayContent = task.text;
			const priorityMatch = displayContent.match(/#task\/(?:priority\/)?(p1|p2|p3|p4|important|urgent|quan-trong|khan-cap)/gi);
			const labelMatch = displayContent.match(/#task\/label\/([\w-]+)/g);
			const oldNakedImportant = displayContent.match(/#important|#quan-trong/gi);
			const oldNakedUrgent = displayContent.match(/#urgent|#khan-cap/gi);
			const reminderMatch = displayContent.match(/\(@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\)/);

			if (priorityMatch) {
				for (const p of priorityMatch) displayContent = displayContent.replace(p, "");
			}
			if (oldNakedImportant) {
				for (const p of oldNakedImportant) displayContent = displayContent.replace(p, "");
			}
			if (oldNakedUrgent) {
				for (const p of oldNakedUrgent) displayContent = displayContent.replace(p, "");
			}
			if (labelMatch) {
				for (const l of labelMatch) displayContent = displayContent.replace(l, "");
			}
			if (reminderMatch) displayContent = displayContent.replace(reminderMatch[0], "");
			
			// Remove any metadata IDs and Parents
			displayContent = displayContent.replace(/%%id:[^%]+%%/g, "");
			displayContent = displayContent.replace(/%%parent:[^%]+%%/g, "");
			displayContent = displayContent.replace(/%%recur:[^%]+%%/g, "");
			displayContent = displayContent.replace(/\?\?([\w-~+]+)/, "");

			displayContent = displayContent.replace(/\s+/g, " ").trim();

			const textDiv = contentWrap.createDiv();
			textDiv.textContent = displayContent.trim();
			textDiv.setCssProps({ "font-size": "1.05em", "font-weight": "700", "letter-spacing": "-0.01em", "line-height": "1.5", "color": "var(--text-normal)", "transition": "all 0.2s ease" })
			
			if (isDoing) {
				textDiv.setCssProps({ "color": "var(--interactive-accent)" })
			}
			if (isDone) {
				textDiv.setCssProps({ "text-decoration": "line-through" })
				textDiv.setCssProps({ "opacity": "0.5" })
			}

			checkbox.onchange = async () => {
					const activeStatuses = Array.isArray(this.settings.taskFilters!.status) 
						? this.settings.taskFilters!.status 
						: [this.settings.taskFilters!.status];
					
					const newStatus = checkbox.checked ? "x" : " ";
				
				if (newStatus === "x") {
					if (task.recur) {
						const recurRule = task.recur;
						let nextDateStr = moment().add(1, 'day').format("YYYY-MM-DD");
						
						let shouldRecur = true;
						if (recurRule && recurRule !== "~") {
							// If it's a specific date, stop recurring if we pass it
							if (nextDateStr > recurRule) {
								shouldRecur = false;
							}
						}
						
						if (shouldRecur) {
							const currentText = task.text;
							let newText = currentText;
							// Replace due date
							const dateMatch = currentText.match(/\(@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\)/);
							if (dateMatch && dateMatch[1]) {
								newText = currentText.replace(dateMatch[1], nextDateStr);
							} else {
								newText = currentText + ` (@${nextDateStr} 08:00)`;
							}
							
							// If it was raw text, convert to inline comment for the new task
							if (newText.match(/\?\?([\w-~+]+)/)) {
								newText = newText.replace(/\?\?([\w-~+]+)/, `%%recur:${recurRule}%%`);
							}
							
							await this.createTask(newText, nextDateStr);
						}
					}
				}

				await this.setTaskStatus(task.file, task.line, newStatus);
				task.status = newStatus;
				
				if (checkbox.checked && (activeStatuses.includes("todo") || activeStatuses.includes("doing"))) {
						item.setCssProps({ "display": "none" })
					} else if (!checkbox.checked && activeStatuses.includes("done")) {
						item.setCssProps({ "display": "none" })
					}
				textDiv.setCssProps({ "text-decoration": checkbox.checked ? "line-through" : "none" })
				textDiv.setCssProps({ "opacity": checkbox.checked ? "0.5" : "1" })
			};

			const metaDiv = contentWrap.createDiv();
			metaDiv.setCssProps({ "display": "flex", "align-items": "center", "gap": "8px", "font-size": "10px", "text-transform": "uppercase", "letter-spacing": "0.05em", "font-weight": "600", "color": "var(--text-muted)", "margin-top": "8px" })
			
			const isDateFile = /^\d{4}-\d{2}-\d{2}$/.test(task.file.basename);
			const fileBadge = metaDiv.createSpan();
			fileBadge.setCssProps({ "display": "flex", "align-items": "center", "gap": "4px", "color": "var(--text-accent)", "cursor": "pointer", "text-decoration": "none", "padding": "2px 8px", "background": "var(--background-primary)", "border-radius": "9999px", "transition": "all 0.2s" })
			const fileIcon = fileBadge.createSpan();
			setIcon(fileIcon, isDateFile ? "calendar" : "file-text");
			(fileIcon.querySelector("svg") as SVGElement)?.setAttribute("width", "12");
			(fileIcon.querySelector("svg") as SVGElement)?.setAttribute("height", "12");
			fileBadge.createSpan({ text: task.file.basename });
			
			fileBadge.onmouseenter = () => fileBadge.setCssProps({ "background": "var(--background-modifier-hover)" })
			fileBadge.onmouseleave = () => fileBadge.setCssProps({ "background": "var(--background-primary)" })
			fileBadge.onclick = async () => {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(task.file, { eState: { line: task.line } });
				this.closeModal();
			};

			if (task.recur) {
				const recurBadge = metaDiv.createSpan();
				recurBadge.setCssProps({ "display": "flex", "align-items": "center", "gap": "4px", "color": "var(--text-muted)", "background": "var(--background-modifier-hover)", "padding": "2px 8px", "border-radius": "9999px" })
				const recurIcon = recurBadge.createSpan();
				setIcon(recurIcon, "refresh-cw");
				(recurIcon.querySelector("svg") as SVGElement)?.setAttribute("width", "12");
				(recurIcon.querySelector("svg") as SVGElement)?.setAttribute("height", "12");
				if (task.recur !== "~") {
					recurBadge.createSpan({ text: task.recur });
				}
			}

			const priorities: string[] = [];
			if (priorityMatch) {
				for (const p of priorityMatch) {
					const val = p.split("/").pop();
					if (val) priorities.push(val.toLowerCase());
				}
			}
			if (oldNakedImportant) priorities.push("important");
			if (oldNakedUrgent) priorities.push("urgent");

			const createPriorityBadge = (text: string, iconName: string, color: string, bg: string) => {
				const badge = metaDiv.createSpan();
				badge.setCssProps({ "display": `flex`, "align-items": `center`, "gap": `4px`, "padding": `2px 8px`, "background": `${bg}`, "color": `${color}`, "border-radius": `9999px`, "font-weight": `600` })
				const icon = badge.createSpan();
				setIcon(icon, iconName);
				(icon.querySelector("svg") as SVGElement)?.setAttribute("width", "12");
				(icon.querySelector("svg") as SVGElement)?.setAttribute("height", "12");
				badge.createSpan({ text });
			};

			if (priorities.includes("p1") || (priorities.includes("important") && priorities.includes("urgent"))) {
				createPriorityBadge("P1", "alert-triangle", "#f44336", "rgba(244, 67, 54, 0.15)");
			} else if (priorities.includes("p2") || priorities.includes("important")) {
				createPriorityBadge("P2", "zap", "#ff9800", "rgba(255, 152, 0, 0.15)");
			} else if (priorities.includes("p3") || priorities.includes("urgent")) {
				createPriorityBadge("P3", "star", "#fbc02d", "rgba(255, 235, 59, 0.15)");
			} else if (priorities.includes("p4")) {
				createPriorityBadge("P4", "info", "var(--text-muted)", "var(--background-modifier-hover)");
			}

			if (labelMatch) {
				for (const l of labelMatch) {
					const val = l.split("/").pop();
					if (val) {
						const labelSpan = metaDiv.createSpan({ text: val });
						labelSpan.setCssProps({ "padding": "2px 8px", "background": "var(--background-secondary-alt)", "border": "1px solid var(--background-modifier-border)", "color": "var(--text-muted)", "border-radius": "4px", "font-size": "9px" })
					}
				}
			}
			if (reminderMatch) {
				const remDate = reminderMatch[1];
				const remTime = reminderMatch[2];
				const remSpan = metaDiv.createSpan();
				remSpan.setCssProps({ "display": "flex", "align-items": "center", "gap": "4px", "padding": "2px 8px", "background": "var(--background-modifier-hover)", "color": "var(--text-muted)", "border-radius": "9999px" })
				const iconSpan = remSpan.createSpan();
				setIcon(iconSpan, "bell");
				iconSpan.setCssProps({ "display": "flex" });
				(iconSpan.querySelector("svg") as SVGElement)?.setAttribute("width", "12");
				(iconSpan.querySelector("svg") as SVGElement)?.setAttribute("height", "12");
				
				if (remDate === task.file.basename) {
					remSpan.createSpan({ text: remTime });
				} else {
					remSpan.createSpan({ text: `${remDate} ${remTime}` });
				}
			}

			// Action icons wrapper
			const actionsDiv = metaDiv.createDiv();
			actionsDiv.setCssProps({ "display": "flex", "gap": "16px", "margin-left": "auto", "opacity": "0", "transition": "opacity 0.2s ease" }) 
			
			item.addEventListener("mouseenter", () => actionsDiv.setCssProps({ "opacity": "1" }));
			item.addEventListener("mouseleave", () => actionsDiv.setCssProps({ "opacity": "0" }));

			// Delete icon
			const deleteIcon = actionsDiv.createSpan();
			setIcon(deleteIcon, "trash-2");
			deleteIcon.setCssProps({ "cursor": "pointer", "opacity": "0.5", "transition": "opacity 0.2s", "display": "flex", "align-items": "center", "color": "var(--text-error)" })
			deleteIcon.onmouseenter = () => deleteIcon.setCssProps({ "opacity": "1" })
			deleteIcon.onmouseleave = () => deleteIcon.setCssProps({ "opacity": "0.5" })
			
			deleteIcon.onclick = async () => {
				await this.deleteTask(task.file, task.line);
				item.setCssProps({ "display": "none" })
			};

			// Hide icon
			const hideIcon = actionsDiv.createSpan();
			setIcon(hideIcon, isHidden ? "eye" : "eye-off");
			hideIcon.setCssProps({ "cursor": "pointer", "opacity": "0.5", "transition": "opacity 0.2s", "display": "flex", "align-items": "center", "color": "var(--text-muted)" })
			hideIcon.onmouseenter = () => hideIcon.setCssProps({ "opacity": "1" })
			hideIcon.onmouseleave = () => hideIcon.setCssProps({ "opacity": "0.5" })
			
			hideIcon.onclick = async () => {
				const newStatus = isHidden ? " " : "-";
				await this.setTaskStatus(task.file, task.line, newStatus);
				task.status = newStatus;
				item.setCssProps({ "display": "none" }) // Hide from current view
			};

			// Edit icon
			const editIcon = actionsDiv.createSpan();
			setIcon(editIcon, "pencil");
			editIcon.setCssProps({ "cursor": "pointer", "opacity": "0.5", "transition": "opacity 0.2s", "display": "flex", "align-items": "center", "color": "var(--text-muted)" })
			editIcon.onmouseenter = () => editIcon.setCssProps({ "opacity": "1" })
			editIcon.onmouseleave = () => editIcon.setCssProps({ "opacity": "0.5" })
			
			editIcon.onclick = () => {
				const input = contentWrap.createEl("input", { type: "text", value: task.text });
				input.setCssProps({ "width": "100%", "font-size": "1.05em", "font-weight": "700", "letter-spacing": "-0.01em", "line-height": "1.5", "color": "var(--text-normal)", "background": "transparent", "border": "none", "outline": "none", "border-bottom": "2px solid var(--interactive-accent)", "padding": "0", "margin": "0" })
				
				textDiv.setCssProps({ "display": "none" })
				contentWrap.insertBefore(input, textDiv);
				input.focus();

				const saveTask = async () => {
					const newText = input.value;
					input.remove();
					textDiv.setCssProps({ "display": "block" })
					if (newText !== task.text && newText.trim() !== "") {
						task.text = newText;
						await this.updateTaskText(task.file, task.line, newText);
						await this.loadTasks();
						void this.renderTaskList();
					}
				};

				input.onblur = () => saveTask();
				input.onkeydown = (e) => {
					if (e.key === "Enter") {
						input.blur();
					} else if (e.key === "Escape") {
						input.value = task.text; // reset
						input.blur();
					}
				};
			};
		}
	}

	private async setTaskStatus(file: TFile, lineNum: number, statusChar: string) {
		await this.app.vault.process(file, (content) => {
			const lines = content.split('\n');
			if (lines[lineNum] !== undefined) {
				const line = lines[lineNum];
				lines[lineNum] = line.replace(/\[.\]/, `[${statusChar}]`);
			}
			return lines.join('\n');
		});
	}

	private async deleteTask(file: TFile, lineNum: number) {
		await this.app.vault.process(file, (content) => {
			const lines = content.split('\n');
			if (lines[lineNum] !== undefined) {
				lines.splice(lineNum, 1);
			}
			return lines.join('\n');
		});
	}

	private async updateTaskText(file: TFile, lineNum: number, newText: string) {
		await this.app.vault.process(file, (content) => {
			const lines = content.split('\n');
			if (lines[lineNum] !== undefined) {
				const line = lines[lineNum];
				// Match the `- [ ] ` or `- [x] ` part and capture it, then append new text
				lines[lineNum] = line.replace(/(-\s*\[.*?\]\s*).*/, "$1" + newText);
			}
			return lines.join('\n');
		});
	}

	private async ensureFolderExists(folderPath: string) {
		const parts = folderPath.split('/');
		let currentPath = '';
		for (const part of parts) {
			currentPath = currentPath === '' ? part : `${currentPath}/${part}`;
			if (!this.app.vault.getAbstractFileByPath(currentPath)) {
				try {
					await this.app.vault.createFolder(currentPath);
				} catch (e) {
					console.error(`Failed to create folder ${currentPath}:`, e);
				}
			}
		}
	}

	private async handleTaskDrop(sourceData: { sourcePath: string; sourceLine: number; sourceId?: string }, targetTask: TaskItem, dropPosition: "top" | "bottom" | "center") {
		const sourceTask = this.tasks.find(t => t.file.path === sourceData.sourcePath && t.line === sourceData.sourceLine);
		if (!sourceTask) return;

		if (dropPosition === "center") {
			const isVi = this.settings.language === "vi";
			if (!targetTask.id) {
				targetTask.id = Date.now().toString(36);
				await this.app.vault.process(targetTask.file, (content) => {
					const lines = content.split('\n');
					if (lines[targetTask.line]) {
						lines[targetTask.line] = lines[targetTask.line] + ` %%id:${targetTask.id}%%`;
					}
					return lines.join('\n');
				});
			}
			
			await this.app.vault.process(sourceTask.file, (content) => {
				const lines = content.split('\n');
				const lineStr = lines[sourceTask.line];
				if (lineStr !== undefined) {
					lines[sourceTask.line] = lineStr.replace(/\s*%%parent:[^%]+%%\s*/g, ' ') + ` %%parent:${targetTask.id}%%`;
				}
				return lines.join('\n');
			});
			
			new Notice(isVi ? "Đã liên kết tác vụ con" : "Linked as subtask");
			await this.loadTasks();
			void this.renderTaskList();
			return;
		}

		if (sourceTask.file.path !== targetTask.file.path) {
			const isVi = this.settings.language === "vi";
			new Notice(isVi ? "Chỉ hỗ trợ sắp xếp ngang hàng trong cùng một file." : "Can only reorder tasks within the same file.");
			return;
		}

		await this.app.vault.process(sourceTask.file, (content) => {
			const lines = content.split('\n');
			
			const getBlockLength = (startLine: number) => {
				if (startLine >= lines.length) return 0;
				const startLineStr = lines[startLine];
				if (startLineStr === undefined) return 0;
				const baseIndentMatch = startLineStr.match(/^([ \t]*)/);
				const baseIndent = (baseIndentMatch && baseIndentMatch[1]) ? baseIndentMatch[1].length : 0;
				let i = startLine + 1;
				while (i < lines.length) {
					const lineStr = lines[i];
					if (lineStr === undefined) break;
					if (lineStr.trim() === "") { i++; continue; }
					const indentMatch = lineStr.match(/^([ \t]*)/);
					const indent = (indentMatch && indentMatch[1]) ? indentMatch[1].length : 0;
					if (indent <= baseIndent && lineStr.match(/^([ \t]*)[-*+]/)) break;
					if (indent <= baseIndent && lineStr.trim() !== "") break;
					i++;
				}
				return i - startLine;
			};

			const sourceLine = sourceTask.line;
			let targetLine = targetTask.line;
			
			const sourceLength = getBlockLength(sourceLine);
			const targetLength = getBlockLength(targetLine);
			
			const sourceBlock = lines.splice(sourceLine, sourceLength);
			
			if (sourceLine < targetLine) {
				targetLine -= sourceLength;
			}
			
			let insertIndex = dropPosition === "top" ? targetLine : targetLine + targetLength;
			
			const targetLineContent = lines[targetLine < lines.length ? targetLine : lines.length - 1];
			const targetIndentMatch = targetLineContent ? targetLineContent.match(/^([ \t]*)/) : null;
			const targetIndentStr: string = (targetIndentMatch && targetIndentMatch[1]) ? targetIndentMatch[1] : "";
			const sourceIndentMatch = sourceBlock[0] ? sourceBlock[0].match(/^([ \t]*)/) : null;
			const sourceIndentStr: string = (sourceIndentMatch && sourceIndentMatch[1]) ? sourceIndentMatch[1] : "";
			
			if (targetIndentStr !== sourceIndentStr) {
				for (let i = 0; i < sourceBlock.length; i++) {
					const blockStr = sourceBlock[i];
					if (blockStr !== undefined && blockStr.startsWith(sourceIndentStr)) {
						sourceBlock[i] = targetIndentStr + blockStr.substring(sourceIndentStr.length);
					}
				}
			}

			lines.splice(insertIndex, 0, ...sourceBlock);
			return lines.join('\n');
		});
		
		await this.loadTasks();
		void this.renderTaskList();
	}

	private renderKanban(filteredTasks: TaskItem[]) {
		this.listContainer.setCssProps({ "flex-direction": "row" })
		this.listContainer.setCssProps({ "overflow-x": "auto" })
		this.listContainer.setCssProps({ "padding": "4px" })

		const isVi = this.settings.language === "vi";
		
		const columns = [
			{ id: " ", title: isVi ? "Chưa làm" : "To Do", color: "var(--text-muted)" },
			{ id: "/", title: isVi ? "Đang làm" : "Doing", color: "var(--color-yellow)" },
			{ id: "x", title: isVi ? "Đã xong" : "Done", color: "var(--color-green)" },
		];

		for (const col of columns) {
			const colDiv = this.listContainer.createDiv();
			colDiv.setCssProps({ "flex": "1", "min-width": "280px", "max-width": "400px", "display": "flex", "flex-direction": "column", "background": "var(--background-secondary)", "border-radius": "12px", "border": "1px solid var(--background-modifier-border)", "overflow": "hidden", "max-height": "100%" })
			
			const header = colDiv.createDiv();
			header.setCssProps({ "padding": `12px 16px`, "font-weight": `600`, "font-size": `0.9em`, "border-bottom": `1px solid var(--background-modifier-border)`, "color": `${col.color}`, "display": `flex`, "justify-content": `space-between` })
			
			const colTasks = filteredTasks.filter(t => t.status.trim().toLowerCase() === col.id || (col.id === " " && t.status.trim() === ""));
			
			header.createSpan({ text: col.title });
			const countBadge = header.createSpan({ text: colTasks.length.toString() });
			countBadge.setCssProps({ "background": "var(--background-modifier-form-field)", "padding": "2px 8px", "border-radius": "12px", "font-size": "0.8em", "color": "var(--text-muted)" })

			const cardsContainer = colDiv.createDiv();
			cardsContainer.setCssProps({ "flex": "1", "overflow-y": "auto", "padding": "12px", "display": "flex", "flex-direction": "column", "gap": "8px" })
			
			// Setup Drop Zone
			cardsContainer.ondragover = (e) => {
				e.preventDefault();
				cardsContainer.setCssProps({ "background": "var(--background-modifier-hover)" })
			};
			cardsContainer.ondragleave = () => {
				cardsContainer.setCssProps({ "background": "transparent" })
			};
			cardsContainer.ondrop = async (e) => {
				e.preventDefault();
				cardsContainer.setCssProps({ "background": "transparent" })
				const taskId = e.dataTransfer?.getData("text/plain");
				if (!taskId) return;
				
				const task = this.tasks.find(t => `${t.file.path}:${t.line}` === taskId);
				if (task && task.status !== col.id) {
					task.status = col.id;
					void this.renderTaskList();
					
					await this.app.vault.process(task.file, (content) => {
						const lines = content.split('\n');
						const targetLine = lines[task.line];
						if (targetLine !== undefined) {
							lines[task.line] = targetLine.replace(/\[.\]/, `[${col.id}]`);
						}
						return lines.join('\n');
					});
				}
			};

			for (const task of colTasks) {
				const card = cardsContainer.createDiv();
				card.setCssProps({ "display": "flex", "flex-direction": "column", "gap": "8px", "padding": "12px", "background": "var(--background-primary)", "border": "1px solid var(--background-modifier-border)", "border-radius": "8px", "cursor": "grab", "box-shadow": "0 1px 2px rgba(0,0,0,0.02)", "transition": "transform 0.1s, box-shadow 0.1s" })
				
				card.draggable = true;
				card.ondragstart = (e) => {
					card.setCssProps({ "opacity": "0.5" })
					e.dataTransfer?.setData("text/plain", `${task.file.path}:${task.line}`);
				};
				card.ondragend = () => {
					card.setCssProps({ "opacity": "1" })
				};
				
				card.onmouseenter = () => {
					card.setCssProps({ "transform": "translateY(-1px)" })
					card.setCssProps({ "box-shadow": "0 4px 12px rgba(0,0,0,0.05)" })
				};
				card.onmouseleave = () => {
					card.setCssProps({ "transform": "none" })
					card.setCssProps({ "box-shadow": "0 1px 2px rgba(0,0,0,0.02)" })
				};

				this.renderTaskItemContent(card, task, isVi, true);
			}
		}
	}

	private renderTaskItemContent(item: HTMLElement, task: TaskItem, isVi: boolean, isKanbanCard: boolean = false) {
		const statusChar = task.status.trim().toLowerCase();
		
		const checkboxWrap = item.createDiv();
		if (!isKanbanCard) {
			checkboxWrap.setCssProps({ "flex-shrink": "0", "cursor": "pointer", "width": "24px", "height": "24px", "border-radius": "6px", "border": "2px solid var(--background-modifier-border)", "display": "flex", "align-items": "center", "justify-content": "center", "transition": "all 0.2s ease", "background": "var(--background-primary)", "margin-top": "2px" })
		} else {
			checkboxWrap.setCssProps({ "flex-shrink": "0", "cursor": "pointer", "width": "20px", "height": "20px", "border-radius": "5px", "border": "2px solid var(--background-modifier-border)", "display": "flex", "align-items": "center", "justify-content": "center", "transition": "all 0.2s ease", "background": "var(--background-primary)" })
		}

		if (statusChar === "x") {
			checkboxWrap.setCssProps({ "background": "var(--interactive-accent)" })
			checkboxWrap.setCssProps({ "border-color": "var(--interactive-accent)" })
			const icon = checkboxWrap.createSpan();
			setIcon(icon, "check");
			icon.setCssProps({ "color": "var(--text-on-accent)" });
			(icon.querySelector("svg") as SVGElement)?.setAttribute("width", isKanbanCard ? "12" : "14");
			(icon.querySelector("svg") as SVGElement)?.setAttribute("height", isKanbanCard ? "12" : "14");
		} else if (statusChar === "/") {
			checkboxWrap.setCssProps({ "border-color": "var(--color-yellow)" })
			const icon = checkboxWrap.createSpan();
			setIcon(icon, "minus");
			icon.setCssProps({ "color": "var(--color-yellow)" })
		} else if (statusChar === "-") {
			checkboxWrap.setCssProps({ "background": "var(--background-modifier-border)" })
			const icon = checkboxWrap.createSpan();
			setIcon(icon, "x");
			icon.setCssProps({ "color": "var(--text-muted)" });
			(icon.querySelector("svg") as SVGElement)?.setAttribute("width", isKanbanCard ? "12" : "14");
			(icon.querySelector("svg") as SVGElement)?.setAttribute("height", isKanbanCard ? "12" : "14");
		}

		checkboxWrap.onclick = async (e) => {
			e.stopPropagation();
			let nextStatus = "x";
			if (statusChar === " ") nextStatus = "/";
			else if (statusChar === "/") nextStatus = "x";
			else if (statusChar === "x") nextStatus = " ";
			else if (statusChar === "-") nextStatus = " ";
			
			// optimistic UI
			task.status = nextStatus;
			if (this.viewMode === "kanban") {
				void this.renderTaskList(); // Re-render to move columns
			} else {
				void this.renderTaskList(); // Simple re-render
			}
			
			await this.app.vault.process(task.file, (content) => {
				const lines = content.split('\n');
				const targetLine = lines[task.line];
				if (targetLine !== undefined) {
					lines[task.line] = targetLine.replace(/\[.\]/, `[${nextStatus}]`);
				}
				return lines.join('\n');
			});
		};

		const contentDiv = item.createDiv();
		contentDiv.setCssProps({ "flex": "1", "display": "flex", "flex-direction": "column", "gap": "6px", "min-width": "0" })

		let displayText = task.text;
		const dateMatch = displayText.match(/(\d{4}-\d{2}-\d{2})/);
		const taskDate = dateMatch ? dateMatch[1] : null;

		let isUrgent = false;
		let isImportant = false;

		const tags = [...displayText.matchAll(/#[\w/-]+/g)].map(m => m[0]);
		for (const tag of tags) {
			if (tag.includes("urgent")) {
				isUrgent = true;
				displayText = displayText.replace(tag, "");
			} else if (tag.includes("important")) {
				isImportant = true;
				displayText = displayText.replace(tag, "");
			} else {
				// Also strip generic tracking tags
				displayText = displayText.replace(tag, "");
			}
		}

		// Clean up metadata
		displayText = displayText.replace(/%%[^%]+%%/g, "");
		displayText = displayText.replace(/\(@[^)]+\)/g, "");
		displayText = displayText.replace(/\?\?([\w-~+]+)/, "");
		
		const titleEl = contentDiv.createDiv({ text: displayText.trim() });
		titleEl.setCssProps({ "font-size": "1em", "color": "var(--text-normal)", "line-height": "1.4", "word-wrap": "break-word" })
		if (statusChar === "x") {
			titleEl.setCssProps({ "text-decoration": "line-through" })
			titleEl.setCssProps({ "color": "var(--text-muted)" })
		} else if (statusChar === "-") {
			titleEl.setCssProps({ "text-decoration": "line-through" })
			titleEl.setCssProps({ "color": "var(--text-faint)" })
		}

		const metaDiv = contentDiv.createDiv();
		metaDiv.setCssProps({ "display": "flex", "flex-wrap": "wrap", "gap": "8px", "align-items": "center", "font-size": "0.8em" })

		if (isImportant || isUrgent) {
			const badge = metaDiv.createSpan();
			badge.setCssProps({ "padding": "2px 6px", "border-radius": "6px", "font-weight": "600", "display": "flex", "align-items": "center", "gap": "4px" })
			
			const icon = badge.createSpan();
			icon.setCssProps({ "display": "flex" })
			
			if (isImportant && isUrgent) {
				badge.setCssProps({ "background": "rgba(244, 67, 54, 0.15)" })
				badge.setCssProps({ "color": "#f44336" })
				setIcon(icon, "alert-triangle");
				badge.appendChild(icon);
				badge.createSpan({ text: "P1" });
			} else if (isUrgent) {
				badge.setCssProps({ "background": "rgba(255, 152, 0, 0.15)" })
				badge.setCssProps({ "color": "#ff9800" })
				setIcon(icon, "zap");
				badge.appendChild(icon);
				badge.createSpan({ text: "P2" });
			} else if (isImportant) {
				badge.setCssProps({ "background": "rgba(255, 235, 59, 0.15)" })
				badge.setCssProps({ "color": "#fbc02d" })
				setIcon(icon, "star");
				badge.appendChild(icon);
				badge.createSpan({ text: "P3" });
			}
			
			(icon.querySelector("svg") as SVGElement)?.setAttribute("width", "12");
			(icon.querySelector("svg") as SVGElement)?.setAttribute("height", "12");
		}

		if (taskDate && taskDate !== task.file.basename) {
			const dateBadge = metaDiv.createSpan();
			dateBadge.setCssProps({ "display": "flex", "align-items": "center", "gap": "4px", "padding": "2px 6px", "border-radius": "6px", "background": "var(--background-secondary)", "color": "var(--text-muted)", "font-size": "0.9em" })
			const dateIcon = dateBadge.createSpan();
			setIcon(dateIcon, "calendar");
			(dateIcon.querySelector("svg") as SVGElement)?.setAttribute("width", "12");
			(dateIcon.querySelector("svg") as SVGElement)?.setAttribute("height", "12");
			dateBadge.createSpan({ text: taskDate });
			
			const today = window.moment().format("YYYY-MM-DD");
			if (taskDate < today && statusChar !== "x" && statusChar !== "-") {
				dateBadge.setCssProps({ "color": "var(--text-error)" })
				dateBadge.setCssProps({ "background": "rgba(244, 67, 54, 0.1)" }) // Soft red
				dateBadge.setCssProps({ "border": "1px solid rgba(244, 67, 54, 0.2)" })
			}
		}

		if (task.recur) {
			const shouldShowRecurText = task.recur !== "~" && task.recur !== taskDate;
			const shouldShowRecurIconOnly = task.recur === "~";
			
			if (shouldShowRecurText || shouldShowRecurIconOnly) {
				const recurBadge = metaDiv.createSpan();
				recurBadge.setCssProps({ "display": "flex", "align-items": "center", "gap": "4px", "color": "var(--text-muted)", "background": "var(--background-modifier-hover)", "padding": "2px 6px", "border-radius": "6px", "font-size": "0.9em" })
				const recurIcon = recurBadge.createSpan();
				setIcon(recurIcon, "refresh-cw");
				(recurIcon.querySelector("svg") as SVGElement)?.setAttribute("width", "12");
				(recurIcon.querySelector("svg") as SVGElement)?.setAttribute("height", "12");
				if (shouldShowRecurText) {
					recurBadge.createSpan({ text: task.recur });
				}
			}
		}

		const isDateFile = /^\d{4}-\d{2}-\d{2}$/.test(task.file.basename);
		let shouldShowFolder = true;
		if (isKanbanCard && isDateFile) {
			shouldShowFolder = false;
		}

		if (shouldShowFolder) {
			const folderBadge = metaDiv.createSpan();
			folderBadge.setCssProps({ "display": "flex", "align-items": "center", "gap": "4px", "color": "var(--text-faint)", "font-size": "0.9em" })
			const folderIcon = folderBadge.createSpan();
			
			setIcon(folderIcon, isDateFile ? "calendar" : "file-text");
			
			(folderIcon.querySelector("svg") as SVGElement)?.setAttribute("width", "12");
			(folderIcon.querySelector("svg") as SVGElement)?.setAttribute("height", "12");
			folderBadge.createSpan({ text: task.file.basename });
		}

		// Click to open file
		item.onclick = (e) => {
			if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).closest('input[type="checkbox"]')) return;
			void this.app.workspace.getLeaf(false).openFile(task.file, { eState: { line: task.line } });
			this.closeModal();
		};
	}

	private getTrackFolder(): string {
		const configured = this.settings.folderMap[FlowRole.TRACK];
		if (configured && configured !== "2. Track") {
			return configured;
		}
		const trackFile = this.app.vault.getAbstractFileByPath("2. Track");
		if (trackFile) return "2. Track";

		const appWithPlugins = this.app as App & { internalPlugins?: { plugins?: Record<string, { enabled?: boolean, instance?: { options?: { folder?: string } } }> } };
		const dailyNotesPlugin = appWithPlugins.internalPlugins?.plugins?.["daily-notes"];
		if (dailyNotesPlugin?.enabled && dailyNotesPlugin.instance?.options?.folder) {
			return dailyNotesPlugin.instance.options.folder;
		}

		return configured || "2. Track";
	}

	private async createTask(text: string, dateStr: string) {
		const parentMatch = text.match(/%%parent:([^%]+)%%/);
		if (parentMatch) {
			const parentId = parentMatch[1];
			const parentTask = this.tasks.find(t => t.id === parentId);
			if (parentTask && parentTask.file instanceof TFile) {
				await this.app.vault.process(parentTask.file, (content) => {
					const lines = content.split('\n');
					let parentLineIdx = lines.findIndex(l => l.includes(`%%id:${parentId}%%`));
					if (parentLineIdx === -1) parentLineIdx = parentTask.line;
					
					if (parentLineIdx !== -1 && parentLineIdx < lines.length) {
						const parentLine = lines[parentLineIdx];
						if (parentLine !== undefined) {
							const indentMatch = parentLine.match(/^(\s*)/);
							const parentIndent = indentMatch ? indentMatch[1] : "";
							if (parentIndent !== undefined) {
								const newIndent = parentIndent + "\t"; 
								const taskLine = `${newIndent}- [ ] ${text}`;

								let insertIdx = parentLineIdx + 1;
								while (insertIdx < lines.length) {
									const nextLine = lines[insertIdx];
									if (nextLine === undefined) break;
									if (nextLine.trim() === "") {
										insertIdx++;
										continue;
									}
									
									if (nextLine.startsWith(parentIndent) && nextLine.length > parentIndent.length && /^\s/.test(nextLine.substring(parentIndent.length))) {
										insertIdx++;
									} else {
										break;
									}
								}
								lines.splice(insertIdx, 0, taskLine);
							}
						}
					}
					return lines.join('\n');
				});
				return;
			}
		}

		const trackFolder = this.getTrackFolder();
		const filePath = `${trackFolder}/${dateStr}.md`;

		await this.ensureFolderExists(trackFolder);

		let file = this.app.vault.getAbstractFileByPath(filePath);
		
		const isVi = this.settings.language === "vi";
		const taskHeader = isVi ? "## Nhiệm vụ" : "## Tasks";

		if (file instanceof TFile) {
			// Append to existing
			await this.app.vault.process(file, (content) => {
				const lines = content.split('\n');
				const taskLine = `- [ ] ${text}`;
				
				// Find ## Tasks or ## Nhiệm vụ
				const headerIdx = lines.findIndex(l => l.match(/^##\s+(Tasks|Nhiệm vụ)/i));
				if (headerIdx !== -1) {
					// Insert right after the header
					lines.splice(headerIdx + 1, 0, taskLine);
				} else {
					// Just append to end if no tasks header, but try to find a place
					if (lines[lines.length - 1] !== "") lines.push("");
					lines.push(taskHeader);
					lines.push(taskLine);
				}
				return lines.join('\n');
			});
		} else {
			// Create new
			const content = `${taskHeader}\n- [ ] ${text}\n`;
			try {
				await this.app.vault.create(filePath, content);
			} catch (e) {
				console.error("Failed to create file:", e);
				new Notice("Failed to create daily note for task.");
			}
		}
	}
}
