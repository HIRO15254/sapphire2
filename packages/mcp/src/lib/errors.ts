export interface ToolErrorResult {
	content: { type: "text"; text: string }[];
	isError: true;
	[key: string]: unknown;
}

const FORBIDDEN_TEXT = "You do not have access to that resource.";
const NOT_FOUND_TEXT = "Not found.";
const UNAUTHORIZED_TEXT =
	"Your session expired. Re-authenticate and reconnect.";
const INTERNAL_TEXT = "Internal error.";

interface ZodLikeIssue {
	message: string;
	path: PropertyKey[];
}

interface TrpcLikeError {
	cause?: unknown;
	code: string;
	message: string;
}

function asTrpcError(error: unknown): TrpcLikeError | undefined {
	if (
		typeof error === "object" &&
		error !== null &&
		(error as { name?: unknown }).name === "TRPCError" &&
		typeof (error as { code?: unknown }).code === "string"
	) {
		return error as TrpcLikeError;
	}
	return undefined;
}

function zodIssues(cause: unknown): ZodLikeIssue[] | undefined {
	if (
		typeof cause === "object" &&
		cause !== null &&
		"issues" in cause &&
		Array.isArray((cause as { issues: unknown }).issues)
	) {
		return (cause as { issues: ZodLikeIssue[] }).issues;
	}
	return undefined;
}

function badRequestText(error: TrpcLikeError): string {
	const issues = zodIssues(error.cause);
	if (issues && issues.length > 0) {
		return issues
			.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
			.join("\n");
	}
	return error.message;
}

function toolError(text: string): ToolErrorResult {
	return { isError: true, content: [{ type: "text", text }] };
}

export function mapToolError(
	error: unknown,
	log: (error: unknown) => void
): ToolErrorResult {
	const trpcError = asTrpcError(error);
	if (trpcError) {
		switch (trpcError.code) {
			case "FORBIDDEN":
				return toolError(FORBIDDEN_TEXT);
			case "NOT_FOUND":
				return toolError(NOT_FOUND_TEXT);
			case "BAD_REQUEST":
				return toolError(badRequestText(trpcError));
			case "UNAUTHORIZED":
				return toolError(UNAUTHORIZED_TEXT);
			case "CONFLICT":
			case "PRECONDITION_FAILED":
				return toolError(trpcError.message);
			default:
				break;
		}
	}
	log(error);
	return toolError(INTERNAL_TEXT);
}
