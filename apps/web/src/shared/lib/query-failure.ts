export type QueryFailure = "not-found" | "retryable";

export function trpcErrorCode(error: unknown): unknown {
	if (typeof error !== "object" || error === null || !("data" in error)) {
		return;
	}
	const { data } = error;
	if (typeof data !== "object" || data === null || !("code" in data)) {
		return;
	}
	return data.code;
}

export function classifyQueryFailure(error: unknown): QueryFailure {
	const code = trpcErrorCode(error);
	return code === "FORBIDDEN" || code === "NOT_FOUND"
		? "not-found"
		: "retryable";
}
