export interface ToolErrorResult {
	content: { type: "text"; text: string }[];
	isError: true;
	// Index signature required by the SDK's CallToolResult shape.
	[key: string]: unknown;
}

// FORBIDDEN and NOT_FOUND are deliberately constant and id-free: the API's
// ownership checks return uniform errors so callers cannot probe whether an
// entity exists (.claude/rules/api-security.md) — echoing router messages
// here would rebuild that existence oracle at the MCP layer.
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

/**
 * Duck-typed for the same reason as zodIssues below: `instanceof TRPCError`
 * silently returns false if `packages/mcp` and `packages/api` ever resolve
 * separate `@trpc/server` instances, which would collapse every domain error
 * (FORBIDDEN, BAD_REQUEST, …) into the generic internal text and hide Zod
 * feedback from the model. Requiring `name === "TRPCError"` keeps unrelated
 * errors that merely carry a `code` (D1, runtime) out of this branch.
 */
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

/**
 * Duck-typed ZodError detection — tRPC stores the Zod failure on `cause`,
 * and instanceof would break across duplicated zod module instances.
 */
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

/**
 * The single translation point from thrown errors to MCP tool results.
 * Domain errors stay in-band (isError) so the calling model can read and
 * recover from them; anything unexpected is logged and reduced to a generic
 * text that leaks no D1/SQL strings, stack traces, ids or keys.
 */
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
