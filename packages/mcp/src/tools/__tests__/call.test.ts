import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import { callTool } from "../call";
import { TOOL_DEFINITIONS } from "../registry";

function defByName(name: string) {
	const def = TOOL_DEFINITIONS.find((d) => d.name === name);
	if (!def) {
		throw new Error(`unknown tool in test: ${name}`);
	}
	return def;
}

function createCallerMock(result: unknown = null, error?: unknown) {
	const procedure = error
		? vi.fn().mockRejectedValue(error)
		: vi.fn().mockResolvedValue(result);
	const caller = new Proxy(
		{},
		{
			get: () =>
				new Proxy({}, { get: () => procedure }) as Record<string, unknown>,
		}
	);
	return { caller: caller as never, procedure };
}

/** A caller whose namespaces/procedures are recorded, to assert routing. */
function createRoutedCallerMock(result: unknown = null) {
	const calls: { path: string; input: unknown }[] = [];
	const caller = new Proxy(
		{},
		{
			get: (_target, namespace: string) =>
				new Proxy(
					{},
					{
						get: (_t, procedure: string) => (input: unknown) => {
							calls.push({ path: `${namespace}.${procedure}`, input });
							return Promise.resolve(result);
						},
					}
				),
		}
	);
	return { caller: caller as never, calls };
}

describe("callTool", () => {
	it("routes each tool to its own procedure path", async () => {
		for (const def of TOOL_DEFINITIONS) {
			const { caller, calls } = createRoutedCallerMock({ ok: true });
			await callTool(def, caller, { some: "input" }, vi.fn());
			expect(calls).toEqual([
				{ path: def.procedurePath, input: { some: "input" } },
			]);
		}
	});

	it("forwards the input verbatim with no transformation layer", async () => {
		const { caller, procedure } = createCallerMock({ id: "s1" });
		const input = {
			type: "cash_game",
			sessionDate: 1_753_920_000,
			buyIn: 10_000,
			cashOut: 12_345,
			tagIds: ["t1", "t2"],
		};
		await callTool(
			defByName("session_create_cash_game"),
			caller,
			input,
			vi.fn()
		);
		expect(procedure).toHaveBeenCalledTimes(1);
		expect(procedure).toHaveBeenNthCalledWith(1, input);
	});

	it("passes undefined through for tools called with no arguments", async () => {
		const { caller, procedure } = createCallerMock([]);
		await callTool(defByName("room_list"), caller, undefined, vi.fn());
		expect(procedure).toHaveBeenCalledTimes(1);
		expect(procedure).toHaveBeenNthCalledWith(1, undefined);
	});

	it("serializes the result as the same JSON the HTTP API would return", async () => {
		const { caller } = createCallerMock({
			id: "s1",
			sessionDate: new Date(Date.UTC(2026, 6, 30)),
			memo: null,
			profitLoss: -500,
		});
		const result = await callTool(
			defByName("session_get_by_id"),
			caller,
			{ id: "s1" },
			vi.fn()
		);
		expect(result.isError).toBeUndefined();
		expect(result.content).toEqual([
			{
				type: "text",
				text: '{"id":"s1","sessionDate":"2026-07-30T00:00:00.000Z","memo":null,"profitLoss":-500}',
			},
		]);
	});

	it("serializes empty and zero-ish results faithfully", async () => {
		for (const value of [[], null, 0, { items: [], nextCursor: undefined }]) {
			const { caller } = createCallerMock(value);
			const result = await callTool(
				defByName("session_list"),
				caller,
				{},
				vi.fn()
			);
			expect(result.content[0]?.text).toBe(JSON.stringify(value));
		}
	});

	it("returns an isError result when the procedure throws a domain error", async () => {
		const log = vi.fn();
		const { caller } = createCallerMock(
			null,
			new TRPCError({ code: "FORBIDDEN", message: "room r-1 not owned" })
		);
		const result = await callTool(
			defByName("session_list"),
			caller,
			{ roomId: "r-1" },
			log
		);
		expect(result.isError).toBe(true);
		expect(result.content[0]?.text).toBe(
			"You do not have access to that resource."
		);
		expect(log).toHaveBeenCalledTimes(0);
	});

	it("returns the generic isError result and logs once on unexpected failures", async () => {
		const log = vi.fn();
		const error = new Error("D1_ERROR: no such column");
		const { caller } = createCallerMock(null, error);
		const result = await callTool(
			defByName("stats_summary"),
			caller,
			{ normalized: true },
			log
		);
		expect(result.isError).toBe(true);
		expect(result.content[0]?.text).toBe("Internal error.");
		expect(log).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenNthCalledWith(1, error);
	});
});
