import { trpcErrorCode } from "@/shared/lib/query-failure";

export function firstError(errors: readonly unknown[]): string | undefined {
	for (const error of errors) {
		if (typeof error === "string") {
			return error;
		}
		if (
			typeof error === "object" &&
			error !== null &&
			"message" in error &&
			typeof error.message === "string"
		) {
			return error.message;
		}
	}
}

export function isNameConflict(error: unknown): boolean {
	return (
		trpcErrorCode(error) === "CONFLICT" &&
		error instanceof Error &&
		error.message.includes("name")
	);
}

export function isConflict(error: unknown): boolean {
	return trpcErrorCode(error) === "CONFLICT";
}

export function toInstant(value: Date | string): number {
	return Math.floor(new Date(value).getTime() / 1000);
}
