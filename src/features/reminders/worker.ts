import { Notice, moment, TFile } from "obsidian";
import type FlowPlugin from "../../main";
import { FlowRole, ReminderConfig } from "../../types";
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
			void this.evaluateReminders();

			// Then schedule periodic checks
			const intervalMs = this.plugin.settings.reminderCheckIntervalSec * 1000;
			if (intervalMs > 0) {
				this.plugin.registerInterval(
					window.setInterval(() => {
						void this.evaluateReminders();
					}, intervalMs)
				);
			}
		}, initialDelayMs);
	}

	private isReminderActive(config: ReminderConfig, date: Date): boolean {
		if (config.activeDays && !config.activeDays.includes(date.getDay())) {
			return false;
		}
		
		const currentMins = date.getHours() * 60 + date.getMinutes();
		
		if (config.activeStartTime) {
			const [sh, sm] = config.activeStartTime.split(":").map(Number);
			const startMins = (sh || 0) * 60 + (sm || 0);
			if (currentMins < startMins) return false;
		}
		
		if (config.activeEndTime) {
			const [eh, em] = config.activeEndTime.split(":").map(Number);
			const endMins = (eh || 0) * 60 + (em || 0);
			if (currentMins > endMins) return false;
		}
		
		return true;
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
		const nowObj = new Date(now);

		await this.evaluateTaskReminders();

		// consolidateCapture
		if (reminders.consolidateCapture.enabled && this.isReminderActive(reminders.consolidateCapture, nowObj)) {
			const captureStats = stats.roleStats[FlowRole.CAPTURE];
			if (captureStats && captureStats.captureRawNotes > 0) {
				const timeSinceLast = now - reminders.consolidateCapture.lastTriggered;
				if (timeSinceLast > oneDayMs) {
					this.triggerNotification(L.consolidateCapture, REMINDER_MESSAGES.consolidateCapture);
					reminders.consolidateCapture.lastTriggered = now;
					settingsChanged = true;
				}
			}
		}

		// dailyNote
		if (reminders.dailyNote.enabled && this.isReminderActive(reminders.dailyNote, nowObj)) {
			const timeSinceLast = now - reminders.dailyNote.lastTriggered;
			// 12 hours minimum between daily notes to avoid spam but catch them once a day
			if (timeSinceLast > 12 * 60 * 60 * 1000) {
				this.triggerNotification(L.dailyNote, REMINDER_MESSAGES.dailyNote);
				reminders.dailyNote.lastTriggered = now;
				settingsChanged = true;
			}
		}

		// weeklyReview
		if (reminders.weeklyReview.enabled && this.isReminderActive(reminders.weeklyReview, nowObj)) {
			const timeSinceLast = now - reminders.weeklyReview.lastTriggered;
			if (timeSinceLast > oneWeekMs) {
				this.triggerNotification(L.weeklyReview, REMINDER_MESSAGES.weeklyReview);
				reminders.weeklyReview.lastTriggered = now;
				settingsChanged = true;
			}
		}

		// publishContent
		if (reminders.publishContent.enabled && this.isReminderActive(reminders.publishContent, nowObj)) {
			const timeSinceLast = now - reminders.publishContent.lastTriggered;
			if (timeSinceLast > oneWeekMs) {
				this.triggerNotification(L.publishContent, REMINDER_MESSAGES.publishContent);
				reminders.publishContent.lastTriggered = now;
				settingsChanged = true;
			}
		}

		// forgeCleanup
		if (reminders.forgeCleanup.enabled && this.isReminderActive(reminders.forgeCleanup, nowObj)) {
			const forgeStats = stats.roleStats[FlowRole.FORGE];
			if (forgeStats && forgeStats.subfolderCount > settings.maxSubfolders) {
				const timeSinceLast = now - reminders.forgeCleanup.lastTriggered;
				if (timeSinceLast > oneDayMs) {
					this.triggerNotification(L.forgeCleanup, REMINDER_MESSAGES.forgeCleanup);
					reminders.forgeCleanup.lastTriggered = now;
					settingsChanged = true;
				}
			}
		}

		if (settingsChanged) {
			await this.plugin.saveSettings();
		}
	}

	private async evaluateTaskReminders() {
		const trackFolder = this.plugin.settings.folderMap[FlowRole.TRACK] || "2. Track";
		const todayStr = moment().format("YYYY-MM-DD");
		const currentMinuteStr = moment().format("YYYY-MM-DD HH:mm");
		
		const todayFile = this.plugin.app.vault.getAbstractFileByPath(`${trackFolder}/${todayStr}.md`);
		if (!(todayFile instanceof TFile)) return;

		const content = await this.plugin.app.vault.cachedRead(todayFile);
		const lines = content.split('\n');

		// Simple local state to avoid firing multiple times for the same task in the same minute
		// Though since interval is exactly 60s, it usually fires once.
		if (!this.notifiedTaskMins) this.notifiedTaskMins = new Set<string>();

		for (const line of lines) {
			// Find uncompleted tasks `- [ ] `
			if (!line.match(/^[ \t]*[-*+]\s+\[ \]\s+/)) continue;

			// Extract (@YYYY-MM-DD HH:mm)
			const reminderMatch = line.match(/\(@(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\)/);
			if (!reminderMatch || !reminderMatch[1]) continue;

			const taskTimeStr = reminderMatch[1];
			
			// If it matches exactly current minute
			if (taskTimeStr === currentMinuteStr) {
				const uniqueKey = `${todayStr}:${taskTimeStr}:${line}`;
				if (!this.notifiedTaskMins.has(uniqueKey)) {
					// Extract clean text for notification
					let cleanText = line.replace(/^[ \t]*[-*+]\s+\[ \]\s+/, "");
					cleanText = cleanText.replace(reminderMatch[0], "").trim();
					
					this.triggerNotification("Task Reminder", cleanText);
					this.notifiedTaskMins.add(uniqueKey);
					
					// Optional: Keep set from growing infinitely
					if (this.notifiedTaskMins.size > 1000) this.notifiedTaskMins.clear();
				}
			}
		}
	}
	
	private notifiedTaskMins?: Set<string>;

	private triggerNotification(title: string, body: string) {
		// Always show an internal notice to ensure it doesn't quietly fail
		new Notice(`🔔 FLOW: ${body}`, 10000);

		if ("Notification" in window && Notification.permission === "granted") {
			new Notification(`FLOW: ${title}`, { body, icon: "🔔" });
		} else if ("Notification" in window && Notification.permission !== "denied") {
			void Notification.requestPermission().then((perm) => {
				if (perm === "granted") {
					new Notification(`FLOW: ${title}`, { body, icon: "🔔" });
				}
			});
		}
	}
}
