export const LATEST_MODEL = "claude-opus-5";

export const AI_MODELS = {
	seating: LATEST_MODEL,
	tournamentExtraction: LATEST_MODEL,
} as const satisfies Record<string, typeof LATEST_MODEL>;

export const EXTRACTION_MAX_TOKENS = 8192;
