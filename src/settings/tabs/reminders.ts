import { Setting, Notice } from "obsidian";
import type FlowPlugin from "../../main";
import type { RemindersSettings } from "../../types";
import { getSettingsLabels } from "../../i18n/settings-labels";
import { REMINDER_MESSAGES } from "../../features/reminders/constants";

export class RemindersTab {
	constructor(private plugin: FlowPlugin) {}

	display(containerEl: HTMLElement): void {
		const L = getSettingsLabels(this.plugin.settings);
		const section = containerEl.createDiv("flow-section");

		new Setting(section)
			.setName(L.checkInterval)
			.setDesc(L.checkIntervalDesc)
			.addText((text) => {
				text
					.setPlaceholder("3600")
					.setValue(String(this.plugin.settings.reminderCheckIntervalSec))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 60) {
							this.plugin.settings.reminderCheckIntervalSec = num;
							await this.plugin.saveSettings();
							new Notice(`FLOW: Reminder interval → ${num}s. Reload to apply.`);
						}
					});
			});

		const typesSection = containerEl.createDiv("flow-section");
		typesSection.createEl("h3", { text: L.reminderTypes });

		const reminderTypes: {
			key: keyof RemindersSettings;
			nameKey: keyof typeof L;
			descKey: keyof typeof L;
		}[] = [
			{ key: "consolidateCapture", nameKey: "consolidateCapture", descKey: "consolidateCaptureDesc" },
			{ key: "dailyNote", nameKey: "dailyNote", descKey: "dailyNoteDesc" },
			{ key: "weeklyReview", nameKey: "weeklyReview", descKey: "weeklyReviewDesc" },
			{ key: "publishContent", nameKey: "publishContent", descKey: "publishContentDesc" },
			{ key: "forgeCleanup", nameKey: "forgeCleanup", descKey: "forgeCleanupDesc" },
		];

		for (const rt of reminderTypes) {
			const reminderKey = rt.key;
			const rtName = L[rt.nameKey] as string;
			const rtDesc = L[rt.descKey] as string;

			new Setting(typesSection)
				.setName(rtName)
				.setDesc(rtDesc)
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.reminders[reminderKey].enabled);
					toggle.onChange(async (value) => {
						this.plugin.settings.reminders[reminderKey].enabled = value;
						await this.plugin.saveSettings();
						new Notice(
							`FLOW: "${rtName}" ${value ? "enabled" : "disabled"}.`
						);
					});
				})
				.addButton((button) => {
					button
						.setButtonText("🔔 Test")
						.setTooltip("Preview this reminder — OS notification fires in 10s")
						.onClick(() => {
							new Notice("⏳ Test notification will fire in 10 seconds...");
							const msg = REMINDER_MESSAGES[reminderKey];
							setTimeout(() => {
								if ("Notification" in window && Notification.permission === "granted") {
									new Notification(`FLOW: ${rtName}`, { body: msg, icon: "🔔" });
								} else if ("Notification" in window && Notification.permission !== "denied") {
									Notification.requestPermission().then(perm => {
										if (perm === "granted") {
											new Notification(`FLOW: ${rtName}`, { body: msg, icon: "🔔" });
										} else {
											new Notice(`FLOW Reminder: ${msg}`, 10000);
										}
									});
								} else {
									new Notice(`FLOW Reminder: ${msg}`, 10000);
								}
							}, 10000);
						});
				});
		}
	}
}
