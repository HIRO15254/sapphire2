declare module "turndown" {
	interface Options {
		bulletListMarker?: "-" | "+" | "*";
		codeBlockStyle?: "indented" | "fenced";
		emDelimiter?: "_" | "*";
		fence?: "```" | "~~~";
		headingStyle?: "setext" | "atx";
		hr?: string;
		linkReferenceStyle?: "full" | "collapsed" | "shortcut";
		linkStyle?: "inlined" | "referenced";
		preformattedCode?: boolean;
		strongDelimiter?: "**" | "__";
	}

	class TurndownService {
		constructor(options?: Options);
		turndown(html: string): string;
		use(plugin: (service: TurndownService) => void): this;
		addRule(key: string, rule: object): this;
		keep(filter: string | string[] | ((node: Node) => boolean)): this;
		remove(filter: string | string[] | ((node: Node) => boolean)): this;
		escape(str: string): string;
	}

	export = TurndownService;
}

declare module "turndown-plugin-gfm" {
	import type TurndownService from "turndown";
	export const gfm: (service: TurndownService) => void;
	export const tables: (service: TurndownService) => void;
	export const strikethrough: (service: TurndownService) => void;
	export const taskListItems: (service: TurndownService) => void;
}
