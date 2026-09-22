export const LATEST_MODEL = "gpt-5.6-sol";

export const AI_MODELS = {
	seating: LATEST_MODEL,
	tournamentExtraction: LATEST_MODEL,
} as const satisfies Record<string, typeof LATEST_MODEL>;

export const EXTRACTION_MAX_OUTPUT_TOKENS = 8192;
