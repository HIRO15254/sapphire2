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
