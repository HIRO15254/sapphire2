import {
	buildIconSearchIndex,
	type IconSearchIndex,
	suggestIconFromWords,
} from "./icon-search";

export const ICON_FONT_FAMILY = "sapphire-tabler-icons";

interface IconGlyphs {
	codeByName: Map<string, number>;
	names: string[];
}

export interface IconGlyph {
	char: string;
	ready: boolean;
}

let glyphs: IconGlyphs | null = null;
let glyphsPromise: Promise<IconGlyphs> | null = null;
let searchIndexPromise: Promise<IconSearchIndex> | null = null;
const readyChars = new Set<string>();
const loadingChars = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
let notifyQueued = false;

function notify() {
	if (notifyQueued) {
		return;
	}
	notifyQueued = true;
	queueMicrotask(() => {
		notifyQueued = false;
		version += 1;
		for (const listener of listeners) {
			listener();
		}
	});
}

function fontsSupported(): boolean {
	return (
		typeof document !== "undefined" &&
		typeof FontFace !== "undefined" &&
		document.fonts !== undefined
	);
}

function registerFont(faces: { unicodeRange: string; url: string }[]) {
	if (!fontsSupported()) {
		return;
	}
	for (const face of faces) {
		document.fonts.add(
			new FontFace(ICON_FONT_FAMILY, `url("${face.url}") format("woff2")`, {
				display: "swap",
				unicodeRange: face.unicodeRange,
			})
		);
	}
}

export function subscribeIconData(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function getIconDataVersion(): number {
	return version;
}

export function loadIconGlyphs(): Promise<IconGlyphs> {
	glyphsPromise ??= import("virtual:tabler-icons/glyphs").then(
		(module) => {
			registerFont(module.FONT_FACES);
			glyphs = {
				codeByName: new Map(
					module.ICON_NAMES.map((name, i) => [name, module.ICON_CODES[i] ?? 0])
				),
				names: module.ICON_NAMES,
			};
			notify();
			return glyphs;
		},
		(error: unknown) => {
			glyphsPromise = null;
			throw error;
		}
	);
	return glyphsPromise;
}

export function loadIconSearchIndex(): Promise<IconSearchIndex> {
	searchIndexPromise ??= Promise.all([
		loadIconGlyphs(),
		import("virtual:tabler-icons/tags"),
	]).then(
		([loaded, tags]) => buildIconSearchIndex(loaded.names, tags.ICON_TAGS),
		(error: unknown) => {
			searchIndexPromise = null;
			throw error;
		}
	);
	return searchIndexPromise;
}

function loadChar(char: string) {
	if (loadingChars.has(char)) {
		return;
	}
	loadingChars.add(char);
	const done = () => {
		readyChars.add(char);
		notify();
	};
	document.fonts.load(`16px "${ICON_FONT_FAMILY}"`, char).then(done, done);
}

export function iconGlyph(name: string): IconGlyph | null | undefined {
	if (!glyphs) {
		loadIconGlyphs().catch(() => undefined);
		return;
	}
	const code = glyphs.codeByName.get(name);
	if (code === undefined) {
		return null;
	}
	const char = String.fromCodePoint(code);
	if (!fontsSupported() || readyChars.has(char)) {
		return { char, ready: true };
	}
	loadChar(char);
	return { char, ready: false };
}

export async function suggestIcon(text: string): Promise<string> {
	return suggestIconFromWords(await loadIconSearchIndex(), text);
}

export async function suggestIconForKeywords(
	keywords: string[]
): Promise<string> {
	if (keywords.length === 0) {
		return "";
	}
	const index = await loadIconSearchIndex();
	for (const keyword of keywords) {
		const name = suggestIconFromWords(index, keyword);
		if (name) {
			return name;
		}
	}
	return "";
}
