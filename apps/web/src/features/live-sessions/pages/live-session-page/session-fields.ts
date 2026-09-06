import {
	SESSION_STATUSES,
	type SessionStatus,
} from "@sapphire2/db/constants/session-event-types";
import { variantLabel } from "@/features/live-sessions/utils/game-scene-formatters";

export function toSessionStatus(value: string): SessionStatus {
	const match = SESSION_STATUSES.find((status) => status === value);
	return match ?? "completed";
}

export function resolveRuleName(
	ruleName: string | null | undefined,
	variant: string | null | undefined,
	fallback: string
): string {
	const trimmed = ruleName?.trim();
	if (trimmed) {
		return trimmed;
	}
	return variant ? variantLabel(variant) : fallback;
}
