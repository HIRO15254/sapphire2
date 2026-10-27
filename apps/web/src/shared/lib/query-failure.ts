export type QueryFailure = "not-found" | "retryable";

export function classifyQueryFailure(error: unknown): QueryFailure {
	if (typeof error !== "object" || error === null || !("data" in error)) {
		return "retryable";
	}

	const { data } = error;
	if (typeof data !== "object" || data === null || !("code" in data)) {
		return "retryable";
	}

	return data.code === "FORBIDDEN" || data.code === "NOT_FOUND"
		? "not-found"
		: "retryable";
}
