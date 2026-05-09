import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import {
	assertEventAllowedForSource,
	assertLiveSession,
} from "../session-guards";

describe("assertEventAllowedForSource", () => {
	it("throws BAD_REQUEST when source is manual", () => {
		expect(() => assertEventAllowedForSource("manual", "update_stack")).toThrow(
			TRPCError
		);
	});

	it("includes the event type in the error message when source is manual", () => {
		try {
			assertEventAllowedForSource("manual", "purchase_chips");
			expect.fail("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(TRPCError);
			const trpcErr = err as TRPCError;
			expect(trpcErr.code).toBe("BAD_REQUEST");
			expect(trpcErr.message).toContain("purchase_chips");
		}
	});

	it("does not throw when source is live", () => {
		expect(() =>
			assertEventAllowedForSource("live", "update_stack")
		).not.toThrow();
	});

	it("does not throw for any event type when source is live", () => {
		const eventTypes = [
			"session_start",
			"session_end",
			"session_pause",
			"session_resume",
			"chips_add_remove",
			"all_in",
			"purchase_chips",
			"update_stack",
			"player_join",
			"player_leave",
			"memo",
		] as const;

		for (const eventType of eventTypes) {
			expect(() =>
				assertEventAllowedForSource("live", eventType)
			).not.toThrow();
		}
	});
});

describe("assertLiveSession", () => {
	it("throws BAD_REQUEST when source is manual", () => {
		expect(() => assertLiveSession("manual")).toThrow(TRPCError);
	});

	it("sets code to BAD_REQUEST when source is manual", () => {
		try {
			assertLiveSession("manual");
			expect.fail("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(TRPCError);
			const trpcErr = err as TRPCError;
			expect(trpcErr.code).toBe("BAD_REQUEST");
		}
	});

	it("does not throw when source is live", () => {
		expect(() => assertLiveSession("live")).not.toThrow();
	});

	it("returns void (no return value) when source is live", () => {
		const result = assertLiveSession("live");
		expect(result).toBeUndefined();
	});
});
