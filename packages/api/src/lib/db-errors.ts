import { TRPCError } from "@trpc/server";

const LABEL_CONFLICT_RE = /UNIQUE constraint failed|label already exists/i;

const UNFINISHED_LIVE_SESSION_CONFLICT_RE =
	/UNIQUE constraint failed:\s*game_session\.user_id/i;
const SESSION_EVENT_ORDER_CONFLICT_RE =
	/UNIQUE constraint failed:\s*session_event\.session_id,\s*session_event\.sort_order/i;

const FILTER_PRESET_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*filter_preset\.user_id,\s*filter_preset\.screen_key,\s*filter_preset\.name/i;

export function isSessionEventOrderConflictError(error: unknown): boolean {
	return (
		error instanceof Error &&
		SESSION_EVENT_ORDER_CONFLICT_RE.test(error.message)
	);
}

export function isUnfinishedLiveSessionConflictError(error: unknown): boolean {
	return (
		error instanceof Error &&
		UNFINISHED_LIVE_SESSION_CONFLICT_RE.test(error.message)
	);
}

export function isLabelConflictError(error: unknown): boolean {
	return error instanceof Error && LABEL_CONFLICT_RE.test(error.message);
}

export function isFilterPresetNameConflictError(error: unknown): boolean {
	return (
		error instanceof Error && FILTER_PRESET_NAME_CONFLICT_RE.test(error.message)
	);
}

export const ACTIVE_SESSION_CONFLICT_MESSAGE =
	"Another session is already active";

export async function runUnfinishedLiveSessionWrite(
	operation: () => Promise<unknown>
): Promise<void> {
	try {
		await operation();
	} catch (error) {
		if (
			isUnfinishedLiveSessionConflictError(error) ||
			isSessionEventOrderConflictError(error)
		) {
			throw new TRPCError({
				code: "CONFLICT",
				message: ACTIVE_SESSION_CONFLICT_MESSAGE,
			});
		}
		throw error;
	}
}
