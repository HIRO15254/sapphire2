import { describe, expect, it, vi } from "vitest";
import {
	ACTIVE_SESSION_CONFLICT_MESSAGE,
	isLabelConflictError,
	isSessionEventOrderConflictError,
	isUnfinishedLiveSessionConflictError,
	runUnfinishedLiveSessionWrite,
} from "../lib/db-errors";

describe("isLabelConflictError", () => {
	it("returns true for a D1-style UNIQUE constraint error (index backstop)", () => {
		const error = new Error(
			"D1_ERROR: UNIQUE constraint failed: game_group.user_id, game_group.label: SQLITE_CONSTRAINT"
		);
		expect(isLabelConflictError(error)).toBe(true);
	});

	it("returns true for the 0041 variant/mix label trigger abort message", () => {
		// game_variant_label_unique_insert / game_mix_label_unique_insert raise
		// this before the unique index is ever evaluated.
		expect(
			isLabelConflictError(new Error("game master label already exists"))
		).toBe(true);
	});

	it("returns true for the 0041 group label trigger abort message", () => {
		expect(
			isLabelConflictError(new Error("game_group label already exists"))
		).toBe(true);
	});

	it("is case-insensitive for both shapes", () => {
		expect(
			isLabelConflictError(
				new Error("unique constraint failed: game_mix.label")
			)
		).toBe(true);
		expect(
			isLabelConflictError(new Error("GAME MASTER LABEL ALREADY EXISTS"))
		).toBe(true);
	});

	it("returns false for an unrelated Error (a real failure must surface)", () => {
		expect(isLabelConflictError(new Error("network timeout"))).toBe(false);
		// The mix-reference trigger is NOT a label collision — must not be
		// swallowed as one.
		expect(
			isLabelConflictError(
				new Error("game_mix contains an unavailable variant")
			)
		).toBe(false);
		expect(
			isLabelConflictError(new Error("game_variant is referenced by a mix"))
		).toBe(false);
	});

	it("returns false for a non-Error value", () => {
		expect(isLabelConflictError("UNIQUE constraint failed")).toBe(false);
		expect(isLabelConflictError(undefined)).toBe(false);
		expect(isLabelConflictError(null)).toBe(false);
	});
});

describe("isSessionEventOrderConflictError", () => {
	it("returns true for the composite session event order violation", () => {
		expect(
			isSessionEventOrderConflictError(
				new Error(
					"D1_ERROR: UNIQUE constraint failed: session_event.session_id, session_event.sort_order: SQLITE_CONSTRAINT"
				)
			)
		).toBe(true);
	});

	it("is case-insensitive", () => {
		expect(
			isSessionEventOrderConflictError(
				new Error(
					"unique constraint failed: SESSION_EVENT.SESSION_ID, SESSION_EVENT.SORT_ORDER"
				)
			)
		).toBe(true);
	});

	it("returns false for unrelated violations and non-Errors", () => {
		expect(
			isSessionEventOrderConflictError(
				new Error("UNIQUE constraint failed: session_event.id")
			)
		).toBe(false);
		expect(isSessionEventOrderConflictError("session event conflict")).toBe(
			false
		);
	});
});
describe("isUnfinishedLiveSessionConflictError", () => {
	it("returns true for the D1 unique violation on game_session.user_id", () => {
		expect(
			isUnfinishedLiveSessionConflictError(
				new Error(
					"D1_ERROR: UNIQUE constraint failed: game_session.user_id: SQLITE_CONSTRAINT"
				)
			)
		).toBe(true);
	});

	it("is case-insensitive", () => {
		expect(
			isUnfinishedLiveSessionConflictError(
				new Error("unique constraint failed: GAME_SESSION.USER_ID")
			)
		).toBe(true);
	});

	it("returns false for unrelated unique violations and non-Errors", () => {
		expect(
			isUnfinishedLiveSessionConflictError(
				new Error("UNIQUE constraint failed: game_session.id")
			)
		).toBe(false);
		expect(
			isUnfinishedLiveSessionConflictError(
				new Error("UNIQUE constraint failed: game_group.user_id")
			)
		).toBe(false);
		expect(
			isUnfinishedLiveSessionConflictError(
				"UNIQUE constraint failed: game_session.user_id"
			)
		).toBe(false);
	});
});

describe("runUnfinishedLiveSessionWrite", () => {
	it("resolves after one successful operation", async () => {
		const operation = vi.fn().mockResolvedValue(undefined);

		await expect(
			runUnfinishedLiveSessionWrite(operation)
		).resolves.toBeUndefined();
		expect(operation).toHaveBeenCalledTimes(1);
	});

	it("maps an unfinished-session unique violation to the domain conflict", async () => {
		const operation = vi
			.fn()
			.mockRejectedValue(
				new Error("UNIQUE constraint failed: game_session.user_id")
			);

		await expect(
			runUnfinishedLiveSessionWrite(operation)
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: ACTIVE_SESSION_CONFLICT_MESSAGE,
		});
		expect(operation).toHaveBeenCalledTimes(1);
	});

	it("maps a session-event order collision to the domain conflict", async () => {
		const operation = vi
			.fn()
			.mockRejectedValue(
				new Error(
					"UNIQUE constraint failed: session_event.session_id, session_event.sort_order"
				)
			);

		await expect(
			runUnfinishedLiveSessionWrite(operation)
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: ACTIVE_SESSION_CONFLICT_MESSAGE,
		});
		expect(operation).toHaveBeenCalledTimes(1);
	});

	it("rethrows an unrelated failure unchanged", async () => {
		const failure = new Error("network timeout");
		const operation = vi.fn().mockRejectedValue(failure);

		await expect(runUnfinishedLiveSessionWrite(operation)).rejects.toBe(
			failure
		);
		expect(operation).toHaveBeenCalledTimes(1);
	});
});
