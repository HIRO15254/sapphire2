export interface UpdateNoteSection {
	items: string[];
	section: string;
}

const LIST_ITEM_PREFIX = /^[-*]\s+/;
const SECTION_HEADING_PREFIX = /^###\s+/;

export function parseReleaseBody(body: string | null): UpdateNoteSection[] {
	if (!body) {
		return [];
	}

	const sections: UpdateNoteSection[] = [];
	let current: UpdateNoteSection | null = null;

	for (const rawLine of body.split("\n")) {
		const line = rawLine.trim();

		if (SECTION_HEADING_PREFIX.test(line)) {
			current = {
				section: line.replace(SECTION_HEADING_PREFIX, "").trim(),
				items: [],
			};
			sections.push(current);
			continue;
		}

		if (line.startsWith("#")) {
			continue;
		}

		const item = line.replace(LIST_ITEM_PREFIX, "").trim();
		if (item.length === 0) {
			continue;
		}

		if (!current) {
			current = { section: "", items: [] };
			sections.push(current);
		}
		current.items.push(item);
	}

	return sections;
}
