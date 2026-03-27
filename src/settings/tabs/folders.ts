import { Setting, Notice } from "obsidian";
import type FlowPlugin from "../../main";
import { FLOW_PRESETS, getPresetById, applyPrefixFormat } from "../../constants";
import { FLOW_ROLE_ORDER, FLOW_ROLE_DESCRIPTIONS } from "../../types";
import { renameFlowFolders, syncObsidianConfigs } from "../../core/folder-manager";
import type { FlowSettingTab } from "../../settings";
import { getSettingsLabels } from "../../i18n/settings-labels";

export class FoldersTab {
	constructor(private plugin: FlowPlugin, private settingTab: FlowSettingTab) {}

	display(containerEl: HTMLElement): void {
		const L = getSettingsLabels(this.plugin.settings);
		const section = containerEl.createDiv("flow-section");

		// Preset selector
		new Setting(section)
			.setName(L.folderPreset)
			.setDesc(L.folderPresetDesc)
			.addDropdown((dropdown) => {
				for (const preset of FLOW_PRESETS) {
					dropdown.addOption(preset.id, preset.label);
				}
				dropdown.addOption("custom", "Custom (tùy chỉnh)");

				dropdown.setValue(this.plugin.settings.presetId);
				dropdown.onChange(async (value) => {
					const oldMap = { ...this.plugin.settings.folderMap };
					this.plugin.settings.presetId = value;

					if (value !== "custom") {
						const preset = getPresetById(value);
						if (preset) {
							this.plugin.settings.folderMap = applyPrefixFormat(
								preset.folders,
								this.plugin.settings.useNumberPrefix
							);
						}
					}

					await this.plugin.saveSettings();

					const newMap = this.plugin.settings.folderMap;
					const renamedPairs = await renameFlowFolders(this.plugin.app.vault, oldMap, newMap);
					await syncObsidianConfigs(this.plugin.app.vault, oldMap, newMap);

					this.plugin.reinstallSort();
					this.settingTab.display();
				});
			});

		// Number prefix toggle
		new Setting(section)
			.setName(L.numberPrefix)
			.setDesc(L.numberPrefixDesc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.useNumberPrefix);
				toggle.onChange(async (value) => {
					this.plugin.settings.useNumberPrefix = value;

					const oldMap = { ...this.plugin.settings.folderMap };
					const newMap = applyPrefixFormat(oldMap, value);

					this.plugin.settings.folderMap = newMap;
					await this.plugin.saveSettings();

					new Notice(L.renamingNotice, 7000);

					const renamedPairs2 = await renameFlowFolders(this.plugin.app.vault, oldMap, newMap);
					await syncObsidianConfigs(this.plugin.app.vault, oldMap, newMap);
					this.plugin.reinstallSort();
					this.settingTab.display();
				});
			});

		// Auto-create folders on startup
		new Setting(section)
			.setName(L.autoCreate)
			.setDesc(L.autoCreateDesc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.autoCreateFolders);
				toggle.onChange(async (value) => {
					this.plugin.settings.autoCreateFolders = value;
					await this.plugin.saveSettings();
					if (value) {
						const { createMissingFlowFolders } = await import("../../core/folder-manager");
						const created = await createMissingFlowFolders(
							this.plugin.app.vault,
							this.plugin.settings.folderMap
						);
						if (created.length === 0) {
							new Notice("FLOW: All folders already exist.");
						}
					}
				});
			});

		// Custom sort toggle
		new Setting(section)
			.setName(L.customSort)
			.setDesc(L.customSortDesc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.enableCustomSort);
				toggle.onChange(async (value) => {
					this.plugin.settings.enableCustomSort = value;
					await this.plugin.saveSettings();
					if (value) {
						this.plugin.reinstallSort();
						new Notice("FLOW: Custom sort enabled.");
					} else {
						this.plugin.uninstallSort();
						new Notice("FLOW: Custom sort disabled.");
					}
				});
			});

		// Folder name editors
		const isCustom = this.plugin.settings.presetId === "custom";

		const namesSection = containerEl.createDiv("flow-section");
		namesSection.createEl("h3", { text: L.folderNames });
		if (!isCustom) {
			namesSection.createEl("p", {
				text: L.switchToCustom,
				cls: "setting-item-description",
			});
		}

		for (const role of FLOW_ROLE_ORDER) {
			const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
			const roleIndex = FLOW_ROLE_ORDER.indexOf(role) + 1;
			new Setting(namesSection)
				.setName(`${roleIndex}. ${roleLabel}`)
				.setDesc(FLOW_ROLE_DESCRIPTIONS[role])
				.addText((text) => {
					text
						.setPlaceholder(`${roleIndex}. ${roleLabel}`)
						.setValue(this.plugin.settings.folderMap[role])
						.setDisabled(!isCustom)
						.onChange(async (value) => {
							if (isCustom && value.trim()) {
								const oldMap = { ...this.plugin.settings.folderMap };
								this.plugin.settings.folderMap[role] = value.trim();
								await this.plugin.saveSettings();
								await renameFlowFolders(
									this.plugin.app.vault,
									oldMap,
									this.plugin.settings.folderMap
								);
								await syncObsidianConfigs(
									this.plugin.app.vault,
									oldMap,
									this.plugin.settings.folderMap
								);
								this.plugin.reinstallSort();
							}
						});
				});
		}
	}
}
