import { Setting, Notice } from "obsidian";
import type FlowPlugin from "../../main";
import { NamingConvention } from "../../types";
import { getSettingsLabels } from "../../i18n/settings-labels";

const NAMING_OPTIONS: { value: NamingConvention; label: string; labelVi: string }[] = [
	{ value: "any", label: "Any (no preference)", labelVi: "Tuỳ ý (không ưu tiên)" },
	{ value: "space", label: "Spaces — My Note Name", labelVi: "Khoảng trắng — My Note Name" },
	{ value: "kebab-case", label: "Kebab — my-note-name", labelVi: "Gạch ngang — my-note-name" },
	{ value: "snake_case", label: "Snake — my_note_name", labelVi: "Gạch dưới — my_note_name" },
	{ value: "camelCase", label: "Camel — myNoteName", labelVi: "camelCase — myNoteName" },
	{ value: "PascalCase", label: "Pascal — MyNoteName", labelVi: "PascalCase — MyNoteName" },
];

export class HealthTab {
	constructor(private plugin: FlowPlugin) {}

	display(containerEl: HTMLElement): void {
		const L = getSettingsLabels(this.plugin.settings);
		const isVi = this.plugin.settings.language === "vi";
		const section = containerEl.createDiv("flow-section");

		// ── Basic thresholds ──────────────────

		new Setting(section)
			.setName(L.staleCaptureDays)
			.setDesc(L.staleCaptureDaysDesc)
			.addText((text) => {
				text
					.setPlaceholder("7")
					.setValue(String(this.plugin.settings.captureStaleDays))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.captureStaleDays = num;
							await this.plugin.saveSettings();
							new Notice(`FLOW: Stale Capture threshold → ${num} days.`);
						}
					});
			});

		new Setting(section)
			.setName(L.maxSubfolders)
			.setDesc(L.maxSubfoldersDesc)
			.addText((text) => {
				text
					.setPlaceholder("9")
					.setValue(String(this.plugin.settings.maxSubfolders))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.maxSubfolders = num;
							await this.plugin.saveSettings();
							new Notice(`FLOW: Max subfolders → ${num}.`);
						}
					});
			});

		new Setting(section)
			.setName(L.maxSubfolderDepth)
			.setDesc(L.maxSubfolderDepthDesc)
			.addText((text) => {
				text
					.setPlaceholder("2")
					.setValue(String(this.plugin.settings.healthScoring.maxSubfolderDepth))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.healthScoring.maxSubfolderDepth = num;
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(section)
			.setName(L.namingConventionLabel)
			.setDesc(L.namingConventionDesc)
			.addDropdown((dropdown) => {
				for (const opt of NAMING_OPTIONS) {
					dropdown.addOption(opt.value, isVi ? opt.labelVi : opt.label);
				}
				dropdown.setValue(this.plugin.settings.namingConvention);
				dropdown.onChange(async (value) => {
					this.plugin.settings.namingConvention = value as NamingConvention;
					await this.plugin.saveSettings();
				});
			});

		// ── Scoring Configuration ──────────────────
		const scoringSection = containerEl.createDiv("flow-section");
		scoringSection.createEl("h3", { text: L.scoringSection });
		scoringSection.createEl("p", {
			text: L.scoringSectionDesc,
			cls: "setting-item-description",
		});

		new Setting(scoringSection)
			.setName(L.maxNotesPerFolder)
			.setDesc(L.maxNotesPerFolderDesc)
			.addText((text) => {
				text
					.setPlaceholder("9")
					.setValue(String(this.plugin.settings.healthScoring.maxNotesPerFolder))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.healthScoring.maxNotesPerFolder = num;
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(scoringSection)
			.setName(L.maxRootNotes)
			.setDesc(L.maxRootNotesDesc)
			.addText((text) => {
				text
					.setPlaceholder("9")
					.setValue(String(this.plugin.settings.healthScoring.maxRootNotes))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.healthScoring.maxRootNotes = num;
							await this.plugin.saveSettings();
						}
					});
			});

		// Stale thresholds — 3 inputs inline
		this.renderTripleInput(scoringSection, L.staleThresholds, L.staleThresholdsDesc,
			this.plugin.settings.healthScoring.staleThresholdDays,
			async (vals) => {
				this.plugin.settings.healthScoring.staleThresholdDays = vals;
				await this.plugin.saveSettings();
			});

		// Meta coverage — 2 inputs
		this.renderDualInput(scoringSection, L.metaCoverage, L.metaCoverageDesc,
			this.plugin.settings.healthScoring.metaCoverageThresholds,
			async (vals) => {
				this.plugin.settings.healthScoring.metaCoverageThresholds = vals;
				await this.plugin.saveSettings();
			});

		// Orphan thresholds — 3 inputs
		this.renderTripleInput(scoringSection, L.orphanThresholds, L.orphanThresholdsDesc,
			this.plugin.settings.healthScoring.orphanRateThresholds,
			async (vals) => {
				this.plugin.settings.healthScoring.orphanRateThresholds = vals;
				await this.plugin.saveSettings();
			});

		// Oversized — 2 inputs
		this.renderDualInput(scoringSection, L.oversizedThresholds, L.oversizedThresholdsDesc,
			this.plugin.settings.healthScoring.oversizedFileThresholds,
			async (vals) => {
				this.plugin.settings.healthScoring.oversizedFileThresholds = vals;
				await this.plugin.saveSettings();
			});
	}

	// ── Helpers for multi-value threshold inputs ──────────

	private renderTripleInput(
		container: HTMLElement,
		name: string,
		desc: string,
		values: [number, number, number],
		onSave: (vals: [number, number, number]) => Promise<void>
	) {
		const setting = new Setting(container).setName(name).setDesc(desc);
		const controlEl = setting.controlEl;
		controlEl.addClass("flow-health-control-flex");

		for (let i = 0; i < 3; i++) {
			const input = controlEl.createEl("input", { type: "number" });
			input.value = String(values[i]);
			input.addClass("flow-health-threshold-input");
			input.onchange = async () => {
				const num = parseInt(input.value, 10);
				if (!isNaN(num) && num >= 0) {
					values[i] = num;
					await onSave(values);
				}
			};
		}
	}

	private renderDualInput(
		container: HTMLElement,
		name: string,
		desc: string,
		values: [number, number],
		onSave: (vals: [number, number]) => Promise<void>
	) {
		const setting = new Setting(container).setName(name).setDesc(desc);
		const controlEl = setting.controlEl;
		controlEl.addClass("flow-health-control-flex");

		for (let i = 0; i < 2; i++) {
			const input = controlEl.createEl("input", { type: "number" });
			input.value = String(values[i]);
			input.addClass("flow-health-threshold-input");
			input.onchange = async () => {
				const num = parseInt(input.value, 10);
				if (!isNaN(num) && num >= 0) {
					values[i] = num;
					await onSave(values);
				}
			};
		}
	}
}
