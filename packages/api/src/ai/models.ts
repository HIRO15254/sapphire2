export const LATEST_MODEL = "gpt-5.6-luna";

export const AI_MODELS = {
	iconKeywords: LATEST_MODEL,
	seating: LATEST_MODEL,
	tournamentExtraction: LATEST_MODEL,
} as const satisfies Record<string, typeof LATEST_MODEL>;

export const EXTRACTION_MAX_OUTPUT_TOKENS = 8192;

export const ICON_KEYWORDS_MAX_OUTPUT_TOKENS = 2048;
