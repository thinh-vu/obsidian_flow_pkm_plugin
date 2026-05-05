import { App, ItemView, WorkspaceLeaf, setIcon, TFile, moment } from "obsidian";
import { FlowPluginSettings, FlowRole } from "../../../types";
import { VIEW_TYPE_TASK_SIDEBAR } from "../../../constants";

export interface TaskItem {
	file: TFile;
	line: number;
	text: string;
	status: string;
	folder: string;
    dueDate?: string;
    level?: number;
	id?: string;
	parentId?: string;
}

export class TaskSidebarView extends ItemView {
	private settings: FlowPluginSettings;
	private tasks: TaskItem[] = [];
	private activeFilter: "today" | "tomorrow" | "other" = "today";
    private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    private quickInputEl: HTMLInputElement | null = null;

	constructor(leaf: WorkspaceLeaf, settings: FlowPluginSettings) {
		super(leaf);
		this.settings = settings;
	}

	getViewType() {
		return VIEW_TYPE_TASK_SIDEBAR;
	}

	getDisplayText() {
		return this.settings.language === "vi" ? "Tập trung hôm nay" : "Focus On Today";
	}

    getIcon() {
        return "check-square";
    }

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("flow-sidebar-task-view");
        container.setCssProps({ "padding": "20px 16px" })
        container.setCssProps({ "display": "flex" })
        container.setCssProps({ "flex-direction": "column" })
        container.setCssProps({ "gap": "24px" })
        container.setCssProps({ "background": "var(--background-secondary)" })

        this.registerEvent(
            this.app.metadataCache.on("changed", () => {
                this.requestRefresh();
            })
        );

        this.registerEvent(
            this.app.vault.on("delete", () => {
                this.requestRefresh();
            })
        );

