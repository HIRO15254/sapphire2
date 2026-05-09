import type { SessionEventType } from "@sapphire2/db/constants/session-event-types";
import { TRPCError } from "@trpc/server";

export function assertEventAllowedForSource(
	source: "live" | "manual",
	eventType: SessionEventType
): void {
	if (source === "manual") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Event "${eventType}" cannot be created on a manual session`,
		});
	}
}

export function assertLiveSession(
	source: "live" | "manual"
): asserts source is "live" {
	if (source !== "live") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "This operation is only available on live sessions",
		});
	}
}
