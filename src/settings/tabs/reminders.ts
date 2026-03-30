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

		const isVi = this.plugin.settings.language !== "en";
		const daysLabels = isVi ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

		for (const rt of reminderTypes) {
			const reminderKey = rt.key;
			const rtName = L[rt.nameKey] as string;
			const rtDesc = L[rt.descKey] as string;
			const config = this.plugin.settings.reminders[reminderKey];

			const group = typesSection.createDiv();
			group.addClass("flow-reminder-group");

			new Setting(group)
				.setName(rtName)
				.setDesc(rtDesc)
				.addToggle((toggle) => {
					toggle.setValue(config.enabled);
					toggle.onChange(async (value) => {
						config.enabled = value;
						await this.plugin.saveSettings();
						new Notice(`FLOW: "${rtName}" ${value ? "enabled" : "disabled"}.`);
					});
				})
				.addButton((button) => {
					button
						.setButtonText("🔔 Test")
						.setTooltip("Preview this reminder — fires in 3s")
						.onClick(() => {
							new Notice("⏳ Test notification will fire in 3 seconds...");
							const msg = REMINDER_MESSAGES[reminderKey];
							setTimeout(() => {
								// Always show an internal notice to ensure visibility
								new Notice(`🔔 FLOW: ${msg}`, 10000);
								if ("Notification" in window && Notification.permission === "granted") {
									new Notification(`FLOW: ${rtName}`, { body: msg, icon: "🔔" });
								} else if ("Notification" in window && Notification.permission !== "denied") {
									void Notification.requestPermission().then(perm => {
										if (perm === "granted") {
											new Notification(`FLOW: ${rtName}`, { body: msg, icon: "🔔" });
										}
									});
								}
							}, 3000);
						});
				});

			// Days of week setting
			const daysSetting = new Setting(group)
				.setName(isVi ? "Ngày hoạt động" : "Active Days")
				.setDesc(isVi ? "Chọn các ngày trong tuần sẽ nhận được thông báo này." : "Select which days of the week this reminder is active.");

			const daysControl = daysSetting.controlEl;
			daysControl.addClass("flow-reminder-days-container");

			daysLabels.forEach((lbl, index) => {
				const chip = daysControl.createEl("label");
				// Reusing the feeling chip style for a quick nice look, or create a specific one
				chip.addClass("flow-reminder-day-chip");
				const isActive = config.activeDays?.includes(index) ?? true;
				if (isActive) chip.addClass("is-active");

				const cb = chip.createEl("input", { type: "checkbox" }) as HTMLInputElement;
				cb.checked = isActive;
				cb.style.display = "none";

				chip.createSpan({ text: lbl });

				cb.onchange = async () => {
					let days = config.activeDays ?? [0, 1, 2, 3, 4, 5, 6];
					if (cb.checked) {
						if (!days.includes(index)) days.push(index);
					} else {
						days = days.filter(d => d !== index);
					}
					days.sort();
					config.activeDays = days;
					await this.plugin.saveSettings();
					
					if (cb.checked) chip.addClass("is-active");
					else chip.removeClass("is-active");
				};
			});

			// Time window setting
			new Setting(group)
				.setName(isVi ? "Khung giờ" : "Time Window")
				.setDesc(isVi ? "Chỉ hiển thị nhắc nhở trong khoảng thời gian này." : "Only trigger reminders within this time window.")
				.addText(text => {
					text.inputEl.type = "time";
					text.setValue(config.activeStartTime ?? "08:00");
					text.onChange(async val => {
						config.activeStartTime = val;
						await this.plugin.saveSettings();
					});
				})
				.addText(text => {
					text.inputEl.type = "time";
					text.setValue(config.activeEndTime ?? "22:00");
					text.onChange(async val => {
						config.activeEndTime = val;
						await this.plugin.saveSettings();
					});
				});
		}
	}
}
