import { Notice } from "obsidian";
import type FlowPlugin from "../../main";
import { FlowRole } from "../../types";
import { collectVaultStats } from "../dashboard/stats-collector";
import { getSettingsLabels } from "../../i18n/settings-labels";
import { REMINDER_MESSAGES } from "./constants";

export class NotificationWorker {
	private plugin: FlowPlugin;

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin;
	}

	public start() {
		// Delayed first start: wait 5 minutes after loading the vault
		const initialDelayMs = 5 * 60 * 1000;
		setTimeout(() => {
			this.evaluateReminders();

			// Then schedule periodic checks
			const intervalMs = this.plugin.settings.reminderCheckIntervalSec * 1000;
			if (intervalMs > 0) {
				this.plugin.registerInterval(
					window.setInterval(() => {
						this.evaluateReminders();
					}, intervalMs)
				);
			}
		}, initialDelayMs);
	}

	private async evaluateReminders() {
		const settings = this.plugin.settings;
		const reminders = settings.reminders;
		const stats = collectVaultStats(this.plugin.app, settings.folderMap, settings);
		
		const L = getSettingsLabels(settings);

		let settingsChanged = false;
		const now = Date.now();
		const oneDayMs = 24 * 60 * 60 * 1000;
		const oneWeekMs = 7 * oneDayMs;

		// consolidateCapture
		if (reminders.consolidateCapture.enabled) {
			const captureStats = stats.roleStats[FlowRole.CAPTURE];
			if (captureStats && captureStats.captureRawNotes > 0) {
				const timeSinceLast = now - reminders.consolidateCapture.lastTriggered;
				if (timeSinceLast > oneDayMs) {
					this.triggerNotification(L.consolidateCapture as string, REMINDER_MESSAGES.consolidateCapture);
					reminders.consolidateCapture.lastTriggered = now;
					settingsChanged = true;
				}
			}
		}

		// dailyNote
		if (reminders.dailyNote.enabled) {
			const timeSinceLast = now - reminders.dailyNote.lastTriggered;
			// 12 hours minimum between daily notes to avoid spam but catch them once a day
			if (timeSinceLast > 12 * 60 * 60 * 1000) {
				this.triggerNotification(L.dailyNote as string, REMINDER_MESSAGES.dailyNote);
				reminders.dailyNote.lastTriggered = now;
				settingsChanged = true;
			}
		}

		// weeklyReview
		if (reminders.weeklyReview.enabled) {
			const timeSinceLast = now - reminders.weeklyReview.lastTriggered;
			if (timeSinceLast > oneWeekMs) {
				this.triggerNotification(L.weeklyReview as string, REMINDER_MESSAGES.weeklyReview);
				reminders.weeklyReview.lastTriggered = now;
				settingsChanged = true;
			}
		}

		// publishContent
		if (reminders.publishContent.enabled) {
			const timeSinceLast = now - reminders.publishContent.lastTriggered;
			if (timeSinceLast > oneWeekMs) {
				this.triggerNotification(L.publishContent as string, REMINDER_MESSAGES.publishContent);
				reminders.publishContent.lastTriggered = now;
				settingsChanged = true;
			}
		}

		// forgeCleanup
		if (reminders.forgeCleanup.enabled) {
			const forgeStats = stats.roleStats[FlowRole.FORGE];
			if (forgeStats && forgeStats.subfolderCount > settings.maxSubfolders) {
				const timeSinceLast = now - reminders.forgeCleanup.lastTriggered;
				if (timeSinceLast > oneDayMs) {
					this.triggerNotification(L.forgeCleanup as string, REMINDER_MESSAGES.forgeCleanup);
					reminders.forgeCleanup.lastTriggered = now;
					settingsChanged = true;
				}
			}
		}

		if (settingsChanged) {
			await this.plugin.saveSettings();
		}
	}

	private triggerNotification(title: string, body: string) {
		if ("Notification" in window && Notification.permission === "granted") {
			new Notification(`FLOW: ${title}`, { body, icon: "🔔" });
		} else if ("Notification" in window && Notification.permission !== "denied") {
			Notification.requestPermission().then((perm) => {
				if (perm === "granted") {
					new Notification(`FLOW: ${title}`, { body, icon: "🔔" });
				} else {
					new Notice(`FLOW Reminder: ${body}`, 10000);
				}
			});
		} else {
			new Notice(`FLOW Reminder: ${body}`, 10000);
		}
	}
}
