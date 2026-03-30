import { Setting, Notice } from "obsidian";
import type FlowPlugin from "../../main";
import { FLOW_ROLE_ORDER, FlowRole, FLOW_ROLE_DESCRIPTIONS } from "../../types";
import { generateTOCFiles, getExistingFlowRoles } from "../../features/toc/toc-generator";
import type { FlowSettingTab } from "../../settings";
import { getSettingsLabels } from "../../i18n/settings-labels";

export class GeneralTab {
	constructor(private plugin: FlowPlugin, private settingTab: FlowSettingTab) {}

	display(containerEl: HTMLElement): void {
		const L = getSettingsLabels(this.plugin.settings);
		const section = containerEl.createDiv("flow-section");

		new Setting(section)
			.setName(L.showRibbonIcon)
			.setDesc(L.showRibbonIconDesc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.showRibbonIcon);
				toggle.onChange(async (value) => {
					this.plugin.settings.showRibbonIcon = value;
					await this.plugin.saveSettings();
					new Notice(
						`FLOW: Ribbon icon ${value ? "enabled" : "disabled"}. ${L.ribbonReload}`
					);
				});
			});

		new Setting(section)
			.setName(L.dashboardRefresh)
			.setDesc(L.dashboardRefreshDesc)
			.addDropdown((dropdown) => {
				dropdown.addOption("0", L.disabled);
				dropdown.addOption("5", `5 ${L.minutes}`);
				dropdown.addOption("15", `15 ${L.minutes}`);
				dropdown.addOption("30", `30 ${L.minutes}`);
				dropdown.addOption("60", L.hour1);
				dropdown.addOption("120", L.hours2);
				dropdown.setValue(String(this.plugin.settings.dashboardRefreshIntervalMin));
				dropdown.onChange(async (value) => {
					this.plugin.settings.dashboardRefreshIntervalMin = Number(value);
					await this.plugin.saveSettings();
					new Notice(`FLOW: Dashboard refresh → ${value === "0" ? L.disabled : value + " " + L.minutes}.`);
				});
			});

		new Setting(section)
			.setName(L.pluginLanguage)
			.setDesc(L.pluginLanguageDesc)
			.addDropdown((dropdown) => {
				dropdown.addOption("vi", "🇻🇳 Tiếng Việt");
				dropdown.addOption("en", "🇺🇸 English");
				dropdown.setValue(this.plugin.settings.language || "vi");
				dropdown.onChange(async (value) => {
					this.plugin.settings.language = value as "vi" | "en";
					await this.plugin.saveSettings();
					new Notice(`FLOW: Language → ${value === "vi" ? "Tiếng Việt" : "English"}.`);
					// Re-render settings to apply language change immediately
					this.settingTab.display();
				});
			});

		// TOC section
		const tocSection = containerEl.createDiv("flow-section");
		tocSection.createEl("h3", { text: L.tocSection });

		new Setting(tocSection)
			.setName(L.autoToc)
			.setDesc(L.autoTocDesc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.autoTOC);
				toggle.onChange(async (value) => {
					this.plugin.settings.autoTOC = value;
					await this.plugin.saveSettings();
					if (value) {
						this.plugin.enableTOCWatcher();
						new Notice("FLOW: Auto-TOC watcher enabled.");
					} else {
						this.plugin.disableTOCWatcher();
						new Notice("FLOW: Auto-TOC watcher disabled.");
					}
				});
			});

		new Setting(tocSection)
			.setName(L.includeDataview)
			.setDesc(L.includeDataviewDesc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.tocDataViewQueries);
				toggle.onChange(async (value) => {
					this.plugin.settings.tocDataViewQueries = value;
					await this.plugin.saveSettings();
					new Notice(`FLOW: DataView queries in TOC ${value ? "enabled" : "disabled"}.`);
				});
			});

		// ── Folder checkboxes (only when auto-TOC is enabled) ──
		if (this.plugin.settings.autoTOC) {
			const checkboxSection = containerEl.createDiv("flow-section");
			checkboxSection.createEl("h3", { text: L.generateTocFor });
			checkboxSection.createEl("p", {
				text: L.generateTocForDesc,
				cls: "setting-item-description",
			});

			const existingRoles = getExistingFlowRoles(
				this.plugin.app.vault,
				this.plugin.settings.folderMap
			);

			for (const role of FLOW_ROLE_ORDER) {
				const folderName = this.plugin.settings.folderMap[role];
				const exists = existingRoles.includes(role);

				new Setting(checkboxSection)
					.setName(`${folderName}`)
					.setDesc(exists ? FLOW_ROLE_DESCRIPTIONS[role] : "⚠ Folder does not exist")
					.addToggle((toggle) => {
						toggle.setValue(this.settingTab.tocSelectedRoles.has(role) && exists);
						toggle.setDisabled(!exists);
						toggle.onChange((value) => {
							if (value) {
								this.settingTab.tocSelectedRoles.add(role);
							} else {
								this.settingTab.tocSelectedRoles.delete(role);
							}
						});
					});
			}

			// Generate button
			new Setting(checkboxSection)
				.setName("")
				.setDesc("")
				.addButton((button) => {
					button
						.setButtonText(L.generateTocBtn)
						.setCta()
						.onClick(async () => {
							const selectedRoles = FLOW_ROLE_ORDER.filter((r) =>
								this.settingTab.tocSelectedRoles.has(r) && existingRoles.includes(r)
							);

							if (selectedRoles.length === 0) {
								new Notice("FLOW: No folders selected for TOC generation.");
								return;
							}

							const count = await generateTOCFiles(
								this.plugin.app.vault,
								this.plugin.settings.folderMap,
								selectedRoles,
								this.plugin.settings.tocDataViewQueries
							);

							new Notice(
								`FLOW: Generated ${count} TOC file(s) in: ${selectedRoles.map((r) => this.plugin.settings.folderMap[r]).join(", ")}`
							);
						});
				});
		}

		// ── Settings Data Management ──────────
		const isVi = this.plugin.settings.language === "vi";
		const dataSection = containerEl.createDiv("flow-section");
		dataSection.createEl("h3", { text: isVi ? "Quản lý Dữ liệu" : "Data Management" });
		dataSection.createEl("p", {
			text: isVi ? "Nhập hoặc xuất cấu hình FLOW của bạn thành file JSON." : "Import or export your FLOW settings as a JSON file.",
			cls: "setting-item-description",
		});

		new Setting(dataSection)
			.setName(isVi ? "Xuất cấu hình" : "Export Settings")
			.setDesc(isVi ? "Lưu cấu hình hiện tại thành file JSON để sao lưu." : "Save your current configuration to a file.")
			.addButton((button) => {
				button.setButtonText(isVi ? "Xuất" : "Export").onClick(() => {
					const data = JSON.stringify(this.plugin.settings, null, 2);
					const blob = new Blob([data], { type: "application/json" });
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url;
					a.download = "obsidian-flow-settings.json";
					a.click();
					URL.revokeObjectURL(url);
					new Notice(isVi ? "FLOW: Đã xuất cấu hình thành công." : "FLOW: Settings exported successfully.");
				});
			});

		new Setting(dataSection)
			.setName(isVi ? "Nhập cấu hình" : "Import Settings")
			.setDesc(isVi ? "Tải cấu hình từ file JSON (chú ý: ghi đè cấu hình hiện tại)." : "Load your configuration from a JSON file (overwrites current settings).")
			.addButton((button) => {
				button.setButtonText(isVi ? "Nhập" : "Import").onClick(() => {
					const input = document.createElement("input");
					input.type = "file";
					input.accept = ".json";
					input.onchange = async (e) => {
						const file = (e.target as HTMLInputElement).files?.[0];
						if (file) {
							const reader = new FileReader();
							reader.onload = async (e) => {
								try {
									const data = JSON.parse(e.target?.result as string);
									this.plugin.settings = Object.assign({}, this.plugin.settings, data);
									await this.plugin.saveSettings();
									this.settingTab.display();
									new Notice(isVi ? "FLOW: Đã nhập cấu hình thành công." : "FLOW: Settings imported successfully.");
								} catch (err) {
									new Notice(isVi ? "FLOW: File JSON không hợp lệ." : "FLOW: Invalid JSON file.");
								}
							};
							reader.readAsText(file);
						}
					};
					input.click();
				});
			});

		// ── FLOW Vault Template Section ──
		const templateSection = containerEl.createDiv("flow-section");
		templateSection.createEl("h3", { text: L.vaultTemplate });
		templateSection.createEl("p", {
			text: L.vaultTemplateDesc,
			cls: "setting-item-description",
		});

		new Setting(templateSection)
			.setName("Learn Anything")
			.setDesc("https://learn-anything.vn/download-obsidian-flow")
			.addButton((button) => {
				button
					.setButtonText(L.downloadBtn)
					.setCta()
					.onClick(() => {
						window.open("https://learn-anything.vn/download-obsidian-flow", "_blank");
					});
			});

		// ── Credits & Support ──
		const creditSection = containerEl.createDiv("flow-credits-section");

		creditSection.createEl("h4", { text: "Credits & Support", cls: "flow-credits-title" });

		// Add Logo Link
		const logoLink = creditSection.createEl("a");
		logoLink.href = "http://learn-anything.vn";
		logoLink.target = "_blank";
		logoLink.addClass("flow-credits-logo-link");

		const logo = logoLink.createEl("img");
		logo.addClass("flow-credits-logo");
		logo.src = "https://learn-anything.vn/img/logo-learn-anything-new-rec_trans.png";
		logo.onerror = () => {
			try {
				const adapter = this.plugin.app.vault.adapter as unknown as Record<string, unknown>;
				if (typeof adapter.getResourcePath === "function") {
					const basePath = typeof adapter.getBasePath === "function" ? (adapter.getBasePath as () => string)() : "";
					logo.src = `app://local/${basePath}/${this.plugin.app.vault.configDir}/plugins/obsidian-flow/learn-anything-logo-rec-trans.png`;
				}
			} catch { /* ignore */ }
		};

		// i18n strings for credits
		const isViCred = this.plugin.settings.language !== "en";
		const authorPrefix = isViCred ? "Tác giả: " : "Author: ";
		const flowLabel = isViCred ? "Phương pháp FLOW PKM" : "FLOW PKM Methodology";
		const courseLabel = isViCred ? "Khoá học Obsidian FLOW" : "Obsidian FLOW Course";

		const createCreditLink = (parent: HTMLElement, text: string, href: string) => {
			const link = parent.createEl("a", { text, href });
			link.target = "_blank";
			link.addClass("flow-credits-link");
			return link;
		};

		const authorLine = creditSection.createEl("div");
		authorLine.addClass("flow-credits-text-line", "flow-credits-text-line-top");
		authorLine.appendChild(document.createTextNode(`${authorPrefix}Thịnh Vũ | `));
		createCreditLink(authorLine, "Website", "http://learn-anything.vn");

		const resourcesLine = creditSection.createEl("div");
		resourcesLine.addClass("flow-credits-text-line", "flow-credits-text-line-bottom");
		createCreditLink(resourcesLine, flowLabel, "https://learn-anything.vn/download-obsidian-flow");
		resourcesLine.appendChild(document.createTextNode(" | "));
		createCreditLink(resourcesLine, courseLabel, "https://learn-anything.vn/khoa-hoc/lp-khoa-hoc-obsidian-flow");
	}
}
