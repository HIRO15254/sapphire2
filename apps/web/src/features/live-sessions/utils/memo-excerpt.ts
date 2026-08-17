const HTML_TAG_PATTERN = /<[^>]*>/g;
const BR_PATTERN = /<br\s*\/?>/gi;
const WHITESPACE_RUN_PATTERN = /\s+/g;

const ENTITY_MAP: Record<string, string> = {
	"&amp;": "&",
	"&gt;": ">",
	"&lt;": "<",
	"&nbsp;": " ",
	"&quot;": '"',
	"&#39;": "'",
};

const ENTITY_PATTERN = /&(?:amp|lt|gt|nbsp|quot|#39);/g;

export function memoExcerpt(memo: string | null): string | null {
	if (!memo) {
		return null;
	}
	const text = memo
		.replace(BR_PATTERN, " ")
		.replace(HTML_TAG_PATTERN, " ")
		.replace(ENTITY_PATTERN, (entity) => ENTITY_MAP[entity] ?? entity)
		.replace(WHITESPACE_RUN_PATTERN, " ")
		.trim();
	return text === "" ? null : text;
}
