import { CONCURRENT_CHANGE_MESSAGE } from "@sapphire2/api/concurrent-change";

export type QueryFailure = "not-found" | "retryable";

export function isConcurrentChange(error: unknown): error is Error {
	return (
		error instanceof Error &&
		error.message === CONCURRENT_CHANGE_MESSAGE &&
		trpcErrorCode(error) === "CONFLICT"
	);
}

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
