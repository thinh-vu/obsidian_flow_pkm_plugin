/**
 * Modular Settings tab for the FLOW plugin.
 */

import { App, PluginSettingTab, setIcon } from "obsidian";
import type FlowPlugin from "./main";
import { FLOW_ROLE_ORDER, FlowRole } from "./types";
import { getSettingsLabels } from "./i18n/settings-labels";

import { GeneralTab } from "./settings/tabs/general";
import { FoldersTab } from "./settings/tabs/folders";
import { TaxonomyTab } from "./settings/tabs/taxonomy";
import { RemindersTab } from "./settings/tabs/reminders";
import { HealthTab } from "./settings/tabs/health";

export interface SettingTab {
	id: string;
	name: string;
	icon: string;
}

const SETTING_TABS: SettingTab[] = [
	{ id: "general", name: "General", icon: "settings" },
	{ id: "folders", name: "Folders", icon: "folder-tree" },
	{ id: "taxonomy", name: "Taxonomy", icon: "tags" },
	{ id: "reminders", name: "Reminders", icon: "bell" },
	{ id: "health", name: "Vault Health", icon: "heart-pulse" },
];

const TAB_NAME_KEYS: Record<string, keyof ReturnType<typeof getSettingsLabels>> = {
	general: "tabGeneral",
	folders: "tabFolders",
	taxonomy: "tabTaxonomy",
	reminders: "tabReminders",
	health: "tabHealth",
};

export class FlowSettingTab extends PluginSettingTab {
	plugin: FlowPlugin;
	activeTab = "general";
	
	/** Track which folders to generate TOC for (defaults: all except Track + Vault) */
	public tocSelectedRoles: Set<FlowRole> = new Set(
		FLOW_ROLE_ORDER.filter((r) => r !== FlowRole.TRACK && r !== FlowRole.VAULT)
	);

	private tabModules: Record<string, { display: (container: HTMLElement) => void }>;

	constructor(app: App, plugin: FlowPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		
		this.tabModules = {
			general: new GeneralTab(plugin, this),
			folders: new FoldersTab(plugin, this),
			taxonomy: new TaxonomyTab(plugin, this),
			reminders: new RemindersTab(plugin),
			health: new HealthTab(plugin),
		};
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("flow-settings");

		const L = getSettingsLabels(this.plugin.settings);

		// ── Header ─────────────────────────────────────────
		containerEl.createEl("h2", { text: L.settingsTitle });

		// ── Tab bar ────────────────────────────────────────
		const tabBar = containerEl.createEl("div", { cls: "flow-tabs" });

		for (const tab of SETTING_TABS) {
			const tabButton = tabBar.createEl("div", {
				cls: `flow-tab ${this.activeTab === tab.id ? "active" : ""}`,
			});
			setIcon(tabButton, tab.icon);
			const nameKey = TAB_NAME_KEYS[tab.id];
			const displayName = nameKey ? L[nameKey] : tab.name;
			tabButton.createEl("span", { text: displayName as string });

			tabButton.addEventListener("click", () => {
				this.activeTab = tab.id;
				this.display();
			});
		}

		// ── Content ────────────────────────────────────────
		const content = containerEl.createEl("div", { cls: "flow-content" });

		const activeTabModule = this.tabModules[this.activeTab];
		if (activeTabModule) {
			activeTabModule.display(content);
		}
	}
}
