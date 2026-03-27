import { RemindersSettings } from "../../types";

export const REMINDER_MESSAGES: Record<keyof RemindersSettings, string> = {
	consolidateCapture: "📥 You have unprocessed notes in Capture. Time to consolidate them into Forge!",
	dailyNote: "📝 Don't forget to write your daily reflection in Track!",
	weeklyReview: "📋 It's time for your weekly review — tidy up your vault and plan ahead.",
	publishContent: "🚀 Have you published anything to Exhibit this week? Time to share your work!",
	forgeCleanup: "🔥 Your Forge has too many active projects. Consider archiving some to Vault.",
};