        await this.refresh();
	}

    public requestRefresh() {
        if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
        this.refreshTimeout = setTimeout(() => {
            // Do not refresh if user is typing to avoid stealing focus
            if (this.quickInputEl && document.activeElement === this.quickInputEl) {
                return;
            }
            void this.refresh();
        }, 1000);
    }

    public async refresh() {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();

		// Cập nhật lại title của tab nếu có thể
		const titleEl = this.containerEl.querySelector(".view-header-title");
		if (titleEl) {
			titleEl.textContent = this.getDisplayText();
		}

        await this.loadTasks();
        this.renderHeader(container);
        this.renderStats(container);
        this.renderQuickInput(container);
        this.renderTimeline(container);
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

                // Parse due date from (@YYYY-MM-DD ...)
                const reminderMatch = text.match(/\(@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\)/);
                let dueDate = reminderMatch ? reminderMatch[1] : undefined;

                // Fallback to filename if in Track folder
                if (!dueDate && file.path.includes(this.settings.folderMap[FlowRole.TRACK])) {
                    const dateMatch = file.basename.match(/^\d{4}-\d{2}-\d{2}$/);
                    if (dateMatch) dueDate = dateMatch[0];
                }

				const idMatch = text.match(/%%id:([^%]+)%%/);
				const parentMatch = text.match(/%%parent:([^%]+)%%/);
				const id = idMatch ? idMatch[1] : undefined;
				const parentId = parentMatch ? parentMatch[1] : undefined;

				this.tasks.push({
					file,
					line: lineNum,
					text,
					status: li.task || " ",
					folder: file.parent?.path || "/",
                    dueDate,
                    level,
					id,
					parentId
				});
			}
		}
	}

    private renderHeader(container: HTMLElement) {
        const header = container.createDiv();
        header.setCssProps({ "text-align": "center" })
        header.setCssProps({ "margin": "10px 0" })

        const title = header.createEl("h2", { text: "Focus on today" });
        title.setCssProps({ "font-size": "24px", "font-weight": "800", "color": "#00b4ff", "margin": "0", "letter-spacing": "-0.02em" })
        
        if (this.settings.language === "vi") {
            title.textContent = "Tập trung hôm nay";
        }
    }

    private renderStats(container: HTMLElement) {
        const statsRow = container.createDiv();
        statsRow.setCssProps({ "display": "flex", "gap": "10px", "justify-content": "space-between" })

        const today = moment().format("YYYY-MM-DD");
        const isUncompleted = (t: TaskItem) => t.status.toLowerCase() !== "x" && t.status !== "-";
        const todoTasks = this.tasks.filter(t => isUncompleted(t) && t.dueDate === today);
        const overdueTasks = this.tasks.filter(t => isUncompleted(t) && t.dueDate && t.dueDate < today);

        const createCard = (label: string, count: number, color: string, subLabel: string) => {
            const card = statsRow.createDiv();
            card.setCssProps({ "flex": `1`, "background": `transparent`, "padding": `4px`, "text-align": `center`, "border-bottom": `2px solid ${color}`, "display": `flex`, "flex-direction": `column`, "gap": `2px` })
            
            const val = card.createDiv();
            val.setCssProps({ "font-size": "24px", "font-weight": "300", "color": "var(--text-normal)" })
            val.textContent = String(count);

            const lbl = card.createDiv();
            lbl.setCssProps({ "font-size": `10px`, "font-weight": `600`, "color": `${color}`, "text-transform": `uppercase`, "letter-spacing": `0.05em` })
            lbl.textContent = subLabel;
        };

        const isVi = this.settings.language === "vi";
        createCard("Todo", todoTasks.length, "var(--interactive-accent)", isVi ? "Cần làm" : "Todo");
        createCard("Overdue", overdueTasks.length, "var(--text-error)", isVi ? "Quá hạn" : "Overdue");
    }

    private renderQuickInput(container: HTMLElement) {
        const inputWrap = container.createDiv();
        inputWrap.setCssProps({ "display": "flex", "align-items": "center", "background": "var(--background-modifier-form-field)", "border-radius": "8px", "padding": "8px 12px", "gap": "8px", "border": "1px solid var(--background-modifier-border)", "transition": "border-color 0.2s" })

        const addIcon = inputWrap.createSpan();
        setIcon(addIcon, "plus");
        addIcon.setCssProps({ "color": "var(--text-muted)", "opacity": "0.7", "display": "flex" });
        (addIcon.querySelector("svg") as SVGElement)?.setAttribute("width", "16");
        (addIcon.querySelector("svg") as SVGElement)?.setAttribute("height", "16");

        const isVi = this.settings.language === "vi";
        const input = inputWrap.createEl("input", { type: "text", placeholder: isVi ? "Nhập tác vụ mới..." : "New task..." });
        input.setCssProps({ "flex": "1", "border": "none", "background": "transparent", "color": "var(--text-normal)", "font-size": "14px", "outline": "none", "padding": "0" })
        this.quickInputEl = input;
        
        input.onfocus = () => inputWrap.setCssProps({ "border-color": "var(--interactive-accent)" })
        input.onblur = () => {
            inputWrap.setCssProps({ "border-color": "var(--background-modifier-border)" })
            // If we missed a refresh while focused, do it now
            setTimeout(() => this.requestRefresh(), 200);
        };

        input.onkeydown = async (e) => {
            if (e.key === "Enter" && input.value.trim()) {
                const raw = input.value.trim();
                input.value = "";
                
                const todayStr = moment().format("YYYY-MM-DD");
                const { text, targetDateStr } = this.parseSimple(raw, todayStr);
                
                await this.createTask(text, targetDateStr);
                await this.refresh();
            }
        };
    }

    private renderTimeline(container: HTMLElement) {
        const isVi = this.settings.language === "vi";

        // Filter Bar
        const filterBar = container.createDiv();
        filterBar.setCssProps({ "display": "flex", "gap": "8px", "margin-bottom": "4px", "border-bottom": "1px solid var(--background-modifier-border)", "padding-bottom": "8px" })
        
        const createFilterBtn = (id: "today" | "tomorrow" | "other", label: string) => {
            const btn = filterBar.createEl("button");
            btn.textContent = label;
            btn.setCssProps({ "flex": "1", "padding": "4px 8px", "border-radius": "6px", "font-size": "12px", "font-weight": "600", "cursor": "pointer", "transition": "all 0.2s", "background": "transparent", "box-shadow": "none", "border": "none" })
            
            if (this.activeFilter === id) {
                btn.setCssProps({ "background": "var(--interactive-accent)" })
                btn.setCssProps({ "color": "var(--text-on-accent)" })
            } else {
                btn.setCssProps({ "color": "var(--text-muted)" })
                btn.onmouseenter = () => btn.setCssProps({ "color": "var(--text-normal)" })
                btn.onmouseleave = () => btn.setCssProps({ "color": "var(--text-muted)" })
            }

            btn.onclick = () => {
                this.activeFilter = id;
                void this.refresh();
            };
        };

        createFilterBtn("today", isVi ? "Hôm nay" : "Today");
        createFilterBtn("tomorrow", isVi ? "Ngày mai" : "Tomorrow");
        createFilterBtn("other", isVi ? "Khác" : "Other");

        const timeline = container.createDiv();
        timeline.setCssProps({ "flex": "1", "overflow-y": "auto", "display": "flex", "flex-direction": "column", "gap": "12px", "padding-right": "4px" })

        const today = moment().format("YYYY-MM-DD");
        const tomorrow = moment().add(1, 'day').format("YYYY-MM-DD");

        let displayList: TaskItem[] = [];
        let overdueList: TaskItem[] = [];

        const isUncompleted = (t: TaskItem) => t.status.toLowerCase() !== "x" && t.status !== "-";

        if (this.activeFilter === "today") {
            displayList = this.tasks.filter(t => isUncompleted(t) && t.dueDate === today);
            overdueList = this.tasks.filter(t => isUncompleted(t) && t.dueDate && t.dueDate < today);
        } else if (this.activeFilter === "tomorrow") {
            displayList = this.tasks.filter(t => isUncompleted(t) && t.dueDate === tomorrow);
        } else {
            displayList = this.tasks.filter(t => isUncompleted(t) && (!t.dueDate || t.dueDate > tomorrow));
        }

        const renderSection = (title: string, list: TaskItem[], color: string) => {
            if (list.length === 0) return;
            const sec = timeline.createDiv();
            const h = sec.createEl("h3", { text: title });
            h.setCssProps({ "font-size": `10px`, "font-weight": `700`, "text-transform": `uppercase`, "color": `${color}`, "letter-spacing": `0.05em`, "margin": `4px 0`, "opacity": `0.8` })

            for (const t of list) {
                const item = sec.createDiv();

				let depth = t.level || 0;
				if (t.parentId) {
					depth = 0;
					let curr = t;
					const seen = new Set<string>();
					if (curr.id) seen.add(curr.id);
					
					while (curr.parentId) {
						const parent = this.tasks.find(pt => pt.id === curr.parentId);
						if (parent && (!parent.id || !seen.has(parent.id))) {
							depth++;
							curr = parent;
							if (curr.id) seen.add(curr.id);
						} else {
							break;
						}
					}
				}

                const indentPx = depth * 20;
                item.setCssProps({ "display": `flex`, "gap": `10px`, "align-items": `flex-start`, "padding": `6px 0`, "border-bottom": `1px solid var(--background-modifier-border)`, "margin-left": `${indentPx}px` })
                // remove bottom border from last item if needed, but keeping it simple

                const checkbox = item.createEl("input", { type: "checkbox" });
                checkbox.setCssProps({ "width": "14px", "height": "14px", "border-radius": "4px", "accent-color": "var(--interactive-accent)", "cursor": "pointer", "flex-shrink": "0", "margin-top": "3px" })
                
                checkbox.onchange = async () => {
                    const newStatus = checkbox.checked ? "x" : " ";
                    
                    if (newStatus === "x") {
                        const recurMatch = t.text.match(/\?\?([\w-~]*)/);
                        if (recurMatch) {
                            const recurRule = recurMatch[1];
                            let nextDateStr = moment().add(1, 'day').format("YYYY-MM-DD");
                            
                            let shouldRecur = true;
                            if (recurRule && recurRule !== "~") {
                                if (nextDateStr > recurRule) {
                                    shouldRecur = false;
                                }
                            }
                            
                            if (shouldRecur) {
                                const currentText = t.text;
                                let newText = currentText;
                                const dateMatch = currentText.match(/\(@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\)/);
                                if (dateMatch && dateMatch[1]) {
                                    newText = currentText.replace(dateMatch[1], nextDateStr);
                                } else {
                                    newText = currentText + ` (@${nextDateStr} 08:00)`;
                                }
                                
                                await this.createTask(newText, nextDateStr);
                            }
                        }
                    }

                    await this.setTaskStatus(t.file, t.line, newStatus);
                    item.setCssProps({ "opacity": checkbox.checked ? "0.5" : "1" })
                    item.setCssProps({ "text-decoration": checkbox.checked ? "line-through" : "none" })
                    setTimeout(() => { void this.refresh(); }, 500);
                };

                const textDiv = item.createDiv();
                textDiv.setCssProps({ "font-size": "13px", "color": "var(--text-normal)", "line-height": "1.4" })
                
                let cleanText = t.text;
                cleanText = cleanText.replace(/#task\/(important|urgent)/g, "");
                cleanText = cleanText.replace(/\(@\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\)/g, "");
                
                textDiv.textContent = cleanText.trim();
                
                if (t.status === "/") {
                    textDiv.setCssProps({ "color": "var(--interactive-accent)" })
                }
                
                // For 'other' view, display the date badge
                if (this.activeFilter === "other" && t.dueDate) {
                    const badge = textDiv.createSpan();
                    badge.textContent = t.dueDate;
                    badge.setCssProps({ "display": "inline-block", "margin-left": "8px", "padding": "2px 6px", "font-size": "10px", "border-radius": "4px", "background": "var(--background-modifier-hover)", "color": "var(--text-muted)" })
                }
            }
        };

        if (this.activeFilter === "today") {
            renderSection(isVi ? "Hôm nay" : "Today", displayList, "var(--text-accent)");
            renderSection(isVi ? "Quá hạn" : "Overdue", overdueList, "var(--text-error)");
        } else if (this.activeFilter === "tomorrow") {
            renderSection(isVi ? "Ngày mai" : "Tomorrow", displayList, "var(--text-accent)");
        } else {
            renderSection(isVi ? "Sắp tới & Chưa xếp lịch" : "Upcoming & Unplanned", displayList, "var(--text-muted)");
        }
        
        if (displayList.length === 0 && overdueList.length === 0) {
            const empty = timeline.createDiv();
            empty.setCssProps({ "text-align": "center", "color": "var(--text-muted)", "font-size": "12px", "margin-top": "20px", "font-style": "italic" })
            empty.textContent = isVi ? "Không có tác vụ nào." : "No tasks found.";
        }
    }

    private parseSimple(raw: string, defaultDate: string) {
        // Very basic parsing for Sidebar as requested (no dropdowns)
        let text = raw;
        let targetDateStr = defaultDate;

        // Still handle basic @today / @tomorrow if gapped
        if (text.includes("@tomorrow")) {
            targetDateStr = moment().add(1, 'day').format("YYYY-MM-DD");
            text = text.replace("@tomorrow", "");
        } else if (text.includes("@today")) {
            text = text.replace("@today", "");
        }

        // Handle $HH:mm
        const timeMatch = text.match(/\$(\d{1,2}:\d{2})/);
        let timeStr = "";
        if (timeMatch && timeMatch[1]) {
            timeStr = timeMatch[1];
            if (timeStr.length === 4) timeStr = "0" + timeStr;
            text = text.replace(timeMatch[0], "");
        } else {
            timeStr = "08:00"; // default
        }

        if (timeStr) {
            text += ` (@${targetDateStr} ${timeStr})`;
        }

        return { text: text.trim(), targetDateStr };
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
									const nextIndentMatch = nextLine.match(/^(\s*)/);
									const nextIndent = nextIndentMatch ? nextIndentMatch[1] : "";
									
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
		if (!file) {
			const isVi = this.settings.language === "vi";
			const titlePrefix = isVi ? "## Nhiệm vụ" : "## Tasks";
			await this.app.vault.create(filePath, `${titlePrefix}\n\n- [ ] ${text}\n`);
		} else if (file instanceof TFile) {
			await this.app.vault.process(file, (content) => {
				const isVi = this.settings.language === "vi";
				const header = isVi ? "## Nhiệm vụ" : "## Tasks";
				if (content.includes(header)) {
					return content.replace(header, `${header}\n- [ ] ${text}`);
				}
				return content + `\n${header}\n- [ ] ${text}\n`;
			});
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
}
