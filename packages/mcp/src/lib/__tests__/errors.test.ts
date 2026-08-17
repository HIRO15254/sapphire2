import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import z from "zod";
import { mapToolError } from "../errors";

function textOf(result: ReturnType<typeof mapToolError>): string {
	return result.content[0]?.text ?? "";
}

const BUY_IN_LINE = /^buyIn: /;
const ROOM_ID_LINE = /^roomId: /;
const INPUT_LINE = /^input: /;

describe("mapToolError", () => {
	it("returns an isError text result with no structuredContent", () => {
		const result = mapToolError(new TRPCError({ code: "NOT_FOUND" }), vi.fn());
		expect(result.isError).toBe(true);
		expect(result.content).toHaveLength(1);
		expect(result.content[0]?.type).toBe("text");
		expect("structuredContent" in result).toBe(false);
	});

	it.each([
		new TRPCError({ code: "FORBIDDEN", message: "Room not found" }),
		new TRPCError({
			code: "FORBIDDEN",
			message: "session room-123 belongs to another user",
		}),
		new TRPCError({
			code: "FORBIDDEN",
			cause: new Error("D1_ERROR: no such row"),
		}),
	])("maps every FORBIDDEN to one byte-identical constant text (%#)", (error) => {
		const log = vi.fn();
		const result = mapToolError(error, log);
		expect(textOf(result)).toBe("You do not have access to that resource.");
		expect(log).toHaveBeenCalledTimes(0);
	});

	it("never echoes ids or entity names from FORBIDDEN messages", () => {
		const result = mapToolError(
			new TRPCError({
				code: "FORBIDDEN",
				message: "currency cur-42 not owned",
			}),
			vi.fn()
		);
		expect(textOf(result)).not.toContain("cur-42");
		expect(textOf(result)).not.toContain("currency");
	});

	it("maps NOT_FOUND to an id-free constant", () => {
		const result = mapToolError(
			new TRPCError({ code: "NOT_FOUND", message: "session s-9 missing" }),
			vi.fn()
		);
		expect(textOf(result)).toBe("Not found.");
	});

	it("passes the BAD_REQUEST message through so the model can self-correct", () => {
		const result = mapToolError(
			new TRPCError({
				code: "BAD_REQUEST",
				message: "currencyId is required unless normalized is enabled",
			}),
			vi.fn()
		);
		expect(textOf(result)).toBe(
			"currencyId is required unless normalized is enabled"
		);
	});

	it("compresses a Zod cause into one path: message line per issue", () => {
		const parsed = z
			.object({ buyIn: z.number().int().min(0), roomId: z.string().min(1) })
			.safeParse({ buyIn: -1, roomId: "" });
		expect(parsed.success).toBe(false);
		const result = mapToolError(
			new TRPCError({
				code: "BAD_REQUEST",
				message: "raw json blob",
				cause: parsed.error,
			}),
			vi.fn()
		);
		const lines = textOf(result).split("\n");
		expect(lines).toHaveLength(2);
		expect(lines[0]).toMatch(BUY_IN_LINE);
		expect(lines[1]).toMatch(ROOM_ID_LINE);
	});

	it("labels a root-level Zod issue as input", () => {
		const parsed = z.number().safeParse("nope");
		expect(parsed.success).toBe(false);
		const result = mapToolError(
			new TRPCError({
				code: "BAD_REQUEST",
				message: "raw",
				cause: parsed.error,
			}),
			vi.fn()
		);
		expect(textOf(result)).toMatch(INPUT_LINE);
	});

	it("falls back to the message when the Zod cause has no issues", () => {
		const empty = new z.ZodError([]);
		const result = mapToolError(
			new TRPCError({ code: "BAD_REQUEST", message: "fallback", cause: empty }),
			vi.fn()
		);
		expect(textOf(result)).toBe("fallback");
	});

	it("maps UNAUTHORIZED to a re-authentication prompt", () => {
		const result = mapToolError(
			new TRPCError({ code: "UNAUTHORIZED" }),
			vi.fn()
		);
		expect(textOf(result)).toBe(
			"Your session expired. Re-authenticate and reconnect."
		);
	});

	it.each([
		"CONFLICT",
		"PRECONDITION_FAILED",
	] as const)("passes the %s message through", (code) => {
		const result = mapToolError(
			new TRPCError({ code, message: "already exists" }),
			vi.fn()
		);
		expect(textOf(result)).toBe("already exists");
	});

	it("hides INTERNAL_SERVER_ERROR details and logs the original error once", () => {
		const log = vi.fn();
		const error = new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "D1_ERROR: no such table game_session",
		});
		const result = mapToolError(error, log);
		expect(textOf(result)).toBe("Internal error.");
		expect(textOf(result)).not.toContain("D1_ERROR");
		expect(log).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenNthCalledWith(1, error);
	});

	it("maps a non-TRPC Error to the generic text and logs it once", () => {
		const log = vi.fn();
		const error = new Error("boom with secrets sk-ant-xyz");
		const result = mapToolError(error, log);
		expect(textOf(result)).toBe("Internal error.");
		expect(textOf(result)).not.toContain("sk-ant");
		expect(log).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenNthCalledWith(1, error);
	});

	it.each([
		["a string"],
		[null],
		[undefined],
		[42],
	])("survives a thrown non-Error value (%s)", (value) => {
		const log = vi.fn();
		const result = mapToolError(value, log);
		expect(result.isError).toBe(true);
		expect(textOf(result)).toBe("Internal error.");
		expect(log).toHaveBeenCalledTimes(1);
	});

	it("recognizes a TRPCError from a duplicated @trpc/server instance", () => {
		const foreign = Object.assign(new Error("Room not found"), {
			name: "TRPCError",
			code: "FORBIDDEN",
		});
		const log = vi.fn();
		expect(textOf(mapToolError(foreign, log))).toBe(
			"You do not have access to that resource."
		);
		expect(log).toHaveBeenCalledTimes(0);
	});

	it("surfaces Zod issues from a duplicated-instance BAD_REQUEST", () => {
		const parsed = z.object({ buyIn: z.number() }).safeParse({ buyIn: "x" });
		const foreign = Object.assign(new Error("raw"), {
			name: "TRPCError",
			code: "BAD_REQUEST",
			cause: parsed.success ? undefined : parsed.error,
		});
		expect(textOf(mapToolError(foreign, vi.fn()))).toMatch(BUY_IN_LINE);
	});

	it("does not mistake an unrelated error carrying a code for a TRPCError", () => {
		const log = vi.fn();
		const d1Error = Object.assign(
			new Error("D1_ERROR: no such column: secret"),
			{ code: "BAD_REQUEST" }
		);
		expect(textOf(mapToolError(d1Error, log))).toBe("Internal error.");
		expect(log).toHaveBeenCalledTimes(1);
	});

	it("does not log expected domain errors", () => {
		const log = vi.fn();
		for (const code of [
			"FORBIDDEN",
			"NOT_FOUND",
			"BAD_REQUEST",
			"UNAUTHORIZED",
			"CONFLICT",
			"PRECONDITION_FAILED",
		] as const) {
			mapToolError(new TRPCError({ code, message: "m" }), log);
		}
		expect(log).toHaveBeenCalledTimes(0);
	});
});
