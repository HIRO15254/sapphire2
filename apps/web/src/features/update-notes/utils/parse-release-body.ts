export interface UpdateNoteSection {
	items: string[];
	section: string;
}

const LIST_ITEM_PREFIX = /^[-*]\s+/u;
const SECTION_HEADING_PREFIX = /^###\s+/u;

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
				items: [],
				section: line.replace(SECTION_HEADING_PREFIX, "").trim(),
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
			current = { items: [], section: "" };
			sections.push(current);
		}
		current.items.push(item);
	}

	return sections;
}
