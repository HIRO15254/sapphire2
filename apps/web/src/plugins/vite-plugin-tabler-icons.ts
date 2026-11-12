import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const GLYPHS_ID = "virtual:tabler-icons/glyphs";
const TAGS_ID = "virtual:tabler-icons/tags";
const RESOLVED_GLYPHS_ID = `\0${GLYPHS_ID}`;
const RESOLVED_TAGS_ID = `\0${TAGS_ID}`;

const FONT_FACE = /@font-face\s*\{(?<body>[^}]*)\}/gu;
const FONT_SRC = /url\("\.\/fonts\/(?<file>[^"?]+\.woff2)[^"]*"\)/u;
const UNICODE_RANGE = /unicode-range:\s*(?<range>[^;]+);/u;

interface TablerIconMeta {
	category?: string;
	styles?: { outline?: { unicode?: string } };
	tags?: (number | string)[];
}

interface TablerIconData {
	codes: number[];
	fontFaces: { file: string; unicodeRange: string }[];
	names: string[];
	tags: string[];
}

function findPackageDir(pkg: string, from: string): string {
	let dir = from;
	for (;;) {
		const candidate = path.join(dir, "node_modules", pkg);
		if (existsSync(candidate)) {
			return candidate;
		}
		const parent = path.dirname(dir);
		if (parent === dir) {
			throw new Error(`[tabler-icons] ${pkg} is not installed`);
		}
		dir = parent;
	}
}

function readTablerIconData(
	iconsJson: string,
	webfontCss: string
): TablerIconData {
	const meta = JSON.parse(iconsJson) as Record<string, TablerIconMeta>;
	const names = Object.keys(meta)
		.filter((name) => meta[name]?.styles?.outline?.unicode)
		.sort();
	const codes = names.map((name) =>
		Number(`0x${meta[name]?.styles?.outline?.unicode ?? ""}`)
	);
	const tags = names.map((name) => {
		const icon = meta[name];
		return [...(icon?.tags ?? []), icon?.category ?? ""]
			.map((tag) => String(tag).toLowerCase().trim())
			.filter(Boolean)
			.join(" ");
	});
	const fontFaces = [...webfontCss.matchAll(FONT_FACE)].flatMap((match) => {
		const body = match.groups?.body ?? "";
		const file = FONT_SRC.exec(body)?.groups?.file;
		const unicodeRange = UNICODE_RANGE.exec(body)?.groups?.range?.trim();
		return file && unicodeRange ? [{ file, unicodeRange }] : [];
	});
	return { codes, fontFaces, names, tags };
}

export function tablerIconsPlugin(): Plugin {
	let data: TablerIconData | null = null;
	let fontDir = "";

	const load = () => {
		if (!data) {
			const iconsDir = findPackageDir("@tabler/icons", import.meta.dirname);
			const webfontDir = findPackageDir(
				"@tabler/icons-webfont",
				import.meta.dirname
			);
			fontDir = path.join(webfontDir, "dist", "fonts");
			data = readTablerIconData(
				readFileSync(path.join(iconsDir, "icons.json"), "utf8"),
				readFileSync(path.join(webfontDir, "dist", "tabler-icons.css"), "utf8")
			);
		}
		return data;
	};

	return {
		load(id) {
			if (id === RESOLVED_GLYPHS_ID) {
				const { codes, fontFaces, names } = load();
				const imports = fontFaces
					.map(
						(face, i) =>
							`import font${i} from ${JSON.stringify(`${path.join(fontDir, face.file)}?url&no-inline`)};`
					)
					.join("\n");
				const faces = fontFaces
					.map(
						(face, i) =>
							`{ url: font${i}, unicodeRange: ${JSON.stringify(face.unicodeRange)} }`
					)
					.join(",\n");
				return `${imports}
export const ICON_NAMES = ${JSON.stringify(names.join("|"))}.split("|");
export const ICON_CODES = ${JSON.stringify(codes)};
export const FONT_FACES = [${faces}];
`;
			}
			if (id === RESOLVED_TAGS_ID) {
				return `export const ICON_TAGS = ${JSON.stringify(load().tags.join("|"))}.split("|");\n`;
			}
		},
		name: "tabler-icons",
		resolveId(id) {
			if (id === GLYPHS_ID) {
				return RESOLVED_GLYPHS_ID;
			}
			if (id === TAGS_ID) {
				return RESOLVED_TAGS_ID;
			}
		},
	};
}
