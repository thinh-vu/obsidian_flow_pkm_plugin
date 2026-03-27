/**
 * Tag Taxonomy Suggest Provider.
 * Provides auto-complete suggestions from the user's registered tag taxonomy
 * when typing '#' in the editor.
 */

import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";
import type FlowPlugin from "../../main";
import { TagNode } from "../../types";

interface TagSuggestion {
	fullTag: string;
	description?: string;
}

export class TagTaxonomySuggest extends EditorSuggest<TagSuggestion> {
	private plugin: FlowPlugin;

	constructor(plugin: FlowPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		// Find the last '#' before cursor that isn't inside code/link
		const beforeCursor = line.slice(0, cursor.ch);
		const match = beforeCursor.match(/#([\w/]*)$/);

		if (!match) return null;

		const query = match[1] || "";

		return {
			start: { line: cursor.line, ch: cursor.ch - query.length - 1 },
			end: cursor,
			query,
		};
	}

	getSuggestions(context: EditorSuggestContext): TagSuggestion[] {
		const taxonomy = this.plugin.settings.tagTaxonomy || [];
		if (taxonomy.length === 0) return [];

		const query = context.query.toLowerCase();
		const allTags = this.flattenTaxonomy(taxonomy, "");

		return allTags
			.filter((t) => t.fullTag.toLowerCase().includes(query))
			.slice(0, 20);
	}

	renderSuggestion(suggestion: TagSuggestion, el: HTMLElement): void {
		const container = el.createDiv();
		container.style.display = "flex";
		container.style.flexDirection = "column";
		container.style.gap = "2px";

		const tagEl = container.createSpan({ text: `#${suggestion.fullTag}` });
		tagEl.style.fontWeight = "500";
		tagEl.style.color = "var(--text-accent)";

		if (suggestion.description) {
			const descEl = container.createSpan({ text: suggestion.description });
			descEl.style.fontSize = "0.85em";
			descEl.style.color = "var(--text-muted)";
		}
	}

	selectSuggestion(suggestion: TagSuggestion, _evt: MouseEvent | KeyboardEvent): void {
		if (!this.context) return;

		const editor = this.context.editor;
		const start = this.context.start;
		const end = this.context.end;

		editor.replaceRange(`#${suggestion.fullTag} `, start, end);
	}

	/**
	 * Flatten the tag hierarchy into a flat list of full tag paths.
	 */
	private flattenTaxonomy(nodes: TagNode[], parentPath: string): TagSuggestion[] {
		const result: TagSuggestion[] = [];

		for (const node of nodes) {
			const fullTag = parentPath ? `${parentPath}/${node.name}` : node.name;
			result.push({ fullTag, description: node.description });

			if (node.children?.length > 0) {
				result.push(...this.flattenTaxonomy(node.children, fullTag));
			}
		}

		return result;
	}
}
