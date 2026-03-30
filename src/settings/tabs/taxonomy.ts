import { App, Setting, Notice, setIcon, TFile, TFolder } from "obsidian";
import type FlowPlugin from "../../main";
import { FlowRole, TagNode } from "../../types";
import { findExistingFlowFolder, findFlowFolderByRole } from "../../core/folder-manager";
import { detectBlueprintMissions } from "../../core/blueprint-detect";
import type { FlowSettingTab } from "../../settings";
import { getSettingsLabels } from "../../i18n/settings-labels";

export class TaxonomyTab {
	constructor(private plugin: FlowPlugin, private settingTab: FlowSettingTab) {}

	display(containerEl: HTMLElement): void {
		const L = getSettingsLabels(this.plugin.settings);

		// ── Section 1: Progress Lifecycle ────────────────────
		const lifecycleSection = containerEl.createDiv("flow-section");
		lifecycleSection.createEl("h3", { text: L.progressLifecycle });
		lifecycleSection.createEl("p", {
			text: L.progressLifecycleDesc,
			cls: "setting-item-description",
		});

		const stages = this.plugin.settings.progressLifecycle?.stages || ["raw", "medium", "done", "archived"];

		const renderLifecycleList = () => {
			const listEl = lifecycleSection.querySelector(".flow-lifecycle-list");
			if (listEl) listEl.remove();

			const list = lifecycleSection.createDiv("flow-lifecycle-list");
			list.addClass("flow-taxonomy-lifecycle-list");

			stages.forEach((stage, idx) => {
				const chip = list.createDiv();
				chip.addClass("flow-taxonomy-lifecycle-chip");

				const input = chip.createEl("input", { type: "text" });
				input.value = stage;
				input.addClass("flow-taxonomy-lifecycle-input");

				input.onchange = async () => {
					const oldVal = stages[idx] || "";
					const newVal = input.value.trim().toLowerCase();
					if (newVal && newVal !== oldVal) {
						stages[idx] = newVal;
						this.plugin.settings.progressLifecycle.stages = [...stages];
						await this.plugin.saveSettings();
						await this.renameProgressValues(oldVal, newVal);
					}
				};

				if (idx < stages.length - 1) {
					const arrow = list.createSpan({ text: "→" });
					arrow.addClass("flow-taxonomy-arrow");
				}
			});
		};

		renderLifecycleList();

		new Setting(lifecycleSection)
			.setName(L.addStage)
			.setDesc(L.addStageDesc)
			.addText((text) => {
				text.setPlaceholder(L.newStageName);
				text.inputEl.style.minWidth = "120px";
				text.inputEl.style.flex = "1";
				(text.inputEl as any).__flowRef = text;
			})
			.addButton((btn) => {
				btn.setButtonText(L.addBtn).onClick(async () => {
					const inputEl = lifecycleSection.querySelector(".setting-item:last-child input[type=text]") as HTMLInputElement;
					const val = inputEl?.value?.trim().toLowerCase();
					if (val && !stages.includes(val)) {
						stages.push(val);
						this.plugin.settings.progressLifecycle.stages = [...stages];
						await this.plugin.saveSettings();
						inputEl.value = "";
						renderLifecycleList();
						new Notice(`FLOW: Stage "${val}" added.`);
					}
				});
			});

		// ── Section 1b: Eisenhower Matrix (Urgency & Impact) ──────────
		const eisenSection = containerEl.createDiv("flow-section");
		eisenSection.createEl("h3", { text: L.eisenhower });
		eisenSection.createEl("p", {
			text: L.eisenhowerDesc,
			cls: "setting-item-description",
		});

		this.renderEisenhowerField(eisenSection, "urgency", this.plugin.settings.urgencyConfig);
		this.renderEisenhowerField(eisenSection, "impact", this.plugin.settings.impactConfig);

		// Publish & Channel field names
		new Setting(eisenSection)
			.setName(L.publishField)
			.setDesc(L.publishFieldDesc)
			.addText((text) => {
				text
					.setPlaceholder("publish")
					.setValue(this.plugin.settings.publishFieldName || "publish")
					.onChange(async (value) => {
						if (value.trim()) {
							this.plugin.settings.publishFieldName = value.trim();
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(eisenSection)
			.setName(L.channelField)
			.setDesc(L.channelFieldDesc)
			.addText((text) => {
				text
					.setPlaceholder("channel")
					.setValue(this.plugin.settings.channelFieldName || "channel")
					.onChange(async (value) => {
						if (value.trim()) {
							this.plugin.settings.channelFieldName = value.trim();
							await this.plugin.saveSettings();
						}
					});
			});

		// ── Section 2: Tag Hierarchy ────────────────────────
		const tagSection = containerEl.createDiv("flow-section");
		tagSection.createEl("h3", { text: L.tagHierarchy });
		tagSection.createEl("p", {
			text: L.tagHierarchyDesc,
			cls: "setting-item-description",
		});

		const taxonomy = this.plugin.settings.tagTaxonomy || [];

		const renderTagTree = (parent: HTMLElement, nodes: TagNode[], depth: number, parentPath: string) => {
			for (let i = 0; i < nodes.length; i++) {
				const node = nodes[i]!;
				const fullTag = parentPath ? `${parentPath}/${node.name}` : node.name;

				const row = parent.createDiv();
				row.addClass("flow-taxonomy-tag-row");
				row.style.paddingLeft = `${depth * 24 + 8}px`;
				row.style.borderBottom = "1px solid var(--background-modifier-border)";
				row.style.padding = `4px 8px 4px ${depth * 24 + 8}px`;

				if (depth > 0) {
					const indent = row.createSpan({ text: "└" });
					indent.addClass("flow-taxonomy-tag-indent");
				}

				const tagLabel = row.createSpan({ text: `#${fullTag}` });
				tagLabel.addClass("flow-taxonomy-tag-label");

				if (node.description) {
					const desc = row.createSpan({ text: node.description });
					desc.addClass("flow-taxonomy-tag-desc");
				}

				const delBtn = row.createEl("button");
				setIcon(delBtn, "x");
				delBtn.addClass("flow-taxonomy-del-btn");
				delBtn.title = "Remove tag";
				delBtn.onclick = async () => {
					nodes.splice(i, 1);
					this.plugin.settings.tagTaxonomy = [...taxonomy];
					await this.plugin.saveSettings();
					await this.generateTagHierarchyMarkdown();
					this.settingTab.display();
				};

				if (node.children?.length > 0) {
					renderTagTree(parent, node.children, depth + 1, fullTag);
				}
			}
		};

		const tagTreeContainer = tagSection.createDiv();
		tagTreeContainer.addClass("flow-taxonomy-tree-container");

		if (taxonomy.length === 0) {
			const empty = tagTreeContainer.createDiv();
			empty.addClass("flow-taxonomy-tree-empty");
			empty.setText(L.noTagsRegistered);
		} else {
			renderTagTree(tagTreeContainer, taxonomy, 0, "");
		}

		new Setting(tagSection)
			.setName(L.addTag)
			.setDesc(L.addTagDesc)
			.addText((text) => {
				text.setPlaceholder("e.g. project/python");
				text.inputEl.style.minWidth = "120px";
				text.inputEl.style.flex = "1";
			})
			.addText((text) => {
				text.setPlaceholder("Description (optional)");
				text.inputEl.style.minWidth = "120px";
				text.inputEl.style.flex = "1";
				text.inputEl.addClass("flow-tag-desc-input");
			})
			.addButton((btn) => {
				btn.setButtonText("+ Add").onClick(async () => {
					const inputs = tagSection.querySelectorAll(".setting-item:last-child input[type=text]");
					const nameInput = inputs[0] as HTMLInputElement;
					const descInput = inputs[1] as HTMLInputElement;
					const tagPath = nameInput?.value?.trim().toLowerCase();
					const tagDesc = descInput?.value?.trim() || undefined;

					if (!tagPath) return;

					const parts = tagPath.split("/").filter(Boolean);
					let current = taxonomy;

					for (let p = 0; p < parts.length; p++) {
						const part = parts[p]!;
						let existing = current.find((n) => n.name === part);
						if (!existing) {
							existing = {
								name: part,
								description: p === parts.length - 1 ? tagDesc : undefined,
								children: [],
							};
							current.push(existing);
						}
						current = existing.children;
					}

					this.plugin.settings.tagTaxonomy = [...taxonomy];
					await this.plugin.saveSettings();
					await this.generateTagHierarchyMarkdown();
					nameInput.value = "";
					if (descInput) descInput.value = "";
					new Notice(`FLOW: Tag "#${tagPath}" registered.`);
					this.settingTab.display();
				});
			});

		// ── Section 3: Vault Missions ─────────────────────
		const missionSection = containerEl.createDiv("flow-section");
		missionSection.createEl("h3", { text: L.vaultMissions });
		missionSection.createEl("p", {
			text: L.vaultMissionsDesc,
			cls: "setting-item-description",
		});

		const missions = this.plugin.settings.vaultMissions || [];

		// Auto-detect Blueprint files as missions if not already registered
		const updatedMissions = detectBlueprintMissions(this.plugin.app.vault, this.plugin.settings.folderMap, missions);
		
		if (updatedMissions.length > missions.length) {
			this.plugin.settings.vaultMissions = updatedMissions;
			void this.plugin.saveSettings().then(() => this.generateBlueprintsIndexMarkdown());
		}

		for (let mi = 0; mi < updatedMissions.length; mi++) {
			const m = updatedMissions[mi]!;
			const statusIcon = m.status === "active" ? "🟢" : m.status === "paused" ? "🟡" : "✅";

			new Setting(missionSection)
				.setName(`${statusIcon} ${m.name}`)
				.setDesc(`${m.description} | Tags: ${m.relatedTags.map((t) => "#" + t).join(", ") || "none"}`)
				.addDropdown((dd) => {
					dd.addOption("active", "🟢 Active");
					dd.addOption("paused", "🟡 Paused");
					dd.addOption("completed", "✅ Completed");
					dd.setValue(m.status);
					dd.onChange(async (val) => {
						const mission = missions[mi];
						if (mission) {
							mission.status = val as "active" | "paused" | "completed";
							await this.plugin.saveSettings();
							await this.syncMissionProgress(mission.name, val as "active" | "paused" | "completed");
							await this.generateBlueprintsIndexMarkdown();
						}
						this.settingTab.display();
					});
				})
				.addButton((btn) => {
					btn.setButtonText("✕").setTooltip("Remove mission").onClick(async () => {
						missions.splice(mi, 1);
						await this.plugin.saveSettings();
						await this.generateBlueprintsIndexMarkdown();
						this.settingTab.display();
					});
				});
		}

		// Add mission form
		const addMissionDiv = missionSection.createDiv();
		addMissionDiv.addClass("flow-taxonomy-add-mission-form");

		const mNameInput = addMissionDiv.createEl("input", { type: "text", placeholder: L.missionNamePlaceholder });
		mNameInput.style.flex = "1";
		mNameInput.style.minWidth = "120px";
		const mDescInput = addMissionDiv.createEl("input", { type: "text", placeholder: L.descriptionPlaceholder });
		mDescInput.style.flex = "2";
		mDescInput.style.minWidth = "150px";
		const mTagsInput = addMissionDiv.createEl("input", { type: "text", placeholder: L.tagsPlaceholder });
		mTagsInput.style.flex = "1";
		mTagsInput.style.minWidth = "120px";

		const mAddBtn = addMissionDiv.createEl("button", { text: L.addMission });
		mAddBtn.onclick = async () => {
			const name = mNameInput.value.trim();
			const desc = mDescInput.value.trim();
			const tags = mTagsInput.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
			if (!name) return;

			missions.push({
				id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
				name,
				description: desc,
				relatedTags: tags,
				status: "active",
			});
			this.plugin.settings.vaultMissions = [...missions];
			await this.plugin.saveSettings();
			await this.generateBlueprintsIndexMarkdown();

			const blueprintFolderName = this.plugin.settings.folderMap[FlowRole.BLUEPRINT];
			if (blueprintFolderName) {
				const blueprintFolder = findExistingFlowFolder(this.plugin.app.vault, blueprintFolderName);
				if (blueprintFolder) {
					const filePath = `${blueprintFolder.path}/${name}.md`;
					const existing = this.plugin.app.vault.getAbstractFileByPath(filePath);
					if (!existing) {
						const tagsFm = tags.length > 0 ? `\n  - ${tags.join("\n  - ")}` : "";
						const content = `---\nprogress: medium\nsummary: "${desc.replace(/"/g, '\\"')}"\ntags: ${tagsFm}\nimpact: 5\nurgency: 1\nmin-impact: 5\ncreated-after: 2024-08-01\n---\n\n## 📝 Activity Tracking\n\n\`\`\`dataview\nTABLE impact, created\nFROM -"6. Vault"\nWHERE contains(string(join(blueprint, "  ")), this.file.name) AND number(impact) >= number(this.min-impact) AND date(created, "yyyy-MM-dd HH:mm:ss") >= date(this.created-after)\nSORT rank DESC, created DESC\n\`\`\`\n\n## 📎 Others\n\n\`\`\`dataview\nTABLE impact, created\nFROM -"6. Vault"\nWHERE contains(string(join(blueprint, "  ")), this.file.name) AND none(list(impact))\nSORT rank DESC, created DESC\n\`\`\`\n`;
						try {
							await this.plugin.app.vault.create(filePath, content);
						} catch (e) {
							console.warn("[FLOW] Failed to auto-create mission blueprint:", e);
						}
					}
				}
			}

			new Notice(`FLOW: Mission "${name}" created.`);
			this.settingTab.display();
		};

		// ── Section 4: Dimensions ────────────────────────
		const dimSection = containerEl.createDiv("flow-section");
		dimSection.createEl("h3", { text: L.dimensions });
		dimSection.createEl("p", {
			text: L.dimensionsDesc,
			cls: "setting-item-description",
		});

		const dims = this.plugin.settings.taxonomyDimensions || [];

		for (let di = 0; di < dims.length; di++) {
			const dim = dims[di]!;
			new Setting(dimSection)
				.setName(dim.label)
				.setDesc(`Values: ${dim.values.join(", ") || "(empty)"}`)
				.addText((text) => {
					text.setPlaceholder(L.addValuePlaceholder);
					text.inputEl.style.width = "120px";
					text.inputEl.onkeydown = async (e) => {
						if (e.key === "Enter") {
							const val = text.getValue().trim();
							const d = dims[di];
							if (val && d && !d.values.includes(val)) {
								d.values.push(val);
								await this.plugin.saveSettings();
								await this.generateDimensionsIndexMarkdown();
								text.setValue("");
								this.settingTab.display();
							}
						}
					};
				})
				.addButton((btn) => {
					btn.setButtonText("✕").setTooltip("Remove dimension").onClick(async () => {
						dims.splice(di, 1);
						this.plugin.settings.taxonomyDimensions = [...dims];
						await this.plugin.saveSettings();
						await this.generateDimensionsIndexMarkdown();
						this.settingTab.display();
					});
				});
		}

		new Setting(dimSection)
			.setName(L.addDimension)
			.addText((text) => {
				text.setPlaceholder(L.dimensionLabel);
				text.inputEl.style.minWidth = "120px";
				text.inputEl.style.flex = "1";
			})
			.addButton((btn) => {
				btn.setButtonText(L.addBtn).onClick(async () => {
					const input = dimSection.querySelector(".setting-item:last-child input[type=text]") as HTMLInputElement;
					const label = input?.value?.trim();
					if (label) {
						dims.push({
							id: label.toLowerCase().replace(/\s+/g, "_"),
							label,
							values: [],
						});
						this.plugin.settings.taxonomyDimensions = [...dims];
						await this.plugin.saveSettings();
						await this.generateDimensionsIndexMarkdown();
						new Notice(`FLOW: Dimension "${label}" added.`);
						this.settingTab.display();
					}
				});
			});

		// ── Section 5: Feeling Spectrum (Emotion Wheel) ──────────
		const feelingSection = containerEl.createDiv("flow-section");
		feelingSection.createEl("h3", { text: L.feelingSpectrum });
		feelingSection.createEl("p", {
			text: L.feelingSpectrumDesc,
			cls: "setting-item-description",
		});

		const EMOTION_WHEEL = [
			{
				group: "Joy", groupVi: "Vui vẻ", color: "#f1c40f",
				feelings: [
					{ en: "happy", vi: "hạnh phúc" }, { en: "cheerful", vi: "vui vẻ" },
					{ en: "excited", vi: "phấn khích" }, { en: "grateful", vi: "biết ơn" },
					{ en: "hopeful", vi: "hy vọng" }, { en: "proud", vi: "tự hào" },
				]
			},
			{
				group: "Trust", groupVi: "Tin tưởng", color: "#2ecc71",
				feelings: [
					{ en: "calm", vi: "bình tĩnh" }, { en: "peaceful", vi: "an yên" },
					{ en: "confident", vi: "tự tin" }, { en: "secure", vi: "an toàn" },
					{ en: "accepted", vi: "được chấp nhận" },
				]
			},
			{
				group: "Fear", groupVi: "Sợ hãi", color: "#27ae60",
				feelings: [
					{ en: "anxious", vi: "lo lắng" }, { en: "nervous", vi: "bồn chồn" },
					{ en: "worried", vi: "lo ngại" }, { en: "insecure", vi: "bất an" },
					{ en: "overwhelmed", vi: "quá tải" },
				]
			},
			{
				group: "Surprise", groupVi: "Ngạc nhiên", color: "#3498db",
				feelings: [
					{ en: "amazed", vi: "kinh ngạc" }, { en: "confused", vi: "bối rối" },
					{ en: "curious", vi: "tò mò" }, { en: "shocked", vi: "sốc" },
				]
			},
			{
				group: "Sadness", groupVi: "Buồn bã", color: "#5dade2",
				feelings: [
					{ en: "sad", vi: "buồn" }, { en: "lonely", vi: "cô đơn" },
					{ en: "disappointed", vi: "thất vọng" }, { en: "guilty", vi: "tội lỗi" },
					{ en: "empty", vi: "trống rỗng" },
				]
			},
			{
				group: "Disgust", groupVi: "Ghê tởm", color: "#9b59b6",
				feelings: [
					{ en: "bored", vi: "chán nản" }, { en: "disgusted", vi: "ghê tởm" },
					{ en: "frustrated", vi: "bực bội" }, { en: "tired", vi: "mệt mỏi" },
				]
			},
			{
				group: "Anger", groupVi: "Tức giận", color: "#e74c3c",
				feelings: [
					{ en: "angry", vi: "tức giận" }, { en: "irritated", vi: "khó chịu" },
					{ en: "stressed", vi: "căng thẳng" }, { en: "jealous", vi: "ghen tuông" },
					{ en: "resentful", vi: "bất mãn" },
				]
			},
			{
				group: "Anticipation", groupVi: "Kỳ vọng", color: "#e67e22",
				feelings: [
					{ en: "motivated", vi: "có động lực" }, { en: "creative", vi: "sáng tạo" },
					{ en: "focused", vi: "tập trung" }, { en: "energetic", vi: "tràn năng lượng" },
					{ en: "productive", vi: "hiệu quả" }, { en: "reflective", vi: "suy ngẫm" },
				]
			},
		];

		const selected = new Set(this.plugin.settings.selectedFeelings || []);

		for (const group of EMOTION_WHEEL) {
			const groupDiv = feelingSection.createDiv();
			groupDiv.addClass("flow-taxonomy-group-div");

			const groupHeader = groupDiv.createDiv();
			groupHeader.addClass("flow-taxonomy-group-header");

			const dot = groupHeader.createSpan();
			dot.addClass("flow-taxonomy-color-dot");
			dot.style.backgroundColor = group.color;

			groupHeader.createEl("strong", { text: `${group.group} — ${group.groupVi}` });

			const grid = groupDiv.createDiv();
			grid.addClass("flow-taxonomy-feeling-grid");

			for (const f of group.feelings) {
				const chip = grid.createEl("label");
				chip.addClass("flow-taxonomy-feeling-chip");
				chip.style.backgroundColor = selected.has(f.en) ? group.color + "25" : "transparent";

				const cb = chip.createEl("input", { type: "checkbox" }) as HTMLInputElement;
				cb.checked = selected.has(f.en);
				cb.addClass("flow-taxonomy-feeling-checkbox");

				chip.createSpan({ text: `${f.en} (${f.vi})` });

				cb.onchange = async () => {
					if (cb.checked) {
						selected.add(f.en);
					} else {
						selected.delete(f.en);
					}
					chip.style.backgroundColor = cb.checked ? group.color + "25" : "transparent";
					this.plugin.settings.selectedFeelings = Array.from(selected);
					await this.plugin.saveSettings();
					await this.generateFeelingsSpectrumMarkdown(EMOTION_WHEEL);
				};
			}
		}
	}

	// ── Helper: Bulk rename progress values ──────────────────────────

	private async renameProgressValues(oldVal: string, newVal: string): Promise<void> {
		const files = this.plugin.app.vault.getMarkdownFiles();
		let count = 0;

		for (const file of files) {
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter || cache.frontmatter.progress === undefined) continue;

			const currentVal = String(cache.frontmatter.progress).trim();
			if (currentVal.toLowerCase() === oldVal.toLowerCase()) {
				const content = await this.plugin.app.vault.read(file);
				const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
				if (fmMatch) {
					const oldFm = fmMatch[0];
					const newFm = oldFm.replace(
						new RegExp(`(progress:\\s*)${oldVal.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`, "i"),
						`$1${newVal}`
					);
					if (newFm !== oldFm) {
						const newContent = content.replace(oldFm, newFm);
						await this.plugin.app.vault.modify(file, newContent);
						count++;
					}
				}
			}
		}

		if (count > 0) {
			new Notice(`FLOW: Renamed progress "${oldVal}" → "${newVal}" in ${count} note(s).`);
		} else {
			new Notice(`FLOW: No notes found with progress "${oldVal}".`);
		}
	}

	// ── Helper: Sync mission status to Blueprint file progress ────────

	private async syncMissionProgress(
		missionName: string,
		status: "active" | "paused" | "completed"
	): Promise<void> {
		const statusToProgress: Record<string, string> = {
			active: "medium",
			paused: "archived",
			completed: "done",
		};
		const progressVal = statusToProgress[status] || "medium";

		const blueprintFolderName = this.plugin.settings.folderMap[FlowRole.BLUEPRINT];
		const blueprintFolder = findExistingFlowFolder(this.plugin.app.vault, blueprintFolderName);
		if (!blueprintFolder) return;

		for (const child of blueprintFolder.children) {
			if (child instanceof TFile && child.extension === "md" && child.basename === missionName) {
				const content = await this.plugin.app.vault.read(child);
				const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);

				if (fmMatch) {
					const oldFm = fmMatch[0];
					let newFm: string;
					if (/^progress:/m.test(oldFm)) {
						newFm = oldFm.replace(/^(progress:\s*).*$/m, `$1${progressVal}`);
					} else {
						newFm = oldFm.replace(/\n---$/, `\nprogress: ${progressVal}\n---`);
					}
					if (newFm !== oldFm) {
						const newContent = content.replace(oldFm, newFm);
						await this.plugin.app.vault.modify(child, newContent);
						new Notice(`FLOW: Updated "${missionName}" progress → ${progressVal}`);
					}
				} else {
					const newContent = `---\nprogress: ${progressVal}\n---\n${content}`;
					await this.plugin.app.vault.modify(child, newContent);
					new Notice(`FLOW: Added progress → ${progressVal} to "${missionName}"`);
				}
				break;
			}
		}
	}

	// ── Helper: Find or create settings subfolder in Vault ──────────

	private async findOrCreateSettingsFolder(): Promise<TFolder | undefined> {
		const vaultFolder = findFlowFolderByRole(
			this.plugin.app.vault,
			this.plugin.settings.folderMap,
			FlowRole.VAULT
		);

		if (!vaultFolder) {
			console.warn("[FLOW] Cannot find Vault folder.");
			return undefined;
		}

		let settingsFolder: TFolder | undefined;
		for (const child of vaultFolder.children) {
			if (child instanceof TFolder && child.name.toLowerCase() === "settings") {
				settingsFolder = child;
				break;
			}
		}

		if (!settingsFolder) {
			try {
				await this.plugin.app.vault.createFolder(`${vaultFolder.path}/settings`);
				const created = this.plugin.app.vault.getAbstractFileByPath(`${vaultFolder.path}/settings`);
				if (created && created instanceof TFolder) {
					settingsFolder = created;
				}
			} catch (e) {
				console.warn("[FLOW] Failed to create settings folder:", e);
				return undefined;
			}
		}

		return settingsFolder;
	}

	private async generateBlueprintsIndexMarkdown(): Promise<void> {
		const missions = this.plugin.settings.vaultMissions || [];
		if (missions.length === 0) return;

		const settingsFolder = await this.findOrCreateSettingsFolder();
		if (!settingsFolder) return;

		const fmLines: string[] = [
			"---",
			"generated: true",
			"plugin: obsidian-flow",
			`updated: ${new Date().toISOString().split("T")[0]}`,
			"---",
		];

		const bodyLines: string[] = [
			"",
			"# 🧭 Blueprints & Missions",
			"",
			"> This file is auto-generated by the FLOW plugin.",
			"> It tracks all active and completed blueprints (missions) defined in your Vault.",
			"",
		];

		const active = missions.filter(m => m.status === "active");
		const paused = missions.filter(m => m.status === "paused");
		const completed = missions.filter(m => m.status === "completed");

		if (active.length > 0) {
			bodyLines.push("## 🟢 Active Missions\n");
			for (const m of active) {
				bodyLines.push(`- [[${m.name}]]${m.description ? ` — *${m.description}*` : ""}`);
			}
			bodyLines.push("");
		}

		if (paused.length > 0) {
			bodyLines.push("## 🟡 Paused Missions\n");
			for (const m of paused) {
				bodyLines.push(`- [[${m.name}]]${m.description ? ` — *${m.description}*` : ""}`);
			}
			bodyLines.push("");
		}

		if (completed.length > 0) {
			bodyLines.push("## ✅ Completed Missions\n");
			for (const m of completed) {
				bodyLines.push(`- [[${m.name}]]${m.description ? ` — *${m.description}*` : ""}`);
			}
			bodyLines.push("");
		}

		const content = fmLines.join("\n") + "\n" + bodyLines.join("\n");
		const filePath = `${settingsFolder.path}/blueprints-index.md`;

		try {
			const existing = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (existing && existing instanceof TFile) {
				await this.plugin.app.vault.modify(existing, content);
			} else {
				await this.plugin.app.vault.create(filePath, content);
			}
		} catch (e) {
			console.warn("[FLOW] Failed to write blueprints-index.md:", e);
		}
	}

	private async generateTagHierarchyMarkdown(): Promise<void> {
		const taxonomy = this.plugin.settings.tagTaxonomy || [];
		if (taxonomy.length === 0) return;

		const settingsFolder = await this.findOrCreateSettingsFolder();
		if (!settingsFolder) return;

		const lines: string[] = [
			"---",
			"generated: true",
			"plugin: obsidian-flow",
			`updated: ${new Date().toISOString().split("T")[0]}`,
			"---",
			"",
			"# 🏷️ Tag Hierarchy",
			"",
			"> This file is auto-generated by the FLOW plugin from your tag taxonomy settings.",
			"> Edit your tags in **Settings → FLOW → Taxonomy → Tag Hierarchy**.",
			"",
		];

		const renderNodes = (nodes: TagNode[], depth: number, parentPath: string) => {
			for (const node of nodes) {
				const fullTag = parentPath ? `${parentPath}/${node.name}` : node.name;
				const indent = "  ".repeat(depth);
				const desc = node.description ? ` — ${node.description}` : "";
				lines.push(`${indent}- #${fullTag}${desc}`);
				if (node.children?.length > 0) {
					renderNodes(node.children, depth + 1, fullTag);
				}
			}
		};

		renderNodes(taxonomy, 0, "");

		const content = lines.join("\n") + "\n";
		const filePath = `${settingsFolder.path}/tag-hierarchy.md`;

		try {
			const existing = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (existing && existing instanceof TFile) {
				await this.plugin.app.vault.modify(existing, content);
			} else {
				await this.plugin.app.vault.create(filePath, content);
			}
		} catch (e) {
			console.warn("[FLOW] Failed to write tag-hierarchy.md:", e);
		}
	}

	private async generateDimensionsIndexMarkdown(): Promise<void> {
		const dims = this.plugin.settings.taxonomyDimensions || [];
		if (dims.length === 0) return;

		const settingsFolder = await this.findOrCreateSettingsFolder();
		if (!settingsFolder) return;

		const fmLines: string[] = [
			"---",
			"generated: true",
			"plugin: obsidian-flow",
			`updated: ${new Date().toISOString().split("T")[0]}`,
		];

		for (const dim of dims) {
			if (dim.values.length > 0) {
				fmLines.push(`${dim.id}:`);
				for (const val of dim.values) {
					fmLines.push(`  - ${val}`);
				}
			} else {
				fmLines.push(`${dim.id}: []`);
			}
		}

		fmLines.push("---");

		const bodyLines: string[] = [
			"",
			"# 📐 Information Dimensions",
			"",
			"> This file is auto-generated by the FLOW plugin from your dimension settings.",
			"> Edit dimensions in **Settings → FLOW → Taxonomy → Information Dimensions**.",
			"> Properties defined here are indexed by Obsidian for auto-suggestion in your notes.",
			"",
		];

		for (const dim of dims) {
			bodyLines.push(`## ${dim.label}`);
			bodyLines.push("");
			if (dim.values.length > 0) {
				for (const val of dim.values) {
					bodyLines.push(`- ${val}`);
				}
			} else {
				bodyLines.push("_No values defined yet._");
			}
			bodyLines.push("");
		}

		const content = fmLines.join("\n") + "\n" + bodyLines.join("\n");
		const filePath = `${settingsFolder.path}/dimensions-index.md`;

		try {
			const existing = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (existing && existing instanceof TFile) {
				await this.plugin.app.vault.modify(existing, content);
			} else {
				await this.plugin.app.vault.create(filePath, content);
			}
		} catch (e) {
			console.warn("[FLOW] Failed to write dimensions-index.md:", e);
		}
	}

	private async generateFeelingsSpectrumMarkdown(emotionWheel: { group: string; groupVi: string; color: string; feelings: { en: string; vi: string }[] }[]): Promise<void> {
		const selected = this.plugin.settings.selectedFeelings || [];
		if (selected.length === 0) return;

		const settingsFolder = await this.findOrCreateSettingsFolder();
		if (!settingsFolder) return;

		const fmLines: string[] = [
			"---",
			"generated: true",
			"plugin: obsidian-flow",
			`updated: ${new Date().toISOString().split("T")[0]}`,
			"feeling:",
		];

		for (const f of selected) {
			fmLines.push(`  - ${f}`);
		}

		fmLines.push("---");

		const bodyLines: string[] = [
			"",
			"# 🎭 Feeling Spectrum",
			"",
			"> This file is auto-generated by the FLOW plugin from your emotion settings.",
			"> Edit in **Settings → FLOW → Taxonomy → Feeling Spectrum**.",
			"> The `feeling` property above is indexed by Obsidian for auto-suggestion in your daily notes.",
			"",
		];

		for (const group of emotionWheel) {
			const groupFeelings = group.feelings.filter(f => selected.includes(f.en));
			if (groupFeelings.length === 0) continue;
			bodyLines.push(`## ${group.group} — ${group.groupVi}`);
			bodyLines.push("");
			for (const f of groupFeelings) {
				bodyLines.push(`- **${f.en}** — ${f.vi}`);
			}
			bodyLines.push("");
		}

		const content = fmLines.join("\n") + "\n" + bodyLines.join("\n");
		const filePath = `${settingsFolder.path}/feelings-spectrum.md`;

		try {
			const existing = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (existing && existing instanceof TFile) {
				await this.plugin.app.vault.modify(existing, content);
			} else {
				await this.plugin.app.vault.create(filePath, content);
			}
		} catch (e) {
			console.warn("[FLOW] Failed to write feelings-spectrum.md:", e);
		}
	}

	// ── Eisenhower Matrix Field Renderer ───────────────────────────────

	private renderEisenhowerField(
		container: HTMLElement,
		type: "urgency" | "impact",
		config: { fieldName: string; levels: { value: number; label: string }[] }
	) {
		const L = getSettingsLabels(this.plugin.settings);
		const icon = type === "urgency" ? "⏰" : "🎯";
		const title = type === "urgency" ? "Urgency" : "Impact";

		const fieldSection = container.createDiv();
		fieldSection.addClass("flow-taxonomy-field-section");

		fieldSection.createEl("h4", { text: `${icon} ${title}`, cls: "flow-taxonomy-field-title" });

		// Field name
		new Setting(fieldSection)
			.setName(`Field name`)
			.setDesc(L.propertyKeyDesc)
			.addText((text) => {
				text.setValue(config.fieldName);
				text.setPlaceholder(type);
				text.inputEl.style.width = "140px";
				text.inputEl.onchange = async () => {
					const newName = text.getValue().trim().toLowerCase();
					if (newName && newName !== config.fieldName) {
						const oldName = config.fieldName;
						config.fieldName = newName;
						await this.plugin.saveSettings();
						await this.renameVaultFrontmatterField(oldName, newName);
					}
				};
			});

		// Levels list
		const levelsContainer = fieldSection.createDiv();
		levelsContainer.addClass("flow-taxonomy-levels-container");

		const renderLevels = () => {
			levelsContainer.empty();
			for (let i = 0; i < config.levels.length; i++) {
				const level = config.levels[i]!;
				const chip = levelsContainer.createDiv();
				chip.addClass("flow-taxonomy-level-chip");

				const valSpan = chip.createEl("strong", { text: String(level.value) });
				valSpan.addClass("flow-taxonomy-level-value");

				const labelInput = chip.createEl("input", { type: "text" });
				labelInput.value = level.label;
				labelInput.addClass("flow-taxonomy-level-input");
				labelInput.onchange = async () => {
					level.label = labelInput.value.trim();
					await this.plugin.saveSettings();
				};

				const delBtn = chip.createEl("button");
				setIcon(delBtn, "x");
				delBtn.addClass("flow-taxonomy-level-del");
				delBtn.onclick = async () => {
					config.levels.splice(i, 1);
					await this.plugin.saveSettings();
					renderLevels();
				};
			}
		};

		renderLevels();

		// Add level button
		const addRow = fieldSection.createDiv();
		addRow.addClass("flow-taxonomy-add-level-row");

		const valInput = addRow.createEl("input", { type: "number", placeholder: L.valuePlaceholder });
		valInput.style.width = "60px";
		const lblInput = addRow.createEl("input", { type: "text", placeholder: L.labelPlaceholder });
		lblInput.style.width = "120px";
		lblInput.style.flex = "1";

		const addBtn = addRow.createEl("button", { text: L.addBtn });
		addBtn.onclick = async () => {
			const v = parseInt(valInput.value);
			const l = lblInput.value.trim();
			if (!isNaN(v) && l) {
				config.levels.push({ value: v, label: l });
				config.levels.sort((a, b) => a.value - b.value);
				await this.plugin.saveSettings();
				valInput.value = "";
				lblInput.value = "";
				renderLevels();
				new Notice(`FLOW: Level ${v} \"${l}\" added to ${title}.`);
			}
		};
	}

	// ── Helper: Rename frontmatter field key across all vault notes ───

	private async renameVaultFrontmatterField(oldKey: string, newKey: string): Promise<void> {
		const files = this.plugin.app.vault.getMarkdownFiles();
		let count = 0;

		for (const file of files) {
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter || cache.frontmatter[oldKey] === undefined) continue;

			const content = await this.plugin.app.vault.read(file);
			const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (fmMatch) {
				const oldFm = fmMatch[0];
				const newFm = oldFm.replace(
					new RegExp(`^(${oldKey.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")})(\\s*:.*)$`, "m"),
					`${newKey}$2`
				);
				if (newFm !== oldFm) {
					const newContent = content.replace(oldFm, newFm);
					await this.plugin.app.vault.modify(file, newContent);
					count++;
				}
			}
		}

		if (count > 0) {
			new Notice(`FLOW: Renamed field \"${oldKey}\" \u2192 \"${newKey}\" in ${count} note(s).`);
		} else {
			new Notice(`FLOW: No notes found with field \"${oldKey}\".`);
		}
	}
}
